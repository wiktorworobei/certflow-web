import cadesPluginScriptUrl from "cadesplugin_api.js/dist/cadesplugin_api.js?url";
import i18n from "@marking/src/i18n";
import { captureMarkingScope, assertMarkingScope } from '../workspace-scope';

import type {
    CertificateSummary,
    DetachedSignatureResult,
    SignAttachedInput,
    SignDetachedInput,
} from "./types";

type CadesPrivateKey = {
    CacheKey(value: boolean): Promise<void>;
};

type CadesCertificate = {
    HasPrivateKey: Promise<boolean>;
    IssuerName: Promise<string>;
    PrivateKey: Promise<CadesPrivateKey>;
    SubjectName: Promise<string>;
    Thumbprint: Promise<string>;
    ValidFromDate: Promise<string | Date>;
    ValidToDate: Promise<string | Date>;
};

type CadesCertificates = {
    Count: Promise<number>;
    Find(findType: number, criteria?: string): Promise<CadesCertificates>;
    Item(index: number): Promise<CadesCertificate>;
};

type CadesStore = {
    Certificates: Promise<CadesCertificates>;
    Open(location: number, name: string, mode: number): Promise<void>;
    Close(): Promise<void>;
};

type CadesAttributes = {
    Add(attribute: CadesAttribute): Promise<void>;
};

type CadesAttribute = {
    propset_Name(value: number): Promise<void>;
    propset_Value(value: Date): Promise<void>;
};

type CadesSigner = {
    AuthenticatedAttributes2: Promise<CadesAttributes>;
    propset_Certificate(certificate: CadesCertificate): Promise<void>;
    propset_CheckCertificate(value: boolean): Promise<void>;
    propset_Options(value: number): Promise<void>;
};

type CadesHashedData = {
    Value: Promise<string>;
    Hash(value: string): Promise<void>;
    SetHashValue(value: string): Promise<void>;
    propset_Algorithm(value: number): Promise<void>;
    propset_DataEncoding(value: number): Promise<void>;
};

type CadesSignedData = {
    SignCades(signer: CadesSigner, type: number): Promise<string>;
    SignHash(
        hash: CadesHashedData,
        signer: CadesSigner,
        type: number,
    ): Promise<string>;
    propset_Content(value: string): Promise<void>;
    propset_ContentEncoding(value: number): Promise<void>;
};

type CadesObjectMap = {
    "CAdESCOM.Store": CadesStore;
    "CADESCOM.CPAttribute": CadesAttribute;
    "CAdESCOM.CPSigner": CadesSigner;
    "CAdESCOM.HashedData": CadesHashedData;
    "CAdESCOM.CadesSignedData": CadesSignedData;
};

type CadesPluginApi = {
    CADESCOM_AUTHENTICATED_ATTRIBUTE_SIGNING_TIME: number;
    CADESCOM_BASE64_TO_BINARY: number;
    CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256: number;
    CADESCOM_PKCS7_TYPE: number;
    CADESCOM_CADES_BES?: number;
    CAPICOM_CERTIFICATE_FIND_SHA1_HASH: number;
    CAPICOM_CERTIFICATE_FIND_TIME_VALID: number;
    CAPICOM_CERTIFICATE_INCLUDE_WHOLE_CHAIN: number;
    CAPICOM_CURRENT_USER_STORE: number;
    CAPICOM_MY_STORE: string;
    CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED: number;
    CreateObjectAsync<TName extends keyof CadesObjectMap>(
        name: TName,
    ): Promise<CadesObjectMap[TName]>;
    getLastError?(error: unknown): string;
};

type CadesPlugin = PromiseLike<void> & CadesPluginApi;

declare global {
    interface Window {
        cadesplugin?: CadesPlugin;
    }
}

let pluginScriptPromise: Promise<void> | null = null;

function loadPluginScript(): Promise<void> {
    if (window.cadesplugin) return Promise.resolve();
    if (pluginScriptPromise) return pluginScriptPromise;

    pluginScriptPromise = new Promise<void>((resolve, reject) => {
        const script = document.createElement("script");
        script.src = cadesPluginScriptUrl;
        script.async = true;
        script.dataset.honestSignCadesPlugin = "true";
        script.addEventListener("load", () => resolve(), { once: true });
        script.addEventListener(
            "error",
            () =>
                reject(
                    new Error(i18n.t("honestSign.messages.cryptoLoaderFailed")),
                ),
            { once: true },
        );
        document.head.append(script);
    });
    return pluginScriptPromise;
}

function pluginError(error: unknown): Error {
    const pluginMessage = window.cadesplugin?.getLastError?.(error);
    if (typeof pluginMessage === "string" && pluginMessage.trim()) {
        return new Error(pluginMessage.trim());
    }
    return error instanceof Error
        ? error
        : new Error(i18n.t("honestSign.messages.cryptoUnavailable"));
}

async function getPlugin(): Promise<CadesPluginApi> {
    await loadPluginScript();
    const plugin = window.cadesplugin;
    if (!plugin) {
        throw new Error(i18n.t("honestSign.messages.cryptoNotLoaded"));
    }

    try {
        await plugin;
        if (typeof plugin.CreateObjectAsync !== "function") {
            throw new Error(
                i18n.t("honestSign.messages.cryptoAsyncUnavailable"),
            );
        }
        return {
            CADESCOM_AUTHENTICATED_ATTRIBUTE_SIGNING_TIME:
                plugin.CADESCOM_AUTHENTICATED_ATTRIBUTE_SIGNING_TIME,
            CADESCOM_BASE64_TO_BINARY: plugin.CADESCOM_BASE64_TO_BINARY,
            CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256:
                plugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256,
            CADESCOM_PKCS7_TYPE: plugin.CADESCOM_PKCS7_TYPE,
            CADESCOM_CADES_BES: plugin.CADESCOM_CADES_BES,
            CAPICOM_CERTIFICATE_FIND_SHA1_HASH:
                plugin.CAPICOM_CERTIFICATE_FIND_SHA1_HASH,
            CAPICOM_CERTIFICATE_FIND_TIME_VALID:
                plugin.CAPICOM_CERTIFICATE_FIND_TIME_VALID,
            CAPICOM_CERTIFICATE_INCLUDE_WHOLE_CHAIN:
                plugin.CAPICOM_CERTIFICATE_INCLUDE_WHOLE_CHAIN,
            CAPICOM_CURRENT_USER_STORE: plugin.CAPICOM_CURRENT_USER_STORE,
            CAPICOM_MY_STORE: plugin.CAPICOM_MY_STORE,
            CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED:
                plugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED,
            CreateObjectAsync: plugin.CreateObjectAsync.bind(plugin),
            getLastError: plugin.getLastError?.bind(plugin),
        };
    } catch (error) {
        throw pluginError(error);
    }
}

function toBase64Utf8(value: string): string {
    const bytes = new TextEncoder().encode(value);
    let binary = "";
    const chunkSize = 0x8000;

    for (let offset = 0; offset < bytes.length; offset += chunkSize) {
        binary += String.fromCharCode(
            ...bytes.subarray(offset, offset + chunkSize),
        );
    }

    return btoa(binary);
}

function extractCommonName(subjectName: string): string | undefined {
    const match = subjectName.match(/(?:^|,\s*)CN=("(?:[^"]|"")*"|[^,]+)/i);
    return match?.[1]?.replace(/^"|"$/g, "").replace(/""/g, '"').trim();
}

function normalizeDetachedSignature(pkcs7: string): string {
    return pkcs7.replace(/[\r\n\u2028\u2029]/g, "");
}

async function withStore<T>(
    plugin: CadesPluginApi,
    operation: (store: CadesStore) => Promise<T>,
): Promise<T> {
    const store = await plugin.CreateObjectAsync("CAdESCOM.Store");
    await store.Open(
        plugin.CAPICOM_CURRENT_USER_STORE,
        plugin.CAPICOM_MY_STORE,
        plugin.CAPICOM_STORE_OPEN_MAXIMUM_ALLOWED,
    );

    try {
        return await operation(store);
    } finally {
        await store.Close();
    }
}

async function getCertificate(
    plugin: CadesPluginApi,
    thumbprint: string,
): Promise<CadesCertificate> {
    return withStore(plugin, async (store) => {
        const certificates = await store.Certificates;
        const matches = await certificates.Find(
            plugin.CAPICOM_CERTIFICATE_FIND_SHA1_HASH,
            thumbprint,
        );
        if ((await matches.Count) < 1) {
            throw new Error(
                i18n.t("honestSign.messages.certificateNotFound", {
                    thumbprint,
                }),
            );
        }
        return matches.Item(1);
    });
}

async function createSigner(
    plugin: CadesPluginApi,
    certificate: CadesCertificate,
): Promise<CadesSigner> {
    const signer = await plugin.CreateObjectAsync("CAdESCOM.CPSigner");
    const signingTime = await plugin.CreateObjectAsync("CADESCOM.CPAttribute");

    await signingTime.propset_Name(
        plugin.CADESCOM_AUTHENTICATED_ATTRIBUTE_SIGNING_TIME,
    );
    await signingTime.propset_Value(new Date());
    await signer.propset_Certificate(certificate);
    await signer.propset_CheckCertificate(true);
    await signer.propset_Options(
        plugin.CAPICOM_CERTIFICATE_INCLUDE_WHOLE_CHAIN,
    );
    const attributes = await signer.AuthenticatedAttributes2;
    await attributes.Add(signingTime);
    return signer;
}

async function createHash(
    plugin: CadesPluginApi,
    message: string,
): Promise<string> {
    const hashedData = await plugin.CreateObjectAsync("CAdESCOM.HashedData");
    await hashedData.propset_Algorithm(
        plugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256,
    );
    await hashedData.propset_DataEncoding(plugin.CADESCOM_BASE64_TO_BINARY);
    await hashedData.Hash(toBase64Utf8(message));
    return hashedData.Value;
}

export const cryptoProSignatureService = {
    async getUserCertificates(): Promise<CertificateSummary[]> {
        const plugin = await getPlugin();
        try {
            return await withStore(plugin, async (store) => {
                let certificates = await store.Certificates;
                certificates = await certificates.Find(
                    plugin.CAPICOM_CERTIFICATE_FIND_TIME_VALID,
                );
                const count = await certificates.Count;
                const result: CertificateSummary[] = [];

                for (let index = 1; index <= count; index += 1) {
                    const certificate = await certificates.Item(index);
                    if (!(await certificate.HasPrivateKey)) continue;

                    const subjectName = await certificate.SubjectName;
                    result.push({
                        name: extractCommonName(subjectName),
                        issuerName: await certificate.IssuerName,
                        subjectName,
                        thumbprint: await certificate.Thumbprint,
                        validFrom: String(await certificate.ValidFromDate),
                        validTo: String(await certificate.ValidToDate),
                    });
                }

                if (result.length === 0) {
                    throw new Error(
                        i18n.t("honestSign.messages.validCertificateNotFound"),
                    );
                }
                return result;
            });
        } catch (error) {
            throw pluginError(error);
        }
    },

    async releasePrivateKeyCache(thumbprint: string): Promise<void> {
        const plugin = await getPlugin();
        try {
            const certificate = await getCertificate(plugin, thumbprint);
            const privateKey = await certificate.PrivateKey;
            await privateKey.CacheKey(false);
        } catch (error) {
            throw pluginError(error);
        }
    },

    async signAttached({
        thumbprint,
        message,
    }: SignAttachedInput): Promise<string> {
        const scope = captureMarkingScope();
        const plugin = await getPlugin();
        try {
            const certificate = await getCertificate(plugin, thumbprint);
            const signer = await createSigner(plugin, certificate);
            const signedData = await plugin.CreateObjectAsync(
                "CAdESCOM.CadesSignedData",
            );
            await signedData.propset_ContentEncoding(
                plugin.CADESCOM_BASE64_TO_BINARY,
            );
            await signedData.propset_Content(toBase64Utf8(message));
            const signature = await signedData.SignCades(signer, plugin.CADESCOM_PKCS7_TYPE);
            assertMarkingScope(scope);
            return signature;
        } catch (error) {
            throw pluginError(error);
        }
    },

    async signDetached({
        thumbprint,
        message,
        cadesType,
    }: SignDetachedInput): Promise<DetachedSignatureResult> {
        const scope = captureMarkingScope();
        const plugin = await getPlugin();
        try {
            const hash = await createHash(plugin, message);
            const certificate = await getCertificate(plugin, thumbprint);
            const signer = await createSigner(plugin, certificate);
            const hashedData = await plugin.CreateObjectAsync(
                "CAdESCOM.HashedData",
            );
            await hashedData.propset_Algorithm(
                plugin.CADESCOM_HASH_ALGORITHM_CP_GOST_3411_2012_256,
            );
            await hashedData.SetHashValue(hash);
            const signedData = await plugin.CreateObjectAsync(
                "CAdESCOM.CadesSignedData",
            );
            const pkcs7 = await signedData.SignHash(
                hashedData,
                signer,
                cadesType === "bes"
                    ? (plugin.CADESCOM_CADES_BES ?? 1)
                    : plugin.CADESCOM_PKCS7_TYPE,
            );
            assertMarkingScope(scope);
            return { hash, pkcs7 };
        } catch (error) {
            throw pluginError(error);
        }
    },

    normalizeDetachedSignature,
};
