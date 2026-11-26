import { apiClient, toHttpError } from "@marking/lib/honest-sign/httpClient";
import i18n from "@marking/src/i18n";
import type { PermitLookup, PermitReference } from "./catalogPermitTypes";

import type {
    CatalogAttribute,
    CatalogCardRequest,
    CatalogCategory,
    CatalogFeedStatus,
    CatalogSubmission,
    CatalogSubmissionAttempt,
    CatalogCard,
    CatalogOperation,
    CatalogSignRequest,
    CatalogSigningData,
    DeclarationCatalogProduct,
    CatalogProductGroup,
    CatalogBrand,
    CatalogGtinCheckResult,
    CatalogGtinReceipt,
    CatalogProductFilters,
    CatalogProductsPage,
} from "./catalogTypes";

const URL = "/api/honest-sign/catalog";
const WORKFLOW_TIMEOUT_MS = 120_000;
async function catalogCall<T>(call: () => Promise<{ data: T }>): Promise<T> {
    try {
        return (await call()).data;
    } catch (error) {
        throw toHttpError(i18n.t("honestSign.catalog.requestFailed"), error);
    }
}

export const catalogApiService = {
    permitsByDocument: (companyId: string, documents: PermitReference[], signal?: AbortSignal) =>
        catalogCall(() => apiClient.post<PermitLookup>(`${URL}/permits/by-document`, { documents },
            { signal, headers: { 'X-Company-Id': companyId } })),
    permitsByProduct: (companyId: string, gtin: string, inn?: string, signal?: AbortSignal) =>
        catalogCall(() => apiClient.post<PermitLookup>(`${URL}/permits/by-product`, { gtin, ...(inn?.trim() ? { inn: inn.trim() } : {}) },
            { signal, headers: { 'X-Company-Id': companyId } })),
    lookupProduct: (gtin: string, signal?: AbortSignal) =>
        catalogCall(() => apiClient.get<DeclarationCatalogProduct[]>(`${URL}/products/lookup`, { params: { gtin }, signal })),
    products: (
        page: number,
        filters: CatalogProductFilters,
        signal?: AbortSignal,
        pageSize = 50,
    ) =>
        catalogCall(() =>
            apiClient.get<CatalogProductsPage>(`${URL}/products`, {
                signal,
                params: { page, pageSize, ...filters },
            }),
        ),
    trackProduct: (goodId: number, gtin: string) =>
        catalogCall(() =>
            apiClient.post<CatalogSubmission>(
                `${URL}/products/${goodId}/track`,
                { gtin },
            ),
        ),
    productGroups: (signal?: AbortSignal) =>
        catalogCall(() =>
            apiClient.get<CatalogProductGroup[]>(`${URL}/product-groups`, {
                signal,
            }),
        ),
    brands: (query: string, page = 1, signal?: AbortSignal) =>
        catalogCall(() =>
            apiClient.get<{ items: CatalogBrand[]; hasNextPage: boolean }>(
                `${URL}/brands`,
                { signal, params: { query, page } },
            ),
        ),
    checkGtin: (companyId: string, gtin: string, submissionId?: string, signal?: AbortSignal) =>
        catalogCall(() =>
            apiClient.get<CatalogGtinCheckResult>(`${URL}/gtins/check`, {
                signal,
                params: { gtin, submissionId },
                headers: { "X-Company-Id": companyId },
            }),
        ),
    generateGtins: (requestId: string, quantity = 1) =>
        catalogCall(() =>
            apiClient.post<CatalogGtinReceipt>(`${URL}/gtins/generate`, {
                requestId,
                quantity,
            }),
        ),
    gtinReceipt: (requestId: string) =>
        catalogCall(() =>
            apiClient.get<CatalogGtinReceipt | null>(
                `${URL}/gtins/requests/${encodeURIComponent(requestId)}`,
            ),
        ),
    generatedGtins: () =>
        catalogCall(() =>
            apiClient.get<{
                codes: string[];
                monthlyLimit: number | null;
                monthlyUsage: number | null;
            }>(`${URL}/gtins/generated`),
        ),
    bindIdentity: (id: string, gtin: string) =>
        catalogCall(() =>
            apiClient.post<CatalogSubmission>(
                `${URL}/submissions/${encodeURIComponent(id)}/identity`,
                { gtin },
            ),
        ),
    saveDraft: (request: CatalogCardRequest, id?: string) =>
        catalogCall(() =>
            id
                ? apiClient.put<CatalogSubmission>(
                      `${URL}/submissions/${encodeURIComponent(id)}/draft`,
                      request,
                  )
                : apiClient.post<CatalogSubmission>(`${URL}/drafts`, request),
        ),
    sendDraft: (id: string, expectedVersion?: string | null, sendToModeration = false) =>
        catalogCall(() =>
            apiClient.post<CatalogSubmission>(
                `${URL}/submissions/${encodeURIComponent(id)}/send`,
                undefined,
                {
                    params: { expectedVersion, sendToModeration },
                    timeout: WORKFLOW_TIMEOUT_MS,
                },
            ),
        ),
    findSubmission: (requestId: string) =>
        catalogCall(() =>
            apiClient.get<CatalogSubmission | null>(
                `${URL}/requests/${encodeURIComponent(requestId)}`,
                { timeout: WORKFLOW_TIMEOUT_MS },
            ),
        ),
    card: (id: string, signal?: AbortSignal) =>
        catalogCall(() =>
            apiClient.get<CatalogCard>(
                `${URL}/submissions/${encodeURIComponent(id)}/card`,
                { signal, timeout: WORKFLOW_TIMEOUT_MS },
            ),
        ),
    update: (id: string, request: CatalogCardRequest) =>
        catalogCall(() =>
            apiClient.put<CatalogOperation>(
                `${URL}/submissions/${encodeURIComponent(id)}/card`,
                request,
                { timeout: WORKFLOW_TIMEOUT_MS },
            ),
        ),
    moderate: (id: string, requestId: string) =>
        catalogCall(() =>
            apiClient.post<CatalogOperation>(
                `${URL}/submissions/${encodeURIComponent(id)}/moderation`,
                { requestId },
                { timeout: WORKFLOW_TIMEOUT_MS },
            ),
        ),
    signingData: (id: string, publicationAgreement: boolean) =>
        catalogCall(() =>
            apiClient.get<CatalogSigningData>(
                `${URL}/submissions/${encodeURIComponent(id)}/signing-data`,
                {
                    params: { publicationAgreement },
                    timeout: WORKFLOW_TIMEOUT_MS,
                },
            ),
        ),
    sign: (id: string, request: CatalogSignRequest) =>
        catalogCall(() =>
            apiClient.post<CatalogOperation>(
                `${URL}/submissions/${encodeURIComponent(id)}/sign`,
                request,
                { timeout: WORKFLOW_TIMEOUT_MS },
            ),
        ),
    operation: (id: string, requestId: string) =>
        catalogCall(() =>
            apiClient.get<CatalogOperation | null>(
                `${URL}/submissions/${encodeURIComponent(id)}/operations/${encodeURIComponent(requestId)}`,
                { timeout: WORKFLOW_TIMEOUT_MS },
            ),
        ),
    reconcile: (id: string, requestId: string) =>
        catalogCall(() =>
            apiClient.post<CatalogOperation>(
                `${URL}/submissions/${encodeURIComponent(id)}/operations/${encodeURIComponent(requestId)}/reconcile`,
                { providerChecked: true },
            ),
        ),
    categories: (
        signal?: AbortSignal,
        tnved?: string,
        productGroupCode?: number,
    ) =>
        catalogCall(() =>
            apiClient.get<CatalogCategory[]>(`${URL}/categories`, {
                signal,
                params: { tnved, productGroupCode },
            }),
        ),
    attributes: (
        categoryId: number,
        signal?: AbortSignal,
        productGroupCode?: number,
        isSet = false,
    ) =>
        catalogCall(() =>
            apiClient.get<CatalogAttribute[]>(
                `${URL}/categories/${categoryId}/attributes`,
                { signal, params: { productGroupCode, isSet } },
            ),
        ),
    create: (request: CatalogCardRequest) =>
        catalogCall(() =>
            apiClient.post<CatalogSubmission>(`${URL}/cards`, request, {
                timeout: WORKFLOW_TIMEOUT_MS,
            }),
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
                { signal, timeout: WORKFLOW_TIMEOUT_MS },
            ),
        ),
    attempts: (id: string, page: number, signal?: AbortSignal) =>
        catalogCall(() =>
            apiClient.get<{ items: CatalogSubmissionAttempt[]; hasNextPage: boolean }>(
                `${URL}/submissions/${encodeURIComponent(id)}/attempts`,
                { params: { page }, signal },
            ),
        ),
};
