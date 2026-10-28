import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { useRef, useState } from "react";
import { useMarkingDeclaration } from '@marking/DeclarationContext';
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { CatalogAttributeFields } from "@marking/components/honest-sign/CatalogAttributeFields";
import { FormField } from "@marking/components/honest-sign/ui/form-field";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Select } from "@marking/components/honest-sign/ui/select";
import { Button } from "@marking/components/ui/button";
import { Input } from "@marking/components/ui/input";
import { Skeleton } from "@marking/components/ui/skeleton";
import {
    useCatalogAttributes,
    useCatalogCategories,
    useCreateCatalogCard,
    useUpdateCatalogCard,
} from "@marking/hooks/use-honest-sign-catalog";
import { catalogApiService } from "@marking/lib/honest-sign/catalogApiService";
import {
    buildCatalogCardRequest,
    catalogRequirements,
    catalogLayerCompletion,
    createCatalogFormSchema,
    emptyCatalogForm,
    isCoreCatalogAttribute,
    isValidCatalogTnved,
    catalogFormFromCard,
    canEditCatalogFailure,
} from "@marking/lib/honest-sign/catalogForm";
import { getHttpErrorStatus } from "@marking/lib/honest-sign/httpClient";

import type {
    CatalogCardRequest,
    CatalogCategory,
    CatalogSubmission,
    CatalogOperation,
} from "@marking/lib/honest-sign/catalogTypes";

export function CatalogCardForm({
    companyId,
    categories,
    onSubmitted,
    initialCard,
    submissionId,
    onUpdated,
}: {
    companyId: string;
    categories: CatalogCategory[];
    onSubmitted: (submission: CatalogSubmission) => void;
    initialCard?: CatalogCardRequest;
    submissionId?: string;
    onUpdated?: (operation: CatalogOperation) => void;
}) {
    const { t } = useTranslation();
    const declaration = useMarkingDeclaration();
    const idPrefix = submissionId ? `catalog-edit-${submissionId}` : "catalog";
    const [categoryId, setCategoryId] = useState(initialCard?.categoryId ?? 0);
    const [lookupTnved, setLookupTnved] = useState(initialCard?.tnved ?? "");
    const [recoveryNotice, setRecoveryNotice] = useState("");
    const [receiptError, setReceiptError] = useState("");
    const [sentRequest, setSentRequest] = useState<CatalogCardRequest | null>(
        null,
    );
    const inFlight = useRef(false);
    const requestId = useRef(crypto.randomUUID());
    const attributes = useCatalogAttributes(companyId, categoryId);
    const model = attributes.data ?? [];
    const create = useCreateCatalogCard(companyId);
    const update = useUpdateCatalogCard(companyId, submissionId ?? "");
    const mutation = submissionId ? update : create;
    const form = useForm({
        defaultValues: initialCard
            ? catalogFormFromCard(initialCard)
            : { ...emptyCatalogForm, name: declaration?.product.name ?? '', gtin: declaration?.product.gtin ?? '', tnved: declaration?.product.tnVed ?? '' },
        resolver: zodResolver(
            createCatalogFormSchema(model, (key) =>
                t(`honestSign.catalog.${key}`),
            ),
        ),
    });
    const values = form.watch();
    const tnved = values.tnved.trim();
    const validTnved = isValidCatalogTnved(tnved);
    const lookupConfirmed = validTnved && lookupTnved === tnved;
    const matchingCategories = useCatalogCategories(companyId, lookupTnved);
    const availableCategories = (
        lookupConfirmed ? (matchingCategories.data ?? []) : []
    ).filter(
        (c) =>
            c.isActive &&
            categories.some((oil) => oil.id === c.id && oil.isActive),
    );
    const categoryMatches = availableCategories.some(
        (c) => c.id === categoryId,
    );
    const { required, activated } = catalogRequirements(model, values);
    const completion = catalogLayerCompletion(model, values);
    const visible = model.filter(
        (a) =>
            !isCoreCatalogAttribute(a.id, values.tnved) &&
            (a.requirement !== "b" || activated.has(a.id)),
    );
    const locked = sentRequest !== null;
    const lookupCategories = () => {
        if (!validTnved || locked || matchingCategories.isFetching) return;
        if (lookupTnved === tnved) void matchingCategories.refetch();
        else setLookupTnved(tnved);
    };
    const submit = async (request: CatalogCardRequest) => {
        if (inFlight.current) return;
        inFlight.current = true;
        setSentRequest(request);
        setRecoveryNotice("");
        setReceiptError("");
        try {
            if (submissionId) {
                const receipt = await update.mutateAsync(request);
                if (receipt.state === "Rejected") {
                    setReceiptError(
                        receipt.error ??
                            t("honestSign.catalog.workflow.rejected"),
                    );
                    requestId.current = crypto.randomUUID();
                    setSentRequest(null);
                    setRecoveryNotice("editableAfterError");
                } else onUpdated?.(receipt);
            } else onSubmitted(await create.mutateAsync(request));
        } catch (error) {
            // A failed validation must not lose the form. Network ambiguity must not unlock another payload.
            try {
                const receipt = submissionId
                    ? await catalogApiService.operation(
                          submissionId,
                          request.requestId,
                      )
                    : await catalogApiService.findSubmission(request.requestId);
                if (canEditCatalogFailure(getHttpErrorStatus(error), receipt)) {
                    requestId.current = crypto.randomUUID();
                    setSentRequest(null);
                    setRecoveryNotice("editableAfterError");
                } else if (!submissionId && receipt && "gtin" in receipt)
                    onSubmitted(receipt);
                else setRecoveryNotice("unknownAfterError");
            } catch {
                setRecoveryNotice("unknownAfterError");
            }
        } finally {
            inFlight.current = false;
        }
    };
    const coreFields = ["tnved", "gtin", "name", "brand", "photoUrl"] as const;
    return (
        <form
            className="space-y-6"
            noValidate
            onSubmit={form.handleSubmit((v) =>
                submit(
                    sentRequest ??
                        buildCatalogCardRequest(v, model, requestId.current),
                ),
            )}
        >
            <Notice>{t("honestSign.catalog.scopeNotice")}</Notice>
            {declaration && !initialCard && <Notice>
                <p>Декларация {declaration.reference}: {declaration.registrationNumber || 'регистрационный номер не указан'}{declaration.adoptedAt ? ` от ${declaration.adoptedAt}` : ''}.</p>
                <Button type="button" variant="outline" className="mt-2" disabled={Boolean(sentRequest)} onClick={() => {
                    form.setValue('name', declaration.product.name, { shouldDirty: true });
                    form.setValue('tnved', declaration.product.tnVed, { shouldDirty: true });
                    if (declaration.product.gtin) form.setValue('gtin', declaration.product.gtin, { shouldDirty: true });
                    // The provider's current attribute model identifies the declaration field; never guess an attribute ID.
                    const permit = model.find(attribute => [23555, 23890, 23561, 23557].includes(attribute.id) && /декларац/i.test(attribute.name));
                    if (permit && declaration.registrationNumber && declaration.adoptedAt) form.setValue(`attributes.attr_${permit.id}`, [{ value: `${declaration.registrationNumber}:::${declaration.adoptedAt}`, valueType: '' }], { shouldDirty: true });
                }}>Подставить данные декларации</Button>
            </Notice>}
            <p className="text-sm text-muted-foreground">
                {t("honestSign.catalog.oilsModelHint")}
            </p>
            <fieldset
                className="grid min-w-0 gap-4 md:grid-cols-2"
                disabled={locked}
            >
                <legend className="mb-3 text-sm font-semibold">
                    {t("honestSign.catalog.basicData")}
                </legend>
                {coreFields.map((field) => (
                    <FormField
                        key={field}
                        label={`${t(`honestSign.catalog.${field}`)}${field !== "photoUrl" ? " *" : ""}`}
                        htmlFor={`${idPrefix}-${field}`}
                    >
                        <Input
                            id={`${idPrefix}-${field}`}
                            {...form.register(
                                field,
                                field === "tnved"
                                    ? {
                                          onChange: () => {
                                              form.setValue("categoryId", "");
                                              form.setValue("attributes", {});
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
                                    ? 14
                                    : field === "tnved"
                                      ? 10
                                      : field === "name"
                                        ? 1000
                                        : field === "brand"
                                          ? 255
                                          : 2048
                            }
                            type={field === "photoUrl" ? "url" : "text"}
                            readOnly={Boolean(submissionId && field === "gtin")}
                            onKeyDown={(event) => {
                                if (
                                    field === "tnved" &&
                                    event.key === "Enter"
                                ) {
                                    event.preventDefault();
                                    lookupCategories();
                                }
                            }}
                            aria-invalid={Boolean(form.formState.errors[field])}
                            aria-describedby={`${idPrefix}-${field}-help`}
                        />
                        <div
                            id={`${idPrefix}-${field}-help`}
                            className="text-xs"
                        >
                            {form.formState.errors[field]?.message ? (
                                <p role="alert" className="text-destructive">
                                    {form.formState.errors[field]?.message}
                                </p>
                            ) : (
                                ["gtin", "tnved", "photoUrl"].includes(
                                    field,
                                ) && (
                                    <p className="text-muted-foreground">
                                        {t(`honestSign.catalog.${field}Help`)}
                                    </p>
                                )
                            )}
                        </div>
                        {field === "tnved" && (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                    locked ||
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
                            form.setValue("categoryId", e.target.value);
                            form.setValue("attributes", {});
                            setCategoryId(Number(e.target.value));
                        }}
                    >
                        <option value="">
                            {t("honestSign.catalog.selectCategory")}
                        </option>
                        {availableCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name} · {c.id}
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
            {categoryId > 0 && (
                <section
                    className="space-y-4 border-t pt-4"
                    aria-label={t("honestSign.catalog.characteristics")}
                >
                    <div>
                        <h3 className="font-semibold">
                            {t("honestSign.catalog.characteristics")}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                            {t("honestSign.catalog.characteristicsHelp")}
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
                            <div className="grid min-w-0 gap-6 md:grid-cols-2">
                                {visible.map((a) => (
                                    <CatalogAttributeFields
                                        key={`${categoryId}-${a.id}`}
                                        idPrefix={idPrefix}
                                        attribute={a}
                                        form={form}
                                        required={required.has(a.id)}
                                        disabled={locked}
                                    />
                                ))}
                                {visible.length === 0 && (
                                    <p className="text-sm text-muted-foreground">
                                        {t("honestSign.catalog.noAttributes")}
                                    </p>
                                )}
                            </div>
                        </>
                    )}
                </section>
            )}
            <div className="space-y-3 border-t pt-4">
                <FormField
                    htmlFor={`${idPrefix}-mode`}
                    label={t("honestSign.catalog.submissionMode")}
                >
                    <Select
                        id={`${idPrefix}-mode`}
                        value={values.sendToModeration ? "moderation" : "draft"}
                        disabled={locked}
                        onChange={(e) =>
                            form.setValue(
                                "sendToModeration",
                                e.target.value === "moderation",
                            )
                        }
                    >
                        <option value="draft">
                            {t("honestSign.catalog.draft")}
                        </option>
                        <option value="moderation">
                            {t("honestSign.catalog.moderation")}
                        </option>
                    </Select>
                </FormField>
                <p className="text-sm text-muted-foreground">
                    {t("honestSign.catalog.publicationNotice")}
                </p>
                {(mutation.isError || receiptError) && (
                    <Notice variant="error" role="alert">
                        <p>{receiptError || mutation.error?.message}</p>
                        <p className="mt-2">
                            {t("honestSign.catalog.retryNotice")}
                        </p>
                    </Notice>
                )}
                {recoveryNotice && (
                    <Notice>
                        {t(`honestSign.catalog.workflow.${recoveryNotice}`)}
                    </Notice>
                )}
                <div className="flex flex-wrap gap-3">
                    {!locked && (
                        <Button
                            type="submit"
                            disabled={
                                !categoryId ||
                                !categoryMatches ||
                                matchingCategories.isFetching ||
                                matchingCategories.isError ||
                                attributes.isPending ||
                                attributes.isError ||
                                attributes.isFetching ||
                                form.formState.isSubmitting
                            }
                        >
                            {form.formState.isSubmitting ? (
                                <Loader2
                                    className="size-4 animate-spin motion-reduce:animate-none"
                                    aria-hidden="true"
                                />
                            ) : (
                                <Send className="size-4" aria-hidden="true" />
                            )}
                            {t(
                                submissionId
                                    ? "honestSign.catalog.workflow.saveChanges"
                                    : values.sendToModeration
                                      ? "honestSign.catalog.submitModeration"
                                      : "honestSign.catalog.createDraft",
                            )}
                        </Button>
                    )}
                    {locked && mutation.isError && (
                        <Button
                            type="button"
                            disabled={mutation.isPending}
                            onClick={() => void submit(sentRequest)}
                        >
                            {t("honestSign.catalog.retrySameRequest")}
                        </Button>
                    )}
                    {locked && !submissionId && (
                        <Button
                            type="button"
                            variant="outline"
                            disabled={mutation.isPending}
                            onClick={() => {
                                form.reset(emptyCatalogForm);
                                setCategoryId(0);
                                setLookupTnved("");
                                setSentRequest(null);
                                requestId.current = crypto.randomUUID();
                                create.reset();
                                setRecoveryNotice("");
                                setReceiptError("");
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
