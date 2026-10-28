import {
    AlertTriangle,
    CheckCircle2,
    FileSpreadsheet,
    PackageOpen,
    Trash2,
    Upload,
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CIS_TYPE_MAP } from "@marking/components/honest-sign/constants";
import { FormField } from "@marking/components/honest-sign/ui/form-field";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import {
    Panel,
    PanelBody,
    PanelFooter,
} from "@marking/components/honest-sign/ui/panel";
import { Select } from "@marking/components/honest-sign/ui/select";
import { WorkflowStepper } from "@marking/components/honest-sign/ui/workflow-stepper";
import { UtilisationDocumentPicker } from "@marking/components/honest-sign/UtilisationDocumentPicker";
import { formatProductGroupLabel } from "@marking/components/honest-sign/utils";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Input } from "@marking/components/ui/input";
import { useUtilisationDocumentCodes } from "@marking/hooks/use-utilisation-documents";
import {
    formatDataMatrixCodeForDisplay,
    normalizeDataMatrixCode,
} from "@marking/lib/honest-sign/codeNormalization";
import { cryptoProSignatureService } from "@marking/lib/honest-sign/cryptoProSignatureService";
import {
    documentsApiService,
    type SubmitUtilisationReportResponse,
} from "@marking/lib/honest-sign/documentsApiService";
import {
    honestSignCodesCheckService,
    type HonestSignCodesCheckSummary,
} from "@marking/lib/honest-sign/honestSignCodesCheckService";
import { getHttpErrorStatus } from "@marking/lib/honest-sign/httpClient";
import {
    areExpirationConditionsValid,
    buildUtilisationReportPayload,
    getDefaultUtilisationExpirationMode,
    isExpirationDateValid,
    isExpirationDateTimeValid,
    isMilkPartNumberValid,
    isProductionDateValid,
    requiresUtilisationDates,
    MAX_UTILISATION_REPORT_CODES,
    type SubmittedUtilisationReport,
    type UtilisationCisType,
    type UtilisationExpirationCondition,
    type UtilisationExpirationMode,
} from "@marking/lib/honest-sign/utilisationReport";

export type { SubmittedUtilisationReport } from "@marking/lib/honest-sign/utilisationReport";

type DocumentsWorkspaceProps = {
    companyId: string;
    productGroups: string[];
    selectedThumbprint: string;
    onCancel?: () => void;
    onSubmitted?: (report: SubmittedUtilisationReport) => void;
};

type UploadedCsvDocument = {
    name: string;
    size: number;
    rows: string[];
};

type CurrentCodesCheckResult = HonestSignCodesCheckSummary & {
    bufferSignature: string;
};

const createEmptyExpirationCondition = (): UtilisationExpirationCondition => ({
    storageConditionIndex: "",
    expirationDate: "",
});

const EMPTY_DOCUMENT_CODES: string[] = [];

function splitCsvRows(text: string): string[] {
    return text
        .replace(/^\uFEFF/, "")
        .split(/\r?\n/)
        .map((row) => row.trim())
        .filter(Boolean);
}

function bufferSignature(codes: string[]): string {
    return codes.join("\u001e");
}

function responseValue(
    response: SubmitUtilisationReportResponse,
    keys: readonly string[],
): string {
    for (const key of keys) {
        const value =
            response[key as keyof SubmitUtilisationReportResponse] ??
            (response.rawResponse && typeof response.rawResponse === "object"
                ? (response.rawResponse as Record<string, unknown>)[key]
                : undefined);
        if (
            typeof value === "string" ||
            typeof value === "number" ||
            typeof value === "boolean"
        ) {
            return String(value);
        }
    }
    return "";
}

export function DocumentsWorkspace({
    companyId,
    productGroups,
    selectedThumbprint,
    onCancel,
    onSubmitted,
}: DocumentsWorkspaceProps) {
    const { t, i18n } = useTranslation();
    const sourceControlId = useId();
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const mountedRef = useRef(true);
    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);
    const expirationProductGroupRef = useRef("");
    const [activeStep, setActiveStep] = useState<1 | 2>(1);
    const [selectedProductGroup, setSelectedProductGroup] = useState("");
    const [productionDate, setProductionDate] = useState("");
    const [partNumber, setPartNumber] = useState("");
    const [cisType, setCisType] = useState<UtilisationCisType>("UNIT");
    const [expirationMode, setExpirationMode] =
        useState<UtilisationExpirationMode>("not-specified");
    const [expirationDate, setExpirationDate] = useState("");
    const [expirationConditions, setExpirationConditions] = useState<
        UtilisationExpirationCondition[]
    >([createEmptyExpirationCondition()]);
    const [markingCode, setMarkingCode] = useState("");
    const [manualCodes, setManualCodes] = useState<string[]>([]);
    const [uploadedDocument, setUploadedDocument] =
        useState<UploadedCsvDocument | null>(null);
    const [loadingFile, setLoadingFile] = useState(false);
    const [checkingCodes, setCheckingCodes] = useState(false);
    const [submittingDocument, setSubmittingDocument] = useState(false);
    const [codeSource, setCodeSource] = useState<"document" | "file">(
        "document",
    );
    const [selectedDocumentId, setSelectedDocumentId] = useState("");
    const documentCodesQuery = useUtilisationDocumentCodes(
        companyId,
        selectedDocumentId,
        codeSource === "document" && activeStep === 2,
    );
    const documentCodes =
        codeSource === "document" &&
        documentCodesQuery.data?.documentId === selectedDocumentId
            ? documentCodesQuery.data.sntins
            : EMPTY_DOCUMENT_CODES;
    const sourceBusy = checkingCodes || submittingDocument || loadingFile;
    const [codesCheckResult, setCodesCheckResult] =
        useState<CurrentCodesCheckResult | null>(null);
    const [errorMessage, setErrorMessage] = useState("");
    const [successMessage, setSuccessMessage] = useState("");
    const [touched, setTouched] = useState({
        productGroup: false,
        productionDate: false,
        partNumber: false,
        cisType: false,
        expirationMode: false,
        expirationDate: false,
    });

    useEffect(() => {
        setSelectedProductGroup((current) =>
            current && productGroups.includes(current)
                ? current
                : (productGroups[0] ?? ""),
        );
    }, [productGroups]);

    useEffect(() => {
        if (
            !selectedProductGroup ||
            expirationProductGroupRef.current === selectedProductGroup
        ) {
            return;
        }

        expirationProductGroupRef.current = selectedProductGroup;
        setExpirationMode(
            getDefaultUtilisationExpirationMode(selectedProductGroup, cisType),
        );
        setExpirationDate("");
        setExpirationConditions([createEmptyExpirationCondition()]);
    }, [cisType, selectedProductGroup]);

    useEffect(() => {
        if (selectedProductGroup === "milk") {
            if (cisType !== "UNIT") {
                if (expirationMode !== "not-specified") {
                    setExpirationMode("not-specified");
                }
            } else if (
                expirationMode !== "not-specified" &&
                expirationMode !== "milk-over-72" &&
                expirationMode !== "milk-under-72" &&
                expirationMode !== "milk-storage-conditions"
            ) {
                setExpirationMode("milk-over-72");
            }
        } else if (
            selectedProductGroup === "autofluids" &&
            cisType === "UNIT" &&
            expirationMode !== "specified"
        ) {
            setExpirationMode("specified");
        } else if (expirationMode.startsWith("milk-")) {
            setExpirationMode(
                getDefaultUtilisationExpirationMode(
                    selectedProductGroup,
                    cisType,
                ),
            );
        }
    }, [cisType, expirationMode, selectedProductGroup]);

    const uploadedRows = useMemo(
        () => uploadedDocument?.rows ?? [],
        [uploadedDocument],
    );
    const bufferedCodes = useMemo(
        () =>
            codeSource === "document"
                ? documentCodes
                : [...uploadedRows, ...manualCodes],
        [codeSource, documentCodes, manualCodes, uploadedRows],
    );
    const currentSignature = bufferedCodes.length
        ? bufferSignature([selectedProductGroup, ...bufferedCodes])
        : "";
    const currentCheck: CurrentCodesCheckResult | null =
        currentSignature !== "" &&
        codesCheckResult?.bufferSignature === currentSignature
            ? codesCheckResult
            : null;
    const currentBufferValid = Boolean(
        currentCheck &&
        currentCheck.totalCount > 0 &&
        currentCheck.invalidCount === 0 &&
        (codeSource !== "document" ||
            (!documentCodesQuery.isFetching && !documentCodesQuery.isError)),
    );
    const now = new Date();
    const today = [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0"),
        String(now.getDate()).padStart(2, "0"),
    ].join("-");
    const nowMinute = `${today}T${String(now.getHours()).padStart(2, "0")}:${String(
        now.getMinutes(),
    ).padStart(2, "0")}`;
    const requiredDates = requiresUtilisationDates(
        selectedProductGroup,
        cisType,
    );
    const omitDairyDates =
        selectedProductGroup === "milk" && cisType !== "UNIT";
    const productionDateValid =
        omitDairyDates ||
        (isProductionDateValid(productionDate, today) &&
            (!requiredDates || productionDate !== ""));
    const expirationDateValid = (() => {
        if (expirationMode === "milk-storage-conditions") {
            return areExpirationConditionsValid(
                expirationConditions,
                productionDate,
                today,
            );
        }
        if (expirationMode === "milk-under-72") {
            return isExpirationDateTimeValid(
                expirationDate,
                productionDate,
                nowMinute,
            );
        }
        if (expirationMode === "not-specified") {
            return !requiredDates;
        }
        return isExpirationDateValid(
            expirationDate,
            productionDate,
            today,
            selectedProductGroup === "autofluids",
        );
    })();
    const partNumberValid =
        selectedProductGroup !== "milk" ||
        cisType !== "UNIT" ||
        isMilkPartNumberValid(partNumber, productionDate);
    const cisTypeValid =
        selectedProductGroup !== "milk" ||
        cisType === "UNIT" ||
        cisType === "GROUP" ||
        cisType === "SET";
    const stepOneComplete = Boolean(
        selectedProductGroup &&
        productionDateValid &&
        expirationDateValid &&
        partNumberValid &&
        cisTypeValid,
    );
    const stepComplete =
        activeStep === 1
            ? stepOneComplete
            : stepOneComplete && bufferedCodes.length > 0 && currentBufferValid;

    const productGroupLabel = (group: string) =>
        t(`honestSign.productGroups.${group}`, {
            defaultValue: formatProductGroupLabel(group),
        });
    const clearMessages = () => {
        setErrorMessage("");
        setSuccessMessage("");
    };
    const invalidateCheck = () => {
        setCodesCheckResult(null);
        clearMessages();
    };

    const reset = () => {
        const initialProductGroup = productGroups[0] ?? "";
        setActiveStep(1);
        setSelectedProductGroup(initialProductGroup);
        setProductionDate("");
        setPartNumber("");
        setCisType("UNIT");
        setExpirationMode(
            getDefaultUtilisationExpirationMode(initialProductGroup, "UNIT"),
        );
        setExpirationDate("");
        setExpirationConditions([createEmptyExpirationCondition()]);
        setMarkingCode("");
        setManualCodes([]);
        setUploadedDocument(null);
        setCodeSource("document");
        setSelectedDocumentId("");
        setCodesCheckResult(null);
        setTouched({
            productGroup: false,
            productionDate: false,
            partNumber: false,
            cisType: false,
            expirationMode: false,
            expirationDate: false,
        });
        clearMessages();
    };

    const openProductsStep = () => {
        setTouched({
            productGroup: true,
            productionDate: true,
            partNumber: true,
            cisType: true,
            expirationMode: true,
            expirationDate: true,
        });
        if (!stepOneComplete) {
            setErrorMessage(t("honestSign.documents.errors.commonFields"));
            setSuccessMessage("");
            return;
        }
        clearMessages();
        setActiveStep(2);
    };

    const addManualCode = () => {
        const code = markingCode.trim();
        if (!code) {
            setErrorMessage(t("honestSign.documents.errors.codeRequired"));
            return;
        }
        if (bufferedCodes.length >= MAX_UTILISATION_REPORT_CODES) {
            setErrorMessage(
                t("honestSign.documents.errors.tooManyReportCodes"),
            );
            return;
        }
        if (!bufferedCodes.includes(code)) {
            setManualCodes((current) => [...current, code]);
        }
        setMarkingCode("");
        invalidateCheck();
    };

    const uploadFile = async (file: File | null) => {
        if (!file) return;
        if (!file.name.toLowerCase().endsWith(".csv")) {
            setErrorMessage(t("honestSign.documents.errors.csvOnly"));
            return;
        }

        setLoadingFile(true);
        invalidateCheck();
        try {
            const rows = splitCsvRows(await file.text());
            if (rows.length === 0) {
                throw new Error(t("honestSign.documents.errors.csvEmpty"));
            }
            if (
                rows.length + manualCodes.length >
                MAX_UTILISATION_REPORT_CODES
            ) {
                throw new Error(
                    t("honestSign.documents.errors.tooManyReportCodes"),
                );
            }
            setUploadedDocument({ name: file.name, size: file.size, rows });
        } catch (error) {
            setUploadedDocument(null);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : t("honestSign.documents.errors.csvRead"),
            );
        } finally {
            setLoadingFile(false);
        }
    };

    const checkCodes = async (showSuccess: boolean): Promise<boolean> => {
        if (bufferedCodes.length === 0) {
            setErrorMessage(t("honestSign.documents.errors.codesEmpty"));
            return false;
        }
        if (bufferedCodes.length > MAX_UTILISATION_REPORT_CODES) {
            setErrorMessage(
                t("honestSign.documents.errors.tooManyReportCodes"),
            );
            return false;
        }

        const result = await honestSignCodesCheckService.checkCodes(
            bufferedCodes,
            selectedProductGroup,
        );
        setCodesCheckResult({ ...result, bufferSignature: currentSignature });
        if (result.invalidCount > 0) {
            setErrorMessage(
                t("honestSign.documents.errors.invalidCodes", {
                    invalid: result.invalidCount,
                    total: result.totalCount,
                }),
            );
            setSuccessMessage("");
            return false;
        }

        setErrorMessage("");
        setSuccessMessage(
            showSuccess
                ? t("honestSign.documents.codesValid", {
                      count: result.totalCount,
                  })
                : "",
        );
        return true;
    };

    const handleCheckCodes = async () => {
        setCheckingCodes(true);
        clearMessages();
        try {
            await checkCodes(true);
        } catch (error) {
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : t("honestSign.documents.errors.check"),
            );
        } finally {
            setCheckingCodes(false);
        }
    };

    const handleSubmit = async () => {
        if (!stepOneComplete) {
            setActiveStep(1);
            setErrorMessage(t("honestSign.documents.errors.commonFields"));
            return;
        }
        if (!currentBufferValid) {
            setErrorMessage(t("honestSign.documents.errors.checkBeforeSubmit"));
            return;
        }
        if (!selectedThumbprint) {
            setErrorMessage(t("honestSign.documents.errors.certificate"));
            return;
        }

        setSubmittingDocument(true);
        clearMessages();
        try {
            if (!(await checkCodes(false)) || !mountedRef.current) return;
            const sntins =
                codeSource === "document"
                    ? bufferedCodes
                    : bufferedCodes
                          .map(normalizeDataMatrixCode)
                          .filter(Boolean);
            const body = buildUtilisationReportPayload({
                productGroup: selectedProductGroup,
                productionDate,
                partNumber,
                cisType,
                expirationMode,
                expirationDate,
                expirationConditions,
                sntins,
            });
            const signature = await cryptoProSignatureService.signDetached({
                thumbprint: selectedThumbprint,
                message: JSON.stringify(body),
            });
            if (!mountedRef.current) return;
            const response = await documentsApiService.submitUtilisationReport(
                cryptoProSignatureService.normalizeDetachedSignature(
                    signature.pkcs7,
                ),
                body,
                codeSource === "document" ? selectedDocumentId : undefined,
                cisType,
            );
            const reportId = responseValue(response, [
                "reportId",
                "report_id",
                "id",
                "uuid",
            ]);
            const status = responseValue(response, [
                "status",
                "state",
                "result",
            ]);
            const upstreamMessage = responseValue(response, [
                "message",
                "detail",
                "description",
            ]);
            if (!reportId) {
                throw new Error(t("honestSign.documents.errors.reportId"));
            }
            setSuccessMessage(
                t("honestSign.documents.reportSubmitted", {
                    reportId,
                    status: status || "—",
                    message: upstreamMessage,
                }),
            );
            onSubmitted?.({
                reportId,
                productGroup: selectedProductGroup,
                codesCount: sntins.length,
                status: status || null,
                message: upstreamMessage || null,
                submittedAtUtc: new Date().toISOString(),
            });
        } catch (error) {
            if (getHttpErrorStatus(error) === 409) setCodesCheckResult(null);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : t("honestSign.documents.errors.submit"),
            );
        } finally {
            setSubmittingDocument(false);
        }
    };

    const removeCode = (index: number) => {
        if (index < uploadedRows.length) {
            setUploadedDocument((current) =>
                current
                    ? {
                          ...current,
                          rows: current.rows.filter(
                              (_, rowIndex) => rowIndex !== index,
                          ),
                      }
                    : null,
            );
        } else {
            const manualIndex = index - uploadedRows.length;
            setManualCodes((current) =>
                current.filter((_, codeIndex) => codeIndex !== manualIndex),
            );
        }
        invalidateCheck();
    };

    return (
        <Panel className="overflow-hidden border-t-2 border-t-yellow-300">
            <WorkflowStepper
                steps={[
                    t("honestSign.workspace.steps.common"),
                    t("honestSign.workspace.steps.products"),
                ]}
                activeStep={activeStep - 1}
                tone="honest-sign"
            />
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-6 py-3 text-sm">
                <span className="inline-flex items-center gap-2 text-muted-foreground">
                    <AlertTriangle className="size-4" aria-hidden="true" />
                    {t("honestSign.workspace.requiredHint")}
                </span>
                <Badge variant={stepComplete ? "secondary" : "outline"}>
                    {stepComplete
                        ? t("honestSign.documents.complete")
                        : t("honestSign.documents.incomplete")}
                </Badge>
            </div>

            {errorMessage ? (
                <Notice variant="error" className="m-4 mb-0" role="alert">
                    {errorMessage}
                </Notice>
            ) : null}
            {successMessage ? (
                <Notice variant="success" className="m-4 mb-0" role="status">
                    {successMessage}
                </Notice>
            ) : null}

            {activeStep === 1 ? (
                <>
                    <PanelBody>
                        <h2 className="mb-8 text-2xl font-semibold">
                            {t("honestSign.documents.newApplication")}
                        </h2>
                        <div className="grid gap-6 border-t pt-8 lg:grid-cols-[220px_1fr]">
                            <div className="pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                {t("honestSign.workspace.commonData")}
                            </div>
                            <div className="max-w-3xl space-y-4">
                                <Notice variant="warning">
                                    {t("honestSign.documents.datesHint")}
                                </Notice>
                                <Select
                                    aria-label={t(
                                        "honestSign.workspace.productGroup",
                                    )}
                                    leadingAdornment={
                                        <PackageOpen
                                            className="size-4 text-muted-foreground"
                                            aria-hidden="true"
                                        />
                                    }
                                    value={selectedProductGroup}
                                    aria-invalid={
                                        touched.productGroup &&
                                        !selectedProductGroup
                                    }
                                    onBlur={() =>
                                        setTouched((value) => ({
                                            ...value,
                                            productGroup: true,
                                        }))
                                    }
                                    onChange={(event) => {
                                        setSelectedProductGroup(
                                            event.target.value,
                                        );
                                        clearMessages();
                                    }}
                                >
                                    <option value="">
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

                        <div className="mt-8 grid gap-6 border-t pt-8 lg:grid-cols-[220px_1fr]">
                            <div className="pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                {t("honestSign.workspace.productionData")}
                            </div>
                            <div className="grid max-w-3xl gap-4 md:grid-cols-2">
                                <FormField
                                    label={t(
                                        "honestSign.documents.productionDate",
                                    )}
                                    htmlFor="productionDate"
                                >
                                    <Input
                                        id="productionDate"
                                        type="date"
                                        required={requiredDates}
                                        disabled={omitDairyDates}
                                        max={today}
                                        value={productionDate}
                                        aria-invalid={
                                            touched.productionDate &&
                                            !productionDateValid
                                        }
                                        onBlur={() =>
                                            setTouched((value) => ({
                                                ...value,
                                                productionDate: true,
                                            }))
                                        }
                                        onChange={(event) => {
                                            setProductionDate(
                                                event.target.value,
                                            );
                                            clearMessages();
                                        }}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        {t(
                                            requiredDates
                                                ? "honestSign.documents.requiredDatesHint"
                                                : "honestSign.documents.productionDateHint",
                                        )}
                                    </p>
                                </FormField>
                                {selectedProductGroup === "milk" ||
                                selectedProductGroup === "autofluids" ? (
                                    <FormField
                                        label={t(
                                            "honestSign.workspace.markingType",
                                        )}
                                        htmlFor="utilisationCisType"
                                    >
                                        <Select
                                            id="utilisationCisType"
                                            value={cisType}
                                            aria-invalid={
                                                touched.cisType && !cisTypeValid
                                            }
                                            onBlur={() =>
                                                setTouched((value) => ({
                                                    ...value,
                                                    cisType: true,
                                                }))
                                            }
                                            onChange={(event) => {
                                                const nextCisType = event.target
                                                    .value as UtilisationCisType;
                                                setCisType(nextCisType);
                                                setExpirationMode(
                                                    getDefaultUtilisationExpirationMode(
                                                        selectedProductGroup,
                                                        nextCisType,
                                                    ),
                                                );
                                                if (nextCisType !== "UNIT") {
                                                    setPartNumber("");
                                                }
                                                setExpirationDate("");
                                                setExpirationConditions([
                                                    createEmptyExpirationCondition(),
                                                ]);
                                                clearMessages();
                                            }}
                                        >
                                            {Object.entries(CIS_TYPE_MAP).map(
                                                ([label, value]) => (
                                                    <option
                                                        key={value}
                                                        value={value}
                                                    >
                                                        {t(
                                                            `honestSign.orderOptions.${label}`,
                                                            {
                                                                defaultValue:
                                                                    label,
                                                            },
                                                        )}
                                                    </option>
                                                ),
                                            )}
                                        </Select>
                                        <p className="text-xs text-muted-foreground">
                                            {t(
                                                "honestSign.documents.cisTypeHint",
                                            )}
                                        </p>
                                    </FormField>
                                ) : null}
                                {selectedProductGroup === "milk" &&
                                cisType === "UNIT" ? (
                                    <FormField
                                        label={t(
                                            "honestSign.documents.partNumber",
                                        )}
                                        htmlFor="partNumber"
                                    >
                                        <Input
                                            id="partNumber"
                                            value={partNumber}
                                            placeholder={t(
                                                "honestSign.documents.partNumberPlaceholder",
                                            )}
                                            minLength={21}
                                            maxLength={32}
                                            aria-invalid={
                                                touched.partNumber &&
                                                !partNumberValid
                                            }
                                            onBlur={() =>
                                                setTouched((value) => ({
                                                    ...value,
                                                    partNumber: true,
                                                }))
                                            }
                                            onChange={(event) => {
                                                setPartNumber(
                                                    event.target.value,
                                                );
                                                clearMessages();
                                            }}
                                        />
                                        <p className="text-xs text-muted-foreground">
                                            {t(
                                                "honestSign.documents.partNumberHint",
                                            )}
                                        </p>
                                    </FormField>
                                ) : null}
                            </div>
                        </div>

                        <div className="mt-8 grid gap-6 border-t pt-8 lg:grid-cols-[220px_1fr]">
                            <div className="pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                {t("honestSign.documents.productData")}
                            </div>
                            <div className="grid max-w-3xl gap-4 md:grid-cols-2">
                                <FormField
                                    label={t(
                                        "honestSign.documents.expirationMode",
                                    )}
                                    htmlFor="expirationMode"
                                >
                                    <Select
                                        id="expirationMode"
                                        value={expirationMode}
                                        onBlur={() =>
                                            setTouched((value) => ({
                                                ...value,
                                                expirationMode: true,
                                            }))
                                        }
                                        onChange={(event) => {
                                            const value = event.target
                                                .value as UtilisationExpirationMode;
                                            setExpirationMode(value);
                                            setExpirationDate("");
                                            setExpirationConditions([
                                                createEmptyExpirationCondition(),
                                            ]);
                                            clearMessages();
                                        }}
                                    >
                                        {selectedProductGroup === "milk" &&
                                        cisType === "UNIT" ? (
                                            <>
                                                <option
                                                    value="not-specified"
                                                    disabled
                                                >
                                                    {t(
                                                        "honestSign.documents.expirationNotSpecified",
                                                    )}
                                                </option>
                                                <option value="milk-over-72">
                                                    {t(
                                                        "honestSign.documents.expirationMilkOver72",
                                                    )}
                                                </option>
                                                <option value="milk-under-72">
                                                    {t(
                                                        "honestSign.documents.expirationMilkUnder72",
                                                    )}
                                                </option>
                                                <option value="milk-storage-conditions">
                                                    {t(
                                                        "honestSign.documents.expirationStorageConditions",
                                                    )}
                                                </option>
                                            </>
                                        ) : (
                                            <>
                                                <option
                                                    value="not-specified"
                                                    disabled={requiredDates}
                                                >
                                                    {t(
                                                        "honestSign.documents.expirationNotSpecified",
                                                    )}
                                                </option>
                                                {selectedProductGroup !==
                                                "milk" ? (
                                                    <option value="specified">
                                                        {t(
                                                            "honestSign.documents.expirationSpecified",
                                                        )}
                                                    </option>
                                                ) : null}
                                            </>
                                        )}
                                    </Select>
                                    {selectedProductGroup === "milk" ? (
                                        <p className="text-xs text-muted-foreground">
                                            {cisType !== "UNIT"
                                                ? t(
                                                      "honestSign.documents.expirationSetHint",
                                                  )
                                                : t(
                                                      "honestSign.documents.expirationMilkHint",
                                                  )}
                                        </p>
                                    ) : selectedProductGroup ===
                                      "autofluids" ? (
                                        <p className="text-xs text-muted-foreground">
                                            {t(
                                                "honestSign.documents.autofluidsDatesHint",
                                            )}
                                        </p>
                                    ) : null}
                                </FormField>
                                {expirationMode === "specified" ||
                                expirationMode === "milk-over-72" ? (
                                    <FormField
                                        label={t(
                                            "honestSign.documents.expirationDate",
                                        )}
                                        htmlFor="expirationDate"
                                    >
                                        <Input
                                            id="expirationDate"
                                            type="date"
                                            required={requiredDates}
                                            min={productionDate || today}
                                            value={expirationDate}
                                            aria-invalid={
                                                touched.expirationDate &&
                                                !expirationDateValid
                                            }
                                            onBlur={() =>
                                                setTouched((value) => ({
                                                    ...value,
                                                    expirationDate: true,
                                                }))
                                            }
                                            onChange={(event) => {
                                                setExpirationDate(
                                                    event.target.value,
                                                );
                                                clearMessages();
                                            }}
                                        />
                                    </FormField>
                                ) : null}
                                {expirationMode === "milk-under-72" ? (
                                    <FormField
                                        label={t(
                                            "honestSign.documents.expirationDateTime",
                                        )}
                                        htmlFor="expirationDateTime"
                                    >
                                        <Input
                                            id="expirationDateTime"
                                            type="datetime-local"
                                            min={nowMinute}
                                            value={expirationDate}
                                            aria-invalid={
                                                touched.expirationDate &&
                                                !expirationDateValid
                                            }
                                            onBlur={() =>
                                                setTouched((value) => ({
                                                    ...value,
                                                    expirationDate: true,
                                                }))
                                            }
                                            onChange={(event) => {
                                                setExpirationDate(
                                                    event.target.value,
                                                );
                                                clearMessages();
                                            }}
                                        />
                                    </FormField>
                                ) : null}
                                {expirationMode ===
                                "milk-storage-conditions" ? (
                                    <div className="space-y-3 md:col-span-2">
                                        <div className="text-sm font-medium">
                                            {t(
                                                "honestSign.documents.expirationConditions",
                                            )}
                                        </div>
                                        {expirationConditions.map(
                                            (condition, index) => (
                                                <div
                                                    key={index}
                                                    className="grid gap-3 sm:grid-cols-[180px_1fr_auto]"
                                                >
                                                    <Input
                                                        inputMode="numeric"
                                                        aria-label={t(
                                                            "honestSign.documents.storageConditionIndex",
                                                        )}
                                                        placeholder={t(
                                                            "honestSign.documents.storageConditionIndex",
                                                        )}
                                                        value={
                                                            condition.storageConditionIndex
                                                        }
                                                        aria-invalid={
                                                            touched.expirationDate &&
                                                            !expirationDateValid
                                                        }
                                                        onChange={(event) => {
                                                            const value =
                                                                event.target
                                                                    .value;
                                                            setExpirationConditions(
                                                                (current) =>
                                                                    current.map(
                                                                        (
                                                                            item,
                                                                            itemIndex,
                                                                        ) =>
                                                                            itemIndex ===
                                                                            index
                                                                                ? {
                                                                                      ...item,
                                                                                      storageConditionIndex:
                                                                                          value,
                                                                                  }
                                                                                : item,
                                                                    ),
                                                            );
                                                            clearMessages();
                                                        }}
                                                    />
                                                    <Input
                                                        type="date"
                                                        min={
                                                            productionDate ||
                                                            today
                                                        }
                                                        aria-label={t(
                                                            "honestSign.documents.expirationDate",
                                                        )}
                                                        value={
                                                            condition.expirationDate
                                                        }
                                                        aria-invalid={
                                                            touched.expirationDate &&
                                                            !expirationDateValid
                                                        }
                                                        onChange={(event) => {
                                                            const value =
                                                                event.target
                                                                    .value;
                                                            setExpirationConditions(
                                                                (current) =>
                                                                    current.map(
                                                                        (
                                                                            item,
                                                                            itemIndex,
                                                                        ) =>
                                                                            itemIndex ===
                                                                            index
                                                                                ? {
                                                                                      ...item,
                                                                                      expirationDate:
                                                                                          value,
                                                                                  }
                                                                                : item,
                                                                    ),
                                                            );
                                                            clearMessages();
                                                        }}
                                                        onBlur={() =>
                                                            setTouched(
                                                                (value) => ({
                                                                    ...value,
                                                                    expirationDate: true,
                                                                }),
                                                            )
                                                        }
                                                    />
                                                    <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="icon"
                                                        disabled={
                                                            expirationConditions.length ===
                                                            1
                                                        }
                                                        aria-label={t(
                                                            "honestSign.documents.removeExpirationCondition",
                                                        )}
                                                        onClick={() =>
                                                            setExpirationConditions(
                                                                (current) =>
                                                                    current.filter(
                                                                        (
                                                                            _,
                                                                            itemIndex,
                                                                        ) =>
                                                                            itemIndex !==
                                                                            index,
                                                                    ),
                                                            )
                                                        }
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                </div>
                                            ),
                                        )}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() =>
                                                setExpirationConditions(
                                                    (current) => [
                                                        ...current,
                                                        createEmptyExpirationCondition(),
                                                    ],
                                                )
                                            }
                                        >
                                            {t(
                                                "honestSign.documents.addExpirationCondition",
                                            )}
                                        </Button>
                                        <p className="text-xs text-muted-foreground">
                                            {t(
                                                "honestSign.documents.expirationConditionsHint",
                                            )}
                                        </p>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    </PanelBody>
                    <PanelFooter className="flex justify-between gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={sourceBusy}
                            onClick={onCancel ?? reset}
                        >
                            {t("common.cancel")}
                        </Button>
                        <Button type="button" onClick={openProductsStep}>
                            {t("honestSign.workspace.goToProducts")}
                        </Button>
                    </PanelFooter>
                </>
            ) : (
                <>
                    <PanelBody>
                        <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
                            <h2 className="text-2xl font-semibold">
                                {t("honestSign.documents.newApplication")}
                            </h2>
                            <Button
                                type="button"
                                variant="outline"
                                disabled={sourceBusy}
                                onClick={() => setActiveStep(1)}
                            >
                                {t("honestSign.workspace.backToStepOne")}
                            </Button>
                        </div>

                        <div className="grid gap-6 border-t pt-8 lg:grid-cols-[220px_1fr]">
                            <div className="pt-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                                {t("honestSign.workspace.products")}
                            </div>
                            <div className="max-w-4xl space-y-5">
                                <FormField
                                    label={t(
                                        "honestSign.documents.source.label",
                                    )}
                                    htmlFor={sourceControlId}
                                >
                                    <Select
                                        id={sourceControlId}
                                        value={codeSource}
                                        disabled={sourceBusy}
                                        onChange={(event) => {
                                            setCodeSource(
                                                event.target.value as
                                                    | "document"
                                                    | "file",
                                            );
                                            setSelectedDocumentId("");
                                            invalidateCheck();
                                        }}
                                    >
                                        <option value="document">
                                            {t(
                                                "honestSign.documents.source.fromDocument",
                                            )}
                                        </option>
                                        <option value="file">
                                            {t(
                                                "honestSign.documents.source.fromFile",
                                            )}
                                        </option>
                                    </Select>
                                </FormField>
                                {codeSource === "document" ? (
                                    <>
                                        <UtilisationDocumentPicker
                                            companyId={companyId}
                                            documentId={selectedDocumentId}
                                            title={
                                                documentCodesQuery.data?.title
                                            }
                                            disabled={sourceBusy}
                                            onSelect={(id) => {
                                                setSelectedDocumentId(id);
                                                invalidateCheck();
                                            }}
                                        />
                                        {selectedDocumentId ? (
                                            <div className="space-y-3">
                                                {documentCodesQuery.isFetching ? (
                                                    <p role="status">
                                                        {t(
                                                            "honestSign.documents.source.loadingCodes",
                                                        )}
                                                    </p>
                                                ) : documentCodesQuery.isError ? (
                                                    <Notice
                                                        variant="error"
                                                        role="alert"
                                                    >
                                                        {
                                                            documentCodesQuery
                                                                .error.message
                                                        }
                                                    </Notice>
                                                ) : documentCodesQuery.data ? (
                                                    <Notice>
                                                        <p className="font-medium break-words">
                                                            {
                                                                documentCodesQuery
                                                                    .data.title
                                                            }
                                                        </p>
                                                        <p>
                                                            {t(
                                                                "honestSign.documents.source.loaded",
                                                                {
                                                                    count: documentCodes.length,
                                                                },
                                                            )}
                                                        </p>
                                                    </Notice>
                                                ) : null}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    disabled={
                                                        sourceBusy ||
                                                        documentCodesQuery.isFetching
                                                    }
                                                    onClick={() => {
                                                        invalidateCheck();
                                                        void documentCodesQuery.refetch();
                                                    }}
                                                >
                                                    {t(
                                                        "honestSign.documents.source.refresh",
                                                    )}
                                                </Button>
                                            </div>
                                        ) : null}
                                    </>
                                ) : (
                                    <>
                                        <div className="flex gap-2">
                                            <Input
                                                disabled={sourceBusy}
                                                value={markingCode}
                                                onChange={(event) =>
                                                    setMarkingCode(
                                                        event.target.value,
                                                    )
                                                }
                                                onKeyDown={(event) => {
                                                    if (event.key === "Enter") {
                                                        event.preventDefault();
                                                        addManualCode();
                                                    }
                                                }}
                                                placeholder={t(
                                                    "honestSign.documents.codePlaceholder",
                                                )}
                                            />
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={sourceBusy}
                                                onClick={addManualCode}
                                            >
                                                {t(
                                                    "honestSign.documents.addCode",
                                                )}
                                            </Button>
                                        </div>

                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".csv,text/csv"
                                            className="sr-only"
                                            onChange={(event) => {
                                                const input =
                                                    event.currentTarget;
                                                void uploadFile(
                                                    input.files?.[0] ?? null,
                                                ).finally(() => {
                                                    input.value = "";
                                                });
                                            }}
                                        />
                                        <Button
                                            type="button"
                                            variant="outline"
                                            disabled={sourceBusy}
                                            onClick={() =>
                                                fileInputRef.current?.click()
                                            }
                                        >
                                            <Upload
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                            {loadingFile
                                                ? t(
                                                      "honestSign.documents.loadingCsv",
                                                  )
                                                : t(
                                                      "honestSign.documents.uploadCsv",
                                                  )}
                                        </Button>

                                        {uploadedDocument ? (
                                            <div className="flex items-center gap-3 rounded-md border bg-muted/30 p-3">
                                                <FileSpreadsheet
                                                    className="size-5 text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium">
                                                        {uploadedDocument.name}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {t(
                                                            "honestSign.documents.fileSummary",
                                                            {
                                                                count: uploadedRows.length,
                                                                size: new Intl.NumberFormat(
                                                                    i18n.language,
                                                                    {
                                                                        style: "unit",
                                                                        unit: "kilobyte",
                                                                        maximumFractionDigits: 1,
                                                                    },
                                                                ).format(
                                                                    uploadedDocument.size /
                                                                        1024,
                                                                ),
                                                            },
                                                        )}
                                                    </p>
                                                </div>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    onClick={() => {
                                                        setUploadedDocument(
                                                            null,
                                                        );
                                                        invalidateCheck();
                                                    }}
                                                    aria-label={t(
                                                        "honestSign.documents.removeFile",
                                                    )}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        ) : null}
                                    </>
                                )}

                                {bufferedCodes.length === 0 ? (
                                    <Notice>
                                        {t(
                                            codeSource === "document"
                                                ? "honestSign.documents.source.choose"
                                                : "honestSign.documents.bufferEmpty",
                                        )}
                                    </Notice>
                                ) : (
                                    <div className="overflow-hidden rounded-md border">
                                        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
                                            <p className="text-sm font-medium">
                                                {t(
                                                    "honestSign.documents.codesBuffer",
                                                )}
                                            </p>
                                            <Badge variant="outline">
                                                {bufferedCodes.length}
                                            </Badge>
                                        </div>
                                        <div className="max-h-80 divide-y overflow-y-auto">
                                            {bufferedCodes
                                                .slice(0, 100)
                                                .map((code, index) => {
                                                    const checkItem =
                                                        currentCheck?.items[
                                                            index
                                                        ];
                                                    return (
                                                        <div
                                                            key={`${code}-${index}`}
                                                            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 px-4 py-3"
                                                        >
                                                            {checkItem ? (
                                                                <CheckCircle2
                                                                    className={
                                                                        checkItem.isValid
                                                                            ? "mt-0.5 size-4 text-primary"
                                                                            : "mt-0.5 size-4 text-destructive"
                                                                    }
                                                                    aria-label={
                                                                        checkItem.isValid
                                                                            ? t(
                                                                                  "honestSign.documents.valid",
                                                                              )
                                                                            : t(
                                                                                  "honestSign.documents.invalid",
                                                                              )
                                                                    }
                                                                />
                                                            ) : (
                                                                <span className="mt-0.5 text-xs text-muted-foreground">
                                                                    {index + 1}
                                                                </span>
                                                            )}
                                                            <div>
                                                                <code className="font-mono text-xs break-all">
                                                                    {formatDataMatrixCodeForDisplay(
                                                                        code,
                                                                    )}
                                                                </code>
                                                                {checkItem &&
                                                                !checkItem.isValid ? (
                                                                    <p className="mt-1 text-xs text-destructive">
                                                                        {checkItem.reasons.join(
                                                                            "; ",
                                                                        )}
                                                                    </p>
                                                                ) : null}
                                                                {checkItem?.productName ||
                                                                checkItem?.status ? (
                                                                    <p className="mt-1 text-xs text-muted-foreground">
                                                                        {[
                                                                            checkItem.productName,
                                                                            checkItem.status
                                                                                ? t(
                                                                                      "honestSign.documents.codeStatus",
                                                                                      {
                                                                                          status: checkItem.status,
                                                                                      },
                                                                                  )
                                                                                : null,
                                                                        ]
                                                                            .filter(
                                                                                Boolean,
                                                                            )
                                                                            .join(
                                                                                " · ",
                                                                            )}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                            {codeSource ===
                                                            "file" ? (
                                                                <Button
                                                                    disabled={
                                                                        sourceBusy
                                                                    }
                                                                    type="button"
                                                                    variant="ghost"
                                                                    size="icon-sm"
                                                                    onClick={() =>
                                                                        removeCode(
                                                                            index,
                                                                        )
                                                                    }
                                                                    aria-label={t(
                                                                        "honestSign.documents.removeCode",
                                                                        {
                                                                            number:
                                                                                index +
                                                                                1,
                                                                        },
                                                                    )}
                                                                >
                                                                    <Trash2 className="size-4" />
                                                                </Button>
                                                            ) : null}
                                                        </div>
                                                    );
                                                })}
                                        </div>
                                        {bufferedCodes.length > 100 ? (
                                            <p className="border-t p-3 text-xs text-muted-foreground">
                                                {t(
                                                    "honestSign.documents.source.previewLimit",
                                                    {
                                                        shown: 100,
                                                        total: bufferedCodes.length,
                                                    },
                                                )}
                                            </p>
                                        ) : null}
                                    </div>
                                )}

                                <p
                                    className={
                                        currentBufferValid
                                            ? "text-sm text-primary"
                                            : "text-sm text-muted-foreground"
                                    }
                                >
                                    {currentBufferValid
                                        ? t(
                                              "honestSign.documents.readyToSubmit",
                                          )
                                        : t(
                                              "honestSign.documents.checkRequired",
                                          )}
                                </p>
                            </div>
                        </div>
                    </PanelBody>
                    <PanelFooter className="flex flex-wrap justify-between gap-3">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={sourceBusy}
                            onClick={onCancel ?? reset}
                        >
                            {t("common.cancel")}
                        </Button>
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                disabled={
                                    sourceBusy ||
                                    documentCodesQuery.isFetching ||
                                    (codeSource === "document" &&
                                        documentCodesQuery.isError) ||
                                    bufferedCodes.length === 0
                                }
                                onClick={() => void handleCheckCodes()}
                            >
                                {checkingCodes
                                    ? t("honestSign.documents.checking")
                                    : t("honestSign.documents.checkCodes")}
                            </Button>
                            <Button
                                type="button"
                                disabled={sourceBusy || !currentBufferValid}
                                onClick={() => void handleSubmit()}
                            >
                                {submittingDocument
                                    ? t("honestSign.documents.submitting")
                                    : t("honestSign.documents.submitReport")}
                            </Button>
                        </div>
                    </PanelFooter>
                </>
            )}
        </Panel>
    );
}
