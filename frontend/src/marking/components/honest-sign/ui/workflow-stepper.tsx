import { cn } from "@marking/lib/utils";

type WorkflowStepperProps = {
    steps: string[];
    activeStep: number;
    className?: string;
};

export function WorkflowStepper({
    steps,
    activeStep,
    className,
}: WorkflowStepperProps) {
    return (
        <div
            className={cn(
                "grid border-b bg-muted/50 text-center text-sm font-medium",
                className,
            )}
            style={{
                gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))`,
            }}
        >
            {steps.map((step, index) => {
                const isActive = index === activeStep;
                const isLast = index === steps.length - 1;

                return (
                    <div
                        key={step}
                        className={cn(
                            "relative py-3",
                            isActive
                                ? "bg-primary text-primary-foreground"
                                : "text-muted-foreground",
                        )}
                    >
                        {step}
                        {isActive && !isLast ? (
                            <span
                                aria-hidden="true"
                                className="absolute top-0 -right-4 h-full w-8 skew-x-[-30deg] bg-primary"
                            />
                        ) : null}
                    </div>
                );
            })}
        </div>
    );
}
