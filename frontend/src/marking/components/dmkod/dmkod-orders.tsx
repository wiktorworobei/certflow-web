import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
    CalendarRange,
    CircleAlert,
    LoaderCircle,
    PackageOpen,
    Plus,
    RefreshCw,
    UserRound,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import {
    DmKodIconAction,
    DmKodListToolbar,
} from "@marking/components/dmkod/dmkod-compact-controls";
import { DmKodEnvironmentTarget } from "@marking/components/dmkod/dmkod-environment-workspace";
import { DmKodOrderWorkspace } from "@marking/components/dmkod/dmkod-order-workspace";
import { useDmKodScope } from "@marking/components/dmkod/dmkod-scope-context";
import { Alert, AlertDescription, AlertTitle } from "@marking/components/ui/alert";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@marking/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@marking/components/ui/form";
import { Input } from "@marking/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@marking/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@marking/components/ui/select";
import { Skeleton } from "@marking/components/ui/skeleton";
import {
    dmKodKeys,
    useDmKodBackgroundTask,
    useDmKodCreateOrder,
    useDmKodCreateOrderOptions,
    useDmKodOrders,
} from "@marking/hooks/use-dmkod";
import { useDmKodCabinetLabels } from "@marking/hooks/use-dmkod-cabinet-labels";
import { dmKodApi } from "@marking/lib/api/dmkod";
import { dmKodScopeStorageKey, readDmKodOrderReceipt } from "@marking/lib/dmkod-scope";

import type { DmKodOrderReceipt } from "@marking/lib/dmkod-scope";
import type {
    DmKodDictionaryOption,
    DmKodOrder,
    DmKodOrdersSearch,
} from "@marking/lib/dmkod-types";
import type { Control, FieldPath, FieldValues } from "react-hook-form";

type DmKodOrdersProps = {
    companyId: string;
    enabled: boolean;
    selectedOrderId?: number | null;
    onOrderChange?: (id: number | null) => void;
};

const pageSize = 20;

export function DmKodOrders({
    companyId,
    enabled,
    selectedOrderId: selected,
    onOrderChange,
}: DmKodOrdersProps) {
    const { t, i18n } = useTranslation();
    const scope = useDmKodScope(companyId);
    const labels = useDmKodCabinetLabels(companyId, enabled);
    const queryClient = useQueryClient();
    const [draft, setDraft] = useState({
        search: "",
        dateFrom: "",
        dateTo: "",
    });
    const [query, setQuery] = useState<DmKodOrdersSearch>({
        page: 1,
        pageSize,
    });
    const [createOpen, setCreateOpen] = useState(
        () =>
            !!readDmKodOrderReceipt(
                sessionStorage.getItem(dmKodScopeStorageKey(scope, "orders")),
            ),
    );
    const [dateOpen, setDateOpen] = useState(false);
    const [internalOrderId, setInternalOrderId] = useState<number | null>(null);
    const selectedOrderId = selected === undefined ? internalOrderId : selected;
    const setSelectedOrderId = onOrderChange ?? setInternalOrderId;
    const orders = useDmKodOrders(scope, query, enabled);

    useEffect(() => {
        if (isAxiosError(orders.error) && orders.error.response?.status === 401)
            void queryClient.invalidateQueries({
                queryKey: dmKodKeys.session(scope),
            });
    }, [scope, orders.error, queryClient]);

    const applyFilters = () => {
        setDateOpen(false);
        setQuery((current) => ({
            ...current,
            page: 1,
            pageSize,
            search: draft.search.trim() || undefined,
            dateFrom: draft.dateFrom || undefined,
            dateTo: draft.dateTo || undefined,
        }));
    };

    const appliedSearch = useRef("");
    useEffect(() => {
        const search = draft.search.trim();
        if (appliedSearch.current === search) return;
        const timer = window.setTimeout(() => {
            appliedSearch.current = search;
            setQuery((current) => ({
                ...current,
                page: 1,
                search: search || undefined,
            }));
        }, 300);
        return () => window.clearTimeout(timer);
    }, [draft.search]);

    const groups = useMemo(() => {
        const result = new Map<string, DmKodOrder[]>();
        for (const order of orders.data?.orders ?? []) {
            const key = order.createdAtUtc
                ? new Intl.DateTimeFormat(i18n.language, {
                      dateStyle: "full",
                  }).format(new Date(order.createdAtUtc))
                : t("dmkod.orders.unknownDate");
            result.set(key, [...(result.get(key) ?? []), order]);
        }
        return [...result.entries()];
    }, [i18n.language, orders.data?.orders, t]);

    if (selectedOrderId !== null)
        return (
            <DmKodOrderWorkspace
                key={selectedOrderId}
                companyId={companyId}
                orderId={selectedOrderId}
                enabled={enabled}
                hideBreadcrumb={selected !== undefined}
                flags={orders.data?.flags}
                releaseMethods={orders.data?.releaseMethods}
                onBack={() => setSelectedOrderId(null)}
            />
        );

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                    <h1 className="font-semibold uppercase">
                        {t("dmkod.orders.title")}
                    </h1>
                    <Button
                        variant={query.flag ? "ghost" : "secondary"}
                        size="sm"
                        className="h-6 rounded-full px-2 text-xs"
                        aria-label={t("dmkod.orders.allStatuses")}
                        aria-pressed={!query.flag}
                        disabled={orders.isFetching}
                        onClick={() =>
                            setQuery((current) => ({
                                ...current,
                                page: 1,
                                flag: undefined,
                            }))
                        }
                    >
                        {orders.data?.totalRows ?? "—"}
                    </Button>
                    {(orders.data?.flags ?? []).map((flag) =>
                        orders.data?.totalFlags[flag.value] !== undefined ? (
                            <Button
                                key={flag.value}
                                data-dmkod-flag={flag.value}
                                variant={
                                    query.flag === flag.value
                                        ? "secondary"
                                        : "outline"
                                }
                                size="sm"
                                className="dmkod-flag-count h-6 rounded-full px-2 text-xs"
                                aria-label={`${flag.label}: ${orders.data.totalFlags[flag.value]}`}
                                title={flag.label}
                                aria-pressed={query.flag === flag.value}
                                disabled={orders.isFetching}
                                onClick={() =>
                                    setQuery((current) => ({
                                        ...current,
                                        page: 1,
                                        flag:
                                            current.flag === flag.value
                                                ? undefined
                                                : flag.value,
                                    }))
                                }
                            >
                                {orders.data.totalFlags[flag.value]}
                            </Button>
                        ) : null,
                    )}
                </div>
                <div className="flex items-center gap-1">
                    <Popover open={dateOpen} onOpenChange={setDateOpen}>
                        <PopoverTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                aria-label={t("dmkod.cabinet.dateFilter")}
                            >
                                <CalendarRange aria-hidden="true" />
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent
                            align="end"
                            className="integration-theme dmkod-theme space-y-3"
                        >
                            <DateInput
                                value={draft.dateFrom}
                                label={t("dmkod.orders.dateFrom")}
                                onChange={(dateFrom) =>
                                    setDraft((current) => ({
                                        ...current,
                                        dateFrom,
                                    }))
                                }
                            />
                            <DateInput
                                value={draft.dateTo}
                                label={t("dmkod.orders.dateTo")}
                                min={draft.dateFrom || undefined}
                                onChange={(dateTo) =>
                                    setDraft((current) => ({
                                        ...current,
                                        dateTo,
                                    }))
                                }
                            />
                            <div className="flex justify-end gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setDraft((current) => ({
                                            ...current,
                                            dateFrom: "",
                                            dateTo: "",
                                        }));
                                        setQuery((current) => ({
                                            ...current,
                                            page: 1,
                                            dateFrom: undefined,
                                            dateTo: undefined,
                                        }));
                                        setDateOpen(false);
                                    }}
                                >
                                    {t("dmkod.cabinet.clear")}
                                </Button>
                                <Button onClick={applyFilters}>
                                    {t("dmkod.cabinet.done")}
                                </Button>
                            </div>
                        </PopoverContent>
                    </Popover>
                    <DmKodIconAction
                        label={t("dmkod.orders.create")}
                        onClick={() => setCreateOpen(true)}
                    >
                        <Plus className="text-emerald-600" aria-hidden="true" />
                    </DmKodIconAction>
                    <DmKodIconAction
                        label={t("dmkod.orders.refresh")}
                        disabled={orders.isFetching}
                        onClick={() => void orders.refetch()}
                    >
                        <RefreshCw
                            className={
                                orders.isFetching ? "animate-spin" : undefined
                            }
                            aria-hidden="true"
                        />
                    </DmKodIconAction>
                </div>
            </div>
            <DmKodListToolbar
                search={draft.search}
                onSearch={(search) =>
                    setDraft((current) => ({ ...current, search }))
                }
                label={t("dmkod.orders.search")}
                found={orders.data?.filteredRows ?? 0}
                total={orders.data?.totalRows ?? 0}
                page={query.page}
                pages={orders.data?.pages ?? 1}
                onPage={(page) => setQuery((current) => ({ ...current, page }))}
                disabled={orders.isFetching}
            />
            {orders.isError ? (
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertTitle>{t("dmkod.orders.loadFailed")}</AlertTitle>
                    <AlertDescription>
                        <p>
                            {readError(orders.error, t("dmkod.errors.orders"))}
                        </p>
                        <Button
                            variant="outline"
                            onClick={() => void orders.refetch()}
                        >
                            {t("common.retry")}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {orders.isLoading ? <OrdersSkeleton /> : null}
            {!orders.isLoading && !orders.isError && groups.length === 0 ? (
                <div className="py-12 text-center">
                    <PackageOpen
                        className="mx-auto mb-3 size-8 text-muted-foreground"
                        aria-hidden="true"
                    />
                    <h2 className="font-semibold">
                        {t("dmkod.orders.emptyTitle")}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t("dmkod.orders.emptyDescription")}
                    </p>
                </div>
            ) : null}
            {groups.map(([date, dateOrders]) => (
                <section key={date} aria-label={date} className="space-y-3">
                    <h2 className="pt-3 text-center text-base font-semibold text-muted-foreground">
                        {date}
                    </h2>
                    {dateOrders.map((order) => (
                        <OrderRow
                            key={order.id}
                            order={order}
                            labels={labels}
                            locale={i18n.language}
                            flags={orders.data?.flags ?? []}
                            releaseMethods={orders.data?.releaseMethods ?? []}
                            onOpen={() => setSelectedOrderId(order.id)}
                        />
                    ))}
                </section>
            ))}
            <CreateOrderDialog
                companyId={companyId}
                open={createOpen}
                onOpenChange={setCreateOpen}
            />
        </div>
    );
}

function OrderRow({
    order,
    labels,
    locale,
    flags,
    releaseMethods,
    onOpen,
}: {
    order: DmKodOrder;
    labels: ReturnType<typeof useDmKodCabinetLabels>;
    locale: string;
    flags: DmKodDictionaryOption[];
    releaseMethods: DmKodDictionaryOption[];
    onOpen: () => void;
}) {
    const { t } = useTranslation();
    const created = order.createdAtUtc ? new Date(order.createdAtUtc) : null;
    return (
        <button
            type="button"
            data-flag={order.flag}
            className="dmkod-order-card flex w-full flex-col gap-2 rounded-xl border px-4 py-3 text-left transition-colors hover:brightness-95 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            onClick={onOpen}
        >
            <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="min-w-0 font-semibold break-words">
                    {order.participant?.name || t("dmkod.orders.noParticipant")}
                </h3>
                <div className="flex flex-wrap gap-2">
                    {order.attributes.releaseMethodType ? (
                        <Badge variant="outline">
                            {lookup(
                                releaseMethods,
                                order.attributes.releaseMethodType,
                            )}
                        </Badge>
                    ) : null}
                    <Badge className="dmkod-order-status">
                        {lookup(flags, order.flag)}
                    </Badge>
                </div>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-sm">
                <span>{order.attributes.secondaryProductionOrderId}</span>
                <span className="text-muted-foreground">
                    {order.attributes.productionOrderId}
                </span>
            </div>
            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                    # {order.id}
                    <UserRound className="ml-1 size-3" aria-hidden="true" />
                    {order.user?.displayName || order.user?.username || "—"}
                </span>
                <span>
                    {created
                        ? new Intl.DateTimeFormat(locale, {
                              hour: "2-digit",
                              minute: "2-digit",
                          }).format(created)
                        : "—"}
                </span>
            </div>
            <hr className="my-1 w-full" />
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1">
                    {order.productGroups.map((group) => (
                        <Badge key={group} variant="secondary">
                            {labels("PRODUCT_GROUP", group)}
                        </Badge>
                    ))}
                </div>
                <div className="ml-auto flex flex-wrap gap-2 text-xs text-muted-foreground">
                    <span>
                        <strong className="mr-1 text-2xl font-medium text-foreground tabular-nums">
                            {new Intl.NumberFormat(locale).format(
                                order.itemsCount,
                            )}
                        </strong>
                        {t("dmkod.orderLayout.positionsLabel", {
                            count: order.itemsCount,
                        })}
                    </span>
                    <span>
                        <strong className="mr-1 text-2xl font-medium text-foreground tabular-nums">
                            {new Intl.NumberFormat(locale).format(
                                order.itemsQuantity,
                            )}
                        </strong>
                        {t("dmkod.orderLayout.codesLabel", {
                            count: order.itemsQuantity,
                        })}
                    </span>
                </div>
            </div>
        </button>
    );
}

function DateInput({
    value,
    label,
    min,
    onChange,
}: {
    value: string;
    label: string;
    min?: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="relative">
            <CalendarRange
                className="pointer-events-none absolute top-2.5 left-3 size-4 text-muted-foreground"
                aria-hidden="true"
            />
            <Input
                className="pl-9"
                type="date"
                value={value}
                min={min}
                aria-label={label}
                title={label}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}

function CreateOrderDialog({
    companyId,
    open,
    onOpenChange,
}: {
    companyId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const scope = useDmKodScope(companyId);
    const storageKey = dmKodScopeStorageKey(scope, "orders");
    const [receipt, setReceipt] = useState<DmKodOrderReceipt | null>(() =>
        readDmKodOrderReceipt(sessionStorage.getItem(storageKey)),
    );
    const [recovering, setRecovering] = useState(false);
    const options = useDmKodCreateOrderOptions(scope, open);
    const create = useDmKodCreateOrder(scope);
    const [backgroundTaskId, setBackgroundTaskId] = useState<string | null>(
        receipt?.backgroundTaskId ?? null,
    );
    const task = useDmKodBackgroundTask(scope, backgroundTaskId);
    const handledTask = useRef<string | null>(null);
    const requestId = useRef<string | null>(receipt?.clientRequestId ?? null);
    const remember = (next: DmKodOrderReceipt | null) => {
        setReceipt(next);
        if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
        else sessionStorage.removeItem(storageKey);
    };
    const schema = useMemo(
        () =>
            z.object({
                participantId: z
                    .string()
                    .min(1, t("dmkod.orders.form.participantRequired")),
                releaseMethodType: z
                    .string()
                    .min(1, t("dmkod.orders.form.releaseRequired")),
                createMethodType: z.enum([
                    "",
                    "SELF_MADE",
                    "CEM",
                    "CM",
                    "CL",
                    "CA",
                ]),
                productionOrderId: z.string().trim().max(200),
                secondaryProductionOrderId: z.string().trim().max(200),
            }),
        [t],
    );
    type Values = z.infer<typeof schema>;
    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: {
            participantId: "",
            releaseMethodType: "",
            createMethodType: "",
            productionOrderId: "",
            secondaryProductionOrderId: "",
        },
    });

    useEffect(() => {
        if (!open && !receipt) {
            setBackgroundTaskId(null);
            handledTask.current = null;
            requestId.current = null;
            form.reset();
        }
    }, [form, open, receipt]);

    useEffect(() => {
        const current = task.data;
        if (
            !current ||
            !["COMPLETED", "FAILED"].includes(current.state.toUpperCase())
        )
            return;
        if (handledTask.current === current.backgroundTaskId) return;
        handledTask.current = current.backgroundTaskId;
        setReceipt(null);
        sessionStorage.removeItem(storageKey);
        if (
            current.state.toUpperCase() === "COMPLETED" &&
            current.resultState?.toUpperCase() === "SUCCESS"
        ) {
            toast.success(
                t("dmkod.orders.form.success", { id: current.orderId ?? "—" }),
            );
            void queryClient.invalidateQueries({
                queryKey: [...dmKodKeys.scoped(scope), "orders"],
            });
            onOpenChange(false);
        } else {
            toast.error(t("dmkod.orders.form.failed"));
        }
    }, [scope, storageKey, onOpenChange, queryClient, t, task.data]);

    const submit = form.handleSubmit(async (values) => {
        if (receipt || create.isPending) return;
        try {
            requestId.current ??= crypto.randomUUID();
            remember({
                clientRequestId: requestId.current,
                backgroundTaskId: null,
            });
            const accepted = await create.mutateAsync({
                clientRequestId: requestId.current,
                participantId: Number(values.participantId),
                releaseMethodType: values.releaseMethodType,
                createMethodType: values.createMethodType || undefined,
                productionOrderId: values.productionOrderId || undefined,
                secondaryProductionOrderId:
                    values.secondaryProductionOrderId || undefined,
            });
            setBackgroundTaskId(accepted.backgroundTaskId);
            remember({
                clientRequestId: requestId.current,
                backgroundTaskId: accepted.backgroundTaskId,
            });
        } catch (error) {
            toast.error(readError(error, t("dmkod.errors.createOrder")));
        }
    });

    const recover = async () => {
        if (!receipt) return;
        setRecovering(true);
        try {
            const accepted = await dmKodApi.recoverOrder(
                scope,
                receipt.clientRequestId,
            );
            remember({
                ...receipt,
                backgroundTaskId: accepted.backgroundTaskId,
            });
            setBackgroundTaskId(accepted.backgroundTaskId);
        } catch (error) {
            if (isAxiosError(error) && error.response?.status === 404) {
                remember(null);
                requestId.current = null;
                toast.error(t("dmkod.environment.notSubmitted"));
            } else
                toast.error(
                    readError(error, t("dmkod.environment.orderUnknown")),
                );
        } finally {
            setRecovering(false);
        }
    };

    const taskState = task.data?.state.toUpperCase();
    const taskTerminal = taskState === "COMPLETED" || taskState === "FAILED";
    const taskSucceeded =
        taskState === "COMPLETED" &&
        task.data?.resultState?.toUpperCase() === "SUCCESS";
    const taskFailed = task.isError || (taskTerminal && !taskSucceeded);
    const pending = create.isPending;
    return (
        <Dialog
            open={open}
            onOpenChange={(next) => !pending && onOpenChange(next)}
        >
            <DialogContent
                className="integration-theme dmkod-theme sm:max-w-xl"
                aria-describedby={undefined}
            >
                <DialogHeader>
                    <DialogTitle>{t("dmkod.orders.form.title")}</DialogTitle>
                </DialogHeader>
                <DmKodEnvironmentTarget companyId={companyId} />
                {options.isError ? (
                    <Alert variant="destructive">
                        <CircleAlert aria-hidden="true" />
                        <AlertTitle>
                            {t("dmkod.orders.form.optionsFailed")}
                        </AlertTitle>
                        <AlertDescription>
                            {readError(
                                options.error,
                                t("dmkod.errors.createOptions"),
                            )}
                        </AlertDescription>
                    </Alert>
                ) : null}
                {receipt && !backgroundTaskId ? (
                    <div className="space-y-3">
                        <Alert>
                            <CircleAlert aria-hidden="true" />
                            <AlertTitle>
                                {t("dmkod.environment.orderUnknownTitle")}
                            </AlertTitle>
                            <AlertDescription>
                                {t("dmkod.environment.orderUnknown")}
                            </AlertDescription>
                        </Alert>
                        <p className="font-mono text-sm break-all">
                            {receipt.clientRequestId}
                        </p>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={create.isPending || recovering}
                                onClick={() => onOpenChange(false)}
                            >
                                {t("common.close")}
                            </Button>
                            <Button
                                type="button"
                                disabled={create.isPending || recovering}
                                onClick={() => void recover()}
                            >
                                {t("dmkod.environment.recoverOrder")}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : backgroundTaskId && !taskFailed ? (
                    <div
                        className="flex min-h-40 flex-col items-center justify-center rounded-lg border bg-muted/20 p-6 text-center"
                        aria-live="polite"
                    >
                        <LoaderCircle
                            className="mb-3 size-7 animate-spin text-primary"
                            aria-hidden="true"
                        />
                        <p className="font-medium">
                            {t("dmkod.orders.form.processing")}
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {t("dmkod.orders.form.processingHint")}
                        </p>
                        <p className="mt-2 font-mono text-xs break-all">
                            {backgroundTaskId}
                        </p>
                        <Button
                            className="mt-3"
                            type="button"
                            variant="outline"
                            disabled={create.isPending}
                            onClick={() => onOpenChange(false)}
                        >
                            {t("common.close")}
                        </Button>
                    </div>
                ) : taskFailed ? (
                    <div className="space-y-4">
                        <Alert variant="destructive">
                            <CircleAlert aria-hidden="true" />
                            <AlertTitle>
                                {t("dmkod.orders.form.failed")}
                            </AlertTitle>
                            <AlertDescription>
                                {task.isError
                                    ? readError(
                                          task.error,
                                          t("dmkod.errors.backgroundTask"),
                                      )
                                    : t("dmkod.orders.form.failedHint")}
                            </AlertDescription>
                        </Alert>
                        <DialogFooter>
                            {task.isError ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void task.refetch()}
                                >
                                    {t("common.retry")}
                                </Button>
                            ) : null}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => onOpenChange(false)}
                            >
                                {t("common.close")}
                            </Button>
                        </DialogFooter>
                    </div>
                ) : (
                    <Form {...form}>
                        <form
                            className="space-y-4"
                            onSubmit={submit}
                            noValidate
                        >
                            <FormField
                                control={form.control}
                                name="participantId"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t("dmkod.orders.form.participant")}
                                        </FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            disabled={options.isLoading}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue
                                                        placeholder={t(
                                                            "dmkod.orders.form.selectParticipant",
                                                        )}
                                                    />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="integration-theme dmkod-theme">
                                                {(
                                                    options.data
                                                        ?.participants ?? []
                                                ).map((participant) => (
                                                    <SelectItem
                                                        key={participant.id}
                                                        value={String(
                                                            participant.id,
                                                        )}
                                                    >
                                                        {participant.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="releaseMethodType"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t(
                                                "dmkod.orders.form.releaseMethod",
                                            )}
                                        </FormLabel>
                                        <Select
                                            value={field.value}
                                            onValueChange={field.onChange}
                                            disabled={options.isLoading}
                                        >
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue
                                                        placeholder={t(
                                                            "dmkod.orders.form.selectReleaseMethod",
                                                        )}
                                                    />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent className="integration-theme dmkod-theme">
                                                {(
                                                    options.data
                                                        ?.releaseMethods ?? []
                                                ).map((method) => (
                                                    <SelectItem
                                                        key={method.value}
                                                        value={method.value}
                                                    >
                                                        {method.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <TextField
                                control={form.control}
                                name="secondaryProductionOrderId"
                                label={t("dmkod.cabinet.orderNumber")}
                            />
                            {options.data &&
                            options.data.participants.length === 0 ? (
                                <Alert>
                                    <CircleAlert aria-hidden="true" />
                                    <AlertTitle>
                                        {t("dmkod.orders.form.noPoaTitle")}
                                    </AlertTitle>
                                    <AlertDescription>
                                        {t("dmkod.orders.form.noPoa")}
                                    </AlertDescription>
                                </Alert>
                            ) : null}
                            <DialogFooter>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => onOpenChange(false)}
                                >
                                    {t("common.cancel")}
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        create.isPending ||
                                        options.isLoading ||
                                        !options.data?.participants.length ||
                                        !options.data?.releaseMethods.length
                                    }
                                >
                                    {create.isPending ? (
                                        <LoaderCircle
                                            className="animate-spin"
                                            aria-hidden="true"
                                        />
                                    ) : (
                                        <Plus aria-hidden="true" />
                                    )}
                                    {t("dmkod.orders.form.submit")}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                )}
            </DialogContent>
        </Dialog>
    );
}

function TextField<TFieldValues extends FieldValues>({
    control,
    name,
    label,
}: {
    control: Control<TFieldValues>;
    name: FieldPath<TFieldValues>;
    label: string;
}) {
    return (
        <FormField
            control={control}
            name={name}
            render={({ field }) => (
                <FormItem>
                    <FormLabel>{label}</FormLabel>
                    <FormControl>
                        <Input {...field} />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}

function OrdersSkeleton() {
    return (
        <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-24 w-full" />
            ))}
        </div>
    );
}

function lookup(options: DmKodDictionaryOption[], value: string): string {
    return options.find((option) => option.value === value)?.label || value;
}

function readError(error: unknown, fallback: string): string {
    if (isAxiosError<{ message?: string }>(error))
        return error.response?.data?.message || fallback;
    return error instanceof Error && error.message ? error.message : fallback;
}
