import { apiClient, toHttpError } from "@marking/lib/honest-sign/httpClient";
import i18n from "@marking/src/i18n";

const PARTICIPANTS_URL = "/api/honest-sign/participants/product-groups";

export const participantsApiService = {
    async getParticipantProductGroups(): Promise<string[]> {
        try {
            const response = await apiClient.get<string[]>(PARTICIPANTS_URL, {
                headers: {
                    Accept: "application/json",
                },
            });

            return Array.isArray(response.data) ? response.data : [];
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.participantsRequestFailed"),
                error,
            );
        }
    },
};
