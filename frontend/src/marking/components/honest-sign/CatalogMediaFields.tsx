import { Plus, X } from "lucide-react";
import { useFieldArray } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { FormField } from "@marking/components/honest-sign/ui/form-field";
import { Select } from "@marking/components/honest-sign/ui/select";
import { Button } from "@marking/components/ui/button";
import { Input } from "@marking/components/ui/input";
import { Textarea } from "@marking/components/ui/textarea";
import {
    catalogPackagingScopes,
    catalogPhotoTypes,
} from "@marking/lib/honest-sign/catalogForm";

import type { CatalogFormValues } from "@marking/lib/honest-sign/catalogForm";
import type { UseFormReturn } from "react-hook-form";

export function CatalogMediaFields({
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
    const images = useFieldArray({ control: form.control, name: "images" });
    const scopes = [
        values.gtin,
        ...catalogPackagingScopes(values).map((scope) => scope.value),
    ].filter((gtin) => gtin && !gtin.startsWith("generated:"));
    return (
        <div className="space-y-4">
            {images.fields.map((field, index) => {
                const urlsError = form.getFieldState(
                    `images.${index}.urls`,
                    form.formState,
                ).error?.message;
                const scopeError = form.getFieldState(
                    `images.${index}.identifier`,
                    form.formState,
                ).error?.message;
                return (
                    <fieldset
                        key={field.id}
                        className="space-y-3 rounded-md border p-3"
                        disabled={disabled}
                    >
                        <legend className="px-1 text-sm font-medium">
                            {t("honestSign.catalog.imageNumber", {
                                number: index + 1,
                            })}
                        </legend>
                        <div className="grid min-w-0 gap-3 md:grid-cols-2">
                            <FormField
                                label={t("honestSign.catalog.imageType")}
                                htmlFor={`${idPrefix}-image-type-${index}`}
                            >
                                <Select
                                    id={`${idPrefix}-image-type-${index}`}
                                    {...form.register(
                                        `images.${index}.photoType`,
                                    )}
                                >
                                    {catalogPhotoTypes.map((type) => (
                                        <option key={type} value={type}>
                                            {t(
                                                `honestSign.catalog.photoTypes.${type}`,
                                            )}
                                        </option>
                                    ))}
                                </Select>
                            </FormField>
                            <FormField
                                label={t("honestSign.catalog.attributeScope")}
                                htmlFor={`${idPrefix}-image-scope-${index}`}
                            >
                                <Select
                                    id={`${idPrefix}-image-scope-${index}`}
                                    {...form.register(
                                        `images.${index}.identifier`,
                                    )}
                                    aria-invalid={Boolean(scopeError)}
                                >
                                    <option value="">
                                        {t("honestSign.catalog.cardScope")}
                                    </option>
                                    {[...new Set(scopes)].map((gtin) => (
                                        <option
                                            key={gtin}
                                            value={gtin.padStart(14, "0")}
                                        >
                                            {gtin.padStart(14, "0")}
                                        </option>
                                    ))}
                                </Select>
                                {scopeError && (
                                    <p
                                        role="alert"
                                        className="text-xs text-destructive"
                                    >
                                        {scopeError}
                                    </p>
                                )}
                            </FormField>
                        </div>
                        <FormField
                            label={t(
                                values.images[index]?.photoType === "3ds"
                                    ? "honestSign.catalog.imageUrls"
                                    : "honestSign.catalog.photoUrl",
                            )}
                            htmlFor={`${idPrefix}-image-urls-${index}`}
                        >
                            {values.images[index]?.photoType === "3ds" ? (
                                <Textarea
                                    id={`${idPrefix}-image-urls-${index}`}
                                    {...form.register(`images.${index}.urls`)}
                                    aria-invalid={Boolean(urlsError)}
                                />
                            ) : (
                                <Input
                                    id={`${idPrefix}-image-urls-${index}`}
                                    {...form.register(`images.${index}.urls`)}
                                    type="url"
                                    maxLength={2048}
                                    aria-invalid={Boolean(urlsError)}
                                />
                            )}
                            {urlsError && (
                                <p
                                    role="alert"
                                    className="text-xs text-destructive"
                                >
                                    {urlsError}
                                </p>
                            )}
                        </FormField>
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => images.remove(index)}
                            disabled={disabled}
                        >
                            <X className="size-4" aria-hidden="true" />
                            {t("honestSign.catalog.removeImage")}
                        </Button>
                    </fieldset>
                );
            })}
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={
                    disabled ||
                    !values.gtin ||
                    images.fields.length + (values.photoUrl.trim() ? 1 : 0) >=
                        100
                }
                onClick={() =>
                    images.append({
                        photoType: "default",
                        urls: "",
                        identifier: "",
                    })
                }
            >
                <Plus className="size-4" aria-hidden="true" />
                {t("honestSign.catalog.addImage")}
            </Button>
        </div>
    );
}
