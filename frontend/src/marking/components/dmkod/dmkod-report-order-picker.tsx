import { CircleAlert, Search } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDmKodScope } from "@marking/components/dmkod/dmkod-scope-context";
import { Alert, AlertDescription } from "@marking/components/ui/alert";
import { Button } from "@marking/components/ui/button";
import {
    Empty,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@marking/components/ui/empty";
import { Field, FieldLabel } from "@marking/components/ui/field";
import { Input } from "@marking/components/ui/input";
import { useDmKodOrder, useDmKodOrders } from "@marking/hooks/use-dmkod";

export function DmKodReportOrderPicker({
    companyId,
    value,
    onChange,
    enabled,
    locked,
}: {
    companyId: string;
    value: number | null;
    onChange: (id: number) => void;
    enabled: boolean;
    locked: boolean;
}) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const [open, setOpen] = useState(!value);
    const [input, setInput] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const orders = useDmKodOrders(
        scope,
        { page, pageSize: 10, search: search || undefined },
        enabled && open,
    );
    const selected = useDmKodOrder(scope, enabled ? value : null);
    return (
        <div className="flex flex-col gap-3">
            {value ? (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex min-w-0 flex-col gap-1">
                        <p className="font-medium">
                            {t("dmkod.reports.order", { id: value })}
                        </p>
                        <p className="text-sm break-words text-muted-foreground">
                            {selected.data?.order.participant?.name}{" "}
                            {selected.data?.order.attributes.productionOrderId}
                        </p>
                    </div>
                    <Button
                        variant="outline"
                        disabled={locked}
                        onClick={() => setOpen(!open)}
                    >
                        {t(
                            open
                                ? "common.cancel"
                                : "dmkod.application.changeOrder",
                        )}
                    </Button>
                </div>
            ) : null}
            {open ? (
                <div className="flex flex-col gap-3 rounded-lg border p-3">
                    <form
                        className="flex flex-col gap-2 sm:flex-row sm:items-end"
                        onSubmit={(event) => {
                            event.preventDefault();
                            setSearch(input.trim());
                            setPage(1);
                        }}
                    >
                        <Field className="min-w-0 flex-1">
                            <FieldLabel htmlFor="dmkod-report-order-search">
                                {t("dmkod.application.chooseOrder")}
                            </FieldLabel>
                            <Input
                                id="dmkod-report-order-search"
                                placeholder={t(
                                    "dmkod.application.searchPlaceholder",
                                )}
                                value={input}
                                onChange={(event) =>
                                    setInput(event.target.value)
                                }
                                disabled={locked}
                            />
                        </Field>
                        <Button
                            type="submit"
                            variant="outline"
                            disabled={locked || orders.isFetching}
                        >
                            <Search aria-hidden="true" />
                            {t("dmkod.application.search")}
                        </Button>
                    </form>
                    {orders.isLoading ? (
                        <p role="status" className="text-sm">
                            {t("dmkod.reports.loading")}
                        </p>
                    ) : orders.isError ? (
                        <Alert variant="destructive">
                            <CircleAlert aria-hidden="true" />
                            <AlertDescription>
                                {t("dmkod.orders.loadFailed")}
                                <Button
                                    variant="outline"
                                    onClick={() => void orders.refetch()}
                                >
                                    {t("common.retry")}
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : orders.data?.orders.length ? (
                        <ul className="flex flex-col gap-2">
                            {orders.data.orders.map((order) => (
                                <li key={order.id}>
                                    <Button
                                        variant="outline"
                                        className="h-auto w-full justify-start p-3 text-left whitespace-normal"
                                        disabled={locked || orders.isFetching}
                                        onClick={() => {
                                            onChange(order.id);
                                            setOpen(false);
                                        }}
                                    >
                                        <span className="flex min-w-0 flex-col gap-1">
                                            <span>
                                                {t("dmkod.reports.order", {
                                                    id: order.id,
                                                })}{" "}
                                                · {order.participant?.name}
                                            </span>
                                            <span className="text-xs break-words text-muted-foreground">
                                                {order.attributes
                                                    .productionOrderId ||
                                                    t(
                                                        "dmkod.application.noOrderName",
                                                    )}{" "}
                                                ·{" "}
                                                {t(
                                                    "dmkod.application.positions",
                                                    { count: order.itemsCount },
                                                )}
                                            </span>
                                        </span>
                                    </Button>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <Empty className="border">
                            <EmptyHeader>
                                <EmptyTitle>
                                    {t("dmkod.application.noOrders")}
                                </EmptyTitle>
                                <EmptyDescription>
                                    {t("dmkod.application.noOrdersHint")}
                                </EmptyDescription>
                            </EmptyHeader>
                        </Empty>
                    )}
                    {(orders.data?.pages ?? 0) > 1 ? (
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <Button
                                variant="outline"
                                disabled={
                                    locked || page <= 1 || orders.isFetching
                                }
                                onClick={() => setPage(page - 1)}
                            >
                                {t("dmkod.orders.previous")}
                            </Button>
                            <span className="text-sm">
                                {page} / {orders.data?.pages}
                            </span>
                            <Button
                                variant="outline"
                                disabled={
                                    locked ||
                                    page >= (orders.data?.pages ?? 1) ||
                                    orders.isFetching
                                }
                                onClick={() => setPage(page + 1)}
                            >
                                {t("dmkod.orders.next")}
                            </Button>
                        </div>
                    ) : null}
                    <p className="text-xs text-muted-foreground">
                        {t("dmkod.application.orderHint")}
                    </p>
                </div>
            ) : null}
        </div>
    );
}
