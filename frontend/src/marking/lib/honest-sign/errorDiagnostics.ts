const contentTypes = [
    "application/json",
    "application/problem+json",
    "text/html",
    "text/plain",
    "other",
    "missing",
] as const;
const bodyFormats = [
    "empty",
    "json",
    "html",
    "text",
    "invalid_json",
    "not_inspected",
] as const;
const extractionStatuses = ["message", "code_only", "none"] as const;
const discardReasons = [
    "body_limit",
    "json_depth",
    "invalid_json",
    "unrecognized_shape",
    "safety_filter",
    "parser_budget",
    "regex_timeout",
] as const;
const providers = ["national-catalog", "markirovka", "suz"] as const;
const descriptionSources = ["upstream", "documentation", "generic"] as const;

export type HonestSignResponseDiagnostics = {
    contentType: (typeof contentTypes)[number];
    bodyFormat: (typeof bodyFormats)[number];
    bodyLengthChars: number;
    extractionStatus: (typeof extractionStatuses)[number];
    discardReason: (typeof discardReasons)[number] | null;
};
export type HonestSignErrorDiagnostics = {
    correlationId?: string;
    code?: string;
    provider?: (typeof providers)[number];
    operation?: string;
    upstreamStatus?: number;
    upstreamErrorCode?: string;
    errors?: Array<{
        code?: string;
        parameter?: string;
        descriptionSource?: (typeof descriptionSources)[number];
    }>;
    responseDiagnostics?: HonestSignResponseDiagnostics;
};

function record(value: unknown): Record<string, unknown> | undefined {
    return value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
}
function member<const T extends readonly string[]>(
    value: unknown,
    allowed: T,
): T[number] | undefined {
    return typeof value === "string" && allowed.includes(value)
        ? value
        : undefined;
}
function token(value: unknown, pattern: RegExp): string | undefined {
    return typeof value === "string" && pattern.test(value) ? value : undefined;
}

export function parseHonestSignResponseDiagnostics(
    value: unknown,
): HonestSignResponseDiagnostics | undefined {
    const input = record(value);
    if (!input) return undefined;
    const contentType = member(input.contentType, contentTypes);
    const bodyFormat = member(input.bodyFormat, bodyFormats);
    const extractionStatus = member(input.extractionStatus, extractionStatuses);
    const discardReason =
        input.discardReason === null
            ? null
            : member(input.discardReason, discardReasons);
    const bodyLengthChars = input.bodyLengthChars;
    if (
        !contentType ||
        !bodyFormat ||
        !extractionStatus ||
        discardReason === undefined ||
        typeof bodyLengthChars !== "number" ||
        !Number.isInteger(bodyLengthChars) ||
        bodyLengthChars < 0 ||
        bodyLengthChars > 10_485_760
    )
        return undefined;
    return {
        contentType,
        bodyFormat,
        bodyLengthChars,
        extractionStatus,
        discardReason,
    };
}

/** Read only the public diagnostic contract, never a provider response body. */
export function parseHonestSignErrorDiagnostics(
    value: unknown,
): HonestSignErrorDiagnostics {
    const input = record(value);
    if (!input) return {};
    const details = record(input.details) ?? input;
    const result: HonestSignErrorDiagnostics = {};
    const correlationId = token(
        input.correlationId,
        /^[A-Za-z0-9_.:-]{1,128}$/,
    );
    const code = token(input.code, /^[A-Za-z0-9_.:-]{1,128}$/);
    const provider = member(details.provider, providers);
    const operation = token(details.operation, /^[A-Za-z0-9_./:-]{1,128}$/);
    const upstreamStatus = details.upstreamStatus;
    const upstreamErrorCode = token(
        details.upstreamErrorCode,
        /^[A-Za-z0-9_.:-]{1,128}$/,
    );
    const responseDiagnostics = parseHonestSignResponseDiagnostics(
        details.responseDiagnostics,
    );
    if (correlationId) result.correlationId = correlationId;
    if (code) result.code = code;
    if (provider) result.provider = provider;
    if (operation) result.operation = operation;
    if (
        typeof upstreamStatus === "number" &&
        Number.isInteger(upstreamStatus) &&
        upstreamStatus >= 100 &&
        upstreamStatus <= 599
    )
        result.upstreamStatus = upstreamStatus;
    if (upstreamErrorCode) result.upstreamErrorCode = upstreamErrorCode;
    if (responseDiagnostics) result.responseDiagnostics = responseDiagnostics;
    if (Array.isArray(details.errors)) {
        const errors = details.errors.slice(0, 10).flatMap((entry) => {
            const error = record(entry);
            if (!error) return [];
            const code = token(error.code, /^[A-Za-z0-9_.:-]{1,128}$/);
            const parameter = token(
                error.parameter,
                /^[A-Za-z0-9_.:[\]-]{1,128}$/,
            );
            const descriptionSource = member(
                error.descriptionSource,
                descriptionSources,
            );
            return code || parameter || descriptionSource
                ? [
                      {
                          ...(code ? { code } : {}),
                          ...(parameter ? { parameter } : {}),
                          ...(descriptionSource ? { descriptionSource } : {}),
                      },
                  ]
                : [];
        });
        if (errors.length) result.errors = errors;
    }
    return result;
}

export function getHttpErrorDiagnostics(
    error: unknown,
): HonestSignErrorDiagnostics {
    const input = record(error);
    return parseHonestSignErrorDiagnostics(input?.diagnostics ?? input);
}
