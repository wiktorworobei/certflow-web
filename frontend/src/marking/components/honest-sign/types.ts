import type { OrdersFilters } from "@marking/lib/honest-sign/ordersFiltersStore";
import type { OrdersView } from "@marking/lib/honest-sign/orderViews";

export type TopTab = "orders" | "documents" | "catalog";

export type OrderTemplateOption = {
    id: number;
    category: string;
    format: string;
};

export type CreateOrderBody = {
    productGroup: string;
    attributes: {
        createMethodType: string;
        paymentType: number;
        releaseMethodType: string;
        productionOrderId: null;
        factoryAddress: null;
        factoryName: null;
    };
    products: Array<{
        gtin: string;
        templateId: number;
        quantity: number;
        serialNumberType: string;
        cisType: string;
    }>;
};

export type CreateOrderProductDraft = {
    gtin: string;
    quantity: string;
    serialNumberType: string;
    cisType: string;
};

export type CreateOrderProductTouchedState = {
    gtin: boolean;
    quantity: boolean;
    serialNumberType: boolean;
    cisType: boolean;
};

export type OrderRow = {
    orderId: string;
    status: string;
    productionOrderId: string | null;
    createdAtUtc: string | null;
    receivedAtUtc: string | null;
    closedAtUtc: string | null;
    productsCount: number;
    provider: string;
    totalCodes: number | null;
    usedCodes: number | null;
    remainingCodes: number | null;
    firstGtin: string | null;
    declineReason: string | null;
    products: Array<{
        gtin: string | null;
        totalCodes: number | null;
        status: string | null;
    }>;
};

export type { OrdersView };

export type FilterForm = OrdersFilters;

export type BrowserViewState =
    | { view: "orders-list" }
    | { view: "create-step-1" }
    | { view: "create-step-2" }
    | { view: "order-details"; orderId: string; gtin: string };

export type BreadcrumbItem = {
    label: string;
    onClick?: () => void;
};

export type CertificateOption = {
    label: string;
    value: string;
};

export type StatusVariant = "info" | "success" | "warning" | "error";
