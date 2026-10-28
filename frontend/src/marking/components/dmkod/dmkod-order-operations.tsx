import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Download, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DmKodCodeOrderingView } from "@marking/components/dmkod/dmkod-code-ordering-view";
import {
    useDmKodLocalOperation,
    useDmKodScope,
} from "@marking/components/dmkod/dmkod-scope-context";
import { Alert, AlertDescription } from "@marking/components/ui/alert";
import { Button } from "@marking/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@marking/components/ui/dialog";
import { Field, FieldGroup } from "@marking/components/ui/field";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@marking/components/ui/form";
import { Input } from "@marking/components/ui/input";
import { Label } from "@marking/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectGroup,
    SelectTrigger,
    SelectValue,
} from "@marking/components/ui/select";
import { Textarea } from "@marking/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@marking/components/ui/toggle-group";
import { dmKodKeys } from "@marking/hooks/use-dmkod";
import { dmKodWorkflowApi } from "@marking/lib/api/dmkod-workflow";
import { additionalOrderOperations } from "@marking/lib/dmkod-code-ordering-policy";
import {
    canSignCodeRequest,
    codeRequestSignatureWasNotSent,
} from "@marking/lib/dmkod-request-signing-policy";
import { dmKodScopeKey } from "@marking/lib/dmkod-scope";
import {
    destructiveOperation,
    operationFields,
    type WorkflowField,
    workflowPayload,
    workflowSchema,
    workflowTaskOutcome,
    workflowNeedsConfirmation,
} from "@marking/lib/dmkod-workflow-policy";
import { dmKodOperations } from "@marking/lib/dmkod-workflow-types";
import { cryptoProSignatureService } from "@marking/lib/honest-sign/cryptoProSignatureService";
import { downloadInBrowser } from "@marking/lib/save-file";

import type { DmKodOrderItem } from "@marking/lib/dmkod-types";
import type {
    DmKodOrderOperation,
    DmKodRequestSigningData,
} from "@marking/lib/dmkod-workflow-types";
import type { CertificateSummary } from "@marking/lib/honest-sign/types";

type Intent = {
    requestId: string;
    taskId: string | null;
    operation: DmKodOrderOperation;
};
function restoreIntent(raw: string | null): Intent | null {
    try {
        const value = JSON.parse(raw ?? "null") as Intent | null;
        return value &&
            /^[0-9a-f-]{36}$/i.test(value.requestId) &&
            dmKodOperations.includes(value.operation) &&
            (value.taskId === null || /^[0-9a-f-]{36}$/i.test(value.taskId))
            ? value
            : null;
    } catch {
        return null;
    }
}
const dictionaryFields: Record<string, string> = {
    templateId: "TEMPLATE_ID",
    cisType: "CIS_TYPE",
    paymentType: "PAYMENT_TYPE",
    freeCode: "FREE_CODE",
    releaseMethodType: "RELEASE_METHOD_TYPE",
};
export function DmKodOrderOperations({
    companyId,
    orderId,
    items = [],
    synchronization = "orders",
    enabled = true,
    panel,
    onShowRequests,
    onShowCodes,
    onBusyChange,
}: {
    companyId: string;
    orderId: number;
    items?: DmKodOrderItem[];
    synchronization?: "orders" | "poas";
    enabled?: boolean;
    panel?: "codes" | "requests" | "tools";
    onShowRequests?: () => void;
    onShowCodes?: () => void;
    onBusyChange?: (busy: boolean) => void;
}) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const key = dmKodScopeKey(scope);
    const hold = useDmKodLocalOperation();
    const client = useQueryClient();
    const storageKey = `dmkod.workflow.${key}.${orderId}${synchronization === "poas" ? ".poas" : ""}`;
    const signatureStorageKey = `dmkod.request-sign.${key}.${orderId}`;
    const [operation, setOperation] = useState<DmKodOrderOperation>(
        orderId === 0
            ? synchronization === "poas"
                ? "SynchronizePoas"
                : "Synchronize"
            : "CreateItem",
    );
    const [intent, setIntent] = useState(() =>
        restoreIntent(sessionStorage.getItem(storageKey)),
    );
    const [view, setView] = useState("codes");
    const workflowView = panel === "tools" ? "tools" : panel ? "codes" : view;
    const [actionOpen, setActionOpen] = useState(false);
    const [lockedTarget, setLockedTarget] = useState<string | null>(null);
    const [downloadRangeMode, setDownloadRangeMode] = useState("all");
    const [signIntent, setSignIntent] = useState<string | null>(() => {
        const value = sessionStorage.getItem(signatureStorageKey);
        return value && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
    });
    const [confirmValues, setConfirmValues] = useState<Record<
        string,
        string
    > | null>(null);
    const [reconcile, setReconcile] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [signingRetryId, setSigningRetryId] = useState<number | null>(null);
    const [signingData, setSigningData] =
        useState<DmKodRequestSigningData | null>(null);
    const [certificates, setCertificates] = useState<CertificateSummary[]>([]);
    const [thumbprint, setThumbprint] = useState("");
    const [localBusy, setLocalBusy] = useState(false);
    const handled = useRef<string | null>(null);
    const form = useForm<Record<string, string>>({
        resolver: zodResolver(
            workflowSchema(operation, t("dmkod.workflow.invalid")),
        ),
        defaultValues: Object.fromEntries(
            operationFields[operation].map((name) => [name, ""]),
        ),
        shouldUnregister: true,
    });
    const options = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "workflow-options"],
        queryFn: () => dmKodWorkflowApi.options(scope),
        enabled: enabled && orderId > 0,
        retry: false,
    });
    const requests = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "code-requests", orderId],
        queryFn: () => dmKodWorkflowApi.requests(scope, orderId),
        enabled: enabled && orderId > 0,
        retry: false,
        refetchInterval: (query) =>
            query.state.status !== "error" &&
            query.state.data?.requests.some((request) =>
                ["SIGNED", "PENDING"].includes(request.state),
            )
                ? 3000
                : false,
    });
    const recovery = useQuery({
        queryKey: [
            ...dmKodKeys.scoped(scope),
            "workflow-receipt",
            intent?.requestId,
        ],
        queryFn: () => dmKodWorkflowApi.receipt(scope, intent!.requestId),
        enabled: !!intent && !intent.taskId,
        retry: false,
    });
    const task = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "workflow-task", intent?.taskId],
        queryFn: () => dmKodWorkflowApi.task(scope, intent!.taskId!),
        enabled: !!intent?.taskId,
        retry: false,
        refetchInterval: (q) =>
            q.state.status === "error" ||
            ["COMPLETED", "FAILED", "UNAVAILABLE"].includes(
                q.state.data?.state ?? "",
            )
                ? false
                : 1500,
    });
    const signedRecovery = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "signed-receipt", signIntent],
        queryFn: () => dmKodWorkflowApi.signedReceipt(scope, signIntent!),
        enabled: !!signIntent,
        retry: false,
    });
    const remember = (next: Intent | null) => {
        setIntent(next);
        if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
        else sessionStorage.removeItem(storageKey);
    };
    const run = useMutation({
        retry: false,
        meta: { dmKodScopeKey: key },
        mutationFn: ({
            values,
            requestId,
            selectedOperation,
        }: {
            values: Record<string, string>;
            requestId: string;
            selectedOperation: DmKodOrderOperation;
        }) =>
            selectedOperation === "SynchronizePoas"
                ? dmKodWorkflowApi.synchronizePoas(scope, requestId)
                : dmKodWorkflowApi.run(
                      scope,
                      orderId,
                      workflowPayload(selectedOperation, values, requestId),
                  ),
    });
    const sign = useMutation({
        retry: false,
        meta: { dmKodScopeKey: key },
        mutationFn: ({
            id,
            request,
        }: {
            id: number;
            request: Parameters<typeof dmKodWorkflowApi.sign>[3];
        }) => dmKodWorkflowApi.sign(scope, orderId, id, request),
    });
    const download = useMutation({
        retry: false,
        meta: { dmKodScopeKey: key },
        mutationFn: (id: string) => dmKodWorkflowApi.file(scope, id),
    });
    const outcome = workflowTaskOutcome(task.data);
    const terminal = outcome !== "pending";
    const success = outcome === "succeeded";
    const busy =
        localBusy || run.isPending || sign.isPending || download.isPending;
    const blocked = !enabled || busy || (!!intent && !terminal) || !!signIntent;
    useEffect(() => {
        onBusyChange?.(busy);
        return () => onBusyChange?.(false);
    }, [onBusyChange, busy]);
    useEffect(() => {
        if (panel === "tools") {
            setOperation("UpdateItem");
            form.reset({});
            setLockedTarget(null);
        }
    }, [panel, form]);
    useEffect(() => {
        if (recovery.data && intent && !intent.taskId) {
            const next = { ...intent, taskId: recovery.data.backgroundTaskId };
            setError(null);
            setIntent(next);
            sessionStorage.setItem(storageKey, JSON.stringify(next));
        }
    }, [recovery.data, intent, storageKey]);
    useEffect(() => {
        if (!terminal || !intent?.taskId || handled.current === intent.taskId)
            return;
        handled.current = intent.taskId;
        void client.invalidateQueries({ queryKey: dmKodKeys.scoped(scope) });
    }, [terminal, intent?.taskId, client, scope]);
    const readError = (value: unknown) =>
        isAxiosError<{ message?: string; correlationId?: string }>(value)
            ? `${value.response?.data?.message || t("dmkod.workflow.failed")} ${value.response?.data?.correlationId ?? ""}`
            : t("dmkod.workflow.failed");
    const executeOperation = async (
        selectedOperation: DmKodOrderOperation,
        values: Record<string, string>,
    ) => {
        const requestId = crypto.randomUUID();
        setOperation(selectedOperation);
        remember({ requestId, taskId: null, operation: selectedOperation });
        setError(null);
        setConfirmValues(null);
        setActionOpen(false);
        try {
            const accepted = await run.mutateAsync({
                values,
                requestId,
                selectedOperation,
            });
            remember({
                requestId,
                taskId: accepted.backgroundTaskId,
                operation: selectedOperation,
            });
        } catch (value) {
            setError(readError(value));
        }
    };
    const submitOperation = async () => {
        if (!confirmValues || blocked) return;
        await executeOperation(operation, confirmValues);
    };
    const openOperation = (
        next: DmKodOrderOperation,
        values: Record<string, string> = {},
    ) => {
        if (blocked) return;
        if (terminal) remember(null);
        setError(null);
        setOperation(next);
        if (next === "DownloadCodes")
            setDownloadRangeMode(
                values.range === "requested" ? "all" : "custom",
            );
        form.reset(
            Object.fromEntries(
                operationFields[next].map((name) => [name, values[name] ?? ""]),
            ),
        );
        setLockedTarget(
            values.itemId ? "itemId" : values.requestId ? "requestId" : null,
        );
        if (next === "GenerateRequests" || next === "PullRequest")
            void executeOperation(next, values);
        else setActionOpen(true);
    };
    const refreshSigningRetryId = async (id: number) => {
        const refreshed = await requests.refetch();
        const current = refreshed.data?.requests.find(
            (request) => request.id === id,
        );
        return refreshed.isSuccess
            ? current && canSignCodeRequest(current)
                ? id
                : null
            : id;
    };
    const prepareSign = async (id: number) => {
        if (blocked) return;
        const release = hold();
        setLocalBusy(true);
        setError(null);
        try {
            const [data, certs] = await Promise.all([
                dmKodWorkflowApi.signingData(scope, orderId, id),
                cryptoProSignatureService.getUserCertificates(),
            ]);
            setSigningData(data);
            setSigningRetryId(null);
            setCertificates(certs);
            setThumbprint(certs[0]?.thumbprint ?? "");
        } catch (value) {
            setSigningRetryId(
                isAxiosError<{ code?: string }>(value) &&
                    codeRequestSignatureWasNotSent(
                        value.response?.status,
                        value.response?.data?.code,
                    )
                    ? await refreshSigningRetryId(id)
                    : id,
            );
            setError(readError(value));
        } finally {
            release();
            setLocalBusy(false);
        }
    };
    const sendSignature = async () => {
        if (!signingData || !thumbprint || blocked) return;
        const release = hold();
        setLocalBusy(true);
        setError(null);
        try {
            const data = signingData;
            const signed = await cryptoProSignatureService.signDetached({
                thumbprint,
                message: data.data,
            });
            const requestId = crypto.randomUUID();
            sessionStorage.setItem(signatureStorageKey, requestId);
            setSignIntent(requestId);
            const result = await sign.mutateAsync({
                id: data.requestId,
                request: {
                    clientRequestId: requestId,
                    certificateThumbprint: thumbprint,
                    payloadHash: data.payloadHash,
                    signature: signed.pkcs7,
                },
            });
            client.setQueryData(
                [...dmKodKeys.scoped(scope), "signed-receipt", requestId],
                result,
            );
            setSigningData(null);
            setCertificates([]);
            setThumbprint("");
            await requests.refetch();
            // Signing acceptance is followed by a scoped pull; its result is shown on the request.
            await executeOperation("PullRequest", {
                requestId: String(result.requestId),
            });
            setSignIntent(null);
            sessionStorage.removeItem(signatureStorageKey);
        } catch (value) {
            if (
                isAxiosError<{ code?: string }>(value) &&
                codeRequestSignatureWasNotSent(
                    value.response?.status,
                    value.response?.data?.code,
                )
            ) {
                setSignIntent(null);
                sessionStorage.removeItem(signatureStorageKey);
                setSigningData(null);
                setCertificates([]);
                setThumbprint("");
                setSigningRetryId(
                    await refreshSigningRetryId(signingData.requestId),
                );
                void client.invalidateQueries({
                    queryKey: dmKodKeys.order(scope, orderId),
                });
            }
            setError(readError(value));
        } finally {
            release();
            setLocalBusy(false);
        }
    };
    const downloadFile = async () => {
        if (!intent?.taskId || !success || !task.data?.hasFile) return;
        try {
            const blob = await download.mutateAsync(intent.taskId);
            downloadInBrowser(
                blob,
                `dmkod-codes-${intent.taskId}.${blob.type.includes("json") ? "json" : blob.type.includes("csv") ? "csv" : "txt"}`,
            );
        } catch (value) {
            setError(readError(value));
        }
    };
    const optionalItemFields: readonly WorkflowField[] =
        operation === "CreateItem" || operation === "UpdateItem"
            ? ["tag", "flag", "paymentType", "freeCode", "producer"]
            : [];
    const renderWorkflowField = (name: WorkflowField) => {
        const dictionary =
            name === "flag"
                ? operation === "Update"
                    ? "ORDER_FLAG"
                    : "ORDER_ITEM_FLAG"
                : dictionaryFields[name];
        const choices =
            name === "itemId"
                ? items.map((item) => ({
                      value: String(item.id),
                      label: `${item.product?.gtin ?? "—"} · #${item.id}`,
                  }))
                : name === "requestId"
                  ? (requests.data?.requests ?? []).map((item) => ({
                        value: String(item.id),
                        label: `#${item.id} · ${t(`dmkod.codeOrdering.states.${item.state}`, { defaultValue: item.state })}`,
                    }))
                  : name === "filetype"
                    ? ["json", "txt", "csv"].map((value) => ({
                          value,
                          label: value.toUpperCase(),
                      }))
                    : dictionary
                      ? (options.data?.[dictionary] ?? [])
                      : null;
        return (
            <FormField
                key={name}
                control={form.control}
                name={name}
                render={({ field }) => (
                    <Field
                        className={
                            name === "filecontent" ? "sm:col-span-2" : undefined
                        }
                        data-invalid={!!form.formState.errors[name]}
                    >
                        <FormItem>
                            <FormLabel>
                                {t(`dmkod.workflow.fields.${name}`)}
                            </FormLabel>
                            {name === "range" ? (
                                <div className="flex flex-col gap-2">
                                    <Select
                                        value={downloadRangeMode}
                                        disabled={blocked}
                                        onValueChange={(value) => {
                                            setDownloadRangeMode(value);
                                            field.onChange(
                                                value === "all"
                                                    ? "requested"
                                                    : "",
                                            );
                                        }}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent className="integration-theme dmkod-theme">
                                            <SelectGroup>
                                                <SelectItem value="all">
                                                    {t(
                                                        "dmkod.codeOrdering.allCodes",
                                                    )}
                                                </SelectItem>
                                                <SelectItem value="custom">
                                                    {t(
                                                        "dmkod.codeOrdering.customRange",
                                                    )}
                                                </SelectItem>
                                            </SelectGroup>
                                        </SelectContent>
                                    </Select>
                                    {downloadRangeMode === "custom" ? (
                                        <Input
                                            {...field}
                                            value={field.value ?? ""}
                                            disabled={blocked}
                                            aria-label={t(
                                                "dmkod.codeOrdering.rangeNumbers",
                                            )}
                                            aria-invalid={
                                                !!form.formState.errors[name]
                                            }
                                            placeholder="1-100"
                                        />
                                    ) : null}
                                </div>
                            ) : choices ? (
                                <Select
                                    value={field.value || "__empty__"}
                                    disabled={
                                        blocked ||
                                        options.isLoading ||
                                        lockedTarget === name
                                    }
                                    onValueChange={(value) =>
                                        field.onChange(
                                            value === "__empty__" ? "" : value,
                                        )
                                    }
                                >
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="integration-theme dmkod-theme">
                                        <SelectGroup>
                                            <SelectItem value="__empty__">
                                                {t("dmkod.workflow.choose")}
                                            </SelectItem>
                                            {choices.map((choice) => (
                                                <SelectItem
                                                    key={choice.value}
                                                    value={choice.value}
                                                >
                                                    {choice.label}
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                            ) : name === "filecontent" ? (
                                <FormControl>
                                    <Textarea
                                        {...field}
                                        value={field.value ?? ""}
                                        disabled={blocked}
                                        rows={5}
                                    />
                                </FormControl>
                            ) : (
                                <FormControl>
                                    <Input
                                        {...field}
                                        value={field.value ?? ""}
                                        disabled={blocked}
                                        inputMode={
                                            [
                                                "quantity",
                                                "gtin",
                                                "producer",
                                            ].includes(name)
                                                ? "numeric"
                                                : undefined
                                        }
                                    />
                                </FormControl>
                            )}
                            <FormMessage />
                        </FormItem>
                    </Field>
                )}
            />
        );
    };
    const operationForm = (
        <Form {...form}>
            <form
                className="flex flex-col gap-3"
                onSubmit={form.handleSubmit((values) => {
                    if (
                        workflowNeedsConfirmation(
                            operation,
                            orderId > 0 && workflowView === "codes",
                        )
                    ) {
                        setActionOpen(false);
                        setConfirmValues(values);
                    } else void executeOperation(operation, values);
                })}
            >
                <FieldGroup className="grid gap-3 sm:grid-cols-2">
                    {operationFields[operation]
                        .filter((name) => !optionalItemFields.includes(name))
                        .map(renderWorkflowField)}
                </FieldGroup>
                {!!optionalItemFields.length && (
                    <details className="rounded-md border p-3">
                        <summary className="cursor-pointer text-sm font-medium">
                            {t("dmkod.codeOrdering.optionalFields")}
                        </summary>
                        <FieldGroup className="mt-3 grid gap-3 sm:grid-cols-2">
                            {optionalItemFields.map(renderWorkflowField)}
                        </FieldGroup>
                    </details>
                )}
                {options.isError || requests.isError ? (
                    <Alert variant="destructive">
                        <AlertDescription>
                            {t("dmkod.workflow.loadFailed")}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    void options.refetch();
                                    void requests.refetch();
                                }}
                            >
                                {t("common.retry")}
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : null}
                <Button
                    type="submit"
                    className="h-auto min-h-9 max-w-full whitespace-normal"
                    disabled={
                        blocked ||
                        (operationFields[operation].some(
                            (field) =>
                                dictionaryFields[field] || field === "flag",
                        ) &&
                            !options.data)
                    }
                >
                    {busy ? (
                        <LoaderCircle
                            className="animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                        />
                    ) : null}
                    {t(`dmkod.workflow.operations.${operation}`)}
                </Button>
            </form>
        </Form>
    );
    return (
        <section
            className={
                orderId > 0
                    ? "flex flex-col gap-4"
                    : "flex flex-col gap-4 rounded-lg border p-4"
            }
            aria-label={t(
                orderId === 0
                    ? `dmkod.workflow.operations.${operation}`
                    : workflowView === "tools"
                      ? "dmkod.codeOrdering.otherOperations"
                      : "dmkod.codeOrdering.title",
            )}
        >
            {orderId > 0 && !panel ? (
                <ToggleGroup
                    type="single"
                    variant="outline"
                    value={view}
                    onValueChange={(value) => {
                        if (!value) return;
                        setView(value);
                        if (value === "tools") {
                            setOperation("UpdateItem");
                            form.reset({});
                            setLockedTarget(null);
                        }
                    }}
                    className="flex-wrap"
                    aria-label={t("dmkod.codeOrdering.navigation")}
                >
                    <ToggleGroupItem value="codes">
                        {t("dmkod.codeOrdering.title")}
                    </ToggleGroupItem>
                    <ToggleGroupItem value="tools">
                        {t("dmkod.codeOrdering.otherOperations")}
                    </ToggleGroupItem>
                </ToggleGroup>
            ) : orderId === 0 ? (
                <div>
                    <h3 className="font-semibold">
                        {t(`dmkod.workflow.operations.${operation}`)}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t(
                            synchronization === "poas"
                                ? "dmkod.poasSync.description"
                                : "dmkod.codeOrdering.syncHint",
                        )}
                    </p>
                </div>
            ) : null}
            {orderId > 0 && workflowView === "tools" ? (
                <div>
                    <h3 className="font-semibold">
                        {t("dmkod.codeOrdering.otherOperations")}
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t("dmkod.codeOrdering.otherHint")}
                    </p>
                </div>
            ) : null}
            {!enabled && synchronization === "poas" ? (
                <p className="text-sm text-muted-foreground">
                    {t("dmkod.poasSync.requiresConnection")}
                </p>
            ) : null}
            {(error && !signingData) ||
            task.isError ||
            (recovery.isError && !intent?.taskId && !run.isPending) ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {error || readError(task.error || recovery.error)}
                        {signingRetryId !== null ? (
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={blocked}
                                onClick={() => void prepareSign(signingRetryId)}
                            >
                                <RefreshCw aria-hidden="true" />
                                {t("dmkod.workflow.reloadSigningData")}
                            </Button>
                        ) : null}
                    </AlertDescription>
                </Alert>
            ) : null}
            {intent &&
            (task.data?.state !== "UNAVAILABLE" ||
                workflowView === "tools" ||
                orderId === 0) &&
            (orderId === 0 ||
                workflowView === "tools" ||
                !terminal ||
                !success ||
                intent.operation === "DownloadCodes") ? (
                <div
                    className="flex flex-col gap-2 rounded-md border bg-muted/30 p-3"
                    role="status"
                >
                    <p className="font-medium">
                        {t(`dmkod.workflow.operations.${intent.operation}`)} ·{" "}
                        {task.data?.state === "UNAVAILABLE"
                            ? t("dmkod.workflow.taskUnavailable")
                            : task.data
                              ? t(`dmkod.codeOrdering.task.${outcome}`)
                              : t("dmkod.workflow.unknown")}
                    </p>
                    {orderId === 0 || workflowView === "tools" ? (
                        <p className="font-mono text-xs break-all">
                            {intent.requestId}
                        </p>
                    ) : null}
                    {synchronization === "poas" && task.data ? (
                        <p className="text-sm">
                            {t(`dmkod.poasSync.${outcome}`)}
                        </p>
                    ) : null}
                    {task.data?.messages.map((message, i) => (
                        <p key={i} className="text-sm">
                            {message.key} {message.level}
                        </p>
                    ))}
                    <div className="flex flex-wrap gap-2">
                        {!terminal ? (
                            <Button
                                variant="outline"
                                className="h-auto min-h-9 max-w-full whitespace-normal"
                                disabled={busy}
                                onClick={() =>
                                    void (intent.taskId
                                        ? task.refetch()
                                        : recovery.refetch())
                                }
                            >
                                <RefreshCw aria-hidden="true" />
                                {t("dmkod.workflow.recover")}
                            </Button>
                        ) : (
                            <Button
                                variant="outline"
                                onClick={() => remember(null)}
                            >
                                {t(
                                    orderId > 0 && workflowView === "codes"
                                        ? "dmkod.codeOrdering.dismissTask"
                                        : "dmkod.workflow.next",
                                )}
                            </Button>
                        )}
                        {intent.operation === "DownloadCodes" &&
                        success &&
                        task.data?.hasFile ? (
                            <Button
                                disabled={busy}
                                onClick={() => void downloadFile()}
                            >
                                <Download aria-hidden="true" />
                                {t("dmkod.workflow.download")}
                            </Button>
                        ) : null}
                        {!terminal ? (
                            <Button
                                variant="outline"
                                className="h-auto min-h-9 max-w-full whitespace-normal"
                                disabled={busy}
                                onClick={() => setReconcile(true)}
                            >
                                {t("dmkod.workflow.reconcile")}
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : null}
            {signIntent ? (
                <div
                    className="flex flex-col gap-2 rounded-md border p-3"
                    role="status"
                >
                    <p>
                        {signedRecovery.data
                            ? t("dmkod.codeOrdering.signatureAccepted")
                            : t("dmkod.workflow.unknown")}
                    </p>
                    <p className="font-mono text-xs break-all">
                        {signedRecovery.data?.uuid ?? signIntent}
                    </p>
                    {signedRecovery.data ? (
                        <Button
                            variant="outline"
                            disabled={busy || !enabled}
                            onClick={() => {
                                const requestId =
                                    signedRecovery.data!.requestId;
                                void executeOperation("PullRequest", {
                                    requestId: String(requestId),
                                }).then(() => {
                                    setSignIntent(null);
                                    sessionStorage.removeItem(
                                        signatureStorageKey,
                                    );
                                });
                            }}
                        >
                            {t("dmkod.codeOrdering.checkResponse")}
                        </Button>
                    ) : (
                        <>
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => void signedRecovery.refetch()}
                            >
                                {t("dmkod.workflow.recover")}
                            </Button>
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => setReconcile(true)}
                            >
                                {t("dmkod.workflow.reconcile")}
                            </Button>
                        </>
                    )}
                </div>
            ) : null}
            {orderId > 0 && workflowView === "tools" ? (
                <div className="flex flex-col gap-2">
                    <Label htmlFor={`dmkod-operation-${orderId}`}>
                        {t("dmkod.workflow.operation")}
                    </Label>
                    <Select
                        value={operation}
                        disabled={blocked}
                        onValueChange={(value) => {
                            setOperation(value as DmKodOrderOperation);
                            form.reset(
                                Object.fromEntries(
                                    operationFields[
                                        value as DmKodOrderOperation
                                    ].map((name) => [name, ""]),
                                ),
                            );
                        }}
                    >
                        <SelectTrigger id={`dmkod-operation-${orderId}`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="integration-theme dmkod-theme">
                            <SelectGroup>
                                {additionalOrderOperations.map((value) => (
                                    <SelectItem key={value} value={value}>
                                        {t(
                                            `dmkod.workflow.operations.${value}`,
                                        )}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            ) : null}
            {orderId === 0 || workflowView === "tools" ? operationForm : null}
            {orderId > 0 && workflowView === "codes" ? (
                <DmKodCodeOrderingView
                    companyId={companyId}
                    section={
                        panel === "requests"
                            ? "requests"
                            : panel === "codes"
                              ? "codes"
                              : "all"
                    }
                    onShowRequests={onShowRequests}
                    onShowCodes={onShowCodes}
                    items={items}
                    requests={requests.data?.requests ?? []}
                    loading={requests.isLoading}
                    fetching={requests.isFetching}
                    failed={requests.isError}
                    blocked={blocked}
                    onOperation={openOperation}
                    onSign={(id) => void prepareSign(id)}
                    onRefresh={() => {
                        void requests.refetch();
                        void client.invalidateQueries({
                            queryKey: dmKodKeys.order(scope, orderId),
                        });
                    }}
                />
            ) : null}
            <Dialog
                open={actionOpen}
                onOpenChange={(open) => {
                    if (!busy) setActionOpen(open);
                }}
            >
                <DialogContent className="integration-theme dmkod-theme max-h-[90svh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            {t(`dmkod.workflow.operations.${operation}`)}
                        </DialogTitle>
                        <DialogDescription>
                            {t("dmkod.codeOrdering.actionHint", {
                                orderId,
                                environment: scope.environment,
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    {operationForm}
                </DialogContent>
            </Dialog>
            <Dialog
                open={!!confirmValues}
                onOpenChange={(open) => {
                    if (!open && !busy) setConfirmValues(null);
                }}
            >
                <DialogContent className="integration-theme dmkod-theme">
                    <DialogHeader>
                        <DialogTitle>
                            {t(`dmkod.workflow.operations.${operation}`)}
                        </DialogTitle>
                        <DialogDescription>
                            {t(
                                synchronization === "poas"
                                    ? "dmkod.poasSync.confirmHint"
                                    : destructiveOperation(operation)
                                      ? "dmkod.workflow.destructiveHint"
                                      : "dmkod.workflow.confirmHint",
                                { orderId, environment: scope.environment },
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    {confirmValues?.requestId || confirmValues?.itemId ? (
                        <p className="rounded-md border px-3 py-2 text-sm">
                            {t(
                                confirmValues.requestId
                                    ? "dmkod.workflow.fields.requestId"
                                    : "dmkod.workflow.fields.itemId",
                            )}
                            :{" "}
                            <span className="font-mono" translate="no">
                                #
                                {confirmValues.requestId ||
                                    confirmValues.itemId}
                            </span>
                        </p>
                    ) : null}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setConfirmValues(null)}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button
                            variant={
                                destructiveOperation(operation)
                                    ? "destructive"
                                    : "default"
                            }
                            disabled={blocked}
                            onClick={() => void submitOperation()}
                        >
                            {t("dmkod.workflow.confirm")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog
                open={!!signingData}
                onOpenChange={(open) => {
                    if (!open && !busy) {
                        setSigningData(null);
                        setCertificates([]);
                        setThumbprint("");
                    }
                }}
            >
                <DialogContent className="integration-theme dmkod-theme">
                    <DialogHeader>
                        <DialogTitle>{t("dmkod.workflow.sign")}</DialogTitle>
                        <DialogDescription>
                            {t("dmkod.workflow.signHint", {
                                id: signingData?.requestId,
                                environment: scope.environment,
                            })}
                        </DialogDescription>
                    </DialogHeader>
                    <Label htmlFor="dmkod-request-certificate">
                        {t("dmkod.connection.certificate")}
                    </Label>
                    <Select
                        value={thumbprint}
                        onValueChange={setThumbprint}
                        disabled={busy}
                    >
                        <SelectTrigger id="dmkod-request-certificate">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="integration-theme dmkod-theme">
                            <SelectGroup>
                                {certificates.map((cert) => (
                                    <SelectItem
                                        key={cert.thumbprint}
                                        value={cert.thumbprint}
                                    >
                                        {cert.name || cert.subjectName}
                                    </SelectItem>
                                ))}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                    {!certificates.length ? (
                        <p role="alert">{t("dmkod.workflow.noCertificates")}</p>
                    ) : null}
                    {error ? (
                        <Alert variant="destructive">
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    ) : null}
                    <DialogFooter>
                        <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                                setSigningData(null);
                                setCertificates([]);
                                setThumbprint("");
                            }}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button
                            disabled={blocked || !thumbprint}
                            onClick={() => void sendSignature()}
                        >
                            {t("dmkod.workflow.sign")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
            <Dialog open={reconcile} onOpenChange={setReconcile}>
                <DialogContent className="integration-theme dmkod-theme">
                    <DialogHeader>
                        <DialogTitle>
                            {t("dmkod.workflow.reconcile")}
                        </DialogTitle>
                        <DialogDescription>
                            {t("dmkod.workflow.reconcileHint")}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setReconcile(false)}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button
                            disabled={busy}
                            onClick={() => {
                                remember(null);
                                setSignIntent(null);
                                sessionStorage.removeItem(signatureStorageKey);
                                setReconcile(false);
                                setError(null);
                            }}
                        >
                            {t("dmkod.workflow.reconciled")}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </section>
    );
}
