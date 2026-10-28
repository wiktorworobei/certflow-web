import { BadgeCheck, CloudOff, Loader2, LogOut, ScanLine } from "lucide-react";
import { useTranslation } from "react-i18next";
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
};

export function HonestSignApp({ companyId, catalogOnly = false }: HonestSignAppProps) {
    return (
        <IntegrationSurface integration="honestSign">
            <HonestSignWorkspace companyId={companyId} catalogOnly={catalogOnly}/>
        </IntegrationSurface>
    );
}

function HonestSignWorkspace({ companyId, catalogOnly = false }: HonestSignAppProps) {
    const { t } = useTranslation();
    const app = useMarkingApp(companyId, catalogOnly);
    const connectivity = useHonestSignConnectivity(companyId, app.isAuthorized && !catalogOnly);

    if (app.checkingSession) {
        return (
            <div className="space-y-3 p-2 md:p-3">
                <Skeleton className="h-20 w-full" />
                <Skeleton className="mx-auto h-80 w-full max-w-xl" />
            </div>
        );
    }

    if (!app.isAuthorized) {
        return (
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
            />
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
                            {catalogOnly ? 'Национальный каталог · карточки товаров' : t("honestSign.systemLabel")}
                        </p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2">
                            <WorkspaceHeader title={catalogOnly ? 'Работа с карточками товаров' : t("honestSign.title")} />
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
                            {catalogOnly ? 'Описание товара, характеристики, модерация и подписание карточки.' : t("honestSign.description")}
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
                {(["orders", "documents", "catalog"] as const).map((tab) => (
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
            </div>}
            {app.statusMessage ? (
                <div className="border-b p-3 md:px-6">
                    <Notice variant={app.statusVariant} role="status">
                        {app.statusMessage}
                    </Notice>
                </div>
            ) : null}
            {catalogOnly ? <NationalCatalogWorkspace companyId={companyId} selectedThumbprint={app.selectedThumbprint}/> : <AuthorizedAppContent app={app} companyId={companyId} />}
        </div>
    );
}
