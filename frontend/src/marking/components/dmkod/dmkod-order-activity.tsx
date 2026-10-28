import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
    ArrowDownUp,
    CalendarDays,
    FileSignature,
    RefreshCw,
    Sparkles,
    Table as TableIcon,
    CircleHelp,
    Plus,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { DmKodActionPanel } from "@marking/components/dmkod/dmkod-api-tools";
import {
    DmKodIconAction,
    DmKodListToolbar,
} from "@marking/components/dmkod/dmkod-compact-controls";
import {
    useDmKodLocalOperation,
    useDmKodScope,
} from "@marking/components/dmkod/dmkod-scope-context";
import { DmKodUtilisationAttributesDialog } from "@marking/components/dmkod/dmkod-utilisation-attributes-dialog";
import { Alert, AlertDescription } from "@marking/components/ui/alert";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import {
    Dialog,
    DialogContent,
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
import { Skeleton } from "@marking/components/ui/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@marking/components/ui/table";
import { dmKodKeys, useDmKodSession } from "@marking/hooks/use-dmkod";
import { useDmKodCabinetLabels } from "@marking/hooks/use-dmkod-cabinet-labels";
import { dmKodApi } from "@marking/lib/api/dmkod";
import { dmKodExtendedApi } from "@marking/lib/api/dmkod-extended";
import {
    allocateDmKodRanges,
    dmKodFreeRanges,
    readDmKodRangeIntent,
    validDmKodRangeTag,
} from "@marking/lib/dmkod-ranges-policy";
import { dmKodScopeKey } from "@marking/lib/dmkod-scope";
import {
    dmKodEditableAttributeFields as attributeFields,
    dmKodEmptyAttributes,
    dmKodRangeAttributes,
    dmKodManufactureSuggestions,
    formatDmKodAttributeDate,
    validDmKodRequisite,
    type DmKodAttributeValues,
} from "@marking/lib/dmkod-utilisation-attributes";
import {
    dmKodCalendarDate,
    validCalendarDate,
} from "@marking/lib/dmkod-utilisation-policy";
import { workflowTaskOutcome } from "@marking/lib/dmkod-workflow-policy";

import type { DmKodRangeIntent } from "@marking/lib/dmkod-ranges-policy";
import type { DmKodOrderItem } from "@marking/lib/dmkod-types";

type Values = DmKodAttributeValues & {
    quantity: string;
    tag: string;
};
const defaults: Values = {
    quantity: "",
    tag: "",
    ...dmKodEmptyAttributes,
};

export function DmKodOrderActivity({
    companyId,
    orderId,
    items,
    kind,
    enabled,
    onBusyChange,
    onGenerateReports,
}: {
    companyId: string;
    orderId: number;
    items: DmKodOrderItem[];
    kind: "validation" | "utilisation";
    enabled: boolean;
    onBusyChange?: (busy: boolean) => void;
    onGenerateReports: () => void;
}) {
    const { t, i18n } = useTranslation();
    const scope = useDmKodScope(companyId);
    const labels = useDmKodCabinetLabels(companyId, enabled);
    const hold = useDmKodLocalOperation();
    const client = useQueryClient();
    const session = useDmKodSession(scope).data;
    const storageKey = `dmkod.ranges.${dmKodScopeKey(scope)}.${orderId}`;
    const [intent, setIntent] = useState<DmKodRangeIntent | null>(() =>
        kind === "utilisation"
            ? readDmKodRangeIntent(sessionStorage.getItem(storageKey), orderId)
            : null,
    );
    const [selectedId, setSelectedId] = useState<number | null>(
        intent?.itemId ?? null,
    );
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [descending, setDescending] = useState(false);
    const [generateOpen, setGenerateOpen] = useState(false);
    const [reportActionsOpen, setReportActionsOpen] = useState(false);
    const [attributesOpen, setAttributesOpen] = useState(false);
    const [reconcileOpen, setReconcileOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const handledTask = useRef<string | null>(null);
    const remember = (value: DmKodRangeIntent | null) => {
        setIntent(value);
        if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
        else sessionStorage.removeItem(storageKey);
    };
    const query = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "item-activity", kind, orderId],
        queryFn: () =>
            dmKodExtendedApi.read(scope, {
                method:
                    kind === "utilisation"
                        ? "OrderUtilisationRanges"
                        : "OrderValidations",
                id: orderId,
            }),
        enabled,
        retry: false,
    });
    const data =
        kind === "utilisation"
            ? query.data?.utilisationItems
            : query.data?.validationItems;
    const statesFor = (id: number) =>
        data?.find((row) => row.orderItemId === id)?.states ?? [];
    const selected = items.find((item) => item.id === selectedId);
    const manufactures = useQuery({
        queryKey: dmKodKeys.manufactures(scope, orderId, selectedId ?? 0),
        queryFn: async () => {
            const result = await dmKodApi.getItemManufactures(
                scope,
                orderId,
                selectedId!,
            );
            if (result.orderId !== orderId || result.orderItemId !== selectedId)
                throw new Error(t("dmkod.cabinet.attributeForm.loadError"));
            return result;
        },
        enabled: enabled && kind === "utilisation" && !!selected,
        retry: false,
    });
    // Never keep another item's choices or serve cached choices after a failed refresh.
    const requisites = dmKodManufactureSuggestions(
        manufactures.isSuccess && !manufactures.isFetching
            ? manufactures.data.manufactures
            : [],
    );
    const free =
        selected && data
            ? dmKodFreeRanges(selected.receivedQuantity, statesFor(selected.id))
            : null;
    const maximum =
        free?.reduce((sum, range) => sum + range.end - range.start + 1, 0) ?? 0;
    const schema = z.object({
        quantity: z
            .string()
            .refine(
                (value) =>
                    Number.isSafeInteger(Number(value)) &&
                    Number(value) > 0 &&
                    Number(value) <= maximum,
                t("dmkod.cabinet.activity.quantityInvalid", { count: maximum }),
            ),
        tag: z
            .string()
            .trim()
            .max(256, t("dmkod.workflow.invalid"))
            .refine(
                (value) => validDmKodRangeTag(value),
                t("dmkod.workflow.invalid"),
            ),
        productionDate: z
            .string()
            .refine(
                (value) =>
                    !value ||
                    (validCalendarDate(value) && value <= dmKodCalendarDate()),
                t("dmkod.utilisation.validation.productionDate"),
            ),
        expirationDate: z
            .string()
            .refine(
                (value) =>
                    !value ||
                    (validCalendarDate(value) && value >= dmKodCalendarDate()),
                t("dmkod.utilisation.validation.expirationDate"),
            ),
        kpp: z
            .string()
            .refine(
                (value) =>
                    !value ||
                    (validDmKodRequisite("kpps", value) &&
                        requisites.kpps.some(
                            (choice) => choice.value === value,
                        )),
                t("dmkod.cabinet.attributeForm.kppInvalid"),
            ),
        fiasUuid: z
            .string()
            .refine(
                (value) =>
                    !value ||
                    (validDmKodRequisite("fiasUuids", value) &&
                        requisites.fiasUuids.some(
                            (choice) => choice.value === value,
                        )),
                t("dmkod.cabinet.attributeForm.fiasInvalid"),
            ),
        seriesNumber: z
            .string()
            .trim()
            .max(20, t("dmkod.utilisation.validation.seriesNumber")),
        batchNumber: z
            .string()
            .trim()
            .max(49, t("dmkod.utilisation.validation.batchNumber")),
    });
    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: defaults,
    });
    const draft = form.watch();
    const task = useQuery({
        queryKey: [
            ...dmKodKeys.scoped(scope),
            "range-task",
            intent?.requestId,
            intent?.taskId,
        ],
        queryFn: () => dmKodExtendedApi.task(scope, intent!.taskId!),
        enabled: !!intent?.taskId,
        retry: false,
        refetchInterval: (q) =>
            q.state.status === "error" ||
            ["COMPLETED", "FAILED"].includes(q.state.data?.state ?? "")
                ? false
                : 2000,
    });
    const outcome = workflowTaskOutcome(task.data);
    const terminal = !!intent?.taskId && outcome !== "pending";
    useEffect(() => {
        if (
            !terminal ||
            !intent?.taskId ||
            handledTask.current === `${intent.requestId}.${intent.taskId}`
        )
            return;
        handledTask.current = `${intent.requestId}.${intent.taskId}`;
        void client.invalidateQueries({ queryKey: dmKodKeys.scoped(scope) });
        if (outcome === "succeeded")
            toast.success(t("dmkod.utilisation.success"));
    }, [
        terminal,
        intent?.requestId,
        intent?.taskId,
        outcome,
        client,
        scope,
        t,
    ]);
    const save = useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: async (values: Values) => {
            if (!selected || !free || intent)
                throw new Error(t("dmkod.cabinet.activity.unknownPositions"));
            const include = allocateDmKodRanges(
                free,
                Number(values.quantity),
                values.tag.trim() || undefined,
            );
            if (!include)
                throw new Error(
                    t("dmkod.cabinet.activity.quantityInvalid", {
                        count: maximum,
                    }),
                );
            const release = hold();
            const next: DmKodRangeIntent = {
                requestId: crypto.randomUUID(),
                orderId,
                itemId: selected.id,
                taskId: null,
            };
            setError(null);
            remember(next);
            try {
                const attributes = dmKodRangeAttributes(values);
                const receipt = await dmKodExtendedApi.run(scope, {
                    clientRequestId: next.requestId,
                    action: "PushUtilisationRanges",
                    ranges: {
                        orderId,
                        orderItemId: selected.id,
                        include,
                        attributes,
                    },
                });
                remember({ ...next, taskId: receipt.backgroundTaskId });
                form.reset(defaults);
            } catch (cause) {
                // Definite gateway refusals happen before dispatch; uncertain/409/502 outcomes retain the original key.
                if (
                    isAxiosError(cause) &&
                    [400, 401, 403, 404, 422].includes(
                        cause.response?.status ?? 0,
                    )
                )
                    remember(null);
                throw cause;
            } finally {
                release();
            }
        },
        onError: (cause) =>
            setError(readError(cause, t("dmkod.extended.failed"))),
    });
    const recover = useMutation({
        retry: false,
        mutationFn: async () => {
            if (!intent) return;
            const receipt = await dmKodExtendedApi.receipt(
                scope,
                intent.requestId,
            );
            remember({ ...intent, taskId: receipt.backgroundTaskId });
            setError(null);
        },
        onError: (cause) =>
            setError(readError(cause, t("dmkod.extended.unknown"))),
    });
    const busy = save.isPending || recover.isPending;
    useEffect(() => {
        onBusyChange?.(busy || (!!intent && !terminal));
        return () => onBusyChange?.(false);
    }, [busy, intent, terminal, onBusyChange]);
    const filtered = items
        .filter((item) =>
            [
                item.product?.gtin,
                item.product?.name,
                item.tag,
                String(item.id),
            ].some((value) =>
                value
                    ?.toLocaleLowerCase()
                    .includes(search.trim().toLocaleLowerCase()),
            ),
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
    const current = Math.min(page, pages);
    const open = (item: DmKodOrderItem) => {
        if (intent && intent.itemId !== item.id) return;
        form.reset(defaults);
        setAttributesOpen(false);
        setError(null);
        setSelectedId(item.id);
    };
    return (
        <section className="space-y-3">
            <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
                <h2 className="flex items-center gap-2 font-semibold uppercase">
                    {t("dmkod.codeOrdering.products")}
                    <Badge variant="secondary">{items.length}</Badge>
                </h2>
                <Popover
                    open={reportActionsOpen}
                    onOpenChange={setReportActionsOpen}
                >
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            disabled={!enabled || busy}
                            aria-label={t(
                                "dmkod.cabinet.activity.reportActions",
                            )}
                        >
                            <Sparkles
                                className="text-[var(--dmkod-warning)]"
                                aria-hidden="true"
                            />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        align="end"
                        className="integration-theme dmkod-theme flex w-auto items-center gap-2"
                    >
                        <DmKodIconAction
                            label={t("common.refresh")}
                            disabled={query.isFetching}
                            onClick={() => void query.refetch()}
                        >
                            <RefreshCw aria-hidden="true" />
                        </DmKodIconAction>
                        <Button
                            variant="outline"
                            disabled={!data || (!!intent && !terminal)}
                            onClick={() => {
                                setReportActionsOpen(false);
                                if (kind === "validation")
                                    setGenerateOpen(true);
                                else onGenerateReports();
                            }}
                        >
                            <FileSignature aria-hidden="true" />
                            {t("dmkod.cabinet.activity.generateReports")}
                        </Button>
                    </PopoverContent>
                </Popover>
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
                page={current}
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
            {query.isLoading ? (
                <Skeleton className="h-40 w-full" />
            ) : query.isError || (query.data && !data) ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {t("dmkod.workflow.loadFailed")}
                        <Button
                            variant="outline"
                            onClick={() => void query.refetch()}
                        >
                            {t("common.retry")}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {filtered.slice((current - 1) * 20, current * 20).map((item) => {
                const states = statesFor(item.id);
                const gaps = data
                    ? dmKodFreeRanges(item.receivedQuantity, states)
                    : null;
                const unknown = gaps?.reduce(
                    (sum, range) => sum + range.end - range.start + 1,
                    0,
                );
                return (
                    <div
                        key={item.id}
                        className={
                            kind === "utilisation"
                                ? "grid items-start gap-1 md:grid-cols-2"
                                : "space-y-1"
                        }
                    >
                        <article className="space-y-2 rounded-xl border bg-card px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-semibold">
                                    {item.product?.gtin || `#${item.id}`}
                                </h3>
                                {item.flag ? (
                                    <Badge variant="secondary">
                                        {labels(
                                            "ORDER_ITEM_FLAG",
                                            item.flag,
                                            t(
                                                `dmkod.orderLayout.itemStates.${item.flag}`,
                                                { defaultValue: item.flag },
                                            ),
                                        )}
                                    </Badge>
                                ) : null}
                                <span className="ml-auto text-lg tabular-nums">
                                    {item.quantity}
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                {item.product?.name}
                            </p>
                            <div className="flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
                                <span>
                                    #{item.id} ·{" "}
                                    {item.user?.displayName ||
                                        item.user?.username}
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
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            },
                                        ).format(new Date(item.createdAtUtc))}
                                    </span>
                                ) : null}
                            </div>
                            <div className="flex flex-wrap items-center gap-1 border-t pt-3">
                                {[
                                    {
                                        dictionary: "PRODUCT_GROUP",
                                        value: item.product?.group,
                                    },
                                    {
                                        dictionary: "TEMPLATE_ID",
                                        value: item.templateId,
                                    },
                                    {
                                        dictionary: "CIS_TYPE",
                                        value: item.product?.cisType,
                                    },
                                    { dictionary: null, value: item.tag },
                                ]
                                    .filter((entry) => entry.value)
                                    .map(({ dictionary, value }, index) => (
                                        <Badge
                                            key={`${dictionary}.${value}.${index}`}
                                            variant="outline"
                                        >
                                            {dictionary
                                                ? labels(dictionary, value)
                                                : value}
                                        </Badge>
                                    ))}
                                {kind === "utilisation" ? (
                                    <span className="ml-auto">
                                        <DmKodIconAction
                                            label={t(
                                                "dmkod.cabinet.activity.openUtilisation",
                                                {
                                                    product:
                                                        item.product?.gtin ||
                                                        `#${item.id}`,
                                                },
                                            )}
                                            disabled={
                                                !enabled ||
                                                !gaps ||
                                                !item.receivedQuantity ||
                                                busy ||
                                                (!!intent &&
                                                    intent.itemId !== item.id)
                                            }
                                            onClick={() => open(item)}
                                        >
                                            <TableIcon aria-hidden="true" />
                                        </DmKodIconAction>
                                    </span>
                                ) : null}
                            </div>
                        </article>
                        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-card px-4 py-2 text-xs text-muted-foreground">
                            {states.map((state, index) => (
                                <span
                                    className="inline-flex items-center gap-2"
                                    key={`${state.state}.${index}`}
                                >
                                    {t(
                                        `dmkod.cabinet.activity.states.${state.state}`,
                                        { defaultValue: state.state },
                                    )}
                                    <Badge variant="outline">
                                        {state.total ?? "—"}
                                    </Badge>
                                </span>
                            ))}
                            {(unknown !== undefined && unknown > 0) ||
                            !states.length ? (
                                <span className="ml-auto flex flex-1 items-center justify-between gap-2">
                                    <span className="flex items-center gap-2">
                                        <CircleHelp
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                        {t(
                                            item.receivedQuantity === 0
                                                ? `dmkod.cabinet.activity.noCodes.${kind}`
                                                : "dmkod.cabinet.activity.noData",
                                        )}
                                    </span>
                                    <Badge variant="outline">
                                        {unknown ?? "—"}
                                    </Badge>
                                </span>
                            ) : null}
                        </div>
                    </div>
                );
            })}
            {!filtered.length ? (
                <p className="py-10 text-center text-muted-foreground">
                    {t("dmkod.extended.empty")}
                </p>
            ) : null}
            {intent ? (
                <Alert>
                    <AlertDescription>
                        <p>
                            {t(
                                terminal
                                    ? outcome === "succeeded"
                                        ? "dmkod.utilisation.success"
                                        : "dmkod.utilisation.failed"
                                    : intent.taskId
                                      ? "dmkod.utilisation.processing"
                                      : "dmkod.utilisation.unknownTitle",
                            )}
                        </p>
                        <p className="text-xs break-all">{intent.requestId}</p>
                        {!intent.taskId ? (
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => recover.mutate()}
                            >
                                {t("dmkod.utilisation.recover")}
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                disabled={task.isFetching}
                                onClick={() => void task.refetch()}
                            >
                                {t("common.refresh")}
                            </Button>
                        )}
                        {!terminal ? (
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => setReconcileOpen(true)}
                            >
                                {t("dmkod.extended.reconciled")}
                            </Button>
                        ) : null}
                        {terminal ? (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    remember(null);
                                    setSelectedId(null);
                                    setError(null);
                                }}
                            >
                                {t("common.close")}
                            </Button>
                        ) : null}
                        {task.isError ? (
                            <p role="alert">
                                {t("dmkod.utilisation.statusFailed")}
                            </p>
                        ) : null}
                    </AlertDescription>
                </Alert>
            ) : null}
            <Dialog
                open={selectedId !== null}
                onOpenChange={(value) => {
                    if (!value && !busy) {
                        setSelectedId(null);
                        setAttributesOpen(false);
                    }
                }}
            >
                <DialogContent
                    className="integration-theme dmkod-theme max-h-[90svh] overflow-y-auto sm:max-w-2xl"
                    aria-describedby={undefined}
                >
                    <DialogHeader>
                        <DialogTitle className="uppercase">
                            {t("dmkod.cabinet.details")}
                        </DialogTitle>
                    </DialogHeader>
                    <p className="font-semibold">
                        {selected?.product?.gtin || `#${selectedId}`}
                    </p>
                    <p className="text-sm text-muted-foreground">
                        {selected?.product?.name}
                    </p>
                    <div className="flex flex-wrap gap-1">
                        {selected?.product?.group ? (
                            <Badge variant="secondary">
                                {labels(
                                    "PRODUCT_GROUP",
                                    selected.product.group,
                                )}
                            </Badge>
                        ) : null}
                        {selected?.product?.cisType ? (
                            <Badge variant="outline">
                                {labels("CIS_TYPE", selected.product.cisType)}
                            </Badge>
                        ) : null}
                    </div>
                    {!intent ? (
                        <Form {...form}>
                            <form
                                className="space-y-4"
                                noValidate
                                onSubmit={form.handleSubmit(
                                    (values) => save.mutate(values),
                                    (errors) => {
                                        if (
                                            attributeFields.some(
                                                (name) => errors[name],
                                            )
                                        )
                                            setAttributesOpen(true);
                                    },
                                )}
                            >
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>
                                                    {t(
                                                        "dmkod.cabinet.activity.attributes",
                                                    )}
                                                </TableHead>
                                                <TableHead>
                                                    {t(
                                                        "dmkod.cabinet.activity.tag",
                                                    )}
                                                </TableHead>
                                                <TableHead>
                                                    {t(
                                                        "dmkod.cabinet.activity.quantity",
                                                    )}
                                                </TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {selected
                                                ? statesFor(
                                                      selected.id,
                                                  ).flatMap((state, i) =>
                                                      state.ranges.map(
                                                          (range, j) => (
                                                              <TableRow
                                                                  key={`${i}.${j}`}
                                                              >
                                                                  <TableCell>
                                                                      <Popover>
                                                                          <PopoverTrigger
                                                                              asChild
                                                                          >
                                                                              <Button
                                                                                  type="button"
                                                                                  variant="outline"
                                                                              >
                                                                                  {t(
                                                                                      "dmkod.cabinet.activity.attributes",
                                                                                  )}
                                                                              </Button>
                                                                          </PopoverTrigger>
                                                                          <PopoverContent className="integration-theme dmkod-theme max-h-[70svh] space-y-3 overflow-y-auto text-sm">
                                                                              <p>
                                                                                  {t(
                                                                                      `dmkod.cabinet.activity.states.${state.state}`,
                                                                                      {
                                                                                          defaultValue:
                                                                                              state.state,
                                                                                      },
                                                                                  )}
                                                                              </p>
                                                                              <dl className="space-y-2">
                                                                                  {Object.entries(
                                                                                      state.attributes ??
                                                                                          {},
                                                                                  )
                                                                                      .filter(
                                                                                          ([
                                                                                              ,
                                                                                              value,
                                                                                          ]) =>
                                                                                              value !=
                                                                                                  null &&
                                                                                              value !==
                                                                                                  "",
                                                                                      )
                                                                                      .map(
                                                                                          ([
                                                                                              name,
                                                                                              value,
                                                                                          ]) => (
                                                                                              <div
                                                                                                  key={
                                                                                                      name
                                                                                                  }
                                                                                              >
                                                                                                  <dt className="text-muted-foreground">
                                                                                                      {t(
                                                                                                          `dmkod.utilisation.fields.${name}`,
                                                                                                          {
                                                                                                              defaultValue:
                                                                                                                  name,
                                                                                                          },
                                                                                                      )}
                                                                                                  </dt>
                                                                                                  <dd className="break-words">
                                                                                                      {String(
                                                                                                          value,
                                                                                                      )}
                                                                                                  </dd>
                                                                                              </div>
                                                                                          ),
                                                                                      )}
                                                                              </dl>
                                                                          </PopoverContent>
                                                                      </Popover>
                                                                  </TableCell>
                                                                  <TableCell>
                                                                      {range.tag ||
                                                                          "—"}
                                                                  </TableCell>
                                                                  <TableCell>
                                                                      {range.end -
                                                                          range.start +
                                                                          1}
                                                                  </TableCell>
                                                              </TableRow>
                                                          ),
                                                      ),
                                                  )
                                                : null}
                                            <TableRow>
                                                <TableCell>
                                                    <div className="flex flex-wrap items-center gap-1.5">
                                                        <Button
                                                            type="button"
                                                            variant="ghost"
                                                            size="icon"
                                                            disabled={busy}
                                                            aria-label={t(
                                                                "dmkod.cabinet.attributeForm.edit",
                                                            )}
                                                            onClick={() =>
                                                                setAttributesOpen(
                                                                    true,
                                                                )
                                                            }
                                                        >
                                                            <Plus aria-hidden="true" />
                                                        </Button>
                                                        {attributeFields
                                                            .filter(
                                                                (name) =>
                                                                    draft[name],
                                                            )
                                                            .map((name) => (
                                                                <Badge
                                                                    key={name}
                                                                    asChild
                                                                    variant="outline"
                                                                >
                                                                    <button
                                                                        type="button"
                                                                        className="cursor-pointer"
                                                                        disabled={
                                                                            busy
                                                                        }
                                                                        onClick={() =>
                                                                            setAttributesOpen(
                                                                                true,
                                                                            )
                                                                        }
                                                                        aria-label={`${t(`dmkod.utilisation.fields.${name}`)}: ${name.endsWith("Date") ? formatDmKodAttributeDate(draft[name]) : draft[name]}`}
                                                                        title={`${t(`dmkod.utilisation.fields.${name}`)}: ${name.endsWith("Date") ? formatDmKodAttributeDate(draft[name]) : draft[name]}`}
                                                                    >
                                                                        {t(
                                                                            `dmkod.cabinet.attributeForm.short.${name}`,
                                                                        )}
                                                                    </button>
                                                                </Badge>
                                                            ))}
                                                        {!attributeFields.some(
                                                            (name) =>
                                                                draft[name],
                                                        ) ? (
                                                            <Button
                                                                type="button"
                                                                variant="ghost"
                                                                size="sm"
                                                                disabled={busy}
                                                                onClick={() =>
                                                                    setAttributesOpen(
                                                                        true,
                                                                    )
                                                                }
                                                            >
                                                                {t(
                                                                    "dmkod.cabinet.activity.attributes",
                                                                )}
                                                            </Button>
                                                        ) : null}
                                                    </div>
                                                    {attributesOpen ? (
                                                        <DmKodUtilisationAttributesDialog
                                                            value={draft}
                                                            kpps={
                                                                requisites.kpps
                                                            }
                                                            fiasUuids={
                                                                requisites.fiasUuids
                                                            }
                                                            loading={
                                                                manufactures.isPending ||
                                                                manufactures.isFetching
                                                            }
                                                            loadError={
                                                                manufactures.isError
                                                            }
                                                            onRetry={() =>
                                                                void manufactures.refetch()
                                                            }
                                                            onClose={() =>
                                                                setAttributesOpen(
                                                                    false,
                                                                )
                                                            }
                                                            onSave={(
                                                                values,
                                                            ) => {
                                                                for (const name of attributeFields)
                                                                    form.setValue(
                                                                        name,
                                                                        values[
                                                                            name
                                                                        ],
                                                                        {
                                                                            shouldDirty: true,
                                                                            shouldValidate: true,
                                                                        },
                                                                    );
                                                                setAttributesOpen(
                                                                    false,
                                                                );
                                                            }}
                                                        />
                                                    ) : null}
                                                </TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name="tag"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="sr-only">
                                                                    {t(
                                                                        "dmkod.cabinet.activity.tag",
                                                                    )}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        {...field}
                                                                        disabled={
                                                                            busy
                                                                        }
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <FormField
                                                        control={form.control}
                                                        name="quantity"
                                                        render={({ field }) => (
                                                            <FormItem>
                                                                <FormLabel className="sr-only">
                                                                    {t(
                                                                        "dmkod.cabinet.activity.quantity",
                                                                    )}
                                                                </FormLabel>
                                                                <FormControl>
                                                                    <Input
                                                                        {...field}
                                                                        type="number"
                                                                        min={1}
                                                                        max={
                                                                            maximum
                                                                        }
                                                                        disabled={
                                                                            busy ||
                                                                            !free
                                                                        }
                                                                    />
                                                                </FormControl>
                                                                <FormMessage />
                                                            </FormItem>
                                                        )}
                                                    />
                                                </TableCell>
                                            </TableRow>
                                        </TableBody>
                                    </Table>
                                </div>
                                <p className="text-xs text-muted-foreground">
                                    {t("dmkod.cabinet.activity.maximum", {
                                        count: maximum,
                                    })}
                                </p>
                                {!free ? (
                                    <p role="alert">
                                        {t(
                                            "dmkod.cabinet.activity.unknownPositions",
                                        )}
                                    </p>
                                ) : null}
                                <Button
                                    className="w-full"
                                    type="submit"
                                    disabled={busy || !free || maximum === 0}
                                >
                                    {t("common.save")}
                                </Button>
                            </form>
                        </Form>
                    ) : (
                        <p className="text-sm">
                            {t(
                                intent.taskId
                                    ? "dmkod.utilisation.processingHint"
                                    : "dmkod.utilisation.unknown",
                            )}
                        </p>
                    )}
                    {error ? (
                        <p role="alert" className="text-sm text-destructive">
                            {error}
                        </p>
                    ) : null}
                    {intent && !intent.taskId ? (
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => recover.mutate()}
                        >
                            {t("dmkod.utilisation.recover")}
                        </Button>
                    ) : null}
                    {intent && !terminal ? (
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => setReconcileOpen(true)}
                        >
                            {t("dmkod.extended.reconciled")}
                        </Button>
                    ) : null}
                    {terminal ? (
                        <Button
                            onClick={() => {
                                remember(null);
                                setSelectedId(null);
                            }}
                        >
                            {t("common.close")}
                        </Button>
                    ) : null}
                </DialogContent>
            </Dialog>
            <Dialog
                open={reconcileOpen}
                onOpenChange={(value) => {
                    if (!busy) setReconcileOpen(value);
                }}
            >
                <DialogContent className="integration-theme dmkod-theme">
                    <DialogHeader>
                        <DialogTitle>
                            {t("dmkod.extended.reconciled")}
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm">
                        {t("dmkod.extended.reconcileHint")}
                    </p>
                    <Button
                        disabled={busy}
                        onClick={() => {
                            remember(null);
                            setReconcileOpen(false);
                            setSelectedId(null);
                            setError(null);
                            void query.refetch();
                        }}
                    >
                        {t("dmkod.workflow.confirm")}
                    </Button>
                </DialogContent>
            </Dialog>
            <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
                <DialogContent
                    className="integration-theme dmkod-theme max-h-[90svh] overflow-y-auto"
                    aria-describedby={undefined}
                >
                    <DialogHeader>
                        <DialogTitle>
                            {t("dmkod.cabinet.activity.generateReports")}
                        </DialogTitle>
                    </DialogHeader>
                    {session ? (
                        <DmKodActionPanel
                            companyId={companyId}
                            module="marking"
                            session={session}
                            choices={["GenerateOrderValidation"]}
                            orderId={orderId}
                            enabled={enabled}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>
        </section>
    );
}

function readError(error: unknown, fallback: string) {
    return isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message || fallback
        : error instanceof Error
          ? error.message
          : fallback;
}
