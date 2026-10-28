import {
    normalizeDataMatrixCode,
    toTrueApiInformationCode,
} from "@marking/lib/honest-sign/codeNormalization";
import {
    apiClient,
    getHttpErrorStatus,
    toHttpError,
} from "@marking/lib/honest-sign/httpClient";
import {
    findDuplicateCodes,
    MAX_UTILISATION_REPORT_CODES,
    UTILISATION_CODE_CHECK_BATCH_SIZE,
} from "@marking/lib/honest-sign/utilisationReport";
import i18n from "@marking/src/i18n";

const CODES_CHECK_URL = "/api/honest-sign/codes/check";
const CODES_INFO_URL = "/api/honest-sign/codes/info";
const CODE_CHECK_BATCH_GAP_MS = 2_100;

type CodesCheckResponse = {
    result?: boolean;
    codes?: unknown;
    quantity?: unknown;
};

type CodeInfoResponse = {
    requestedCode: string;
    cis: string | null;
    gtin: string | null;
    productGroup: string | null;
    status: string | null;
    extendedStatus: string | null;
    productName: string | null;
    ownerInn: string | null;
    errorCode: string | null;
    errorMessage: string | null;
};

export type HonestSignCodeCheckItem = {
    code: string;
    isValid: boolean;
    reasons: string[];
    gtin: string | null;
    productGroup: string | null;
    status: string | null;
    extendedStatus: string | null;
    productName: string | null;
    raw: Record<string, unknown>;
};

export type HonestSignCodesCheckSummary = {
    items: HonestSignCodeCheckItem[];
    totalCount: number;
    validCount: number;
    invalidCount: number;
    rawResponse: unknown;
};

function toOptionalBoolean(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
}

function toCodesCheckError(error: unknown): Error {
    const httpError = toHttpError(
        i18n.t("honestSign.messages.codesCheckFailed"),
        error,
    );
    const status = getHttpErrorStatus(httpError);

    if (status === 401 || status === 403) {
        return new Error(i18n.t("honestSign.messages.codesCheckRejected"));
    }

    return httpError;
}

function delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) =>
        globalThis.setTimeout(resolve, milliseconds),
    );
}

export const honestSignCodesCheckService = {
    async checkCodes(
        codes: string[],
        productGroup?: string,
    ): Promise<HonestSignCodesCheckSummary> {
        const preparedCodes = codes
            .map((code) => ({
                original: code.trim(),
                normalized: normalizeDataMatrixCode(code),
                informationCode: toTrueApiInformationCode(code),
            }))
            .filter((item) => item.original.length > 0);

        if (preparedCodes.length === 0) {
            throw new Error(i18n.t("honestSign.messages.codesRequired"));
        }

        if (preparedCodes.length > MAX_UTILISATION_REPORT_CODES) {
            throw new Error(
                i18n.t("honestSign.documents.errors.tooManyReportCodes"),
            );
        }

        if (
            findDuplicateCodes(preparedCodes.map((item) => item.normalized))
                .length > 0
        ) {
            throw new Error(
                i18n.t("honestSign.documents.errors.duplicateCodes"),
            );
        }

        if (preparedCodes.length > UTILISATION_CODE_CHECK_BATCH_SIZE) {
            const summaries: HonestSignCodesCheckSummary[] = [];
            for (
                let offset = 0;
                offset < preparedCodes.length;
                offset += UTILISATION_CODE_CHECK_BATCH_SIZE
            ) {
                if (offset > 0) {
                    await delay(CODE_CHECK_BATCH_GAP_MS);
                }
                summaries.push(
                    await honestSignCodesCheckService.checkCodes(
                        preparedCodes
                            .slice(
                                offset,
                                offset + UTILISATION_CODE_CHECK_BATCH_SIZE,
                            )
                            .map((item) => item.original),
                        productGroup,
                    ),
                );
            }

            const items = summaries.flatMap((summary) => summary.items);
            const validCount = items.filter((item) => item.isValid).length;
            return {
                items,
                totalCount: items.length,
                validCount,
                invalidCount: items.length - validCount,
                rawResponse: summaries.map((summary) => summary.rawResponse),
            };
        }

        try {
            const response = await apiClient.post<CodesCheckResponse>(
                CODES_CHECK_URL,
                { codes: preparedCodes.map((item) => item.normalized) },
                {
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                },
            );

            const result = toOptionalBoolean(response.data.result);

            if (result === null) {
                throw new Error(
                    i18n.t("honestSign.messages.codesResponseInvalid"),
                );
            }

            const responseCodes = Array.isArray(response.data.codes)
                ? response.data.codes
                : [];
            const invalidCodes =
                result === false
                    ? responseCodes
                          .filter(
                              (code): code is string =>
                                  typeof code === "string" &&
                                  code.trim().length > 0,
                          )
                          .map((code) => normalizeDataMatrixCode(code))
                    : [];

            const invalidCodesSet = new Set(invalidCodes);
            const cryptoItems = preparedCodes.map((item) => {
                const cryptoValid =
                    result === true
                        ? true
                        : invalidCodesSet.size === 0
                          ? false
                          : !invalidCodesSet.has(item.normalized);

                return {
                    code: item.original,
                    normalizedCode: item.normalized,
                    informationCode: item.informationCode,
                    cryptoValid,
                    reasons: cryptoValid
                        ? []
                        : [i18n.t("honestSign.messages.codeInvalid")],
                };
            });

            const infoResponse = await apiClient.post<CodeInfoResponse[]>(
                CODES_INFO_URL,
                {
                    codes: preparedCodes.map((item) => item.informationCode),
                    productGroup: productGroup?.trim() || null,
                },
                {
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                },
            );
            const infoByCode = new Map(
                infoResponse.data
                    .map((info, index) => ({
                        info,
                        key: toTrueApiInformationCode(
                            info.requestedCode ||
                                info.cis ||
                                preparedCodes[index]?.informationCode ||
                                "",
                        ),
                    }))
                    .filter(({ key }) => key.length > 0)
                    .map(({ key, info }) => [key, info]),
            );
            const items = cryptoItems.map((item, index) => {
                const info =
                    infoByCode.get(item.informationCode) ??
                    infoResponse.data[index] ??
                    null;
                const infoError = info?.errorMessage || info?.errorCode || "";
                const reasons = infoError
                    ? [...item.reasons, infoError]
                    : item.reasons;
                return {
                    code: item.code,
                    isValid: item.cryptoValid && !infoError,
                    reasons,
                    gtin: info?.gtin ?? null,
                    productGroup: info?.productGroup ?? null,
                    status: info?.status ?? null,
                    extendedStatus: info?.extendedStatus ?? null,
                    productName: info?.productName ?? null,
                    raw: {
                        result: response.data.result ?? null,
                        quantity: response.data.quantity ?? null,
                        normalizedCode: item.normalizedCode,
                        informationCode: item.informationCode,
                        info,
                    },
                };
            });
            const validCount = items.filter((item) => item.isValid).length;

            return {
                items,
                totalCount: items.length,
                validCount,
                invalidCount: items.length - validCount,
                rawResponse: {
                    cryptographicCheck: response.data,
                    codeInformation: infoResponse.data,
                },
            };
        } catch (error) {
            throw toCodesCheckError(error);
        }
    },
};
