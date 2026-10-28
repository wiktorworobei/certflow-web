import { AlertTriangle, Info } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
    PAYMENT_TYPE_OPTIONS,
    RELEASE_METHOD_OPTIONS,
} from "@marking/components/honest-sign/constants";
import {
    Panel,
    PanelBody,
    PanelFooter,
} from "@marking/components/honest-sign/ui/panel";
import { Select } from "@marking/components/honest-sign/ui/select";
import { WorkflowStepper } from "@marking/components/honest-sign/ui/workflow-stepper";
import {
    formatProductGroupLabel,
    getRequiredSelectClass,
} from "@marking/components/honest-sign/utils";
import { Button } from "@marking/components/ui/button";

type CreateOrderStepOneProps = {
    onCancel: () => void;
    onNext: () => void;
    selectedProductGroup: string;
    productGroups: string[];
    onProductGroupChange: (value: string) => void;
    selectedReleaseMethod: string;
    onReleaseMethodChange: (value: string) => void;
    selectedPaymentType: string;
    onPaymentTypeChange: (value: string) => void;
};

export function CreateOrderStepOne({
    onCancel,
    onNext,
    selectedProductGroup,
    productGroups,
    onProductGroupChange,
    selectedReleaseMethod,
    onReleaseMethodChange,
    selectedPaymentType,
    onPaymentTypeChange,
}: CreateOrderStepOneProps) {
    const { t } = useTranslation();
    const [touched, setTouched] = useState({
        productGroup: false,
        releaseMethod: false,
        paymentType: false,
    });

    const invalid = {
        productGroup: touched.productGroup && !selectedProductGroup,
        releaseMethod: touched.releaseMethod && !selectedReleaseMethod,
        paymentType: touched.paymentType && !selectedPaymentType,
    };

    const handleNext = () => {
        if (
            !selectedProductGroup ||
            !selectedReleaseMethod ||
            !selectedPaymentType
        ) {
            setTouched({
                productGroup: true,
                releaseMethod: true,
                paymentType: true,
            });
            return;
        }
        onNext();
    };

    const productGroupLabel = (group: string) =>
        t(`honestSign.productGroups.${group}`, {
            defaultValue: formatProductGroupLabel(group),
        });
    const optionLabel = (option: string) =>
        t(`honestSign.orderOptions.${option}`, { defaultValue: option });

    return (
        <Panel className="overflow-hidden">
            <WorkflowStepper
                steps={[
                    t("honestSign.workspace.steps.common"),
                    t("honestSign.workspace.steps.products"),
                ]}
                activeStep={0}
            />

            <div className="border-b px-6 py-3 text-sm">
                <div className="inline-flex items-center gap-2 text-destructive">
                    <AlertTriangle className="size-4" aria-hidden="true" />
                    {t("honestSign.workspace.requiredHint")}
                </div>
            </div>

            <PanelBody>
                <h2 className="mb-8 text-2xl font-semibold">
                    {t("honestSign.workspace.newOrder")}
                </h2>

                <div className="grid gap-6 border-t pt-8 md:grid-cols-[220px_1fr]">
                    <div className="pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {t("honestSign.workspace.commonData")}
                    </div>
                    <div className="max-w-3xl space-y-4">
                        <Select
                            aria-label={t("honestSign.workspace.productGroup")}
                            className={getRequiredSelectClass(
                                invalid.productGroup,
                            )}
                            value={selectedProductGroup}
                            onBlur={() =>
                                setTouched((value) => ({
                                    ...value,
                                    productGroup: true,
                                }))
                            }
                            onChange={(event) => {
                                setTouched((value) => ({
                                    ...value,
                                    productGroup: true,
                                }));
                                onProductGroupChange(event.target.value);
                            }}
                            trailingAdornment={
                                <Info
                                    className={
                                        invalid.productGroup
                                            ? "size-4 text-destructive"
                                            : "size-4 text-muted-foreground"
                                    }
                                    aria-hidden="true"
                                />
                            }
                        >
                            <option value="" disabled>
                                {t("honestSign.workspace.productGroup")}
                            </option>
                            {productGroups.map((group) => (
                                <option key={group} value={group}>
                                    {productGroupLabel(group)}
                                </option>
                            ))}
                        </Select>
                    </div>
                </div>

                <div className="mt-8 grid gap-6 border-t pt-8 md:grid-cols-[220px_1fr]">
                    <div className="pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {t("honestSign.workspace.productionData")}
                    </div>
                    <div className="grid max-w-3xl gap-4 md:grid-cols-2">
                        <Select
                            aria-label={t("honestSign.workspace.releaseMethod")}
                            value={selectedReleaseMethod}
                            onBlur={() =>
                                setTouched((value) => ({
                                    ...value,
                                    releaseMethod: true,
                                }))
                            }
                            onChange={(event) => {
                                setTouched((value) => ({
                                    ...value,
                                    releaseMethod: true,
                                }));
                                onReleaseMethodChange(event.target.value);
                            }}
                            className={getRequiredSelectClass(
                                invalid.releaseMethod,
                            )}
                        >
                            <option value="" disabled>
                                {t("honestSign.workspace.releaseMethod")}
                            </option>
                            {RELEASE_METHOD_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {optionLabel(option)}
                                </option>
                            ))}
                        </Select>

                        <Select
                            aria-label={t("honestSign.workspace.paymentType")}
                            value={selectedPaymentType}
                            onBlur={() =>
                                setTouched((value) => ({
                                    ...value,
                                    paymentType: true,
                                }))
                            }
                            onChange={(event) => {
                                setTouched((value) => ({
                                    ...value,
                                    paymentType: true,
                                }));
                                onPaymentTypeChange(event.target.value);
                            }}
                            className={getRequiredSelectClass(
                                invalid.paymentType,
                            )}
                        >
                            <option value="" disabled>
                                {t("honestSign.workspace.paymentType")}
                            </option>
                            {PAYMENT_TYPE_OPTIONS.map((option) => (
                                <option key={option} value={option}>
                                    {optionLabel(option)}
                                </option>
                            ))}
                        </Select>
                    </div>
                </div>
            </PanelBody>

            <PanelFooter className="flex flex-wrap items-center justify-between gap-3">
                <Button type="button" variant="outline" onClick={onCancel}>
                    {t("common.cancel")}
                </Button>
                <Button type="button" onClick={handleNext}>
                    {t("honestSign.workspace.goToProducts")}
                </Button>
            </PanelFooter>
        </Panel>
    );
}
