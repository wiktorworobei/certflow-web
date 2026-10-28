import { useQuery } from "@tanstack/react-query";
import { honestSignKeys } from "@marking/hooks/use-honest-sign";
import { documentsApiService } from "@marking/lib/honest-sign/documentsApiService";

export const utilisationDocumentKeys = {
    list: (companyId: string, page: number, search: string) =>
        [
            ...honestSignKeys.all,
            companyId,
            "utilisation-documents",
            page,
            search,
        ] as const,
    codes: (companyId: string, documentId: string) =>
        [
            ...honestSignKeys.all,
            companyId,
            "utilisation-document-codes",
            documentId,
        ] as const,
};
export const useUtilisationDocuments = (
    companyId: string,
    page: number,
    search: string,
) =>
    useQuery({
        queryKey: utilisationDocumentKeys.list(companyId, page, search),
        queryFn: ({ signal }) =>
            documentsApiService.listUtilisationDocuments(page, search, signal),
        enabled: Boolean(companyId),
        staleTime: 30_000,
        retry: false,
    });
export const useUtilisationDocumentCodes = (
    companyId: string,
    documentId: string,
    enabled: boolean,
) =>
    useQuery({
        queryKey: utilisationDocumentKeys.codes(companyId, documentId),
        queryFn: ({ signal }) =>
            documentsApiService.getUtilisationDocumentCodes(documentId, signal),
        enabled: Boolean(companyId && documentId) && enabled,
        // Explicit refresh invalidates the code check. Never replace a set being signed
        // on focus/reconnect, persist full codes, or retry a report mutation automatically.
        staleTime: Infinity,
        gcTime: 0,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        retry: false,
    });
