import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useDmKodScope } from "@marking/components/dmkod/dmkod-scope-context";
import { Button } from "@marking/components/ui/button";
import { Input } from "@marking/components/ui/input";
import { Label } from "@marking/components/ui/label";
import { dmKodKeys } from "@marking/hooks/use-dmkod";
import { dmKodWorkflowApi } from "@marking/lib/api/dmkod-workflow";

export function DmKodProductionCodeSearch({
    companyId,
}: {
    companyId: string;
}) {
    const { t } = useTranslation();
    const scope = useDmKodScope(companyId);
    const [draft, setDraft] = useState("");
    const [tag, setTag] = useState("");
    const result = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "production-code", tag],
        queryFn: () => dmKodWorkflowApi.productionCode(scope, tag),
        enabled: !!tag,
        retry: false,
    });
    return (
        <section className="space-y-2 rounded-lg border p-4">
            <form
                onSubmit={(event) => {
                    event.preventDefault();
                    setTag(draft.trim());
                    if (tag === draft.trim()) void result.refetch();
                }}
                className="space-y-2"
            >
                <Label htmlFor="dmkod-production-code">
                    {t("dmkod.workflow.productionSearch")}
                </Label>
                <div className="flex flex-wrap gap-2">
                    <Input
                        id="dmkod-production-code"
                        maxLength={256}
                        value={draft}
                        onChange={(event) => setDraft(event.target.value)}
                        className="min-w-0 flex-1"
                    />
                    <Button
                        variant="outline"
                        disabled={!draft.trim() || result.isFetching}
                    >
                        {t("dmkod.orders.apply")}
                    </Button>
                </div>
            </form>
            {result.isLoading ? (
                <p role="status">{t("common.loading")}</p>
            ) : result.isError ? (
                <p role="alert">
                    {t("dmkod.workflow.loadFailed")}{" "}
                    <Button
                        variant="outline"
                        onClick={() => void result.refetch()}
                    >
                        {t("common.retry")}
                    </Button>
                </p>
            ) : result.data ? (
                <ul className="space-y-1 text-sm">
                    {result.data.length ? (
                        result.data.map((item) => (
                            <li key={item.id}>
                                #{item.id} ·{" "}
                                {t("dmkod.workflow.productionQuantity", {
                                    count: item.quantityRequested,
                                })}
                            </li>
                        ))
                    ) : (
                        <li>{t("dmkod.history.empty")}</li>
                    )}
                </ul>
            ) : null}
        </section>
    );
}
