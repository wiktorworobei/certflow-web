const safeFileName = (fileName: string, defaultExtension = ".csv") => {
    const forbiddenCharacters = new Set([
        "\\",
        "/",
        ":",
        "*",
        "?",
        '"',
        "<",
        ">",
        "|",
    ]);
    const normalized = Array.from(fileName, (character) =>
        character.charCodeAt(0) < 32 || forbiddenCharacters.has(character)
            ? "_"
            : character,
    )
        .join("")
        .trim();
    if (!normalized) return `data${defaultExtension}`;
    return normalized.toLocaleLowerCase().endsWith(defaultExtension)
        ? normalized
        : `${normalized}${defaultExtension}`;
};

export const saveReportBlob = async (
    blob: Blob,
    fileName: string,
    extension: ".csv" | ".xlsx" | ".zip" | ".txt",
): Promise<boolean> => {
    downloadInBrowser(blob, safeFileName(fileName, extension));
    return true;
};
export const downloadInBrowser = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    anchor.hidden = true;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const saveCsvBlob = (blob: Blob, fileName: string) =>
    saveReportBlob(blob, fileName, ".csv");
export async function saveFileBlob(
    blob: Blob,
    fileName: string,
): Promise<boolean> {
    downloadInBrowser(blob, safeFileName(fileName, ""));
    return true;
}
