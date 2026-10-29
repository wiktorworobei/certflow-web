import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
    FileCheck2,
    FileSignature,
    Files,
    Loader2,
    Square,
    Upload,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FormField } from "@marking/components/honest-sign/ui/form-field";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Select } from "@marking/components/honest-sign/ui/select";
import {
    checkUtilisationBatchFiles,
    UtilisationFileCheckError,
} from "@marking/components/honest-sign/utilisation-batch-checks";
import { UtilisationBatchFileFields } from "@marking/components/honest-sign/UtilisationBatchFileFields";
import { UtilisationBatchQueue } from "@marking/components/honest-sign/UtilisationBatchQueue";
import { formatProductGroupLabel } from "@marking/components/honest-sign/utils";
import { Button } from "@marking/components/ui/button";
import { Checkbox } from "@marking/components/ui/checkbox";
import { Label } from "@marking/components/ui/label";
import { useUtilisationBatchProcessor } from "@marking/hooks/use-utilisation-batch-processor";
import { utilisationBatchKeys } from "@marking/hooks/use-utilisation-batches";
import { cryptoProSignatureService } from "@marking/lib/honest-sign/cryptoProSignatureService";
import { documentsApiService } from "@marking/lib/honest-sign/documentsApiService";
import { honestSignCodesCheckService } from "@marking/lib/honest-sign/honestSignCodesCheckService";
import {
    buildUtilisationBatchFilePayload,
    countUtilisationBatchDuplicates,
    createUtilisationBatchFile,
    MAX_UTILISATION_BATCH_CODES,
    MAX_UTILISATION_BATCH_FILE_BYTES,
    MAX_UTILISATION_BATCH_FILES,
    parseUtilisationBatchFile,
    validateUtilisationBatchFile,
} from "@marking/lib/honest-sign/utilisationBatch";
import { MAX_UTILISATION_REPORT_CODES } from "@marking/lib/honest-sign/utilisationReport";
import { useAuthStore } from "@marking/src/store/auth";

import type {
    CreateUtilisationBatchRequest,
    UtilisationBatchDraftFile,
} from "@marking/lib/honest-sign/utilisationBatch";

export function UtilisationBatchWorkspace({
    companyId,
    productGroups,
    selectedThumbprint,
    onBusyChange,
}: {
    companyId: string;
    productGroups: string[];
    selectedThumbprint: string;
    onBusyChange?: (busy: boolean) => void;
}) {
    const { t } = useTranslation();
    const client = useQueryClient();
    const actorId = useAuthStore((state) => state.user?.id ?? "anonymous");
    const [productGroup, setProductGroup] = useState(productGroups[0] ?? "");
    const [files, setFiles] = useState<UtilisationBatchDraftFile[]>([]);
    const [stage, setStage] = useState<
        "idle" | "reading" | "checking" | "signing" | "storing"
    >("idle");
    const [progress, setProgress] = useState("");
    const [error, setError] = useState("");
    const [showErrors, setShowErrors] = useState(false);
    const [checks, setChecks] = useState<Record<string, number>>({});
    const [failedCheckFile, setFailedCheckFile] = useState<string | null>(null);
    const [confirmed, setConfirmed] = useState(false);
    const [selectedBatchId, setSelectedBatchId] = useState("");
    const [hasPreparedRequest, setHasPreparedRequest] = useState(false);
    const signedRequest = useRef<CreateUtilisationBatchRequest | null>(null);
    const action = useRef(false);
    const mounted = useRef(true);
    const uploadInput = useRef<HTMLInputElement>(null);
    const checkController = useRef<AbortController | null>(null);
    const processor = useUtilisationBatchProcessor(companyId);
    const busy = stage !== "idle" || processor.isProcessing;
    const locked = busy || hasPreparedRequest || Boolean(selectedBatchId);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            checkController.current?.abort();
        };
    }, []);
    useEffect(() => {
        onBusyChange?.(busy);
    }, [busy, onBusyChange]);
    const store = useMutation({
        mutationFn: ({
            request,
        }: {
            request: CreateUtilisationBatchRequest;
            owner: string;
        }) => documentsApiService.createUtilisationBatch(request),
        retry: false,
        onSuccess: (batch, { owner }) => {
            client.setQueryData(
                utilisationBatchKeys.detail(companyId, owner, batch.id),
                batch,
            );
            void client.invalidateQueries({
                queryKey: utilisationBatchKeys.all(companyId, owner),
            });
        },
    });
    const totalCodes = files.reduce(
        (total, file) => total + file.codes.length,
        0,
    );
    const duplicates = useMemo(
        () => countUtilisationBatchDuplicates(files),
        [files],
    );
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const localCalendarDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const nowMinute = `${localCalendarDate}T${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    const valid = Boolean(
        files.length &&
        productGroup &&
        !duplicates &&
        totalCodes <= MAX_UTILISATION_BATCH_CODES &&
        files.every(
            (file) =>
                validateUtilisationBatchFile(
                    file,
                    productGroup,
                    today,
                    nowMinute,
                ).valid,
        ),
    );
    const allChecked =
        files.length > 0 && files.every((file) => checks[file.id] === 0);
    const invalidate = () => {
        setChecks({});
        setFailedCheckFile(null);
        setConfirmed(false);
        setError("");
        setProgress("");
    };
    const updateFile = (
        id: string,
        patch: Partial<UtilisationBatchDraftFile>,
    ) => {
        if (locked) return;
        setFiles((current) =>
            current.map((file) =>
                file.id === id ? { ...file, ...patch } : file,
            ),
        );
        invalidate();
    };
    const uploadFiles = async (selected: File[]) => {
        if (action.current || locked || !selected.length) return;
        action.current = true;
        setStage("reading");
        invalidate();
        try {
            if (files.length + selected.length > MAX_UTILISATION_BATCH_FILES)
                throw new Error(
                    t("honestSign.documents.batch.errors.fileLimit"),
                );
            const loaded: UtilisationBatchDraftFile[] = [];
            let count = totalCodes;
            for (const file of selected) {
                if (!/\.(csv|txt)$/i.test(file.name))
                    throw new Error(
                        t("honestSign.documents.batch.errors.fileType"),
                    );
                if (
                    file.name.length > 200 ||
                    /[\\/:]/.test(file.name) ||
                    /\p{Cc}/u.test(file.name)
                )
                    throw new Error(
                        t("honestSign.documents.batch.errors.fileName"),
                    );
                if (file.size > MAX_UTILISATION_BATCH_FILE_BYTES)
                    throw new Error(
                        t("honestSign.documents.batch.errors.fileSize"),
                    );
                const codes = parseUtilisationBatchFile(await file.text());
                if (!mounted.current) return;
                if (
                    !codes.length ||
                    codes.length > MAX_UTILISATION_REPORT_CODES
                )
                    throw new Error(
                        t("honestSign.documents.errors.tooManyReportCodes"),
                    );
                count += codes.length;
                if (count > MAX_UTILISATION_BATCH_CODES)
                    throw new Error(
                        t("honestSign.documents.batch.errors.codeLimit"),
                    );
                loaded.push(
                    createUtilisationBatchFile(
                        crypto.randomUUID(),
                        file,
                        codes,
                        productGroup,
                    ),
                );
            }
            if (mounted.current) setFiles((current) => [...current, ...loaded]);
        } catch (cause) {
            if (mounted.current)
                setError(
                    cause instanceof Error
                        ? cause.message
                        : t("honestSign.documents.errors.csvRead"),
                );
        } finally {
            action.current = false;
            if (mounted.current) setStage("idle");
        }
    };
    const checkFiles = async () => {
        if (action.current || locked) return;
        setShowErrors(true);
        if (!valid) {
            setError(t("honestSign.documents.batch.errors.fields"));
            return;
        }
        action.current = true;
        const controller = new AbortController();
        checkController.current = controller;
        setStage("checking");
        setError("");
        setConfirmed(false);
        setFailedCheckFile(null);
        const previousResults = allChecked ? {} : checks;
        setChecks(
            Object.fromEntries(
                Object.entries(previousResults).filter(
                    ([, count]) => count === 0,
                ),
            ),
        );
        try {
            const results = await checkUtilisationBatchFiles({
                files,
                previousResults,
                productGroup,
                signal: controller.signal,
                checkCodes: honestSignCodesCheckService.checkCodes,
                invalidResultMessage: t("honestSign.documents.errors.check"),
                onProgress: (state) => {
                    if (!mounted.current) return;
                    setProgress(
                        t("honestSign.documents.batch.checkProgressDetailed", {
                            current: state.fileIndex,
                            total: state.filesTotal,
                            name: state.fileName,
                            completed: state.fileCompleted,
                            codes: state.fileTotal,
                            totalCompleted: state.completedCodes,
                            totalCodes: state.totalCodes,
                        }),
                    );
                },
                onChecked: (id, invalidCount) => {
                    if (mounted.current)
                        setChecks((current) => ({
                            ...current,
                            [id]: invalidCount,
                        }));
                },
            });
            if (!mounted.current) return;
            if (Object.values(results).some((count) => count > 0))
                setError(t("honestSign.documents.batch.errors.invalidCodes"));
            setProgress("");
        } catch (cause) {
            if (!mounted.current) return;
            if (controller.signal.aborted) {
                setProgress(t("honestSign.documents.batch.checkStopped"));
            } else if (cause instanceof UtilisationFileCheckError) {
                setFailedCheckFile(cause.fileId);
                setError(
                    t("honestSign.documents.batch.errors.checkFile", {
                        name: cause.fileName,
                        reason:
                            cause.message ||
                            t("honestSign.documents.errors.check"),
                    }),
                );
            } else {
                setError(
                    cause instanceof Error
                        ? cause.message
                        : t("honestSign.documents.errors.check"),
                );
            }
        } finally {
            action.current = false;
            if (checkController.current === controller)
                checkController.current = null;
            if (mounted.current) setStage("idle");
        }
    };
    const signAndStore = async () => {
        if (action.current || busy || selectedBatchId) return;
        if (!signedRequest.current && (!valid || !allChecked || !confirmed)) {
            setShowErrors(true);
            setError(t("honestSign.documents.batch.errors.checkFirst"));
            return;
        }
        if (!selectedThumbprint) {
            setError(t("honestSign.documents.errors.certificate"));
            return;
        }
        action.current = true;
        setError("");
        try {
            if (!signedRequest.current) {
                setStage("signing");
                const items: CreateUtilisationBatchRequest["items"] = [];
                let signedBytes = 0;
                for (const [index, file] of files.entries()) {
                    setProgress(
                        t("honestSign.documents.batch.signProgress", {
                            current: index + 1,
                            total: files.length,
                        }),
                    );
                    const payloadJson = JSON.stringify(
                        buildUtilisationBatchFilePayload(file, productGroup),
                    );
                    const result = await cryptoProSignatureService.signDetached(
                        {
                            thumbprint: selectedThumbprint,
                            message: payloadJson,
                        },
                    );
                    if (!mounted.current) return;
                    const signature =
                        cryptoProSignatureService.normalizeDetachedSignature(
                            result.pkcs7,
                        );
                    signedBytes +=
                        new TextEncoder().encode(payloadJson).length +
                        signature.length;
                    if (signedBytes > 20 * 1024 * 1024)
                        throw new Error(
                            t("honestSign.documents.batch.errors.batchSize"),
                        );
                    items.push({
                        fileName: file.name,
                        cisType: file.cisType,
                        payloadJson,
                        signature,
                    });
                }
                signedRequest.current = {
                    requestId: crypto.randomUUID(),
                    items,
                };
                setHasPreparedRequest(true);
            }
            if (!mounted.current) return;
            setStage("storing");
            setProgress(t("honestSign.documents.batch.storing"));
            const batch = await store.mutateAsync({
                request: signedRequest.current,
                owner: actorId,
            });
            if (!mounted.current) return;
            setSelectedBatchId(batch.id);
            setProgress("");
            setStage("idle");
            signedRequest.current = null;
            setFiles([]);
            setChecks({});
            setHasPreparedRequest(false);
            // The signed files are durable before the first CRPT POST. Follow server receipts in order.
            await processor.processBatch(batch.id);
        } catch (cause) {
            if (mounted.current)
                setError(
                    cause instanceof Error
                        ? cause.message
                        : t("honestSign.documents.batch.errors.store"),
                );
        } finally {
            action.current = false;
            if (mounted.current) {
                setStage("idle");
                setProgress("");
            }
        }
    };
    return (
        <div className="space-y-4">
            <Notice>
                <p>{t("honestSign.documents.batch.explanation")}</p>
                <p className="mt-2">
                    {t("honestSign.documents.batch.pauseHint")}
                </p>
            </Notice>
            {selectedBatchId ? (
                <UtilisationBatchQueue
                    companyId={companyId}
                    batchId={selectedBatchId}
                    processing={processor.isProcessing}
                    processError={processor.error || error}
                    onContinue={() =>
                        void processor.processBatch(selectedBatchId)
                    }
                />
            ) : (
                <>
                    <div className="flex flex-wrap items-end justify-between gap-4 rounded-xl border bg-card p-4">
                        <FormField
                            className="w-full min-w-0 sm:max-w-sm sm:flex-1"
                            label={t("honestSign.workspace.productGroup")}
                            htmlFor="batch-product-group"
                        >
                            <Select
                                id="batch-product-group"
                                disabled={locked}
                                value={productGroup}
                                onChange={(event) => {
                                    const group = event.target.value;
                                    setProductGroup(group);
                                    setFiles((current) =>
                                        current.map((file) =>
                                            createUtilisationBatchFile(
                                                file.id,
                                                {
                                                    name: file.name,
                                                    size: file.size,
                                                },
                                                file.codes,
                                                group,
                                            ),
                                        ),
                                    );
                                    invalidate();
                                }}
                            >
                                <option value="">
                                    {t("honestSign.workspace.productGroup")}
                                </option>
                                {productGroups.map((group) => (
                                    <option key={group} value={group}>
                                        {t(
                                            `honestSign.productGroups.${group}`,
                                            {
                                                defaultValue:
                                                    formatProductGroupLabel(
                                                        group,
                                                    ),
                                            },
                                        )}
                                    </option>
                                ))}
                            </Select>
                        </FormField>
                        <div className="flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-start">
                            <span className="text-sm text-muted-foreground">
                                {t("honestSign.documents.batch.summary", {
                                    files: files.length,
                                    codes: totalCodes,
                                })}
                            </span>
                            <input
                                ref={uploadInput}
                                className="sr-only"
                                tabIndex={-1}
                                type="file"
                                accept=".txt,.csv,text/plain,text/csv"
                                multiple
                                disabled={locked || !productGroup}
                                aria-label={t(
                                    "honestSign.documents.batch.upload",
                                )}
                                onChange={(event) => {
                                    const picked = Array.from(
                                        event.target.files ?? [],
                                    );
                                    event.currentTarget.value = "";
                                    void uploadFiles(picked);
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                disabled={
                                    locked ||
                                    !productGroup ||
                                    files.length >= MAX_UTILISATION_BATCH_FILES
                                }
                                onClick={() => uploadInput.current?.click()}
                            >
                                <Upload aria-hidden="true" className="size-4" />
                                {t("honestSign.documents.batch.upload")}
                            </Button>
                        </div>
                        <p className="w-full text-xs text-muted-foreground">
                            {t("honestSign.documents.batch.fileHint")}
                        </p>
                    </div>
                    {error && (
                        <Notice variant="error" role="alert">
                            {error}
                        </Notice>
                    )}
                    {duplicates > 0 && (
                        <Notice variant="error" role="alert">
                            {t("honestSign.documents.batch.duplicates", {
                                count: duplicates,
                            })}
                        </Notice>
                    )}
                    {!files.length ? (
                        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-4 py-10 text-center">
                            <Files
                                className="size-9 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <p className="font-medium">
                                {t("honestSign.documents.batch.empty")}
                            </p>
                            <p className="max-w-xl text-sm text-muted-foreground">
                                {t("honestSign.documents.batch.fileHint")}
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {files.map((file, index) => (
                                <div key={file.id} className="space-y-2">
                                    <UtilisationBatchFileFields
                                        file={file}
                                        index={index}
                                        productGroup={productGroup}
                                        today={today}
                                        nowMinute={nowMinute}
                                        disabled={locked}
                                        showErrors={showErrors}
                                        checked={Object.hasOwn(checks, file.id)}
                                        invalidCodes={checks[file.id] ?? 0}
                                        onChange={(patch) =>
                                            updateFile(file.id, patch)
                                        }
                                        onRemove={() => {
                                            if (locked) return;
                                            setFiles((current) =>
                                                current.filter(
                                                    (item) =>
                                                        item.id !== file.id,
                                                ),
                                            );
                                            invalidate();
                                        }}
                                    />
                                    {failedCheckFile === file.id && (
                                        <p className="px-1 text-sm text-destructive">
                                            {t(
                                                "honestSign.documents.batch.checkIncomplete",
                                            )}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    {hasPreparedRequest && (
                        <Notice variant="warning">
                            {t("honestSign.documents.batch.storeRetryHint")}
                        </Notice>
                    )}
                    {files.length > 0 && (
                        <div className="space-y-4 rounded-xl border bg-card p-4">
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    disabled={locked}
                                    onClick={() => void checkFiles()}
                                    className="max-w-full whitespace-normal"
                                >
                                    <FileCheck2
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    {t(
                                        Object.values(checks).some(
                                            (count) => count === 0,
                                        ) && !allChecked
                                            ? "honestSign.documents.batch.checkRemaining"
                                            : "honestSign.documents.batch.checkAll",
                                    )}
                                </Button>
                                {stage === "checking" && (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() =>
                                            checkController.current?.abort()
                                        }
                                    >
                                        <Square
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                        {t(
                                            "honestSign.documents.batch.stopCheck",
                                        )}
                                    </Button>
                                )}
                            </div>
                            <div className="flex items-start gap-2">
                                <Checkbox
                                    id="batch-confirm"
                                    checked={confirmed}
                                    disabled={locked || !allChecked || !valid}
                                    onCheckedChange={(value) =>
                                        setConfirmed(value === true)
                                    }
                                />
                                <Label
                                    htmlFor="batch-confirm"
                                    className="text-sm leading-5"
                                >
                                    {t("honestSign.documents.batch.confirm")}
                                </Label>
                            </div>
                            {progress && (
                                <p
                                    role="status"
                                    className="flex items-start gap-2 text-sm wrap-anywhere text-muted-foreground"
                                >
                                    {busy && (
                                        <Loader2
                                            className="mt-0.5 size-4 shrink-0 animate-spin motion-reduce:animate-none"
                                            aria-hidden="true"
                                        />
                                    )}
                                    {progress}
                                </p>
                            )}
                            <Button
                                type="button"
                                disabled={
                                    busy ||
                                    (!hasPreparedRequest &&
                                        (!valid ||
                                            !allChecked ||
                                            !confirmed ||
                                            !selectedThumbprint))
                                }
                                onClick={() => void signAndStore()}
                            >
                                {busy ? (
                                    <Loader2
                                        className="size-4 animate-spin motion-reduce:animate-none"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <FileSignature
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                )}
                                {t(
                                    hasPreparedRequest
                                        ? "honestSign.documents.batch.retryStore"
                                        : "honestSign.documents.batch.submit",
                                )}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
