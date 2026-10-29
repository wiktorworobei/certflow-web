export type PermitReference = { attributeId: number; number: string; date?: string };
export type PermitDocument = {
    attributeId: number; number: string; fromDate: string | null; toDate: string | null;
    productName: string | null; applicantName: string | null; manufacturerName: string | null;
    tnved: string | null; identification: string | null; regulations: string | null;
    status: string | null; statusGroup: number | null; active: boolean | null; updatedAt: string | null;
};
export type PermitLookup = {
    documents: PermitDocument[];
    errors: { code: string | null; message: string; number: string | null; statusGroup: number | null; registryRequestPending: boolean }[];
    retrievedAtUtc: string;
};
