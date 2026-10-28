import { ClipboardList, History } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { OrdersView } from "@marking/components/honest-sign/types";

type OrdersViewTabsProps = {
    value: OrdersView;
    onChange: (value: OrdersView) => void;
};

export function OrdersViewTabs({ value, onChange }: OrdersViewTabsProps) {
    const { t } = useTranslation();

    return (
        <div
            role="tablist"
            aria-label={t("honestSign.workspace.orderViews.label")}
            className="flex gap-1 border-b"
        >
            {(
                [
                    ["active", ClipboardList],
                    ["completed", History],
                ] as const
            ).map(([view, Icon]) => {
                const selected = value === view;
                return (
                    <button
                        key={view}
                        type="button"
                        role="tab"
                        aria-selected={selected}
                        onClick={() => onChange(view)}
                        className={`relative flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none ${
                            selected
                                ? "text-foreground after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-yellow-400"
                                : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        <Icon className="size-4" aria-hidden="true" />
                        {t(`honestSign.workspace.orderViews.${view}`)}
                    </button>
                );
            })}
        </div>
    );
}
