import { useTranslation } from "react-i18next";
import { CatalogErrorDetails } from "@marking/components/honest-sign/CatalogErrorDetails";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Button } from "@marking/components/ui/button";
import { Skeleton } from "@marking/components/ui/skeleton";
import { useCatalogFeedStatus } from "@marking/hooks/use-honest-sign-catalog";

import type { CatalogFeedMessage, CatalogFeedStatus } from "@marking/lib/honest-sign/catalogTypes";

export function CatalogFeedProviderStatus({ data }: { data: CatalogFeedStatus }) {
    const { t } = useTranslation();
    const status = data.providerStatus;
    const statusId = data.providerStatusId;
    const httpStatus = data.upstreamHttpStatus;
    const totalErrors = data.providerTotalErrors;
    if (!status && statusId == null && httpStatus == null && totalErrors == null) return null;
    return (
        <dl className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1 text-xs">
            {status && <><dt>{t("honestSign.catalog.feedDetails.providerStatus")}</dt><dd><code translate="no">{status}</code></dd></>}
            {statusId != null && <><dt>{t("honestSign.catalog.feedDetails.statusId")}</dt><dd><code>{statusId}</code></dd></>}
            {httpStatus != null && <><dt>{t("honestSign.catalog.feedDetails.httpStatus")}</dt><dd><code>HTTP {httpStatus}</code></dd></>}
            {totalErrors != null && <><dt>{t("honestSign.catalog.feedDetails.totalErrors")}</dt><dd><code>{totalErrors}</code></dd></>}
        </dl>
    );
}

function CatalogFeedMessageList({ items, compact, title }: { items: CatalogFeedMessage[]; compact: boolean; title: string }) {
    const { t } = useTranslation();
    if (!items.length) return null;
    return (
        <section className={compact ? "space-y-1 text-sm" : "space-y-2 text-sm"} aria-label={title}>
            <p className="font-medium">{title}</p>
            <ul className={compact ? "list-disc space-y-2 pl-4" : "space-y-2"}>
                {items.map((item, index) => {
                    const httpCode = /^HTTP_(\d{3})$/.exec(item.code ?? "")?.[1];
                    const facts = [
                        httpCode ? `HTTP ${httpCode}` : item.code && t("honestSign.catalog.feedDetails.messageCode", { code: item.code }),
                        item.gtin && `GTIN ${item.gtin}`,
                        item.attributeName,
                        item.attributeId != null && t("honestSign.catalog.attributeId", { id: item.attributeId }),
                        item.parameter && t("honestSign.catalog.feedDetails.parameter", { name: item.parameter }),
                        item.entryId != null && `entry ${item.entryId}`,
                        item.goodId != null && `good_id ${item.goodId}`,
                        item.source && t("honestSign.catalog.feedDetails.source", { source: item.source }),
                    ].filter(Boolean);
                    return (
                        <li key={index} className={compact ? "min-w-0 wrap-anywhere" : "min-w-0 wrap-anywhere rounded-md border p-3"}>
                            {item.reason === "DuplicateGtin" && (
                                <p className="font-semibold">{t("honestSign.catalog.feedDetails.duplicateGtin")}</p>
                            )}
                            {item.message && <p className="whitespace-pre-wrap" translate="no">{item.message}</p>}
                            {item.statusMessage && item.statusMessage !== item.message && (
                                <p className="whitespace-pre-wrap">
                                    <span className="font-medium">{t("honestSign.catalog.feedDetails.itemStatus")} · </span>
                                    <span translate="no">{item.statusMessage}</span>
                                </p>
                            )}
                            {!item.message && !item.statusMessage && <p>{t("honestSign.catalog.noRejectionReason")}</p>}
                            {facts.length > 0 && <p className="mt-1 text-xs text-muted-foreground" translate="no">{facts.join(" · ")}</p>}
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
}: {
    companyId: string;
    submissionId: string;
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
                        <CatalogFeedProviderStatus data={status.data} />
                        {status.data.errors.length > 0 && (
                            <p className="text-sm text-muted-foreground">
                                {t("honestSign.catalog.feedResultHelp")}
                            </p>
                        )}
                        <CatalogFeedMessages data={status.data} />
                    </>
                )
            )}
        </section>
    );
}
