import { apiClient } from "../api-client";
import { dmKodRequestConfig } from "@marking/lib/dmkod-request-scope";
import { cryptoProSignatureService } from "@marking/lib/honest-sign/cryptoProSignatureService";

import type {
    DmKodChangePassword,
    CreateDmKodOrder,
    DmKodBackgroundTask,
    DmKodBackgroundTaskAccepted,
    DmKodConnectionStatus,
    DmKodCreateOrderOptions,
    DmKodOrderDetails,
    DmKodOrderItemManufactures,
    DmKodOrdersPage,
    DmKodOrdersSearch,
    DmKodSession,
    DmKodSignIn,
    DmKodSigningKey,
    DmKodUtilisationOptions,
    DmKodUtilisationTask,
    PushDmKodUtilisation,
} from "../dmkod-types";
import type { DmKodScope } from "@marking/lib/dmkod-scope";

const SESSION_URL = "/api/dmkod/session";

export const dmKodApi = {
    getItemManufactures: (
        scope: DmKodScope,
        orderId: number,
        orderItemId: number,
    ): Promise<DmKodOrderItemManufactures> =>
        apiClient
            .get(
                `/api/dmkod/orders/${orderId}/items/${orderItemId}/manufactures`,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),
    recoverOrder: (
        scope: DmKodScope,
        requestId: string,
    ): Promise<DmKodBackgroundTaskAccepted> =>
        apiClient
            .get(
                `/api/dmkod/orders/requests/${requestId}`,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),
    getUtilisationOptions: (
        scope: DmKodScope,
    ): Promise<DmKodUtilisationOptions> =>
        apiClient
            .get("/api/dmkod/utilisation/options", dmKodRequestConfig(scope))
            .then((response) => response.data),
    pushUtilisation: (
        scope: DmKodScope,
        request: PushDmKodUtilisation,
    ): Promise<DmKodBackgroundTaskAccepted> =>
        apiClient
            .post("/api/dmkod/utilisation", request, dmKodRequestConfig(scope))
            .then((response) => response.data),
    getUtilisationTask: (
        scope: DmKodScope,
        taskId: string,
    ): Promise<DmKodUtilisationTask> =>
        apiClient
            .get(
                `/api/dmkod/utilisation/tasks/${taskId}`,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),
    recoverUtilisation: (
        scope: DmKodScope,
        requestId: string,
    ): Promise<DmKodBackgroundTaskAccepted> =>
        apiClient
            .get(
                `/api/dmkod/utilisation/requests/${requestId}`,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),
    getSession: (scope: DmKodScope): Promise<DmKodSession> =>
        apiClient
            .get(SESSION_URL, dmKodRequestConfig(scope))
            .then((response) => response.data),

    signIn: (scope: DmKodScope, request: DmKodSignIn): Promise<DmKodSession> =>
        apiClient
            .post("/api/dmkod/auth/sign-in", request, dmKodRequestConfig(scope))
            .then((response) => response.data),

    refresh: (scope: DmKodScope): Promise<DmKodSession> =>
        apiClient
            .post(
                "/api/dmkod/auth/refresh",
                undefined,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),

    changePassword: (
        scope: DmKodScope,
        request: DmKodChangePassword,
    ): Promise<DmKodSession> =>
        apiClient
            .post(
                "/api/dmkod/auth/password",
                request,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),

    disconnect: (scope: DmKodScope): Promise<void> =>
        apiClient
            .delete(SESSION_URL, dmKodRequestConfig(scope))
            .then(() => undefined),

    ping: (scope: DmKodScope): Promise<DmKodConnectionStatus> =>
        apiClient
            .post(
                "/api/dmkod/connection/ping",
                undefined,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),

    connectHonestSign: async (
        scope: DmKodScope,
        certificateThumbprint: string,
    ): Promise<DmKodConnectionStatus> => {
        const signingKey = await apiClient
            .post<DmKodSigningKey>(
                "/api/dmkod/connection/signing-key",
                undefined,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data);
        const signature = await cryptoProSignatureService.signAttached({
            thumbprint: certificateThumbprint,
            message: signingKey.key,
        });
        return apiClient
            .post<DmKodConnectionStatus>(
                "/api/dmkod/connection/sign",
                {
                    signature,
                    certificateThumbprint,
                },
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data);
    },

    searchOrders: (
        scope: DmKodScope,
        request: DmKodOrdersSearch,
    ): Promise<DmKodOrdersPage> =>
        apiClient
            .post(
                "/api/dmkod/orders/search",
                request,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),

    getOrder: (
        scope: DmKodScope,
        orderId: number,
    ): Promise<DmKodOrderDetails> =>
        apiClient
            .get(`/api/dmkod/orders/${orderId}`, dmKodRequestConfig(scope))
            .then((response) => response.data),

    getCreateOrderOptions: (
        scope: DmKodScope,
    ): Promise<DmKodCreateOrderOptions> =>
        apiClient
            .get("/api/dmkod/orders/create-options", dmKodRequestConfig(scope))
            .then((response) => response.data),

    createOrder: (
        scope: DmKodScope,
        request: CreateDmKodOrder,
    ): Promise<DmKodBackgroundTaskAccepted> =>
        apiClient
            .post("/api/dmkod/orders", request, dmKodRequestConfig(scope))
            .then((response) => response.data),

    getBackgroundTask: (
        scope: DmKodScope,
        backgroundTaskId: string,
    ): Promise<DmKodBackgroundTask> =>
        apiClient
            .get(
                `/api/dmkod/background-tasks/${backgroundTaskId}`,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),
};
