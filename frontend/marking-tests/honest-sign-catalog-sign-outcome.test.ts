import { expect, test } from "./test-compat";
import {
    catalogWorkflowOutcome,
    recoverCatalogOperationFailure,
} from "../src/marking/lib/honest-sign/catalogWorkflowOutcome";

import type { CatalogOperation } from "../src/marking/lib/honest-sign/catalogTypes";

const accepted: CatalogOperation = {
    requestId: "synthetic-sign-intent",
    submissionId: "synthetic-card",
    operation: "Sign",
    state: "Accepted",
    goodId: 42,
    feedId: null,
    error: null,
    createdAtUtc: "2026-10-22T12:00:00Z",
    replayed: false,
};

test("an accepted signing receipt remains authoritative while the card refresh is unavailable", () => {
    expect(
        catalogWorkflowOutcome({
            actionKind: "Sign",
            receipt: accepted,
            freshSignedCard: false,
            pendingRequest: false,
            actionFailed: false,
        }),
    ).toEqual({
        signAccepted: true,
        publicationConfirmed: true,
        uncertain: false,
        showActionError: false,
    });
});

test("a freshly confirmed signed card supersedes a stale transport error without accepting the missing receipt", () => {
    expect(
        catalogWorkflowOutcome({
            actionKind: "Sign",
            freshSignedCard: true,
            pendingRequest: true,
            actionFailed: true,
        }),
    ).toEqual({
        signAccepted: false,
        publicationConfirmed: true,
        uncertain: false,
        showActionError: false,
    });
});

test("a missing receipt and stale card keep signing uncertain rather than reporting a rejection", () => {
    expect(
        catalogWorkflowOutcome({
            actionKind: "Sign",
            freshSignedCard: false,
            pendingRequest: true,
            actionFailed: true,
        }),
    ).toMatchObject({
        publicationConfirmed: false,
        uncertain: true,
        showActionError: false,
    });
});

test("an already signed card cannot turn a new provider refusal into success", () => {
    expect(
        catalogWorkflowOutcome({
            actionKind: "Sign",
            freshSignedCard: true,
            signedBeforeAction: true,
            pendingRequest: false,
            actionFailed: true,
        }),
    ).toMatchObject({
        publicationConfirmed: false,
        uncertain: false,
        showActionError: true,
    });
    expect(
        catalogWorkflowOutcome({
            actionKind: "Sign",
            freshSignedCard: true,
            signedBeforeAction: true,
            pendingRequest: true,
            actionFailed: true,
        }),
    ).toMatchObject({
        publicationConfirmed: false,
        uncertain: true,
        showActionError: false,
    });
});

test("confirmed rejections remain errors even if another action later signed the card", () => {
    expect(
        catalogWorkflowOutcome({
            actionKind: "Sign",
            receipt: {
                ...accepted,
                state: "Rejected",
                error: "Safe rejection",
            },
            freshSignedCard: true,
            pendingRequest: false,
            actionFailed: true,
        }),
    ).toMatchObject({ showActionError: true });
    expect(
        catalogWorkflowOutcome({
            actionKind: "Moderate",
            freshSignedCard: true,
            pendingRequest: false,
            actionFailed: true,
        }),
    ).toMatchObject({ publicationConfirmed: false, showActionError: true });
});

test("recovering a lost signing response returns its saved receipt with one read and no resend", async () => {
    let reads = 0;
    let missing = 0;
    const result = await recoverCatalogOperationFailure(
        new Error("Synthetic lost response"),
        async () => {
            reads++;
            return accepted;
        },
        () => missing++,
    );
    expect(result).toBe(accepted);
    expect(reads).toBe(1);
    expect(missing).toBe(0);
});

test("a failed receipt read preserves the original error and never clears the pending intent", async () => {
    const original = new Error("Synthetic lost response");
    let missing = 0;
    const result = await recoverCatalogOperationFailure(
        original,
        async () => {
            throw new Error("Synthetic receipt refresh failure");
        },
        () => missing++,
    ).catch((error: unknown) => error);
    expect(result).toBe(original);
    expect(missing).toBe(0);
});

test("only a completed empty receipt read permits the existing preflight-failure policy", async () => {
    const original = new Error("Synthetic preflight failure");
    let missing = 0;
    const result = await recoverCatalogOperationFailure(
        original,
        async () => null,
        () => missing++,
    ).catch((error: unknown) => error);
    expect(result).toBe(original);
    expect(missing).toBe(1);
});

test("a rejected receipt preserves the original HTTP response alongside the completed intent", async () => {
    const original = Object.assign(
        new Error("Provider refused this new attempt"),
        {
            status: 400,
            diagnostics: {
                correlationId: "synthetic-correlation",
                upstreamErrorCode: "155",
            },
        },
    );
    const rejected = { ...accepted, state: "Rejected" as const, error: null };
    let displayedError: unknown;
    let displayedReceipt: CatalogOperation | undefined;
    let reads = 0;
    const result = await recoverCatalogOperationFailure(
        original,
        async () => {
            reads++;
            return rejected;
        },
        undefined,
        (error, receipt) => {
            displayedError = error;
            displayedReceipt = receipt;
        },
    );
    expect(reads).toBe(1);
    expect(result).toBe(rejected);
    expect(displayedReceipt).toBe(rejected);
    expect(displayedError).toBe(original);
    expect(displayedError).toMatchObject({
        status: 400,
        diagnostics: {
            upstreamErrorCode: "155",
            correlationId: "synthetic-correlation",
        },
    });
});

test.each(["Accepted", "Unknown", "Processing"] as const)(
    "%s receipt recovery does not manufacture a confirmed provider refusal",
    async (state) => {
        const receipt = { ...accepted, state };
        let refused = 0;
        const result = await recoverCatalogOperationFailure(
            new Error("Synthetic lost response"),
            async () => receipt,
            undefined,
            () => refused++,
        );
        expect(result).toBe(receipt);
        expect(refused).toBe(0);
    },
);
