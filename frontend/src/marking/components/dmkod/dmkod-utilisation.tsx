import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import {
    CheckCircle2,
    CircleAlert,
    Download,
    FileUp,
    LoaderCircle,
    RefreshCw,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { DmKodEnvironmentTarget } from "@marking/components/dmkod/dmkod-environment-workspace";
import { useDmKodScope } from "@marking/components/dmkod/dmkod-scope-context";
import { Alert, AlertDescription, AlertTitle } from "@marking/components/ui/alert";
import { Button } from "@marking/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@marking/components/ui/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
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
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@marking/components/ui/select";
import { Textarea } from "@marking/components/ui/textarea";
import {
    useDmKodPushUtilisation,
    useDmKodUtilisationOptions,
    useDmKodUtilisationTask,
} from "@marking/hooks/use-dmkod";
import { dmKodApi } from "@marking/lib/api/dmkod";
import { dmKodScopeStorageKey } from "@marking/lib/dmkod-scope";
import {
    formatDmKodUtilisationCodes,
    parseDmKodUtilisationJson,
    serializeDmKodUtilisationJson,
} from "@marking/lib/dmkod-utilisation-json";
import {
    dmKodCalendarDate,
    parseUtilisationCodes,
    readUtilisationPending,
    utilisationTaskSucceeded,
    validateUtilisation,
} from "@marking/lib/dmkod-utilisation-policy";
import { workflowTaskOutcome } from "@marking/lib/dmkod-workflow-policy";

import type {
    DmKodUtilisationAttributes,
    PushDmKodUtilisation,
} from "@marking/lib/dmkod-types";
import type { UtilisationPending } from "@marking/lib/dmkod-utilisation-policy";

const commonFields = [
    "productionDate",
    "expirationDate",
    "seriesNumber",
    "batchNumber",
] as const;
const advancedGroups = [
    [
        "participants",
        [
            "ownerUuid",
            "subjectUuid",
            "packingUuid",
            "controlUuid",
            "customsReceiverUuid",
            "participantInn",
            "kpp",
            "fiasUuid",
            "vetisUuid",
        ],
    ],
    [
        "product",
        [
            "expirationDateLess72",
            "expirationDateOver72",
            "alcoholVolume",
            "documentNumber",
            "documentDate",
        ],
    ],
] as const;
const attributeFields = [
    ...commonFields,
    "productionOrderType",
    "usedInProduction",
    ...advancedGroups.flatMap(([, fields]) => fields),
] as const;
type AttributeField = (typeof attributeFields)[number];
type Values = Record<
    | AttributeField
    | "includeText"
    | "excludeText"
    | "expirationSetIndex"
    | "expirationSetDate",
    string
>;
const defaults = Object.fromEntries(
    [
        ...attributeFields,
        "includeText",
        "excludeText",
        "expirationSetIndex",
        "expirationSetDate",
    ].map((field) => [field, ""]),
) as Values;

export function DmKodUtilisation({
    companyId,
    enabled,
    onPrepared,
    onBusyChange,
}: {
    companyId: string;
    enabled: boolean;
    onPrepared?: () => void;
    onBusyChange?: (busy: boolean) => void;
}) {
    const scope = useDmKodScope(companyId);
    const storageKey = dmKodScopeStorageKey(scope, "utilisation");
    return (
        <DmKodUtilisationForm
            key={storageKey}
            storageKey={storageKey}
            companyId={companyId}
            enabled={enabled}
            onPrepared={onPrepared}
            onBusyChange={onBusyChange}
        />
    );
}

function DmKodUtilisationForm({
    companyId,
    enabled,
    onPrepared,
    onBusyChange,
    storageKey,
}: {
    companyId: string;
    enabled: boolean;
    onPrepared?: () => void;
    onBusyChange?: (busy: boolean) => void;
    storageKey: string;
}) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const options = useDmKodUtilisationOptions(scope, enabled);
    const push = useDmKodPushUtilisation(scope);
    const [pending, setPending] = useState<UtilisationPending | null>(() =>
        readUtilisationPending(sessionStorage.getItem(storageKey)),
    );
    const [confirmation, setConfirmation] =
        useState<PushDmKodUtilisation | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [recovering, setRecovering] = useState(false);
    const [importing, setImporting] = useState(false);
    const frozenRequest = useRef<PushDmKodUtilisation | null>(null);
    const importVersion = useRef(0);
    useEffect(
        () => () => {
            importVersion.current++;
        },
        [],
    );
    const task = useDmKodUtilisationTask(
        scope,
        pending?.backgroundTaskId ?? null,
    );
    const schema = useMemo(
        () =>
            z.object(
                Object.fromEntries(
                    Object.keys(defaults).map((field) => [field, z.string()]),
                ) as Record<keyof Values, z.ZodString>,
            ),
        [],
    );
    const form = useForm<Values>({
        resolver: zodResolver(schema),
        defaultValues: defaults,
    });
    const includeText = form.watch("includeText");
    const excludeText = form.watch("excludeText");
    const includedCount = parseUtilisationCodes(includeText, true).codes.length;
    const excludedCount = parseUtilisationCodes(excludeText, false).codes
        .length;
    const terminal = workflowTaskOutcome(task.data) !== "pending";
    const unknownTask = task.data?.state === "COMPLETED" && !terminal;
    const succeeded = !!task.data && utilisationTaskSucceeded(task.data);
    const locked = !enabled || !!pending || push.isPending || importing;
    const operationBusy = push.isPending || importing || recovering;
    useEffect(() => {
        onBusyChange?.(operationBusy);
        return () => onBusyChange?.(false);
    }, [onBusyChange, operationBusy]);

    const remember = (next: UtilisationPending | null) => {
        setPending(next);
        if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
        else sessionStorage.removeItem(storageKey);
    };

    useEffect(() => {
        if (!pending || terminal) return;
        const protect = (event: BeforeUnloadEvent) => {
            event.preventDefault();
        };
        window.addEventListener("beforeunload", protect);
        return () => window.removeEventListener("beforeunload", protect);
    }, [pending, terminal]);

    const prepareRequest = (values: Values): PushDmKodUtilisation | null => {
        if (!enabled || !options.data || locked) return null;
        form.clearErrors();
        const attributes: DmKodUtilisationAttributes = Object.fromEntries(
            attributeFields
                .filter((field) => values[field].trim())
                .map((field) => [field, values[field].trim()]),
        );
        if (values.expirationSetIndex.trim() || values.expirationSetDate)
            attributes.expirationDateOver72Set = {
                index: values.expirationSetIndex.trim() || undefined,
                expirationDate: values.expirationSetDate || undefined,
            };
        const parsed = validateUtilisation(
            values.includeText,
            values.excludeText,
            attributes,
            options.data,
        );
        for (const issue of parsed.issues)
            form.setError(issue.field as keyof Values, {
                message: t(`dmkod.utilisation.validation.${issue.key}`, {
                    line: issue.line ?? "",
                    limit: options.data.maxCodesInReportPush ?? "—",
                }),
            });
        if (parsed.issues.length) {
            form.setFocus(parsed.issues[0].field as keyof Values);
            return null;
        }
        return {
            clientRequestId: crypto.randomUUID(),
            include: parsed.include,
            exclude: parsed.exclude,
            attributes,
        };
    };

    const submit = form.handleSubmit((values) => {
        const request = prepareRequest(values);
        if (request) setConfirmation(request);
    });

    const exportJson = form.handleSubmit((values) => {
        const request = prepareRequest(values);
        if (!request) return;
        const url = URL.createObjectURL(
            new Blob([serializeDmKodUtilisationJson(request)], {
                type: "application/json;charset=utf-8",
            }),
        );
        const link = document.createElement("a");
        link.href = url;
        link.download = `dmkod-utilisation-${values.productionDate || dmKodCalendarDate()}.json`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    });

    const importJson = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || locked) return;
        if (file.size > 20 * 1024 * 1024) {
            form.setError("includeText", {
                message: t("dmkod.utilisation.fileTooLarge"),
            });
            return;
        }
        setImporting(true);
        const version = ++importVersion.current;
        try {
            const imported = parseDmKodUtilisationJson(await file.text());
            if (version !== importVersion.current) return;
            const nextValues: Values = {
                ...defaults,
                includeText: imported.includeText,
                excludeText: imported.excludeText,
                expirationSetIndex:
                    imported.attributes.expirationDateOver72Set?.index ?? "",
                expirationSetDate:
                    imported.attributes.expirationDateOver72Set
                        ?.expirationDate ?? "",
            };
            for (const name of attributeFields)
                nextValues[name] = imported.attributes[name] ?? "";
            form.reset(nextValues);
            setError(null);
        } catch {
            if (version !== importVersion.current) return;
            form.setError("includeText", {
                message: t("dmkod.utilisation.jsonInvalid"),
            });
        } finally {
            if (version === importVersion.current) setImporting(false);
        }
    };

    const send = async (request: PushDmKodUtilisation) => {
        if (!enabled) return;
        frozenRequest.current = request;
        remember({
            clientRequestId: request.clientRequestId,
            backgroundTaskId: null,
            included: request.include.length,
            excluded: request.exclude.length,
        });
        setConfirmation(null);
        setError(null);
        try {
            const accepted = await push.mutateAsync(request);
            remember({
                clientRequestId: request.clientRequestId,
                backgroundTaskId: accepted.backgroundTaskId,
                included: request.include.length,
                excluded: request.exclude.length,
            });
        } catch (caught) {
            setError(readError(caught, t("dmkod.utilisation.unknown")));
        }
    };

    const recover = async () => {
        if (!pending) return;
        setRecovering(true);
        setError(null);
        try {
            const accepted = await dmKodApi.recoverUtilisation(
                scope,
                pending.clientRequestId,
            );
            remember({
                ...pending,
                backgroundTaskId: accepted.backgroundTaskId,
            });
        } catch (caught) {
            if (isAxiosError(caught) && caught.response?.status === 404) {
                remember(null);
                frozenRequest.current = null;
                setError(t("dmkod.utilisation.notSubmitted"));
            } else setError(readError(caught, t("dmkod.utilisation.unknown")));
        } finally {
            setRecovering(false);
        }
    };

    const importFile = async (
        event: React.ChangeEvent<HTMLInputElement>,
        field: "includeText" | "excludeText",
    ) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || locked) return;
        if (file.size > 20 * 1024 * 1024) {
            form.setError(field, {
                message: t("dmkod.utilisation.fileTooLarge"),
            });
            return;
        }
        setImporting(true);
        const version = ++importVersion.current;
        try {
            const text = await file.text();
            if (version !== importVersion.current) return;
            const include = field === "includeText";
            const current = parseUtilisationCodes(
                form.getValues(field),
                include,
            );
            const imported = parseUtilisationCodes(text, include);
            const issue = [...current.issues, ...imported.issues][0];
            if (issue) {
                form.setError(field, {
                    message: t(`dmkod.utilisation.validation.${issue.key}`, {
                        line: issue.line ?? "",
                    }),
                });
                return;
            }
            form.setValue(
                field,
                formatDmKodUtilisationCodes([
                    ...current.codes,
                    ...imported.codes,
                ]),
                { shouldDirty: true },
            );
            form.clearErrors(field);
        } catch {
            if (version !== importVersion.current) return;
            form.setError(field, {
                message: t("dmkod.utilisation.fileFailed"),
            });
        } finally {
            if (version === importVersion.current) setImporting(false);
        }
    };

    const field = (name: AttributeField) => (
        <FormField
            key={name}
            control={form.control}
            name={name}
            render={({ field: input }) => (
                <FormItem>
                    <FormLabel>
                        {t(`dmkod.utilisation.fields.${name}`)}
                    </FormLabel>
                    <FormControl>
                        <Input
                            {...input}
                            type={
                                name.endsWith("Date") ||
                                name === "expirationDateOver72"
                                    ? "date"
                                    : "text"
                            }
                            max={
                                name === "productionDate"
                                    ? dmKodCalendarDate()
                                    : undefined
                            }
                            min={
                                name === "expirationDate"
                                    ? dmKodCalendarDate()
                                    : undefined
                            }
                            maxLength={
                                name === "seriesNumber"
                                    ? 20
                                    : name === "batchNumber"
                                      ? 49
                                      : name === "documentNumber"
                                        ? 255
                                        : name === "participantInn"
                                          ? 12
                                          : name === "kpp"
                                            ? 10
                                            : 200
                            }
                            placeholder={
                                name === "expirationDateLess72"
                                    ? "2026-10-05T12:00:00+03:00"
                                    : undefined
                            }
                        />
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );

    return (
        <Card>
            <CardHeader className="border-b">
                <CardTitle>{t("dmkod.utilisation.title")}</CardTitle>
                <CardDescription>
                    {t("dmkod.utilisation.description")}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                {error && !pending ? (
                    <Alert variant="destructive">
                        <CircleAlert aria-hidden="true" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}
                {options.isError ? (
                    <Alert variant="destructive">
                        <CircleAlert aria-hidden="true" />
                        <AlertTitle>
                            {t("dmkod.utilisation.optionsFailed")}
                        </AlertTitle>
                        <AlertDescription>
                            <p>
                                {readError(
                                    options.error,
                                    t("dmkod.utilisation.optionsFailed"),
                                )}
                            </p>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => void options.refetch()}
                            >
                                {t("common.retry")}
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : null}
                {options.data?.maxCodesInReportPush === null ? (
                    <Alert>
                        <CircleAlert aria-hidden="true" />
                        <AlertDescription>
                            {t("dmkod.utilisation.limitUnavailable")}
                        </AlertDescription>
                    </Alert>
                ) : null}
                {pending ? (
                    <div
                        className="space-y-3 rounded-md border bg-muted/20 p-4"
                        aria-live="polite"
                    >
                        <div className="flex items-start gap-2">
                            {succeeded ? (
                                <CheckCircle2
                                    className="mt-0.5 size-5 shrink-0"
                                    aria-hidden="true"
                                />
                            ) : terminal || error || task.isError ? (
                                <CircleAlert
                                    className="mt-0.5 size-5 shrink-0"
                                    aria-hidden="true"
                                />
                            ) : (
                                <LoaderCircle
                                    className="mt-0.5 size-5 shrink-0 animate-spin"
                                    aria-hidden="true"
                                />
                            )}
                            <div className="min-w-0">
                                <p className="font-medium">
                                    {t(
                                        succeeded
                                            ? "dmkod.utilisation.success"
                                            : unknownTask
                                              ? "dmkod.application.unknownTask"
                                              : terminal
                                                ? "dmkod.utilisation.failed"
                                                : pending.backgroundTaskId
                                                  ? "dmkod.utilisation.processing"
                                                  : "dmkod.utilisation.unknownTitle",
                                    )}
                                </p>
                                <p className="mt-1 text-sm text-muted-foreground">
                                    {t(
                                        succeeded
                                            ? "dmkod.application.preparedHint"
                                            : pending.backgroundTaskId
                                              ? "dmkod.utilisation.processingHint"
                                              : "dmkod.utilisation.unknown",
                                    )}
                                </p>
                            </div>
                        </div>
                        <details className="text-sm">
                            <summary className="cursor-pointer text-muted-foreground">
                                {t("dmkod.application.technicalDetails")}
                            </summary>
                            <dl className="mt-2 grid gap-3 text-sm sm:grid-cols-2">
                                <div>
                                    <dt className="text-muted-foreground">
                                        {t("dmkod.utilisation.requestId")}
                                    </dt>
                                    <dd className="font-mono break-all">
                                        {pending.clientRequestId}
                                    </dd>
                                </div>
                                {pending.backgroundTaskId ? (
                                    <div>
                                        <dt className="text-muted-foreground">
                                            {t("dmkod.utilisation.taskId")}
                                        </dt>
                                        <dd className="font-mono break-all">
                                            {pending.backgroundTaskId}
                                        </dd>
                                    </div>
                                ) : null}
                            </dl>
                            {task.data ? (
                                <p className="text-sm">
                                    {t("dmkod.utilisation.taskState", {
                                        state: task.data.state,
                                        result: task.data.resultState ?? "—",
                                    })}
                                </p>
                            ) : null}
                        </details>
                        {succeeded ? (
                            <>
                                <p className="text-sm">
                                    {t("dmkod.utilisation.result", {
                                        id: task.data?.utilisationId ?? "—",
                                        included: task.data?.included ?? "—",
                                        excluded: task.data?.excluded ?? "—",
                                        notFound: task.data?.notFound ?? "—",
                                    })}
                                </p>
                                {(task.data?.notFound ?? 0) > 0 ? (
                                    <p className="text-sm text-destructive">
                                        {t("dmkod.utilisation.notFound")}
                                    </p>
                                ) : null}
                            </>
                        ) : null}
                        {error || task.isError ? (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {error ||
                                    readError(
                                        task.error,
                                        t("dmkod.utilisation.statusFailed"),
                                    )}
                            </p>
                        ) : null}
                        {task.data?.messages.length ? (
                            <ul className="list-disc space-y-1 pl-5 text-sm">
                                {task.data.messages.map((message, index) => (
                                    <li key={index}>
                                        {message.level} · {message.key}
                                    </li>
                                ))}
                            </ul>
                        ) : null}
                        <div className="flex flex-wrap gap-2">
                            {succeeded && onPrepared ? (
                                <Button type="button" onClick={onPrepared}>
                                    {t("dmkod.application.continueReports")}
                                </Button>
                            ) : null}
                            {pending.backgroundTaskId ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void task.refetch()}
                                    disabled={task.isFetching}
                                >
                                    <RefreshCw aria-hidden="true" />
                                    {t("dmkod.utilisation.refreshStatus")}
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => void recover()}
                                        disabled={recovering || push.isPending}
                                    >
                                        {t("dmkod.utilisation.recover")}
                                    </Button>
                                    {frozenRequest.current ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={
                                                push.isPending || recovering
                                            }
                                            onClick={() =>
                                                void send(
                                                    frozenRequest.current!,
                                                )
                                            }
                                        >
                                            {t("dmkod.utilisation.retrySame")}
                                        </Button>
                                    ) : null}
                                </>
                            )}
                            {terminal ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => {
                                        remember(null);
                                        frozenRequest.current = null;
                                        form.reset(defaults);
                                    }}
                                >
                                    {t("dmkod.utilisation.new")}
                                </Button>
                            ) : null}
                        </div>
                    </div>
                ) : null}
                <Form {...form}>
                    <form
                        onSubmit={submit}
                        className={pending ? "hidden" : "flex flex-col gap-5"}
                        noValidate
                    >
                        <fieldset
                            disabled={locked}
                            className="min-w-0 space-y-5"
                        >
                            <div className="space-y-2">
                                <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring hover:bg-muted">
                                    <FileUp
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    {t("dmkod.utilisation.importJson")}
                                    <input
                                        type="file"
                                        accept=".json,application/json"
                                        className="sr-only"
                                        disabled={locked}
                                        onChange={(event) =>
                                            void importJson(event)
                                        }
                                    />
                                </label>
                                <p className="text-sm text-muted-foreground">
                                    {t("dmkod.utilisation.jsonHint")}
                                </p>
                            </div>
                            <div className="grid gap-5 lg:grid-cols-2">
                                {(["includeText", "excludeText"] as const).map(
                                    (name) => (
                                        <FormField
                                            key={name}
                                            control={form.control}
                                            name={name}
                                            render={({ field: input }) => (
                                                <FormItem>
                                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                                        <FormLabel>
                                                            {t(
                                                                `dmkod.utilisation.${name}`,
                                                            )}
                                                        </FormLabel>
                                                        <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-sm focus-within:ring-2 focus-within:ring-ring hover:bg-muted">
                                                            <FileUp
                                                                className="size-4"
                                                                aria-hidden="true"
                                                            />
                                                            {t(
                                                                "dmkod.utilisation.import",
                                                            )}
                                                            <input
                                                                type="file"
                                                                accept={
                                                                    name ===
                                                                    "includeText"
                                                                        ? ".txt,.csv,text/plain,text/csv"
                                                                        : ".txt,.csv,text/plain,text/csv"
                                                                }
                                                                className="sr-only"
                                                                disabled={
                                                                    locked
                                                                }
                                                                onChange={(
                                                                    event,
                                                                ) =>
                                                                    void importFile(
                                                                        event,
                                                                        name,
                                                                    )
                                                                }
                                                            />
                                                        </label>
                                                    </div>
                                                    <FormControl>
                                                        <Textarea
                                                            {...input}
                                                            rows={7}
                                                            className="field-sizing-fixed font-mono"
                                                            spellCheck={false}
                                                            autoComplete="off"
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ),
                                )}
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {t("dmkod.utilisation.codesHint")}
                            </p>
                            <details className="rounded-md border p-3">
                                <summary className="cursor-pointer text-sm font-medium">
                                    {t("dmkod.utilisation.codeAttributes")}
                                </summary>
                                <p className="mt-3 text-sm text-muted-foreground">
                                    {t("dmkod.utilisation.csvHint")}
                                </p>
                                <p className="mt-2 overflow-x-auto font-mono text-sm">
                                    code;x97;x30;x3103;x310y;x311y;x335y
                                </p>
                                <p className="mt-2 text-sm text-muted-foreground">
                                    {t("dmkod.utilisation.numericHint")}
                                </p>
                            </details>
                            <div className="space-y-3 border-t pt-4">
                                <h3 className="font-medium">
                                    {t("dmkod.utilisation.attributes")}
                                </h3>
                                <p className="text-sm text-muted-foreground">
                                    {t("dmkod.utilisation.optional")}
                                </p>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    {commonFields.map(field)}
                                    {(
                                        [
                                            "productionOrderType",
                                            "usedInProduction",
                                        ] as const
                                    ).map((name) => (
                                        <FormField
                                            key={name}
                                            control={form.control}
                                            name={name}
                                            render={({ field: input }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t(
                                                            `dmkod.utilisation.fields.${name}`,
                                                        )}
                                                    </FormLabel>
                                                    <Select
                                                        value={
                                                            input.value ||
                                                            "none"
                                                        }
                                                        onValueChange={(
                                                            value,
                                                        ) =>
                                                            input.onChange(
                                                                value === "none"
                                                                    ? ""
                                                                    : value,
                                                            )
                                                        }
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger className="w-full">
                                                                <SelectValue />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent className="integration-theme dmkod-theme">
                                                            <SelectItem value="none">
                                                                {t(
                                                                    "dmkod.utilisation.unspecified",
                                                                )}
                                                            </SelectItem>
                                                            {(name ===
                                                            "productionOrderType"
                                                                ? options.data
                                                                      ?.productionOrderTypes
                                                                : options.data
                                                                      ?.usedInProduction
                                                            )?.map((item) => (
                                                                <SelectItem
                                                                    key={
                                                                        item.value
                                                                    }
                                                                    value={
                                                                        item.value
                                                                    }
                                                                >
                                                                    {item.label}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ))}
                                </div>
                            </div>
                            <details
                                className="rounded-md border p-3"
                                open={
                                    Object.keys(form.formState.errors).some(
                                        (name) =>
                                            ![
                                                "includeText",
                                                "excludeText",
                                                ...commonFields,
                                                "productionOrderType",
                                                "usedInProduction",
                                            ].includes(name),
                                    ) || undefined
                                }
                            >
                                <summary className="cursor-pointer font-medium">
                                    {t("dmkod.utilisation.advanced")}
                                </summary>
                                <div className="mt-4 space-y-5">
                                    {advancedGroups.map(([group, fields]) => (
                                        <section
                                            key={group}
                                            className="space-y-3"
                                        >
                                            <h4 className="text-sm font-medium">
                                                {t(
                                                    `dmkod.utilisation.groups.${group}`,
                                                )}
                                            </h4>
                                            <div className="grid gap-4 sm:grid-cols-2">
                                                {fields.map(field)}
                                            </div>
                                        </section>
                                    ))}
                                    <div className="grid gap-4 sm:grid-cols-2">
                                        {(
                                            [
                                                "expirationSetIndex",
                                                "expirationSetDate",
                                            ] as const
                                        ).map((name) => (
                                            <FormField
                                                key={name}
                                                control={form.control}
                                                name={name}
                                                render={({ field: input }) => (
                                                    <FormItem>
                                                        <FormLabel>
                                                            {t(
                                                                `dmkod.utilisation.fields.${name}`,
                                                            )}
                                                        </FormLabel>
                                                        <FormControl>
                                                            <Input
                                                                {...input}
                                                                maxLength={
                                                                    name ===
                                                                    "expirationSetIndex"
                                                                        ? 512
                                                                        : undefined
                                                                }
                                                                type={
                                                                    name ===
                                                                    "expirationSetDate"
                                                                        ? "date"
                                                                        : "text"
                                                                }
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </details>
                        </fieldset>
                        <div className="flex flex-col gap-3 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm tabular-nums">
                                {t("dmkod.utilisation.summary", {
                                    included:
                                        pending?.included ?? includedCount,
                                    excluded:
                                        pending?.excluded ?? excludedCount,
                                    limit:
                                        options.data?.maxCodesInReportPush ??
                                        "—",
                                })}
                            </p>
                            <div className="flex flex-col gap-2 sm:flex-row">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => void exportJson()}
                                    disabled={
                                        locked ||
                                        !options.data ||
                                        options.data.maxCodesInReportPush ===
                                            null ||
                                        options.isFetching
                                    }
                                >
                                    <Download aria-hidden="true" />
                                    {t("dmkod.utilisation.exportJson")}
                                </Button>
                                <Button
                                    type="submit"
                                    disabled={
                                        locked ||
                                        !enabled ||
                                        !options.data ||
                                        options.data.maxCodesInReportPush ===
                                            null ||
                                        options.isFetching
                                    }
                                >
                                    {options.isLoading || push.isPending ? (
                                        <LoaderCircle
                                            className="animate-spin"
                                            aria-hidden="true"
                                        />
                                    ) : null}
                                    {t("dmkod.utilisation.submit")}
                                </Button>
                            </div>
                        </div>
                    </form>
                </Form>
                <Dialog
                    open={!!confirmation}
                    onOpenChange={(open) => {
                        if (!open) setConfirmation(null);
                    }}
                >
                    <DialogContent className="integration-theme dmkod-theme">
                        <DialogHeader>
                            <DialogTitle>
                                {t("dmkod.utilisation.confirmTitle")}
                            </DialogTitle>
                            <DialogDescription>
                                {t("dmkod.utilisation.confirm", {
                                    included: confirmation?.include.length ?? 0,
                                    excluded: confirmation?.exclude.length ?? 0,
                                })}
                            </DialogDescription>
                        </DialogHeader>
                        <DmKodEnvironmentTarget companyId={companyId} />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setConfirmation(null)}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button
                                type="button"
                                onClick={() => {
                                    if (confirmation) void send(confirmation);
                                }}
                            >
                                {t("dmkod.utilisation.submit")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

function readError(error: unknown, fallback: string) {
    return isAxiosError<{ message?: string }>(error)
        ? error.response?.data?.message || fallback
        : error instanceof Error
          ? error.message
          : fallback;
}
