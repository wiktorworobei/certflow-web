export type OrdersFilters = {
    dateFrom: string;
    dateTo: string;
    orderStatus: string;
    productGroup: string;
    limit: number;
};

const ORDERS_FILTERS_KEY_PREFIX = "honest-sign.orders.filters.v2";
const ALLOWED_LIMITS = new Set([10, 20, 50]);

export const DEFAULT_ORDERS_FILTERS: OrdersFilters = {
    dateFrom: "",
    dateTo: "",
    orderStatus: "",
    productGroup: "",
    limit: 10,
};

function cloneDefaultFilters(): OrdersFilters {
    return { ...DEFAULT_ORDERS_FILTERS };
}

function readStringValue(value: unknown, fallback: string): string {
    return typeof value === "string" ? value : fallback;
}

function readLimitValue(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return DEFAULT_ORDERS_FILTERS.limit;
    }

    const rounded = Math.round(value);
    return ALLOWED_LIMITS.has(rounded) ? rounded : DEFAULT_ORDERS_FILTERS.limit;
}

function normalizeFilters(rawFilters: unknown): OrdersFilters {
    if (!rawFilters || typeof rawFilters !== "object") {
        return cloneDefaultFilters();
    }

    const candidate = rawFilters as Partial<OrdersFilters>;

    return {
        dateFrom: readStringValue(
            candidate.dateFrom,
            DEFAULT_ORDERS_FILTERS.dateFrom,
        ),
        dateTo: readStringValue(
            candidate.dateTo,
            DEFAULT_ORDERS_FILTERS.dateTo,
        ),
        orderStatus: readStringValue(
            candidate.orderStatus,
            DEFAULT_ORDERS_FILTERS.orderStatus,
        ),
        productGroup: readStringValue(
            candidate.productGroup,
            DEFAULT_ORDERS_FILTERS.productGroup,
        ),
        limit: readLimitValue(candidate.limit),
    };
}

function storageKey(scope: string): string {
    return `${ORDERS_FILTERS_KEY_PREFIX}.${scope || "unknown-company"}`;
}

export function getStoredOrdersFilters(scope: string): OrdersFilters {
    if (typeof window === "undefined") {
        return cloneDefaultFilters();
    }

    const stored = window.localStorage.getItem(storageKey(scope));
    if (!stored) {
        return cloneDefaultFilters();
    }

    try {
        const parsed = JSON.parse(stored);
        return normalizeFilters(parsed);
    } catch {
        return cloneDefaultFilters();
    }
}

export function saveOrdersFilters(scope: string, filters: OrdersFilters): void {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.setItem(
        storageKey(scope),
        JSON.stringify(normalizeFilters(filters)),
    );
}

export function clearOrdersFilters(scope: string): void {
    if (typeof window === "undefined") {
        return;
    }

    window.localStorage.removeItem(storageKey(scope));
}
