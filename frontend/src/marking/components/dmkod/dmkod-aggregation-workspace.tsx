import { useQuery } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DmKodActionPanel } from "@marking/components/dmkod/dmkod-api-tools";
import { useDmKodScope } from "@marking/components/dmkod/dmkod-scope-context";
import { Alert, AlertDescription } from "@marking/components/ui/alert";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@marking/components/ui/card";
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
import { dmKodKeys } from "@marking/hooks/use-dmkod";
import { dmKodExtendedApi } from "@marking/lib/api/dmkod-extended";
import {
    canSignDmKodAggregationReport,
    canPullDmKodAggregationReport,
} from "@marking/lib/dmkod-aggregation-policy";

import type {
    DmKodAggregationRangeLink,
    DmKodAggregationReport,
} from "@marking/lib/dmkod-extended-types";
import type { DmKodSession } from "@marking/lib/dmkod-types";

export function DmKodAggregationWorkspace({
    companyId,
    orderId,
    session,
    enabled,
    foreignOrder = false,
    onBusyChange,
}: {
    companyId: string;
    orderId: number;
    session: DmKodSession;
    enabled: boolean;
    foreignOrder?: boolean;
    onBusyChange?: (busy: boolean) => void;
}) {
    const { t, i18n } = useTranslation();
    const scope = useDmKodScope(companyId);
    const [provider, setProvider] = useState("");
    const profile = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "extended-profile"],
        queryFn: () => dmKodExtendedApi.read(scope, { method: "Profile" }),
        enabled: enabled && session.externalCompanyType === "INTEGRATOR",
        retry: false,
    });
    const providers =
        profile.data?.profile?.integratees.filter(
            (entry) =>
                entry.id &&
                entry.type === "SERVICEPROVIDER" &&
                entry.access === "OPENED",
        ) ?? [];
    const providerId =
        provider && providers.some((entry) => String(entry.id) === provider)
            ? Number(provider)
            : undefined;
    const allowed =
        enabled &&
        !session.requiresPasswordChange &&
        session.externalRole !== "SERVICE" &&
        (session.externalCompanyType === "SERVICEPROVIDER" || !!providerId);
    const [prepareBusy, setPrepareBusy] = useState(false);
    const [generateBusy, setGenerateBusy] = useState(false);
    const [reportBusy, setReportBusy] = useState(false);
    const [extraBusy, setExtraBusy] = useState(false);
    const [prepareOutcome, setPrepareOutcome] = useState("idle");
    const [selectedId, setSelectedId] = useState("");
    const [compositionPage, setCompositionPage] = useState(1);
    const busy = prepareBusy || generateBusy || reportBusy || extraBusy;
    useEffect(() => {
        onBusyChange?.(busy);
        return () => onBusyChange?.(false);
    }, [busy, onBusyChange]);
    const ranges = useQuery({
        queryKey: [
            ...dmKodKeys.scoped(scope),
            "aggregation-ranges",
            orderId,
            providerId,
        ],
        queryFn: () =>
            dmKodExtendedApi.read(scope, {
                method: "OrderAggregations",
                id: orderId,
                serviceProviderId: providerId,
            }),
        enabled: allowed,
        retry: false,
        staleTime: 0,
    });
    const reports = useQuery({
        queryKey: [
            ...dmKodKeys.scoped(scope),
            "aggregation-reports",
            orderId,
            providerId,
        ],
        queryFn: () =>
            dmKodExtendedApi.read(scope, {
                method: "OrderReports",
                id: orderId,
                serviceProviderId: providerId,
            }),
        enabled: allowed,
        retry: false,
        staleTime: 0,
        refetchInterval: (query) =>
            query.state.status !== "error" &&
            query.state.data?.aggregationReports?.some((report) =>
                ["SIGNED", "PENDING"].includes(report.state),
            )
                ? 3000
                : false,
    });
    const rows = ranges.data?.aggregationRanges ?? [];
    const pages = Math.max(1, Math.ceil(rows.length / 20));
    const page = Math.min(compositionPage, pages);
    const visibleRows = rows.slice((page - 1) * 20, page * 20);
    const reportRows = reports.data?.aggregationReports ?? [];
    const selected =
        reportRows.find((report) => String(report.id) === selectedId) ?? null;
    const canSign =
        selected &&
        !reports.isError &&
        canSignDmKodAggregationReport(selected, reportRows, foreignOrder);
    const canPull = selected && canPullDmKodAggregationReport(selected);
    const refLabel = (ref: DmKodAggregationRangeLink) =>
        ref.readOnly ||
        ref.orderItemId === null ||
        ref.start === null ||
        ref.end === null
            ? `${t("dmkod.aggregation.externalReference")} · ${ref.key.slice(0, 8)}`
            : t("dmkod.aggregation.rangeReference", {
                  id: ref.orderItemId,
                  start: ref.start,
                  end: ref.end,
              });
    const reportState = (report: DmKodAggregationReport) =>
        t(`dmkod.aggregation.states.${report.state}`, {
            defaultValue: report.state,
        });
    const refresh = () => {
        void ranges.refetch();
        void reports.refetch();
    };
    return (
        <section
            className="min-w-0 space-y-4"
            aria-label={t("dmkod.aggregation.title")}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 className="font-semibold">
                        {t("dmkod.aggregation.title")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {t("dmkod.aggregation.steps")}
                    </p>
                </div>
                <Button
                    variant="outline"
                    disabled={busy || ranges.isFetching || reports.isFetching}
                    onClick={refresh}
                >
                    <RefreshCw aria-hidden="true" />
                    {t("common.refresh")}
                </Button>
            </div>
            {session.externalCompanyType === "INTEGRATOR" ? (
                <div className="space-y-2">
                    <Label htmlFor={`aggregation-provider-${orderId}`}>
                        {t("dmkod.extended.provider")}
                    </Label>
                    <Select
                        value={provider}
                        onValueChange={(value) => {
                            setProvider(value);
                            setSelectedId("");
                        }}
                        disabled={busy || profile.isFetching}
                    >
                        <SelectTrigger id={`aggregation-provider-${orderId}`}>
                            <SelectValue
                                placeholder={t("dmkod.extended.chooseProvider")}
                            />
                        </SelectTrigger>
                        <SelectContent className="integration-theme dmkod-theme">
                            {providers.map((entry) => (
                                <SelectItem
                                    key={entry.id}
                                    value={String(entry.id)}
                                >
                                    {entry.name} · {entry.inn}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
                key={`${orderId}.${providerId ?? "self"}`}
                className="space-y-4"
            >
                <DmKodActionPanel
                    companyId={companyId}
                    module="marking"
                    category="aggregation"
                    orderId={orderId}
                    session={session}
                    provider={providerId}
                    choices={["PushAggregationRanges"]}
                    flowKey="ranges-prepare"
                    enabled={
                        allowed && !generateBusy && !reportBusy && !extraBusy
                    }
                    onBusyChange={setPrepareBusy}
                    onOutcomeChange={setPrepareOutcome}
                />
                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle>
                            {t("dmkod.aggregation.composition")}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        {ranges.isError ? (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    {t("dmkod.aggregation.readFailed")}
                                    <Button
                                        variant="outline"
                                        onClick={() => void ranges.refetch()}
                                    >
                                        {t("common.retry")}
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        ) : ranges.isPending ? (
                            <p role="status">{t("common.loading")}</p>
                        ) : !rows.length ? (
                            <p className="text-sm text-muted-foreground">
                                {t("dmkod.aggregation.emptyComposition")}
                            </p>
                        ) : (
                            <div className="overflow-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>
                                                {t(
                                                    "dmkod.aggregation.container",
                                                )}
                                            </TableHead>
                                            <TableHead>
                                                {t("dmkod.aggregation.parent")}
                                            </TableHead>
                                            <TableHead>
                                                {t(
                                                    "dmkod.aggregation.capacity",
                                                )}
                                            </TableHead>
                                            <TableHead>
                                                {t("dmkod.extended.state")}
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {visibleRows.map((row) => (
                                            <TableRow key={row.key}>
                                                <TableCell className="min-w-44 whitespace-normal">
                                                    {refLabel(row)}
                                                    {row.readOnly ? (
                                                        <p className="text-xs text-muted-foreground">
                                                            {t(
                                                                "dmkod.aggregation.readOnly",
                                                            )}
                                                        </p>
                                                    ) : null}
                                                </TableCell>
                                                <TableCell className="min-w-40 whitespace-normal">
                                                    {row.parent
                                                        ? refLabel(row.parent)
                                                        : t(
                                                              "dmkod.aggregation.noParent",
                                                          )}
                                                </TableCell>
                                                <TableCell>
                                                    {row.capacity === null
                                                        ? "—"
                                                        : String(row.capacity)}
                                                </TableCell>
                                                <TableCell className="min-w-44 whitespace-normal">
                                                    <span>
                                                        {row.state
                                                            ? t(
                                                                  `dmkod.aggregation.states.${row.state}`,
                                                                  {
                                                                      defaultValue:
                                                                          row.state,
                                                                  },
                                                              )
                                                            : "—"}
                                                    </span>
                                                    <div className="flex flex-wrap gap-1">
                                                        {(
                                                            [
                                                                row.excluded &&
                                                                    "excluded",
                                                                row.unpacked &&
                                                                    "unpacked",
                                                                row.mixItems &&
                                                                    "mixItems",
                                                            ] as const
                                                        )
                                                            .filter(Boolean)
                                                            .map((flag) => (
                                                                <Badge
                                                                    variant="outline"
                                                                    key={String(
                                                                        flag,
                                                                    )}
                                                                >
                                                                    {t(
                                                                        `dmkod.aggregation.${flag}`,
                                                                    )}
                                                                </Badge>
                                                            ))}
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        )}
                        {!ranges.isError && rows.length > 0 ? (
                            <nav
                                className="flex flex-wrap items-center justify-between gap-3"
                                aria-label={t("dmkod.aggregation.pagination")}
                            >
                                <p
                                    className="text-sm text-muted-foreground"
                                    role="status"
                                >
                                    {t("dmkod.aggregation.pageSummary", {
                                        from: (page - 1) * 20 + 1,
                                        to: Math.min(page * 20, rows.length),
                                        total: rows.length,
                                    })}
                                </p>
                                <div className="flex gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page <= 1}
                                        onClick={() =>
                                            setCompositionPage(page - 1)
                                        }
                                    >
                                        {t("dmkod.aggregation.previousPage")}
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={page >= pages}
                                        onClick={() =>
                                            setCompositionPage(page + 1)
                                        }
                                    >
                                        {t("dmkod.aggregation.nextPage")}
                                    </Button>
                                </div>
                            </nav>
                        ) : null}
                    </CardContent>
                </Card>
                <DmKodActionPanel
                    companyId={companyId}
                    module="marking"
                    category="aggregation"
                    orderId={orderId}
                    session={session}
                    provider={providerId}
                    choices={["GenerateOrderAggregation"]}
                    flowKey="ranges-generate"
                    enabled={
                        allowed &&
                        !prepareBusy &&
                        !reportBusy &&
                        !extraBusy &&
                        prepareOutcome !== "pending"
                    }
                    onBusyChange={setGenerateBusy}
                />
                <Card className="min-w-0">
                    <CardHeader>
                        <CardTitle>{t("dmkod.aggregation.reports")}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {reports.isError ? (
                            <Alert variant="destructive">
                                <AlertDescription>
                                    {t("dmkod.aggregation.readFailed")}
                                    <Button
                                        variant="outline"
                                        onClick={() => void reports.refetch()}
                                    >
                                        {t("common.retry")}
                                    </Button>
                                </AlertDescription>
                            </Alert>
                        ) : reports.isPending ? (
                            <p role="status">{t("common.loading")}</p>
                        ) : !reportRows.length ? (
                            <p className="text-sm text-muted-foreground">
                                {t("dmkod.aggregation.emptyReports")}
                            </p>
                        ) : (
                            <div className="space-y-2">
                                <Label
                                    htmlFor={`aggregation-report-${orderId}`}
                                >
                                    {t("dmkod.aggregation.selectReport")}
                                </Label>
                                <Select
                                    value={selectedId}
                                    onValueChange={setSelectedId}
                                    disabled={busy || reports.isFetching}
                                >
                                    <SelectTrigger
                                        id={`aggregation-report-${orderId}`}
                                        className="h-auto min-h-9 w-full [&>span]:whitespace-normal"
                                    >
                                        <SelectValue
                                            placeholder={t(
                                                "dmkod.aggregation.selectReport",
                                            )}
                                        />
                                    </SelectTrigger>
                                    <SelectContent className="integration-theme dmkod-theme">
                                        {reportRows.map((report) => (
                                            <SelectItem
                                                value={String(report.id)}
                                                key={report.id}
                                            >
                                                #{report.id} ·{" "}
                                                {reportState(report)}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        {selected ? (
                            <div className="space-y-3">
                                <p className="flex flex-wrap gap-2 font-medium">
                                    #{selected.id}
                                    <Badge variant="outline">
                                        {reportState(selected)}
                                    </Badge>
                                    {selected.createdAtUtc ? (
                                        <span className="text-sm font-normal text-muted-foreground">
                                            {new Intl.DateTimeFormat(
                                                i18n.language,
                                                {
                                                    dateStyle: "short",
                                                    timeStyle: "short",
                                                },
                                            ).format(
                                                new Date(selected.createdAtUtc),
                                            )}
                                        </span>
                                    ) : null}
                                </p>
                                {selected.failureReason ? (
                                    <Alert variant="destructive">
                                        <AlertDescription>
                                            {selected.failureReason}
                                        </AlertDescription>
                                    </Alert>
                                ) : null}
                                {selected.precedingAggregationReportIds
                                    .length ? (
                                    <p className="text-sm">
                                        {t("dmkod.aggregation.preceding")}:{" "}
                                        {selected.precedingAggregationReportIds
                                            .map((id) => `#${id}`)
                                            .join(", ")}
                                    </p>
                                ) : null}
                                {!canSign && selected.state === "CREATED" ? (
                                    <p className="text-sm text-muted-foreground">
                                        {t("dmkod.aggregation.signBlocked")}
                                    </p>
                                ) : null}
                                <DmKodActionPanel
                                    key={selected.id}
                                    companyId={companyId}
                                    module="marking"
                                    category="aggregation"
                                    orderId={orderId}
                                    session={session}
                                    provider={providerId}
                                    choices={
                                        canSign
                                            ? ["SignAggregation"]
                                            : ["PullAggregation"]
                                    }
                                    fixedReportId={selected.id}
                                    flowKey={`report-${selected.id}`}
                                    enabled={
                                        allowed &&
                                        !prepareBusy &&
                                        !generateBusy &&
                                        !extraBusy &&
                                        !reports.isError &&
                                        !reports.isFetching &&
                                        !!(canSign || canPull)
                                    }
                                    onBusyChange={setReportBusy}
                                />
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
                <details className="rounded-lg border p-4">
                    <summary className="cursor-pointer text-sm font-medium">
                        {t("dmkod.aggregation.additional")}
                    </summary>
                    <div className="mt-4">
                        <DmKodActionPanel
                            companyId={companyId}
                            module="marking"
                            category="aggregation"
                            orderId={orderId}
                            session={session}
                            provider={providerId}
                            choices={[
                                "InspectContainers",
                                "GenerateAggregation",
                                "DeleteAggregation",
                                "PushAggregation",
                            ]}
                            flowKey="additional"
                            enabled={
                                allowed &&
                                !prepareBusy &&
                                !generateBusy &&
                                !reportBusy
                            }
                            onBusyChange={setExtraBusy}
                        />
                    </div>
                </details>
            </div>
        </section>
    );
}
