import { BookOpen, RefreshCw } from "lucide-react";
import { useState } from "react";
import { toast } from 'sonner';
import { useMarkingDeclaration } from '@marking/DeclarationContext';
import { apiClient } from '@marking/lib/api-client';
import { api, store } from '../../../store';
import { useTranslation } from "react-i18next";
import { CatalogCardForm } from "@marking/components/honest-sign/CatalogCardForm";
import { CatalogCardWorkflow } from "@marking/components/honest-sign/CatalogCardWorkflow";
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
import {
    useCatalogCategories,
    useCatalogFeedStatus,
    useCatalogSubmissions,
} from "@marking/hooks/use-honest-sign-catalog";

export function NationalCatalogWorkspace({
    companyId,
    selectedThumbprint = "",
}: {
    companyId: string;
    selectedThumbprint?: string;
}) {
    const { t, i18n } = useTranslation();
    const declaration = useMarkingDeclaration();
    const [page, setPage] = useState(1);
    const [selectedId, setSelectedId] = useState("");
    const categories = useCatalogCategories(companyId);
    const submissions = useCatalogSubmissions(companyId, page);
    const status = useCatalogFeedStatus(companyId, selectedId);
    return (
        <div className="space-y-6 p-4 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                    <h2 className="flex items-center gap-2 text-lg font-semibold">
                        <BookOpen className="size-5" aria-hidden="true" />
                        {t("honestSign.catalog.title")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t("honestSign.catalog.description")}
                    </p>
                </div>
                <Badge variant="outline">
                    {t("honestSign.catalog.motorOils")}
                </Badge>
            </div>
            {categories.isPending ? (
                <Skeleton className="h-48 w-full" />
            ) : categories.isError ? (
                <Notice variant="error" role="alert">
                    <p>{categories.error.message}</p>
                    <Button
                        variant="outline"
                        size="sm"
                        className="mt-2"
                        onClick={() => void categories.refetch()}
                    >
                        {t("honestSign.catalog.retry")}
                    </Button>
                </Notice>
            ) : !categories.data?.some((c) => c.isActive) ? (
                <Notice>{t("honestSign.catalog.noCategories")}</Notice>
            ) : (
                <CatalogCardForm
                    companyId={companyId}
                    categories={categories.data}
                    onSubmitted={(row) => {
                        setSelectedId(row.id);
                        setPage(1);
                        if (declaration && row.state !== 'Rejected') {
                            void apiClient.get(`/api/firms/${companyId}/marking/settings`).then(settings => apiClient.post(`/api/firms/${companyId}/marking/links`, {
                                declarationId: declaration.id, gtin: row.gtin, provider: 'ChZ', environment: settings.data.profile,
                                externalOrderId: `catalog:${row.id}`, batchNumber: '',
                            })).then(() => store.dispatch(api.util.invalidateTags(['Marking']))).catch(() => toast.error('Карточка отправлена. Не удалось сохранить связь с декларацией — добавьте её во вкладке «Связи с декларациями».'));
                        }
                    }}
                />
            )}
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
                        {submissions.error.message}
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
                                            {row.gtin}
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
                                                onClick={() =>
                                                    setSelectedId(row.id)
                                                }
                                            >
                                                {t(
                                                    "honestSign.catalog.checkStatus",
                                                )}
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
                            !submissions.data?.hasNextPage ||
                            submissions.isFetching
                        }
                        onClick={() => setPage(page + 1)}
                    >
                        {t("honestSign.catalog.next")}
                    </Button>
                </div>
            </section>
            {selectedId && (
                <CatalogCardWorkflow
                    key={selectedId}
                    companyId={companyId}
                    submissionId={selectedId}
                    selectedThumbprint={selectedThumbprint}
                    categories={categories.data ?? []}
                />
            )}
            {selectedId && (
                <section
                    className="space-y-3 border-t pt-5"
                    aria-live="polite"
                    aria-label={t("honestSign.catalog.processing")}
                >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="font-semibold">
                            {t("honestSign.catalog.processing")}
                        </h3>
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
                    ) : status.isError ? (
                        <Notice variant="error" role="alert">
                            {status.error.message}
                        </Notice>
                    ) : (
                        status.data && (
                            <>
                                <Notice
                                    variant={
                                        status.data.errors.length ||
                                        status.data.status === "Rejected" ||
                                        status.data.submissionState ===
                                            "Rejected"
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
                                            status.data.submissionState ===
                                                "Rejected"
                                                ? "honestSign.catalog.rejectedNotice"
                                                : !status.data.feedId
                                                  ? "honestSign.catalog.unknownNotice"
                                                  : status.data.status ===
                                                      "Moderated"
                                                    ? "honestSign.catalog.moderatedNotice"
                                                    : status.data.status ===
                                                        "Signed"
                                                      ? "honestSign.catalog.signedNotice"
                                                      : "honestSign.catalog.acceptedNotice",
                                        )}
                                    </p>
                                </Notice>
                                {status.data.errors.length > 0 && (
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
                                                {e.code && (
                                                    <span>{e.code}: </span>
                                                )}
                                                {e.message}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </>
                        )
                    )}
                </section>
            )}
        </div>
    );
}
