export interface SessionIdentity {
  user: { id: string } | null;
  firmId: string;
  authEpoch: number;
  workspaceEpoch: number;
}

export const captureRequestScope = (session: SessionIdentity) => ({
  userId: session.user?.id ?? null,
  firmId: session.firmId,
  authEpoch: session.authEpoch,
  workspaceEpoch: session.workspaceEpoch,
});

export function isRequestScopeCurrent(
  scope: ReturnType<typeof captureRequestScope>,
  session: SessionIdentity,
  includeFirm = true,
) {
  return (
    scope.authEpoch === session.authEpoch &&
    scope.userId === (session.user?.id ?? null) &&
    (!includeFirm ||
      (scope.workspaceEpoch === session.workspaceEpoch && scope.firmId === session.firmId))
  );
}

export function assertRequestScope(
  scope: ReturnType<typeof captureRequestScope>,
  session: SessionIdentity,
  includeFirm = true,
) {
  if (!isRequestScopeCurrent(scope, session, includeFirm))
    throw new Error(
      'Пользователь или компания изменились. Повторите действие в текущем пространстве.',
    );
}

export function requestMatchesFirm(url: string, firmId: string) {
  const path = url.split(/[?#]/, 1)[0];
  if (path.includes('\\') || /%2f|%5c/i.test(path) || /(?:^|\/)(?:\.|%2e){1,2}(?:\/|$)/i.test(path))
    return false;
  const match = /^\/?(?:api\/)?firms\/([^/?#]+)(?:\/|$)/.exec(path);
  return !match || match[1] === firmId;
}
