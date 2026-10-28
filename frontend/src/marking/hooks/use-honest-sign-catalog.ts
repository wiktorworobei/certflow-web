import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { honestSignKeys } from "@marking/hooks/use-honest-sign";
import { catalogApiService } from "@marking/lib/honest-sign/catalogApiService";
import {
    isValidCatalogTnved,
    shouldPollCatalogFeed,
} from "@marking/lib/honest-sign/catalogForm";

import type { CatalogCardRequest } from "@marking/lib/honest-sign/catalogTypes";

export const catalogKeys = {
    all: (companyId: string) =>
        [...honestSignKeys.all, companyId, "catalog"] as const,
    categories: (companyId: string, tnved?: string) =>
        [...catalogKeys.all(companyId), "categories", tnved ?? "all"] as const,
    attributes: (companyId: string, categoryId: number) =>
        [...catalogKeys.all(companyId), "attributes", categoryId] as const,
    submissions: (companyId: string, page: number) =>
        [...catalogKeys.all(companyId), "submissions", page] as const,
    status: (companyId: string, id: string) =>
        [...catalogKeys.all(companyId), "status", id] as const,
    card: (companyId: string, id: string) =>
        [...catalogKeys.all(companyId), "card", id] as const,
};
export const useCatalogCategories = (companyId: string, tnved?: string) =>
    useQuery({
        queryKey: catalogKeys.categories(companyId, tnved),
        queryFn: ({ signal }) => catalogApiService.categories(signal, tnved),
        enabled:
            Boolean(companyId) &&
            (tnved === undefined || isValidCatalogTnved(tnved)),
        staleTime: 5 * 60_000,
        retry: false,
    });
export const useCatalogAttributes = (companyId: string, categoryId: number) =>
    useQuery({
        queryKey: catalogKeys.attributes(companyId, categoryId),
        queryFn: ({ signal }) =>
            catalogApiService.attributes(categoryId, signal),
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
export const useCatalogFeedStatus = (companyId: string, id: string) =>
    useQuery({
        queryKey: catalogKeys.status(companyId, id),
        queryFn: ({ signal }) => catalogApiService.status(id, signal),
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
export function useCreateCatalogCard(companyId: string) {
    const client = useQueryClient();
    return useMutation({
        mutationFn: (request: CatalogCardRequest) =>
            catalogApiService.create(request),
        retry: false,
        onSettled: () =>
            client.invalidateQueries({
                queryKey: [...catalogKeys.all(companyId), "submissions"],
            }),
    });
}

export const useCatalogCard = (companyId: string, id: string) =>
    useQuery({
        queryKey: catalogKeys.card(companyId, id),
        queryFn: ({ signal }) => catalogApiService.card(id, signal),
        enabled: Boolean(companyId && id),
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
