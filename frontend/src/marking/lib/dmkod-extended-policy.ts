import { z } from "zod";
import { parseDmKodAggregationRangesJson } from "@marking/lib/dmkod-aggregation-json";

import type {
    DmKodAction,
    DmKodActionRequest,
    DmKodReadMethod,
    DmKodReadRequest,
} from "@marking/lib/dmkod-extended-types";

export const dmKodDedicatedReads = ["OrderUtilisationRanges"] as const;
export const dmKodDedicatedActions = ["PushUtilisationRanges"] as const;
export const dmKodModules = ["marking", "reference", "account"] as const;
export type DmKodModule = (typeof dmKodModules)[number];
export const moduleReads: Record<DmKodModule, DmKodReadMethod[]> = {
    marking: [
        "Validation",
        "ValidationOrder",
        "Validations",
        "OrderValidations",
        "OrderAggregations",
        "OrderReports",
    ],
    reference: [
        "Poas",
        "Products",
        "Product",
        "Statistics",
        "StatisticsDetails",
        "Dictionaries",
        "Variables",
        "Server",
    ],
    account: ["Profile", "Users", "Services"],
};
export const moduleActions: Record<DmKodModule, DmKodAction[]> = {
    marking: [
        "PushValidation",
        "PushAggregationRanges",
        "PushAggregation",
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
    ],
    reference: [],
    account: [
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
    ],
};
export function availableReads(module: DmKodModule, role: string | null) {
    return moduleReads[module].filter((method) =>
        role === "SERVICE"
            ? ["Product", "Variables", "Server"].includes(method)
            : role === "SUPERUSER" || !["Users", "Services"].includes(method),
    );
}
export function availableActions(module: DmKodModule, role: string | null) {
    return moduleActions[module].filter((action) =>
        role === "SERVICE"
            ? action === "PushValidation"
            : module !== "account" ||
              role === "SUPERUSER" ||
              ["UpdateProfile", "UpdateDefaults"].includes(action),
    );
}
export const extendedFields = [
    "id",
    "gtin",
    "month",
    "year",
    "username",
    "nickname",
    "email",
    "role",
    "access",
    "password",
    "settings",
    "company",
    "inn",
    "companyRole",
    "validation",
    "aggregation",
    "aggregationRanges",
    "containers",
    "search",
    "dateFrom",
    "dateTo",
    "page",
    "pageSize",
] as const;
export type ExtendedField = (typeof extendedFields)[number];
export const readFields = (method: DmKodReadMethod): ExtendedField[] => {
    if (method === "Product") return ["gtin"];
    if (method === "Statistics") return ["month", "year"];
    if (method === "StatisticsDetails") return ["month", "year", "id"];
    if (method === "Validations")
        return ["page", "pageSize", "search", "dateFrom", "dateTo"];
    return [
        "Products",
        "Validation",
        "ValidationOrder",
        "OrderValidations",
        "OrderAggregations",
        "OrderReports",
        "OrderUtilisationRanges",
    ].includes(method)
        ? ["id"]
        : [];
};
export const actionFields = (action: DmKodAction): ExtendedField[] => {
    switch (action) {
        case "UpdateProfile":
            return ["username", "nickname", "email", "password"];
        case "UpdateDefaults":
            return ["settings"];
        case "ConnectCompany":
            return ["inn", "companyRole"];
        case "UpdateCompany":
            return ["company"];
        case "LinkUser":
            return ["email"];
        case "UnlinkUser":
        case "AuthenticateService":
        case "RefreshServicePassword":
            return ["username"];
        case "UserRole":
            return ["username", "role"];
        case "UserAccess":
        case "ServiceAccess":
            return ["username", "access"];
        case "UserPermissions":
            return ["username", "settings"];
        case "RegisterService":
            return ["nickname"];
        case "ServiceNickname":
            return ["username", "nickname"];
        case "PushValidation":
            return ["validation"];
        case "PushAggregation":
            return ["aggregation"];
        case "PushAggregationRanges":
            return ["id", "aggregationRanges"];
        case "InspectContainers":
        case "GenerateAggregation":
            return ["containers"];
        case "DraftNda":
        case "ApproveNda":
        case "ApproveContract":
            return [];
        default:
            return ["id"];
    }
};
const integer = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const code = z.string().min(1).max(500);
const strings = z.array(code).max(10000);
const settings = z.strictObject({
    grant: z.array(z.string()).max(10).optional(),
    revoke: z.array(z.string()).max(10).optional(),
});
const validation = z.strictObject({
    include: z
        .array(
            z.strictObject({
                code,
                quality: z.enum(["A", "B", "C", "D", "F"]),
            }),
        )
        .max(10000)
        .optional(),
    exclude: strings.optional(),
    attributes: z
        .strictObject({
            reportedAt: z.iso.datetime({ offset: true }).optional(),
            productionLine: z.string().max(256).optional(),
            shiftUuid: z.uuid().optional(),
            senderType: z.string().max(64).optional(),
            senderUuid: z.uuid().optional(),
        })
        .optional(),
});
const aggregation = z.strictObject({
    include: z
        .array(
            z.strictObject({
                code,
                capacity: integer,
                contains: strings.min(1),
            }),
        )
        .min(1)
        .max(10000),
    exclude: strings.optional(),
    unpack: strings.optional(),
});
const company = z.strictObject({
    companyName: z.string().min(1),
    companyOrgForm: z.enum(["OOO", "IP", "AO", "ZAO", "NAO", "PAO"]),
    signerShortname: z.string().min(1),
    signerPosition: z.string().min(1),
    addressLegal: z.string().min(1),
    inn: z.string().regex(/^(\d{10}|\d{12})$/),
    kpp: z.string().regex(/^\d{9}$/),
    ogrn: z.string().regex(/^(\d{13}|\d{15})$/),
    bank: z.string().min(1),
    bik: z.string().regex(/^\d{9}$/),
    rs: z.string().regex(/^\d{20}$/),
    ks: z.string().regex(/^\d{20}$/),
    phone: z.string().regex(/^\+[1-9]\d{7,14}$/),
    email: z.email(),
    docHeaderPhrase: z.string().min(1),
    companyShortname: z.string().min(1).optional(),
    addressPostal: z.string().min(1).optional(),
});
const structured = { settings, validation, aggregation, company };
export type ExtendedValues = Record<ExtendedField, string>;
export type DmKodActionConfirmation = Readonly<{
    action: DmKodAction;
    values: ExtendedValues;
}>;
export function freezeDmKodActionConfirmation(
    action: DmKodAction,
    values: ExtendedValues,
): DmKodActionConfirmation {
    return Object.freeze({ action, values: Object.freeze({ ...values }) });
}
export function dmKodConfirmationStillAvailable(
    confirmation: DmKodActionConfirmation,
    choices: readonly DmKodAction[],
) {
    return choices.includes(confirmation.action);
}
export const extendedDefaults: ExtendedValues = Object.fromEntries(
    extendedFields.map((f) => [
        f,
        f === "page" ? "1" : f === "pageSize" ? "10" : "",
    ]),
) as ExtendedValues;

export function extendedFormSchema(
    fields: ExtendedField[],
    error: string,
    optional: ExtendedField[] = [],
) {
    const shape = Object.fromEntries(
        extendedFields.map((f) => [f, z.string()]),
    ) as { [K in ExtendedField]: z.ZodString };
    return z.object(shape).superRefine((values, ctx) => {
        for (const field of fields) {
            const value = values[field];
            if (optional.includes(field) && !value.trim()) continue;
            try {
                if (field === "aggregationRanges")
                    parseDmKodAggregationRangesJson(value, Number(values.id));
                else if (field in structured)
                    structured[field as keyof typeof structured].parse(
                        JSON.parse(value),
                    );
                else if (field === "containers")
                    strings.min(1).parse(value.split(/\r?\n/).filter(Boolean));
                else if (
                    ["id", "month", "year", "page", "pageSize"].includes(field)
                ) {
                    const parsed = integer.parse(value);
                    if (
                        (field === "month" && parsed > 12) ||
                        (field === "year" &&
                            (parsed < 2000 || parsed > 2100)) ||
                        (field === "pageSize" && parsed > 100)
                    )
                        throw Error();
                } else if (field === "dateFrom" || field === "dateTo")
                    z.iso.date().parse(value);
                else if (field === "email") z.email().parse(value);
                else if (field === "gtin")
                    z.string()
                        .regex(/^\d{14}$/)
                        .parse(value);
                else if (field === "inn")
                    z.string()
                        .regex(/^(\d{10}|\d{12})$/)
                        .parse(value);
                else if (field === "companyRole")
                    z.enum([
                        "PRINTERY",
                        "CUSTOMS",
                        "LOGISTICS",
                        "CONTRACTS",
                        "COMMISSIONS",
                    ]).parse(value);
                else if (field === "role")
                    z.enum(["USER", "SUPERUSER"]).parse(value);
                else if (field === "access")
                    z.enum(["OPENED", "CLOSED"]).parse(value);
                else
                    z.string()
                        .min(1)
                        .max(field === "password" ? 512 : 256)
                        .parse(value);
            } catch {
                ctx.addIssue({ code: "custom", path: [field], message: error });
            }
        }
    });
}
export function buildExtendedRead(
    method: DmKodReadMethod,
    values: ExtendedValues,
    serviceProviderId?: number,
): DmKodReadRequest {
    const request: DmKodReadRequest = {
        method,
        ...(method.startsWith("Order") ||
        [
            "Poas",
            "Product",
            "Products",
            "Statistics",
            "StatisticsDetails",
            "Validation",
            "ValidationOrder",
            "Validations",
        ].includes(method)
            ? { serviceProviderId }
            : {}),
    };
    for (const f of readFields(method)) {
        if (["id", "month", "year"].includes(f))
            request[f as "id" | "month" | "year"] = Number(values[f]);
        if (f === "gtin") request.gtin = values.gtin;
    }
    if (method === "Validations")
        request.search = {
            page: Number(values.page),
            pageSize: Number(values.pageSize),
            search: values.search || undefined,
            dateFrom: values.dateFrom || undefined,
            dateTo: values.dateTo || undefined,
        };
    return request;
}
export function buildExtendedAction(
    action: DmKodAction,
    values: ExtendedValues,
    clientRequestId: string,
    serviceProviderId?: number,
): DmKodActionRequest {
    const request: DmKodActionRequest = {
        action,
        clientRequestId,
        ...(moduleActions.marking.includes(action)
            ? { serviceProviderId }
            : {}),
    };
    for (const f of actionFields(action)) {
        if (
            ["username", "nickname", "email", "role", "access"].includes(f) &&
            action !== "UpdateProfile"
        )
            request[
                f as "username" | "nickname" | "email" | "role" | "access"
            ] = values[f];
        if (f === "id" && action !== "PushAggregationRanges")
            request.id = Number(values.id);
        if (f === "aggregationRanges")
            request.aggregationRanges = parseDmKodAggregationRangesJson(
                values.aggregationRanges,
                Number(values.id),
            );
        if (f === "settings")
            request.settings = settings.parse(JSON.parse(values.settings));
        if (f === "validation")
            request.validation = validation.parse(
                JSON.parse(values.validation),
            );
        if (f === "aggregation")
            request.aggregation = aggregation.parse(
                JSON.parse(values.aggregation),
            );
        if (f === "company")
            request.company = company.parse(JSON.parse(values.company));
        if (f === "containers")
            request.containers = strings
                .min(1)
                .parse(values.containers.split(/\r?\n/).filter(Boolean));
    }
    if (action === "UpdateProfile")
        request.profile = {
            password: values.password,
            username: values.username || undefined,
            nickname: values.nickname || undefined,
            email: values.email || undefined,
        };
    return request;
}
export type ExtendedIntent = {
    clientRequestId: string;
    action: DmKodAction;
    backgroundTaskId: string | null;
    accepted: boolean;
};
export function extendedTaskSettled(
    task: { state: string; resultState: string | null } | undefined,
) {
    return (
        !!task &&
        (task.state === "FAILED" ||
            (task.state === "COMPLETED" &&
                ["SUCCESS", "FAILED"].includes(task.resultState ?? "")))
    );
}
export function readExtendedIntent(raw: string | null): ExtendedIntent | null {
    try {
        const value = JSON.parse(raw ?? "null") as ExtendedIntent | null;
        return value &&
            z.uuid().safeParse(value.clientRequestId).success &&
            Object.values(moduleActions).flat().includes(value.action) &&
            (value.backgroundTaskId === null ||
                z.uuid().safeParse(value.backgroundTaskId).success) &&
            typeof value.accepted === "boolean"
            ? {
                  clientRequestId: value.clientRequestId,
                  action: value.action,
                  backgroundTaskId: value.backgroundTaskId,
                  accepted: value.accepted,
              }
            : null;
    } catch {
        return null;
    }
}
