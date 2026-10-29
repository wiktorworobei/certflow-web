import axios from "axios";
import { apiClient } from "@marking/lib/api-client";
import { parseHonestSignErrorDiagnostics } from "@marking/lib/honest-sign/errorDiagnostics";

import type { HonestSignErrorDiagnostics } from "@marking/lib/honest-sign/errorDiagnostics";

export { apiClient };
export { getHttpErrorDiagnostics } from "@marking/lib/honest-sign/errorDiagnostics";

export type HttpError = Error & {
    status?: number;
    body?: string;
    code?: string;
    correlationId?: string;
    diagnostics?: HonestSignErrorDiagnostics;
};

function stringifyErrorBody(data: unknown): string {
    if (typeof data === "string") return data;
    if (data === null || data === undefined) return "";

    try {
        return JSON.stringify(data);
    } catch {
        return String(data);
    }
}

export function toHttpError(prefix: string, error: unknown): HttpError {
    if (!axios.isAxiosError(error)) {
        const result = error instanceof Error ? error : new Error(prefix);
        return result as HttpError;
    }

    const status = error.response?.status;
    const body = stringifyErrorBody(error.response?.data);
    const responseMessage =
        error.response?.data && typeof error.response.data === "object"
            ? (error.response.data as { message?: unknown }).message
            : undefined;
    const message =
        typeof responseMessage === "string" && responseMessage.trim()
            ? responseMessage.trim()
            : prefix;
    const result = new Error(message) as HttpError;
    result.status = status;
    result.body = body;
    const responseCode =
        error.response?.data && typeof error.response.data === "object"
            ? (error.response.data as { code?: unknown }).code
            : undefined;
    if (typeof responseCode === "string") result.code = responseCode;
    result.diagnostics = parseHonestSignErrorDiagnostics(error.response?.data);
    result.correlationId = result.diagnostics.correlationId;
    return result;
}

export function getHttpErrorCode(error: unknown): string | null {
    if (!error || typeof error !== "object") return null;
    const candidate = error as HttpError;
    if (typeof candidate.code === "string") return candidate.code;
    if (typeof candidate.body !== "string") return null;
    try {
        const body: unknown = JSON.parse(candidate.body);
        if (body && typeof body === "object" && "code" in body)
            return typeof body.code === "string" ? body.code : null;
    } catch {
        // Non-JSON transport failures have no stable application error code.
    }
    return null;
}

export function getHttpErrorStatus(error: unknown): number | null {
    if (!error || typeof error !== "object") return null;
    const status = (error as HttpError).status;
    return typeof status === "number" ? status : null;
}
