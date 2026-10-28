import { AlertTriangle, PackageOpen, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    CIS_TYPE_OPTIONS,
    ORDER_TEMPLATE_OPTIONS,
    SERIAL_NUMBER_OPTIONS,
    createEmptyProductTouchedState,
} from "@marking/components/honest-sign/constants";
import { FormField } from "@marking/components/honest-sign/ui/form-field";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import {
    Panel,
    PanelBody,
    PanelFooter,
    PanelHeader,
} from "@marking/components/honest-sign/ui/panel";
import { Select } from "@marking/components/honest-sign/ui/select";
import { WorkflowStepper } from "@marking/components/honest-sign/ui/workflow-stepper";
import {
    formatProductGroupLabel,
    getRequiredSelectClass,
} from "@marking/components/honest-sign/utils";
import { Button } from "@marking/components/ui/button";
import { Input } from "@marking/components/ui/input";

import type {
    CreateOrderProductDraft,
    CreateOrderProductTouchedState,
} from "@marking/components/honest-sign/types";

type CreateOrderStepTwoProps = {
    onBack: () => void;
    onCancel: () => void;
    selectedProductGroup: string;
    selectedTemplateId: number | null;
    onTemplateChange: (value: number | null) => void;
    products: CreateOrderProductDraft[];
    onAddProduct: () => void;
    onRemoveProduct: (index: number) => void;
    onProductChange: (
        index: number,
        patch: Partial<CreateOrderProductDraft>,
    ) => void;
    onCreateOrder: () => Promise<void>;
    creatingOrder: boolean;
    createOrderError: string;
    createOrderSuccess: string;
};

export function CreateOrderStepTwo({
    onBack,
    onCancel,
    selectedProductGroup,
    selectedTemplateId,
    onTemplateChange,
    products,
    onAddProduct,
    onRemoveProduct,
    onProductChange,
    onCreateOrder,
    creatingOrder,
    createOrderError,
    createOrderSuccess,
}: CreateOrderStepTwoProps) {
    const { t } = useTranslation();
    const [touchedFields, setTouchedFields] = useState<
        CreateOrderProductTouchedState[]
    >([]);

    const markFieldTouched = (
        index: number,
        field: keyof CreateOrderProductTouchedState,
    ) => {
        setTouchedFields((previous) => {
            const next = products.map(
                (_, itemIndex) =>
                    previous[itemIndex] ?? createEmptyProductTouchedState(),
            );
            const current = next[index];
            if (current) next[index] = { ...current, [field]: true };
            return next;
        });
    };

    const markAllTouched = () =>
        setTouchedFields(
            products.map(() => ({
                gtin: true,
                quantity: true,
                serialNumberType: true,
                cisType: true,
            })),
        );

    const optionLabel = (option: string) =>
        t(`honestSign.orderOptions.${option}`, { defaultValue: option });
    const productGroupLabel = t(
        `honestSign.productGroups.${selectedProductGroup}`,
        { defaultValue: formatProductGroupLabel(selectedProductGroup) },
    );

    return (
        <Panel className="overflow-hidden">
            <PanelHeader className="bg-muted/35 text-sm text-muted-foreground">
                {t("honestSign.workspace.newOrder")}
            </PanelHeader>
            <WorkflowStepper
                steps={[
                    t("honestSign.workspace.steps.common"),
                    t("honestSign.workspace.steps.products"),
                ]}
                activeStep={1}
            />
            <div className="border-b px-6 py-3 text-sm">
                <div className="inline-flex items-center gap-2 text-destructive">
                    <AlertTriangle className="size-4" aria-hidden="true" />
                    {t("honestSign.workspace.requiredHint")}
                </div>
            </div>

            {createOrderError ? (
                <Notice variant="error" className="m-4 mb-0">
                    {createOrderError}
                </Notice>
            ) : null}
            {createOrderSuccess ? (
                <Notice variant="success" className="m-4 mb-0">
                    {createOrderSuccess}
                </Notice>
            ) : null}

            <PanelBody>
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl font-semibold">
                            {t("honestSign.workspace.newOrder")}
                        </h2>
                        <p className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                            <PackageOpen
                                className="size-4"
                                aria-hidden="true"
                            />
                            {productGroupLabel}
                        </p>
                    </div>
                    <Button type="button" variant="outline" onClick={onBack}>
                        {t("honestSign.workspace.backToStepOne")}
                    </Button>
                </div>

                <FormField
                    label={t("honestSign.workspace.orderTemplate")}
                    htmlFor="orderTemplate"
                    className="mb-8 max-w-3xl"
                >
                    <Select
                        id="orderTemplate"
                        value={selectedTemplateId?.toString() ?? ""}
                        onChange={(event) =>
                            onTemplateChange(
                                event.target.value
                                    ? Number(event.target.value)
                                    : null,
                            )
                        }
                    >
                        <option value="">
                            {t("honestSign.workspace.selectOrderTemplate")}
                        </option>
                        {ORDER_TEMPLATE_OPTIONS.map((option) => (
                            <option key={option.id} value={option.id}>
                                {`ID ${option.id} — ${option.category}`}
                            </option>
                        ))}
                    </Select>
                </FormField>

                <div className="space-y-8 border-t pt-8">
                    {products.map((product, index) => {
                        const touched =
                            touchedFields[index] ??
                            createEmptyProductTouchedState();
                        const gtinInvalid =
                            touched.gtin &&
                            !/^\d{8,18}$/.test(product.gtin.trim());
                        const quantity = Number.parseInt(product.quantity, 10);
                        const quantityInvalid =
                            touched.quantity &&
                            (!Number.isInteger(quantity) ||
                                quantity < 1 ||
                                quantity > 2_000_000);
                        const serialInvalid =
                            touched.serialNumberType &&
                            !product.serialNumberType;
                        const cisInvalid = touched.cisType && !product.cisType;

                        return (
                            <section
                                key={index}
                                className="grid gap-6 border-b pb-8 md:grid-cols-[220px_1fr]"
                            >
                                <h3 className="pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                    {t("honestSign.workspace.productNumber", {
                                        number: index + 1,
                                    })}
                                </h3>
                                <div className="max-w-3xl space-y-4">
                                    <FormField
                                        label="GTIN"
                                        htmlFor={`gtin-${index}`}
                                    >
                                        <Input
                                            id={`gtin-${index}`}
                                            inputMode="numeric"
                                            value={product.gtin}
                                            aria-invalid={gtinInvalid}
                                            onBlur={() =>
                                                markFieldTouched(index, "gtin")
                                            }
                                            onChange={(event) =>
                                                onProductChange(index, {
                                                    gtin: event.target.value,
                                                })
                                            }
                                            placeholder={t(
                                                "honestSign.workspace.gtinPlaceholder",
                                            )}
                                        />
                                        {gtinInvalid ? (
                                            <p className="text-xs text-destructive">
                                                {t(
                                                    "honestSign.workspace.gtinError",
                                                )}
                                            </p>
                                        ) : null}
                                    </FormField>

                                    <FormField
                                        label={t(
                                            "honestSign.workspace.codesQuantity",
                                        )}
                                        htmlFor={`quantity-${index}`}
                                    >
                                        <Input
                                            id={`quantity-${index}`}
                                            type="number"
                                            min={1}
                                            max={2_000_000}
                                            value={product.quantity}
                                            aria-invalid={quantityInvalid}
                                            onBlur={() =>
                                                markFieldTouched(
                                                    index,
                                                    "quantity",
                                                )
                                            }
                                            onChange={(event) =>
                                                onProductChange(index, {
                                                    quantity:
                                                        event.target.value,
                                                })
                                            }
                                        />
                                        {quantityInvalid ? (
                                            <p className="text-xs text-destructive">
                                                {t(
                                                    "honestSign.workspace.quantityError",
                                                )}
                                            </p>
                                        ) : null}
                                    </FormField>

                                    <Select
                                        aria-label={t(
                                            "honestSign.workspace.serialNumberType",
                                        )}
                                        value={product.serialNumberType}
                                        onBlur={() =>
                                            markFieldTouched(
                                                index,
                                                "serialNumberType",
                                            )
                                        }
                                        onChange={(event) =>
                                            onProductChange(index, {
                                                serialNumberType:
                                                    event.target.value,
                                            })
                                        }
                                        className={getRequiredSelectClass(
                                            serialInvalid,
                                        )}
                                    >
                                        <option value="">
                                            {t(
                                                "honestSign.workspace.serialNumberType",
                                            )}
                                        </option>
                                        {SERIAL_NUMBER_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {optionLabel(option)}
                                            </option>
                                        ))}
                                    </Select>

                                    <Select
                                        aria-label={t(
                                            "honestSign.workspace.markingType",
                                        )}
                                        value={product.cisType}
                                        onBlur={() =>
                                            markFieldTouched(index, "cisType")
                                        }
                                        onChange={(event) =>
                                            onProductChange(index, {
                                                cisType: event.target.value,
                                            })
                                        }
                                        className={getRequiredSelectClass(
                                            cisInvalid,
                                        )}
                                    >
                                        <option value="">
                                            {t(
                                                "honestSign.workspace.markingType",
                                            )}
                                        </option>
                                        {CIS_TYPE_OPTIONS.map((option) => (
                                            <option key={option} value={option}>
                                                {optionLabel(option)}
                                            </option>
                                        ))}
                                    </Select>

                                    {products.length > 1 ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                onRemoveProduct(index)
                                            }
                                            aria-label={t(
                                                "honestSign.workspace.removeProduct",
                                            )}
                                            className="text-destructive"
                                        >
                                            <Trash2
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                            {t(
                                                "honestSign.workspace.removeProduct",
                                            )}
                                        </Button>
                                    ) : null}
                                </div>
                            </section>
                        );
                    })}
                </div>

                <Button
                    type="button"
                    variant="outline"
                    onClick={onAddProduct}
                    disabled={products.length >= 10}
                    className="mt-6"
                >
                    {t("honestSign.workspace.addProduct")}
                </Button>
                {products.length >= 10 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                        {t("honestSign.workspace.productsLimit")}
                    </p>
                ) : null}
            </PanelBody>

            <PanelFooter className="flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={onCancel}>
                    {t("common.cancel")}
                </Button>
                <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={onBack}>
                        {t("honestSign.workspace.backToStepOne")}
                    </Button>
                    <Button
                        type="button"
                        disabled={creatingOrder}
                        onClick={() => {
                            markAllTouched();
                            void onCreateOrder();
                        }}
                    >
                        {creatingOrder
                            ? t("honestSign.workspace.creatingOrder")
                            : t("honestSign.workspace.submitOrder")}
                    </Button>
                </div>
            </PanelFooter>
        </Panel>
    );
}
