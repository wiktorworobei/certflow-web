import { expect, test } from "./test-compat";
import {
    CODES_CHECK_REQUEST_INTERVAL_MS,
    createCodesCheckQueue,
} from "../src/marking/lib/honest-sign/codesCheckQueue";

function deferred() {
    let resolve!: () => void;
    const promise = new Promise<void>((complete) => {
        resolve = complete;
    });
    return { promise, resolve };
}

function fakeClock() {
    let time = 0;
    const waits: number[] = [];
    return {
        waits,
        advance: (milliseconds: number) => {
            time += milliseconds;
        },
        now: () => time,
        wait: async (milliseconds: number) => {
            waits.push(milliseconds);
            time += milliseconds;
        },
    };
}

test("separately invoked checks serialize and pace from the previous completion", async () => {
    const clock = fakeClock();
    const queue = createCodesCheckQueue(clock);
    const firstStarted = deferred();
    const finishFirst = deferred();
    const events: { event: string; time: number }[] = [];
    const first = queue.run(async () => {
        events.push({ event: "first started", time: clock.now() });
        firstStarted.resolve();
        await finishFirst.promise;
        events.push({ event: "first completed", time: clock.now() });
        return "first";
    });
    const second = queue.run(async () => {
        events.push({ event: "second started", time: clock.now() });
        return "second";
    });

    await firstStarted.promise;
    expect(events).toEqual([{ event: "first started", time: 0 }]);
    expect(clock.waits).toEqual([]);
    clock.advance(750);
    finishFirst.resolve();

    expect(await Promise.all([first, second])).toEqual(["first", "second"]);
    expect(events).toEqual([
        { event: "first started", time: 0 },
        { event: "first completed", time: 750 },
        {
            event: "second started",
            time: 750 + CODES_CHECK_REQUEST_INTERVAL_MS,
        },
    ]);
    expect(clock.waits).toEqual([CODES_CHECK_REQUEST_INTERVAL_MS]);
});

test("a failed check still consumes its rate limit window and releases the queue", async () => {
    const clock = fakeClock();
    const queue = createCodesCheckQueue(clock);
    const failed = queue.run(async () => {
        clock.advance(400);
        throw new Error("Synthetic provider failure");
    });
    const rejected = expect(failed).rejects.toThrow(
        "Synthetic provider failure",
    );
    const next = queue.run(async () => clock.now());

    await rejected;
    expect(await next).toBe(400 + CODES_CHECK_REQUEST_INTERVAL_MS);
    expect(clock.waits).toEqual([CODES_CHECK_REQUEST_INTERVAL_MS]);
});

test("queued cancellation rejects before the running check finishes and cannot poison the next check", async () => {
    const clock = fakeClock();
    const queue = createCodesCheckQueue(clock);
    const firstStarted = deferred();
    const finishFirst = deferred();
    let firstCompleted = false;
    let cancelledActionCalls = 0;
    const first = queue.run(async () => {
        firstStarted.resolve();
        await finishFirst.promise;
        firstCompleted = true;
    });
    await firstStarted.promise;
    const controller = new AbortController();
    const cancelled = queue.run(async () => {
        cancelledActionCalls++;
    }, controller.signal);
    const rejected = cancelled.catch((error: unknown) => error);

    controller.abort();
    expect(await rejected).toMatchObject({ name: "AbortError" });
    expect(firstCompleted).toBe(false);
    expect(cancelledActionCalls).toBe(0);
    const next = queue.run(async () => clock.now());
    clock.advance(200);
    finishFirst.resolve();

    await first;
    expect(await next).toBe(200 + CODES_CHECK_REQUEST_INTERVAL_MS);
    expect(cancelledActionCalls).toBe(0);
    expect(clock.waits).toEqual([CODES_CHECK_REQUEST_INTERVAL_MS]);
});
