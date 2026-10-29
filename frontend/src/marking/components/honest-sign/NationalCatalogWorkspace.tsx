import { ArrowLeft, BookOpen, History, Package, Plus } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CatalogCardForm } from "@marking/components/honest-sign/CatalogCardForm";
import { CatalogCardWorkflow } from "@marking/components/honest-sign/CatalogCardWorkflow";
import { CatalogErrorDetails } from "@marking/components/honest-sign/CatalogErrorDetails";
import { CatalogFeedProcessing } from "@marking/components/honest-sign/CatalogFeedProcessing";
import { CatalogProductsPanel } from "@marking/components/honest-sign/CatalogProductsPanel";
import { CatalogPermitsPanel } from "@marking/components/honest-sign/CatalogPermitsPanel";
import { CatalogSubmissionHistory } from "@marking/components/honest-sign/CatalogSubmissionHistory";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@marking/components/ui/alert-dialog";
import { Button } from "@marking/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@marking/components/ui/dialog";
import { Skeleton } from "@marking/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@marking/components/ui/tabs";
import { useCatalogProductGroups } from "@marking/hooks/use-honest-sign-catalog";

type WorkspaceProps = {
    companyId: string;
    selectedThumbprint?: string;
    initialView?: "products" | "create";
};
type SelectedCard = {
    id: string;
    name?: string;
    gtin?: string;
    signing: boolean;
    showFeed: boolean;
};

export function NationalCatalogWorkspace(props: WorkspaceProps) {
    return <CatalogWorkspace key={props.companyId} {...props} />;
}

function CatalogWorkspace({
    companyId,
    selectedThumbprint = "",
    initialView = "products",
}: WorkspaceProps) {
    const { t } = useTranslation();
    const [view, setView] = useState(initialView);
    const [tab, setTab] = useState("products");
    const [selected, setSelected] = useState<SelectedCard | null>(null);
    const [createDirty, setCreateDirty] = useState(false);
    const [createBusy, setCreateBusy] = useState(false);
    const [detailDirty, setDetailDirty] = useState(false);
    const [detailBusy, setDetailBusy] = useState(false);
    const [discard, setDiscard] = useState<"create" | "detail" | null>(null);
    const cancelDiscard = useRef<HTMLButtonElement>(null);
    const addButton = useRef<HTMLButtonElement>(null);
    const productGroups = useCatalogProductGroups(companyId);
    const create = () => {
        setCreateDirty(false);
        setCreateBusy(false);
        setView("create");
    };
    const back = () => {
        if (createBusy) return;
        if (createDirty) setDiscard("create");
        else setView("products");
    };
    const closeDetail = () => {
        if (detailBusy) return;
        if (detailDirty) setDiscard("detail");
        else {
            setSelected(null);
            setDetailDirty(false);
        }
    };
    const open = (card: SelectedCard) => {
        setDetailDirty(false);
        setDetailBusy(false);
        setSelected(card);
    };
    return (
        <div className="min-w-0 space-y-5 p-4 md:p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                    <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <BookOpen className="size-5" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                        <h2 className="text-xl font-semibold tracking-tight">
                            {t("honestSign.catalog.title")}
                        </h2>
                        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
                            {t(
                                view === "create"
                                    ? "honestSign.catalog.description"
                                    : "honestSign.catalog.products.description",
                            )}
                        </p>
                    </div>
                </div>
                {view === "products" ? (
                    <Button
                        ref={addButton}
                        type="button"
                        onClick={create}
                        className="h-10 w-full shadow-sm sm:w-auto"
                    >
                        <Plus className="size-4" aria-hidden="true" />
                        {t("honestSign.catalog.products.add")}
                    </Button>
                ) : (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={createBusy}
                        onClick={back}
                    >
                        <ArrowLeft className="size-4" aria-hidden="true" />
                        {t("honestSign.catalog.products.back")}
                    </Button>
                )}
            </div>
            {view === "create" ? (
                <section
                    className="space-y-4"
                    aria-label={t("honestSign.catalog.products.createTitle")}
                >
                    <h3 className="font-semibold">
                        {t("honestSign.catalog.products.createTitle")}
                    </h3>
                    {productGroups.isPending ? (
                        <Skeleton className="h-48 w-full" />
                    ) : productGroups.isError ? (
                        <Notice variant="error" role="alert">
                            <p>{productGroups.error.message}</p>
                            <CatalogErrorDetails error={productGroups.error} />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => void productGroups.refetch()}
                            >
                                {t("honestSign.catalog.retry")}
                            </Button>
                        </Notice>
                    ) : !productGroups.data?.length ? (
                        <Notice>
                            {t("honestSign.catalog.noProductGroups")}
                        </Notice>
                    ) : (
                        <CatalogCardForm
                            companyId={companyId}
                            productGroups={productGroups.data}
                            onDirtyChange={setCreateDirty}
                            onBusyChange={setCreateBusy}
                            onSubmitted={(row) => {
                                setCreateDirty(false);
                                setCreateBusy(false);
                                setView("products");
                                setTab("products");
                                open({
                                    id: row.id,
                                    gtin: row.gtin,
                                    signing: false,
                                    showFeed: true,
                                });
                            }}
                        />
                    )}
                </section>
            ) : (
                <Tabs
                    value={tab}
                    onValueChange={setTab}
                    className="min-w-0 gap-0"
                >
                    <TabsList
                        aria-label={t("honestSign.catalog.products.views")}
                        variant="line"
                        className="mb-4 h-auto min-h-11 w-full max-w-full items-stretch justify-start gap-3 border-b p-0 group-data-[orientation=horizontal]/tabs:h-auto sm:w-fit sm:gap-4"
                    >
                        <TabsTrigger
                            value="products"
                            className="h-auto min-w-0 gap-2 px-1 py-3 whitespace-normal after:bottom-0 after:rounded-t-full after:bg-primary motion-reduce:transition-none sm:whitespace-nowrap"
                        >
                            <Package className="size-4" aria-hidden="true" />
                            {t("honestSign.catalog.products.title")}
                        </TabsTrigger>
                        <TabsTrigger
                            value="history"
                            className="h-auto min-w-0 gap-2 px-1 py-3 whitespace-normal after:bottom-0 after:rounded-t-full after:bg-primary motion-reduce:transition-none sm:whitespace-nowrap"
                        >
                            <History className="size-4" aria-hidden="true" />
                            {t("honestSign.catalog.products.journal")}
                        </TabsTrigger>
                        <TabsTrigger value="permits" className="h-auto min-w-0 px-1 py-3 whitespace-normal">
                            {t("honestSign.catalog.permits.title")}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="permits" className="min-w-0">
                        <CatalogPermitsPanel key={companyId} companyId={companyId} />
                    </TabsContent>
                    <TabsContent value="products" className="min-w-0">
                        <CatalogProductsPanel
                            companyId={companyId}
                            onCreate={create}
                            onOpen={(product, id, signing) =>
                                open({
                                    id,
                                    name: product.name,
                                    gtin: product.gtin,
                                    signing,
                                    showFeed: false,
                                })
                            }
                        />
                    </TabsContent>
                    <TabsContent value="history" className="min-w-0">
                        <CatalogSubmissionHistory
                            companyId={companyId}
                            onOpen={(id) =>
                                open({ id, signing: false, showFeed: true })
                            }
                        />
                    </TabsContent>
                </Tabs>
            )}
            <Dialog
                open={Boolean(selected)}
                onOpenChange={(isOpen) => {
                    if (!isOpen) closeDetail();
                }}
            >
                <DialogContent
                    className="max-h-[90dvh] overflow-y-auto sm:max-w-5xl"
                    onCloseAutoFocus={(event) => {
                        event.preventDefault();
                        addButton.current?.focus();
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>
                            {selected?.name ||
                                t("honestSign.catalog.workflow.title")}
                        </DialogTitle>
                        <DialogDescription>
                            {selected?.gtin
                                ? `${t("honestSign.catalog.gtin")}: ${selected.gtin}`
                                : t("honestSign.catalog.description")}
                        </DialogDescription>
                    </DialogHeader>
                    {selected && (
                        <CatalogCardWorkflow
                            key={selected.id}
                            showTitle={false}
                            companyId={companyId}
                            submissionId={selected.id}
                            selectedThumbprint={selectedThumbprint}
                            productGroups={productGroups.data ?? []}
                            focusSigning={selected.signing}
                            onDirtyChange={setDetailDirty}
                            onBusyChange={setDetailBusy}
                        />
                    )}
                    {selected?.showFeed && (
                        <CatalogFeedProcessing
                            companyId={companyId}
                            submissionId={selected.id}
                        />
                    )}
                </DialogContent>
            </Dialog>
            <AlertDialog
                open={discard !== null}
                onOpenChange={(isOpen) => {
                    if (!isOpen) setDiscard(null);
                }}
            >
                <AlertDialogContent
                    onOpenAutoFocus={(event) => {
                        event.preventDefault();
                        cancelDiscard.current?.focus();
                    }}
                >
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {t("honestSign.catalog.products.discardTitle")}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {t(
                                "honestSign.catalog.products.discardDescription",
                            )}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel ref={cancelDiscard}>
                            {t("honestSign.catalog.products.keepEditing")}
                        </AlertDialogCancel>
                        <AlertDialogAction
                            variant="destructive"
                            disabled={
                                discard === "create" ? createBusy : detailBusy
                            }
                            onClick={() => {
                                if (discard === "create" && !createBusy) {
                                    setCreateDirty(false);
                                    setView("products");
                                }
                                if (discard === "detail" && !detailBusy) {
                                    setDetailDirty(false);
                                    setSelected(null);
                                }
                                setDiscard(null);
                            }}
                        >
                            {t("honestSign.catalog.products.discard")}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
