import { apiClient } from "@marking/lib/api-client";
import { dmKodRequestConfig } from "@marking/lib/dmkod-request-scope";

import type {
    DmKodReports,
    DmKodReportSigningData,
    DmKodReportSigned,
    DmKodSignReport,
    DmKodReportTask,
    DmKodReportOperation,
} from "@marking/lib/dmkod-report-types";
import type { DmKodScope } from "@marking/lib/dmkod-scope";
import type { DmKodBackgroundTaskAccepted } from "@marking/lib/dmkod-types";

const REPORTS_URL = "/api/dmkod/utilisation/reports";

export const dmKodReportsApi = {
    delete: (
        scope: DmKodScope,
        reportId: number,
        failedOnly: boolean,
        clientRequestId: string,
    ): Promise<DmKodBackgroundTaskAccepted> =>
        apiClient
            .post(
                `${REPORTS_URL}/${reportId}/delete`,
                { clientRequestId },
                { ...dmKodRequestConfig(scope), params: { failedOnly } },
            )
            .then((response) => response.data),
    getReports: (scope: DmKodScope, orderId: number): Promise<DmKodReports> =>
        apiClient
            .get(
                `/api/dmkod/orders/${orderId}/utilisation/reports`,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),
    generate: (
        scope: DmKodScope,
        orderId: number,
        clientRequestId: string,
    ): Promise<DmKodBackgroundTaskAccepted> =>
        apiClient
            .post(
                `/api/dmkod/orders/${orderId}/utilisation/reports/generate`,
                {
                    clientRequestId,
                },
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),
    getSigningData: (
        scope: DmKodScope,
        reportId: number,
    ): Promise<DmKodReportSigningData> =>
        apiClient
            .get(
                `${REPORTS_URL}/${reportId}/signing-data`,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),
    sign: (
        scope: DmKodScope,
        reportId: number,
        request: DmKodSignReport,
    ): Promise<DmKodReportSigned> =>
        apiClient
            .post(
                `${REPORTS_URL}/${reportId}/sign`,
                request,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),
    pull: (
        scope: DmKodScope,
        reportId: number,
        clientRequestId: string,
    ): Promise<DmKodBackgroundTaskAccepted> =>
        apiClient
            .post(
                `${REPORTS_URL}/${reportId}/pull`,
                { clientRequestId },
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),
    getTask: (scope: DmKodScope, taskId: string): Promise<DmKodReportTask> =>
        apiClient
            .get(
                `/api/dmkod/utilisation/report-tasks/${taskId}`,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),
    getOperation: (
        scope: DmKodScope,
        requestId: string,
    ): Promise<DmKodReportOperation> =>
        apiClient
            .get(
                `/api/dmkod/utilisation/report-requests/${requestId}`,
                dmKodRequestConfig(scope),
            )
            .then((response) => response.data),
};
