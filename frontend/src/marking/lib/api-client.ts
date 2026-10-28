import axios from 'axios';
import { api, store, refreshIntegrationSession } from '../../store';
import { API_SERVER_ORIGIN } from '../../apiUrl';
import { dmKodActorKey } from './dmkod-scope';
import { useAuthStore } from '../src/store/auth';
import { assertMarkingScope, captureMarkingScope } from './workspace-scope';
declare module 'axios' {
  interface AxiosRequestConfig { dmKodActorId?: string; certflowActor?: string; certflowFirm?: string; certflowRetried?: boolean; certflowScope?: ReturnType<typeof captureMarkingScope> }
}
export const apiClient = axios.create({ baseURL: API_SERVER_ORIGIN, timeout: 60000, withCredentials: true });
apiClient.interceptors.request.use(config => {
  const session = store.getState().session;
  if (config.certflowScope) assertMarkingScope(config.certflowScope); else config.certflowScope = captureMarkingScope();
  if (!session.user || !session.token || !session.firmId) throw new Error('Войдите в CertFlow и выберите компанию.');
  const expectedFirm = config.headers.get('X-Company-Id') || config.certflowFirm || session.firmId;
  if (expectedFirm !== session.firmId || config.certflowActor && config.certflowActor !== session.user.id || config.dmKodActorId && config.dmKodActorId !== dmKodActorKey(useAuthStore.getState().user)) throw new Error('Компания или пользователь изменились. Повторите действие в текущем пространстве.');
  config.certflowActor = session.user.id; config.certflowFirm = session.firmId;
  const url = config.url ?? '';
  if (url.startsWith('/api/honest-sign')) config.url = url.replace('/api/honest-sign', `/api/firms/${session.firmId}/marking/honest-sign`);
  else if (url.startsWith('/api/dmkod')) config.url = url.replace('/api/dmkod', `/api/firms/${session.firmId}/marking/dmkod`);
  else if (url.startsWith('/api/standalone/documents')) config.url = url.replace('/api/standalone/documents', `/api/firms/${session.firmId}/marking/documents`);
  else if (!url.startsWith(`/api/firms/${session.firmId}/marking/`)) throw new Error('Недопустимый адрес интеграции.');
  config.headers.set('Authorization', `Bearer ${session.token}`); config.headers.set('X-Requested-With', 'CertFlow'); config.headers.set('locale', 'ru');
  return config;
});
apiClient.interceptors.response.use(response => {
  if (response.config.certflowScope) assertMarkingScope(response.config.certflowScope);
  if (response.config.method !== 'get' && /\/(auth\/|session)/.test(response.config.url ?? '')) store.dispatch(api.util.invalidateTags(['Marking']));
  return response;
}, async error => {
  const config = error.config;
  if (axios.isAxiosError(error) && error.response?.status === 401 && config && !config.certflowRetried) {
    config.certflowRetried = true;
    const session = store.getState().session;
    if (config.certflowActor === session.user?.id && config.certflowFirm === session.firmId && await refreshIntegrationSession()) return apiClient.request(config);
  }
  return Promise.reject(error);
});
