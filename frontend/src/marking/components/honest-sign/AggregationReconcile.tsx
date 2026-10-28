import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@marking/components/ui/button";
import { Input } from "@marking/components/ui/input";
import { Label } from "@marking/components/ui/label";
import { aggregationApiService } from "@marking/lib/honest-sign/aggregationApiService";

export function AggregationReconcile({
    id,
    onSuccess,
}: {
    id: string;
    onSuccess: () => Promise<void>;
}) {
    const { t } = useTranslation();
    const [externalId, setExternalId] = useState("");
    const mutation = useMutation({
        mutationFn: () =>
            aggregationApiService.reconcile(id, externalId.trim()),
        onSuccess,
    });
    return (
        <form
            className="min-w-52 space-y-2"
            onSubmit={(event) => {
                event.preventDefault();
                mutation.mutate();
            }}
        >
            <Label htmlFor={`reconcile-${id}`}>
                {t("honestSign.aggregation.reconcileId")}
            </Label>
            <Input
                id={`reconcile-${id}`}
                value={externalId}
                required
                maxLength={256}
                disabled={mutation.isPending}
                onChange={(event) => setExternalId(event.target.value)}
            />
            <Button
                type="submit"
                size="sm"
                variant="outline"
                disabled={!externalId.trim() || mutation.isPending}
            >
                {t("honestSign.aggregation.reconcile")}
            </Button>
            {mutation.error ? (
                <p role="alert" className="text-xs text-destructive">
                    {mutation.error.message}
                </p>
            ) : null}
        </form>
    );
}
