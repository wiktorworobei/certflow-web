import { apiClient, toHttpError } from "@marking/lib/honest-sign/httpClient";
import i18n from "@marking/src/i18n";

export type SsccAggregation = {
    id: string;
    documentId: string;
    sscc: string;
    elementString: string;
    productGroup: string;
    participantInn: string;
    level: number;
    childrenCount: number;
    payloadHash: string;
    state:
        | "Prepared"
        | "Sending"
        | "Submitted"
        | "Accepted"
        | "Rejected"
        | "OutcomeUnknown";
    externalDocumentId: string | null;
    externalStatus: string | null;
    createdAtUtc: string;
    updatedAtUtc: string;
    payload: string | null;
};

export const SSCC_PRODUCT_GROUPS = [
    "milk",
    "beer",
    "water",
    "soft-drinks",
    "shoes",
    "lp",
    "perfumery",
    "tires",
    "electronics",
    "bicycle",
    "autofluids",
    "construction",
    "chemistry",
    "petfood",
    "conserve",
    "vegetableoil",
    "seafood",
    "meat",
    "groceries",
];
const url = "/api/honest-sign/aggregations";
async function post(path: string, body?: unknown): Promise<SsccAggregation> {
    try {
        return (await apiClient.post<SsccAggregation>(`${url}/${path}`, body))
            .data;
    } catch (error) {
        throw toHttpError(i18n.t("honestSign.aggregation.failed"), error);
    }
}
export const aggregationApiService = {
    async list(page: number): Promise<SsccAggregation[]> {
        try {
            return (
                await apiClient.get<SsccAggregation[]>(url, {
                    params: { page },
                })
            ).data;
        } catch (error) {
            throw toHttpError(i18n.t("honestSign.aggregation.failed"), error);
        }
    },
    prepare: (sscc: string, productGroup: string) =>
        post("prepare", { sscc, productGroup }),
    submit: (draft: SsccAggregation, signature: string) =>
        post(`${draft.id}/submit`, {
            payloadHash: draft.payloadHash,
            signature,
            physicalCompositionConfirmed: true,
            gs1PrefixOwnershipConfirmed: true,
        }),
    refresh: (id: string) => post(`${id}/refresh`),
    reconcile: (id: string, externalDocumentId: string) =>
        post(`${id}/reconcile`, { externalDocumentId }),
};
