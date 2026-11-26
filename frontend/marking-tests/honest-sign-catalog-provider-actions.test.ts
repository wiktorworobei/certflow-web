import { expect, test } from "./test-compat";
import { catalogActionAvailability, catalogProviderActions } from "../src/marking/lib/honest-sign/catalogWorkflowOutcome";

const idle = {
    busy: false,
    pendingRequest: false,
    fetching: false,
    dirty: false,
};
const noActions = { canEdit: false, canModerate: false, canSign: false };
const draftActions = { ...noActions, canEdit: true, canModerate: true };
const correctionActions = { ...noActions, canEdit: true };
const signingActions = { ...noActions, canSign: true };
const wireReady = { canEdit: true, canModerate: true, canSign: true };

test.each([
    ["draft", [], draftActions],
    ["draft", ["moderation"], noActions],
    ["draft", ["errors"], correctionActions],
    ["draft", ["notsigned"], signingActions],
    ["published", ["published", " NOTSIGNED "], signingActions],
    ["published", ["published", "moderation", "notsigned"], noActions],
    ["published", ["published", "errors"], correctionActions],
    ["published", [], noActions],
    ["archived", ["archived", "draft"], noActions],
    ["draft", ["new_provider_state"], noActions],
    ["unknown", [], noActions],
])(
    "card actions follow the detailed status before the technical status",
    (status, detailedStatuses, expected) => {
        expect(catalogProviderActions({ status, detailedStatuses })).toEqual(expected);
        const card = { ...wireReady, status, detailedStatuses, isSigned: true };
        expect(catalogActionAvailability(card, idle)).toEqual(expected);
    },
);

test("a pending request blocks otherwise eligible draft or signing actions", () => {
    for (const status of ["draft", "notsigned"]) {
        expect(catalogActionAvailability(
            { ...wireReady, status },
            { ...idle, pendingRequest: true },
        )).toEqual(noActions);
    }
});

test("eligible statuses still require backend authorization and an idle workflow", () => {
    const card = {
        status: "notsigned",
        canEdit: false,
        canModerate: false,
        canSign: true,
    };
    expect(catalogActionAvailability(card, idle)).toEqual(signingActions);
    expect(catalogActionAvailability({ ...card, canSign: false }, idle)).toEqual(noActions);
    expect(catalogActionAvailability(card, { ...idle, busy: true })).toEqual(noActions);
    expect(catalogActionAvailability(undefined, idle)).toEqual(noActions);
});

test("unsaved changes and active refresh postpone external actions without making the form read-only", () => {
    for (const state of [
        { ...idle, dirty: true },
        { ...idle, fetching: true },
    ]) {
        expect(catalogActionAvailability({ ...wireReady, status: "draft" }, state)).toEqual(correctionActions);
        expect(catalogActionAvailability({ ...wireReady, status: "notsigned" }, state)).toEqual(noActions);
    }
});
