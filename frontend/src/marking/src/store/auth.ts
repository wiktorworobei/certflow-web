import { useSyncExternalStore } from 'react';
import { store, signedOut } from '../../../store';
import { captureMarkingScope } from '../../lib/workspace-scope';
export interface AuthUser { id: string; companyId: string; username: string; role: string; isImpersonated?: boolean; impersonatedByUserId?: string }
let previousProfile: unknown; let previousFirm = ''; let cached: AuthUser | null = null;
function user() {
  const session = store.getState().session;
  if (session.user !== previousProfile || session.firmId !== previousFirm) {
    previousProfile = session.user; previousFirm = session.firmId;
    cached = session.user ? { id: session.user.id, companyId: session.firmId, username: session.user.userName, role: session.user.firms.find(f => f.id === session.firmId)?.role ?? 'Viewer' } : null;
  }
  return cached;
}
const clearAuth = () => store.dispatch(signedOut());
const getState = () => ({ user: user(), clearAuth, version: captureMarkingScope().epoch });
export const useAuthStore = Object.assign(<T,>(select: (state: ReturnType<typeof getState>) => T): T => useSyncExternalStore(store.subscribe, () => select(getState())), { getState });
