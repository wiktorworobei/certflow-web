export const GS_SEPARATOR = "\u001D";

export function normalizeDataMatrixCode(value: string): string {
    return value
        .trim()
        .replace(/\\u001d/gi, GS_SEPARATOR)
        .replace(/\\x1d/gi, GS_SEPARATOR)
        .replace(/<gs>/gi, GS_SEPARATOR);
}

export function toTrueApiInformationCode(value: string): string {
    const normalized = normalizeDataMatrixCode(value);
    const separatorIndex = normalized.indexOf(GS_SEPARATOR);
    return separatorIndex > 0
        ? normalized.slice(0, separatorIndex)
        : normalized;
}

export function formatDataMatrixCodeForDisplay(value: string): string {
    return normalizeDataMatrixCode(value).replaceAll(GS_SEPARATOR, "<GS>");
}
