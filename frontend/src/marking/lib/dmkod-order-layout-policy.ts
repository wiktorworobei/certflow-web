import type { DmKodAction, DmKodReadMethod } from "@marking/lib/dmkod-extended-types";

export type DmKodOrderMarkingCategory = "validation" | "aggregation";
export const orderMarkingReads: Record<
    DmKodOrderMarkingCategory,
    DmKodReadMethod[]
> = {
    validation: ["OrderValidations"],
    aggregation: ["OrderAggregations"],
};
export const orderMarkingActions: Record<
    DmKodOrderMarkingCategory,
    DmKodAction[]
> = {
    validation: [
        "PushValidation",
        "GenerateOrderValidation",
        "SignValidation",
        "PullValidation",
        "DeleteValidation",
    ],
    aggregation: [
        "PushAggregationRanges",
        "InspectContainers",
        "GenerateAggregation",
        "GenerateOrderAggregation",
        "SignAggregation",
        "PullAggregation",
        "DeleteAggregation",
    ],
};
export function usesDmKodOrderId(method: string) {
    return [
        "OrderValidations",
        "OrderAggregations",
        "GenerateOrderValidation",
        "GenerateOrderAggregation",
        "PushAggregationRanges",
    ].includes(method);
}
export function withDmKodOrderTarget<T extends Record<string, string>>(
    method: string,
    values: T,
    orderId?: number,
): T {
    return orderId && usesDmKodOrderId(method)
        ? { ...values, id: String(orderId) }
        : values;
}
