import { apiClient, toHttpError } from "@marking/lib/honest-sign/httpClient";
import i18n from "@marking/src/i18n";

export type HonestSignConnectivity = {
    isAvailable: boolean;
    status: string | null;
    message: string | null;
    checkedAtUtc: string;
};

const CONNECTIVITY_URL = "/api/honest-sign/connectivity";

export const integrationApiService = {
    async getConnectivity(): Promise<HonestSignConnectivity> {
        try {
            const response =
                await apiClient.get<HonestSignConnectivity>(CONNECTIVITY_URL);
            return response.data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.connectivityFailed"),
                error,
            );
        }
    },
};
