import axios from "axios";
import {
    apiClient,
    type HttpError,
    toHttpError,
} from "@marking/lib/honest-sign/httpClient";
import i18n from "@marking/src/i18n";

type OrderSearchFilter = {
    startCreatedTimestamp: number | null;
    endCreatedTimestamp: number | null;
    productGroups?: string[];
    orderStatuses?: string[];
};

export type SearchOrdersPayload = {
    filter: OrderSearchFilter;
    limit: number;
    page: number;
};

export type OrderSearchItem = {
    orderId: string;
    status: string;
    productionOrderId: string | null;
    createdAtUtc: string | null;
    receivedAtUtc: string | null;
    closedAtUtc: string | null;
    productsCount: number;
    provider: string;
    totalCodes: number | null;
    usedCodes: number | null;
    remainingCodes: number | null;
    firstGtin: string | null;
    declineReason: string | null;
    products: Array<{
        gtin: string | null;
        totalCodes: number | null;
        status: string | null;
    }>;
};

type SearchOrdersResponse = {
    totalItems: number;
    items: OrderSearchItem[];
};

export type CreateOrderResponse = {
    orderId: string | null;
    rawResponse: Record<string, unknown>;
};

export type GetCodesResponse = {
    file: Blob;
    fileName: string;
    codes: string[];
};

export type UploadOrderCodesToConverterResponse = {
    orderId: string;
    codesCount: number;
    rawResponse: Record<string, unknown>;
};

const SEARCH_ORDERS_URL = "/api/honest-sign/orders/search";
const ORDER_STATUS_URL = "/api/honest-sign/orders/status";
const CREATE_ORDER_URL = "/api/honest-sign/orders";
const CODES_URL = "/api/honest-sign/orders/codes";

function stripUtf8Bom(value: string): string {
    return value.replace(/^\uFEFF/, "");
}

function parseCodesCsv(content: string): string[] {
    return stripUtf8Bom(content)
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter((row) => row.length > 0);
}

function extractFileName(
    contentDisposition: string | undefined,
    fallback: string,
): string {
    if (!contentDisposition) {
        return fallback;
    }

    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1]);
    }

    const fileNameMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
    return fileNameMatch?.[1] ?? fallback;
}

async function toBlobHttpError(prefix: string, error: unknown): Promise<Error> {
    if (!axios.isAxiosError(error) || !(error.response?.data instanceof Blob)) {
        return toHttpError(prefix, error);
    }

    const status = error.response.status;
    const responseText = stripUtf8Bom(await error.response.data.text()).trim();
    let resolvedBody = responseText;

    if (responseText.startsWith("{")) {
        try {
            const parsed = JSON.parse(responseText) as { message?: unknown };
            if (
                typeof parsed.message === "string" &&
                parsed.message.trim().length > 0
            ) {
                resolvedBody = parsed.message.trim();
            }
        } catch {
            // Keep the original body if the blob is not JSON.
        }
    }

    const httpError = new Error(prefix) as HttpError;
    httpError.status = status;
    httpError.body = responseText;
    httpError.message =
        resolvedBody.length > 0
            ? `${prefix}: ${status}. ${resolvedBody}`
            : `${prefix}: ${status}.`;
    return httpError;
}

export const ordersApiService = {
    async searchOrders(
        payload: SearchOrdersPayload,
    ): Promise<SearchOrdersResponse> {
        try {
            const response = await apiClient.post<SearchOrdersResponse>(
                SEARCH_ORDERS_URL,
                payload,
                {
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                    },
                },
            );

            return {
                items: Array.isArray(response.data.items)
                    ? response.data.items
                    : [],
                totalItems:
                    typeof response.data.totalItems === "number"
                        ? response.data.totalItems
                        : 0,
            };
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.ordersRequestFailed"),
                error,
            );
        }
    },

    async getOrderStatus(orderId: string, gtin: string): Promise<unknown> {
        try {
            const response = await apiClient.get<unknown>(ORDER_STATUS_URL, {
                params: { orderId, gtin },
                headers: {
                    Accept: "application/json",
                },
            });

            return response.data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.orderStatusRequestFailed"),
                error,
            );
        }
    },

    async createOrder(
        detachedSignature: string,
        payload: unknown,
    ): Promise<CreateOrderResponse> {
        try {
            const response = await apiClient.post<CreateOrderResponse>(
                CREATE_ORDER_URL,
                payload,
                {
                    headers: {
                        Accept: "application/json",
                        "Content-Type": "application/json",
                        "x-signature": detachedSignature,
                    },
                },
            );

            return response.data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.orderCreateRequestFailed"),
                error,
            );
        }
    },

    async getCodes(
        orderId: string,
        gtin: string,
        quantity: number,
    ): Promise<GetCodesResponse> {
        try {
            const response = await apiClient.get<Blob>(CODES_URL, {
                params: { orderId, gtin, quantity },
                responseType: "blob",
                headers: {
                    Accept: "text/csv, application/json",
                },
            });

            const file =
                response.data instanceof Blob
                    ? response.data
                    : new Blob([response.data], {
                          type: "text/csv;charset=utf-8",
                      });
            const content = await file.text();
            const fileName = extractFileName(
                response.headers["content-disposition"],
                `${orderId}_${gtin}.csv`,
            );

            return {
                file,
                fileName,
                codes: parseCodesCsv(content),
            };
        } catch (error) {
            throw await toBlobHttpError(
                i18n.t("honestSign.messages.codesRequestFailed"),
                error,
            );
        }
    },

    async uploadOrderCodesToConverter(
        orderId: string,
    ): Promise<UploadOrderCodesToConverterResponse> {
        try {
            const response =
                await apiClient.post<UploadOrderCodesToConverterResponse>(
                    `/api/honest-sign/orders/${encodeURIComponent(orderId)}/converter`,
                    undefined,
                    {
                        headers: {
                            Accept: "application/json",
                        },
                    },
                );

            return {
                orderId:
                    typeof response.data.orderId === "string"
                        ? response.data.orderId
                        : orderId,
                codesCount:
                    typeof response.data.codesCount === "number"
                        ? response.data.codesCount
                        : 0,
                rawResponse: response.data.rawResponse ?? {},
            };
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.converterRequestFailed"),
                error,
            );
        }
    },
};
