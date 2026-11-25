import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogErrorDetails } from "@marking/components/honest-sign/CatalogErrorDetails";
import { CatalogFeedCardLookup } from "@marking/components/honest-sign/CatalogFeedCardLookup";
import { CatalogFeedMessages } from "@marking/components/honest-sign/CatalogFeedProcessing";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Skeleton } from "@marking/components/ui/skeleton";
import { useCatalogSubmissionAttempts } from "@marking/hooks/use-honest-sign-catalog";

export function CatalogSubmissionAttempts({
    companyId,
    submissionId,
    currentLookupFeedId,
}: {
    companyId: string;
    submissionId: string;
    currentLookupFeedId?: string;
}) {
    const { t, i18n } = useTranslation();
    const [page, setPage] = useState(1);
    const attempts = useCatalogSubmissionAttempts(companyId, submissionId, page);
    const title = t("honestSign.catalog.attempts.title");
    const items = attempts.data?.items ?? [];

    return (
        <section className="space-y-3 border-t pt-4" aria-label={title}>
            <h4 className="font-semibold">{title}</h4>
            {attempts.isError && (
                <Notice variant="error" role="alert">
                    <p>{attempts.error.message}</p>
                    <CatalogErrorDetails error={attempts.error} />
                </Notice>
            )}
            {attempts.isPending && <Skeleton className="h-16 w-full" />}
            {attempts.isSuccess && !items.length && (
                <p className="text-sm text-muted-foreground">
                    {t("honestSign.catalog.attempts.empty")}
                </p>
            )}
            {items.length > 0 && (
                <ul className="space-y-2">
                    {items.map((attempt) => {
                        const rejected = attempt.state === "Rejected";
                        const feedState = rejected ? "Rejected" : attempt.state === "Unknown" ? undefined : attempt.feedStatus?.status;
                        const providerUpdatedAt = attempt.feedId ? attempt.feedStatus?.updatedAtUtc : null;
                        const updatedAt = providerUpdatedAt ?? attempt.updatedAtUtc;
                        let stateLabel = `deliveryStates.${attempt.state}`;
                        if (attempt.state === "Reconciled") stateLabel = "workflow.operationStates.Reconciled";
                        else if (feedState) stateLabel = `feedStates.${feedState}`;
                        else if (attempt.operation === "Update") stateLabel = `workflow.operationStates.${attempt.state}`;
                        else if (attempt.state === "Processing") stateLabel = "feedStates.Processing";
                        return (
                            <li key={attempt.id} className="rounded-md border px-3 py-2 text-sm">
                                <details>
                                    <summary className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                        <span className="ml-2 inline-flex flex-wrap items-center gap-x-3 gap-y-1">
                                            <time dateTime={attempt.createdAtUtc}>
                                                {new Date(attempt.createdAtUtc).toLocaleString(i18n.language)}
                                            </time>
                                            <span>{t(`honestSign.catalog.attempts.${attempt.operation}`)}</span>
                                            {attempt.gtin && <span className="font-mono">{attempt.gtin}</span>}
                                            <Badge variant={rejected ? "destructive" : "outline"}>
                                                {t(`honestSign.catalog.${stateLabel}`)}
                                            </Badge>
                                        </span>
                                    </summary>
                                    <div className="space-y-3 pt-3">
                                        <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
                                            <dt>{t("honestSign.catalog.attempts.requestId")}</dt>
                                            <dd className="break-all font-mono">{attempt.requestId}</dd>
                                            {attempt.feedId && (
                                                <>
                                                    <dt>{t("honestSign.catalog.feedId")}</dt>
                                                    <dd className="break-all font-mono">{attempt.feedId}</dd>
                                                </>
                                            )}
                                            {updatedAt && (
                                                <>
                                                    <dt>{t(providerUpdatedAt
                                                        ? "honestSign.catalog.attempts.providerUpdated"
                                                        : "honestSign.catalog.attempts.updated")}</dt>
                                                    <dd>
                                                        <time dateTime={updatedAt}>
                                                            {new Date(updatedAt).toLocaleString(i18n.language)}
                                                        </time>
                                                    </dd>
                                                </>
                                            )}
                                        </dl>
                                        {attempt.feedStatus && <CatalogErrorDetails diagnostics={attempt.feedStatus} />}
                                    </div>
                                </details>
                                {attempt.feedStatus && (
                                    <div className="mt-2 space-y-2">
                                        <CatalogFeedMessages data={attempt.feedStatus} compact />
                                        {attempt.feedId !== currentLookupFeedId && (
                                            <CatalogFeedCardLookup companyId={companyId} submissionId={submissionId} gtin={attempt.gtin} data={attempt.feedStatus} />
                                        )}
                                    </div>
                                )}
                                {rejected && !attempt.feedStatus?.errors.length && (
                                    <p className="mt-2 text-muted-foreground">{t("honestSign.catalog.noRejectionReason")}</p>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
            {(page > 1 || attempts.data?.hasNextPage) && (
                <div className="flex items-center justify-end gap-3">
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={page === 1 || attempts.isFetching}
                        onClick={() => setPage(page - 1)}
                    >
                        {t("honestSign.catalog.previous")}
                    </Button>
                    <span className="text-sm text-muted-foreground">
                        {t("honestSign.catalog.page", { page })}
                    </span>
                    <Button
                        size="sm"
                        variant="outline"
                        disabled={!attempts.data?.hasNextPage || attempts.isFetching}
                        onClick={() => setPage(page + 1)}
                    >
                        {t("honestSign.catalog.next")}
                    </Button>
                </div>
            )}
        </section>
    );
}
