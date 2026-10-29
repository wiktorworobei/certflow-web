import type { DmKodSignReport } from "@marking/lib/dmkod-report-types";
import type { DmKodDictionaryOption } from "@marking/lib/dmkod-types";
import type {
    DmKodUtilisationAttributes,
    DmKodOrdersSearch,
} from "@marking/lib/dmkod-types";

export const dmKodReadMethods = [
    "Server",
    "Variables",
    "Dictionaries",
    "Profile",
    "Users",
    "Services",
    "Poas",
    "Products",
    "Product",
    "Statistics",
    "StatisticsDetails",
    "Validation",
    "ValidationOrder",
    "Validations",
    "OrderValidations",
    "OrderAggregations",
    "OrderReports",
    "OrderUtilisationRanges",
] as const;
export type DmKodReadMethod = (typeof dmKodReadMethods)[number];
export const dmKodActions = [
    "UpdateProfile",
    "UpdateDefaults",
    "ConnectCompany",
    "UpdateCompany",
    "LinkUser",
    "UnlinkUser",
    "UserRole",
    "UserAccess",
    "UserPermissions",
    "RegisterService",
    "ServiceAccess",
    "ServiceNickname",
    "AuthenticateService",
    "RefreshServicePassword",
    "DraftNda",
    "ApproveNda",
    "ApproveContract",
    "PushValidation",
    "PushAggregation",
    "PushAggregationRanges",
    "InspectContainers",
    "GenerateAggregation",
    "GenerateOrderValidation",
    "GenerateOrderAggregation",
    "SignValidation",
    "SignAggregation",
    "PullValidation",
    "PullAggregation",
    "DeleteValidation",
    "DeleteAggregation",
    "PushUtilisationRanges",
] as const;
export type DmKodAction = (typeof dmKodActions)[number];
export type DmKodReadRequest = {
    method: DmKodReadMethod;
    id?: number;
    gtin?: string;
    month?: number;
    year?: number;
    search?: DmKodOrdersSearch;
    names?: string[];
    serviceProviderId?: number;
};
export type DmKodExternalCompany = {
    id: number | null;
    uuid: string | null;
    name: string | null;
    inn: string | null;
    type: string | null;
    role: string | null;
    access: string | null;
};
export type DmKodAccount = {
    username: string | null;
    nickname: string | null;
    displayName: string | null;
    email: string | null;
    role: string | null;
    access: string | null;
    permissions: string[];
    defaults: string[];
    company: DmKodExternalCompany | null;
    integratees: DmKodExternalCompany[];
    documents: Record<string, string>;
};
export type DmKodMetadataRow = {
    id: number | null;
    orderId: number | null;
    itemId: number | null;
    uuid: string | null;
    name: string | null;
    gtin: string | null;
    type: string | null;
    state: string | null;
    createdAtUtc: string | null;
    counts: Record<string, number>;
};
export type DmKodPoa = {
    id: number;
    uuid?: string | null;
    productGroups?: string[] | null;
    principal: DmKodExternalCompany | null;
    state: string | null;
    startAtUtc: string | null;
    endAtUtc: string | null;
    permissions: string[];
};
export type DmKodProduct = {
    gtin: string | null;
    name: string | null;
    cisType: string | null;
    group: string | null;
    scheme: string | null;
    capacity: number | null;
};
export type DmKodExtendedResult = {
    aggregationRanges?: DmKodAggregationRangeRow[];
    aggregationReports?: DmKodAggregationReport[];
    profile: DmKodAccount | null;
    accounts: DmKodAccount[] | null;
    rows: DmKodMetadataRow[] | null;
    products: DmKodProduct[] | null;
    totalRows: number | null;
    filteredRows: number | null;
    pages: number | null;
    page: number | null;
    dictionaries: Record<string, DmKodDictionaryOption[]> | null;
    variables: Record<string, string> | null;
    app: string | null;
    version: string | null;
    branch: string | null;
    poas: DmKodPoa[] | null;
    utilisationItems?: DmKodItemActivityRanges[] | null;
    validationItems?: DmKodItemActivityRanges[] | null;
};
export type DmKodAggregationRangeLink = {
    key: string;
    orderItemId: number | null;
    start: number | null;
    end: number | null;
    readOnly: boolean;
    label: string | null;
};
export type DmKodAggregationRangeRow = DmKodAggregationRangeLink & {
    capacity: number | string | null;
    parent: DmKodAggregationRangeLink | null;
    updatedAt: string | null;
    excluded: boolean;
    unpacked: boolean;
    mixItems: boolean;
    state: string;
};
export type DmKodAggregationReport = {
    id: number;
    canSign: boolean;
    state: string;
    uuid: string | null;
    createdAtUtc: string | null;
    failureReason: string | null;
    precedingAggregationReportIds: number[];
    precedesAggregationReportId: number | null;
};
export type DmKodPositionRange = {
    start: number;
    end: number;
    tag?: string | null;
};
export type DmKodActivityRangeState = {
    state: string;
    total: number | null;
    ranges: DmKodPositionRange[];
    attributes: DmKodUtilisationAttributes | null;
};
export type DmKodItemActivityRanges = {
    orderItemId: number;
    states: DmKodActivityRangeState[];
};
export type DmKodUtilisationRangesPush = {
    orderId: number;
    orderItemId: number;
    include?: DmKodPositionRange[];
    exclude?: DmKodPositionRange[];
    attributes?: DmKodUtilisationAttributes;
};
export type DmKodCompanyUpdate = {
    companyName: string;
    companyOrgForm: string;
    signerShortname: string;
    signerPosition: string;
    addressLegal: string;
    inn: string;
    kpp: string;
    ogrn: string;
    bank: string;
    bik: string;
    rs: string;
    ks: string;
    phone: string;
    email: string;
    docHeaderPhrase: string;
    companyShortname?: string;
    addressPostal?: string;
};
export type DmKodValidationPush = {
    include?: { code: string; quality: "A" | "B" | "C" | "D" | "F" }[];
    exclude?: string[];
    attributes?: {
        reportedAt?: string;
        productionLine?: string;
        shiftUuid?: string;
        senderType?: string;
        senderUuid?: string;
    };
};
export type DmKodAggregationPush = {
    include: { code: string; capacity: number; contains: string[] }[];
    exclude?: string[];
    unpack?: string[];
};
export type DmKodJsonValue =
    | string
    | number
    | boolean
    | null
    | DmKodJsonValue[]
    | { [key: string]: DmKodJsonValue };
export type DmKodAggregationRangeRef = {
    orderItemId: number;
    start: number;
    end: number;
};
export type DmKodAggregationRangeContainer = DmKodAggregationRangeRef & {
    capacity?: number | string | null;
    parent?: DmKodAggregationRangeRef | null;
    updatedAt?: string | null;
    excluded?: boolean;
    unpacked?: boolean;
    mixItems?: boolean;
};
export type DmKodAggregationRangesPush = {
    orderId: number;
    containers: DmKodAggregationRangeContainer[];
    attributes?: { [key: string]: DmKodJsonValue };
};
export type DmKodActionRequest = {
    clientRequestId: string;
    action: DmKodAction;
    id?: number;
    username?: string;
    nickname?: string;
    email?: string;
    role?: string;
    access?: string;
    profile?: {
        password: string;
        username?: string;
        nickname?: string;
        email?: string;
    };
    settings?: { grant?: string[]; revoke?: string[] };
    company?: DmKodCompanyUpdate;
    connection?: {
        companyRole: string;
        data: string;
        payloadHash: string;
        signature: string;
        certificateThumbprint: string;
    };
    ranges?: DmKodUtilisationRangesPush;
    validation?: DmKodValidationPush;
    aggregation?: DmKodAggregationPush;
    aggregationRanges?: DmKodAggregationRangesPush;
    containers?: string[];
    signing?: DmKodSignReport;
    serviceProviderId?: number;
};
export type DmKodExtendedReceipt = {
    clientRequestId: string;
    action: DmKodAction;
    backgroundTaskId: string | null;
    username: string | null;
    uuid: string | null;
    replayed: boolean;
};
export type DmKodContainerTree = {
    code: string;
    capacity: number | null;
    contains: DmKodContainerTree[];
};
export type DmKodExtendedTask = {
    backgroundTaskId: string;
    state: string;
    resultState: string | null;
    validationId: number | null;
    aggregationId: number | null;
    reportIds: number[];
    counts: Record<string, number>;
    containers: DmKodContainerTree[];
    messages: { key: string | null; level: string | null }[];
};
export type DmKodExtendedSigningData = { data: string; payloadHash: string };
