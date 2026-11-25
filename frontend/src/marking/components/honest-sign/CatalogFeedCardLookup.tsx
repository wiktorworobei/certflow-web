import { CatalogGtinCheck, useCatalogGtinLookup } from "@marking/components/honest-sign/CatalogGtinCheck";
import { catalogFeedMessageSuggestsLookup } from "@marking/lib/honest-sign/catalogFeedMessages";
import { isValidCatalogGtin } from "@marking/lib/honest-sign/catalogForm";

import type { CatalogFeedStatus } from "@marking/lib/honest-sign/catalogTypes";

export function catalogFeedLookupGtins(data?: CatalogFeedStatus | null, gtin?: string | null): string[] {
    if (!data) return [];
    const values = [...data.errors, ...(data.messages ?? [])]
        .filter(catalogFeedMessageSuggestsLookup)
        .map((item) => item.gtin?.trim() || gtin?.trim() || "")
        .filter(isValidCatalogGtin)
        .map((value) => value.padStart(14, "0"));
    return [...new Set(values)];
}

function CatalogFeedCardLookupButton({ companyId, submissionId, gtin, showCode }: {
    companyId: string;
    submissionId: string;
    gtin: string;
    showCode: boolean;
}) {
    const lookup = useCatalogGtinLookup({ companyId, submissionId, gtin });
    return <CatalogGtinCheck lookup={lookup} presentation="card" gtinLabel={showCode ? gtin : undefined} />;
}

export function CatalogFeedCardLookup({ companyId, submissionId, gtin, data }: {
    companyId: string;
    submissionId: string;
    gtin?: string | null;
    data?: CatalogFeedStatus | null;
}) {
    const codes = catalogFeedLookupGtins(data, gtin);
    return codes.map((code) => (
        <CatalogFeedCardLookupButton
            key={code}
            companyId={companyId}
            submissionId={submissionId}
            gtin={code}
            showCode={codes.length > 1}
        />
    ));
}
