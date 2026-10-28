import { useTranslation } from "react-i18next";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import {
    Panel,
    PanelBody,
    PanelFooter,
    PanelHeader,
} from "@marking/components/honest-sign/ui/panel";
import { formatDate } from "@marking/components/honest-sign/utils";
import { Button } from "@marking/components/ui/button";
import { Skeleton } from "@marking/components/ui/skeleton";

type OrderDetailsPlaceholderProps = {
    orderId: string;
    gtin: string;
    details: unknown;
    loading: boolean;
    error: string;
    onBack: () => void;
};

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isDateLikeKey(key: string): boolean {
    const normalizedKey = key.toLowerCase();
    return (
        normalizedKey.endsWith("date") ||
        normalizedKey.endsWith("timestamp") ||
        normalizedKey.includes("expired") ||
        normalizedKey.includes("created")
    );
}

function DetailValue({
    field,
    value,
    locale,
    yes,
    no,
}: {
    field: string;
    value: unknown;
    locale: string;
    yes: string;
    no: string;
}) {
    if (value === null || value === undefined || value === "") return <>-</>;
    if (typeof value === "boolean") return <>{value ? yes : no}</>;
    if (
        (typeof value === "number" || typeof value === "string") &&
        isDateLikeKey(field)
    ) {
        return <>{formatDate(value, locale)}</>;
    }
    if (typeof value === "string" || typeof value === "number") {
        return <>{String(value)}</>;
    }
    if (Array.isArray(value) || isRecord(value)) {
        return (
            <pre className="font-mono text-xs leading-5 break-all whitespace-pre-wrap">
                {JSON.stringify(value, null, 2)}
            </pre>
        );
    }
    return <>{String(value)}</>;
}

export function OrderDetailsPlaceholder({
    orderId,
    gtin,
    details,
    loading,
    error,
    onBack,
}: OrderDetailsPlaceholderProps) {
    const { t, i18n } = useTranslation();
    const detailItems = Array.isArray(details)
        ? details.filter((item): item is Record<string, unknown> =>
              isRecord(item),
          )
        : isRecord(details)
          ? [details]
          : [];

    return (
        <Panel className="overflow-hidden">
            <PanelHeader className="bg-muted/35 text-sm text-muted-foreground">
                {t("honestSign.workspace.orderTitle", { orderId })}
            </PanelHeader>
            <PanelBody>
                <h2 className="mb-2 text-2xl font-semibold">
                    {t("honestSign.workspace.orderTitle", { orderId })}
                </h2>
                <p className="mb-6 font-mono text-xs text-muted-foreground">
                    GTIN: {gtin || "-"}
                </p>

                {loading ? (
                    <div className="space-y-3" aria-label={t("common.loading")}>
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : null}
                {error ? <Notice variant="error">{error}</Notice> : null}
                {!loading && !error && detailItems.length === 0 ? (
                    <Notice>
                        {t("honestSign.workspace.orderDetailsEmpty")}
                    </Notice>
                ) : null}

                <div className="space-y-8">
                    {detailItems.map((detailItem, index) => (
                        <section key={`${orderId}-${index}`}>
                            {detailItems.length > 1 ? (
                                <h3 className="mb-3 font-semibold">
                                    {t("honestSign.workspace.record", {
                                        number: index + 1,
                                    })}
                                </h3>
                            ) : null}
                            <dl className="divide-y rounded-md border">
                                {Object.entries(detailItem).map(
                                    ([key, value]) => (
                                        <div
                                            key={`${index}-${key}`}
                                            className="grid gap-2 px-4 py-3 md:grid-cols-[220px_minmax(0,1fr)]"
                                        >
                                            <dt className="text-sm font-medium break-all text-muted-foreground">
                                                {key}
                                            </dt>
                                            <dd className="text-sm break-all">
                                                <DetailValue
                                                    field={key}
                                                    value={value}
                                                    locale={i18n.language}
                                                    yes={t("common.yes")}
                                                    no={t("common.no")}
                                                />
                                            </dd>
                                        </div>
                                    ),
                                )}
                            </dl>
                        </section>
                    ))}
                </div>
            </PanelBody>
            <PanelFooter>
                <Button type="button" variant="outline" onClick={onBack}>
                    {t("honestSign.workspace.backToOrders")}
                </Button>
            </PanelFooter>
        </Panel>
    );
}
