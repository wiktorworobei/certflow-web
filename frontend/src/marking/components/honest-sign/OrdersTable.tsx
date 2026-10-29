import {
    CheckCircle2,
    CircleAlert,
    PackageCheck,
    PlusCircle,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDate } from "@marking/components/honest-sign/utils";
import { Badge } from "@marking/components/ui/badge";
import { Button } from "@marking/components/ui/button";
import { Skeleton } from "@marking/components/ui/skeleton";
import {
    Table as WorkspaceTable,
    TableHeader as WorkspaceTableHeader,
    TableBody as WorkspaceTableBody,
    TableRow as WorkspaceTableRow,
    TableHead as WorkspaceTableHead,
    TableCell as WorkspaceTableCell,
} from "@marking/components/ui/table";

import type { OrderRow, OrdersView } from "@marking/components/honest-sign/types";

type OrdersTableProps = {
    orders: OrderRow[];
    view: OrdersView;
    loading: boolean;
    onCreateOrder: () => void;
    onOpenOrderDetails: (orderId: string, gtin: string) => void;
    onOpenGetCodes: (orderId: string, gtin: string) => void;
    onUploadToConverter?: (orderId: string) => void;
    uploadingToConverterOrderId?: string;
};

const activeColumns = [
    "orderId",
    "createdAt",
    "products",
    "provider",
    "totalCodes",
    "usedCodes",
    "remainingCodes",
    "status",
    "actions",
] as const;

const completedColumns = [
    "orderId",
    "productionOrderId",
    "provider",
    "productCodes",
    "createdAt",
    "receivedAt",
    "closedAt",
    "status",
] as const;

function ProductCodesCell({ order }: { order: OrderRow }) {
    const products = order.products.length
        ? order.products
        : order.firstGtin
          ? [
                {
                    gtin: order.firstGtin,
                    totalCodes: order.totalCodes,
                    status: null,
                },
            ]
          : [];

    if (products.length === 0) {
        return "-";
    }

    return (
        <div className="space-y-1">
            {products.slice(0, 3).map((product, index) => (
                <div
                    key={`${product.gtin ?? "product"}-${index}`}
                    className="whitespace-nowrap"
                >
                    <span className="font-mono text-xs">
                        {product.gtin ?? "-"}
                    </span>{" "}
                    <span className="text-muted-foreground">
                        ({product.totalCodes ?? "-"})
                    </span>
                </div>
            ))}
            {products.length > 3 ? (
                <div className="text-xs text-muted-foreground">
                    +{products.length - 3}
                </div>
            ) : null}
        </div>
    );
}

function OrderStatusBadge({
    order,
    view,
}: {
    order: OrderRow;
    view: OrdersView;
}) {
    const { t } = useTranslation();
    const status = order.status || "-";

    if (view === "completed") {
        const hasError = status === "DECLINED";
        return (
            <div className="max-w-64 space-y-1.5">
                <Badge
                    variant={hasError ? "destructive" : "outline"}
                    className={
                        hasError
                            ? "gap-1"
                            : "gap-1 border-emerald-500/35 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                    }
                >
                    {hasError ? (
                        <CircleAlert aria-hidden="true" />
                    ) : (
                        <PackageCheck aria-hidden="true" />
                    )}
                    {t(`honestSign.workspace.completedStatus.${status}`, {
                        defaultValue: t(
                            `honestSign.workspace.status.${status}`,
                            { defaultValue: status },
                        ),
                    })}
                </Badge>
                {order.declineReason ? (
                    <p
                        className="line-clamp-2 text-xs text-destructive"
                        title={order.declineReason}
                    >
                        {order.declineReason}
                    </p>
                ) : null}
            </div>
        );
    }

    if (status === "READY") {
        return (
            <Badge variant="secondary" className="gap-1">
                <CheckCircle2 aria-hidden="true" />
                {t("honestSign.workspace.status.READY")}
            </Badge>
        );
    }

    return (
        <Badge variant="outline">
            {t(`honestSign.workspace.status.${status}`, {
                defaultValue: status,
            })}
        </Badge>
    );
}

export function OrdersTable({
    orders,
    view,
    loading,
    onCreateOrder,
    onOpenOrderDetails,
    onOpenGetCodes,
    onUploadToConverter,
    uploadingToConverterOrderId,
}: OrdersTableProps) {
    const { t, i18n } = useTranslation();
    const columns = view === "completed" ? completedColumns : activeColumns;

    return (
        <section className="overflow-hidden rounded-lg border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/35 px-4 py-3">
                <div>
                    <h2 className="text-sm font-semibold">
                        {t(
                            view === "completed"
                                ? "honestSign.workspace.completedOrders"
                                : "honestSign.workspace.activeOrders",
                        )}
                    </h2>
                    {view === "completed" ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                            {t("honestSign.workspace.completedOrdersHint")}
                        </p>
                    ) : null}
                </div>
                {view === "active" ? (
                    <Button onClick={onCreateOrder} size="sm">
                        <PlusCircle className="size-4" aria-hidden="true" />
                        {t("honestSign.workspace.createOrder")}
                    </Button>
                ) : null}
            </div>

            <div className="overflow-x-auto">
                <WorkspaceTable
                    className={`w-full text-sm ${
                        view === "completed"
                            ? "min-w-[1320px]"
                            : "min-w-[1240px]"
                    }`}
                >
                    <WorkspaceTableHeader>
                        <WorkspaceTableRow className="border-b bg-muted/60 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
                            {columns.map((column) => (
                                <WorkspaceTableHead
                                    key={column}
                                    className="px-3 py-3"
                                >
                                    {t(`honestSign.workspace.table.${column}`)}
                                </WorkspaceTableHead>
                            ))}
                        </WorkspaceTableRow>
                    </WorkspaceTableHeader>
                    <WorkspaceTableBody>
                        {loading
                            ? Array.from({ length: 4 }, (_, index) => (
                                  <WorkspaceTableRow
                                      key={index}
                                      className="border-b last:border-b-0"
                                  >
                                      {columns.map((column) => (
                                          <WorkspaceTableCell
                                              key={column}
                                              className="px-3 py-4"
                                          >
                                              <Skeleton className="h-5 w-full max-w-32" />
                                          </WorkspaceTableCell>
                                      ))}
                                  </WorkspaceTableRow>
                              ))
                            : null}
                        {!loading
                            ? orders.map((order, index) => {
                                  const orderId = order.orderId || "-";
                                  const isUploading =
                                      uploadingToConverterOrderId === orderId;
                                  const orderLink = (
                                      <button
                                          type="button"
                                          onClick={() =>
                                              onOpenOrderDetails(
                                                  orderId,
                                                  order.firstGtin ?? "",
                                              )
                                          }
                                          className="text-left font-mono text-xs text-primary hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                      >
                                          {orderId}
                                      </button>
                                  );

                                  if (view === "completed") {
                                      return (
                                          <WorkspaceTableRow
                                              key={`${orderId}-${index}`}
                                              className="border-b transition-colors last:border-b-0 hover:bg-muted/30"
                                          >
                                              <WorkspaceTableCell className="px-3 py-4">
                                                  {orderLink}
                                              </WorkspaceTableCell>
                                              <WorkspaceTableCell className="max-w-56 px-3 py-4 font-mono text-xs break-all">
                                                  {order.productionOrderId ||
                                                      "-"}
                                              </WorkspaceTableCell>
                                              <WorkspaceTableCell
                                                  className="max-w-56 truncate px-3 py-4"
                                                  title={order.provider}
                                              >
                                                  {order.provider || "-"}
                                              </WorkspaceTableCell>
                                              <WorkspaceTableCell className="px-3 py-4">
                                                  <ProductCodesCell
                                                      order={order}
                                                  />
                                              </WorkspaceTableCell>
                                              <WorkspaceTableCell className="px-3 py-4 whitespace-nowrap">
                                                  {formatDate(
                                                      order.createdAtUtc,
                                                      i18n.language,
                                                  )}
                                              </WorkspaceTableCell>
                                              <WorkspaceTableCell className="px-3 py-4 whitespace-nowrap">
                                                  {formatDate(
                                                      order.receivedAtUtc,
                                                      i18n.language,
                                                  )}
                                              </WorkspaceTableCell>
                                              <WorkspaceTableCell className="px-3 py-4 whitespace-nowrap">
                                                  {formatDate(
                                                      order.closedAtUtc,
                                                      i18n.language,
                                                  )}
                                              </WorkspaceTableCell>
                                              <WorkspaceTableCell className="px-3 py-4">
                                                  <OrderStatusBadge
                                                      order={order}
                                                      view={view}
                                                  />
                                              </WorkspaceTableCell>
                                          </WorkspaceTableRow>
                                      );
                                  }

                                  return (
                                      <WorkspaceTableRow
                                          key={`${orderId}-${index}`}
                                          className="border-b transition-colors last:border-b-0 hover:bg-muted/30"
                                      >
                                          <WorkspaceTableCell className="px-3 py-4">
                                              {orderLink}
                                          </WorkspaceTableCell>
                                          <WorkspaceTableCell className="px-3 py-4">
                                              {formatDate(
                                                  order.createdAtUtc,
                                                  i18n.language,
                                              )}
                                          </WorkspaceTableCell>
                                          <WorkspaceTableCell className="px-3 py-4">
                                              {order.productsCount}
                                          </WorkspaceTableCell>
                                          <WorkspaceTableCell
                                              className="max-w-52 truncate px-3 py-4"
                                              title={order.provider}
                                          >
                                              {order.provider || "-"}
                                          </WorkspaceTableCell>
                                          <WorkspaceTableCell className="px-3 py-4">
                                              {order.totalCodes ?? "-"}
                                          </WorkspaceTableCell>
                                          <WorkspaceTableCell className="px-3 py-4">
                                              {order.usedCodes ?? "-"}
                                          </WorkspaceTableCell>
                                          <WorkspaceTableCell className="px-3 py-4">
                                              {order.remainingCodes ?? "-"}
                                          </WorkspaceTableCell>
                                          <WorkspaceTableCell className="px-3 py-4">
                                              <OrderStatusBadge
                                                  order={order}
                                                  view={view}
                                              />
                                          </WorkspaceTableCell>
                                          <WorkspaceTableCell className="px-3 py-4">
                                              <div className="flex items-center gap-2">
                                                  <Button
                                                      type="button"
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() =>
                                                          onOpenGetCodes(
                                                              orderId,
                                                              order.firstGtin ??
                                                                  "",
                                                          )
                                                      }
                                                      disabled={
                                                          orderId === "-" ||
                                                          Boolean(
                                                              uploadingToConverterOrderId,
                                                          )
                                                      }
                                                  >
                                                      {t(
                                                          "honestSign.workspace.getCodes",
                                                      )}
                                                  </Button>
                                                  {onUploadToConverter && <Button
                                                      type="button"
                                                      variant="outline"
                                                      size="sm"
                                                      onClick={() =>
                                                          onUploadToConverter(
                                                              orderId,
                                                          )
                                                      }
                                                      disabled={
                                                          orderId === "-" ||
                                                          Boolean(
                                                              uploadingToConverterOrderId,
                                                          )
                                                      }
                                                  >
                                                      {isUploading
                                                          ? t(
                                                                "honestSign.workspace.uploading",
                                                            )
                                                          : t(
                                                                "honestSign.workspace.sendToConverter",
                                                            )}
                                                  </Button>}
                                              </div>
                                          </WorkspaceTableCell>
                                      </WorkspaceTableRow>
                                  );
                              })
                            : null}
                        {!loading && orders.length === 0 ? (
                            <WorkspaceTableRow>
                                <WorkspaceTableCell
                                    colSpan={columns.length}
                                    className="px-3 py-12 text-center text-muted-foreground"
                                >
                                    {t(
                                        view === "completed"
                                            ? "honestSign.workspace.completedOrdersEmpty"
                                            : "honestSign.workspace.ordersEmpty",
                                    )}
                                </WorkspaceTableCell>
                            </WorkspaceTableRow>
                        ) : null}
                    </WorkspaceTableBody>
                </WorkspaceTable>
            </div>
        </section>
    );
}
