import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { honestSignKeys } from "@marking/hooks/use-honest-sign";
import { authApiService } from "@marking/lib/honest-sign/authApiService";
import { catalogApiService } from "@marking/lib/honest-sign/catalogApiService";
import { getHttpErrorDiagnostics, getHttpErrorStatus } from "@marking/lib/honest-sign/httpClient";
import {
    isValidCatalogTnved,
    isCatalogFeedProcessing,
    shouldPollCatalogFeed,
} from "@marking/lib/honest-sign/catalogForm";
import { catalogProviderStatus } from "@marking/lib/honest-sign/catalogWorkflowOutcome";

import type {
    CatalogCardRequest,
    CatalogFeedStatus,
    CatalogProductFilters,
    CatalogSubmission,
} from "@marking/lib/honest-sign/catalogTypes";

export const catalogKeys = {
    all: (companyId: string) =>
        [...honestSignKeys.all, companyId, "catalog"] as const,
    productGroups: (companyId: string) =>
        [...catalogKeys.all(companyId), "product-groups"] as const,
    brands: (companyId: string, query: string, page: number) =>
        [...catalogKeys.all(companyId), "brands", query, page] as const,
    generatedGtins: (companyId: string) =>
        [...catalogKeys.all(companyId), "generated-gtins"] as const,
    categories: (
        companyId: string,
        tnved?: string,
        productGroupCode?: number,
    ) =>
        [
            ...catalogKeys.all(companyId),
            "categories",
            productGroupCode ?? "all",
            tnved ?? "all",
        ] as const,
    attributes: (
        companyId: string,
        categoryId: number,
        productGroupCode?: number,
        isSet = false,
    ) =>
        [
            ...catalogKeys.all(companyId),
            "attributes",
            categoryId,
            productGroupCode ?? "all",
            isSet,
        ] as const,
    submissions: (companyId: string, page: number) =>
        [...catalogKeys.all(companyId), "submissions", page] as const,
    attempts: (companyId: string, id: string) =>
        [...catalogKeys.all(companyId), "attempts", id] as const,
    productLists: (companyId: string) =>
        [...catalogKeys.all(companyId), "products"] as const,
    products: (
        companyId: string,
        page: number,
        filters: CatalogProductFilters,
    ) => [...catalogKeys.productLists(companyId), page, filters] as const,
    status: (companyId: string, id: string) =>
        [...catalogKeys.all(companyId), "status", id] as const,
    card: (companyId: string, id: string) =>
        [...catalogKeys.all(companyId), "card", id] as const,
    workflowAction: (
        companyId: string,
        id: string,
        actorId: string,
        authVersion: number,
    ) =>
        [
            ...catalogKeys.all(companyId),
            "workflow-action",
            id,
            actorId,
            authVersion,
        ] as const,
};
export const useCatalogProducts = (
    companyId: string,
    page: number,
    filters: CatalogProductFilters,
    enabled = true,
) =>
    useQuery({
        queryKey: catalogKeys.products(companyId, page, filters),
        queryFn: ({ signal }) =>
            catalogApiService.products(page, filters, signal),
        enabled: Boolean(companyId) && enabled,
        staleTime: 10_000,
        retry: false,
        placeholderData: keepPreviousData,
    });
export const useCatalogProductGroups = (companyId: string, enabled = true) =>
    useQuery({
        queryKey: catalogKeys.productGroups(companyId),
        queryFn: ({ signal }) => catalogApiService.productGroups(signal),
        enabled: Boolean(companyId) && enabled,
        staleTime: 5 * 60_000,
        retry: false,
    });
export const useCatalogBrands = (companyId: string, query: string, page = 1) =>
    useQuery({
        queryKey: catalogKeys.brands(companyId, query, page),
        queryFn: ({ signal }) => catalogApiService.brands(query, page, signal),
        enabled: Boolean(companyId && query.trim()),
        staleTime: 5 * 60_000,
        retry: false,
    });
export const useCatalogCategories = (
    companyId: string,
    tnved?: string,
    productGroupCode?: number,
) =>
    useQuery({
        queryKey: catalogKeys.categories(companyId, tnved, productGroupCode),
        queryFn: ({ signal }) =>
            catalogApiService.categories(signal, tnved, productGroupCode),
        enabled:
            Boolean(companyId) &&
            (tnved === undefined || isValidCatalogTnved(tnved)),
        staleTime: 5 * 60_000,
        retry: false,
    });
export const useCatalogAttributes = (
    companyId: string,
    categoryId: number,
    productGroupCode?: number,
    isSet = false,
) =>
    useQuery({
        queryKey: catalogKeys.attributes(
            companyId,
            categoryId,
            productGroupCode,
            isSet,
        ),
        queryFn: ({ signal }) =>
            catalogApiService.attributes(
                categoryId,
                signal,
                productGroupCode,
                isSet,
            ),
        enabled: Boolean(companyId && categoryId > 0),
        staleTime: 5 * 60_000,
        retry: false,
    });
const catalogSubmissionPollInterval = 30_000;

const hasPendingCatalogSubmission = (row: CatalogSubmission) => {
    if (row.state !== "Accepted" || !row.feedId) return false;
    const feed = row.latestFeedStatus;
    return !feed || (feed.feedId === row.feedId &&
        (!feed.status || feed.status === "Processing" || feed.status === "Received"));
};

export const useCatalogSubmissionHistorySession = (companyId: string, enabled = true) =>
    useQuery({
        queryKey: [...honestSignKeys.all, companyId, "submission-history-session"],
        queryFn: ({ signal }) => authApiService.getCurrentSession(signal),
        enabled: Boolean(companyId) && enabled,
        staleTime: catalogSubmissionPollInterval,
        refetchOnMount: "always",
        refetchOnWindowFocus: true,
        retry: false,
    });

export function useCatalogSubmissions(companyId: string, page: number) {
    const session = useCatalogSubmissionHistorySession(companyId);

    return useQuery({
        queryKey: catalogKeys.submissions(companyId, page),
        queryFn: ({ signal }) => catalogApiService.submissions(page, signal),
        enabled: Boolean(companyId),
        staleTime: 10_000,
        retry: false,
        refetchInterval: (query) => {
            const expiresAt = session.data?.honestSignSessionExpiresAtUtc;
            if (session.isError || !session.data?.hasHonestSignSession ||
                (expiresAt && Date.parse(expiresAt) <= Date.now()) ||
                !query.state.data?.items.some(hasPendingCatalogSubmission)) return false;
            const retryInterval = catalogReadRetryInterval(query.state.error);
            return retryInterval && Math.max(catalogSubmissionPollInterval, retryInterval);
        },
        refetchIntervalInBackground: false,
    });
}

export const useCatalogSubmissionAttempts = (companyId: string, id: string, page: number) =>
    useQuery({
        queryKey: [...catalogKeys.attempts(companyId, id), page],
        queryFn: ({ signal }) => catalogApiService.attempts(id, page, signal),
        enabled: Boolean(companyId && id),
        staleTime: 10_000,
        retry: false,
    });

const catalogReadRetryInterval = (error: Error | null, allowNotFound = false) => {
    const status = getHttpErrorStatus(error);
    const upstream = getHttpErrorDiagnostics(error).upstreamStatus;
    if (status === 429 || upstream === 429) return 300_000;
    if (status === null || status === 408 || status === 409 || status >= 500 ||
        upstream === 408 || upstream === 404 || (allowNotFound && status === 404))
        return 15_000;
    return false;
};

export const catalogFeedPollInterval = (data: CatalogFeedStatus | undefined, error: Error | null) =>
    shouldPollCatalogFeed(data) ? catalogReadRetryInterval(error) : false;

export function useCatalogFeedStatus(companyId: string, id: string) {
    const client = useQueryClient();
    return useQuery({
        queryKey: catalogKeys.status(companyId, id),
        queryFn: async ({ signal }) => {
            const previous = client.getQueryData<
                Awaited<ReturnType<typeof catalogApiService.status>>
            >(catalogKeys.status(companyId, id));
            const status = await catalogApiService.status(id, signal);
            const stateChanged =
                previous?.submissionState !== status.submissionState ||
                previous?.status !== status.status;
            if (stateChanged) {
                void client.invalidateQueries({
                    queryKey: catalogKeys.card(companyId, id),
                    refetchType: isCatalogFeedProcessing(status)
                        ? "none"
                        : "active",
                });
                void client.invalidateQueries({
                    queryKey: [...catalogKeys.all(companyId), "products"],
                });
            }
            if (
                stateChanged ||
                previous?.updatedAtUtc !== status.updatedAtUtc ||
                previous?.feedId !== status.feedId ||
                previous?.providerStatus !== status.providerStatus ||
                previous?.providerStatusId !== status.providerStatusId ||
                previous?.providerTotalErrors !== status.providerTotalErrors ||
                previous?.upstreamHttpStatus !== status.upstreamHttpStatus ||
                JSON.stringify(previous?.errors) !== JSON.stringify(status.errors) ||
                JSON.stringify(previous?.messages) !== JSON.stringify(status.messages)
            ) {
                void client.invalidateQueries({
                    queryKey: [...catalogKeys.all(companyId), "submissions"],
                });
                void client.invalidateQueries({ queryKey: catalogKeys.attempts(companyId, id) });
            }
            return status;
        },
        enabled: Boolean(companyId && id),
        staleTime: 10_000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchInterval: (query) =>
            catalogFeedPollInterval(query.state.data, query.state.error),
    });
}
export function useCreateCatalogCard(companyId: string) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (request: CatalogCardRequest) =>
            catalogApiService.saveDraft(request),
        retry: false,
        onSettled: () =>
            client.invalidateQueries({
                queryKey: [...catalogKeys.all(companyId), "submissions"],
            }),
    });
}

export const useCatalogCard = (
    companyId: string,
    id: string,
    enabled: boolean,
    { awaitingCard, acceptedSubmission, awaitingModeration, awaitingPublication }: {
        awaitingCard: boolean;
        acceptedSubmission: boolean;
        awaitingModeration: boolean;
        awaitingPublication: boolean;
    },
) =>
    useQuery({
        queryKey: catalogKeys.card(companyId, id),
        queryFn: ({ signal }) => catalogApiService.card(id, signal),
        enabled: Boolean(companyId && id) && enabled,
        retry: false,
        staleTime: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: (query) => {
            const { data, error } = query.state;
            const status = catalogProviderStatus(data);
            const waitingForModerationStatus = (awaitingModeration && (error || status === "draft")) ||
                (acceptedSubmission && status === "draft" && data && data.goodId > 0 &&
                    !data.canModerate && !data.blockingOperation);
            const waitingForPublicationStatus = awaitingPublication &&
                (error || status === "notsigned" || (status === "published" && !data?.isSigned));
            const shouldRefresh = (awaitingCard && !data && error) || waitingForModerationStatus || waitingForPublicationStatus ||
                data?.blockingOperation?.state === "Processing" || status === "moderation";
            return shouldRefresh ? catalogReadRetryInterval(error, awaitingCard || awaitingModeration || awaitingPublication) : false;
        },
    });
export function useUpdateCatalogCard(companyId: string, id: string) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (request: CatalogCardRequest) =>
            catalogApiService.update(id, request),
        retry: false,
        onSettled: () =>
            client.invalidateQueries({ queryKey: catalogKeys.all(companyId) }),
    });
}
