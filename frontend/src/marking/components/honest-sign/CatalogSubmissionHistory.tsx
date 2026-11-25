import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogErrorDetails } from "@marking/components/honest-sign/CatalogErrorDetails";
import { CatalogFeedCardLookup } from "@marking/components/honest-sign/CatalogFeedCardLookup";
import { CatalogFeedMessages } from "@marking/components/honest-sign/CatalogFeedProcessing";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Skeleton } from "@marking/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@marking/components/ui/table";
import { useCatalogSubmissions } from "@marking/hooks/use-honest-sign-catalog";

export function CatalogSubmissionHistory({
    companyId,
    onOpen,
    attemptsOnly = false,
}: {
    companyId: string;
    onOpen: (id: string, retry?: boolean) => void;
    attemptsOnly?: boolean;
}) {
    const { t, i18n } = useTranslation();
    const [page, setPage] = useState(1);
    const submissions = useCatalogSubmissions(companyId, page);
    return (
        <section
            className="space-y-3 border-t pt-5"
            aria-label={t("honestSign.catalog.history")}
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold">
                    {t("honestSign.catalog.history")}
                </h3>
                <Button
                    size="sm"
                    variant="outline"
                    disabled={submissions.isFetching}
                    onClick={() => void submissions.refetch()}
                >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    {t("honestSign.catalog.refresh")}
                </Button>
            </div>
            {submissions.isError && (
                <Notice variant={submissions.data ? "warning" : "error"} role="alert">
                    {submissions.data && <p>{t("honestSign.catalog.historyRefreshFailed")}</p>}
                    <p>{submissions.error.message}</p>
                    <CatalogErrorDetails error={submissions.error} />
                </Notice>
            )}
            {submissions.isPending ? (
                <Skeleton className="h-20 w-full" />
            ) : !submissions.data ? null : !submissions.data.items.length ? (
                <p className="text-sm text-muted-foreground">
                    {t("honestSign.catalog.emptyHistory")}
                </p>
            ) : (
                <div className="overflow-x-auto">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>GTIN</TableHead>
                                <TableHead>
                                    {t("honestSign.catalog.created")}
                                </TableHead>
                                <TableHead>
                                    {t("honestSign.catalog.delivery")}
                                </TableHead>
                                <TableHead>
                                    {t("honestSign.catalog.feedId")}
                                </TableHead>
                                <TableHead>
                                    {t("honestSign.catalog.actions")}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {submissions.data.items.map((row) => {
                                const feed = row.latestFeedStatus;
                                const previousFeed = row.state === "Draft" || Boolean(row.feedId && feed && feed.feedId !== row.feedId);
                                const currentFeed = row.state === "Accepted" && row.feedId && !previousFeed ? feed : null;
                                const feedState = currentFeed?.submissionState === "Rejected" ? "Rejected" : currentFeed?.status;
                                const rejected = row.state === "Rejected" || feedState === "Rejected";
                                const status = feedState
                                    ? t(`honestSign.catalog.feedStates.${feedState}`)
                                    : t(`honestSign.catalog.deliveryStates.${row.state}`);
                                return (
                                    <TableRow key={row.id}>
                                        <TableCell className="font-mono">
                                            {row.gtin || t("honestSign.catalog.pendingGtin")}
                                        </TableCell>
                                        <TableCell>
                                            {new Date(row.createdAtUtc).toLocaleString(i18n.language)}
                                        </TableCell>
                                        <TableCell className="min-w-52 max-w-md align-top whitespace-normal">
                                            <Badge variant={rejected ? "destructive" : "outline"}>{status}</Badge>
                                            {feed && (
                                                <div className="mt-2 space-y-2">
                                                    {previousFeed && (
                                                        <p className="text-sm text-muted-foreground">
                                                            {t("honestSign.catalog.workflow.previousFeedProcessing")}
                                                        </p>
                                                    )}
                                                    <CatalogFeedMessages data={feed} compact />
                                                    <CatalogFeedCardLookup companyId={companyId} submissionId={row.id} gtin={row.gtin} data={feed} />
                                                </div>
                                            )}
                                            {rejected && !feed?.errors.length && (
                                                <p className="mt-2 text-sm text-muted-foreground">
                                                    {t("honestSign.catalog.noRejectionReason")}
                                                </p>
                                            )}
                                        </TableCell>
                                        <TableCell className="font-mono">
                                            {row.feedId ?? "—"}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-2">
                                                {rejected && (
                                                    <Button size="sm" onClick={() => onOpen(row.id, true)}>
                                                        {t("honestSign.catalog.attempts.openRetry")}
                                                    </Button>
                                                )}
                                                <Button variant="outline" size="sm" onClick={() => onOpen(row.id)}>
                                                    {t(attemptsOnly ? "honestSign.catalog.attempts.open" : "honestSign.catalog.openCard")}
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </div>
            )}
            <div className="flex items-center justify-end gap-3">
                <Button
                    variant="outline"
                    size="sm"
                    disabled={page === 1 || submissions.isFetching}
                    onClick={() => setPage(page - 1)}
                >
                    {t("honestSign.catalog.previous")}
                </Button>
                <span className="text-sm text-muted-foreground">
                    {t("honestSign.catalog.page", { page })}
                </span>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={
                        !submissions.data?.hasNextPage || submissions.isFetching
                    }
                    onClick={() => setPage(page + 1)}
                >
                    {t("honestSign.catalog.next")}
                </Button>
            </div>
        </section>
    );
}
