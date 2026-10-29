import { ChevronLeft, ChevronRight, Files, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import {
    UtilisationBatchQueue,
    UtilisationBatchStateBadge,
} from "@marking/components/honest-sign/UtilisationBatchQueue";
import { Button } from "@marking/components/ui/button";
import { Skeleton } from "@marking/components/ui/skeleton";
import { useUtilisationBatchProcessor } from "@marking/hooks/use-utilisation-batch-processor";
import { useUtilisationBatches } from "@marking/hooks/use-utilisation-batches";
import { useAuthStore } from "@marking/src/store/auth";

export function UtilisationBatchesHistory({
    companyId,
}: {
    companyId: string;
}) {
    const actorId = useAuthStore((state) => state.user?.id ?? "anonymous");
    return (
        <ScopedUtilisationBatchesHistory
            key={`${companyId}:${actorId}`}
            companyId={companyId}
        />
    );
}

function ScopedUtilisationBatchesHistory({ companyId }: { companyId: string }) {
    const { t, i18n } = useTranslation();
    const [page, setPage] = useState(1);
    const [selected, setSelected] = useState("");
    const query = useUtilisationBatches(companyId, page);
    const processor = useUtilisationBatchProcessor(companyId);
    return (
        <section
            className="space-y-4"
            aria-label={t("honestSign.documents.batch.historyTitle")}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="flex items-center gap-2 font-semibold">
                        <Files className="size-4" aria-hidden="true" />
                        {t("honestSign.documents.batch.historyTitle")}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t("honestSign.documents.batch.historyHint")}
                    </p>
                </div>
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={query.isFetching || processor.isProcessing}
                    onClick={() => void query.refetch()}
                >
                    <RefreshCw className="size-4" aria-hidden="true" />
                    {t("honestSign.catalog.refresh")}
                </Button>
            </div>
            {query.isError && (
                <Notice role="alert" variant="error">
                    {query.error.message}
                </Notice>
            )}
            {query.isPending ? (
                <Skeleton className="h-24 w-full" />
            ) : query.data?.items.length ? (
                <ul className="divide-y rounded-xl border bg-card">
                    {query.data.items.map((batch) => (
                        <li
                            key={batch.id}
                            className="flex flex-wrap items-center justify-between gap-3 p-4"
                        >
                            <div className="min-w-0 flex-1">
                                <p className="text-sm font-medium">
                                    {new Intl.DateTimeFormat(
                                        i18n.resolvedLanguage || i18n.language,
                                        {
                                            dateStyle: "short",
                                            timeStyle: "short",
                                        },
                                    ).format(new Date(batch.createdAtUtc))}
                                </p>
                                <p className="mt-1 text-xs wrap-anywhere text-muted-foreground">
                                    {batch.items
                                        .map((item) => item.fileName)
                                        .slice(0, 3)
                                        .join(" · ")}
                                    {batch.items.length > 3 ? " …" : ""}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    {t(
                                        "honestSign.documents.batch.acceptedCount",
                                        {
                                            accepted: batch.items.filter(
                                                (item) =>
                                                    item.state === "Accepted",
                                            ).length,
                                            total: batch.items.length,
                                        },
                                    )}
                                </p>
                            </div>
                            <UtilisationBatchStateBadge state={batch.state} />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={processor.isProcessing}
                                onClick={() => setSelected(batch.id)}
                            >
                                {t("honestSign.catalog.products.open")}
                            </Button>
                        </li>
                    ))}
                </ul>
            ) : (
                !query.isError && (
                    <p className="rounded-xl border border-dashed px-4 py-6 text-sm text-muted-foreground">
                        {t("honestSign.documents.batch.historyEmpty")}
                    </p>
                )
            )}
            {query.data && (
                <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                            page === 1 ||
                            query.isFetching ||
                            processor.isProcessing
                        }
                        onClick={() => setPage(page - 1)}
                    >
                        <ChevronLeft aria-hidden="true" className="size-4" />
                        {t("honestSign.catalog.previous")}
                    </Button>
                    <span className="text-xs">
                        {t("honestSign.catalog.page", { page })}
                    </span>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={
                            !query.data.hasNextPage ||
                            query.isFetching ||
                            processor.isProcessing
                        }
                        onClick={() => setPage(page + 1)}
                    >
                        {t("honestSign.catalog.next")}
                        <ChevronRight aria-hidden="true" className="size-4" />
                    </Button>
                </div>
            )}
            {selected && (
                <UtilisationBatchQueue
                    companyId={companyId}
                    batchId={selected}
                    processing={processor.isProcessing}
                    processError={processor.error}
                    onContinue={() => void processor.processBatch(selected)}
                />
            )}
        </section>
    );
}
