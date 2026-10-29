import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Select } from "@marking/components/honest-sign/ui/select";
import { Button } from "@marking/components/ui/button";
import { useCatalogBrands } from "@marking/hooks/use-honest-sign-catalog";

export function CatalogBrandLookup({
    companyId,
    value,
    disabled,
    idPrefix,
    onSelected,
}: {
    companyId: string;
    value: string;
    disabled: boolean;
    idPrefix: string;
    onSelected: (brand: string) => void;
}) {
    const { t } = useTranslation();
    const [query, setQuery] = useState("");
    const [page, setPage] = useState(1);
    const brands = useCatalogBrands(companyId, query, page);
    return (
        <div className="space-y-2">
            <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || !value.trim() || brands.isFetching}
                onClick={() => {
                    if (query === value.trim() && page === 1)
                        void brands.refetch();
                    else {
                        setQuery(value.trim());
                        setPage(1);
                    }
                }}
            >
                {t("honestSign.catalog.findBrand")}
            </Button>
            {query && (
                <div className="space-y-2">
                    <label
                        className="text-xs text-muted-foreground"
                        htmlFor={`${idPrefix}-brand-options`}
                    >
                        {t("honestSign.catalog.brandDictionary")}
                    </label>
                    <Select
                        id={`${idPrefix}-brand-options`}
                        value=""
                        disabled={
                            disabled || brands.isFetching || brands.isError
                        }
                        onChange={(event) => {
                            const chosen = brands.data?.items.find(
                                (brand) =>
                                    String(brand.id) === event.target.value,
                            );
                            if (chosen) {
                                onSelected(chosen.name);
                                setQuery("");
                            }
                        }}
                    >
                        <option value="">
                            {t("honestSign.catalog.selectValue")}
                        </option>
                        {brands.data?.items.map((brand) => (
                            <option key={brand.id} value={brand.id}>
                                {brand.name}
                            </option>
                        ))}
                    </Select>
                    {brands.isFetching && (
                        <p
                            role="status"
                            className="text-xs text-muted-foreground"
                        >
                            {t("honestSign.catalog.loadingBrands")}
                        </p>
                    )}
                    {brands.error && (
                        <p role="alert" className="text-xs text-destructive">
                            {brands.error.message}
                        </p>
                    )}
                    {!brands.isFetching && brands.data?.items.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                            {t("honestSign.catalog.noBrands")}
                        </p>
                    )}
                    <div className="flex flex-wrap gap-2">
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                                disabled || brands.isFetching || page === 1
                            }
                            onClick={() => setPage((current) => current - 1)}
                        >
                            {t("honestSign.catalog.previous")}
                        </Button>
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            disabled={
                                disabled ||
                                brands.isFetching ||
                                !brands.data?.hasNextPage
                            }
                            onClick={() => setPage((current) => current + 1)}
                        >
                            {t("honestSign.catalog.next")}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
