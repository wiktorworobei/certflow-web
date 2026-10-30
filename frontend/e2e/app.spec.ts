import { test, expect, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

test('laboratory evidence survives reload, file upload during editing, exports and deletion of the directory source', async ({ page }) => {
  test.slow();
  await login(page);
  await page.getByRole('link',{name:'Справочники',exact:true}).click();
  await page.getByRole('tab',{name:/Лаборатории/}).click();
  await page.getByRole('button',{name:'Добавить лабораторию',exact:true}).click();
  const dialog=page.getByRole('dialog',{name:'Новая лаборатория'});
  const labName=`Лаборатория образцов ${Date.now()}`;
  await dialog.getByRole('textbox',{name:'Наименование лаборатории',exact:true}).fill(labName);
  await dialog.getByLabel('Адрес',{exact:true}).fill('Алматы, адрес испытаний');
  await dialog.getByLabel('Страна лаборатории',{exact:true}).fill('Казахстан');
  await dialog.getByRole('combobox',{name:'Тип лаборатории'}).click();
  await page.getByRole('option',{name:'Неаккредитованная',exact:true}).click();
  await dialog.getByRole('button',{name:'Сохранить',exact:true}).click(); await expect(dialog).toBeHidden();
  await page.goto('/#/declarations/new');
  await page.getByRole('textbox',{name:'Название декларации',exact:true}).fill(`Испытания образцов ${Date.now()}`);
  await page.getByRole('button',{name:'Сохранить',exact:true}).click(); await expect(page).toHaveURL(/declarations\/[a-f0-9-]+$/);
  const documentUrl=page.url();
  await page.getByRole('tab',{name:'Файлы и история',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'evidence.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nEvidence')});
  await expect(page.getByText('evidence.pdf',{exact:true})).toBeVisible();
  await page.getByRole('tab',{name:'Испытания',exact:true}).click();
  await page.getByRole('button',{name:'Добавить направление',exact:true}).click();
  await page.getByLabel('Номер направления',{exact:true}).fill('DIR-E2E');
  await page.getByLabel('Дата направления',{exact:true}).fill('2026-10-14');
  await page.getByRole('combobox',{name:'Лаборатория направления из справочника',exact:true}).fill(labName);
  await page.getByRole('option',{name:new RegExp(labName)}).click();
  await page.getByLabel('Номер акта отбора',{exact:true}).fill('ACT-E2E');
  await page.getByLabel('Дата акта отбора',{exact:true}).fill('2026-10-13');
  await page.getByRole('combobox',{name:'Файл акта отбора'}).click();
  await page.getByRole('option',{name:'evidence.pdf',exact:true}).click();
  await page.getByRole('button',{name:'Добавить образец',exact:true}).click();
  await page.getByLabel('Название образца',{exact:true}).fill('Образец машины');
  await page.getByLabel('Идентификация образца',{exact:true}).fill('Модель X, партия 123');
  await page.getByLabel('Количество образцов',{exact:true}).fill('2');
  await page.getByRole('button',{name:'Добавить протокол',exact:true}).click();
  await page.getByLabel('Номер протокола',{exact:true}).fill('PI-E2E');
  await page.getByLabel('Дата протокола',{exact:true}).fill('2026-10-15');
  await page.getByRole('combobox',{name:'Лаборатория из справочника',exact:true}).fill(labName);
  await page.getByRole('option',{name:new RegExp(labName)}).click();
  await expect(page.getByLabel('Страна лаборатории',{exact:true})).toHaveValue('Казахстан');
  await page.getByRole('combobox',{name:'Связанное направление'}).click();
  await page.getByRole('option',{name:new RegExp('DIR-E2E')}).click();
  await page.getByRole('combobox',{name:'Файл протокола'}).click();
  await page.getByRole('option',{name:'evidence.pdf',exact:true}).click();
  await page.getByLabel('Комментарий к протоколу',{exact:true}).fill('Изменения до загрузки второго файла');
  await page.getByRole('tab',{name:'Файлы и история',exact:true}).click();
  await page.locator('input[type=file]').setInputFiles({name:'extra.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nExtra')});
  await expect(page.getByText('extra.pdf',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Сохранить',exact:true}).click();
  await expect(page.getByText('Декларация сохранена',{exact:true})).toBeVisible();
  await expect(page.getByText('Есть изменения',{exact:true})).toHaveCount(0);
  await page.reload(); await page.getByRole('tab',{name:'Испытания',exact:true}).click();
  await expect(page.getByLabel('Номер направления',{exact:true})).toHaveValue('DIR-E2E');
  await expect(page.getByLabel('Комментарий к протоколу',{exact:true})).toHaveValue('Изменения до загрузки второго файла');
  await expect(page.getByRole('combobox',{name:'Файл протокола'})).toHaveText('evidence.pdf');
  const directionDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'Скачать направление',exact:true}).click();
  expect((await directionDownload).suggestedFilename()).toMatch(/\.docx$/);
  const zipDownload=page.waitForEvent('download'); await page.getByRole('button',{name:'Комплект ZIP',exact:true}).click();
  const zip=await zipDownload; expect(zip.suggestedFilename()).toMatch(/\.zip$/);
  const zipPath=await zip.path(); expect(fs.readFileSync(zipPath!).subarray(0,2).toString()).toBe('PK');
  await page.screenshot({path:path.resolve('..','artifacts','screenshots','evidence-desktop.png'),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:path.resolve('..','artifacts','screenshots','evidence-mobile.png'),animations:'disabled'});
  await page.setViewportSize({width:1440,height:1050});
  await page.getByRole('link',{name:'Справочники',exact:true}).click(); await page.getByRole('tab',{name:/Лаборатории/}).click();
  await page.getByRole('button',{name:`Удалить лабораторию ${labName}`,exact:true}).click();
  await page.getByRole('dialog',{name:'Удалить лабораторию из справочника?'}).getByRole('button',{name:'Удалить запись',exact:true}).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto(documentUrl); await page.getByRole('tab',{name:'Испытания',exact:true}).click();
  await expect(page.getByLabel('Наименование лаборатории',{exact:true})).toHaveValue(labName);
  await expect(page.getByLabel('Адрес лаборатории протокола',{exact:true})).toHaveValue('Алматы, адрес испытаний');
});

test('ChZ related declaration import persists through the real certification API without registering the draft', async ({ page }) => {
  await page.route('**/catalog/products/lookup?*', route => route.fulfill({ json: [{ gtin: '05011846021161', name: 'Масло из карточки', brand: '', tnved: '2710', identification: '', okpd2: '', storageConditions: '', status: 'published' }] }));
  await page.route('**/catalog/permits/by-product', route => {
    expect(route.request().postDataJSON()).toEqual({ gtin: '05011846021161' });
    return route.fulfill({ json: { documents: [{ attributeId: 23557, number: 'ЕАЭС E2E-NK-1', fromDate: '2026-10-01', toDate: '2027-10-01', productName: 'Масло по декларации НК', applicantName: 'Заявитель НК', manufacturerName: 'Изготовитель НК', tnved: '2710198200', identification: 'Артикул NK-E2E', regulations: 'ТР ТС 030/2012', status: 'Действует', statusGroup: 1, active: null, updatedAt: null }], errors: [], retrievedAtUtc: '2026-10-29T10:00:00Z' } });
  });
  await login(page); await page.goto('/#/declarations/new');
  await page.getByLabel('Название декларации').fill(`Подстановка НК ${Date.now()}`);
  await page.getByRole('tab', { name: 'Продукция', exact: true }).click();
  await page.getByLabel('Сведения о партии / изделии').fill('Наша новая партия');
  await page.getByRole('button', { name: 'Выбрать товар из ЧЗ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Выбрать товар из ЧЗ', exact: true });
  await dialog.getByLabel('GTIN для поиска в ЧЗ').fill('5011846021161'); await dialog.getByRole('button', { name: 'Найти в ЧЗ', exact: true }).click();
  await dialog.getByRole('combobox', { name: /^Декларация из ЧЗ/ }).click(); await page.getByRole('option', { name: /ЕАЭС E2E-NK-1/ }).click();
  await dialog.getByRole('button', { name: 'Подставить товар и выбранную декларацию', exact: true }).click();
  const saved = page.waitForResponse(response => /\/declarations\/?$/.test(new URL(response.url()).pathname) && response.request().method() === 'POST' && response.status() === 200);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  const data = await (await saved).json();
  expect(data.status).toBe('Draft'); expect(data.registrationNumber).toBe(''); expect(data.reports).toEqual([]);
  expect(data.evidence.catalogDeclaration).toMatchObject({ number: 'ЕАЭС E2E-NK-1', gtin: '05011846021161', ownerInn: null });
  await expect(page).toHaveURL(/declarations\/[a-f0-9-]+$/); await page.reload();
  await page.getByRole('tab', { name: 'Продукция', exact: true }).click();
  await expect(page.getByLabel('Наименование продукции', { exact: true })).toHaveValue('Масло по декларации НК');
  await expect(page.getByLabel('Сведения о партии / изделии')).toHaveValue('Наша новая партия');
  await expect(page.getByRole('region', { name: 'Декларация-источник из НК' })).toContainText('ЕАЭС E2E-NK-1');
  await page.getByRole('tab', { name: 'Участники', exact: true }).click();
  await expect(page.getByLabel('Полное наименование', { exact: true }).first()).toHaveValue('Заявитель НК');
  await page.getByRole('tab', { name: 'Сведения', exact: true }).click();
  await expect(page.getByLabel('Дата принятия', { exact: true })).toHaveValue('2026-10-01');
});

test('manual declaration product persists independently of the standalone NK catalog', async ({ page }) => {
  await login(page); await page.goto('/#/declarations/new');
  const title = `Моторное масло для НК ${Date.now()}`;
  await page.getByLabel('Название декларации').fill(title);
  await page.getByRole('tab', { name: 'Продукция', exact: true }).click();
  await page.getByLabel('Наименование продукции', { exact: true }).fill('Масло моторное Premium 5W-30');
  await page.getByLabel('Модель, марка, артикул и другие признаки').fill('Oil Brand, канистра 4 л');
  await page.getByLabel('Код ТН ВЭД', { exact: true }).fill('2710198200');
  await page.getByLabel('GTIN', { exact: true }).fill('05011846021161');
  await expect(page.getByRole('button', { name: 'Сохранить и создать карточку в ЧЗ', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page).toHaveURL(/declarations\/[a-f0-9-]+$/);
  await page.reload();
  await page.getByRole('tab', { name: 'Продукция', exact: true }).click();
  await expect(page.getByLabel('Наименование продукции', { exact: true })).toHaveValue('Масло моторное Premium 5W-30');
  await expect(page.getByLabel('Модель, марка, артикул и другие признаки')).toHaveValue('Oil Brand, канистра 4 л');
  await expect(page.getByLabel('GTIN', { exact: true })).toHaveValue('05011846021161');
  await page.getByRole('link', { name: 'Карточки ЧЗ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Карточки ЧЗ', exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#honest-sign-certificate')).toBeVisible();
});

test('company directory fills a declaration after reload and a failed refresh preserves stored details', async ({ page }) => {
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить компанию' }).click();
  const dialog = page.getByRole('dialog', { name: 'Новая компания' }); const name = `Компания для повторного выбора ${Date.now()}`;
  await dialog.getByRole('textbox', { name: 'Полное наименование', exact: true }).fill(name);
  await dialog.getByLabel('ИНН', { exact: true }).fill('7707083893');
  await dialog.getByLabel('ОГРН / ОГРНИП', { exact: true }).fill('1027700132195');
  await dialog.getByLabel('КПП', { exact: true }).fill('773601001');
  await dialog.getByLabel('Электронная почта', { exact: true }).fill('directory@example.com');
  await dialog.getByLabel('Телефон', { exact: true }).fill('+375 29 123-45-67');
  await dialog.getByLabel('Регистрирующий орган', { exact: true }).fill('Регистрирующий орган, заполненный вручную');
  await dialog.getByLabel('ФИО подписанта', { exact: true }).fill('Подписант из справочника');
  await dialog.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(dialog).toBeHidden();
  const warning = page.getByRole('dialog', { name: 'Ручные данные будут перезаписаны' });
  await expect(warning).toBeHidden();
  const row = page.getByRole('row').filter({ hasText: name });
  await expect(row.getByText(/защищены ночью/)).toBeVisible();
  await row.getByRole('button', { name: `Обновить ${name}`, exact: true }).click();
  await warning.getByRole('checkbox', { name: 'Больше не показывать' }).check();
  await warning.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(row.getByRole('alert')).toContainText('DaData отключён');
  await page.reload(); await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Обзор', exact: true }).click();
  await page.getByRole('link', { name: 'Новая декларация' }).click(); await page.getByRole('tab', { name: 'Участники' }).click();
  await page.getByRole('combobox', { name: 'Подставить из справочника' }).first().fill('7707083893');
  await page.getByRole('option', { name: new RegExp(name) }).click();
  await expect(page.getByRole('textbox', { name: 'Полное наименование', exact: true }).first()).toHaveValue(name);
  await expect(page.getByLabel('Электронная почта', { exact: true }).first()).toHaveValue('directory@example.com');
  await expect(page.getByLabel('Телефон', { exact: true }).first()).toHaveValue('+375 29 123-45-67');
  await expect(page.getByLabel('Регистрирующий орган', { exact: true }).first()).toHaveValue('Регистрирующий орган, заполненный вручную');
  await expect(page.getByLabel('ФИО подписанта', { exact: true })).toHaveValue('Подписант из справочника');
});

async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Логин', exact: true }).fill('SuperViktor');
  await page.getByLabel('Пароль', { exact: true }).fill('test12345-');
  const response = page.waitForResponse(r => r.url().endsWith('/api/auth/login') && r.status() === 200);
  await page.getByRole('button', { name: 'Войти в CertFlow' }).click();
  const auth = await (await response).json();
  await expect(page.getByRole('heading', { name: 'Добрый день, Виктор' })).toBeVisible();
  return auth;
}

async function searchDeclarations(page: Page, search: string) {
  const response = page.waitForResponse(result => {
    const url = new URL(result.url());
    return url.pathname.replace(/\/$/, '').endsWith('/declarations') && url.searchParams.get('search') === search && result.status() === 200;
  });
  await page.getByRole('textbox', { name: 'Поиск деклараций', exact: true }).fill(search);
  await response;
  await expect(page).toHaveURL(/search=/);
}

test('declaration archive and restore persist across reload with attachments and history', async ({ page }) => {
  await login(page); await page.getByRole('link', { name: 'Новая декларация' }).click();
  const title = `Архивная декларация ${Date.now()}`;
  await page.getByLabel('Название декларации').fill(title);
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Декларация сохранена', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Файлы и история', exact: true }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'archive.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\narchive test') });
  await expect(page.getByText('archive.pdf', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'К реестру деклараций', exact: true }).click();
  await searchDeclarations(page, title);
  const row = page.getByRole('row').filter({ hasText: title }); await expect(row).toBeVisible();
  await row.getByRole('button', { name: /^Действия / }).click();
  await page.getByRole('menuitem', { name: 'В архив', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Отправить в архив?' });
  await dialog.getByLabel('Комментарий к архивированию').fill('Завершено в браузерной проверке');
  await dialog.getByRole('button', { name: 'Отправить в архив', exact: true }).click();
  await expect(dialog).toBeHidden(); await expect(row).toHaveCount(0);
  await page.getByRole('button', { name: 'Архив', exact: true }).click(); await expect(row).toBeVisible();
  await page.reload(); await expect(row).toBeVisible();
  await row.getByRole('link', { name: title, exact: true }).click();
  await expect(page.getByRole('button', { name: 'В архив', exact: true })).toHaveCount(0);
  await expect(page.getByLabel('Название декларации')).toBeDisabled();
  await page.getByRole('tab', { name: 'Файлы и история', exact: true }).click();
  await expect(page.getByText('archive.pdf', { exact: true })).toBeVisible();
  await expect(page.getByText('Статус: В архиве. Завершено в браузерной проверке', { exact: true })).toBeVisible();
  const downloaded = page.waitForEvent('download'); await page.getByRole('button', { name: 'Скачать archive.pdf', exact: true }).click();
  expect((await downloaded).suggestedFilename()).toBe('archive.pdf');
  await page.getByRole('button', { name: 'Восстановить из архива', exact: true }).click();
  const restore = page.getByRole('dialog', { name: 'Восстановить из архива?' });
  await restore.getByLabel('Комментарий к восстановлению').fill('Возобновлена работа');
  await restore.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await expect(restore).toBeHidden();
  await expect(page.getByText('Восстановлена из архива. Статус: Черновик. Возобновлена работа', { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Сведения', exact: true }).click();
  await expect(page.getByLabel('Название декларации')).toBeEnabled();
  await page.reload();
  await expect(page.getByLabel('Название декларации')).toBeEnabled();
  await page.getByRole('tab', { name: 'Файлы и история', exact: true }).click();
  await expect(page.getByText('archive.pdf', { exact: true })).toBeVisible();
});

test('login, invalid credentials, session reload and logout', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('textbox', { name: 'Логин', exact: true }).fill('SuperViktor');
  await page.getByLabel('Пароль', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Войти в CertFlow' }).click();
  await expect(page.getByText('Неверный логин или пароль.')).toBeVisible();
  await page.getByLabel('Пароль', { exact: true }).fill('test12345-');
  await page.getByRole('button', { name: 'Войти в CertFlow' }).click();
  await expect(page.getByRole('heading', { name: 'Добрый день, Виктор' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Добрый день, Виктор' })).toBeVisible();
  await page.getByRole('button', { name: 'Меню профиля' }).click();
  await page.getByRole('menuitem', { name: 'Выйти', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'С возвращением' })).toBeVisible();
});

test('create declaration, fill all sections, review, register, export and duplicate', async ({ page }) => {
  test.slow();
  await login(page);
  await page.getByRole('link', { name: 'Новая декларация' }).click();
  const title = `Браузерная проверка ${Date.now()}`;
  await page.getByLabel('Название декларации').fill(title);
  await page.getByRole('combobox', { name: 'Технические регламенты / стандарты' }).fill('ТР ТС 010/2011');
  await page.getByRole('combobox', { name: 'Технические регламенты / стандарты' }).press('Enter');
  await page.getByLabel('Дата принятия').fill('2026-10-15');
  await page.getByLabel('Действует до').fill('2027-10-14');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Декларация сохранена')).toBeVisible();
  await page.getByRole('tab', { name: 'Участники' }).click();
  const orgSelectors = page.getByRole('combobox', { name: 'Подставить из справочника' });
  await orgSelectors.first().click();
  await page.getByRole('option', { name: /ООО «Атлас Импорт»/ }).click();
  await orgSelectors.nth(1).click();
  await page.getByRole('option', { name: /Atlas Manufacturing Co., Ltd./ }).click();
  await page.getByRole('tab', { name: 'Продукция', exact: true }).click();
  await page.getByLabel('Наименование продукции', { exact: true }).fill('Машина упаковочная тестовая');
  await page.getByLabel('Код ТН ВЭД', { exact: true }).fill('8422400008');
  await page.getByRole('tab', { name: 'Файлы и история' }).click();
  await page.locator('input[type=file]').setInputFiles({name:'ui-protocol.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\nUI report')});
  await expect(page.getByText('ui-protocol.pdf',{exact:true})).toBeVisible();
  await page.getByRole('tab', { name: 'Испытания' }).click();
  await page.getByRole('button', { name: 'Добавить протокол', exact: true }).click();
  await page.getByRole('combobox',{name:'Файл протокола'}).click();
  await page.getByRole('option',{name:'ui-protocol.pdf',exact:true}).click();
  await page.getByLabel('Номер протокола').fill('UITEST-100');
  await page.getByLabel('Дата протокола').fill('2026-10-14');
  await page.getByRole('combobox', { name: 'Лаборатория из справочника' }).click();
  await page.getByRole('option', { name: 'Демонстрационная лаборатория «Тест»' }).click();
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText('Декларация сохранена')).toBeVisible();
  await page.getByRole('button', { name: 'Изменить статус' }).click();
  await page.getByRole('menuitem', { name: 'На проверке', exact: true }).click();
  await page.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Изменить статус' }).click();
  await page.getByRole('menuitem', { name: 'Готова к регистрации' }).click();
  await page.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Изменить статус' }).click();
  await page.getByRole('menuitem', { name: 'Учесть регистрацию' }).click();
  await page.getByLabel('Регистрационный номер').fill('UI-TEST-2026');
  await page.getByLabel('HTTPS-ссылка на запись в реестре').fill('https://example.com/registry/test');
  await page.getByRole('button', { name: 'Подтвердить' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const wordDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Word', exact: true }).click();
  const word = await wordDownload; expect(word.suggestedFilename()).toMatch(/\.docx$/);
  const pdfDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'PDF', exact: true }).click();
  const pdf = await pdfDownload; expect(pdf.suggestedFilename()).toMatch(/\.pdf$/);
  const pdfPath = await pdf.path(); expect(fs.readFileSync(pdfPath!).subarray(0, 5).toString()).toBe('%PDF-');
  await page.getByRole('tab', { name: 'Файлы и история' }).click();
  await page.locator('input[type=file]').setInputFiles({ name: 'протокол.pdf', mimeType: 'application/pdf', buffer: fs.readFileSync(pdfPath!) });
  await expect(page.getByText('протокол.pdf', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'К реестру деклараций' }).click();
  await searchDeclarations(page, title);
  const row = page.getByRole('row').filter({ hasText: title }); await expect(row).toBeVisible();
  await row.getByRole('button', { name: /Действия/ }).click(); await page.getByRole('menuitem', { name: 'Создать копию' }).click();
  await expect(page.getByRole('heading', { name: `${title} — копия` })).toBeVisible();
  await expect(page.getByText('Черновик', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Дата принятия')).toHaveValue('');
  await page.getByRole('tab', { name: 'Файлы и история' }).click();
  await expect(page.getByText('Файлы ещё не добавлены.')).toBeVisible();
});

test('directories persist company and laboratory edits', async ({ page }) => {
  await login(page); await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить компанию' }).click();
  const name = `Тестовый заявитель ${Date.now()}`;
  await page.getByLabel('Полное наименование').fill(name); await page.getByLabel('Адрес', { exact: true }).fill('Минск, тестовый адрес');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByRole('tab', { name: /Лаборатории/ }).click(); await page.getByRole('button', { name: 'Добавить лабораторию' }).click();
  const lab = `Лаборатория ${Date.now()}`;
  await page.getByLabel('Наименование лаборатории').fill(lab); await page.getByLabel('Номер аккредитации').fill('UI-ACC');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(page.getByText(lab, { exact: true })).toBeVisible();
});

test('local TN VED codes are loaded from Excel and persist in a product after saving', async ({ page }) => {
  await login(page);
  await page.getByRole('combobox', { name: 'Компания', exact: true }).selectOption({ label: 'Моя компания' });
  await page.goto('/#/declarations/new');
  await page.getByRole('textbox', { name: 'Название декларации', exact: true }).fill('Локальный справочник ТН ВЭД');
  await page.getByRole('tab', { name: 'Продукция', exact: true }).click();
  await page.getByLabel('Наименование продукции', { exact: true }).fill('Племенные лошади');
  await page.getByRole('button', { name: 'Подобрать код ТН ВЭД', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: /Подбор кода ТН ВЭД/ });
  await expect(dialog).toContainText(/13\s*294 кодов/);
  await dialog.getByRole('textbox', { name: 'Код или название товара', exact: true }).fill('0101 21 0000');
  await dialog.getByRole('button', { name: /чистопородные племенные животные/ }).click();
  await dialog.getByRole('button', { name: 'Подставить код', exact: true }).click();
  await expect(page.getByLabel('Код ТН ВЭД', { exact: true })).toHaveValue('0101210000');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click();
  await expect(page).toHaveURL(/declarations\/[a-f0-9-]+$/);
  await page.reload(); await page.getByRole('tab', { name: 'Продукция', exact: true }).click();
  await expect(page.getByLabel('Код ТН ВЭД', { exact: true })).toHaveValue('0101210000');
  await expect(page.getByLabel('Наименование продукции', { exact: true })).toHaveValue('Племенные лошади');
});

test('company switching, filters, CSV and honest integration states', async ({ page }) => {
  await login(page); await page.getByRole('link', { name: 'Декларации', exact: true }).click();
  await page.getByRole('button', { name: 'Черновики', exact: true }).click(); await expect(page.getByRole('table')).toBeVisible();
  const csvDownload = page.waitForEvent('download'); await page.getByRole('button', { name: 'Экспорт CSV' }).click(); expect((await csvDownload).suggestedFilename()).toBe('declarations.csv');
  await page.getByRole('combobox', { name: 'Компания', exact: true }).selectOption({ label: 'Моя компания' });
  await expect(page.getByRole('heading', { name: 'Добрый день, Виктор' })).toBeVisible();
  await page.getByRole('link', { name: 'Настройки', exact: true }).click();
  for (const name of ['ФГИС Росаккредитации', 'Реестр деклараций', 'Реестр лабораторий и обмен с ИЛ']) {
    const card = page.locator('.connection-card').filter({ has: page.getByRole('heading', { name, exact: true }) });
    await expect(card.getByText('Не подключено', { exact: true })).toBeVisible();
  }
  const tnved = page.locator('.connection-card').filter({ has: page.getByRole('heading', { name: 'ТН ВЭД — локальный справочник', exact: true }) });
  await expect(tnved.getByText('Загружен', { exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Успешных подключений пока нет' })).toBeVisible();
});

test('DaData without a key keeps manual organization entry available', async ({ page }) => {
  await login(page);
  await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('button', { name: 'Добавить компанию' }).click();
  await page.getByRole('textbox', { name: 'Полное наименование', exact: true }).fill('Проверка ручных реквизитов');
  await page.getByRole('button', { name: 'Найти по ИНН / ОГРН' }).click();
  const dialog = page.getByRole('dialog', { name: 'Поиск реквизитов в DaData', exact: true });
  await expect(dialog.getByText(/Добавьте свой API-ключ DaData/)).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Найти организацию', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Отмена', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Полное наименование', exact: true })).toHaveValue('Проверка ручных реквизитов');
});

test('declaration GTIN and confirmed code batch persist through the real marking API', async ({ page }) => {
  await login(page); await page.getByRole('link', { name: 'Новая декларация' }).click();
  await page.getByLabel('Название декларации').fill(`Масло E2E ${Date.now()}`);
  await page.getByRole('tab', { name: 'Продукция', exact: true }).click();
  await page.getByLabel('Наименование продукции', { exact: true }).fill('Моторное масло 5W-30');
  await page.getByLabel('GTIN', { exact: true }).fill('05011846021161');
  await page.getByRole('button', { name: 'Сохранить', exact: true }).click(); await expect(page.getByText('Декларация сохранена')).toBeVisible();
  await page.getByRole('button', { name: 'Товары в ЧЗ и Нашей марке' }).click();
  await expect(page.getByLabel('GTIN товара')).toHaveValue('05011846021161');
  await page.getByLabel('Номер партии (необязательно)').fill('E2E-OIL');
  await page.getByRole('button', { name: 'Связать с декларацией' }).click(); await expect(page.getByText('Связь с декларацией сохранена.')).toBeVisible();
  await page.getByRole('tab', { name: 'Партии и коды' }).click();
  await page.getByLabel('GTIN партии').fill('05011846021161');
  await page.getByLabel('Полные коды Data Matrix').fill(`010501184602116121E2E${Date.now()}<GS>93TEST`);
  await page.getByLabel('Коды нанесены, физический результат и состав партии проверены').check();
  await page.getByRole('button', { name: 'Сохранить партию и связать с декларацией' }).click();
  await expect(page.getByText(/Состав партии сохранён и связан с декларацией/)).toBeVisible();
  const batchDialog = page.getByRole('dialog');
  await expect(batchDialog.getByRole('table', { name: 'Состав кодов партии' })).toBeVisible();
  await expect(batchDialog.getByText(/<GS>93TEST/)).toBeVisible();
  const codesDownload = page.waitForEvent('download'); await batchDialog.getByRole('button', { name: 'Скачать полные коды TXT' }).click();
  const savedCodes = fs.readFileSync((await (await codesDownload).path())!, 'utf8'); expect(savedCodes).toContain('\u001d93TEST');
  await batchDialog.getByRole('button', { name: 'Закрыть', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Журнал партий', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Открыть партию' })).toBeVisible();
  await page.getByRole('tab', { name: 'Связи с декларациями' }).click();
  await expect(page.getByText('Привязан состав кодов', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('Привязан состав кодов', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Компания', exact: true }).selectOption('22222222-2222-4222-8222-222222222222');
  await page.getByRole('link', { name: 'ЧЗ и Наша марка', exact: true }).click();
  await expect(page.getByText('Привязан состав кодов', { exact: true })).toHaveCount(0);
});

test('desktop and mobile layouts', async ({ page }) => {
  const screenshotDir = path.resolve('..', 'artifacts', 'screenshots'); fs.mkdirSync(screenshotDir, { recursive: true });
  await page.goto('/'); await expect(page.getByRole('heading', { name: 'С возвращением' })).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, 'login.png'), fullPage: true });
  await login(page); await page.screenshot({ path: path.join(screenshotDir, 'overview.png'), fullPage: true });
  await page.getByRole('link', { name: 'Декларации', exact: true }).click(); await expect(page.getByRole('table')).toBeVisible();
  await page.screenshot({ path: path.join(screenshotDir, 'registry.png'), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 }); await page.reload();
  await expect(page.getByRole('heading', { name: 'Декларации', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Открыть меню' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: path.join(screenshotDir, 'mobile.png'), fullPage: true });
});

test('bulk archive, restore and permanent cleanup of selected declarations', async ({ page }) => {
  const auth = await login(page); const firmId = auth.user.firms[0].id;
  const prefix = `Массовая проверка документов ${Date.now()}`;
  const headers = { Authorization: `Bearer ${auth.accessToken}` };
  for (let i = 1; i <= 2; i++) {
    const response = await page.request.post(`/api/firms/${firmId}/declarations/`, { headers, data: {
      title: `${prefix} ${i}`, kind: 'Декларация', scheme: '1д',
      applicant: { name: 'Заявитель', inn: '', ogrn: '', kpp: '', country: 'Россия', address: '', email: '', phone: '', signatory: '', position: '', shortName: '', legalForm: '', registrationDate: null, registrationAuthority: '', managerName: '', managerPosition: '' },
      manufacturer: { name: '', inn: '', ogrn: '', kpp: '', country: 'Россия', address: '', email: '', phone: '', signatory: '', position: '', shortName: '', legalForm: '', registrationDate: null, registrationAuthority: '', managerName: '', managerPosition: '' },
      product: { name: '', identification: '', tnVed: '', okpd2: '', gtin: '', productionType: 'Serial', batchDetails: '', storageConditions: '' },
      regulations: [], additionalInfo: '', adoptedAt: null, validUntil: null, reports: [], revision: 0,
    } });
    expect(response.ok()).toBeTruthy();
  }
  await page.getByRole('link', { name: 'Декларации', exact: true }).click();
  await searchDeclarations(page, prefix);
  await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Выбрать все декларации на странице', exact: true }).check();
  await page.getByRole('button', { name: 'В архив выбранные', exact: true }).click();
  const archive = page.getByRole('dialog', { name: 'Архивировать выбранные записи?' });
  await expect(archive).toContainText('деклараций: 2');
  await archive.getByLabel('Комментарий к архивированию').fill('Пакетная проверка');
  await archive.getByRole('button', { name: 'Отправить в архив', exact: true }).click();
  await expect(archive).toBeHidden(); await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(0);
  await page.getByRole('button', { name: 'Архив', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(2);
  await page.reload(); await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Выбрать все декларации на странице', exact: true }).check();
  await page.getByRole('button', { name: 'Восстановить выбранные', exact: true }).click();
  const restore = page.getByRole('dialog', { name: 'Восстановить из архива?' });
  await restore.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await expect(restore).toBeHidden(); await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(0);
  await page.getByRole('button', { name: /^В работе/ }).click();
  await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Выбрать все декларации на странице', exact: true }).check();
  await page.getByRole('button', { name: 'В архив выбранные', exact: true }).click();
  await archive.getByRole('button', { name: 'Отправить в архив', exact: true }).click();
  await expect(archive).toBeHidden();
  await page.getByRole('button', { name: 'Архив', exact: true }).click();
  await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Выбрать все декларации на странице', exact: true }).check();
  await page.getByRole('button', { name: 'Удалить выбранные навсегда', exact: true }).click();
  const purge = page.getByRole('dialog', { name: 'Удалить из архива навсегда?' });
  await expect(purge.getByRole('button', { name: 'Удалить навсегда', exact: true })).toBeDisabled();
  await purge.getByLabel('Для подтверждения введите УДАЛИТЬ').fill('УДАЛИТЬ');
  await purge.getByRole('button', { name: 'Удалить навсегда', exact: true }).click();
  await expect(purge).toBeHidden(); await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(0);
});

test('bulk company archive, restore and cleanup on mobile preserve the selected workspace', async ({ page }) => {
  const auth = await login(page); const firmId = auth.user.firms[0].id;
  const prefix = `Массовая проверка компаний ${Date.now()}`;
  for (let i = 1; i <= 2; i++) {
    const response = await page.request.post(`/api/firms/${firmId}/organizations/`, { headers: { Authorization: `Bearer ${auth.accessToken}` }, data: { kind: 'Both', name: `${prefix} ${i}`, autoRefresh: false } });
    expect(response.ok()).toBeTruthy();
  }
  await page.getByRole('link', { name: 'Справочники', exact: true }).click();
  await page.getByRole('textbox', { name: 'Поиск в справочнике', exact: true }).fill(prefix);
  await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Выбрать все найденные компании', exact: true }).check();
  await page.getByRole('button', { name: 'В архив выбранные', exact: true }).click();
  const archive = page.getByRole('dialog', { name: 'Архивировать выбранные записи?' });
  await expect(archive).toContainText('компаний: 2');
  await archive.getByLabel('Комментарий к архивированию').fill('Компании обработаны');
  await archive.getByRole('button', { name: 'Отправить в архив', exact: true }).click();
  await expect(archive).toBeHidden(); await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(0);
  await page.getByRole('tab', { name: 'Архив компаний', exact: true }).click();
  await page.getByRole('textbox', { name: 'Поиск в справочнике', exact: true }).fill(prefix);
  await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(2);
  await expect(page.getByRole('row').filter({ hasText: prefix }).first()).toContainText('Компании обработаны');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('checkbox', { name: 'Выбрать все найденные компании', exact: true }).check();
  await page.getByRole('button', { name: 'Восстановить выбранные', exact: true }).click();
  const restore = page.getByRole('dialog', { name: 'Восстановить из архива?' });
  await restore.getByLabel('Комментарий к восстановлению').fill('Возвращены в справочник');
  await restore.getByRole('button', { name: 'Восстановить', exact: true }).click();
  await expect(restore).toBeHidden(); await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(0);
  await page.getByRole('tab', { name: /^Компании ·/ }).click();
  await page.getByRole('textbox', { name: 'Поиск в справочнике', exact: true }).fill(prefix);
  await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Выбрать все найденные компании', exact: true }).check();
  await page.getByRole('button', { name: 'В архив выбранные', exact: true }).click();
  await archive.getByRole('button', { name: 'Отправить в архив', exact: true }).click();
  await expect(archive).toBeHidden();
  await page.getByRole('tab', { name: 'Архив компаний', exact: true }).click();
  await page.getByRole('textbox', { name: 'Поиск в справочнике', exact: true }).fill(prefix);
  await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(2);
  await page.getByRole('checkbox', { name: 'Выбрать все найденные компании', exact: true }).check();
  await page.getByRole('button', { name: 'Удалить выбранные навсегда', exact: true }).click();
  const purge = page.getByRole('dialog', { name: 'Удалить из архива навсегда?' });
  await purge.getByLabel('Для подтверждения введите УДАЛИТЬ').fill('УДАЛИТЬ');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const screenshotDir = path.resolve('..', 'artifacts', 'screenshots'); fs.mkdirSync(screenshotDir, { recursive: true });
  await page.screenshot({ path: path.join(screenshotDir, 'bulk-archive-cleanup-mobile.png'), animations: 'disabled' });
  await purge.getByRole('button', { name: 'Удалить навсегда', exact: true }).click();
  await expect(purge).toBeHidden(); await expect(page.getByRole('row').filter({ hasText: prefix })).toHaveCount(0);
});



