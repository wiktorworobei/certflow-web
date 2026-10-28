import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    DmKodActionPanel,
    DmKodApiTools,
} from "@marking/components/dmkod/dmkod-api-tools";
import {
    useDmKodBusy,
    useDmKodScope,
} from "@marking/components/dmkod/dmkod-scope-context";
import {
    DmKodConnection,
    TemporaryPasswordForm,
} from "@marking/components/dmkod/dmkod-workspace";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@marking/components/ui/accordion";
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
import { dmKodKeys, useDmKodConnection } from "@marking/hooks/use-dmkod";
import { dmKodExtendedApi } from "@marking/lib/api/dmkod-extended";

import type { DmKodAction } from "@marking/lib/dmkod-extended-types";
import type { DmKodSession } from "@marking/lib/dmkod-types";

export function DmKodSettings({
    companyId,
    session,
}: {
    companyId: string;
    session: DmKodSession;
}) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const busy = useDmKodBusy();
    const profile = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "extended-profile"],
        queryFn: () => dmKodExtendedApi.read(scope, { method: "Profile" }),
        enabled: session.externalRole !== "SERVICE",
        retry: false,
    });
    const account = profile.data?.profile;
    const [action, setAction] = useState<DmKodAction | "password" | null>(null);
    const detail = (label: string, value: string | null | undefined) => (
        <div className="grid gap-1 sm:grid-cols-[minmax(9rem,0.4fr)_1fr]">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words">
                {value || t("dmkod.cabinet.notSpecified")}
            </dd>
        </div>
    );
    const company = account?.company;
    const superuser = account?.role === "SUPERUSER";
    const section = (name: string, children: React.ReactNode) => (
        <AccordionItem
            value={name}
            className="rounded-xl border bg-card px-4 last:border-b"
        >
            <AccordionTrigger className="font-semibold uppercase hover:no-underline">
                {t(`dmkod.cabinet.${name}`)}
            </AccordionTrigger>
            <AccordionContent className="space-y-4">
                {children}
            </AccordionContent>
        </AccordionItem>
    );
    return (
        <>
            {profile.isLoading ? (
                <Skeleton className="h-48 w-full" />
            ) : profile.isError ? (
                <Alert variant="destructive">
                    <AlertDescription>
                        {t("dmkod.errors.read")}
                        <Button
                            variant="outline"
                            onClick={() => void profile.refetch()}
                        >
                            {t("common.retry")}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : account ? (
                <Accordion type="multiple" className="space-y-3">
                    {section(
                        "profile",
                        <>
                            <dl className="space-y-3">
                                {detail(
                                    t("dmkod.login.username"),
                                    account.username,
                                )}
                                {detail(
                                    t("dmkod.authActions.email"),
                                    account.email,
                                )}
                                {detail(
                                    t("dmkod.authActions.nickname"),
                                    account.nickname,
                                )}
                            </dl>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => setAction("password")}
                                >
                                    {t("dmkod.cabinet.changePassword")}
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={() => setAction("UpdateProfile")}
                                >
                                    {t("common.edit")}
                                </Button>
                            </div>
                        </>,
                    )}
                    {section(
                        "settings",
                        <>
                            <h3 className="font-semibold">
                                {t("dmkod.cabinet.visibility")}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {account.defaults.map((key) => (
                                    <Badge variant="secondary" key={key}>
                                        {t(`dmkod.cabinet.defaults.${key}`, {
                                            defaultValue: key,
                                        })}
                                    </Badge>
                                ))}
                            </div>
                            <Button
                                variant="outline"
                                onClick={() => setAction("UpdateDefaults")}
                            >
                                {t("common.edit")}
                            </Button>
                        </>,
                    )}
                    {section(
                        "permissions",
                        account.permissions.length ? (
                            <div className="flex flex-wrap gap-2">
                                {account.permissions.map((key) => (
                                    <Badge variant="outline" key={key}>
                                        {t(
                                            `dmkod.cabinet.permissionLabels.${key}`,
                                            { defaultValue: key },
                                        )}
                                    </Badge>
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground">
                                {t("dmkod.cabinet.noPermissions")}
                            </p>
                        ),
                    )}
                    {section(
                        "company",
                        company ? (
                            <>
                                <dl className="space-y-3">
                                    {detail(
                                        t("dmkod.cabinet.companyName"),
                                        company.name,
                                    )}
                                    {detail(
                                        t("dmkod.cabinet.inn"),
                                        company.inn,
                                    )}
                                    {detail(
                                        t("dmkod.cabinet.role"),
                                        company.role
                                            ? t(
                                                  `dmkod.cabinet.companyRoles.${company.role}`,
                                                  {
                                                      defaultValue:
                                                          company.role,
                                                  },
                                              )
                                            : null,
                                    )}
                                    {detail(
                                        t("dmkod.cabinet.companyUuid"),
                                        company.uuid,
                                    )}
                                </dl>
                                {superuser ? (
                                    <Button
                                        variant="outline"
                                        onClick={() =>
                                            setAction("UpdateCompany")
                                        }
                                    >
                                        {t("common.edit")}
                                    </Button>
                                ) : null}
                            </>
                        ) : superuser ? (
                            <Button onClick={() => setAction("ConnectCompany")}>
                                {t("dmkod.extended.methods.ConnectCompany")}
                            </Button>
                        ) : (
                            <p>{t("dmkod.cabinet.noCompany")}</p>
                        ),
                    )}
                    {superuser &&
                    session.externalCompanyType === "SERVICEPROVIDER"
                        ? section(
                              "connection",
                              <ConnectionSettings
                                  companyId={companyId}
                                  session={session}
                              />,
                          )
                        : null}
                    {superuser
                        ? section(
                              "administration",
                              <DmKodApiTools
                                  companyId={companyId}
                                  module="account"
                                  session={session}
                              />,
                          )
                        : null}
                </Accordion>
            ) : null}
            <Dialog
                open={!!action}
                onOpenChange={(open) => {
                    if (!open && !busy) setAction(null);
                }}
            >
                <DialogContent
                    className="integration-theme dmkod-theme max-h-[90svh] overflow-y-auto"
                    aria-describedby={undefined}
                >
                    <DialogHeader>
                        <DialogTitle>
                            {t(
                                action === "password"
                                    ? "dmkod.cabinet.changePassword"
                                    : action === "UpdateDefaults"
                                      ? "dmkod.cabinet.settings"
                                      : action === "UpdateProfile"
                                        ? "dmkod.cabinet.details"
                                        : `dmkod.extended.methods.${action}`,
                            )}
                        </DialogTitle>
                    </DialogHeader>
                    {action === "password" ? (
                        <TemporaryPasswordForm
                            companyId={companyId}
                            temporary={false}
                            embedded
                        />
                    ) : action ? (
                        <DmKodActionPanel
                            key={action}
                            companyId={companyId}
                            module="account"
                            session={session}
                            choices={[action]}
                            onCompleted={() => setAction(null)}
                            enabled={!!account}
                            initialValues={
                                action === "UpdateProfile"
                                    ? {
                                          username: account?.username ?? "",
                                          nickname: account?.nickname ?? "",
                                          email: account?.email ?? "",
                                      }
                                    : action === "UpdateDefaults"
                                      ? {
                                            settings: JSON.stringify({
                                                grant: account?.defaults ?? [],
                                                revoke: [],
                                            }),
                                        }
                                      : undefined
                            }
                        />
                    ) : null}
                </DialogContent>
            </Dialog>
        </>
    );
}

function ConnectionSettings({
    companyId,
    session,
}: {
    companyId: string;
    session: DmKodSession;
}) {
    const scope = useDmKodScope(companyId);
    const connection = useDmKodConnection(scope, true);
    return (
        <DmKodConnection
            companyId={companyId}
            sessionCertificate={session.certificateThumbprint}
            isServiceProvider
            connection={connection}
        />
    );
}
