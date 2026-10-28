import { cn } from "@marking/lib/utils";

import type { ComponentPropsWithoutRef, ElementType, ReactNode } from "react";

type PanelProps = ComponentPropsWithoutRef<"section">;

export function Panel({ className, ...props }: PanelProps) {
    return (
        <section
            className={cn(
                "rounded-lg border bg-card text-card-foreground",
                className,
            )}
            {...props}
        />
    );
}

type PanelSectionProps<T extends ElementType> = {
    as?: T;
    children?: ReactNode;
    className?: string;
} & Omit<ComponentPropsWithoutRef<T>, "as" | "className" | "children">;

function createPanelSection<TDefault extends ElementType>(
    defaultTag: TDefault,
    defaultClassName: string,
) {
    return function PanelSection<T extends ElementType = TDefault>({
        as,
        className,
        ...props
    }: PanelSectionProps<T>) {
        const Component = (as ?? defaultTag) as ElementType;

        return (
            <Component className={cn(defaultClassName, className)} {...props} />
        );
    };
}

export const PanelHeader = createPanelSection("div", "border-b px-6 py-3");
export const PanelBody = createPanelSection("div", "px-6 py-7");
export const PanelFooter = createPanelSection("div", "border-t px-6 py-6");
