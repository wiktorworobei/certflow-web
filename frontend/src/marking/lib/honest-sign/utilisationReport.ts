import { buildUtilisationIndustryAttributes, formatUtilisationProductionTime, getUtilisationDateRules, type UtilisationIndustryValues } from './utilisationIndustry';

export const MAX_UTILISATION_REPORT_CODES = 30_000;
export const UTILISATION_CODE_CHECK_BATCH_SIZE = 1_000;

export type UtilisationExpirationMode =
    | "not-specified"
    | "specified"
    | "milk-over-72"
    | "milk-under-72"
    | "milk-storage-conditions";

export type UtilisationCisType = "UNIT" | "GROUP" | "SET";

export type UtilisationExpirationCondition = {
    storageConditionIndex: string;
    expirationDate: string;
};

export type UtilisationReportAttributes = {
    [field: string]: string | number | Record<string, string> | undefined;
    productionDate?: string;
    expDate?: string;
    expDate72?: string;
    expDateConditions?: Record<string, string>;
    expirationDate?: string;
    batchNumber?: string;
    usedInProduction?: number;
};

export type UtilisationReportPayload = {
    attributes: UtilisationReportAttributes;
    sntins: string[];
    productGroup: string;
};

export type SubmittedUtilisationReport = {
    reportId: string;
    productGroup: string;
    codesCount: number;
    status: string | null;
    message: string | null;
    submittedAtUtc: string;
};

export type BuildUtilisationReportPayloadInput = {
    productGroup: string;
    productionDate: string;
    expirationMode: UtilisationExpirationMode;
    expirationDate: string;
    expirationConditions?: UtilisationExpirationCondition[];
    partNumber: string;
    cisType?: UtilisationCisType;
    sntins: string[];
    industryValues?: UtilisationIndustryValues;
};

export function getDefaultUtilisationExpirationMode(
    productGroup: string,
    cisType: UtilisationCisType,
): UtilisationExpirationMode {
    const group = productGroup.trim();
    if (!getUtilisationDateRules(group, cisType).expirationRequired) return "not-specified";
    return group === "milk" ? "milk-over-72" : "specified";
}
export function requiresUtilisationDates(
    productGroup: string,
    cisType: UtilisationCisType,
): boolean {
    const rules = getUtilisationDateRules(productGroup, cisType);
    return rules.productionRequired && rules.expirationRequired;
}

export function buildUtilisationReportPayload({
    productGroup,
    productionDate,
    expirationMode,
    expirationDate,
    expirationConditions = [],
    partNumber,
    cisType = "UNIT",
    sntins,
    industryValues = {},
}: BuildUtilisationReportPayloadInput): UtilisationReportPayload {
    const normalizedProductGroup = productGroup.trim();
    const attributes: UtilisationReportAttributes = buildUtilisationIndustryAttributes(normalizedProductGroup, cisType, industryValues);
    const rules = getUtilisationDateRules(normalizedProductGroup, cisType);
    if (productionDate && !rules.noDates) {
        attributes.productionDate = rules.productionTimestamp ? formatUtilisationProductionTime(productionDate) : productionDate;
    }

    if (normalizedProductGroup === "milk" && !rules.noDates) {
        if (
            (expirationMode === "specified" ||
                expirationMode === "milk-over-72") &&
            expirationDate
        ) {
            attributes.expDate = expirationDate;
        } else if (expirationMode === "milk-under-72" && expirationDate) {
            attributes.expDate72 = expirationDate;
        } else if (expirationMode === "milk-storage-conditions") {
            attributes.expDateConditions = Object.fromEntries(
                expirationConditions.map((condition) => [
                    condition.storageConditionIndex.trim(),
                    condition.expirationDate,
                ]),
            );
        }
    } else if (
        normalizedProductGroup !== "milk" && rules.expirationAllowed
    ) {
        if (expirationMode === "specified" && expirationDate) attributes.expirationDate = expirationDate;
        if (expirationMode === "milk-under-72" && rules.expiryTimestamp && expirationDate) attributes.expDate72 = expirationDate;
        if (expirationMode === "milk-storage-conditions" && rules.expiryConditions) {
            attributes.expDateConditions = Object.fromEntries(expirationConditions.map((condition) => [condition.storageConditionIndex.trim(), condition.expirationDate]));
        }
    }

    if (normalizedProductGroup === "milk") {
        if (cisType === "UNIT" && partNumber.trim()) {
            attributes.batchNumber = partNumber.trim();
        }
        attributes.usedInProduction ??= 0;
    }

    return {
        productGroup: normalizedProductGroup,
        attributes,
        sntins,
    };
}

export function isProductionDateValid(value: string, today: string, timestamp = false): boolean {
    if (!value) return true;
    if (!timestamp) return isIsoDate(value) && value <= today;
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:[+-]\d{4})?)?$/.test(value) &&
        isIsoDate(value.slice(0, 10)) && new Date(value).getTime() <= Date.now();
}

export function isExpirationDateValid(
    value: string,
    productionDate: string,
    today: string,
    strictlyFuture = false,
    allowPast = false,
): boolean {
    return (
        isIsoDate(value) &&
        (allowPast || (strictlyFuture ? value > today : value >= today)) &&
        (productionDate === "" || value >= productionDate.slice(0, 10))
    );
}

export function isExpirationDateTimeValid(
    value: string,
    productionDate: string,
    now: string,
): boolean {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return false;
    const date = value.slice(0, 10);
    const parsed = new Date(`${value}:00`);
    return (
        isIsoDate(date) &&
        !Number.isNaN(parsed.getTime()) &&
        value >= now &&
        (productionDate === "" || date >= productionDate)
    );
}

export function areExpirationConditionsValid(
    conditions: UtilisationExpirationCondition[],
    productionDate: string,
    today: string,
): boolean {
    if (conditions.length === 0) return false;
    const indexes = new Set<string>();
    return conditions.every((condition) => {
        const index = condition.storageConditionIndex.trim();
        return (
            /^[1-9]\d*$/.test(index) &&
            !indexes.has(index) &&
            indexes.add(index) &&
            isExpirationDateValid(
                condition.expirationDate,
                productionDate,
                today,
            )
        );
    });
}

function isIsoDate(value: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00Z`);
    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

export function isMilkPartNumberValid(
    value: string,
    productionDate = "",
): boolean {
    if (value === "") return true;
    if (!/^\d{20}[0-9A-Za-z/.,-]{1,12}$/.test(value)) return false;
    return (
        productionDate === "" ||
        value.slice(14, 20) === productionDate.replaceAll("-", "").slice(2)
    );
}

export function findDuplicateCodes(codes: string[]): string[] {
    const seen = new Set<string>();
    const duplicates = new Set<string>();

    for (const code of codes) {
        if (seen.has(code)) {
            duplicates.add(code);
        } else {
            seen.add(code);
        }
    }

    return [...duplicates];
}
