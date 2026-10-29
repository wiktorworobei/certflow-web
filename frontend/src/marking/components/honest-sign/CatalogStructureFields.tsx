import { Plus, X } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormField } from "@marking/components/honest-sign/ui/form-field";
import { Select } from "@marking/components/honest-sign/ui/select";
import { Button } from "@marking/components/ui/button";
import { Input } from "@marking/components/ui/input";

import type { CatalogFormValues } from "@marking/lib/honest-sign/catalogForm";
import type { FieldPath, UseFormReturn } from "react-hook-form";

export function CatalogStructureFields({
    form,
    values,
    disabled,
    identityLocked,
    idPrefix,
}: {
    form: UseFormReturn<CatalogFormValues>;
    values: CatalogFormValues;
    disabled: boolean;
    identityLocked: boolean;
    idPrefix: string;
}) {
    const { t } = useTranslation();
    return (
        <div className="grid min-w-0 gap-4 md:grid-cols-2">
            <FormField
                label={t("honestSign.catalog.gtinMode")}
                htmlFor={`${idPrefix}-gtinMode`}
            >
                <Select
                    id={`${idPrefix}-gtinMode`}
                    {...form.register("gtinMode")}
                    disabled={disabled || identityLocked}
                    value={values.gtinMode}
                    aria-invalid={Boolean(form.formState.errors.gtinMode)}
                    onChange={(event) => {
                        const mode = event.target
                            .value as CatalogFormValues["gtinMode"];
                        form.setValue("gtinMode", mode, { shouldDirty: true });
                        form.setValue("gtin", "", { shouldDirty: true });
                        if (
                            mode === "industrial" &&
                            values.composition === "kit"
                        )
                            form.setValue("composition", "single", {
                                shouldDirty: true,
                            });
                    }}
                >
                    {["existing", "technical", "industrial"].map((mode) => (
                        <option key={mode} value={mode}>
                            {t(`honestSign.catalog.gtinModes.${mode}`)}
                        </option>
                    ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                    {t(`honestSign.catalog.gtinModeHelp.${values.gtinMode}`)}
                </p>
                {form.formState.errors.gtinMode?.message && (
                    <p className="text-xs text-destructive" role="alert">
                        {form.formState.errors.gtinMode.message}
                    </p>
                )}
            </FormField>
            <FormField
                label={t("honestSign.catalog.composition")}
                htmlFor={`${idPrefix}-composition`}
            >
                <Select
                    id={`${idPrefix}-composition`}
                    {...form.register("composition")}
                    value={values.composition}
                    disabled={disabled || identityLocked}
                    aria-invalid={Boolean(form.formState.errors.composition)}
                    onChange={(event) => {
                        form.setValue(
                            "composition",
                            event.target
                                .value as CatalogFormValues["composition"],
                            { shouldDirty: true },
                        );
                        if (event.target.value !== "set")
                            form.setValue("setGtins", [], {
                                shouldDirty: true,
                            });
                    }}
                >
                    {["single", "kit", "set"].map((kind) => (
                        <option
                            key={kind}
                            value={kind}
                            disabled={
                                kind === "kit" &&
                                values.gtinMode === "industrial"
                            }
                        >
                            {t(`honestSign.catalog.compositions.${kind}`)}
                        </option>
                    ))}
                </Select>
                {form.formState.errors.composition?.message && (
                    <p className="text-xs text-destructive" role="alert">
                        {form.formState.errors.composition.message}
                    </p>
                )}
            </FormField>
        </div>
    );
}

export function CatalogPackagingFields({
    form,
    values,
    disabled,
    idPrefix,
}: {
    form: UseFormReturn<CatalogFormValues>;
    values: CatalogFormValues;
    disabled: boolean;
    idPrefix: string;
}) {
    const { t } = useTranslation();
    const identifiers = useFieldArray({
        control: form.control,
        name: "identifiers",
    });
    const contents = useFieldArray({ control: form.control, name: "setGtins" });
    const input = (
        name: FieldPath<CatalogFormValues>,
        label: string,
        numeric = false,
    ) => {
        const error = form.getFieldState(name, form.formState).error?.message;
        const id = `${idPrefix}-${name.replaceAll(".", "-")}`;
        return (
            <FormField
                key={name}
                label={t(`honestSign.catalog.${label}`)}
                htmlFor={id}
            >
                <Input
                    id={id}
                    {...form.register(name)}
                    disabled={disabled}
                    inputMode={numeric ? "numeric" : undefined}
                    aria-invalid={Boolean(error)}
                    aria-describedby={`${id}-error`}
                />
                <p
                    id={`${id}-error`}
                    role={error ? "alert" : undefined}
                    className="text-xs text-destructive"
                >
                    {typeof error === 'string' ? error : null}
                </p>
            </FormField>
        );
    };
    const canPackage = Boolean(values.gtin);
    return (
        <div className="space-y-5 border-t pt-4">
            <div>
                <h3 className="font-semibold">
                    {t("honestSign.catalog.packagingTitle")}
                </h3>
                <p className="text-sm text-muted-foreground">
                    {t("honestSign.catalog.packagingHelp")}
                </p>
            </div>
            <div className="grid min-w-0 gap-3 md:grid-cols-3">
                <FormField
                    label={t("honestSign.catalog.baseLevel")}
                    htmlFor={`${idPrefix}-baseLevel`}
                >
                    <Select
                        id={`${idPrefix}-baseLevel`}
                        {...form.register("baseLevel")}
                        disabled={
                            disabled ||
                            (!values.gtin && values.gtinMode !== "existing")
                        }
                        onChange={(event) => {
                            form.setValue(
                                "baseLevel",
                                event.target
                                    .value as CatalogFormValues["baseLevel"],
                                { shouldDirty: true },
                            );
                            if (event.target.value === "trade-unit")
                                form.setValue("baseMultiplier", "1", {
                                    shouldDirty: true,
                                });
                        }}
                    >
                        {["trade-unit", "inner-pack", "box"].map((level) => (
                            <option key={level} value={level}>
                                {t(
                                    `honestSign.catalog.packagingLevels.${level}`,
                                )}
                            </option>
                        ))}
                    </Select>
                </FormField>
                {input("baseMultiplier", "packageMultiplier", true)}
                <FormField
                    label={t("honestSign.catalog.baseUnit")}
                    htmlFor={`${idPrefix}-unit`}
                >
                    <Select
                        id={`${idPrefix}-unit`}
                        {...form.register("unit")}
                        disabled={disabled}
                    >
                        <option value="шт">
                            {t("honestSign.catalog.unitPieces")}
                        </option>
                    </Select>
                </FormField>
            </div>
            {!canPackage && values.gtinMode !== "existing" && (
                <p className="text-sm text-muted-foreground">
                    {t("honestSign.catalog.generatedPackagingAfterIdentity")}
                </p>
            )}
            {identifiers.fields.map((field, index) => (
                <fieldset
                    key={field.id}
                    className="space-y-3 rounded-md border p-3"
                    disabled={disabled}
                >
                    <legend className="px-1 text-sm font-medium">
                        {t("honestSign.catalog.packageNumber", {
                            number: index + 1,
                        })}
                    </legend>
                    <div className="grid min-w-0 gap-3 md:grid-cols-2">
                        {input(
                            `identifiers.${index}.gtin`,
                            "packageGtin",
                            true,
                        )}
                        <FormField
                            label={t("honestSign.catalog.packageLevel")}
                            htmlFor={`${idPrefix}-package-level-${index}`}
                        >
                            <Select
                                id={`${idPrefix}-package-level-${index}`}
                                {...form.register(`identifiers.${index}.level`)}
                                disabled={disabled}
                                onChange={(event) => {
                                    form.setValue(
                                        `identifiers.${index}.level`,
                                        event.target
                                            .value as CatalogFormValues["baseLevel"],
                                        { shouldDirty: true },
                                    );
                                    if (event.target.value === "trade-unit")
                                        form.setValue(
                                            `identifiers.${index}.multiplier`,
                                            "1",
                                            { shouldDirty: true },
                                        );
                                }}
                            >
                                {["trade-unit", "inner-pack", "box"].map(
                                    (level) => (
                                        <option key={level} value={level}>
                                            {t(
                                                `honestSign.catalog.packagingLevels.${level}`,
                                            )}
                                        </option>
                                    ),
                                )}
                            </Select>
                        </FormField>
                        {input(
                            `identifiers.${index}.multiplier`,
                            "packageMultiplier",
                            true,
                        )}
                        <FormField
                            label={t("honestSign.catalog.packageUnit")}
                            htmlFor={`${idPrefix}-package-unit-${index}`}
                        >
                            <Select
                                id={`${idPrefix}-package-unit-${index}`}
                                {...form.register(`identifiers.${index}.unit`)}
                                disabled={disabled}
                            >
                                <option value="шт">
                                    {t("honestSign.catalog.unitPieces")}
                                </option>
                                <option value="">
                                    {t("honestSign.catalog.unitUnspecified")}
                                </option>
                            </Select>
                        </FormField>
                        {values.gtinMode === "industrial" &&
                            values.gtin &&
                            values.identifiers[index]?.level === "inner-pack" &&
                            input(
                                `identifiers.${index}.packageGenerateOrder`,
                                "packageGenerateOrder",
                                true,
                            )}
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled}
                        onClick={() => identifiers.remove(index)}
                    >
                        <X className="size-4" aria-hidden="true" />
                        {t("honestSign.catalog.removePackage")}
                    </Button>
                </fieldset>
            ))}
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                    disabled || !canPackage || identifiers.fields.length >= 499
                }
                onClick={() =>
                    identifiers.append({
                        gtin: "",
                        level: "inner-pack",
                        multiplier: "1",
                        unit: "шт",
                        packageGenerateOrder: "",
                    })
                }
            >
                <Plus className="size-4" aria-hidden="true" />
                {t("honestSign.catalog.addPackage")}
            </Button>
            {values.composition === "set" && (
                <section
                    className="space-y-3 border-t pt-4"
                    aria-label={t("honestSign.catalog.setContents")}
                >
                    <h3 className="font-semibold">
                        {t("honestSign.catalog.setContents")}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        {t(
                            values.gtinMode === "industrial"
                                ? "honestSign.catalog.industrialSetHelp"
                                : "honestSign.catalog.setContentsHelp",
                        )}
                    </p>
                    {form.getFieldState("setGtins", form.formState).error
                        ?.message && (
                        <p className="text-xs text-destructive" role="alert">
                            {
                                form.getFieldState("setGtins", form.formState)
                                    .error?.message
                            }
                        </p>
                    )}
                    {contents.fields.map((field, index) => (
                        <div
                            key={field.id}
                            className="grid min-w-0 items-start gap-3 rounded-md border p-3 md:grid-cols-[1fr_1fr_auto]"
                        >
                            {input(
                                `setGtins.${index}.gtin`,
                                "componentGtin",
                                true,
                            )}
                            {input(
                                `setGtins.${index}.quantity`,
                                "componentQuantity",
                                true,
                            )}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={disabled}
                                onClick={() => contents.remove(index)}
                                aria-label={t(
                                    "honestSign.catalog.removeComponent",
                                    { number: index + 1 },
                                )}
                            >
                                <X className="size-4" aria-hidden="true" />
                            </Button>
                        </div>
                    ))}
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || contents.fields.length >= 1000}
                        onClick={() =>
                            contents.append({ gtin: "", quantity: "1" })
                        }
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        {t("honestSign.catalog.addComponent")}
                    </Button>
                </section>
            )}
        </div>
    );
}
