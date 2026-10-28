import type { DmKodOrderItem } from "@marking/lib/dmkod-types";
import type {
    DmKodCodeRequest,
    DmKodOrderOperation,
} from "@marking/lib/dmkod-workflow-types";

export const additionalOrderOperations: DmKodOrderOperation[] = [
    "UpdateItem",
    "DeleteItem",
    "ImportItems",
    "GenerateCancellation",
    "DeleteRequest",
    "FixCodes",
    "Update",
    "Delete",
];

export function codeRequestOutcome(state: string) {
    if (state === "CREATED") return "sign";
    if (["SIGNED", "PENDING"].includes(state)) return "pending";
    if (["READY", "EXHAUSTED", "CLOSED"].includes(state)) return "accepted";
    if (state === "DECLINED") return "rejected";
    return "unknown";
}

export function canReceiveOrderItem(
    item: DmKodOrderItem,
    requests: DmKodCodeRequest[],
) {
    if (item.readyQuantity != null && item.readyQuantity <= 0) return false;
    return requests.some(
        (request) =>
            request.type === "CODES" &&
            codeRequestOutcome(request.state) === "accepted" &&
            (!request.items?.length ||
                request.items.some((row) =>
                    row.orderItemId !== null
                        ? row.orderItemId === item.id
                        : !!row.gtin && row.gtin === item.product?.gtin,
                )),
    );
}

export function codeOrderingStep(
    items: DmKodOrderItem[],
    requests: DmKodCodeRequest[],
) {
    if (!items.length) return 1;
    if (!requests.length) return 2;
    return requests.some(
        (request) => request.type === "CODES" && request.state !== "CREATED",
    )
        ? 3
        : 2;
}

export function latestOrderItemRequest(
    item: DmKodOrderItem,
    requests: DmKodCodeRequest[],
) {
    return requests
        .filter(
            (request) =>
                request.type === "CODES" &&
                (!request.items?.length ||
                    request.items.some((row) =>
                        row.orderItemId !== null
                            ? row.orderItemId === item.id
                            : !!row.gtin && row.gtin === item.product?.gtin,
                    )),
        )
        .reduce<DmKodCodeRequest | undefined>(
            (latest, request) =>
                !latest || request.id > latest.id ? request : latest,
            undefined,
        );
}
