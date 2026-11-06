import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { emptyParty } from '../src/types';

async function login(page: Page) {
  await page.goto('/'); await page.getByLabel('Логин', { exact: true }).fill('SuperViktor'); await page.getByLabel('Пароль', { exact: true }).fill('test12345-');
  const response=page.waitForResponse(r=>r.url().endsWith('/api/auth/login')&&r.status()===200);
  await page.getByRole('button',{name:'Войти в ZNAQ'}).click(); const auth=await (await response).json(); await expect(page.getByRole('heading',{name:'Добрый день, Виктор'})).toBeVisible(); return auth;
}
async function fragment(page: Page, label: string) { await page.getByRole('button',{name:`Редактировать: ${label}`,exact:true}).first().click(); }

test('builder uses real directory records, INN lookup, inline edits and saves the revision before Word and PDF',async({page})=>{
  test.slow(); page.setDefaultTimeout(15000); const errors:string[]=[]; page.on('pageerror',e=>errors.push(e.message));
  const auth=await login(page), firm=auth.user.firms[0].id;
  const company={...emptyParty(),kind:'Both',name:'Заявитель конструктора',inn:'7707083893',ogrn:'1027700132195',address:'Москва, адрес заявителя',signatory:'Подписант конструктора'};
  const response=await page.request.post(`/api/firms/${firm}/organizations/`,{headers:{Authorization:`Bearer ${auth.accessToken}`,'X-Requested-With':'CertFlow'},data:company}); expect(response.ok(),await response.text()).toBe(true);
  let lookups=0;
  await page.route('**/integrations',route=>route.fulfill({json:[{id:'organizations',status:'Configured'}]}));
  await page.route('**/organizations/lookup',route=>{lookups++;return route.fulfill({json:{items:[{...company,name:'Изготовитель по ИНН',inn:'5406792731',ogrn:'1234567890123',kpp:'540601001',type:'LEGAL',branchType:'MAIN',status:'ACTIVE',managerName:'Руководитель',managerPosition:'Директор',standardizedAddress:company.address,dataInvalid:false}],retrievedAt:'2026-11-06T12:00:00Z',fromCache:false}});});
  await page.goto('/#/declarations/new');
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
  const saved=page.waitForResponse(r=>r.request().method()==='POST'&&r.url().endsWith('/declarations/')&&r.status()===200);
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
  page.setDefaultTimeout(15000); await login(page); await page.goto('/#/declarations/new');
  await expect(page.locator('.builder-sheet').first()).toBeVisible();
  await page.route('**/declarations/preview**',route=>route.fulfill({status:503,json:{detail:'Предпросмотр временно недоступен'}}));
  await page.getByRole('textbox',{name:'Название декларации',exact:true}).fill('Несохранённая работа');
  await expect(page.getByRole('alert').filter({hasText:'Предпросмотр временно недоступен'})).toBeVisible(); await expect(page.getByRole('button',{name:'Word',exact:true})).toBeDisabled();
  await expect(page.getByRole('textbox',{name:'Название декларации',exact:true})).toHaveValue('Несохранённая работа');
  await page.unroute('**/declarations/preview**'); await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await expect(page.getByRole('button',{name:'Word',exact:true})).toBeEnabled();
});
