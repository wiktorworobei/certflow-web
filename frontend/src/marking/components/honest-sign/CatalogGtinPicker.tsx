import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Button } from "@marking/components/ui/button";
import { catalogKeys } from "@marking/hooks/use-honest-sign-catalog";
import { catalogApiService } from "@marking/lib/honest-sign/catalogApiService";
import { isValidCatalogGtin } from "@marking/lib/honest-sign/catalogForm";
import {
    catalogGtinActorKey,
    catalogGtinRecoveryStorage,
    readCatalogGtinRecovery,
    writeCatalogGtinRecovery,
} from "@marking/lib/honest-sign/catalogGtinRecovery";
import { useAuthStore } from "@marking/src/store/auth";

import type { CatalogGtinReceipt } from "@marking/lib/honest-sign/catalogTypes";

export function CatalogGtinPicker({
    companyId,
    disabled,
    onSelected,
}: {
    companyId: string;
    disabled: boolean;
    onSelected: (gtin: string) => void;
}) {
    const { t } = useTranslation();
    const client = useQueryClient();
    const user = useAuthStore((state) => state.user);
    const actor = catalogGtinActorKey(user);
    const currentScope = useRef({ actor, companyId });
    currentScope.current = { actor, companyId };
    const receiptKey = [...catalogKeys.generatedGtins(companyId), actor];
    const [pending, setPending] = useState(() => ({
        actor,
        companyId,
        ...readCatalogGtinRecovery(
            catalogGtinRecoveryStorage(),
            actor,
            companyId,
        ),
    }));
    useEffect(() => {
        setPending({
            actor,
            companyId,
            ...readCatalogGtinRecovery(
                catalogGtinRecoveryStorage(),
                actor,
                companyId,
            ),
        });
    }, [actor, companyId]);
    const receipt = useQuery<CatalogGtinReceipt | null>({
        queryKey: receiptKey,
        queryFn: () => null,
        enabled: false,
    });
    const [showExisting, setShowExisting] = useState(false);
    const existing = useQuery({
        queryKey: [...receiptKey, "existing"],
        queryFn: () => catalogApiService.generatedGtins(),
        enabled: showExisting,
        retry: false,
        staleTime: 0,
    });
    const settle = (
        result: CatalogGtinReceipt,
        origin = { actor, companyId },
    ) => {
        client.setQueryData(
            [...catalogKeys.generatedGtins(origin.companyId), origin.actor],
            result,
        );
        if (["Accepted", "Rejected"].includes(result.state)) {
            const saved = writeCatalogGtinRecovery(
                catalogGtinRecoveryStorage(),
                origin.actor,
                origin.companyId,
                null,
            );
            if (
                catalogGtinActorKey(useAuthStore.getState().user) ===
                    origin.actor &&
                currentScope.current.actor === origin.actor &&
                currentScope.current.companyId === origin.companyId
            )
                setPending({
                    ...origin,
                    requestId: saved ? null : result.requestId,
                    blocked: !saved,
                });
        }
    };
    const generation = useMutation({
        retry: false,
        mutationFn: async () => {
            const origin = { actor, companyId };
            const previous =
                client.getQueryData<CatalogGtinReceipt>(receiptKey);
            const stored = readCatalogGtinRecovery(
                catalogGtinRecoveryStorage(),
                actor,
                companyId,
            );
            if (stored.blocked || stored.requestId)
                throw new Error(t("honestSign.catalog.gtinGenerationUnknown"));
            if (previous && ["Sending", "Unknown"].includes(previous.state))
                throw new Error(t("honestSign.catalog.gtinGenerationUnknown"));
            const requestId = crypto.randomUUID();
            if (
                !writeCatalogGtinRecovery(
                    catalogGtinRecoveryStorage(),
                    actor,
                    companyId,
                    requestId,
                )
            ) {
                setPending({ ...origin, requestId: null, blocked: true });
                throw new Error(
                    t("honestSign.catalog.gtinRecoveryStorageBlocked"),
                );
            }
            setPending({ ...origin, requestId, blocked: false });
            client.setQueryData(receiptKey, {
                requestId,
                state: "Sending",
                codes: [],
                createdAtUtc: new Date().toISOString(),
                replayed: false,
            } satisfies CatalogGtinReceipt);
            try {
                return {
                    result: await catalogApiService.generateGtins(requestId, 1),
                    origin,
                };
            } catch (error) {
                try {
                    const recovered =
                        await catalogApiService.gtinReceipt(requestId);
                    if (recovered) return { result: recovered, origin };
                } catch {
                    /* Keep the original write locked while receipt lookup is unavailable. */
                }
                client.setQueryData<CatalogGtinReceipt>(receiptKey, (pending) =>
                    pending ? { ...pending, state: "Unknown" } : pending,
                );
                throw error;
            }
        },
        onSuccess: ({ result, origin }) => settle(result, origin),
    });
    const check = useMutation({
        retry: false,
        mutationFn: async () => ({
            result: await catalogApiService.gtinReceipt(
                pending.requestId ?? receipt.data!.requestId,
            ),
            origin: { actor, companyId },
        }),
        onSuccess: ({ result, origin }) => {
            if (result) settle(result, origin);
        },
    });
    const checkReceipt = check.mutate;
    useEffect(() => {
        if (
            pending.actor === actor &&
            pending.companyId === companyId &&
            pending.requestId &&
            !generation.isPending
        )
            checkReceipt();
    }, [
        pending.actor,
        pending.companyId,
        pending.requestId,
        generation.isPending,
        actor,
        companyId,
        checkReceipt,
    ]);
    const uncertain = Boolean(
        (pending.actor === actor &&
            pending.companyId === companyId &&
            pending.requestId) ||
        (receipt.data && ["Sending", "Unknown"].includes(receipt.data.state)),
    );
    const codes = [
        ...new Set([
            ...(receipt.data?.codes ?? []),
            ...(showExisting ? (existing.data?.codes ?? []) : []),
        ]),
    ];
    const quota = showExisting ? existing.data : receipt.data;
    return (
        <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={
                        disabled ||
                        generation.isPending ||
                        uncertain ||
                        pending.blocked
                    }
                    onClick={() => generation.mutate()}
                >
                    {t("honestSign.catalog.generateGtin")}
                </Button>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={disabled || existing.isFetching}
                    onClick={() => {
                        setShowExisting(true);
                        if (showExisting) void existing.refetch();
                    }}
                >
                    {t("honestSign.catalog.loadGeneratedGtins")}
                </Button>
            </div>
            {pending.blocked && (
                <p role="alert" className="text-xs text-destructive">
                    {t("honestSign.catalog.gtinRecoveryStorageBlocked")}
                </p>
            )}
            {generation.isPending && (
                <p role="status" className="text-sm text-muted-foreground">
                    {t("honestSign.catalog.generatingGtin")}
                </p>
            )}
            {uncertain && (
                <Notice>
                    <p>{t("honestSign.catalog.gtinGenerationUnknown")}</p>
                    <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2"
                        disabled={
                            disabled || check.isPending || generation.isPending
                        }
                        onClick={() => check.mutate()}
                    >
                        {t("honestSign.catalog.workflow.checkReceipt")}
                    </Button>
                </Notice>
            )}
            {(generation.error || check.error || existing.error) && (
                <Notice variant="error" role="alert">
                    {
                        (generation.error ?? check.error ?? existing.error)
                            ?.message
                    }
                </Notice>
            )}
            {receipt.data?.state === "Rejected" && (
                <Notice variant="error">
                    {t("honestSign.catalog.gtinGenerationRejected")}
                </Notice>
            )}
            {showExisting &&
                !existing.isFetching &&
                existing.data?.codes.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                        {t("honestSign.catalog.noGeneratedGtins")}
                    </p>
                )}
            {quota?.monthlyLimit != null && quota.monthlyUsage != null && (
                <p className="text-xs text-muted-foreground">
                    {t("honestSign.catalog.gtinQuota", {
                        used: quota.monthlyUsage,
                        limit: quota.monthlyLimit,
                    })}
                </p>
            )}
            {codes.length > 0 && (
                <div
                    className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2"
                    aria-label={t("honestSign.catalog.generatedGtins")}
                >
                    {codes.map((gtin) => (
                        <div
                            key={gtin}
                            className="flex flex-wrap items-center justify-between gap-2"
                        >
                            <span className="font-mono text-sm">{gtin}</span>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={disabled || !isValidCatalogGtin(gtin)}
                                onClick={() => onSelected(gtin)}
                            >
                                {t("honestSign.catalog.useGtin")}
                            </Button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
