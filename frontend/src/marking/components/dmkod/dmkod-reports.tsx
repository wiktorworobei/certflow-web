import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isAxiosError } from "axios";
import {
    CircleAlert,
    FileSignature,
    LoaderCircle,
    RefreshCw,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    DmKodIconAction,
    DmKodListToolbar,
} from "@marking/components/dmkod/dmkod-compact-controls";
import { DmKodEnvironmentTarget } from "@marking/components/dmkod/dmkod-environment-workspace";
import { DmKodReportOrderPicker } from "@marking/components/dmkod/dmkod-report-order-picker";
import {
    useDmKodScope,
    useDmKodLocalOperation,
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
import { Label } from "@marking/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectGroup,
    SelectTrigger,
    SelectValue,
} from "@marking/components/ui/select";
import {
    dmKodReportKeys,
    useDmKodGenerateReports,
    useDmKodPullReport,
    useDmKodReports,
    useDmKodReportTask,
    useDmKodSignReport,
} from "@marking/hooks/use-dmkod-reports";
import { dmKodReportsApi } from "@marking/lib/api/dmkod-reports";
import {
    dmKodReportOperationStorageKey,
    dmKodReportSelectedOrder,
    restoreDmKodReportOperations,
    saveDmKodReportOperations,
    dmKodReportOperationsConflict,
    type DmKodReportOperation as Operation,
} from "@marking/lib/dmkod-report-operation";
import { utilisationReportOutcome } from "@marking/lib/dmkod-report-policy";
import { resolveDmKodReportOperation } from "@marking/lib/dmkod-report-recovery";
import { dmKodScopeKey, dmKodScopeStorageKey } from "@marking/lib/dmkod-scope";
import { cryptoProSignatureService } from "@marking/lib/honest-sign/cryptoProSignatureService";

import type { DmKodReport, DmKodSignReport } from "@marking/lib/dmkod-report-types";
import type { CertificateSummary } from "@marking/lib/honest-sign/types";

export function DmKodReports({
    companyId,
    enabled,
    fixedOrderId,
    onStepChange,
    onBusyChange,
    generateSignal,
}: {
    companyId: string;
    enabled: boolean;
    fixedOrderId?: number;
    onStepChange?: (step: number) => void;
    onBusyChange?: (busy: boolean) => void;
    generateSignal?: number;
}) {
    const scope = useDmKodScope(companyId);
    const [selectedOrderId, setSelectedOrderId] = useState(() =>
        dmKodReportSelectedOrder(sessionStorage, scope),
    );
    const orderId = fixedOrderId ?? selectedOrderId;
    const storageKey = dmKodReportOperationStorageKey(scope, orderId);
    useEffect(() => {
        if (orderId !== null)
            sessionStorage.setItem(
                `${dmKodScopeStorageKey(scope, "reports")}.selected-order`,
                String(orderId),
            );
    }, [orderId, scope]);
    return (
        <DmKodReportsWorkflow
            key={storageKey}
            storageKey={storageKey}
            companyId={companyId}
            enabled={enabled}
            fixedOrderId={fixedOrderId}
            orderId={orderId}
            onOrderChange={setSelectedOrderId}
            onStepChange={onStepChange}
            onBusyChange={onBusyChange}
            generateSignal={generateSignal}
        />
    );
}

function DmKodReportsWorkflow({
    companyId,
    enabled,
    fixedOrderId,
    onStepChange,
    onBusyChange,
    storageKey,
    orderId,
    onOrderChange,
    generateSignal = 0,
}: {
    companyId: string;
    enabled: boolean;
    fixedOrderId?: number;
    onStepChange?: (step: number) => void;
    onBusyChange?: (busy: boolean) => void;
    storageKey: string;
    orderId: number | null;
    onOrderChange: (orderId: number | null) => void;
    generateSignal?: number;
}) {
    const { t } = useTranslation();
    const [error, setError] = useState<string | null>(null);
    const [selectedReport, setSelectedReport] = useState<DmKodReport | null>(
        null,
    );
    const [certificates, setCertificates] = useState<CertificateSummary[]>([]);
    const [thumbprint, setThumbprint] = useState("");
    const [localBusy, setLocalBusy] = useState(false);
    const [generateConfirm, setGenerateConfirm] = useState(false);
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [deleteTarget, setDeleteTarget] = useState<{
        id: number;
        failedOnly: boolean;
    } | null>(null);
    const handledTask = useRef<string | null>(null);
    const queryClient = useQueryClient();
    const scope = useDmKodScope(companyId);
    const [operations, setOperations] = useState<Operation[]>(() =>
        restoreDmKodReportOperations(sessionStorage, scope, orderId),
    );
    const [restoredRequestIds] = useState(
        () => new Set(operations.map((item) => item.requestId)),
    );
    const pendingOperations = useRef(operations);
    const operation = operations.at(-1) ?? null;
    const holdLocalOperation = useDmKodLocalOperation();
    const reports = useDmKodReports(scope, enabled ? orderId : null);
    const generate = useDmKodGenerateReports(scope);
    const sign = useDmKodSignReport(scope, orderId);
    const pull = useDmKodPullReport(scope);
    const deleteReport = useMutation({
        retry: false,
        meta: { dmKodScopeKey: dmKodScopeKey(scope) },
        mutationFn: ({
            id,
            failedOnly,
            requestId,
        }: {
            id: number;
            failedOnly: boolean;
            requestId: string;
        }) => dmKodReportsApi.delete(scope, id, failedOnly, requestId),
    });
    const task = useDmKodReportTask(scope, operation?.taskId ?? null);
    const signingData = useQuery({
        queryKey: [
            ...dmKodReportKeys.all(scope),
            "signing-data",
            selectedReport?.id ?? 0,
        ],
        queryFn: () =>
            dmKodReportsApi.getSigningData(scope, selectedReport!.id),
        enabled: enabled && !!selectedReport,
        retry: false,
        gcTime: 0,
        staleTime: "static",
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
    });
    const terminal = ["COMPLETED", "FAILED", "UNAVAILABLE"].includes(
        task.data?.state.toUpperCase() ?? "",
    );
    const busy =
        localBusy ||
        generate.isPending ||
        sign.isPending ||
        pull.isPending ||
        deleteReport.isPending;
    const locked = !enabled || busy;
    const lastGenerateSignal = useRef(0);
    useEffect(() => {
        if (generateSignal === lastGenerateSignal.current) return;
        lastGenerateSignal.current = generateSignal;
        if (generateSignal > 0 && !locked) setGenerateConfirm(true);
    }, [generateSignal, locked]);
    useEffect(() => {
        onBusyChange?.(busy);
        return () => onBusyChange?.(false);
    }, [onBusyChange, busy]);
    const reportStep = reports.data?.reports.some(
        (report) => utilisationReportOutcome(report.state) === "draft",
    )
        ? 2
        : reports.data?.reports.length
          ? 3
          : 1;
    useEffect(() => {
        onStepChange?.(reportStep);
    }, [reportStep, onStepChange]);

    const commitOperations = useCallback(
        (next: Operation[]) => {
            saveDmKodReportOperations(sessionStorage, storageKey, next);
            pendingOperations.current = next;
            setOperations(next);
        },
        [storageKey],
    );
    const forget = useCallback(
        (requestId: string) => {
            commitOperations(
                pendingOperations.current.filter(
                    (item) => item.requestId !== requestId,
                ),
            );
        },
        [commitOperations],
    );
    const remember = useCallback(
        (next: Operation) => {
            const current = pendingOperations.current;
            commitOperations(
                current.some((item) => item.requestId === next.requestId)
                    ? current.map((item) =>
                          item.requestId === next.requestId ? next : item,
                      )
                    : [...current, next],
            );
        },
        [commitOperations],
    );
    useEffect(() => {
        if (!busy) return;
        const protect = (event: BeforeUnloadEvent) => event.preventDefault();
        window.addEventListener("beforeunload", protect);
        return () => window.removeEventListener("beforeunload", protect);
    }, [busy]);

    const receipt = useQuery({
        queryKey: dmKodReportKeys.operation(scope, operation?.requestId ?? ""),
        queryFn: () =>
            dmKodReportsApi.getOperation(scope, operation!.requestId),
        enabled:
            enabled &&
            !busy &&
            !!operation &&
            restoredRequestIds.has(operation.requestId) &&
            !operation.taskId &&
            !operation.uuid,
        retry: false,
        staleTime: 0,
    });
    useEffect(() => {
        if (!operation || busy || !restoredRequestIds.has(operation.requestId))
            return;
        if (
            receipt.isError &&
            isAxiosError(receipt.error) &&
            receipt.error.response?.status === 404
        ) {
            forget(operation.requestId);
            void reports.refetch();
        } else if (
            receipt.data &&
            (operation.taskId !== receipt.data.backgroundTaskId ||
                operation.uuid !== receipt.data.uuid)
        ) {
            remember({
                ...operation,
                taskId: receipt.data.backgroundTaskId,
                uuid: receipt.data.uuid,
                reportId: receipt.data.reportId ?? operation.reportId,
            });
        }
    }, [
        operation,
        busy,
        receipt.data,
        receipt.isError,
        receipt.error,
        forget,
        remember,
        reports,
        restoredRequestIds,
    ]);
    useEffect(() => {
        if (
            !terminal ||
            !task.data ||
            handledTask.current === task.data.backgroundTaskId
        )
            return;
        handledTask.current = task.data.backgroundTaskId;
        void queryClient.invalidateQueries({
            queryKey: dmKodReportKeys.list(scope, orderId ?? 0),
        });
    }, [terminal, task.data, scope, orderId, queryClient]);

    const prepareAction = async (
        action: Operation["action"],
        reportId: number | null,
    ) => {
        for (const previous of pendingOperations.current) {
            if (!dmKodReportOperationsConflict(previous, action, reportId))
                continue;
            const outcome = await resolveDmKodReportOperation(
                previous,
                (requestId) =>
                    queryClient.fetchQuery({
                        queryKey: dmKodReportKeys.operation(scope, requestId),
                        queryFn: () =>
                            dmKodReportsApi.getOperation(scope, requestId),
                        staleTime: 0,
                        retry: false,
                    }),
                (taskId) =>
                    queryClient.fetchQuery({
                        queryKey: dmKodReportKeys.task(scope, taskId),
                        queryFn: () => dmKodReportsApi.getTask(scope, taskId),
                        staleTime: 0,
                        retry: false,
                    }),
            );
            if (outcome === "pending") {
                setError(t("dmkod.reports.processing"));
                void reports.refetch();
                return false;
            }
            forget(previous.requestId);
            if (
                outcome === "submitted" &&
                action === "sign" &&
                previous.action === "sign"
            ) {
                await reports.refetch();
                return false;
            }
        }
        return true;
    };

    const runTask = async (
        action: "generate" | "pull" | "delete" | "delete-failure",
        reportId: number | null,
    ) => {
        if (!enabled || !orderId) return;
        const release = holdLocalOperation();
        setLocalBusy(true);
        setError(null);
        setGenerateConfirm(false);
        setDeleteTarget(null);
        try {
            if (!(await prepareAction(action, reportId))) return;
            const next: Operation = {
                action,
                requestId: crypto.randomUUID(),
                orderId,
                reportId,
                taskId: null,
                uuid: null,
            };
            remember(next);
            setError(null);
            const accepted =
                action === "generate"
                    ? await generate.mutateAsync({
                          orderId: next.orderId,
                          clientRequestId: next.requestId,
                      })
                    : action === "pull"
                      ? await pull.mutateAsync({
                            reportId: next.reportId!,
                            clientRequestId: next.requestId,
                        })
                      : await deleteReport.mutateAsync({
                            id: next.reportId!,
                            failedOnly: action === "delete-failure",
                            requestId: next.requestId,
                        });
            remember({ ...next, taskId: accepted.backgroundTaskId });
        } catch (caught) {
            setError(readError(caught, t("dmkod.reports.actionFailed")));
        } finally {
            release();
            setLocalBusy(false);
        }
    };

    const sendSignature = async (next: Operation, payload: DmKodSignReport) => {
        if (!enabled) return;
        setError(null);
        remember(next);
        try {
            const accepted = await sign.mutateAsync({
                reportId: next.reportId!,
                payload,
            });
            remember({ ...next, uuid: accepted.uuid });
            setSelectedReport(null);
            await runTask("pull", next.reportId);
        } catch (caught) {
            setError(readError(caught, t("dmkod.reports.signFailed")));
            setSelectedReport(null);
        }
    };

    const signAndSend = async () => {
        if (
            !enabled ||
            !selectedReport ||
            !orderId ||
            !signingData.data ||
            !thumbprint
        )
            return;
        const releaseEnvironmentLock = holdLocalOperation();
        setLocalBusy(true);
        setError(null);
        try {
            // Sign exactly the server-provided bytes; never parse or reserialize the document.
            const signature = await cryptoProSignatureService.signDetached({
                thumbprint,
                message: signingData.data.data,
            });
            const next: Operation = {
                action: "sign",
                requestId: crypto.randomUUID(),
                orderId,
                reportId: selectedReport.id,
                taskId: null,
                uuid: null,
            };
            await sendSignature(next, {
                clientRequestId: next.requestId,
                signature: cryptoProSignatureService.normalizeDetachedSignature(
                    signature.pkcs7,
                ),
                certificateThumbprint: thumbprint,
                payloadHash: signingData.data.payloadHash,
            });
        } catch (caught) {
            setError(readError(caught, t("dmkod.reports.signFailed")));
        } finally {
            releaseEnvironmentLock();
            setLocalBusy(false);
        }
    };

    const loadCertificates = async () => {
        setLocalBusy(true);
        setError(null);
        try {
            const available =
                await cryptoProSignatureService.getUserCertificates();
            setCertificates(available);
            setThumbprint((value) => value || available[0]?.thumbprint || "");
        } catch (caught) {
            setError(readError(caught, t("dmkod.reports.certificatesFailed")));
        } finally {
            setLocalBusy(false);
        }
    };

    const openSigning = async (report: DmKodReport) => {
        if (locked) return;
        const release = holdLocalOperation();
        setLocalBusy(true);
        setError(null);
        try {
            if (!(await prepareAction("sign", report.id))) return;
            setSelectedReport(report);
            if (!certificates.length) await loadCertificates();
        } catch (caught) {
            setError(
                isAxiosError(caught) && caught.response?.status === 409
                    ? t("dmkod.reports.processing")
                    : readError(caught, t("dmkod.reports.signFailed")),
            );
        } finally {
            release();
            setLocalBusy(false);
        }
    };

    const filteredReports = (reports.data?.reports ?? []).filter((report) =>
        [String(report.id), report.uuid, report.state].some((value) =>
            value
                ?.toLocaleLowerCase()
                .includes(search.trim().toLocaleLowerCase()),
        ),
    );
    const pages = Math.max(1, Math.ceil(filteredReports.length / 20));
    const currentPage = Math.min(page, pages);
    const visibleReports = fixedOrderId
        ? filteredReports.slice((currentPage - 1) * 20, currentPage * 20)
        : (reports.data?.reports ?? []);
    return (
        <Card
            className={
                fixedOrderId
                    ? "gap-3 border-0 bg-transparent py-0 shadow-none"
                    : undefined
            }
        >
            {fixedOrderId ? (
                <div className="flex items-center justify-between gap-2 rounded-xl border bg-card px-4 py-3">
                    <h2 className="flex items-center gap-2 font-semibold uppercase">
                        {t("dmkod.orderLayout.tabs.reports")}
                        <Badge variant="secondary">
                            {reports.data?.reports.length ?? 0}
                        </Badge>
                    </h2>
                    <DmKodIconAction
                        label={t("dmkod.reports.refresh")}
                        disabled={reports.isFetching}
                        onClick={() => {
                            void reports.refetch();
                            if (operation?.taskId) void task.refetch();
                        }}
                    >
                        <RefreshCw aria-hidden="true" />
                    </DmKodIconAction>
                </div>
            ) : (
                <CardHeader className="border-b">
                    <CardTitle>{t("dmkod.reports.title")}</CardTitle>
                    <CardDescription>
                        {t(
                            fixedOrderId
                                ? "dmkod.orderLayout.reportsHint"
                                : "dmkod.reports.description",
                        )}
                    </CardDescription>
                </CardHeader>
            )}
            <CardContent
                className={
                    fixedOrderId
                        ? "flex flex-col gap-3 px-0"
                        : "flex flex-col gap-4"
                }
            >
                {fixedOrderId ? (
                    <DmKodListToolbar
                        search={search}
                        onSearch={(value) => {
                            setSearch(value);
                            setPage(1);
                        }}
                        label={t("dmkod.cabinet.reportSearch")}
                        found={filteredReports.length}
                        total={reports.data?.reports.length ?? 0}
                        page={currentPage}
                        pages={pages}
                        onPage={setPage}
                    />
                ) : null}
                {!fixedOrderId ? (
                    <DmKodReportOrderPicker
                        companyId={companyId}
                        value={orderId}
                        enabled={enabled}
                        locked={busy}
                        onChange={onOrderChange}
                    />
                ) : null}
                {error ? (
                    <Alert variant="destructive">
                        <CircleAlert aria-hidden="true" />
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                ) : null}
                {orderId ? (
                    <section
                        className={
                            fixedOrderId
                                ? "space-y-3"
                                : "space-y-3 border-t pt-4"
                        }
                    >
                        {!fixedOrderId ? (
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="font-medium">
                                    {t("dmkod.reports.order", { id: orderId })}
                                </h3>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={reports.isFetching}
                                        onClick={() => {
                                            void reports.refetch();
                                            if (operation?.taskId)
                                                void task.refetch();
                                        }}
                                    >
                                        <RefreshCw aria-hidden="true" />
                                        {t("dmkod.reports.refresh")}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant={
                                            reports.data?.reports.length
                                                ? "outline"
                                                : "default"
                                        }
                                        disabled={
                                            locked ||
                                            reports.isLoading ||
                                            reports.isError
                                        }
                                        onClick={() => setGenerateConfirm(true)}
                                    >
                                        {t(
                                            reports.data?.reports.length
                                                ? "dmkod.application.generateMore"
                                                : "dmkod.reports.generate",
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ) : null}
                        {reports.isLoading ? (
                            <p role="status" className="text-sm">
                                {t("dmkod.reports.loading")}
                            </p>
                        ) : reports.isError ? (
                            <Alert variant="destructive">
                                <CircleAlert aria-hidden="true" />
                                <AlertDescription>
                                    {readError(
                                        reports.error,
                                        t("dmkod.reports.loadFailed"),
                                    )}
                                </AlertDescription>
                            </Alert>
                        ) : reports.data ? (
                            <>
                                {!visibleReports.length ? (
                                    <div className="rounded-xl border bg-card px-4 py-12 text-center text-sm text-muted-foreground">
                                        <p>
                                            {t(
                                                fixedOrderId
                                                    ? "dmkod.cabinet.emptyReports"
                                                    : "dmkod.reports.empty",
                                            )}
                                        </p>
                                        {fixedOrderId && !search ? (
                                            <p className="mt-1">
                                                {t(
                                                    "dmkod.cabinet.prepareReport",
                                                )}
                                            </p>
                                        ) : null}
                                    </div>
                                ) : (
                                    <ul className="divide-y rounded-md border">
                                        {visibleReports.map((report) => (
                                            <li
                                                key={report.id}
                                                className="space-y-3 p-4"
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2">
                                                    <p className="font-medium">
                                                        {t(
                                                            "dmkod.reports.report",
                                                            { id: report.id },
                                                        )}{" "}
                                                        ·{" "}
                                                        {t(
                                                            "dmkod.application.positions",
                                                            {
                                                                count: report.itemsCount,
                                                            },
                                                        )}
                                                    </p>
                                                    <Badge
                                                        variant={
                                                            report.state ===
                                                            "SUCCESS"
                                                                ? "secondary"
                                                                : "outline"
                                                        }
                                                    >
                                                        {t(
                                                            `dmkod.reports.states.${report.state}`,
                                                            {
                                                                defaultValue:
                                                                    report.state,
                                                            },
                                                        )}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-muted-foreground">
                                                    {t(
                                                        `dmkod.application.outcomes.${utilisationReportOutcome(report.state)}`,
                                                    )}
                                                </p>
                                                {report.failureReason ? (
                                                    <Alert variant="destructive">
                                                        <CircleAlert aria-hidden="true" />
                                                        <AlertDescription className="break-words whitespace-pre-wrap">
                                                            {
                                                                report.failureReason
                                                            }
                                                        </AlertDescription>
                                                    </Alert>
                                                ) : null}
                                                {report.uuid ? (
                                                    <details className="text-sm">
                                                        <summary className="cursor-pointer text-muted-foreground">
                                                            {t(
                                                                "dmkod.application.technicalDetails",
                                                            )}
                                                        </summary>
                                                        <p className="mt-2 font-mono break-all">
                                                            {t(
                                                                "dmkod.reports.documentUuid",
                                                            )}
                                                            : {report.uuid}
                                                        </p>
                                                    </details>
                                                ) : null}
                                                <div className="flex flex-wrap gap-2">
                                                    {report.state ===
                                                    "CREATED" ? (
                                                        <Button
                                                            type="button"
                                                            disabled={
                                                                locked ||
                                                                report.state !==
                                                                    "CREATED" ||
                                                                reports.isFetching
                                                            }
                                                            onClick={() =>
                                                                void openSigning(
                                                                    report,
                                                                )
                                                            }
                                                        >
                                                            <FileSignature aria-hidden="true" />
                                                            {t(
                                                                "dmkod.reports.sign",
                                                            )}
                                                        </Button>
                                                    ) : null}
                                                    {report.uuid &&
                                                    report.state !==
                                                        "SUCCESS" ? (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            disabled={locked}
                                                            onClick={() =>
                                                                void runTask(
                                                                    "pull",
                                                                    report.id,
                                                                )
                                                            }
                                                        >
                                                            {t(
                                                                "dmkod.reports.pull",
                                                            )}
                                                        </Button>
                                                    ) : null}
                                                </div>
                                                {[
                                                    "CREATED",
                                                    "REJECTED",
                                                    "FAILED",
                                                    "PARTIALLY",
                                                ].includes(report.state) ? (
                                                    <details className="text-sm">
                                                        <summary className="cursor-pointer text-muted-foreground">
                                                            {t(
                                                                "dmkod.application.additionalActions",
                                                            )}
                                                        </summary>
                                                        <div className="mt-2 flex flex-wrap gap-2">
                                                            {[
                                                                "CREATED",
                                                                "REJECTED",
                                                                "FAILED",
                                                            ].includes(
                                                                report.state,
                                                            ) ? (
                                                                <Button
                                                                    variant="outline"
                                                                    disabled={
                                                                        locked
                                                                    }
                                                                    onClick={() =>
                                                                        setDeleteTarget(
                                                                            {
                                                                                id: report.id,
                                                                                failedOnly: false,
                                                                            },
                                                                        )
                                                                    }
                                                                >
                                                                    {t(
                                                                        "dmkod.workflow.deleteReport",
                                                                    )}
                                                                </Button>
                                                            ) : null}
                                                            {[
                                                                "FAILED",
                                                                "PARTIALLY",
                                                            ].includes(
                                                                report.state,
                                                            ) ? (
                                                                <Button
                                                                    variant="outline"
                                                                    disabled={
                                                                        locked
                                                                    }
                                                                    onClick={() =>
                                                                        setDeleteTarget(
                                                                            {
                                                                                id: report.id,
                                                                                failedOnly: true,
                                                                            },
                                                                        )
                                                                    }
                                                                >
                                                                    {t(
                                                                        "dmkod.workflow.deleteFailure",
                                                                    )}
                                                                </Button>
                                                            ) : null}
                                                        </div>
                                                    </details>
                                                ) : null}
                                            </li>
                                        ))}
                                    </ul>
                                )}
                                {reports.data.backgroundTaskIds.length ? (
                                    <p className="text-sm text-muted-foreground">
                                        {t("dmkod.reports.serverTasks", {
                                            count: reports.data
                                                .backgroundTaskIds.length,
                                        })}
                                    </p>
                                ) : null}
                            </>
                        ) : null}
                    </section>
                ) : (
                    <p className="text-sm text-muted-foreground">
                        {t("dmkod.reports.chooseOrder")}
                    </p>
                )}
                <Dialog
                    open={generateConfirm}
                    onOpenChange={setGenerateConfirm}
                >
                    <DialogContent className="integration-theme dmkod-theme">
                        <DialogHeader>
                            <DialogTitle>
                                {t("dmkod.reports.generateTitle")}
                            </DialogTitle>
                            <DialogDescription>
                                {t("dmkod.reports.generateConfirm", {
                                    id: orderId,
                                })}
                            </DialogDescription>
                        </DialogHeader>
                        <DmKodEnvironmentTarget companyId={companyId} />
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setGenerateConfirm(false)}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button
                                type="button"
                                onClick={() => void runTask("generate", null)}
                            >
                                {t("dmkod.reports.generate")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <Dialog
                    open={!!deleteTarget}
                    onOpenChange={(open) => {
                        if (!open && !busy) setDeleteTarget(null);
                    }}
                >
                    <DialogContent className="integration-theme dmkod-theme">
                        <DialogHeader>
                            <DialogTitle>
                                {t(
                                    deleteTarget?.failedOnly
                                        ? "dmkod.workflow.deleteFailure"
                                        : "dmkod.workflow.deleteReport",
                                )}
                            </DialogTitle>
                            <DialogDescription>
                                {t("dmkod.workflow.deleteReportHint", {
                                    id: deleteTarget?.id,
                                    environment: scope.environment,
                                })}
                            </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                disabled={busy}
                                onClick={() => setDeleteTarget(null)}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button
                                variant="destructive"
                                disabled={busy}
                                onClick={() => {
                                    if (deleteTarget)
                                        void runTask(
                                            deleteTarget.failedOnly
                                                ? "delete-failure"
                                                : "delete",
                                            deleteTarget.id,
                                        );
                                }}
                            >
                                {t("dmkod.workflow.confirm")}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
                <Dialog
                    open={!!selectedReport}
                    onOpenChange={(open) => {
                        if (!open && !busy) setSelectedReport(null);
                    }}
                >
                    <DialogContent className="integration-theme dmkod-theme">
                        <DialogHeader>
                            <DialogTitle>
                                {t("dmkod.reports.signTitle")}
                            </DialogTitle>
                            <DialogDescription>
                                {t("dmkod.reports.signConfirm", {
                                    order: orderId,
                                    report: selectedReport?.id,
                                    count: selectedReport?.itemsCount ?? 0,
                                })}
                            </DialogDescription>
                        </DialogHeader>
                        <DmKodEnvironmentTarget companyId={companyId} />
                        {signingData.isLoading ? (
                            <p role="status" className="text-sm">
                                {t("dmkod.reports.loadingDocument")}
                            </p>
                        ) : signingData.isError ? (
                            <Alert variant="destructive">
                                <CircleAlert aria-hidden="true" />
                                <AlertDescription>
                                    {readError(
                                        signingData.error,
                                        t("dmkod.reports.dataFailed"),
                                    )}
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            void signingData.refetch()
                                        }
                                    >
                                        {t("common.retry")}
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        ) : signingData.data ? (
                            <details className="text-sm">
                                <summary className="cursor-pointer text-muted-foreground">
                                    {t("dmkod.reports.fingerprint")}
                                </summary>
                                <p className="font-mono text-xs break-all">
                                    {signingData.data.payloadHash}
                                </p>
                            </details>
                        ) : null}
                        <div className="space-y-2">
                            <Label htmlFor="dmkod-report-certificate">
                                {t("dmkod.reports.certificate")}
                            </Label>
                            <Select
                                value={thumbprint}
                                onValueChange={setThumbprint}
                                disabled={busy}
                            >
                                <SelectTrigger
                                    id="dmkod-report-certificate"
                                    className="w-full"
                                >
                                    <SelectValue
                                        placeholder={t(
                                            "dmkod.reports.selectCertificate",
                                        )}
                                    />
                                </SelectTrigger>
                                <SelectContent className="integration-theme dmkod-theme">
                                    <SelectGroup>
                                        {certificates.map((certificate) => (
                                            <SelectItem
                                                key={certificate.thumbprint}
                                                value={certificate.thumbprint}
                                            >
                                                {certificate.name ||
                                                    certificate.subjectName}
                                            </SelectItem>
                                        ))}
                                    </SelectGroup>
                                </SelectContent>
                            </Select>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => void loadCertificates()}
                            >
                                {t("dmkod.reports.loadCertificates")}
                            </Button>
                            <p className="text-sm text-muted-foreground">
                                {t("dmkod.reports.signatureHint")}
                            </p>
                        </div>
                        {error ? (
                            <p
                                role="alert"
                                className="text-sm text-destructive"
                            >
                                {error}
                            </p>
                        ) : null}
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={busy}
                                onClick={() => setSelectedReport(null)}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button
                                type="button"
                                disabled={
                                    !enabled ||
                                    busy ||
                                    !thumbprint ||
                                    !signingData.data ||
                                    signingData.isFetching ||
                                    signingData.isError
                                }
                                onClick={() => void signAndSend()}
                            >
                                {busy ? (
                                    <LoaderCircle
                                        className="animate-spin"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <FileSignature aria-hidden="true" />
                                )}
                                {t("dmkod.reports.signAndSubmit")}
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
