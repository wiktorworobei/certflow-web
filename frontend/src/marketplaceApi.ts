import { api, authRequest, authenticated, signedOut, store } from './store';
import { apiUrl } from './apiUrl';

export type RegistrySection = 'rss' | 'rds' | 'reaeu';
export interface MarketplaceSettings { enabled: boolean; isConfigured: boolean; environment: string; accessMode: string; revision: string | null; updatedAtUtc: string | null }
export interface RegistryQuery { numberDoc: string; regDate?: string; applicantInn?: string }
export interface RegistryDocument {
  id: number | string | null; objectId?: string | null; numberDoc: string | null; regDate: string | null; endDate: string | null;
  idStatus?: number | null; idStatusEAEU?: string | null; idStatusInRF?: number | null;
  manufacturerName: string | null; manufacturerAddress: string | null;
  products: { productName: string | null; tnveds: string[] | null; okpds: string[] | null }[] | null;
  techRegs: string[] | null; statusChanges?: { idStatus: number | null; beginDate: string | null; basisSolutions: string[] | null }[] | null; updated: string | null;
}
export interface RegistryVerification { section: RegistrySection; checkedAtUtc: string; document: RegistryDocument; registryUrl: string | null; statusLabel: string; statusInRussiaLabel: string | null }
export interface RegistryRequest { requestId: string; section: string; kind: string; createdAtUtc: string }
export interface RegistryRequestSummary extends RegistryRequest { usesCurrentConnection: boolean }
export interface RegistryRequestStatus { requestId: string; status: string; resultAvailable: boolean; errorsAvailable: boolean; errorMessage: string | null }
export interface RegistryExport { url: string | null; section?: string; coversDate?: string; generatedAt: string | null; sizeBytes: number | null; sha256: string | null; recordCount: number | null }
export interface RegistryManifest { rssFull: RegistryExport | null; rdsFull: RegistryExport | null; reaeuFull: RegistryExport | null; deltasSinceFull: RegistryExport[] | null; updatedAt: string | null }
const root = (firmId: string) => `/firms/${firmId}/marketplace`;
export const marketplaceApi = api.injectEndpoints({ endpoints: b => ({
  marketplaceSettings: b.query<MarketplaceSettings, string>({ query: firmId => `${root(firmId)}/settings`, providesTags: ['Integrations'], keepUnusedDataFor: 0 }),
  deleteMarketplace: b.mutation<void, { firmId: string; revision: string }>({ query: ({ firmId, revision }) => ({ url: `${root(firmId)}/settings`, params: { revision }, method: 'DELETE' }), invalidatesTags: ['Integrations'] }),
  registryLookup: b.mutation<RegistryVerification, { firmId: string; section: RegistrySection; query: RegistryQuery }>({ query: ({ firmId, section, query }) => ({ url: `${root(firmId)}/sync/${section}/get`, method: 'POST', body: query }) }),
  checkDeclarationRegistry: b.mutation<RegistryVerification, { firmId: string; id: string; revision: number; section: RegistrySection; regDate?: string }>({ query: ({ firmId, id, ...body }) => ({ url: `/firms/${firmId}/declarations/${id}/registry/check`, method: 'POST', body }) }),
  registryFind: b.mutation<{ requestId: string }, { firmId: string; section: RegistrySection; items: RegistryQuery[] }>({ query: ({ firmId, section, items }) => ({ url: `${root(firmId)}/async/${section}/find-doc`, method: 'POST', body: { items } }), invalidatesTags: ['RegistryRequests'] }),
  registryCheckStatuses: b.mutation<{ requestId: string }, { firmId: string; section: RegistrySection; daysBack: number; documentIds?: (number | string)[] }>({ query: ({ firmId, section, ...body }) => ({ url: `${root(firmId)}/async/${section}/check-status`, method: 'POST', body }), invalidatesTags: ['RegistryRequests'] }),
  registryRequests: b.query<RegistryRequest[], string>({ query: firmId => `${root(firmId)}/async/requests`, keepUnusedDataFor: 0 }),
  registryHistory: b.query<{ items: RegistryRequestSummary[]; total: number; page: number; pageSize: number }, { firmId: string; section?: string; kind?: string; page: number }>({ query: ({ firmId, ...params }) => ({ url: `${root(firmId)}/async/history`, params: { ...params, pageSize: 10 } }), providesTags: ['RegistryRequests', 'Integrations'], keepUnusedDataFor: 0 }),
  registryRequestStatus: b.query<RegistryRequestStatus, { firmId: string; requestId: string }>({ query: ({ firmId, requestId }) => `${root(firmId)}/async/status/${requestId}`, keepUnusedDataFor: 0 }),
  registryManifest: b.query<RegistryManifest, string>({ query: firmId => `${root(firmId)}/sync/export/manifest`, keepUnusedDataFor: 0 }),
}) });

async function authenticatedFetch(path: string, init?: RequestInit) {
  const request = () => fetch(apiUrl(path), { ...init, credentials: 'include', headers: { ...init?.headers, Authorization: `Bearer ${store.getState().session.token}`, 'X-Requested-With': 'CertFlow' } });
  let response = await request();
  if (response.status === 401) {
    try { store.dispatch(authenticated(await authRequest('refresh'))); } catch { store.dispatch(signedOut()); throw { status: 401 }; }
    response = await request();
  }
  if (!response.ok) throw { status: response.status, data: await response.json().catch(() => ({})) };
  return response;
}

// Credential input goes straight to the server, never through Redux action history.
export async function saveMarketplace(firmId: string, data: { environment: string; accessMode: string; apiKey: string; revision: string | null }) {
  const response = await authenticatedFetch(`${root(firmId)}/settings`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
  store.dispatch(api.util.invalidateTags(['Integrations']));
  return await response.json() as MarketplaceSettings;
}

interface FileWriter extends WritableStream<Uint8Array> { }
interface FilePickerWindow extends Window { showSaveFilePicker?: (options: { suggestedName: string }) => Promise<{ createWritable(): Promise<FileWriter> }> }
export async function downloadRegistryFile(firmId: string, path: string, filename: string, size?: number | null) {
  // Select the destination before the network request to retain the browser's user gesture.
  const picker = (window as FilePickerWindow).showSaveFilePicker;
  const file = picker ? await picker.call(window, { suggestedName: filename }) : null;
  if (!file && (size == null || size > 64 * 1024 * 1024)) throw new Error('Для потокового скачивания больших выгрузок откройте приложение в Chrome или Edge.');
  const response = await authenticatedFetch(`${root(firmId)}${path}`);
  if (file && response.body) { await response.body.pipeTo(await file.createWritable()); return; }
  if (Number(response.headers.get('Content-Length')) > 64 * 1024 * 1024) { await response.body?.cancel(); throw new Error('Размер файла превышает лимит скачивания этого браузера. Используйте Chrome или Edge.'); }
  // Bound the fallback even when the server uses chunked transfer.
  const reader = response.body?.getReader(); if (!reader) throw new Error('Пустой ответ при скачивании файла.');
  const chunks: Uint8Array<ArrayBuffer>[] = []; let length = 0;
  for (;;) { const item = await reader.read(); if (item.done) break; length += item.value.byteLength; if (length > 64 * 1024 * 1024) { await reader.cancel(); throw new Error('Файл слишком велик для этого браузера. Используйте Chrome или Edge.'); } chunks.push(new Uint8Array(item.value)); }
  const url = URL.createObjectURL(new Blob(chunks, { type: 'application/gzip' }));
  const link = document.createElement('a'); link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000);
}
