import { useTranslation } from "react-i18next";
import { CatalogErrorDetails } from "@marking/components/honest-sign/CatalogErrorDetails";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Button } from "@marking/components/ui/button";
import { Skeleton } from "@marking/components/ui/skeleton";
import { useCatalogFeedStatus } from "@marking/hooks/use-honest-sign-catalog";

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
                        {status.data.errors.length > 0 && (
                            <div className="space-y-2" role="status">
                                <p className="text-sm font-medium">
                                    {t("honestSign.catalog.rejectionReasons")}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {t("honestSign.catalog.feedResultHelp")}
                                </p>
                                <ul className="space-y-2 text-sm">
                                    {status.data.errors.map((e, index) => (
                                        <li
                                            key={index}
                                            className="rounded-md border border-destructive/20 p-3"
                                        >
                                            {e.gtin && (
                                                <span className="mr-2 font-mono">
                                                    {e.gtin}
                                                </span>
                                            )}
                                            {e.attributeId && (
                                                <span>
                                                    {t(
                                                        "honestSign.catalog.attributeId",
                                                        {
                                                            id: e.attributeId,
                                                        },
                                                    )}{" "}
                                                    ·{" "}
                                                </span>
                                            )}
                                            {!e.attributeId && e.parameter && (
                                                <span>{e.parameter} · </span>
                                            )}
                                            {e.code && <span>{e.code}: </span>}
                                            {e.message ||
                                                t(
                                                    "honestSign.catalog.noRejectionReason",
                                                )}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        )}
                    </>
                )
            )}
        </section>
    );
}
