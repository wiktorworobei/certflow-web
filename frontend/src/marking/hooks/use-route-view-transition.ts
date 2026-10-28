import { useSyncExternalStore } from "react";

// Mobile sheets and their backdrops must stay live while a route changes.
// A document snapshot captures them mid-animation and produces visible flashes.
const ROUTE_MOTION_QUERY =
    "(min-width: 768px) and (prefers-reduced-motion: no-preference)";

export function canAnimateRouteTransition() {
    return (
        typeof window !== "undefined" &&
        window.matchMedia(ROUTE_MOTION_QUERY).matches
    );
}

function subscribe(onChange: () => void) {
    const media = window.matchMedia(ROUTE_MOTION_QUERY);
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
}

export function useRouteViewTransition() {
    return useSyncExternalStore(
        subscribe,
        canAnimateRouteTransition,
        () => false,
    );
}
