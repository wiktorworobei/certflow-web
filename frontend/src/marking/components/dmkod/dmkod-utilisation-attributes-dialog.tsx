import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { enUS, ru } from "react-day-picker/locale";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { Button } from "@marking/components/ui/button";
import { Calendar } from "@marking/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@marking/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@marking/components/ui/form";
import { Input } from "@marking/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@marking/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@marking/components/ui/select";
import {
    formatDmKodAttributeDate,
    parseDmKodAttributeDate,
    dmKodAttributeCalendarDate,
    dmKodAttributeCalendarValue,
} from "@marking/lib/dmkod-utilisation-attributes";
import { dmKodCalendarDate } from "@marking/lib/dmkod-utilisation-policy";

import type { DmKodAttributeValues } from "@marking/lib/dmkod-utilisation-attributes";

type Props = {
    value: DmKodAttributeValues;
    kpps: { value: string; address: string | null }[];
    fiasUuids: { value: string; address: string | null }[];
    onSave: (value: DmKodAttributeValues) => void;
    onClose: () => void;
    loading: boolean;
    loadError: boolean;
    onRetry: () => void;
};

/** Edits a local draft; only the outer Details form sends the mutation to DMkod. */
export function DmKodUtilisationAttributesDialog({
    value,
    kpps,
    fiasUuids,
    onSave,
    onClose,
    loading,
    loadError,
    onRetry,
}: Props) {
    const { t, i18n } = useTranslation();
    const today = dmKodCalendarDate();
    const todayDate = dmKodAttributeCalendarDate(today)!;
    const [calendarOpen, setCalendarOpen] = useState<
        "productionDate" | "expirationDate" | null
    >(null);
    const validDate = (value: string) =>
        parseDmKodAttributeDate(value) !== null;
    const schema = z.object({
        productionDate: z
            .string()
            .refine(validDate, t("dmkod.cabinet.attributeForm.dateInvalid"))
            .refine((value) => {
                const date = parseDmKodAttributeDate(value);
                return !date || date <= today;
            }, t("dmkod.utilisation.validation.productionDate")),
        expirationDate: z
            .string()
            .refine(validDate, t("dmkod.cabinet.attributeForm.dateInvalid"))
            .refine((value) => {
                const date = parseDmKodAttributeDate(value);
                return !date || date >= today;
            }, t("dmkod.utilisation.validation.expirationDate")),
        kpp: z
            .string()
            .refine(
                (value) =>
                    !value || kpps.some((choice) => choice.value === value),
                t("dmkod.cabinet.attributeForm.chooseFromList"),
            ),
        fiasUuid: z
            .string()
            .refine(
                (value) =>
                    !value ||
                    fiasUuids.some((choice) => choice.value === value),
                t("dmkod.cabinet.attributeForm.chooseFromList"),
            ),
        seriesNumber: z
            .string()
            .trim()
            .max(20, t("dmkod.utilisation.validation.seriesNumber")),
        batchNumber: z
            .string()
            .trim()
            .max(49, t("dmkod.utilisation.validation.batchNumber")),
    });
    const form = useForm<DmKodAttributeValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            ...value,
            productionDate: formatDmKodAttributeDate(value.productionDate),
            expirationDate: formatDmKodAttributeDate(value.expirationDate),
        },
    });
    return (
        <Dialog
            open
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent className="integration-theme dmkod-theme max-h-[90svh] overflow-y-auto sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="uppercase">
                        {t("dmkod.cabinet.activity.attributes")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("dmkod.cabinet.attributeForm.description")}
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form
                        className="min-w-0 space-y-4"
                        noValidate
                        onSubmit={(event) => {
                            event.stopPropagation();
                            if (loading || loadError) {
                                event.preventDefault();
                                return;
                            }
                            void form.handleSubmit((values) =>
                                onSave({
                                    ...values,
                                    productionDate: parseDmKodAttributeDate(
                                        values.productionDate,
                                    )!,
                                    expirationDate: parseDmKodAttributeDate(
                                        values.expirationDate,
                                    )!,
                                }),
                            )(event);
                        }}
                    >
                        <div className="grid gap-4 sm:grid-cols-2">
                            {(
                                ["productionDate", "expirationDate"] as const
                            ).map((name) => (
                                <FormField
                                    key={name}
                                    control={form.control}
                                    name={name}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                {t(
                                                    `dmkod.utilisation.fields.${name}`,
                                                )}
                                            </FormLabel>
                                            <div className="flex min-w-0 gap-1">
                                                <FormControl>
                                                    <Input
                                                        {...field}
                                                        className="min-w-0"
                                                        type="text"
                                                        inputMode="numeric"
                                                        autoComplete="off"
                                                        maxLength={10}
                                                        placeholder={t(
                                                            "dmkod.cabinet.attributeForm.datePlaceholder",
                                                        )}
                                                    />
                                                </FormControl>
                                                <Popover
                                                    open={calendarOpen === name}
                                                    onOpenChange={(open) =>
                                                        setCalendarOpen(
                                                            open ? name : null,
                                                        )
                                                    }
                                                >
                                                    <PopoverTrigger asChild>
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            className="shrink-0"
                                                            aria-label={t(
                                                                "dmkod.cabinet.attributeForm.openCalendar",
                                                                {
                                                                    field: t(
                                                                        `dmkod.utilisation.fields.${name}`,
                                                                    ),
                                                                },
                                                            )}
                                                        >
                                                            <CalendarDays aria-hidden="true" />
                                                        </Button>
                                                    </PopoverTrigger>
                                                    <PopoverContent
                                                        align="end"
                                                        className="integration-theme dmkod-theme w-auto max-w-[calc(100vw-2rem)] p-0"
                                                    >
                                                        <Calendar
                                                            mode="single"
                                                            required
                                                            autoFocus
                                                            locale={
                                                                i18n.language.startsWith(
                                                                    "ru",
                                                                )
                                                                    ? ru
                                                                    : enUS
                                                            }
                                                            captionLayout="dropdown"
                                                            formatters={{
                                                                formatMonthDropdown:
                                                                    (date) =>
                                                                        date.toLocaleString(
                                                                            i18n.language,
                                                                            {
                                                                                month: "long",
                                                                            },
                                                                        ),
                                                            }}
                                                            selected={dmKodAttributeCalendarDate(
                                                                field.value,
                                                            )}
                                                            defaultMonth={
                                                                dmKodAttributeCalendarDate(
                                                                    field.value,
                                                                ) ?? todayDate
                                                            }
                                                            today={todayDate}
                                                            startMonth={
                                                                name ===
                                                                "productionDate"
                                                                    ? new Date(
                                                                          1900,
                                                                          0,
                                                                          1,
                                                                      )
                                                                    : todayDate
                                                            }
                                                            endMonth={
                                                                name ===
                                                                "productionDate"
                                                                    ? todayDate
                                                                    : new Date(
                                                                          todayDate.getFullYear() +
                                                                              100,
                                                                          11,
                                                                          31,
                                                                      )
                                                            }
                                                            disabled={
                                                                name ===
                                                                "productionDate"
                                                                    ? {
                                                                          after: todayDate,
                                                                      }
                                                                    : {
                                                                          before: todayDate,
                                                                      }
                                                            }
                                                            onSelect={(
                                                                date,
                                                            ) => {
                                                                field.onChange(
                                                                    dmKodAttributeCalendarValue(
                                                                        date,
                                                                    ),
                                                                );
                                                                setCalendarOpen(
                                                                    null,
                                                                );
                                                            }}
                                                        />
                                                    </PopoverContent>
                                                </Popover>
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            ))}
                        </div>
                        {(["kpp", "fiasUuid"] as const).map((name) => {
                            const options = name === "kpp" ? kpps : fiasUuids;
                            return (
                                <FormField
                                    key={name}
                                    control={form.control}
                                    name={name}
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>
                                                {t(
                                                    `dmkod.utilisation.fields.${name}`,
                                                )}
                                            </FormLabel>
                                            <div className="flex min-w-0 items-center gap-2">
                                                <Select
                                                    disabled={
                                                        loading || loadError
                                                    }
                                                    value={
                                                        field.value ||
                                                        "unspecified"
                                                    }
                                                    onValueChange={(value) =>
                                                        field.onChange(
                                                            value ===
                                                                "unspecified"
                                                                ? ""
                                                                : value,
                                                        )
                                                    }
                                                >
                                                    <FormControl>
                                                        <SelectTrigger
                                                            className="min-w-0 flex-1 *:data-[slot=select-value]:min-w-0"
                                                            title={
                                                                field.value ||
                                                                undefined
                                                            }
                                                        >
                                                            <SelectValue
                                                                placeholder={t(
                                                                    "dmkod.utilisation.unspecified",
                                                                )}
                                                            />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent className="integration-theme dmkod-theme max-w-[calc(100vw-2rem)]">
                                                        <SelectItem value="unspecified">
                                                            {t(
                                                                "dmkod.utilisation.unspecified",
                                                            )}
                                                        </SelectItem>
                                                        {options.map(
                                                            ({
                                                                value,
                                                                address,
                                                            }) => (
                                                                <SelectItem
                                                                    className="break-all whitespace-normal"
                                                                    key={value}
                                                                    value={
                                                                        value
                                                                    }
                                                                >
                                                                    <span className="flex min-w-0 flex-col text-left">
                                                                        <span>
                                                                            {
                                                                                value
                                                                            }
                                                                        </span>
                                                                        {address ? (
                                                                            <span className="text-xs text-muted-foreground">
                                                                                {
                                                                                    address
                                                                                }
                                                                            </span>
                                                                        ) : null}
                                                                    </span>
                                                                </SelectItem>
                                                            ),
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            {!loading &&
                                            !loadError &&
                                            !options.length ? (
                                                <p className="text-xs text-muted-foreground">
                                                    {t(
                                                        "dmkod.cabinet.attributeForm.emptyList",
                                                    )}
                                                </p>
                                            ) : null}
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                            );
                        })}
                        {loading ? (
                            <p
                                role="status"
                                className="text-sm text-muted-foreground"
                            >
                                {t("dmkod.cabinet.attributeForm.loading")}
                            </p>
                        ) : null}
                        {loadError ? (
                            <div role="alert" className="space-y-2 text-sm">
                                <p className="text-destructive">
                                    {t("dmkod.cabinet.attributeForm.loadError")}
                                </p>
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={onRetry}
                                >
                                    {t("common.retry")}
                                </Button>
                            </div>
                        ) : null}
                        <details
                            className="space-y-3"
                            open={
                                !!form.formState.errors.seriesNumber ||
                                !!form.formState.errors.batchNumber ||
                                undefined
                            }
                        >
                            <summary className="cursor-pointer text-sm text-muted-foreground">
                                {t("dmkod.utilisation.advanced")}
                            </summary>
                            <div className="grid gap-4 sm:grid-cols-2">
                                {(["seriesNumber", "batchNumber"] as const).map(
                                    (name) => (
                                        <FormField
                                            key={name}
                                            control={form.control}
                                            name={name}
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t(
                                                            `dmkod.utilisation.fields.${name}`,
                                                        )}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input {...field} />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    ),
                                )}
                            </div>
                        </details>
                        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading || loadError}
                            >
                                {t("dmkod.cabinet.attributeForm.apply")}
                            </Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
