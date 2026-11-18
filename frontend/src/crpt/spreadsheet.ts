import { unzipSync, zipSync, strToU8, strFromU8 } from 'fflate';
import type { CatalogCardRequest } from '../marking/lib/honest-sign/catalogTypes';

export const cardColumns = [
  'GTIN',
  'Наименование',
  'Бренд',
  'ТН ВЭД',
  'Группа',
  'Категория',
  'Тип',
  'GTIN вложения',
  'Количество',
  'Характеристики JSON',
  'Упаковки JSON',
  'Изображения JSON',
];
const escapeXml = (text: string) =>
  text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
const columnName = (index: number): string =>
  index < 26
    ? String.fromCharCode(65 + index)
    : columnName(Math.floor(index / 26) - 1) + columnName(index % 26);
export function downloadFile(name: string, data: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export function exportSheet(name: string, rows: string[][], sheetName = 'Карточки НК') {
  const sheet = `<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><cols>${(rows[0] ?? []).map((_, i) => `<col min="${i + 1}" max="${i + 1}" width="${i === 1 ? 50 : 24}" customWidth="1"/>`).join('')}</cols><sheetData>${rows.map((row, i) => `<row r="${i + 1}">${row.map((cell, j) => `<c r="${columnName(j)}${i + 1}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const files: Record<string, Uint8Array> = {};
  for (const [path, data] of Object.entries({
    '[Content_Types].xml':
      '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>',
    '_rels/.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>',
    'xl/worksheets/sheet1.xml': sheet,
  }))
    files[path] = strToU8(data);
  downloadFile(
    name,
    zipSync(files).slice().buffer,
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  );
}

export function parseDelimited(text: string, maximumRows = 30001): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const first = source.split(/\r?\n/, 1)[0];
  const delimiter = first.includes('\t') ? '\t' : first.includes(';') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [],
    value = '',
    quoted = false;
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') {
        value += '"';
        i++;
      } else quoted = !quoted;
    } else if (!quoted && char === delimiter) {
      row.push(value);
      value = '';
      if (row.length > 100) throw new Error('В таблице слишком много столбцов.');
    } else if (!quoted && (char === '\n' || char === '\r')) {
      if (char === '\r' && source[i + 1] === '\n') i++;
      row.push(value);
      if (row.some((x) => x.trim())) rows.push(row);
      if (rows.length > maximumRows) throw new Error(`В таблице больше ${maximumRows} строк.`);
      row = [];
      value = '';
    } else value += char;
  }
  if (quoted) throw new Error('В CSV не закрыта кавычка.');
  row.push(value);
  if (row.some((x) => x.trim())) rows.push(row);
  if (rows.length > maximumRows) throw new Error(`В таблице больше ${maximumRows} строк.`);
  return rows;
}
const xmlDocument = (bytes: Uint8Array) => {
  const source = strFromU8(bytes);
  if (/<!DOCTYPE|<!ENTITY/i.test(source))
    throw new Error('DTD и объявления сущностей в XLSX не поддерживаются.');
  const xml = new DOMParser().parseFromString(source, 'application/xml');
  if (xml.querySelector('parsererror')) throw new Error('Файл XLSX содержит повреждённый XML.');
  return xml;
};
export async function readSheet(file: File): Promise<string[][]> {
  if (file.size > 8 * 1024 * 1024) throw new Error('Максимальный размер файла — 8 МБ.');
  if (!file.name.toLowerCase().endsWith('.xlsx')) return parseDelimited(await file.text(), 1001);
  let expanded = 0;
  const files = unzipSync(new Uint8Array(await file.arrayBuffer()), {
    filter: (entry) => {
      expanded += entry.originalSize;
      if (expanded > 24 * 1024 * 1024 || entry.originalSize > 12 * 1024 * 1024)
        throw new Error('Распакованный XLSX слишком велик.');
      return /^(xl\/(sharedStrings\.xml|worksheets\/[^/]+\.xml|workbook\.xml|_rels\/workbook\.xml\.rels))$/.test(
        entry.name,
      );
    },
  });
  const workbook = files['xl/workbook.xml'];
  const rels = files['xl/_rels/workbook.xml.rels'];
  if (!workbook || !rels) throw new Error('Не найден рабочий лист XLSX.');
  const first = xmlDocument(workbook).getElementsByTagName('sheet')[0];
  const id = first?.getAttribute('r:id');
  const target = Array.from(xmlDocument(rels).getElementsByTagName('Relationship'))
    .find((x) => x.getAttribute('Id') === id)
    ?.getAttribute('Target');
  const path = target?.startsWith('/') ? target.slice(1) : `xl/${target}`;
  const sheet = files[path];
  if (!sheet) throw new Error('Не найден первый лист XLSX.');
  const shared = files['xl/sharedStrings.xml']
    ? Array.from(xmlDocument(files['xl/sharedStrings.xml']).getElementsByTagName('si')).map(
        (x) => x.textContent ?? '',
      )
    : [];
  const sheetRows = xmlDocument(sheet).getElementsByTagName('row');
  if (sheetRows.length > 1001) throw new Error('В таблице больше 1000 строк.');
  const result = Array.from(sheetRows)
    .map((row) => {
      const values: string[] = [];
      for (const cell of Array.from(row.getElementsByTagName('c'))) {
        const label = cell.getAttribute('r')?.match(/^[A-Z]+/)?.[0] ?? 'A';
        const index = [...label].reduce((n, c) => n * 26 + c.charCodeAt(0) - 64, 0) - 1;
        if (index > 100) throw new Error('В таблице слишком много столбцов.');
        if (cell.getElementsByTagName('f').length)
          throw new Error('Замените формулы значениями перед импортом.');
        const value = cell.getElementsByTagName('v')[0]?.textContent ?? '';
        values[index] =
          cell.getAttribute('t') === 's'
            ? (shared[Number(value)] ?? '')
            : cell.getAttribute('t') === 'inlineStr'
              ? (cell.getElementsByTagName('is')[0]?.textContent ?? '')
              : value;
      }
      return values;
    })
    .filter((row) => row.some((x) => x?.trim()));
  if (result.length > 1001) throw new Error('В таблице больше 1000 строк.');
  return result;
}

export function importCards(rows: string[][]): CatalogCardRequest[] {
  if (rows.length < 2) throw new Error('Заполните хотя бы одну карточку под заголовками шаблона.');
  const headers = rows[0].map((x) => x?.trim());
  for (const key of ['GTIN', 'Наименование', 'Бренд', 'ТН ВЭД', 'Группа', 'Категория', 'Тип'])
    if (!headers.includes(key))
      throw new Error(`В таблице отсутствует столбец «${key}». Скачайте шаблон.`);
  const cards: CatalogCardRequest[] = [];
  const seen = new Map<string, CatalogCardRequest>();
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index];
    const get = (key: string) => (row[headers.indexOf(key)] ?? '').trim();
    const type = get('Тип').toLowerCase();
    const gtin = get('GTIN');
    const parse = <T>(name: string, empty: T): T => {
      try {
        const text = get(name);
        return text ? (JSON.parse(text) as T) : empty;
      } catch {
        throw new Error(`Строка ${index + 1}: некорректный JSON в столбце «${name}».`);
      }
    };
    if (!['единица', 'комплект', 'набор', 'техническая', 'индустриальная'].includes(type))
      throw new Error(`Строка ${index + 1}: неизвестный тип карточки.`);
    if (gtin && !/^\d{8}$|^\d{12,14}$/.test(gtin))
      throw new Error(`Строка ${index + 1}: GTIN должен быть текстом из 8, 12, 13 или 14 цифр.`);
    let card = gtin ? seen.get(gtin.padStart(14, '0')) : undefined;
    if (
      card &&
      (type !== 'набор' ||
        !card.isSet ||
        (get('Наименование') && get('Наименование') !== card.name) ||
        (get('Бренд') && get('Бренд') !== card.brand) ||
        (get('ТН ВЭД') && get('ТН ВЭД') !== card.tnved))
    )
      throw new Error(`Строка ${index + 1}: повтор GTIN с другим товаром.`);
    if (!card) {
      if (
        !get('Наименование') ||
        !get('Бренд') ||
        !/^\d{4,10}$/.test(get('ТН ВЭД')) ||
        !/^\d+$/.test(get('Группа')) ||
        !/^\d+$/.test(get('Категория')) ||
        Number(get('Группа')) < 1 ||
        Number(get('Категория')) < 1
      )
        throw new Error(
          `Строка ${index + 1}: заполните название, бренд, ТН ВЭД, группу и категорию.`,
        );
      if (!gtin && !['техническая', 'индустриальная'].includes(type))
        throw new Error(`Строка ${index + 1}: укажите GTIN.`);
      card = {
        requestId: crypto.randomUUID(),
        gtin,
        name: get('Наименование'),
        brand: get('Бренд'),
        tnved: get('ТН ВЭД'),
        productGroupCode: Number(get('Группа')),
        categoryId: Number(get('Категория')),
        sendToModeration: false,
        photoUrl: null,
        isSet: type === 'набор',
        isKit: type === 'комплект',
        isTechGtin: type === 'техническая',
        isSim: type === 'индустриальная',
        attributes: parse('Характеристики JSON', []),
        identifiers: parse('Упаковки JSON', null),
        images: parse('Изображения JSON', null),
        setGtins: [],
      };
      if (
        !Array.isArray(card.attributes) ||
        (card.identifiers !== null && !Array.isArray(card.identifiers)) ||
        (card.images !== null && !Array.isArray(card.images))
      )
        throw new Error(`Строка ${index + 1}: JSON должен содержать массив.`);
      cards.push(card);
      if (gtin) seen.set(gtin.padStart(14, '0'), card);
    }
    const content = get('GTIN вложения');
    if (content) {
      if (
        !card.isSet ||
        !/^\d{8}$|^\d{12,14}$/.test(content) ||
        !/^\d+$/.test(get('Количество')) ||
        Number(get('Количество')) < 1
      )
        throw new Error(`Строка ${index + 1}: проверьте GTIN вложения и количество набора.`);
      const normalized = content.padStart(14, '0');
      if (card.setGtins?.some((x) => x.gtin === normalized))
        throw new Error(
          `Строка ${index + 1}: вложение повторяется в наборе. Укажите количество в одной строке.`,
        );
      card.setGtins!.push({ gtin: normalized, quantity: Number(get('Количество')) });
    }
  }
  if (cards.length > 500) throw new Error('В одном пакете может быть до 500 карточек.');
  return cards;
}

export function cardsToRows(cards: CatalogCardRequest[]) {
  return [
    cardColumns,
    ...cards.flatMap((card) =>
      (card.setGtins?.length ? card.setGtins : [null]).map((content, i) => [
        card.gtin,
        i ? '' : card.name,
        i ? '' : card.brand,
        i ? '' : card.tnved,
        String(card.productGroupCode ?? ''),
        String(card.categoryId),
        card.isSet
          ? 'Набор'
          : card.isKit
            ? 'Комплект'
            : card.isTechGtin
              ? 'Техническая'
              : card.isSim
                ? 'Индустриальная'
                : 'Единица',
        content?.gtin ?? '',
        content ? String(content.quantity) : '',
        i ? '' : JSON.stringify(card.attributes),
        i ? '' : JSON.stringify(card.identifiers ?? null),
        i ? '' : JSON.stringify(card.images ?? null),
      ]),
    ),
  ];
}

export function similarCard(card: CatalogCardRequest): CatalogCardRequest {
  return {
    ...structuredClone(card),
    requestId: crypto.randomUUID(),
    gtin: '',
    identifiers: [],
    sendToModeration: false,
    attributes: card.attributes
      .filter(
        (x) =>
          !x.packageGenerateOrder &&
          (!x.gtin || x.gtin.padStart(14, '0') === card.gtin.padStart(14, '0')),
      )
      .map(({ gtin: _gtin, packageGenerateOrder: _order, ...value }) => value),
    images:
      card.images?.filter((x) => !x.identifier).map((x) => ({ ...x, identifier: null })) ?? [],
    photoUrl: card.photoUrl,
  };
}
