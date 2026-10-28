import { useTranslation } from "react-i18next";
import { FormField } from "@marking/components/honest-sign/ui/form-field";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Button } from "@marking/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@marking/components/ui/dialog";
import { Input } from "@marking/components/ui/input";

type GetCodesModalResult = {
    downloadedFileName: string;
    codesCount: number;
    queuedForConverter: boolean;
    queuedOrderId: string;
};

type GetCodesModalProps = {
    open: boolean;
    orderId: string;
    gtin: string;
    quantity: string;
    gettingCodes: boolean;
    errorMessage: string;
    result: unknown;
    onClose: () => void;
    onGtinChange: (value: string) => void;
    onQuantityChange: (value: string) => void;
    onSubmit: () => Promise<void>;
};

function isGetCodesModalResult(value: unknown): value is GetCodesModalResult {
    if (!value || typeof value !== "object") return false;
    const candidate = value as Record<string, unknown>;
    return (
        typeof candidate.downloadedFileName === "string" &&
        typeof candidate.codesCount === "number" &&
        typeof candidate.queuedForConverter === "boolean" &&
        typeof candidate.queuedOrderId === "string"
    );
}

export function GetCodesModal({
    open,
    orderId,
    gtin,
    quantity,
    gettingCodes,
    errorMessage,
    result,
    onClose,
    onGtinChange,
    onQuantityChange,
    onSubmit,
}: GetCodesModalProps) {
    const { t } = useTranslation();
    const resolvedResult = isGetCodesModalResult(result) ? result : null;

    return (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
            <DialogContent className="integration-theme">
                <DialogHeader>
                    <DialogTitle>
                        {t("honestSign.workspace.getCodes")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("honestSign.workspace.getCodesDescription")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    <FormField label="Order ID" htmlFor="codesOrderId">
                        <Input id="codesOrderId" value={orderId} readOnly />
                    </FormField>
                    <FormField label="GTIN" htmlFor="codesGtin">
                        <Input
                            id="codesGtin"
                            value={gtin}
                            onChange={(event) =>
                                onGtinChange(event.target.value)
                            }
                            placeholder={t(
                                "honestSign.workspace.gtinPlaceholder",
                            )}
                        />
                    </FormField>
                    <FormField
                        label={t("honestSign.workspace.quantity")}
                        htmlFor="codesQuantity"
                    >
                        <Input
                            id="codesQuantity"
                            type="number"
                            min={1}
                            value={quantity}
                            onChange={(event) =>
                                onQuantityChange(event.target.value)
                            }
                            placeholder={t(
                                "honestSign.workspace.quantityPlaceholder",
                            )}
                        />
                    </FormField>

                    {errorMessage ? (
                        <Notice variant="error">{errorMessage}</Notice>
                    ) : null}
                    {resolvedResult ? (
                        <Notice variant="success">
                            <p className="font-semibold">
                                {t("honestSign.workspace.codesFileReady")}
                            </p>
                            <p className="mt-1">
                                {t("honestSign.workspace.codesFileResult", {
                                    fileName: resolvedResult.downloadedFileName,
                                    count: resolvedResult.codesCount,
                                })}
                            </p>
                            {resolvedResult.queuedForConverter ? (
                                <p className="mt-1">
                                    {t(
                                        "honestSign.workspace.converterQueueReady",
                                        {
                                            orderId:
                                                resolvedResult.queuedOrderId,
                                        },
                                    )}
                                </p>
                            ) : null}
                        </Notice>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        {t("common.close")}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void onSubmit()}
                        disabled={gettingCodes}
                    >
                        {gettingCodes
                            ? t("honestSign.workspace.requesting")
                            : t("honestSign.workspace.getCodes")}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
