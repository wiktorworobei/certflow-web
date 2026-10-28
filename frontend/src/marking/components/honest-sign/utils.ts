import { PRODUCT_GROUP_LABELS } from "@marking/components/honest-sign/constants";

export function toStartTimestamp(dateString: string): number | null {
    if (!dateString) {
        return null;
    }

    return new Date(`${dateString}T00:00:00`).getTime();
}

export function toEndTimestamp(dateString: string): number | null {
    if (!dateString) {
        return null;
    }

    return new Date(`${dateString}T23:59:59.999`).getTime();
}

export function formatDate(value: unknown, locale = "ru-RU"): string {
    if (typeof value === "number") {
        return new Date(value).toLocaleString(locale);
    }

    if (typeof value === "string") {
        const date = new Date(value);
        if (!Number.isNaN(date.getTime())) {
            return date.toLocaleString(locale);
        }

        return value;
    }

    return "-";
}

export function readString(
    order: Record<string, unknown>,
    keys: string[],
): string {
    for (const key of keys) {
        const value = order[key];
        if (typeof value === "string" && value.length > 0) {
            return value;
        }
        if (typeof value === "number") {
            return String(value);
        }
    }

    return "-";
}

export function formatProductGroupLabel(productGroup: string): string {
    if (!productGroup) {
        return "-";
    }

    return PRODUCT_GROUP_LABELS[productGroup] ?? productGroup;
}

export function normalizeProductGroupFilter(
    productGroup: string,
    availableGroups: string[],
): string {
    if (!productGroup) {
        return "";
    }

    return availableGroups.includes(productGroup) ? productGroup : "";
}

function sanitizeFileNamePart(value: string, fallback: string): string {
    const invalidCharacters = new Set('<>:"/\\|?*');
    const normalized = Array.from(value.trim(), (character) =>
        invalidCharacters.has(character) || character.charCodeAt(0) <= 31
            ? "_"
            : character,
    ).join("");
    return normalized || fallback;
}

export function downloadCodesFile(
    fileNameOrOrderId: string,
    fileOrGtin: Blob | string,
    maybeCodes?: string[],
): string {
    const fileName =
        fileOrGtin instanceof Blob
            ? fileNameOrOrderId
            : `${sanitizeFileNamePart(fileNameOrOrderId, "order")}_${sanitizeFileNamePart(fileOrGtin, "gtin")}.txt`;
    const file =
        fileOrGtin instanceof Blob
            ? fileOrGtin
            : new Blob([`${(maybeCodes ?? []).join("\r\n")}\r\n`], {
                  type: "text/plain;charset=utf-8",
              });

    if (typeof window === "undefined") {
        return fileName;
    }

    const downloadUrl = window.URL.createObjectURL(file);
    const anchor = document.createElement("a");

    anchor.href = downloadUrl;
    anchor.download = fileName;
    anchor.style.display = "none";

    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.URL.revokeObjectURL(downloadUrl);

    return fileName;
}

export function getRequiredSelectClass(hasError: boolean): string {
    return [
        "h-11 w-full appearance-none border border-input border-l-4 bg-background pl-4 pr-14 text-foreground focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50",
        hasError ? "border-l-destructive" : "border-l-border",
    ].join(" ");
}

export function getRequiredInfoClass(hasError: boolean): string {
    return `pointer-events-none absolute right-9 top-1/2 h-4 w-4 -translate-y-1/2 ${hasError ? "text-destructive" : "text-muted-foreground"}`;
}
