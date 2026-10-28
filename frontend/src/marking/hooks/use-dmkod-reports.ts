import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dmKodReportsApi } from "@marking/lib/api/dmkod-reports";
import {
    dmKodScopeKey,
    dmKodScopeQueryKey,
    type DmKodScope,
} from "@marking/lib/dmkod-scope";

import type { DmKodSignReport } from "@marking/lib/dmkod-report-types";

export const dmKodReportKeys = {
    all: (scope: DmKodScope) =>
        [...dmKodScopeQueryKey(scope), "utilisation-reports"] as const,
    list: (scope: DmKodScope, orderId: number) =>
        [...dmKodReportKeys.all(scope), "order", orderId] as const,
    task: (scope: DmKodScope, taskId: string) =>
        [...dmKodReportKeys.all(scope), "task", taskId] as const,
    operation: (scope: DmKodScope, requestId: string) =>
        [...dmKodReportKeys.all(scope), "operation", requestId] as const,
};

export const useDmKodReports = (scope: DmKodScope, orderId: number | null) =>
    useQuery({
        retry: false,
        queryKey: dmKodReportKeys.list(scope, orderId ?? 0),
        queryFn: () => dmKodReportsApi.getReports(scope, orderId!),
        enabled: !!scope.companyId && !!orderId && orderId > 0,
        refetchInterval: (query) =>
            query.state.status !== "error" &&
            query.state.data?.reports.some((report) =>
                ["SIGNED", "PENDING"].includes(report.state.toUpperCase()),
            )
                ? 3_000
                : false,
    });

export const useDmKodGenerateReports = (scope: DmKodScope) =>
    useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: (request: { orderId: number; clientRequestId: string }) =>
            dmKodReportsApi.generate(
                scope,
                request.orderId,
                request.clientRequestId,
            ),
    });

export const useDmKodSignReport = (
    scope: DmKodScope,
    orderId: number | null,
) => {
    const queryClient = useQueryClient();
    return useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: (request: { reportId: number; payload: DmKodSignReport }) =>
            dmKodReportsApi.sign(scope, request.reportId, request.payload),
        onSuccess: () =>
            queryClient.invalidateQueries({
                queryKey: dmKodReportKeys.list(scope, orderId ?? 0),
            }),
    });
};

export const useDmKodPullReport = (scope: DmKodScope) =>
    useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: (request: { reportId: number; clientRequestId: string }) =>
            dmKodReportsApi.pull(
                scope,
                request.reportId,
                request.clientRequestId,
            ),
    });

export const useDmKodReportTask = (scope: DmKodScope, taskId: string | null) =>
    useQuery({
        retry: false,
        queryKey: dmKodReportKeys.task(scope, taskId ?? ""),
        queryFn: () => dmKodReportsApi.getTask(scope, taskId!),
        enabled: !!scope.companyId && !!taskId,
        refetchInterval: (query) => {
            const state = query.state.data?.state?.toUpperCase();
            return query.state.status === "error" ||
                state === "COMPLETED" ||
                state === "FAILED" ||
                state === "UNAVAILABLE"
                ? false
                : 1_500;
        },
    });
