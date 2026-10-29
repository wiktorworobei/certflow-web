import { apiClient, toHttpError } from "@marking/lib/honest-sign/httpClient";
import i18n from "@marking/src/i18n";

import type {
    CreateUtilisationBatchRequest,
    UtilisationBatch,
    UtilisationBatchesPage,
} from "@marking/lib/honest-sign/utilisationBatch";
import type { UtilisationReportPayload } from "@marking/lib/honest-sign/utilisationReport";

export type SubmitUtilisationReportPayload = UtilisationReportPayload;

export type SubmitUtilisationReportResponse = {
    reportId: string | null;
    status: string | null;
    message: string | null;
    rawResponse: unknown;
};

export type HonestSignUtilisationReportStatus = {
    reportId: string;
    status: string | null;
    errorReason: string | null;
};

export type HonestSignDocumentView = "all" | "in-work" | "processed";

export type UtilisationSourceDocument = {
    documentId: string;
    title: string;
    uploadedAtUtc: string;
    printedCodesCount: number;
};
export type UtilisationSourceDocuments = {
    items: UtilisationSourceDocument[];
    hasNextPage: boolean;
};
export type UtilisationDocumentCodes = {
    documentId: string;
    title: string;
    sntins: string[];
};

export type HonestSignDocumentSummary = {
    documentId: string;
    documentDateUtc: string | null;
    receivedAtUtc: string | null;
    type: string | null;
    status: string | null;
    productGroup: string | null;
    isIncoming: boolean | null;
    errors: string[];
};

export type HonestSignDocumentsResult = {
    items: HonestSignDocumentSummary[];
    hasNextPage: boolean;
};

export type HonestSignDocumentDetails = HonestSignDocumentSummary & {
    senderInn: string | null;
    senderName: string | null;
    receiverInn: string | null;
    receiverName: string | null;
};

const DOCUMENTS_URL = "/api/honest-sign/documents";
const SUBMIT_UTILISATION_REPORT_URL = "/api/honest-sign/reports/utilisation";

function parseBody(body: string | undefined): unknown {
    if (!body) {
        return null;
    }

    try {
        return JSON.parse(body);
    } catch {
        return body;
    }
}

function readErrorMessage(body: unknown): string {
    if (typeof body === "string") {
        return body;
    }

    if (!body || typeof body !== "object") {
        return "";
    }

    const candidates = [
        "message",
        "detail",
        "description",
        "error",
        "rawText",
    ] as const;
    for (const key of candidates) {
        const value = (body as Record<string, unknown>)[key];
        if (typeof value === "string" && value.trim().length > 0) {
            return value.trim();
        }
    }

    return "";
}

export const documentsApiService = {
    async listUtilisationBatches(
        page: number,
        signal?: AbortSignal,
    ): Promise<UtilisationBatchesPage> {
        try {
            return (
                await apiClient.get<UtilisationBatchesPage>(
                    `${SUBMIT_UTILISATION_REPORT_URL}/batches`,
                    { params: { page }, signal },
                )
            ).data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.documents.batch.errors.load"),
                error,
            );
        }
    },
    async getUtilisationBatch(
        id: string,
        signal?: AbortSignal,
    ): Promise<UtilisationBatch> {
        try {
            return (
                await apiClient.get<UtilisationBatch>(
                    `${SUBMIT_UTILISATION_REPORT_URL}/batches/${encodeURIComponent(id)}`,
                    { signal },
                )
            ).data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.documents.batch.errors.load"),
                error,
            );
        }
    },
    async createUtilisationBatch(
        request: CreateUtilisationBatchRequest,
    ): Promise<UtilisationBatch> {
        try {
            return (
                await apiClient.post<UtilisationBatch>(
                    `${SUBMIT_UTILISATION_REPORT_URL}/batches`,
                    request,
                )
            ).data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.documents.batch.errors.store"),
                error,
            );
        }
    },
    async processUtilisationBatchNext(id: string): Promise<UtilisationBatch> {
        try {
            return (
                await apiClient.post<UtilisationBatch>(
                    `${SUBMIT_UTILISATION_REPORT_URL}/batches/${encodeURIComponent(id)}/process-next`,
                    {},
                )
            ).data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.documents.batch.errors.process"),
                error,
            );
        }
    },
    async skipUtilisationBatchItem(
        id: string,
        itemId: string,
    ): Promise<UtilisationBatch> {
        try {
            return (
                await apiClient.post<UtilisationBatch>(
                    `${SUBMIT_UTILISATION_REPORT_URL}/batches/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}/skip`,
                    {},
                )
            ).data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.documents.batch.errors.skip"),
                error,
            );
        }
    },
    async listUtilisationDocuments(
        page: number,
        search: string,
        signal?: AbortSignal,
    ): Promise<UtilisationSourceDocuments> {
        try {
            return (
                await apiClient.get<UtilisationSourceDocuments>(
                    `${SUBMIT_UTILISATION_REPORT_URL}/documents`,
                    { params: { page, search }, signal },
                )
            ).data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.documents.source.loadFailed"),
                error,
            );
        }
    },
    async getUtilisationDocumentCodes(
        documentId: string,
        signal?: AbortSignal,
    ): Promise<UtilisationDocumentCodes> {
        try {
            return (
                await apiClient.get<UtilisationDocumentCodes>(
                    `${SUBMIT_UTILISATION_REPORT_URL}/documents/${encodeURIComponent(documentId)}/codes`,
                    { signal },
                )
            ).data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.documents.source.codesLoadFailed"),
                error,
            );
        }
    },
    async searchDocuments(
        productGroup: string,
        limit = 20,
        view: HonestSignDocumentView = "all",
    ): Promise<HonestSignDocumentsResult> {
        try {
            const response = await apiClient.get<HonestSignDocumentsResult>(
                DOCUMENTS_URL,
                { params: { productGroup, limit, view } },
            );
            return response.data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.documentsLoadFailed"),
                error,
            );
        }
    },

    async getDocument(
        documentId: string,
        productGroup: string,
    ): Promise<HonestSignDocumentDetails> {
        try {
            const response = await apiClient.get<HonestSignDocumentDetails>(
                `${DOCUMENTS_URL}/${encodeURIComponent(documentId)}`,
                { params: { productGroup } },
            );
            return response.data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.documentDetailsFailed"),
                error,
            );
        }
    },

    async createDocument(
        productGroup: string,
        payload: unknown,
    ): Promise<unknown> {
        try {
            const response = await apiClient.post<unknown>(
                DOCUMENTS_URL,
                payload,
                {
                    params: { productGroup },
                },
            );
            return response.data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.documentCreateFailed"),
                error,
            );
        }
    },

    async submitUtilisationReport(
        detachedSignature: string,
        payload: SubmitUtilisationReportPayload,
        documentId?: string,
        cisType: "UNIT" | "GROUP" | "SET" = "UNIT",
    ): Promise<SubmitUtilisationReportResponse> {
        try {
            const response =
                await apiClient.post<SubmitUtilisationReportResponse>(
                    documentId
                        ? `${SUBMIT_UTILISATION_REPORT_URL}/documents/${encodeURIComponent(documentId)}`
                        : SUBMIT_UTILISATION_REPORT_URL,
                    payload,
                    {
                        params: { cisType },
                        headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                            "x-signature": detachedSignature,
                        },
                    },
                );

            return response.data;
        } catch (error) {
            const httpError = toHttpError(
                i18n.t("honestSign.messages.reportRequestFailed"),
                error,
            ) as Error & {
                body?: string;
            };
            const message = readErrorMessage(parseBody(httpError.body));

            if (message) {
                httpError.message = message;
            }

            throw httpError;
        }
    },

    async getUtilisationReportStatus(
        reportId: string,
    ): Promise<HonestSignUtilisationReportStatus> {
        try {
            const response =
                await apiClient.get<HonestSignUtilisationReportStatus>(
                    `${SUBMIT_UTILISATION_REPORT_URL}/${encodeURIComponent(reportId)}/status`,
                );
            return response.data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.reportStatusFailed"),
                error,
            );
        }
    },
};
