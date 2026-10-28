export type CatalogCategory = {
    id: number;
    name: string;
    parentId: number;
    level: number;
    isActive: boolean;
};
export type CatalogProduct = {
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
    attributes: Array<{ id: number; value: string; valueType: string | null }>;
    photoUrl: string | null;
};
export type CatalogSubmission = {
    id: string;
    gtin: string;
    state: "Sending" | "Accepted" | "Unknown" | "Rejected";
    feedId: string | null;
    sendToModeration: boolean;
    createdAtUtc: string;
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
    errors: Array<{
        gtin: string | null;
        attributeId: number | null;
        code: string | null;
        message: string;
    }>;
};

export type CatalogOperation = {
    requestId: string;
    submissionId: string;
    operation: "Update" | "Moderate" | "Sign" | "PrepareSign";
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
