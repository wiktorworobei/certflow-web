import { apiClient, toHttpError } from "@marking/lib/honest-sign/httpClient";
import i18n from "@marking/src/i18n";

import type {
    CatalogAttribute,
    CatalogCardRequest,
    CatalogCategory,
    CatalogFeedStatus,
    CatalogSubmission,
    CatalogCard,
    CatalogOperation,
    CatalogSignRequest,
    CatalogSigningData,
    CatalogProduct,
} from "./catalogTypes";

const URL = "/api/honest-sign/catalog";
async function catalogCall<T>(call: () => Promise<{ data: T }>): Promise<T> {
    try {
        return (await call()).data;
    } catch (error) {
        throw toHttpError(i18n.t("honestSign.catalog.requestFailed"), error);
    }
}

export const catalogApiService = {
    products: (gtin: string, signal?: AbortSignal) =>
        catalogCall(() => apiClient.get<CatalogProduct[]>(`${URL}/products`, { params: { gtin }, signal })),
    findSubmission: (requestId: string) =>
        catalogCall(() =>
            apiClient.get<CatalogSubmission | null>(
                `${URL}/requests/${encodeURIComponent(requestId)}`,
            ),
        ),
    card: (id: string, signal?: AbortSignal) =>
        catalogCall(() =>
            apiClient.get<CatalogCard>(
                `${URL}/submissions/${encodeURIComponent(id)}/card`,
                { signal },
            ),
        ),
    update: (id: string, request: CatalogCardRequest) =>
        catalogCall(() =>
            apiClient.put<CatalogOperation>(
                `${URL}/submissions/${encodeURIComponent(id)}/card`,
                request,
            ),
        ),
    moderate: (id: string, requestId: string) =>
        catalogCall(() =>
            apiClient.post<CatalogOperation>(
                `${URL}/submissions/${encodeURIComponent(id)}/moderation`,
                { requestId },
            ),
        ),
    signingData: (id: string, publicationAgreement: boolean) =>
        catalogCall(() =>
            apiClient.get<CatalogSigningData>(
                `${URL}/submissions/${encodeURIComponent(id)}/signing-data`,
                { params: { publicationAgreement } },
            ),
        ),
    sign: (id: string, request: CatalogSignRequest) =>
        catalogCall(() =>
            apiClient.post<CatalogOperation>(
                `${URL}/submissions/${encodeURIComponent(id)}/sign`,
                request,
            ),
        ),
    operation: (id: string, requestId: string) =>
        catalogCall(() =>
            apiClient.get<CatalogOperation | null>(
                `${URL}/submissions/${encodeURIComponent(id)}/operations/${encodeURIComponent(requestId)}`,
            ),
        ),
    reconcile: (id: string, requestId: string) =>
        catalogCall(() =>
            apiClient.post<CatalogOperation>(
                `${URL}/submissions/${encodeURIComponent(id)}/operations/${encodeURIComponent(requestId)}/reconcile`,
                { providerChecked: true },
            ),
        ),
    categories: (signal?: AbortSignal, tnved?: string) =>
        catalogCall(() =>
            apiClient.get<CatalogCategory[]>(`${URL}/autofluids/categories`, {
                signal,
                params: tnved ? { tnved } : undefined,
            }),
        ),
    attributes: (categoryId: number, signal?: AbortSignal) =>
        catalogCall(() =>
            apiClient.get<CatalogAttribute[]>(
                `${URL}/autofluids/categories/${categoryId}/attributes`,
                { signal },
            ),
        ),
    create: (request: CatalogCardRequest) =>
        catalogCall(() =>
            apiClient.post<CatalogSubmission>(
                `${URL}/autofluids/cards`,
                request,
            ),
        ),
    submissions: (page: number, signal?: AbortSignal) =>
        catalogCall(() =>
            apiClient.get<{ items: CatalogSubmission[]; hasNextPage: boolean }>(
                `${URL}/submissions`,
                { params: { page }, signal },
            ),
        ),
    status: (id: string, signal?: AbortSignal) =>
        catalogCall(() =>
            apiClient.get<CatalogFeedStatus>(
                `${URL}/submissions/${encodeURIComponent(id)}/status`,
                { signal },
            ),
        ),
};
