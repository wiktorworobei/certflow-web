import type { CrptEnvironment } from '../../crpt/environment';

/** Resolve and validate before attaching credentials, including browser URL normalization. */
export function markingRequestUrl(
  url: string,
  firmId: string,
  environment: CrptEnvironment | null,
) {
  const origin = 'https://integration.invalid';
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('\\'))
    throw new Error('Недопустимый адрес интеграции.');
  const target = new URL(url, origin);
  if (target.origin !== origin || /%2f|%5c/i.test(target.pathname))
    throw new Error('Недопустимый адрес интеграции.');

  const firmRoot = `/api/firms/${encodeURIComponent(firmId)}`;
  const markingRoot = `${firmRoot}/marking`;
  const crptRoot = environment ? `${firmRoot}/crpt/${environment}` : null;
  const routes = [
    ['/api/honest-sign', `${crptRoot ?? markingRoot}/honest-sign`],
    ['/api/dmkod', `${markingRoot}/dmkod`],
    ['/api/standalone/documents', `${markingRoot}/documents`],
  ];
  for (const [source, destination] of routes) {
    if (target.pathname === source || target.pathname.startsWith(source + '/')) {
      target.pathname = destination + target.pathname.slice(source.length);
      return target.pathname + target.search;
    }
  }
  if (
    target.pathname.startsWith(markingRoot + '/') ||
    (crptRoot && target.pathname.startsWith(crptRoot + '/'))
  ) {
    return target.pathname + target.search;
  }
  throw new Error('Недопустимый адрес интеграции.');
}
