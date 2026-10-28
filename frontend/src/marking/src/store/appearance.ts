import { create } from "zustand";
import {
    APPEARANCE_STORAGE_KEY,
    defaultAppearance,
    readAppearancePreferences,
    serializeAppearance,
    type AppearancePreferences,
} from "@marking/lib/appearance";

function restore() {
    try {
        return readAppearancePreferences(
            localStorage.getItem(APPEARANCE_STORAGE_KEY),
        );
    } catch {
        return { ...defaultAppearance };
    }
}

export const useAppearanceStore = create<{
    preferences: AppearancePreferences;
    storageError: boolean;
    update: <K extends keyof AppearancePreferences>(
        key: K,
        value: AppearancePreferences[K],
    ) => void;
    reset: () => void;
}>((set, get) => {
    const save = (preferences: AppearancePreferences) => {
        let storageError = false;
        try {
            localStorage.setItem(
                APPEARANCE_STORAGE_KEY,
                serializeAppearance(preferences),
            );
        } catch {
            storageError = true;
        }
        set({ preferences, storageError });
    };
    return {
        preferences: restore(),
        storageError: false,
        update: (key, value) => save({ ...get().preferences, [key]: value }),
        reset: () => save({ ...defaultAppearance }),
    };
});
