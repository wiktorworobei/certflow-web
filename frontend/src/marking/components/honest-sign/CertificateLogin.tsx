import { BadgeCheck, KeyRound, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Select } from "@marking/components/honest-sign/ui/select";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@marking/components/ui/card";
import { Label } from "@marking/components/ui/label";
import { cn } from "@marking/lib/utils";

import type {
    CertificateOption,
    StatusVariant,
} from "@marking/components/honest-sign/types";

type CertificateLoginProps = {
    certificates: CertificateOption[];
    selectedThumbprint: string;
    loadingCertificates: boolean;
    connecting: boolean;
    statusMessage: string;
    statusVariant: StatusVariant;
    onCertificateChange: (thumbprint: string) => void;
    onReload: () => void;
    onConnect: () => void;
};

export function CertificateLogin({
    certificates,
    selectedThumbprint,
    loadingCertificates,
    connecting,
    statusMessage,
    statusVariant,
    onCertificateChange,
    onReload,
    onConnect,
}: CertificateLoginProps) {
    const { t } = useTranslation();
    const hasCertificates = certificates.length > 0;

    return (
        <div className="flex min-h-[calc(100svh-7rem)] items-center justify-center p-2 md:p-4">
            <Card className="w-full max-w-xl gap-0 overflow-hidden border-t-4 border-t-primary py-0">
                <CardHeader className="border-b bg-muted/30 py-5">
                    <p className="text-xs font-medium tracking-wide text-muted-foreground">
                        {t("honestSign.systemLabel")}
                    </p>
                    <div className="mt-1 mb-2 flex items-center gap-2 text-primary">
                        <KeyRound className="size-5" aria-hidden="true" />
                        <Badge variant="secondary">
                            {t("honestSign.certificateLogin.badge")}
                        </Badge>
                    </div>
                    <CardTitle className="text-xl">
                        {t("honestSign.certificateLogin.title")}
                    </CardTitle>
                    <CardDescription>
                        {t("honestSign.certificateLogin.description")}
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5 py-6">
                    {loadingCertificates ? (
                        <Notice variant="info">
                            {t("honestSign.certificateLogin.loading")}
                        </Notice>
                    ) : null}
                    {!loadingCertificates && !hasCertificates ? (
                        <Notice variant="warning">
                            {t("honestSign.certificateLogin.empty")}
                        </Notice>
                    ) : null}
                    <div className="space-y-2">
                        <Label htmlFor="honest-sign-certificate">
                            {t("honestSign.certificateLogin.certificate")}
                        </Label>
                        <Select
                            id="honest-sign-certificate"
                            value={selectedThumbprint}
                            onChange={(event) =>
                                onCertificateChange(event.target.value)
                            }
                            disabled={
                                loadingCertificates ||
                                connecting ||
                                !hasCertificates
                            }
                        >
                            <option value="">
                                {hasCertificates
                                    ? t(
                                          "honestSign.certificateLogin.selectPlaceholder",
                                      )
                                    : t(
                                          "honestSign.certificateLogin.noCertificates",
                                      )}
                            </option>
                            {certificates.map((option) => (
                                <option key={option.value} value={option.value}>
                                    {option.label}
                                </option>
                            ))}
                        </Select>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                        <Button
                            variant="outline"
                            onClick={onReload}
                            disabled={loadingCertificates || connecting}
                        >
                            <RefreshCw
                                className={cn(
                                    "size-4",
                                    loadingCertificates && "animate-spin",
                                )}
                                aria-hidden="true"
                            />
                            {t("honestSign.certificateLogin.reload")}
                        </Button>
                        <Button
                            onClick={onConnect}
                            disabled={
                                loadingCertificates ||
                                connecting ||
                                !selectedThumbprint
                            }
                        >
                            <BadgeCheck className="size-4" aria-hidden="true" />
                            {connecting
                                ? t("honestSign.certificateLogin.connecting")
                                : t("honestSign.certificateLogin.submit")}
                        </Button>
                    </div>
                    {statusMessage ? (
                        <Notice variant={statusVariant} role="status">
                            {statusMessage}
                        </Notice>
                    ) : null}
                </CardContent>
            </Card>
        </div>
    );
}
