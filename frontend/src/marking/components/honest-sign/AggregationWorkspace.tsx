import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { AggregationReconcile } from "@marking/components/honest-sign/AggregationReconcile";
import { FormField } from "@marking/components/honest-sign/ui/form-field";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Select } from "@marking/components/honest-sign/ui/select";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Checkbox } from "@marking/components/ui/checkbox";
import { Input } from "@marking/components/ui/input";
import { Label } from "@marking/components/ui/label";
import {
    Table as WorkspaceTable,
    TableHeader as WorkspaceTableHeader,
    TableBody as WorkspaceTableBody,
    TableRow as WorkspaceTableRow,
    TableHead as WorkspaceTableHead,
    TableCell as WorkspaceTableCell,
} from "@marking/components/ui/table";
import {
    aggregationApiService,
    SSCC_PRODUCT_GROUPS,
} from "@marking/lib/honest-sign/aggregationApiService";
import { cryptoProSignatureService } from "@marking/lib/honest-sign/cryptoProSignatureService";

type Props = {
    companyId: string;
    productGroups: string[];
    selectedThumbprint: string;
};

export function AggregationWorkspace({
    companyId,
    productGroups,
    selectedThumbprint,
}: Props) {
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [physical, setPhysical] = useState(false);
    const [rights, setRights] = useState(false);
    const groups = productGroups.filter((group) =>
        SSCC_PRODUCT_GROUPS.includes(group),
    );
    const form = useForm({
        defaultValues: { sscc: "", productGroup: groups[0] ?? "" },
    });
    const key = ["honest-sign", companyId, "aggregations"];
    const journal = useQuery({
        queryKey: [...key, page],
        queryFn: () => aggregationApiService.list(page),
        enabled: Boolean(companyId),
        refetchInterval: 15000,
    });
    const invalidate = () => queryClient.invalidateQueries({ queryKey: key });
    const prepare = useMutation({
        mutationFn: ({
            sscc,
            productGroup,
        }: {
            sscc: string;
            productGroup: string;
        }) => aggregationApiService.prepare(sscc, productGroup),
        onSuccess: invalidate,
    });
    const submit = useMutation({
        mutationFn: async () => {
            const draft = prepare.data;
            if (!draft?.payload || !physical || !rights || !selectedThumbprint)
                throw new Error(t("honestSign.aggregation.confirmFirst"));
            const signature = await cryptoProSignatureService.signDetached({
                thumbprint: selectedThumbprint,
                message: draft.payload,
            });
            return aggregationApiService.submit(draft, signature.pkcs7);
        },
        onSettled: invalidate,
    });
    const refresh = useMutation({
        mutationFn: aggregationApiService.refresh,
        onSuccess: invalidate,
    });
    const busy = prepare.isPending || submit.isPending;
    const current = submit.data
        ? (journal.data?.find((row) => row.id === submit.data.id) ??
          submit.data)
        : prepare.data;
    const error = submit.error ?? prepare.error ?? refresh.error;
    const reset = () => {
        prepare.reset();
        submit.reset();
        setPhysical(false);
        setRights(false);
    };

    return (
        <section
            className="space-y-5"
            aria-label={t("honestSign.aggregation.title")}
        >
            <div>
                <h2 className="text-lg font-semibold">
                    {t("honestSign.aggregation.title")}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                    {t("honestSign.aggregation.intro")}
                </p>
            </div>
            <Notice>{t("honestSign.aggregation.prerequisites")}</Notice>
            {groups.length === 0 ? (
                <Notice>{t("honestSign.aggregation.noGroups")}</Notice>
            ) : (
                <form
                    className="flex flex-wrap items-end gap-3"
                    onSubmit={form.handleSubmit((values) => {
                        reset();
                        prepare.mutate(values);
                    })}
                >
                    <FormField
                        htmlFor="aggregation-sscc"
                        label={t("honestSign.aggregation.scan")}
                        className="min-w-60 flex-1"
                    >
                        <Input
                            id="aggregation-sscc"
                            autoComplete="off"
                            disabled={busy}
                            aria-invalid={Boolean(form.formState.errors.sscc)}
                            {...form.register("sscc", {
                                required: true,
                                onChange: reset,
                            })}
                        />
                        {form.formState.errors.sscc ? (
                            <p
                                role="alert"
                                className="text-xs text-destructive"
                            >
                                {t("honestSign.aggregation.required")}
                            </p>
                        ) : null}
                    </FormField>
                    <FormField
                        htmlFor="aggregation-group"
                        label={t("honestSign.aggregation.group")}
                    >
                        <Select
                            id="aggregation-group"
                            disabled={busy}
                            {...form.register("productGroup", {
                                required: true,
                                onChange: reset,
                            })}
                        >
                            {groups.map((group) => (
                                <option key={group} value={group}>
                                    {t(`honestSign.productGroups.${group}`, {
                                        defaultValue: group,
                                    })}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    <Button type="submit" disabled={busy}>
                        {t(
                            prepare.isPending
                                ? "honestSign.aggregation.checking"
                                : "honestSign.aggregation.prepare",
                        )}
                    </Button>
                </form>
            )}
            {error ? (
                <p role="alert" className="text-sm text-destructive">
                    {error.message}
                </p>
            ) : null}
            {current ? (
                <div
                    className="space-y-4 rounded-lg border p-4"
                    aria-live="polite"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <span className="font-mono break-all">
                            (00){current.sscc}
                        </span>
                        <Badge
                            variant={
                                current.state === "Rejected"
                                    ? "destructive"
                                    : "outline"
                            }
                        >
                            {t(
                                `honestSign.aggregation.states.${current.state}`,
                            )}
                        </Badge>
                    </div>
                    <p className="text-sm">
                        {t("honestSign.aggregation.summary", {
                            inn: current.participantInn,
                            count: current.childrenCount,
                            level: current.level,
                        })}
                    </p>
                    {current.state === "Prepared" && current.payload ? (
                        <>
                            <p className="text-sm text-muted-foreground">
                                {t("honestSign.aggregation.review")}
                            </p>
                            <div className="flex items-start gap-2">
                                <Checkbox
                                    id="aggregation-physical"
                                    checked={physical}
                                    disabled={busy}
                                    onCheckedChange={(checked) =>
                                        setPhysical(checked === true)
                                    }
                                />
                                <Label
                                    htmlFor="aggregation-physical"
                                    className="leading-5"
                                >
                                    {t("honestSign.aggregation.physical")}
                                </Label>
                            </div>
                            <div className="flex items-start gap-2">
                                <Checkbox
                                    id="aggregation-rights"
                                    checked={rights}
                                    disabled={busy}
                                    onCheckedChange={(checked) =>
                                        setRights(checked === true)
                                    }
                                />
                                <Label
                                    htmlFor="aggregation-rights"
                                    className="leading-5"
                                >
                                    {t("honestSign.aggregation.rights")}
                                </Label>
                            </div>
                            <Button
                                disabled={
                                    busy ||
                                    !physical ||
                                    !rights ||
                                    !selectedThumbprint ||
                                    submit.isError
                                }
                                onClick={() => submit.mutate()}
                            >
                                {t(
                                    submit.isPending
                                        ? "honestSign.aggregation.sending"
                                        : "honestSign.aggregation.sign",
                                )}
                            </Button>
                            {!selectedThumbprint ? (
                                <p className="text-sm text-destructive">
                                    {t("honestSign.aggregation.certificate")}
                                </p>
                            ) : null}
                            {submit.isError ? (
                                <Notice>
                                    {t("honestSign.aggregation.afterError")}
                                </Notice>
                            ) : null}
                        </>
                    ) : (
                        <p className="text-sm">
                            {t(
                                current.state === "OutcomeUnknown" ||
                                    current.state === "Sending"
                                    ? "honestSign.aggregation.unknown"
                                    : "honestSign.aggregation.afterSubmit",
                            )}
                        </p>
                    )}
                </div>
            ) : null}
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold">
                        {t("honestSign.aggregation.journal")}
                    </h3>
                    <Button
                        variant="outline"
                        disabled={journal.isFetching}
                        onClick={() => void journal.refetch()}
                    >
                        {t("honestSign.aggregation.reload")}
                    </Button>
                </div>
                {journal.isPending ? (
                    <p role="status">{t("honestSign.aggregation.loading")}</p>
                ) : journal.isError ? (
                    <p role="alert" className="text-destructive">
                        {journal.error.message}
                    </p>
                ) : journal.data.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                        {t("honestSign.aggregation.empty")}
                    </p>
                ) : (
                    <div className="relative overflow-x-auto rounded-lg border">
                        <WorkspaceTable className="w-full text-sm">
                            <WorkspaceTableHeader className="border-b bg-muted/40">
                                <WorkspaceTableRow>
                                    <WorkspaceTableHead className="p-3 text-left">
                                        SSCC
                                    </WorkspaceTableHead>
                                    <WorkspaceTableHead className="p-3 text-left">
                                        {t("honestSign.aggregation.count")}
                                    </WorkspaceTableHead>
                                    <WorkspaceTableHead className="p-3 text-left">
                                        {t("honestSign.aggregation.status")}
                                    </WorkspaceTableHead>
                                    <WorkspaceTableHead className="p-3 text-left">
                                        {t("honestSign.aggregation.document")}
                                    </WorkspaceTableHead>
                                    <WorkspaceTableHead className="p-3">
                                        <span className="sr-only">
                                            {t(
                                                "honestSign.aggregation.actions",
                                            )}
                                        </span>
                                    </WorkspaceTableHead>
                                </WorkspaceTableRow>
                            </WorkspaceTableHeader>
                            <WorkspaceTableBody>
                                {journal.data.map((row) => (
                                    <WorkspaceTableRow
                                        className="border-b last:border-0"
                                        key={row.id}
                                    >
                                        <WorkspaceTableCell className="p-3 font-mono">
                                            (00){row.sscc}
                                        </WorkspaceTableCell>
                                        <WorkspaceTableCell className="p-3">
                                            {row.childrenCount}
                                        </WorkspaceTableCell>
                                        <WorkspaceTableCell className="p-3">
                                            <Badge
                                                variant={
                                                    row.state === "Rejected"
                                                        ? "destructive"
                                                        : "outline"
                                                }
                                            >
                                                {t(
                                                    `honestSign.aggregation.states.${row.state}`,
                                                )}
                                            </Badge>
                                            <p className="mt-1 text-xs text-muted-foreground">
                                                {row.externalStatus}
                                            </p>
                                            {row.state === "Sending" ||
                                            row.state === "OutcomeUnknown" ? (
                                                <p className="mt-1 max-w-64 text-xs">
                                                    {t(
                                                        "honestSign.aggregation.unknown",
                                                    )}
                                                </p>
                                            ) : null}
                                        </WorkspaceTableCell>
                                        <WorkspaceTableCell className="max-w-64 p-3 font-mono text-xs break-all">
                                            {row.externalDocumentId ?? "—"}
                                        </WorkspaceTableCell>
                                        <WorkspaceTableCell className="p-3">
                                            <Button
                                                aria-label={
                                                    t(
                                                        "honestSign.aggregation.checkStatus",
                                                    ) +
                                                    " " +
                                                    row.sscc
                                                }
                                                size="sm"
                                                variant="outline"
                                                disabled={
                                                    !row.externalDocumentId ||
                                                    refresh.isPending ||
                                                    row.state === "Accepted" ||
                                                    row.state === "Rejected"
                                                }
                                                onClick={() =>
                                                    refresh.mutate(row.id)
                                                }
                                            >
                                                {t(
                                                    "honestSign.aggregation.checkStatus",
                                                )}
                                            </Button>
                                            {row.state === "OutcomeUnknown" ||
                                            row.state === "Sending" ? (
                                                <AggregationReconcile
                                                    id={row.id}
                                                    onSuccess={invalidate}
                                                />
                                            ) : null}
                                        </WorkspaceTableCell>
                                    </WorkspaceTableRow>
                                ))}
                            </WorkspaceTableBody>
                        </WorkspaceTable>
                    </div>
                )}
                <div className="flex items-center justify-end gap-3">
                    <Button
                        variant="outline"
                        disabled={page === 1 || journal.isFetching}
                        onClick={() => setPage(page - 1)}
                    >
                        {t("honestSign.aggregation.previous")}
                    </Button>
                    <span>{page}</span>
                    <Button
                        variant="outline"
                        disabled={
                            journal.isFetching ||
                            (journal.data?.length ?? 0) < 20
                        }
                        onClick={() => setPage(page + 1)}
                    >
                        {t("honestSign.aggregation.next")}
                    </Button>
                </div>
            </div>
        </section>
    );
}
