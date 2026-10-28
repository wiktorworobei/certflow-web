import axios from "axios";
import { apiClient } from "@marking/lib/api-client";

export { apiClient };

export type HttpError = Error & {
    status?: number;
    body?: string;
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
    return result;
}

export function getHttpErrorStatus(error: unknown): number | null {
    if (!error || typeof error !== "object") return null;
    const status = (error as HttpError).status;
    return typeof status === "number" ? status : null;
}
