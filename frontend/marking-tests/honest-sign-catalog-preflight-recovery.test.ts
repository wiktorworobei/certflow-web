import { describe, expect, test } from "./test-compat";
import {
    canEditCatalogFailure,
    catalogFailureRecoveryNotice,
    isCatalogGtinPreflightConflict,
} from "../src/marking/lib/honest-sign/catalogForm";

const conflicts = [
    "error.honest_sign_catalog_gtin_pending",
    "error.honest_sign_catalog_gtin_draft_exists",
    "error.honest_sign_catalog_gtin_exists",
    "error.honest_sign_catalog_gtin_archived",
];

describe("Catalog preflight conflict recovery", () => {
    test.each(conflicts)(
        "%s keeps an unsent form editable after a confirmed empty receipt",
        (code) => {
            expect(isCatalogGtinPreflightConflict(409, code)).toBe(true);
            expect(canEditCatalogFailure(409, null, code)).toBe(true);
            expect(catalogFailureRecoveryNotice(409, code, null)).toBe(
                "editableAfterError",
            );
            expect(catalogFailureRecoveryNotice(409, code, "Draft")).toBe(
                "editableAfterError",
            );
            expect(catalogFailureRecoveryNotice(409, code, "Rejected")).toBe(
                "editableAfterError",
            );
        },
    );

    test.each(conflicts)(
        "%s cannot override a parallel call's own receipt",
        (code) => {
            for (const state of [
                "Sending",
                "Unknown",
                "Processing",
                "Accepted",
                "Reconciled",
            ]) {
                expect(canEditCatalogFailure(409, { state }, code)).toBe(false);
                expect(catalogFailureRecoveryNotice(409, code, state)).toBe(
                    "conflictReceiptFound",
                );
            }
        },
    );

    test.each(conflicts)(
        "%s preserves the request when its receipt cannot be read",
        (code) => {
            expect(catalogFailureRecoveryNotice(409, code, undefined)).toBe(
                "conflictReceiptUnavailable",
            );
        },
    );

    test("a reused key with different data never authorizes a new key or editable payload", () => {
        const code = "error.honest_sign_catalog_request_payload_conflict";
        expect(isCatalogGtinPreflightConflict(409, code)).toBe(false);
        expect(canEditCatalogFailure(409, null, code)).toBe(false);
        for (const state of [
            undefined,
            null,
            "Draft",
            "Rejected",
            "Sending",
            "Unknown",
            "Accepted",
        ]) {
            expect(catalogFailureRecoveryNotice(409, code, state)).toBe(
                "requestKeyConflict",
            );
        }
    });

    test("unclassified conflicts and transport failures retain the existing unknown-outcome guard", () => {
        for (const code of [
            null,
            "error.honest_sign_catalog_submission_conflict",
            "error.synthetic_conflict",
        ]) {
            expect(canEditCatalogFailure(409, null, code)).toBe(false);
            expect(catalogFailureRecoveryNotice(409, code, null)).toBe(
                "unknownAfterError",
            );
        }
        for (const status of [null, 408, 429, 500, 502]) {
            expect(isCatalogGtinPreflightConflict(status, conflicts[0])).toBe(
                false,
            );
            expect(
                catalogFailureRecoveryNotice(status, conflicts[0], null),
            ).toBe("unknownAfterError");
        }
    });
});
