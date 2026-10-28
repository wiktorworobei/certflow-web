import {
    utilisationCodeFields,
    validUtilisationCodeAttribute,
} from "@marking/lib/dmkod-utilisation-policy";

import type {
    DmKodUtilisationAttributes,
    DmKodUtilisationCode,
    PushDmKodUtilisation,
} from "@marking/lib/dmkod-types";

// The JSON file uses the external DMkod contract, while the form uses camelCase.
export const dmKodUtilisationAttributeNames = {
    productionDate: "production_date",
    expirationDate: "expiration_date",
    productionOrderType: "production_order_type",
    ownerUuid: "owner_uuid",
    seriesNumber: "series_number",
    subjectUuid: "subject_uuid",
    packingUuid: "packing_uuid",
    controlUuid: "control_uuid",
    customsReceiverUuid: "customs_receiver_uuid",
    expirationDateLess72: "expiration_date_less_72",
    expirationDateOver72: "expiration_date_over_72",
    usedInProduction: "used_in_production",
    batchNumber: "batch_number",
    participantInn: "participant_inn",
    kpp: "kpp",
    fiasUuid: "fias_uuid",
    alcoholVolume: "alcohol_volume",
    documentNumber: "document_number",
    documentDate: "document_date",
    vetisUuid: "vetis_uuid",
} as const satisfies Record<
    Exclude<keyof DmKodUtilisationAttributes, "expirationDateOver72Set">,
    string
>;

type ScalarAttribute = keyof typeof dmKodUtilisationAttributeNames;
type JsonObject = Record<string, unknown>;

export type ImportedDmKodUtilisationJson = {
    includeText: string;
    excludeText: string;
    attributes: DmKodUtilisationAttributes;
};

function invalidStructure(): never {
    // Never include codes, attribute values or the source document in an error.
    throw new Error("Unsupported DMkod utilisation JSON structure.");
}

function invalidValue(): never {
    throw new Error("Invalid DMkod utilisation JSON value.");
}

function object(value: unknown): JsonObject {
    if (value === null || typeof value !== "object" || Array.isArray(value))
        invalidStructure();
    return value as JsonObject;
}

function knownKeys(value: JsonObject, keys: readonly string[]) {
    if (Object.keys(value).some((key) => !keys.includes(key)))
        invalidStructure();
}

function textValue(value: unknown): string {
    if (typeof value !== "string") invalidStructure();
    // The single-line form and existing CSV policy cannot represent these values
    // without changing them. JSON escapes for a real GS remain U+001D here.
    if (!value.length || /[\r\n]/.test(value) || /^[ \t]|[ \t]$/.test(value))
        invalidValue();
    return value;
}

function codeValue(value: unknown): string {
    const code = textValue(value);
    // The text form decodes this literal spelling; accepting it would change a
    // JSON code that actually contains a backslash rather than a GS character.
    if (/\\u001d/i.test(code)) invalidValue();
    return code;
}

function decimalNumber(value: number): string {
    const text = String(value);
    if (!text.includes("e")) return text;
    const [coefficient, exponent] = text.split("e");
    const digits = coefficient.replace(".", "");
    const point =
        (coefficient.includes(".")
            ? coefficient.indexOf(".")
            : coefficient.length) + Number(exponent);
    if (point <= 0) return `0.${"0".repeat(-point)}${digits}`;
    if (point >= digits.length)
        return `${digits}${"0".repeat(point - digits.length)}`;
    return `${digits.slice(0, point)}.${digits.slice(point)}`;
}

function readCodes(value: unknown, include: boolean): DmKodUtilisationCode[] {
    if (!Array.isArray(value)) invalidStructure();
    return value.map((entry) => {
        const item = object(entry);
        knownKeys(
            item,
            include ? ["code", ...utilisationCodeFields] : ["code"],
        );
        const result: DmKodUtilisationCode = { code: codeValue(item.code) };
        if (!include) return result;
        for (const name of utilisationCodeFields) {
            if (!Object.hasOwn(item, name)) continue;
            const raw = item[name];
            let attribute: string;
            if (name === "x30") {
                if (raw === "--") attribute = raw;
                else if (typeof raw === "number" && Number.isSafeInteger(raw))
                    attribute = String(raw);
                else invalidStructure();
            } else if (name !== "x97" && typeof raw === "number") {
                if (!Number.isFinite(raw) || raw <= 0) invalidValue();
                attribute = decimalNumber(raw);
            } else {
                attribute = textValue(raw);
                if (name !== "x97") attribute = attribute.replace(",", ".");
            }
            if (!validUtilisationCodeAttribute(name, attribute)) invalidValue();
            result[name] = attribute;
        }
        return result;
    });
}

function csvCell(value: string) {
    return /[;"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/** Format a single code list for the form, retaining attributes and CSV quoting. */
export function formatDmKodUtilisationCodes(
    codes: DmKodUtilisationCode[],
): string {
    if (
        !codes.some((code) =>
            utilisationCodeFields.some((name) => name in code),
        )
    )
        return codes.map(({ code }) => code).join("\n");
    return [
        ["code", ...utilisationCodeFields].join(";"),
        ...codes.map((code) =>
            [
                code.code,
                ...utilisationCodeFields.map((name) => code[name] ?? ""),
            ]
                .map(csvCell)
                .join(";"),
        ),
    ].join("\n");
}

function readAttributes(value: unknown): DmKodUtilisationAttributes {
    const item = object(value);
    knownKeys(item, [
        ...Object.values(dmKodUtilisationAttributeNames),
        "expiration_date_over_72_set",
    ]);
    const attributes: DmKodUtilisationAttributes = {};
    for (const [name, external] of Object.entries(
        dmKodUtilisationAttributeNames,
    ))
        if (Object.hasOwn(item, external))
            attributes[name as ScalarAttribute] = textValue(item[external]);
    if (Object.hasOwn(item, "expiration_date_over_72_set")) {
        const dates = object(item.expiration_date_over_72_set);
        knownKeys(dates, ["index", "expiration_date"]);
        attributes.expirationDateOver72Set = {
            ...(Object.hasOwn(dates, "index")
                ? { index: textValue(dates.index) }
                : {}),
            ...(Object.hasOwn(dates, "expiration_date")
                ? { expirationDate: textValue(dates.expiration_date) }
                : {}),
        };
    }
    return attributes;
}

/** Import a DMkod /psp/utilisation/push/ body without changing its codes. */
export function parseDmKodUtilisationJson(
    text: string,
): ImportedDmKodUtilisationJson {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text.replace(/^\uFEFF/, "")) as unknown;
    } catch {
        throw new Error("Invalid DMkod utilisation JSON.");
    }
    const request = object(parsed);
    knownKeys(request, ["include", "exclude", "attributes"]);
    if (
        !Object.hasOwn(request, "include") &&
        !Object.hasOwn(request, "exclude")
    )
        invalidStructure();
    const include = Object.hasOwn(request, "include")
        ? readCodes(request.include, true)
        : [];
    const exclude = Object.hasOwn(request, "exclude")
        ? readCodes(request.exclude, false)
        : [];
    return {
        includeText: formatDmKodUtilisationCodes(include),
        excludeText: exclude.map(({ code }) => code).join("\n"),
        attributes: Object.hasOwn(request, "attributes")
            ? readAttributes(request.attributes)
            : {},
    };
}

function writeCodes(codes: DmKodUtilisationCode[], include: boolean) {
    return codes.map((code) => {
        const item = object(code);
        knownKeys(
            item,
            include ? ["code", ...utilisationCodeFields] : ["code"],
        );
        const result: Record<string, string | number> = {
            code: codeValue(item.code),
        };
        if (!include) return result;
        for (const name of utilisationCodeFields) {
            if (item[name] === undefined) continue;
            const raw = textValue(item[name]);
            const value = name === "x97" ? raw : raw.replace(",", ".");
            if (!validUtilisationCodeAttribute(name, value)) invalidValue();
            result[name] =
                name === "x30" && value !== "--" ? Number(value) : value;
        }
        return result;
    });
}

function writeAttributes(attributes: DmKodUtilisationAttributes) {
    const item = object(attributes);
    knownKeys(item, [
        ...Object.keys(dmKodUtilisationAttributeNames),
        "expirationDateOver72Set",
    ]);
    const result: Record<string, string | Record<string, string>> = {};
    for (const [name, external] of Object.entries(
        dmKodUtilisationAttributeNames,
    )) {
        if (item[name] === undefined || item[name] === "") continue;
        result[external] = textValue(item[name]);
    }
    if (item.expirationDateOver72Set !== undefined) {
        const dates = object(item.expirationDateOver72Set);
        knownKeys(dates, ["index", "expirationDate"]);
        const set: Record<string, string> = {};
        if (dates.index !== undefined && dates.index !== "")
            set.index = textValue(dates.index);
        if (dates.expirationDate !== undefined && dates.expirationDate !== "")
            set.expiration_date = textValue(dates.expirationDate);
        if (Object.keys(set).length) result.expiration_date_over_72_set = set;
    }
    return result;
}

/** Export only the external request body; the application's request ID stays local. */
export function serializeDmKodUtilisationJson(
    request: PushDmKodUtilisation,
): string {
    const item = object(request);
    knownKeys(item, ["clientRequestId", "include", "exclude", "attributes"]);
    if (!Array.isArray(request.include) || !Array.isArray(request.exclude))
        invalidStructure();
    const attributes =
        request.attributes === undefined
            ? {}
            : writeAttributes(request.attributes);
    return `${JSON.stringify(
        {
            include: writeCodes(request.include, true),
            ...(request.exclude.length
                ? { exclude: writeCodes(request.exclude, false) }
                : {}),
            ...(Object.keys(attributes).length ? { attributes } : {}),
        },
        null,
        2,
    )}\n`;
}
