import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDmKodScope } from "@marking/components/dmkod/dmkod-scope-context";
import { Button } from "@marking/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@marking/components/ui/card";
import { Input } from "@marking/components/ui/input";
import { Label } from "@marking/components/ui/label";
import { dmKodKeys } from "@marking/hooks/use-dmkod";
import { dmKodWorkflowApi } from "@marking/lib/api/dmkod-workflow";

export function DmKodUtilisationHistory({ companyId }: { companyId: string }) {
    const { t, i18n } = useTranslation();
    const scope = useDmKodScope(companyId);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState("");
    const [draft, setDraft] = useState("");
    const [selected, setSelected] = useState<{
        kind: "session" | "order" | "order-sessions";
        id: number;
    } | null>(null);
    const query = useQuery({
        queryKey: [
            ...dmKodKeys.scoped(scope),
            "utilisation-history",
            page,
            search,
        ],
        queryFn: () =>
            dmKodWorkflowApi.sessions(scope, {
                page,
                pageSize: 10,
                search: search || undefined,
            }),
        retry: false,
    });
    const details = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "utilisation-details", selected],
        queryFn: () =>
            dmKodWorkflowApi.details(scope, selected!.kind, selected!.id),
        enabled: !!selected,
        retry: false,
    });
    const [orderInput, setOrderInput] = useState("");
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("dmkod.history.title")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
                <form
                    onSubmit={(event) => {
                        event.preventDefault();
                        setSearch(draft.trim());
                        setPage(1);
                    }}
                    className="flex flex-wrap gap-2"
                >
                    <Input
                        className="min-w-0 flex-1"
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        aria-label={t("dmkod.orders.search")}
                        placeholder={t("dmkod.orders.search")}
                    />
                    <Button type="submit" variant="outline">
                        {t("dmkod.orders.apply")}
                    </Button>
                </form>
                {query.isLoading ? (
                    <p role="status">{t("common.loading")}</p>
                ) : query.isError ? (
                    <p role="alert">
                        {t("dmkod.workflow.loadFailed")}{" "}
                        <Button
                            variant="outline"
                            onClick={() => void query.refetch()}
                        >
                            {t("common.retry")}
                        </Button>
                    </p>
                ) : !query.data?.items.length ? (
                    <p className="text-sm text-muted-foreground">
                        {t("dmkod.history.empty")}
                    </p>
                ) : (
                    <ul className="space-y-2">
                        {query.data.items.map((item) => (
                            <li
                                key={item.id}
                                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                            >
                                <div className="text-sm">
                                    #{item.id} ·{" "}
                                    {item.createdAtUtc
                                        ? new Date(
                                              item.createdAtUtc,
                                          ).toLocaleString(i18n.language)
                                        : "—"}
                                    <p className="text-muted-foreground">
                                        {t("dmkod.history.counts", {
                                            included: item.included ?? "—",
                                            excluded: item.excluded ?? "—",
                                            notFound: item.notFound ?? "—",
                                        })}
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    onClick={() =>
                                        setSelected({
                                            kind: "session",
                                            id: item.id,
                                        })
                                    }
                                >
                                    {t("dmkod.history.details")}
                                </Button>
                            </li>
                        ))}
                    </ul>
                )}
                <div className="flex items-center justify-between">
                    <Button
                        variant="outline"
                        disabled={page <= 1 || query.isFetching}
                        onClick={() => setPage((value) => value - 1)}
                    >
                        {t("dmkod.history.previous")}
                    </Button>
                    <span className="text-sm">
                        {page} / {query.data?.pages ?? 1}
                    </span>
                    <Button
                        variant="outline"
                        disabled={
                            !query.data ||
                            page >= query.data.pages ||
                            query.isFetching
                        }
                        onClick={() => setPage((value) => value + 1)}
                    >
                        {t("dmkod.history.next")}
                    </Button>
                </div>
                <div className="space-y-2 border-t pt-3">
                    <Label htmlFor="dmkod-history-order">
                        {t("dmkod.reports.orderId")}
                    </Label>
                    <Input
                        id="dmkod-history-order"
                        inputMode="numeric"
                        value={orderInput}
                        onChange={(event) => setOrderInput(event.target.value)}
                    />
                    <div className="flex flex-wrap gap-2">
                        {(["order", "order-sessions"] as const).map((kind) => (
                            <Button
                                key={kind}
                                variant="outline"
                                disabled={
                                    !/^[1-9][0-9]*$/.test(orderInput) ||
                                    !Number.isSafeInteger(Number(orderInput))
                                }
                                onClick={() =>
                                    setSelected({
                                        kind,
                                        id: Number(orderInput),
                                    })
                                }
                            >
                                {t(
                                    kind === "order"
                                        ? "dmkod.history.order"
                                        : "dmkod.history.orderSessions",
                                )}
                            </Button>
                        ))}
                    </div>
                </div>
                {selected ? (
                    <section className="space-y-2 rounded-md border p-3">
                        <h4 className="font-medium">
                            {t("dmkod.history.details")} #{selected.id}
                        </h4>
                        {details.isLoading ? (
                            <p>{t("common.loading")}</p>
                        ) : details.isError ? (
                            <p role="alert">
                                {t("dmkod.workflow.loadFailed")}{" "}
                                <Button
                                    variant="outline"
                                    onClick={() => void details.refetch()}
                                >
                                    {t("common.retry")}
                                </Button>
                            </p>
                        ) : !details.data?.items.length ? (
                            <p>{t("dmkod.history.empty")}</p>
                        ) : (
                            details.data.items.map((item, index) => (
                                <div
                                    key={index}
                                    className="border-t pt-2 text-sm"
                                >
                                    <p>
                                        {item.productName || item.gtin || "—"} ·{" "}
                                        {item.itemId ?? "—"}
                                    </p>
                                    <dl className="grid grid-cols-2 gap-1">
                                        {Object.entries(item.counts).map(
                                            ([name, count]) => (
                                                <div
                                                    key={name}
                                                    className="flex gap-2"
                                                >
                                                    <dt>{name}</dt>
                                                    <dd>{count ?? "—"}</dd>
                                                </div>
                                            ),
                                        )}
                                    </dl>
                                </div>
                            ))
                        )}
                    </section>
                ) : null}
            </CardContent>
        </Card>
    );
}
