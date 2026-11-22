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
    if (p.endsWith('/fgis/draft') && request.method() === 'PUT') {
      const { revision, documentId, assignedNumber } = request.postDataJSON();
      if (revision !== document.revision) return route.fulfill({ status: 409, json: { detail: 'Декларация изменилась.' } });
      const workspace = document.workspace ??= { sections: {}, files: [] };
      workspace.fgisDraft = {
        documentId, assignedNumber, recordedAtUtc: '2026-11-20T00:00:00Z', recordedBy: 'Tester',
        cabinetUrl: `https://srd.fsa.gov.ru/srd/view/${documentId}/srd/common`,
        registryUrl: `https://pub.fsa.gov.ru/rds/declaration/view/${documentId}/common`,
      };
      document.revision += 1;
      return route.fulfill({ json: document });
    }
    if (p.endsWith('/fgis')) return route.fulfill({ json: { revision: 3, missingRequirements: [], preparationIsCurrent: false, selectedFiles: 0 } });
    if (p.endsWith('/print-fields')) return route.fulfill({ json: [] });
    if (p.endsWith('/dadata')) return route.fulfill({ json: { enabled: false, isConfigured: false, source: 'None' } });
    if (p.includes('/document-fonts/')) return route.fulfill({ status: 204 });
    return route.fulfill({ json: [] });
  });
  await page.goto(`/#/declarations/${id}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(document.title, { timeout: 30_000 });
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

test('records the FGIS draft and copies both links without changing local registration', async ({ page }) => {
  test.setTimeout(120_000);
  const { document, writes } = await appFixture(page);
  await page.getByRole('tab', { name: /^Публикация/ }).click();
  await page.getByRole('button', { name: 'Указать черновик ФГИС' }).click();
  const dialog = page.getByRole('dialog', { name: 'Сведения о черновике ФГИС' });
  const save = dialog.getByRole('button', { name: 'Сохранить сведения' });
  await dialog.getByLabel('ФГИС ID документа').fill('внешняя ссылка');
  await expect(save).toBeDisabled();
  await dialog.getByLabel('ФГИС ID документа').fill('12345678');
  await dialog.getByLabel('Номер, присвоенный в ФГИС').fill('ТЕСТ-1');
  await save.click();
  await expect(page.getByRole('link', { name: 'Открыть черновик' })).toHaveAttribute('href', 'https://srd.fsa.gov.ru/srd/view/12345678/srd/common', { timeout: 20_000 });
  await expect(page.getByRole('link', { name: 'Открыть карточку реестра' })).toHaveAttribute('href', 'https://pub.fsa.gov.ru/rds/declaration/view/12345678/common');
  await page.evaluate(() => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
      writeText: async (value: string) => sessionStorage.setItem('copied-draft', value),
    } });
  });
  await page.getByRole('button', { name: 'Скопировать сведения' }).click();
  await expect.poll(() => page.evaluate(() => sessionStorage.getItem('copied-draft'))).toContain('Номер, присвоенный в ФГИС: ТЕСТ-1');
  expect(document.status).toBe('Draft');
  expect(document.registrationNumber).toBe('');
  expect(writes.filter(path => path.includes('/fgis/'))).toEqual([`/api/firms/${id}/declarations/${id}/fgis/draft`]);
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

test('fills all TN VED codes in a native multi-select and leaves a single-value field for manual entry', async ({ page }) => {
  const data = payload([field('product.tnVed', 'Код ТН ВЭД ЕАЭС', '6202, 6201', 'Продукция', 'choice')]);
  await adapter(page, '<label>Код ТН ВЭД ЕАЭС<select id="codes" multiple><option>6201</option><option>6202</option></select></label>');
  expect((await fill(page, data)).fields[0]?.status).toBe('filled');
  await expect(page.locator('#codes')).toHaveValues(['6201', '6202']);
  expect((await fill(page, data)).fields[0]?.status).toBe('unchanged');
  await adapter(page, '<label>Код ТН ВЭД ЕАЭС<input id="code"></label>');
  expect((await fill(page, data)).fields[0]?.status).toBe('manual');
  await expect(page.locator('#code')).toHaveValue('');
});

test('transfers only current EAEU groups through exact native multi-select matches', async ({ page }) => {
  const document = documentFixture();
  document.regulations = ['ТР ТС 017/2011'];
  document.workspace = { sections: {}, files: [], productGroups: [
    { regulation: 'ТР ТС 017/2011', code: '017.002.08', name: 'Изделия костюмные' },
    { regulation: 'ТР ТС 017/2011', code: '017.002.09', name: 'Изделия плательные' },
    { regulation: 'ТР ТС 007/2011', code: '', name: 'Устаревшая группа' },
  ] };
  expect(fgisPayload(document).fields.some(item => item.key === 'product.eaeuGroups')).toBe(false);
  const groups = fgisPayload(document, true).fields.find(item => item.key === 'product.eaeuGroups')!;
  expect(groups.value).toBe('Изделия костюмные\nИзделия плательные');
  const data = payload([groups]);
  await adapter(page, '<label>Группа продукции ЕАЭС<select id="groups" multiple><option value="8">Изделия костюмные</option><option value="9">Изделия плательные</option></select></label>');
  expect((await fill(page, data)).fields[0]?.status).toBe('filled');
  await expect(page.locator('#groups')).toHaveValues(['8', '9']);
  await adapter(page, '<label>Группа продукции ЕАЭС<input id="groups"></label>');
  expect((await fill(page, data)).fields[0]?.status).toBe('manual');
  await expect(page.locator('#groups')).toHaveValue('');
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

test('only a published SRD card for the matching applicant can prefill registration', async ({ page }) => {
  const document = documentFixture();
  document.status = 'Ready';
  const fixture = await appFixture(page, document);
  const registrationNumber = 'ЕАЭС N RU Д-DE.PA10.B.12345/26';
  await page.evaluate(({ registrationNumber, applicantInn }) => {
    const cards = [
      { status: 'Черновик', applicantInn },
      { status: 'Действует', applicantInn: '7700000002' },
      { status: 'Действует', applicantInn },
    ];
    window.addEventListener('message', event => {
      const data = event.data;
      if (data?.channel !== 'znaq-fgis-request') return;
      const response = data.action === 'status' ? { tabs: [{ id: 10, title: 'Кабинет ФГИС' }] }
        : { inspection: { page: 'view', documentId: '12345678', registrationNumber, ...cards.shift() } };
      window.postMessage({ channel: 'znaq-fgis-response', requestId: data.requestId, response: { version: 1, ...response } }, location.origin);
    });
  }, { registrationNumber, applicantInn: document.applicant.inn });

  await page.getByRole('button', { name: 'Перенести в ФГИС', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: /^Перенести в ФГИС/ });
  const inspect = dialog.getByRole('button', { name: 'Проверить карточку ФГИС' });
  const recordRegistration = dialog.getByRole('button', { name: 'Учесть регистрацию', exact: true });
  await inspect.click();
  await expect(dialog).toContainText('Статус в ФГИС: Черновик');
  await expect(dialog).toContainText('Присвоенный номер у черновика не подтверждает регистрацию');
  await expect(dialog.getByRole('link', { name: 'Открыть карточку в ФГИС' })).toHaveAttribute('href', 'https://srd.fsa.gov.ru/srd/view/12345678');
  await expect(dialog.getByRole('button', { name: 'Связать черновик с декларацией' })).toBeEnabled();
  expect(fixture.writes.some(url => url.endsWith('/fgis/draft'))).toBe(false);
  await expect(recordRegistration).toHaveCount(0);

  await inspect.click();
  await expect(dialog).toContainText('Статус в ФГИС: Действует');
  await expect(dialog.getByRole('alert').filter({ hasText: /ИНН.*отличается|ИНН.*не совпадает/ })).toBeVisible();
  await expect(recordRegistration).toHaveCount(0);

  await inspect.click();
  await recordRegistration.click();
  const statusDialog = page.getByRole('dialog', { name: 'Учесть регистрацию документа' });
  await expect(statusDialog.getByLabel('Регистрационный номер')).toHaveValue(registrationNumber);
  expect(fixture.writes.some(url => /fgis\/send|\/status$/.test(url))).toBe(false);
});

test('publication shows the payments portal and the applicant identity', async ({ page }) => {
  const { document } = await appFixture(page);
  await page.getByRole('tab', { name: /^Публикация/ }).click();
  const panel = page.getByRole('heading', { name: 'Оплата регистрации декларации' }).locator('..');
  await expect(panel).toContainText(document.applicant.name);
  await expect(panel).toContainText(`ИНН ${document.applicant.inn}`);
  await expect(panel).toContainText(/Создать сч[её]т/);
  await expect(panel.getByRole('link', { name: 'Открыть кабинет «Платежи»' })).toHaveAttribute('href', 'https://pay.niakk.ru/');
});

test('a saved SRD draft ID rejects another declaration from the same applicant', async ({ page }) => {
  const document = documentFixture();
  document.status = 'Ready';
  document.workspace = { sections: {}, files: [], fgisDraft: { applicationId: '', documentId: '12345678', assignedNumber: '' } };
  await appFixture(page, document);
  await page.evaluate(applicantInn => {
    window.addEventListener('message', event => {
      const data = event.data;
      if (data?.channel !== 'znaq-fgis-request') return;
      const response = data.action === 'status' ? { tabs: [{ id: 10, title: 'Кабинет ФГИС' }] }
        : { inspection: { page: 'view', documentId: '12345679', registrationNumber: 'ЕАЭС N RU Д-DE.PA10.B.12345/26', status: 'Действует', applicantInn } };
      window.postMessage({ channel: 'znaq-fgis-response', requestId: data.requestId, response: { version: 1, ...response } }, location.origin);
    });
  }, document.applicant.inn);
  await page.getByRole('button', { name: 'Перенести в ФГИС', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: /^Перенести в ФГИС/ });
  await dialog.getByRole('button', { name: 'Проверить карточку ФГИС' }).click();
  await expect(dialog).toContainText('Открыта другая карточка ФГИС.');
  await expect(dialog.getByRole('button', { name: 'Учесть регистрацию', exact: true })).toHaveCount(0);
});

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
    const number = 'ЕАЭС N RU Д-DE.PA10.B.12345/26';
    await context.route('https://srd.fsa.gov.ru/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body:
      new URL(route.request().url()).pathname === '/srd/view/12345678/srd/common'
        ? `<h1>${number} от 17.11.2026 действует до 16.11.2031</h1><span>Статус: Черновик</span><span>ИНН заявителя: 7701234567</span>`
        : html,
    }));
    await context.route('https://pay.niakk.ru/**', route => route.fulfill({ contentType: 'text/html; charset=utf-8', body: `
      <meta charset="utf-8"><title>Кабинет «Платежи»</title>
      <header><span>16 000,50 ₽</span><div><span>ООО «Заявитель»</span><span>ИНН 7701234567</span></div></header>
      <main><h1>Создать счет</h1><form>
        <section><h2>Регистрация декларации о соответствии</h2>
          <button type="button">−</button><input aria-label="Количество в НИА" type="number" min="1" value="1"><button type="button">+</button>
          <p>1500 ₽ за единицу</p>
        </section>
        <p>Итого: 1500 ₽</p><button type="submit">Сформировать</button>
      </form></main>` }));
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

    await target.goto('https://srd.fsa.gov.ru/srd/view/12345678/srd/common');
    await dialog.getByRole('button', { name: 'Проверить карточку ФГИС' }).click();
    await expect(dialog).toContainText('Статус в ФГИС: Черновик');
    await expect(dialog).toContainText(number);

    const payment = await context.newPage();
    await payment.goto('https://pay.niakk.ru/ru/main/documents/new');
    await payment.evaluate(() => {
      document.addEventListener('submit', event => {
        event.preventDefault();
        document.body.dataset.submitted = 'yes';
      });
      document.querySelector('input')?.addEventListener('change', () => { document.body.dataset.quantityChanged = 'yes'; });
    });
    await dialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await source.getByRole('tab', { name: /^Публикация/ }).click();
    const paymentPanel = source.getByRole('heading', { name: 'Оплата регистрации декларации' }).locator('..');
    await paymentPanel.getByRole('button', { name: 'Найти вкладки «Платежи»' }).click();
    await paymentPanel.getByRole('combobox', { name: 'Вкладка кабинета «Платежи»' }).click();
    await source.getByRole('option', { name: /Кабинет «Платежи»/ }).click();
    await paymentPanel.getByRole('button', { name: 'Прочитать баланс' }).click();
    await expect(paymentPanel).toContainText(/16\s000,50\s*₽/);
    await expect(paymentPanel).toContainText('ИНН плательщика совпадает с ИНН заявителя.');
    await paymentPanel.getByLabel('Количество деклараций').fill('3');
    await paymentPanel.getByRole('button', { name: 'Заполнить счёт в кабинете' }).click();
    await expect(paymentPanel).toContainText('Количество заполнено.');
    await expect(payment.getByLabel('Количество в НИА')).toHaveValue('3');
    await expect(payment.locator('body')).toHaveAttribute('data-quantity-changed', 'yes');
    await expect(payment.locator('body')).not.toHaveAttribute('data-submitted', 'yes');

    await source.getByRole('button', { name: 'Перенести в ФГИС', exact: true }).first().click();
    // A same-host sibling on another port must not inherit the paired origin's access.
    await context.route('http://127.0.0.1:5177/**', route => route.fulfill({ body: '<!doctype html><title>Unpaired source</title>' }));
    const unpaired = await context.newPage(); await unpaired.goto('http://127.0.0.1:5177/');
    await worker.evaluate(async () => {
      const chrome = (globalThis as any).chrome;
      const tabs = await chrome.tabs.query({ url: 'http://127.0.0.1/*' });
      const unpairedTab = tabs.find((tab: { url: string }) => new URL(tab.url).origin === 'http://127.0.0.1:5177');
      await chrome.scripting.executeScript({ target: { tabId: unpairedTab.id }, files: ['bridge.js'] });
    });
    const denied = await unpaired.evaluate(() => new Promise<string>((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error('No denial from the extension.')), 5000);
      window.addEventListener('message', event => {
        if (event.data?.channel !== 'znaq-fgis-response' || event.data.requestId !== 'unpaired-test') return;
        window.clearTimeout(timer);
        resolve(event.data.error);
      });
      window.postMessage({ channel: 'znaq-fgis-request', action: 'status', requestId: 'unpaired-test' }, location.origin);
    }));
    expect(denied).toContain('Подключите эту вкладку ZNAQ');
    await worker.evaluate(async () => { await (globalThis as any).chrome.storage.local.set({ appOrigins: [] }); });
    await dialog.getByRole('button', { name: 'Обновить список вкладок', exact: true }).click();
    await expect(dialog).toContainText('Подключите эту вкладку ZNAQ через значок расширения.');
  } finally { await context.close(); }
});
