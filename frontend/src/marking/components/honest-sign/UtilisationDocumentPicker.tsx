import { Search } from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FormField } from "@marking/components/honest-sign/ui/form-field";
import { Notice } from "@marking/components/honest-sign/ui/notice";
import { Select } from "@marking/components/honest-sign/ui/select";
import { Button } from "@marking/components/ui/button";
import { Input } from "@marking/components/ui/input";
import { useUtilisationDocuments } from "@marking/hooks/use-utilisation-documents";
import { MAX_UTILISATION_REPORT_CODES } from "@marking/lib/honest-sign/utilisationReport";

export function UtilisationDocumentPicker({
    companyId,
    documentId,
    title,
    onSelect,
    disabled,
}: {
    companyId: string;
    documentId: string;
    title?: string;
    onSelect: (id: string) => void;
    disabled: boolean;
}) {
    const { t } = useTranslation();
    const id = useId();
    const [input, setInput] = useState("");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const query = useUtilisationDocuments(companyId, page, search);
    const items = query.data?.items ?? [];
    return (
        <div className="space-y-3 rounded-md border bg-muted/20 p-4">
            <form
                className="flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                    event.preventDefault();
                    if (disabled) return;
                    setSearch(input.trim());
                    setPage(1);
                }}
            >
                <FormField
                    className="min-w-0 flex-1"
                    label={t("honestSign.documents.source.search")}
                    htmlFor={`${id}-search`}
                >
                    <Input
                        id={`${id}-search`}
                        value={input}
                        maxLength={200}
                        disabled={disabled}
                        onChange={(event) => setInput(event.target.value)}
                    />
                </FormField>
                <Button type="submit" variant="outline" disabled={disabled}>
                    <Search className="size-4" aria-hidden="true" />
                    {t("common.search")}
                </Button>
            </form>
            {query.isPending ? (
                <p role="status">{t("common.loading")}</p>
            ) : query.isError ? (
                <Notice variant="error">
                    <p>{query.error.message}</p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={disabled || query.isFetching}
                        onClick={() => void query.refetch()}
                    >
                        {t("honestSign.documents.source.retry")}
                    </Button>
                </Notice>
            ) : (
                <>
                    <FormField
                        label={t("honestSign.documents.source.document")}
                        htmlFor={`${id}-document`}
                    >
                        <Select
                            id={`${id}-document`}
                            value={documentId}
                            disabled={disabled}
                            onChange={(event) => onSelect(event.target.value)}
                        >
                            <option value="">
                                {t("honestSign.documents.source.choose")}
                            </option>
                            {documentId &&
                            !items.some(
                                (item) => item.documentId === documentId,
                            ) ? (
                                <option value={documentId}>
                                    {title ||
                                        t(
                                            "honestSign.documents.source.selected",
                                        )}
                                </option>
                            ) : null}
                            {items.map((item) => (
                                <option
                                    key={item.documentId}
                                    value={item.documentId}
                                    disabled={
                                        item.printedCodesCount === 0 ||
                                        item.printedCodesCount >
                                            MAX_UTILISATION_REPORT_CODES
                                    }
                                >
                                    {t("honestSign.documents.source.option", {
                                        title: item.title,
                                        count: item.printedCodesCount,
                                    })}
                                </option>
                            ))}
                        </Select>
                    </FormField>
                    {items.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                            {t("honestSign.documents.source.empty")}
                        </p>
                    ) : null}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-xs text-muted-foreground">
                            {t("honestSign.documents.source.page", { page })}
                        </p>
                        <div className="flex gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                    disabled || page === 1 || query.isFetching
                                }
                                onClick={() => setPage((value) => value - 1)}
                            >
                                {t("honestSign.documents.source.previous")}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={
                                    disabled ||
                                    !query.data?.hasNextPage ||
                                    query.isFetching
                                }
                                onClick={() => setPage((value) => value + 1)}
                            >
                                {t("honestSign.documents.source.next")}
                            </Button>
                        </div>
                    </div>
                </>
            )}
            <p className="text-xs text-muted-foreground">
                {t("honestSign.documents.source.hint")}
            </p>
        </div>
    );
}
