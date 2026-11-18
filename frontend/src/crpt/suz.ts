import { parseDelimited } from './spreadsheet';

export type SuzRow = {
  id: string;
  group: string;
  gtin: string;
  quantity: string;
  cis: string;
  release: string;
  payment: string;
  template: string;
  name: string;
  producer: string;
  production: string;
};
export type SuzReceipt = {
  id: string;
  kind: string;
  state: string;
  name: string;
  createdAtUtc: string;
  body: string | null;
  certificateThumbprint: string;
  expiresAtUtc: string;
  orderId: string | null;
  gtin: string | null;
  blockId: string | null;
  codesCount: number;
  sources: string[];
  codes?: string[];
  message?: string;
};
export type SuzCatalogItem = {
  gtin: string;
  name: string;
  cisType: string;
  status: string;
  contents: { gtin: string; quantity: number }[];
};
export type SuzProduct = {
  gtin: string | null;
  totalCodes: number | null;
  status: string | null;
  availableCodes?: number | null;
  totalPassed?: number | null;
  rejectionReason?: string | null;
  expiredAtUtc?: string | null;
  cisType?: string | null;
};
export type SuzOrder = {
  orderId: string;
  status: string;
  productionOrderId: string | null;
  createdAtUtc: string | null;
  totalCodes: number | null;
  usedCodes: number | null;
  remainingCodes: number | null;
  declineReason: string | null;
  products: SuzProduct[];
};
export const releaseOptions = {
  PRODUCTION: 'Производство в РФ',
  IMPORT: 'Импорт в РФ',
  REMAINS: 'Маркировка остатков',
  REMARK: 'Перемаркировка',
  COMMISSION: 'Комиссионная торговля',
  REAPPLY: 'Вне производства или импорта',
};
export const cisOptions = {
  UNIT: 'Единица',
  GROUP: 'Групповая упаковка',
  SET: 'Набор',
  BUNDLE: 'Комплект',
  ATK: 'АТК',
};
export const orderStatuses: Record<string, string> = {
  CREATED: 'Создан',
  PENDING: 'В очереди',
  APPROVED: 'Одобрен',
  READY: 'Готов',
  CLOSED: 'Закрыт',
  DECLINED: 'Отклонён',
};
export const bufferStatuses: Record<string, string> = {
  PENDING: 'Готовится',
  ACTIVE: 'Доступен',
  EXHAUSTED: 'Коды исчерпаны',
  REJECTED: 'Отказ в эмиссии',
  CLOSED: 'Закрыт',
};
export const operationStatuses: Record<string, string> = {
  Prepared: 'Ожидает подписи',
  Sending: 'Отправка — проверьте результат',
  Unknown: 'Результат неизвестен',
  Rejected: 'Отклонено СУЗ',
  Accepted: 'Выполнено',
};
export const suzColumns = [
  'Группа',
  'GTIN',
  'Способ выпуска',
  'Количество',
  'Тип КМ',
  'Оплата',
  'ID шаблона',
  'Наименование',
  'ИНН производителя',
  'Производственный заказ',
];
export const blankSuzRow = (group = ''): SuzRow => ({
  id: crypto.randomUUID(),
  group,
  gtin: '',
  quantity: '1',
  cis: 'UNIT',
  release: 'PRODUCTION',
  payment: '2',
  template: '',
  name: '',
  producer: '',
  production: '',
});
export function suzRowsToSheet(rows: SuzRow[]) {
  return [
    suzColumns,
    ...rows.map((x) => [
      x.group,
      x.gtin,
      x.release,
      x.quantity,
      x.cis,
      x.payment,
      x.template,
      x.name,
      x.producer,
      x.production,
    ]),
  ];
}
export function importSuzRows(sheet: string[][]): SuzRow[] {
  if (sheet.length < 2 || sheet.length > 1001)
    throw new Error('Заполните от 1 до 1000 строк шаблона.');
  const header = sheet[0].map((x) => x.trim());
  for (const key of suzColumns.slice(0, 7))
    if (!header.includes(key)) throw new Error(`Нет столбца «${key}». Используйте шаблон СУЗ.`);
  const result = sheet.slice(1).map((line) => {
    const get = (key: string) => (line[header.indexOf(key)] ?? '').trim();
    return {
      id: crypto.randomUUID(),
      group: get('Группа'),
      gtin: get('GTIN'),
      release: get('Способ выпуска'),
      quantity: get('Количество'),
      cis: get('Тип КМ'),
      payment: get('Оплата'),
      template: get('ID шаблона'),
      name: get('Наименование'),
      producer: get('ИНН производителя'),
      production: get('Производственный заказ'),
    };
  });
  buildSuzOrders(result);
  return result;
}
export type SuzBatchOrder = {
  requestId: string;
  payload: {
    productGroup: string;
    attributes: { releaseMethodType: string; paymentType: number; productionOrderId?: string };
    products: {
      gtin: string;
      quantity: number;
      cisType: string;
      templateId: number;
      serialNumberType: string;
      attributes?: { producer: string };
    }[];
  };
};
export function buildSuzOrders(rows: SuzRow[]): SuzBatchOrder[] {
  if (!rows.length || rows.length > 1000) throw new Error('Добавьте от 1 до 1000 товаров.');
  const groups = new Map<string, SuzRow[]>();
  const seen = new Set<string>();
  rows.forEach((row, index) => {
    const error = (message: string): never => {
      throw new Error(`Строка ${index + 1}: ${message}`);
    };
    if (!/^[a-zA-Z0-9_-]{1,64}$/.test(row.group)) error('выберите товарную группу.');
    if (!/^[0-9]{14}$/.test(row.gtin))
      error('GTIN должен содержать 14 цифр, включая ведущие нули.');
    if (
      !/^[0-9]+$/.test(row.quantity) ||
      Number(row.quantity) < 1 ||
      Number(row.quantity) > 2_000_000
    )
      error('количество от 1 до 2 000 000.');
    if (
      !(row.release in releaseOptions) ||
      !(row.cis in cisOptions) ||
      !['1', '2'].includes(row.payment)
    )
      error('проверьте способ выпуска, оплату и тип КМ.');
    if (
      !/^[0-9]+$/.test(row.template) ||
      Number(row.template) < 1 ||
      !Number.isSafeInteger(Number(row.template))
    )
      error('выберите шаблон кода по товарной группе.');
    if (row.producer && !/^[0-9]{10}([0-9]{2})?$/.test(row.producer))
      error('ИНН производителя — 10 или 12 цифр.');
    if (
      row.production.length > 256 ||
      /[\x00-\x1f]/.test(row.production) ||
      (row.production && !row.production.trim())
    )
      error('проверьте производственный заказ.');
    const key = JSON.stringify([row.group, row.release, row.payment, row.production]);
    if (seen.has(key + row.gtin))
      error('GTIN повторяется с теми же параметрами заказа. Объедините количество в одной строке.');
    seen.add(key + row.gtin);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  });
  const result: SuzBatchOrder[] = [];
  const push = (chunk: SuzRow[]) => {
    const first = chunk[0];
    result.push({
      requestId: crypto.randomUUID(),
      payload: {
        productGroup: first.group,
        attributes: {
          releaseMethodType: first.release,
          paymentType: Number(first.payment),
          ...(first.production ? { productionOrderId: first.production } : {}),
        },
        products: chunk.map((x) => ({
          gtin: x.gtin,
          quantity: Number(x.quantity),
          cisType: x.cis,
          templateId: Number(x.template),
          serialNumberType: 'OPERATOR',
          ...(x.producer ? { attributes: { producer: x.producer } } : {}),
        })),
      },
    });
  };
  for (const group of groups.values()) {
    const large = group.filter((x) => Number(x.quantity) > 150000);
    large.forEach((x) => push([x]));
    const normal = group.filter((x) => Number(x.quantity) <= 150000);
    for (let i = 0; i < normal.length; i += 10) push(normal.slice(i, i + 10));
  }
  return result;
}
export function codesCsv(codes: string[]) {
  return '\uFEFFcode\r\n' + codes.map((x) => `"${x.replaceAll('"', '""')}"`).join('\r\n');
}
export function parseSuzCodes(text: string): string[] {
  const raw = text.replace(/^\uFEFF/, '');
  let codes: unknown;
  if (raw.trimStart().startsWith('[')) {
    codes = JSON.parse(raw);
  } else if (/^(code|codes|Код|Код маркировки)[\r\n;]/i.test(raw) || raw.startsWith('"')) {
    const rows = parseDelimited(raw);
    if (rows.some((x) => x.length !== 1))
      throw new Error('Ожидается CSV с одним столбцом полных кодов.');
    codes = rows.map((x) => x[0]);
    if (/^(code|codes|Код|Код маркировки)$/i.test((codes as string[])[0]))
      (codes as string[]).shift();
  } else codes = raw.split(/\r?\n/).filter((x) => x !== '');
  if (
    !Array.isArray(codes) ||
    codes.length < 1 ||
    codes.length > 30000 ||
    codes.some(
      (x) =>
        typeof x !== 'string' ||
        x.length > 2048 ||
        !/^(?:(?:\]d2)?01[0-9]{14}21.+|[0-9]{14}.{11,})$/.test(x) ||
        /[\x00-\x1c\x1e-\x1f]/.test(x),
    )
  )
    throw new Error(
      'Файл должен содержать от 1 до 30 000 полных GS1 или non-GS1 кодов. Сохраните разделители GS.',
    );
  return codes as string[];
}
