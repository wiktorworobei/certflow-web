import { ArrowUpRight, FileSignature, Loader2, Package } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CatalogProductStatus } from "@marking/components/honest-sign/CatalogProductStatus";
import { Button } from "@marking/components/ui/button";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@marking/components/ui/table";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@marking/components/ui/tooltip";
import {
    canOpenCatalogSigning,
    catalogProductStatuses,
} from "@marking/lib/honest-sign/catalogProductView";

import type { CatalogProduct } from "@marking/lib/honest-sign/catalogTypes";

type Actions = {
    product: CatalogProduct;
    busy: boolean;
    openingGoodId?: number;
    onOpen: (product: CatalogProduct, signing: boolean) => void;
};

function ProductActions({ product, busy, openingGoodId, onOpen }: Actions) {
    const { t } = useTranslation();
    const title = product.name || t("honestSign.catalog.products.unnamed");
    const awaitingSignature =
        catalogProductStatuses(product).includes("notsigned");
    return (
        <>
            {canOpenCatalogSigning(product) && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className={`h-11 shadow-none motion-reduce:transition-none @min-[56rem]/catalog:h-8 ${awaitingSignature ? "border-amber-500/30 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-200" : ""}`}
                    disabled={busy}
                    aria-label={t("honestSign.catalog.products.signNamed", {
                        name: title,
                    })}
                    onClick={() => onOpen(product, true)}
                >
                    <FileSignature className="size-4" aria-hidden="true" />
                    {t("honestSign.catalog.products.sign")}
                </Button>
            )}
            <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-11 motion-reduce:transition-none @min-[56rem]/catalog:h-8"
                disabled={busy || !product.gtin}
                aria-label={t("honestSign.catalog.products.openNamed", {
                    name: title,
                })}
                onClick={() => onOpen(product, false)}
            >
                {openingGoodId === product.goodId ? (
                    <Loader2
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                    />
                ) : (
                    <ArrowUpRight className="size-4" aria-hidden="true" />
                )}
                {t("honestSign.catalog.products.open")}
            </Button>
        </>
    );
}

function ProductName({
    product,
    busy,
    onOpen,
}: Omit<Actions, "openingGoodId">) {
    const { t } = useTranslation();
    const name = product.name || t("honestSign.catalog.products.unnamed");
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    type="button"
                    className="line-clamp-2 max-w-full rounded-sm text-left text-sm leading-5 font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-default disabled:text-muted-foreground disabled:no-underline"
                    disabled={busy || !product.gtin}
                    aria-label={t("honestSign.catalog.products.openNamed", {
                        name,
                    })}
                    onClick={() => onOpen(product, false)}
                >
                    {name}
                </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm break-words motion-reduce:animate-none">
                {name}
            </TooltipContent>
        </Tooltip>
    );
}

export function CatalogProductsTable({
    items,
    busy = false,
    openingGoodId,
    onOpen,
}: {
    items: CatalogProduct[];
    busy?: boolean;
    openingGoodId?: number;
    onOpen: (product: CatalogProduct, signing: boolean) => void;
}) {
    const { t } = useTranslation();
    return (
        <TooltipProvider delayDuration={300}>
            <div className="@container/catalog min-w-0">
                <div className="hidden @min-[56rem]/catalog:block">
                    <Table className="table-fixed">
                        <TableCaption className="sr-only">
                            {t("honestSign.catalog.products.tableDescription")}
                        </TableCaption>
                        <TableHeader className="bg-muted/35">
                            <TableRow className="hover:bg-transparent [&>th]:h-11 [&>th]:text-xs [&>th]:font-medium [&>th]:text-muted-foreground">
                                <TableHead className="w-48 pl-4">
                                    {t("honestSign.catalog.gtin")}
                                </TableHead>
                                <TableHead>
                                    {t("honestSign.catalog.products.product")}
                                </TableHead>
                                <TableHead className="hidden w-32 @min-[72rem]/catalog:table-cell">
                                    {t("honestSign.catalog.products.brand")}
                                </TableHead>
                                <TableHead className="hidden w-28 @min-[80rem]/catalog:table-cell">
                                    {t("honestSign.catalog.products.tnved")}
                                </TableHead>
                                <TableHead className="hidden w-40 @min-[64rem]/catalog:table-cell">
                                    {t("honestSign.catalog.products.updated")}
                                </TableHead>
                                <TableHead className="w-52">
                                    {t("honestSign.catalog.products.status")}
                                </TableHead>
                                <TableHead className="w-64 pr-4 text-right">
                                    {t("honestSign.catalog.actions")}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {items.map((product) => (
                                <TableRow
                                    key={product.goodId}
                                    className="group bg-card transition-colors focus-within:bg-primary/[0.035] hover:bg-primary/[0.025] motion-reduce:transition-none [&>td]:py-3"
                                >
                                    <TableCell className="pl-4">
                                        <div className="flex items-center gap-3">
                                            <span
                                                className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground"
                                                aria-hidden="true"
                                            >
                                                <Package className="size-4" />
                                            </span>
                                            <span className="font-mono text-xs font-medium wrap-anywhere whitespace-normal tabular-nums">
                                                {product.gtin ||
                                                    t(
                                                        "honestSign.catalog.pendingGtin",
                                                    )}
                                            </span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="min-w-0 whitespace-normal">
                                        <ProductName
                                            product={product}
                                            busy={busy}
                                            onOpen={onOpen}
                                        />
                                        <p className="mt-1 text-xs wrap-anywhere text-muted-foreground @min-[72rem]/catalog:hidden">
                                            {product.brand || "—"}
                                        </p>
                                    </TableCell>
                                    <TableCell className="hidden text-sm wrap-anywhere whitespace-normal @min-[72rem]/catalog:table-cell">
                                        {product.brand || "—"}
                                    </TableCell>
                                    <TableCell className="hidden font-mono text-xs @min-[80rem]/catalog:table-cell">
                                        {product.tnved || "—"}
                                    </TableCell>
                                    <TableCell className="hidden text-xs text-muted-foreground @min-[64rem]/catalog:table-cell">
                                        {product.updatedAt || "—"}
                                    </TableCell>
                                    <TableCell className="whitespace-normal">
                                        <CatalogProductStatus
                                            product={product}
                                        />
                                    </TableCell>
                                    <TableCell className="pr-4">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <ProductActions
                                                product={product}
                                                busy={busy}
                                                openingGoodId={openingGoodId}
                                                onOpen={onOpen}
                                            />
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </div>
                <ul className="divide-y @min-[56rem]/catalog:hidden">
                    {items.map((product) => (
                        <li
                            key={product.goodId}
                            className="space-y-3 bg-card p-4"
                        >
                            <div className="flex items-start gap-3">
                                <span
                                    className="flex size-10 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-muted-foreground"
                                    aria-hidden="true"
                                >
                                    <Package className="size-5" />
                                </span>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm leading-5 font-medium wrap-anywhere">
                                        {product.name ||
                                            t(
                                                "honestSign.catalog.products.unnamed",
                                            )}
                                    </p>
                                    <p className="mt-1 text-xs wrap-anywhere text-muted-foreground">
                                        {product.brand || "—"}
                                    </p>
                                    <p className="mt-2 font-mono text-xs font-medium wrap-anywhere tabular-nums">
                                        {product.gtin ||
                                            t("honestSign.catalog.pendingGtin")}
                                    </p>
                                </div>
                            </div>
                            <CatalogProductStatus product={product} />
                            <dl className="flex flex-wrap gap-x-6 gap-y-2 text-xs">
                                {product.tnved && (
                                    <div>
                                        <dt className="text-muted-foreground">
                                            {t(
                                                "honestSign.catalog.products.tnved",
                                            )}
                                        </dt>
                                        <dd className="mt-1 font-mono">
                                            {product.tnved}
                                        </dd>
                                    </div>
                                )}
                                {product.updatedAt && (
                                    <div>
                                        <dt className="text-muted-foreground">
                                            {t(
                                                "honestSign.catalog.products.updated",
                                            )}
                                        </dt>
                                        <dd className="mt-1 tabular-nums">
                                            {product.updatedAt}
                                        </dd>
                                    </div>
                                )}
                            </dl>
                            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-dashed pt-3">
                                <ProductActions
                                    product={product}
                                    busy={busy}
                                    openingGoodId={openingGoodId}
                                    onOpen={onOpen}
                                />
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </TooltipProvider>
    );
}
