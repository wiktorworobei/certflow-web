import { test, expect, type Page } from '@playwright/test';
import { installCertificatePluginFixture } from './certificate-plugin-fixture';
import { readFile } from 'node:fs/promises';

const firmId = '11111111-1111-4111-8111-111111111111';
const thumbprint = 'A'.repeat(40);
const submissionId = '44444444-4444-4444-8444-444444444444';
const draft = { requestId: submissionId, categoryId: 100, gtin: '05011846021161', name: 'Масло моторное 5W-30, 4 л', brand: 'Тестовый бренд', tnved: '2710198200', productGroupCode: 43, sendToModeration: false, attributes: [], photoUrl: null };
export async function crptFixtures(page: Page) {
  await installCertificatePluginFixture(page);
  const firm = { id: firmId, name: 'Тестовая компания CRPT', role: 'Admin' };
  const auth = { accessToken: 'synthetic-crpt-token', expiresAt: '2099-01-01T00:00:00Z', user: { id: '22222222-2222-4222-8222-222222222222', userName: 'test', displayName: 'Тест CRPT', email: '', firms: [firm] } };
  const requests: string[] = []; const writes: unknown[] = [];
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname; requests.push(path);
    const json = (value: unknown) => route.fulfill({ json: value });
    if (path.startsWith('/api/auth/')) return json(auth);
    if (path.endsWith('/registry-monitoring/notifications')) return json({ items: [], total: 0, unreadCount: 0 });
    if (path.endsWith('/session')) return json({ isAuthenticated: true, hasHonestSignSession: true, certificateThumbprint: thumbprint, honestSignSessionExpiresAtUtc: '2099-01-01T00:00:00Z' });
    if (path.endsWith('/settings')) return json({ profile: path.includes('/production/') ? 'Production' : 'Sandbox', omsId: '33333333-3333-4333-8333-333333333333', connectionId: '33333333-3333-4333-8333-333333333333', participantInn: '7707083893' });
    if (path.endsWith('/product-groups')) return json([{ code: 43, name: 'Моторные масла' }]);
    if (path.endsWith('/categories')) return json([{ id: 100, name: 'Моторные масла', parentId: 0, level: 1, isActive: true, productGroupCodes: [43] }]);
    if (path.endsWith('/attributes')) return json([]);
    if (path.endsWith('/brands')) return json({ items: [], hasNextPage: false });
    if (path.endsWith('/gtins/generated')) return json({ codes: [], monthlyLimit: 100, monthlyUsage: 0 });
    if (path.endsWith('/products')) return json({ items: [{ goodId: 42, gtin: draft.gtin, name: draft.name, brand: draft.brand, tnved: draft.tnved, status: 'draft', detailedStatuses: ['notsigned'], updatedAt: '2026-11-17T12:00:00', submissionId }], page: 1, pageSize: 50, total: 1, hasNextPage: false });
    if (path.endsWith('/search')) return json([]);
    if (path.endsWith('/card')) return json({ submissionId, goodId: 42, gtin: draft.gtin, status: 'draft', detailedStatuses: ['notsigned'], isSigned: false, canEdit: true, canSign: true, canModerate: true, canOrderCodes: false, canIntroduce: false, draft, blockingOperation: null });
    if (path.endsWith('/status')) return json({ submissionId, submissionState: 'Draft', status: null, errors: [] });
    if (path.endsWith('/submissions')) return json({ items: [], hasNextPage: false });
    if (path.endsWith('/access')) return json({ linked_accounts: [{ account_inn: '7707083893', account_name: 'Тестовый субаккаунт', full_access: false, access_allowed: [{ gtin: '04600000000008' }] }], linked_gtins: [] });
    if (path.endsWith('/access/prepare')) { writes.push(req.postDataJSON()); return json({ id: submissionId, inn: '7707083893', xml: '<account>synthetic</account>', certificateThumbprint: thumbprint, expiresAtUtc: '2099-01-01T12:00:00Z', state: 'Prepared', result: null }); }
    if (path.endsWith('/bulk/drafts')) { const data = req.postDataJSON(); writes.push(data); return json(data.map((card: typeof draft, i: number) => ({ row: i+1, submission: { id: submissionId, gtin: card.gtin, state: 'Draft', feedId: null, sendToModeration: false, createdAtUtc: '2026-11-17T12:00:00Z', draftVersion: submissionId }, error: null }))); }
    if (req.method() !== 'GET') writes.push(req.postDataJSON());
    return json({ items: [], total: 0, unreadCount: 0 });
  });
  return { requests, writes };
}

test('CRPT keeps sandbox and production requests separate and renders desktop, mobile and dark theme', async ({ page }) => {
  const fixture = await crptFixtures(page); await page.goto('/#/crpt');
  await expect(page.getByRole('heading', { name: 'ZNAQ.CRPT', exact: true })).toBeVisible();
  await expect(page.getByText(draft.name, { exact: true })).toBeVisible();
  expect(fixture.requests.some(x => x.includes('/crpt/sandbox/honest-sign/catalog/products'))).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '../artifacts/screenshots/crpt-desktop.png', fullPage: true });
  await page.getByRole('tab', { name: 'Рабочий контур', exact: true }).click();
  await expect(page.getByText(draft.name, { exact: true })).toBeVisible();
  await expect.poll(() => fixture.requests.some(x => x.includes('/crpt/production/honest-sign/catalog/products'))).toBe(true);
  await page.getByRole('button', { name: 'Включить тёмную тему', exact: true }).click();
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '../artifacts/screenshots/crpt-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '../artifacts/screenshots/crpt-mobile.png', fullPage: true });
});
test('CRPT copies characteristics while requiring a new GTIN and confirms subaccount access before signing', async ({ page }) => {
  const fixture = await crptFixtures(page); await page.goto('/#/crpt');
  await page.getByRole('checkbox', { name: `Выбрать ${draft.gtin}`, exact: true }).check();
  await page.getByRole('button', { name: /Действия · 1/ }).click(); await page.getByRole('menuitem', { name: 'Создать подобный товар', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Создать подобный товар', exact: true }); await expect(editor).toBeVisible();
  await expect(editor.locator('#catalog-gtin')).toHaveValue(''); await expect(editor.locator('#catalog-name')).toHaveValue(draft.name);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '../artifacts/screenshots/crpt-similar.png', fullPage: true });
  await editor.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('tab', { name: 'Субаккаунты', exact: true }).click();
  await page.getByLabel('ИНН субаккаунта', { exact: true }).fill('7707083893'); await page.getByLabel('GTIN для доступа', { exact: true }).fill('04600000000008');
  await page.getByRole('button', { name: 'Сформировать документ доступа', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Подписать и применить доступ', exact: true })).toBeDisabled();
  expect(fixture.writes[0]).toMatchObject({ inn: '7707083893', allow: true, gtins: ['04600000000008'] });
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '../artifacts/screenshots/crpt-access.png', fullPage: true });
});
test('CRPT imports Excel-compatible CSV and saves drafts without publishing', async ({ page }) => {
  const fixture = await crptFixtures(page); await page.goto('/#/crpt'); await page.getByRole('tab', { name: 'Массовое создание', exact: true }).click();
  await page.getByLabel('Файл карточек НК', { exact: true }).setInputFiles({ name: 'cards.csv', mimeType: 'text/csv', buffer: Buffer.from('GTIN;Наименование;Бренд;ТН ВЭД;Группа;Категория;Тип\r\n05011846021161;Товар из импорта;Тест;2710198200;43;100;Единица', 'utf8') });
  await expect(page.getByText('Товар из импорта', { exact: true })).toBeVisible();
  const exported = page.waitForEvent('download'); await page.getByRole('button', { name: 'Экспорт пакета', exact: true }).click();
  const workbook = await (await exported).path(); expect(workbook).toBeTruthy();
  page.once('dialog', dialog => dialog.accept());
  await page.reload(); await page.getByRole('tab', { name: 'Массовое создание', exact: true }).click();
  await page.getByLabel('Файл карточек НК', { exact: true }).setInputFiles({ name: 'cards.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: await readFile(workbook!) });
  await expect(page.getByText('Товар из импорта', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Сохранить черновики (1)', exact: true }).click();
  await expect(page.getByText('Черновик сохранён', { exact: true })).toBeVisible();
  expect((fixture.writes[0] as Record<string, unknown>[])[0]).toMatchObject({ name: 'Товар из импорта', sendToModeration: false });
  expect(fixture.requests.some(x => x.endsWith('/send') || x.endsWith('/sign'))).toBe(false);
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '../artifacts/screenshots/crpt-batch.png', fullPage: true });
  await page.getByRole('tab', { name: 'Удаление карточек', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Открыть песочницу ЧЗ', exact: true })).toHaveAttribute('href', 'https://markirovka.sandbox.crptech.ru/');
});
