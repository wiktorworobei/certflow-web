export type OrdersView = "active" | "completed";

export const ORDER_STATUSES_BY_VIEW = {
    active: ["CREATED", "PENDING", "APPROVED", "READY"],
    completed: ["CLOSED", "DECLINED"],
} as const satisfies Record<OrdersView, readonly string[]>;

export function resolveOrderStatuses(
    view: OrdersView,
    selectedStatus: string,
): string[] {
    const availableStatuses = ORDER_STATUSES_BY_VIEW[view];
    return selectedStatus &&
        availableStatuses.some((status) => status === selectedStatus)
        ? [selectedStatus]
        : [...availableStatuses];
}
