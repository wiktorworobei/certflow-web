import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Button } from "@marking/components/ui/button";
import { catalogApiService } from "@marking/lib/honest-sign/catalogApiService";
import { isValidCatalogGtin } from "@marking/lib/honest-sign/catalogForm";
import { getHttpErrorCode, getHttpErrorDiagnostics, getHttpErrorStatus } from "@marking/lib/honest-sign/httpClient";
import { assertMarkingScope, captureMarkingScope } from "@marking/lib/workspace-scope";
import { useAuthStore } from "@marking/src/store/auth";

export function useCatalogGtinLookup({
    companyId,
    gtin,
    submissionId,
    enabled = true,
    automatic = false,
}: {
    companyId: string;
    gtin: string;
    submissionId?: string;
    enabled?: boolean;
    automatic?: boolean;
}) {
    const client = useQueryClient();
    const authVersion = useAuthStore((state) => state.version);
    const { crpt } = captureMarkingScope();
    const value = gtin.trim();
    const canCheck = enabled && Boolean(companyId) && isValidCatalogGtin(value);
    const queryKey = useMemo(() => [
        "catalog-gtin-check", companyId, crpt.environment, crpt.epoch, authVersion, submissionId, canCheck ? value : null,
    ], [companyId, crpt.environment, crpt.epoch, authVersion, submissionId, canCheck, value]);
    const query = useQuery({
        queryKey,
        queryFn: async ({ signal }) => {
            const scope = captureMarkingScope();
            const result = await catalogApiService.checkGtin(companyId, value, submissionId, signal);
            assertMarkingScope(scope);
            return result;
        },
        enabled: false,
        retry: false,
        gcTime: 0,
    });
    const refetch = query.refetch;
    const check = useCallback(() => {
        if (canCheck) void refetch({ cancelRefetch: false });
    }, [canCheck, refetch]);

    useEffect(() => {
        if (!automatic || !canCheck) return;
        const timer = window.setTimeout(() => {
            const state = client.getQueryState(queryKey);
            if (state?.status === "pending" && state.fetchStatus === "idle") check();
        }, 450);
        return () => window.clearTimeout(timer);
    }, [automatic, canCheck, check, client, queryKey]);

    return {
        result: canCheck ? query.data : undefined,
        error: canCheck ? query.error : null,
        canCheck,
        isFetching: canCheck && query.isFetching,
        isWaiting: automatic && canCheck && !query.data && !query.error,
        check,
    };
}

export function CatalogGtinCheck({
    lookup,
    presentation = "gtin",
    gtinLabel,
    confirmedDuplicate = false,
}: {
    lookup: ReturnType<typeof useCatalogGtinLookup>;
    presentation?: "gtin" | "card";
    gtinLabel?: string;
    confirmedDuplicate?: boolean;
}) {
    const { t } = useTranslation();
    const { result, error } = lookup;
    const label = "honestSign.catalog.gtinCheck";
    const cardLookup = presentation === "card";
    const status = error ? getHttpErrorStatus(error) : null;
    const upstream = error ? getHttpErrorDiagnostics(error).upstreamStatus : null;
    const errorCode = error ? getHttpErrorCode(error) : null;
    const errorText = errorCode === "error.honest_sign_session_required" || errorCode === "error.honest_sign_session_expired"
        ? "connect"
        : status === 403 || upstream === 403 ? "inaccessible" : cardLookup ? "cardFailed" : "failed";
    const buttonText = lookup.isFetching
        ? cardLookup ? "cardChecking" : "checking"
        : cardLookup ? gtinLabel ? "cardActionForGtin" : "cardAction" : "action";

    return (
        <div className="space-y-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={!lookup.canCheck || lookup.isFetching}
                onClick={lookup.check}
            >
                {t(`${label}.${buttonText}`, { gtin: gtinLabel })}
            </Button>
            {error && (
                <Notice variant="error" role="alert">
                    {t(`${label}.${errorText}`)}
                </Notice>
            )}
            {result && (
                <Notice variant={result.state === "Invalid" || confirmedDuplicate ? "error" : "info"} role="status">
                    {!confirmedDuplicate && t(`${label}.${cardLookup && result.state !== "Invalid" ? `card${result.state}` : result.state}`, { gtin: result.gtin })}
                    {!!result.cards?.length && (
                        <ul className="mt-1 list-inside list-disc">
                            {result.cards.map(({ name, status }) => (
                                <li key={JSON.stringify([name, status])}>
                                    {[name, t(`honestSign.catalog.workflow.cardStates.${status.toLowerCase()}`, {
                                        defaultValue: t("honestSign.catalog.workflow.cardStates.unknown"),
                                    })].filter(Boolean).join(" · ")}
                                </li>
                            ))}
                        </ul>
                    )}
                    {!cardLookup && result.localState && (
                        <p className="mt-1">{t(`${label}.${result.localState}`)}</p>
                    )}
                </Notice>
            )}
        </div>
    );
}
