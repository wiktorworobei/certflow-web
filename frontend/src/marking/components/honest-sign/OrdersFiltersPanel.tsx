import { useTranslation } from "react-i18next";
import { FormField } from "@marking/components/honest-sign/ui/form-field";
import { Panel } from "@marking/components/honest-sign/ui/panel";
import { Select } from "@marking/components/honest-sign/ui/select";
import { formatProductGroupLabel } from "@marking/components/honest-sign/utils";
import { Button } from "@marking/components/ui/button";
import { Input } from "@marking/components/ui/input";
import { ORDER_STATUSES_BY_VIEW } from "@marking/lib/honest-sign/orderViews";

import type { FilterForm, OrdersView } from "@marking/components/honest-sign/types";

type OrdersFiltersPanelProps = {
    filters: FilterForm;
    view: OrdersView;
    productGroups: string[];
    loadingOrders: boolean;
    onChange: (patch: Partial<FilterForm>) => void;
    onRefresh: () => void;
    onApply: () => void;
    onReset: () => void;
};

export function OrdersFiltersPanel({
    filters,
    view,
    productGroups,
    loadingOrders,
    onChange,
    onRefresh,
    onApply,
    onReset,
}: OrdersFiltersPanelProps) {
    const { t } = useTranslation();
    const productGroupLabel = (group: string) =>
        t(`honestSign.productGroups.${group}`, {
            defaultValue: formatProductGroupLabel(group),
        });

    return (
        <Panel className="p-4">
            <h2 className="mb-4 text-sm font-semibold tracking-wide text-muted-foreground uppercase">
                {t("honestSign.workspace.filters.title")}
            </h2>

            <div className="grid gap-3 md:grid-cols-5">
                <FormField
                    label={t("honestSign.workspace.filters.dateFrom")}
                    htmlFor="dateFrom"
                >
                    <Input
                        id="dateFrom"
                        type="date"
                        value={filters.dateFrom}
                        onChange={(event) =>
                            onChange({ dateFrom: event.target.value })
                        }
                    />
                </FormField>

                <FormField
                    label={t("honestSign.workspace.filters.dateTo")}
                    htmlFor="dateTo"
                >
                    <Input
                        id="dateTo"
                        type="date"
                        value={filters.dateTo}
                        onChange={(event) =>
                            onChange({ dateTo: event.target.value })
                        }
                    />
                </FormField>

                <FormField
                    label={t("honestSign.workspace.filters.status")}
                    htmlFor="status"
                >
                    <Select
                        id="status"
                        value={filters.orderStatus}
                        onChange={(event) =>
                            onChange({ orderStatus: event.target.value })
                        }
                    >
                        <option value="">{t("common.all")}</option>
                        {ORDER_STATUSES_BY_VIEW[view].map((status) => (
                            <option key={status} value={status}>
                                {t(`honestSign.workspace.status.${status}`, {
                                    defaultValue: status,
                                })}
                            </option>
                        ))}
                    </Select>
                </FormField>

                <FormField
                    label={t("honestSign.workspace.productGroup")}
                    htmlFor="group"
                >
                    <Select
                        id="group"
                        value={filters.productGroup}
                        onChange={(event) =>
                            onChange({ productGroup: event.target.value })
                        }
                    >
                        <option value="">{t("common.all")}</option>
                        {productGroups.map((group) => (
                            <option key={group} value={group}>
                                {productGroupLabel(group)}
                            </option>
                        ))}
                    </Select>
                </FormField>

                <FormField
                    label={t("honestSign.workspace.filters.limit")}
                    htmlFor="limit"
                >
                    <Select
                        id="limit"
                        value={String(filters.limit)}
                        onChange={(event) =>
                            onChange({
                                limit: Number(event.target.value) || 10,
                            })
                        }
                    >
                        <option value="10">10</option>
                        <option value="20">20</option>
                        <option value="50">50</option>
                    </Select>
                </FormField>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
                <Button
                    variant="outline"
                    disabled={loadingOrders}
                    onClick={onRefresh}
                >
                    {t("common.refresh")}
                </Button>
                <Button onClick={onApply}>
                    {t("honestSign.workspace.filters.apply")}
                </Button>
                <Button variant="outline" onClick={onReset}>
                    {t("common.reset")}
                </Button>
            </div>
        </Panel>
    );
}
