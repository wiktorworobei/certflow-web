import { FileDown, FileUp, FileJson } from "lucide-react";
import { forwardRef, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useDmKodScope } from "@marking/components/dmkod/dmkod-scope-context";
import { Button } from "@marking/components/ui/button";
import { Textarea } from "@marking/components/ui/textarea";
import { useDmKodOrder } from "@marking/hooks/use-dmkod";
import {
    DMKOD_AGGREGATION_JSON_MAX_BYTES,
    DmKodAggregationJsonError,
    dmKodAggregationRangesExample,
    parseDmKodAggregationRangesJson,
    readDmKodAggregationJsonFile,
    serializeDmKodAggregationRangesJson,
} from "@marking/lib/dmkod-aggregation-json";
import { dmKodScopeKey } from "@marking/lib/dmkod-scope";
import { downloadInBrowser } from "@marking/lib/save-file";

import type { ComponentProps } from "react";

type Props = Omit<
    ComponentProps<"textarea">,
    "value" | "onChange" | "onError"
> & {
    companyId: string;
    orderId: number;
    value: string;
    onChange: (value: string) => void;
    onError: (message: string | null) => void;
    onBusyChange?: (busy: boolean) => void;
};

export const DmKodAggregationJsonInput = forwardRef<HTMLTextAreaElement, Props>(
    function DmKodAggregationJsonInput(
        {
            companyId,
            orderId,
            value,
            onChange,
            onError,
            onBusyChange,
            disabled,
            ...props
        },
        ref,
    ) {
        const { t } = useTranslation();
        const scope = useDmKodScope(companyId);
        const scopeKey = dmKodScopeKey(scope);
        const order = useDmKodOrder(
            scope,
            Number.isSafeInteger(orderId) && orderId > 0 ? orderId : null,
        );
        const [importing, setImporting] = useState(false);
        const version = useRef(0);
        const invalidate = useCallback(() => {
            version.current++;
        }, []);
        const input = useRef<HTMLTextAreaElement | null>(null);
        useEffect(() => {
            invalidate();
            return () => {
                invalidate();
                onBusyChange?.(false);
            };
        }, [scopeKey, orderId, onBusyChange, invalidate]);
        const fail = (error: unknown) =>
            onError(
                t(
                    `dmkod.aggregation.jsonErrors.${error instanceof DmKodAggregationJsonError ? error.kind : "structure"}`,
                ),
            );
        const load = async (event: React.ChangeEvent<HTMLInputElement>) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file || disabled || importing) return;
            if (!/\.json$/i.test(file.name)) {
                fail(new DmKodAggregationJsonError("structure"));
                return;
            }
            if (file.size > DMKOD_AGGREGATION_JSON_MAX_BYTES) {
                fail(new DmKodAggregationJsonError("size"));
                return;
            }
            const current = ++version.current;
            setImporting(true);
            onBusyChange?.(true);
            try {
                const request = await readDmKodAggregationJsonFile(
                    file,
                    orderId,
                );
                if (current !== version.current) return;
                onChange(serializeDmKodAggregationRangesJson(request));
                onError(null);
                input.current?.focus();
            } catch (error) {
                if (current === version.current) fail(error);
            } finally {
                if (current === version.current) {
                    setImporting(false);
                    onBusyChange?.(false);
                }
            }
        };
        const exportJson = () => {
            try {
                const request = parseDmKodAggregationRangesJson(value, orderId);
                downloadInBrowser(
                    new Blob([serializeDmKodAggregationRangesJson(request)], {
                        type: "application/json;charset=utf-8",
                    }),
                    `dmkod-aggregation-${orderId}.json`,
                );
                onError(null);
            } catch (error) {
                fail(error);
                input.current?.focus();
            }
        };
        return (
            <div className="min-w-0 space-y-3">
                <div className="flex flex-wrap gap-2">
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm focus-within:ring-2 focus-within:ring-ring hover:bg-muted has-disabled:pointer-events-none has-disabled:opacity-50">
                        <FileUp className="size-4" aria-hidden="true" />
                        {t("dmkod.aggregation.importJson")}
                        <input
                            type="file"
                            accept=".json,application/json"
                            className="sr-only"
                            disabled={disabled || importing}
                            onChange={(event) => void load(event)}
                        />
                    </label>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={disabled || importing || !value.trim()}
                        onClick={exportJson}
                    >
                        <FileDown aria-hidden="true" />
                        {t("dmkod.aggregation.exportJson")}
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        disabled={disabled || importing}
                        onClick={() => {
                            onChange(
                                dmKodAggregationRangesExample(
                                    order.data?.items[0]?.id ?? 1,
                                ),
                            );
                            onError(null);
                            input.current?.focus();
                        }}
                    >
                        <FileJson aria-hidden="true" />
                        {t("dmkod.aggregation.example")}
                    </Button>
                </div>
                <Textarea
                    {...props}
                    ref={(element) => {
                        input.current = element;
                        if (typeof ref === "function") ref(element);
                        else if (ref) ref.current = element;
                    }}
                    value={value}
                    onChange={(event) => {
                        onChange(event.target.value);
                        onError(null);
                    }}
                    disabled={disabled || importing}
                    rows={12}
                    className="max-h-[32rem] min-h-64 overflow-auto font-mono text-sm"
                />
                <p className="text-sm text-muted-foreground">
                    {t(
                        importing
                            ? "dmkod.aggregation.importing"
                            : "dmkod.aggregation.jsonHint",
                    )}
                </p>
            </div>
        );
    },
);
