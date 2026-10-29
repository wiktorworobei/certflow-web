import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    CheckCircle2,
    CircleAlert,
    Clock3,
    FileText,
    Loader2,
    Play,
    RefreshCw,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@marking/components/ui/alert-dialog";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Skeleton } from "@marking/components/ui/skeleton";
import { useHonestSignUtilisationReportStatus } from "@marking/hooks/use-honest-sign";
import {
    utilisationBatchKeys,
    useUtilisationBatch,
} from "@marking/hooks/use-utilisation-batches";
import { documentsApiService } from "@marking/lib/honest-sign/documentsApiService";
import { cn } from "@marking/lib/utils";
import { useAuthStore } from "@marking/src/store/auth";

import type {
    UtilisationBatchItem,
    UtilisationBatchItemState,
} from "@marking/lib/honest-sign/utilisationBatch";

export function UtilisationBatchStateBadge({
    state,
}: {
    state:
        | UtilisationBatchItemState
        | "Completed"
        | "CompletedWithIssues"
        | "Blocked";
}) {
    const { t } = useTranslation();
    const Icon =
        state === "Accepted" || state === "Completed"
            ? CheckCircle2
            : state === "Rejected" ||
                state === "Unknown" ||
                state === "Blocked" ||
                state === "SkippedUnknown" ||
                state === "SkippedRejected" ||
                state === "CompletedWithIssues"
              ? CircleAlert
              : state === "Sending"
                ? Loader2
                : Clock3;
    return (
        <Badge
            variant="outline"
            className={cn(
                "max-w-full min-w-0 shrink whitespace-normal",
                state === "Accepted" || state === "Completed"
                    ? "gap-1.5 border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    : state === "Unknown" ||
                        state === "Rejected" ||
                        state === "Blocked" ||
                        state === "SkippedUnknown" ||
                        state === "SkippedRejected" ||
                        state === "CompletedWithIssues"
                      ? "gap-1.5 border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
                      : "gap-1.5",
            )}
        >
            <Icon
                aria-hidden="true"
                className={
                    state === "Sending"
                        ? "size-3.5 animate-spin motion-reduce:animate-none"
                        : "size-3.5"
                }
            />
            {t(`honestSign.documents.batch.states.${state}`)}
        </Badge>
    );
}

function AcceptedReportStatus({
    companyId,
    reportId,
    initialStatus,
}: {
    companyId: string;
    reportId: string;
    initialStatus: string | null;
}) {
    const { t } = useTranslation();
    const query = useHonestSignUtilisationReportStatus(companyId, reportId);
    const status = query.data?.status ?? initialStatus;
    return (
        <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-mono wrap-anywhere">
                    {t("honestSign.documents.batch.reportId")}: {reportId}
                </span>
                <Badge
                    className="max-w-full wrap-anywhere whitespace-normal"
                    variant={
                        status === "REJECTED" || status === "FAILED"
                            ? "destructive"
                            : "outline"
                    }
                >
                    {t("honestSign.documents.batch.providerStatus")}:{" "}
                    {status
                        ? t(`honestSign.documentsCenter.statuses.${status}`, {
                              defaultValue: status,
                          })
                        : "—"}
                </Badge>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={query.isFetching}
                    onClick={() => void query.refetch()}
                    aria-label={t("honestSign.documentsCenter.refreshStatus")}
                >
                    <RefreshCw
                        aria-hidden="true"
                        className={
                            query.isFetching
                                ? "size-3.5 animate-spin motion-reduce:animate-none"
                                : "size-3.5"
                        }
                    />
                </Button>
            </div>
            {(query.isError || query.data?.errorReason) && (
                <p className="text-xs text-destructive">
                    {query.data?.errorReason ||
                        t("honestSign.messages.reportStatusFailed")}
                </p>
            )}
        </div>
    );
}

export function UtilisationBatchQueue({
    companyId,
    batchId,
    processing,
    processError,
    onContinue,
}: {
    companyId: string;
    batchId: string;
    processing: boolean;
    processError?: string;
    onContinue: () => void;
}) {
    const { t } = useTranslation();
    const query = useUtilisationBatch(companyId, batchId);
    const client = useQueryClient();
    const actorId = useAuthStore((state) => state.user?.id ?? "anonymous");
    const [skipItem, setSkipItem] = useState<UtilisationBatchItem | null>(null);
    const skipCancel = useRef<HTMLButtonElement>(null);
    const skip = useMutation({
        mutationFn: ({ itemId }: { itemId: string; owner: string }) =>
            documentsApiService.skipUtilisationBatchItem(batchId, itemId),
        retry: false,
        onSuccess: (data, { owner }) => {
            client.setQueryData(
                utilisationBatchKeys.detail(companyId, owner, batchId),
                data,
            );
            void client.invalidateQueries({
                queryKey: utilisationBatchKeys.all(companyId, owner),
            });
            setSkipItem(null);
        },
    });
    const batch = query.data;
    return (
        <section
            className="space-y-4 rounded-xl border bg-card p-4 sm:p-5"
            aria-label={t("honestSign.documents.batch.queueTitle")}
            aria-busy={processing}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                    <h3 className="font-semibold">
                        {t("honestSign.documents.batch.queueTitle")}
                    </h3>
                    <p className="mt-1 font-mono text-xs wrap-anywhere text-muted-foreground">
                        {batchId}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={query.isFetching || processing}
                    onClick={() => void query.refetch()}
                >
                    <RefreshCw aria-hidden="true" className="size-4" />
                    {t("honestSign.catalog.refresh")}
                </Button>
            </div>
            {(query.isError || processError) && (
                <Notice variant="error" role="alert">
                    {processError || query.error?.message}
                </Notice>
            )}
            {query.isPending ? (
                <Skeleton className="h-36 w-full" />
            ) : (
                batch && (
                    <>
                        <div className="flex flex-wrap items-center gap-3">
                            <UtilisationBatchStateBadge state={batch.state} />
                            <span className="text-sm text-muted-foreground">
                                {t("honestSign.documents.batch.acceptedCount", {
                                    accepted: batch.items.filter(
                                        (item) => item.state === "Accepted",
                                    ).length,
                                    total: batch.items.length,
                                })}
                            </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {t("honestSign.documents.batch.serverSaved")}
                        </p>
                        {batch.state === "Blocked" && (
                            <Notice variant="warning">
                                {t("honestSign.documents.batch.blockedHint")}
                            </Notice>
                        )}
                        {batch.state === "Sending" && (
                            <Notice>
                                {t("honestSign.documents.batch.sendingHint")}
                            </Notice>
                        )}
                        <ol className="divide-y rounded-lg border">
                            {batch.items.map((item) => (
                                <li
                                    key={item.id}
                                    className="space-y-2 p-3 sm:p-4"
                                >
                                    <div className="flex flex-wrap items-start justify-between gap-2">
                                        <div className="flex min-w-0 items-start gap-2">
                                            <FileText
                                                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                                                aria-hidden="true"
                                            />
                                            <p className="min-w-0 text-sm font-medium wrap-anywhere">
                                                {item.sequence}. {item.fileName}
                                            </p>
                                        </div>
                                        <UtilisationBatchStateBadge
                                            state={item.state}
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {t(
                                            "honestSign.documents.batch.codeCount",
                                            { count: item.codesCount },
                                        )}
                                        {item.expirationDate
                                            ? ` · ${t("honestSign.documents.expirationDate")}: ${item.expirationDate}`
                                            : ""}
                                        {item.productionDate
                                            ? ` · ${t("honestSign.documents.batch.productionDate")}: ${item.productionDate}`
                                            : ""}
                                    </p>
                                    {item.reportId && (
                                        <AcceptedReportStatus
                                            companyId={companyId}
                                            reportId={item.reportId}
                                            initialStatus={item.status}
                                        />
                                    )}
                                    {item.error && (
                                        <p className="text-sm wrap-anywhere text-destructive">
                                            {item.error}
                                        </p>
                                    )}
                                    {(item.upstreamErrorCode ||
                                        item.correlationId) && (
                                        <p className="font-mono text-xs wrap-anywhere text-muted-foreground">
                                            {item.upstreamErrorCode
                                                ? `${t("honestSign.documents.batch.errorCode")}: ${item.upstreamErrorCode}`
                                                : ""}
                                            {item.upstreamErrorCode &&
                                            item.correlationId
                                                ? " · "
                                                : ""}
                                            {item.correlationId
                                                ? `${t("honestSign.documents.batch.correlationId")}: ${item.correlationId}`
                                                : ""}
                                        </p>
                                    )}
                                    {(item.state === "Rejected" ||
                                        item.state === "Unknown") && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={
                                                processing || skip.isPending
                                            }
                                            onClick={() => {
                                                skip.reset();
                                                setSkipItem(item);
                                            }}
                                        >
                                            {t(
                                                "honestSign.documents.batch.skip",
                                            )}
                                        </Button>
                                    )}
                                </li>
                            ))}
                        </ol>
                        {batch.state === "Queued" && (
                            <Button
                                type="button"
                                disabled={
                                    processing ||
                                    query.isFetching ||
                                    skip.isPending
                                }
                                onClick={onContinue}
                            >
                                {processing ? (
                                    <Loader2
                                        aria-hidden="true"
                                        className="size-4 animate-spin motion-reduce:animate-none"
                                    />
                                ) : (
                                    <Play
                                        aria-hidden="true"
                                        className="size-4"
                                    />
                                )}
                                {t(
                                    processing
                                        ? "honestSign.documents.batch.processing"
                                        : "honestSign.documents.batch.continue",
                                )}
                            </Button>
                        )}
                    </>
                )
            )}
            <AlertDialog
                open={Boolean(skipItem)}
                onOpenChange={(open) => {
                    if (!open && !skip.isPending) setSkipItem(null);
                }}
            >
                <AlertDialogContent
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        skipCancel.current?.focus();
                    }}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("honestSign.documents.batch.skipTitle", {
                                name: skipItem?.fileName ?? "",
                            })}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t(
                                skipItem?.state === "Unknown"
                                    ? "honestSign.documents.batch.skipUnknownDescription"
                                    : "honestSign.documents.batch.skipRejectedDescription",
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    {skip.isError && (
                        <Notice variant="error" role="alert">
                            {skip.error.message}
                        </Notice>
                    )}
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            ref={skipCancel}
                            disabled={skip.isPending}
                        >
                            {t("common.cancel")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={skip.isPending || !skipItem}
                            onClick={(event) => {
                                event.preventDefault();
                                if (skipItem && !skip.isPending)
                                    skip.mutate({
                                        itemId: skipItem.id,
                                        owner: actorId,
                                    });
                            }}
                        >
                            {t("honestSign.documents.batch.skipConfirm")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </section>
    );
}
