import { ScanLine } from "lucide-react";
import { useTranslation } from "react-i18next";

import type { ReactNode } from "react";
import "@marking/src/styles/integration-theme.css";
import "@marking/src/styles/dmkod-theme.css";

/** Scoped palette: never changes the application theme, navigation or semantic status colors. */
export function IntegrationSurface({
    integration,
    children,
}: {
    integration: "dmkod" | "honestSign";
    children: ReactNode;
}) {
    const { t } = useTranslation();
    return (
        <div
            data-integration={integration}
            className="integration-theme min-w-0 rounded-lg border bg-background text-foreground"
        >
            {integration !== "dmkod" ? (
                <div className="integration-brand flex flex-wrap items-center justify-between gap-2 rounded-t-lg border-b-4 px-4 py-3 md:px-6">
                    <div className="flex items-center gap-2 font-semibold">
                        <ScanLine className="size-5" aria-hidden="true" />
                        {t("honestSign.title")}
                    </div>
                    <span className="text-xs">
                        {t("dmkod.integrationLabel")}
                    </span>
                </div>
            ) : null}
            {children}
        </div>
    );
}
