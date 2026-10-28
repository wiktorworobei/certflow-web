import { useCallback } from "react";
import {
    type NavigateFunction,
    type NavigateOptions,
    type To,
    useNavigate,
} from "react-router-dom";
import { canAnimateRouteTransition } from "@marking/hooks/use-route-view-transition";

export function useSmoothNavigate(): NavigateFunction {
    const navigate = useNavigate();

    return useCallback(
        ((destination: To | number, options?: NavigateOptions) => {
            if (typeof destination === "number") return navigate(destination);
            return navigate(typeof destination === "string" && /^\/(ru|en)\/company\//.test(destination) ? "/" : destination, {
                ...options,
                viewTransition:
                    (options?.viewTransition ?? true) &&
                    canAnimateRouteTransition(),
            });
        }) as NavigateFunction,
        [navigate],
    );
}
