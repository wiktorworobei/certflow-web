import {
    ClipboardCheck,
    FileSignature,
    ListChecks,
    PackageCheck,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DmKodReports } from "@marking/components/dmkod/dmkod-reports";
import { useDmKodScope } from "@marking/components/dmkod/dmkod-scope-context";
import { DmKodUtilisation } from "@marking/components/dmkod/dmkod-utilisation";
import { DmKodUtilisationHistory } from "@marking/components/dmkod/dmkod-utilisation-history";
import { Alert, AlertDescription } from "@marking/components/ui/alert";
import { Button } from "@marking/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@marking/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@marking/components/ui/tabs";
import { dmKodScopeStorageKey } from "@marking/lib/dmkod-scope";

const steps = [
    { key: "prepare", icon: PackageCheck },
    { key: "generate", icon: ListChecks },
    { key: "sign", icon: FileSignature },
    { key: "result", icon: ClipboardCheck },
] as const;

export function DmKodUtilisationWorkspace({
    companyId,
    enabled,
}: {
    companyId: string;
    enabled: boolean;
}) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const [view, setView] = useState(() =>
        sessionStorage.getItem(dmKodScopeStorageKey(scope, "reports"))
            ? "reports"
            : "prepare",
    );
    const [reportStep, setReportStep] = useState(1);
    const [preparationBusy, setPreparationBusy] = useState(false);
    const [reportBusy, setReportBusy] = useState(false);
    const currentStep =
        view === "prepare" ? 0 : view === "reports" ? reportStep : -1;
    return (
        <div className="flex flex-col gap-4">
            <Card>
                <CardHeader>
                    <CardTitle>{t("dmkod.application.title")}</CardTitle>
                    <CardDescription>
                        {t("dmkod.application.description")}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ol
                        aria-label={t("dmkod.application.stepsLabel")}
                        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
                    >
                        {steps.map(({ key, icon: Icon }, index) => (
                            <li
                                key={key}
                                aria-current={
                                    currentStep === index ? "step" : undefined
                                }
                                className={`flex gap-3 rounded-lg border p-3 ${currentStep === index ? "border-primary bg-primary/5" : "bg-muted/20"}`}
                            >
                                <Icon
                                    className="mt-0.5 size-5 shrink-0 text-primary"
                                    aria-hidden="true"
                                />
                                <div className="flex min-w-0 flex-col gap-1">
                                    <p className="text-sm font-medium">
                                        {index + 1}.{" "}
                                        {t(`dmkod.application.steps.${key}`)}
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        {t(`dmkod.application.hints.${key}`)}
                                    </p>
                                </div>
                            </li>
                        ))}
                    </ol>
                </CardContent>
            </Card>
            <Tabs
                value={view}
                onValueChange={setView}
                className="flex flex-col gap-4"
            >
                <TabsList
                    aria-label={t("dmkod.application.title")}
                    className="grid w-full grid-cols-1 gap-1 group-data-[orientation=horizontal]/tabs:h-auto sm:grid-cols-3"
                >
                    <TabsTrigger
                        value="prepare"
                        className="h-auto min-h-9 whitespace-normal"
                    >
                        {t("dmkod.application.tabs.prepare")}
                    </TabsTrigger>
                    <TabsTrigger
                        value="reports"
                        className="h-auto min-h-9 whitespace-normal"
                    >
                        {t("dmkod.application.tabs.reports")}
                    </TabsTrigger>
                    <TabsTrigger
                        value="history"
                        className="h-auto min-h-9 whitespace-normal"
                    >
                        {t("dmkod.application.tabs.history")}
                    </TabsTrigger>
                </TabsList>
                {(view === "reports" && preparationBusy) ||
                (view === "prepare" && reportBusy) ? (
                    <Alert>
                        <AlertDescription>
                            {t(
                                preparationBusy
                                    ? "dmkod.application.waitPreparation"
                                    : "dmkod.application.waitReport",
                            )}
                        </AlertDescription>
                    </Alert>
                ) : null}
                <TabsContent
                    value="prepare"
                    forceMount
                    className="flex flex-col gap-3 data-[state=inactive]:hidden"
                >
                    <DmKodUtilisation
                        companyId={companyId}
                        enabled={enabled && !reportBusy}
                        onPrepared={() => setView("reports")}
                        onBusyChange={setPreparationBusy}
                    />
                    <Button
                        variant="outline"
                        className="self-start text-left whitespace-normal"
                        onClick={() => setView("reports")}
                    >
                        {t("dmkod.application.existingPreparation")}
                    </Button>
                </TabsContent>
                <TabsContent
                    value="reports"
                    forceMount
                    className="data-[state=inactive]:hidden"
                >
                    <DmKodReports
                        companyId={companyId}
                        enabled={enabled && !preparationBusy}
                        onStepChange={setReportStep}
                        onBusyChange={setReportBusy}
                    />
                </TabsContent>
                <TabsContent value="history">
                    <DmKodUtilisationHistory companyId={companyId} />
                </TabsContent>
            </Tabs>
        </div>
    );
}
