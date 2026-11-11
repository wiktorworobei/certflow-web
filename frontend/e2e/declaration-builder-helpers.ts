import { expect, type Page } from '@playwright/test';
import type { SaveDeclaration } from '../src/types';

export async function createDeclarationDraft(page: Page, title = 'Тестовый черновик декларации') {
  const dialog = page.getByRole('dialog', { name: 'Новая декларация', exact: true });
  await dialog.getByRole('textbox', { name: 'Название декларации', exact: true }).fill(title);
  await dialog.getByRole('button', { name: 'Продолжить', exact: true }).click();
  await expect(dialog).toBeHidden();
  await expect(page).toHaveURL(/declarations\/[a-f0-9-]+(?:\?.*)?$/);
  await expect(page.getByRole('textbox', { name: 'Название декларации', exact: true })).toBeVisible();
}

export async function openDeclarationPart(page: Page, name: string) {
  const fragments: Record<string,string> = { 'Заявитель':'Заявитель','Изготовитель':'Изготовитель','Продукция':'заявляет, что','ГОСТы/Тех.регламент':'соответствует требованиям','ДЕКЛАРАЦИЯ':'Схема декларирования соответствия' };
  if (name in fragments) {
    await page.getByRole('button',{name:`Редактировать: ${fragments[name]}`,exact:true}).first().click();
    if (name === 'Заявитель' || name === 'Изготовитель') {
      const details=page.locator('.builder-requisites'); if (await details.count() && !await details.getAttribute('open').then(value=>value!==null)) await details.locator(':scope > summary').click();
      const extra=details.locator('details'); if(await extra.count() && !await extra.getAttribute('open').then(value=>value!==null)) await extra.locator(':scope > summary').click();
    } return;
  }
  if(name === 'Основные') { await page.getByRole('button',{name:'Редактировать: Дата принятия декларации о соответствии',exact:true}).first().click(); name='Организация работы'; }
  const cases:Record<string,string>={'Организация работы':'main','Отбор / Испытания (ПИ) / Анализ пр-ва':'testing','Сканы':'scans','Заявка/Документы':'application','Опись/Закрытие':'closure','Публикация ФГИС':'fgis','Foreign':'foreign'};
  const groups:Record<string,string>={main:'Данные дела',application:'Данные дела',foreign:'Данные дела',testing:'Испытания и основания',scans:'Файлы и приложения',closure:'Файлы и приложения',fgis:'Публикация'};
  await page.getByRole('tab',{name:groups[cases[name]],exact:true}).click();
  const details=page.locator(`#declaration-case-${cases[name]}`); await expect(details).toBeAttached(); if(await details.getAttribute('open')===null) await details.locator(':scope > summary').click();
}
export const organizationLookupSurface = (page: Page) => page.getByRole('dialog',{name:'Поиск реквизитов в DaData',exact:true}).or(page.getByRole('region',{name:'Поиск реквизитов в DaData',exact:true}));

// Layout fixture for isolated UI tests; real pagination/export parity is tested through the API.
export function printLayoutFixture(d: SaveDeclaration) {
  const fields=[['Заявитель',d.applicant.name],['Место нахождения и адрес места осуществления деятельности',d.applicant.address],['Основной государственный регистрационный номер',d.applicant.ogrn],['Контактные сведения',d.applicant.email],['в лице',d.applicant.signatory],['заявляет, что',d.product.name],['Изготовитель',d.manufacturer.name],['Место нахождения и адрес места осуществления деятельности по изготовлению продукции',d.manufacturer.address],['Код (коды) ТН ВЭД ЕАЭС',d.product.tnVed],['production','Серийный выпуск'],['соответствует требованиям',d.regulations.join('\n')],['Декларация о соответствии принята на основании',d.reports.map(r=>r.number).join(', ')],['Схема декларирования соответствия',d.scheme],['Дополнительная информация',d.additionalInfo],['Дата принятия декларации о соответствии',d.adoptedAt],['Декларация о соответствии действительна до',d.validUntil],['Подпись заявителя',d.applicant.signatory]].map(([key,text])=>({key:key!,label:key!,text:d.workspace?.printOverrides?.[key!]??text??'не указано'}));
  return {width:595.28,height:841.89,fields,pages:[{images:[],lines:fields.map((field,i)=>({key:field.key,y:100+i*30,size:10,family:'Noto Serif',runs:[{text:`${field.label} ${field.text}`,x:50,bold:false}]}))}]};
}
