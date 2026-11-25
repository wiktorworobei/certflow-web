import { test, expect, type Page } from '@playwright/test';
import { installCertificatePluginFixture } from './certificate-plugin-fixture';
import { readFile } from 'node:fs/promises';

const firmId = '11111111-1111-4111-8111-111111111111';
const thumbprint = 'A'.repeat(40);
const submissionId = '44444444-4444-4444-8444-444444444444';
const draft = { requestId: submissionId, categoryId: 100, gtin: '05011846021161', name: 'Масло моторное 5W-30, 4 л', brand: 'Тестовый бренд', tnved: '2710198200', productGroupCode: 43, sendToModeration: false, attributes: [], photoUrl: null };
export async function crptFixtures(page: Page, hasHonestSignSession = true) {
  if (hasHonestSignSession) await installCertificatePluginFixture(page);
  const firm = { id: firmId, name: 'Тестовая компания CRPT', role: 'Admin' };
  const auth = { accessToken: 'synthetic-crpt-token', expiresAt: '2099-01-01T00:00:00Z', user: { id: '22222222-2222-4222-8222-222222222222', userName: 'test', displayName: 'Тест CRPT', email: '', firms: [firm] } };
  const requests: string[] = []; const writes: unknown[] = [];
  await page.route('**/api/**', async route => {
    const req = route.request(), url = new URL(req.url()), path = url.pathname; requests.push(path);
    const json = (value: unknown) => route.fulfill({ json: value });
    if (path.startsWith('/api/auth/')) return json(auth);
    if (path.endsWith('/registry-monitoring/notifications')) return json({ items: [], total: 0, unreadCount: 0 });
    if (path.endsWith('/session')) return json({ isAuthenticated: true, hasHonestSignSession, certificateThumbprint: hasHonestSignSession ? thumbprint : null, honestSignSessionExpiresAtUtc: hasHonestSignSession ? '2099-01-01T00:00:00Z' : null });
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

test('CRPT finds a certificate when only the CryptoPro Manifest V3 extension is available', async ({ page }) => {
  await crptFixtures(page, false);
  const manifestV3Url = 'chrome-extension://pfhgbfnnjiafkhfdkmpiflachepdcjod/nmcades_plugin_api.js';
  await page.addInitScript(({ manifestV3Url }) => {
    const bridge = window as unknown as {
      cadesplugin?: { set(plugin: { CreateObjectAsync(name: string): Promise<unknown> }): void };
      cpcsp_chrome_nmcades?: { check_chrome_plugin(loaded: () => void): void };
    };
    const certificate = {
      HasPrivateKey: true,
      SubjectName: 'CN=Сертификат Manifest V3',
      IssuerName: 'CN=Тестовый УЦ',
      Thumbprint: 'A'.repeat(40),
      ValidFromDate: '2026-01-01',
      ValidToDate: '2099-01-01',
    };
    const certificates = { Count: 1, Find: async () => certificates, Item: async () => certificate };
    const appendChild = HTMLHeadElement.prototype.appendChild;

    // Intercept the extension resource only. ZNAQ still runs the real CryptoPro loader.
    HTMLHeadElement.prototype.appendChild = function <T extends Node>(this: HTMLHeadElement, node: T): T {
      if (!(node instanceof HTMLScriptElement) || !node.src.startsWith('chrome-extension://') || !node.src.endsWith('/nmcades_plugin_api.js')) {
        return appendChild.call(this, node) as T;
      }
      queueMicrotask(() => {
        if (node.src !== manifestV3Url) {
          node.dispatchEvent(new Event('error'));
          return;
        }
        bridge.cpcsp_chrome_nmcades = {
          check_chrome_plugin(loaded) {
            bridge.cadesplugin!.set({
              async CreateObjectAsync(name) {
                if (name !== 'CAdESCOM.Store') throw new Error(`Unexpected CryptoPro object: ${name}`);
                return { Certificates: certificates, Open: async () => {}, Close: async () => {} };
              },
            });
            loaded();
          },
        };
        function respondToEcho(event: MessageEvent) {
          if (event.source !== window || event.data !== 'cadesplugin_echo_request') return;
          window.removeEventListener('message', respondToEcho);
          window.postMessage('cadesplugin_loaded', location.origin);
        }
        window.addEventListener('message', respondToEcho);
        node.dispatchEvent(new Event('load'));
      });
      return node;
    };
  }, { manifestV3Url });

  await page.goto('/#/crpt');
  await expect(page.getByText('Подключение к Честному знаку', { exact: true })).toBeVisible();
  const certificate = page.getByRole('combobox', { name: 'Сертификат', exact: true });
  await expect(certificate.getByRole('option', { name: /Сертификат Manifest V3/ })).toHaveAttribute('value', thumbprint);
  await certificate.selectOption(thumbprint);
  await expect(page.getByRole('button', { name: 'Войти по сертификату', exact: true })).toBeEnabled();
});

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

test('CRPT shows readable rejection reasons and checks the card directly in the submission journal', async ({ page }) => {
  const fixture = await crptFixtures(page);
  const feedId = '24098';
  const createdAtUtc = '2026-11-17T12:00:00Z';
  const checks: { url: URL; method: string }[] = [];
  await page.route('**/catalog/gtins/check?*', route => {
    checks.push({ url: new URL(route.request().url()), method: route.request().method() });
    return route.fulfill({ json: { gtin: draft.gtin, state: 'Found', cards: [{ name: 'Тестовая карточка НК', status: 'moderation' }] } });
  });
  await page.route('**/catalog/submissions?*', route => route.fulfill({ json: {
    items: [{
      id: submissionId, gtin: draft.gtin, state: 'Rejected', feedId, sendToModeration: false, createdAtUtc,
      latestFeedStatus: {
        submissionId, feedId, submissionState: 'Rejected', status: 'Rejected', providerStatus: 'Rejected',
        providerStatusId: 0, upstreamHttpStatus: 200, receivedAtUtc: createdAtUtc, updatedAtUtc: createdAtUtc,
        errors: [
          { gtin: draft.gtin, attributeId: 3961, code: '81', message: 'Не заполнено значение обязательного параметра Код ОКПД2 для кода товара [скрыто].' },
          { gtin: draft.gtin, attributeId: null, code: '157', entryId: 0, source: 'error_details.items', message: 'Карточка товара [скрыто] находится на модерации и недоступна для редактирования. Воспользуйтесь методом feed-product для её поиска.' },
        ],
      },
    }],
    hasNextPage: false,
  } }));

  await page.goto('/#/crpt');
  await page.getByRole('tab', { name: 'Журнал операций', exact: true }).click();
  const entry = page.getByRole('row').filter({ hasText: feedId });
  await expect(entry.getByText('Запрос отклонён НК', { exact: true })).toBeVisible();
  await expect(entry.getByText('Укажите код ОКПД2 в карточке товара.', { exact: true })).toBeVisible();
  await expect(entry.getByText('НК отклонил изменения, потому что карточка уже была на модерации.', { exact: true })).toBeVisible();
  await expect(entry).not.toContainText(/feed-product|status_id|HTTP 200|error_details|entry 0|Код НК|скрыто/);
  expect(checks).toHaveLength(0);
  await entry.getByRole('button', { name: 'Проверить карточку в НК', exact: true }).click();
  await expect(entry.getByText('Тестовая карточка НК · На модерации', { exact: true })).toBeVisible();
  expect(checks).toHaveLength(1);
  expect(checks[0].method).toBe('GET');
  expect(checks[0].url.pathname).toBe(`/api/firms/${firmId}/crpt/sandbox/honest-sign/catalog/gtins/check`);
  expect(checks[0].url.searchParams.get('gtin')).toBe(draft.gtin);
  expect(checks[0].url.searchParams.get('submissionId')).toBe(submissionId);
  expect(fixture.requests.some(path => path.endsWith(`/catalog/submissions/${submissionId}/status`))).toBe(false);
  expect(fixture.writes).toHaveLength(0);
});

test('CRPT checks a newly entered valid GTIN and prevents a duplicate send', async ({ page }) => {
  const fixture = await crptFixtures(page);
  const checks: string[] = [];
  await page.route('**/catalog/gtins/check?*', route => {
    const gtin = new URL(route.request().url()).searchParams.get('gtin')!;
    checks.push(gtin);
    return route.fulfill({ json: { gtin, state: 'Found', cards: [{ name: 'Существующая карточка', status: 'notsigned' }] } });
  });

  await page.goto('/#/crpt');
  await page.getByRole('button', { name: 'Создать новую позицию', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Новая карточка товара', exact: true });
  const gtinInput = editor.getByLabel('GTIN *', { exact: true });
  await editor.getByLabel('Товарная группа *', { exact: true }).selectOption('43');
  await editor.locator('#catalog-tnved').fill(draft.tnved);
  await editor.getByRole('button', { name: 'Подобрать категории', exact: true }).click();
  await editor.locator('#catalog-category').selectOption('100');
  await editor.locator('#catalog-name').fill(draft.name);
  await editor.locator('#catalog-brand').fill(draft.brand);
  await gtinInput.fill('05011846021160');
  await expect(editor.getByText('Неверная контрольная цифра GTIN.', { exact: true })).toBeVisible();
  expect(checks).toHaveLength(0);
  await gtinInput.fill(draft.gtin);
  await expect(editor.getByText('Существующая карточка · Ожидает подписания', { exact: true })).toBeVisible();
  await expect(editor.getByText(/GTIN уже зарегистрирован в Национальном каталоге/)).toBeVisible();
  await expect(editor.getByRole('button', { name: 'Создать черновик в НК', exact: true })).toBeDisabled();
  expect(checks).toEqual([draft.gtin]);
  expect(fixture.writes).toHaveLength(0);
});

test('CRPT retries a rejected submission from the event journal after editing the card', async ({ page }) => {
  const fixture = await crptFixtures(page);
  const createdAtUtc = '2026-11-17T12:00:00Z';
  const firstFeedId = '24098';
  const newFeedId = '24099';
  const unknownGtin = '04006381333931';
  const correctedGtin = '00012345600012';
  const correctedName = 'Масло моторное 5W-30, 1 л';
  const savedWrites: string[] = [];
  let sent = false;
  let savedDraft: typeof draft | undefined;
  const receipt = {
    id: submissionId, gtin: draft.gtin, state: 'Rejected', feedId: firstFeedId,
    sendToModeration: false, createdAtUtc,
  };
  const status = {
    submissionId, feedId: firstFeedId, submissionState: 'Rejected', status: 'Moderated',
    receivedAtUtc: createdAtUtc, updatedAtUtc: createdAtUtc,
    errors: [{ gtin: draft.gtin, code: 'invalid', message: 'Проверьте наименование товара.' }],
  };
  const sentReceipt = { ...receipt, gtin: correctedGtin, state: 'Accepted', feedId: newFeedId };

  await page.route('**/honest-sign/events?*', route => route.fulfill({ json: { items: [], hasNextPage: false } }));
  await page.route('**/catalog/submissions?*', route => route.fulfill({
    json: {
      items: [
        sent ? sentReceipt : { ...receipt, latestFeedStatus: status },
        { ...receipt, id: '99999999-9999-4999-8999-999999999999', gtin: unknownGtin, state: 'Unknown', feedId: null },
      ],
      hasNextPage: false,
    },
  }));
  await page.route('**/catalog/submissions/*/attempts?*', route => route.fulfill({
    json: { items: [{ ...receipt, requestId: submissionId, operation: 'Create', feedStatus: status }], hasNextPage: false },
  }));
  await page.route('**/catalog/submissions/*/status', route => route.fulfill({
    json: sent ? { ...status, feedId: newFeedId, submissionState: 'Accepted', errors: [] } : status,
  }));
  await page.route('**/catalog/submissions/*/card', route => route.fulfill({
    json: {
      submissionId, goodId: sent ? 43 : 0, gtin: sent ? correctedGtin : draft.gtin,
      status: sent ? 'draft' : 'errors', detailedStatuses: [], isSigned: false,
      canEdit: true, canSign: false, canModerate: false, canOrderCodes: false,
      canIntroduce: false, draft: savedDraft ?? draft, blockingOperation: null,
    },
  }));
  await page.route('**/catalog/submissions/*/draft', route => {
    const request = route.request();
    savedWrites.push(request.method());
    savedDraft = request.postDataJSON();
    return route.fulfill({ json: { ...receipt, gtin: correctedGtin, state: 'Draft', feedId: null, draftVersion: submissionId } });
  });
  await page.route('**/catalog/submissions/*/send?*', route => {
    const request = route.request();
    savedWrites.push(request.method());
    expect(new URL(request.url()).searchParams.get('expectedVersion')).toBe(submissionId);
    sent = true;
    return route.fulfill({ json: sentReceipt });
  });

  await page.goto('/#/crpt?environment=sandbox&view=journal');
  await page.getByRole('tab', { name: 'Карточки товаров', exact: true }).click();
  const history = page.getByRole('region', { name: 'Черновики и отправки в НК', exact: true });
  const unknownEntry = history.getByRole('row').filter({ hasText: unknownGtin });
  await expect(unknownEntry).toContainText('Исход неизвестен');
  await expect(unknownEntry.getByRole('button', { name: 'Отправить повторно', exact: true })).toHaveCount(0);
  await history.getByRole('row').filter({ hasText: firstFeedId })
    .getByRole('button', { name: 'Отправить повторно', exact: true }).click();

  const editor = page.getByRole('dialog', { name: 'Карточка товара', exact: true });
  const gtinInput = editor.getByLabel('GTIN *', { exact: true });
  const nameInput = editor.getByLabel('Полное наименование товара *', { exact: true });
  await expect(gtinInput).toHaveValue(draft.gtin);
  await expect(nameInput).toHaveValue(draft.name);
  await expect(editor.getByLabel('Категория НК *', { exact: true })).toBeEnabled();
  expect(savedWrites).toEqual([]);
  expect(fixture.writes).toEqual([]);

  await gtinInput.fill(correctedGtin);
  await nameInput.fill(correctedName);
  await editor.getByRole('button', { name: 'Отправить в НК повторно', exact: true }).click();
  await expect(editor.getByRole('region', { name: 'Ответ заявки НК', exact: true })).toContainText(newFeedId);
  expect(savedDraft).toMatchObject({ gtin: correctedGtin, name: correctedName, sendToModeration: false });
  expect(savedWrites).toEqual(['PUT', 'POST']);
  await expect(editor.getByRole('region', { name: 'История попыток отправки' })).toContainText('Проверьте наименование товара.');
});
