import { cn } from "@marking/lib/utils";

import type { ComponentProps, ReactNode } from "react";

export function WorkspacePage({
    className,
    width = "full",
    ...props
}: ComponentProps<"section"> & { width?: "full" | "content" | "narrow" }) {
    return (
        <section
            data-slot="workspace-page"
            className={cn(
                "mx-auto w-full min-w-0 space-y-6 p-4 sm:p-6",
                width === "content" && "max-w-6xl",
                width === "narrow" && "max-w-3xl",
                className,
            )}
            {...props}
        />
    );
}

export function WorkspaceHeader({
    title,
    titleId,
    heading: Heading = "h1",
    description,
    actions,
    meta,
    className,
}: {
    title: ReactNode;
    titleId?: string;
    heading?: "h1" | "h2";
    description?: ReactNode;
    actions?: ReactNode;
    meta?: ReactNode;
    className?: string;
}) {
    return (
        <header
            data-slot="workspace-header"
            className={cn("space-y-3", className)}
        >
            <div className="flex min-w-0 flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1 space-y-1">
                    <Heading
                        id={titleId}
                        tabIndex={-1}
                        className="text-2xl font-semibold tracking-tight [overflow-wrap:anywhere]"
                    >
                        {title}
                    </Heading>
                    {description && (
                        <div className="max-w-3xl text-sm text-muted-foreground">
                            {description}
                        </div>
                    )}
                </div>
                {actions && (
                    <div className="flex max-w-full shrink-0 flex-wrap items-center gap-2">
                        {actions}
                    </div>
                )}
            </div>
            {meta && (
                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
                    {meta}
                </div>
            )}
        </header>
    );
}

export function WorkspaceToolbar({
    className,
    ...props
}: ComponentProps<"div"> & { "aria-label": string }) {
    return (
        <div
            role="group"
            data-slot="workspace-toolbar"
            className={cn(
                "flex min-w-0 flex-wrap items-center gap-3 rounded-lg border bg-card p-3",
                className,
            )}
            {...props}
        />
    );
}
