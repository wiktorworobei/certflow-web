import type { Page } from '@playwright/test';

// Synthetic browser plugin. HTTP tests exercise real CMS signatures and the production verifier.
export async function installCertificatePluginFixture(page: Page, unavailable = false) {
  await page.addInitScript(({ unavailable }) => {
    const w = window as unknown as Record<string, unknown>;
    w.certificateSignedMessages = [];
    const certificate = { HasPrivateKey: true, SubjectName: 'CN=Тестовый пользователь', IssuerName: 'CN=Тестовый УЦ', Thumbprint: 'A'.repeat(40), ValidFromDate: '2026-01-01', ValidToDate: '2099-01-01' };
    const certificates = { Count: 1, Find: async () => certificates, Item: async () => certificate };
    w.cadesplugin = { CADESCOM_BASE64_TO_BINARY: 1, CADESCOM_CADES_BES: 1, CreateObjectAsync: async (kind: string) => {
      if (unavailable) throw new Error('КриптоПро недоступен. Установите КриптоПро ЭЦП Browser plug-in.');
      if (kind === 'CAdESCOM.Store') return { Certificates: certificates, Open: async () => {}, Close: async () => {} };
      if (kind === 'CADESCOM.CPAttribute') return { propset_Name: async () => {}, propset_Value: async () => {} };
      if (kind === 'CAdESCOM.CPSigner') return { propset_Certificate: async () => {}, propset_CheckCertificate: async () => {}, propset_Options: async () => {}, AuthenticatedAttributes2: { Add: async () => {} } };
      if (kind === 'CAdESCOM.HashedData') { let value = ''; return { propset_Algorithm: async () => {}, propset_DataEncoding: async () => {}, Hash: async (input: string) => { value = input; }, SetHashValue: async (input: string) => { value = input; }, get Value() { return value; } }; }
      let content = '';
      return { propset_ContentEncoding: async () => {}, propset_Content: async (value: string) => { content = value; }, SignHash: async (hash: { Value: string }, _signer: unknown, type: number) => { if (type !== 1) throw new Error('Expected CAdES-BES'); (w.certificateSignedMessages as string[]).push(new TextDecoder().decode(Uint8Array.from(atob(hash.Value), c => c.charCodeAt(0)))); return 'synthetic-certificate-proof'; }, SignCades: async (_signer: unknown, type: number) => {
        if (type !== 1) throw new Error('Expected CAdES-BES');
        (w.certificateSignedMessages as string[]).push(new TextDecoder().decode(Uint8Array.from(atob(content), c => c.charCodeAt(0))));
        return 'synthetic-certificate-proof';
      } };
    } };
  }, { unavailable });
}
