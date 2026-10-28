import { Label } from "@marking/components/ui/label";
import { cn } from "@marking/lib/utils";

import type { HTMLAttributes, ReactNode } from "react";

type FormFieldProps = HTMLAttributes<HTMLDivElement> & {
    label?: ReactNode;
    htmlFor?: string;
};

export function FormField({
    className,
    label,
    htmlFor,
    children,
    ...props
}: FormFieldProps) {
    return (
        <div className={cn("space-y-1", className)} {...props}>
            {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
            {children}
        </div>
    );
}
