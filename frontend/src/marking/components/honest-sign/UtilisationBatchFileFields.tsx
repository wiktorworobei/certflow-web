import { CheckCircle2, FileText, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { CIS_TYPE_MAP } from "@marking/components/honest-sign/constants";
import { FormField } from "@marking/components/honest-sign/ui/form-field";
import { Select } from "@marking/components/honest-sign/ui/select";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Input } from "@marking/components/ui/input";
import { validateUtilisationBatchFile } from "@marking/lib/honest-sign/utilisationBatch";
import {
    getDefaultUtilisationExpirationMode,
    requiresUtilisationDates,
} from "@marking/lib/honest-sign/utilisationReport";

import type { UtilisationBatchDraftFile } from "@marking/lib/honest-sign/utilisationBatch";
import type {
    UtilisationCisType,
    UtilisationExpirationMode,
} from "@marking/lib/honest-sign/utilisationReport";

export function UtilisationBatchFileFields({
    file,
    index,
    productGroup,
    today,
    nowMinute,
    disabled,
    showErrors,
    checked,
    invalidCodes,
    onChange,
    onRemove,
}: {
    file: UtilisationBatchDraftFile;
    index: number;
    productGroup: string;
    today: string;
    nowMinute: string;
    disabled: boolean;
    showErrors: boolean;
    checked: boolean;
    invalidCodes: number;
    onChange: (patch: Partial<UtilisationBatchDraftFile>) => void;
    onRemove: () => void;
}) {
    const { t } = useTranslation();
    const valid = validateUtilisationBatchFile(
        file,
        productGroup,
        today,
        nowMinute,
    );
    const required = requiresUtilisationDates(productGroup, file.cisType);
    const omitDates = productGroup === "milk" && file.cisType !== "UNIT";
    const fieldId = (name: string) => `batch-${file.id}-${name}`;
    const options =
        productGroup === "milk"
            ? [
                  ...(required
                      ? []
                      : [["not-specified", "expirationNotSpecified"]]),
                  ...(omitDates
                      ? []
                      : [
                            ["milk-over-72", "expirationMilkOver72"],
                            ["milk-under-72", "expirationMilkUnder72"],
                            [
                                "milk-storage-conditions",
                                "expirationStorageConditions",
                            ],
                        ]),
              ]
            : [
                  ...(required
                      ? []
                      : [["not-specified", "expirationNotSpecified"]]),
                  ["specified", "expirationSpecified"],
              ];
    return (
        <section
            className="space-y-4 rounded-xl border bg-card p-4"
            aria-labelledby={fieldId("title")}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <FileText className="size-4" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h4
                            id={fieldId("title")}
                            className="text-sm font-semibold wrap-anywhere"
                        >
                            {index + 1}. {file.name}
                        </h4>
                        <p className="mt-1 text-xs text-muted-foreground">
                            {t("honestSign.documents.batch.codeCount", {
                                count: file.codes.length,
                            })}
                        </p>
                    </div>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    disabled={disabled}
                    aria-label={t("honestSign.documents.batch.removeNamed", {
                        name: file.name,
                    })}
                    onClick={onRemove}
                >
                    <Trash2 className="size-4" aria-hidden="true" />
                </Button>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <FormField
                    label={t("honestSign.workspace.markingType")}
                    htmlFor={fieldId("cisType")}
                >
                    <Select
                        id={fieldId("cisType")}
                        disabled={disabled}
                        value={file.cisType}
                        onChange={(event) => {
                            const cisType = event.target
                                .value as UtilisationCisType;
                            onChange({
                                cisType,
                                expirationMode:
                                    getDefaultUtilisationExpirationMode(
                                        productGroup,
                                        cisType,
                                    ),
                                expirationDate: "",
                                expirationConditions: [
                                    {
                                        storageConditionIndex: "",
                                        expirationDate: "",
                                    },
                                ],
                                partNumber:
                                    cisType === "UNIT" ? file.partNumber : "",
                            });
                        }}
                    >
                        {Object.entries(CIS_TYPE_MAP).map(([label, value]) => (
                            <option key={value} value={value}>
                                {t(`honestSign.orderOptions.${label}`, {
                                    defaultValue: label,
                                })}
                            </option>
                        ))}
                    </Select>
                </FormField>
                <FormField
                    label={`${t("honestSign.documents.batch.productionDate")}${required ? " *" : ""}`}
                    htmlFor={fieldId("productionDate")}
                >
                    <Input
                        id={fieldId("productionDate")}
                        type="date"
                        required={required}
                        disabled={disabled || omitDates}
                        max={today}
                        value={file.productionDate}
                        aria-invalid={showErrors && !valid.productionDate}
                        aria-describedby={
                            showErrors && !valid.productionDate
                                ? fieldId("productionError")
                                : undefined
                        }
                        onChange={(event) =>
                            onChange({ productionDate: event.target.value })
                        }
                    />
                    {showErrors && !valid.productionDate && (
                        <p
                            id={fieldId("productionError")}
                            className="text-xs text-destructive"
                        >
                            {t(
                                "honestSign.documents.batch.errors.productionDate",
                            )}
                        </p>
                    )}
                </FormField>
                <FormField
                    label={t("honestSign.documents.expirationMode")}
                    htmlFor={fieldId("expirationMode")}
                >
                    <Select
                        id={fieldId("expirationMode")}
                        value={file.expirationMode}
                        disabled={disabled || omitDates}
                        onChange={(event) =>
                            onChange({
                                expirationMode: event.target
                                    .value as UtilisationExpirationMode,
                                expirationDate: "",
                            })
                        }
                    >
                        {options.map(([value, label]) => (
                            <option key={value} value={value}>
                                {t(`honestSign.documents.${label}`)}
                            </option>
                        ))}
                    </Select>
                </FormField>
                {!omitDates &&
                    !["not-specified", "milk-storage-conditions"].includes(
                        file.expirationMode,
                    ) && (
                        <FormField
                            label={`${t(file.expirationMode === "milk-under-72" ? "honestSign.documents.expirationDateTime" : "honestSign.documents.expirationDate")} *`}
                            htmlFor={fieldId("expirationDate")}
                        >
                            <Input
                                id={fieldId("expirationDate")}
                                type={
                                    file.expirationMode === "milk-under-72"
                                        ? "datetime-local"
                                        : "date"
                                }
                                required
                                disabled={disabled}
                                value={file.expirationDate}
                                aria-invalid={
                                    showErrors && !valid.expirationDate
                                }
                                aria-describedby={
                                    showErrors && !valid.expirationDate
                                        ? fieldId("expirationError")
                                        : undefined
                                }
                                onChange={(event) =>
                                    onChange({
                                        expirationDate: event.target.value,
                                    })
                                }
                            />
                            {showErrors && !valid.expirationDate && (
                                <p
                                    id={fieldId("expirationError")}
                                    className="text-xs text-destructive"
                                >
                                    {t(
                                        "honestSign.documents.batch.errors.expirationDate",
                                    )}
                                </p>
                            )}
                        </FormField>
                    )}
                {productGroup === "milk" && file.cisType === "UNIT" && (
                    <FormField
                        label={t("honestSign.documents.partNumber")}
                        htmlFor={fieldId("partNumber")}
                    >
                        <Input
                            id={fieldId("partNumber")}
                            disabled={disabled}
                            value={file.partNumber}
                            maxLength={32}
                            aria-invalid={showErrors && !valid.partNumber}
                            onChange={(event) =>
                                onChange({ partNumber: event.target.value })
                            }
                        />
                        {showErrors && !valid.partNumber && (
                            <p className="text-xs text-destructive">
                                {t("honestSign.documents.partNumberHint")}
                            </p>
                        )}
                    </FormField>
                )}
            </div>
            {!omitDates &&
                file.expirationMode === "milk-storage-conditions" && (
                    <fieldset className="space-y-3">
                        <legend className="mb-2 text-sm font-medium">
                            {t("honestSign.documents.expirationConditions")}
                        </legend>
                        {file.expirationConditions.map(
                            (condition, conditionIndex) => (
                                <div
                                    key={conditionIndex}
                                    className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto]"
                                >
                                    <FormField
                                        label={t(
                                            "honestSign.documents.storageConditionIndex",
                                        )}
                                        htmlFor={fieldId(
                                            `condition-${conditionIndex}`,
                                        )}
                                    >
                                        <Input
                                            id={fieldId(
                                                `condition-${conditionIndex}`,
                                            )}
                                            disabled={disabled}
                                            inputMode="numeric"
                                            value={
                                                condition.storageConditionIndex
                                            }
                                            onChange={(event) =>
                                                onChange({
                                                    expirationConditions:
                                                        file.expirationConditions.map(
                                                            (item, position) =>
                                                                position ===
                                                                conditionIndex
                                                                    ? {
                                                                          ...item,
                                                                          storageConditionIndex:
                                                                              event
                                                                                  .target
                                                                                  .value,
                                                                      }
                                                                    : item,
                                                        ),
                                                })
                                            }
                                        />
                                    </FormField>
                                    <FormField
                                        label={t(
                                            "honestSign.documents.expirationDate",
                                        )}
                                        htmlFor={fieldId(
                                            `condition-date-${conditionIndex}`,
                                        )}
                                    >
                                        <Input
                                            id={fieldId(
                                                `condition-date-${conditionIndex}`,
                                            )}
                                            disabled={disabled}
                                            type="date"
                                            value={condition.expirationDate}
                                            onChange={(event) =>
                                                onChange({
                                                    expirationConditions:
                                                        file.expirationConditions.map(
                                                            (item, position) =>
                                                                position ===
                                                                conditionIndex
                                                                    ? {
                                                                          ...item,
                                                                          expirationDate:
                                                                              event
                                                                                  .target
                                                                                  .value,
                                                                      }
                                                                    : item,
                                                        ),
                                                })
                                            }
                                        />
                                    </FormField>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        disabled={
                                            disabled ||
                                            file.expirationConditions.length ===
                                                1
                                        }
                                        aria-label={t(
                                            "honestSign.documents.removeExpirationCondition",
                                        )}
                                        onClick={() =>
                                            onChange({
                                                expirationConditions:
                                                    file.expirationConditions.filter(
                                                        (_, position) =>
                                                            position !==
                                                            conditionIndex,
                                                    ),
                                            })
                                        }
                                    >
                                        <Trash2
                                            className="size-4"
                                            aria-hidden="true"
                                        />
                                    </Button>
                                </div>
                            ),
                        )}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={
                                disabled ||
                                file.expirationConditions.length >= 20
                            }
                            onClick={() =>
                                onChange({
                                    expirationConditions: [
                                        ...file.expirationConditions,
                                        {
                                            storageConditionIndex: "",
                                            expirationDate: "",
                                        },
                                    ],
                                })
                            }
                        >
                            {t("honestSign.documents.addExpirationCondition")}
                        </Button>
                        {showErrors && !valid.expirationDate && (
                            <p className="text-xs text-destructive">
                                {t(
                                    "honestSign.documents.expirationConditionsHint",
                                )}
                            </p>
                        )}
                    </fieldset>
                )}
            {omitDates ? (
                <p className="text-xs text-muted-foreground">
                    {t("honestSign.documents.expirationSetHint")}
                </p>
            ) : (
                required && (
                    <p className="text-xs text-muted-foreground">
                        {t(
                            productGroup === "autofluids"
                                ? "honestSign.documents.autofluidsDatesHint"
                                : "honestSign.documents.expirationMilkHint",
                        )}
                    </p>
                )
            )}
            {checked && (
                <Badge
                    variant={invalidCodes ? "destructive" : "outline"}
                    className="gap-1.5 whitespace-normal"
                >
                    <CheckCircle2 aria-hidden="true" />
                    {t(
                        invalidCodes
                            ? "honestSign.documents.batch.checkInvalid"
                            : "honestSign.documents.batch.checkValid",
                        { count: invalidCodes || file.codes.length },
                    )}
                </Badge>
            )}
        </section>
    );
}
