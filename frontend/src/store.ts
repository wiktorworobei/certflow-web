import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createApi, fetchBaseQuery, type BaseQueryFn, type FetchArgs, type FetchBaseQueryError } from '@reduxjs/toolkit/query/react';
import type { AuthResponse, Profile, Dashboard, Declaration, DeclarationRow, SaveDeclaration, Filters, Page, Organization, OrganizationInput, Laboratory, TeamUser, Integration, Status, OrganizationLookupResult, DaDataSettings } from './types';
import type { MarkingSettings, MarkingConnections, MarkingLink, SaveMarkingLink, MarkingBatch } from './types';
import { API_BASE_URL, apiUrl } from './apiUrl';

interface Session { token: string | null; user: Profile | null; firmId: string; ready: boolean }
const sessionSlice = createSlice({
  name: 'session',
  initialState: { token: null, user: null, firmId: localStorage.getItem('certflow.firm') ?? '', ready: false } as Session,
  reducers: {
    authenticated(state, action: PayloadAction<AuthResponse>) {
      state.token = action.payload.accessToken; state.user = action.payload.user; state.ready = true;
      if (!state.user.firms.some(f => f.id === state.firmId)) state.firmId = state.user.firms[0]?.id ?? '';
      localStorage.setItem('certflow.firm', state.firmId);
    },
    signedOut(state) { state.token = null; state.user = null; state.ready = true; },
    selectFirm(state, action: PayloadAction<string>) { state.firmId = action.payload; localStorage.setItem('certflow.firm', action.payload); },
  },
});
export const { authenticated, signedOut, selectFirm } = sessionSlice.actions;
const rawBaseQuery = fetchBaseQuery({
  baseUrl: API_BASE_URL, credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as { session: Session }).session.token;
    if (token) headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Requested-With', 'CertFlow'); return headers;
  },
});
let refreshPromise: Promise<AuthResponse | null> | null = null;
const baseQuery: BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError> = async (args, api, extra) => {
  const originalToken = (api.getState() as { session: Session }).session.token;
  let result = await rawBaseQuery(args, api, extra);
  const url = typeof args === 'string' ? args : args.url;
  if (result.error?.status === 401 && !url.startsWith('/auth/')) {
    const currentToken = (api.getState() as { session: Session }).session.token;
    if (currentToken && currentToken !== originalToken) return rawBaseQuery(args, api, extra);
    if (!refreshPromise) refreshPromise = (async () => {
      const refresh = await rawBaseQuery({ url: '/auth/refresh', method: 'POST' }, api, extra);
      if (refresh.data) { const data = refresh.data as AuthResponse; api.dispatch(authenticated(data)); return data; }
      api.dispatch(signedOut()); return null;
    })().finally(() => { refreshPromise = null; });
    if (await refreshPromise) result = await rawBaseQuery(args, api, extra);
  }
  return result;
};
const firmUrl = (firmId: string, path: string) => `/firms/${firmId}${path}`;
export const api = createApi({
  reducerPath: 'api', baseQuery, tagTypes: ['Declarations', 'Directories', 'Team', 'Integrations', 'PersonalIntegrations', 'Marking'],
  endpoints: b => ({
    dashboard: b.query<Dashboard, string>({ query: id => firmUrl(id, '/dashboard'), providesTags: ['Declarations', 'Directories'] }),
    declarations: b.query<Page<DeclarationRow>, { firmId: string; filters: Filters }>({ query: ({ firmId, filters }) => ({ url: firmUrl(firmId, '/declarations/'), params: filters }), providesTags: ['Declarations'] }),
    declaration: b.query<Declaration, { firmId: string; id: string }>({ query: ({ firmId, id }) => firmUrl(firmId, `/declarations/${id}`), providesTags: ['Declarations'] }),
    saveDeclaration: b.mutation<Declaration, { firmId: string; id?: string; data: SaveDeclaration }>({ query: ({ firmId, id, data }) => ({ url: firmUrl(firmId, `/declarations/${id ?? ''}`), method: id ? 'PUT' : 'POST', body: data }), invalidatesTags: ['Declarations'] }),
    copyDeclaration: b.mutation<Declaration, { firmId: string; id: string }>({ query: ({ firmId, id }) => ({ url: firmUrl(firmId, `/declarations/${id}/copy`), method: 'POST' }), invalidatesTags: ['Declarations'] }),
    changeStatus: b.mutation<Declaration, { firmId: string; id: string; status: Status; revision: number; reason?: string; registrationNumber?: string; registryUrl?: string }>({ query: ({ firmId, id, ...body }) => ({ url: firmUrl(firmId, `/declarations/${id}/status`), method: 'POST', body }), invalidatesTags: ['Declarations'] }),
    archiveDeclarations: b.mutation<{ count: number; pendingFiles: number }, { firmId: string; items: { id: string; revision: number }[]; reason: string; purge: boolean }>({ query: ({ firmId, purge, ...body }) => ({ url: firmUrl(firmId, `/declarations/archive${purge ? '/purge' : ''}`), method: 'POST', body: { ...body, confirmPermanentDeletion: purge } }), invalidatesTags: ['Declarations', 'Marking'] }),
    upload: b.mutation<Declaration, { firmId: string; id: string; file: File }>({ query: ({ firmId, id, file }) => { const body = new FormData(); body.append('file', file); return { url: firmUrl(firmId, `/declarations/${id}/attachments`), method: 'POST', body }; }, invalidatesTags: ['Declarations'] }),
    removeAttachment: b.mutation<void, { firmId: string; id: string; attachmentId: string }>({ query: ({ firmId, id, attachmentId }) => ({ url: firmUrl(firmId, `/declarations/${id}/attachments/${attachmentId}`), method: 'DELETE' }), invalidatesTags: ['Declarations'] }),
    organizations: b.query<Organization[], string>({ query: id => firmUrl(id, '/organizations/'), providesTags: ['Directories'] }),
    archivedOrganizations: b.query<Organization[], string>({ query: id => ({ url: firmUrl(id, '/organizations/'), params: { archived: true } }), providesTags: ['Directories'] }),
    archiveOrganizations: b.mutation<{ count: number; pendingFiles: number }, { firmId: string; items: { id: string; revision: string }[]; reason: string; purge: boolean }>({ query: ({ firmId, purge, ...body }) => ({ url: firmUrl(firmId, `/organizations/archive${purge ? '/purge' : ''}`), method: 'POST', body: { ...body, confirmPermanentDeletion: purge } }), invalidatesTags: ['Directories'] }),
    matchOrganization: b.query<{ organization: Organization | null }, { firmId: string; inn: string; ogrn: string; kpp: string }>({ query: ({ firmId, inn, ogrn, kpp }) => ({ url: firmUrl(firmId, '/organizations/match'), params: { inn: inn.trim(), ogrn: ogrn.trim(), kpp: kpp.trim() }, cache: 'no-store' }), keepUnusedDataFor: 0 }),
    lookupOrganization: b.mutation<OrganizationLookupResult, { firmId: string; query: string; kpp?: string }>({ query: ({ firmId, ...body }) => ({ url: firmUrl(firmId, '/organizations/lookup'), method: 'POST', body }) }),
    saveOrganization: b.mutation<Organization, { firmId: string; id?: string; data: OrganizationInput }>({ query: ({ firmId, id, data }) => ({ url: firmUrl(firmId, `/organizations/${id ?? ''}`), method: id ? 'PUT' : 'POST', body: data }), invalidatesTags: ['Directories'] }),
    deleteOrganization: b.mutation<void, { firmId: string; id: string }>({ query: ({ firmId, id }) => ({ url: firmUrl(firmId, `/organizations/${id}`), method: 'DELETE' }), invalidatesTags: ['Directories'] }),
    refreshOrganization: b.mutation<Organization, { firmId: string; id: string }>({ query: ({ firmId, id }) => ({ url: firmUrl(firmId, `/organizations/${id}/refresh`), method: 'POST' }), invalidatesTags: ['Directories'] }),
    organizationRefreshSchedule: b.query<{ enabled: boolean; hour: number; timeZoneId: string }, string>({ query: id => firmUrl(id, '/organizations/refresh-schedule') }),
    laboratories: b.query<Laboratory[], string>({ query: id => firmUrl(id, '/laboratories/'), providesTags: ['Directories'] }),
    deleteLaboratory: b.mutation<void, { firmId: string; id: string }>({ query: ({ firmId, id }) => ({ url: firmUrl(firmId, `/laboratories/${id}`), method: 'DELETE' }), invalidatesTags: ['Directories'] }),
    saveLaboratory: b.mutation<Laboratory, { firmId: string; id?: string; data: Omit<Laboratory, 'id' | 'firmId'> }>({ query: ({ firmId, id, data }) => ({ url: firmUrl(firmId, `/laboratories/${id ?? ''}`), method: id ? 'PUT' : 'POST', body: data }), invalidatesTags: ['Directories'] }),
    team: b.query<TeamUser[], string>({ query: id => firmUrl(id, '/team/'), providesTags: ['Team'] }),
    createUser: b.mutation<TeamUser, { firmId: string; userName: string; displayName: string; email: string; password: string; role: string }>({ query: ({ firmId, ...body }) => ({ url: firmUrl(firmId, '/team/'), method: 'POST', body }), invalidatesTags: ['Team'] }),
    integrations: b.query<Integration[], string>({ query: id => firmUrl(id, '/integrations'), providesTags: ['Integrations'] }),
    daDataSettings: b.query<DaDataSettings, void>({ query: () => '/me/integrations/dadata/', providesTags: ['PersonalIntegrations'] }),
    deleteDaDataKey: b.mutation<DaDataSettings, void>({ query: () => ({ url: '/me/integrations/dadata/', method: 'DELETE' }), invalidatesTags: ['Integrations', 'PersonalIntegrations'] }),
    checkDaDataKey: b.mutation<DaDataSettings, void>({ query: () => ({ url: '/me/integrations/dadata/check', method: 'POST' }), invalidatesTags: ['Integrations', 'PersonalIntegrations'] }),
    markingSettings: b.query<MarkingSettings, string>({ query: id => firmUrl(id, '/marking/settings'), providesTags: ['Marking'] }),
    saveMarkingSettings: b.mutation<MarkingSettings, { firmId: string; data: Omit<MarkingSettings, 'profile' | 'updatedAtUtc'> }>({ query: ({ firmId, data }) => ({ url: firmUrl(firmId, '/marking/settings'), method: 'PUT', body: data }), invalidatesTags: ['Marking', 'Integrations'] }),
    markingConnections: b.query<MarkingConnections, string>({ query: id => firmUrl(id, '/marking/connections'), providesTags: ['Marking'], keepUnusedDataFor: 0 }),
    markingLinks: b.query<MarkingLink[], { firmId: string; declarationId?: string }>({ query: ({ firmId, declarationId }) => ({ url: firmUrl(firmId, '/marking/links'), params: { declarationId } }), providesTags: ['Marking'] }),
    markingBatches: b.query<Page<MarkingBatch>, { firmId: string; search?: string; declarationId?: string; page: number }>({ query: ({ firmId, ...params }) => ({ url: firmUrl(firmId, '/marking/batches'), params: { ...params, pageSize: 10 } }), providesTags: ['Marking'] }),
    markingBatch: b.query<MarkingBatch, { firmId: string; id: string }>({ query: ({ firmId, id }) => firmUrl(firmId, `/marking/batches/${id}`), providesTags: ['Marking'], keepUnusedDataFor: 0 }),
    saveMarkingLink: b.mutation<MarkingLink, { firmId: string; data: SaveMarkingLink }>({ query: ({ firmId, data }) => ({ url: firmUrl(firmId, '/marking/links'), method: 'POST', body: data }), invalidatesTags: ['Marking'] }),
    deleteMarkingLink: b.mutation<void, { firmId: string; id: string }>({ query: ({ firmId, id }) => ({ url: firmUrl(firmId, `/marking/links/${id}`), method: 'DELETE' }), invalidatesTags: ['Marking'] }),
  }),
});
export const store = configureStore({ reducer: { session: sessionSlice.reducer, [api.reducerPath]: api.reducer }, middleware: g => g().concat(api.middleware) });
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

// Keep a newly entered secret out of Redux mutation arguments and DevTools action history.
export async function savePersonalDaDataKey(apiKey: string): Promise<DaDataSettings> {
  const originalToken = store.getState().session.token;
  const send = () => fetch(apiUrl('/me/integrations/dadata/'), {
    method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CertFlow', Authorization: `Bearer ${store.getState().session.token}` },
    body: JSON.stringify({ apiKey }),
  });
  let response = await send();
  if (response.status === 401) {
    if (store.getState().session.token === originalToken) {
      if (!refreshPromise) refreshPromise = (async () => {
        try { const auth = await authRequest('refresh'); store.dispatch(authenticated(auth)); return auth; }
        catch { store.dispatch(signedOut()); return null; }
      })().finally(() => { refreshPromise = null; });
      if (!await refreshPromise) throw { status: 401, data: { detail: 'Войдите в аккаунт.' } };
    }
    response = await send();
  }
  if (!response.ok) throw { status: response.status, data: await response.json().catch(() => ({})) };
  const settings = await response.json() as DaDataSettings;
  store.dispatch(api.util.invalidateTags(['Integrations', 'PersonalIntegrations']));
  return settings;
}

export async function authRequest(path: string, body?: unknown): Promise<AuthResponse> {
  const response = await fetch(apiUrl(`/auth/${path}`), { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'CertFlow', ...(store.getState().session.token ? { Authorization: `Bearer ${store.getState().session.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  if (!response.ok) throw { status: response.status, data: await response.json().catch(() => ({})) };
  return response.status === 204 ? undefined as unknown as AuthResponse : response.json();
}
export async function bootstrapSession() {
  try { store.dispatch(authenticated(await authRequest('refresh'))); } catch { store.dispatch(signedOut()); }
}
export async function refreshIntegrationSession(): Promise<boolean> {
  if (!refreshPromise) refreshPromise = (async () => {
    try { const auth = await authRequest('refresh'); store.dispatch(authenticated(auth)); return auth; }
    catch { store.dispatch(signedOut()); return null; }
  })().finally(() => { refreshPromise = null; });
  return !!await refreshPromise;
}
export async function download(path: string, filename: string) {
  let response = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${store.getState().session.token}` }, credentials: 'include' });
  if (response.status === 401) {
    try { store.dispatch(authenticated(await authRequest('refresh'))); } catch { store.dispatch(signedOut()); throw { status: 401 }; }
    response = await fetch(apiUrl(path), { headers: { Authorization: `Bearer ${store.getState().session.token}` }, credentials: 'include' });
  }
  if (!response.ok) throw { status: response.status, data: await response.json().catch(() => ({})) };
  const blob = await response.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
