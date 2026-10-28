import {
    ArrowDownUp,
    CalendarDays,
    Database,
    Download,
    FileSignature,
    FileUp,
    MoreHorizontal,
    Pencil,
    Plus,
    Sparkles,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    DmKodIconAction,
    DmKodListToolbar,
} from "@marking/components/dmkod/dmkod-compact-controls";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@marking/components/ui/dropdown-menu";
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@marking/components/ui/empty";
import { useDmKodCabinetLabels } from "@marking/hooks/use-dmkod-cabinet-labels";
import {
    canReceiveOrderItem,
    codeRequestOutcome,
    latestOrderItemRequest,
} from "@marking/lib/dmkod-code-ordering-policy";

import type { DmKodOrderItem } from "@marking/lib/dmkod-types";
import type {
    DmKodCodeRequest,
    DmKodOrderOperation,
} from "@marking/lib/dmkod-workflow-types";

type Props = {
    companyId: string;
    items: DmKodOrderItem[];
    requests: DmKodCodeRequest[];
    requestsKnown?: boolean;
    blocked: boolean;
    onOperation: (
        operation: DmKodOrderOperation,
        values?: Record<string, string>,
    ) => void;
    onShowRequests?: () => void;
};

export function DmKodOrderProducts({
    companyId,
    items,
    requests,
    requestsKnown = true,
    blocked,
    onOperation,
    onShowRequests,
}: Props) {
    const { t, i18n } = useTranslation();
    const labels = useDmKodCabinetLabels(companyId);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [descending, setDescending] = useState(false);
    const number = (value: number) =>
        new Intl.NumberFormat(i18n.language).format(value);
    const query = search.trim().toLocaleLowerCase();
    const filtered = items
        .filter((item) =>
            [
                item.product?.gtin,
                item.product?.name,
                item.tag,
                String(item.id),
            ].some((value) => value?.toLocaleLowerCase().includes(query)),
        )
        .sort(
            (a, b) =>
                (a.product?.gtin ?? String(a.id)).localeCompare(
                    b.product?.gtin ?? String(b.id),
                    i18n.language,
                    { numeric: true },
                ) * (descending ? -1 : 1),
        );
    const pages = Math.max(1, Math.ceil(filtered.length / 20));
    const currentPage = Math.min(page, pages);

    return (
        <section
            className="flex flex-col gap-3"
            aria-labelledby="dmkod-products-title"
        >
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
                <h2
                    id="dmkod-products-title"
                    className="flex items-center gap-2 text-sm font-semibold"
                >
                    {t("dmkod.codeOrdering.products")}{" "}
                    <Badge variant="secondary">{number(items.length)}</Badge>
                </h2>
                <div className="flex items-center gap-1">
                    <DmKodIconAction
                        label={t("dmkod.codeOrdering.addProduct")}
                        disabled={blocked}
                        onClick={() => onOperation("CreateItem")}
                    >
                        <Plus aria-hidden="true" />
                    </DmKodIconAction>
                    <DmKodIconAction
                        label={t("dmkod.orderLayout.importCodes")}
                        disabled={blocked}
                        onClick={() => onOperation("ImportItems")}
                    >
                        <FileUp aria-hidden="true" />
                    </DmKodIconAction>
                    <DmKodIconAction
                        label={t("dmkod.codeOrdering.generate")}
                        disabled={blocked || !items.length || !requestsKnown}
                        onClick={() => {
                            onShowRequests?.();
                            onOperation("GenerateRequests");
                        }}
                    >
                        <Sparkles aria-hidden="true" />
                    </DmKodIconAction>
                </div>
            </div>
            <DmKodListToolbar
                search={search}
                onSearch={(value) => {
                    setSearch(value);
                    setPage(1);
                }}
                label={t("dmkod.orderLayout.searchProducts")}
                found={filtered.length}
                total={items.length}
                page={currentPage}
                pages={pages}
                onPage={setPage}
            >
                <DmKodIconAction
                    label={t("dmkod.orderLayout.sortProducts")}
                    onClick={() => setDescending(!descending)}
                >
                    <ArrowDownUp aria-hidden="true" />
                </DmKodIconAction>
            </DmKodListToolbar>
            {!filtered.length ? (
                <Empty className="border py-6 md:py-6">
                    <EmptyHeader>
                        <EmptyTitle>
                            {t(
                                items.length
                                    ? "dmkod.orderLayout.noMatches"
                                    : "dmkod.orders.details.noItems",
                            )}
                        </EmptyTitle>
                        <EmptyDescription>
                            {t(
                                items.length
                                    ? "dmkod.orderLayout.noMatchesHint"
                                    : "dmkod.codeOrdering.addProductsFirst",
                            )}
                        </EmptyDescription>
                    </EmptyHeader>
                    {!items.length ? (
                        <EmptyContent>
                            <Button
                                disabled={blocked}
                                onClick={() => onOperation("CreateItem")}
                            >
                                {t("dmkod.codeOrdering.addProduct")}
                            </Button>
                        </EmptyContent>
                    ) : null}
                </Empty>
            ) : null}
            <ul className="flex flex-col gap-2">
                {filtered
                    .slice((currentPage - 1) * 20, currentPage * 20)
                    .map((item) => {
                        const canReceive =
                            requestsKnown &&
                            canReceiveOrderItem(item, requests);
                        const received = item.receivedQuantity;
                        const canDownload =
                            (received ?? 0) > 0 || item.source === "FILE";
                        const request = latestOrderItemRequest(item, requests);
                        const outcome = codeRequestOutcome(
                            request?.state ?? "",
                        );
                        const requestQuantity = request?.items?.find(
                            (row) =>
                                row.orderItemId === item.id ||
                                (row.orderItemId == null &&
                                    !!row.gtin &&
                                    row.gtin === item.product?.gtin),
                        )?.quantity;
                        const statusKey = canDownload
                            ? received != null && received > 0
                                ? "received"
                                : "imported"
                            : !requestsKnown
                              ? "unknownRequest"
                              : canReceive
                                ? "ready"
                                : !request
                                  ? "noRequest"
                                  : outcome === "sign"
                                    ? "awaitingSignature"
                                    : outcome === "rejected"
                                      ? "requestDeclined"
                                      : outcome === "pending"
                                        ? "awaitingResponse"
                                        : "unknownRequest";
                        return (
                            <li
                                key={item.id}
                                className="grid items-start gap-2 lg:grid-cols-2"
                            >
                                <article className="min-w-0 rounded-lg border bg-card px-3 py-2.5">
                                    <div className="flex items-center gap-2">
                                        <h3 className="min-w-0 font-mono text-sm font-semibold break-all">
                                            {item.product?.gtin ||
                                                `#${item.id}`}
                                        </h3>
                                        {item.flag ? (
                                            <Badge
                                                variant="secondary"
                                                className="max-w-[45%] shrink-0 break-words whitespace-normal"
                                            >
                                                {labels(
                                                    "ORDER_ITEM_FLAG",
                                                    item.flag,
                                                    t(
                                                        `dmkod.orderLayout.itemStates.${item.flag}`,
                                                        {
                                                            defaultValue:
                                                                item.flag,
                                                        },
                                                    ),
                                                )}
                                            </Badge>
                                        ) : null}
                                        <span className="ml-auto text-base font-semibold tabular-nums">
                                            {number(item.quantity)}
                                        </span>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8 shrink-0"
                                                    aria-label={t(
                                                        "dmkod.orderLayout.productActions",
                                                        {
                                                            gtin:
                                                                item.product
                                                                    ?.gtin ||
                                                                item.id,
                                                        },
                                                    )}
                                                    disabled={blocked}
                                                >
                                                    <MoreHorizontal aria-hidden="true" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                align="end"
                                                className="integration-theme dmkod-theme"
                                            >
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        onOperation(
                                                            "UpdateItem",
                                                            {
                                                                itemId: String(
                                                                    item.id,
                                                                ),
                                                                gtin:
                                                                    item.product
                                                                        ?.gtin ||
                                                                    "",
                                                                templateId:
                                                                    item.templateId ||
                                                                    "",
                                                                cisType:
                                                                    item.product
                                                                        ?.cisType ||
                                                                    "",
                                                                quantity:
                                                                    String(
                                                                        item.quantity,
                                                                    ),
                                                                tag:
                                                                    item.tag ||
                                                                    "",
                                                                flag:
                                                                    item.flag ||
                                                                    "",
                                                            },
                                                        )
                                                    }
                                                >
                                                    <Pencil aria-hidden="true" />
                                                    {t(
                                                        "dmkod.workflow.operations.UpdateItem",
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        onOperation(
                                                            "FixCodes",
                                                            {
                                                                itemId: String(
                                                                    item.id,
                                                                ),
                                                            },
                                                        )
                                                    }
                                                >
                                                    {t(
                                                        "dmkod.workflow.operations.FixCodes",
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuItem
                                                    onSelect={() =>
                                                        onOperation(
                                                            "GenerateCancellation",
                                                            {
                                                                itemId: String(
                                                                    item.id,
                                                                ),
                                                            },
                                                        )
                                                    }
                                                >
                                                    {t(
                                                        "dmkod.workflow.operations.GenerateCancellation",
                                                    )}
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem
                                                    variant="destructive"
                                                    onSelect={() =>
                                                        onOperation(
                                                            "DeleteItem",
                                                            {
                                                                itemId: String(
                                                                    item.id,
                                                                ),
                                                            },
                                                        )
                                                    }
                                                >
                                                    {t(
                                                        "dmkod.workflow.operations.DeleteItem",
                                                    )}
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    {item.product?.name ? (
                                        <p
                                            className="truncate text-xs text-muted-foreground"
                                            title={item.product.name}
                                        >
                                            {item.product.name}
                                        </p>
                                    ) : null}
                                    <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span className="min-w-0 break-words">
                                            #{item.id} ·{" "}
                                            {item.user?.displayName ||
                                                item.user?.username ||
                                                "—"}
                                        </span>
                                        {item.createdAtUtc ? (
                                            <span className="flex items-center gap-1">
                                                <CalendarDays
                                                    className="size-3"
                                                    aria-hidden="true"
                                                />
                                                {new Intl.DateTimeFormat(
                                                    i18n.language,
                                                    {
                                                        dateStyle: "short",
                                                        timeStyle: "short",
                                                    },
                                                ).format(
                                                    new Date(item.createdAtUtc),
                                                )}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="mt-2 flex flex-wrap gap-1.5 border-t pt-2">
                                        {item.product?.group ? (
                                            <Badge
                                                variant="secondary"
                                                className="max-w-full break-all whitespace-normal"
                                            >
                                                {labels(
                                                    "PRODUCT_GROUP",
                                                    item.product.group,
                                                )}
                                            </Badge>
                                        ) : null}
                                        {item.product?.cisType ? (
                                            <Badge variant="outline">
                                                {t(
                                                    `dmkod.orderLayout.cisTypes.${item.product.cisType}`,
                                                    {
                                                        defaultValue:
                                                            item.product
                                                                .cisType,
                                                    },
                                                )}
                                            </Badge>
                                        ) : null}
                                        {item.templateId ? (
                                            <Badge variant="outline">
                                                {labels(
                                                    "TEMPLATE_ID",
                                                    item.templateId,
                                                )}
                                            </Badge>
                                        ) : null}
                                        {item.tag ? (
                                            <Badge
                                                variant="outline"
                                                className="max-w-full break-all whitespace-normal"
                                            >
                                                {item.tag}
                                            </Badge>
                                        ) : null}
                                    </div>
                                </article>
                                <div className="min-w-0 space-y-2 rounded-lg border bg-card px-3 py-2 text-sm">
                                    {(
                                        [
                                            ["toSign", item.toSignQuantity],
                                            [
                                                "requested",
                                                item.requestedQuantity,
                                            ],
                                            ["rejected", item.rejectedQuantity],
                                            [
                                                "suspended",
                                                item.suspendedQuantity,
                                            ],
                                            [
                                                "available",
                                                item.availableQuantity,
                                            ],
                                            [
                                                "requestError",
                                                item.requestErrorQuantity,
                                            ],
                                            [
                                                "ready",
                                                statusKey === "ready"
                                                    ? null
                                                    : item.readyQuantity,
                                            ],
                                        ] as const
                                    )
                                        .filter(
                                            ([, count]) =>
                                                count != null && count > 0,
                                        )
                                        .map(([key, count]) => (
                                            <div
                                                key={key}
                                                className="flex items-center justify-between gap-2 text-muted-foreground"
                                            >
                                                <span>
                                                    {t(
                                                        `dmkod.cabinet.quantities.${key}`,
                                                    )}
                                                </span>
                                                <Badge variant="outline">
                                                    {number(count!)}
                                                </Badge>
                                            </div>
                                        ))}
                                    <div className="flex flex-wrap items-center gap-2">
                                        {canDownload || canReceive ? (
                                            <Database
                                                className="size-4 shrink-0 text-muted-foreground"
                                                aria-hidden="true"
                                            />
                                        ) : (
                                            <FileSignature
                                                className="size-4 shrink-0 text-muted-foreground"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <span className="mr-auto text-muted-foreground">
                                            {t(
                                                `dmkod.orderLayout.${statusKey}`,
                                            )}
                                        </span>
                                        {canDownload && received != null ? (
                                            <Badge variant="outline">
                                                {number(received)}
                                            </Badge>
                                        ) : requestQuantity != null ? (
                                            <Badge variant="outline">
                                                {number(requestQuantity)}
                                            </Badge>
                                        ) : null}
                                        {canDownload ? (
                                            <DmKodIconAction
                                                label={t(
                                                    "dmkod.orderLayout.downloadCodes",
                                                )}
                                                disabled={blocked}
                                                onClick={() =>
                                                    onOperation(
                                                        "DownloadCodes",
                                                        {
                                                            itemId: String(
                                                                item.id,
                                                            ),
                                                            range: "requested",
                                                            filetype: "csv",
                                                        },
                                                    )
                                                }
                                            >
                                                <Download aria-hidden="true" />
                                            </DmKodIconAction>
                                        ) : null}
                                        {canReceive &&
                                        item.readyQuantity !== 0 ? (
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                disabled={blocked}
                                                onClick={() =>
                                                    onOperation("PullCodes", {
                                                        itemId: String(item.id),
                                                        quantity: String(
                                                            item.readyQuantity ??
                                                                Math.max(
                                                                    1,
                                                                    item.quantity -
                                                                        (received ??
                                                                            0),
                                                                ),
                                                        ),
                                                    })
                                                }
                                            >
                                                {t(
                                                    "dmkod.orderLayout.receiveShort",
                                                )}
                                            </Button>
                                        ) : null}
                                        {!canDownload &&
                                        !canReceive &&
                                        onShowRequests ? (
                                            <DmKodIconAction
                                                label={t(
                                                    "dmkod.orderLayout.openRequests",
                                                )}
                                                onClick={onShowRequests}
                                            >
                                                <FileSignature aria-hidden="true" />
                                            </DmKodIconAction>
                                        ) : null}
                                    </div>
                                </div>
                            </li>
                        );
                    })}
            </ul>
        </section>
    );
}
