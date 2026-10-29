import {
    normalizeDataMatrixCode,
    toTrueApiInformationCode,
} from "./codeNormalization";
import {
    areExpirationConditionsValid,
    buildUtilisationReportPayload,
    getDefaultUtilisationExpirationMode,
    isExpirationDateTimeValid,
    isExpirationDateValid,
    isMilkPartNumberValid,
    isProductionDateValid,
    MAX_UTILISATION_REPORT_CODES,
    requiresUtilisationDates,
} from "./utilisationReport";

import type {
    UtilisationCisType,
    UtilisationExpirationCondition,
    UtilisationExpirationMode,
} from "./utilisationReport";

export const MAX_UTILISATION_BATCH_FILES = 20;
export const MAX_UTILISATION_BATCH_CODES = 100_000;
export const MAX_UTILISATION_BATCH_FILE_BYTES = 12 * 1024 * 1024;

export type UtilisationBatchItemState =
    | "Queued"
    | "Sending"
    | "Accepted"
    | "Rejected"
    | "Unknown"
    | "SkippedRejected"
    | "SkippedUnknown";
export type UtilisationBatchItem = {
    id: string;
    sequence: number;
    fileName: string;
    productGroup: string;
    cisType: UtilisationCisType;
    codesCount: number;
    productionDate: string | null;
    expirationDate: string | null;
    state: UtilisationBatchItemState;
    reportId: string | null;
    status: string | null;
    error: string | null;
    upstreamErrorCode: string | null;
    correlationId: string | null;
    startedAtUtc: string | null;
    completedAtUtc: string | null;
};
export type UtilisationBatch = {
    id: string;
    requestId: string;
    state:
        | "Queued"
        | "Sending"
        | "Completed"
        | "CompletedWithIssues"
        | "Blocked";
    createdAtUtc: string;
    updatedAtUtc: string;
    items: UtilisationBatchItem[];
};
export type UtilisationBatchesPage = {
    items: UtilisationBatch[];
    hasNextPage: boolean;
};
export type CreateUtilisationBatchRequest = {
    requestId: string;
    items: {
        fileName: string;
        cisType: UtilisationCisType;
        payloadJson: string;
        signature: string;
    }[];
};

export type UtilisationBatchDraftFile = {
    id: string;
    name: string;
    size: number;
    codes: string[];
    productionDate: string;
    cisType: UtilisationCisType;
    expirationMode: UtilisationExpirationMode;
    expirationDate: string;
    expirationConditions: UtilisationExpirationCondition[];
    partNumber: string;
};

export function parseUtilisationBatchFile(text: string): string[] {
    return text
        .replace(/^\uFEFF/, "")
        .split(/\r\n|\n|\r/)
        .map((row) => {
            const trimmed = row.trim();
            const value =
                trimmed.startsWith('"') && trimmed.endsWith('"')
                    ? trimmed.slice(1, -1).replaceAll('""', '"')
                    : trimmed;
            return normalizeDataMatrixCode(value);
        })
        .filter(Boolean);
}

export function createUtilisationBatchFile(
    id: string,
    file: Pick<File, "name" | "size">,
    codes: string[],
    productGroup: string,
): UtilisationBatchDraftFile {
    return {
        id,
        name: file.name,
        size: file.size,
        codes,
        productionDate: "",
        cisType: "UNIT",
        expirationMode: getDefaultUtilisationExpirationMode(
            productGroup,
            "UNIT",
        ),
        expirationDate: "",
        expirationConditions: [
            { storageConditionIndex: "", expirationDate: "" },
        ],
        partNumber: "",
    };
}

export function validateUtilisationBatchFile(
    file: UtilisationBatchDraftFile,
    productGroup: string,
    today: string,
    nowMinute: string,
) {
    const omitDairyDates = productGroup === "milk" && file.cisType !== "UNIT";
    const requiredDates = requiresUtilisationDates(productGroup, file.cisType);
    const productionDate =
        omitDairyDates ||
        (isProductionDateValid(file.productionDate, today) &&
            (!requiredDates || file.productionDate !== ""));
    const expirationDate =
        omitDairyDates ||
        (file.expirationMode === "not-specified"
            ? !requiredDates
            : file.expirationMode === "milk-storage-conditions"
              ? areExpirationConditionsValid(
                    file.expirationConditions,
                    file.productionDate,
                    today,
                )
              : file.expirationMode === "milk-under-72"
                ? isExpirationDateTimeValid(
                      file.expirationDate,
                      file.productionDate,
                      nowMinute,
                  )
                : isExpirationDateValid(
                      file.expirationDate,
                      file.productionDate,
                      today,
                      productGroup === "autofluids",
                  ));
    const partNumber =
        productGroup !== "milk" ||
        file.cisType !== "UNIT" ||
        isMilkPartNumberValid(file.partNumber, file.productionDate);
    const codes =
        file.codes.length > 0 &&
        file.codes.length <= MAX_UTILISATION_REPORT_CODES;
    return {
        productionDate,
        expirationDate,
        partNumber,
        codes,
        valid: Boolean(
            productGroup &&
            productionDate &&
            expirationDate &&
            partNumber &&
            codes,
        ),
    };
}

/** Count duplicate codes across the entire batch without exposing full codes in diagnostics. */
export function countUtilisationBatchDuplicates(
    files: Pick<UtilisationBatchDraftFile, "codes">[],
): number {
    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const file of files) {
        for (const code of file.codes) {
            const normalized = toTrueApiInformationCode(code);
            if (seen.has(normalized)) duplicates.add(normalized);
            seen.add(normalized);
        }
    }
    return duplicates.size;
}

export function buildUtilisationBatchFilePayload(
    file: UtilisationBatchDraftFile,
    productGroup: string,
) {
    return buildUtilisationReportPayload({
        productGroup,
        productionDate: file.productionDate,
        partNumber: file.partNumber,
        cisType: file.cisType,
        expirationMode: file.expirationMode,
        expirationDate: file.expirationDate,
        expirationConditions: file.expirationConditions,
        sntins: file.codes.map(normalizeDataMatrixCode),
    });
}
