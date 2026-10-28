// Public deployment settings only. Database passwords and API keys never belong here.
const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || '/api';
const parsed = new URL(configured, window.location.origin);
const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
if (parsed.username || parsed.password || parsed.search || parsed.hash ||
    (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && (local || parsed.origin === window.location.origin)))) {
  throw new Error('Настройте корректный HTTPS-адрес API без пароля и параметров URL.');
}
export const API_BASE_URL = configured.replace(/\/+$/, '');
export const API_SERVER_ORIGIN = parsed.origin === window.location.origin ? '' : parsed.origin;
export const API_IS_CROSS_ORIGIN = parsed.origin !== window.location.origin;
export const SERVER_APP_URL = `${parsed.origin}/`;
export const apiUrl = (path: string) => `${API_BASE_URL}/${path.replace(/^\/+/, '')}`;
