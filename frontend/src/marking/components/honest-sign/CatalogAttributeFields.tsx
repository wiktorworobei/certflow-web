import { Plus, X } from "lucide-react";
import { useFormState, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { CatalogPermitFields } from "@marking/components/honest-sign/CatalogPermitFields";
import { Select } from "@marking/components/honest-sign/ui/select";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Input } from "@marking/components/ui/input";
import { Label } from "@marking/components/ui/label";
import {
    catalogPackagingScopes,
    isCatalogPermitAttribute,
} from "@marking/lib/honest-sign/catalogForm";

import type { CatalogFormValues } from "@marking/lib/honest-sign/catalogForm";
import type { CatalogAttribute } from "@marking/lib/honest-sign/catalogTypes";
import type { UseFormReturn } from "react-hook-form";

export function CatalogAttributeFields({
    attribute: a,
    form,
    required,
    disabled,
    idPrefix = "catalog",
    showGroupName = true,
    showLayer = true,
    scopedOnly = false,
}: {
    attribute: CatalogAttribute;
    form: UseFormReturn<CatalogFormValues>;
    required: boolean;
    disabled: boolean;
    idPrefix?: string;
    showGroupName?: boolean;
    showLayer?: boolean;
    scopedOnly?: boolean;
}) {
    const { t } = useTranslation();
    const formState = useFormState({
        control: form.control,
        name: `attributes.attr_${a.id}`,
    });
    const entries = useWatch({
        control: form.control,
        name: `attributes.attr_${a.id}`,
    }) ?? [{ value: "", valueType: "" }];
    const scopes = catalogPackagingScopes(form.getValues());
    return (
        <div className="space-y-2">
            {showGroupName && (
                <p className="text-xs text-muted-foreground">{a.groupName}</p>
            )}
            {showLayer && (a.isFirstLayer || a.isSecondLayer) && (
                <div className="flex flex-wrap gap-1">
                    {a.isFirstLayer && (
                        <Badge variant="outline">
                            {t("honestSign.catalog.firstLayer")}
                        </Badge>
                    )}
                    {a.isSecondLayer && (
                        <Badge variant="outline">
                            {t("honestSign.catalog.secondLayer")}
                        </Badge>
                    )}
                </div>
            )}
            {entries.map((entry, index) => {
                const name = `attributes.attr_${a.id}.${index}.value` as const;
                const typeName =
                    `attributes.attr_${a.id}.${index}.valueType` as const;
                const id = `${idPrefix}-attribute-${a.id}-${index}`;
                const error = form.getFieldState(name, formState).error
                    ?.message;
                return (
                    <div key={id} className="space-y-1">
                        {a.valueTypes.length === 0 && (
                            <input
                                type="hidden"
                                {...form.register(typeName)}
                                value=""
                            />
                        )}
                        <Label
                            id={`${id}-label`}
                            htmlFor={
                                isCatalogPermitAttribute(a.id) && !a.presetOnly
                                    ? undefined
                                    : id
                            }
                        >
                            {a.name}
                            {scopedOnly
                                ? ` · ${t("honestSign.catalog.packagingAttribute")}`
                                : ""}
                            {required ? " *" : ""}
                            {index > 0 ? ` (${index + 1})` : ""}
                        </Label>
                        {(scopes.length > 0 ||
                            entry.gtin ||
                            entry.packageGenerateOrder) && (
                            <div className="space-y-1">
                                <Label
                                    htmlFor={`${id}-scope`}
                                    className="text-xs text-muted-foreground"
                                >
                                    {t("honestSign.catalog.attributeScope")}
                                </Label>
                                <Select
                                    id={`${id}-scope`}
                                    disabled={disabled}
                                    value={
                                        entry.packageGenerateOrder
                                            ? `generated:${entry.packageGenerateOrder}`
                                            : (entry.gtin ?? "")
                                    }
                                    aria-invalid={Boolean(error)}
                                    aria-describedby={`${id}-help`}
                                    onChange={(event) => {
                                        const scope = event.target.value;
                                        form.setValue(
                                            `attributes.attr_${a.id}.${index}.gtin`,
                                            scope.startsWith("generated:")
                                                ? ""
                                                : scope,
                                            {
                                                shouldDirty: true,
                                                shouldValidate: true,
                                            },
                                        );
                                        form.setValue(
                                            `attributes.attr_${a.id}.${index}.packageGenerateOrder`,
                                            scope.startsWith("generated:")
                                                ? scope.slice(10)
                                                : "",
                                            {
                                                shouldDirty: true,
                                                shouldValidate: true,
                                            },
                                        );
                                    }}
                                >
                                    <option value="" disabled={scopedOnly}>
                                        {t(
                                            scopedOnly
                                                ? "honestSign.catalog.selectPackageScope"
                                                : "honestSign.catalog.cardScope",
                                        )}
                                    </option>
                                    {scopes.map((scope) => (
                                        <option
                                            key={scope.value}
                                            value={scope.value}
                                        >
                                            {t(
                                                `honestSign.catalog.packagingLevels.${scope.level}`,
                                            )}{" "}
                                            · {scope.value}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        )}
                        <div className="flex items-start gap-2">
                            <div className="min-w-0 flex-1">
                                {isCatalogPermitAttribute(a.id) &&
                                !a.presetOnly ? (
                                    <CatalogPermitFields
                                        control={form.control}
                                        name={name}
                                        id={id}
                                        disabled={disabled}
                                        invalid={Boolean(error)}
                                    />
                                ) : a.presetOnly ? (
                                    <Select
                                        id={id}
                                        {...form.register(name)}
                                        disabled={disabled}
                                        aria-invalid={Boolean(error)}
                                        aria-describedby={`${id}-help`}
                                    >
                                        <option value="">
                                            {t(
                                                "honestSign.catalog.selectValue",
                                            )}
                                        </option>
                                        {a.options.map((o) => (
                                            <option
                                                key={o.value}
                                                value={o.value}
                                            >
                                                {o.label}
                                            </option>
                                        ))}
                                    </Select>
                                ) : (
                                    <>
                                        <Input
                                            id={id}
                                            {...form.register(name)}
                                            type={
                                                a.fieldType === "date"
                                                    ? "date"
                                                    : "text"
                                            }
                                            inputMode={
                                                a.fieldType === "number"
                                                    ? "decimal"
                                                    : undefined
                                            }
                                            list={
                                                a.options.length
                                                    ? `${id}-options`
                                                    : undefined
                                            }
                                            maxLength={4000}
                                            disabled={disabled}
                                            aria-invalid={Boolean(error)}
                                            aria-describedby={`${id}-help`}
                                        />
                                        {a.options.length > 0 && (
                                            <datalist id={`${id}-options`}>
                                                {a.options.map((o) => (
                                                    <option
                                                        key={o.value}
                                                        value={o.value}
                                                    >
                                                        {o.label}
                                                    </option>
                                                ))}
                                            </datalist>
                                        )}
                                    </>
                                )}
                            </div>
                            {a.valueTypes.length > 0 && (
                                <div className="w-32 shrink-0">
                                    <Label
                                        htmlFor={`${id}-type`}
                                        className="sr-only"
                                    >
                                        {t("honestSign.catalog.valueType")}
                                    </Label>
                                    <Select
                                        id={`${id}-type`}
                                        {...form.register(typeName, {
                                            onChange: () =>
                                                form.trigger(
                                                    `attributes.attr_${a.id}`,
                                                ),
                                        })}
                                        disabled={disabled}
                                        aria-invalid={Boolean(error)}
                                    >
                                        <option value="">
                                            {t("honestSign.catalog.valueType")}
                                        </option>
                                        {a.valueTypes.map((v) => (
                                            <option key={v} value={v}>
                                                {v}
                                            </option>
                                        ))}
                                    </Select>
                                </div>
                            )}
                            {index > 0 && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    disabled={disabled}
                                    aria-label={t(
                                        "honestSign.catalog.removeValue",
                                        { name: a.name },
                                    )}
                                    onClick={() =>
                                        form.setValue(
                                            `attributes.attr_${a.id}`,
                                            entries.filter(
                                                (__, i) => i !== index,
                                            ),
                                            {
                                                shouldValidate: true,
                                                shouldDirty: true,
                                            },
                                        )
                                    }
                                >
                                    <X className="size-4" aria-hidden="true" />
                                </Button>
                            )}
                        </div>
                        <div id={`${id}-help`} className="text-xs">
                            {error ? (
                                <p role="alert" className="text-destructive">
                                    {error}
                                </p>
                            ) : (
                                <p className="text-muted-foreground">
                                    {t("honestSign.catalog.attributeId", {
                                        id: a.id,
                                    })}
                                </p>
                            )}
                            {a.hasUnsupportedDictionary && (
                                <p className="text-muted-foreground">
                                    {t(
                                        "honestSign.catalog.unsupportedDictionary",
                                    )}
                                </p>
                            )}
                            {isCatalogPermitAttribute(a.id) && (
                                <p className="text-muted-foreground">
                                    {t("honestSign.catalog.permitFormat")}
                                </p>
                            )}
                        </div>
                    </div>
                );
            })}
            {(a.isMultiple || scopes.length > 0) && (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={disabled || entries.length >= 500}
                    onClick={() =>
                        form.setValue(
                            `attributes.attr_${a.id}`,
                            [...entries, { value: "", valueType: "" }],
                            { shouldDirty: true },
                        )
                    }
                >
                    <Plus className="size-3.5" aria-hidden="true" />
                    {t("honestSign.catalog.addValue")}
                </Button>
            )}
        </div>
    );
}
