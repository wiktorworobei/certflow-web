import { useMutation } from "@tanstack/react-query";
import {
    CircleAlert,
    CircleCheck,
    CircleHelp,
    FileText,
    Loader2,
    RefreshCw,
    ScanLine,
    ShieldCheck,
    Trash2,
    Upload,
    X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Select } from "@marking/components/honest-sign/ui/select";
import { formatProductGroupLabel } from "@marking/components/honest-sign/utils";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Label } from "@marking/components/ui/label";
import { Progress } from "@marking/components/ui/progress";
import {
    Table,
    TableBody,
    TableCaption,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@marking/components/ui/table";
import {
    codeCheckDisplayCode,
    combineCodesCheckFiles,
    MAX_CODES_CHECK_FILE_BYTES,
    MAX_CODES_CHECK_FILES,
    parseCodesCheckText,
} from "@marking/lib/honest-sign/codesCheckFiles";
import { honestSignCodesCheckService } from "@marking/lib/honest-sign/honestSignCodesCheckService";

import type { CodesCheckFile } from "@marking/lib/honest-sign/codesCheckFiles";
import type { HonestSignCodeCheckItem } from "@marking/lib/honest-sign/honestSignCodesCheckService";

const PAGE_SIZE = 50;
const UPLOAD_ERRORS = new Set([
    "tooManyFiles",
    "fileTooLarge",
    "invalidFile",
    "emptyFile",
    "tooManyCodes",
]);

function CodeStatus({ item }: { item: HonestSignCodeCheckItem }) {
    const { t } = useTranslation();
    const status = item.status?.trim() || "";
    const known = ["EMITTED", "APPLIED", "INTRODUCED"].includes(status);
    return (
        <div className="space-y-1.5">
            <Badge
                variant="outline"
                className={
                    "max-w-full min-w-0 gap-1.5 whitespace-normal " +
                    (status === "INTRODUCED"
                        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                        : status === "APPLIED"
                          ? "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300"
                          : "bg-muted/40 text-muted-foreground")
                }
            >
                {known ? (
                    <CircleCheck className="shrink-0" aria-hidden="true" />
                ) : (
                    <CircleHelp className="shrink-0" aria-hidden="true" />
                )}
                <span className="min-w-0 wrap-anywhere">
                    {status
                        ? t("honestSign.dmCheck.statuses." + status, {
                              defaultValue: status,
                          })
                        : t("honestSign.dmCheck.unknownStatus")}
                </span>
            </Badge>
            {item.extendedStatus && (
                <p className="text-xs wrap-anywhere text-muted-foreground">
                    {item.extendedStatus}
                </p>
            )}
        </div>
    );
}

function CheckOutcome({ item }: { item: HonestSignCodeCheckItem }) {
    const { t } = useTranslation();
    const Icon = item.isValid ? ShieldCheck : CircleAlert;
    return (
        <div className="space-y-1.5">
            <p
                className={
                    "flex items-center gap-1.5 text-xs font-medium " +
                    (item.isValid
                        ? "text-emerald-700 dark:text-emerald-300"
                        : "text-destructive")
                }
            >
                <Icon className="size-3.5 shrink-0" aria-hidden="true" />
                {t(
                    item.isValid
                        ? "honestSign.dmCheck.valid"
                        : "honestSign.dmCheck.issue",
                )}
            </p>
            {item.reasons.length > 0 && (
                <ul className="space-y-1 text-xs wrap-anywhere text-muted-foreground">
                    {item.reasons.map((reason, index) => (
                        <li key={index}>{reason}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}

export function CodesCheckResults({
    items,
}: {
    items: HonestSignCodeCheckItem[];
}) {
    const { t } = useTranslation();
    return (
        <div className="@container/dm-check">
            <div className="hidden @min-[56rem]/dm-check:block">
                <Table className="table-fixed">
                    <TableCaption className="sr-only">
                        {t("honestSign.dmCheck.results")}
                    </TableCaption>
                    <TableHeader className="bg-muted/35">
                        <TableRow>
                            <TableHead className="w-64 pl-4">
                                {t("honestSign.dmCheck.code")}
                            </TableHead>
                            <TableHead>
                                {t("honestSign.dmCheck.product")}
                            </TableHead>
                            <TableHead className="w-44">
                                {t("honestSign.dmCheck.codeStatus")}
                            </TableHead>
                            <TableHead className="w-52 pr-4">
                                {t("honestSign.dmCheck.validation")}
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {items.map((item, index) => (
                            <TableRow key={index} className="[&>td]:py-3">
                                <TableCell className="pl-4 font-mono text-xs wrap-anywhere whitespace-normal">
                                    {codeCheckDisplayCode(item.code)}
                                </TableCell>
                                <TableCell className="text-sm wrap-anywhere whitespace-normal">
                                    <p>{item.productName || "—"}</p>
                                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                                        {item.gtin || "—"}
                                    </p>
                                </TableCell>
                                <TableCell className="whitespace-normal">
                                    <CodeStatus item={item} />
                                </TableCell>
                                <TableCell className="pr-4 whitespace-normal">
                                    <CheckOutcome item={item} />
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
            <ul className="divide-y @min-[56rem]/dm-check:hidden">
                {items.map((item, index) => (
                    <li key={index} className="space-y-3 p-4">
                        <p className="font-mono text-xs wrap-anywhere">
                            {codeCheckDisplayCode(item.code)}
                        </p>
                        {item.productName && (
                            <p className="text-sm wrap-anywhere">
                                {item.productName}
                            </p>
                        )}
                        {item.gtin && (
                            <p className="font-mono text-xs text-muted-foreground">
                                GTIN: {item.gtin}
                            </p>
                        )}
                        <CodeStatus item={item} />
                        <CheckOutcome item={item} />
                    </li>
                ))}
            </ul>
        </div>
    );
}

export function CodesCheckWorkspace({
    companyId,
    productGroups,
}: {
    companyId: string;
    productGroups: string[];
}) {
    const { t } = useTranslation();
    const input = useRef<HTMLInputElement>(null);
    const controllerRef = useRef<AbortController | null>(null);
    const mounted = useRef(true);
    const reading = useRef(false);
    const [files, setFiles] = useState<CodesCheckFile[]>([]);
    const [productGroup, setProductGroup] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [cancelled, setCancelled] = useState(false);
    const [progress, setProgress] = useState({ completed: 0, total: 0 });
    const [page, setPage] = useState(1);
    const [filter, setFilter] = useState("all");
    const combined = useMemo(() => combineCodesCheckFiles(files), [files]);
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            controllerRef.current?.abort();
        };
    }, []);
    const check = useMutation({
        mutationKey: ["honest-sign", companyId, "codes-check"],
        gcTime: 0,
        retry: false,
        mutationFn: async () => {
            const controller = new AbortController();
            controllerRef.current = controller;
            try {
                return await honestSignCodesCheckService.checkCodes(
                    combined.codes,
                    productGroup || undefined,
                    {
                        signal: controller.signal,
                        onProgress: (completed, total) => {
                            if (
                                mounted.current &&
                                controllerRef.current === controller
                            )
                                setProgress({ completed, total });
                        },
                    },
                );
            } finally {
                if (controllerRef.current === controller)
                    controllerRef.current = null;
            }
        },
    });
    const busy = loading || check.isPending;
    const resetResults = () => {
        check.reset();
        setPage(1);
        setFilter("all");
        setCancelled(false);
        setError("");
    };
    const loadFiles = async (selected: File[]) => {
        if (reading.current || check.isPending || !selected.length) return;
        reading.current = true;
        setLoading(true);
        setError("");
        try {
            if (files.length + selected.length > MAX_CODES_CHECK_FILES)
                throw new Error("tooManyFiles");
            if (
                files.reduce((sum, file) => sum + file.size, 0) +
                    selected.reduce((sum, file) => sum + file.size, 0) >
                MAX_CODES_CHECK_FILE_BYTES
            )
                throw new Error("fileTooLarge");
            const added: CodesCheckFile[] = [];
            for (const file of selected) {
                if (!/\.(?:txt|csv)$/i.test(file.name))
                    throw new Error("invalidFile");
                const codes = parseCodesCheckText(await file.text());
                added.push({
                    id: crypto.randomUUID(),
                    name: file.name,
                    size: file.size,
                    codes,
                });
            }
            const next = [...files, ...added];
            combineCodesCheckFiles(next);
            if (mounted.current) {
                setFiles(next);
                resetResults();
            }
        } catch (failure) {
            const errorKey =
                failure instanceof Error && UPLOAD_ERRORS.has(failure.message)
                    ? failure.message
                    : "invalidFile";
            if (mounted.current)
                setError(
                    t("honestSign.dmCheck.errors." + errorKey, {
                        defaultValue: t(
                            "honestSign.dmCheck.errors.invalidFile",
                        ),
                    }),
                );
        } finally {
            reading.current = false;
            if (mounted.current) setLoading(false);
        }
    };
    const resultItems = check.data?.items ?? [];
    const statuses = [
        ...new Set(
            resultItems
                .map((item) => item.status)
                .filter((status): status is string => Boolean(status)),
        ),
    ].sort();
    const filtered = resultItems.filter(
        (item) =>
            filter === "all" ||
            (filter === "issues" ? !item.isValid : item.status === filter),
    );
    const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const pageItems = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    return (
        <section
            className="min-w-0 space-y-5 p-4 md:p-6"
            aria-label={t("honestSign.dmCheck.title")}
            aria-busy={busy}
        >
            <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <ScanLine className="size-5" aria-hidden="true" />
                </div>
                <div>
                    <h2 className="text-xl font-semibold tracking-tight">
                        {t("honestSign.dmCheck.title")}
                    </h2>
                    <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                        {t("honestSign.dmCheck.description")}
                    </p>
                </div>
            </div>
            <div className="overflow-hidden rounded-xl border bg-card">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                    <div>
                        <h3 className="font-semibold">
                            {t("honestSign.dmCheck.files")}
                        </h3>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {t("honestSign.dmCheck.fileHint")}
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={busy}
                        onClick={() => input.current?.click()}
                        className="h-10"
                    >
                        <Upload className="size-4" aria-hidden="true" />
                        {t("honestSign.dmCheck.addFiles")}
                    </Button>
                    <input
                        ref={input}
                        type="file"
                        disabled={busy}
                        accept=".txt,.csv,text/plain,text/csv"
                        multiple
                        className="sr-only"
                        tabIndex={-1}
                        aria-label={t("honestSign.dmCheck.addFiles")}
                        onChange={(event) => {
                            const selected = [...(event.target.files ?? [])];
                            event.target.value = "";
                            void loadFiles(selected);
                        }}
                    />
                </div>
                {files.length ? (
                    <ul className="divide-y">
                        {files.map((file) => (
                            <li
                                key={file.id}
                                className="flex items-center gap-3 px-4 py-3"
                            >
                                <FileText
                                    className="size-4 shrink-0 text-muted-foreground"
                                    aria-hidden="true"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium wrap-anywhere">
                                        {file.name}
                                    </p>
                                    <p className="mt-0.5 text-xs text-muted-foreground">
                                        {t("honestSign.dmCheck.fileCodes", {
                                            count: file.codes.length,
                                        })}
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    disabled={busy}
                                    aria-label={t(
                                        "honestSign.dmCheck.removeFile",
                                        { name: file.name },
                                    )}
                                    onClick={() => {
                                        setFiles(
                                            files.filter(
                                                (item) => item.id !== file.id,
                                            ),
                                        );
                                        resetResults();
                                    }}
                                >
                                    <Trash2
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                </Button>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="flex flex-col items-center gap-2 p-8 text-center">
                        <ScanLine
                            className="mb-1 size-8 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <p className="text-sm font-medium">
                            {t("honestSign.dmCheck.empty")}
                        </p>
                        <p className="max-w-lg text-xs text-muted-foreground">
                            {t("honestSign.dmCheck.emptyHelp")}
                        </p>
                    </div>
                )}
                <div className="flex flex-wrap items-end justify-between gap-4 border-t bg-muted/15 p-4">
                    <div className="min-w-0 space-y-1.5">
                        <Label htmlFor="dm-check-group">
                            {t("honestSign.dmCheck.productGroup")}
                        </Label>
                        <Select
                            id="dm-check-group"
                            disabled={busy}
                            value={productGroup}
                            onChange={(event) => {
                                setProductGroup(event.target.value);
                                resetResults();
                            }}
                        >
                            <option value="">
                                {t("honestSign.dmCheck.autoGroup")}
                            </option>
                            {productGroups.map((group) => (
                                <option key={group} value={group}>
                                    {t("honestSign.productGroups." + group, {
                                        defaultValue:
                                            formatProductGroupLabel(group),
                                    })}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                        <p className="text-sm text-muted-foreground">
                            {t("honestSign.dmCheck.uniqueCount", {
                                count: combined.codes.length,
                            })}
                        </p>
                        {check.isPending ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    controllerRef.current?.abort();
                                    check.reset();
                                    setCancelled(true);
                                }}
                            >
                                <X className="size-4" aria-hidden="true" />
                                {t("honestSign.dmCheck.cancel")}
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                disabled={busy || !combined.codes.length}
                                onClick={() => {
                                    resetResults();
                                    setProgress({
                                        completed: 0,
                                        total: combined.codes.length,
                                    });
                                    check.mutate();
                                }}
                            >
                                <RefreshCw
                                    className="size-4"
                                    aria-hidden="true"
                                />
                                {t(
                                    check.data
                                        ? "honestSign.dmCheck.refresh"
                                        : "honestSign.dmCheck.check",
                                )}
                            </Button>
                        )}
                    </div>
                </div>
            </div>
            {combined.duplicates > 0 && (
                <Notice>
                    {t("honestSign.dmCheck.duplicates", {
                        count: combined.duplicates,
                    })}
                </Notice>
            )}
            {loading && (
                <p
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                    role="status"
                >
                    <Loader2
                        className="size-4 animate-spin motion-reduce:animate-none"
                        aria-hidden="true"
                    />
                    {t("honestSign.dmCheck.reading")}
                </p>
            )}
            {check.isPending && (
                <div className="space-y-2" role="status">
                    <p className="text-sm text-muted-foreground">
                        {t("honestSign.dmCheck.progress", progress)}
                    </p>
                    <Progress
                        value={
                            progress.total
                                ? (progress.completed / progress.total) * 100
                                : 0
                        }
                        aria-label={t("honestSign.dmCheck.checking")}
                    />
                </div>
            )}
            {cancelled && <Notice>{t("honestSign.dmCheck.cancelled")}</Notice>}
            {(error || (check.isError && !cancelled)) && (
                <Notice variant="error" role="alert">
                    {error || check.error?.message}
                </Notice>
            )}
            {check.data && (
                <section
                    className="overflow-hidden rounded-xl border bg-card"
                    aria-label={t("honestSign.dmCheck.results")}
                >
                    <div className="flex flex-wrap items-end justify-between gap-3 border-b p-4">
                        <div>
                            <h3 className="font-semibold">
                                {t("honestSign.dmCheck.results")}
                            </h3>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t("honestSign.dmCheck.summary", {
                                    total: check.data.totalCount,
                                    valid: check.data.validCount,
                                    issues: check.data.invalidCount,
                                })}
                            </p>
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="dm-check-filter">
                                {t("honestSign.dmCheck.filter")}
                            </Label>
                            <Select
                                id="dm-check-filter"
                                value={filter}
                                onChange={(event) => {
                                    setFilter(event.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="all">
                                    {t("honestSign.dmCheck.all")}
                                </option>
                                <option value="issues">
                                    {t("honestSign.dmCheck.issuesOnly")}
                                </option>
                                {statuses.map((status) => (
                                    <option value={status} key={status}>
                                        {t(
                                            "honestSign.dmCheck.statuses." +
                                                status,
                                            { defaultValue: status },
                                        )}
                                    </option>
                                ))}
                            </Select>
                        </div>
                    </div>
                    {pageItems.length ? (
                        <CodesCheckResults items={pageItems} />
                    ) : (
                        <p className="p-6 text-sm text-muted-foreground">
                            {t("honestSign.dmCheck.noResults")}
                        </p>
                    )}
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted/15 p-4">
                        <p className="text-xs text-muted-foreground">
                            {t("honestSign.dmCheck.filteredCount", {
                                count: filtered.length,
                            })}
                        </p>
                        <div className="flex max-w-full flex-wrap items-center gap-2">
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={page <= 1}
                                onClick={() => setPage(page - 1)}
                            >
                                {t("honestSign.catalog.previous")}
                            </Button>
                            <span className="text-xs tabular-nums">
                                {t("honestSign.dmCheck.page", {
                                    page,
                                    count: pageCount,
                                })}
                            </span>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={page >= pageCount}
                                onClick={() => setPage(page + 1)}
                            >
                                {t("honestSign.catalog.next")}
                            </Button>
                        </div>
                    </div>
                </section>
            )}
        </section>
    );
}
