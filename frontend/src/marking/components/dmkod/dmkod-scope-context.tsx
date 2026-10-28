import { createContext, useContext } from "react";

import type { DmKodScope } from "@marking/lib/dmkod-scope";

export const DmKodScopeContext = createContext<{
    scope: DmKodScope;
    holdLocalOperation: () => () => void;
    busy?: boolean;
} | null>(null);

export function useDmKodScope(companyId: string) {
    const context = useContext(DmKodScopeContext);
    if (!context || context.scope.companyId !== companyId)
        throw new Error("DMkod workspace scope is required");
    return context.scope;
}

export function useDmKodBusy() {
    return useContext(DmKodScopeContext)?.busy ?? false;
}

export function useDmKodLocalOperation() {
    const context = useContext(DmKodScopeContext);
    if (!context) throw new Error("DMkod workspace scope is required");
    return context.holdLocalOperation;
}
