import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogCardForm } from "@marking/components/honest-sign/CatalogCardForm";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Checkbox } from "@marking/components/ui/checkbox";
import { Label } from "@marking/components/ui/label";
import { Skeleton } from "@marking/components/ui/skeleton";
import { catalogKeys, useCatalogCard } from "@marking/hooks/use-honest-sign-catalog";
import { catalogApiService } from "@marking/lib/honest-sign/catalogApiService";
import { canEditCatalogFailure } from "@marking/lib/honest-sign/catalogForm";
import { cryptoProSignatureService } from "@marking/lib/honest-sign/cryptoProSignatureService";
import { getHttpErrorStatus } from "@marking/lib/honest-sign/httpClient";

import type { CatalogCategory } from "@marking/lib/honest-sign/catalogTypes";

export function CatalogCardWorkflow({
    companyId,
    submissionId,
    selectedThumbprint,
    categories,
}: {
    companyId: string;
    submissionId: string;
    selectedThumbprint: string;
    categories: CatalogCategory[];
}) {
    const { t } = useTranslation();
    const client = useQueryClient();
    const card = useCatalogCard(companyId, submissionId);
    const [editing, setEditing] = useState(false);
    const [publicationAgreement, setPublicationAgreement] = useState(false);
    const [confirmSign, setConfirmSign] = useState(false);
    const [providerChecked, setProviderChecked] = useState(false);
    const pending = useRef<string | null>(null);
    const inFlight = useRef(false);
    const invalidate = () =>
        client.invalidateQueries({ queryKey: catalogKeys.all(companyId) });
    const action = useMutation({
        retry: false,
        mutationFn: async (kind: "Moderate" | "Sign") => {
            try {
                if (pending.current) {
                    const previous = await catalogApiService.operation(
                        submissionId,
                        pending.current,
                    );
                    if (
                        previous &&
                        !["Sending", "Unknown", "Processing"].includes(
                            previous.state,
                        )
                    )
                        pending.current = null;
                    else
                        throw new Error(
                            t("honestSign.catalog.workflow.operationBlocked"),
                        );
                }
                if (kind === "Moderate") {
                    pending.current ??= crypto.randomUUID();
                    return await catalogApiService.moderate(
                        submissionId,
                        pending.current,
                    );
                }
                if (!confirmSign || !selectedThumbprint)
                    throw new Error(
                        t("honestSign.catalog.workflow.confirmSignFirst"),
                    );
                const data = await catalogApiService.signingData(
                    submissionId,
                    publicationAgreement,
                );
                const normalize = (value: string) =>
                    value.replace(/[^a-f0-9]/gi, "").toUpperCase();
                if (
                    normalize(data.certificateThumbprint) !==
                    normalize(selectedThumbprint)
                )
                    throw new Error(
                        t("honestSign.catalog.workflow.certificateMismatch"),
                    );
                const signature = await cryptoProSignatureService.signDetached({
                    thumbprint: selectedThumbprint,
                    message: data.xml,
                    cadesType: "bes",
                });
                pending.current ??= crypto.randomUUID();
                return await catalogApiService.sign(submissionId, {
                    requestId: pending.current,
                    preparationId: data.preparationId,
                    xml: data.xml,
                    payloadHash: data.payloadHash,
                    signature:
                        cryptoProSignatureService.normalizeDetachedSignature(
                            signature.pkcs7,
                        ),
                    certificateThumbprint: selectedThumbprint,
                    publicationAgreement,
                });
            } catch (error) {
                if (pending.current) {
                    const receipt = await catalogApiService.operation(
                        submissionId,
                        pending.current,
                    );
                    if (receipt) return receipt;
                    if (canEditCatalogFailure(getHttpErrorStatus(error), null))
                        pending.current = null;
                }
                throw error;
            }
        },
        onSuccess: (receipt) => {
            if (!["Sending", "Unknown", "Processing"].includes(receipt.state))
                pending.current = null;
            setConfirmSign(false);
        },
        onSettled: invalidate,
    });
    const check = useMutation({
        retry: false,
        mutationFn: async () => {
            const receipt = pending.current
                ? await catalogApiService.operation(
                      submissionId,
                      pending.current,
                  )
                : null;
            if (
                receipt &&
                !["Sending", "Unknown", "Processing"].includes(receipt.state)
            )
                pending.current = null;
            return receipt;
        },
        onSuccess: (receipt) => {
            if (
                receipt &&
                !["Sending", "Unknown", "Processing"].includes(receipt.state)
            )
                action.reset();
        },
        onSettled: invalidate,
    });
    const reconcile = useMutation({
        retry: false,
        mutationFn: () => {
            const operation = card.data?.blockingOperation;
            if (!providerChecked || !operation)
                throw new Error(
                    t("honestSign.catalog.workflow.confirmReconcile"),
                );
            return catalogApiService.reconcile(
                submissionId,
                operation.requestId,
            );
        },
        onSuccess: () => {
            pending.current = null;
            setProviderChecked(false);
            action.reset();
            check.reset();
        },
        onSettled: invalidate,
    });
    const run = (kind: "Moderate" | "Sign") => {
        if (inFlight.current) return;
        inFlight.current = true;
        check.reset();
        action.mutate(kind, {
            onSettled: () => {
                inFlight.current = false;
            },
        });
    };
    const busy = action.isPending || check.isPending || reconcile.isPending;
    const receipt = check.data ?? action.data;
    const uncertain = action.isError && Boolean(pending.current);
    const data = card.data;
    const blocking = data?.blockingOperation;
    const readyToReconcile =
        blocking &&
        Date.now() - new Date(blocking.createdAtUtc).getTime() >= 300_000;
    const error = action.error ?? check.error ?? reconcile.error;
    return (
        <section
            className="space-y-4 border-t pt-5"
            aria-label={t("honestSign.catalog.workflow.title")}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="font-semibold">
                    {t("honestSign.catalog.workflow.title")}
                </h3>
                <Button
                    variant="outline"
                    size="sm"
                    disabled={card.isFetching || busy}
                    onClick={() => void card.refetch()}
                >
                    {t("honestSign.catalog.refresh")}
                </Button>
            </div>
            {card.isPending ? (
                <Skeleton className="h-24 w-full" />
            ) : card.isError ? (
                <Notice variant="error" role="alert">
                    {card.error.message}
                </Notice>
            ) : (
                data && (
                    <>
                        <div className="flex flex-wrap gap-2 text-sm">
                            <span className="font-mono">{data.gtin}</span>
                            {data.detailedStatuses.map((state) => (
                                <Badge key={state} variant="outline">
                                    {t(
                                        `honestSign.catalog.workflow.cardStates.${state}`,
                                        {
                                            defaultValue: t(
                                                "honestSign.catalog.workflow.cardStates.unknown",
                                            ),
                                        },
                                    )}
                                </Badge>
                            ))}
                            <Badge variant="outline">
                                {t(
                                    data.canOrderCodes
                                        ? "honestSign.catalog.workflow.codesAllowed"
                                        : "honestSign.catalog.workflow.codesNotAllowed",
                                )}
                            </Badge>
                            <Badge variant="outline">
                                {t(
                                    data.canIntroduce
                                        ? "honestSign.catalog.workflow.turnAllowed"
                                        : "honestSign.catalog.workflow.turnNotAllowed",
                                )}
                            </Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                            {t("honestSign.catalog.workflow.statusNotice")}
                        </p>
                        {(blocking || uncertain) && (
                            <Notice>
                                <p>
                                    {t(
                                        "honestSign.catalog.workflow.operationBlocked",
                                    )}
                                </p>
                                <p className="mt-2 font-mono text-xs">
                                    {blocking?.requestId ?? pending.current}
                                </p>
                            </Notice>
                        )}
                        {error && (
                            <Notice variant="error" role="alert">
                                {error.message}
                            </Notice>
                        )}
                        {receipt && (
                            <Notice
                                variant={
                                    receipt.state === "Rejected"
                                        ? "error"
                                        : "info"
                                }
                            >
                                {t(
                                    `honestSign.catalog.workflow.operationStates.${receipt.state}`,
                                )}
                                {receipt.error ? ` · ${receipt.error}` : ""}
                            </Notice>
                        )}
                        {!data.isSigned &&
                            !data.canEdit &&
                            !data.canModerate &&
                            !data.canSign &&
                            !blocking && (
                                <Notice>
                                    {t("honestSign.catalog.workflow.notReady")}
                                </Notice>
                            )}
                        <div className="flex flex-wrap gap-3">
                            <Button
                                variant="outline"
                                disabled={
                                    !data.canEdit ||
                                    busy ||
                                    uncertain ||
                                    card.isFetching
                                }
                                onClick={() => setEditing(!editing)}
                            >
                                {t(
                                    editing
                                        ? "honestSign.catalog.workflow.cancelEdit"
                                        : "honestSign.catalog.workflow.edit",
                                )}
                            </Button>
                            <Button
                                disabled={
                                    !data.canModerate ||
                                    busy ||
                                    uncertain ||
                                    card.isFetching
                                }
                                onClick={() => run("Moderate")}
                            >
                                {t(
                                    "honestSign.catalog.workflow.sendModeration",
                                )}
                            </Button>
                            {pending.current && (
                                <Button
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() => check.mutate()}
                                >
                                    {t(
                                        "honestSign.catalog.workflow.checkReceipt",
                                    )}
                                </Button>
                            )}
                        </div>
                        {editing && data.draft && (
                            <div className="space-y-4 border-t pt-4">
                                <h4 className="font-semibold">
                                    {t("honestSign.catalog.workflow.edit")}
                                </h4>
                                <CatalogCardForm
                                    key={`${submissionId}-${data.goodId}`}
                                    companyId={companyId}
                                    categories={categories}
                                    initialCard={data.draft}
                                    submissionId={submissionId}
                                    onSubmitted={() => {}}
                                    onUpdated={() => {
                                        setEditing(false);
                                        void invalidate();
                                    }}
                                />
                            </div>
                        )}
                        {data.canSign && (
                            <div className="space-y-3 border-t pt-4">
                                <Label
                                    className="flex items-start gap-2"
                                    htmlFor="catalog-publication-agreement"
                                >
                                    <Checkbox
                                        id="catalog-publication-agreement"
                                        checked={publicationAgreement}
                                        disabled={busy || uncertain}
                                        onCheckedChange={(value) =>
                                            setPublicationAgreement(
                                                value === true,
                                            )
                                        }
                                    />
                                    {t(
                                        "honestSign.catalog.workflow.publicationAgreement",
                                    )}
                                </Label>
                                <Label
                                    className="flex items-start gap-2"
                                    htmlFor="catalog-confirm-sign"
                                >
                                    <Checkbox
                                        id="catalog-confirm-sign"
                                        checked={confirmSign}
                                        disabled={busy || uncertain}
                                        onCheckedChange={(value) =>
                                            setConfirmSign(value === true)
                                        }
                                    />
                                    {t(
                                        "honestSign.catalog.workflow.confirmSign",
                                    )}
                                </Label>
                                {!selectedThumbprint && (
                                    <Notice>
                                        {t(
                                            "honestSign.catalog.workflow.selectCertificate",
                                        )}
                                    </Notice>
                                )}
                                <Button
                                    disabled={
                                        !confirmSign ||
                                        !selectedThumbprint ||
                                        busy ||
                                        uncertain ||
                                        card.isFetching
                                    }
                                    onClick={() => run("Sign")}
                                >
                                    {t(
                                        "honestSign.catalog.workflow.signPublish",
                                    )}
                                </Button>
                            </div>
                        )}
                        {blocking && blocking.state !== "Processing" && (
                            <div className="space-y-3 border-t pt-4">
                                <p className="text-sm text-muted-foreground">
                                    {t(
                                        "honestSign.catalog.workflow.reconcileHelp",
                                    )}
                                </p>
                                <Label
                                    className="flex items-start gap-2"
                                    htmlFor="catalog-provider-checked"
                                >
                                    <Checkbox
                                        id="catalog-provider-checked"
                                        checked={providerChecked}
                                        disabled={busy || !readyToReconcile}
                                        onCheckedChange={(value) =>
                                            setProviderChecked(value === true)
                                        }
                                    />
                                    {t(
                                        "honestSign.catalog.workflow.confirmReconcile",
                                    )}
                                </Label>
                                <Button
                                    variant="outline"
                                    disabled={
                                        !readyToReconcile ||
                                        !providerChecked ||
                                        busy
                                    }
                                    onClick={() => reconcile.mutate()}
                                >
                                    {t("honestSign.catalog.workflow.reconcile")}
                                </Button>
                            </div>
                        )}
                    </>
                )
            )}
        </section>
    );
}
