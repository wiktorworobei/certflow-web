import { cn } from "@marking/lib/utils";

import type { HTMLAttributes } from "react";

const noticeVariants = {
    error: "border-destructive/30 bg-destructive/10 text-destructive",
    success: "border-primary/30 bg-primary/10 text-foreground",
    warning: "border-border bg-muted text-foreground",
    info: "border-border bg-muted/45 text-foreground",
} as const;

type NoticeProps = HTMLAttributes<HTMLDivElement> & {
    variant?: keyof typeof noticeVariants;
};

export function Notice({ className, variant = "info", ...props }: NoticeProps) {
    return (
        <div
            className={cn(
                "rounded-md border p-3 text-sm",
                noticeVariants[variant],
                className,
            )}
            {...props}
        />
    );
}
