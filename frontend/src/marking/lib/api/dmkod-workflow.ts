import { apiClient } from "@marking/lib/api-client";
import { dmKodRequestConfig } from "@marking/lib/dmkod-request-scope";

import type { DmKodSignReport } from "@marking/lib/dmkod-report-types";
import type { DmKodScope } from "@marking/lib/dmkod-scope";
import type { DmKodOrdersSearch } from "@marking/lib/dmkod-types";
import type {
    DmKodCodeRequest,
    DmKodOrderOperationRequest,
    DmKodWorkflowReceipt,
    DmKodWorkflowTask,
    DmKodWorkflowOptions,
    DmKodRequestSigned,
    DmKodRequestSigningData,
    DmKodUtilisationPage,
    DmKodUtilisationDetails,
} from "@marking/lib/dmkod-workflow-types";
const base = "/api/dmkod";
export const dmKodWorkflowApi = {
    synchronizePoas: (
        scope: DmKodScope,
        clientRequestId: string,
    ): Promise<DmKodWorkflowReceipt> =>
        apiClient
            .post(
                `${base}/poas/sync`,
                { clientRequestId },
                dmKodRequestConfig(scope),
            )
            .then((r) => r.data),
    options: (scope: DmKodScope): Promise<DmKodWorkflowOptions> =>
        apiClient
            .get(`${base}/orders/workflow/options`, dmKodRequestConfig(scope))
            .then((r) => r.data),
    run: (
        scope: DmKodScope,
        orderId: number,
        request: DmKodOrderOperationRequest,
    ): Promise<DmKodWorkflowReceipt> =>
        apiClient
            .post(
                `${base}/orders/${orderId}/operations`,
                request,
                dmKodRequestConfig(scope),
            )
            .then((r) => r.data),
    receipt: (scope: DmKodScope, id: string): Promise<DmKodWorkflowReceipt> =>
        apiClient
            .get(
                `${base}/orders/workflow/receipts/${id}`,
                dmKodRequestConfig(scope),
            )
            .then((r) => r.data),
    task: (scope: DmKodScope, id: string): Promise<DmKodWorkflowTask> =>
        apiClient
            .get(
                `${base}/orders/workflow/tasks/${id}`,
                dmKodRequestConfig(scope),
            )
            .then((r) => r.data),
    file: (scope: DmKodScope, id: string): Promise<Blob> =>
        apiClient
            .post(`${base}/orders/workflow/tasks/${id}/file`, undefined, {
                ...dmKodRequestConfig(scope),
                responseType: "blob",
            })
            .then((r) => r.data),
    requests: (
        scope: DmKodScope,
        orderId: number,
    ): Promise<{ requests: DmKodCodeRequest[] }> =>
        apiClient
            .get(
                `${base}/orders/${orderId}/code-requests`,
                dmKodRequestConfig(scope),
            )
            .then((r) => r.data),
    signingData: (
        scope: DmKodScope,
        orderId: number,
        id: number,
    ): Promise<DmKodRequestSigningData> =>
        apiClient
            .get(
                `${base}/orders/${orderId}/code-requests/${id}/signing-data`,
                dmKodRequestConfig(scope),
            )
            .then((r) => r.data),
    sign: (
        scope: DmKodScope,
        orderId: number,
        id: number,
        request: DmKodSignReport,
    ): Promise<DmKodRequestSigned> =>
        apiClient
            .post(
                `${base}/orders/${orderId}/code-requests/${id}/sign`,
                request,
                dmKodRequestConfig(scope),
            )
            .then((r) => r.data),
    signedReceipt: (
        scope: DmKodScope,
        id: string,
    ): Promise<DmKodRequestSigned> =>
        apiClient
            .get(
                `${base}/orders/workflow/signatures/${id}`,
                dmKodRequestConfig(scope),
            )
            .then((r) => r.data),
    sessions: (
        scope: DmKodScope,
        search: DmKodOrdersSearch,
    ): Promise<DmKodUtilisationPage> =>
        apiClient
            .post(
                `${base}/utilisation/sessions/search`,
                search,
                dmKodRequestConfig(scope),
            )
            .then((r) => r.data),
    details: (
        scope: DmKodScope,
        kind: "session" | "order" | "order-sessions",
        id: number,
    ): Promise<DmKodUtilisationDetails> =>
        apiClient
            .get(
                `${base}/utilisation/details/${kind}/${id}`,
                dmKodRequestConfig(scope),
            )
            .then((r) => r.data),
    productionCode: (
        scope: DmKodScope,
        tag: string,
    ): Promise<
        { id: number; quantityRequested: number; createdAtUtc: string | null }[]
    > =>
        apiClient
            .get(`${base}/orders/production-code`, {
                ...dmKodRequestConfig(scope),
                params: { tag },
            })
            .then((r) => r.data),
    register: (
        scope: DmKodScope,
        request: { username: string; email: string; nickname?: string },
    ): Promise<void> =>
        apiClient
            .post(`${base}/auth/register`, request, dmKodRequestConfig(scope))
            .then(() => undefined),
    resetPassword: (scope: DmKodScope, email: string): Promise<void> =>
        apiClient
            .post(
                `${base}/auth/password/reset`,
                { email },
                dmKodRequestConfig(scope),
            )
            .then(() => undefined),
};
