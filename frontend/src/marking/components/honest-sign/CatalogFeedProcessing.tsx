import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { CatalogErrorDetails } from "@marking/components/honest-sign/CatalogErrorDetails";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { catalogFeedPollInterval } from "@marking/hooks/use-honest-sign-catalog";
import { catalogFeedMessageLines } from "@marking/lib/honest-sign/catalogFeedMessages";
import { isCatalogFeedProcessing } from "@marking/lib/honest-sign/catalogForm";

import type { CatalogFeedMessage, CatalogFeedStatus } from "@marking/lib/honest-sign/catalogTypes";

function CatalogFeedDates({ data }: { data: CatalogFeedStatus }) {
    const { t, i18n } = useTranslation();
    const receivedAt = data.receivedAtUtc;
    const updatedAt = data.updatedAtUtc;
    if (!receivedAt && !updatedAt) return null;
    return (
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
            {receivedAt && (
                <><dt>{t("honestSign.catalog.feedDetails.receivedAt")}</dt><dd><time dateTime={receivedAt}>{new Date(receivedAt).toLocaleString(i18n.language)}</time></dd></>
            )}
            {updatedAt && (
                <><dt>{t("honestSign.catalog.attempts.providerUpdated")}</dt><dd><time dateTime={updatedAt}>{new Date(updatedAt).toLocaleString(i18n.language)}</time></dd></>
            )}
        </dl>
    );
}

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
    data,
    error,
    cardLookup,
}: {
    data: CatalogFeedStatus | undefined;
    error: Error | null;
    cardLookup?: ReactNode;
}) {
    const { t } = useTranslation();
    const previousFeed = data?.submissionState === "Draft" && Boolean(data.status || data.errors.length || data.messages?.length);
    const heading = t(previousFeed
        ? "honestSign.catalog.workflow.previousFeedProcessing"
        : "honestSign.catalog.processing");
    const pending = isCatalogFeedProcessing(data);
    const rejected = data && !pending && (
        data.status === "Rejected" ||
        data.submissionState === "Rejected" ||
        (previousFeed && data.errors.length > 0)
    );
    const status = rejected ? "Rejected" : data?.status;
    let notice: string | undefined;
    if (rejected) notice = data.errors.length ? undefined : "noRejectionReason";
    else if (data?.submissionState === "Draft") notice = "savedDraftNotice";
    else if (data?.submissionState === "Unknown") notice = "unknownNotice";
    else if (status === "Moderated") notice = "moderatedNotice";
    else if (status === "Signed") notice = "signedNotice";
    else if (pending && data?.feedId) notice = "acceptedNotice";

    return (
        <section className="space-y-3" aria-label={heading} aria-live="polite">
            <h4 className="font-semibold">{heading}</h4>
            {error && (
                <Notice variant="warning" role="status">
                    <p>{t(data
                        ? "honestSign.catalog.workflow.feedRefreshPending"
                        : "honestSign.catalog.workflow.feedResultPending")}</p>
                    <p>{error.message}</p>
                    {catalogFeedPollInterval(data, error) && (
                        <p>{t("honestSign.catalog.workflow.feedRetryScheduled")}</p>
                    )}
                    <CatalogErrorDetails error={error} />
                </Notice>
            )}
            {!data && !error && (
                <Notice role="status">
                    {t("honestSign.catalog.workflow.checkingSubmission")}
                </Notice>
            )}
            {data && (
                <>
                    <Notice variant={rejected ? "error" : "info"}>
                        <p className="font-medium">
                            {status
                                ? t(`honestSign.catalog.feedStates.${status}`)
                                : t(`honestSign.catalog.deliveryStates.${data.submissionState}`)}
                        </p>
                        {data.feedId && (
                            <p>{t("honestSign.catalog.feedId")}: <span className="font-mono">{data.feedId}</span></p>
                        )}
                        {notice && <p className="mt-1">{t(`honestSign.catalog.${notice}`)}</p>}
                    </Notice>
                    <CatalogFeedDates data={data} />
                    <CatalogFeedMessages data={data} />
                    {cardLookup}
                    <CatalogErrorDetails diagnostics={data} />
                </>
            )}
        </section>
    );
}
