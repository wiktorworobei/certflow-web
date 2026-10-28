import { useQuery } from "@tanstack/react-query";
import {
    ArrowLeft,
    CalendarDays,
    CircleAlert,
    MoreHorizontal,
    UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { DmKodApiTools } from "@marking/components/dmkod/dmkod-api-tools";
import { DmKodOrderActivity } from "@marking/components/dmkod/dmkod-order-activity";
import { DmKodOrderOperations } from "@marking/components/dmkod/dmkod-order-operations";
import { DmKodReports } from "@marking/components/dmkod/dmkod-reports";
import { useDmKodScope } from "@marking/components/dmkod/dmkod-scope-context";
import { Alert, AlertDescription, AlertTitle } from "@marking/components/ui/alert";
import { Badge } from "@marking/components/ui/badge";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@marking/components/ui/breadcrumb";
import { Button } from "@marking/components/ui/button";
import {
    Card,
    CardAction,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@marking/components/ui/card";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@marking/components/ui/dropdown-menu";
import { Separator } from "@marking/components/ui/separator";
import { Skeleton } from "@marking/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@marking/components/ui/tabs";
import { dmKodKeys, useDmKodOrder, useDmKodSession } from "@marking/hooks/use-dmkod";
import { useDmKodCabinetLabels } from "@marking/hooks/use-dmkod-cabinet-labels";
import { dmKodExtendedApi } from "@marking/lib/api/dmkod-extended";
import { dmKodWorkflowApi } from "@marking/lib/api/dmkod-workflow";
import {
    dmKodReportOperationStorageKey,
    readDmKodReportOperation,
} from "@marking/lib/dmkod-report-operation";
import { dmKodScopeKey, dmKodScopeStorageKey } from "@marking/lib/dmkod-scope";

import type { DmKodDictionaryOption } from "@marking/lib/dmkod-types";

const sectionNames = [
    "codes",
    "validation",
    "utilisation",
    "aggregation",
    "requests",
    "reports",
] as const;
type Section =
    | (typeof sectionNames)[number]
    | "tools"
    | "utilisation"
    | "aggregation";
export function DmKodOrderWorkspace({
    companyId,
    orderId,
    enabled,
    flags = [],
    releaseMethods = [],
    onBack,
    hideBreadcrumb = false,
}: {
    companyId: string;
    orderId: number;
    enabled: boolean;
    flags?: DmKodDictionaryOption[];
    releaseMethods?: DmKodDictionaryOption[];
    onBack: () => void;
    hideBreadcrumb?: boolean;
}) {
    const { t, i18n } = useTranslation();
    const scope = useDmKodScope(companyId);
    const labels = useDmKodCabinetLabels(companyId, enabled);
    const details = useDmKodOrder(scope, orderId);
    const session = useDmKodSession(scope).data;
    const profile = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "extended-profile"],
        queryFn: () => dmKodExtendedApi.read(scope, { method: "Profile" }),
        enabled: enabled && session?.externalRole !== "SERVICE",
        retry: false,
    });
    const defaults = profile.data?.profile?.defaults ?? [
        "ORDER_SHOW_VALIDATION",
        "ORDER_SHOW_UTILISATION",
    ];
    const sections = sectionNames.filter(
        (name) =>
            (name !== "validation" && name !== "aggregation") ||
            defaults.includes(`ORDER_SHOW_${name.toUpperCase()}`),
    );
    const [section, setSection] = useState<Section>(() =>
        sessionStorage.getItem(
            `dmkod.request-sign.${dmKodScopeKey(scope)}.${orderId}`,
        )
            ? "requests"
            : (readDmKodReportOperation(
                    sessionStorage.getItem(
                        dmKodReportOperationStorageKey(scope, orderId),
                    ),
                    orderId,
                ) ??
                readDmKodReportOperation(
                    sessionStorage.getItem(
                        dmKodScopeStorageKey(scope, "reports"),
                    ),
                    orderId,
                ))
              ? "reports"
              : "codes",
    );
    const [generateSignal, setGenerateSignal] = useState(0);
    const [codeBusy, setCodeBusy] = useState(false);
    const [preparationBusy, setPreparationBusy] = useState(false);
    const [reportBusy, setReportBusy] = useState(false);
    const [markingBusy, setMarkingBusy] = useState(false);
    const [markingCategory, setMarkingCategory] = useState<
        "validation" | "aggregation"
    >("validation");
    const busy = codeBusy || preparationBusy || reportBusy || markingBusy;
    const number = (value: number) =>
        new Intl.NumberFormat(i18n.language).format(value);
    const order = details.data?.order;
    const requests = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "code-requests", orderId],
        queryFn: () => dmKodWorkflowApi.requests(scope, orderId),
        enabled: enabled && !!order,
        retry: false,
    });
    const extraSection = sections.includes(
        section as (typeof sectionNames)[number],
    )
        ? null
        : section;
    const chooseSection = (value: Section) => {
        setSection(value);
        if (value === "validation" || value === "aggregation")
            setMarkingCategory(value);
    };
    const codePanelVisible = ["codes", "requests", "tools"].includes(section);
    useEffect(() => {
        window.scrollTo({ top: 0 });
    }, []);
    return (
        <div
            data-dmkod-order-workspace
            className="mx-auto flex w-full max-w-7xl flex-col gap-3"
        >
            {!hideBreadcrumb ? (
                <Breadcrumb>
                    <BreadcrumbList>
                        <BreadcrumbItem>
                            <BreadcrumbLink asChild>
                                <Button
                                    variant="link"
                                    disabled={busy}
                                    onClick={onBack}
                                >
                                    <ArrowLeft
                                        data-icon="inline-start"
                                        aria-hidden="true"
                                    />
                                    {t("dmkod.orderLayout.orders")}
                                </Button>
                            </BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            <BreadcrumbPage>
                                {t("dmkod.reports.order", { id: orderId })}
                            </BreadcrumbPage>
                        </BreadcrumbItem>
                    </BreadcrumbList>
                </Breadcrumb>
            ) : null}
            {details.isLoading ? (
                <Skeleton className="mx-auto h-32 w-full max-w-4xl" />
            ) : null}
            {details.isError ? (
                <Alert variant="destructive">
                    <CircleAlert aria-hidden="true" />
                    <AlertTitle>
                        {t("dmkod.orders.details.loadFailed")}
                    </AlertTitle>
                    <AlertDescription>
                        <Button
                            variant="outline"
                            onClick={() => void details.refetch()}
                        >
                            {t("common.retry")}
                        </Button>
                    </AlertDescription>
                </Alert>
            ) : null}
            {order ? (
                <>
                    <Card
                        data-flag={order.flag}
                        className="dmkod-order-card mx-auto w-full max-w-4xl gap-0 py-3"
                    >
                        <CardHeader className="flex flex-col gap-1 px-4 pb-2 sm:grid">
                            <CardTitle
                                role="heading"
                                aria-level={1}
                                className="text-base break-words sm:text-lg"
                            >
                                {order.participant?.name ||
                                    t("dmkod.orders.noParticipant")}
                            </CardTitle>
                            <CardDescription className="text-xs break-all">
                                {order.attributes.productionOrderId ||
                                    t("dmkod.reports.order", { id: order.id })}
                            </CardDescription>
                            <CardAction className="flex flex-wrap items-center gap-2">
                                {order.attributes.releaseMethodType ? (
                                    <Badge variant="outline">
                                        {releaseMethods.find(
                                            (option) =>
                                                option.value ===
                                                order.attributes
                                                    .releaseMethodType,
                                        )?.label ||
                                            order.attributes.releaseMethodType}
                                    </Badge>
                                ) : null}
                                <Badge className="dmkod-order-status">
                                    {flags.find(
                                        (option) => option.value === order.flag,
                                    )?.label || order.flag}
                                </Badge>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="size-8"
                                            disabled={busy}
                                            aria-label={t(
                                                "dmkod.orderLayout.orderActions",
                                            )}
                                        >
                                            <MoreHorizontal aria-hidden="true" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent
                                        align="end"
                                        className="integration-theme dmkod-theme"
                                    >
                                        <DropdownMenuItem
                                            onSelect={() =>
                                                chooseSection("tools")
                                            }
                                        >
                                            {t(
                                                "dmkod.orderLayout.orderActions",
                                            )}
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </CardAction>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2 px-4">
                            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                                <span className="flex flex-wrap items-center gap-2">
                                    #{order.id}
                                    <UserRound
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    <span className="min-w-0 break-words">
                                        {order.user?.displayName ||
                                            order.user?.username}
                                    </span>
                                </span>
                                {order.createdAtUtc ? (
                                    <span className="flex items-center gap-2">
                                        <CalendarDays
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                        {new Intl.DateTimeFormat(
                                            i18n.language,
                                            {
                                                dateStyle: "medium",
                                                timeStyle: "short",
                                            },
                                        ).format(new Date(order.createdAtUtc))}
                                    </span>
                                ) : null}
                            </div>
                            <Separator />
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div className="flex flex-wrap gap-2">
                                    {order.productGroups.map((group) => (
                                        <Badge
                                            key={group}
                                            variant="secondary"
                                            className="max-w-full break-all whitespace-normal"
                                        >
                                            {labels("PRODUCT_GROUP", group)}
                                        </Badge>
                                    ))}
                                </div>
                                <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                                    <span>
                                        <strong className="mr-1 text-xl font-medium text-foreground tabular-nums">
                                            {number(order.itemsCount)}
                                        </strong>
                                        {t("dmkod.orderLayout.positionsLabel", {
                                            count: order.itemsCount,
                                        })}
                                    </span>
                                    <span>
                                        <strong className="mr-1 text-xl font-medium text-foreground tabular-nums">
                                            {number(order.itemsQuantity)}
                                        </strong>
                                        {t("dmkod.orderLayout.codesLabel", {
                                            count: order.itemsQuantity,
                                        })}
                                    </span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                    <Tabs
                        value={section}
                        onValueChange={(value) =>
                            chooseSection(value as Section)
                        }
                        className="flex flex-col gap-3"
                    >
                        <TabsList
                            aria-label={t("dmkod.orderLayout.sections")}
                            className="mx-auto w-full max-w-4xl flex-wrap justify-start gap-1 bg-transparent p-0 group-data-[orientation=horizontal]/tabs:h-auto"
                        >
                            {sections.map((name) => (
                                <TabsTrigger
                                    key={name}
                                    id={`dmkod-order-tab-${name}`}
                                    aria-controls={
                                        name === "codes" || name === "requests"
                                            ? "dmkod-order-codes-panel"
                                            : name === "validation" ||
                                                name === "aggregation"
                                              ? "dmkod-order-marking-panel"
                                              : `dmkod-order-${name}-panel`
                                    }
                                    value={name}
                                    disabled={
                                        busy &&
                                        name !== section &&
                                        !(
                                            preparationBusy &&
                                            name === "utilisation" &&
                                            !codeBusy &&
                                            !reportBusy &&
                                            !markingBusy
                                        )
                                    }
                                    className={
                                        name === "requests"
                                            ? "h-auto min-h-9 flex-none sm:ml-auto"
                                            : "h-auto min-h-9 flex-none"
                                    }
                                >
                                    {t(`dmkod.orderLayout.tabs.${name}`)}
                                    {name === "requests" && requests.data ? (
                                        <span className="ml-1 text-xs tabular-nums">
                                            {number(
                                                requests.data.requests.length,
                                            )}
                                        </span>
                                    ) : null}
                                </TabsTrigger>
                            ))}
                            {extraSection ? (
                                <TabsTrigger
                                    value={extraSection}
                                    id={`dmkod-order-tab-${extraSection}`}
                                    aria-controls={
                                        extraSection === "utilisation"
                                            ? "dmkod-order-utilisation-panel"
                                            : extraSection === "aggregation" ||
                                                extraSection === "validation"
                                              ? "dmkod-order-marking-panel"
                                              : "dmkod-order-codes-panel"
                                    }
                                    className="h-auto min-h-9 flex-none"
                                >
                                    {t(
                                        extraSection === "tools"
                                            ? "dmkod.orderLayout.orderActions"
                                            : `dmkod.orderLayout.tabs.${extraSection}`,
                                    )}
                                </TabsTrigger>
                            ) : null}
                        </TabsList>
                        <TabsContent
                            value="codes"
                            forceMount
                            id="dmkod-order-codes-panel"
                            aria-labelledby={
                                section === "tools"
                                    ? undefined
                                    : `dmkod-order-tab-${section}`
                            }
                            aria-label={
                                section === "tools"
                                    ? t("dmkod.orderLayout.orderActions")
                                    : undefined
                            }
                            className={codePanelVisible ? "" : "hidden"}
                        >
                            {section === "tools" ? (
                                <p className="mb-4 text-sm text-muted-foreground">
                                    {t("dmkod.orderLayout.orderActionsHint")}
                                </p>
                            ) : null}
                            <DmKodOrderOperations
                                companyId={companyId}
                                orderId={order.id}
                                items={details.data!.items}
                                enabled={
                                    enabled &&
                                    !preparationBusy &&
                                    !reportBusy &&
                                    !markingBusy
                                }
                                panel={
                                    section === "tools"
                                        ? "tools"
                                        : section === "requests"
                                          ? "requests"
                                          : "codes"
                                }
                                onShowRequests={() => setSection("requests")}
                                onShowCodes={() => setSection("codes")}
                                onBusyChange={setCodeBusy}
                            />
                        </TabsContent>
                        <TabsContent
                            value="utilisation"
                            forceMount
                            id="dmkod-order-utilisation-panel"
                            aria-labelledby="dmkod-order-tab-utilisation"
                            className="data-[state=inactive]:hidden"
                        >
                            <DmKodOrderActivity
                                companyId={companyId}
                                orderId={orderId}
                                items={details.data!.items}
                                kind="utilisation"
                                enabled={
                                    enabled &&
                                    section === "utilisation" &&
                                    !codeBusy &&
                                    !reportBusy &&
                                    !markingBusy
                                }
                                onBusyChange={setPreparationBusy}
                                onGenerateReports={() => {
                                    setGenerateSignal((value) => value + 1);
                                    setSection("reports");
                                }}
                            />
                        </TabsContent>
                        <TabsContent
                            value="reports"
                            forceMount
                            id="dmkod-order-reports-panel"
                            aria-labelledby="dmkod-order-tab-reports"
                            className="data-[state=inactive]:hidden"
                        >
                            <DmKodReports
                                companyId={companyId}
                                fixedOrderId={orderId}
                                generateSignal={generateSignal}
                                enabled={
                                    enabled &&
                                    !codeBusy &&
                                    !preparationBusy &&
                                    !markingBusy
                                }
                                onBusyChange={setReportBusy}
                            />
                        </TabsContent>
                        {session ? (
                            <TabsContent
                                value="validation"
                                forceMount
                                id="dmkod-order-marking-panel"
                                aria-labelledby={`dmkod-order-tab-${markingCategory}`}
                                className={
                                    section === "validation" ||
                                    section === "aggregation"
                                        ? ""
                                        : "hidden"
                                }
                            >
                                {markingCategory === "validation" ? (
                                    <DmKodOrderActivity
                                        companyId={companyId}
                                        orderId={orderId}
                                        items={details.data!.items}
                                        kind="validation"
                                        enabled={
                                            enabled &&
                                            section === "validation" &&
                                            !codeBusy &&
                                            !preparationBusy &&
                                            !reportBusy
                                        }
                                        onBusyChange={setMarkingBusy}
                                        onGenerateReports={() =>
                                            setSection("reports")
                                        }
                                    />
                                ) : (
                                    <DmKodApiTools
                                        companyId={companyId}
                                        module="marking"
                                        category={markingCategory}
                                        orderId={orderId}
                                        session={session}
                                        enabled={
                                            enabled &&
                                            !codeBusy &&
                                            !preparationBusy &&
                                            !reportBusy
                                        }
                                        onBusyChange={setMarkingBusy}
                                    />
                                )}
                            </TabsContent>
                        ) : null}
                    </Tabs>
                </>
            ) : null}
        </div>
    );
}
