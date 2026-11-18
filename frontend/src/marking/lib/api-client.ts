import axios from 'axios';
import { api, store, refreshIntegrationSession } from '../../store';
import { API_SERVER_ORIGIN } from '../../apiUrl';
import { dmKodActorKey } from './dmkod-scope';
import { useAuthStore } from '../src/store/auth';
import { assertMarkingScope, captureMarkingScope } from './workspace-scope';
import { assertCrptEnvironment, captureCrptEnvironment } from '../../crpt/environment';
import { markingRequestUrl } from './request-routing';
declare module 'axios' {
  interface AxiosRequestConfig {
    dmKodActorId?: string;
    certflowActor?: string;
    certflowFirm?: string;
    certflowRetried?: boolean;
    certflowScope?: ReturnType<typeof captureMarkingScope>;
    crptScope?: ReturnType<typeof captureCrptEnvironment>;
    authVersion?: number;
  }
}
export const apiClient = axios.create({
  baseURL: API_SERVER_ORIGIN,
  timeout: 60000,
  withCredentials: true,
});
apiClient.interceptors.request.use(
  (config) => {
    if (config.baseURL !== API_SERVER_ORIGIN) throw new Error('Недопустимый сервер интеграции.');
    if (config.crptScope) assertCrptEnvironment(config.crptScope);
    else config.crptScope = captureCrptEnvironment();
    const session = store.getState().session;
    if (config.certflowScope) assertMarkingScope(config.certflowScope);
    else config.certflowScope = captureMarkingScope();
    if (config.authVersion !== undefined && config.authVersion !== config.certflowScope.epoch)
      throw new Error('Компания или пользователь изменились. Операция остановлена.');
    if (!session.user || !session.token || !session.firmId)
      throw new Error('Войдите в ZNAQ и выберите компанию.');
    const expectedFirm =
      config.headers.get('X-Company-Id') || config.certflowFirm || session.firmId;
    if (
      expectedFirm !== session.firmId ||
      (config.certflowActor && config.certflowActor !== session.user.id) ||
      (config.dmKodActorId && config.dmKodActorId !== dmKodActorKey(useAuthStore.getState().user))
    )
      throw new Error(
        'Компания или пользователь изменились. Повторите действие в текущем пространстве.',
      );
    config.certflowActor = session.user.id;
    config.certflowFirm = session.firmId;
    config.url = markingRequestUrl(config.url ?? '', session.firmId, config.crptScope.environment);
    config.headers.set('Authorization', `Bearer ${session.token}`);
    config.headers.set('X-Requested-With', 'CertFlow');
    config.headers.set('locale', 'ru');
    return config;
  },
  (error) => {
    throw error;
  },
  { synchronous: true },
);
apiClient.interceptors.response.use(
  (response) => {
    if (response.config.crptScope) assertCrptEnvironment(response.config.crptScope);
    if (response.config.certflowScope) assertMarkingScope(response.config.certflowScope);
    if (response.config.method !== 'get' && /\/(auth\/|session)/.test(response.config.url ?? ''))
      store.dispatch(api.util.invalidateTags(['Marking']));
    return response;
  },
  async (error) => {
    const config = error.config;
    if (config?.crptScope) assertCrptEnvironment(config.crptScope);
    if (config?.certflowScope) assertMarkingScope(config.certflowScope);
    if (
      axios.isAxiosError(error) &&
      error.response?.status === 401 &&
      config &&
      !config.certflowRetried
    ) {
      config.certflowRetried = true;
      const session = store.getState().session;
      const tokenAlreadyRotated =
        session.token && config.headers.get('Authorization') !== `Bearer ${session.token}`;
      if (
        config.certflowActor === session.user?.id &&
        config.certflowFirm === session.firmId &&
        (tokenAlreadyRotated || (await refreshIntegrationSession()))
      )
        return apiClient.request(config);
    }
    return Promise.reject(error);
  },
);
