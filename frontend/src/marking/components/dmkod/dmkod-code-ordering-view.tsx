import {
    CalendarDays,
    CircleAlert,
    CircleCheck,
    Clock3,
    FileSignature,
    RefreshCw,
    Sparkles,
    Trash2,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    DmKodIconAction,
    DmKodListToolbar,
} from "@marking/components/dmkod/dmkod-compact-controls";
import { DmKodOrderProducts } from "@marking/components/dmkod/dmkod-order-products";
import { Alert, AlertDescription } from "@marking/components/ui/alert";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Empty, EmptyHeader, EmptyDescription } from "@marking/components/ui/empty";
import { codeRequestOutcome } from "@marking/lib/dmkod-code-ordering-policy";
import { canSignCodeRequest } from "@marking/lib/dmkod-request-signing-policy";

import type { DmKodOrderItem } from "@marking/lib/dmkod-types";
import type {
    DmKodCodeRequest,
    DmKodOrderOperation,
} from "@marking/lib/dmkod-workflow-types";

export function DmKodCodeOrderingView({
    companyId,
    section = "all",
    onShowRequests,
    onShowCodes,
    items,
    requests,
    loading,
    fetching,
    failed,
    blocked,
    onOperation,
    onSign,
    onRefresh,
}: {
    companyId: string;
    section?: "all" | "codes" | "requests";
    onShowRequests?: () => void;
    onShowCodes?: () => void;
    items: DmKodOrderItem[];
    requests: DmKodCodeRequest[];
    loading: boolean;
    fetching: boolean;
    failed: boolean;
    blocked: boolean;
    onOperation: (
        operation: DmKodOrderOperation,
        values?: Record<string, string>,
    ) => void;
    onSign: (id: number) => void;
    onRefresh: () => void;
}) {
    const { t, i18n } = useTranslation();
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const number = (value: number) =>
        new Intl.NumberFormat(i18n.language).format(value);
    const query = search.trim().toLocaleLowerCase();
    const filtered = requests.filter((request) =>
        [
            String(request.id),
            request.uuid,
            request.type,
            request.state,
            ...(request.items ?? []).map(
                (row) => row.gtin ?? String(row.orderItemId),
            ),
        ].some((value) => value?.toLocaleLowerCase().includes(query)),
    );
    const pages = Math.max(1, Math.ceil(filtered.length / 10));
    const currentPage = Math.min(page, pages);
    return (
        <div className="flex flex-col gap-3">
            {section === "codes" && failed ? (
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertDescription>
                        {t("dmkod.workflow.loadFailed")}
                        <Button variant="outline" size="sm" onClick={onRefresh}>
                            {t("common.retry")}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {section !== "codes" ? (
                <section
                    className="flex flex-col gap-3"
                    aria-labelledby="dmkod-code-requests-title"
                >
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2">
                        <h2
                            id="dmkod-code-requests-title"
                            className="flex items-center gap-2 text-sm font-semibold"
                        >
                            {t("dmkod.orderLayout.tabs.requests")}{" "}
                            <Badge variant="secondary">
                                {loading || failed
                                    ? "—"
                                    : number(requests.length)}
                            </Badge>
                        </h2>
                        <div className="flex items-center gap-1">
                            <DmKodIconAction
                                label={t("dmkod.codeOrdering.refreshRequests")}
                                onClick={onRefresh}
                                disabled={fetching || blocked}
                            >
                                <RefreshCw
                                    className={
                                        fetching
                                            ? "animate-spin motion-reduce:animate-none"
                                            : undefined
                                    }
                                    aria-hidden="true"
                                />
                            </DmKodIconAction>
                            <DmKodIconAction
                                label={t("dmkod.codeOrdering.generate")}
                                disabled={
                                    blocked ||
                                    !items.length ||
                                    loading ||
                                    failed
                                }
                                onClick={() => onOperation("GenerateRequests")}
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
                        label={t("dmkod.orderLayout.searchRequests")}
                        found={filtered.length}
                        total={requests.length}
                        page={currentPage}
                        pages={pages}
                        onPage={setPage}
                        countLabel={
                            loading || failed
                                ? "—"
                                : t("dmkod.orderLayout.requestsFound", {
                                      found: number(filtered.length),
                                      total: number(requests.length),
                                  })
                        }
                    />
                    {loading ? (
                        <p
                            role="status"
                            className="px-3 py-4 text-sm text-muted-foreground"
                        >
                            {t("common.loading")}
                        </p>
                    ) : failed ? (
                        <Alert variant="destructive">
                            <CircleAlert aria-hidden="true" />
                            <AlertDescription>
                                {t("dmkod.workflow.loadFailed")}
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={onRefresh}
                                >
                                    {t("common.retry")}
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : !filtered.length ? (
                        <Empty className="border py-6 md:py-6">
                            <EmptyHeader>
                                <EmptyDescription>
                                    {t(
                                        requests.length
                                            ? "dmkod.orderLayout.noRequestMatches"
                                            : items.length
                                              ? "dmkod.codeOrdering.emptyRequests"
                                              : "dmkod.codeOrdering.addProductsFirst",
                                    )}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    ) : null}
                    <ul className="flex flex-col gap-2">
                        {filtered
                            .slice((currentPage - 1) * 10, currentPage * 10)
                            .map((request) => {
                                const outcome = codeRequestOutcome(
                                    request.state,
                                );
                                const StatusIcon =
                                    outcome === "accepted"
                                        ? CircleCheck
                                        : outcome === "pending"
                                          ? Clock3
                                          : outcome === "sign"
                                            ? FileSignature
                                            : CircleAlert;
                                return (
                                    <li
                                        key={request.id}
                                        className="grid items-start gap-2 lg:grid-cols-2"
                                    >
                                        <article className="min-w-0 rounded-lg border bg-card px-3 py-2.5">
                                            <div className="flex items-center gap-2">
                                                <StatusIcon
                                                    className="size-4 shrink-0 text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                                <h3 className="mr-auto text-sm font-semibold">
                                                    {t(
                                                        `dmkod.codeOrdering.states.${request.state}`,
                                                        {
                                                            defaultValue:
                                                                request.state,
                                                        },
                                                    )}
                                                </h3>
                                                {canSignCodeRequest(request) ? (
                                                    <>
                                                        <Button
                                                            size="sm"
                                                            className="h-auto min-h-9 whitespace-normal"
                                                            aria-label={t(
                                                                "dmkod.orderLayout.signRequest",
                                                                {
                                                                    id: request.id,
                                                                },
                                                            )}
                                                            disabled={
                                                                blocked ||
                                                                failed
                                                            }
                                                            onClick={() =>
                                                                onSign(
                                                                    request.id,
                                                                )
                                                            }
                                                        >
                                                            <FileSignature aria-hidden="true" />
                                                            {t(
                                                                "dmkod.workflow.sign",
                                                            )}
                                                        </Button>
                                                        <DmKodIconAction
                                                            label={t(
                                                                "dmkod.orderLayout.deleteRequest",
                                                                {
                                                                    id: request.id,
                                                                },
                                                            )}
                                                            disabled={
                                                                blocked ||
                                                                failed
                                                            }
                                                            onClick={() =>
                                                                onOperation(
                                                                    "DeleteRequest",
                                                                    {
                                                                        requestId:
                                                                            String(
                                                                                request.id,
                                                                            ),
                                                                    },
                                                                )
                                                            }
                                                        >
                                                            <Trash2
                                                                className="text-destructive"
                                                                aria-hidden="true"
                                                            />
                                                        </DmKodIconAction>
                                                    </>
                                                ) : outcome === "pending" ? (
                                                    <DmKodIconAction
                                                        label={t(
                                                            "dmkod.codeOrdering.checkResponse",
                                                        )}
                                                        disabled={
                                                            blocked || failed
                                                        }
                                                        onClick={() =>
                                                            onOperation(
                                                                "PullRequest",
                                                                {
                                                                    requestId:
                                                                        String(
                                                                            request.id,
                                                                        ),
                                                                },
                                                            )
                                                        }
                                                    >
                                                        <RefreshCw aria-hidden="true" />
                                                    </DmKodIconAction>
                                                ) : outcome === "accepted" &&
                                                  request.type === "CODES" &&
                                                  onShowCodes ? (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={onShowCodes}
                                                    >
                                                        {t(
                                                            "dmkod.orderLayout.tabs.codes",
                                                        )}
                                                    </Button>
                                                ) : null}
                                            </div>
                                            <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                                <span className="font-mono">
                                                    #{request.id}
                                                </span>
                                                {request.createdAtUtc ? (
                                                    <span className="flex items-center gap-1">
                                                        <CalendarDays
                                                            className="size-3"
                                                            aria-hidden="true"
                                                        />
                                                        {new Intl.DateTimeFormat(
                                                            i18n.language,
                                                            {
                                                                dateStyle:
                                                                    "short",
                                                                timeStyle:
                                                                    "short",
                                                            },
                                                        ).format(
                                                            new Date(
                                                                request.createdAtUtc,
                                                            ),
                                                        )}
                                                    </span>
                                                ) : null}
                                            </div>
                                            {request.failureReason ? (
                                                <p
                                                    role="alert"
                                                    className="mt-2 text-xs break-words text-destructive"
                                                >
                                                    {request.failureReason}
                                                </p>
                                            ) : null}
                                            {request.uuid ? (
                                                <details className="mt-2 border-t pt-2 text-xs text-muted-foreground">
                                                    <summary className="cursor-pointer focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-ring">
                                                        {t(
                                                            "dmkod.orderLayout.details",
                                                        )}
                                                    </summary>
                                                    <p className="mt-2 font-mono break-all">
                                                        {request.uuid}
                                                    </p>
                                                    <p className="mt-1">
                                                        {t(
                                                            section ===
                                                                "requests" &&
                                                                outcome ===
                                                                    "accepted"
                                                                ? "dmkod.orderLayout.requestAccepted"
                                                                : `dmkod.codeOrdering.outcomes.${outcome}`,
                                                        )}
                                                    </p>
                                                </details>
                                            ) : null}
                                        </article>
                                        <div className="min-w-0 rounded-lg border bg-card px-3 py-2.5">
                                            <p className="mb-2 text-xs font-medium text-muted-foreground">
                                                {t(
                                                    request.type === "CANCEL"
                                                        ? "dmkod.codeOrdering.cancellation"
                                                        : "dmkod.codeOrdering.codes",
                                                )}
                                            </p>
                                            {request.items?.length ? (
                                                <ul className="flex flex-col gap-2">
                                                    {request.items.map(
                                                        (row, index) => {
                                                            const product =
                                                                items.find(
                                                                    (item) =>
                                                                        row.orderItemId !==
                                                                        null
                                                                            ? row.orderItemId ===
                                                                              item.id
                                                                            : !!row.gtin &&
                                                                              row.gtin ===
                                                                                  item
                                                                                      .product
                                                                                      ?.gtin,
                                                                );
                                                            return (
                                                                <li
                                                                    key={`${row.orderItemId ?? row.gtin}-${index}`}
                                                                    className="flex flex-wrap items-center gap-2 text-sm"
                                                                >
                                                                    {row.orderItemId !==
                                                                    null ? (
                                                                        <span className="text-xs text-muted-foreground">
                                                                            #
                                                                            {
                                                                                row.orderItemId
                                                                            }
                                                                        </span>
                                                                    ) : null}
                                                                    <span className="min-w-0 font-mono break-all">
                                                                        {row.gtin ||
                                                                            product
                                                                                ?.product
                                                                                ?.gtin ||
                                                                            "—"}
                                                                    </span>
                                                                    {product
                                                                        ?.product
                                                                        ?.group ? (
                                                                        <Badge
                                                                            variant="secondary"
                                                                            className="ml-auto"
                                                                        >
                                                                            {
                                                                                product
                                                                                    .product
                                                                                    .group
                                                                            }
                                                                        </Badge>
                                                                    ) : null}
                                                                    {row.quantity !==
                                                                    null ? (
                                                                        <Badge
                                                                            variant="outline"
                                                                            className="ml-auto"
                                                                        >
                                                                            {number(
                                                                                row.quantity,
                                                                            )}
                                                                        </Badge>
                                                                    ) : null}
                                                                </li>
                                                            );
                                                        },
                                                    )}
                                                </ul>
                                            ) : (
                                                <p className="text-xs text-muted-foreground">
                                                    {t(
                                                        "dmkod.orderLayout.requestItemsMissing",
                                                    )}
                                                </p>
                                            )}
                                        </div>
                                    </li>
                                );
                            })}
                    </ul>
                </section>
            ) : null}
            {section !== "requests" ? (
                <DmKodOrderProducts
                    companyId={companyId}
                    items={items}
                    requests={requests}
                    requestsKnown={!loading && !failed}
                    blocked={blocked}
                    onOperation={onOperation}
                    onShowRequests={onShowRequests}
                />
            ) : null}
        </div>
    );
}
