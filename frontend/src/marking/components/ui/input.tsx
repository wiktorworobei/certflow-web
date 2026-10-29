import * as React from "react";
import { inputStyles } from "@marking/components/appearance/component-styles";
import { cn } from "@marking/lib/utils";
import { useAppearanceStore } from "@marking/src/store/appearance";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
    const style = useAppearanceStore((state) => state.preferences.style);
    return (
        <input
            type={type}
            data-slot="input"
            className={cn(inputStyles[style], className)}
            {...props}
        />
    );
}

export { Input };
