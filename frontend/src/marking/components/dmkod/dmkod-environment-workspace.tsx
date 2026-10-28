import { useIsMutating } from "@tanstack/react-query";
import { Info } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    DmKodScopeContext,
    useDmKodScope,
} from "@marking/components/dmkod/dmkod-scope-context";
import { DmKodWorkspace } from "@marking/components/dmkod/dmkod-workspace";
import { IntegrationSurface } from "@marking/components/integration-surface";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Label } from "@marking/components/ui/label";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@marking/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@marking/components/ui/select";
import {
    createDmKodScope,
    dmKodScopeKey,
    dmKodActorKey,
} from "@marking/lib/dmkod-scope";
import { useAuthStore } from "@marking/src/store/auth";

import type { DmKodEnvironment } from "@marking/lib/dmkod-scope";
import type { ReactNode } from "react";

export function DmKodEnvironmentWorkspace({
    companyId,
    environment,
    onEnvironmentChange,
    children,
}: {
    companyId: string;
    environment: DmKodEnvironment;
    onEnvironmentChange: (environment: DmKodEnvironment) => void;
    children?: ReactNode;
}) {
    const { t } = useTranslation();
    const user = useAuthStore((state) => state.user);
    const actorId = dmKodActorKey(user);
    const [activeEnvironment, setActiveEnvironment] = useState(environment);
    const [localOperations, setLocalOperations] = useState(0);
    const scope = useMemo(
        () => createDmKodScope(companyId, actorId, activeEnvironment),
        [companyId, actorId, activeEnvironment],
    );
    const scopeKey = dmKodScopeKey(scope);
    const mutations = useIsMutating({
        predicate: (mutation) =>
            mutation.options.meta?.dmKodScopeKey === scopeKey,
    });
    const busy = localOperations > 0 || mutations > 0;
    const holdLocalOperation = useCallback(() => {
        setLocalOperations((count) => count + 1);
        let released = false;
        return () => {
            if (!released) {
                released = true;
                setLocalOperations((count) => Math.max(0, count - 1));
            }
        };
    }, []);
    useEffect(() => {
        if (!busy) setActiveEnvironment(environment);
    }, [busy, environment]);
    useEffect(() => {
        if (!busy) return;
        const protect = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", protect);
        return () => window.removeEventListener("beforeunload", protect);
    }, [busy]);
    const context = useMemo(
        () => ({ scope, holdLocalOperation, busy }),
        [scope, holdLocalOperation, busy],
    );
    return (
        <IntegrationSurface integration="dmkod">
            <section
                className="mx-auto w-full max-w-7xl px-3 pt-3 md:px-6"
                aria-label={t("dmkod.environment.label")}
            >
                <div className="flex flex-wrap items-center gap-2 border-b pb-2">
                    <Label
                        htmlFor="dmkod-environment"
                        className="text-xs text-muted-foreground"
                    >
                        {t("dmkod.environment.shortLabel")}
                    </Label>
                    <Badge
                        variant={
                            activeEnvironment === "TEST"
                                ? "outline"
                                : "secondary"
                        }
                    >
                        {activeEnvironment}
                    </Badge>
                    <div className="ml-auto w-40 sm:w-48">
                        <Select
                            value={activeEnvironment}
                            disabled={busy}
                            onValueChange={(value) => {
                                if (!busy)
                                    onEnvironmentChange(
                                        value as DmKodEnvironment,
                                    );
                            }}
                        >
                            <SelectTrigger
                                id="dmkod-environment"
                                className="h-8 w-full text-xs"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent className="integration-theme dmkod-theme">
                                <SelectItem value="PROD">
                                    {t("dmkod.environment.prod")}
                                </SelectItem>
                                <SelectItem value="TEST">
                                    {t("dmkod.environment.test")}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8"
                                aria-label={t("dmkod.environment.info")}
                            >
                                <Info className="size-4" aria-hidden="true" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="end"
                            className="integration-theme dmkod-theme max-w-[calc(100vw-2rem)] space-y-2 text-sm"
                        >
                            <p>
                                {t(
                                    activeEnvironment === "TEST"
                                        ? "dmkod.environment.testDescription"
                                        : "dmkod.environment.prodDescription",
                                )}
                            </p>
                            <p className="text-muted-foreground">
                                {t("dmkod.environment.separate")}
                            </p>
                        </PopoverContent>
                    </Popover>
                    {busy ? (
                        <p
                            role="status"
                            className="w-full text-xs text-muted-foreground"
                        >
                            {t("dmkod.environment.busy")}
                        </p>
                    ) : null}
                </div>
            </section>
            <DmKodScopeContext.Provider key={scopeKey} value={context}>
                {children ?? <DmKodWorkspace companyId={companyId} />}
            </DmKodScopeContext.Provider>
        </IntegrationSurface>
    );
}

export function DmKodEnvironmentTarget({ companyId }: { companyId: string }) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    return (
        <p className="flex items-center gap-2 text-sm font-medium">
            <Badge
                variant={scope.environment === "TEST" ? "outline" : "secondary"}
            >
                {scope.environment}
            </Badge>
            {t("dmkod.environment.target", { environment: scope.environment })}
        </p>
    );
}
