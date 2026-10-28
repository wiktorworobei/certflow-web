import type { DmKodReportOperation } from "@marking/lib/dmkod-report-operation";
import type { DmKodReportTask } from "@marking/lib/dmkod-report-types";

export function dmKodGenerationReconciled(
    operation: DmKodReportOperation | null,
    task: DmKodReportTask | undefined,
) {
    return (
        operation?.action === "generate" &&
        task?.state === "UNAVAILABLE" &&
        task.generationReconciled === true &&
        task.backgroundTaskId === operation.taskId &&
        task.orderId === operation.orderId &&
        task.reportIds.some((id) => Number.isSafeInteger(id) && id > 0)
    );
}

export function utilisationReportOutcome(
    state: string,
): "draft" | "pending" | "accepted" | "partial" | "rejected" | "unknown" {
    switch (state.toUpperCase()) {
        case "CREATED":
            return "draft";
        case "SIGNED":
        case "PENDING":
            return "pending";
        case "SUCCESS":
            return "accepted";
        case "PARTIALLY":
            return "partial";
        case "FAILED":
        case "REJECTED":
            return "rejected";
        default:
            return "unknown";
    }
}
