import { Check, ChevronDown, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@marking/components/ui/button";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@marking/components/ui/collapsible";
import {
    getHttpErrorDiagnostics,
    parseHonestSignErrorDiagnostics,
} from "@marking/lib/honest-sign/errorDiagnostics";

export function CatalogErrorDetails({
    error,
    diagnostics,
    defaultOpen = false,
}: {
    error?: unknown;
    diagnostics?: unknown;
    defaultOpen?: boolean;
}) {
    const { t, i18n } = useTranslation();
    const [open, setOpen] = useState(defaultOpen);
    const [copyResult, setCopyResult] = useState<{
        id: string;
        state: "copied" | "failed";
    } | null>(null);
    const data = error
        ? getHttpErrorDiagnostics(error)
        : parseHonestSignErrorDiagnostics(diagnostics);
    if (!Object.keys(data).length) return null;
    const response = data.responseDiagnostics;
    const rows = [
        ["code", data.code],
        [
            "provider",
            data.provider
                ? t(`honestSign.catalog.diagnostics.providers.${data.provider}`)
                : undefined,
        ],
        ["operation", data.operation],
        [
            "upstreamStatus",
            data.upstreamStatus ? `HTTP ${data.upstreamStatus}` : undefined,
        ],
        ["upstreamErrorCode", data.upstreamErrorCode],
        [
            "contentType",
            response
                ? ["missing", "other"].includes(response.contentType)
                    ? t(
                          `honestSign.catalog.diagnostics.contentTypes.${response.contentType}`,
                      )
                    : response.contentType
                : undefined,
        ],
        [
            "bodyFormat",
            response
                ? t(
                      `honestSign.catalog.diagnostics.bodyFormats.${response.bodyFormat}`,
                  )
                : undefined,
        ],
        [
            "bodyLengthChars",
            response?.bodyLengthChars.toLocaleString(i18n.language),
        ],
        [
            "extractionStatus",
            response
                ? t(
                      `honestSign.catalog.diagnostics.extractionStatuses.${response.extractionStatus}`,
                  )
                : undefined,
        ],
        [
            "discardReason",
            response?.discardReason
                ? t(
                      `honestSign.catalog.diagnostics.discardReasons.${response.discardReason}`,
                  )
                : undefined,
        ],
    ].filter(([, value]) => value !== undefined);
    const copyId = async () => {
        const id = data.correlationId;
        if (!id) return;
        try {
            await navigator.clipboard.writeText(id);
            setCopyResult({ id, state: "copied" });
        } catch {
            setCopyResult({ id, state: "failed" });
        }
    };
    return (
        <Collapsible
            open={open}
            onOpenChange={setOpen}
            className="mt-3 min-w-0"
        >
            <CollapsibleTrigger className="flex items-center gap-2 rounded-sm text-left text-xs font-medium underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronDown
                    aria-hidden="true"
                    className={`size-3.5 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                />
                {t("honestSign.catalog.diagnostics.title")}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3 text-xs">
                {data.correlationId && (
                    <div className="space-y-1">
                        <p className="font-medium">
                            {t("honestSign.catalog.diagnostics.correlationId")}
                        </p>
                        <div className="flex min-w-0 flex-wrap items-center gap-2">
                            <code
                                className="break-all select-all"
                                translate="no"
                            >
                                {data.correlationId}
                            </code>
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void copyId()}
                            >
                                {copyResult?.id === data.correlationId &&
                                copyResult.state === "copied" ? (
                                    <Check
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                ) : (
                                    <Copy
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                )}
                                {t("honestSign.catalog.diagnostics.copyId")}
                            </Button>
                        </div>
                        {copyResult?.id === data.correlationId && (
                            <p role="status">
                                {t(
                                    `honestSign.catalog.diagnostics.${copyResult.state}`,
                                )}
                            </p>
                        )}
                    </div>
                )}
                {rows.length > 0 && (
                    <dl className="grid min-w-0 gap-x-4 gap-y-1 sm:grid-cols-[auto_1fr]">
                        {rows.map(([key, value]) => (
                            <div key={key} className="contents">
                                <dt className="font-medium">
                                    {t(`honestSign.catalog.diagnostics.${key}`)}
                                </dt>
                                <dd className="min-w-0 break-words">{value}</dd>
                            </div>
                        ))}
                    </dl>
                )}
                {data.errors && (
                    <ul className="space-y-1">
                        {data.errors.map((item, index) => (
                            <li key={index} className="break-words">
                                {item.code && <code>{item.code}</code>}
                                {item.parameter && (
                                    <span>
                                        {item.code ? " · " : ""}
                                        {t(
                                            "honestSign.catalog.diagnostics.parameter",
                                        )}
                                        : <code>{item.parameter}</code>
                                    </span>
                                )}
                                {item.descriptionSource && (
                                    <span>
                                        {item.code || item.parameter
                                            ? " · "
                                            : ""}
                                        {t(
                                            `honestSign.catalog.diagnostics.descriptionSources.${item.descriptionSource}`,
                                        )}
                                    </span>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </CollapsibleContent>
        </Collapsible>
    );
}
