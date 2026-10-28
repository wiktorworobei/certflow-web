import { dmKodScopeStorageKey } from "@marking/lib/dmkod-scope";

import type { DmKodScope } from "@marking/lib/dmkod-scope";

export type DmKodReportOperation = {
    action: "generate" | "sign" | "pull" | "delete" | "delete-failure";
    requestId: string;
    orderId: number;
    reportId: number | null;
    taskId: string | null;
    uuid: string | null;
};
const uuid = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;

export function readDmKodReportOperation(
    raw: string | null,
    orderId?: number | null,
): DmKodReportOperation | null {
    try {
        const item = JSON.parse(raw ?? "null") as DmKodReportOperation | null;
        if (
            !item ||
            !["generate", "sign", "pull", "delete", "delete-failure"].includes(
                item.action,
            ) ||
            !uuid.test(item.requestId) ||
            !Number.isSafeInteger(item.orderId) ||
            item.orderId <= 0 ||
            (orderId != null && item.orderId !== orderId) ||
            (item.reportId !== null &&
                (!Number.isSafeInteger(item.reportId) || item.reportId <= 0)) ||
            (item.taskId !== null && !uuid.test(item.taskId))
        )
            return null;
        return {
            action: item.action,
            requestId: item.requestId,
            orderId: item.orderId,
            reportId: item.reportId,
            taskId: item.taskId,
            uuid:
                typeof item.uuid === "string" && uuid.test(item.uuid)
                    ? item.uuid
                    : null,
        };
    } catch {
        return null;
    }
}

export function dmKodReportOperationStorageKey(
    scope: DmKodScope,
    orderId: number | null,
) {
    return `${dmKodScopeStorageKey(scope, "reports")}.order.${orderId ?? "none"}`;
}

export function restoreDmKodReportOperation(
    storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
    scope: DmKodScope,
    orderId: number | null,
) {
    if (orderId === null) return null;
    const key = dmKodReportOperationStorageKey(scope, orderId);
    const current = readDmKodReportOperation(storage.getItem(key), orderId);
    if (current) return current;
    const legacyKey = dmKodScopeStorageKey(scope, "reports");
    const legacy = readDmKodReportOperation(
        storage.getItem(legacyKey),
        orderId,
    );
    if (legacy) {
        // Move only a matching receipt; another order's unknown outcome stays recoverable.
        storage.setItem(key, JSON.stringify(legacy));
        storage.removeItem(legacyKey);
    }
    return legacy;
}

export function dmKodReportSelectedOrder(
    storage: Pick<Storage, "getItem">,
    scope: DmKodScope,
) {
    const selected = Number(
        storage.getItem(
            `${dmKodScopeStorageKey(scope, "reports")}.selected-order`,
        ),
    );
    return Number.isSafeInteger(selected) && selected > 0
        ? selected
        : (readDmKodReportOperation(
              storage.getItem(dmKodScopeStorageKey(scope, "reports")),
          )?.orderId ?? null);
}

export function restoreDmKodReportOperations(
    storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
    scope: DmKodScope,
    orderId: number | null,
) {
    if (orderId === null) return [];
    const current = restoreDmKodReportOperation(storage, scope, orderId);
    const operations = new Map<string, DmKodReportOperation>();
    try {
        const saved: unknown = JSON.parse(
            storage.getItem(
                `${dmKodReportOperationStorageKey(scope, orderId)}.pending`,
            ) ?? "[]",
        );
        if (Array.isArray(saved))
            for (const item of saved) {
                const operation = readDmKodReportOperation(
                    JSON.stringify(item),
                    orderId,
                );
                if (operation) operations.set(operation.requestId, operation);
            }
    } catch {
        /* Ignore malformed local metadata; the current receipt remains recoverable. */
    }
    if (current) operations.set(current.requestId, current);
    return [...operations.values()];
}

export function saveDmKodReportOperations(
    storage: Pick<Storage, "setItem" | "removeItem">,
    storageKey: string,
    operations: readonly DmKodReportOperation[],
) {
    const safe = operations.flatMap((operation) => {
        const validated = readDmKodReportOperation(JSON.stringify(operation));
        return validated ? [validated] : [];
    });
    if (safe.length) {
        storage.setItem(`${storageKey}.pending`, JSON.stringify(safe));
        storage.setItem(storageKey, JSON.stringify(safe.at(-1)));
    } else {
        storage.removeItem(`${storageKey}.pending`);
        storage.removeItem(storageKey);
    }
}

export function dmKodReportOperationsConflict(
    previous: DmKodReportOperation,
    action: DmKodReportOperation["action"],
    reportId: number | null,
) {
    if (action === "generate") return previous.action === "generate";
    // Generation belongs to the order. It must not prevent signing an existing report.
    return previous.reportId === reportId && previous.action !== "generate";
}
