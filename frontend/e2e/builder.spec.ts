import { createDeclarationDraft } from './declaration-builder-helpers';
import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { emptyParty } from '../src/types';

async function login(page: Page) {
  await page.goto('/'); await page.getByLabel('Логин', { exact: true }).fill('SuperViktor'); await page.getByLabel('Пароль', { exact: true }).fill('test12345-');
  const response=page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.status()===200);
  await page.getByRole('button',{name:'Войти в ZNAQ'}).click(); const auth=await (await response).json(); await expect(page.getByRole('heading',{name:'Добрый день, Виктор'})).toBeVisible(); return auth;
}
async function fragment(page: Page, label: string) { await page.getByRole('button',{name:`Редактировать: ${label}`,exact:true}).first().click(); }

test('creation asks for a name, supports cancellation and keeps the dialog open on failure', async ({ page }) => {
  const auth = await login(page); const firm = auth.user.firms[0].id;
  let creations = 0; let fail = true;
  await page.route('**/declarations/', route => {
    if (route.request().method() !== 'POST') return route.continue();
    creations++;
    return fail ? route.fulfill({ status: 503, json: { detail: 'Сохранение временно недоступно' } }) : route.continue();
  });
  await page.getByRole('link', { name: 'Новая декларация', exact: true }).click();
  let dialog = page.getByRole('dialog', { name: 'Новая декларация', exact: true });
  await expect(dialog).toBeVisible(); await expect(page.locator('.builder-sheet')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(dialog).toContainText('Введите название декларации'); expect(creations).toBe(0);
  await dialog.getByLabel('Название декларации').fill('   '); await dialog.getByRole('button', { name: 'Продолжить', exact: true }).click();
  expect(creations).toBe(0);
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(page).toHaveURL(/#\/declarations$/); expect(creations).toBe(0);
  await page.getByRole('button', { name: 'Создать декларацию', exact: true }).click();
  dialog = page.getByRole('dialog', { name: 'Новая декларация', exact: true });
  await dialog.getByLabel('Название декларации').fill('  Черновик из модального окна  ');
  await dialog.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(dialog).toContainText('Сохранение временно недоступно');
  await expect(dialog.getByLabel('Название декларации')).toHaveValue('  Черновик из модального окна  ');
  fail = false;
  await page.screenshot({ path: path.resolve('..', 'artifacts', 'builder-qa', 'new-declaration-dialog.png') });
  await page.setViewportSize({ width: 320, height: 740 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await dialog.getByLabel('Название декларации').press('Enter');
  await expect(dialog).toBeHidden(); await expect(page).toHaveURL(/declarations\/[a-f0-9-]+$/);
  const id = page.url().split('/').at(-1);
  const response = await page.request.get(`/api/firms/${firm}/declarations/${id}`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  expect(await response.json()).toMatchObject({ title: 'Черновик из модального окна', status: 'Draft', product: { name: '' } });
  expect(creations).toBe(2);
});

test('autosave persists edits every minute, skips unchanged data and stops after leaving', async ({ page }) => {
  const auth = await login(page); const firm = auth.user.firms[0].id;
  await page.clock.install();
  await page.goto('/#/declarations/new'); await createDeclarationDraft(page, 'Черновик с автосохранением');
  const id = page.url().split('/').at(-1); let writes = 0;
  page.on('request', request => { if (request.method() === 'PUT' && request.url().endsWith(`/declarations/${id}`)) writes++; });
  await page.clock.fastForward(60_000); expect(writes).toBe(0);
  const title = page.getByRole('textbox', { name: 'Название декларации', exact: true });
  await title.fill('Сохранено через минуту');
  const saved = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/declarations/${id}`));
  await page.clock.fastForward(60_000); const data = await (await saved).json();
  expect(data).toMatchObject({ title: 'Сохранено через минуту', status: 'Draft' });
  await expect(page.getByText(/^Автосохранено /)).toBeVisible(); await expect(page.getByText('Есть изменения', { exact: true })).toHaveCount(0);
  await page.clock.fastForward(60_000); expect(writes).toBe(1);
  const response = await page.request.get(`/api/firms/${firm}/declarations/${id}`, { headers: { Authorization: `Bearer ${auth.accessToken}` } });
  expect((await response.json()).revision).toBe(data.revision);
  await page.reload(); await expect(title).toHaveValue('Сохранено через минуту');
  await page.getByRole('button', { name: 'К реестру деклараций', exact: true }).click();
  await page.clock.fastForward(180_000); expect(writes).toBe(1);
});

test('autosave keeps edits entered during a slow request and uses the new revision on the next save', async ({ page }) => {
  await login(page); await page.clock.install();
  await page.goto('/#/declarations/new'); await createDeclarationDraft(page);
  const id = page.url().split('/').at(-1); const title = page.getByRole('textbox', { name: 'Название декларации', exact: true });
  let release!: () => void; let writes = 0;
  await page.route(`**/declarations/${id}`, async route => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes++;
    if (writes === 1) await new Promise<void>(resolve => { release = resolve; });
    return route.continue();
  });
  await title.fill('Отправлено на сервер');
  await page.clock.fastForward(60_000); await expect.poll(() => writes).toBe(1);
  await expect(title).toBeEnabled(); await title.fill('Введено во время сохранения');
  await expect(page.getByRole('button', { name: 'Сохраняем…', exact: true })).toBeDisabled();
  await page.clock.fastForward(60_000); expect(writes).toBe(1);
  const first = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/declarations/${id}`));
  release(); expect((await first).ok()).toBe(true);
  await expect(title).toHaveValue('Введено во время сохранения'); await expect(page.getByText('Есть изменения', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Сохранить', exact: true })).toBeEnabled();
  const second = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/declarations/${id}`));
  await page.clock.fastForward(60_000); const response = await second;
  expect(response.ok(), await response.text()).toBe(true); expect((await response.json()).title).toBe('Введено во время сохранения');
  await expect(page.getByText('Есть изменения', { exact: true })).toHaveCount(0);
  await page.reload(); await expect(title).toHaveValue('Введено во время сохранения');
});

test('failed autosave preserves the form and retries at the next minute', async ({ page }) => {
  await login(page); await page.clock.install();
  await page.goto('/#/declarations/new'); await createDeclarationDraft(page);
  const id = page.url().split('/').at(-1); let writes = 0;
  await page.route(`**/declarations/${id}`, route => {
    if (route.request().method() !== 'PUT') return route.continue();
    writes++;
    return writes === 1 ? route.fulfill({ status: 503, json: { detail: 'Нет связи с сервером' } }) : route.continue();
  });
  const title = page.getByRole('textbox', { name: 'Название декларации', exact: true });
  await title.fill('Правки при сбое сети'); await page.clock.fastForward(60_000);
  await expect(page.getByRole('alert').filter({ hasText: 'Не удалось автоматически сохранить декларацию' })).toContainText('Изменения остались в форме');
  await expect(title).toHaveValue('Правки при сбое сети'); await expect(page.getByText('Есть изменения', { exact: true })).toBeVisible();
  const saved = page.waitForResponse(r => r.request().method() === 'PUT' && r.url().endsWith(`/declarations/${id}`) && r.status() === 200);
  await page.clock.fastForward(60_000); await saved;
  await expect(page.getByText('Есть изменения', { exact: true })).toHaveCount(0); expect(writes).toBe(2);
  await page.reload(); await expect(title).toHaveValue('Правки при сбое сети');
});

test('builder uses real directory records, INN lookup, inline edits and saves the revision before Word and PDF',async({page})=>{
  test.slow(); page.setDefaultTimeout(15000); const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  const auth=await login(page), firm=auth.user.firms[0].id;
  const company={...emptyParty(),kind:'Both',name:'Заявитель конструктора',inn:'7707083893',ogrn:'1027700132195',address:'Москва, адрес заявителя',signatory:'Подписант конструктора'};
  const response=await page.request.post(`/api/firms/${firm}/organizations/`,{headers:{Authorization:`Bearer ${auth.accessToken}`,'X-Requested-With':'CertFlow'},data:company}); expect(response.ok(),await response.text()).toBe(true);
  let lookups=0;
  await page.route('**/integrations',route=>route.fulfill({json:[{id:'organizations',status:'Configured'}]}));
  await page.route('**/organizations/lookup',route=>{lookups++;return route.fulfill({json:{items:[{...company,name:'Изготовитель по ИНН',inn:'5406792731',ogrn:'1234567890123',kpp:'540601001',type:'LEGAL',branchType:'MAIN',status:'ACTIVE',managerName:'Руководитель',managerPosition:'Директор',standardizedAddress:company.address,dataInvalid:false}],retrievedAt:'2026-11-06T12:00:00Z',fromCache:false}});});
  await page.goto('/#/declarations/new'); await createDeclarationDraft(page);
  await expect(page.getByRole('tablist',{name:'Разделы декларации'})).toHaveCount(0);
  const directory=page.getByRole('combobox',{name:'Подставить из справочника'});
  await directory.fill('7707083893'); await page.getByRole('option',{name:/Заявитель конструктора/}).click();
  await expect(page.locator('.builder-sheet').first()).toContainText('Заявитель конструктора'); await expect(page.locator('.builder-sheet').first()).toContainText('Подписант конструктора');
  await fragment(page,'Изготовитель'); await page.getByRole('button',{name:'По ИНН',exact:true}).click();
  const lookup=page.getByRole('region',{name:'Поиск реквизитов в DaData'});
  await lookup.getByLabel('ИНН или ОГРН / ОГРНИП').fill('5406792731'); await lookup.getByRole('button',{name:'Найти организацию',exact:true}).click();
  await lookup.getByRole('button',{name:'Подставить реквизиты',exact:true}).click(); await expect(lookup).toBeHidden(); expect(lookups).toBe(1);
  await expect(page.locator('.builder-sheet').first()).toContainText('Изготовитель по ИНН');
  await fragment(page,'заявляет, что'); await page.getByLabel('Наименование продукции',{exact:true}).fill('Продукция в живом документе'); await page.getByLabel('Код ТН ВЭД',{exact:true}).fill('2710198200');
  await fragment(page,'соответствует требованиям'); const regulation=page.getByRole('combobox',{name:'Технические регламенты / стандарты',exact:true}); await regulation.fill('ТР ТС 030/2012'); await regulation.press('Enter');
  await fragment(page,'Дата принятия декларации о соответствии'); await page.getByLabel('Дата принятия',{exact:true}).fill('2026-11-06'); await page.getByLabel('Действует до',{exact:true}).fill('2027-11-06');
  await page.getByRole('textbox',{name:'Название декларации',exact:true}).fill('Конструктор — полный сценарий');
  await fragment(page,'Заявитель'); await page.getByRole('button',{name:'Текст на листе',exact:true}).click();
  await page.getByRole('textbox',{name:'Текст фрагмента: Заявитель',exact:true}).fill('Заявитель изменён на листе'); await page.getByRole('button',{name:'Готово',exact:true}).click();
  await expect(page.locator('.builder-sheet').first()).toContainText('Заявитель изменён на листе');
  const saved=page.waitForResponse(r=>r.request().method()==='PUT'&&/\/declarations\/[a-f0-9-]+$/.test(new URL(r.url()).pathname)&&r.status()===200);
  const wordDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'Word',exact:true}).click(); const document=await (await saved).json();
  expect(document.applicant.name).toBe('Заявитель изменён на листе'); expect(document.manufacturer.name).toBe('Изготовитель по ИНН');
  const word=await wordDownload; await word.saveAs(path.resolve('..','artifacts','builder-qa','browser.docx'));
  await page.reload(); await expect(page.locator('.builder-sheet').first()).toContainText('Заявитель изменён на листе');
  const pdfDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'PDF',exact:true}).click(); const pdf=await pdfDownload; await pdf.saveAs(path.resolve('..','artifacts','builder-qa','browser.pdf'));
  await page.screenshot({path:path.resolve('..','artifacts','builder-qa','desktop.png'),fullPage:true});
  for(const width of [736,390,320]) { await page.setViewportSize({width,height:900}); expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true); }
  await page.getByRole('button',{name:'Включить тёмную тему',exact:true}).click(); await page.screenshot({path:path.resolve('..','artifacts','builder-qa','mobile-dark.png'),fullPage:true});
  expect(errors).toEqual([]);
});

test('builder leaves server data intact on preview, handles errors and keeps unsaved edits',async({page})=>{
  page.setDefaultTimeout(15000); await login(page); await page.goto('/#/declarations/new'); await createDeclarationDraft(page);
  await expect(page.locator('.builder-sheet').first()).toBeVisible();
  await page.route('**/declarations/preview**',route=>route.fulfill({status:503,json:{detail:'Предпросмотр временно недоступен'}}));
  await page.getByRole('textbox',{name:'Название декларации',exact:true}).fill('Несохранённая работа');
  await expect(page.getByRole('alert').filter({hasText:'Предпросмотр временно недоступен'})).toBeVisible(); await expect(page.getByRole('button',{name:'Word',exact:true})).toBeDisabled();
  await expect(page.getByRole('textbox',{name:'Название декларации',exact:true})).toHaveValue('Несохранённая работа');
  await page.unroute('**/declarations/preview**'); await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.getByRole('button',{name:'Word',exact:true})).toBeEnabled();
});
