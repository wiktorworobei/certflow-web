export const SESSION_VALIDATION_INTERVAL_MS = 60_000;
export const SESSION_HEARTBEAT_INTERVAL_MS = 5 * 60_000;

export function shouldRunSessionHeartbeat(
    lastHeartbeatAtMs: number,
    nowMs = Date.now(),
): boolean {
    return (
        !lastHeartbeatAtMs ||
        nowMs - lastHeartbeatAtMs >= SESSION_HEARTBEAT_INTERVAL_MS
    );
}
