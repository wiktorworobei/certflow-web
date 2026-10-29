import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import { Download, LoaderCircle, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { DmKodAggregationJsonInput } from "@marking/components/dmkod/dmkod-aggregation-json-input";
import {
    useDmKodLocalOperation,
    useDmKodScope,
} from "@marking/components/dmkod/dmkod-scope-context";
import { Alert, AlertDescription } from "@marking/components/ui/alert";
import { Badge } from "@marking/components/ui/badge";
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
    FormDescription,
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
    SelectTrigger,
    SelectValue,
} from "@marking/components/ui/select";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@marking/components/ui/table";
import { Textarea } from "@marking/components/ui/textarea";
import { dmKodKeys } from "@marking/hooks/use-dmkod";
import { dmKodExtendedApi } from "@marking/lib/api/dmkod-extended";
import { parseDmKodAggregationRangesJson } from "@marking/lib/dmkod-aggregation-json";
import { dmKodReportPreparationWasNotSent } from "@marking/lib/dmkod-aggregation-policy";
import {
    actionFields,
    availableActions,
    availableReads,
    buildExtendedAction,
    buildExtendedRead,
    extendedDefaults,
    extendedFormSchema,
    freezeDmKodActionConfirmation,
    dmKodConfirmationStillAvailable,
    extendedTaskSettled,
    readExtendedIntent,
    readFields,
} from "@marking/lib/dmkod-extended-policy";
import {
    orderMarkingReads,
    orderMarkingActions,
    usesDmKodOrderId,
    withDmKodOrderTarget,
    type DmKodOrderMarkingCategory,
} from "@marking/lib/dmkod-order-layout-policy";
import { dmKodScopeKey } from "@marking/lib/dmkod-scope";
import {
    isDmKodWorkflowOutcomeUncertain,
    isDmKodWorkflowReceiptPending,
} from "@marking/lib/dmkod-workflow-recovery";
import { cryptoProSignatureService } from "@marking/lib/honest-sign/cryptoProSignatureService";
import { downloadInBrowser } from "@marking/lib/save-file";

import type {
    DmKodModule,
    ExtendedField,
    ExtendedIntent,
    ExtendedValues,
    DmKodActionConfirmation,
} from "@marking/lib/dmkod-extended-policy";
import type {
    DmKodAction,
    DmKodActionRequest,
    DmKodContainerTree,
    DmKodExtendedResult,
    DmKodReadMethod,
    DmKodReadRequest,
} from "@marking/lib/dmkod-extended-types";
import type { DmKodSession } from "@marking/lib/dmkod-types";
import type { CertificateSummary } from "@marking/lib/honest-sign/types";

export function DmKodApiTools({
    companyId,
    module,
    session,
    orderId,
    category,
    enabled = true,
    onBusyChange,
}: {
    companyId: string;
    module: DmKodModule;
    session: DmKodSession;
    orderId?: number;
    category?: DmKodOrderMarkingCategory;
    enabled?: boolean;
    onBusyChange?: (busy: boolean) => void;
}) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const [provider, setProvider] = useState<string>("");
    const profile = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "extended-profile"],
        queryFn: () => dmKodExtendedApi.read(scope, { method: "Profile" }),
        enabled:
            session.externalRole !== "SERVICE" &&
            !session.requiresPasswordChange,
        retry: false,
    });
    const providers =
        profile.data?.profile?.integratees.filter(
            (p) =>
                p.type === "SERVICEPROVIDER" && p.access === "OPENED" && p.id,
        ) ?? [];
    const allowed =
        enabled &&
        !session.requiresPasswordChange &&
        (module === "account" ||
            module === "reference" ||
            session.externalCompanyType === "SERVICEPROVIDER" ||
            !!provider);
    const reads = availableReads(module, session.externalRole).filter(
        (method) => !category || orderMarkingReads[category].includes(method),
    );
    const actions = availableActions(module, session.externalRole).filter(
        (action) => !category || orderMarkingActions[category].includes(action),
    );
    return (
        <div className="space-y-4">
            {!orderId ? (
                <Alert>
                    <AlertDescription>
                        {t("dmkod.extended.notice")}
                    </AlertDescription>
                </Alert>
            ) : null}
            {session.externalCompanyType === "INTEGRATOR" ? (
                <div className="space-y-2">
                    <Label htmlFor={`provider-${module}`}>
                        {t("dmkod.extended.provider")}
                    </Label>
                    <Select
                        value={provider}
                        onValueChange={setProvider}
                        disabled={profile.isFetching}
                    >
                        <SelectTrigger
                            id={`provider-${module}`}
                            className="w-full"
                        >
                            <SelectValue
                                placeholder={t("dmkod.extended.chooseProvider")}
                            />
                        </SelectTrigger>
                        <SelectContent className="integration-theme dmkod-theme">
                            {providers.map((p) => (
                                <SelectItem key={p.id} value={String(p.id)}>
                                    {p.name} · {p.inn}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {profile.isError ? (
                        <Alert variant="destructive">
                            <AlertDescription>
                                {message(profile.error, t("dmkod.errors.read"))}
                                <Button
                                    variant="outline"
                                    onClick={() => void profile.refetch()}
                                >
                                    {t("common.retry")}
                                </Button>
                            </AlertDescription>
                        </Alert>
                    ) : null}
                    {!profile.isFetching &&
                    !profile.isError &&
                    !providers.length ? (
                        <p className="text-sm text-muted-foreground">
                            {t("dmkod.extended.noProviders")}
                        </p>
                    ) : null}
                </div>
            ) : null}
            {!allowed ? (
                <Alert>
                    <AlertDescription>
                        {t("dmkod.extended.permission")}
                    </AlertDescription>
                </Alert>
            ) : null}
            <div
                key={`${dmKodScopeKey(scope)}.${provider}.${orderId ?? "global"}`}
                className="grid gap-4 xl:grid-cols-2"
            >
                {reads.length ? (
                    <ReadPanel
                        companyId={companyId}
                        module={module}
                        choices={reads}
                        category={category}
                        orderId={orderId}
                        provider={provider ? Number(provider) : undefined}
                        enabled={allowed}
                    />
                ) : null}
                {actions.length ? (
                    <DmKodActionPanel
                        key={`${provider || "self"}.${orderId ?? "general"}.${category ?? module}`}
                        companyId={companyId}
                        module={module}
                        provider={provider ? Number(provider) : undefined}
                        enabled={allowed}
                        session={session}
                        choices={actions}
                        orderId={orderId}
                        category={category}
                        onBusyChange={onBusyChange}
                    />
                ) : null}
            </div>
        </div>
    );
}

function ReadPanel({
    companyId,
    module,
    provider,
    enabled,
    choices,
    category,
    orderId,
}: {
    companyId: string;
    module: DmKodModule;
    provider?: number;
    enabled: boolean;
    choices: DmKodReadMethod[];
    category?: DmKodOrderMarkingCategory;
    orderId?: number;
}) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const [method, setMethod] = useState<DmKodReadMethod>(choices[0]);
    const [request, setRequest] = useState<DmKodReadRequest | null>(() =>
        orderId ? { method: choices[0], id: orderId } : null,
    );
    const effectiveMethod = orderId ? choices[0] : method;
    const fields = readFields(effectiveMethod);
    const form = useForm<ExtendedValues>({
        resolver: zodResolver(
            extendedFormSchema(fields, t("dmkod.extended.invalid"), [
                "search",
                "dateFrom",
                "dateTo",
            ]),
        ),
        defaultValues: withDmKodOrderTarget(method, extendedDefaults, orderId),
    });
    const scopedRequest = orderId
        ? { method: effectiveMethod, id: orderId, serviceProviderId: provider }
        : request;
    const query = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "extended", scopedRequest],
        queryFn: () => dmKodExtendedApi.read(scope, scopedRequest!),
        enabled: enabled && !!scopedRequest,
        retry: false,
    });
    return (
        <Card className="min-w-0">
            <CardHeader>
                <CardTitle>
                    {t(
                        category
                            ? `dmkod.orderLayout.data.${category}`
                            : "dmkod.extended.readTitle",
                    )}
                </CardTitle>
                <CardDescription>
                    {orderId
                        ? t("dmkod.reports.order", { id: orderId })
                        : t(`dmkod.extended.modules.${module}`)}
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {choices.length > 1 ? (
                    <MethodSelect
                        id={`read-${module}`}
                        value={method}
                        choices={choices}
                        onChange={(v) => {
                            setMethod(v as DmKodReadMethod);
                            setRequest(null);
                            form.reset(
                                withDmKodOrderTarget(
                                    v,
                                    extendedDefaults,
                                    orderId,
                                ),
                            );
                        }}
                        disabled={query.isFetching}
                    />
                ) : null}
                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit((v) =>
                            setRequest(
                                buildExtendedRead(
                                    effectiveMethod,
                                    withDmKodOrderTarget(
                                        effectiveMethod,
                                        v,
                                        orderId,
                                    ),
                                    provider,
                                ),
                            ),
                        )}
                        className="space-y-4"
                        noValidate
                    >
                        <Fields
                            form={form}
                            fields={
                                orderId && usesDmKodOrderId(effectiveMethod)
                                    ? fields.filter((field) => field !== "id")
                                    : fields
                            }
                            disabled={query.isFetching || !enabled}
                        />
                        <Button
                            type="submit"
                            disabled={!enabled || query.isFetching}
                        >
                            {query.isFetching ? (
                                <LoaderCircle
                                    className="animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <RefreshCw aria-hidden="true" />
                            )}
                            {t("dmkod.extended.read")}
                        </Button>
                    </form>
                </Form>
                {query.isError ? (
                    <Alert variant="destructive">
                        <AlertDescription>
                            {message(query.error, t("dmkod.errors.read"))}
                            <Button
                                variant="outline"
                                onClick={() => void query.refetch()}
                            >
                                {t("common.retry")}
                            </Button>
                        </AlertDescription>
                    </Alert>
                ) : null}
                {query.isFetching ? (
                    <p role="status">{t("common.loading")}</p>
                ) : null}
                {query.data && !query.isFetching ? (
                    <Result result={query.data} />
                ) : null}
            </CardContent>
        </Card>
    );
}

export function DmKodActionPanel({
    companyId,
    module,
    provider,
    enabled,
    session,
    choices,
    orderId,
    category,
    onBusyChange,
    initialValues,
    onCompleted,
    fixedReportId,
    flowKey,
    onOutcomeChange,
}: {
    companyId: string;
    module: DmKodModule;
    provider?: number;
    enabled: boolean;
    session: DmKodSession;
    choices: DmKodAction[];
    orderId?: number;
    category?: DmKodOrderMarkingCategory;
    onBusyChange?: (busy: boolean) => void;
    initialValues?: Partial<ExtendedValues>;
    onCompleted?: () => void;
    fixedReportId?: number;
    flowKey?: string;
    onOutcomeChange?: (
        outcome: "idle" | "pending" | "succeeded" | "failed",
    ) => void;
}) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const hold = useDmKodLocalOperation();
    const client = useQueryClient();
    const [selectedAction, setAction] = useState<DmKodAction>(choices[0]);
    const action = choices.includes(selectedAction)
        ? selectedAction
        : choices[0];
    const [reconcile, setReconcile] = useState(false);
    const storageKey = `dmkod.extended.${dmKodScopeKey(scope)}.${provider ?? "self"}.${module}${orderId ? `.order.${orderId}.${category ?? "all"}` : ""}${flowKey ? `.flow.${flowKey}` : ""}`;
    const [intent, setIntent] = useState<ExtendedIntent | null>(() =>
        readExtendedIntent(sessionStorage.getItem(storageKey)),
    );
    const [confirm, setConfirm] = useState<DmKodActionConfirmation | null>(
        null,
    );
    const confirmedAction = confirm?.action ?? action;
    const [document, setDocument] = useState<"nda" | "contract" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uncertainError, setUncertainError] = useState<string | null>(null);
    const operationError = (value: unknown, recovering = false) => {
        if (
            module === "marking" &&
            (isDmKodWorkflowOutcomeUncertain(value) ||
                (recovering && isDmKodWorkflowReceiptPending(value)))
        ) {
            setError(null);
            setUncertainError(message(value, t("dmkod.workflow.unknown")));
        } else setError(message(value, t("dmkod.extended.failed")));
    };
    const [thumbprint, setThumbprint] = useState(
        session.certificateThumbprint ?? "",
    );
    const [certificates, setCertificates] = useState<CertificateSummary[]>([]);
    const [certBusy, setCertBusy] = useState(false);
    const [jsonBusy, setJsonBusy] = useState(false);
    const target = (method: string, values: ExtendedValues) =>
        fixedReportId &&
        ["SignAggregation", "PullAggregation", "DeleteAggregation"].includes(
            method,
        )
            ? { ...values, id: String(fixedReportId) }
            : withDmKodOrderTarget(method, values, orderId);
    const fields = actionFields(action);
    const form = useForm<ExtendedValues>({
        resolver: zodResolver(
            extendedFormSchema(
                fields,
                t("dmkod.extended.invalid"),
                action === "UpdateProfile"
                    ? ["username", "nickname", "email"]
                    : [],
            ),
        ),
        defaultValues: {
            ...target(action, extendedDefaults),
            ...initialValues,
        },
    });
    const remember = (next: ExtendedIntent | null) => {
        setIntent(next);
        if (next) sessionStorage.setItem(storageKey, JSON.stringify(next));
        else sessionStorage.removeItem(storageKey);
    };
    const task = useQuery({
        queryKey: [
            ...dmKodKeys.scoped(scope),
            "extended-task",
            intent?.backgroundTaskId,
        ],
        queryFn: () => dmKodExtendedApi.task(scope, intent!.backgroundTaskId!),
        enabled: !!intent?.backgroundTaskId && (enabled || !!orderId),
        retry: false,
        refetchInterval: (q) =>
            ["COMPLETED", "FAILED"].includes(q.state.data?.state ?? "")
                ? false
                : 2500,
    });
    const terminal = extendedTaskSettled(task.data);
    const settled =
        !!intent?.accepted && (!intent.backgroundTaskId || terminal);
    useEffect(() => {
        onOutcomeChange?.(
            !intent
                ? "idle"
                : !settled
                  ? "pending"
                  : task.data?.state === "FAILED" ||
                      task.data?.resultState === "FAILED"
                    ? "failed"
                    : "succeeded",
        );
    }, [
        intent,
        settled,
        task.data?.state,
        task.data?.resultState,
        onOutcomeChange,
    ]);
    useEffect(() => {
        if (terminal)
            void client.invalidateQueries({
                queryKey: dmKodKeys.scoped(scope),
            });
    }, [terminal, client, scope]);
    const run = useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: async ({
            values,
            download,
            selectedAction,
        }: {
            values?: ExtendedValues;
            download?: "nda" | "contract";
            selectedAction: DmKodAction;
        }) => {
            const action = selectedAction;
            const release = hold();
            setError(null);
            setUncertainError(null);
            try {
                const id = crypto.randomUUID();
                if (download) {
                    const blob = await dmKodExtendedApi.downloadLegal(
                        scope,
                        download,
                        id,
                    );
                    downloadInBrowser(blob, `${download}.docx`);
                    await client.invalidateQueries({
                        queryKey: dmKodKeys.scoped(scope),
                    });
                    return;
                }
                if (!values) return;
                const payload: DmKodActionRequest = buildExtendedAction(
                    action,
                    values,
                    id,
                    provider,
                );
                if (
                    [
                        "SignValidation",
                        "SignAggregation",
                        "ConnectCompany",
                    ].includes(action)
                ) {
                    const data =
                        action === "ConnectCompany"
                            ? await dmKodExtendedApi.companySigningData(
                                  scope,
                                  values.inn,
                              )
                            : await dmKodExtendedApi.signingData(
                                  scope,
                                  action === "SignValidation"
                                      ? "validation"
                                      : "aggregation",
                                  Number(values.id),
                                  provider,
                                  action === "SignAggregation"
                                      ? orderId
                                      : undefined,
                              );
                    const signature =
                        await cryptoProSignatureService.signDetached({
                            thumbprint,
                            message: data.data,
                        });
                    const sign =
                        cryptoProSignatureService.normalizeDetachedSignature(
                            signature.pkcs7,
                        );
                    if (action === "ConnectCompany")
                        payload.connection = {
                            companyRole: values.companyRole,
                            data: data.data,
                            payloadHash: data.payloadHash,
                            signature: sign,
                            certificateThumbprint: thumbprint,
                        };
                    else
                        payload.signing = {
                            clientRequestId: id,
                            signature: sign,
                            certificateThumbprint: thumbprint,
                            payloadHash: data.payloadHash,
                        };
                }
                const next: ExtendedIntent = {
                    clientRequestId: id,
                    action,
                    backgroundTaskId: null,
                    accepted: false,
                };
                remember(next);
                let receipt: Awaited<ReturnType<typeof dmKodExtendedApi.run>>;
                try {
                    receipt = await dmKodExtendedApi.run(scope, payload);
                } catch (error) {
                    if (
                        dmKodReportPreparationWasNotSent(error, action) &&
                        readExtendedIntent(sessionStorage.getItem(storageKey))
                            ?.clientRequestId === id
                    )
                        remember(null);
                    throw error;
                }
                remember({
                    ...next,
                    backgroundTaskId: receipt.backgroundTaskId,
                    accepted: true,
                });
                form.reset(target(action, extendedDefaults));
                await client.invalidateQueries({
                    queryKey: dmKodKeys.scoped(scope),
                });
                if (onCompleted && receipt.backgroundTaskId === null) {
                    remember(null);
                    onCompleted();
                }
            } finally {
                release();
                form.setValue("password", "");
            }
        },
        onError: (e) => operationError(e),
    });
    const recover = useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: async () => {
            if (!intent) return;
            const release = hold();
            try {
                const receipt = await dmKodExtendedApi.receipt(
                    scope,
                    intent.clientRequestId,
                );
                remember({
                    ...intent,
                    accepted: true,
                    backgroundTaskId: receipt.backgroundTaskId,
                });
                setError(null);
                setUncertainError(null);
                await client.invalidateQueries({
                    queryKey: dmKodKeys.scoped(scope),
                });
            } finally {
                release();
            }
        },
        onError: (e) => operationError(e, true),
    });
    const busy = run.isPending || recover.isPending || certBusy || jsonBusy;
    useEffect(() => {
        if (
            confirm &&
            !busy &&
            !dmKodConfirmationStillAvailable(confirm, choices)
        )
            setConfirm(null);
    }, [confirm, busy, choices]);
    const locked = !enabled || busy || (!!intent && !settled);
    useEffect(() => {
        onBusyChange?.(busy);
        return () => onBusyChange?.(false);
    }, [onBusyChange, busy]);
    const fixedAccount = module === "account" && choices.length === 1;
    const needsCertificate = [
        "SignValidation",
        "SignAggregation",
        "ConnectCompany",
    ].includes(action);
    return (
        <Card
            className={
                fixedAccount
                    ? "gap-0 border-0 bg-transparent py-0 shadow-none"
                    : "min-w-0"
            }
        >
            {!fixedAccount ? (
                <CardHeader>
                    <CardTitle>
                        {t(
                            choices.length === 1
                                ? `dmkod.extended.methods.${action}`
                                : category
                                  ? `dmkod.orderLayout.actions.${category}`
                                  : "dmkod.extended.actionTitle",
                        )}
                    </CardTitle>
                    <CardDescription>
                        {t(
                            fixedReportId
                                ? "dmkod.aggregation.selectedReportHint"
                                : flowKey === "ranges-generate"
                                  ? "dmkod.aggregation.generateHint"
                                  : action === "PushAggregationRanges"
                                    ? "dmkod.aggregation.prepareHint"
                                    : orderId
                                      ? "dmkod.orderLayout.markingHint"
                                      : "dmkod.extended.actionHint",
                            { id: fixedReportId ?? orderId },
                        )}
                    </CardDescription>
                </CardHeader>
            ) : null}
            <CardContent
                className={fixedAccount ? "space-y-4 px-0" : "space-y-4"}
            >
                {choices.length > 1 ? (
                    <MethodSelect
                        id={`action-${module}-${category ?? "all"}-${flowKey ?? "general"}`}
                        value={action}
                        choices={choices}
                        onChange={(v) => {
                            setAction(v as DmKodAction);
                            form.reset(target(v, extendedDefaults));
                            setError(null);
                        }}
                        disabled={locked}
                    />
                ) : null}
                <Form {...form}>
                    <form
                        className="space-y-4"
                        noValidate
                        onSubmit={form.handleSubmit((v) => {
                            const values = target(action, v);
                            if (
                                action === "UpdateProfile" ||
                                action === "UpdateDefaults"
                            )
                                run.mutate({ values, selectedAction: action });
                            else
                                setConfirm(
                                    freezeDmKodActionConfirmation(
                                        action,
                                        values,
                                    ),
                                );
                        })}
                    >
                        <Fields
                            form={form}
                            fields={
                                fixedReportId ||
                                (orderId && usesDmKodOrderId(action))
                                    ? fields.filter((field) => field !== "id")
                                    : fields
                            }
                            disabled={locked}
                            defaults={initialValues?.settings}
                            companyId={companyId}
                            onJsonBusyChange={setJsonBusy}
                        />
                        {needsCertificate ? (
                            <div className="space-y-2">
                                <Label
                                    htmlFor={`cert-${module}-${category ?? "all"}`}
                                >
                                    {t("dmkod.extended.certificate")}
                                </Label>
                                <Select
                                    value={thumbprint}
                                    onValueChange={setThumbprint}
                                    disabled={locked}
                                >
                                    <SelectTrigger
                                        id={`cert-${module}-${category ?? "all"}`}
                                        className="w-full"
                                    >
                                        <SelectValue
                                            placeholder={t(
                                                "dmkod.extended.chooseCertificate",
                                            )}
                                        />
                                    </SelectTrigger>
                                    <SelectContent className="integration-theme dmkod-theme">
                                        {certificates.map((c) => (
                                            <SelectItem
                                                key={c.thumbprint}
                                                value={c.thumbprint}
                                            >
                                                {c.name ||
                                                    c.subjectName ||
                                                    c.thumbprint}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    variant="outline"
                                    type="button"
                                    disabled={locked}
                                    onClick={async () => {
                                        const release = hold();
                                        setCertBusy(true);
                                        try {
                                            setCertificates(
                                                await cryptoProSignatureService.getUserCertificates(),
                                            );
                                        } catch (e) {
                                            setError(
                                                message(
                                                    e,
                                                    t("dmkod.extended.failed"),
                                                ),
                                            );
                                        } finally {
                                            setCertBusy(false);
                                            release();
                                        }
                                    }}
                                >
                                    {t("dmkod.extended.loadCertificates")}
                                </Button>
                            </div>
                        ) : null}
                        <Button
                            type="submit"
                            disabled={
                                locked || (needsCertificate && !thumbprint)
                            }
                        >
                            {run.isPending ? (
                                <LoaderCircle
                                    className="animate-spin"
                                    aria-hidden="true"
                                />
                            ) : null}
                            {t(
                                module === "account" && choices.length === 1
                                    ? "common.save"
                                    : "dmkod.extended.execute",
                            )}
                        </Button>
                    </form>
                </Form>
                {module === "account" &&
                session.externalRole === "SUPERUSER" ? (
                    <div className="flex flex-wrap gap-2 border-t pt-4">
                        {(["nda", "contract"] as const).map((d) => (
                            <Button
                                key={d}
                                variant="outline"
                                disabled={locked}
                                onClick={() => setDocument(d)}
                            >
                                <Download aria-hidden="true" />
                                {t(`dmkod.extended.${d}`)}
                            </Button>
                        ))}
                    </div>
                ) : null}
                {error ? (
                    <Alert variant="destructive">
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}
                {intent ? (
                    <div className="space-y-2 border-t pt-4" aria-live="polite">
                        <p className="font-medium">
                            {t(`dmkod.extended.methods.${intent.action}`)}
                        </p>
                        <p className="font-mono text-xs break-all">
                            {intent.clientRequestId}
                        </p>
                        <Badge variant="outline">
                            {!intent.accepted
                                ? t("dmkod.extended.unknown")
                                : intent.backgroundTaskId
                                  ? `${task.data?.state ?? "PENDING"} · ${task.data?.resultState ?? "—"}`
                                  : t("dmkod.extended.accepted")}
                        </Badge>
                        {!intent.accepted && uncertainError ? (
                            <p className="text-sm" role="status">
                                {uncertainError}
                            </p>
                        ) : null}
                        {!intent.accepted ? (
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => recover.mutate()}
                            >
                                {t("dmkod.extended.recover")}
                            </Button>
                        ) : null}
                        {intent.backgroundTaskId ? (
                            <Button
                                variant="outline"
                                disabled={busy || task.isFetching}
                                onClick={() => void task.refetch()}
                            >
                                {t("common.refresh")}
                            </Button>
                        ) : null}
                        {task.isError ? (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    {message(
                                        task.error,
                                        t("dmkod.errors.read"),
                                    )}
                                </AlertDescription>
                            </Alert>
                        ) : null}
                        {task.data ? (
                            <div className="space-y-2">
                                <p>
                                    {t("dmkod.extended.resultIds")}:{" "}
                                    {[
                                        task.data.validationId,
                                        task.data.aggregationId,
                                        ...task.data.reportIds,
                                    ]
                                        .filter(Boolean)
                                        .join(", ") || "—"}
                                </p>
                                <Counts counts={task.data.counts} />
                                <ul className="text-sm">
                                    {task.data.messages.map((m, i) => (
                                        <li key={i}>
                                            {m.key} · {m.level}
                                        </li>
                                    ))}
                                </ul>
                                {task.data.containers.length ? (
                                    <Trees trees={task.data.containers} />
                                ) : null}
                            </div>
                        ) : null}
                        {settled ? (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    remember(null);
                                    setError(null);
                                }}
                            >
                                {t("dmkod.extended.next")}
                            </Button>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-sm text-muted-foreground">
                                    {t("dmkod.extended.recoveryHint")}
                                </p>
                                {!intent.accepted ? (
                                    <Button
                                        variant="outline"
                                        disabled={busy}
                                        onClick={() => setReconcile(true)}
                                    >
                                        {t("dmkod.extended.reconciled")}
                                    </Button>
                                ) : null}
                            </div>
                        )}
                    </div>
                ) : null}
                <Dialog
                    open={!!confirm || !!document || reconcile}
                    onOpenChange={(open) => {
                        if (!open && !busy) {
                            setConfirm(null);
                            setDocument(null);
                            setReconcile(false);
                        }
                    }}
                >
                    <DialogContent className="integration-theme dmkod-theme">
                        <DialogHeader>
                            <DialogTitle>
                                {t("dmkod.extended.confirm")}
                            </DialogTitle>
                            <DialogDescription>
                                {reconcile
                                    ? t("dmkod.extended.reconcileHint")
                                    : confirmedAction ===
                                            "PushAggregationRanges" && confirm
                                      ? t(
                                            "dmkod.aggregation.confirmPreparation",
                                            {
                                                id:
                                                    orderId ??
                                                    confirm.values.id,
                                                environment: scope.environment,
                                                provider:
                                                    provider ??
                                                    session.externalCompanyName ??
                                                    "—",
                                                count: parseDmKodAggregationRangesJson(
                                                    confirm.values
                                                        .aggregationRanges,
                                                    Number(confirm.values.id),
                                                ).containers.length,
                                            },
                                        )
                                      : flowKey === "ranges-generate"
                                        ? t(
                                              "dmkod.aggregation.confirmGeneration",
                                              {
                                                  id: orderId,
                                                  environment:
                                                      scope.environment,
                                              },
                                          )
                                        : flowKey &&
                                            flowKey !== "additional" &&
                                            category === "aggregation"
                                          ? t(
                                                "dmkod.aggregation.confirmOperation",
                                                {
                                                    id: orderId,
                                                    report:
                                                        fixedReportId ?? "—",
                                                    environment:
                                                        scope.environment,
                                                    operation: t(
                                                        `dmkod.extended.methods.${confirmedAction}`,
                                                    ),
                                                },
                                            )
                                          : t("dmkod.extended.confirmHint", {
                                                operation: document
                                                    ? t(
                                                          `dmkod.extended.${document}`,
                                                      )
                                                    : t(
                                                          `dmkod.extended.methods.${confirmedAction}`,
                                                      ),
                                                environment: scope.environment,
                                                target:
                                                    provider ??
                                                    session.externalCompanyName ??
                                                    "—",
                                            })}
                            </DialogDescription>
                        </DialogHeader>
                        {confirm ? (
                            <dl className="space-y-2 text-sm">
                                {(
                                    [
                                        "id",
                                        "username",
                                        "email",
                                        "role",
                                        "access",
                                        "inn",
                                        "companyRole",
                                    ] as const
                                )
                                    .filter(
                                        (f) =>
                                            actionFields(
                                                confirmedAction,
                                            ).includes(f) && confirm.values[f],
                                    )
                                    .map((f) => (
                                        <div key={f}>
                                            <dt className="text-muted-foreground">
                                                {t(
                                                    f === "id" &&
                                                        flowKey &&
                                                        flowKey !== "additional"
                                                        ? fixedReportId
                                                            ? "dmkod.aggregation.reportLabel"
                                                            : "dmkod.aggregation.orderLabel"
                                                        : `dmkod.extended.fields.${f}`,
                                                )}
                                            </dt>
                                            <dd className="font-medium break-all">
                                                {confirm.values[f]}
                                            </dd>
                                        </div>
                                    ))}
                            </dl>
                        ) : null}
                        <DialogFooter>
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => {
                                    setConfirm(null);
                                    setDocument(null);
                                    setReconcile(false);
                                }}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button
                                disabled={busy}
                                onClick={() => {
                                    if (reconcile) {
                                        remember(null);
                                        setError(null);
                                        setReconcile(false);
                                        return;
                                    }
                                    if (
                                        confirm &&
                                        !dmKodConfirmationStillAvailable(
                                            confirm,
                                            choices,
                                        )
                                    ) {
                                        setConfirm(null);
                                        return;
                                    }
                                    const values = confirm?.values;
                                    const selectedAction = confirmedAction;
                                    const download = document ?? undefined;
                                    setConfirm(null);
                                    setDocument(null);
                                    run.mutate({
                                        values,
                                        download,
                                        selectedAction,
                                    });
                                }}
                            >
                                {t("dmkod.extended.execute")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </CardContent>
        </Card>
    );
}

function MethodSelect({
    id,
    value,
    choices,
    onChange,
    disabled,
}: {
    id: string;
    value: string;
    choices: readonly string[];
    onChange: (v: string) => void;
    disabled: boolean;
}) {
    const { t } = useTranslation();
    return (
        <div className="space-y-2">
            <Label htmlFor={id}>{t("dmkod.extended.method")}</Label>
            <Select value={value} onValueChange={onChange} disabled={disabled}>
                <SelectTrigger
                    id={id}
                    className="h-auto min-h-9 w-full text-left [&>span]:whitespace-normal"
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent className="integration-theme dmkod-theme">
                    {choices.map((v) => (
                        <SelectItem key={v} value={v}>
                            {t(`dmkod.extended.methods.${v}`)}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
function Fields({
    form,
    fields,
    disabled,
    defaults,
    companyId,
    onJsonBusyChange,
}: {
    form: ReturnType<typeof useForm<ExtendedValues>>;
    fields: ExtendedField[];
    disabled: boolean;
    defaults?: string;
    companyId?: string;
    onJsonBusyChange?: (busy: boolean) => void;
}) {
    const { t } = useTranslation();
    const selects: Partial<Record<ExtendedField, string[]>> = {
        role: ["USER", "SUPERUSER"],
        access: ["OPENED", "CLOSED"],
        companyRole: [
            "PRINTERY",
            "CUSTOMS",
            "LOGISTICS",
            "CONTRACTS",
            "COMMISSIONS",
        ],
    };
    return (
        <div className="space-y-4">
            {fields.map((name) => (
                <FormField
                    key={name}
                    control={form.control}
                    name={name}
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>
                                {t(
                                    name === "settings" &&
                                        defaults !== undefined
                                        ? "dmkod.cabinet.visibility"
                                        : `dmkod.extended.fields.${name}`,
                                )}
                            </FormLabel>
                            {name === "aggregationRanges" && companyId ? (
                                <FormControl>
                                    <DmKodAggregationJsonInput
                                        {...field}
                                        companyId={companyId}
                                        orderId={Number(form.watch("id"))}
                                        disabled={disabled}
                                        onError={(message) =>
                                            message
                                                ? form.setError(name, {
                                                      message,
                                                  })
                                                : form.clearErrors(name)
                                        }
                                        onBusyChange={onJsonBusyChange}
                                    />
                                </FormControl>
                            ) : name === "settings" &&
                              defaults !== undefined ? (
                                <VisibilityFields
                                    value={field.value}
                                    baseline={defaults}
                                    disabled={disabled}
                                    onChange={field.onChange}
                                />
                            ) : selects[name] ? (
                                <Select
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    disabled={disabled}
                                >
                                    <FormControl>
                                        <SelectTrigger className="w-full">
                                            <SelectValue />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent className="integration-theme dmkod-theme">
                                        {selects[name]!.map((v) => (
                                            <SelectItem key={v} value={v}>
                                                {name === "companyRole"
                                                    ? t(
                                                          `dmkod.cabinet.companyRoles.${v}`,
                                                      )
                                                    : v}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            ) : (
                                <FormControl>
                                    {[
                                        "settings",
                                        "company",
                                        "validation",
                                        "aggregation",
                                        "containers",
                                    ].includes(name) ? (
                                        <Textarea
                                            {...field}
                                            disabled={disabled}
                                            rows={name === "company" ? 12 : 6}
                                            className="font-mono text-sm"
                                        />
                                    ) : (
                                        <Input
                                            {...field}
                                            disabled={disabled}
                                            type={
                                                name === "password"
                                                    ? "password"
                                                    : name === "email"
                                                      ? "email"
                                                      : [
                                                              "dateFrom",
                                                              "dateTo",
                                                          ].includes(name)
                                                        ? "date"
                                                        : [
                                                                "id",
                                                                "month",
                                                                "year",
                                                                "page",
                                                                "pageSize",
                                                            ].includes(name)
                                                          ? "number"
                                                          : "text"
                                            }
                                            autoComplete={
                                                name === "password"
                                                    ? "current-password"
                                                    : "off"
                                            }
                                        />
                                    )}
                                </FormControl>
                            )}
                            {[
                                "settings",
                                "company",
                                "validation",
                                "aggregation",
                                "containers",
                            ].includes(name) &&
                            !(name === "settings" && defaults !== undefined) ? (
                                <FormDescription className="text-sm break-words whitespace-pre-wrap text-muted-foreground">
                                    {t(`dmkod.extended.hints.${name}`)}
                                </FormDescription>
                            ) : null}
                            <FormMessage />
                        </FormItem>
                    )}
                />
            ))}
        </div>
    );
}
function VisibilityFields({
    value,
    baseline,
    disabled,
    onChange,
}: {
    value: string;
    baseline: string;
    disabled: boolean;
    onChange: (value: string) => void;
}) {
    const { t } = useTranslation();
    const parse = (raw: string): { grant?: string[]; revoke?: string[] } => {
        try {
            return JSON.parse(raw);
        } catch {
            return {};
        }
    };
    const original = parse(baseline).grant ?? [];
    const change = parse(value);
    const keys = [
        "ORDER_SHOW_VALIDATION",
        "ORDER_SHOW_UTILISATION",
        "ORDER_SHOW_AGGREGATION",
    ];
    const selected = keys.filter((key) =>
        change.revoke?.includes(key)
            ? false
            : change.grant?.includes(key) || original.includes(key),
    );
    return (
        <div className="space-y-4">
            {keys.map((key) => {
                const checked = selected.includes(key);
                return (
                    <div
                        key={key}
                        className="flex items-center justify-between gap-4"
                    >
                        <Label htmlFor={`visibility-${key}`}>
                            {t(`dmkod.cabinet.defaults.${key}`)}
                        </Label>
                        <Button
                            type="button"
                            variant="outline"
                            role="switch"
                            className="h-6 w-10 shrink-0 rounded-full p-0.5"
                            id={`visibility-${key}`}
                            aria-checked={checked}
                            disabled={disabled}
                            onClick={() => {
                                const next = checked
                                    ? selected.filter((v) => v !== key)
                                    : [...selected, key];
                                onChange(
                                    JSON.stringify({
                                        grant: next,
                                        revoke: keys.filter(
                                            (v) => !next.includes(v),
                                        ),
                                    }),
                                );
                            }}
                        >
                            <span
                                aria-hidden="true"
                                className={`size-4 rounded-full ${checked ? "ml-auto bg-primary" : "mr-auto bg-muted-foreground"}`}
                            />
                        </Button>
                    </div>
                );
            })}
        </div>
    );
}

function Result({ result }: { result: DmKodExtendedResult }) {
    const { t } = useTranslation();
    const accounts = result.profile
        ? [result.profile]
        : (result.accounts ?? []);
    const rows: {
        key: string;
        name: string;
        state: string;
        details: string;
    }[] = [
        ...accounts.map((a) => ({
            key: a.username ?? "—",
            name: a.displayName || a.nickname || "—",
            state: `${a.role ?? "—"} · ${a.access ?? "—"}`,
            details: [
                a.email,
                a.company?.name,
                a.company?.inn,
                ...a.permissions,
                ...a.defaults,
                ...Object.entries(a.documents).map(([k, v]) => `${k}: ${v}`),
            ]
                .filter(Boolean)
                .join(" · "),
        })),
        ...(result.rows ?? []).map((r, i) => ({
            key: String(r.id ?? r.itemId ?? r.orderId ?? i + 1),
            name: r.name || r.gtin || r.uuid || "—",
            state: `${r.type ?? "—"} · ${r.state ?? "—"}`,
            details: [
                r.createdAtUtc,
                ...Object.entries(r.counts).map(([k, v]) => `${k}: ${v}`),
            ]
                .filter(Boolean)
                .join(" · "),
        })),
        ...(result.products ?? []).map((p) => ({
            key: p.gtin ?? "—",
            name: p.name ?? "—",
            state: p.group ?? "—",
            details: [p.cisType, p.scheme, p.capacity]
                .filter((v) => v != null)
                .join(" · "),
        })),
        ...(result.poas ?? []).map((p) => ({
            key: String(p.id),
            name: `${p.principal?.name ?? "—"} · ${p.principal?.inn ?? "—"}`,
            state: p.state ?? "—",
            details: [p.startAtUtc, p.endAtUtc, ...p.permissions]
                .filter(Boolean)
                .join(" · "),
        })),
        ...Object.entries(result.dictionaries ?? {})
            .filter(([, v]) => v.length)
            .flatMap(([name, values]) =>
                values.map((v) => ({
                    key: `${name}: ${v.value}`,
                    name: v.label,
                    state: "—",
                    details: "",
                })),
            ),
        ...Object.entries(result.variables ?? {}).map(([key, value]) => ({
            key,
            name: value,
            state: "—",
            details: "",
        })),
        ...(result.app || result.version || result.branch
            ? [
                  {
                      key: result.app ?? "DMKOD",
                      name: result.version ?? "—",
                      state: result.branch ?? "—",
                      details: "",
                  },
              ]
            : []),
    ];
    if (!rows.length)
        return (
            <p className="text-sm text-muted-foreground">
                {t("dmkod.extended.empty")}
            </p>
        );
    return (
        <div className="space-y-2">
            <div className="overflow-auto rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>{t("dmkod.extended.id")}</TableHead>
                            <TableHead>{t("dmkod.extended.value")}</TableHead>
                            <TableHead>{t("dmkod.extended.state")}</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rows.map((r, i) => (
                            <TableRow key={`${r.key}-${i}`}>
                                <TableCell className="max-w-48 font-mono text-xs break-all whitespace-normal">
                                    {r.key}
                                </TableCell>
                                <TableCell className="max-w-80 min-w-40 whitespace-normal">
                                    <p>{r.name}</p>
                                    {r.details ? (
                                        <p className="text-xs break-words text-muted-foreground">
                                            {r.details}
                                        </p>
                                    ) : null}
                                </TableCell>
                                <TableCell className="whitespace-normal">
                                    {r.state}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            {result.page != null ? (
                <p className="text-sm text-muted-foreground">
                    {t("dmkod.extended.pagination", {
                        page: result.page,
                        pages: result.pages,
                        total: result.filteredRows,
                    })}
                </p>
            ) : null}
        </div>
    );
}
function Counts({ counts }: { counts: Record<string, number> }) {
    return (
        <dl className="flex flex-wrap gap-3 text-sm">
            {Object.entries(counts).map(([key, value]) => (
                <div key={key}>
                    <dt className="text-muted-foreground">{key}</dt>
                    <dd>{value}</dd>
                </div>
            ))}
        </dl>
    );
}
function Trees({ trees }: { trees: DmKodContainerTree[] }) {
    return (
        <ul className="space-y-2 border-l pl-3 text-sm">
            {trees.map((node, i) => (
                <li key={i}>
                    <span className="font-mono text-xs break-all">
                        {node.code}
                    </span>
                    {node.capacity != null ? (
                        <span>
                            {" "}
                            · {node.contains.length}/{node.capacity}
                        </span>
                    ) : null}
                    {node.contains.length ? (
                        <Trees trees={node.contains} />
                    ) : null}
                </li>
            ))}
        </ul>
    );
}
function message(error: unknown, fallback: string) {
    if (
        isAxiosError(error) &&
        typeof error.response?.data?.message === "string"
    )
        return error.response.data.message as string;
    return fallback;
}
