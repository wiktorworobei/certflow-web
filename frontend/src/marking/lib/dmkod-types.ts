export type DmKodSession = {
    isAuthenticated: true;
    hasDmKodSession: boolean;
    requiresPasswordChange: boolean;
    needsRefresh: boolean;
    username: string | null;
    displayName: string | null;
    externalCompanyName: string | null;
    externalCompanyInn: string | null;
    externalCompanyType: string | null;
    externalRole: string | null;
    certificateThumbprint: string | null;
    honestSignConnectedAtUtc: string | null;
    accessTokenExpiresAtUtc: string | null;
    refreshTokenExpiresAtUtc: string | null;
};

export type DmKodSignIn = {
    username: string;
    password: string;
};

export type DmKodChangePassword = {
    currentPassword: string;
    newPassword: string;
};

export type DmKodConnectionStatus = {
    connected: boolean;
    checkedAtUtc: string;
    certificateThumbprint: string | null;
    connectedAtUtc: string | null;
};

export type DmKodSigningKey = {
    key: string;
};

export type DmKodDictionaryOption = {
    value: string;
    label: string;
    shortLabel?: string | null;
};

export type DmKodUser = {
    username: string | null;
    displayName: string | null;
};

export type DmKodManufacture = {
    kpp: string | null;
    fiasUuid: string | null;
    address: string | null;
};
export type DmKodOrderItemManufactures = {
    orderId: number;
    orderItemId: number;
    manufactures: DmKodManufacture[];
};

export type DmKodParticipant = {
    id: number;
    uuid: string | null;
    name: string;
};

export type DmKodOrder = {
    id: number;
    user: DmKodUser | null;
    participant: DmKodParticipant | null;
    attributes: {
        productionOrderId: string | null;
        secondaryProductionOrderId: string | null;
        releaseMethodType: string | null;
        createMethodType: string | null;
    };
    createdAtUtc: string | null;
    flag: string;
    external: boolean;
    owner: boolean;
    itemsCount: number;
    itemsQuantity: number;
    productGroups: string[];
    orderItemIds: number[];
};

export type DmKodOrdersSearch = {
    page: number;
    pageSize: number;
    flag?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
};

export type DmKodOrdersPage = {
    orders: DmKodOrder[];
    totalRows: number;
    filteredRows: number;
    pages: number;
    page: number;
    totalFlags: Record<string, number>;
    flags: DmKodDictionaryOption[];
    releaseMethods: DmKodDictionaryOption[];
};

export type DmKodOrderItem = {
    id: number;
    user: DmKodUser | null;
    flag: string | null;
    tag: string | null;
    quantity: number;
    product: {
        gtin: string | null;
        name: string | null;
        cisType: string | null;
        group: string | null;
        scheme: string | null;
        capacity: number | null;
    } | null;
    templateId: string | null;
    codeLength: number | null;
    source: string | null;
    createdAtUtc: string | null;
    filename: string | null;
    filetype: string | null;
    receivedQuantity?: number | null;
    readyQuantity?: number | null;
    toSignQuantity?: number | null;
    requestedQuantity?: number | null;
    rejectedQuantity?: number | null;
    suspendedQuantity?: number | null;
    availableQuantity?: number | null;
    requestErrorQuantity?: number | null;
};

export type DmKodOrderDetails = {
    order: DmKodOrder;
    items: DmKodOrderItem[];
};

export type DmKodCreateOrderOptions = {
    participants: DmKodParticipant[];
    releaseMethods: DmKodDictionaryOption[];
};

export type CreateDmKodOrder = {
    clientRequestId: string;
    participantId: number;
    releaseMethodType: string;
    createMethodType?: "SELF_MADE" | "CEM" | "CM" | "CL" | "CA";
    productionOrderId?: string;
    secondaryProductionOrderId?: string;
};

export type DmKodBackgroundTaskAccepted = {
    backgroundTaskId: string;
    replayed: boolean;
};

export type DmKodBackgroundTask = {
    backgroundTaskId: string;
    state: string;
    resultState: string | null;
    createdAtUtc: string | null;
    startedAtUtc: string | null;
    finishedAtUtc: string | null;
    orderId: number | null;
    messages: Array<{ key: string | null; level: string | null }>;
};

export type DmKodUtilisationCode = {
    code: string;
    x97?: string;
    x30?: string;
    x3103?: string;
    x310y?: string;
    x311y?: string;
    x335y?: string;
};
export type DmKodUtilisationAttributes = {
    productionDate?: string;
    expirationDate?: string;
    productionOrderType?: string;
    ownerUuid?: string;
    seriesNumber?: string;
    subjectUuid?: string;
    packingUuid?: string;
    controlUuid?: string;
    customsReceiverUuid?: string;
    expirationDateLess72?: string;
    expirationDateOver72?: string;
    expirationDateOver72Set?: { index?: string; expirationDate?: string };
    usedInProduction?: string;
    batchNumber?: string;
    participantInn?: string;
    kpp?: string;
    fiasUuid?: string;
    alcoholVolume?: string;
    documentNumber?: string;
    documentDate?: string;
    vetisUuid?: string;
};
export type DmKodUtilisationOptions = {
    maxCodesInReportPush: number | null;
    productionOrderTypes: DmKodDictionaryOption[];
    usedInProduction: DmKodDictionaryOption[];
};
export type PushDmKodUtilisation = {
    clientRequestId: string;
    include: DmKodUtilisationCode[];
    exclude: Array<{ code: string }>;
    attributes?: DmKodUtilisationAttributes;
};
export type DmKodUtilisationTask = Omit<DmKodBackgroundTask, "orderId"> & {
    utilisationId: number | null;
    included: number | null;
    excluded: number | null;
    notFound: number | null;
};
