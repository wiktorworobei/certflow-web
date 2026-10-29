import { CloudCheck } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@marking/components/ui/badge";
import { formatDmKodAttributeDate } from "@marking/lib/dmkod-utilisation-attributes";

import type { DmKodActivityRangeState } from "@marking/lib/dmkod-extended-types";

export function DmKodActivityState({
    state,
}: {
    state: DmKodActivityRangeState;
}) {
    const { t } = useTranslation();
    const reported = state.state === "reported";
    return (
        <div className="w-full space-y-2">
            <div className="flex flex-wrap items-center gap-2">
                {reported ? (
                    <CloudCheck
                        className="size-4 text-[var(--dmkod-success)]"
                        aria-hidden="true"
                    />
                ) : null}
                <span>
                    {t(`dmkod.cabinet.activity.states.${state.state}`, {
                        defaultValue: state.state,
                    })}
                </span>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                    {state.ranges.map((range, index) => (
                        <span
                            key={`${range.start}.${range.end}.${index}`}
                            className="inline-flex items-center gap-2"
                        >
                            {range.tag ? (
                                <Badge variant="outline">{range.tag}</Badge>
                            ) : null}
                            <span className="tabular-nums">
                                {range.start === range.end
                                    ? range.start
                                    : `${range.start}–${range.end}`}
                            </span>
                        </span>
                    ))}
                    <Badge
                        variant={reported ? "default" : "outline"}
                        className={
                            reported
                                ? "border-[var(--dmkod-success)] bg-[var(--dmkod-success)]/15 text-foreground"
                                : undefined
                        }
                    >
                        {state.total ?? "—"}
                    </Badge>
                </div>
            </div>
            {state.attributes?.productionDate ||
            state.attributes?.expirationDate ? (
                <dl className="flex flex-wrap justify-end gap-x-3 gap-y-1">
                    {(["productionDate", "expirationDate"] as const).map(
                        (field) => {
                            const value = state.attributes?.[field];
                            return value ? (
                                <div key={field} className="inline-flex gap-1">
                                    <dt>
                                        {t(
                                            `dmkod.cabinet.attributeForm.short.${field}`,
                                        )}
                                        :
                                    </dt>
                                    <dd className="text-foreground">
                                        {formatDmKodAttributeDate(value)}
                                    </dd>
                                </div>
                            ) : null;
                        },
                    )}
                </dl>
            ) : null}
        </div>
    );
}
