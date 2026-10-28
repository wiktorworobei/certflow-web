import { useQuery } from "@tanstack/react-query";
import {
    documentsApiService,
    type HonestSignDocumentView,
} from "@marking/lib/honest-sign/documentsApiService";
import { integrationApiService } from "@marking/lib/honest-sign/integrationApiService";

export const honestSignKeys = {
    all: ["honest-sign"] as const,
    connectivity: (companyId: string) =>
        [...honestSignKeys.all, companyId, "connectivity"] as const,
    documents: (
        companyId: string,
        productGroup: string,
        limit: number,
        view: HonestSignDocumentView = "all",
    ) =>
        [
            ...honestSignKeys.all,
            companyId,
            "documents",
            productGroup,
            limit,
            view,
        ] as const,
    document: (companyId: string, productGroup: string, documentId: string) =>
        [
            ...honestSignKeys.all,
            companyId,
            "document",
            productGroup,
            documentId,
        ] as const,
    utilisationReport: (companyId: string, reportId: string) =>
        [
            ...honestSignKeys.all,
            companyId,
            "utilisation-report",
            reportId,
        ] as const,
};

export const useHonestSignConnectivity = (companyId: string, enabled = true) =>
    useQuery({
        queryKey: honestSignKeys.connectivity(companyId),
        queryFn: () => integrationApiService.getConnectivity(),
        enabled: Boolean(companyId) && enabled,
        staleTime: 30_000,
        retry: 1,
    });

export const useHonestSignDocuments = (
    companyId: string,
    productGroup: string,
    limit = 20,
    view: HonestSignDocumentView = "all",
    enabled = true,
) =>
    useQuery({
        queryKey: honestSignKeys.documents(
            companyId,
            productGroup,
            limit,
            view,
        ),
        queryFn: () =>
            documentsApiService.searchDocuments(productGroup, limit, view),
        enabled: Boolean(companyId && productGroup) && enabled,
        staleTime: 30_000,
    });

export const useHonestSignUtilisationReportStatus = (
    companyId: string,
    reportId: string,
) =>
    useQuery({
        queryKey: honestSignKeys.utilisationReport(companyId, reportId),
        queryFn: () => documentsApiService.getUtilisationReportStatus(reportId),
        enabled: Boolean(companyId && reportId),
        staleTime: 10_000,
        retry: 1,
        refetchInterval: (query) => {
            const status = query.state.data?.status;
            return !status ||
                ["DRAFT", "PENDING", "READY_TO_SEND", "SENT", "CHECK"].includes(
                    status,
                )
                ? 10_000
                : false;
        },
    });

export const useHonestSignDocument = (
    companyId: string,
    productGroup: string,
    documentId: string,
) =>
    useQuery({
        queryKey: honestSignKeys.document(companyId, productGroup, documentId),
        queryFn: () =>
            documentsApiService.getDocument(documentId, productGroup),
        enabled: Boolean(companyId && productGroup && documentId),
        staleTime: 30_000,
    });
