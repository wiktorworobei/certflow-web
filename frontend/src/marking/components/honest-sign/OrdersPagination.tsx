import { useTranslation } from "react-i18next";
import { Button } from "@marking/components/ui/button";

type OrdersPaginationProps = {
    page: number;
    totalItems: number;
    loadingOrders: boolean;
    hasNextPage: boolean;
    onPreviousPage: () => void;
    onNextPage: () => void;
};

export function OrdersPagination({
    page,
    totalItems,
    loadingOrders,
    hasNextPage,
    onPreviousPage,
    onNextPage,
}: OrdersPaginationProps) {
    const { t } = useTranslation();
    return (
        <section className="rounded-lg border bg-card p-4">
            <div className="flex flex-col items-center justify-between gap-3 text-sm text-muted-foreground md:flex-row">
                <div>
                    {t("honestSign.workspace.pagination", { page, totalItems })}
                </div>
                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        disabled={page <= 1 || loadingOrders}
                        onClick={onPreviousPage}
                    >
                        {t("common.previous")}
                    </Button>
                    <Button
                        disabled={!hasNextPage || loadingOrders}
                        onClick={onNextPage}
                    >
                        {t("common.next")}
                    </Button>
                </div>
            </div>
        </section>
    );
}
