import type {
    HonestSignCodesCheckOptions,
    HonestSignCodesCheckSummary,
} from "@marking/lib/honest-sign/honestSignCodesCheckService";

type CheckFile = { id: string; name: string; codes: string[] };

export type UtilisationFileCheckProgress = {
    fileIndex: number;
    filesTotal: number;
    fileName: string;
    fileCompleted: number;
    fileTotal: number;
    completedFiles: number;
    completedCodes: number;
    totalCodes: number;
};

export class UtilisationFileCheckError extends Error {
    constructor(
        readonly fileId: string,
        readonly fileName: string,
        readonly reason: unknown,
    ) {
        super(reason instanceof Error ? reason.message : "");
        this.name = "UtilisationFileCheckError";
    }
}

function throwIfAborted(signal: AbortSignal): void {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
}

/** Files share one cancellation boundary. HTTP pacing is owned by the shared checker. */
export async function checkUtilisationBatchFiles({
    files,
    previousResults,
    productGroup,
    signal,
    checkCodes,
    invalidResultMessage,
    onProgress,
    onChecked,
}: {
    files: CheckFile[];
    previousResults: Record<string, number>;
    productGroup: string;
    signal: AbortSignal;
    checkCodes: (
        codes: string[],
        productGroup: string,
        options: HonestSignCodesCheckOptions,
    ) => Promise<HonestSignCodesCheckSummary>;
    invalidResultMessage: string;
    onProgress: (progress: UtilisationFileCheckProgress) => void;
    onChecked: (fileId: string, invalidCount: number) => void;
}): Promise<Record<string, number>> {
    const verified = files.filter((file) => previousResults[file.id] === 0);
    const results = Object.fromEntries(verified.map((file) => [file.id, 0]));
    const totalCodes = files.reduce((sum, file) => sum + file.codes.length, 0);
    let completedCodes = verified.reduce(
        (sum, file) => sum + file.codes.length,
        0,
    );
    let completedFiles = verified.length;

    for (const [index, file] of files.entries()) {
        throwIfAborted(signal);
        if (results[file.id] === 0) continue;
        const reportProgress = (completed: number) => {
            if (signal.aborted) return;
            const fileCompleted = Math.max(
                0,
                Math.min(
                    file.codes.length,
                    Number.isFinite(completed) ? completed : 0,
                ),
            );
            onProgress({
                fileIndex: index + 1,
                filesTotal: files.length,
                fileName: file.name,
                fileCompleted,
                fileTotal: file.codes.length,
                completedFiles,
                completedCodes: completedCodes + fileCompleted,
                totalCodes,
            });
        };
        reportProgress(0);
        try {
            const result = await checkCodes(file.codes, productGroup, {
                signal,
                onProgress: reportProgress,
            });
            throwIfAborted(signal);
            if (
                result.totalCount !== file.codes.length ||
                result.items.length !== file.codes.length ||
                !Number.isInteger(result.invalidCount) ||
                result.invalidCount < 0 ||
                result.invalidCount > file.codes.length
            )
                throw new Error(invalidResultMessage);
            results[file.id] = result.invalidCount;
            onChecked(file.id, result.invalidCount);
            reportProgress(file.codes.length);
            completedCodes += file.codes.length;
            completedFiles++;
        } catch (reason) {
            throwIfAborted(signal);
            throw new UtilisationFileCheckError(file.id, file.name, reason);
        }
    }
    return results;
}
