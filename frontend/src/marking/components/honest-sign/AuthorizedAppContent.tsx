import { DocumentsCenter } from "@marking/components/honest-sign/DocumentsCenter";
import { NationalCatalogWorkspace } from "@marking/components/honest-sign/NationalCatalogWorkspace";
import { OrdersWorkspace } from "@marking/components/honest-sign/OrdersWorkspace";

import type { MarkingAppController } from "@marking/components/honest-sign/use-honest-sign-app";

type AuthorizedAppContentProps = {
    app: MarkingAppController;
    companyId: string;
};

export function AuthorizedAppContent({
    app,
    companyId,
}: AuthorizedAppContentProps) {
    if (app.activeTopTab === "orders") {
        return <OrdersWorkspace app={app} />;
    }
    if (app.activeTopTab === "catalog") {
        return (
            <NationalCatalogWorkspace
                key={companyId}
                companyId={companyId}
                selectedThumbprint={app.selectedThumbprint}
            />
        );
    }

    return (
        <DocumentsCenter
            key={companyId}
            companyId={companyId}
            productGroups={app.productGroups}
            selectedThumbprint={app.selectedThumbprint}
            onOpenOrders={() => app.handleTopTabChange("orders")}
        />
    );
}
