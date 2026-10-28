import { useController } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Input } from "@marking/components/ui/input";
import { Label } from "@marking/components/ui/label";
import {
    formatCatalogPermit,
    splitCatalogPermit,
} from "@marking/lib/honest-sign/catalogForm";

import type { CatalogFormValues } from "@marking/lib/honest-sign/catalogForm";
import type { Control } from "react-hook-form";

export function CatalogPermitFields({
    control,
    name,
    id,
    disabled,
    invalid,
}: {
    control: Control<CatalogFormValues>;
    name: `attributes.${string}.${number}.value`;
    id: string;
    disabled: boolean;
    invalid: boolean;
}) {
    const { t } = useTranslation();
    const { field } = useController({ control, name, defaultValue: "" });
    const value = splitCatalogPermit(field.value);
    return (
        <div
            className="grid min-w-0 gap-2 sm:grid-cols-2"
            role="group"
            aria-labelledby={`${id}-label`}
        >
            <div className="min-w-0 space-y-1">
                <Label htmlFor={id}>
                    {t("honestSign.catalog.permitNumber")}
                </Label>
                <Input
                    id={id}
                    ref={field.ref}
                    value={value.number}
                    disabled={disabled}
                    maxLength={3987}
                    autoComplete="off"
                    aria-invalid={invalid}
                    aria-describedby={`${id}-help`}
                    onBlur={field.onBlur}
                    onChange={(e) =>
                        field.onChange(
                            formatCatalogPermit(e.target.value, value.date),
                        )
                    }
                />
            </div>
            <div className="min-w-0 space-y-1">
                <Label htmlFor={`${id}-date`}>
                    {t("honestSign.catalog.permitDate")}
                </Label>
                <Input
                    id={`${id}-date`}
                    type="date"
                    value={value.date}
                    disabled={disabled}
                    aria-invalid={invalid}
                    aria-describedby={`${id}-help`}
                    onBlur={field.onBlur}
                    onChange={(e) =>
                        field.onChange(
                            formatCatalogPermit(value.number, e.target.value),
                        )
                    }
                />
            </div>
        </div>
    );
}
