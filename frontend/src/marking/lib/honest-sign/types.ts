export type Payload = {
    uuid: string;
    data: string;
};

export type SendSignedAuthKeyPayload = {
    uuid: string;
    data: string;
};

export type CertificateSummary = {
    name?: string;
    issuerName?: string;
    subjectName?: string;
    thumbprint: string;
    validFrom?: string | Date;
    validTo?: string | Date;
};

export type SignAttachedInput = {
    thumbprint: string;
    message: string;
};

export type SignDetachedInput = {
    thumbprint: string;
    message: string;
    cadesType?: "bes";
};

export type DetachedSignatureResult = {
    hash: string;
    pkcs7: string;
};
