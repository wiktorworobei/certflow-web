import { expect, test } from "./test-compat";
import { catalogActionAvailability } from "../src/marking/lib/honest-sign/catalogWorkflowOutcome";

const idle = {
    busy: false,
    pendingRequest: false,
    fetching: false,
    dirty: false,
};

test.each([
    "draft",
    "errors",
    "moderation",
    "notsigned",
    "published",
    "archived",
    "new_provider_state",
])(
    "a %s card can reach the provider for a new action when the wire contract is ready",
    (status) => {
        for (const isSigned of [false, true])
            expect(
                catalogActionAvailability(
                    {
                        status,
                        isSigned,
                        canEdit: true,
                        canModerate: true,
                        canSign: true,
                    },
                    idle,
                ),
            ).toEqual({ canEdit: true, canModerate: true, canSign: true });
    },
);

test("a pending request cannot be bypassed by a published or signed card", () => {
    expect(
        catalogActionAvailability(
            {
                status: "published",
                isSigned: true,
                canEdit: true,
                canModerate: true,
                canSign: true,
            },
            { ...idle, pendingRequest: true },
        ),
    ).toEqual({ canEdit: false, canModerate: false, canSign: false });
});

test("wire readiness and in-flight work remain required without imposing a lifecycle rule", () => {
    const card = {
        status: "archived",
        isSigned: true,
        canEdit: false,
        canModerate: false,
        canSign: true,
    };
    expect(catalogActionAvailability(card, idle)).toEqual({
        canEdit: false,
        canModerate: false,
        canSign: true,
    });
    expect(catalogActionAvailability(card, { ...idle, busy: true })).toEqual({
        canEdit: false,
        canModerate: false,
        canSign: false,
    });
    expect(catalogActionAvailability(undefined, idle)).toEqual({
        canEdit: false,
        canModerate: false,
        canSign: false,
    });
});

test("unsaved changes and active refresh postpone external actions without making the form read-only", () => {
    const card = {
        status: "published",
        isSigned: true,
        canEdit: true,
        canModerate: true,
        canSign: true,
    };
    for (const state of [
        { ...idle, dirty: true },
        { ...idle, fetching: true },
    ])
        expect(catalogActionAvailability(card, state)).toEqual({
            canEdit: true,
            canModerate: false,
            canSign: false,
        });
});
