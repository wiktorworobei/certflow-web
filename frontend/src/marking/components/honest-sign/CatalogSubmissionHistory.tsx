import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogErrorDetails } from "@marking/components/honest-sign/CatalogErrorDetails";
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
}: {
    companyId: string;
    onOpen: (id: string) => void;
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
            {submissions.isError ? (
                <Notice variant="error" role="alert">
                    <p>{submissions.error.message}</p>
                    <CatalogErrorDetails error={submissions.error} />
                </Notice>
            ) : submissions.isPending ? (
                <Skeleton className="h-20 w-full" />
            ) : !submissions.data?.items.length ? (
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
                            {submissions.data.items.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell className="font-mono">
                                        {row.gtin ||
                                            t("honestSign.catalog.pendingGtin")}
                                    </TableCell>
                                    <TableCell>
                                        {new Date(
                                            row.createdAtUtc,
                                        ).toLocaleString(i18n.language)}
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline">
                                            {t(
                                                `honestSign.catalog.deliveryStates.${row.state}`,
                                            )}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="font-mono">
                                        {row.feedId ?? "—"}
                                    </TableCell>
                                    <TableCell>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => onOpen(row.id)}
                                        >
                                            {t("honestSign.catalog.openCard")}
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))}
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
