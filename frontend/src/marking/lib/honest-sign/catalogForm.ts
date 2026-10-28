import { z } from "zod";

import type {
    CatalogAttribute,
    CatalogCardRequest,
    CatalogFeedStatus,
} from "./catalogTypes";

export type CatalogFormValues = {
    categoryId: string;
    gtin: string;
    name: string;
    brand: string;
    tnved: string;
    photoUrl: string;
    sendToModeration: boolean;
    attributes: Record<string, Array<{ value: string; valueType: string }>>;
};
// Numeric dot-path segments are treated as array indices by React Hook Form.
export const catalogAttributeKey = (id: number) => `attr_${id}`;
export const isCatalogPermitAttribute = (id: number) =>
    [23555, 23890, 23561, 23557].includes(id);
export const isValidCatalogTnved = (value: string) =>
    /^\d{4,10}$/.test(value.trim());
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
        });
    }
    return {
        categoryId: String(card.categoryId),
        gtin: card.gtin,
        name: card.name,
        brand: card.brand,
        tnved: card.tnved,
        photoUrl: card.photoUrl ?? "",
        sendToModeration: false,
        attributes,
    };
}
/** Only an authoritative rejection, or a completed 4xx without any intent, unlocks an editable payload. */
export function canEditCatalogFailure(
    status: number | null,
    receipt: { state: string } | null,
) {
    if (receipt) return receipt.state === "Rejected";
    return status !== null && [400, 401, 403, 422].includes(status);
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
export function catalogRequirements(
    model: CatalogAttribute[],
    values: CatalogFormValues,
) {
    const coreValues: Record<number, string> = {
        2478: values.name.trim(),
        2504: values.brand.trim(),
        3959: values.tnved.trim().slice(0, 4),
        23768: "43",
    };
    if (values.tnved.trim().length === 10)
        coreValues[13933] = values.tnved.trim();
    const required = new Set(
        model.filter((a) => a.requirement === "m").map((a) => a.id),
    );
    const activated = new Set<number>();
    let changed: boolean;
    do {
        changed = false;
        for (const attr of model) {
            if (attr.requirement === "b" && !activated.has(attr.id)) continue;
            for (const dependency of attr.dependencies) {
                if (
                    coreValues[attr.id] !== undefined
                        ? coreValues[attr.id] === dependency.value
                        : values.attributes[catalogAttributeKey(attr.id)]?.some(
                              (v) => v.value.trim() === dependency.value,
                          )
                ) {
                    for (const id of dependency.attributeIds) {
                        required.add(id);
                        changed ||= !activated.has(id);
                        activated.add(id);
                    }
                }
            }
        }
    } while (changed);
    return { required, activated };
}
export function catalogLayerCompletion(
    model: CatalogAttribute[],
    values: CatalogFormValues,
) {
    const { required } = catalogRequirements(model, values);
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
                                  ? "43"
                                  : values.tnved.trim(),
                      )
                    : values.attributes[catalogAttributeKey(a.id)]?.some(
                          (v) =>
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
            categoryId: z.string().regex(/^[1-9]\d*$/, message("required")),
            gtin: z
                .string()
                .trim()
                .refine(isValidCatalogGtin, message("gtinInvalid")),
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
                z.array(z.object({ value: z.string(), valueType: z.string() })),
            ),
        })
        .superRefine((values, ctx) => {
            const { required, activated } = catalogRequirements(model, values);
            for (const attr of model) {
                if (isCoreCatalogAttribute(attr.id, values.tnved)) continue;
                if (attr.requirement === "b" && !activated.has(attr.id))
                    continue;
                const entries =
                    values.attributes[catalogAttributeKey(attr.id)] ?? [];
                const filled = entries.filter((v) => v.value.trim());
                const path = [
                    "attributes",
                    catalogAttributeKey(attr.id),
                    0,
                    "value",
                ];
                if (
                    values.sendToModeration &&
                    required.has(attr.id) &&
                    filled.length === 0
                )
                    ctx.addIssue({
                        code: "custom",
                        path,
                        message: message("required"),
                    });
                for (const [index, value] of entries.entries()) {
                    if (!value.value.trim()) continue;
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
                if (
                    (!attr.isMultiple && filled.length > 1) ||
                    (attr.multiplicityType === "unique" &&
                        new Set(filled.map((v) => v.valueType)).size !==
                            filled.length)
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
    const { activated } = catalogRequirements(model, values);
    return {
        requestId,
        categoryId: Number(values.categoryId),
        gtin: values.gtin.trim().padStart(14, "0"),
        name: values.name.trim(),
        brand: values.brand.trim(),
        tnved: values.tnved.trim(),
        photoUrl: values.photoUrl.trim() || null,
        sendToModeration: values.sendToModeration,
        attributes: model
            .filter(
                (a) =>
                    !isCoreCatalogAttribute(a.id, values.tnved) &&
                    (a.requirement !== "b" || activated.has(a.id)),
            )
            .flatMap((a) =>
                (values.attributes[catalogAttributeKey(a.id)] ?? [])
                    .filter((v) => v.value.trim())
                    .map((v) => ({
                        id: a.id,
                        value: v.value.trim(),
                        valueType: v.valueType || null,
                    })),
            ),
    };
}
export const shouldPollCatalogFeed = (data: CatalogFeedStatus | undefined) =>
    !data ||
    (data.submissionState === "Accepted" &&
        ["Processing", "Received"].includes(data.status ?? ""));
