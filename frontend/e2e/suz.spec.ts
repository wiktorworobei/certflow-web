import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { installCertificatePluginFixture } from './certificate-plugin-fixture';

const firmId = '11111111-1111-4111-8111-111111111111';
const orderId = '33333333-3333-4333-8333-333333333333';
const blockId = '44444444-4444-4444-8444-444444444444';
const gtin = '00460000000008';
const codes = [`01${gtin}21ABC,;"serial\x1d93xyz+ `, `01${gtin}21SECOND\x1d91ABCD\x1d92xyz==`];
const errors = new WeakMap<Page, string[]>();
test.afterEach(async ({ page }) => { expect(errors.get(page) ?? []).toEqual([]); });
type Receipt = { id: string; kind: string; state: string; body: string | null; codes?: string[]; codesCount: number; [key: string]: unknown };
async function fixture(page: Page) {
  const failures: string[] = []; errors.set(page, failures); page.on('pageerror', error => failures.push(error.message));
  await installCertificatePluginFixture(page);
  const requests: { path: string; body: Record<string, any> | null }[] = []; const receipts = new Map<string, Receipt>();
  const auth = { accessToken: 'synthetic-suz-test', expiresAt: '2099-01-01T00:00:00Z', user: { id: '22222222-2222-4222-8222-222222222222', userName: 'test', displayName: 'Тест СУЗ', email: '', firms: [{ id: firmId, name: 'Тестовая компания СУЗ', role: 'Admin' }] } };
  const make = (id: string, kind: string, extra: Record<string, unknown> = {}): Receipt => ({ id, kind, state: 'Accepted', name: kind === 'Create' ? 'Создание заказа' : kind === 'Close' ? 'Закрытие заказа' : 'Коды · тестовый заказ', createdAtUtc: '2026-11-17T12:00:00Z', body: null, certificateThumbprint: 'A'.repeat(40), expiresAtUtc: '2099-01-01T00:00:00Z', orderId, gtin, blockId: null, codesCount: 0, sources: [orderId], ...extra });
  await page.route('**/api/**', async route => {
    const req = route.request(), path = new URL(req.url()).pathname; const body = req.postData() ? req.postDataJSON() : null; requests.push({ path, body });
    const json = (value: unknown) => route.fulfill({ json: value });
    if (path.startsWith('/api/auth/')) return json(auth);
    if (path.endsWith('/session')) return json({ isAuthenticated: true, hasHonestSignSession: true, certificateThumbprint: 'A'.repeat(40), honestSignSessionExpiresAtUtc: '2099-01-01T00:00:00Z' });
    if (path.endsWith('/participants/product-groups')) return json(['milk', 'autofluids']);
    if (path.endsWith('/orders/search')) return json({ totalItems: 1, items: [{ orderId, productionOrderId: 'Тестовый заказ № 17', status: 'READY', createdAtUtc: '2026-11-17T12:00:00Z', totalCodes: 1000, usedCodes: 200, remainingCodes: 800, declineReason: null, products: [{ gtin, totalCodes: 1000, status: 'ACTIVE', availableCodes: 800, totalPassed: 200, cisType: 'UNIT' }] }] });
    if (path.endsWith('/suz/catalog-product')) return json({ gtin, name: 'Тестовый набор', status: 'published', cisType: 'SET', contents: [{ gtin: '00460000000015', quantity: 3 }] });
    if (path.endsWith('/suz/prepare')) { const row = make(body.requestId, body.kind, { state: 'Prepared', body: JSON.stringify(body.payload) }); receipts.set(row.id, row); return json(row); }
    if (path.endsWith('/sign')) { const id = path.split('/').at(-2)!; const previous = receipts.get(id)!; const row = { ...previous, state: 'Accepted', body: null }; receipts.set(id, row); return json(row); }
    if (path.endsWith('/suz/blocks')) return json({ omsId: orderId, blocks: [{ blockId, quantity: codes.length, blockDateTime: Date.now() }] });
    if (path.endsWith('/suz/codes')) { const row = make(body.requestId, body.blockId ? 'Retry' : 'Codes', { blockId, codes, codesCount: codes.length }); receipts.set(row.id, row); return json(row); }
    if (path.endsWith('/suz/archive')) { const combined = [...new Set([...(body.codes ?? []), ...(body.documentIds ?? []).flatMap((id: string) => receipts.get(id)?.codes ?? [])])] as string[]; const row = make(body.requestId, 'Archive', { name: body.name, codes: combined, codesCount: combined.length, sources: body.documentIds }); receipts.set(row.id, row); return json(row); }
    if (path.endsWith('/suz/operations')) return json([...receipts.values()].map(({ codes: _, ...rest }) => rest));
    if (/\/suz\/operations\/[^/]+$/.test(path)) return json(receipts.get(path.split('/').at(-1)!));
    if (path.endsWith('/product-groups')) return json([{ code: 43, name: 'Моторные масла' }]);
    if (path.endsWith('/products')) return json({ items: [], page: 1, pageSize: 50, total: 0, hasNextPage: false });
    return json({ items: [], total: 0, unreadCount: 0 });
  });
  await page.goto('/#/crpt?service=suz'); await expect(page.getByRole('heading', { name: 'Заказы кодов маркировки', exact: true })).toBeVisible();
  return { requests, receipts };
}
const importCsv = 'Группа;GTIN;Способ выпуска;Количество;Тип КМ;Оплата;ID шаблона;Наименование;ИНН производителя;Производственный заказ\r\nmilk;00460000000008;PRODUCTION;100;UNIT;2;20;Тестовый товар;0012345678;Заказ 0001';
test('SUZ renders order and buffer metrics, downloads a durable code document, and isolates contours', async ({ page }) => {
  const f = await fixture(page); await page.getByRole('button', { name: 'Тестовый заказ № 17', exact: true }).click();
  await expect(page.getByText('Запрошено: 1 000 · получено: 200 · доступно: 800', { exact: true })).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '../artifacts/screenshots/suz-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Получить коды', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Получить коды маркировки', exact: true });
  const download = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Получить и сохранить', exact: true }).click();
  const content = await readFile((await (await download).path())!, 'utf8'); expect(content).toContain(codes[0].replaceAll('"', '""'));
  await page.getByRole('tab', { name: 'Документы с кодами', exact: true }).click(); await expect(page.getByText('Коды · тестовый заказ', { exact: true })).toBeVisible();
  const repeat = page.waitForEvent('download'); await page.getByRole('button', { name: 'CSV', exact: true }).click(); await repeat;
  expect(f.requests.filter(x => x.path.endsWith('/suz/codes'))).toHaveLength(1);
  await page.getByRole('tab', { name: 'Рабочий контур', exact: true }).click();
  await expect.poll(() => f.requests.some(x => x.path.includes('/crpt/production/honest-sign/orders/search'))).toBe(true);
  expect(f.requests.every(x => !x.path.includes('/marking/honest-sign/'))).toBe(true);
  await page.getByRole('button', { name: 'Включить тёмную тему', exact: true }).click(); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '../artifacts/screenshots/suz-dark.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '../artifacts/screenshots/suz-mobile.png', fullPage: true });
});
test('SUZ imports and exports Excel, signs the exact prepared body after confirmation, and never auto-signs', async ({ page }) => {
  const f = await fixture(page); await page.getByRole('tab', { name: 'Создать заказ', exact: true }).click();
  await page.getByLabel('Файл заказов СУЗ', { exact: true }).setInputFiles({ name: 'orders.csv', mimeType: 'text/csv', buffer: Buffer.from(importCsv) });
  await expect(page.getByLabel('GTIN · 14 цифр', { exact: true })).toHaveValue(gtin);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Экспорт пакета', exact: true }).click(); const xlsx = await readFile((await (await download).path())!);
  await page.getByLabel('Файл заказов СУЗ', { exact: true }).setInputFiles({ name: 'orders.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: xlsx });
  await expect(page.getByLabel('ИНН производителя', { exact: true })).toHaveValue('0012345678');
  await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: '../artifacts/screenshots/suz-create.png', fullPage: true });
  await page.getByRole('button', { name: 'Подготовить заказы (1)', exact: true }).click();
  const review = page.getByRole('dialog', { name: /Проверка и подписание/ }); await expect(review).toBeVisible();
  await expect(review.getByRole('button', { name: 'Подписать и отправить', exact: true })).toBeDisabled();
  expect(f.requests.some(x => x.path.endsWith('/sign'))).toBe(false);
  await review.getByRole('checkbox').check(); await review.getByRole('button', { name: 'Подписать и отправить', exact: true }).click();
  await expect(review.getByText('Создание заказа · Выполнено', { exact: true })).toBeVisible();
  const prepared = f.requests.find(x => x.path.endsWith('/suz/prepare'))!.body!;
  expect(prepared.payload.products[0]).toMatchObject({ gtin, quantity: 100, attributes: { producer: '0012345678' } });
  expect(await page.evaluate(() => (window as unknown as { certificateSignedMessages: string[] }).certificateSignedMessages)).toContain(JSON.stringify(prepared.payload));
  await expect(review.getByRole('button', { name: 'Подписать и отправить', exact: true })).toBeDisabled();
});
test('SUZ closes with a signed orderId body and recovers an existing block without requesting a new portion', async ({ page }) => {
  const f = await fixture(page); await page.getByRole('button', { name: 'Закрыть заказ', exact: true }).click();
  const review = page.getByRole('dialog', { name: /Проверка и подписание/ }); await expect(review).toBeVisible();
  expect(f.requests.find(x => x.path.endsWith('/suz/prepare'))?.body).toMatchObject({ kind: 'Close', payload: { orderId } });
  await review.getByRole('checkbox').check(); await review.getByRole('button', { name: 'Подписать и отправить', exact: true }).click(); await expect(review.getByText('Закрытие заказа · Выполнено', { exact: true })).toBeVisible();
  await review.getByRole('button', { name: 'Закрыть окно', exact: true }).click(); await page.getByRole('button', { name: 'Получить коды', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Получить коды маркировки', exact: true });
  await dialog.getByRole('button', { name: 'Обновить выданные блоки', exact: true }).click();
  await dialog.getByLabel('Получение кодов', { exact: true }).click(); await page.getByRole('option', { name: new RegExp('Повторить блок ' + blockId) }).click();
  const download = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Восстановить блок', exact: true }).click(); await download;
  expect(f.requests.find(x => x.path.endsWith('/suz/codes'))?.body).toMatchObject({ orderId, gtin, blockId });
});
test('SUZ merges files preserving separators and requires discarding unsaved work before changing environment', async ({ page }) => {
  const f = await fixture(page); await page.getByRole('tab', { name: 'Объединение файлов', exact: true }).click();
  await page.getByLabel('Файлы кодов СУЗ', { exact: true }).setInputFiles([{ name: 'one.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify([codes[0]])) }, { name: 'two.txt', mimeType: 'text/plain', buffer: Buffer.from(codes.join('\r\n')) }]);
  await expect(page.getByText('one.json · 1 кодов', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Рабочий контур', exact: true }).click();
  const discard = page.getByRole('dialog', { name: 'Закрыть подготовленные данные?', exact: true }); await expect(discard).toBeVisible();
  await discard.getByRole('button', { name: 'Продолжить работу', exact: true }).click();
  await page.getByRole('button', { name: 'Объединить и сохранить', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Объединённые коды', exact: true })).toBeVisible();
  expect(f.requests.find(x => x.path.endsWith('/suz/archive'))?.body?.codes).toEqual([codes[0], ...codes]);
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Скачать CSV', exact: true }).click();
  const text = await readFile((await (await download).path())!, 'utf8'); expect(text.split('\r\n')).toHaveLength(3);
});
test('SUZ adds a subaccount set with multiplied unit quantities from the National Catalog', async ({ page }) => {
  const f = await fixture(page); await page.getByRole('tab', { name: 'Создать заказ', exact: true }).click();
  await page.getByLabel('Найти GTIN в НК', { exact: true }).fill(gtin); await page.getByRole('checkbox', { name: 'Карточка по доступу субаккаунта', exact: true }).check(); await page.getByRole('button', { name: 'Найти карточку', exact: true }).click();
  await page.getByLabel('Количество товара / наборов', { exact: true }).fill('10'); await page.getByRole('checkbox', { name: 'Добавить также единицы из состава набора', exact: true }).check(); await page.getByRole('button', { name: 'Добавить из НК', exact: true }).click();
  await expect(page.getByLabel('Количество КМ', { exact: true }).nth(0)).toHaveValue('10'); await expect(page.getByLabel('Количество КМ', { exact: true }).nth(1)).toHaveValue('30');
  expect(f.requests.some(x => x.path.endsWith('/suz/catalog-product'))).toBe(true);
});

test('SUZ retains a download request ID after an unknown result and reopening the dialog', async ({ page }) => {
  await fixture(page); const attempts: Record<string, unknown>[] = [];
  await page.route('**/honest-sign/suz/codes', async route => { const data = route.request().postDataJSON(); attempts.push(data); await route.fulfill({ json: { id: data.requestId, kind: 'Codes', state: 'Unknown', codesCount: 0, sources: [], message: 'Результат неизвестен. Восстановите выданный блок.' } }); });
  await page.getByRole('button', { name: 'Получить коды', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Получить коды маркировки', exact: true }); await dialog.getByRole('button', { name: 'Получить и сохранить', exact: true }).click();
  await expect(dialog.getByText('Результат неизвестен. Восстановите выданный блок.', { exact: true })).toBeVisible();
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click(); await page.getByRole('button', { name: 'Получить коды', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Получить коды маркировки', exact: true }); await dialog.getByRole('button', { name: 'Получить и сохранить', exact: true }).click();
  await expect.poll(() => attempts.length).toBe(2); expect(attempts[0].requestId).toBe(attempts[1].requestId);
});

test('SUZ blocks signing a partly prepared batch and retries the same preparation IDs', async ({ page }) => {
  await fixture(page); const preparations: string[] = []; let failed = false;
  await page.route('**/honest-sign/suz/prepare', async route => { const data = route.request().postDataJSON(); preparations.push(data.requestId); if (preparations.length === 2 && !failed) { failed = true; return route.abort(); } return route.fallback(); });
  await page.getByRole('tab', { name: 'Создать заказ', exact: true }).click();
  const csv = importCsv.split('\r\n')[0] + '\r\n' + Array.from({ length: 11 }, (_, i) => `milk;${String(46000000000000 + i)};PRODUCTION;100;UNIT;2;20;Товар ${i};;;`).join('\r\n');
  await page.getByLabel('Файл заказов СУЗ', { exact: true }).setInputFiles({ name: 'batch.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) });
  await page.getByRole('button', { name: 'Подготовить заказы (11)', exact: true }).click(); const dialog = page.getByRole('dialog', { name: /Проверка и подписание/ });
  await expect(dialog.getByText('Подготовлено: 1 из 2.', { exact: true })).toBeVisible(); await dialog.getByRole('checkbox').check(); await expect(dialog.getByRole('button', { name: 'Подписать и отправить', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Повторить подготовку пакета', exact: true }).click(); await expect(dialog.getByText('Подготовлено: 2 из 2.', { exact: true })).toBeVisible();
  expect(preparations.slice(0, 2)).toEqual(preparations.slice(2));
});
