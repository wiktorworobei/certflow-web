import { apiClient, toHttpError } from '../marking/lib/honest-sign/httpClient';
import type { SuzCatalogItem, SuzCatalogProductsPage, SuzOrder, SuzReceipt } from './suz';
async function request<T>(fn: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await fn()).data;
  } catch (e) {
    throw toHttpError('Операция СУЗ не выполнена.', e);
  }
}
const base = '/api/honest-sign/suz';
export const suzApi = {
  catalogItem: (gtin: string, subaccount: boolean) =>
    request(() =>
      apiClient.get<SuzCatalogItem>(`${base}/catalog-product`, { params: { gtin, subaccount } }),
    ),
  catalogProducts: (productGroup: string, page: number, signal: AbortSignal) =>
    request(() =>
      apiClient.get<SuzCatalogProductsPage>(`${base}/catalog-products`, {
        params: { productGroup, page },
        signal,
      }),
    ),
  orders: (payload: unknown, signal?: AbortSignal) =>
    request(() =>
      apiClient.post<{ items: SuzOrder[]; totalItems: number }>(
        '/api/honest-sign/orders/search',
        payload,
        { signal },
      ),
    ),
  list: (page: number, signal?: AbortSignal) =>
    request(() => apiClient.get<SuzReceipt[]>(`${base}/operations`, { params: { page }, signal })),
  get: (id: string) => request(() => apiClient.get<SuzReceipt>(`${base}/operations/${id}`)),
  prepare: (requestId: string, kind: 'Create' | 'Close', payload: unknown) =>
    request(() => apiClient.post<SuzReceipt>(`${base}/prepare`, { requestId, kind, payload })),
  sign: (id: string, signature: string, certificateThumbprint: string) =>
    request(() =>
      apiClient.post<SuzReceipt>(`${base}/operations/${id}/sign`, {
        signature,
        certificateThumbprint,
      }),
    ),
  codes: (payload: {
    requestId: string;
    orderId: string;
    gtin: string;
    quantity: number;
    blockId?: string;
  }) => request(() => apiClient.post<SuzReceipt>(`${base}/codes`, payload)),
  blocks: (orderId: string, gtin: string) =>
    request(() => apiClient.get<unknown>(`${base}/blocks`, { params: { orderId, gtin } })),
  archive: (payload: {
    requestId: string;
    name: string;
    codes: string[];
    documentIds: string[];
    fileNames?: string[];
  }) => request(() => apiClient.post<SuzReceipt>(`${base}/archive`, payload)),
};
