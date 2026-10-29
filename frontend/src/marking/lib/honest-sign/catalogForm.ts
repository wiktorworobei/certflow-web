import { z } from "zod";

import type {
    CatalogAttribute,
    CatalogCardRequest,
    CatalogFeedStatus,
    CatalogIdentifier,
} from "./catalogTypes";

export type CatalogFormValues = {
    productGroupCode: string;
    gtinMode: "existing" | "technical" | "industrial";
    composition: "single" | "kit" | "set";
    unit: string;
    baseLevel: CatalogIdentifier["level"];
    baseMultiplier: string;
    identifiers: Array<{
        gtin: string;
        level: CatalogIdentifier["level"];
        multiplier: string;
        unit: string;
        packageGenerateOrder: string;
    }>;
    setGtins: Array<{ gtin: string; quantity: string }>;
    images: Array<{ photoType: string; urls: string; identifier: string }>;
    categoryId: string;
    gtin: string;
    name: string;
    brand: string;
    tnved: string;
    photoUrl: string;
    sendToModeration: boolean;
    attributes: Record<
        string,
        Array<{
            value: string;
            valueType: string;
            gtin?: string;
            packageGenerateOrder?: string;
        }>
    >;
};
// Numeric dot-path segments are treated as array indices by React Hook Form.
export const catalogAttributeKey = (id: number) => `attr_${id}`;
export const isCatalogPermitAttribute = (id: number) =>
    [23555, 23890, 23561, 23557].includes(id);
export const isValidCatalogTnved = (value: string) =>
    /^\d{4,10}$/.test(value.trim());
export const catalogPhotoTypes = [
    "default",
    "7",
    "19",
    "13",
    "si1",
    "si2",
    "si3",
    "si4",
    "si5",
    "3ds",
    "marketing",
    "text",
    "ecommerce",
] as const;
export function catalogPackagingScopes(values: CatalogFormValues) {
    return values.identifiers.flatMap((identifier) =>
        identifier.gtin.trim()
            ? [
                  {
                      value: identifier.gtin.trim().padStart(14, "0"),
                      level: identifier.level,
                  },
              ]
            : identifier.packageGenerateOrder
              ? [
                    {
                        value: `generated:${identifier.packageGenerateOrder}`,
                        level: identifier.level,
                    },
                ]
              : [],
    );
}
export function isValidCatalogPhotoUrl(value: string) {
    if (
        !value ||
        value.length > 2048 ||
        !/^https:\/\/[^/]+/.test(value) ||
        !z.url().safeParse(value).success
    )
        return false;
    const url = new URL(value);
    return (
        !url.username &&
        !url.password &&
        !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    );
}
export function splitCatalogPermit(value: string) {
    const [number = "", ...date] = value.split(":::");
    return { number, date: date.join(":::") };
}
export function formatCatalogPermit(number: string, date: string) {
    return number || date ? `${number}:::${date}` : "";
}
export function isValidCatalogPermit(value: string) {
    const parts = value.trim().split(":::");
    return (
        parts.length === 2 &&
        Boolean(parts[0].trim()) &&
        isCatalogDate(parts[1])
    );
}
export const emptyCatalogForm: CatalogFormValues = {
    productGroupCode: "",
    gtinMode: "existing",
    composition: "single",
    unit: "шт",
    baseLevel: "trade-unit",
    baseMultiplier: "1",
    identifiers: [],
    setGtins: [],
    images: [],
    categoryId: "",
    gtin: "",
    name: "",
    brand: "",
    tnved: "",
    photoUrl: "",
    sendToModeration: false,
    attributes: {},
};
export function catalogFormFromCard(
    card: CatalogCardRequest,
): CatalogFormValues {
    const attributes: CatalogFormValues["attributes"] = {};
    for (const value of card.attributes) {
        (attributes[catalogAttributeKey(value.id)] ??= []).push({
            value: value.value,
            valueType: value.valueType ?? "",
            ...(value.gtin ? { gtin: value.gtin } : {}),
            ...(value.packageGenerateOrder
                ? { packageGenerateOrder: String(value.packageGenerateOrder) }
                : {}),
        });
    }
    return {
        productGroupCode: card.productGroupCode
            ? String(card.productGroupCode)
            : (card.attributes.find((a) => a.id === 23768)?.value ?? ""),
        gtinMode: card.isTechGtin
            ? "technical"
            : card.isSim
              ? "industrial"
              : "existing",
        composition: card.isSet ? "set" : card.isKit ? "kit" : "single",
        unit:
            card.identifiers?.find(
                (i) =>
                    i.gtin?.padStart(14, "0") === card.gtin.padStart(14, "0"),
            )?.unit ?? "шт",
        baseLevel:
            card.identifiers?.find(
                (i) =>
                    i.gtin?.padStart(14, "0") === card.gtin.padStart(14, "0"),
            )?.level ?? "trade-unit",
        baseMultiplier: String(
            card.identifiers?.find(
                (i) =>
                    i.gtin?.padStart(14, "0") === card.gtin.padStart(14, "0"),
            )?.multiplier ?? 1,
        ),
        identifiers: (card.identifiers ?? [])
            .filter(
                (i) =>
                    i.gtin?.padStart(14, "0") !== card.gtin.padStart(14, "0"),
            )
            .map((i) => ({
                gtin: i.gtin ?? "",
                level: i.level,
                multiplier: String(i.multiplier),
                unit: i.unit ?? "",
                packageGenerateOrder: i.packageGenerateOrder
                    ? String(i.packageGenerateOrder)
                    : "",
            })),
        setGtins: (card.setGtins ?? []).map((i) => ({
            gtin: i.gtin,
            quantity: String(i.quantity),
        })),
        images: (card.images ?? []).map((i) => ({
            photoType: i.photoType,
            urls: (i.photoUrls ?? (i.photoUrl ? [i.photoUrl] : [])).join("\n"),
            identifier: i.identifier ?? "",
        })),
        categoryId: String(card.categoryId),
        gtin: card.gtin,
        name: card.name,
        brand: card.brand,
        tnved: card.tnved,
        photoUrl: card.images?.length ? "" : (card.photoUrl ?? ""),
        sendToModeration: false,
        attributes,
    };
}
/** Compatibility for older backend responses; the client does not impose a GTIN policy. */
export function isCatalogGtinPreflightConflict(
    status: number | null,
    code: string | null,
): boolean {
    return (
        status === 409 &&
        code !== null &&
        [
            "error.honest_sign_catalog_gtin_pending",
            "error.honest_sign_catalog_gtin_draft_exists",
            "error.honest_sign_catalog_gtin_exists",
            "error.honest_sign_catalog_gtin_archived",
        ].includes(code)
    );
}

/** An authoritative receipt takes precedence over a failed parallel request. */
export function canEditCatalogFailure(
    status: number | null,
    receipt: { state: string } | null,
    code: string | null = null,
) {
    if (receipt) return receipt.state === "Rejected";
    return (
        (status !== null && [400, 401, 403, 422].includes(status)) ||
        isCatalogGtinPreflightConflict(status, code)
    );
}

/** Undefined means the receipt read failed; null means it confirmed no own intent. */
export function catalogFailureRecoveryNotice(
    status: number | null,
    code: string | null,
    receiptState: string | null | undefined,
) {
    if (code === "error.honest_sign_catalog_request_payload_conflict")
        return "requestKeyConflict";
    const gtinConflict = isCatalogGtinPreflightConflict(status, code);
    if (receiptState === undefined)
        return gtinConflict
            ? "conflictReceiptUnavailable"
            : "unknownAfterError";
    if (
        receiptState === "Draft" ||
        receiptState === "Rejected" ||
        (receiptState === null && canEditCatalogFailure(status, null, code))
    )
        return "editableAfterError";
    return gtinConflict ? "conflictReceiptFound" : "unknownAfterError";
}

export function isValidCatalogGtin(value: string) {
    if (!/^(\d{8}|\d{12}|\d{13}|\d{14})$/.test(value)) return false;
    let sum = 0;
    for (let i = value.length - 2; i >= 0; i--)
        sum += Number(value[i]) * ((value.length - 2 - i) % 2 === 0 ? 3 : 1);
    return (10 - (sum % 10)) % 10 === Number(value.at(-1));
}
export function isValidCatalogText(value: string) {
    return [...value].every((character) => {
        const code = character.codePointAt(0)!;
        return (
            code === 10 ||
            code === 13 ||
            (code >= 0x20 && code <= 0x7e) ||
            (code >= 0xa1 && code <= 0x24f) ||
            (code >= 0x2b0 && code <= 0x52f) ||
            (code >= 0x2000 && code <= 0x209f) ||
            [0x2116, 0x2264, 0x2265].includes(code) ||
            (code >= 0x4e00 && code <= 0x9fff)
        );
    });
}
export function catalogValueScope(
    entry: { gtin?: string; packageGenerateOrder?: string },
    values: CatalogFormValues,
) {
    if (entry.packageGenerateOrder)
        return `generated:${entry.packageGenerateOrder}`;
    if (
        !entry.gtin ||
        (values.gtin &&
            entry.gtin.trim().padStart(14, "0") ===
                values.gtin.trim().padStart(14, "0"))
    )
        return "card";
    return entry.gtin.trim().padStart(14, "0");
}
export function catalogRequirements(
    model: CatalogAttribute[],
    values: CatalogFormValues,
) {
    const coreValues: Record<number, string> = {
        2478: values.name.trim(),
        2504: values.brand.trim(),
        3959: values.tnved.trim().slice(0, 4),
        23768: values.productGroupCode,
    };
    if (values.tnved.trim().length === 10)
        coreValues[13933] = values.tnved.trim();
    const scopes = new Set([
        "card",
        ...Object.values(values.attributes).flatMap((entries) =>
            entries.map((entry) => catalogValueScope(entry, values)),
        ),
    ]);
    const requiredByScope = new Map<string, Set<number>>();
    const activatedByScope = new Map<string, Set<number>>();
    for (const scope of scopes) {
        const required = new Set(
            scope === "card"
                ? model.filter((a) => a.requirement === "m").map((a) => a.id)
                : [],
        );
        const activated = new Set<number>();
        let changed: boolean;
        do {
            changed = false;
            for (const attr of model) {
                if (attr.requirement === "b" && !activated.has(attr.id))
                    continue;
                for (const dependency of attr.dependencies) {
                    const matches =
                        scope === "card" && coreValues[attr.id] !== undefined
                            ? coreValues[attr.id] === dependency.value
                            : values.attributes[
                                  catalogAttributeKey(attr.id)
                              ]?.some(
                                  (entry) =>
                                      catalogValueScope(entry, values) ===
                                          scope &&
                                      entry.value.trim() === dependency.value,
                              );
                    if (!matches) continue;
                    for (const id of dependency.attributeIds) {
                        required.add(id);
                        changed ||= !activated.has(id);
                        activated.add(id);
                    }
                }
            }
        } while (changed);
        requiredByScope.set(scope, required);
        activatedByScope.set(scope, activated);
    }
    return {
        required: new Set(
            [...requiredByScope.values()].flatMap((ids) => [...ids]),
        ),
        activated: new Set(
            [...activatedByScope.values()].flatMap((ids) => [...ids]),
        ),
        primaryRequired: requiredByScope.get("card")!,
        requiredByScope,
        activatedByScope,
    };
}
export function catalogLayerCompletion(
    model: CatalogAttribute[],
    values: CatalogFormValues,
) {
    const { primaryRequired: required } = catalogRequirements(model, values);
    const count = (layer: "isFirstLayer" | "isSecondLayer") => {
        const fields = model.filter((a) => required.has(a.id) && a[layer]);
        return {
            total: fields.length,
            filled: fields.filter((a) =>
                isCoreCatalogAttribute(a.id, values.tnved)
                    ? Boolean(
                          a.id === 2478
                              ? values.name.trim()
                              : a.id === 2504
                                ? values.brand.trim()
                                : a.id === 23768
                                  ? values.productGroupCode
                                  : values.tnved.trim(),
                      )
                    : values.attributes[catalogAttributeKey(a.id)]?.some(
                          (v) =>
                              catalogValueScope(v, values) === "card" &&
                              v.value.trim() &&
                              (!isCatalogPermitAttribute(a.id) ||
                                  isValidCatalogPermit(v.value)),
                      ),
            ).length,
        };
    };
    return { first: count("isFirstLayer"), second: count("isSecondLayer") };
}
export const isCoreCatalogAttribute = (id: number, tnved: string) =>
    [2478, 2504, 3959, 23768].includes(id) ||
    (id === 13933 && tnved.trim().length === 10);

export type CatalogAttributeGroup = {
    key: string;
    name: string;
    layer: "first" | "second" | "both" | "general";
    attributes: CatalogAttribute[];
};

/** Group only by Catalog metadata; labels never decide a field's semantics. */
export function groupCatalogAttributes(
    model: CatalogAttribute[],
    values: CatalogFormValues,
) {
    const { required, activated } = catalogRequirements(model, values);
    const groups = new Map<string, CatalogAttributeGroup>();
    for (const attribute of model) {
        if (
            (isCoreCatalogAttribute(attribute.id, values.tnved) &&
                !catalogPackagingScopes(values).length &&
                !values.attributes[catalogAttributeKey(attribute.id)]?.some(
                    (entry) => catalogValueScope(entry, values) !== "card",
                )) ||
            (attribute.requirement === "b" && !activated.has(attribute.id))
        )
            continue;
        const layer = attribute.isFirstLayer
            ? attribute.isSecondLayer
                ? "both"
                : "first"
            : attribute.isSecondLayer
              ? "second"
              : "general";
        const identity =
            attribute.groupId != null
                ? `id:${attribute.groupId}`
                : `name:${attribute.groupName}`;
        const key = `${identity}:${layer}`;
        const group = groups.get(key) ?? {
            key,
            name: attribute.groupName,
            layer,
            attributes: [],
        };
        group.attributes.push(attribute);
        groups.set(key, group);
    }
    return {
        required: [...groups.values()]
            .map((group) => ({
                ...group,
                attributes: group.attributes.filter(
                    (a) =>
                        required.has(a.id) &&
                        !isCoreCatalogAttribute(a.id, values.tnved),
                ),
            }))
            .filter((group) => group.attributes.length > 0),
        optional: [...groups.values()]
            .map((group) => ({
                ...group,
                attributes: group.attributes.filter(
                    (a) =>
                        !required.has(a.id) ||
                        isCoreCatalogAttribute(a.id, values.tnved),
                ),
            }))
            .filter((group) => group.attributes.length > 0),
    };
}

export function createCatalogFormSchema(
    model: CatalogAttribute[],
    message: (key: string) => string,
) {
    const text = (max: number) =>
        z
            .string()
            .trim()
            .min(1, message("required"))
            .max(max, message("invalid"))
            .refine(isValidCatalogText, message("invalid"));
    return z
        .object({
            productGroupCode: z
                .string()
                .refine((v) => !v || /^[1-9]\d*$/.test(v), message("invalid")),
            gtinMode: z.enum(["existing", "technical", "industrial"]),
            composition: z.enum(["single", "kit", "set"]),
            unit: text(255),
            baseLevel: z.enum(["trade-unit", "inner-pack", "box"]),
            baseMultiplier: z.string(),
            identifiers: z
                .array(
                    z.object({
                        gtin: z.string(),
                        level: z.enum(["trade-unit", "inner-pack", "box"]),
                        multiplier: z.string(),
                        unit: z.string(),
                        packageGenerateOrder: z.string(),
                    }),
                )
                .max(499, message("invalid")),
            setGtins: z
                .array(z.object({ gtin: z.string(), quantity: z.string() }))
                .max(1000, message("invalid")),
            images: z
                .array(
                    z.object({
                        photoType: z.string(),
                        urls: z.string(),
                        identifier: z.string(),
                    }),
                )
                .max(100, message("invalid")),
            categoryId: z.string().regex(/^[1-9]\d*$/, message("required")),
            gtin: z.string().trim(),
            name: text(1000),
            brand: text(255),
            tnved: z
                .string()
                .trim()
                .regex(/^\d{4,10}$/, message("tnvedInvalid")),
            photoUrl: z
                .string()
                .trim()
                .refine(
                    (v) =>
                        !v ||
                        (v.length <= 2048 &&
                            /^https:\/\/[^/]+/.test(v) &&
                            z.url().safeParse(v).success &&
                            !new URL(v).username &&
                            !new URL(v).password &&
                            !["localhost", "127.0.0.1", "[::1]"].includes(
                                new URL(v).hostname,
                            )),
                    message("photoInvalid"),
                ),
            sendToModeration: z.boolean(),
            attributes: z.record(
                z.string(),
                z.array(
                    z.object({
                        value: z.string(),
                        valueType: z.string(),
                        gtin: z.string().optional(),
                        packageGenerateOrder: z.string().optional(),
                    }),
                ),
            ),
        })
        .superRefine((values, ctx) => {
            const issue = (path: Array<string | number>, key = "invalid") =>
                ctx.addIssue({ code: "custom", path, message: message(key) });
            const positiveInteger = (value: string) =>
                /^\d+$/.test(value) &&
                Number(value) > 0 &&
                Number.isSafeInteger(Number(value)) &&
                Number(value) <= 2147483647;
            const normalizeGtin = (gtin: string) =>
                gtin.trim().padStart(14, "0");
            if (
                (values.gtinMode === "existing" || values.gtin) &&
                !isValidCatalogGtin(values.gtin)
            )
                issue(["gtin"], "gtinInvalid");
            if (
                values.gtinMode === "industrial" &&
                values.composition === "kit"
            )
                issue(["composition"], "industrialKitInvalid");
            if (
                values.gtinMode === "industrial" &&
                values.productGroupCode &&
                ![28, 34, 42, 51].includes(Number(values.productGroupCode))
            )
                issue(["productGroupCode"], "industrialGroupInvalid");
            if (
                values.gtinMode === "industrial" &&
                !values.gtin &&
                [34, 42].includes(Number(values.productGroupCode)) &&
                (values.composition !== "single" ||
                    values.baseLevel !== "trade-unit" ||
                    values.identifiers.length > 0)
            )
                issue(["composition"], "industrialInitialInvalid");
            if (
                !positiveInteger(values.baseMultiplier) ||
                (values.baseLevel === "trade-unit" &&
                    Number(values.baseMultiplier) !== 1)
            )
                issue(["baseMultiplier"]);
            if (values.unit && values.unit !== "шт") issue(["unit"]);
            const knownGtins = new Set(
                [values.gtin, ...values.identifiers.map((i) => i.gtin)]
                    .filter(Boolean)
                    .map(normalizeGtin),
            );
            for (const [index, identifier] of values.identifiers.entries()) {
                const generated =
                    values.gtinMode === "industrial" &&
                    Boolean(values.gtin) &&
                    identifier.level === "inner-pack" &&
                    !identifier.gtin.trim() &&
                    positiveInteger(identifier.packageGenerateOrder);
                if (
                    (!identifier.gtin.trim() && !generated) ||
                    (identifier.gtin.trim() &&
                        !isValidCatalogGtin(identifier.gtin))
                )
                    issue(["identifiers", index, "gtin"], "gtinInvalid");
                if (
                    !positiveInteger(identifier.multiplier) ||
                    (identifier.level === "trade-unit" &&
                        Number(identifier.multiplier) !== 1)
                )
                    issue(["identifiers", index, "multiplier"]);
                if (identifier.packageGenerateOrder && !generated)
                    issue(["identifiers", index, "packageGenerateOrder"]);
                if (
                    identifier.packageGenerateOrder &&
                    values.identifiers.findIndex(
                        (other) =>
                            other.packageGenerateOrder ===
                            identifier.packageGenerateOrder,
                    ) !== index
                )
                    issue(["identifiers", index, "packageGenerateOrder"]);
                if (identifier.unit && identifier.unit !== "шт")
                    issue(["identifiers", index, "unit"]);
                if (
                    (identifier.gtin &&
                        values.identifiers.findIndex(
                            (other) =>
                                other.gtin &&
                                normalizeGtin(other.gtin) ===
                                    normalizeGtin(identifier.gtin),
                        ) !== index) ||
                    (identifier.gtin &&
                        normalizeGtin(identifier.gtin) ===
                            normalizeGtin(values.gtin))
                )
                    issue(["identifiers", index, "gtin"], "duplicateGtin");
            }
            if (
                values.composition === "set" &&
                values.setGtins.length === 0 &&
                values.sendToModeration &&
                values.productGroupCode !== "1"
            )
                issue(["setGtins"], "setContentsRequired");
            for (const [index, item] of values.setGtins.entries()) {
                if (!isValidCatalogGtin(item.gtin))
                    issue(["setGtins", index, "gtin"], "gtinInvalid");
                else if (
                    normalizeGtin(item.gtin).startsWith("004") !==
                    (values.gtinMode === "industrial")
                )
                    issue(
                        ["setGtins", index, "gtin"],
                        "setComponentTypeInvalid",
                    );
                if (!positiveInteger(item.quantity))
                    issue(["setGtins", index, "quantity"]);
                if (
                    values.gtin &&
                    normalizeGtin(item.gtin) === normalizeGtin(values.gtin)
                )
                    issue(["setGtins", index, "gtin"], "duplicateGtin");
                if (
                    values.setGtins.findIndex(
                        (other) =>
                            normalizeGtin(other.gtin) ===
                            normalizeGtin(item.gtin),
                    ) !== index
                )
                    issue(["setGtins", index, "gtin"], "duplicateGtin");
            }
            for (const [index, image] of values.images.entries()) {
                const urls = image.urls
                    .split(/\r?\n/)
                    .map((url) => url.trim())
                    .filter(Boolean);
                if (
                    !(catalogPhotoTypes as readonly string[]).includes(
                        image.photoType,
                    )
                )
                    issue(["images", index, "photoType"]);
                if (
                    !urls.length ||
                    urls.length > 100 ||
                    (image.photoType !== "3ds" && urls.length !== 1) ||
                    urls.some((url) => !isValidCatalogPhotoUrl(url))
                )
                    issue(["images", index, "urls"], "photoInvalid");
                if (
                    image.identifier &&
                    (!isValidCatalogGtin(image.identifier) ||
                        !knownGtins.has(normalizeGtin(image.identifier)))
                )
                    issue(["images", index, "identifier"], "scopeInvalid");
            }
            if (
                values.gtinMode !== "existing" &&
                !values.gtin &&
                (values.identifiers.length ||
                    values.images.length ||
                    values.photoUrl)
            )
                issue(["gtinMode"], "generatedPackagingAfterIdentity");
            if (values.images.length + (values.photoUrl.trim() ? 1 : 0) > 100)
                issue(["images"], "invalid");
            const { requiredByScope, activated, activatedByScope } =
                catalogRequirements(model, values);
            if (
                buildCatalogCardRequest(values, model, "").attributes.length >
                500
            )
                issue(["attributes"], "invalid");
            for (const attr of model) {
                const coreAttribute = isCoreCatalogAttribute(
                    attr.id,
                    values.tnved,
                );
                if (attr.requirement === "b" && !activated.has(attr.id))
                    continue;
                const entries =
                    values.attributes[catalogAttributeKey(attr.id)] ?? [];
                const filled = entries.filter(
                    (v) =>
                        v.value.trim() &&
                        (attr.requirement !== "b" ||
                            activatedByScope
                                .get(catalogValueScope(v, values))
                                ?.has(attr.id)),
                );
                const path = [
                    "attributes",
                    catalogAttributeKey(attr.id),
                    0,
                    "value",
                ];
                if (
                    !coreAttribute &&
                    values.sendToModeration &&
                    [...requiredByScope].some(
                        ([scope, required]) =>
                            required.has(attr.id) &&
                            !filled.some(
                                (entry) =>
                                    catalogValueScope(entry, values) === scope,
                            ),
                    )
                )
                    ctx.addIssue({
                        code: "custom",
                        path,
                        message: message("required"),
                    });
                for (const [index, value] of entries.entries()) {
                    if (!value.value.trim()) continue;
                    if (
                        attr.id === 13933 &&
                        catalogValueScope(value, values) === "card" &&
                        values.tnved.length === 4 &&
                        (!/^\d{10}$/.test(value.value.trim()) ||
                            !value.value.trim().startsWith(values.tnved))
                    )
                        issue(
                            [
                                "attributes",
                                catalogAttributeKey(attr.id),
                                index,
                                "value",
                            ],
                            "fullTnvedInvalid",
                        );
                    if (
                        attr.id === 13763 &&
                        (!isValidCatalogGtin(value.value.trim()) ||
                            normalizeGtin(value.value).startsWith("004") !==
                                (values.gtinMode === "industrial"))
                    )
                        issue(
                            [
                                "attributes",
                                catalogAttributeKey(attr.id),
                                index,
                                "value",
                            ],
                            "setComponentTypeInvalid",
                        );
                    if (
                        attr.requirement === "b" &&
                        !activatedByScope
                            .get(catalogValueScope(value, values))
                            ?.has(attr.id)
                    )
                        continue;
                    if (
                        coreAttribute &&
                        catalogValueScope(value, values) === "card"
                    ) {
                        issue(
                            [
                                "attributes",
                                catalogAttributeKey(attr.id),
                                index,
                                "value",
                            ],
                            "scopeInvalid",
                        );
                        continue;
                    }
                    if (
                        (value.gtin &&
                            (!isValidCatalogGtin(value.gtin) ||
                                !knownGtins.has(normalizeGtin(value.gtin)))) ||
                        (value.packageGenerateOrder &&
                            !values.identifiers.some(
                                (identifier) =>
                                    identifier.packageGenerateOrder ===
                                        value.packageGenerateOrder &&
                                    values.gtinMode === "industrial",
                            ))
                    )
                        issue(
                            [
                                "attributes",
                                catalogAttributeKey(attr.id),
                                index,
                                "value",
                            ],
                            "scopeInvalid",
                        );
                    if (
                        isCatalogPermitAttribute(attr.id) &&
                        !isValidCatalogPermit(value.value)
                    ) {
                        ctx.addIssue({
                            code: "custom",
                            path: [
                                "attributes",
                                catalogAttributeKey(attr.id),
                                index,
                                "value",
                            ],
                            message: message("permitInvalid"),
                        });
                        continue;
                    }
                    const invalid =
                        value.value.length > 4000 ||
                        !isValidCatalogText(value.value) ||
                        (attr.requirement === "b" && !activated.has(attr.id)) ||
                        (attr.presetOnly &&
                            !attr.options.some(
                                (o) => o.value === value.value.trim(),
                            )) ||
                        (attr.fieldType === "number" &&
                            !/^[+-]?\d+(\.\d+)?$/.test(value.value.trim())) ||
                        (attr.fieldType === "date" &&
                            !isCatalogDate(value.value)) ||
                        (attr.valueTypes.length > 0 &&
                            !attr.valueTypes.includes(value.valueType)) ||
                        (attr.valueTypes.length === 0 &&
                            Boolean(value.valueType));
                    if (invalid)
                        ctx.addIssue({
                            code: "custom",
                            path: [
                                "attributes",
                                catalogAttributeKey(attr.id),
                                index,
                                "value",
                            ],
                            message: message("invalid"),
                        });
                }
                const scoped = new Map<string, typeof filled>();
                for (const entry of filled) {
                    const scope = catalogValueScope(entry, values);
                    scoped.set(scope, [...(scoped.get(scope) ?? []), entry]);
                }
                if (
                    [...scoped.values()].some(
                        (entries) =>
                            (!attr.isMultiple && entries.length > 1) ||
                            (attr.multiplicityType === "unique" &&
                                new Set(entries.map((v) => v.valueType))
                                    .size !== entries.length),
                    )
                )
                    ctx.addIssue({
                        code: "custom",
                        path,
                        message: message("invalid"),
                    });
            }
        });
}
function isCatalogDate(value: string) {
    return (
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        !value.startsWith("0000-") &&
        !Number.isNaN(Date.parse(value)) &&
        new Date(value).toISOString().slice(0, 10) === value
    );
}
export function buildCatalogCardRequest(
    values: CatalogFormValues,
    model: CatalogAttribute[],
    requestId: string,
): CatalogCardRequest {
    const { activated, activatedByScope } = catalogRequirements(model, values);
    const request: CatalogCardRequest = {
        requestId,
        categoryId: Number(values.categoryId),
        gtin: values.gtin.trim() ? values.gtin.trim().padStart(14, "0") : "",
        name: values.name.trim(),
        brand: values.brand.trim(),
        tnved: values.tnved.trim(),
        photoUrl: values.photoUrl.trim() || null,
        sendToModeration: values.sendToModeration,
        attributes: model
            .filter(
                (a) =>
                    (!isCoreCatalogAttribute(a.id, values.tnved) ||
                        values.attributes[catalogAttributeKey(a.id)]?.some(
                            (v) => v.gtin || v.packageGenerateOrder,
                        )) &&
                    (a.requirement !== "b" || activated.has(a.id)),
            )
            .flatMap((a) =>
                (values.attributes[catalogAttributeKey(a.id)] ?? [])
                    .filter(
                        (v) =>
                            v.value.trim() &&
                            (!isCoreCatalogAttribute(a.id, values.tnved) ||
                                catalogValueScope(v, values) !== "card") &&
                            (a.requirement !== "b" ||
                                activatedByScope
                                    .get(catalogValueScope(v, values))
                                    ?.has(a.id)),
                    )
                    .map((v) => ({
                        id: a.id,
                        value: v.value.trim(),
                        valueType: v.valueType || null,
                        ...(v.gtin
                            ? { gtin: v.gtin.trim().padStart(14, "0") }
                            : values.baseLevel !== "trade-unit" &&
                                values.gtin &&
                                !v.packageGenerateOrder
                              ? { gtin: values.gtin.padStart(14, "0") }
                              : {}),
                        ...(v.packageGenerateOrder
                            ? {
                                  packageGenerateOrder: Number(
                                      v.packageGenerateOrder,
                                  ),
                              }
                            : {}),
                    })),
            ),
    };
    if (
        values.productGroupCode ||
        values.gtinMode !== "existing" ||
        values.composition !== "single" ||
        values.baseLevel !== "trade-unit" ||
        values.identifiers.length ||
        values.images.length ||
        values.setGtins.length
    ) {
        request.productGroupCode = values.productGroupCode
            ? Number(values.productGroupCode)
            : null;
        request.isTechGtin = values.gtinMode === "technical";
        request.isSim = values.gtinMode === "industrial";
        request.isSet = values.composition === "set";
        request.isKit = values.composition === "kit";
        request.identifiers = request.gtin
            ? [
                  {
                      gtin: request.gtin,
                      level: values.baseLevel,
                      multiplier: Number(values.baseMultiplier),
                      unit: values.unit.trim(),
                  },
                  ...values.identifiers.map((i) => ({
                      gtin: i.gtin.trim()
                          ? i.gtin.trim().padStart(14, "0")
                          : "",
                      level: i.level,
                      multiplier: Number(i.multiplier),
                      unit: i.unit.trim() || null,
                      ...(i.packageGenerateOrder
                          ? {
                                packageGenerateOrder: Number(
                                    i.packageGenerateOrder,
                                ),
                            }
                          : {}),
                  })),
              ]
            : [];
        request.setGtins =
            values.composition === "set"
                ? values.setGtins.map((i) => ({
                      gtin: i.gtin.trim().padStart(14, "0"),
                      quantity: Number(i.quantity),
                  }))
                : [];
        if (values.images.length) {
            request.images = [
                ...(values.photoUrl.trim()
                    ? [
                          {
                              photoType: "default",
                              photoUrls: [values.photoUrl.trim()],
                          },
                      ]
                    : []),
                ...values.images.map((image) => ({
                    photoType: image.photoType,
                    photoUrls: image.urls
                        .split(/\r?\n/)
                        .map((url) => url.trim())
                        .filter(Boolean),
                    ...(image.identifier
                        ? {
                              identifier: image.identifier.padStart(14, "0"),
                              identifierType: "gtin" as const,
                          }
                        : {}),
                })),
            ];
            request.photoUrl = null;
        }
    }
    return request;
}

export function hasCatalogFormChanges(
    values: CatalogFormValues,
    baseline: CatalogFormValues,
    model: CatalogAttribute[],
) {
    // Blank registered optional controls and whitespace are not changes to the feed.
    return (
        JSON.stringify(buildCatalogCardRequest(values, model, "")) !==
        JSON.stringify(buildCatalogCardRequest(baseline, model, ""))
    );
}
export const isCatalogFeedProcessing = (data: CatalogFeedStatus | undefined) =>
    data?.submissionState === "Sending" ||
    (data?.submissionState === "Accepted" &&
        ["Processing", "Received"].includes(data.status ?? ""));

export const shouldPollCatalogFeed = (data: CatalogFeedStatus | undefined) =>
    !data || isCatalogFeedProcessing(data);
