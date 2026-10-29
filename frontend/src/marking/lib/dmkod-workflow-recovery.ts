import { queryOptions } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { dmKodWorkflowApi } from "@marking/lib/api/dmkod-workflow";
import { dmKodScopeQueryKey } from "@marking/lib/dmkod-scope";

import type { DmKodScope } from "@marking/lib/dmkod-scope";

export function isDmKodWorkflowOutcomeUncertain(error: unknown) {
    return (
        isAxiosError(error) &&
        (!error.response ||
            error.response.status === 408 ||
            error.response.status >= 500)
    );
}

export function isDmKodWorkflowReceiptPending(error: unknown) {
    return (
        isAxiosError<{ code?: string }>(error) &&
        (error.response?.status === 404 ||
            (error.response?.status === 409 &&
                error.response.data?.code ===
                    "error.dmkod_order_operation_pending"))
    );
}

export function dmKodWorkflowRecoveryOptions(
    scope: DmKodScope,
    intent: { requestId: string; taskId: string | null } | null,
    submittingRequestId: string | null,
) {
    return queryOptions({
        queryKey: [
            ...dmKodScopeQueryKey(scope),
            "workflow-receipt",
            intent?.requestId,
        ],
        queryFn: () => dmKodWorkflowApi.receipt(scope, intent!.requestId),
        // The mutating request can still be validating before its server intent
        // exists. Start recovery only after that request has settled.
        enabled:
            !!intent &&
            !intent.taskId &&
            intent.requestId !== submittingRequestId,
        retry: (failureCount, error) =>
            failureCount < 4 &&
            (isDmKodWorkflowReceiptPending(error) ||
                isDmKodWorkflowOutcomeUncertain(error)),
        retryDelay: 1500,
    });
}
