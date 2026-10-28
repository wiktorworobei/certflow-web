import { useQuery } from "@tanstack/react-query";
import { Check, X, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    DmKodIconAction,
    DmKodListToolbar,
} from "@marking/components/dmkod/dmkod-compact-controls";
import { DmKodOrderOperations } from "@marking/components/dmkod/dmkod-order-operations";
import {
    useDmKodBusy,
    useDmKodScope,
} from "@marking/components/dmkod/dmkod-scope-context";
import { Alert, AlertDescription } from "@marking/components/ui/alert";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@marking/components/ui/dialog";
import { Skeleton } from "@marking/components/ui/skeleton";
import { dmKodKeys } from "@marking/hooks/use-dmkod";
import { dmKodExtendedApi } from "@marking/lib/api/dmkod-extended";

export function DmKodPoas({ companyId }: { companyId: string }) {
    const { t, i18n } = useTranslation();
    const scope = useDmKodScope(companyId);
    const busy = useDmKodBusy();
    const [active, setActive] = useState(true);
    const dictionaries = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "poa-dictionaries"],
        queryFn: () =>
            dmKodExtendedApi.read(scope, {
                method: "Dictionaries",
                names: ["PRODUCT_GROUP", "POA_STATE"],
            }),
        retry: false,
    });
    const groupLabel = (group: string) => {
        const option = dictionaries.data?.dictionaries?.PRODUCT_GROUP?.find(
            (v) => v.value === group,
        );
        return option?.shortLabel || option?.label || group;
    };
    const query = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "cabinet-poas"],
        queryFn: () => dmKodExtendedApi.read(scope, { method: "Poas" }),
        retry: false,
    });
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [sync, setSync] = useState(false);
    const rows = query.data?.poas ?? [];
    const filtered = rows.filter(
        (p) =>
            (p.state === "ACTIVE") === active &&
            [
                p.principal?.name,
                p.principal?.inn,
                p.principal?.uuid,
                p.uuid,
                String(p.id),
            ].some((v) =>
                v
                    ?.toLocaleLowerCase()
                    .includes(search.trim().toLocaleLowerCase()),
            ),
    );
    const pages = Math.max(1, Math.ceil(filtered.length / 20));
    const current = Math.min(page, pages);
    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border bg-card px-4 py-3">
                <h1 className="flex items-center gap-2 font-semibold uppercase">
                    {t("dmkod.cabinet.poas")}
                    {[true, false].map((value) => (
                        <Button
                            key={String(value)}
                            variant={active === value ? "secondary" : "outline"}
                            size="sm"
                            className="h-6 rounded-full px-2 text-xs"
                            aria-pressed={active === value}
                            aria-label={t(
                                value
                                    ? "dmkod.cabinet.active"
                                    : "dmkod.cabinet.inactive",
                            )}
                            onClick={() => {
                                setActive(value);
                                setPage(1);
                            }}
                        >
                            {
                                rows.filter(
                                    (p) => (p.state === "ACTIVE") === value,
                                ).length
                            }
                        </Button>
                    ))}
                </h1>
                <DmKodIconAction
                    label={t("dmkod.workflow.operations.SynchronizePoas")}
                    onClick={() => setSync(true)}
                >
                    <RefreshCw aria-hidden="true" />
                </DmKodIconAction>
            </div>
            <DmKodListToolbar
                search={search}
                onSearch={(v) => {
                    setSearch(v);
                    setPage(1);
                }}
                label={t("dmkod.cabinet.poaSearch")}
                total={rows.length}
                found={filtered.length}
                page={current}
                pages={pages}
                onPage={setPage}
            />
            {query.isLoading ? (
                <Skeleton className="h-40 w-full" />
            ) : query.isError ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {t("dmkod.errors.read")}
                        <Button
                            variant="outline"
                            onClick={() => void query.refetch()}
                        >
                            {t("common.retry")}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : filtered.length === 0 ? (
                <p className="py-12 text-center text-muted-foreground">
                    {t("dmkod.extended.empty")}
                </p>
            ) : (
                filtered.slice((current - 1) * 20, current * 20).map((p) => (
                    <article
                        key={p.uuid ?? `${p.id}.${p.principal?.uuid}`}
                        className="space-y-3 rounded-xl border bg-card p-4"
                    >
                        <div className="flex flex-wrap justify-between gap-2">
                            <h2 className="font-semibold">
                                {p.principal?.name || "—"}
                            </h2>
                            <span
                                className="flex items-center gap-1 text-xs text-muted-foreground"
                                aria-label={
                                    dictionaries.data?.dictionaries?.POA_STATE?.find(
                                        (v) => v.value === p.state,
                                    )?.label ??
                                    p.state ??
                                    "—"
                                }
                            >
                                {p.endAtUtc
                                    ? t("dmkod.cabinet.until", {
                                          date: new Intl.DateTimeFormat(
                                              i18n.language,
                                          ).format(new Date(p.endAtUtc)),
                                      })
                                    : null}
                                {p.state === "ACTIVE" ? (
                                    <Check
                                        className="size-5 text-emerald-600"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <X
                                        className="size-5 text-destructive"
                                        aria-hidden="true"
                                    />
                                )}
                            </span>
                        </div>
                        <dl className="text-xs text-muted-foreground">
                            <div>
                                {t("dmkod.cabinet.inn")}:{" "}
                                {p.principal?.inn || "—"}
                            </div>
                            <div className="break-all">
                                UUID: {p.principal?.uuid || "—"}
                            </div>
                        </dl>
                        <p className="text-right text-sm break-all text-[var(--dmkod-info)]">
                            {p.uuid || (p.id ? `#${p.id}` : "—")}
                        </p>
                        <div className="flex flex-wrap justify-end gap-1">
                            {(p.productGroups ?? []).map((group) => (
                                <Badge key={group} variant="secondary">
                                    {groupLabel(group)}
                                </Badge>
                            ))}
                        </div>
                    </article>
                ))
            )}
            <Dialog
                open={sync}
                onOpenChange={(open) => {
                    if (!busy) setSync(open);
                }}
            >
                <DialogContent
                    className="integration-theme dmkod-theme"
                    aria-describedby={undefined}
                >
                    <DialogHeader>
                        <DialogTitle>
                            {t("dmkod.workflow.operations.SynchronizePoas")}
                        </DialogTitle>
                    </DialogHeader>
                    <DmKodOrderOperations
                        companyId={companyId}
                        orderId={0}
                        synchronization="poas"
                    />
                </DialogContent>
            </Dialog>
        </div>
    );
}
