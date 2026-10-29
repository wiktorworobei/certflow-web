import { describe, expect, test } from "./test-compat";
import {
    canEditCatalogFailure,
    catalogFormFromCard,
    buildCatalogCardRequest,
    catalogAttributeKey,
} from "../src/marking/lib/honest-sign/catalogForm";
import en from "../src/marking/src/i18n/locales/en.json" with { type: 'json' };
import ru from "../src/marking/src/i18n/locales/ru.json" with { type: 'json' };

import type {
    CatalogAttribute,
    CatalogCardRequest,
} from "../src/marking/lib/honest-sign/catalogTypes";

describe("Catalog lifecycle recovery", () => {
    test.each([400, 401, 403, 422])(
        "a completed %i before any intent keeps the form editable",
        (status) => {
            expect(canEditCatalogFailure(status, null)).toBe(true);
        },
    );
    test.each([null, 408, 409, 429, 500, 502])(
        "an ambiguous %s never unlocks another payload",
        (status) => {
            expect(canEditCatalogFailure(status, null)).toBe(false);
        },
    );
    test.each(["Sending", "Unknown", "Accepted", "Processing", "Reconciled"])(
        "receipt %s wins over an HTTP 400",
        (state) => {
            expect(canEditCatalogFailure(400, { state })).toBe(false);
        },
    );
    test("an authoritative rejection is editable even after a lost response", () => {
        expect(canEditCatalogFailure(null, { state: "Rejected" })).toBe(true);
    });
    test("editing a card preserves all scalar values, repeated attributes and units", () => {
        const request: CatalogCardRequest = {
            requestId: "synthetic",
            categoryId: 100,
            gtin: "05011846021161",
            name: "Synthetic oil",
            brand: "Test",
            tnved: "2710198200",
            photoUrl: null,
            sendToModeration: true,
            attributes: [
                { id: 2716, value: "4", valueType: "л" },
                { id: 2630, value: "RU", valueType: null },
                { id: 2630, value: "BY", valueType: null },
            ],
        };
        const values = catalogFormFromCard(request);
        expect(values.sendToModeration).toBe(false);
        expect(values.gtin).toBe(request.gtin);
        expect(values.attributes[catalogAttributeKey(2630)]).toHaveLength(2);
        const model = [2716, 2630].map(
            (id): CatalogAttribute => ({
                id,
                name: "Test",
                groupName: "Test",
                fieldType: "text",
                requirement: "o",
                isMultiple: true,
                multiplicityType: "regular",
                presetOnly: false,
                options: [],
                valueTypes: [],
                dependencies: [],
                isFirstLayer: true,
                isSecondLayer: false,
                hasUnsupportedDictionary: false,
            }),
        );
        expect(buildCatalogCardRequest(values, model, "new-request")).toEqual({
            ...request,
            requestId: "new-request",
            sendToModeration: false,
        });
    });
    test("lifecycle confirmations, recovery and actual state labels exist in both locales", () => {
        for (const locale of [ru, en]) {
            const text = locale.honestSign.catalog.workflow;
            expect(text.confirmSign).toBeTruthy();
            expect(text.confirmReconcile).toBeTruthy();
            expect(text.certificateMismatch).toBeTruthy();
            expect(text.unknownAfterError).toBeTruthy();
            expect(text.cardStates.notsigned).toBeTruthy();
            expect(text.operationStates.Unknown).toBeTruthy();
        }
    });
});
