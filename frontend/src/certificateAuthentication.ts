import { authRequest, refreshIntegrationSession, store } from './store';
import type { AuthResponse } from './types';
import type { CertificateSummary } from './marking/lib/honest-sign/types';
import { assertRequestScope, captureRequestScope } from './requestScope';

export type { CertificateSummary };
export interface LinkedCertificate {
  id: string;
  thumbprint: string;
  subject: string;
  issuer: string;
  validFrom: string;
  validUntil: string;
  createdAt: string;
}
interface Challenge {
  id: string;
  content: string;
  expiresAt: string;
}
const cryptoService = async () =>
  (await import('./marking/lib/honest-sign/cryptoProSignatureService')).cryptoProSignatureService;

export async function findSigningCertificates() {
  return (await cryptoService()).getUserCertificates();
}

// Account operations may require an access-token refresh. Passwords and signatures stay out of Redux.
async function accountRequest<T>(path: string, body?: unknown): Promise<T> {
  const scope = captureRequestScope(store.getState().session);
  try {
    return await authRequest<T>(path, body);
  } catch (error) {
    if ((error as { status?: number }).status !== 401 || !(await refreshIntegrationSession()))
      throw error;
    assertRequestScope(scope, store.getState().session, false);
    return authRequest<T>(path, body);
  }
}

async function signChallenge(challenge: Challenge, thumbprint: string) {
  const signature = await (
    await cryptoService()
  ).signAuthenticationChallenge(thumbprint, challenge.content);
  if (new Date(challenge.expiresAt).getTime() <= Date.now())
    throw new Error('Время подтверждения истекло. Повторите попытку входа.');
  return { challengeId: challenge.id, signature };
}

export async function loginWithCertificate(thumbprint: string): Promise<AuthResponse> {
  const scope = captureRequestScope(store.getState().session);
  const challenge = await authRequest<Challenge>('certificate/challenge');
  const proof = await signChallenge(challenge, thumbprint);
  assertRequestScope(scope, store.getState().session, false);
  return authRequest('certificate/login', proof);
}

export async function linkCertificate(
  thumbprint: string,
  currentPassword: string,
): Promise<LinkedCertificate> {
  const scope = captureRequestScope(store.getState().session);
  const challenge = await accountRequest<Challenge>('certificates/challenge');
  const proof = await signChallenge(challenge, thumbprint);
  assertRequestScope(scope, store.getState().session, false);
  if (!scope.userId) throw new Error('Пользователь изменился. Повторите привязку сертификата.');
  return accountRequest<LinkedCertificate>('certificates/', { ...proof, currentPassword });
}

export const removeCertificate = (id: string, currentPassword: string) =>
  accountRequest<void>(`certificates/${encodeURIComponent(id)}/remove`, { currentPassword });

export function certificateError(error: unknown): string {
  if (error instanceof Error && !(error instanceof TypeError)) return error.message;
  const detail = (error as { data?: { detail?: string } })?.data?.detail;
  return (
    detail ||
    ((error as { status?: number })?.status === 429
      ? 'Слишком много попыток. Подождите минуту и попробуйте снова.'
      : 'Не удалось выполнить вход по ЭЦП. Проверьте подключение, КриптоПро CSP и расширение КриптоПро ЭЦП Browser plug-in.')
  );
}
