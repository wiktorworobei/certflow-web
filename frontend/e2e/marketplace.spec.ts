import { test, expect, type Page } from '@playwright/test';
import { gzipSync } from 'node:zlib';

const firmId = '11111111-1111-4111-8111-111111111111';
const requestId = '33333333-3333-4333-8333-333333333333';
const number = 'ЕАЭС N RU Д-RU.РА01.В.10085/26';

async function fixtures(page: Page, role = 'Admin', accessMode = 'SyncOnly', connected = false) {
  const firm = { id: firmId, name: 'Моя компания', inn: '', role };
  const auth = { accessToken: 'fixture-token', expiresAt: '2099-01-01T00:00:00Z', user: { id: requestId, userName: 'test', displayName: 'Виктор', email: '', firms: [firm] } };
  let configured = connected || role === 'Viewer'; let mode = accessMode; let revision = configured ? 'rev-1' : null;
  const writes: Record<string, unknown>[] = []; const queries: Record<string, unknown>[] = []; const batches: Record<string, unknown>[] = [];
  await page.route('**/api/**', async route => {
    const req = route.request(); const path = new URL(req.url()).pathname.replace(/\/$/, '');
    const json = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    if (path.includes('/auth/')) return json(auth);
    if (path.endsWith('/integrations/dadata')) return json({ enabled: true, isConfigured: false, hasPersonalKey: false, source: 'None', verifiedAt: null });
    if (path.endsWith('/marking/connections')) return json({ profile: 'Sandbox', chz: null, dmKod: [] });
    if (path.endsWith('/marking/settings')) return json({ profile: 'Sandbox', omsId: '', connectionId: '', participantInn: '' });
    if (path.endsWith('/integrations')) return json([{ id: 'registry', name: 'Реестры Росаккредитации', status: configured ? 'Configured' : 'NotConfigured', description: 'Проверка реестров' }]);
    if (path.endsWith('/marketplace/settings')) {
      if (req.method() === 'PUT') { const body = req.postDataJSON(); writes.push(body); configured = true; revision = 'rev-1'; mode = body.accessMode; }
      if (req.method() === 'DELETE') { configured = false; revision = null; return route.fulfill({ status: 204 }); }
      return json({ enabled: true, isConfigured: configured, environment: 'Development', accessMode: mode, revision, updatedAtUtc: configured ? '2026-11-11T10:00:00Z' : null });
    }
    if (/\/sync\/(rds|rss|reaeu)\/get$/.test(path)) {
      queries.push({ ...req.postDataJSON(), section: path.split('/').at(-2) });
      return json({ section: 'rds', checkedAtUtc: '2026-11-11T10:00:00Z', statusLabel: 'Прекращён', statusInRussiaLabel: null, registryUrl: 'https://pub.fsa.gov.ru/rds/declaration/view/17319408', document: { id: 17319408, numberDoc: number, regDate: '', endDate: null, products: null, techRegs: null, manufacturerName: 'Тестовый изготовитель', manufacturerAddress: null, updated: null } });
    }
    if (path.endsWith('/async/rds/find-doc') || path.endsWith('/async/rds/check-status')) { batches.push(req.postDataJSON()); return json({ requestId }); }
    if (path.endsWith('/async/history')) return json({ items: batches.length ? [{ requestId, section: 'rds', kind: 'find-doc', createdAtUtc: '2026-11-11T10:00:00Z', usesCurrentConnection: true }] : [], total: batches.length ? 1 : 0, page: 1, pageSize: 10 });
    if (path.endsWith('/sync/export/manifest')) return json({ rssFull: { sizeBytes: 100, recordCount: 1, sha256: 'test' }, rdsFull: { sizeBytes: 100, recordCount: 1, sha256: 'test' }, reaeuFull: { sizeBytes: 100, recordCount: 1, sha256: 'test' }, deltasSinceFull: ['rss', 'rds', 'reaeu'].map(section => ({ section, coversDate: '2026-11-11', sizeBytes: 100, recordCount: 1 })), updatedAt: '2026-11-11T10:00:00Z' });
    if (/\/sync\/export\/.+\.jsonl\.gz$/.test(path) || /\/async\/(result|errors)\//.test(path)) return route.fulfill({ contentType: 'application/gzip', body: gzipSync('{"id":42}\n') });
    if (path.endsWith('/async/requests')) return json(batches.length ? [{ requestId, section: 'RDS', kind: 'find-doc', createdAtUtc: '2026-11-11T10:00:00Z' }] : []);
    if (path.endsWith(`/async/status/${requestId}`)) return json({ requestId, status: 'SUCCESS', resultAvailable: true, errorsAvailable: true, errorMessage: null });
    return json({});
  });
  return { writes, queries, batches };
}

test('registry workspace saves a connection and checks documents in each registry', async ({ page }) => {
  const fixture = await fixtures(page);
  await page.goto('/#/registries?tab=connection');
  await page.getByLabel('API-ключ реестров', { exact: true }).fill('synthetic-registry-key');
  await page.getByRole('button', { name: 'Сохранить доступ к реестрам', exact: true }).click();
  await expect(page.getByLabel('Новый API-ключ реестров')).toHaveValue('');
  expect(fixture.writes[0]).toMatchObject({ apiKey: 'synthetic-registry-key', environment: 'Development', accessMode: 'SyncOnly', revision: null });
  await page.getByRole('tab', { name: 'Проверить документ', exact: true }).click();
  for (const [section, name] of [['rds', 'Декларации РФ'], ['rss', 'Сертификаты РФ'], ['reaeu', 'Документы ЕАЭС']]) {
    await page.getByRole('combobox', { name: /^Реестр документа/ }).click();
    await page.getByRole('option', { name, exact: true }).click();
    await page.getByLabel('Номер документа в реестре').fill(number);
    if (section === 'reaeu') await expect(page.getByLabel('ИНН заявителя (необязательно)')).toHaveCount(0);
    await page.getByRole('button', { name: 'Найти в реестре', exact: true }).click();
    await expect(page.getByText('Прекращён', { exact: true })).toBeVisible();
    expect(fixture.queries.at(-1)).toEqual({ numberDoc: number, section });
  }
  await page.screenshot({ path: '../artifacts/screenshots/registry-lookup.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('batch requests open results and support explicit subscription checks', async ({ page }) => {
  const fixture = await fixtures(page, 'Admin', 'Marketplace', true);
  await page.goto('/#/registries?tab=batch');
  await page.getByLabel('Документы, по одному в строке', { exact: true }).fill(`${number} | 2026-09-29 | 7706114267`);
  await page.getByRole('button', { name: 'Создать пакетный запрос', exact: true }).click();
  await expect(page.getByText('Готово', { exact: true })).toBeVisible();
  expect(fixture.batches[0]).toEqual({ items: [{ numberDoc: number, regDate: '2026-09-29', applicantInn: '7706114267' }] });
  await expect(page.getByRole('button', { name: 'Скачать ошибки JSONL.GZ', exact: true })).toBeEnabled();
  await page.getByRole('tab', { name: 'Проверить список', exact: true }).click();
  await page.getByRole('button', { name: /Проверить изменения статусов/ }).click();
  await page.getByRole('radio', { name: 'Подписка организации', exact: true }).check();
  await expect(page.getByLabel('ID документов, по одному в строке')).toHaveCount(0);
  await page.getByRole('button', { name: 'Создать пакетный запрос', exact: true }).click();
  await expect.poll(() => fixture.batches.length).toBe(2);
  expect(fixture.batches[1]).toEqual({ daysBack: 1 });
  await expect(page.getByText('Готово', { exact: true })).toBeVisible();
  await page.screenshot({ path: '../artifacts/screenshots/registry-history.png' });
});

test('reader sees operations and history while credential changes and batch writes are protected', async ({ page }) => {
  await fixtures(page, 'Viewer'); await page.goto('/#/registries');
  await expect(page.getByRole('button', { name: 'Найти в реестре', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Подключение', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Сохранить доступ к реестрам', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Новый API-ключ реестров')).toHaveCount(0);
  await expect(page.getByRole('combobox', { name: /^Контур реестров/ })).toBeDisabled();
  await page.getByRole('tab', { name: 'Проверить список', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Создать пакетный запрос', exact: true })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Запросы и результаты', exact: true }).click();
  await expect(page.getByText('Запросов пока нет', { exact: true })).toBeVisible();
});

test('PCP exports expose full and daily files for all three registries', async ({ page }) => {
  await fixtures(page, 'Admin', 'Pcp', true);
  await page.addInitScript(() => Object.defineProperty(window, 'showSaveFilePicker', { value: undefined, configurable: true }));
  await page.goto('/#/registries?tab=exports');
  await page.getByRole('button', { name: 'Получить список выгрузок', exact: true }).click();
  for (const kind of ['полную выгрузку', 'изменения']) {
    const buttons = page.getByRole('button', { name: `Скачать ${kind}`, exact: true });
    await expect(buttons).toHaveCount(3);
    for (let i = 0; i < 3; i++) {
      const download = page.waitForEvent('download'); await buttons.nth(i).click();
      expect((await download).suggestedFilename()).toMatch(/^(rss|rds|reaeu)-(full|delta-2026-11-11)\.jsonl\.gz$/);
    }
  }
  await page.screenshot({ path: '../artifacts/screenshots/registry-exports.png' });
});


test('daily status monitoring shows changes in the notification bell and marks only read state', async ({ page }) => {
  await fixtures(page, 'Admin', 'SyncOnly', true);
  let changed = false; let read = false; let checks = 0;
  const declarationId = '44444444-4444-4444-8444-000000000000';
  const watch = () => ({ declarationId, title: 'Декларация под наблюдением', registrationNumber: number, eligible: true, enabled: true, section: 'rds', regDate: null, revision: 'watch-1', checkedAtUtc: '2026-11-11T10:00:00Z', attemptedAtUtc: '2026-11-11T10:00:00Z', statusLabel: changed ? 'Приостановлен' : 'Действует', statusInRussiaLabel: '', registryUrl: '', lastError: '', sourceEnvironment: 'Production' });
  await page.route('**/registry-monitoring/**', async route => {
    const path = new URL(route.request().url()).pathname; const query = new URL(route.request().url()).searchParams;
    if (path.endsWith('/summary')) return route.fulfill({ json: { enabled: true, hour: 6, timeZoneId: 'Europe/Minsk', nextRunUtc: '2026-11-12T03:00:00Z', connectionConfigured: true, environment: 'Production', registeredDocuments: 1, checkedDocuments: 1, failedDocuments: 0 } });
    if (path.endsWith('/declarations')) return route.fulfill({ json: { items: [watch()], total: 1, page: 1, pageSize: 20 } });
    if (path.endsWith('/check')) { checks++; changed = true; return route.fulfill({ json: watch() }); }
    if (path.endsWith('/read-all') || path.endsWith('/read')) { read = true; return route.fulfill({ status: 204 }); }
    if (path.endsWith('/notifications')) return route.fulfill({ json: { items: changed && (!read || query.get('unreadOnly') !== 'true') ? [{ id: requestId, declarationId, title: 'Изменился статус декларации', message: `${number}: Действует → Приостановлен`, previousStatus: 'Действует', currentStatus: 'Приостановлен', occurredAtUtc: '2026-11-11T10:00:00Z', isRead: read }] : [], total: changed ? 1 : 0, unreadCount: changed && !read ? 1 : 0, page: 1, pageSize: 10 } });
    return route.fulfill({ json: watch() });
  });
  await page.goto('/#/registries?tab=monitoring');
  await expect(page.getByText('06:00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Проверить сейчас', exact: true }).click();
  await expect(page.getByText('Приостановлен', { exact: true })).toBeVisible(); expect(checks).toBe(1);
  const bell = page.getByRole('button', { name: 'Уведомления реестра: 1 непрочитанных', exact: true }); await expect(bell).toBeVisible(); await bell.click();
  const menu = page.getByRole('menu'); await expect(menu.getByText('Изменился статус декларации', { exact: true })).toBeVisible();
  await menu.getByRole('button', { name: 'Прочитать все', exact: true }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Уведомления реестра', exact: true })).toBeVisible();
  expect(read).toBe(true); expect(checks).toBe(1);
  await page.screenshot({ path: '../artifacts/screenshots/registry-monitoring.png' });
  await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
