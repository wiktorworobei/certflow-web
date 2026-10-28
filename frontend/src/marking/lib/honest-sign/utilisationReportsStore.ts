import { create } from "zustand";

import type { SubmittedUtilisationReport } from "@marking/lib/honest-sign/utilisationReport";

type UtilisationReportsState = {
    reportsByCompany: Record<string, SubmittedUtilisationReport[]>;
    clearReports: (companyId: string) => void;
    rememberReport: (
        companyId: string,
        report: SubmittedUtilisationReport,
    ) => void;
};

export const useUtilisationReportsStore = create<UtilisationReportsState>(
    (set) => ({
        reportsByCompany: {},
        clearReports: (companyId) =>
            set((state) => {
                const reportsByCompany = { ...state.reportsByCompany };
                delete reportsByCompany[companyId];
                return { reportsByCompany };
            }),
        rememberReport: (companyId, report) =>
            set((state) => ({
                reportsByCompany: {
                    ...state.reportsByCompany,
                    [companyId]: [
                        report,
                        ...(state.reportsByCompany[companyId] ?? []).filter(
                            (item) => item.reportId !== report.reportId,
                        ),
                    ],
                },
            })),
    }),
);
