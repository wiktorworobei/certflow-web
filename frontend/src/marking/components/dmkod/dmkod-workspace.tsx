import { zodResolver } from "@hookform/resolvers/zod";
import { isAxiosError } from "axios";
import {
    BadgeCheck,
    CircleAlert,
    House,
    Globe,
    SunMoon,
    ChevronRight,
    LoaderCircle,
    LockKeyhole,
    PlugZap,
    RefreshCw,
} from "lucide-react";
import { useTheme } from "@marking/lib/theme";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { z } from "zod";
import { DmKodAuthActions } from "@marking/components/dmkod/dmkod-auth-actions";
import { DmKodHome } from "@marking/components/dmkod/dmkod-home";
import { DmKodOrderOperations } from "@marking/components/dmkod/dmkod-order-operations";
import { DmKodOrders } from "@marking/components/dmkod/dmkod-orders";
import { DmKodPoas } from "@marking/components/dmkod/dmkod-poas";
import {
    useDmKodBusy,
    useDmKodScope,
} from "@marking/components/dmkod/dmkod-scope-context";
import { DmKodSettings } from "@marking/components/dmkod/dmkod-settings";
import { Alert, AlertDescription, AlertTitle } from "@marking/components/ui/alert";
import { Badge } from "@marking/components/ui/badge";
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
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@marking/components/ui/dropdown-menu";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@marking/components/ui/form";
import { Input } from "@marking/components/ui/input";
import { Label } from "@marking/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@marking/components/ui/select";
import { Skeleton } from "@marking/components/ui/skeleton";
import {
    WorkspacePage,
    WorkspaceHeader,
} from "@marking/components/workspace/workspace";
import {
    useDmKodChangePassword,
    useDmKodConnectHonestSign,
    useDmKodConnection,
    useDmKodDisconnect,
    useDmKodSession,
    useDmKodSessionReentry,
    useDmKodSignIn,
} from "@marking/hooks/use-dmkod";
import { cryptoProSignatureService } from "@marking/lib/honest-sign/cryptoProSignatureService";

import type { CertificateSummary } from "@marking/lib/honest-sign/types";

type DmKodWorkspaceProps = {
    companyId: string;
};

export function DmKodWorkspace({ companyId }: DmKodWorkspaceProps) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const sessionQuery = useDmKodSession(scope);
    const requiresSignIn = useDmKodSessionReentry(scope);
    const session = sessionQuery.data;

    return (
        <WorkspacePage className="group/dmkod-workspace">
            <WorkspaceHeader
                className="group-has-[[data-dmkod-order-workspace]]/dmkod-workspace:hidden"
                title={t("dmkod.title")}
                description={t("dmkod.description")}
            />

            {!requiresSignIn && sessionQuery.isLoading ? (
                <WorkspaceSkeleton />
            ) : null}
            {requiresSignIn || (session && !session.hasDmKodSession) ? (
                <DmKodLogin companyId={companyId} />
            ) : null}
            {!requiresSignIn && session?.hasDmKodSession ? (
                <ConnectedWorkspace companyId={companyId} session={session} />
            ) : null}
        </WorkspacePage>
    );
}

function DmKodLogin({ companyId }: DmKodWorkspaceProps) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const signIn = useDmKodSignIn(scope);
    const schema = useMemo(
        () =>
            z.object({
                username: z
                    .string()
                    .trim()
                    .min(1, t("dmkod.login.usernameRequired"))
                    .max(150, t("dmkod.login.usernameTooLong")),
                password: z
                    .string()
                    .min(1, t("dmkod.login.passwordRequired"))
                    .max(512, t("dmkod.login.passwordTooLong")),
            }),
        [t],
    );
    type LoginValues = z.infer<typeof schema>;
    const form = useForm<LoginValues>({
        resolver: zodResolver(schema),
        defaultValues: { username: "", password: "" },
    });

    const submit = form.handleSubmit(async (values) => {
        try {
            await signIn.mutateAsync(values);
            form.reset({ username: values.username, password: "" });
            toast.success(t("dmkod.login.success"));
        } catch (error) {
            form.setValue("password", "");
            form.setError("password", {
                message: errorMessage(error, t("dmkod.errors.signIn")),
            });
        }
    });

    return (
        <div className="flex min-h-[min(34rem,calc(100svh-12rem))] items-center justify-center py-4">
            <Card className="w-full max-w-md gap-0 overflow-hidden py-0">
                <CardHeader className="py-5">
                    <div className="flex items-center justify-between gap-2">
                        <CardTitle className="text-xl uppercase">
                            {t("dmkod.login.title")}
                        </CardTitle>
                        <DmKodAppearanceControls />
                    </div>
                    <CardDescription>
                        {t("dmkod.login.description")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 py-6">
                    <Form {...form}>
                        <form
                            className="space-y-4"
                            onSubmit={submit}
                            noValidate
                        >
                            <FormField
                                control={form.control}
                                name="username"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t("dmkod.login.username")}
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                autoComplete="username"
                                                disabled={signIn.isPending}
                                                autoFocus
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="password"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center justify-between gap-2">
                                            <FormLabel>
                                                {t("dmkod.login.password")}
                                            </FormLabel>
                                            <DmKodAuthActions
                                                companyId={companyId}
                                                trigger="reset"
                                            />
                                        </div>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                type="password"
                                                autoComplete="current-password"
                                                disabled={signIn.isPending}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <Button
                                className="w-full"
                                type="submit"
                                disabled={signIn.isPending}
                            >
                                {signIn.isPending ? (
                                    <LoaderCircle
                                        className="animate-spin"
                                        aria-hidden="true"
                                    />
                                ) : null}
                                {signIn.isPending
                                    ? t("dmkod.login.submitting")
                                    : t("dmkod.login.submit")}
                            </Button>
                        </form>
                    </Form>
                    <div className="flex flex-wrap items-center justify-center gap-1 text-sm">
                        <span className="text-muted-foreground">
                            {t("dmkod.cabinet.noAccount")}
                        </span>
                        <DmKodAuthActions
                            companyId={companyId}
                            trigger="register"
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}

function ConnectedWorkspace({
    companyId,
    session,
}: DmKodWorkspaceProps & {
    session: NonNullable<ReturnType<typeof useDmKodSession>["data"]>;
}) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const busy = useDmKodBusy();
    const disconnect = useDmKodDisconnect(scope);
    const [page, setPage] = useState<"home" | "orders" | "poas" | "settings">(
        "home",
    );
    const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
    const isServiceProvider =
        session.externalCompanyType?.toUpperCase() === "SERVICEPROVIDER";
    const handleDisconnect = async () => {
        try {
            await disconnect.mutateAsync();
            toast.success(t("dmkod.session.disconnected"));
        } catch (error) {
            toast.error(errorMessage(error, t("dmkod.errors.disconnect")));
        }
    };
    if (session.requiresPasswordChange)
        return <TemporaryPasswordForm companyId={companyId} />;
    return (
        <div className="space-y-3">
            <header className="flex flex-wrap items-center justify-between gap-2">
                <nav
                    aria-label={t("dmkod.tabs.label")}
                    className="flex items-center gap-2 text-sm"
                >
                    <Button
                        variant="ghost"
                        size="icon"
                        disabled={busy}
                        onClick={() => {
                            setSelectedOrderId(null);
                            setPage(isServiceProvider ? "home" : "settings");
                        }}
                        aria-label={t("dmkod.cabinet.home")}
                    >
                        <House className="size-4" aria-hidden="true" />
                    </Button>
                    {page !== "home" ? (
                        <ChevronRight
                            className="size-4 text-muted-foreground"
                            aria-hidden="true"
                        />
                    ) : null}
                    {page === "orders" && selectedOrderId ? (
                        <>
                            <Button
                                variant="link"
                                className="h-auto px-0"
                                disabled={busy}
                                onClick={() => setSelectedOrderId(null)}
                            >
                                {t("dmkod.cabinet.orders")}
                            </Button>
                            <ChevronRight
                                className="size-4 text-muted-foreground"
                                aria-hidden="true"
                            />
                            <span>
                                {t("dmkod.reports.order", {
                                    id: selectedOrderId,
                                })}
                            </span>
                        </>
                    ) : (
                        <span>
                            {t(
                                `dmkod.cabinet.${isServiceProvider ? page : "settings"}`,
                            )}
                        </span>
                    )}
                </nav>
                <div className="ml-auto flex items-center gap-1">
                    <DmKodAppearanceControls />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="outline"
                                disabled={busy || disconnect.isPending}
                            >
                                {session.displayName ||
                                    session.username ||
                                    "DMKOD"}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent
                            align="end"
                            className="integration-theme dmkod-theme"
                        >
                            {isServiceProvider ? (
                                <>
                                    <DropdownMenuItem
                                        onSelect={() => {
                                            setSelectedOrderId(null);
                                            setPage("orders");
                                        }}
                                    >
                                        {t("dmkod.cabinet.orders")}
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onSelect={() => setPage("poas")}
                                    >
                                        {t("dmkod.cabinet.poas")}
                                    </DropdownMenuItem>
                                </>
                            ) : null}
                            <DropdownMenuItem
                                onSelect={() => setPage("settings")}
                            >
                                {t("dmkod.cabinet.settings")}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                onSelect={() => void handleDisconnect()}
                            >
                                {t("dmkod.cabinet.logout")}
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>
            {isServiceProvider && page === "home" ? (
                <DmKodHome companyId={companyId} onNavigate={setPage} />
            ) : null}
            {isServiceProvider ? (
                <div hidden={page !== "orders"}>
                    <DmKodOrders
                        companyId={companyId}
                        enabled={page === "orders"}
                        selectedOrderId={selectedOrderId}
                        onOrderChange={setSelectedOrderId}
                    />
                </div>
            ) : null}
            {isServiceProvider && page === "poas" ? (
                <DmKodPoas companyId={companyId} />
            ) : null}
            {page === "settings" || !isServiceProvider ? (
                <DmKodSettings companyId={companyId} session={session} />
            ) : null}
        </div>
    );
}

export function TemporaryPasswordForm({
    companyId,
    temporary = true,
    embedded = false,
}: DmKodWorkspaceProps & { temporary?: boolean; embedded?: boolean }) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const changePassword = useDmKodChangePassword(scope);
    const schema = useMemo(
        () =>
            z
                .object({
                    currentPassword: z
                        .string()
                        .min(1, t("dmkod.password.currentRequired"))
                        .max(512),
                    newPassword: z
                        .string()
                        .min(8, t("dmkod.password.newTooShort"))
                        .max(512),
                    confirmation: z.string(),
                })
                .refine(
                    (values) => values.newPassword === values.confirmation,
                    {
                        path: ["confirmation"],
                        message: t("dmkod.password.mismatch"),
                    },
                ),
        [t],
    );
    type PasswordValues = z.infer<typeof schema>;
    const form = useForm<PasswordValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            currentPassword: "",
            newPassword: "",
            confirmation: "",
        },
    });
    const submit = form.handleSubmit(async (values) => {
        try {
            await changePassword.mutateAsync({
                currentPassword: values.currentPassword,
                newPassword: values.newPassword,
            });
            form.reset();
            toast.success(t("dmkod.password.success"));
        } catch (error) {
            form.reset();
            form.setError("currentPassword", {
                message: errorMessage(error, t("dmkod.errors.password")),
            });
        }
    });

    return (
        <Card
            className={
                embedded
                    ? "gap-0 border-0 bg-transparent py-0 shadow-none"
                    : undefined
            }
        >
            {!embedded ? (
                <CardHeader>
                    <CardTitle>
                        {t(
                            temporary
                                ? "dmkod.password.title"
                                : "dmkod.extended.passwordTitle",
                        )}
                    </CardTitle>
                    <CardDescription>
                        {t(
                            temporary
                                ? "dmkod.password.description"
                                : "dmkod.extended.passwordHint",
                        )}
                    </CardDescription>
                </CardHeader>
            ) : null}
            <CardContent className={embedded ? "px-0" : undefined}>
                <Form {...form}>
                    <form className="grid gap-4" onSubmit={submit} noValidate>
                        {(
                            [
                                [
                                    "currentPassword",
                                    "current",
                                    "current-password",
                                ],
                                ["newPassword", "new", "new-password"],
                                [
                                    "confirmation",
                                    "confirmation",
                                    "new-password",
                                ],
                            ] as const
                        ).map(([name, label, autoComplete]) => (
                            <FormField
                                key={name}
                                control={form.control}
                                name={name}
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>
                                            {t(
                                                !temporary &&
                                                    label === "current"
                                                    ? "dmkod.extended.fields.password"
                                                    : `dmkod.password.${label}`,
                                            )}
                                        </FormLabel>
                                        <FormControl>
                                            <Input
                                                {...field}
                                                type="password"
                                                autoComplete={autoComplete}
                                                disabled={
                                                    changePassword.isPending
                                                }
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        ))}
                        <Button
                            type="submit"
                            disabled={changePassword.isPending}
                        >
                            {changePassword.isPending ? (
                                <LoaderCircle
                                    className="animate-spin"
                                    aria-hidden="true"
                                />
                            ) : (
                                <LockKeyhole aria-hidden="true" />
                            )}
                            {t(
                                temporary
                                    ? "dmkod.password.submit"
                                    : "dmkod.cabinet.changePassword",
                            )}
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}

export function DmKodConnection({
    companyId,
    sessionCertificate,
    isServiceProvider,
    connection,
}: {
    companyId: string;
    sessionCertificate: string | null;
    isServiceProvider: boolean;
    connection: ReturnType<typeof useDmKodConnection>;
}) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const connect = useDmKodConnectHonestSign(scope);
    const [certificates, setCertificates] = useState<CertificateSummary[]>([]);
    const [thumbprint, setThumbprint] = useState(sessionCertificate ?? "");
    const [loadingCertificates, setLoadingCertificates] = useState(false);
    const [certificateError, setCertificateError] = useState<string | null>(
        null,
    );

    const loadCertificates = async () => {
        setLoadingCertificates(true);
        setCertificateError(null);
        try {
            const available =
                await cryptoProSignatureService.getUserCertificates();
            setCertificates(available);
            setThumbprint(
                (current) => current || available[0]?.thumbprint || "",
            );
        } catch (error) {
            setCertificateError(
                errorMessage(error, t("dmkod.errors.certificates")),
            );
        } finally {
            setLoadingCertificates(false);
        }
    };

    const handleConnect = async () => {
        if (!thumbprint) return;
        try {
            await connect.mutateAsync(thumbprint);
            toast.success(t("dmkod.connection.success"));
        } catch (error) {
            toast.error(errorMessage(error, t("dmkod.errors.connection")));
        }
    };

    const connected = connection.data?.connected === true;
    return (
        <Card>
            <CardHeader>
                <CardTitle>{t("dmkod.connection.title")}</CardTitle>
                <CardDescription>
                    {t("dmkod.connection.description")}
                </CardDescription>
                <CardAction>
                    <Badge variant={connected ? "secondary" : "outline"}>
                        {connected ? (
                            <BadgeCheck aria-hidden="true" />
                        ) : (
                            <PlugZap aria-hidden="true" />
                        )}
                        {connection.isLoading
                            ? t("dmkod.connection.checking")
                            : connected
                              ? t("dmkod.connection.connected")
                              : t("dmkod.connection.notConnected")}
                    </Badge>
                </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
                {!isServiceProvider ? (
                    <Alert>
                        <CircleAlert aria-hidden="true" />
                        <AlertTitle>
                            {t("dmkod.connection.serviceProviderOnlyTitle")}
                        </AlertTitle>
                        <AlertDescription>
                            {t("dmkod.connection.serviceProviderOnly")}
                        </AlertDescription>
                    </Alert>
                ) : null}
                {connection.isError ? (
                    <Alert>
                        <CircleAlert aria-hidden="true" />
                        <AlertTitle>
                            {t("dmkod.connection.checkFailed")}
                        </AlertTitle>
                        <AlertDescription>
                            {errorMessage(
                                connection.error,
                                t("dmkod.errors.ping"),
                            )}
                        </AlertDescription>
                    </Alert>
                ) : null}

                {isServiceProvider && !connected ? (
                    <div className="space-y-3 border-t pt-4">
                        <div className="space-y-2">
                            <Label htmlFor="dmkod-certificate">
                                {t("dmkod.connection.certificate")}
                            </Label>
                            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                                <Select
                                    value={thumbprint}
                                    onValueChange={setThumbprint}
                                    disabled={
                                        loadingCertificates || connect.isPending
                                    }
                                >
                                    <SelectTrigger id="dmkod-certificate">
                                        <SelectValue
                                            placeholder={t(
                                                "dmkod.connection.selectCertificate",
                                            )}
                                        />
                                    </SelectTrigger>
                                    <SelectContent className="integration-theme dmkod-theme">
                                        {certificates.map((certificate) => (
                                            <SelectItem
                                                key={certificate.thumbprint}
                                                value={certificate.thumbprint}
                                            >
                                                {certificate.name ||
                                                    certificate.subjectName}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={loadCertificates}
                                    disabled={
                                        loadingCertificates || connect.isPending
                                    }
                                >
                                    <RefreshCw
                                        className={
                                            loadingCertificates
                                                ? "animate-spin"
                                                : undefined
                                        }
                                        aria-hidden="true"
                                    />
                                    {t("dmkod.connection.loadCertificates")}
                                </Button>
                            </div>
                            {certificateError ? (
                                <p
                                    className="text-sm text-destructive"
                                    role="alert"
                                >
                                    {certificateError}
                                </p>
                            ) : null}
                            <p className="text-sm text-muted-foreground">
                                {t("dmkod.connection.signatureHint")}
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                onClick={handleConnect}
                                disabled={!thumbprint || connect.isPending}
                            >
                                {connect.isPending ? (
                                    <LoaderCircle
                                        className="animate-spin"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <PlugZap aria-hidden="true" />
                                )}
                                {t("dmkod.connection.connect")}
                            </Button>
                            <Button
                                variant="outline"
                                onClick={() => void connection.refetch()}
                                disabled={connection.isFetching}
                            >
                                <RefreshCw aria-hidden="true" />
                                {t("dmkod.connection.checkAgain")}
                            </Button>
                        </div>
                    </div>
                ) : isServiceProvider ? (
                    <p className="text-sm text-muted-foreground">
                        {t("dmkod.connection.ready")}
                    </p>
                ) : null}
                <DmKodOrderOperations
                    companyId={companyId}
                    orderId={0}
                    synchronization="poas"
                    enabled={isServiceProvider && connected}
                />
            </CardContent>
        </Card>
    );
}

function WorkspaceSkeleton() {
    return (
        <Card aria-busy="true" aria-label="Loading DMkod">
            <CardHeader>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-72 max-w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-full" />
                <Skeleton className="h-9 w-32" />
            </CardContent>
        </Card>
    );
}

function errorMessage(error: unknown, fallback: string): string {
    if (isAxiosError<{ message?: string }>(error))
        return error.response?.data?.message || fallback;
    return error instanceof Error && error.message ? error.message : fallback;
}

function DmKodAppearanceControls() {
    const { t } = useTranslation();
    const { setTheme } = useTheme();
    return (
        <div className="flex items-center gap-1">
            {" "}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label={t("header.theme")}
                    >
                        <SunMoon className="size-4" aria-hidden="true" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    align="end"
                    className="integration-theme dmkod-theme"
                >
                    {["light", "dark", "system"].map((theme) => (
                        <DropdownMenuItem
                            key={theme}
                            onSelect={() => setTheme(theme)}
                        >
                            {t(`dmkod.cabinet.themes.${theme}`)}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>{" "}
            <DmKodLanguageControl />
        </div>
    );
}

function DmKodLanguageControl() {
    const { i18n } = useTranslation();
    return (
        <DmKodLanguageMenu
            onChange={(language) => void i18n.changeLanguage(language)}
        />
    );
}
function DmKodLanguageMenu({
    onChange,
}: {
    onChange: (language: "ru" | "en") => void;
}) {
    const { t } = useTranslation();
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t("header.language")}
                >
                    <Globe className="size-4" aria-hidden="true" />
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                className="integration-theme dmkod-theme"
            >
                {(["ru", "en"] as const).map((language) => (
                    <DropdownMenuItem
                        key={language}
                        onSelect={() => onChange(language)}
                    >
                        {t(`dmkod.cabinet.languages.${language}`)}
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
