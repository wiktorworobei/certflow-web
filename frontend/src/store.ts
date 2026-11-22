import { configureStore, createSlice, type Middleware, type PayloadAction } from '@reduxjs/toolkit';
import {
  createApi,
  fetchBaseQuery,
  type BaseQueryFn,
  type FetchArgs,
  type FetchBaseQueryError,
} from '@reduxjs/toolkit/query/react';
import type {
  AuthResponse,
  Profile,
  Dashboard,
  Declaration,
  DeclarationRow,
  SaveDeclaration,
  Filters,
  Page,
  Organization,
  OrganizationInput,
  Laboratory,
  LaboratoryFilters,
  TeamUser,
  Integration,
  Status,
  OrganizationLookupResult,
  DaDataSettings,
} from './types';
import type {
  MarkingSettings,
  MarkingConnections,
  MarkingLink,
  SaveMarkingLink,
  MarkingBatch,
} from './types';
import type { ArchiveAction } from './types';
import { API_BASE_URL, apiUrl } from './apiUrl';
import type { LinkedCertificate } from './certificateAuthentication';
import type { DeclarationPrintLayout } from './types';
import type { OrganizationRegistryComparison } from './types';
import {
  assertRequestScope,
  captureRequestScope,
  isRequestScopeCurrent,
  requestMatchesFirm,
} from './requestScope';

interface Session {
  token: string | null;
  user: Profile | null;
  firmId: string;
  ready: boolean;
  authEpoch: number;
  workspaceEpoch: number;
}
function storedFirm() {
  try {
    return localStorage.getItem('certflow.firm') ?? '';
  } catch {
    return '';
  }
}
function persistFirm(firmId: string) {
  try {
    localStorage.setItem('certflow.firm', firmId);
  } catch {
    /* Storage is optional; authentication stays in memory. */
  }
}
const sessionSlice = createSlice({
  name: 'session',
  initialState: {
    token: null,
    user: null,
    firmId: storedFirm(),
    ready: false,
    authEpoch: 0,
    workspaceEpoch: 0,
  } as Session,
  reducers: {
    authenticated(state, action: PayloadAction<AuthResponse>) {
      if (state.user?.id !== action.payload.user.id) {
        state.authEpoch++;
        state.workspaceEpoch++;
      }
      const previousFirm = state.firmId;
      state.token = action.payload.accessToken;
      state.user = action.payload.user;
      state.ready = true;
      if (!state.user.firms.some((f) => f.id === state.firmId))
        state.firmId = state.user.firms[0]?.id ?? '';
      if (previousFirm !== state.firmId) state.workspaceEpoch++;
      persistFirm(state.firmId);
    },
    signedOut(state) {
      state.token = null;
      state.user = null;
      state.ready = true;
      state.authEpoch++;
      state.workspaceEpoch++;
    },
    selectFirm(state, action: PayloadAction<string>) {
      if (
        state.user?.firms.some((firm) => firm.id === action.payload) &&
        state.firmId !== action.payload
      ) {
        state.firmId = action.payload;
        state.workspaceEpoch++;
        persistFirm(state.firmId);
      }
    },
  },
});
export const { authenticated, signedOut, selectFirm } = sessionSlice.actions;
const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL,
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as { session: Session }).session.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Requested-With', 'CertFlow');
    return headers;
  },
});
let refreshPromise: Promise<AuthResponse | null> | null = null;
let refreshEpoch = -1;
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (
  args,
  api,
  extra,
) => {
  const original = (api.getState() as { session: Session }).session;
  const scope = captureRequestScope(original);
  const url = typeof args === 'string' ? args : args.url;
  const stale = (): { error: FetchBaseQueryError } => ({
    error: {
      status: 'CUSTOM_ERROR',
      error: 'Пользователь или компания изменились. Повторите действие.',
    },
  });
  const current = () =>
    isRequestScopeCurrent(scope, (api.getState() as { session: Session }).session);
  if (!requestMatchesFirm(url, original.firmId)) return stale();
  let result = await rawBaseQuery(args, api, extra);
  if (!current()) return stale();
  if (
    result.error?.status === 401 &&
    (!url.startsWith('/auth/') || url.startsWith('/auth/certificates'))
  ) {
    const currentToken = (api.getState() as { session: Session }).session.token;
    if ((currentToken && currentToken !== original.token) || (await refreshIntegrationSession())) {
      if (!current() || api.signal.aborted) return stale();
      result = await rawBaseQuery(args, api, extra);
    }
  }
  return current() ? result : stale();
};
const firmUrl = (firmId: string, path: string) => `/firms/${firmId}${path}`;
export const api = createApi({
  reducerPath: 'api',
  baseQuery,
  tagTypes: [
    'Declarations',
    'Directories',
    'Team',
    'Integrations',
    'PersonalIntegrations',
    'Marking',
    'RegistryRequests',
    'RegistryMonitoring',
    'RegistryNotifications',
  ],
  endpoints: (b) => ({
    instruction: b.query<{ content: string; revision: string }, string>({
      query: (id) => firmUrl(id, '/instruction'),
      keepUnusedDataFor: 0,
    }),
    saveInstruction: b.mutation<
      { content: string; revision: string },
      { firmId: string; content: string; revision: string }
    >({
      query: ({ firmId, ...body }) => ({
        url: firmUrl(firmId, '/instruction'),
        method: 'PUT',
        body,
      }),
    }),
    printFields: b.query<
      { key: string; label: string; text: string }[],
      { firmId: string; id: string; revision: number }
    >({
      query: ({ firmId, id, revision }) => ({
        url: firmUrl(firmId, `/declarations/${id}/print-fields`),
        params: { revision },
      }),
      keepUnusedDataFor: 0,
    }),
    declarationPreview: b.mutation<
      DeclarationPrintLayout,
      { firmId: string; id?: string; data: SaveDeclaration }
    >({
      query: ({ firmId, id, data }) => ({
        url: firmUrl(firmId, '/declarations/preview'),
        params: id ? { id } : undefined,
        method: 'POST',
        body: data,
      }),
    }),
    certificates: b.query<LinkedCertificate[], void>({
      query: () => '/auth/certificates/',
      keepUnusedDataFor: 0,
    }),
    dashboard: b.query<Dashboard, string>({
      query: (id) => firmUrl(id, '/dashboard'),
      providesTags: ['Declarations', 'Directories'],
    }),
    declarations: b.query<Page<DeclarationRow>, { firmId: string; filters: Filters }>({
      query: ({ firmId, filters }) => ({ url: firmUrl(firmId, '/declarations/'), params: filters }),
      providesTags: ['Declarations'],
    }),
    declaration: b.query<Declaration, { firmId: string; id: string }>({
      query: ({ firmId, id }) => firmUrl(firmId, `/declarations/${id}`),
      providesTags: ['Declarations'],
    }),
    saveDeclaration: b.mutation<
      Declaration,
      { firmId: string; id?: string; data: SaveDeclaration }
    >({
      query: ({ firmId, id, data }) => ({
        url: firmUrl(firmId, `/declarations/${id ?? ''}`),
        method: id ? 'PUT' : 'POST',
        body: data,
      }),
      invalidatesTags: ['Declarations'],
    }),
    copyDeclaration: b.mutation<Declaration, { firmId: string; id: string }>({
      query: ({ firmId, id }) => ({
        url: firmUrl(firmId, `/declarations/${id}/copy`),
        method: 'POST',
      }),
      invalidatesTags: ['Declarations'],
    }),
    applyDeclarationFields: b.mutation<
      { count: number },
      {
        firmId: string;
        id: string;
        revision: number;
        items: { id: string; revision: number }[];
        fields: string[];
      }
    >({
      query: ({ firmId, id, ...body }) => ({
        url: firmUrl(firmId, `/declarations/${id}/apply-fields`),
        method: 'POST',
        body,
      }),
      invalidatesTags: (result) => (result ? ['Declarations'] : []),
    }),
    changeStatus: b.mutation<
      Declaration,
      {
        firmId: string;
        id: string;
        status: Status;
        revision: number;
        reason?: string;
        registrationNumber?: string;
        registryUrl?: string;
      }
    >({
      query: ({ firmId, id, ...body }) => ({
        url: firmUrl(firmId, `/declarations/${id}/status`),
        method: 'POST',
        body,
      }),
      invalidatesTags: ['Declarations'],
    }),
    archiveDeclarations: b.mutation<
      { count: number; pendingFiles: number },
      {
        firmId: string;
        items: { id: string; revision: number }[];
        reason: string;
        action: ArchiveAction;
      }
    >({
      query: ({ firmId, action, ...body }) => ({
        url: firmUrl(firmId, `/declarations/archive${action === 'archive' ? '' : `/${action}`}`),
        method: 'POST',
        body: { ...body, confirmPermanentDeletion: action === 'purge' },
      }),
      invalidatesTags: ['Declarations', 'Marking'],
    }),
    upload: b.mutation<Declaration, { firmId: string; id: string; file: File }>({
      query: ({ firmId, id, file }) => {
        const body = new FormData();
        body.append('file', file);
        return { url: firmUrl(firmId, `/declarations/${id}/attachments`), method: 'POST', body };
      },
      invalidatesTags: ['Declarations'],
    }),
    removeAttachment: b.mutation<void, { firmId: string; id: string; attachmentId: string }>({
      query: ({ firmId, id, attachmentId }) => ({
        url: firmUrl(firmId, `/declarations/${id}/attachments/${attachmentId}`),
        method: 'DELETE',
      }),
      invalidatesTags: ['Declarations'],
    }),
    organizations: b.query<Organization[], string>({
      query: (id) => firmUrl(id, '/organizations/'),
      providesTags: ['Directories'],
    }),
    archivedOrganizations: b.query<Organization[], string>({
      query: (id) => ({ url: firmUrl(id, '/organizations/'), params: { archived: true } }),
      providesTags: ['Directories'],
    }),
    archiveOrganizations: b.mutation<
      { count: number; pendingFiles: number },
      {
        firmId: string;
        items: { id: string; revision: string }[];
        reason: string;
        action: ArchiveAction;
      }
    >({
      query: ({ firmId, action, ...body }) => ({
        url: firmUrl(firmId, `/organizations/archive${action === 'archive' ? '' : `/${action}`}`),
        method: 'POST',
        body: { ...body, confirmPermanentDeletion: action === 'purge' },
      }),
      invalidatesTags: ['Directories'],
    }),
    matchOrganization: b.query<
      { organization: Organization | null },
      { firmId: string; inn: string; ogrn: string; kpp: string }
    >({
      query: ({ firmId, inn, ogrn, kpp }) => ({
        url: firmUrl(firmId, '/organizations/match'),
        params: { inn: inn.trim(), ogrn: ogrn.trim(), kpp: kpp.trim() },
        cache: 'no-store',
      }),
      keepUnusedDataFor: 0,
    }),
    lookupOrganization: b.mutation<
      OrganizationLookupResult,
      { firmId: string; query: string; kpp?: string }
    >({
      query: ({ firmId, ...body }) => ({
        url: firmUrl(firmId, '/organizations/lookup'),
        method: 'POST',
        body,
      }),
    }),
    saveOrganization: b.mutation<
      Organization,
      { firmId: string; id?: string; data: OrganizationInput }
    >({
      query: ({ firmId, id, data }) => ({
        url: firmUrl(firmId, `/organizations/${id ?? ''}`),
        method: id ? 'PUT' : 'POST',
        body: data,
      }),
      invalidatesTags: ['Directories'],
    }),
    deleteOrganization: b.mutation<void, { firmId: string; id: string }>({
      query: ({ firmId, id }) => ({
        url: firmUrl(firmId, `/organizations/${id}`),
        method: 'DELETE',
      }),
      invalidatesTags: ['Directories'],
    }),
    refreshOrganization: b.mutation<
      Organization,
      { firmId: string; id: string; overwriteManualFields: boolean }
    >({
      query: ({ firmId, id, overwriteManualFields }) => ({
        url: firmUrl(firmId, `/organizations/${id}/refresh`),
        method: 'POST',
        params: { overwriteManualFields },
      }),
      invalidatesTags: ['Directories'],
    }),
    organizationRefreshSchedule: b.query<
      { enabled: boolean; hour: number; timeZoneId: string },
      string
    >({ query: (id) => firmUrl(id, '/organizations/refresh-schedule') }),
    organizationChanges: b.query<OrganizationRegistryComparison, { firmId: string; id: string }>({
      query: ({ firmId, id }) => ({
        url: firmUrl(firmId, `/organizations/${id}/changes`),
        cache: 'no-store',
      }),
      providesTags: ['Directories'],
      keepUnusedDataFor: 0,
    }),
    laboratories: b.query<Laboratory[], string>({
      query: (id) => firmUrl(id, '/laboratories/'),
      providesTags: ['Directories'],
    }),
    laboratorySearch: b.query<Page<Laboratory>, LaboratoryFilters>({
      query: ({ firmId, ...params }) => ({ url: firmUrl(firmId, '/laboratories/search'), params }),
      providesTags: ['Directories'],
    }),
    deleteLaboratory: b.mutation<void, { firmId: string; id: string }>({
      query: ({ firmId, id }) => ({
        url: firmUrl(firmId, `/laboratories/${id}`),
        method: 'DELETE',
      }),
      invalidatesTags: ['Directories'],
    }),
    saveLaboratory: b.mutation<
      Laboratory,
      {
        firmId: string;
        id?: string;
        data: Omit<Laboratory, 'id' | 'firmId'> & { acceptRegistryOverride?: boolean };
      }
    >({
      query: ({ firmId, id, data }) => ({
        url: firmUrl(firmId, `/laboratories/${id ?? ''}`),
        method: id ? 'PUT' : 'POST',
        body: data,
      }),
      invalidatesTags: ['Directories'],
    }),
    team: b.query<TeamUser[], string>({
      query: (id) => firmUrl(id, '/team/'),
      providesTags: ['Team'],
    }),
    createUser: b.mutation<
      TeamUser,
      {
        firmId: string;
        userName: string;
        displayName: string;
        email: string;
        password: string;
        role: string;
      }
    >({
      query: ({ firmId, ...body }) => ({ url: firmUrl(firmId, '/team/'), method: 'POST', body }),
      invalidatesTags: ['Team'],
    }),
    integrations: b.query<Integration[], string>({
      query: (id) => firmUrl(id, '/integrations'),
      providesTags: ['Integrations'],
    }),
    daDataSettings: b.query<DaDataSettings, void>({
      query: () => '/me/integrations/dadata/',
      providesTags: ['PersonalIntegrations'],
    }),
    deleteDaDataKey: b.mutation<DaDataSettings, void>({
      query: () => ({ url: '/me/integrations/dadata/', method: 'DELETE' }),
      invalidatesTags: ['Integrations', 'PersonalIntegrations'],
    }),
    checkDaDataKey: b.mutation<DaDataSettings, void>({
      query: () => ({ url: '/me/integrations/dadata/check', method: 'POST' }),
      invalidatesTags: ['Integrations', 'PersonalIntegrations'],
    }),
    markingSettings: b.query<MarkingSettings, string>({
      query: (id) => firmUrl(id, '/marking/settings'),
      providesTags: ['Marking'],
    }),
    saveMarkingSettings: b.mutation<
      MarkingSettings,
      { firmId: string; data: Omit<MarkingSettings, 'profile' | 'updatedAtUtc'> }
    >({
      query: ({ firmId, data }) => ({
        url: firmUrl(firmId, '/marking/settings'),
        method: 'PUT',
        body: data,
      }),
      invalidatesTags: ['Marking', 'Integrations'],
    }),
    markingConnections: b.query<MarkingConnections, string>({
      query: (id) => firmUrl(id, '/marking/connections'),
      providesTags: ['Marking'],
      keepUnusedDataFor: 0,
    }),
    markingLinks: b.query<MarkingLink[], { firmId: string; declarationId?: string }>({
      query: ({ firmId, declarationId }) => ({
        url: firmUrl(firmId, '/marking/links'),
        params: { declarationId },
      }),
      providesTags: ['Marking'],
    }),
    markingBatches: b.query<
      Page<MarkingBatch>,
      { firmId: string; search?: string; declarationId?: string; page: number }
    >({
      query: ({ firmId, ...params }) => ({
        url: firmUrl(firmId, '/marking/batches'),
        params: { ...params, pageSize: 10 },
      }),
      providesTags: ['Marking'],
    }),
    markingBatch: b.query<MarkingBatch, { firmId: string; id: string }>({
      query: ({ firmId, id }) => firmUrl(firmId, `/marking/batches/${id}`),
      providesTags: ['Marking'],
      keepUnusedDataFor: 0,
    }),
    saveMarkingLink: b.mutation<MarkingLink, { firmId: string; data: SaveMarkingLink }>({
      query: ({ firmId, data }) => ({
        url: firmUrl(firmId, '/marking/links'),
        method: 'POST',
        body: data,
      }),
      invalidatesTags: ['Marking'],
    }),
    deleteMarkingLink: b.mutation<void, { firmId: string; id: string }>({
      query: ({ firmId, id }) => ({
        url: firmUrl(firmId, `/marking/links/${id}`),
        method: 'DELETE',
      }),
      invalidatesTags: ['Marking'],
    }),
  }),
});
const resetWorkspaceCache: Middleware<{}, { session: Session }> = (state) => (next) => (action) => {
  const previous = state.getState().session;
  const result = next(action);
  const current = state.getState().session;
  if (
    previous.authEpoch !== current.authEpoch ||
    previous.workspaceEpoch !== current.workspaceEpoch
  ) {
    state.dispatch(api.util.resetApiState());
  }
  return result;
};
export const store = configureStore({
  reducer: { session: sessionSlice.reducer, [api.reducerPath]: api.reducer },
  middleware: (g) => g().concat(resetWorkspaceCache, api.middleware),
});
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Keep a newly entered secret out of Redux mutation arguments and DevTools action history.
export async function savePersonalDaDataKey(apiKey: string): Promise<DaDataSettings> {
  const session = store.getState().session;
  const scope = captureRequestScope(session);
  const ensureCurrent = () => assertRequestScope(scope, store.getState().session, false);
  const send = () => {
    ensureCurrent();
    return fetch(apiUrl('/me/integrations/dadata/'), {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'CertFlow',
        Authorization: `Bearer ${store.getState().session.token}`,
      },
      body: JSON.stringify({ apiKey }),
    });
  };
  let response = await send();
  ensureCurrent();
  if (response.status === 401) {
    if (store.getState().session.token === session.token && !(await refreshIntegrationSession()))
      throw { status: 401, data: { detail: 'Войдите в аккаунт.' } };
    response = await send();
    ensureCurrent();
  }
  if (!response.ok)
    throw { status: response.status, data: await response.json().catch(() => ({})) };
  const settings = (await response.json()) as DaDataSettings;
  ensureCurrent();
  store.dispatch(api.util.invalidateTags(['Integrations', 'PersonalIntegrations']));
  return settings;
}

export async function authRequest<T = AuthResponse>(path: string, body?: unknown): Promise<T> {
  const scope = captureRequestScope(store.getState().session);
  const response = await fetch(apiUrl(`/auth/${path}`), {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'CertFlow',
      ...(store.getState().session.token
        ? { Authorization: `Bearer ${store.getState().session.token}` }
        : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  assertRequestScope(scope, store.getState().session, false);
  if (!response.ok)
    throw { status: response.status, data: await response.json().catch(() => ({})) };
  const result = response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  assertRequestScope(scope, store.getState().session, false);
  return result;
}
export async function bootstrapSession() {
  await refreshIntegrationSession();
}
export async function refreshIntegrationSession(): Promise<boolean> {
  const scope = captureRequestScope(store.getState().session);
  if (!refreshPromise || refreshEpoch !== scope.authEpoch) {
    refreshEpoch = scope.authEpoch;
    const pending = (async () => {
      try {
        const auth = await authRequest('refresh');
        assertRequestScope(scope, store.getState().session, false);
        if (scope.userId && scope.userId !== auth.user.id)
          throw new Error('Учётная запись изменилась. Повторите вход.');
        store.dispatch(authenticated(auth));
        return auth;
      } catch {
        if (isRequestScopeCurrent(scope, store.getState().session, false))
          store.dispatch(signedOut());
        return null;
      }
    })();
    refreshPromise = pending;
    void pending.finally(() => {
      if (refreshPromise === pending) refreshPromise = null;
    });
  }
  return !!(await refreshPromise);
}
export async function documentBlob(path: string): Promise<Blob> {
  const session = store.getState().session;
  const scope = captureRequestScope(session);
  const ensureCurrent = () => assertRequestScope(scope, store.getState().session);
  if (!requestMatchesFirm(path, session.firmId))
    throw new Error('Документ принадлежит другому рабочему пространству.');
  let response = await fetch(apiUrl(path), {
    headers: { Authorization: `Bearer ${store.getState().session.token}` },
    credentials: 'include',
  });
  ensureCurrent();
  if (response.status === 401) {
    if (store.getState().session.token === session.token && !(await refreshIntegrationSession()))
      throw { status: 401 };
    ensureCurrent();
    response = await fetch(apiUrl(path), {
      headers: { Authorization: `Bearer ${store.getState().session.token}` },
      credentials: 'include',
    });
    ensureCurrent();
  }
  if (!response.ok)
    throw { status: response.status, data: await response.json().catch(() => ({})) };
  const blob = await response.blob();
  ensureCurrent();
  return blob;
}
export async function download(path: string, filename: string) {
  const blob = await documentBlob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
