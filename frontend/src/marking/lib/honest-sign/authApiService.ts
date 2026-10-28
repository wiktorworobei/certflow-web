import { cryptoProSignatureService } from "@marking/lib/honest-sign/cryptoProSignatureService";
import { apiClient, toHttpError } from "@marking/lib/honest-sign/httpClient";
import i18n from "@marking/src/i18n";

export type AppSessionResponse = {
    isAuthenticated: true;
    hasHonestSignSession: boolean;
    certificateThumbprint: string | null;
    honestSignSessionExpiresAtUtc: string | null;
};

export type CompleteHonestSignPayload = {
    uuid: string;
    data: string;
    bearerUuid: string;
    bearerData: string;
    certificateThumbprint: string;
};

type HonestSignChallengeResponse = {
    uuid: string;
    data: string;
};

const SESSION_URL = "/api/honest-sign/session";
const CHALLENGE_URL = "/api/honest-sign/auth/challenge";
const SIGN_IN_URL = "/api/honest-sign/auth/sign-in";

export const authApiService = {
    async getCurrentSession(): Promise<AppSessionResponse> {
        try {
            const response =
                await apiClient.get<AppSessionResponse>(SESSION_URL);
            return response.data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.sessionRequestFailed"),
                error,
            );
        }
    },

    async logout(): Promise<void> {
        try {
            await apiClient.delete(SESSION_URL);
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.sessionCloseFailed"),
                error,
            );
        }
    },

    async getHonestSignChallenge(): Promise<HonestSignChallengeResponse> {
        try {
            const response =
                await apiClient.get<HonestSignChallengeResponse>(CHALLENGE_URL);
            return response.data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.challengeFailed"),
                error,
            );
        }
    },

    async completeHonestSign(
        payload: CompleteHonestSignPayload,
    ): Promise<AppSessionResponse> {
        try {
            const response = await apiClient.post<AppSessionResponse>(
                SIGN_IN_URL,
                payload,
            );
            return response.data;
        } catch (error) {
            throw toHttpError(
                i18n.t("honestSign.messages.signInFailed"),
                error,
            );
        }
    },

    async signAndSendAuthKey(thumbprint: string): Promise<AppSessionResponse> {
        const clientChallenge = await this.getHonestSignChallenge();
        const clientSignature = await cryptoProSignatureService.signAttached({
            thumbprint,
            message: clientChallenge.data,
        });
        const bearerChallenge = await this.getHonestSignChallenge();
        const bearerSignature = await cryptoProSignatureService.signAttached({
            thumbprint,
            message: bearerChallenge.data,
        });

        return this.completeHonestSign({
            uuid: clientChallenge.uuid,
            data: clientSignature,
            bearerUuid: bearerChallenge.uuid,
            bearerData: bearerSignature,
            certificateThumbprint: thumbprint,
        });
    },
};
