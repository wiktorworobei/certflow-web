import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    CalendarDays,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ListFilter,
    PackageSearch,
    Plus,
    RefreshCw,
} from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogErrorDetails } from "@marking/components/honest-sign/CatalogErrorDetails";
import { CatalogProductsTable } from "@marking/components/honest-sign/CatalogProductsTable";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Select } from "@marking/components/honest-sign/ui/select";
import { Button } from "@marking/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@marking/components/ui/collapsible";
import { Input } from "@marking/components/ui/input";
import { Label } from "@marking/components/ui/label";
import { Skeleton } from "@marking/components/ui/skeleton";
import {
    catalogKeys,
    useCatalogProducts,
} from "@marking/hooks/use-honest-sign-catalog";
import { catalogApiService } from "@marking/lib/honest-sign/catalogApiService";
import { validCatalogProductDateRange } from "@marking/lib/honest-sign/catalogProductView";

import type {
    CatalogProduct,
    CatalogProductFilters,
    CatalogProductStatusFilter,
} from "@marking/lib/honest-sign/catalogTypes";

export function CatalogProductsPanel({
    companyId,
    onOpen,
    onCreate,
}: {
    companyId: string;
    onOpen: (
        product: CatalogProduct,
        submissionId: string,
        signing: boolean,
    ) => void;
    onCreate: () => void;
}) {
    const { t, i18n } = useTranslation();
    const client = useQueryClient();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState<CatalogProductFilters>(() => ({
        fromDate: "2000-01-01",
        toDate: new Date().toISOString().slice(0, 10),
    }));
    const [draftFilters, setDraftFilters] = useState(filters);
    const [dateError, setDateError] = useState(false);
    const [filtersOpen, setFiltersOpen] = useState(false);
    const opening = useRef(false);
    const products = useCatalogProducts(companyId, page, filters);
    const track = useMutation({
        retry: false,
        mutationFn: ({
            product,
        }: {
            product: CatalogProduct;
            signing: boolean;
        }) => catalogApiService.trackProduct(product.goodId, product.gtin),
        onSuccess: (row, { product, signing }) => {
            void client.invalidateQueries({
                queryKey: catalogKeys.all(companyId),
            });
            onOpen(product, row.id, signing);
        },
        onSettled: () => {
            opening.current = false;
        },
    });
    const open = (product: CatalogProduct, signing: boolean) => {
        if (opening.current || !product.gtin) return;
        opening.current = true;
        track.mutate({ product, signing });
    };
    const items = products.data?.items ?? [];
    const formatFilterDate = (value: string) =>
        new Intl.DateTimeFormat(i18n.resolvedLanguage || i18n.language, {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            timeZone: "UTC",
        }).format(new Date(`${value}T00:00:00Z`));
    const statusLabel = filters.status
        ? t(
              filters.status === "draft"
                  ? "honestSign.catalog.products.unpublished"
                  : `honestSign.catalog.workflow.cardStates.${filters.status}`,
          )
        : t("honestSign.catalog.products.allStatuses");
    return (
        <section
            className="min-w-0 overflow-hidden rounded-xl border bg-card shadow-xs"
            aria-label={t("honestSign.catalog.products.title")}
            aria-busy={products.isFetching || track.isPending}
        >
            <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
                <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-4">
                    <div className="min-w-0">
                        <h3 className="flex flex-wrap items-center gap-2 font-semibold">
                            {t("honestSign.catalog.products.registry")}
                            {!products.isFetching && products.data && (
                                <span
                                    className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground tabular-nums"
                                    aria-label={t(
                                        "honestSign.catalog.products.pageCount",
                                        {
                                            count: items.length,
                                        },
                                    )}
                                >
                                    {items.length}
                                </span>
                            )}
                        </h3>
                        <p
                            className="mt-1 text-xs text-muted-foreground"
                            role="status"
                        >
                            {products.isFetching
                                ? t("honestSign.catalog.products.loading")
                                : t("honestSign.catalog.products.source")}
                        </p>
                    </div>
                    <div className="flex w-full items-center gap-2 sm:w-auto">
                        <CollapsibleTrigger asChild>
                            <Button
                                type="button"
                                variant={filtersOpen ? "secondary" : "outline"}
                                size="sm"
                                className="flex-1 sm:flex-none"
                            >
                                <ListFilter
                                    className="size-4"
                                    aria-hidden="true"
                                />
                                {t("honestSign.catalog.products.filters")}
                                <ChevronDown
                                    className={
                                        filtersOpen
                                            ? "size-3.5 rotate-180"
                                            : "size-3.5"
                                    }
                                    aria-hidden="true"
                                />
                            </Button>
                        </CollapsibleTrigger>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="flex-1 sm:flex-none"
                            disabled={products.isFetching || track.isPending}
                            onClick={() => void products.refetch()}
                        >
                            <RefreshCw
                                className={
                                    products.isFetching
                                        ? "size-4 animate-spin motion-reduce:animate-none"
                                        : "size-4"
                                }
                                aria-hidden="true"
                            />
                            {t("honestSign.catalog.refresh")}
                        </Button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-muted/25 px-4 py-2.5 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                        <ListFilter className="size-3.5" aria-hidden="true" />
                        <span className="font-medium text-foreground">
                            {statusLabel}
                        </span>
                    </span>
                    <span className="inline-flex min-w-0 flex-wrap items-center gap-1.5">
                        <CalendarDays
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        <span>
                            {formatFilterDate(filters.fromDate)} —{" "}
                            {formatFilterDate(filters.toDate)}
                        </span>
                    </span>
                </div>
                <CollapsibleContent>
                    <form
                        className="grid items-end gap-3 border-t bg-muted/15 p-4 sm:grid-cols-2 lg:grid-cols-[minmax(12rem,1fr)_minmax(10rem,1fr)_minmax(10rem,1fr)_auto]"
                        onSubmit={(event) => {
                            event.preventDefault();
                            if (
                                !validCatalogProductDateRange(
                                    draftFilters.fromDate,
                                    draftFilters.toDate,
                                )
                            ) {
                                setDateError(true);
                                return;
                            }
                            setDateError(false);
                            setPage(1);
                            setFilters({ ...draftFilters });
                        }}
                    >
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="catalog-products-status">
                                {t("honestSign.catalog.products.statusFilter")}
                            </Label>
                            <Select
                                id="catalog-products-status"
                                value={draftFilters.status ?? ""}
                                onChange={(event) =>
                                    setDraftFilters({
                                        ...draftFilters,
                                        status: event.target.value
                                            ? (event.target
                                                  .value as CatalogProductStatusFilter)
                                            : undefined,
                                    })
                                }
                            >
                                <option value="">
                                    {t(
                                        "honestSign.catalog.products.allStatuses",
                                    )}
                                </option>
                                <option value="draft">
                                    {t(
                                        "honestSign.catalog.products.unpublished",
                                    )}
                                </option>
                                <option value="published">
                                    {t(
                                        "honestSign.catalog.workflow.cardStates.published",
                                    )}
                                </option>
                                <option value="archived">
                                    {t(
                                        "honestSign.catalog.workflow.cardStates.archived",
                                    )}
                                </option>
                            </Select>
                        </div>
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="catalog-products-from">
                                {t("honestSign.catalog.products.fromDate")}
                            </Label>
                            <Input
                                id="catalog-products-from"
                                type="date"
                                className="w-full min-w-0"
                                required
                                value={draftFilters.fromDate}
                                aria-invalid={dateError}
                                aria-describedby={
                                    dateError
                                        ? "catalog-products-date-error"
                                        : undefined
                                }
                                onChange={(event) =>
                                    setDraftFilters({
                                        ...draftFilters,
                                        fromDate: event.target.value,
                                    })
                                }
                            />
                        </div>
                        <div className="min-w-0 space-y-1.5">
                            <Label htmlFor="catalog-products-to">
                                {t("honestSign.catalog.products.toDate")}
                            </Label>
                            <Input
                                id="catalog-products-to"
                                type="date"
                                className="w-full min-w-0"
                                required
                                value={draftFilters.toDate}
                                aria-invalid={dateError}
                                aria-describedby={
                                    dateError
                                        ? "catalog-products-date-error"
                                        : undefined
                                }
                                onChange={(event) =>
                                    setDraftFilters({
                                        ...draftFilters,
                                        toDate: event.target.value,
                                    })
                                }
                            />
                        </div>
                        <Button
                            type="submit"
                            variant="secondary"
                            disabled={products.isFetching || track.isPending}
                        >
                            {t("honestSign.catalog.products.applyFilters")}
                        </Button>
                        {dateError && (
                            <p
                                id="catalog-products-date-error"
                                role="alert"
                                className="text-sm text-destructive sm:col-span-2 lg:col-span-4"
                            >
                                {t(
                                    "honestSign.catalog.products.invalidDateRange",
                                )}
                            </p>
                        )}
                    </form>
                </CollapsibleContent>
            </Collapsible>
            {products.isError && (
                <Notice variant="error" role="alert" className="m-4">
                    <p>{products.error.message}</p>
                    <CatalogErrorDetails error={products.error} />
                    {items.length > 0 && (
                        <p className="mt-2">
                            {t("honestSign.catalog.products.stale")}
                        </p>
                    )}
                </Notice>
            )}
            {track.isError && (
                <Notice variant="error" role="alert" className="m-4">
                    <p>{track.error.message}</p>
                    <CatalogErrorDetails error={track.error} />
                </Notice>
            )}
            {products.isPending ? (
                <div
                    className="space-y-2 border-t p-4"
                    aria-label={t("honestSign.catalog.products.loading")}
                >
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-32 w-full" />
                </div>
            ) : !items.length && !products.isError ? (
                <div className="flex flex-col items-center gap-3 border-t px-4 py-14 text-center">
                    <div className="mb-1 flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <PackageSearch className="size-7" aria-hidden="true" />
                    </div>
                    <p className="font-medium">
                        {t("honestSign.catalog.products.empty")}
                    </p>
                    <p className="max-w-lg text-sm text-muted-foreground">
                        {t("honestSign.catalog.products.emptyHelp")}
                    </p>
                    <Button type="button" onClick={onCreate}>
                        <Plus className="size-4" aria-hidden="true" />
                        {t("honestSign.catalog.products.add")}
                    </Button>
                </div>
            ) : items.length > 0 ? (
                <CatalogProductsTable
                    items={items}
                    busy={track.isPending}
                    openingGoodId={
                        track.isPending
                            ? track.variables?.product.goodId
                            : undefined
                    }
                    onOpen={open}
                />
            ) : null}
            {products.data && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/15 px-4 py-3 text-sm">
                    <p className="text-muted-foreground" role="status">
                        {products.isFetching
                            ? t("honestSign.catalog.products.loading")
                            : products.data.total === null
                              ? t("honestSign.catalog.products.pageCount", {
                                    count: items.length,
                                })
                              : t("honestSign.catalog.products.total", {
                                    count: products.data.total,
                                })}
                    </p>
                    <div className="flex max-w-full flex-wrap items-center gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                                page === 1 ||
                                products.isFetching ||
                                track.isPending
                            }
                            onClick={() => setPage(page - 1)}
                        >
                            <ChevronLeft
                                className="size-4"
                                aria-hidden="true"
                            />
                            {t("honestSign.catalog.previous")}
                        </Button>
                        <span className="px-1 text-xs font-medium tabular-nums">
                            {t("honestSign.catalog.page", { page })}
                        </span>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                                !products.data.hasNextPage ||
                                products.isFetching ||
                                track.isPending
                            }
                            onClick={() => setPage(page + 1)}
                        >
                            {t("honestSign.catalog.next")}
                            <ChevronRight
                                className="size-4"
                                aria-hidden="true"
                            />
                        </Button>
                    </div>
                </div>
            )}
        </section>
    );
}
