import {
    normalizeDataMatrixCode,
    toTrueApiInformationCode,
} from "./codeNormalization";
import { MAX_UTILISATION_REPORT_CODES } from "./utilisationReport";

export const MAX_CODES_CHECK_FILE_BYTES = 20 * 1024 * 1024;
export const MAX_CODES_CHECK_FILES = 20;

export type CodesCheckFile = {
    id: string;
    name: string;
    codes: string[];
    size: number;
};

/** Exported order files contain one code per row; CSV also accepts one quoted column. */
export function parseCodesCheckText(text: string): string[] {
    if (text.includes("\u0000") || text.includes("\uFFFD"))
        throw new Error("invalidFile");
    const rows = text
        .replace(/^\uFEFF/, "")
        .split(/\r\n|\n|\r/)
        .map((row) => row.trim())
        .filter(Boolean);
    if (rows.length > MAX_UTILISATION_REPORT_CODES + 1)
        throw new Error("tooManyCodes");
    const codes: string[] = [];
    for (const [index, row] of rows.entries()) {
        let value = row;
        if (row.startsWith('"')) {
            if (!/^"(?:[^"]|"")*"$/.test(row)) throw new Error("invalidFile");
            value = row.slice(1, -1).replaceAll('""', '"');
        }
        if (
            index === 0 &&
            /^(?:code|codes|cis|sntin|datamatrix|код(?: маркировки)?|ки)$/i.test(
                value,
            )
        )
            continue;
        const normalized = normalizeDataMatrixCode(value);
        if (normalized) codes.push(normalized);
    }
    if (codes.length === 0) throw new Error("emptyFile");
    if (codes.length > MAX_UTILISATION_REPORT_CODES)
        throw new Error("tooManyCodes");
    return codes;
}

export function combineCodesCheckFiles(files: Pick<CodesCheckFile, "codes">[]) {
    const unique = new Set<string>();
    let duplicates = 0;
    for (const file of files) {
        for (const value of file.codes) {
            const code = normalizeDataMatrixCode(value);
            if (unique.has(code)) duplicates++;
            else unique.add(code);
            if (unique.size > MAX_UTILISATION_REPORT_CODES)
                throw new Error("tooManyCodes");
        }
    }
    return { codes: [...unique], duplicates };
}

/** Never place the cryptographic suffix in a rendered result or its title/label. */
export function codeCheckDisplayCode(value: string): string {
    const cis = toTrueApiInformationCode(value);
    return cis.length > 38 ? cis.slice(0, 38) + "…" : cis;
}
