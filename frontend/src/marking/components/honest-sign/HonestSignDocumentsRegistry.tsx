import {
    AlertCircle,
    ArrowDownLeft,
    ArrowUpRight,
    ChevronRight,
    Download,
    FileText,
    Loader2,
    RefreshCw,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import {
    Panel,
    PanelBody,
    PanelHeader,
} from "@marking/components/honest-sign/ui/panel";
import { Select } from "@marking/components/honest-sign/ui/select";
import { formatProductGroupLabel } from "@marking/components/honest-sign/utils";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import {
    Table as WorkspaceTable,
    TableHeader as WorkspaceTableHeader,
    TableBody as WorkspaceTableBody,
    TableRow as WorkspaceTableRow,
    TableHead as WorkspaceTableHead,
    TableCell as WorkspaceTableCell,
} from "@marking/components/ui/table";
import {
    useHonestSignDocument,
    useHonestSignDocuments,
} from "@marking/hooks/use-honest-sign";

import type {
    HonestSignDocumentSummary,
    HonestSignDocumentView,
} from "@marking/lib/honest-sign/documentsApiService";

type HonestSignDocumentsRegistryProps = {
    companyId: string;
    productGroups: string[];
    view?: HonestSignDocumentView;
    allowExport?: boolean;
};

function formatDate(value: string | null, locale: string): string {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime())
        ? value
        : new Intl.DateTimeFormat(locale, {
              dateStyle: "short",
              timeStyle: "short",
          }).format(date);
}

function errorMessage(error: unknown, fallback: string): string {
    return error instanceof Error ? error.message : fallback;
}

function escapeCsv(value: string): string {
    return `"${value.replaceAll('"', '""')}"`;
}

function exportDocuments(documents: HonestSignDocumentSummary[]): void {
    const rows = documents.map((document) =>
        [
            document.documentId,
            document.type ?? "",
            document.status ?? "",
            document.productGroup ?? "",
            document.isIncoming === null
                ? ""
                : document.isIncoming
                  ? "incoming"
                  : "outgoing",
            document.documentDateUtc ?? document.receivedAtUtc ?? "",
            document.errors.join("; "),
        ]
            .map(escapeCsv)
            .join(","),
    );
    const content = [
        "documentId,type,status,productGroup,direction,date,errors",
        ...rows,
    ].join("\r\n");
    const url = URL.createObjectURL(
        new Blob(["\uFEFF", content], { type: "text/csv;charset=utf-8" }),
    );
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `honest-sign-documents-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
}

export function HonestSignDocumentsRegistry({
    companyId,
    productGroups,
    view = "all",
    allowExport = false,
}: HonestSignDocumentsRegistryProps) {
    const { t, i18n } = useTranslation();
    const [productGroup, setProductGroup] = useState("");
    const [selectedDocumentId, setSelectedDocumentId] = useState("");

    useEffect(() => {
        setProductGroup((current) =>
            current && productGroups.includes(current)
                ? current
                : (productGroups[0] ?? ""),
        );
    }, [productGroups]);

    useEffect(() => {
        setSelectedDocumentId("");
    }, [productGroup]);

    const documentsQuery = useHonestSignDocuments(
        companyId,
        productGroup,
        20,
        view,
    );
    const documentQuery = useHonestSignDocument(
        companyId,
        productGroup,
        selectedDocumentId,
    );
    const documents = documentsQuery.data?.items ?? [];
    const details = documentQuery.data;
    const productGroupLabel = (group: string) =>
        t(`honestSign.productGroups.${group}`, {
            defaultValue: formatProductGroupLabel(group),
        });
    const statusLabel = (status: string | null) =>
        status
            ? t(`honestSign.documentRegistry.statuses.${status}`, {
                  defaultValue: status,
              })
            : "—";
    const typeLabel = (type: string | null) =>
        type
            ? t(`honestSign.documentRegistry.types.${type}`, {
                  defaultValue: type,
              })
            : "—";
    const registryKey =
        view === "in-work"
            ? "inWork"
            : view === "processed"
              ? "processed"
              : "all";

    return (
        <Panel aria-labelledby="honest-sign-documents-title">
            <PanelHeader className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2
                        id="honest-sign-documents-title"
                        className="font-semibold"
                    >
                        {t(
                            `honestSign.documentRegistry.views.${registryKey}.title`,
                        )}
                    </h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                        {t(
                            `honestSign.documentRegistry.views.${registryKey}.description`,
                        )}
                    </p>
                </div>
                <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <Select
                        value={productGroup}
                        className="min-w-56 flex-1 sm:flex-none"
                        aria-label={t(
                            "honestSign.documentRegistry.productGroup",
                        )}
                        onChange={(event) =>
                            setProductGroup(event.target.value)
                        }
                    >
                        <option value="">
                            {t("honestSign.documentRegistry.productGroup")}
                        </option>
                        {productGroups.map((group) => (
                            <option key={group} value={group}>
                                {productGroupLabel(group)}
                            </option>
                        ))}
                    </Select>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={!productGroup || documentsQuery.isFetching}
                        onClick={() => void documentsQuery.refetch()}
                    >
                        <RefreshCw
                            className={
                                documentsQuery.isFetching
                                    ? "size-4 animate-spin motion-reduce:animate-none"
                                    : "size-4"
                            }
                            aria-hidden="true"
                        />
                        {t("common.refresh")}
                    </Button>
                    {allowExport ? (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={documents.length === 0}
                            onClick={() => exportDocuments(documents)}
                        >
                            <Download className="size-4" aria-hidden="true" />
                            {t("honestSign.documentRegistry.exportCsv")}
                        </Button>
                    ) : null}
                </div>
            </PanelHeader>
            <PanelBody className="space-y-4">
                {!productGroup ? (
                    <Notice>{t("honestSign.documentRegistry.noGroups")}</Notice>
                ) : documentsQuery.isPending ? (
                    <div
                        className="flex items-center gap-2 py-6 text-sm text-muted-foreground"
                        role="status"
                    >
                        <Loader2
                            className="size-4 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                        />
                        {t("honestSign.documentRegistry.loading")}
                    </div>
                ) : documentsQuery.isError ? (
                    <Notice variant="error" role="alert">
                        {errorMessage(
                            documentsQuery.error,
                            t("honestSign.messages.documentsLoadFailed"),
                        )}
                    </Notice>
                ) : documents.length === 0 ? (
                    <div className="rounded-md border border-dashed px-4 py-8 text-center">
                        <FileText
                            className="mx-auto size-5 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <p className="mt-2 text-sm text-muted-foreground">
                            {t("honestSign.documentRegistry.empty")}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto rounded-md border">
                        <WorkspaceTable className="w-full min-w-[720px] text-left text-sm">
                            <WorkspaceTableHeader className="border-b bg-muted/40 text-xs text-muted-foreground">
                                <WorkspaceTableRow>
                                    <WorkspaceTableHead className="px-3 py-2 font-medium">
                                        {t(
                                            "honestSign.documentRegistry.document",
                                        )}
                                    </WorkspaceTableHead>
                                    <WorkspaceTableHead className="px-3 py-2 font-medium">
                                        {t("honestSign.documentRegistry.type")}
                                    </WorkspaceTableHead>
                                    <WorkspaceTableHead className="px-3 py-2 font-medium">
                                        {t(
                                            "honestSign.documentRegistry.direction",
                                        )}
                                    </WorkspaceTableHead>
                                    <WorkspaceTableHead className="px-3 py-2 font-medium">
                                        {t(
                                            "honestSign.documentRegistry.status",
                                        )}
                                    </WorkspaceTableHead>
                                    <WorkspaceTableHead className="px-3 py-2 font-medium">
                                        {t("honestSign.documentRegistry.date")}
                                    </WorkspaceTableHead>
                                    <WorkspaceTableHead className="w-10 px-2 py-2">
                                        <span className="sr-only">
                                            {t("common.actions")}
                                        </span>
                                    </WorkspaceTableHead>
                                </WorkspaceTableRow>
                            </WorkspaceTableHeader>
                            <WorkspaceTableBody>
                                {documents.map((document) => (
                                    <WorkspaceTableRow
                                        key={document.documentId}
                                        className="border-b last:border-b-0 hover:bg-muted/25"
                                    >
                                        <WorkspaceTableCell className="max-w-64 px-3 py-2.5 font-mono text-xs break-all">
                                            {document.documentId || "—"}
                                        </WorkspaceTableCell>
                                        <WorkspaceTableCell className="px-3 py-2.5">
                                            {typeLabel(document.type)}
                                        </WorkspaceTableCell>
                                        <WorkspaceTableCell className="px-3 py-2.5">
                                            <span className="inline-flex items-center gap-1.5">
                                                {document.isIncoming ===
                                                true ? (
                                                    <ArrowDownLeft
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                ) : document.isIncoming ===
                                                  false ? (
                                                    <ArrowUpRight
                                                        className="size-3.5"
                                                        aria-hidden="true"
                                                    />
                                                ) : null}
                                                {document.isIncoming === true
                                                    ? t(
                                                          "honestSign.documentRegistry.incoming",
                                                      )
                                                    : document.isIncoming ===
                                                        false
                                                      ? t(
                                                            "honestSign.documentRegistry.outgoing",
                                                        )
                                                      : "—"}
                                            </span>
                                        </WorkspaceTableCell>
                                        <WorkspaceTableCell className="px-3 py-2.5">
                                            <Badge
                                                variant={
                                                    document.errors.length > 0
                                                        ? "destructive"
                                                        : "outline"
                                                }
                                            >
                                                {document.errors.length > 0 ? (
                                                    <AlertCircle
                                                        aria-hidden="true"
                                                        className="size-3"
                                                    />
                                                ) : null}
                                                {statusLabel(document.status)}
                                            </Badge>
                                        </WorkspaceTableCell>
                                        <WorkspaceTableCell className="px-3 py-2.5 text-muted-foreground">
                                            {formatDate(
                                                document.documentDateUtc ??
                                                    document.receivedAtUtc,
                                                i18n.language,
                                            )}
                                        </WorkspaceTableCell>
                                        <WorkspaceTableCell className="px-2 py-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="icon-sm"
                                                aria-label={t(
                                                    "honestSign.documentRegistry.open",
                                                    {
                                                        id: document.documentId,
                                                    },
                                                )}
                                                onClick={() =>
                                                    setSelectedDocumentId(
                                                        document.documentId,
                                                    )
                                                }
                                            >
                                                <ChevronRight
                                                    className="size-4"
                                                    aria-hidden="true"
                                                />
                                            </Button>
                                        </WorkspaceTableCell>
                                    </WorkspaceTableRow>
                                ))}
                            </WorkspaceTableBody>
                        </WorkspaceTable>
                    </div>
                )}

                {selectedDocumentId ? (
                    <div className="rounded-md border border-l-2 border-l-emerald-600/50 bg-muted/20 p-4">
                        {documentQuery.isPending ? (
                            <div
                                className="flex items-center gap-2 text-sm text-muted-foreground"
                                role="status"
                            >
                                <Loader2
                                    className="size-4 animate-spin motion-reduce:animate-none"
                                    aria-hidden="true"
                                />
                                {t(
                                    "honestSign.documentRegistry.detailsLoading",
                                )}
                            </div>
                        ) : documentQuery.isError ? (
                            <Notice variant="error" role="alert">
                                {errorMessage(
                                    documentQuery.error,
                                    t(
                                        "honestSign.messages.documentDetailsFailed",
                                    ),
                                )}
                            </Notice>
                        ) : details ? (
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div>
                                        <p className="text-xs font-medium text-muted-foreground">
                                            {t(
                                                "honestSign.documentRegistry.details",
                                            )}
                                        </p>
                                        <p className="mt-1 font-mono text-xs break-all">
                                            {details.documentId}
                                        </p>
                                    </div>
                                    <Badge variant="outline">
                                        {statusLabel(details.status)}
                                    </Badge>
                                </div>
                                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                                    <div>
                                        <dt className="text-xs text-muted-foreground">
                                            {t(
                                                "honestSign.documentRegistry.sender",
                                            )}
                                        </dt>
                                        <dd className="mt-1">
                                            {details.senderName || "—"}
                                            {details.senderInn
                                                ? ` · ${details.senderInn}`
                                                : ""}
                                        </dd>
                                    </div>
                                    <div>
                                        <dt className="text-xs text-muted-foreground">
                                            {t(
                                                "honestSign.documentRegistry.receiver",
                                            )}
                                        </dt>
                                        <dd className="mt-1">
                                            {details.receiverName || "—"}
                                            {details.receiverInn
                                                ? ` · ${details.receiverInn}`
                                                : ""}
                                        </dd>
                                    </div>
                                </dl>
                                {details.errors.length > 0 ? (
                                    <Notice variant="error">
                                        <p className="font-medium">
                                            {t(
                                                "honestSign.documentRegistry.processingErrors",
                                            )}
                                        </p>
                                        <ul className="mt-2 list-disc space-y-1 pl-5">
                                            {details.errors.map((item) => (
                                                <li key={item}>{item}</li>
                                            ))}
                                        </ul>
                                    </Notice>
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                ) : null}
            </PanelBody>
        </Panel>
    );
}
