export type DmKodEnvironment = "TEST" | "PROD";
export type DmKodScope = Readonly<{
    companyId: string;
    actorId: string;
    environment: DmKodEnvironment;
}>;

export function dmKodActorKey(
    user: {
        id: string;
        impersonatedByUserId?: string;
        isImpersonated?: boolean;
    } | null,
) {
    return user
        ? JSON.stringify([
              user.impersonatedByUserId || user.id,
              user.id,
              user.isImpersonated === true,
          ])
        : "";
}

export function dmKodEnvironment(
    value: string | null | undefined,
): DmKodEnvironment {
    return value === "TEST" ? "TEST" : "PROD";
}

export function createDmKodScope(
    companyId: string,
    actorId: string,
    environment: DmKodEnvironment,
): DmKodScope {
    return Object.freeze({ companyId, actorId, environment });
}

export function dmKodScopeKey(scope: DmKodScope) {
    return JSON.stringify([scope.actorId, scope.companyId, scope.environment]);
}

export function dmKodScopeQueryKey(scope: DmKodScope) {
    return [
        "dmkod",
        scope.actorId,
        scope.companyId,
        scope.environment,
    ] as const;
}

export function dmKodScopeStorageKey(
    scope: DmKodScope,
    operation: "orders" | "utilisation" | "reports",
) {
    return `dmkod.${operation}.${dmKodScopeKey(scope)}`;
}

export function dmKodScopeHeaders(scope: DmKodScope) {
    if (
        !scope.companyId ||
        !scope.actorId ||
        !["TEST", "PROD"].includes(scope.environment)
    )
        throw new Error("Invalid DMkod scope");
    return {
        "X-Company-Id": scope.companyId,
        "X-DmKod-Environment": scope.environment,
    };
}

export type DmKodOrderReceipt = {
    clientRequestId: string;
    backgroundTaskId: string | null;
};
export function readDmKodOrderReceipt(
    raw: string | null,
): DmKodOrderReceipt | null {
    try {
        const item = JSON.parse(raw ?? "null") as DmKodOrderReceipt | null;
        const uuid =
            /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
        return item &&
            uuid.test(item.clientRequestId) &&
            (item.backgroundTaskId === null || uuid.test(item.backgroundTaskId))
            ? {
                  clientRequestId: item.clientRequestId,
                  backgroundTaskId: item.backgroundTaskId,
              }
            : null;
    } catch {
        return null;
    }
}
