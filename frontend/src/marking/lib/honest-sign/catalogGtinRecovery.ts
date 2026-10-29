type RecoveryStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function catalogGtinActorKey(
    user: {
        id: string;
        isImpersonated?: boolean;
        impersonatedByUserId?: string;
    } | null,
) {
    return user
        ? JSON.stringify([
              user.id,
              Boolean(user.isImpersonated),
              user.impersonatedByUserId ?? "",
          ])
        : "";
}
export function catalogGtinRecoveryKey(actor: string, companyId: string) {
    return `deltamatrix:honest-sign:gtin-pending:${encodeURIComponent(actor)}:${encodeURIComponent(companyId)}`;
}
export function readCatalogGtinRecovery(
    storage: RecoveryStorage | null,
    actor: string,
    companyId: string,
) {
    if (!storage || !actor || !companyId)
        return { requestId: null, blocked: true };
    try {
        const requestId = storage.getItem(
            catalogGtinRecoveryKey(actor, companyId),
        );
        return !requestId || uuid.test(requestId)
            ? { requestId, blocked: false }
            : { requestId: null, blocked: true };
    } catch {
        return { requestId: null, blocked: true };
    }
}
export function writeCatalogGtinRecovery(
    storage: RecoveryStorage | null,
    actor: string,
    companyId: string,
    requestId: string | null,
) {
    if (
        !storage ||
        !actor ||
        !companyId ||
        (requestId !== null && !uuid.test(requestId))
    )
        return false;
    try {
        const key = catalogGtinRecoveryKey(actor, companyId);
        if (requestId) storage.setItem(key, requestId);
        else storage.removeItem(key);
        return storage.getItem(key) === requestId;
    } catch {
        return false;
    }
}
export function catalogGtinRecoveryStorage() {
    try {
        return sessionStorage;
    } catch {
        return null;
    }
}
