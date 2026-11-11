import type { Declaration, Party } from './types';

export interface FgisField {
  key: string; label: string; group: string; aliases: string[]; value: string; kind: 'text' | 'date' | 'choice';
}
export interface FgisPayload {
  version: 1; declarationId: string; reference: string; revision: number; createdAt: string; fields: FgisField[];
}
export interface FgisTab { id: number; title: string }
export interface FgisFieldResult { key: string; label: string; status: 'filled' | 'unchanged' | 'missing' | 'conflict' | 'manual' | 'error'; message: string }
export interface FgisTransferResult { fields: FgisFieldResult[]; reference: string }
export interface FgisBridgeResponse { version: number; tabs?: FgisTab[]; result?: FgisTransferResult; mapping?: boolean }

export function fgisPayload(document: Declaration): FgisPayload {
  const fields: FgisField[] = [];
  const add = (key: string, label: string, group: string, value: string | null | undefined, aliases: string[] = [], kind: FgisField['kind'] = 'text') => {
    if (value?.trim()) fields.push({ key, label, group, value: value.trim(), aliases, kind });
  };
  function party(key: 'applicant' | 'manufacturer', group: string, value: Party) {
    const items: [keyof Party, string, string[]][] = [
      ['name', 'Полное наименование', ['Наименование', 'Наименование юридического лица']], ['shortName', 'Сокращённое наименование', []],
      ['inn', 'ИНН', []], ['ogrn', 'ОГРН / ОГРНИП', ['ОГРН', 'ОГРНИП', 'Основной государственный регистрационный номер']], ['kpp', 'КПП', []],
      ['country', 'Страна', ['Страна регистрации']], ['address', 'Адрес', ['Адрес места нахождения', 'Юридический адрес']],
      ['email', 'Электронная почта', ['E-mail', 'Email', 'Адрес электронной почты']], ['phone', 'Телефон', ['Номер телефона']],
      ['signatory', 'ФИО подписанта', ['ФИО руководителя', 'Фамилия, имя, отчество руководителя']], ['position', 'Должность подписанта', ['Должность руководителя']],
      ['registrationDate', 'Дата регистрации', []], ['registrationAuthority', 'Регистрирующий орган', []],
    ];
    for (const [property, label, aliases] of items) add(`${key}.${property}`, label, group, value[property], aliases,
      property === 'registrationDate' ? 'date' : property === 'country' ? 'choice' : 'text');
  }
  party('applicant', 'Заявитель', document.applicant); party('manufacturer', 'Изготовитель', document.manufacturer);
  add('kind', 'Вид документа', 'Декларация', document.kind, ['Тип декларации'], 'choice');
  add('scheme', 'Схема декларирования', 'Декларация', document.scheme, ['Схема декларирования соответствия'], 'choice');
  add('product.name', 'Наименование продукции', 'Продукция', document.product.name, ['Полное наименование продукции']);
  add('product.identification', 'Идентификация продукции', 'Продукция', document.product.identification, ['Сведения, обеспечивающие идентификацию продукции']);
  add('product.tnVed', 'Код ТН ВЭД ЕАЭС', 'Продукция', document.product.tnVed, ['Код ТН ВЭД', 'ТН ВЭД ЕАЭС'], 'choice');
  add('product.okpd2', 'Код ОКПД 2', 'Продукция', document.product.okpd2, ['ОКПД 2', 'ОКПД2'], 'choice');
  add('product.gtin', 'GTIN', 'Продукция', document.product.gtin);
  add('product.productionType', 'Тип выпуска продукции', 'Продукция', { Serial: 'Серийный выпуск', Batch: 'Партия', Single: 'Единичное изделие' }[document.product.productionType], ['Тип объекта декларирования'], 'choice');
  add('product.batchDetails', 'Сведения о партии', 'Продукция', document.product.batchDetails);
  add('product.storageConditions', 'Условия хранения', 'Продукция', document.product.storageConditions);
  add('regulations', 'Технические регламенты', 'Декларация', document.regulations.join('\n'), ['Технический регламент'], 'choice');
  add('adoptedAt', 'Дата принятия декларации', 'Декларация', document.adoptedAt, ['Дата принятия декларации о соответствии'], 'date');
  add('validUntil', 'Дата окончания действия декларации', 'Декларация', document.validUntil, ['Срок действия до', 'Дата окончания срока действия'], 'date');
  add('additionalInfo', 'Дополнительная информация', 'Декларация', document.additionalInfo);
  add('evidence.legalBasis', 'Нормативное основание', 'Основания', document.evidence?.legalBasis);
  add('evidence.standards', 'Стандарты и методы испытаний', 'Основания', document.evidence?.standards);
  document.reports.forEach((report, i) => {
    const group = `Протокол ${i + 1}`;
    add(`reports.${i}.number`, 'Номер протокола испытаний', group, report.number, ['Номер протокола']);
    add(`reports.${i}.date`, 'Дата протокола испытаний', group, report.date, ['Дата протокола'], 'date');
    add(`reports.${i}.laboratoryName`, 'Наименование испытательной лаборатории', group, report.laboratoryName);
    add(`reports.${i}.accreditationNumber`, 'Номер аккредитации лаборатории', group, report.accreditationNumber);
  });
  // Internal titles, print overrides, credentials and registration metadata are never sent.
  return { version: 1, declarationId: document.id, reference: document.reference, revision: document.revision, createdAt: new Date().toISOString(), fields };
}

export function requestFgis(action: 'status' | 'fill' | 'map', args: { tabId?: number; payload?: FgisPayload } = {}): Promise<FgisBridgeResponse> {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => { cleanup(); reject(new Error(action === 'status'
      ? 'Расширение не подключено. Установите «ZNAQ → ФГИС» и подключите эту вкладку ZNAQ через его значок.'
      : 'Ответ расширения не получен. Проверьте кабинет ФГИС перед повтором: часть полей могла заполниться.')); }, action === 'status' ? 1800 : 30000);
    const cleanup = () => { window.clearTimeout(timer); window.removeEventListener('message', receive); };
    function receive(event: MessageEvent) {
      if (event.source !== window || event.origin !== location.origin || event.data?.channel !== 'znaq-fgis-response' || event.data.requestId !== requestId) return;
      cleanup();
      if (event.data.error) reject(new Error(event.data.error));
      else if (event.data.response?.version !== 1) reject(new Error('Обновите расширение «ZNAQ → ФГИС».'));
      else resolve(event.data.response);
    }
    window.addEventListener('message', receive);
    window.postMessage({ channel: 'znaq-fgis-request', requestId, action, ...args }, location.origin);
  });
}
