import type {
    DmKodUtilisationAttributes,
    DmKodUtilisationCode,
    DmKodUtilisationOptions,
} from "@marking/lib/dmkod-types";

export const utilisationCodeFields = [
    "x97",
    "x30",
    "x3103",
    "x310y",
    "x311y",
    "x335y",
] as const;
export type UtilisationIssue = { field: string; key: string; line?: number };

// Only ASCII padding is removed: trim() would obscure meaningful code separators.
const padding = (value: string) => value.replace(/^[ \t]+|[ \t]+$/g, "");
export const decodeDmKodCode = (value: string) =>
    padding(value).replace(/\\u001d/gi, "\u001d");

function validDmKodCode(code: string) {
    let content = code.startsWith("]d2") ? code.slice(3) : code;
    if (content.startsWith(String.fromCharCode(29))) content = content.slice(1);
    const prefix = content.match(
        /^(?:01\d{14}|\(01\)\d{14})(?:21|\(21\))/,
    )?.[0];
    const serial = prefix ? content.slice(prefix.length) : "";
    return (
        code.length <= 4096 &&
        !!serial &&
        serial.charCodeAt(0) !== 29 &&
        ![...code].some((character) => {
            const point = character.charCodeAt(0);
            return (point < 32 && point !== 29) || point === 127;
        })
    );
}

// Delimited rows can quote a field containing a semicolon or a literal quote.
// Raw one-code-per-line input never passes through this CSV decoder.
function utilisationCsvRow(row: string): string[] | null {
    const cells: string[] = [];
    let cursor = 0;
    while (cursor <= row.length) {
        let cell = "";
        if (row[cursor] === '"') {
            cursor++;
            let closed = false;
            while (cursor < row.length) {
                if (row[cursor] !== '"') cell += row[cursor++];
                else if (row[cursor + 1] === '"') {
                    cell += '"';
                    cursor += 2;
                } else {
                    cursor++;
                    closed = true;
                    break;
                }
            }
            if (!closed || (cursor < row.length && row[cursor] !== ";"))
                return null;
        } else {
            while (cursor < row.length && row[cursor] !== ";")
                cell += row[cursor++];
        }
        cells.push(cell);
        if (cursor === row.length) break;
        cursor++;
    }
    return cells;
}

export function parseUtilisationCodes(text: string, include: boolean) {
    const codes: DmKodUtilisationCode[] = [];
    const issues: UtilisationIssue[] = [];
    const rows = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
    const headerIndex = rows.findIndex((row) => padding(row));
    const csv =
        rows[headerIndex]?.toLowerCase() ===
        "code;x97;x30;x3103;x310y;x311y;x335y";
    const dataMatrix =
        padding(rows[headerIndex] ?? "").toLowerCase() === "datamatrix";
    for (let index = 0; index < rows.length; index++) {
        if (
            !padding(rows[index]) ||
            ((csv || dataMatrix) && index === headerIndex)
        )
            continue;
        const quotedCode = dataMatrix && rows[index].startsWith('"');
        const cells =
            csv || quotedCode ? utilisationCsvRow(rows[index]) : [rows[index]];
        if (
            !cells ||
            (csv && (!include || cells.length !== 7)) ||
            (quotedCode && cells.length !== 1)
        ) {
            issues.push({
                field: include ? "includeText" : "excludeText",
                key: "csv",
                line: index + 1,
            });
            continue;
        }
        const code = decodeDmKodCode(cells[0]);
        if (!validDmKodCode(code)) {
            issues.push({
                field: include ? "includeText" : "excludeText",
                key: "code",
                line: index + 1,
            });
        }
        const item: DmKodUtilisationCode = { code };
        if (include && csv) {
            for (const [column, name] of utilisationCodeFields.entries()) {
                const value =
                    name === "x97"
                        ? padding(cells[column + 1])
                        : padding(cells[column + 1]).replace(",", ".");
                if (!value) continue;
                item[name] = value;
                if (!validUtilisationCodeAttribute(name, value))
                    issues.push({
                        field: "includeText",
                        key: name,
                        line: index + 1,
                    });
            }
        }
        codes.push(item);
    }
    return { codes, issues };
}

export function validUtilisationCodeAttribute(
    name: (typeof utilisationCodeFields)[number],
    value: string,
) {
    if (name === "x97") return value.length >= 1 && value.length <= 30;
    if (value === "--") return true;
    if (!/^\d+(?:\.\d+)?$/.test(value) || Number(value) <= 0) return false;
    if (name === "x30")
        return /^\d{1,8}$/.test(value) && Number(value) <= 99_999_999;
    if (name === "x3103") return /^\d{1,3}(?:\.\d{1,3})?$/.test(value);
    return value.replace(".", "").replace(/^0+/, "").length <= 6;
}

export function dmKodCalendarDate(now = new Date()) {
    // Match the backend's UTC date boundary for DMkod date-only validation.
    return now.toISOString().slice(0, 10);
}

export function validCalendarDate(value: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T12:00:00Z`);
    return (
        !Number.isNaN(date.getTime()) &&
        date.toISOString().slice(0, 10) === value
    );
}

export function validateUtilisation(
    includeText: string,
    excludeText: string,
    attributes: DmKodUtilisationAttributes,
    options: DmKodUtilisationOptions,
    today = dmKodCalendarDate(),
) {
    const include = parseUtilisationCodes(includeText, true);
    const exclude = parseUtilisationCodes(excludeText, false);
    const issues = [...include.issues, ...exclude.issues];
    if (!include.codes.length && !exclude.codes.length)
        issues.push({ field: "includeText", key: "empty" });
    if (
        options.maxCodesInReportPush === null ||
        include.codes.length + exclude.codes.length >
            options.maxCodesInReportPush
    )
        issues.push({ field: "includeText", key: "limit" });
    const included = new Set<string>();
    for (const item of include.codes) {
        if (included.has(item.code))
            issues.push({ field: "includeText", key: "duplicate" });
        included.add(item.code);
    }
    const excluded = new Set<string>();
    for (const item of exclude.codes) {
        if (excluded.has(item.code))
            issues.push({ field: "excludeText", key: "duplicate" });
        if (included.has(item.code))
            issues.push({ field: "excludeText", key: "overlap" });
        excluded.add(item.code);
    }
    for (const [field, value] of Object.entries(attributes)) {
        if (typeof value !== "string" || !value) continue;
        if (
            field.endsWith("Uuid") &&
            (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                value,
            ) ||
                value === "00000000-0000-0000-0000-000000000000")
        )
            issues.push({ field, key: "uuid" });
        if (
            [
                "productionDate",
                "expirationDate",
                "expirationDateOver72",
                "documentDate",
            ].includes(field) &&
            !validCalendarDate(value)
        )
            issues.push({ field, key: "date" });
    }
    if (attributes.productionDate && attributes.productionDate > today)
        issues.push({ field: "productionDate", key: "productionDate" });
    if (attributes.expirationDate && attributes.expirationDate < today)
        issues.push({ field: "expirationDate", key: "expirationDate" });
    if (
        attributes.expirationDateLess72 &&
        (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(
            attributes.expirationDateLess72,
        ) ||
            !validCalendarDate(attributes.expirationDateLess72.slice(0, 10)) ||
            Number.isNaN(Date.parse(attributes.expirationDateLess72)))
    )
        issues.push({ field: "expirationDateLess72", key: "datetime" });
    if (attributes.seriesNumber && attributes.seriesNumber.length > 20)
        issues.push({ field: "seriesNumber", key: "seriesNumber" });
    if (attributes.batchNumber && attributes.batchNumber.length > 49)
        issues.push({ field: "batchNumber", key: "batchNumber" });
    if (
        attributes.productionOrderType &&
        !options.productionOrderTypes.some(
            (item) => item.value === attributes.productionOrderType,
        )
    )
        issues.push({ field: "productionOrderType", key: "dictionary" });
    if (
        attributes.usedInProduction &&
        !options.usedInProduction.some(
            (item) => item.value === attributes.usedInProduction,
        )
    )
        issues.push({ field: "usedInProduction", key: "dictionary" });
    if (attributes.participantInn && attributes.participantInn.length > 12)
        issues.push({ field: "participantInn", key: "participantInn" });
    if (attributes.kpp && attributes.kpp.length > 10)
        issues.push({ field: "kpp", key: "kpp" });
    if (attributes.documentNumber && attributes.documentNumber.length > 255)
        issues.push({ field: "documentNumber", key: "documentNumber" });
    if (
        attributes.alcoholVolume &&
        !/^\d{1,2}(?:\.\d)?$/.test(attributes.alcoholVolume)
    )
        issues.push({ field: "alcoholVolume", key: "alcoholVolume" });
    if (
        attributes.expirationDateOver72Set?.expirationDate &&
        !validCalendarDate(attributes.expirationDateOver72Set.expirationDate)
    )
        issues.push({ field: "expirationSetDate", key: "date" });
    return {
        include: include.codes,
        exclude: exclude.codes.map(({ code }) => ({ code })),
        issues,
    };
}

export function utilisationTaskSucceeded(task: {
    state: string;
    resultState: string | null;
}) {
    return (
        task.state.toUpperCase() === "COMPLETED" &&
        task.resultState?.toUpperCase() === "SUCCESS"
    );
}

export type UtilisationPending = {
    clientRequestId: string;
    backgroundTaskId: string | null;
    included: number;
    excluded: number;
};
export function readUtilisationPending(
    value: string | null,
): UtilisationPending | null {
    try {
        const item = JSON.parse(value ?? "null") as UtilisationPending | null;
        const uuid =
            /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i;
        return item &&
            uuid.test(item.clientRequestId) &&
            (item.backgroundTaskId === null ||
                uuid.test(item.backgroundTaskId)) &&
            Number.isSafeInteger(item.included) &&
            item.included >= 0 &&
            Number.isSafeInteger(item.excluded) &&
            item.excluded >= 0
            ? {
                  clientRequestId: item.clientRequestId,
                  backgroundTaskId: item.backgroundTaskId,
                  included: item.included,
                  excluded: item.excluded,
              }
            : null;
    } catch {
        return null;
    }
}
