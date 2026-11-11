import { test, expect, chromium, type Page } from '@playwright/test';
import { cp, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fgisPayload, type FgisField, type FgisPayload, type FgisTransferResult } from '../src/fgisTransfer';
import { emptyDeclaration, type Declaration } from '../src/types';
import { printLayoutFixture } from './declaration-builder-helpers';

const extension = path.resolve('../browser-extensions/fgis');
const id = '11111111-1111-4111-8111-111111111111';
function documentFixture(): Declaration {
  const empty = emptyDeclaration();
  return { ...empty, id, reference: 'ZQ-26-123', title: 'Перенос тестовой декларации', revision: 3, status: 'Draft',
    applicant: { ...empty.applicant, name: 'ООО Заявитель', inn: '7701234567' }, manufacturer: { ...empty.manufacturer, name: 'Завод', inn: '7709876543' },
    product: { ...empty.product, name: 'Тестовая продукция' }, adoptedAt: '2026-11-10', validUntil: '2027-11-10',
    registrationNumber: '', registryUrl: '', createdAt: '2026-11-10T00:00:00Z', updatedAt: '2026-11-10T00:00:00Z', attachments: [], events: [], missingRequirements: [], isSample: false };
}
function field(key: string, label: string, value: string, group = 'Декларация', kind: FgisField['kind'] = 'text'): FgisField { return { key, label, value, group, kind, aliases: [] }; }
function payload(fields: FgisField[]): FgisPayload { return { version: 1, declarationId: id, revision: 3, reference: 'ZQ-26-123', createdAt: new Date().toISOString(), fields }; }
async function adapter(page: Page, html: string) {
  await page.setContent(html);
  await page.addScriptTag({ path: path.join(extension, 'form.js') });
}
async function fill(page: Page, data: FgisPayload, bindings: Record<string, unknown> = {}): Promise<FgisTransferResult> {
  return page.evaluate(({ data, bindings }) => (globalThis as any).ZnaqFgisForm.fill(data, bindings), { data, bindings });
}
async function appFixture(page: Page, document = documentFixture(), role = 'Admin') {
  const firm = { id, name: 'Тестовая компания', inn: '', role };
  const auth = { accessToken: 'fixture-only-token', expiresAt: '2099-01-01T00:00:00Z', user: { id, userName: 'Tester', displayName: 'Тест', email: '', firms: [firm] } };
  let gets = 0; const writes: string[] = [];
  await page.route('**/api/**', async route => {
    const request = route.request(); const url = new URL(request.url()); const p = url.pathname.replace(/\/$/, '');
    if (request.method() !== 'GET') writes.push(p);
    if (p === '/api/auth/refresh') return route.fulfill({ json: auth });
    if (p.endsWith('/declarations/preview')) return route.fulfill({ json: printLayoutFixture(request.postDataJSON()) });
    if (p.endsWith(`/declarations/${id}`)) { gets++; return route.fulfill({ json: document }); }
    if (p.endsWith('/fgis')) return route.fulfill({ json: { revision: 3, missingRequirements: [], preparationIsCurrent: false, selectedFiles: 0 } });
    if (p.endsWith('/print-fields')) return route.fulfill({ json: [] });
    if (p.endsWith('/dadata')) return route.fulfill({ json: { enabled: false, isConfigured: false, source: 'None' } });
    if (p.includes('/document-fonts/')) return route.fulfill({ status: 204 });
    return route.fulfill({ json: [] });
  });
  await page.goto(`http://127.0.0.1:5176/#/declarations/${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(document.title);
  return { gets: () => gets, writes, document };
}

test('payload carries structured data without credentials or registration and keeps repeatable reports separate', () => {
  const document = documentFixture(); document.registrationNumber = 'PRIVATE-REGISTRATION'; document.registryUrl = 'https://example.invalid/private';
  document.workspace = { sections: {}, files: [], printOverrides: { 'Заявитель': 'Ручной текст' } };
  document.reports = [{ number: 'П-1', date: '2026-11-01', laboratoryName: 'Лаборатория', accreditationNumber: 'RA.1' }, { number: 'П-2', date: null, laboratoryName: '', accreditationNumber: '' }];
  const data = fgisPayload(document);
  expect(data.fields.find(f => f.key === 'applicant.name')?.value).toBe('ООО Заявитель');
  expect(data.fields.find(f => f.key === 'reports.1.number')?.value).toBe('П-2');
  expect(JSON.stringify(data)).not.toMatch(/PRIVATE-REGISTRATION|example.invalid|Ручной текст|accessToken/);
});

test('fills scoped party fields and dates, emits input changes and repeats without duplicate writes', async ({ page }) => {
  await adapter(page, `<form onsubmit="window.submitted=true;return false"><fieldset><legend>Заявитель</legend><label>ИНН<input id="a"></label></fieldset><fieldset><legend>Изготовитель</legend><label>ИНН<input id="m"></label></fieldset><label>Дата принятия декларации<input type="date" id="date"></label><button>Подписать и зарегистрировать</button></form>`);
  await page.evaluate(() => { (window as any).changes = 0; document.addEventListener('input', () => (window as any).changes++); });
  const data = payload([field('applicant.inn', 'ИНН', '7701234567', 'Заявитель'), field('manufacturer.inn', 'ИНН', '7709876543', 'Изготовитель'), field('adoptedAt', 'Дата принятия декларации', '2026-11-10', 'Декларация', 'date')]);
  expect((await fill(page, data)).fields.map(f => f.status)).toEqual(['filled', 'filled', 'filled']);
  await expect(page.locator('#a')).toHaveValue('7701234567'); await expect(page.locator('#m')).toHaveValue('7709876543'); await expect(page.locator('#date')).toHaveValue('2026-11-10');
  expect((await fill(page, data)).fields.every(f => f.status === 'unchanged')).toBe(true);
  expect(await page.evaluate(() => ({ changes: (window as any).changes, submitted: !!(window as any).submitted }))).toEqual({ changes: 3, submitted: false });
});

test('preserves existing values, skips hidden and disabled fields and prevents ambiguous report matches', async ({ page }) => {
  await adapter(page, `<label>Наименование продукции<input value="Существующее"></label><fieldset disabled><label>Дополнительная информация<textarea></textarea></label></fieldset><div hidden><label>GTIN<input></label></div><label>Номер протокола<input id="report"></label>`);
  const data = payload([field('product.name', 'Наименование продукции', 'Новое'), field('additionalInfo', 'Дополнительная информация', 'Текст'), field('product.gtin', 'GTIN', '123'), field('reports.0.number', 'Номер протокола', '1', 'Протокол 1'), field('reports.1.number', 'Номер протокола', '2', 'Протокол 2')]);
  expect((await fill(page, data)).fields.map(f => f.status)).toEqual(['conflict', 'missing', 'missing', 'manual', 'manual']);
  await expect(page.locator('#report')).toHaveValue(''); await expect(page.locator('input').first()).toHaveValue('Существующее');
});

test('selects only exact dictionary options, leaves autocomplete selection to the user and checks reactive rejection', async ({ page }) => {
  await adapter(page, `<label>Схема декларирования<select><option value="">Выберите</option><option value="1">1д</option></select></label><label>Код ТН ВЭД<input role="combobox"></label><label>Дополнительная информация<input id="reactive"></label><label>Код ОКПД 2<select><option value="">Выберите</option><option>Другой код</option></select></label>`);
  await page.locator('#reactive').evaluate(element => element.addEventListener('input', () => { (element as HTMLInputElement).value = ''; }));
  const data = payload([field('scheme', 'Схема декларирования', '1д', '', 'choice'), field('product.tnVed', 'Код ТН ВЭД', '1234567890', '', 'choice'), field('additionalInfo', 'Дополнительная информация', 'Текст'), field('product.okpd2', 'Код ОКПД 2', '12.34', '', 'choice')]);
  expect((await fill(page, data)).fields.map(f => f.status)).toEqual(['filled', 'manual', 'error', 'manual']);
  await expect(page.locator('select').first()).toHaveValue('1'); await expect(page.getByRole('combobox').nth(1)).toHaveValue('');
});

test('manual field bindings validate labels and cannot silently move to another section', async ({ page }) => {
  await adapter(page, '<fieldset><legend>Заявитель</legend><label>Нестандартное название<input id="custom"></label></fieldset>');
  const binding = await page.locator('#custom').evaluate(element => (globalThis as any).ZnaqFgisForm.bind(element));
  const data = payload([field('applicant.inn', 'ИНН', '7701234567', 'Заявитель')]);
  expect((await fill(page, data)).fields[0].status).toBe('missing');
  expect((await fill(page, data, { 'applicant.inn': binding })).fields[0].status).toBe('filled');
  await page.locator('legend').evaluate(element => { element.textContent = 'Изготовитель'; });
  expect((await fill(page, data, { 'applicant.inn': binding })).fields[0].status).toBe('missing');
});

test('protocol rejects stale declarations, duplicate and unauthorized fields', async ({ page }) => {
  await page.addScriptTag({ path: path.join(extension, 'protocol.js') });
  const valid = payload([field('product.name', 'Наименование продукции', 'Тест')]);
  const validate = (data: unknown) => page.evaluate(data => { try { (globalThis as any).ZnaqFgisProtocol.validatePayload(data); return 'ok'; } catch { return 'rejected'; } }, data);
  expect(await validate(valid)).toBe('ok'); expect(await validate({ ...valid, createdAt: '2020-01-01' })).toBe('rejected');
  expect(await validate({ ...valid, fields: [...valid.fields, valid.fields[0]] })).toBe('rejected');
  expect(await validate({ ...valid, fields: [field('password', 'Пароль', 'secret')] })).toBe('rejected');
});

test('button explains installation, downloads a ZIP and blocks unsaved or protected documents', async ({ page }) => {
  await appFixture(page);
  await page.getByRole('button', { name: 'Перенести в ФГИС', exact: true }).first().click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('alert').filter({ hasText: 'Расширение не подключено' })).toBeVisible();
  await expect(dialog).toContainText('Яндекс Браузере'); await expect(dialog.getByRole('button', { name: 'Заполнить открытый раздел' })).toBeDisabled();
  const archive = await page.request.get('/fgis-extension.zip'); expect(archive.ok()).toBe(true); expect((await archive.body()).subarray(0, 4).toString('hex')).toBe('504b0304');
  await page.screenshot({ path: path.resolve('../artifacts/fgis-qa/install.png') });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: path.resolve('../artifacts/fgis-qa/install-mobile.png') });
  await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await page.getByRole('textbox', { name: 'Название декларации', exact: true }).fill('Несохранённое изменение');
  await expect(page.getByRole('button', { name: 'Перенести в ФГИС', exact: true }).first()).toBeDisabled();
});

test('requires an explicit tab selection and refuses a stale declaration before sending its data', async ({ page }) => {
  const fixture = await appFixture(page); let fills = 0;
  await page.exposeFunction('recordFgisFill', () => { fills++; });
  await page.evaluate(() => {
    window.addEventListener('message', event => {
      if (event.data?.channel !== 'znaq-fgis-request') return;
      const data = event.data;
      if (data.action === 'fill') (window as any).recordFgisFill();
      window.postMessage({ channel: 'znaq-fgis-response', requestId: data.requestId, response: { version: 1, tabs: [{ id: 10, title: 'Кабинет 1' }, { id: 11, title: 'Кабинет 2' }] } }, location.origin);
    });
  });
  await page.getByRole('button', { name: 'Перенести в ФГИС', exact: true }).first().click();
  const dialog = page.getByRole('dialog'); const button = dialog.getByRole('button', { name: 'Заполнить открытый раздел' });
  await expect(button).toBeDisabled(); await dialog.getByRole('combobox', { name: 'Вкладка кабинета ФГИС' }).click();
  await page.getByRole('option', { name: 'Кабинет 2 · вкладка 11' }).click(); await expect(button).toBeEnabled();
  fixture.document.revision = 4; await button.click();
  await expect(dialog).toContainText('Декларация изменилась.'); expect(fills).toBe(0);
});

for (const fixture of [{ role: 'Viewer', status: 'Draft' }, { role: 'Admin', status: 'Registered' }, { role: 'Admin', status: 'Archived' }]) {
  test(`transfer is unavailable for ${fixture.role}/${fixture.status}`, async ({ page }) => {
    const document = documentFixture(); document.status = fixture.status as Declaration['status'];
    await appFixture(page, document, fixture.role);
    await expect(page.getByRole('button', { name: 'Перенести в ФГИС', exact: true }).first()).toBeDisabled();
  });
}

test('real extension connects the app to an existing tab, fills a draft and rejects an unpaired source', async () => {
  test.setTimeout(90000);
  const folder = await mkdtemp(path.join(tmpdir(), 'znaq-fgis-test-')); const copy = path.join(folder, 'extension'); await cp(extension, copy, { recursive: true });
  const manifest = JSON.parse(await readFile(path.join(copy, 'manifest.json'), 'utf8'));
  // Pre-grant only the local fixture host; production asks for this via the popup user gesture.
  manifest.host_permissions.push('http://127.0.0.1/*'); await writeFile(path.join(copy, 'manifest.json'), JSON.stringify(manifest));
  // Windows uses the installed target browser; CI/Linux uses bundled Chromium.
  const channel = process.env.FGIS_TEST_BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : 'chromium');
  const context = await chromium.launchPersistentContext(path.join(folder, 'profile'), { channel, headless: true, viewport: { width: 1440, height: 1050 }, ignoreDefaultArgs: ['--disable-extensions'],
    args: channel === 'chromium' ? [`--disable-extensions-except=${copy}`, `--load-extension=${copy}`] : ['--enable-unsafe-extension-debugging'] });
  try {
    if (channel !== 'chromium') {
      const cdp = await context.browser()!.newBrowserCDPSession();
      await cdp.send('Extensions.loadUnpacked', { path: copy }); await cdp.detach();
    }
    const worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
    // No request reaches the real registry; the target is an explicit HTML fixture.
    const html = '<!doctype html><html lang="ru"><head><meta charset="utf-8"><title>Черновик декларации — тест</title></head><body><form onsubmit="window.submitted=true;return false"><label>Наименование продукции<textarea id="product"></textarea></label><button type="submit">Подписать и зарегистрировать</button></form></body></html>';
    await context.route('https://srd.fsa.gov.ru/**', route => route.fulfill({ contentType: 'text/html', body: html }));
    const target = await context.newPage(); await target.goto('https://srd.fsa.gov.ru/srd/draft/test');
    const source = await context.newPage(); const fixture = await appFixture(source);
    await worker.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      await chrome.storage.local.set({ appOrigins: ['http://127.0.0.1:5176'] });
      await chrome.scripting.registerContentScripts([{ id: 'test-source', matches: ['http://127.0.0.1/*'], js: ['bridge.js'], runAt: 'document_idle' }]);
      const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      await chrome.scripting.executeScript({ target: { tabId: tabs[0].id }, files: ['bridge.js'] });
    });
    await source.getByRole('button', { name: 'Перенести в ФГИС', exact: true }).first().click();
    const dialog = source.getByRole('dialog'); const fillButton = dialog.getByRole('button', { name: 'Заполнить открытый раздел', exact: true });
    await expect(fillButton).toBeEnabled(); await fillButton.click();
    await expect(dialog).toContainText('Заполнено: 1.'); await expect(target.locator('#product')).toHaveValue('Тестовая продукция');
    expect(fixture.gets()).toBeGreaterThanOrEqual(2); expect(fixture.writes.some(url => /fgis\/send|\/status$/.test(url))).toBe(false);
    expect(await target.evaluate(() => !!(window as any).submitted)).toBe(false);
    await fillButton.click(); await expect(dialog).toContainText('Уже совпадало: 1.');
    await source.screenshot({ path: path.resolve('../artifacts/fgis-qa/transferred.png') });
    // A same-host sibling on another port must not inherit the paired origin's access.
    await context.route('http://127.0.0.1:5177/**', route => route.fulfill({ body: '<!doctype html><title>Unpaired source</title>' }));
    const unpaired = await context.newPage(); await unpaired.goto('http://127.0.0.1:5177/');
    const denied = await unpaired.evaluate(() => new Promise<string>(resolve => {
      window.addEventListener('message', event => { if (event.data?.channel === 'znaq-fgis-response') resolve(event.data.error); });
      window.postMessage({ channel: 'znaq-fgis-request', action: 'status', requestId: 'unpaired-test' }, location.origin);
    }));
    expect(denied).toContain('Подключите эту вкладку ZNAQ');
    await worker.evaluate(async () => { await (globalThis as any).chrome.storage.local.set({ appOrigins: [] }); });
    await dialog.getByRole('button', { name: 'Обновить список вкладок', exact: true }).click();
    await expect(dialog).toContainText('Подключите эту вкладку ZNAQ через значок расширения.');
  } finally { await context.close(); }
});
