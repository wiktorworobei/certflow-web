import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";
import { honestSignKeys } from "@marking/hooks/use-honest-sign";
import { catalogApiService } from "@marking/lib/honest-sign/catalogApiService";
import {
    isValidCatalogTnved,
    isCatalogFeedProcessing,
    shouldPollCatalogFeed,
} from "@marking/lib/honest-sign/catalogForm";

import type {
    CatalogCardRequest,
    CatalogProductFilters,
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
    products: (
        companyId: string,
        page: number,
        filters: CatalogProductFilters,
    ) => [...catalogKeys.all(companyId), "products", page, filters] as const,
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
export const useCatalogProductGroups = (companyId: string) =>
    useQuery({
        queryKey: catalogKeys.productGroups(companyId),
        queryFn: ({ signal }) => catalogApiService.productGroups(signal),
        enabled: Boolean(companyId),
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
export const useCatalogSubmissions = (companyId: string, page: number) =>
    useQuery({
        queryKey: catalogKeys.submissions(companyId, page),
        queryFn: ({ signal }) => catalogApiService.submissions(page, signal),
        enabled: Boolean(companyId),
        staleTime: 10_000,
        retry: false,
    });
export function useCatalogFeedStatus(companyId: string, id: string) {
    const client = useQueryClient();
    return useQuery({
        queryKey: catalogKeys.status(companyId, id),
        queryFn: async ({ signal }) => {
            const previous = client.getQueryData<
                Awaited<ReturnType<typeof catalogApiService.status>>
            >(catalogKeys.status(companyId, id));
            const status = await catalogApiService.status(id, signal);
            if (
                previous?.submissionState !== status.submissionState ||
                previous?.status !== status.status
            ) {
                void client.invalidateQueries({
                    queryKey: catalogKeys.card(companyId, id),
                    refetchType: isCatalogFeedProcessing(status)
                        ? "none"
                        : "active",
                });
                void client.invalidateQueries({
                    queryKey: [...catalogKeys.all(companyId), "submissions"],
                });
                void client.invalidateQueries({
                    queryKey: [...catalogKeys.all(companyId), "products"],
                });
            }
            return status;
        },
        enabled: Boolean(companyId && id),
        staleTime: 10_000,
        retry: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: (query) =>
            query.state.error
                ? false
                : shouldPollCatalogFeed(query.state.data)
                  ? 15_000
                  : false,
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

export const useCatalogCard = (companyId: string, id: string, enabled = true) =>
    useQuery({
        queryKey: catalogKeys.card(companyId, id),
        queryFn: ({ signal }) => catalogApiService.card(id, signal),
        enabled: Boolean(companyId && id) && enabled,
        retry: false,
        staleTime: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchInterval: (query) =>
            query.state.error
                ? false
                : query.state.data?.blockingOperation?.state === "Processing" ||
                    query.state.data?.detailedStatuses.includes("moderation")
                  ? 15_000
                  : false,
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
