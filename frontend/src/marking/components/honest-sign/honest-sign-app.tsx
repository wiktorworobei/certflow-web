import { BadgeCheck, CloudOff, History, Loader2, LogOut, ScanLine } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { ReactNode } from 'react';
import { CrptCatalogJournal } from '../../../crpt/CrptCatalogJournal';
import { AuthorizedAppContent } from "@marking/components/honest-sign/AuthorizedAppContent";
import { CertificateLogin } from "@marking/components/honest-sign/CertificateLogin";
import { NationalCatalogWorkspace } from "@marking/components/honest-sign/NationalCatalogWorkspace";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { useMarkingApp } from "@marking/components/honest-sign/use-honest-sign-app";
import { IntegrationSurface } from "@marking/components/integration-surface";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Skeleton } from "@marking/components/ui/skeleton";
import { WorkspaceHeader } from "@marking/components/workspace/workspace";
import { useHonestSignConnectivity } from "@marking/hooks/use-honest-sign";
import { cn } from "@marking/lib/utils";

type HonestSignAppProps = {
    companyId: string;
    catalogOnly?: boolean;
    catalogWorkspace?: (selectedThumbprint: string) => ReactNode;
    workspaceTitle?: string;
    workspaceEyebrow?: string;
    workspaceDescription?: string;
    onConfigureConnection?: () => void;
};

export function HonestSignApp(props: HonestSignAppProps) {
    const { companyId } = props;
    return (
        <IntegrationSurface integration="honestSign">
            <HonestSignWorkspace key={companyId} {...props}/>
        </IntegrationSurface>
    );
}

function HonestSignWorkspace({ companyId, catalogOnly = false, catalogWorkspace, workspaceTitle, workspaceEyebrow, workspaceDescription, onConfigureConnection }: HonestSignAppProps) {
    const { t } = useTranslation();
    const [journalOpen, setJournalOpen] = useState(false);
    const app = useMarkingApp(companyId, catalogOnly);
    const connectivity = useHonestSignConnectivity(companyId, app.isAuthorized && !catalogOnly && !journalOpen);
    const openJournal = !catalogOnly && (
        <Button variant="outline" size="sm" onClick={() => setJournalOpen(true)}>
            <History className="size-4" aria-hidden="true" />
            {t("honestSign.eventJournal")}
        </Button>
    );

    if (journalOpen) {
        return (
            <div className="min-w-0 bg-background">
                <div className="border-b px-4 py-3 md:px-6">
                    <Button variant="outline" size="sm" onClick={() => setJournalOpen(false)}>
                        {t("honestSign.eventJournalBack")}
                    </Button>
                </div>
                <CrptCatalogJournal companyId={companyId} selectedThumbprint={app.selectedThumbprint} />
            </div>
        );
    }

    if (app.checkingSession) {
        return (
            <div className="space-y-3 p-2 md:p-3">
                {openJournal}
                <Skeleton className="h-20 w-full" />
                <Skeleton className="mx-auto h-80 w-full max-w-xl" />
            </div>
        );
    }

    if (!app.isAuthorized) {
        return (
            <>
              {!catalogOnly && <div className="border-b px-4 py-3 md:px-6">{openJournal}</div>}
              <CertificateLogin
                certificates={app.certificateOptions}
                selectedThumbprint={app.selectedThumbprint}
                loadingCertificates={app.loadingCertificates}
                connecting={app.connectingHonestSign}
                statusMessage={app.statusMessage}
                statusVariant={app.statusVariant}
                onCertificateChange={app.handleSelectedThumbprintChange}
                onReload={app.handleReloadCertificates}
                onConnect={() => void app.onConnectHonestSign()}
                onConfigureConnection={onConfigureConnection}
              />
            </>
        );
    }

    return (
        <div className="min-w-0 overflow-hidden bg-background">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-3 md:px-6">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="integration-symbol mt-0.5 rounded-md p-2">
                        <ScanLine className="size-4" aria-hidden="true" />
                    </div>
                    <div>
                        <p className="text-xs font-medium tracking-wide text-muted-foreground">
                            {catalogOnly ? workspaceEyebrow ?? (workspaceTitle ? 'Честный знак · СУЗ 3.0' : 'Национальный каталог · карточки товаров') : t("honestSign.systemLabel")}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <WorkspaceHeader title={catalogOnly ? workspaceTitle ?? 'Работа с карточками товаров' : t("honestSign.title")} />
                            <Badge variant="secondary" className="gap-1">
                                <BadgeCheck
                                    className="size-3.5"
                                    aria-hidden="true"
                                />
                                {t("honestSign.connected")}
                            </Badge>
                            {!catalogOnly && <Badge
                                variant="outline"
                                className="gap-1 bg-background/70"
                            >
                                {connectivity.isFetching ? (
                                    <Loader2
                                        className="size-3 animate-spin motion-reduce:animate-none"
                                        aria-hidden="true"
                                    />
                                ) : connectivity.data?.isAvailable ? (
                                    <BadgeCheck
                                        className="size-3"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <CloudOff
                                        className="size-3"
                                        aria-hidden="true"
                                    />
                                )}
                                {connectivity.isFetching
                                    ? t("honestSign.connectivity.checking")
                                    : connectivity.data?.isAvailable
                                      ? t("honestSign.connectivity.available")
                                      : t(
                                            "honestSign.connectivity.unavailable",
                                        )}
                            </Badge>}
                        </div>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {catalogOnly ? workspaceDescription ?? 'Описание товара, характеристики, модерация и подписание карточки.' : t("honestSign.description")}
                        </p>
                    </div>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void app.onLogout()}
                >
                    <LogOut className="size-4" aria-hidden="true" />
                    {t("honestSign.disconnect")}
                </Button>
            </div>
            {!catalogOnly && <div className="flex flex-wrap items-center gap-x-6 border-b px-4 md:px-6">
                {(
                    ["orders", "documents", "catalog", "codes-check"] as const
                ).map((tab) => (
                    <button
                        key={tab}
                        type="button"
                        aria-pressed={app.activeTopTab === tab}
                        onClick={() => app.handleTopTabChange(tab)}
                        className={cn(
                            "border-b-2 py-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            app.activeTopTab === tab
                                ? "border-foreground text-foreground"
                                : "border-transparent text-muted-foreground hover:text-foreground",
                        )}
                    >
                        {t("honestSign.tabs." + tab)}
                    </button>
                ))}
                {openJournal}
            </div>}
            {app.statusMessage ? (
                <div className="border-b p-3 md:px-6">
                    <Notice variant={app.statusVariant} role="status">
                        {app.statusMessage}
                    </Notice>
                </div>
            ) : null}
            {catalogOnly ? catalogWorkspace ? catalogWorkspace(app.selectedThumbprint) : <NationalCatalogWorkspace companyId={companyId} selectedThumbprint={app.selectedThumbprint}/> : <AuthorizedAppContent app={app} companyId={companyId} />}
        </div>
    );
}
