import { dmKodScopeQueryKey, type DmKodScope } from "@marking/lib/dmkod-scope";
import { validCalendarDate } from "@marking/lib/dmkod-utilisation-policy";

import type {
    DmKodManufacture,
    DmKodUtilisationAttributes,
} from "@marking/lib/dmkod-types";

export const dmKodEditableAttributeFields = [
    "productionDate",
    "expirationDate",
    "kpp",
    "fiasUuid",
    "seriesNumber",
    "batchNumber",
] as const;
export type DmKodAttributeValues = Record<
    (typeof dmKodEditableAttributeFields)[number],
    string
>;
export const dmKodEmptyAttributes: DmKodAttributeValues = {
    productionDate: "",
    expirationDate: "",
    kpp: "",
    fiasUuid: "",
    seriesNumber: "",
    batchNumber: "",
};

/** A calendar date, without local-time conversion or Date's rollover of invalid days. */
export function parseDmKodAttributeDate(value: string): string | null {
    const text = value.trim();
    if (!text) return "";
    const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(text);
    const iso = match ? `${match[3]}-${match[2]}-${match[1]}` : text;
    return !iso.startsWith("0000-") && validCalendarDate(iso) ? iso : null;
}

export function formatDmKodAttributeDate(value: string): string {
    if (!validCalendarDate(value)) return value;
    return `${value.slice(8, 10)}.${value.slice(5, 7)}.${value.slice(0, 4)}`;
}

/** Calendar widgets use local dates; never convert a date-only value through UTC. */
export function dmKodAttributeCalendarDate(value: string): Date | undefined {
    const iso = parseDmKodAttributeDate(value);
    if (!iso) return undefined;
    const date = new Date(0);
    date.setHours(12, 0, 0, 0);
    date.setFullYear(
        Number(iso.slice(0, 4)),
        Number(iso.slice(5, 7)) - 1,
        Number(iso.slice(8, 10)),
    );
    return date;
}

export function dmKodAttributeCalendarValue(value: Date): string {
    return `${String(value.getDate()).padStart(2, "0")}.${String(value.getMonth() + 1).padStart(2, "0")}.${String(value.getFullYear()).padStart(4, "0")}`;
}

export function dmKodRangeAttributes(
    values: DmKodAttributeValues,
): DmKodUtilisationAttributes {
    const result: DmKodUtilisationAttributes = {};
    for (const name of dmKodEditableAttributeFields) {
        const value = values[name].trim();
        if (value) result[name] = value;
    }
    return result;
}

export function dmKodManufacturesQueryKey(
    scope: DmKodScope,
    orderId: number,
    itemId: number,
) {
    return [
        ...dmKodScopeQueryKey(scope),
        "manufactures",
        orderId,
        itemId,
    ] as const;
}

export function dmKodManufactureSuggestions(
    manufactures: readonly DmKodManufacture[],
) {
    const choices = (field: "kpp" | "fiasUuid") => {
        const seen = new Set<string>();
        return manufactures.flatMap((row) => {
            const value = row[field];
            if (!value || seen.has(value)) return [];
            seen.add(value);
            return [{ value, address: row.address }];
        });
    };
    return { kpps: choices("kpp"), fiasUuids: choices("fiasUuid") };
}

export function validDmKodRequisite(kind: "kpps" | "fiasUuids", value: string) {
    return kind === "kpps"
        ? /^\d{9}$/.test(value)
        : /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(
              value,
          ) && value !== "00000000-0000-0000-0000-000000000000";
}
