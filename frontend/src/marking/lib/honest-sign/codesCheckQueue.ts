export const CODES_CHECK_REQUEST_INTERVAL_MS = 2_100;

export function abortCodesCheck(signal?: AbortSignal): void {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}

export function waitForCodesCheck(
    milliseconds: number,
    signal?: AbortSignal,
): Promise<void> {
    abortCodesCheck(signal);
    return new Promise((resolve, reject) => {
        const abort = () => {
            globalThis.clearTimeout(timer);
            reject(new DOMException("Aborted", "AbortError"));
        };
        const timer = globalThis.setTimeout(() => {
            signal?.removeEventListener("abort", abort);
            resolve();
        }, milliseconds);
        signal?.addEventListener("abort", abort, { once: true });
    });
}

/** One queue for all files, chunks and consumers in this WebView. Failed checks also consume a rate-limit window. */
export function createCodesCheckQueue(
    clock = {
        now: () => Date.now(),
        wait: waitForCodesCheck,
    },
) {
    let tail = Promise.resolve();
    let availableAt = 0;
    return {
        run<T>(action: () => Promise<T>, signal?: AbortSignal): Promise<T> {
            abortCodesCheck(signal);
            const execute = async () => {
                abortCodesCheck(signal);
                const gap = availableAt - clock.now();
                if (gap > 0) await clock.wait(gap, signal);
                abortCodesCheck(signal);
                try {
                    return await action();
                } finally {
                    availableAt = clock.now() + CODES_CHECK_REQUEST_INTERVAL_MS;
                }
            };
            const turn = tail.then(execute);
            tail = turn.then(
                () => undefined,
                () => undefined,
            );
            return new Promise<T>((resolve, reject) => {
                const abort = () =>
                    reject(new DOMException("Aborted", "AbortError"));
                signal?.addEventListener("abort", abort, { once: true });
                if (signal?.aborted) abort();
                turn.then(resolve, reject).finally(() =>
                    signal?.removeEventListener("abort", abort),
                );
            });
        },
    };
}
