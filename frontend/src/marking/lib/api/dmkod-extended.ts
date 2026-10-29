import { apiClient } from "@marking/lib/api-client";
import { dmKodRequestConfig } from "@marking/lib/dmkod-request-scope";

import type {
    DmKodActionRequest,
    DmKodReadRequest,
    DmKodExtendedResult,
    DmKodExtendedReceipt,
    DmKodExtendedTask,
    DmKodExtendedSigningData,
} from "@marking/lib/dmkod-extended-types";
import type { DmKodScope } from "@marking/lib/dmkod-scope";

const base = "/api/dmkod/methods";
const extendedConfig = (scope: DmKodScope) => ({
    ...dmKodRequestConfig(scope),
    timeout: 120_000,
});
const aggregationActions = [
    "PushAggregationRanges",
    "PushAggregation",
    "InspectContainers",
    "GenerateAggregation",
    "GenerateOrderAggregation",
    "SignAggregation",
    "PullAggregation",
    "DeleteAggregation",
];
export const dmKodExtendedApi = {
    read: (
        scope: DmKodScope,
        request: DmKodReadRequest,
    ): Promise<DmKodExtendedResult> =>
        apiClient
            .post(
                `${base}/read`,
                request,
                ["OrderAggregations", "OrderReports"].includes(request.method)
                    ? extendedConfig(scope)
                    : dmKodRequestConfig(scope),
            )
            .then((r) => r.data),
    run: (
        scope: DmKodScope,
        request: DmKodActionRequest,
    ): Promise<DmKodExtendedReceipt> =>
        apiClient
            .post(
                `${base}/actions`,
                request,
                aggregationActions.includes(request.action)
                    ? extendedConfig(scope)
                    : dmKodRequestConfig(scope),
            )
            .then((r) => r.data),
    receipt: (scope: DmKodScope, id: string): Promise<DmKodExtendedReceipt> =>
        apiClient
            .get(`${base}/receipts/${id}`, extendedConfig(scope))
            .then((r) => r.data),
    task: (scope: DmKodScope, id: string): Promise<DmKodExtendedTask> =>
        apiClient
            .get(`${base}/tasks/${id}`, extendedConfig(scope))
            .then((r) => r.data),
    signingData: (
        scope: DmKodScope,
        kind: "validation" | "aggregation",
        id: number,
        serviceProviderId?: number,
        orderId?: number,
    ): Promise<DmKodExtendedSigningData> =>
        apiClient
            .get(`${base}/reports/${kind}/${id}/signing-data`, {
                ...(kind === "aggregation"
                    ? extendedConfig(scope)
                    : dmKodRequestConfig(scope)),
                params: { serviceProviderId, orderId },
            })
            .then((r) => r.data),
    companySigningData: (
        scope: DmKodScope,
        inn: string,
    ): Promise<DmKodExtendedSigningData> =>
        apiClient
            .get(`${base}/company/signing-data`, {
                ...dmKodRequestConfig(scope),
                params: { inn },
            })
            .then((r) => r.data),
    downloadLegal: (
        scope: DmKodScope,
        document: "nda" | "contract",
        clientRequestId: string,
    ): Promise<Blob> =>
        apiClient
            .post(
                `${base}/documents/download`,
                { document, clientRequestId },
                { ...dmKodRequestConfig(scope), responseType: "blob" },
            )
            .then((r) => r.data),
};
