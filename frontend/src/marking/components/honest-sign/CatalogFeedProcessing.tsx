import { useTranslation } from "react-i18next";
import { CatalogFeedCardLookup } from "@marking/components/honest-sign/CatalogFeedCardLookup";
import { CatalogErrorDetails } from "@marking/components/honest-sign/CatalogErrorDetails";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Button } from "@marking/components/ui/button";
import { Skeleton } from "@marking/components/ui/skeleton";
import { useCatalogFeedStatus } from "@marking/hooks/use-honest-sign-catalog";

import { catalogFeedMessageLines } from "@marking/lib/honest-sign/catalogFeedMessages";
import type { CatalogFeedMessage, CatalogFeedStatus } from "@marking/lib/honest-sign/catalogTypes";

function CatalogFeedMessageList({ items, compact, title }: { items: CatalogFeedMessage[]; compact: boolean; title: string }) {
    const { t } = useTranslation();
    if (!items.length) return null;
    const affectedGtins = new Set(items.map((item) => item.gtin).filter(Boolean));
    return (
        <section className={compact ? "space-y-1 text-sm" : "space-y-2 text-sm"} aria-label={title}>
            <p className="font-medium">{title}</p>
            <ul className={compact ? "list-disc space-y-2 pl-4" : "space-y-2"}>
                {items.map((item, index) => {
                    const lines = catalogFeedMessageLines(item, t);
                    return (
                        <li key={index} className={compact ? "min-w-0 wrap-anywhere" : "min-w-0 wrap-anywhere rounded-md border p-3"}>
                            {affectedGtins.size > 1 && item.gtin && <p className="text-xs text-muted-foreground">GTIN {item.gtin}</p>}
                            {lines.map((line) => <p key={line} className="whitespace-pre-wrap">{line}</p>)}
                            {!lines.length && <p>{t("honestSign.catalog.noRejectionReason")}</p>}
                        </li>
                    );
                })}
            </ul>
        </section>
    );
}

export function CatalogFeedMessages({ data, compact = false }: { data: CatalogFeedStatus; compact?: boolean }) {
    const { t } = useTranslation();
    const rejected = data.status === "Rejected" || data.submissionState === "Rejected";
    return (
        <>
            <CatalogFeedMessageList items={data.errors} compact={compact} title={t(rejected
                ? "honestSign.catalog.rejectionReasons" : "honestSign.catalog.feedDetails.validationMessages")} />
            {data.messages && <CatalogFeedMessageList items={data.messages} compact={compact} title={t("honestSign.catalog.providerMessages")} />}
        </>
    );
}

export function CatalogFeedProcessing({
    companyId,
    submissionId,
    gtin,
}: {
    companyId: string;
    submissionId: string;
    gtin?: string | null;
}) {
    const { t } = useTranslation();
    const status = useCatalogFeedStatus(companyId, submissionId);
    const heading = t("honestSign.catalog.processing");
    return (
        <section
            className="space-y-3 border-t pt-5"
            aria-live="polite"
            aria-label={heading}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">{heading}</h3>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={status.isFetching}
                    onClick={() => void status.refetch()}
                >
                    {t("honestSign.catalog.refresh")}
                </Button>
            </div>
            {status.isPending ? (
                <Skeleton className="h-20 w-full" />
            ) : status.isError && !status.data ? (
                <Notice role="status">
                    {t("honestSign.catalog.workflow.feedResultPending")}
                </Notice>
            ) : (
                status.data && (
                    <>
                        {status.isError && (
                            <Notice role="status">
                                {t(
                                    "honestSign.catalog.workflow.feedRefreshPending",
                                )}
                            </Notice>
                        )}
                        <Notice
                            variant={
                                status.data.errors.length ||
                                status.data.status === "Rejected" ||
                                status.data.submissionState === "Rejected"
                                    ? "error"
                                    : "info"
                            }
                        >
                            <p className="font-medium">
                                {t("honestSign.catalog.feedId")}:{" "}
                                {status.data.feedId ?? "—"} ·{" "}
                                {t(
                                    status.data.status
                                        ? `honestSign.catalog.feedStates.${status.data.status}`
                                        : `honestSign.catalog.deliveryStates.${status.data.submissionState}`,
                                )}
                            </p>
                            <p className="mt-1">
                                {t(
                                    status.data.submissionState === "Rejected"
                                        ? "honestSign.catalog.rejectedNotice"
                                        : status.data.submissionState ===
                                            "Draft"
                                          ? "honestSign.catalog.savedDraftNotice"
                                          : !status.data.feedId
                                            ? "honestSign.catalog.unknownNotice"
                                            : status.data.status === "Moderated"
                                              ? "honestSign.catalog.moderatedNotice"
                                              : status.data.status === "Signed"
                                                ? "honestSign.catalog.signedNotice"
                                                : "honestSign.catalog.acceptedNotice",
                                )}
                            </p>
                        </Notice>
                        <CatalogErrorDetails diagnostics={status.data} />
                        <CatalogFeedMessages data={status.data} />
                        <CatalogFeedCardLookup companyId={companyId} submissionId={submissionId} gtin={gtin} data={status.data} />
                    </>
                )
            )}
        </section>
    );
}
