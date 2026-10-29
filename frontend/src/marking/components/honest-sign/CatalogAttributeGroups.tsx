import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogAttributeFields } from "@marking/components/honest-sign/CatalogAttributeFields";
import { Badge } from "@marking/components/ui/badge";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@marking/components/ui/collapsible";
import {
    catalogAttributeKey,
    groupCatalogAttributes,
    isCoreCatalogAttribute,
} from "@marking/lib/honest-sign/catalogForm";

import type {
    CatalogFormValues,
    CatalogAttributeGroup,
} from "@marking/lib/honest-sign/catalogForm";
import type { CatalogAttribute } from "@marking/lib/honest-sign/catalogTypes";
import type { UseFormReturn } from "react-hook-form";

export function CatalogAttributeGroups({
    model,
    values,
    form,
    disabled,
    idPrefix,
}: {
    model: CatalogAttribute[];
    values: CatalogFormValues;
    form: UseFormReturn<CatalogFormValues>;
    disabled: boolean;
    idPrefix: string;
}) {
    const { t } = useTranslation();
    const [opened, setOpened] = useState<string[]>([]);
    const groups = groupCatalogAttributes(model, values);
    const layerLabel = (group: CatalogAttributeGroup) =>
        group.layer === "general"
            ? null
            : t(`honestSign.catalog.groupLayers.${group.layer}`);
    const fields = (group: CatalogAttributeGroup, required: boolean) => (
        <div className="grid min-w-0 gap-5 md:grid-cols-2">
            {group.attributes.map((attribute) => (
                <CatalogAttributeFields
                    key={attribute.id}
                    idPrefix={idPrefix}
                    attribute={attribute}
                    form={form}
                    required={required}
                    disabled={disabled}
                    showGroupName={false}
                    showLayer={false}
                    scopedOnly={isCoreCatalogAttribute(
                        attribute.id,
                        values.tnved,
                    )}
                />
            ))}
        </div>
    );
    return (
        <div className="space-y-5">
            {groups.required.length > 0 && (
                <div className="space-y-5">
                    <p className="text-sm font-medium">
                        {t("honestSign.catalog.requiredAttributes")}
                    </p>
                    {groups.required.map((group) => (
                        <section
                            key={group.key}
                            className="space-y-3"
                            aria-label={`${group.name} ${layerLabel(group) ?? ""}`}
                        >
                            <div className="flex flex-wrap items-center gap-2 text-sm">
                                <h4 className="font-medium">
                                    {group.name ||
                                        t("honestSign.catalog.otherAttributes")}
                                </h4>
                                {layerLabel(group) && (
                                    <span className="text-muted-foreground">
                                        {layerLabel(group)}
                                    </span>
                                )}
                            </div>
                            {fields(group, true)}
                        </section>
                    ))}
                </div>
            )}
            {groups.optional.length > 0 && (
                <div className="divide-y border-y">
                    {groups.optional.map((group) => {
                        const hasErrors = group.attributes.some((attribute) =>
                            Boolean(
                                form.formState.errors.attributes?.[
                                    catalogAttributeKey(attribute.id)
                                ],
                            ),
                        );
                        const open = opened.includes(group.key) || hasErrors;
                        const filled = group.attributes.filter((attribute) =>
                            values.attributes[
                                catalogAttributeKey(attribute.id)
                            ]?.some((entry) => entry.value.trim()),
                        ).length;
                        return (
                            <Collapsible
                                key={group.key}
                                open={open}
                                onOpenChange={(next) =>
                                    setOpened((current) =>
                                        next
                                            ? [...current, group.key]
                                            : current.filter(
                                                  (key) => key !== group.key,
                                              ),
                                    )
                                }
                            >
                                <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 rounded-sm py-4 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
                                    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
                                        <span className="font-medium">
                                            {group.name ||
                                                t(
                                                    "honestSign.catalog.otherAttributes",
                                                )}
                                        </span>
                                        {layerLabel(group) && (
                                            <span className="text-muted-foreground">
                                                {layerLabel(group)}
                                            </span>
                                        )}
                                        <span className="text-muted-foreground">
                                            {t(
                                                "honestSign.catalog.optionalGroupCount",
                                                {
                                                    filled,
                                                    total: group.attributes
                                                        .length,
                                                },
                                            )}
                                        </span>
                                        {hasErrors && (
                                            <Badge variant="destructive">
                                                {t(
                                                    "honestSign.catalog.groupHasErrors",
                                                )}
                                            </Badge>
                                        )}
                                    </span>
                                    <ChevronDown
                                        aria-hidden="true"
                                        className={`size-4 shrink-0 transition-transform motion-reduce:transition-none ${open ? "rotate-180" : ""}`}
                                    />
                                </CollapsibleTrigger>
                                <CollapsibleContent
                                    forceMount
                                    hidden={!open}
                                    className="pb-5"
                                >
                                    {fields(group, false)}
                                </CollapsibleContent>
                            </Collapsible>
                        );
                    })}
                </div>
            )}
            {groups.required.length === 0 && groups.optional.length === 0 && (
                <p className="text-sm text-muted-foreground">
                    {t("honestSign.catalog.noAttributes")}
                </p>
            )}
        </div>
    );
}
