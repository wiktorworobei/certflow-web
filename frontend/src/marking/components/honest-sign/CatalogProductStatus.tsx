import {
    Archive,
    BadgeCheck,
    CircleAlert,
    CircleHelp,
    Clock3,
    FilePenLine,
    FileSignature,
    Fingerprint,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@marking/components/ui/badge";
import { catalogProductStatuses } from "@marking/lib/honest-sign/catalogProductView";
import { cn } from "@marking/lib/utils";

import type { CatalogProduct } from "@marking/lib/honest-sign/catalogTypes";

const statusStyles = {
    published: {
        icon: BadgeCheck,
        className:
            "border-emerald-500/25 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    },
    notsigned: {
        icon: FileSignature,
        className:
            "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    },
    moderation: {
        icon: Clock3,
        className:
            "border-sky-500/25 bg-sky-500/10 text-sky-700 dark:text-sky-300",
    },
    draft: {
        icon: FilePenLine,
        className: "border-border bg-muted/60 text-muted-foreground",
    },
    errors: {
        icon: CircleAlert,
        className: "border-destructive/25 bg-destructive/10 text-destructive",
    },
    archived: {
        icon: Archive,
        className: "border-border bg-muted/60 text-muted-foreground",
    },
    identity_pending: {
        icon: Fingerprint,
        className:
            "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
    },
};

export function CatalogProductStatus({ product }: { product: CatalogProduct }) {
    const { t } = useTranslation();
    return (
        <div className="flex min-w-0 flex-wrap gap-1.5">
            {catalogProductStatuses(product).map((status) => {
                const style = Object.hasOwn(statusStyles, status)
                    ? statusStyles[status as keyof typeof statusStyles]
                    : {
                          icon: CircleHelp,
                          className:
                              "border-border bg-muted/40 text-muted-foreground",
                      };
                const Icon = style.icon;
                return (
                    <Badge
                        key={status}
                        variant="outline"
                        className={cn(
                            "max-w-full min-w-0 shrink gap-1.5 rounded-md px-2 py-1 text-xs leading-4 whitespace-normal [&>svg]:size-3.5 [&>svg]:shrink-0",
                            style.className,
                        )}
                    >
                        <Icon aria-hidden="true" />
                        <span className="min-w-0 wrap-anywhere">
                            {t(
                                `honestSign.catalog.workflow.cardStates.${status}`,
                                {
                                    defaultValue: t(
                                        "honestSign.catalog.products.otherStatus",
                                        { status },
                                    ),
                                },
                            )}
                        </span>
                    </Badge>
                );
            })}
        </div>
    );
}
