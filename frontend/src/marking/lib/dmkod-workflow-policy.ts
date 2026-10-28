import { z } from "zod";

import type {
    DmKodOrderOperation,
    DmKodOrderOperationRequest,
} from "@marking/lib/dmkod-workflow-types";

export const operationFields = {
    Synchronize: [],
    SynchronizePoas: [],
    Update: [
        "flag",
        "productionOrderId",
        "secondaryProductionOrderId",
        "releaseMethodType",
    ],
    Delete: [],
    CreateItem: [
        "gtin",
        "templateId",
        "cisType",
        "quantity",
        "tag",
        "flag",
        "paymentType",
        "freeCode",
        "producer",
    ],
    UpdateItem: [
        "itemId",
        "gtin",
        "templateId",
        "cisType",
        "quantity",
        "tag",
        "flag",
        "paymentType",
        "freeCode",
        "producer",
    ],
    DeleteItem: ["itemId"],
    ImportItems: ["filename", "filecontent", "tag", "flag"],
    PullCodes: ["itemId", "quantity"],
    FixCodes: ["itemId"],
    DownloadCodes: ["itemId", "range", "filetype", "filename"],
    GenerateRequests: [],
    GenerateCancellation: ["itemId"],
    PullRequest: ["requestId"],
    DeleteRequest: ["requestId"],
} as const satisfies Record<DmKodOrderOperation, readonly string[]>;
export type WorkflowField =
    (typeof operationFields)[DmKodOrderOperation][number];
export const destructiveOperation = (operation: DmKodOrderOperation) =>
    ["Delete", "DeleteItem", "DeleteRequest", "GenerateCancellation"].includes(
        operation,
    );

export const workflowNeedsConfirmation = (
    operation: DmKodOrderOperation,
    directCodeAction: boolean,
) => !directCodeAction || destructiveOperation(operation);

export function workflowTaskOutcome(task?: {
    state: string;
    resultState: string | null;
}): "pending" | "succeeded" | "failed" {
    if (task?.state === "FAILED") return "failed";
    if (task?.state !== "COMPLETED") return "pending";
    if (task.resultState === "SUCCESS") return "succeeded";
    if (task.resultState === "FAILED") return "failed";
    return "pending";
}

export function workflowSchema(
    operation: DmKodOrderOperation,
    invalid: string,
) {
    const required = new Set<string>(
        operation === "CreateItem"
            ? ["gtin", "templateId", "cisType", "quantity"]
            : operation === "ImportItems"
              ? ["filename", "filecontent"]
              : [],
    );
    const fields: readonly string[] = operationFields[operation];
    if (fields.includes("itemId")) required.add("itemId");
    if (fields.includes("requestId")) required.add("requestId");
    if (operation === "PullCodes") required.add("quantity");
    if (operation === "DownloadCodes") {
        required.add("range");
        required.add("filetype");
    }
    return z
        .record(z.string(), z.string({ error: invalid }))
        .superRefine((values, context) => {
            for (const field of operationFields[operation]) {
                const value = values[field] ?? "";
                let valid = !required.has(field) || value.trim().length > 0;
                if (
                    value &&
                    ["itemId", "requestId", "quantity"].includes(field)
                )
                    valid =
                        /^[1-9][0-9]*$/.test(value) &&
                        Number.isSafeInteger(Number(value));
                if (value && field === "gtin")
                    valid = /^[0-9]{14}$/.test(value);
                if (value && field === "producer")
                    valid = /^[0-9]{10,12}$/.test(value);
                if (value && field !== "filecontent" && value.length > 256)
                    valid = false;
                if (
                    value &&
                    field !== "filecontent" &&
                    [...value].some(
                        (character) =>
                            character.charCodeAt(0) < 32 ||
                            character.charCodeAt(0) === 127,
                    )
                )
                    valid = false;
                if (
                    field === "filetype" &&
                    !["csv", "txt", "json"].includes(value)
                )
                    valid = false;
                if (field === "range" && value !== "requested") {
                    const range = /^([1-9][0-9]*)-([1-9][0-9]*)$/.exec(value);
                    valid =
                        !!range &&
                        Number.isSafeInteger(Number(range[2])) &&
                        Number(range[1]) <= Number(range[2]);
                }
                if (field === "filecontent" && value) {
                    const lines = value
                        .split(/\r?\n/)
                        .filter((line) => line.length > 0);
                    valid =
                        lines.length > 0 &&
                        lines.length <= 100_000 &&
                        lines.every(
                            (line) =>
                                line.length <= 500 && !line.includes("\r"),
                        );
                }
                if (!valid)
                    context.addIssue({
                        code: "custom",
                        path: [field],
                        message: invalid,
                    });
            }
            if (
                operation === "UpdateItem" &&
                !!values.templateId !== !!values.cisType
            )
                context.addIssue({
                    code: "custom",
                    path: ["templateId"],
                    message: invalid,
                });
        });
}
export function workflowPayload(
    operation: DmKodOrderOperation,
    values: Record<string, string>,
    clientRequestId: string,
): DmKodOrderOperationRequest {
    const result: Record<string, unknown> = { clientRequestId, operation };
    for (const field of operationFields[operation]) {
        const value = values[field];
        if (!value) continue;
        result[field] = ["itemId", "requestId", "quantity"].includes(field)
            ? Number(value)
            : field === "filecontent"
              ? value.split(/\r?\n/).filter((line) => line.length > 0)
              : value;
    }
    return result as DmKodOrderOperationRequest;
}
