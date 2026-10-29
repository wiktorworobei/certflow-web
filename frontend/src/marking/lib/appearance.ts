// Presentation preferences only. Never store account, company or print state here.
export const APPEARANCE_STORAGE_KEY = "deltamatrix-appearance-v1";

export const appearanceOptions = {
    style: ["current", "nova", "lyra", "maia"],
    font: ["geist", "openSans", "manrope"],
    palette: ["default", "graphite", "blue", "emerald", "violet", "amber"],
    chat: [
        "graphite",
        "cloud",
        "porcelain",
        "linen",
        "silver",
        "rose",
        "mint",
        "default",
    ],
    radius: ["default", "0", "6", "10", "16"],
    sidebar: ["inset", "sidebar", "floating"],
    collapse: ["icon", "offcanvas", "none"],
    table: ["default", "plain", "bordered", "striped"],
    density: ["default", "comfortable", "compact"],
} as const;

export type AppearancePreferences = {
    [K in keyof typeof appearanceOptions]: (typeof appearanceOptions)[K][number];
};
export type ThemeMode = "light" | "dark" | "system";

// Current DeltaMatrix is the immutable baseline. "default" leaves a component's
// existing sizes/borders intact; it must never mean the design lab's defaults.
export const defaultAppearance: Readonly<AppearancePreferences> = Object.freeze(
    {
        style: "current",
        font: "geist",
        palette: "default",
        chat: "graphite",
        radius: "default",
        sidebar: "inset",
        collapse: "icon",
        table: "default",
        density: "default",
    },
);
export const defaultTheme: ThemeMode = "system";

export function readAppearancePreferences(
    raw: string | null,
): AppearancePreferences {
    const result = { ...defaultAppearance };
    try {
        const saved: unknown = JSON.parse(raw ?? "null");
        if (
            !saved ||
            typeof saved !== "object" ||
            !("version" in saved) ||
            saved.version !== 1 ||
            !("preferences" in saved)
        )
            return result;
        const preferences = saved.preferences;
        if (!preferences || typeof preferences !== "object") return result;
        for (const key of Object.keys(
            appearanceOptions,
        ) as (keyof AppearancePreferences)[]) {
            const value: unknown = Reflect.get(preferences, key);
            if (
                typeof value === "string" &&
                (appearanceOptions[key] as readonly string[]).includes(value)
            ) {
                // Assign through a validated record; the exported result remains strongly typed.
                (result as Record<string, string>)[key] = value;
            }
        }
    } catch {
        // Corrupt or unavailable browser storage cannot prevent app startup.
    }
    return result;
}

export function serializeAppearance(
    preferences: AppearancePreferences,
): string {
    return JSON.stringify({ version: 1, preferences });
}

export function applyAppearance(
    root: HTMLElement,
    preferences: AppearancePreferences,
) {
    for (const [key, value] of Object.entries(preferences)) {
        root.setAttribute(`data-appearance-${key}`, value);
    }
}
