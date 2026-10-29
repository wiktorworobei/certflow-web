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
    fileDownloaded?: boolean;
    converterUpload?: { orderId: string; codesCount: number };
};

type GetCodesModalProps = {
    open: boolean;
    orderId: string;
    gtin: string;
    quantity: string;
    gettingCodes: boolean;
    uploadingToConverter: boolean;
    preparationMessage: string;
    uploadErrorMessage: string;
    errorMessage: string;
    result: unknown;
    onClose: () => void;
    onGtinChange: (value: string) => void;
    onQuantityChange: (value: string) => void;
    onSubmit: () => Promise<void>;
    onUploadToConverter: () => Promise<void>;
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
    uploadingToConverter,
    preparationMessage,
    uploadErrorMessage,
    errorMessage,
    result,
    onClose,
    onGtinChange,
    onQuantityChange,
    onSubmit,
    onUploadToConverter,
}: GetCodesModalProps) {
    const { t } = useTranslation();
    const resolvedResult =
        isGetCodesModalResult(result) && result.queuedOrderId === orderId
            ? result
            : null;
    const busy = gettingCodes || uploadingToConverter;

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => !nextOpen && !busy && onClose()}
        >
            <DialogContent
                className="integration-theme"
                showCloseButton={!busy}
            >
                <DialogHeader>
                    <DialogTitle>
                        {t("honestSign.workspace.getCodes")}
                    </DialogTitle>
                    <DialogDescription>
                        {t("honestSign.workspace.getCodesDescription")}
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                    {preparationMessage && !resolvedResult ? (
                        <Notice role="status">{preparationMessage}</Notice>
                    ) : null}
                    <FormField label="Order ID" htmlFor="codesOrderId">
                        <Input id="codesOrderId" value={orderId} readOnly />
                    </FormField>
                    <FormField label="GTIN" htmlFor="codesGtin">
                        <Input
                            id="codesGtin"
                            value={gtin}
                            disabled={busy || Boolean(resolvedResult)}
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
                            disabled={busy || Boolean(resolvedResult)}
                            onChange={(event) =>
                                onQuantityChange(event.target.value)
                            }
                            placeholder={t(
                                "honestSign.workspace.quantityPlaceholder",
                            )}
                        />
                    </FormField>

                    {errorMessage ? (
                        <Notice variant="error" role="alert">
                            {errorMessage}
                        </Notice>
                    ) : null}
                    {uploadErrorMessage ? (
                        <Notice variant="error" role="alert">
                            {uploadErrorMessage}
                        </Notice>
                    ) : null}
                    {resolvedResult ? (
                        <Notice variant="success" role="status">
                            <p className="font-semibold">
                                {t("honestSign.workspace.codesFileReady")}
                            </p>
                            <p className="mt-1">
                                {t(
                                    resolvedResult.fileDownloaded === false
                                        ? "honestSign.workspace.codesPreparedResult"
                                        : "honestSign.workspace.codesFileResult",
                                    {
                                        fileName:
                                            resolvedResult.downloadedFileName,
                                        count: resolvedResult.codesCount,
                                    },
                                )}
                            </p>
                            {resolvedResult.queuedForConverter &&
                            !resolvedResult.converterUpload ? (
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
                            {resolvedResult.converterUpload ? (
                                <p className="mt-1">
                                    {t(
                                        "honestSign.messages.converterUploaded",
                                        {
                                            orderId:
                                                resolvedResult.converterUpload
                                                    .orderId,
                                            count: resolvedResult
                                                .converterUpload.codesCount,
                                        },
                                    )}
                                </p>
                            ) : null}
                        </Notice>
                    ) : null}
                </div>

                <DialogFooter>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onClose}
                        disabled={busy}
                    >
                        {t("common.close")}
                    </Button>
                    <Button
                        type="button"
                        onClick={() => void onSubmit()}
                        variant={resolvedResult ? "outline" : "default"}
                        disabled={busy || Boolean(resolvedResult)}
                    >
                        {gettingCodes
                            ? t("honestSign.workspace.requesting")
                            : t("honestSign.workspace.getCodes")}
                    </Button>
                    {resolvedResult?.queuedForConverter &&
                    resolvedResult.codesCount > 0 ? (
                        <Button
                            type="button"
                            onClick={() => void onUploadToConverter()}
                            disabled={
                                busy || Boolean(resolvedResult.converterUpload)
                            }
                        >
                            {t(
                                uploadingToConverter
                                    ? "converters.wizard.sendingCodes"
                                    : "converters.wizard.sendAndContinue",
                            )}
                        </Button>
                    ) : null}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
