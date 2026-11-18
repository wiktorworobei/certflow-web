import { test, expect, type Page } from '@playwright/test';

const firmA = '11111111-1111-4111-8111-111111111111';
const firmB = '22222222-2222-4222-8222-222222222222';
const userId = '33333333-3333-4333-8333-333333333333';
const auth = (token: string) => ({
  accessToken: token, expiresAt: '2099-01-01T00:00:00Z',
  user: { id: userId, userName: 'security', displayName: 'Проверка запросов', email: '', firms: [
    { id: firmA, name: 'Компания А', role: 'Admin' }, { id: firmB, name: 'Компания Б', role: 'Admin' },
  ] },
});
async function fixture(page: Page) {
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith('/api/auth/')) return route.fulfill({ json: auth('initial-token') });
    if (path.endsWith('/dashboard')) return route.fulfill({ json: { total: 0, draft: 0, inReview: 0, ready: 0, registered: 0, expiring: 0, suspended: 0, organizations: 0, recent: [], expiringDocuments: [], activity: [] } });
    return route.fulfill({ json: { items: [], total: 0, unreadCount: 0 } });
  });
  await page.goto('/#/settings?tab=appearance');
  await expect(page.getByRole('heading', { name: 'Настройки', exact: true })).toBeVisible();
}

test('parallel document requests share one refresh and use the newly rotated token', async ({ page }) => {
  await fixture(page); let refreshes = 0; const tokens: string[] = [];
  await page.route('**/api/auth/refresh', async route => { refreshes++; await new Promise(resolve => setTimeout(resolve, 100)); await route.fulfill({ json: auth('rotated-token') }); });
  await page.route('**/api/firms/*/declarations/security-download', route => {
    const token = route.request().headers().authorization; tokens.push(token);
    return token === 'Bearer rotated-token' ? route.fulfill({ body: 'document' }) : route.fulfill({ status: 401, json: { detail: 'Expired' } });
  });
  const contents = await page.evaluate(async () => {
    const { documentBlob } = await import('/src/store.ts');
    const path = '/firms/11111111-1111-4111-8111-111111111111/declarations/security-download';
    return Promise.all([documentBlob(path).then(blob => blob.text()), documentBlob(path).then(blob => blob.text())]);
  });
  expect(contents).toEqual(['document', 'document']); expect(refreshes).toBe(1);
  expect(tokens.filter(token => token === 'Bearer rotated-token')).toHaveLength(2);
});

test('late refresh cannot sign a logged-out user back in', async ({ page }) => {
  await fixture(page); let started = false; let release!: () => void;
  const responseGate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/auth/refresh', async route => { started = true; await responseGate; await route.fulfill({ json: auth('late-token') }); });
  await page.evaluate(() => { void import('/src/store.ts').then(async module => { (window as any).securityRefresh = module.refreshIntegrationSession(); }); });
  await expect.poll(() => started).toBe(true);
  await page.evaluate(async () => { const module = await import('/src/store.ts'); module.store.dispatch(module.signedOut()); });
  release();
  const state = await page.evaluate(async () => { await (window as any).securityRefresh; const { store } = await import('/src/store.ts'); return { user: store.getState().session.user, token: store.getState().session.token }; });
  expect(state).toEqual({ user: null, token: null }); await expect(page.getByRole('button', { name: 'Войти в ZNAQ', exact: true })).toBeVisible();
});

test('a late document response is discarded after switching companies', async ({ page }) => {
  await fixture(page); let started = false; let release!: () => void;
  const responseGate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/firms/*/declarations/security-download', async route => { started = true; await responseGate; await route.fulfill({ body: 'company-a-private-document' }); });
  await page.evaluate(() => { void import('/src/store.ts').then(async module => { (window as any).securityDocument = module.documentBlob('/firms/11111111-1111-4111-8111-111111111111/declarations/security-download').then(() => 'unexpected document', error => error.message); }); });
  await expect.poll(() => started).toBe(true);
  await page.getByLabel('Компания', { exact: true }).selectOption(firmB); release();
  expect(await page.evaluate(() => (window as any).securityDocument)).toContain('изменились');
});

test('marking client rejects a foreign base URL and stops a stale 401 without refreshing', async ({ page }) => {
  await fixture(page);
  const blocked = await page.evaluate(async () => {
    const { apiClient } = await import('/src/marking/lib/api-client.ts');
    return apiClient.get('/api/honest-sign/session', { baseURL: 'https://evil.example' }).then(() => '', error => error.message);
  });
  expect(blocked).toContain('Недопустимый сервер');
  let started = false; let release!: () => void; let refreshes = 0;
  const responseGate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/api/auth/refresh', route => { refreshes++; return route.fulfill({ json: auth('unexpected-refresh') }); });
  await page.route('**/api/firms/*/marking/honest-sign/session', async route => { started = true; await responseGate; await route.fulfill({ status: 401, json: {} }); });
  await page.evaluate(() => { void import('/src/marking/lib/api-client.ts').then(module => { (window as any).securityMarking = module.apiClient.get('/api/honest-sign/session').then(() => '', error => error.message); }); });
  await expect.poll(() => started).toBe(true);
  await page.getByLabel('Компания', { exact: true }).selectOption(firmB); release();
  expect(await page.evaluate(() => (window as any).securityMarking)).toContain('изменились'); expect(refreshes).toBe(0);
});
