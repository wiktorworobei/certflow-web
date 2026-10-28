import { useQuery } from "@tanstack/react-query";
import {
    Building2,
    Fingerprint,
    Hash,
    Tag,
    Package,
    Handshake,
    SlidersHorizontal,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDmKodScope } from "@marking/components/dmkod/dmkod-scope-context";
import { Alert, AlertDescription } from "@marking/components/ui/alert";
import { Button } from "@marking/components/ui/button";
import { Skeleton } from "@marking/components/ui/skeleton";
import { dmKodKeys } from "@marking/hooks/use-dmkod";
import { dmKodExtendedApi } from "@marking/lib/api/dmkod-extended";

export function DmKodHome({
    companyId,
    onNavigate,
}: {
    companyId: string;
    onNavigate: (page: "orders" | "poas" | "settings") => void;
}) {
    const { t, i18n } = useTranslation();
    const scope = useDmKodScope(companyId);
    const query = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "extended-profile"],
        queryFn: () => dmKodExtendedApi.read(scope, { method: "Profile" }),
        retry: false,
    });
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const timer = window.setInterval(() => setNow(new Date()), 30000);
        return () => window.clearInterval(timer);
    }, []);
    const company = query.data?.profile?.company;
    return (
        <div className="mx-auto flex w-full max-w-md flex-col gap-3">
            <div className="flex flex-wrap items-center justify-center gap-3 rounded-xl border bg-card px-4 py-3">
                <span className="text-6xl font-semibold tabular-nums">
                    {new Intl.DateTimeFormat(i18n.language, {
                        day: "numeric",
                    }).format(now)}
                </span>
                <div>
                    <p className="font-semibold capitalize">
                        {new Intl.DateTimeFormat(i18n.language, {
                            month: "long",
                        }).format(now)}
                    </p>
                    <p className="text-muted-foreground">{now.getFullYear()}</p>
                </div>
                <span className="text-5xl text-muted-foreground tabular-nums">
                    {new Intl.DateTimeFormat(i18n.language, {
                        hour: "2-digit",
                        minute: "2-digit",
                    }).format(now)}
                </span>
            </div>
            {query.isLoading ? (
                <Skeleton className="h-64 w-full" />
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
            ) : (
                <dl className="space-y-6 rounded-xl border bg-card p-4">
                    {[
                        {
                            label: t("dmkod.cabinet.companyName"),
                            value: company?.name,
                            icon: Building2,
                        },
                        {
                            label: t("dmkod.cabinet.inn"),
                            value: company?.inn,
                            icon: Hash,
                        },
                        {
                            label: t("dmkod.cabinet.role"),
                            value: company?.role
                                ? t(
                                      `dmkod.cabinet.companyRoles.${company.role}`,
                                      { defaultValue: company.role },
                                  )
                                : null,
                            icon: Tag,
                        },
                        {
                            label: t("dmkod.cabinet.companyUuid"),
                            value: company?.uuid,
                            icon: Fingerprint,
                        },
                    ].map(({ label, value, icon: Icon }) => (
                        <div className="relative pl-8" key={label}>
                            <Icon
                                className="absolute top-1 left-0 size-8 text-muted-foreground/25"
                                aria-hidden="true"
                            />
                            <dt className="text-xs text-muted-foreground">
                                {label}
                            </dt>
                            <dd className="break-words">
                                {value || t("dmkod.cabinet.notSpecified")}
                            </dd>
                        </div>
                    ))}
                </dl>
            )}
            <nav
                aria-label={t("dmkod.tabs.label")}
                className="space-y-1 rounded-xl border bg-card p-3"
            >
                {[
                    { page: "orders" as const, icon: Package },
                    { page: "poas" as const, icon: Handshake },
                    { page: "settings" as const, icon: SlidersHorizontal },
                ].map(({ page, icon: Icon }) => (
                    <Button
                        key={page}
                        variant="ghost"
                        className="h-auto w-full justify-start gap-3 px-3 py-4 text-left whitespace-normal"
                        onClick={() => onNavigate(page)}
                    >
                        <Icon
                            className="size-5 shrink-0 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <span>
                            <span className="block font-medium">
                                {t(`dmkod.cabinet.${page}`)}
                            </span>
                            <span className="mt-1 block text-xs font-normal text-muted-foreground">
                                {t(`dmkod.cabinet.homeHints.${page}`)}
                            </span>
                        </span>
                    </Button>
                ))}
            </nav>
        </div>
    );
}
