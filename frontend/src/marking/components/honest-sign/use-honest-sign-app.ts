import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    CIS_TYPE_MAP,
    PAYMENT_TYPE_MAP,
    PRODUCT_GROUP_DEFAULT_TEMPLATE_IDS,
    RELEASE_METHOD_TYPE_MAP,
    SERIAL_NUMBER_TYPE_MAP,
    createEmptyProductDraft,
} from "@marking/components/honest-sign/constants";
import {
    downloadCodesFile,
    normalizeProductGroupFilter,
    toEndTimestamp,
    toStartTimestamp,
} from "@marking/components/honest-sign/utils";
import { honestSignKeys } from "@marking/hooks/use-honest-sign";
import {
    type AppSessionResponse,
    authApiService,
} from "@marking/lib/honest-sign/authApiService";
import {
    SESSION_VALIDATION_INTERVAL_MS,
    shouldRunSessionHeartbeat,
} from "@marking/lib/honest-sign/authSessionGuard";
import { resolveAvailableThumbprint } from "@marking/lib/honest-sign/certificateSelection";
import { buildCreateOrderBody } from "@marking/lib/honest-sign/createOrderPayload";
import { cryptoProSignatureService } from "@marking/lib/honest-sign/cryptoProSignatureService";
import {
    getHttpErrorCode,
    getHttpErrorStatus,
} from "@marking/lib/honest-sign/httpClient";
import { ordersApiService } from "@marking/lib/honest-sign/ordersApiService";
import {
    clearOrdersFilters,
    DEFAULT_ORDERS_FILTERS,
    getStoredOrdersFilters,
    saveOrdersFilters,
} from "@marking/lib/honest-sign/ordersFiltersStore";
import { resolveOrderStatuses } from "@marking/lib/honest-sign/orderViews";
import { participantsApiService } from "@marking/lib/honest-sign/participantsApiService";
import { useUtilisationReportsStore } from "@marking/lib/honest-sign/utilisationReportsStore";

import type {
    BreadcrumbItem,
    BrowserViewState,
    CertificateOption,
    CreateOrderProductDraft,
    FilterForm,
    OrderRow,
    OrdersView,
    StatusVariant,
    TopTab,
} from "@marking/components/honest-sign/types";
import type { CertificateSummary } from "@marking/lib/honest-sign/types";

type GetCodesModalResult = {
    downloadedFileName: string;
    codesCount: number;
    queuedForConverter: boolean;
    queuedOrderId: string;
    fileDownloaded?: boolean;
    converterUpload?: {
        orderId: string;
        codesCount: number;
    };
};

export function useMarkingApp(companyId: string, catalogOnly = false) {
    const { t } = useTranslation();
    const active = useRef(true);
    useEffect(() => {
        active.current = true;
        return () => {
            active.current = false;
        };
    }, []);
    const queryClient = useQueryClient();
    const [checkingSession, setCheckingSession] = useState(true);

    const [certificates, setCertificates] = useState<CertificateSummary[]>([]);
    const [selectedThumbprint, setSelectedThumbprint] = useState("");
    const [loadingCertificates, setLoadingCertificates] = useState(false);
    const [certificatesReloadCounter, setCertificatesReloadCounter] =
        useState(0);
    const [connectingHonestSign, setConnectingHonestSign] = useState(false);
    const [statusMessage, setStatusMessage] = useState("");
    const [statusVariant, setStatusVariant] = useState<StatusVariant>("info");

    const [isAuthorized, setIsAuthorized] = useState(false);
    const [sessionThumbprint, setSessionThumbprint] = useState("");
    const [activeTopTab, setActiveTopTab] = useState<TopTab>(catalogOnly ? "catalog" : "orders");
    const [ordersView, setOrdersView] = useState<OrdersView>("active");
    const [createOrderStep, setCreateOrderStep] = useState<1 | 2 | null>(null);
    const [openedOrder, setOpenedOrder] = useState<{
        orderId: string;
        gtin: string;
    } | null>(null);
    const [orderDetails, setOrderDetails] = useState<unknown>(null);
    const [orderDetailsLoading, setOrderDetailsLoading] = useState(false);
    const [orderDetailsError, setOrderDetailsError] = useState("");

    const [orders, setOrders] = useState<OrderRow[]>([]);
    const [loadingOrders, setLoadingOrders] = useState(false);
    const [ordersError, setOrdersError] = useState("");
    const [productGroups, setProductGroups] = useState<string[]>([]);
    const [productGroupsError, setProductGroupsError] = useState("");
    const [productGroupsResolved, setProductGroupsResolved] = useState(false);
    const [page, setPage] = useState(1);
    const [totalItems, setTotalItems] = useState(0);
    const [ordersReloadCounter, setOrdersReloadCounter] = useState(0);

    const [appliedFilters, setAppliedFilters] = useState<FilterForm>(() =>
        getStoredOrdersFilters(companyId),
    );
    const [filters, setFilters] = useState<FilterForm>(() => ({
        ...appliedFilters,
    }));
    const [createOrderProductGroup, setCreateOrderProductGroup] = useState("");
    const [createOrderReleaseMethod, setCreateOrderReleaseMethod] =
        useState("");
    const [createOrderPaymentType, setCreateOrderPaymentType] = useState("");
    const [createOrderTemplateId, setCreateOrderTemplateId] = useState<
        number | null
    >(null);
    const [createOrderProducts, setCreateOrderProducts] = useState<
        CreateOrderProductDraft[]
    >([createEmptyProductDraft()]);
    const [creatingOrder, setCreatingOrder] = useState(false);
    const [createOrderErrorMessage, setCreateOrderErrorMessage] = useState("");
    const [createOrderSuccessMessage, setCreateOrderSuccessMessage] =
        useState("");

    const [isGetCodesModalOpen, setIsGetCodesModalOpen] = useState(false);
    const [getCodesOrderId, setGetCodesOrderId] = useState("");
    const [getCodesGtin, setGetCodesGtin] = useState("");
    const [getCodesQuantity, setGetCodesQuantity] = useState("1");
    const [gettingCodes, setGettingCodes] = useState(false);
    const [uploadingOrderCodesToConverter, setUploadingOrderCodesToConverter] =
        useState(false);
    const [
        uploadingOrderCodesToConverterOrderId,
        setUploadingOrderCodesToConverterOrderId,
    ] = useState("");
    const [getCodesErrorMessage, setGetCodesErrorMessage] = useState("");
    const [
        uploadOrderCodesToConverterErrorMessage,
        setUploadOrderCodesToConverterErrorMessage,
    ] = useState("");
    const [getCodesResult, setGetCodesResult] = useState<unknown>(null);
    const [converterPreparationMessage, setConverterPreparationMessage] =
        useState("");
    const codesViewVersionRef = useRef(0);
    const codesActionRef = useRef<object | null>(null);

    useEffect(
        () => () => {
            codesViewVersionRef.current += 1;
        },
        [],
    );

    const invalidateCodesView = () => {
        codesViewVersionRef.current += 1;
        setConverterPreparationMessage("");
    };

    const openCodesDialog = (orderId: string, gtin = "", preparation = "") => {
        invalidateCodesView();
        setGetCodesOrderId(orderId);
        setGetCodesGtin(gtin);
        setGetCodesQuantity("1");
        setGetCodesErrorMessage("");
        setUploadOrderCodesToConverterErrorMessage("");
        setGetCodesResult(null);
        setConverterPreparationMessage(preparation);
        setIsGetCodesModalOpen(true);
    };

    const beginCodesAction = () => {
        if (codesActionRef.current) return null;
        const action = {};
        codesActionRef.current = action;
        const version = codesViewVersionRef.current;
        return {
            isCurrent: () =>
                codesViewVersionRef.current === version &&
                codesActionRef.current === action,
            finish: () => {
                if (codesActionRef.current !== action) return;
                codesActionRef.current = null;
                setGettingCodes(false);
                setUploadingOrderCodesToConverter(false);
                setUploadingOrderCodesToConverterOrderId("");
            },
        };
    };

    const sessionGuardInFlightRef = useRef(false);
    const lastSessionHeartbeatAtRef = useRef(0);

    const updateStatus = (message: string, variant: StatusVariant = "info") => {
        setStatusMessage(message);
        setStatusVariant(variant);
    };

    const clearStatus = () => {
        setStatusMessage("");
        setStatusVariant("info");
    };

    const applyServerSession = (session: AppSessionResponse) => {
        setIsAuthorized(
            session.isAuthenticated && session.hasHonestSignSession,
        );
        setSessionThumbprint(session.certificateThumbprint ?? "");

        if (session.certificateThumbprint) {
            setSelectedThumbprint(
                (current) => current || session.certificateThumbprint || "",
            );
        }
    };

    const clearProtectedWorkspace = (
        nextStatusMessage = "",
        nextStatusVariant: StatusVariant = "info",
    ) => {
        invalidateCodesView();
        clearOrdersFilters(companyId);
        const queries = { queryKey: [...honestSignKeys.all, companyId] };
        void queryClient.cancelQueries(queries);
        queryClient.removeQueries(queries);
        useUtilisationReportsStore.getState().clearReports(companyId);
        sessionGuardInFlightRef.current = false;
        lastSessionHeartbeatAtRef.current = 0;
        setIsAuthorized(false);
        setSessionThumbprint("");
        setCertificates([]);
        setSelectedThumbprint("");
        setLoadingCertificates(false);
        setCertificatesReloadCounter((current) => current + 1);
        setActiveTopTab(catalogOnly ? "catalog" : "orders");
        setOrdersView("active");
        setConnectingHonestSign(false);
        updateStatus(nextStatusMessage, nextStatusVariant);
        setOrders([]);
        setLoadingOrders(false);
        setOrdersError("");
        setProductGroups([]);
        setProductGroupsError("");
        setProductGroupsResolved(false);
        setTotalItems(0);
        setPage(1);
        setOrdersReloadCounter(0);
        const clearedFilters = { ...DEFAULT_ORDERS_FILTERS };
        setAppliedFilters(clearedFilters);
        setFilters(clearedFilters);
        setCreateOrderStep(null);
        setOpenedOrder(null);
        setOrderDetails(null);
        setOrderDetailsLoading(false);
        setOrderDetailsError("");
        setCreateOrderProductGroup("");
        setCreateOrderReleaseMethod("");
        setCreateOrderPaymentType("");
        setCreateOrderTemplateId(null);
        setCreateOrderProducts([createEmptyProductDraft()]);
        setCreatingOrder(false);
        setCreateOrderErrorMessage("");
        setCreateOrderSuccessMessage("");
        setIsGetCodesModalOpen(false);
        setGettingCodes(false);
        setUploadingOrderCodesToConverter(false);
        setUploadingOrderCodesToConverterOrderId("");
        setGetCodesOrderId("");
        setGetCodesGtin("");
        setGetCodesQuantity("1");
        setGetCodesErrorMessage("");
        setUploadOrderCodesToConverterErrorMessage("");
        setGetCodesResult(null);

        if (typeof window !== "undefined") {
            const nextState = {
                ...(window.history.state as Record<string, unknown>),
                appView: { view: "orders-list" },
            };
            window.history.replaceState(nextState, "");
        }
    };

    const resolveTemplateIdForProductGroup = (
        productGroup: string,
    ): number | null =>
        PRODUCT_GROUP_DEFAULT_TEMPLATE_IDS[productGroup] ?? null;

    const handleCreateOrderProductGroupChange = (productGroup: string) => {
        setCreateOrderProductGroup(productGroup);
        setCreateOrderTemplateId(
            resolveTemplateIdForProductGroup(productGroup),
        );
    };

    const readHistoryView = (
        historyState: unknown,
    ): BrowserViewState | null => {
        if (!historyState || typeof historyState !== "object") {
            return null;
        }

        const candidate = (historyState as { appView?: unknown }).appView;
        if (!candidate || typeof candidate !== "object") {
            return null;
        }

        const view = (candidate as { view?: unknown }).view;
        if (
            view === "orders-list" ||
            view === "create-step-1" ||
            view === "create-step-2"
        ) {
            return { view };
        }

        if (view === "order-details") {
            const orderId = (candidate as { orderId?: unknown }).orderId;
            const gtin = (candidate as { gtin?: unknown }).gtin;
            if (typeof orderId === "string" && typeof gtin === "string") {
                return { view: "order-details", orderId, gtin };
            }
        }

        return null;
    };

    const applyViewState = (viewState: BrowserViewState) => {
        invalidateCodesView();
        setIsGetCodesModalOpen(false);
        setGetCodesResult(null);
        if (viewState.view === "orders-list") {
            setCreateOrderStep(null);
            setOpenedOrder(null);
            return;
        }

        if (viewState.view === "create-step-1") {
            setOpenedOrder(null);
            setCreateOrderStep(1);
            return;
        }

        if (viewState.view === "create-step-2") {
            setOpenedOrder(null);
            setCreateOrderStep(2);
            return;
        }

        setCreateOrderStep(null);
        setOpenedOrder({ orderId: viewState.orderId, gtin: viewState.gtin });
    };

    const updateBrowserHistory = (
        viewState: BrowserViewState,
        mode: "push" | "replace" = "push",
    ) => {
        if (typeof window === "undefined") {
            return;
        }

        const nextState = {
            ...(window.history.state as Record<string, unknown>),
            appView: viewState,
        };
        if (mode === "replace") {
            window.history.replaceState(nextState, "");
            return;
        }

        window.history.pushState(nextState, "");
    };

    const navigateToOrdersList = (mode: "push" | "replace" = "push") => {
        if (createOrderStep !== null) {
            setCreateOrderProductGroup("");
            setCreateOrderReleaseMethod("");
            setCreateOrderPaymentType("");
            setCreateOrderTemplateId(null);
            setCreateOrderProducts([createEmptyProductDraft()]);
            setCreatingOrder(false);
            setCreateOrderErrorMessage("");
            setCreateOrderSuccessMessage("");
        }
        applyViewState({ view: "orders-list" });
        updateBrowserHistory({ view: "orders-list" }, mode);
    };

    const navigateToCreateStep = (
        step: 1 | 2,
        mode: "push" | "replace" = "push",
    ) => {
        if (step === 1) {
            applyViewState({ view: "create-step-1" });
            updateBrowserHistory({ view: "create-step-1" }, mode);
            return;
        }

        applyViewState({ view: "create-step-2" });
        updateBrowserHistory({ view: "create-step-2" }, mode);
    };

    const navigateToOrderDetails = (
        orderId: string,
        gtin: string,
        mode: "push" | "replace" = "push",
    ) => {
        applyViewState({ view: "order-details", orderId, gtin });
        updateBrowserHistory({ view: "order-details", orderId, gtin }, mode);
    };

    const breadcrumbItems: BreadcrumbItem[] = (() => {
        if (createOrderStep === 1) {
            return [
                {
                    label: t("honestSign.messages.breadcrumbs.orders"),
                    onClick: () => navigateToOrdersList(),
                },
                { label: t("honestSign.messages.breadcrumbs.newOrder") },
            ];
        }

        if (createOrderStep === 2) {
            return [
                {
                    label: t("honestSign.messages.breadcrumbs.orders"),
                    onClick: () => navigateToOrdersList(),
                },
                {
                    label: t("honestSign.messages.breadcrumbs.newOrder"),
                    onClick: () => navigateToCreateStep(1),
                },
                { label: t("honestSign.messages.breadcrumbs.productsStep") },
            ];
        }

        if (openedOrder) {
            return [
                {
                    label: t("honestSign.messages.breadcrumbs.orders"),
                    onClick: () => navigateToOrdersList(),
                },
                {
                    label: t("honestSign.messages.breadcrumbs.order", {
                        orderId: openedOrder.orderId,
                    }),
                },
            ];
        }

        return [{ label: t("honestSign.messages.breadcrumbs.orders") }];
    })();

    const showOrdersBreadcrumbBar = breadcrumbItems.length > 1;

    useEffect(() => {
        let isCancelled = false;

        const loadCertificates = async () => {
            setLoadingCertificates(true);
            setCertificates([]);

            try {
                const certs =
                    await cryptoProSignatureService.getUserCertificates();
                if (isCancelled) {
                    return;
                }

                setCertificates(certs);
                setSelectedThumbprint((current) =>
                    resolveAvailableThumbprint(certs, [
                        sessionThumbprint,
                        current,
                    ]),
                );

                if (certs.length === 0) {
                    updateStatus(
                        t("honestSign.messages.certificatesEmpty"),
                        "warning",
                    );
                }
            } catch (error) {
                if (isCancelled) {
                    return;
                }

                setCertificates([]);
                setSelectedThumbprint("");
                const message =
                    error instanceof Error
                        ? error.message
                        : t("honestSign.messages.certificatesLoadFailed");
                updateStatus(message, "error");
            } finally {
                if (!isCancelled) {
                    setLoadingCertificates(false);
                }
            }
        };

        void loadCertificates();
        return () => {
            isCancelled = true;
        };
    }, [certificatesReloadCounter, sessionThumbprint, t]);

    useEffect(() => {
        let isCancelled = false;

        const loadCurrentSession = async () => {
            try {
                const session = await authApiService.getCurrentSession();
                if (isCancelled) {
                    return;
                }

                applyServerSession(session);
                if (!session.hasHonestSignSession) {
                    updateStatus(
                        t("honestSign.messages.selectCertificateToLogin"),
                    );
                }
            } catch (error) {
                if (isCancelled) {
                    return;
                }

                const status = getHttpErrorStatus(error);
                if (status === 401 || status === 403) {
                    clearStatus();
                    return;
                }

                const message =
                    error instanceof Error
                        ? error.message
                        : t("honestSign.messages.sessionCheckFailed");
                updateStatus(message, "error");
            } finally {
                if (!isCancelled) setCheckingSession(false);
            }
        };

        void loadCurrentSession();
        return () => {
            isCancelled = true;
        };
    }, [t]);

    useEffect(() => {
        if (!isAuthorized || catalogOnly) {
            setProductGroups([]);
            setProductGroupsError("");
            setProductGroupsResolved(false);
            return;
        }

        let isCancelled = false;

        const loadProductGroups = async () => {
            setProductGroupsResolved(false);

            try {
                const groups =
                    await participantsApiService.getParticipantProductGroups();
                if (isCancelled) {
                    return;
                }

                const uniqueGroups = Array.from(new Set(groups));
                setProductGroups(uniqueGroups);
                setProductGroupsError("");
                setFilters((prev) => {
                    const productGroup = normalizeProductGroupFilter(
                        prev.productGroup,
                        uniqueGroups,
                    );
                    return productGroup === prev.productGroup
                        ? prev
                        : { ...prev, productGroup };
                });
                setAppliedFilters((prev) => {
                    const productGroup = normalizeProductGroupFilter(
                        prev.productGroup,
                        uniqueGroups,
                    );
                    return productGroup === prev.productGroup
                        ? prev
                        : { ...prev, productGroup };
                });
            } catch (error) {
                if (isCancelled) {
                    return;
                }

                const message =
                    error instanceof Error
                        ? error.message
                        : t("honestSign.messages.productGroupsLoadFailed");
                setProductGroups([]);
                setProductGroupsError(message);
                setFilters((prev) =>
                    prev.productGroup ? { ...prev, productGroup: "" } : prev,
                );
                setAppliedFilters((prev) =>
                    prev.productGroup ? { ...prev, productGroup: "" } : prev,
                );
            } finally {
                if (!isCancelled) {
                    setProductGroupsResolved(true);
                }
            }
        };

        void loadProductGroups();
        return () => {
            isCancelled = true;
        };
    }, [isAuthorized, catalogOnly, t]);

    useEffect(() => {
        if (!isAuthorized) {
            return;
        }

        saveOrdersFilters(companyId, appliedFilters);
    }, [appliedFilters, companyId, isAuthorized]);

    const runSessionGuard = useEffectEvent(async () => {
        if (!isAuthorized) {
            return;
        }

        if (sessionGuardInFlightRef.current) {
            return;
        }

        const nowMs = Date.now();
        if (
            !shouldRunSessionHeartbeat(lastSessionHeartbeatAtRef.current, nowMs)
        ) {
            return;
        }

        sessionGuardInFlightRef.current = true;

        try {
            const session = await authApiService.getCurrentSession();
            lastSessionHeartbeatAtRef.current = nowMs;

            if (!session.hasHonestSignSession) {
                applyServerSession(session);
                clearProtectedWorkspace(
                    t("honestSign.messages.sessionExpired"),
                    "warning",
                );
                return;
            }

            applyServerSession(session);
        } catch (error) {
            const status = getHttpErrorStatus(error);
            if (status === 401 || status === 403) {
                clearProtectedWorkspace(
                    t("honestSign.messages.sessionExpired"),
                    "warning",
                );
            }
        } finally {
            sessionGuardInFlightRef.current = false;
        }
    });

    useEffect(() => {
        if (!isAuthorized) {
            sessionGuardInFlightRef.current = false;
            lastSessionHeartbeatAtRef.current = 0;
            return;
        }

        void runSessionGuard();
        const intervalId = window.setInterval(() => {
            void runSessionGuard();
        }, SESSION_VALIDATION_INTERVAL_MS);

        return () => {
            window.clearInterval(intervalId);
        };
    }, [isAuthorized]);

    useEffect(() => {
        const loadOrders = async () => {
            if (!isAuthorized || !productGroupsResolved || catalogOnly) {
                return;
            }

            setLoadingOrders(true);
            setOrdersError("");

            try {
                const payload = {
                    filter: {
                        startCreatedTimestamp: toStartTimestamp(
                            appliedFilters.dateFrom,
                        ),
                        endCreatedTimestamp: toEndTimestamp(
                            appliedFilters.dateTo,
                        ),
                        productGroups: appliedFilters.productGroup
                            ? [appliedFilters.productGroup]
                            : undefined,
                        orderStatuses: resolveOrderStatuses(
                            ordersView,
                            appliedFilters.orderStatus,
                        ),
                    },
                    limit: appliedFilters.limit,
                    page,
                };

                const response = await ordersApiService.searchOrders(payload);
                setOrders(response.items);
                setTotalItems(response.totalItems);
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : t("honestSign.messages.ordersLoadFailed");
                setOrdersError(message);
            } finally {
                setLoadingOrders(false);
            }
        };

        void loadOrders();
    }, [
        isAuthorized,
        page,
        appliedFilters,
        ordersView,
        productGroupsResolved,
        catalogOnly,
        ordersReloadCounter,
        t,
    ]);

    useEffect(() => {
        const loadOrderDetails = async () => {
            if (!openedOrder) {
                return;
            }

            if (!openedOrder.gtin) {
                setOrderDetails(null);
                setOrderDetailsError(t("honestSign.messages.orderGtinMissing"));
                return;
            }

            setOrderDetailsLoading(true);
            setOrderDetailsError("");
            setOrderDetails(null);

            try {
                const response = await ordersApiService.getOrderStatus(
                    openedOrder.orderId,
                    openedOrder.gtin,
                );
                setOrderDetails(response);
            } catch (error) {
                const message =
                    error instanceof Error
                        ? error.message
                        : t("honestSign.messages.orderDetailsFailed");
                setOrderDetailsError(message);
                setOrderDetails(null);
            } finally {
                setOrderDetailsLoading(false);
            }
        };

        void loadOrderDetails();
    }, [openedOrder, t]);

    useEffect(() => {
        if (!isAuthorized) {
            return;
        }

        const currentView = readHistoryView(window.history.state);
        if (currentView) {
            applyViewState(currentView);
        } else {
            updateBrowserHistory({ view: "orders-list" }, "replace");
        }

        const onPopState = (event: PopStateEvent) => {
            const nextView = readHistoryView(event.state);
            if (nextView) {
                applyViewState(nextView);
                return;
            }

            applyViewState({ view: "orders-list" });
        };

        window.addEventListener("popstate", onPopState);
        return () => window.removeEventListener("popstate", onPopState);
    }, [isAuthorized]);

    const certificateOptions = useMemo<CertificateOption[]>(
        () =>
            certificates.map((cert) => ({
                label: cert.name || cert.subjectName || cert.thumbprint,
                value: cert.thumbprint,
            })),
        [certificates],
    );

    const hasNextPage = useMemo(
        () => page * appliedFilters.limit < totalItems,
        [page, appliedFilters.limit, totalItems],
    );

    const handleGetCodesCsv = async () => {
        if (codesActionRef.current) return;
        const normalizedOrderId = getCodesOrderId.trim();
        if (!normalizedOrderId) {
            setGetCodesErrorMessage(t("honestSign.messages.orderIdRequired"));
            return;
        }

        const normalizedGtin = getCodesGtin.trim();
        if (!normalizedGtin) {
            setGetCodesErrorMessage(t("honestSign.messages.gtinRequired"));
            return;
        }

        const quantityValue = Number.parseInt(getCodesQuantity, 10);
        if (!Number.isFinite(quantityValue) || quantityValue <= 0) {
            setGetCodesErrorMessage(
                t("honestSign.messages.positiveQuantityRequired"),
            );
            return;
        }

        const action = beginCodesAction();
        if (!action) return;
        setGettingCodes(true);
        setUploadingOrderCodesToConverter(false);
        setGetCodesErrorMessage("");
        setUploadOrderCodesToConverterErrorMessage("");
        setGetCodesResult(null);

        try {
            const csvResponse = await ordersApiService.getCodes(
                normalizedOrderId,
                normalizedGtin,
                quantityValue,
            );
            if (!action.isCurrent()) return;
            const dataMatrixCodes = csvResponse.codes;

            if (dataMatrixCodes.length === 0) {
                setGetCodesErrorMessage(t("honestSign.messages.codesEmpty"));
                return;
            }

            const preparedResult: GetCodesModalResult = {
                downloadedFileName: downloadCodesFile(csvResponse.fileName, csvResponse.file),
                queuedForConverter: false,
                queuedOrderId: normalizedOrderId,
                codesCount: dataMatrixCodes.length,
                fileDownloaded: false,
            };
            setGetCodesResult(preparedResult);
            try {
                const downloadedFileName = downloadCodesFile(
                    csvResponse.fileName,
                    csvResponse.file,
                );
                setGetCodesResult({
                    ...preparedResult,
                    downloadedFileName,
                    fileDownloaded: true,
                });
            } catch {
                setGetCodesErrorMessage(
                    t("honestSign.messages.codesDownloadFailed"),
                );
            }
        } catch (error) {
            if (!action.isCurrent()) return;
            const message =
                error instanceof Error
                    ? error.message
                    : t("honestSign.messages.codesFailed");
            setGetCodesErrorMessage(message);
        } finally {
            action.finish();
        }
    };

    const handleUploadOrderCodesToConverter = async () => {
        if (codesActionRef.current) return;
        const prepared = getCodesResult as GetCodesModalResult | null;
        if (
            !prepared?.queuedForConverter ||
            prepared.codesCount <= 0 ||
            prepared.converterUpload ||
            prepared.queuedOrderId !== getCodesOrderId.trim()
        )
            return;
        const normalizedOrderId = getCodesOrderId.trim();
        if (!normalizedOrderId) {
            setUploadOrderCodesToConverterErrorMessage(
                t("honestSign.messages.converterOrderIdRequired"),
            );
            return;
        }

        const action = beginCodesAction();
        if (!action) return;
        setUploadingOrderCodesToConverter(true);
        setUploadingOrderCodesToConverterOrderId(normalizedOrderId);
        setUploadOrderCodesToConverterErrorMessage("");

        try {
            const response =
                await ordersApiService.uploadOrderCodesToConverter(
                    normalizedOrderId,
                );
            if (!action.isCurrent()) return;
            setGetCodesResult((current: unknown) => {
                const currentResult = current as GetCodesModalResult | null;
                if (currentResult?.queuedOrderId !== normalizedOrderId) {
                    return current;
                }

                return {
                    ...currentResult,
                    converterUpload: {
                        orderId: response.orderId,
                        codesCount: response.codesCount,
                    },
                };
            });
            updateStatus(
                t("honestSign.messages.converterUploaded", {
                    orderId: response.orderId,
                    count: response.codesCount,
                }),
                "success",
            );
        } catch (error) {
            if (!action.isCurrent()) return;
            const message =
                error instanceof Error
                    ? error.message
                    : t("honestSign.messages.converterFailed");
            setUploadOrderCodesToConverterErrorMessage(message);
        } finally {
            action.finish();
        }
    };

    const handleUploadOrderCodesToConverterByOrderId = async (
        orderId: string,
    ) => {
        if (codesActionRef.current) return;
        const normalizedOrderId = orderId.trim();
        if (!normalizedOrderId || normalizedOrderId === "-") {
            setUploadOrderCodesToConverterErrorMessage(
                t("honestSign.messages.converterOrderIdRequired"),
            );
            return;
        }

        const action = beginCodesAction();
        if (!action) return;
        setUploadingOrderCodesToConverter(true);
        setUploadingOrderCodesToConverterOrderId(normalizedOrderId);
        setUploadOrderCodesToConverterErrorMessage("");

        try {
            const response =
                await ordersApiService.uploadOrderCodesToConverter(
                    normalizedOrderId,
                );
            if (!action.isCurrent()) return;
            updateStatus(
                t("honestSign.messages.converterUploaded", {
                    orderId: response.orderId,
                    count: response.codesCount,
                }),
                "success",
            );
        } catch (error) {
            if (!action.isCurrent()) return;
            if (
                getHttpErrorStatus(error) === 404 &&
                getHttpErrorCode(error) ===
                    "error.honest_sign_converter_order_not_found"
            ) {
                const order = orders.find(
                    (item) => item.orderId === normalizedOrderId,
                );
                openCodesDialog(
                    normalizedOrderId,
                    order?.firstGtin ?? "",
                    t("honestSign.messages.converterPreparationRequired"),
                );
                return;
            }
            const message =
                error instanceof Error
                    ? error.message
                    : t("honestSign.messages.converterFailed");
            setUploadOrderCodesToConverterErrorMessage(message);
        } finally {
            action.finish();
        }
    };

    const handleCreateOrder = async () => {
        if (!selectedThumbprint) {
            setCreateOrderErrorMessage(
                t("honestSign.messages.signingCertificateRequired"),
            );
            setCreateOrderSuccessMessage("");
            return;
        }

        const paymentType = PAYMENT_TYPE_MAP[createOrderPaymentType];
        const releaseMethodType =
            RELEASE_METHOD_TYPE_MAP[createOrderReleaseMethod];
        if (
            !createOrderProductGroup ||
            !paymentType ||
            !releaseMethodType ||
            !createOrderTemplateId
        ) {
            setCreateOrderErrorMessage(
                t("honestSign.messages.orderCommonFieldsRequired"),
            );
            setCreateOrderSuccessMessage("");
            return;
        }

        const invalidProduct = createOrderProducts.find((product) => {
            const quantity = Number.parseInt(product.quantity, 10);
            return (
                !/^\d{8,18}$/.test(product.gtin.trim()) ||
                !Number.isInteger(quantity) ||
                quantity < 1 ||
                quantity > 2_000_000 ||
                !SERIAL_NUMBER_TYPE_MAP[product.serialNumberType] ||
                !CIS_TYPE_MAP[product.cisType]
            );
        });
        if (invalidProduct) {
            setCreateOrderErrorMessage(
                t("honestSign.messages.orderProductsInvalid"),
            );
            setCreateOrderSuccessMessage("");
            return;
        }

        setCreatingOrder(true);
        setCreateOrderErrorMessage("");
        setCreateOrderSuccessMessage("");

        const resolvedProductGroup = createOrderProductGroup;
        const resolvedTemplateId = createOrderTemplateId;
        const body = buildCreateOrderBody(
            resolvedProductGroup,
            paymentType,
            releaseMethodType,
            resolvedTemplateId,
            createOrderProducts,
        );

        try {
            const detachedSignature =
                await cryptoProSignatureService.signDetached({
                    thumbprint: selectedThumbprint,
                    message: JSON.stringify(body),
                });
            const normalizedDetachedSignature =
                cryptoProSignatureService.normalizeDetachedSignature(
                    detachedSignature.pkcs7,
                );

            const response = await ordersApiService.createOrder(
                normalizedDetachedSignature,
                body,
            );
            const resolvedOrderId = response.orderId ?? "";
            setOrdersReloadCounter((prev) => prev + 1);
            setCreateOrderProductGroup("");
            setCreateOrderReleaseMethod("");
            setCreateOrderPaymentType("");
            setCreateOrderTemplateId(null);
            setCreateOrderProducts([createEmptyProductDraft()]);
            setCreateOrderErrorMessage("");
            setCreateOrderSuccessMessage("");
            navigateToOrdersList();

            if (resolvedOrderId) {
                updateStatus(
                    t("honestSign.messages.orderCreated", {
                        orderId: resolvedOrderId,
                    }),
                    "success",
                );
            } else {
                updateStatus(
                    t("honestSign.messages.orderCreatedWithoutId"),
                    "success",
                );
            }
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : t("honestSign.messages.orderCreateFailed");
            setCreateOrderErrorMessage(message);
        } finally {
            setCreatingOrder(false);
        }
    };

    const onConnectHonestSign = async () => {
        if (!selectedThumbprint) {
            updateStatus(
                t("honestSign.messages.certificateRequired"),
                "warning",
            );
            return;
        }

        setConnectingHonestSign(true);
        clearStatus();

        try {
            const honestSignSession =
                await authApiService.signAndSendAuthKey(selectedThumbprint);
            applyServerSession(honestSignSession);
            if (honestSignSession.hasHonestSignSession) {
                updateStatus(t("honestSign.messages.connected"), "success");
                return;
            }

            updateStatus(
                t("honestSign.messages.connectionRejected"),
                "warning",
            );
        } catch (error) {
            const message =
                error instanceof Error
                    ? error.message
                    : t("honestSign.messages.connectionFailed");
            updateStatus(message, "error");
        } finally {
            setConnectingHonestSign(false);
        }
    };

    const onLogout = async () => {
        const certificateThumbprint = sessionThumbprint || selectedThumbprint;
        try {
            await authApiService.logout();
        } catch {
            // Ignore logout transport errors and clear local UI state anyway.
        }

        if (certificateThumbprint) {
            try {
                await cryptoProSignatureService.releasePrivateKeyCache(
                    certificateThumbprint,
                );
            } catch {
                // CryptoPro versions and key carriers differ. Local and server
                // session data must still be cleared if the provider retains PIN.
            }
        }

        clearProtectedWorkspace(
            t("honestSign.messages.selectCertificateToLogin"),
        );
    };

    const handleTopTabChange = (tab: TopTab) => {
        if (tab !== "orders") {
            invalidateCodesView();
            setIsGetCodesModalOpen(false);
            setGettingCodes(false);
            setUploadingOrderCodesToConverter(false);
            setUploadingOrderCodesToConverterOrderId("");
            setGetCodesErrorMessage("");
            setUploadOrderCodesToConverterErrorMessage("");
            setGetCodesResult(null);
        }

        setActiveTopTab(tab);
    };

    const handleFiltersChange = (patch: Partial<FilterForm>) => {
        setFilters((prev) => ({ ...prev, ...patch }));
    };

    const handleOrdersViewChange = (view: OrdersView) => {
        if (view === ordersView) {
            return;
        }

        invalidateCodesView();
        setIsGetCodesModalOpen(false);
        setGetCodesResult(null);
        const nextFilters = { ...filters, orderStatus: "" };
        setOrdersView(view);
        setFilters(nextFilters);
        setAppliedFilters(nextFilters);
        setPage(1);
        setOrders([]);
        setTotalItems(0);
        setOrdersError("");
        setLoadingOrders(true);
    };

    const handleApplyFilters = () => {
        setPage(1);
        setAppliedFilters(filters);
    };

    const handleResetFilters = () => {
        const reset = { ...DEFAULT_ORDERS_FILTERS, orderStatus: "" };
        setFilters(reset);
        setAppliedFilters(reset);
        setPage(1);
    };

    const handleRefreshOrders = () => {
        setOrdersReloadCounter((prev) => prev + 1);
    };

    const handlePreviousPage = () => {
        setPage((prev) => Math.max(1, prev - 1));
    };

    const handleNextPage = () => {
        setPage((prev) => prev + 1);
    };

    const handleStartCreateOrder = () => {
        setCreateOrderProductGroup("");
        setCreateOrderReleaseMethod("");
        setCreateOrderPaymentType("");
        setCreateOrderTemplateId(null);
        setCreateOrderProducts([createEmptyProductDraft()]);
        setCreatingOrder(false);
        setCreateOrderErrorMessage("");
        setCreateOrderSuccessMessage("");
        navigateToCreateStep(1);
    };

    return {
        activeTopTab,
        breadcrumbItems,
        certificateOptions,
        connectingHonestSign,
        checkingSession,
        createOrderErrorMessage,
        createOrderPaymentType,
        createOrderProductGroup,
        createOrderProducts,
        createOrderReleaseMethod,
        createOrderStep,
        createOrderSuccessMessage,
        createOrderTemplateId,
        creatingOrder,
        filters,
        getCodesErrorMessage,
        getCodesGtin,
        getCodesOrderId,
        getCodesQuantity,
        getCodesResult,
        converterPreparationMessage,
        gettingCodes,
        hasNextPage,
        isAuthorized,
        isGetCodesModalOpen,
        loadingCertificates,
        loadingOrders,
        openedOrder,
        ordersView,
        orderDetails,
        orderDetailsError,
        orderDetailsLoading,
        orders,
        ordersError,
        page,
        productGroups,
        productGroupsError,
        selectedThumbprint,
        showOrdersBreadcrumbBar,
        statusMessage,
        statusVariant,
        totalItems,
        uploadOrderCodesToConverterErrorMessage,
        uploadingOrderCodesToConverter,
        uploadingOrderCodesToConverterOrderId,
        closeGetCodesModal: () => {
            if (codesActionRef.current) return;
            invalidateCodesView();
            setIsGetCodesModalOpen(false);
            setGettingCodes(false);
            setUploadingOrderCodesToConverter(false);
            setUploadingOrderCodesToConverterOrderId("");
            setGetCodesErrorMessage("");
            setUploadOrderCodesToConverterErrorMessage("");
            setGetCodesResult(null);
        },
        handleAddCreateOrderProduct: () => {
            setCreateOrderProducts((prev) => [
                ...prev,
                createEmptyProductDraft(),
            ]);
        },
        handleApplyFilters,
        onConnectHonestSign,
        handleCreateOrder,
        handleCreateOrderProductGroupChange,
        handleFiltersChange,
        handleGetCodes: handleGetCodesCsv,
        handleUploadOrderCodesToConverterModal:
            handleUploadOrderCodesToConverter,
        handleNextPage,
        handleOrdersViewChange,
        handlePreviousPage,
        handleRefreshOrders,
        handleUploadOrderCodesToConverter:
            handleUploadOrderCodesToConverterByOrderId,
        handleReloadCertificates: () => {
            clearStatus();
            setCertificatesReloadCounter((prev) => prev + 1);
        },
        handleRemoveCreateOrderProduct: (index: number) => {
            setCreateOrderProducts((prev) => {
                if (prev.length <= 1) {
                    return prev;
                }

                return prev.filter((_, itemIndex) => itemIndex !== index);
            });
        },
        handleResetFilters,
        handleSelectedThumbprintChange: setSelectedThumbprint,
        handleStartCreateOrder,
        handleTopTabChange,
        handleUpdateCreateOrderProduct: (
            index: number,
            patch: Partial<CreateOrderProductDraft>,
        ) => {
            setCreateOrderProducts((prev) =>
                prev.map((item, itemIndex) =>
                    itemIndex === index ? { ...item, ...patch } : item,
                ),
            );
        },
        navigateToCreateStep,
        navigateToOrderDetails,
        navigateToOrdersList,
        onLogout,
        openGetCodesModal: (orderId: string, gtin = "") => {
            if (codesActionRef.current) return;
            if (!orderId || orderId === "-") {
                return;
            }

            openCodesDialog(orderId, gtin);
        },
        setCreateOrderPaymentType,
        setCreateOrderReleaseMethod,
        setCreateOrderTemplateId,
        setGetCodesGtin,
        setGetCodesQuantity,
    };
}

export type MarkingAppController = ReturnType<typeof useMarkingApp>;
