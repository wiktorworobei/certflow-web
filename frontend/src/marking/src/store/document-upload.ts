import type { AuthUser } from "./auth";
export function documentUploadOwnerKey(user: AuthUser | null) {
    return user
        ? `${user.id}:${user.impersonatedByUserId ?? ""}:${user.isImpersonated === true}`
        : null;
}
