import { CreateOrderStepOne } from "@marking/components/honest-sign/CreateOrderStepOne";
import { CreateOrderStepTwo } from "@marking/components/honest-sign/CreateOrderStepTwo";
import { GetCodesModal } from "@marking/components/honest-sign/GetCodesModal";
import { OrderDetailsPlaceholder } from "@marking/components/honest-sign/OrderDetailsPlaceholder";
import { OrdersFiltersPanel } from "@marking/components/honest-sign/OrdersFiltersPanel";
import { OrdersPagination } from "@marking/components/honest-sign/OrdersPagination";
import { OrdersTable } from "@marking/components/honest-sign/OrdersTable";
import { OrdersViewTabs } from "@marking/components/honest-sign/OrdersViewTabs";
import { Notice } from "@marking/components/honest-sign/ui/notice";

import type { MarkingAppController } from "@marking/components/honest-sign/use-honest-sign-app";

type OrdersWorkspaceProps = {
    app: MarkingAppController;
};

export function OrdersWorkspace({ app }: OrdersWorkspaceProps) {
    return (
        <div className="space-y-4 p-4 md:p-6">
            {app.createOrderStep === 1 ? (
                <CreateOrderStepOne
                    onCancel={() => app.navigateToOrdersList()}
                    onNext={() => app.navigateToCreateStep(2)}
                    selectedProductGroup={app.createOrderProductGroup}
                    productGroups={app.productGroups}
                    onProductGroupChange={
                        app.handleCreateOrderProductGroupChange
                    }
                    selectedReleaseMethod={app.createOrderReleaseMethod}
                    onReleaseMethodChange={app.setCreateOrderReleaseMethod}
                    selectedPaymentType={app.createOrderPaymentType}
                    onPaymentTypeChange={app.setCreateOrderPaymentType}
                />
            ) : app.createOrderStep === 2 ? (
                <CreateOrderStepTwo
                    onBack={() => app.navigateToCreateStep(1)}
                    onCancel={() => app.navigateToOrdersList()}
                    selectedProductGroup={app.createOrderProductGroup}
                    selectedTemplateId={app.createOrderTemplateId}
                    onTemplateChange={app.setCreateOrderTemplateId}
                    products={app.createOrderProducts}
                    onAddProduct={app.handleAddCreateOrderProduct}
                    onRemoveProduct={app.handleRemoveCreateOrderProduct}
                    onProductChange={app.handleUpdateCreateOrderProduct}
                    onCreateOrder={app.handleCreateOrder}
                    creatingOrder={app.creatingOrder}
                    createOrderError={app.createOrderErrorMessage}
                    createOrderSuccess={app.createOrderSuccessMessage}
                />
            ) : app.openedOrder ? (
                <OrderDetailsPlaceholder
                    orderId={app.openedOrder.orderId}
                    gtin={app.openedOrder.gtin}
                    details={app.orderDetails}
                    loading={app.orderDetailsLoading}
                    error={app.orderDetailsError}
                    onBack={() => app.navigateToOrdersList()}
                />
            ) : (
                <>
                    <OrdersViewTabs
                        value={app.ordersView}
                        onChange={app.handleOrdersViewChange}
                    />

                    {app.productGroupsError ? (
                        <Notice variant="error">
                            {app.productGroupsError}
                        </Notice>
                    ) : null}

                    <OrdersFiltersPanel
                        filters={app.filters}
                        view={app.ordersView}
                        productGroups={app.productGroups}
                        loadingOrders={app.loadingOrders}
                        onChange={app.handleFiltersChange}
                        onRefresh={app.handleRefreshOrders}
                        onApply={app.handleApplyFilters}
                        onReset={app.handleResetFilters}
                    />

                    {app.ordersError ? (
                        <Notice variant="error">{app.ordersError}</Notice>
                    ) : null}
                    {app.uploadOrderCodesToConverterErrorMessage ? (
                        <Notice variant="error">
                            {app.uploadOrderCodesToConverterErrorMessage}
                        </Notice>
                    ) : null}

                    <OrdersTable
                        orders={app.orders}
                        view={app.ordersView}
                        loading={app.loadingOrders}
                        onCreateOrder={app.handleStartCreateOrder}
                        onOpenOrderDetails={app.navigateToOrderDetails}
                        onOpenGetCodes={app.openGetCodesModal}
                    />

                    <OrdersPagination
                        page={app.page}
                        totalItems={app.totalItems}
                        loadingOrders={app.loadingOrders}
                        hasNextPage={app.hasNextPage}
                        onPreviousPage={app.handlePreviousPage}
                        onNextPage={app.handleNextPage}
                    />
                </>
            )}

            <GetCodesModal
                open={app.isGetCodesModalOpen}
                orderId={app.getCodesOrderId}
                gtin={app.getCodesGtin}
                quantity={app.getCodesQuantity}
                gettingCodes={app.gettingCodes}
                uploadingToConverter={app.uploadingOrderCodesToConverter}
                preparationMessage={app.converterPreparationMessage}
                uploadErrorMessage={app.uploadOrderCodesToConverterErrorMessage}
                errorMessage={app.getCodesErrorMessage}
                result={app.getCodesResult}
                onClose={app.closeGetCodesModal}
                onGtinChange={app.setGetCodesGtin}
                onQuantityChange={app.setGetCodesQuantity}
                onSubmit={app.handleGetCodes}
                onUploadToConverter={app.handleUploadOrderCodesToConverterModal}
            />
        </div>
    );
}
