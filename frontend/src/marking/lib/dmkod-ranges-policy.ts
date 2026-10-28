import type {
    DmKodActivityRangeState,
    DmKodPositionRange,
} from "@marking/lib/dmkod-extended-types";

/** Exact received positions are 1-based and inclusive; unknown legacy positions are never assumed free. */
export function dmKodFreeRanges(
    received: number | null | undefined,
    states: DmKodActivityRangeState[],
): DmKodPositionRange[] | null {
    if (!Number.isSafeInteger(received) || received == null || received < 0)
        return null;
    const occupied: DmKodPositionRange[] = [];
    for (const state of states) {
        if (
            (state.total == null || state.total > 0) &&
            state.ranges.length === 0
        )
            return null;
        for (const range of state.ranges) {
            if (
                !Number.isSafeInteger(range.start) ||
                !Number.isSafeInteger(range.end) ||
                range.start < 1 ||
                range.end < range.start ||
                range.end > received
            )
                return null;
            occupied.push(range);
        }
    }
    occupied.sort((a, b) => a.start - b.start);
    const free: DmKodPositionRange[] = [];
    let next = 1;
    for (const range of occupied) {
        if (range.start > next)
            free.push({ start: next, end: range.start - 1 });
        next = Math.max(next, range.end + 1);
    }
    if (next <= received) free.push({ start: next, end: received });
    return free;
}

export function allocateDmKodRanges(
    free: DmKodPositionRange[],
    quantity: number,
    tag?: string,
): DmKodPositionRange[] | null {
    if (
        !Number.isSafeInteger(quantity) ||
        quantity <= 0 ||
        (tag && !validDmKodRangeTag(tag))
    )
        return null;
    const allocated: DmKodPositionRange[] = [];
    let remaining = quantity;
    for (const range of free) {
        if (
            !Number.isSafeInteger(range.start) ||
            !Number.isSafeInteger(range.end) ||
            range.start < 1 ||
            range.end < range.start
        )
            return null;
        const count = Math.min(remaining, range.end - range.start + 1);
        if (count > 0)
            allocated.push({
                start: range.start,
                end: range.start + count - 1,
                ...(tag ? { tag } : {}),
            });
        remaining -= count;
        if (remaining === 0) return allocated;
    }
    return null;
}

export type DmKodRangeIntent = {
    requestId: string;
    orderId: number;
    itemId: number;
    taskId: string | null;
};
export function readDmKodRangeIntent(
    raw: string | null,
    orderId: number,
): DmKodRangeIntent | null {
    try {
        const value = JSON.parse(raw ?? "null") as DmKodRangeIntent | null;
        const uuid =
            /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
        if (
            !value ||
            !uuid.test(value.requestId) ||
            value.orderId !== orderId ||
            !Number.isSafeInteger(value.itemId) ||
            value.itemId <= 0 ||
            (value.taskId !== null && !uuid.test(value.taskId))
        )
            return null;
        return {
            requestId: value.requestId,
            orderId,
            itemId: value.itemId,
            taskId: value.taskId,
        };
    } catch {
        return null;
    }
}

export function validDmKodRangeTag(value: string) {
    return (
        value.length <= 256 &&
        !Array.from(value).some(
            (character) =>
                character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
        )
    );
}
