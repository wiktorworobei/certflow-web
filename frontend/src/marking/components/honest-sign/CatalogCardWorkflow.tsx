import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogCardForm } from "@marking/components/honest-sign/CatalogCardForm";
import { CatalogErrorDetails } from "@marking/components/honest-sign/CatalogErrorDetails";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Checkbox } from "@marking/components/ui/checkbox";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@marking/components/ui/collapsible";
import { Input } from "@marking/components/ui/input";
import { Label } from "@marking/components/ui/label";
import { Skeleton } from "@marking/components/ui/skeleton";
import {
    catalogKeys,
    useCatalogCard,
    useCatalogFeedStatus,
} from "@marking/hooks/use-honest-sign-catalog";
import { catalogApiService } from "@marking/lib/honest-sign/catalogApiService";
import {
    canEditCatalogFailure,
    isCatalogFeedProcessing,
    isValidCatalogGtin,
} from "@marking/lib/honest-sign/catalogForm";
import {
    catalogActionAvailability,
    catalogWorkflowOutcome,
    recoverCatalogOperationFailure,
} from "@marking/lib/honest-sign/catalogWorkflowOutcome";
import { cryptoProSignatureService } from "@marking/lib/honest-sign/cryptoProSignatureService";
import { getHttpErrorStatus } from "@marking/lib/honest-sign/httpClient";
import { useAuthStore } from "@marking/src/store/auth";

import type {
    CatalogCategory,
    CatalogProductGroup,
} from "@marking/lib/honest-sign/catalogTypes";

export function CatalogCardWorkflow({
    companyId,
    submissionId,
    selectedThumbprint,
    categories,
    productGroups,
    showTitle = true,
    focusSigning = false,
    onDirtyChange,
    onBusyChange,
}: {
    companyId: string;
    submissionId: string;
    selectedThumbprint: string;
    categories?: CatalogCategory[];
    productGroups?: CatalogProductGroup[];
    showTitle?: boolean;
    focusSigning?: boolean;
    onDirtyChange?: (dirty: boolean) => void;
    onBusyChange?: (busy: boolean) => void;
}) {
    const { t } = useTranslation();
    const client = useQueryClient();
    const actorId = useAuthStore((state) => state.user?.id ?? "anonymous");
    const authVersion = useAuthStore((state) => state.version);
    const feed = useCatalogFeedStatus(companyId, submissionId);
    const waitingForFeed = !feed.data || isCatalogFeedProcessing(feed.data);
    const card = useCatalogCard(companyId, submissionId, !waitingForFeed);
    const [publicationAgreement, setPublicationAgreement] = useState(false);
    const [confirmSign, setConfirmSign] = useState(false);
    const [providerChecked, setProviderChecked] = useState(false);
    const [editorDirty, setEditorDirty] = useState(false);
    const [editorOpened, setEditorOpened] = useState(false);
    const [editorBusy, setEditorBusy] = useState(false);
    const [recoveredError, setRecoveredError] = useState<Error | null>(null);
    const signingHeading = useRef<HTMLHeadingElement>(null);
    const [identityGtin, setIdentityGtin] = useState("");
    const pending = useRef<string | null>(null);
    const inFlight = useRef(false);
    const signedBeforeAction = useRef(false);
    const invalidate = () =>
        client.invalidateQueries({ queryKey: catalogKeys.all(companyId) });
    const identityCheck = useMutation({
        retry: false,
        mutationFn: () =>
            catalogApiService.bindIdentity(
                submissionId,
                identityGtin.trim().padStart(14, "0"),
            ),
        onSettled: invalidate,
    });
    const action = useMutation({
        mutationKey: catalogKeys.workflowAction(
            companyId,
            submissionId,
            actorId,
            authVersion,
        ),
        retry: false,
        mutationFn: async (kind: "Moderate" | "Sign") => {
            if (editorDirty)
                throw new Error(
                    t("honestSign.catalog.workflow.saveBeforeModeration"),
                );
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
                    const requestId = pending.current;
                    return await recoverCatalogOperationFailure(
                        error,
                        () =>
                            catalogApiService.operation(
                                submissionId,
                                requestId,
                            ),
                        () => {
                            if (
                                canEditCatalogFailure(
                                    getHttpErrorStatus(error),
                                    null,
                                )
                            )
                                pending.current = null;
                        },
                        (originalError) => {
                            const status = getHttpErrorStatus(originalError);
                            if (
                                originalError instanceof Error &&
                                status !== null &&
                                status >= 400 &&
                                status < 500
                            )
                                setRecoveredError(originalError);
                        },
                    );
                }
                throw error;
            }
        },
        onSuccess: (receipt) => {
            if (!["Sending", "Unknown", "Processing"].includes(receipt.state))
                pending.current = null;
            if (receipt.state === "Accepted") setRecoveredError(null);
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
            if (receipt?.state === "Accepted") setRecoveredError(null);
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
            setRecoveredError(null);
        },
        onSettled: invalidate,
    });
    const run = (kind: "Moderate" | "Sign") => {
        if (inFlight.current) return;
        inFlight.current = true;
        signedBeforeAction.current = card.data?.isSigned === true;
        setRecoveredError(null);
        check.reset();
        action.mutate(kind, {
            onSettled: () => {
                inFlight.current = false;
            },
        });
    };
    const busy =
        action.isPending ||
        check.isPending ||
        reconcile.isPending ||
        identityCheck.isPending ||
        editorBusy;
    const receipt = check.data ?? action.data;
    const data = card.data;
    const cardErrorStatus = getHttpErrorStatus(card.error);
    const cardReadPending =
        feed.data?.submissionState === "Accepted" &&
        (cardErrorStatus === null ||
            [404, 408, 429].includes(cardErrorStatus) ||
            cardErrorStatus >= 500);
    const outcome = catalogWorkflowOutcome({
        actionKind: action.variables,
        receipt,
        freshSignedCard: Boolean(
            card.isSuccess &&
            data?.isSigned &&
            card.dataUpdatedAt >= action.submittedAt,
        ),
        signedBeforeAction: signedBeforeAction.current,
        pendingRequest: Boolean(pending.current),
        actionFailed: action.isError,
    });
    const uncertain = outcome.uncertain;
    const available = catalogActionAvailability(data, {
        busy,
        pendingRequest: Boolean(pending.current),
        fetching: card.isFetching || waitingForFeed,
        dirty: editorDirty,
    });
    useEffect(() => {
        onDirtyChange?.(editorDirty);
    }, [editorDirty, onDirtyChange]);
    useEffect(() => {
        onBusyChange?.(busy || editorBusy);
    }, [busy, editorBusy, onBusyChange]);
    useEffect(() => {
        if (focusSigning && data?.canSign) signingHeading.current?.focus();
    }, [focusSigning, data?.canSign]);
    const blocking = data?.blockingOperation;
    const readyToReconcile =
        blocking &&
        Date.now() - new Date(blocking.createdAtUtc).getTime() >= 300_000;
    const error =
        recoveredError ??
        (outcome.showActionError ? action.error : null) ??
        reconcile.error;
    return (
        <section
            className="space-y-4 border-t pt-5"
            aria-label={t("honestSign.catalog.workflow.title")}
        >
            <div className="flex flex-wrap items-center justify-end gap-3">
                {showTitle && (
                    <h3 className="font-semibold">
                        {t("honestSign.catalog.workflow.title")}
                    </h3>
                )}
                <Button
                    variant="outline"
                    size="sm"
                    disabled={card.isFetching || feed.isFetching || busy}
                    onClick={() => {
                        if (waitingForFeed) void feed.refetch();
                        else void card.refetch();
                    }}
                >
                    {t("honestSign.catalog.refresh")}
                </Button>
            </div>
            {waitingForFeed ? (
                <Notice role="status">
                    {t(
                        feed.isError && !feed.data
                            ? "honestSign.catalog.workflow.feedResultPending"
                            : "honestSign.catalog.workflow.waitingForFeed",
                    )}
                </Notice>
            ) : card.isPending ? (
                <Skeleton className="h-24 w-full" />
            ) : card.isError && !data ? (
                <Notice
                    variant={cardReadPending ? "info" : "error"}
                    role={cardReadPending ? "status" : "alert"}
                >
                    {cardReadPending ? (
                        t("honestSign.catalog.workflow.cardResultPending")
                    ) : (
                        <>
                            <p>{card.error.message}</p>
                            <CatalogErrorDetails error={card.error} />
                        </>
                    )}
                </Notice>
            ) : (
                data && (
                    <>
                        {card.isError && (
                            <Notice role="status">
                                {t(
                                    outcome.signAccepted
                                        ? "honestSign.catalog.workflow.signedRefreshPending"
                                        : "honestSign.catalog.workflow.cardRefreshPending",
                                )}
                            </Notice>
                        )}
                        {data.status === "identity_pending" && (
                            <Notice>
                                <p>
                                    {t(
                                        "honestSign.catalog.identityPendingHelp",
                                    )}
                                </p>
                                <div className="mt-3 space-y-2">
                                    <Label
                                        htmlFor={`catalog-identity-${submissionId}`}
                                    >
                                        {t(
                                            "honestSign.catalog.confirmGeneratedIdentity",
                                        )}
                                    </Label>
                                    <Input
                                        id={`catalog-identity-${submissionId}`}
                                        value={identityGtin}
                                        onChange={(event) =>
                                            setIdentityGtin(event.target.value)
                                        }
                                        disabled={busy}
                                        maxLength={14}
                                        inputMode="numeric"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={
                                            busy ||
                                            !isValidCatalogGtin(
                                                identityGtin.trim(),
                                            )
                                        }
                                        onClick={() => identityCheck.mutate()}
                                    >
                                        {t(
                                            "honestSign.catalog.verifyGeneratedIdentity",
                                        )}
                                    </Button>
                                </div>
                                {identityCheck.error && (
                                    <div
                                        role="alert"
                                        className="mt-2 text-sm text-destructive"
                                    >
                                        <p>{identityCheck.error.message}</p>
                                        <CatalogErrorDetails
                                            error={identityCheck.error}
                                        />
                                    </div>
                                )}
                            </Notice>
                        )}
                        <div className="flex flex-wrap gap-2 text-sm">
                            <span className="font-mono">
                                {data.gtin ||
                                    t("honestSign.catalog.pendingGtin")}
                            </span>
                            {data.detailedStatuses.map((state) => (
                                <Badge key={state} variant="outline">
                                    {t(
                                        data.goodId === 0 && state === "draft"
                                            ? "honestSign.catalog.deliveryStates.Draft"
                                            : `honestSign.catalog.workflow.cardStates.${state}`,
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
                        <p className="text-sm text-muted-foreground">
                            {t("honestSign.catalog.workflow.providerDecides")}
                        </p>
                        {(blocking ||
                            uncertain ||
                            Boolean(pending.current)) && (
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
                        {check.isError && (
                            <Notice role="status">
                                {t(
                                    "honestSign.catalog.workflow.receiptRefreshPending",
                                )}
                            </Notice>
                        )}
                        {error && (
                            <Notice variant="error" role="alert">
                                <p>{error.message}</p>
                                <CatalogErrorDetails error={error} />
                            </Notice>
                        )}
                        {receipt &&
                            !(receipt.state === "Rejected" && error) && (
                                <Notice
                                    variant={
                                        receipt.state === "Rejected"
                                            ? "error"
                                            : outcome.signAccepted
                                              ? "success"
                                              : "info"
                                    }
                                    role={
                                        receipt.state === "Rejected"
                                            ? "alert"
                                            : "status"
                                    }
                                >
                                    {t(
                                        outcome.signAccepted
                                            ? "honestSign.catalog.workflow.signedAccepted"
                                            : `honestSign.catalog.workflow.operationStates.${receipt.state}`,
                                    )}
                                    {receipt.error ? ` · ${receipt.error}` : ""}
                                </Notice>
                            )}
                        {outcome.publicationConfirmed &&
                            !outcome.signAccepted && (
                                <Notice variant="success" role="status">
                                    {t(
                                        "honestSign.catalog.workflow.signedVerified",
                                    )}
                                </Notice>
                            )}
                        {!data.isSigned &&
                            !data.canEdit &&
                            !data.canModerate &&
                            !data.canSign &&
                            data.status !== "identity_pending" &&
                            !blocking && (
                                <Notice>
                                    {t("honestSign.catalog.workflow.notReady")}
                                </Notice>
                            )}
                        <div className="flex flex-wrap gap-3">
                            <Button
                                disabled={!available.canModerate}
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
                        {editorDirty && data.goodId > 0 && (
                            <p
                                role="status"
                                className="text-sm text-muted-foreground"
                            >
                                {t(
                                    "honestSign.catalog.workflow.saveBeforeModeration",
                                )}
                            </p>
                        )}
                        {data.canSign && (
                            <div className="space-y-3 border-t pt-4">
                                <h4
                                    ref={signingHeading}
                                    tabIndex={-1}
                                    className="font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    {t("honestSign.catalog.products.signTitle")}
                                </h4>
                                <Label
                                    className="flex items-start gap-2"
                                    htmlFor="catalog-publication-agreement"
                                >
                                    <Checkbox
                                        id="catalog-publication-agreement"
                                        checked={publicationAgreement}
                                        disabled={
                                            busy ||
                                            uncertain ||
                                            Boolean(pending.current)
                                        }
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
                                        disabled={
                                            busy ||
                                            uncertain ||
                                            Boolean(pending.current)
                                        }
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
                                        !available.canSign ||
                                        !confirmSign ||
                                        !selectedThumbprint
                                    }
                                    onClick={() => run("Sign")}
                                >
                                    {t(
                                        "honestSign.catalog.workflow.signPublish",
                                    )}
                                </Button>
                            </div>
                        )}
                        {blocking &&
                            (blocking.state !== "Processing" ||
                                blocking.operation === "Moderate") && (
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
                                                setProviderChecked(
                                                    value === true,
                                                )
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
                                        {t(
                                            "honestSign.catalog.workflow.reconcile",
                                        )}
                                    </Button>
                                </div>
                            )}
                        {data.draft &&
                            data.status !== "identity_pending" &&
                            (data.goodId === 0 ? (
                                <CatalogCardForm
                                    key={`${submissionId}-${data.goodId}`}
                                    companyId={companyId}
                                    categories={categories}
                                    productGroups={productGroups}
                                    initialCard={data.draft}
                                    submissionId={submissionId}
                                    externalGoodId={data.goodId}
                                    onDirtyChange={setEditorDirty}
                                    onBusyChange={setEditorBusy}
                                    readOnly={!available.canEdit}
                                    onSubmitted={() => {
                                        setEditorDirty(false);
                                    }}
                                />
                            ) : (
                                <Collapsible
                                    open={editorOpened}
                                    onOpenChange={(open) => {
                                        if (!editorDirty && !editorBusy)
                                            setEditorOpened(open);
                                    }}
                                    className="border-t pt-4"
                                >
                                    <CollapsibleTrigger asChild>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={editorDirty || editorBusy}
                                        >
                                            {t(
                                                editorOpened
                                                    ? "honestSign.catalog.workflow.cancelEdit"
                                                    : data.canEdit
                                                      ? "honestSign.catalog.workflow.edit"
                                                      : "honestSign.catalog.products.showAttributes",
                                            )}
                                        </Button>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="pt-4">
                                        <CatalogCardForm
                                            key={`${submissionId}-${data.goodId}`}
                                            companyId={companyId}
                                            categories={categories}
                                            productGroups={productGroups}
                                            initialCard={data.draft}
                                            submissionId={submissionId}
                                            externalGoodId={data.goodId}
                                            onDirtyChange={setEditorDirty}
                                            onBusyChange={setEditorBusy}
                                            readOnly={!available.canEdit}
                                            onSubmitted={() => {
                                                setEditorDirty(false);
                                            }}
                                        />
                                    </CollapsibleContent>
                                </Collapsible>
                            ))}
                    </>
                )
            )}
        </section>
    );
}
