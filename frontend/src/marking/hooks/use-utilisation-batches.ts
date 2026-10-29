import { useQuery } from "@tanstack/react-query";
import { honestSignKeys } from "@marking/hooks/use-honest-sign";
import { documentsApiService } from "@marking/lib/honest-sign/documentsApiService";
import { useAuthStore } from "@marking/src/store/auth";

export const utilisationBatchKeys = {
    all: (companyId: string, actorId: string) =>
        [
            ...honestSignKeys.all,
            companyId,
            "utilisation-batches",
            actorId,
        ] as const,
    list: (companyId: string, actorId: string, page: number) =>
        [
            ...utilisationBatchKeys.all(companyId, actorId),
            "list",
            page,
        ] as const,
    detail: (companyId: string, actorId: string, id: string) =>
        [
            ...utilisationBatchKeys.all(companyId, actorId),
            "detail",
            id,
        ] as const,
};
export const useUtilisationBatches = (companyId: string, page: number) => {
    const actorId = useAuthStore((state) => state.user?.id ?? "anonymous");
    return useQuery({
        queryKey: utilisationBatchKeys.list(companyId, actorId, page),
        queryFn: ({ signal }) =>
            documentsApiService.listUtilisationBatches(page, signal),
        enabled: Boolean(companyId),
        retry: false,
        staleTime: 30_000,
    });
};
export const useUtilisationBatch = (companyId: string, id: string) => {
    const actorId = useAuthStore((state) => state.user?.id ?? "anonymous");
    return useQuery({
        queryKey: utilisationBatchKeys.detail(companyId, actorId, id),
        queryFn: ({ signal }) =>
            documentsApiService.getUtilisationBatch(id, signal),
        enabled: Boolean(companyId && id),
        retry: false,
        staleTime: 0,
        refetchOnWindowFocus: false,
    });
};
