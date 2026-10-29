import type { HonestSignResponseDiagnostics } from "@marking/lib/honest-sign/errorDiagnostics";

export type CatalogCategory = {
    id: number;
    name: string;
    parentId: number;
    level: number;
    isActive: boolean;
    productGroupCodes?: number[] | null;
};
export type CatalogProductGroup = { code: number; name: string };
export type CatalogProductStatusFilter = "draft" | "archived" | "published";
export type CatalogProductFilters = {
    status?: CatalogProductStatusFilter;
    fromDate: string;
    toDate: string;
};
export type CatalogProduct = {
    goodId: number;
    gtin: string;
    name: string;
    brand: string;
    tnved: string;
    status: string;
    detailedStatuses: string[];
    updatedAt: string | null;
    submissionId: string | null;
};
export type CatalogProductsPage = {
    items: CatalogProduct[];
    page: number;
    pageSize: number;
    total: number | null;
    hasNextPage: boolean;
    fromDate: string;
    toDate: string;
};
export type CatalogBrand = { id: number; name: string };
export type CatalogIdentifier = {
    gtin: string;
    level: "trade-unit" | "inner-pack" | "box";
    multiplier: number;
    unit?: string | null;
    packageGenerateOrder?: number | null;
};
export type CatalogImage = {
    photoType: string;
    photoUrls?: string[] | null;
    photoUrl?: string | null;
    identifier?: string | null;
    identifierType?: "gtin" | null;
};
export type CatalogGtinReceipt = {
    requestId: string;
    state: "Sending" | "Accepted" | "Rejected" | "Unknown";
    codes: string[];
    createdAtUtc: string;
    replayed: boolean;
    monthlyLimit?: number | null;
    monthlyUsage?: number | null;
};
export type DeclarationCatalogProduct = {
    gtin: string;
    name: string;
    brand: string;
    tnved: string;
    identification: string;
    okpd2: string;
    storageConditions: string;
    status: string;
};
export type CatalogAttribute = {
    id: number;
    name: string;
    groupName: string;
    groupId?: number | null;
    fieldType: string;
    requirement: "m" | "r" | "o" | "b";
    isMultiple: boolean;
    multiplicityType: string | null;
    presetOnly: boolean;
    options: Array<{ value: string; label: string }>;
    valueTypes: string[];
    dependencies: Array<{ value: string; attributeIds: number[] }>;
    isFirstLayer: boolean;
    isSecondLayer: boolean;
    hasUnsupportedDictionary: boolean;
};
export type CatalogCardRequest = {
    requestId: string;
    categoryId: number;
    gtin: string;
    name: string;
    brand: string;
    tnved: string;
    sendToModeration: boolean;
    attributes: Array<{
        id: number;
        value: string;
        valueType: string | null;
        gtin?: string | null;
        packageGenerateOrder?: number | null;
    }>;
    photoUrl: string | null;
    productGroupCode?: number | null;
    identifiers?: CatalogIdentifier[] | null;
    setGtins?: Array<{ gtin: string; quantity: number }> | null;
    isSet?: boolean;
    isKit?: boolean;
    isTechGtin?: boolean;
    isSim?: boolean;
    images?: CatalogImage[] | null;
};
export type CatalogSubmission = {
    id: string;
    gtin: string;
    state: "Draft" | "Sending" | "Accepted" | "Unknown" | "Rejected";
    feedId: string | null;
    sendToModeration: boolean;
    createdAtUtc: string;
    draftVersion?: string | null;
    identityPending?: boolean;
};
export type CatalogFeedStatus = {
    submissionId: string;
    feedId: string | null;
    submissionState: CatalogSubmission["state"];
    status:
        | "Processing"
        | "Received"
        | "Moderated"
        | "Signed"
        | "Rejected"
        | null;
    receivedAtUtc: string | null;
    updatedAtUtc: string | null;
    correlationId?: string | null;
    responseDiagnostics?: HonestSignResponseDiagnostics | null;
    errors: Array<{
        gtin: string | null;
        attributeId: number | null;
        parameter?: string | null;
        code: string | null;
        message: string;
    }>;
};

export type CatalogOperation = {
    requestId: string;
    submissionId: string;
    operation: "Update" | "Moderate" | "Sign" | "PrepareSign" | "Track";
    state:
        | "Sending"
        | "Processing"
        | "Accepted"
        | "Rejected"
        | "Unknown"
        | "Reconciled"
        | "Prepared";
    goodId: number;
    feedId: string | null;
    error: string | null;
    createdAtUtc: string;
    replayed: boolean;
};
export type CatalogCard = {
    submissionId: string;
    gtin: string;
    goodId: number;
    status: string;
    detailedStatuses: string[];
    isSigned: boolean;
    canOrderCodes: boolean;
    canIntroduce: boolean;
    canEdit: boolean;
    canModerate: boolean;
    canSign: boolean;
    draft: CatalogCardRequest | null;
    blockingOperation: CatalogOperation | null;
};
export type CatalogSigningData = {
    preparationId: string;
    goodId: number;
    xml: string;
    payloadHash: string;
    publicationAgreement: boolean;
    certificateThumbprint: string;
};
export type CatalogSignRequest = {
    requestId: string;
    preparationId: string;
    xml: string;
    payloadHash: string;
    signature: string;
    certificateThumbprint: string;
    publicationAgreement: boolean;
};
