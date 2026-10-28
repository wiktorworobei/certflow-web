import {
    CIS_TYPE_MAP,
    SERIAL_NUMBER_TYPE_MAP,
} from "@marking/components/honest-sign/constants";

import type {
    CreateOrderBody,
    CreateOrderProductDraft,
} from "@marking/components/honest-sign/types";

export function buildCreateOrderBody(
    productGroup: string,
    paymentType: number,
    releaseMethodType: string,
    templateId: number,
    products: CreateOrderProductDraft[],
): CreateOrderBody {
    return {
        productGroup,
        attributes: {
            createMethodType: "SELF_MADE",
            paymentType,
            releaseMethodType,
            productionOrderId: null,
            factoryAddress: null,
            factoryName: null,
        },
        products: products.map((product) => ({
            gtin: product.gtin.trim(),
            templateId,
            quantity: Number.parseInt(product.quantity, 10),
            serialNumberType: SERIAL_NUMBER_TYPE_MAP[product.serialNumberType]!,
            cisType: CIS_TYPE_MAP[product.cisType]!,
        })),
    };
}
