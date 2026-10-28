import { isAxiosError } from "axios";
import { dmKodGenerationReconciled } from "@marking/lib/dmkod-report-policy";
import { workflowTaskOutcome } from "@marking/lib/dmkod-workflow-policy";

import type { DmKodReportOperation } from "@marking/lib/dmkod-report-operation";
import type {
    DmKodReportOperation as Receipt,
    DmKodReportTask,
} from "@marking/lib/dmkod-report-types";

export async function resolveDmKodReportOperation(
    operation: DmKodReportOperation,
    readReceipt: (requestId: string) => Promise<Receipt>,
    readTask: (taskId: string) => Promise<DmKodReportTask>,
): Promise<"absent" | "submitted" | "finished" | "pending"> {
    if (operation.uuid) return "submitted";
    let receipt: Receipt;
    try {
        receipt = await readReceipt(operation.requestId);
    } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404)
            return "absent";
        throw error;
    }
    if (
        operation.action !== "generate" &&
        receipt.reportId !== operation.reportId
    )
        return "pending";
    if (operation.taskId && receipt.backgroundTaskId !== operation.taskId)
        return "pending";
    if (receipt.uuid)
        return operation.action === "sign" ? "submitted" : "pending";
    if (!receipt.backgroundTaskId) return "pending";
    const task = await readTask(receipt.backgroundTaskId);
    if (task.backgroundTaskId !== receipt.backgroundTaskId) return "pending";
    return workflowTaskOutcome(task) !== "pending" ||
        dmKodGenerationReconciled(
            { ...operation, taskId: receipt.backgroundTaskId },
            task,
        )
        ? "finished"
        : "pending";
}
