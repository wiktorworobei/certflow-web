import {
    useMutation,
    useQuery,
    useQueryClient,
    notifyManager,
    type QueryClient,
} from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { useCallback, useSyncExternalStore } from "react";
import { dmKodApi } from "@marking/lib/api/dmkod";
import {
    dmKodScopeKey,
    dmKodScopeQueryKey,
    type DmKodScope,
} from "@marking/lib/dmkod-scope";
import { dmKodManufacturesQueryKey } from "@marking/lib/dmkod-utilisation-attributes";

import type {
    CreateDmKodOrder,
    DmKodChangePassword,
    DmKodOrdersSearch,
    DmKodSession,
    DmKodSignIn,
    PushDmKodUtilisation,
} from "@marking/lib/dmkod-types";

export const dmKodKeys = {
    all: ["dmkod"] as const,
    scoped: (scope: DmKodScope) => dmKodScopeQueryKey(scope),
    session: (scope: DmKodScope) =>
        [...dmKodKeys.scoped(scope), "session"] as const,
    connection: (scope: DmKodScope) =>
        [...dmKodKeys.scoped(scope), "connection"] as const,
    orders: (scope: DmKodScope, request: DmKodOrdersSearch) =>
        [...dmKodKeys.scoped(scope), "orders", request] as const,
    order: (scope: DmKodScope, orderId: number) =>
        [...dmKodKeys.scoped(scope), "order", orderId] as const,
    manufactures: dmKodManufacturesQueryKey,
    createOptions: (scope: DmKodScope) =>
        [...dmKodKeys.scoped(scope), "create-options"] as const,
    backgroundTask: (scope: DmKodScope, backgroundTaskId: string) =>
        [
            ...dmKodKeys.scoped(scope),
            "background-task",
            backgroundTaskId,
        ] as const,
    utilisationOptions: (scope: DmKodScope) =>
        [...dmKodKeys.scoped(scope), "utilisation-options"] as const,
    utilisationTask: (scope: DmKodScope, taskId: string) =>
        [...dmKodKeys.scoped(scope), "utilisation-task", taskId] as const,
};

export const useDmKodUtilisationOptions = (
    scope: DmKodScope,
    enabled: boolean,
) =>
    useQuery({
        retry: false,
        queryKey: dmKodKeys.utilisationOptions(scope),
        queryFn: () => dmKodApi.getUtilisationOptions(scope),
        enabled: !!scope.companyId && enabled,
        staleTime: 30_000,
    });

export const useDmKodPushUtilisation = (scope: DmKodScope) =>
    useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: (request: PushDmKodUtilisation) =>
            dmKodApi.pushUtilisation(scope, request),
    });

export const useDmKodUtilisationTask = (
    scope: DmKodScope,
    taskId: string | null,
) =>
    useQuery({
        retry: false,
        queryKey: dmKodKeys.utilisationTask(scope, taskId ?? ""),
        queryFn: () => dmKodApi.getUtilisationTask(scope, taskId!),
        enabled: !!scope.companyId && !!taskId,
        refetchInterval: (query) =>
            query.state.status === "error" ||
            ["COMPLETED", "FAILED"].includes(
                query.state.data?.state?.toUpperCase() ?? "",
            )
                ? false
                : 1_500,
    });

const disconnectedSession: DmKodSession = {
    isAuthenticated: true,
    hasDmKodSession: false,
    requiresPasswordChange: false,
    needsRefresh: false,
    username: null,
    displayName: null,
    externalCompanyName: null,
    externalCompanyInn: null,
    externalCompanyType: null,
    externalRole: null,
    certificateThumbprint: null,
    honestSignConnectedAtUtc: null,
    accessTokenExpiresAtUtc: null,
    refreshTokenExpiresAtUtc: null,
};

export const useDmKodSession = (scope: DmKodScope) =>
    useQuery({
        retry: false,
        queryKey: dmKodKeys.session(scope),
        queryFn: () => dmKodApi.getSession(scope),
        enabled: !!scope.actorId && !!scope.companyId,
    });

export function dmKodRequiresSessionReentry(
    client: QueryClient,
    scope: DmKodScope,
) {
    return client
        .getQueryCache()
        .findAll({ queryKey: dmKodKeys.scoped(scope) })
        .some((query) => {
            if (query.state.status !== "error") return false;
            const resource = query.queryKey[4];
            return (
                resource === "session" ||
                resource === "extended-profile" ||
                resource === "cabinet-poas" ||
                (isAxiosError(query.state.error) &&
                    query.state.error.response?.status === 401)
            );
        });
}

export function useDmKodSessionReentry(scope: DmKodScope) {
    const client = useQueryClient();
    const subscribe = useCallback(
        (onChange: () => void) =>
            client
                .getQueryCache()
                .subscribe(notifyManager.batchCalls(onChange)),
        [client],
    );
    const snapshot = useCallback(
        () => dmKodRequiresSessionReentry(client, scope),
        [client, scope],
    );
    return useSyncExternalStore(subscribe, snapshot, snapshot);
}

export async function completeDmKodSignIn(
    client: QueryClient,
    scope: DmKodScope,
    session: DmKodSession,
) {
    // Cancel old reads before reopening the workspace, including an in-flight
    // session read. Receipts and operation intents remain in their own storage.
    await client.cancelQueries({ queryKey: dmKodKeys.scoped(scope) });
    client.removeQueries({
        queryKey: dmKodKeys.scoped(scope),
        predicate: (query) => query.queryKey[4] !== "session",
    });
    client.setQueryData(dmKodKeys.session(scope), session);
}

export const useDmKodConnection = (scope: DmKodScope, enabled: boolean) =>
    useQuery({
        retry: false,
        queryKey: dmKodKeys.connection(scope),
        queryFn: () => dmKodApi.ping(scope),
        enabled: !!scope.companyId && enabled,
        staleTime: 30_000,
    });

export const useDmKodSignIn = (scope: DmKodScope) => {
    const queryClient = useQueryClient();
    return useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: (request: DmKodSignIn) => dmKodApi.signIn(scope, request),
        onSuccess: (session) =>
            completeDmKodSignIn(queryClient, scope, session),
    });
};

export const useDmKodRefresh = (scope: DmKodScope) => {
    const queryClient = useQueryClient();
    return useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: () => dmKodApi.refresh(scope),
        onSuccess: (session) =>
            queryClient.setQueryData(dmKodKeys.session(scope), session),
    });
};

export const useDmKodChangePassword = (scope: DmKodScope) => {
    const queryClient = useQueryClient();
    return useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: (request: DmKodChangePassword) =>
            dmKodApi.changePassword(scope, request),
        onSuccess: (session) =>
            queryClient.setQueryData(dmKodKeys.session(scope), session),
    });
};

export const useDmKodDisconnect = (scope: DmKodScope) => {
    const queryClient = useQueryClient();
    return useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: () => dmKodApi.disconnect(scope),
        onSuccess: () => {
            queryClient.setQueryData(
                dmKodKeys.session(scope),
                disconnectedSession,
            );
            queryClient.removeQueries({
                queryKey: dmKodKeys.connection(scope),
            });
        },
    });
};

export const useDmKodConnectHonestSign = (scope: DmKodScope) => {
    const queryClient = useQueryClient();
    return useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: (certificateThumbprint: string) =>
            dmKodApi.connectHonestSign(scope, certificateThumbprint),
        onSuccess: async (connection) => {
            queryClient.setQueryData(dmKodKeys.connection(scope), connection);
            await queryClient.invalidateQueries({
                queryKey: dmKodKeys.session(scope),
            });
        },
    });
};

export const useDmKodOrders = (
    scope: DmKodScope,
    request: DmKodOrdersSearch,
    enabled: boolean,
) =>
    useQuery({
        retry: false,
        queryKey: dmKodKeys.orders(scope, request),
        queryFn: () => dmKodApi.searchOrders(scope, request),
        enabled: !!scope.companyId && enabled,
        placeholderData: (previous) => previous,
    });

export const useDmKodOrder = (scope: DmKodScope, orderId: number | null) =>
    useQuery({
        retry: false,
        queryKey: dmKodKeys.order(scope, orderId ?? 0),
        queryFn: () => dmKodApi.getOrder(scope, orderId!),
        enabled: !!scope.companyId && orderId !== null && orderId > 0,
    });

export const useDmKodCreateOrderOptions = (
    scope: DmKodScope,
    enabled: boolean,
) =>
    useQuery({
        retry: false,
        queryKey: dmKodKeys.createOptions(scope),
        queryFn: () => dmKodApi.getCreateOrderOptions(scope),
        enabled: !!scope.companyId && enabled,
        staleTime: 30_000,
    });

export const useDmKodCreateOrder = (scope: DmKodScope) =>
    useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: (request: CreateDmKodOrder) =>
            dmKodApi.createOrder(scope, request),
    });

export const useDmKodBackgroundTask = (
    scope: DmKodScope,
    backgroundTaskId: string | null,
) =>
    useQuery({
        retry: false,
        queryKey: dmKodKeys.backgroundTask(scope, backgroundTaskId ?? ""),
        queryFn: () => dmKodApi.getBackgroundTask(scope, backgroundTaskId!),
        enabled: !!scope.companyId && !!backgroundTaskId,
        refetchInterval: (query) => {
            const state = query.state.data?.state?.toUpperCase();
            return query.state.status === "error" ||
                state === "COMPLETED" ||
                state === "FAILED"
                ? false
                : 1_500;
        },
    });
