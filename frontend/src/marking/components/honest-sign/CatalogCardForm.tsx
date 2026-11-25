import { useMarkingDeclaration } from '@marking/DeclarationContext';
import { captureMarkingScope, assertMarkingScope } from '@marking/lib/workspace-scope';
import { TnVedPicker } from '../../../TnVedPicker';
import { declarationTnVedCodes } from '../../../declarationTnVedCodes';
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, Loader2, Save } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { CatalogAttributeGroups } from "@marking/components/honest-sign/CatalogAttributeGroups";
import { CatalogBrandLookup } from "@marking/components/honest-sign/CatalogBrandLookup";
import { CatalogErrorDetails } from "@marking/components/honest-sign/CatalogErrorDetails";
import { CatalogGtinCheck, useCatalogGtinLookup } from "@marking/components/honest-sign/CatalogGtinCheck";
import { CatalogGtinPicker } from "@marking/components/honest-sign/CatalogGtinPicker";
import { CatalogMediaFields } from "@marking/components/honest-sign/CatalogMediaFields";
import {
    CatalogPackagingFields,
    CatalogStructureFields,
} from "@marking/components/honest-sign/CatalogStructureFields";
import { FormField } from "@marking/components/honest-sign/ui/form-field";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Select } from "@marking/components/honest-sign/ui/select";
import { Button } from "@marking/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@marking/components/ui/collapsible";
import { Input } from "@marking/components/ui/input";
import { Skeleton } from "@marking/components/ui/skeleton";
import {
    useCatalogAttributes,
    useCatalogCategories,
    catalogKeys,
} from "@marking/hooks/use-honest-sign-catalog";
import { catalogApiService } from "@marking/lib/honest-sign/catalogApiService";
import {
    buildCatalogCardRequest,
    catalogLayerCompletion,
    createCatalogFormSchema,
    emptyCatalogForm,
    catalogGtinError,
    isValidCatalogTnved,
    isCatalogFeedProcessing,
    catalogFormFromCard,
    catalogFailureRecoveryNotice,
    isCatalogGtinPreflightConflict,
    hasCatalogFormChanges,
    type CatalogFormValues,
} from "@marking/lib/honest-sign/catalogForm";
import {
    getHttpErrorCode,
    getHttpErrorStatus,
} from "@marking/lib/honest-sign/httpClient";

import type {
    CatalogCardRequest,
    CatalogCategory,
    CatalogSubmission,
    CatalogProductGroup,
    CatalogFeedStatus,
} from "@marking/lib/honest-sign/catalogTypes";

export function CatalogCardForm({
    companyId,
    productGroups = [],
    onSubmitted,
    initialCard,
    submissionId,
    readOnly = false,
    externalGoodId = 0,
    retryRejected = false,
    canResubmitForModeration = false,
    onDirtyChange,
    onBusyChange,
    onStage,
}: {
    companyId: string;
    categories?: CatalogCategory[];
    productGroups?: CatalogProductGroup[];
    onSubmitted: (submission: CatalogSubmission) => void;
    readOnly?: boolean;
    initialCard?: CatalogCardRequest;
    submissionId?: string;
    externalGoodId?: number;
    retryRejected?: boolean;
    canResubmitForModeration?: boolean;
    onDirtyChange?: (dirty: boolean) => void;
    onBusyChange?: (busy: boolean) => void;
    onStage?: (request: CatalogCardRequest) => void;
}) {
    const { t } = useTranslation();
    const declaration = useMarkingDeclaration();
    const declarationCodes = declarationTnVedCodes(declaration?.product.tnVed);
    const singleDeclarationCode = declarationCodes.length === 1 ? declarationCodes[0] : '';
    const idPrefix = submissionId ? `catalog-edit-${submissionId}` : "catalog";
    const [categoryId, setCategoryId] = useState(initialCard?.categoryId ?? 0);
    const [lookupTnved, setLookupTnved] = useState(initialCard?.tnved ?? "");
    const [recoveryNotice, setRecoveryNotice] = useState("");
    const [submissionError, setSubmissionError] = useState<Error | null>(null);
    const [checkingReceipt, setCheckingReceipt] = useState(false);
    const [mediaOpened, setMediaOpened] = useState(false);
    const [gtinVisited, setGtinVisited] = useState(false);
    const client = useQueryClient();
    const savedId = useRef(submissionId);
    const savedReceipt = useRef<CatalogSubmission | null>(null);
    const sendIntent = useRef(false);
    const validateModeration = useRef(false);
    const [sentRequest, setSentRequest] = useState<CatalogCardRequest | null>(
        null,
    );
    const inFlight = useRef(false);
    const [initialRequestId] = useState(() => crypto.randomUUID());
    const requestId = useRef(initialRequestId);
    const mutation = useMutation({
        retry: false,
        mutationFn: async ({
            request,
            send,
        }: {
            request: CatalogCardRequest;
            send: boolean;
        }) => {
            const scope = captureMarkingScope();
            const saved = await catalogApiService.saveDraft(
                { ...request, sendToModeration: false },
                savedId.current,
            );
            assertMarkingScope(scope);
            savedId.current = saved.id;
            savedReceipt.current = saved;
            return send
                ? catalogApiService.sendDraft(saved.id, saved.draftVersion, request.sendToModeration)
                : saved;
        },
        onSuccess: (receipt) => {
            if (submissionId || receipt.state !== "Accepted" || !receipt.feedId) return;
            const key = catalogKeys.status(companyId, receipt.id);
            client.setQueryData<CatalogFeedStatus>(key, (previous) =>
                previous?.feedId === receipt.feedId ? previous : {
                    submissionId: receipt.id,
                    submissionState: receipt.state,
                    feedId: receipt.feedId,
                    status: null,
                    receivedAtUtc: null,
                    updatedAtUtc: null,
                    errors: [],
                },
            );
        },
        onSettled: () => {
            const id = savedId.current;
            const prefix = catalogKeys.all(companyId);
            void client.invalidateQueries({
                queryKey: prefix,
                predicate: (query) =>
                    ["products", "submissions", "workflow-action", "generated-gtins"].includes(
                        String(query.queryKey[prefix.length]),
                    ),
            });
            if (id) {
                void client.invalidateQueries({
                    queryKey: catalogKeys.attempts(companyId, id),
                });
                void client.invalidateQueries({
                    queryKey: catalogKeys.status(companyId, id),
                }).then(() => client.invalidateQueries({
                    queryKey: catalogKeys.card(companyId, id),
                    refetchType: isCatalogFeedProcessing(
                        client.getQueryData<CatalogFeedStatus>(
                            catalogKeys.status(companyId, id),
                        ),
                    )
                        ? "none"
                        : "active",
                }));
            }
        },
    });
    const form = useForm<CatalogFormValues>({
        shouldUnregister: false,
        shouldFocusError: false,
        defaultValues: initialCard
            ? catalogFormFromCard(initialCard)
            : { ...emptyCatalogForm, name: declaration?.product.name ?? '', gtin: declaration?.product.gtin ?? '', tnved: singleDeclarationCode },
        resolver: (input, context, options) =>
            zodResolver(
                createCatalogFormSchema(model, (key) =>
                    t(`honestSign.catalog.${key}`),
                ),
            )({ ...input, sendToModeration: validateModeration.current }, context, options),
    });
    const values = form.watch();
    const gtin = values.gtin.trim();
    const existingGtin = values.gtinMode === "existing";
    const gtinError = existingGtin || gtin ? catalogGtinError(gtin) : null;
    const showGtinError = gtinError && (gtinVisited || values.gtin || form.formState.errors.gtin);
    const productGroupCode = values.productGroupCode
        ? Number(values.productGroupCode)
        : undefined;
    const attributes = useCatalogAttributes(
        companyId,
        categoryId,
        productGroupCode,
        values.composition === "set",
    );
    const model = attributes.data ?? [];
    const dirty =
        hasCatalogFormChanges(
            values,
            initialCard ? catalogFormFromCard(initialCard) : emptyCatalogForm,
            model,
        ) ||
        mutation.isPending ||
        checkingReceipt ||
        form.formState.isSubmitting;
    const busy =
        mutation.isPending || checkingReceipt || form.formState.isSubmitting;
    useEffect(() => {
        onDirtyChange?.(dirty);
    }, [dirty, onDirtyChange]);
    useEffect(() => {
        onBusyChange?.(busy);
        return () => onBusyChange?.(false);
    }, [busy, onBusyChange]);
    const tnved = values.tnved.trim();
    const validTnved = isValidCatalogTnved(tnved);
    const lookupConfirmed = Boolean(
        productGroupCode && validTnved && lookupTnved === tnved,
    );
    const matchingCategories = useCatalogCategories(
        companyId,
        lookupTnved,
        productGroupCode,
    );
    const availableCategories = lookupConfirmed
        ? (matchingCategories.data ?? [])
        : [];
    const completion = catalogLayerCompletion(model, values);
    const locked = readOnly || sentRequest !== null;
    const identityLocked = externalGoodId > 0;
    const isNewCard = !retryRejected && !identityLocked;
    const gtinLookup = useCatalogGtinLookup({
        companyId,
        gtin,
        submissionId: savedId.current,
        enabled: existingGtin && !locked && !gtinError,
        automatic: isNewCard,
    });
    const duplicateGtin = isNewCard && gtinLookup.result?.state === "Found";
    const lookupCategories = () => {
        if (
            !productGroupCode ||
            !validTnved ||
            locked ||
            matchingCategories.isFetching
        )
            return;
        if (lookupTnved === tnved) void matchingCategories.refetch();
        else setLookupTnved(tnved);
    };
    const modelReady = Boolean(productGroupCode && categoryId) &&
        !matchingCategories.isFetching && !matchingCategories.isError &&
        attributes.isSuccess && !attributes.isFetching;
    const submit = async (request: CatalogCardRequest, send = false) => {
        const scope = captureMarkingScope();
        if (inFlight.current || readOnly) return;
        if ((send || onStage) && (duplicateGtin || gtinLookup.isWaiting)) return;
        if (onStage) { onStage(request); onDirtyChange?.(false); return; }
        inFlight.current = true;
        sendIntent.current = send;
        setSentRequest(request);
        savedReceipt.current = null;
        setRecoveryNotice("");
        setSubmissionError(null);
        try {
            const receipt = await mutation.mutateAsync({ request, send });
            if (send) form.reset(form.getValues());
            onSubmitted(receipt);
            requestId.current = crypto.randomUUID();
            setSentRequest(submissionId ? null : request);
        } catch (error) {
            assertMarkingScope(scope);
            const status = getHttpErrorStatus(error);
            const code = getHttpErrorCode(error);
            if (code === "error.honest_sign_catalog_request_payload_conflict") {
                // This key belongs to another payload. Keep it locked until the user
                // inspects that request; generating a key here could duplicate it.
                setRecoveryNotice(
                    catalogFailureRecoveryNotice(status, code, undefined),
                );
                setSubmissionError(
                    error instanceof Error
                        ? error
                        : new Error(t("honestSign.catalog.requestFailed")),
                );
                return;
            }
            setCheckingReceipt(true);
            let receiptState: string | null | undefined;
            let recovered: CatalogSubmission | null = null;
            try {
                const receipt = savedId.current
                    ? await catalogApiService.status(savedId.current)
                    : await catalogApiService.findSubmission(request.requestId);
                receiptState = receipt
                    ? "submissionState" in receipt
                        ? receipt.submissionState
                        : receipt.state
                    : null;
                const saved = savedReceipt.current as CatalogSubmission | null;
                if (receipt && "submissionState" in receipt)
                    client.setQueryData(
                        catalogKeys.status(companyId, receipt.submissionId),
                        receipt,
                    );
                recovered = receipt
                    ? "submissionState" in receipt
                        ? saved && {
                              ...saved,
                              state: receipt.submissionState,
                              feedId: receipt.feedId,
                              sendToModeration: send && request.sendToModeration,
                          }
                        : receipt
                    : null;
            } catch {
                // A concurrent call may already own this UUID. Failed reads cannot
                // authorize another payload, including preflight GTIN conflicts.
            }
            if (
                recovered &&
                (["Accepted", "Sending", "Unknown"].includes(recovered.state) ||
                    (send && recovered.state === "Rejected"))
            ) {
                // Use the stored outcome when the transport lost the send response.
                if (send) form.reset(form.getValues());
                onSubmitted(recovered);
                requestId.current = crypto.randomUUID();
                setSentRequest(submissionId ? null : request);
                return;
            }
            const notice = catalogFailureRecoveryNotice(
                status,
                code,
                receiptState,
            );
            setSubmissionError(
                error instanceof Error
                    ? error
                    : new Error(t("honestSign.catalog.requestFailed")),
            );
            if (notice === "editableAfterError") {
                requestId.current = crypto.randomUUID();
                setSentRequest(null);
            }
            setRecoveryNotice(notice);
        } finally {
            setCheckingReceipt(false);
            inFlight.current = false;
        }
    };
    const sendCurrent = async () => {
        if (!modelReady || gtinError || duplicateGtin || gtinLookup.isWaiting || inFlight.current) return;
        validateModeration.current = canResubmitForModeration;
        try {
            await form.handleSubmit(
                (v) => submit(buildCatalogCardRequest(v, model, requestId.current), true),
                focusInvalid,
            )();
        } finally {
            validateModeration.current = false;
        }
    };
    function focusInvalid() {
        // Optional fields stay mounted. Open their error groups before moving focus.
        requestAnimationFrame(() => {
            const root = document.getElementById(`${idPrefix}-form`);
            const invalid = root?.querySelector<HTMLElement>(
                '[aria-invalid="true"]:not([disabled])',
            );
            invalid?.focus();
            invalid?.scrollIntoView({ block: "nearest" });
        });
    }
    const mediaOpen =
        mediaOpened ||
        Boolean(form.formState.errors.photoUrl || form.formState.errors.images);
    const coreFields = ["tnved", "gtin", "name", "brand"] as const;
    const gtinFieldError = showGtinError
        ? t(`honestSign.catalog.${gtinError}`)
        : duplicateGtin ? t("honestSign.catalog.gtinCheck.alreadyRegistered")
            : form.formState.errors.gtin?.message;
    const gtinPreflightConflict = isCatalogGtinPreflightConflict(
        getHttpErrorStatus(submissionError),
        getHttpErrorCode(submissionError),
    );
    const payloadConflict =
        getHttpErrorCode(submissionError) ===
        "error.honest_sign_catalog_request_payload_conflict";
    return (
        <form
            id={`${idPrefix}-form`}
            className="space-y-6"
            aria-busy={busy}
            noValidate
            onSubmit={form.handleSubmit(
                (v) =>
                    submit(
                        sentRequest ??
                            buildCatalogCardRequest(
                                v,
                                model,
                                requestId.current,
                            ),
                    ),
                focusInvalid,
            )}
        >
            {declaration && !initialCard && <Notice>
                <p>Декларация {declaration.reference}: {declaration.registrationNumber || 'регистрационный номер не указан'}.</p>
                <Button type="button" variant="outline" disabled={locked} onClick={() => {
                    form.setValue('name', declaration.product.name, { shouldDirty: true });
                    if (singleDeclarationCode) form.setValue('tnved', singleDeclarationCode, { shouldDirty: true });
                    if (declaration.product.gtin) form.setValue('gtin', declaration.product.gtin, { shouldDirty: true });
                    const permit = model.find(attribute => attribute.id === 23557);
                    if (permit && declaration.registrationNumber && declaration.adoptedAt) form.setValue(`attributes.attr_${permit.id}`, [{ value: `${declaration.registrationNumber}:::${declaration.adoptedAt}`, valueType: '' }], { shouldDirty: true });
                }}>Подставить данные декларации</Button>
                {declarationCodes.length > 1 && <p className="break-words">Коды ТН ВЭД в декларации — {declarationCodes.join(', ')}. Укажите один код для этой карточки.</p>}
            </Notice>}
            {!initialCard && (
                <>
                    <Notice>{t("honestSign.catalog.scopeNotice")}</Notice>
                    <p className="text-sm text-muted-foreground">
                        {t("honestSign.catalog.modelHint")}
                    </p>
                </>
            )}
            <FormField
                label={`${t("honestSign.catalog.productGroup")} *`}
                htmlFor={`${idPrefix}-productGroup`}
            >
                <Select
                    id={`${idPrefix}-productGroup`}
                    {...form.register("productGroupCode")}
                    value={values.productGroupCode}
                    disabled={locked}
                    aria-invalid={Boolean(
                        form.formState.errors.productGroupCode,
                    )}
                    onChange={(event) => {
                        form.setValue("productGroupCode", event.target.value, {
                            shouldDirty: true,
                        });
                        form.setValue("categoryId", "", { shouldDirty: true });
                        form.setValue("attributes", {}, { shouldDirty: true });
                        setCategoryId(0);
                        setLookupTnved("");
                    }}
                >
                    <option value="">
                        {t("honestSign.catalog.selectProductGroup")}
                    </option>
                    {productGroups.map((group) => (
                        <option key={group.code} value={group.code}>
                            {group.name}
                        </option>
                    ))}
                </Select>
                {form.formState.errors.productGroupCode?.message && (
                    <p role="alert" className="text-xs text-destructive">
                        {form.formState.errors.productGroupCode.message}
                    </p>
                )}
            </FormField>
            <CatalogStructureFields
                form={form}
                values={values}
                disabled={locked}
                identityLocked={identityLocked}
                idPrefix={idPrefix}
            />
            <fieldset
                className="grid min-w-0 gap-4 md:grid-cols-2"
                disabled={locked}
            >
                <legend className="mb-3 text-sm font-semibold">
                    {t("honestSign.catalog.createStage")}
                </legend>
                {coreFields.map((field) => (
                    <FormField
                        key={field}
                        label={`${t(`honestSign.catalog.${field}`)}${field === "gtin" && values.gtinMode !== "existing" ? "" : " *"}`}
                        htmlFor={`${idPrefix}-${field}`}
                    >
                        <Input
                            id={`${idPrefix}-${field}`}
                            {...form.register(
                                field,
                                field === "tnved"
                                    ? {
                                          onChange: () => {
                                              form.setValue("categoryId", "", {
                                                  shouldDirty: true,
                                              });
                                              form.setValue(
                                                  "attributes",
                                                  {},
                                                  { shouldDirty: true },
                                              );
                                              setCategoryId(0);
                                              setLookupTnved("");
                                          },
                                      }
                                    : undefined,
                            )}
                            autoComplete="off"
                            inputMode={
                                field === "gtin" || field === "tnved"
                                    ? "numeric"
                                    : undefined
                            }
                            maxLength={
                                field === "gtin"
                                    ? undefined
                                    : field === "tnved"
                                      ? 10
                                      : field === "name"
                                        ? 1000
                                        : field === "brand"
                                          ? 255
                                          : 2048
                            }
                            type="text"
                            readOnly={identityLocked && field === "gtin"}
                            onFocus={field === "gtin" ? () => setGtinVisited(true) : undefined}
                            disabled={
                                field === "gtin" &&
                                values.gtinMode !== "existing" &&
                                !values.gtin
                            }
                            placeholder={
                                field === "gtin" &&
                                values.gtinMode !== "existing"
                                    ? t("honestSign.catalog.pendingGtin")
                                    : undefined
                            }
                            onKeyDown={(event) => {
                                if (
                                    field === "tnved" &&
                                    event.key === "Enter"
                                ) {
                                    event.preventDefault();
                                    lookupCategories();
                                }
                            }}
                            aria-required={field === "gtin" ? existingGtin : undefined}
                            aria-invalid={field === "gtin" ? Boolean(gtinFieldError) : Boolean(form.formState.errors[field])}
                            aria-describedby={`${idPrefix}-${field}-help`}
                        />
                        <div
                            id={`${idPrefix}-${field}-help`}
                            className="text-xs"
                        >
                            {(field === "gtin" ? gtinFieldError : form.formState.errors[field]?.message) ? (
                                <p role="alert" className="text-destructive">
                                    {field === "gtin" ? gtinFieldError : form.formState.errors[field]?.message}
                                </p>
                            ) : field === "gtin" && existingGtin && gtin ? (
                                <p role="status" className="text-muted-foreground">
                                    {t("honestSign.catalog.gtinValid")}
                                </p>
                            ) : (
                                ["gtin", "tnved", "brand"].includes(field) && (
                                    <p className="text-muted-foreground">
                                        {t(`honestSign.catalog.${field}Help`)}
                                    </p>
                                )
                            )}
                        </div>
                        {field === "gtin" && existingGtin && (
                            <CatalogGtinCheck lookup={gtinLookup} confirmedDuplicate={duplicateGtin} />
                        )}
                        {field === "gtin" &&
                            values.gtinMode === "existing" &&
                            !submissionId && (
                                <CatalogGtinPicker
                                    companyId={companyId}
                                    disabled={locked}
                                    onSelected={(gtin) =>
                                        form.setValue("gtin", gtin, {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                        })
                                    }
                                />
                            )}
                        {field === "brand" && (
                            <CatalogBrandLookup
                                companyId={companyId}
                                idPrefix={idPrefix}
                                value={values.brand}
                                disabled={locked}
                                onSelected={(brand) =>
                                    form.setValue("brand", brand, {
                                        shouldDirty: true,
                                        shouldValidate: true,
                                    })
                                }
                            />
                        )}
                        {field === "tnved" && (
                            <TnVedPicker
                                firmId={companyId}
                                value={values.tnved}
                                productName={values.name}
                                disabled={locked}
                                onSelect={(node) => {
                                    form.setValue("tnved", node.code!, { shouldDirty: true, shouldValidate: true });
                                    form.setValue("categoryId", "", { shouldDirty: true });
                                    form.setValue("attributes", {}, { shouldDirty: true });
                                    setCategoryId(0);
                                    setLookupTnved("");
                                }}
                            />
                        )}
                        {field === "tnved" && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                    locked ||
                                    !productGroupCode ||
                                    !validTnved ||
                                    matchingCategories.isFetching
                                }
                                onClick={lookupCategories}
                            >
                                {t("honestSign.catalog.findCategories")}
                            </Button>
                        )}
                    </FormField>
                ))}
                <FormField
                    label={`${t("honestSign.catalog.category")} *`}
                    htmlFor={`${idPrefix}-category`}
                    className="md:col-span-2"
                >
                    <Select
                        id={`${idPrefix}-category`}
                        {...form.register("categoryId")}
                        value={values.categoryId}
                        aria-describedby={`${idPrefix}-category-help ${idPrefix}-category-error`}
                        aria-invalid={Boolean(form.formState.errors.categoryId)}
                        disabled={
                            locked ||
                            !lookupConfirmed ||
                            !availableCategories.length ||
                            matchingCategories.isFetching ||
                            matchingCategories.isError
                        }
                        onChange={(e) => {
                            form.setValue("categoryId", e.target.value, {
                                shouldDirty: true,
                            });
                            form.setValue(
                                "attributes",
                                {},
                                { shouldDirty: true },
                            );
                            setCategoryId(Number(e.target.value));
                        }}
                    >
                        <option value="">
                            {t("honestSign.catalog.selectCategory")}
                        </option>
                        {categoryId > 0 &&
                            !availableCategories.some(
                                (category) => category.id === categoryId,
                            ) && (
                                <option value={categoryId}>
                                    {t("honestSign.catalog.currentCategory", {
                                        id: categoryId,
                                    })}
                                </option>
                            )}
                        {availableCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} · {c.id}
                                {!c.isActive
                                    ? ` · ${t("honestSign.catalog.categoryInactive")}`
                                    : ""}
                            </option>
                        ))}
                    </Select>
                    <div
                        id={`${idPrefix}-category-help`}
                        className="text-xs text-muted-foreground"
                        aria-live="polite"
                    >
                        {!validTnved ? (
                            t("honestSign.catalog.enterTnvedFirst")
                        ) : !lookupConfirmed ? (
                            t("honestSign.catalog.confirmTnved")
                        ) : matchingCategories.isFetching ? (
                            t("honestSign.catalog.loadingCategories")
                        ) : matchingCategories.isError ? (
                            <>
                                <p role="alert" className="text-destructive">
                                    {matchingCategories.error.message}
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={locked}
                                    onClick={() =>
                                        void matchingCategories.refetch()
                                    }
                                >
                                    {t("honestSign.catalog.retry")}
                                </Button>
                            </>
                        ) : !availableCategories.length ? (
                            t("honestSign.catalog.noMatchingCategories")
                        ) : (
                            t("honestSign.catalog.categoriesMatchTnved")
                        )}
                    </div>
                    <p
                        id={`${idPrefix}-category-error`}
                        className="text-xs text-destructive"
                        role="alert"
                    >
                        {form.formState.errors.categoryId?.message}
                    </p>
                </FormField>
            </fieldset>
            <CatalogPackagingFields
                form={form}
                values={values}
                disabled={locked}
                idPrefix={idPrefix}
            />
            {categoryId > 0 && (
                <section
                    className="space-y-4 border-t pt-4"
                    aria-label={t("honestSign.catalog.characteristics")}
                >
                    <div>
                        <h3 className="font-semibold">
                            {t("honestSign.catalog.detailsStage")}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t("honestSign.catalog.draftDetailsHelp")}
                        </p>
                    </div>
                    {attributes.isPending ? (
                        <Skeleton className="h-32 w-full" />
                    ) : attributes.isError ? (
                        <Notice variant="error" role="alert">
                            <p>{attributes.error.message}</p>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => void attributes.refetch()}
                            >
                                {t("honestSign.catalog.retry")}
                            </Button>
                        </Notice>
                    ) : (
                        <>
                            <div
                                className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground"
                                aria-live="polite"
                            >
                                <p>
                                    {t(
                                        "honestSign.catalog.firstLayerCompletion",
                                        completion.first,
                                    )}
                                </p>
                                <p>
                                    {t(
                                        "honestSign.catalog.secondLayerCompletion",
                                        completion.second,
                                    )}
                                </p>
                            </div>
                            <CatalogAttributeGroups
                                key={categoryId}
                                model={model}
                                values={values}
                                form={form}
                                disabled={locked}
                                idPrefix={idPrefix}
                            />
                        </>
                    )}
                </section>
            )}
            <Collapsible
                open={mediaOpen}
                onOpenChange={setMediaOpened}
                className="border-y"
            >
                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-sm py-4 text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <span>
                        {t("honestSign.catalog.mediaGroup")}
                        {values.photoUrl.trim() || values.images.length
                            ? ` · ${t("honestSign.catalog.mediaAdded")}`
                            : ""}
                    </span>
                    <ChevronDown
                        aria-hidden="true"
                        className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${mediaOpen ? "rotate-180" : ""}`}
                    />
                </CollapsibleTrigger>
                <CollapsibleContent
                    forceMount
                    hidden={!mediaOpen}
                    className="pb-4"
                >
                    <FormField
                        label={t("honestSign.catalog.photoUrl")}
                        htmlFor={`${idPrefix}-photoUrl`}
                    >
                        <Input
                            id={`${idPrefix}-photoUrl`}
                            {...form.register("photoUrl")}
                            type="url"
                            maxLength={2048}
                            autoComplete="off"
                            disabled={locked || !values.gtin}
                            aria-invalid={Boolean(
                                form.formState.errors.photoUrl,
                            )}
                            aria-describedby={`${idPrefix}-photoUrl-help`}
                        />
                        <p
                            id={`${idPrefix}-photoUrl-help`}
                            className={`text-xs ${form.formState.errors.photoUrl ? "text-destructive" : "text-muted-foreground"}`}
                            role={
                                form.formState.errors.photoUrl
                                    ? "alert"
                                    : undefined
                            }
                        >
                            {form.formState.errors.photoUrl?.message ||
                                t("honestSign.catalog.photoUrlHelp")}
                        </p>
                    </FormField>
                    <CatalogMediaFields
                        form={form}
                        values={values}
                        disabled={locked}
                        idPrefix={idPrefix}
                    />
                </CollapsibleContent>
            </Collapsible>
            <div className="space-y-3 border-t pt-4">
                <p className="text-sm text-muted-foreground">
                    {t("honestSign.catalog.publicationNotice")}
                </p>
                {submissionError && (
                    <Notice
                        variant={gtinPreflightConflict ? "warning" : "error"}
                        role={gtinPreflightConflict ? "status" : "alert"}
                    >
                        <p>{submissionError.message}</p>
                        <CatalogErrorDetails error={submissionError} />
                        {!gtinPreflightConflict && !payloadConflict && (
                            <p className="mt-2">
                                {t("honestSign.catalog.retryNotice")}
                            </p>
                        )}
                    </Notice>
                )}
                {recoveryNotice && (
                    <Notice>
                        {t(`honestSign.catalog.workflow.${recoveryNotice}`)}
                    </Notice>
                )}
                {busy && (
                    <p
                        className="flex items-center gap-2 text-sm"
                        role="status"
                    >
                        <Loader2
                            className="size-4 animate-spin motion-reduce:animate-none"
                            aria-hidden="true"
                        />
                        {t(
                            checkingReceipt
                                ? "honestSign.catalog.workflow.checkingSubmission"
                                : sendIntent.current
                                  ? "honestSign.catalog.sendingDraft"
                                  : "honestSign.catalog.savingDraft",
                        )}
                    </p>
                )}
                <div className="flex flex-wrap gap-3">
                    {!locked && (
                        <Button
                            type="submit"
                            variant="outline"
                            disabled={
                                !productGroupCode ||
                                !categoryId ||
                                matchingCategories.isFetching ||
                                matchingCategories.isError ||
                                attributes.isPending ||
                                attributes.isError ||
                                attributes.isFetching ||
                                Boolean(gtinError) ||
                                Boolean(onStage && (duplicateGtin || gtinLookup.isWaiting)) ||
                                form.formState.isSubmitting
                            }
                        >
                            {form.formState.isSubmitting ? (
                                <Loader2
                                    className="size-4 animate-spin motion-reduce:animate-none"
                                    aria-hidden="true"
                                />
                            ) : (
                                <Save className="size-4" aria-hidden="true" />
                            )}
                            {onStage ? 'Добавить в пакет' : t("honestSign.catalog.createDraft")}
                        </Button>
                    )}
                    {!locked && !onStage && (
                        <Button
                            type="button"
                            onClick={() => void sendCurrent()}
                            disabled={
                                !productGroupCode ||
                                !categoryId ||
                                matchingCategories.isFetching ||
                                matchingCategories.isError ||
                                attributes.isPending ||
                                attributes.isError ||
                                attributes.isFetching ||
                                Boolean(gtinError) ||
                                duplicateGtin ||
                                gtinLookup.isWaiting ||
                                form.formState.isSubmitting ||
                                mutation.isPending
                            }
                        >
                            {t(
                                canResubmitForModeration
                                    ? "honestSign.catalog.workflow.sendCorrectionToModeration"
                                    : retryRejected
                                      ? "honestSign.catalog.attempts.resend"
                                      : externalGoodId > 0
                                        ? "honestSign.catalog.updateExternalDraft"
                                        : "honestSign.catalog.sendSavedDraft",
                            )}
                        </Button>
                    )}
                    {locked && mutation.isError && (
                        <Button
                            type="button"
                            disabled={busy}
                            onClick={() =>
                                sentRequest &&
                                void submit(sentRequest, sendIntent.current)
                            }
                        >
                            {t("honestSign.catalog.retrySameRequest")}
                        </Button>
                    )}
                    {locked && !readOnly && !submissionId && (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => {
                                form.reset(emptyCatalogForm);
                                setCategoryId(0);
                                setLookupTnved("");
                                setSentRequest(null);
                                requestId.current = crypto.randomUUID();
                                mutation.reset();
                                savedId.current = undefined;
                                setRecoveryNotice("");
                                setSubmissionError(null);
                                savedReceipt.current = null;
                            }}
                        >
                            {t("honestSign.catalog.newCard")}
                        </Button>
                    )}
                </div>
            </div>
        </form>
    );
}
