import type { DmKodDictionaryOption } from "@marking/lib/dmkod-types";
export const dmKodOperations = [
    "Synchronize",
    "SynchronizePoas",
    "CreateItem",
    "UpdateItem",
    "DeleteItem",
    "ImportItems",
    "GenerateRequests",
    "GenerateCancellation",
    "PullRequest",
    "DeleteRequest",
    "PullCodes",
    "FixCodes",
    "DownloadCodes",
    "Update",
    "Delete",
] as const;
export type DmKodOrderOperation = (typeof dmKodOperations)[number];
export type DmKodOrderOperationRequest = {
    clientRequestId: string;
    operation: DmKodOrderOperation;
    itemId?: number;
    requestId?: number;
    gtin?: string;
    templateId?: string;
    cisType?: string;
    quantity?: number;
    flag?: string;
    tag?: string;
    paymentType?: string;
    freeCode?: string;
    producer?: string;
    productionOrderId?: string;
    secondaryProductionOrderId?: string;
    releaseMethodType?: string;
    filename?: string;
    filecontent?: string[];
    range?: string;
    filetype?: "csv" | "txt" | "json";
};
export type DmKodWorkflowReceipt = {
    clientRequestId: string;
    orderId: number;
    operation: DmKodOrderOperation;
    backgroundTaskId: string;
    replayed: boolean;
};
export type DmKodWorkflowTask = {
    backgroundTaskId: string;
    state: string;
    resultState: string | null;
    hasFile: boolean;
    requestIds: number[];
    messages: { key: string | null; level: string | null }[];
};
export type DmKodCodeRequest = {
    id: number;
    type: string;
    state: string;
    uuid: string | null;
    createdAtUtc: string | null;
    failureReason?: string | null;
    items?: {
        orderItemId: number | null;
        gtin: string | null;
        quantity: number | null;
    }[];
};
export type DmKodRequestSigningData = {
    requestId: number;
    data: string;
    payloadHash: string;
};
export type DmKodRequestSigned = {
    requestId: number;
    uuid: string | null;
    replayed: boolean;
};
export type DmKodWorkflowOptions = Record<string, DmKodDictionaryOption[]>;
export type DmKodUtilisationSession = {
    id: number;
    createdAtUtc: string | null;
    included: number | null;
    excluded: number | null;
    notFound: number | null;
};
export type DmKodUtilisationPage = {
    items: DmKodUtilisationSession[];
    totalRows: number;
    filteredRows: number;
    pages: number;
    page: number;
};
export type DmKodUtilisationDetails = {
    items: {
        orderId: number | null;
        itemId: number | null;
        gtin: string | null;
        productName: string | null;
        counts: Record<string, number | null>;
    }[];
};
