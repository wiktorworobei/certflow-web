import { apiClient, toHttpError } from '../marking/lib/honest-sign/httpClient';
import type {
  CatalogCardRequest,
  CatalogSubmission,
  CatalogProduct,
} from '../marking/lib/honest-sign/catalogTypes';

const root = '/api/honest-sign/catalog';
async function call<T>(request: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await request()).data;
  } catch (e) {
    throw toHttpError('Запрос в Национальный каталог не выполнен.', e);
  }
}
export type AccessPreparation = {
  id: string;
  inn: string;
  xml: string;
  certificateThumbprint: string;
  expiresAtUtc: string;
  state: string;
  result: Record<string, unknown> | null;
};
export type BulkResult = {
  row: number;
  submission: CatalogSubmission | null;
  error: string | null;
};
export type Account = {
  account_inn?: string;
  account_name?: string;
  full_access?: boolean;
  access_allowed?: { gtin: string }[];
  producer_inn?: string;
  producer_name?: string;
  gtin?: string;
};
export const crptApi = {
  search: (gtins: string, signal?: AbortSignal) =>
    call(() => apiClient.get<CatalogProduct[]>(`${root}/search`, { params: { gtins }, signal })),
  bulkDrafts: (cards: CatalogCardRequest[]) =>
    call(() => apiClient.post<BulkResult[]>(`${root}/bulk/drafts`, cards, { timeout: 120000 })),
  accounts: (received: boolean, inn: string, page: number, signal?: AbortSignal) =>
    call(() =>
      apiClient.get<{
        linked_accounts?: Account[];
        linked_gtins?: Account[];
        errors?: { message: string }[];
      }>(`${root}/access`, { params: { received, inn: inn || undefined, page }, signal }),
    ),
  prepareAccess: (requestId: string, inn: string, allow: boolean, gtins: string[] | null) =>
    call(() =>
      apiClient.post<AccessPreparation>(`${root}/access/prepare`, { requestId, inn, allow, gtins }),
    ),
  accessReceipt: (id: string) =>
    call(() => apiClient.get<AccessPreparation>(`${root}/access/${id}`)),
  signAccess: (preparation: AccessPreparation, signature: string, certificateThumbprint: string) =>
    call(() =>
      apiClient.post<AccessPreparation>(
        `${root}/access/${preparation.id}/sign`,
        { signature, certificateThumbprint },
        { timeout: 120000 },
      ),
    ),
};
