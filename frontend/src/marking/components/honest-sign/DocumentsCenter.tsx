import {
    ChevronDown,
    CirclePlus,
    Clock3,
    FileCheck2,
    FileText,
    Loader2,
    Printer,
    RefreshCw,
    ShoppingBag,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AggregationWorkspace } from "@marking/components/honest-sign/AggregationWorkspace";
import { DocumentsWorkspace } from "@marking/components/honest-sign/DocumentsWorkspace";
import { HonestSignDocumentsRegistry } from "@marking/components/honest-sign/HonestSignDocumentsRegistry";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import {
    Panel,
    PanelBody,
    PanelHeader,
} from "@marking/components/honest-sign/ui/panel";
import { UtilisationBatchesHistory } from "@marking/components/honest-sign/UtilisationBatchesHistory";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@marking/components/ui/dropdown-menu";
import {
    Table as WorkspaceTable,
    TableHeader as WorkspaceTableHeader,
    TableBody as WorkspaceTableBody,
    TableRow as WorkspaceTableRow,
    TableHead as WorkspaceTableHead,
    TableCell as WorkspaceTableCell,
} from "@marking/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@marking/components/ui/tabs";
import { useHonestSignUtilisationReportStatus } from "@marking/hooks/use-honest-sign";
import { useUtilisationReportsStore } from "@marking/lib/honest-sign/utilisationReportsStore";

import type { SubmittedUtilisationReport } from "@marking/lib/honest-sign/utilisationReport";

type DocumentsView =
    | "reports"
    | "in-work"
    | "processed"
    | "print-export"
    | "aggregations";

const EMPTY_REPORTS: SubmittedUtilisationReport[] = [];

type DocumentsCenterProps = {
    companyId: string;
    productGroups: string[];
    selectedThumbprint: string;
    onOpenOrders: () => void;
};

function formatDate(value: string, locale: string): string {
    return new Intl.DateTimeFormat(locale, {
        dateStyle: "short",
        timeStyle: "short",
    }).format(new Date(value));
}

function ReportStatus({
    companyId,
    report,
}: {
    companyId: string;
    report: SubmittedUtilisationReport;
}) {
    const { t } = useTranslation();
    const statusQuery = useHonestSignUtilisationReportStatus(
        companyId,
        report.reportId,
    );
    const status = statusQuery.data?.status ?? report.status ?? "PENDING";
    const errorReason = statusQuery.data?.errorReason ?? report.message;
    const destructive = status === "REJECTED" || status === "FAILED";

    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-2">
                <Badge variant={destructive ? "destructive" : "outline"}>
                    {statusQuery.isFetching ? (
                        <Loader2
                            className="size-3 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                        />
                    ) : null}
                    {t(`honestSign.documentsCenter.statuses.${status}`, {
                        defaultValue: status,
                    })}
                </Badge>
                <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t("honestSign.documentsCenter.refreshStatus")}
                    disabled={statusQuery.isFetching}
                    onClick={() => void statusQuery.refetch()}
                >
                    <RefreshCw className="size-3.5" aria-hidden="true" />
                </Button>
            </div>
            {statusQuery.isError || errorReason ? (
                <p className="max-w-72 text-xs text-destructive">
                    {errorReason ?? t("honestSign.messages.reportStatusFailed")}
                </p>
            ) : null}
        </div>
    );
}

export function DocumentsCenter({
    companyId,
    productGroups,
    selectedThumbprint,
    onOpenOrders,
}: DocumentsCenterProps) {
    const { t, i18n } = useTranslation();
    const [view, setView] = useState<DocumentsView>("reports");
    const [creatingReport, setCreatingReport] = useState(false);
    const [reportMode, setReportMode] = useState<"single" | "batch">("single");
    const reports = useUtilisationReportsStore(
        (state) => state.reportsByCompany[companyId] ?? EMPTY_REPORTS,
    );
    const rememberReport = useUtilisationReportsStore(
        (state) => state.rememberReport,
    );

    if (creatingReport) {
        return (
            <div className="space-y-4 p-4 md:p-6">
                <nav className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
                    <button
                        type="button"
                        className="text-primary hover:underline"
                        onClick={() => setCreatingReport(false)}
                    >
                        {t("honestSign.documentsCenter.tabs.reports")}
                    </button>
                    <span aria-hidden="true">/</span>
                    <span>{t("honestSign.documents.newApplication")}</span>
                </nav>
                <DocumentsWorkspace
                    companyId={companyId}
                    initialMode={reportMode}
                    productGroups={productGroups}
                    selectedThumbprint={selectedThumbprint}
                    onCancel={() => setCreatingReport(false)}
                    onSubmitted={(report) => {
                        rememberReport(companyId, report);
                        setCreatingReport(false);
                    }}
                />
            </div>
        );
    }

    return (
        <Tabs
            value={view}
            onValueChange={(value) => setView(value as DocumentsView)}
            className="gap-0"
        >
            <div className="overflow-x-auto border-b bg-background px-4 md:px-6">
                <TabsList
                    variant="line"
                    className="h-14 min-w-max justify-start gap-4"
                    aria-label={t("honestSign.documentsCenter.navigation")}
                >
                    <TabsTrigger value="reports">
                        <FileText aria-hidden="true" />
                        {t("honestSign.documentsCenter.tabs.reports")}
                    </TabsTrigger>
                    <button
                        type="button"
                        className="inline-flex h-full items-center gap-1.5 px-2 text-sm font-medium whitespace-nowrap text-foreground/60 hover:text-foreground"
                        onClick={onOpenOrders}
                    >
                        <ShoppingBag className="size-4" aria-hidden="true" />
                        {t("honestSign.documentsCenter.tabs.orders")}
                    </button>
                    <TabsTrigger value="in-work">
                        <Clock3 aria-hidden="true" />
                        {t("honestSign.documentsCenter.tabs.inWork")}
                    </TabsTrigger>
                    <TabsTrigger value="aggregations">
                        <FileCheck2 aria-hidden="true" />
                        {t("honestSign.aggregation.title")}
                    </TabsTrigger>
                    <TabsTrigger value="processed">
                        <FileCheck2 aria-hidden="true" />
                        {t("honestSign.documentsCenter.tabs.processed")}
                    </TabsTrigger>
                    <TabsTrigger value="print-export">
                        <Printer aria-hidden="true" />
                        {t("honestSign.documentsCenter.tabs.printExport")}
                    </TabsTrigger>
                </TabsList>
            </div>

            <div className="p-4 md:p-6">
                <TabsContent value="reports" className="mt-0 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                            <h2 className="text-lg font-semibold">
                                {t("honestSign.documentsCenter.reportsTitle")}
                            </h2>
                            <p className="mt-1 text-sm text-muted-foreground">
                                {t(
                                    "honestSign.documentsCenter.reportsDescription",
                                )}
                            </p>
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    type="button"
                                    className="bg-yellow-300 text-slate-950 hover:bg-yellow-200"
                                >
                                    <CirclePlus aria-hidden="true" />
                                    {t("honestSign.documentsCenter.create")}
                                    <ChevronDown aria-hidden="true" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-56">
                                <DropdownMenuItem
                                    onSelect={() => {
                                        setReportMode("single");
                                        setCreatingReport(true);
                                    }}
                                >
                                    <FileText aria-hidden="true" />
                                    {t(
                                        "honestSign.documentsCenter.applicationReport",
                                    )}
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                    onSelect={() => {
                                        setReportMode("batch");
                                        setCreatingReport(true);
                                    }}
                                >
                                    <FileText aria-hidden="true" />
                                    {t(
                                        "honestSign.documents.batch.multipleCreate",
                                    )}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    <Notice variant="warning">
                        {t("honestSign.documentsCenter.processingNote")}
                    </Notice>

                    <UtilisationBatchesHistory companyId={companyId} />

                    <Panel>
                        <PanelHeader>
                            <h3 className="font-semibold">
                                {t("honestSign.documentsCenter.submittedTitle")}
                            </h3>
                        </PanelHeader>
                        <PanelBody className="p-0">
                            {reports.length === 0 ? (
                                <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                                    {t(
                                        "honestSign.documentsCenter.emptyReports",
                                    )}
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <WorkspaceTable className="w-full min-w-[760px] text-left text-sm">
                                        <WorkspaceTableHeader className="border-b bg-muted/40 text-xs text-muted-foreground">
                                            <WorkspaceTableRow>
                                                <WorkspaceTableHead className="px-4 py-3 font-medium">
                                                    {t(
                                                        "honestSign.documentsCenter.reportId",
                                                    )}
                                                </WorkspaceTableHead>
                                                <WorkspaceTableHead className="px-4 py-3 font-medium">
                                                    {t(
                                                        "honestSign.documentsCenter.productGroup",
                                                    )}
                                                </WorkspaceTableHead>
                                                <WorkspaceTableHead className="px-4 py-3 font-medium">
                                                    {t(
                                                        "honestSign.documentsCenter.codesCount",
                                                    )}
                                                </WorkspaceTableHead>
                                                <WorkspaceTableHead className="px-4 py-3 font-medium">
                                                    {t(
                                                        "honestSign.documentsCenter.created",
                                                    )}
                                                </WorkspaceTableHead>
                                                <WorkspaceTableHead className="px-4 py-3 font-medium">
                                                    {t(
                                                        "honestSign.documentsCenter.status",
                                                    )}
                                                </WorkspaceTableHead>
                                            </WorkspaceTableRow>
                                        </WorkspaceTableHeader>
                                        <WorkspaceTableBody>
                                            {reports.map((report) => (
                                                <WorkspaceTableRow
                                                    key={report.reportId}
                                                    className="border-b last:border-b-0"
                                                >
                                                    <WorkspaceTableCell className="max-w-72 px-4 py-3 font-mono text-xs break-all">
                                                        {report.reportId}
                                                    </WorkspaceTableCell>
                                                    <WorkspaceTableCell className="px-4 py-3">
                                                        {t(
                                                            `honestSign.productGroups.${report.productGroup}`,
                                                            {
                                                                defaultValue:
                                                                    report.productGroup,
                                                            },
                                                        )}
                                                    </WorkspaceTableCell>
                                                    <WorkspaceTableCell className="px-4 py-3 tabular-nums">
                                                        {report.codesCount}
                                                    </WorkspaceTableCell>
                                                    <WorkspaceTableCell className="px-4 py-3 text-muted-foreground">
                                                        {formatDate(
                                                            report.submittedAtUtc,
                                                            i18n.language,
                                                        )}
                                                    </WorkspaceTableCell>
                                                    <WorkspaceTableCell className="px-4 py-3">
                                                        <ReportStatus
                                                            companyId={
                                                                companyId
                                                            }
                                                            report={report}
                                                        />
                                                    </WorkspaceTableCell>
                                                </WorkspaceTableRow>
                                            ))}
                                        </WorkspaceTableBody>
                                    </WorkspaceTable>
                                </div>
                            )}
                        </PanelBody>
                    </Panel>
                </TabsContent>

                <TabsContent value="aggregations" className="mt-0">
                    <AggregationWorkspace
                        key={companyId}
                        companyId={companyId}
                        productGroups={productGroups}
                        selectedThumbprint={selectedThumbprint}
                    />
                </TabsContent>
                <TabsContent value="in-work" className="mt-0">
                    <HonestSignDocumentsRegistry
                        companyId={companyId}
                        productGroups={productGroups}
                        view="in-work"
                    />
                </TabsContent>
                <TabsContent value="processed" className="mt-0">
                    <HonestSignDocumentsRegistry
                        companyId={companyId}
                        productGroups={productGroups}
                        view="processed"
                    />
                </TabsContent>
                <TabsContent value="print-export" className="mt-0">
                    <HonestSignDocumentsRegistry
                        companyId={companyId}
                        productGroups={productGroups}
                        view="processed"
                        allowExport
                    />
                </TabsContent>
            </div>
        </Tabs>
    );
}
