import { isAxiosError } from "axios";

import type { DmKodAggregationReport } from "@marking/lib/dmkod-extended-types";

export function canPullDmKodAggregationReport(
    report: Pick<DmKodAggregationReport, "state">,
) {
    return ["SIGNED", "PENDING"].includes(report.state);
}

export function dmKodReportPreparationWasNotSent(
    error: unknown,
    action: string,
) {
    return (
        ["SignAggregation", "SignValidation"].includes(action) &&
        isAxiosError<{ code?: string }>(error) &&
        error.response?.status === 409 &&
        error.response.data?.code === "error.dmkod_report_payload_changed"
    );
}

export function canSignDmKodAggregationReport(
    report: DmKodAggregationReport,
    reports: DmKodAggregationReport[],
    foreignOrder = false,
) {
    return (
        report.canSign === true &&
        !foreignOrder &&
        report.state === "CREATED" &&
        report.precedingAggregationReportIds.every((id) =>
            reports.some(
                (previous) =>
                    previous.id === id && previous.state === "SUCCESS",
            ),
        )
    );
}
