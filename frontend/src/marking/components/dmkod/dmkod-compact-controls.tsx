import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@marking/components/ui/button";
import {
    InputGroup,
    InputGroupAddon,
    InputGroupInput,
} from "@marking/components/ui/input-group";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@marking/components/ui/tooltip";

import type { ReactNode } from "react";

export function DmKodIconAction({
    label,
    disabled,
    onClick,
    children,
}: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
    children: ReactNode;
}) {
    return (
        <TooltipProvider delayDuration={250}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-9 shrink-0"
                        aria-label={label}
                        disabled={disabled}
                        onClick={onClick}
                    >
                        {children}
                    </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}

export function DmKodListToolbar({
    search,
    onSearch,
    label,
    found,
    total,
    page,
    pages,
    onPage,
    children,
    countLabel,
    disabled = false,
}: {
    search: string;
    onSearch: (value: string) => void;
    label: string;
    found: number;
    total: number;
    page: number;
    pages: number;
    onPage: (value: number) => void;
    children?: ReactNode;
    countLabel?: string;
    disabled?: boolean;
}) {
    const { t, i18n } = useTranslation();
    const number = (value: number) =>
        new Intl.NumberFormat(i18n.language).format(value);
    const start = Math.max(1, Math.min(page - 3, pages - 6));
    const visiblePages = Array.from(
        { length: Math.min(7, pages) },
        (_, i) => start + i,
    );
    return (
        <div className="space-y-3 rounded-xl border bg-card px-4 py-3">
            <InputGroup>
                <InputGroupAddon>
                    <Search aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                    value={search}
                    name="dmkod-list-search"
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => onSearch(event.target.value)}
                    placeholder={t("dmkod.orderLayout.searchPlaceholder")}
                    aria-label={label}
                />
                <InputGroupAddon align="inline-end">
                    <span
                        className="text-xs whitespace-nowrap tabular-nums"
                        aria-live="polite"
                        title={t("dmkod.orderLayout.found", {
                            found: number(found),
                            total: number(total),
                        })}
                    >
                        {countLabel ??
                            t("dmkod.cabinet.rows", { count: found })}
                    </span>
                    {children}
                </InputGroupAddon>
            </InputGroup>
            {found > 0 || pages > 1 ? (
                <nav
                    aria-label={t("dmkod.cabinet.pagination")}
                    className="flex flex-wrap items-center justify-center gap-1"
                >
                    <DmKodIconAction
                        label={t("dmkod.orders.previous")}
                        disabled={disabled || page <= 1}
                        onClick={() => onPage(page - 1)}
                    >
                        <ChevronLeft aria-hidden="true" />
                    </DmKodIconAction>
                    {visiblePages.map((value) => (
                        <Button
                            key={value}
                            type="button"
                            variant={page === value ? "outline" : "ghost"}
                            size="icon"
                            className="size-9"
                            aria-label={t("dmkod.cabinet.page", {
                                page: value,
                            })}
                            aria-current={value === page ? "page" : undefined}
                            disabled={disabled}
                            onClick={() => onPage(value)}
                        >
                            {number(value)}
                        </Button>
                    ))}
                    <DmKodIconAction
                        label={t("dmkod.orders.next")}
                        disabled={disabled || page >= pages}
                        onClick={() => onPage(page + 1)}
                    >
                        <ChevronRight aria-hidden="true" />
                    </DmKodIconAction>
                </nav>
            ) : null}
        </div>
    );
}
