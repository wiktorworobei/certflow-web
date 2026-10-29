import axios from "axios";
import {
    normalizeDataMatrixCode,
    toTrueApiInformationCode,
} from "@marking/lib/honest-sign/codeNormalization";
import {
    createCodesCheckQueue,
    waitForCodesCheck,
} from "@marking/lib/honest-sign/codesCheckQueue";
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
import { useAuthStore } from "@marking/src/store/auth";
import { useCompanyContextStore } from "@marking/src/store/company-context";

const CODES_CHECK_URL = "/api/honest-sign/codes/check";
const CODES_INFO_URL = "/api/honest-sign/codes/info";
const CODE_CHECK_TIMEOUT_MS = 120_000;
const requestQueue = createCodesCheckQueue();
type CheckStage = "cryptography" | "information";

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

export type HonestSignCodesCheckOptions = {
    signal?: AbortSignal;
    onProgress?: (completed: number, total: number) => void;
};

function toOptionalBoolean(value: unknown): boolean | null {
    return typeof value === "boolean" ? value : null;
}

function toCodesCheckError(error: unknown, stage: CheckStage): Error {
    const httpError = toHttpError(
        i18n.t("honestSign.messages.codesCheckFailed"),
        error,
    );
    const status = getHttpErrorStatus(httpError);

    const stageLabel = i18n.t(`honestSign.messages.codesCheckStages.${stage}`);
    const detail =
        status === 401 || status === 403
            ? i18n.t("honestSign.messages.codesCheckRejected")
            : axios.isAxiosError(error) &&
                ["ECONNABORTED", "ETIMEDOUT"].includes(error.code || "")
              ? i18n.t("honestSign.messages.codesCheckTimeout")
              : axios.isAxiosError(error) && !error.response
                ? i18n.t("honestSign.messages.codesCheckNetwork")
                : status === 429
                  ? i18n.t("honestSign.messages.codesCheckRateLimited")
                  : httpError.message;
    httpError.message =
        i18n.t("honestSign.messages.codesCheckStageError", {
            stage: stageLabel,
            message: detail,
        }) +
        (status ? ` (HTTP ${status})` : "") +
        (httpError.correlationId
            ? ` · ${i18n.t("honestSign.messages.codesCheckReference", { id: httpError.correlationId })}`
            : "");
    return httpError;
}

function throwIfAborted(signal?: AbortSignal): void {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

export const honestSignCodesCheckService = {
    async checkCodes(
        codes: string[],
        productGroup?: string,
        options: HonestSignCodesCheckOptions = {},
    ): Promise<HonestSignCodesCheckSummary> {
        throwIfAborted(options.signal);
        const authVersion = useAuthStore.getState().version;
        const companyId = useCompanyContextStore.getState().selectedCompany?.id;
        const assertScope = () => {
            if (
                authVersion !== useAuthStore.getState().version ||
                companyId !==
                    useCompanyContextStore.getState().selectedCompany?.id
            )
                throw new Error(i18n.t("auth.authError"));
        };
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

        options.onProgress?.(0, preparedCodes.length);

        if (preparedCodes.length > UTILISATION_CODE_CHECK_BATCH_SIZE) {
            const summaries: HonestSignCodesCheckSummary[] = [];
            for (
                let offset = 0;
                offset < preparedCodes.length;
                offset += UTILISATION_CODE_CHECK_BATCH_SIZE
            ) {
                throwIfAborted(options.signal);
                assertScope();
                summaries.push(
                    await honestSignCodesCheckService.checkCodes(
                        preparedCodes
                            .slice(
                                offset,
                                offset + UTILISATION_CODE_CHECK_BATCH_SIZE,
                            )
                            .map((item) => item.original),
                        productGroup,
                        {
                            signal: options.signal,
                            onProgress: (completed) =>
                                options.onProgress?.(
                                    offset + completed,
                                    preparedCodes.length,
                                ),
                        },
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

        return requestQueue.run(async () => {
            let stage: CheckStage = "cryptography";
            try {
                assertScope();
                const postCheck = () =>
                    apiClient.post<CodesCheckResponse>(
                        CODES_CHECK_URL,
                        { codes: preparedCodes.map((item) => item.normalized) },
                        {
                            signal: options.signal,
                            authVersion,
                            timeout: CODE_CHECK_TIMEOUT_MS,
                            headers: {
                                Accept: "application/json",
                                "Content-Type": "application/json",
                                ...(companyId
                                    ? { "X-Company-Id": companyId }
                                    : {}),
                            },
                        },
                    );
                // These POST methods only read code information. A bounded retry on an explicit
                // 429 is safe; report submission and signing never pass through this path.
                let response: Awaited<ReturnType<typeof postCheck>>;
                for (let attempt = 0; ; attempt++) {
                    try {
                        assertScope();
                        response = await postCheck();
                        break;
                    } catch (error) {
                        if (
                            !axios.isAxiosError(error) ||
                            error.response?.status !== 429 ||
                            attempt >= 2
                        )
                            throw error;
                        const raw = Number(
                            error.response.headers?.["retry-after"],
                        );
                        const gap =
                            Number.isFinite(raw) && raw > 0
                                ? Math.min(30_000, Math.max(2_100, raw * 1000))
                                : 2_100;
                        await waitForCodesCheck(gap, options.signal);
                    }
                }

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

                throwIfAborted(options.signal);
                assertScope();
                stage = "information";
                const infoResponse = await apiClient.post<CodeInfoResponse[]>(
                    CODES_INFO_URL,
                    {
                        codes: preparedCodes.map(
                            (item) => item.informationCode,
                        ),
                        productGroup: productGroup?.trim() || null,
                    },
                    {
                        signal: options.signal,
                        authVersion,
                        timeout: CODE_CHECK_TIMEOUT_MS,
                        headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json",
                            ...(companyId ? { "X-Company-Id": companyId } : {}),
                        },
                    },
                );
                throwIfAborted(options.signal);
                assertScope();
                if (!Array.isArray(infoResponse.data)) {
                    throw new Error(
                        i18n.t("honestSign.messages.codesResponseInvalid"),
                    );
                }
                const infoByCode = new Map<string, CodeInfoResponse>();
                const ambiguous = new Set<string>();
                for (const info of infoResponse.data) {
                    const requested = toTrueApiInformationCode(
                        info.requestedCode || "",
                    );
                    const cis = toTrueApiInformationCode(info.cis || "");
                    const key = requested || cis;
                    if (!key || (requested && cis && requested !== cis))
                        continue;
                    if (infoByCode.has(key)) {
                        infoByCode.delete(key);
                        ambiguous.add(key);
                    }
                    if (!ambiguous.has(key)) infoByCode.set(key, info);
                }
                const items = cryptoItems.map((item) => {
                    const info = infoByCode.get(item.informationCode) ?? null;
                    const infoError = info
                        ? info.errorMessage || info.errorCode || ""
                        : i18n.t("honestSign.dmCheck.noInformation");
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

                throwIfAborted(options.signal);
                options.onProgress?.(items.length, preparedCodes.length);

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
                throwIfAborted(options.signal);
                throw toCodesCheckError(error, stage);
            }
        }, options.signal);
    },
};
