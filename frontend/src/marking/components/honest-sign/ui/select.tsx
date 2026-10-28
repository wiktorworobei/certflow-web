import { ChevronDown } from "lucide-react";
import { forwardRef } from "react";
import { cn } from "@marking/lib/utils";

import type { ReactNode, SelectHTMLAttributes } from "react";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement> & {
    wrapperClassName?: string;
    leadingAdornment?: ReactNode;
    trailingAdornment?: ReactNode;
    hideChevron?: boolean;
};

const Select = forwardRef<HTMLSelectElement, SelectProps>(
    (
        {
            className,
            wrapperClassName,
            leadingAdornment,
            trailingAdornment,
            hideChevron = false,
            children,
            ...props
        },
        ref,
    ) => {
        const hasTrailingAdornment = hideChevron
            ? Boolean(trailingAdornment)
            : true;

        return (
            <div className={cn("relative", wrapperClassName)}>
                {leadingAdornment ? (
                    <span className="pointer-events-none absolute top-1/2 left-3 z-10 -translate-y-1/2">
                        {leadingAdornment}
                    </span>
                ) : null}
                <select
                    ref={ref}
                    className={cn(
                        "flex h-10 w-full appearance-none rounded-md border border-input bg-background px-3 py-2 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
                        leadingAdornment && "pl-10",
                        hasTrailingAdornment && "pr-10",
                        className,
                    )}
                    {...props}
                >
                    {children}
                </select>
                {hideChevron ? (
                    trailingAdornment ? (
                        <span className="pointer-events-none absolute top-1/2 right-3 z-10 -translate-y-1/2">
                            {trailingAdornment}
                        </span>
                    ) : null
                ) : (
                    <span className="pointer-events-none absolute top-1/2 right-3 z-10 inline-flex -translate-y-1/2 items-center gap-2">
                        {trailingAdornment}
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                    </span>
                )}
            </div>
        );
    },
);

Select.displayName = "Select";

export { Select };
