import type { DmKodCodeRequest } from "@marking/lib/dmkod-workflow-types";

export function canSignCodeRequest(
    request: Pick<DmKodCodeRequest, "type" | "state">,
) {
    return (
        request.state === "CREATED" &&
        (request.type === "CODES" || request.type === "CANCEL")
    );
}

/** These responses are emitted before a signing intent or external submission is created. */
export function codeRequestSignatureWasNotSent(
    status: number | undefined,
    code: unknown,
) {
    return (
        status === 409 &&
        (code === "error.dmkod_code_request_signing_data_invalid" ||
            code === "error.dmkod_report_payload_changed")
    );
}
