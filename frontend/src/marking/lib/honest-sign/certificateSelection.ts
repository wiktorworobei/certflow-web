import type { CertificateSummary } from "@marking/lib/honest-sign/types";

export function resolveAvailableThumbprint(
    certificates: CertificateSummary[],
    preferredThumbprints: string[],
): string {
    for (const thumbprint of preferredThumbprints) {
        if (
            thumbprint &&
            certificates.some(
                (certificate) => certificate.thumbprint === thumbprint,
            )
        ) {
            return thumbprint;
        }
    }

    return "";
}
