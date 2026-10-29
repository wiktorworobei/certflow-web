import type { CatalogCard, CatalogOperation } from "./catalogTypes";

/** Provider lifecycle and earlier receipts are facts, not local action prohibitions. */
export function catalogActionAvailability(
    card:
        | Pick<
              CatalogCard,
              "canEdit" | "canModerate" | "canSign" | "status" | "isSigned"
          >
        | undefined,
    {
        busy,
        pendingRequest,
        fetching,
        dirty,
    }: {
        busy: boolean;
        pendingRequest: boolean;
        fetching: boolean;
        dirty: boolean;
    },
) {
    const idle = !busy && !pendingRequest;
    return {
        canEdit: Boolean(card?.canEdit && idle),
        canModerate: Boolean(card?.canModerate && idle && !fetching && !dirty),
        canSign: Boolean(card?.canSign && idle && !fetching && !dirty),
    };
}

/** Reading a receipt never resends the mutation or replaces its original failure. */
export async function recoverCatalogOperationFailure(
    originalError: unknown,
    readReceipt: () => Promise<CatalogOperation | null>,
    onMissingReceipt?: () => void,
    onRejectedReceipt?: (error: unknown, receipt: CatalogOperation) => void,
): Promise<CatalogOperation> {
    let receipt: CatalogOperation | null;
    try {
        receipt = await readReceipt();
    } catch {
        // A failed read does not prove whether the original mutation was accepted.
        throw originalError;
    }
    if (receipt) {
        if (receipt.state === "Rejected")
            onRejectedReceipt?.(originalError, receipt);
        return receipt;
    }
    onMissingReceipt?.();
    throw originalError;
}

export function catalogWorkflowOutcome({
    actionKind,
    receipt,
    freshSignedCard,
    signedBeforeAction = false,
    pendingRequest,
    actionFailed,
}: {
    actionKind?: "Moderate" | "Sign";
    receipt?: CatalogOperation | null;
    freshSignedCard: boolean;
    signedBeforeAction?: boolean;
    pendingRequest: boolean;
    actionFailed: boolean;
}) {
    const signAccepted =
        receipt?.operation === "Sign" && receipt.state === "Accepted";
    const publicationConfirmed =
        actionKind === "Sign" &&
        (signAccepted || (freshSignedCard && !signedBeforeAction));
    const rejected = receipt?.state === "Rejected";
    const uncertain =
        pendingRequest &&
        !publicationConfirmed &&
        (actionFailed ||
            Boolean(
                receipt &&
                ["Sending", "Unknown", "Processing"].includes(receipt.state),
            ));
    return {
        signAccepted,
        publicationConfirmed,
        uncertain,
        showActionError:
            actionFailed && (rejected || (!publicationConfirmed && !uncertain)),
    };
}
