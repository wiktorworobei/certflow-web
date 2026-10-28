export interface DmKodReport {
    id: number;
    uuid: string | null;
    state: string;
    createdAtUtc: string | null;
    /** Number of product positions, not marking codes. */
    itemsCount: number;
    failureReason?: string | null;
}

export interface DmKodReports {
    reports: DmKodReport[];
    backgroundTaskIds: string[];
}

export interface DmKodReportSigningData {
    reportId: number;
    data: string;
    payloadHash: string;
}

export interface DmKodSignReport {
    clientRequestId: string;
    signature: string;
    certificateThumbprint: string;
    payloadHash: string;
}

export interface DmKodReportSigned {
    reportId: number;
    uuid: string;
    replayed: boolean;
}

export interface DmKodReportTask {
    backgroundTaskId: string;
    state: string;
    resultState: string | null;
    reportIds: number[];
    orderId: number | null;
    reportId: number | null;
    messages: { key: string | null; level: string | null }[];
    /** Fresh order reports confirm generation output while the original BGT is unavailable. */
    generationReconciled?: boolean;
}

export interface DmKodReportOperation {
    backgroundTaskId: string | null;
    reportId: number | null;
    uuid: string | null;
    replayed: boolean;
}
