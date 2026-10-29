import type { CatalogProduct } from "./catalogTypes";

export function catalogProductStatuses(
    product: Pick<CatalogProduct, "status" | "detailedStatuses">,
): string[] {
    const states = product.detailedStatuses.filter((state) => state.trim());
    return [
        ...new Set(
            (states.length ? states : [product.status || "unknown"]).map(
                (state) => state.trim().toLowerCase(),
            ),
        ),
    ];
}

/** Opening the workflow is not a signing decision; National Catalog decides on submission. */
export function canOpenCatalogSigning(
    product: Pick<CatalogProduct, "gtin" | "status" | "detailedStatuses">,
): boolean {
    return Boolean(product.gtin);
}

export function validCatalogProductDateRange(
    fromDate: string,
    toDate: string,
): boolean {
    const validDate = (value: string) =>
        /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
        new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
    return validDate(fromDate) && validDate(toDate) && fromDate <= toDate;
}
