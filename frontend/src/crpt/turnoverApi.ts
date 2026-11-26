import { apiClient, toHttpError } from '../marking/lib/honest-sign/httpClient';
import type {
  TurnoverCapabilities,
  TurnoverCodeInfo,
  TurnoverReceipt,
  TurnoverState,
} from './turnover';

export type TurnoverJournalSort = 'newest' | 'oldest' | 'groupAsc' | 'groupDesc';
export type TurnoverJournalFilters = {
  productGroup?: string;
  documentType?: string;
  state?: TurnoverState;
  externalStatus?: string;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: TurnoverJournalSort;
};
type TurnoverJournalPage = {
  items: TurnoverReceipt[];
  hasNextPage: boolean;
  total: number;
  page: number;
  pageSize: number;
};

const base = '/api/honest-sign/turnover';
const detail = (id: string) => `${base}/${encodeURIComponent(id)}`;
const timeout = 120_000;

async function request<T>(read: () => Promise<{ data: T }>): Promise<T> {
  try {
    return (await read()).data;
  } catch (error) {
    throw toHttpError('Не удалось выполнить запрос оборота.', error);
  }
}

export const turnoverApi = {
  capabilities: (signal: AbortSignal) =>
    request(() => apiClient.get<TurnoverCapabilities>(`${base}/capabilities`, { signal })),
  page: (
    operation: TurnoverReceipt['operation'],
    page: number,
    signal: AbortSignal,
    filters: TurnoverJournalFilters & { pageSize?: number } = {},
  ) =>
    request(() =>
      apiClient.get<TurnoverJournalPage>(base, {
        params: { operation, page, ...filters },
        signal,
      }),
    ),
  get: (id: string, signal?: AbortSignal) =>
    request(() => apiClient.get<TurnoverReceipt>(detail(id), { signal })),
  prepare: (body: {
    requestId: string;
    productGroup: string;
    documentType: string;
    documentJson: string;
  }) => request(() => apiClient.post<TurnoverReceipt>(`${base}/prepare`, body, { timeout })),
  submit: (
    id: string,
    body: { payloadHash: string; signature: string; certificateThumbprint: string },
  ) => request(() => apiClient.post<TurnoverReceipt>(`${detail(id)}/submit`, body, { timeout })),
  refresh: (id: string) =>
    request(() => apiClient.post<TurnoverReceipt>(`${detail(id)}/refresh`, undefined, { timeout })),
  reconcile: (id: string, externalDocumentId: string) =>
    request(() =>
      apiClient.post<TurnoverReceipt>(
        `${detail(id)}/reconcile`,
        { externalDocumentId },
        { timeout },
      ),
    ),
  metadata: (codes: string[], productGroup: string) =>
    request(() =>
      apiClient.post<TurnoverCodeInfo[]>(
        '/api/honest-sign/codes/info',
        {
          codes,
          productGroup,
        },
        { timeout },
      ),
    ),
};
