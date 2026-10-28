import { dmKodActorKey, dmKodScopeHeaders } from "@marking/lib/dmkod-scope";
import i18n from "@marking/src/i18n";
import { useAuthStore } from "@marking/src/store/auth";

import type { DmKodScope } from "@marking/lib/dmkod-scope";

declare module "axios" {
    interface AxiosRequestConfig {
        dmKodActorId?: string;
    }
}

export function dmKodRequestConfig(scope: DmKodScope) {
    if (dmKodActorKey(useAuthStore.getState().user) !== scope.actorId)
        throw new Error(i18n.t("dmkod.environment.actorChanged"));
    return { headers: dmKodScopeHeaders(scope), dmKodActorId: scope.actorId };
}
