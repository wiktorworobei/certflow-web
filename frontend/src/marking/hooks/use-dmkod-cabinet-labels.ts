import { useQuery } from "@tanstack/react-query";
import { useDmKodScope } from "@marking/components/dmkod/dmkod-scope-context";
import { dmKodKeys } from "@marking/hooks/use-dmkod";
import { dmKodExtendedApi } from "@marking/lib/api/dmkod-extended";

const names = ["PRODUCT_GROUP", "TEMPLATE_ID", "CIS_TYPE", "ORDER_ITEM_FLAG"];
export function useDmKodCabinetLabels(companyId: string, enabled = true) {
    const scope = useDmKodScope(companyId);
    const query = useQuery({
        queryKey: [...dmKodKeys.scoped(scope), "cabinet-dictionaries"],
        queryFn: () =>
            dmKodExtendedApi.read(scope, { method: "Dictionaries", names }),
        enabled,
        retry: false,
        staleTime: 5 * 60_000,
    });
    return (
        dictionary: string,
        value: string | null | undefined,
        fallback?: string,
    ) => {
        const option = query.data?.dictionaries?.[dictionary]?.find(
            (option) => option.value === value,
        );
        return option?.shortLabel || option?.label || fallback || value || "—";
    };
}
