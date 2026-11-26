import { toTrueApiInformationCode } from '../marking/lib/honest-sign/codeNormalization';
import { parseCodesCheckText } from '../marking/lib/honest-sign/codesCheckFiles';

export type TurnoverOperation = 'Introduction' | 'Withdrawal';
export type TurnoverType = { documentType: string; operation: TurnoverOperation };
export type TurnoverState =
  'Prepared' | 'Sending' | 'Submitted' | 'Accepted' | 'Rejected' | 'OutcomeUnknown';
export type TurnoverReceipt = {
  id: string;
  requestId?: string;
  operation: TurnoverOperation | 'SuzReport';
  documentType: string;
  productGroup: string;
  participantInn: string;
  state: TurnoverState;
  payloadHash: string;
  documentJson: string | null;
  certificateThumbprint?: string | null;
  codesCount: number;
  externalDocumentId: string | null;
  externalStatus: string | null;
  error: string | null;
  createdAtUtc: string;
  updatedAtUtc: string;
  lastCheckedAtUtc?: string | null;
  statusCheckError?: string | null;
};
export type TurnoverCapabilities = {
  participantInn: string;
  documentTypes: TurnoverType[];
  maxCodes: number;
  maxDocumentBytes: number;
  withdrawalReasons: string[];
  productGroupRules?:
    | {
        productGroup: string;
        introductionDocumentTypes: string[];
        withdrawalReasons: string[];
        supportsOsu: boolean;
      }[]
    | null;
};
export type TurnoverCodeInfo = {
  requestedCode: string;
  cis: string | null;
  productGroup: string | null;
  tnVedCode?: string | null;
  producedDate?: string | null;
  packageType?: string | null;
  productName?: string | null;
  errorCode: string | null;
  errorMessage: string | null;
};

export const turnoverNames: Record<string, string> = {
  LP_INTRODUCE_GOODS: 'Производство в России',
  LP_GOODS_IMPORT: 'Производство вне ЕАЭС',
  LK_CONTRACT_COMMISSIONING: 'Контрактное производство',
  CROSSBORDER: 'Трансграничная торговля',
  LP_FTS_INTRODUCE: 'Импорт с ФТС',
  LK_UNIVERSAL_INTRODUCE: 'Ввод с указанием причины',
  FURS_CROSSBORDER: 'Трансграничная торговля мехом',
  LP_INTRODUCE_OST: 'Маркировка остатков',
  LK_INDI_COMMISSIONING: 'Получение от физических лиц',
  FURS_FTS_INTRODUCE: 'Импорт меха с ФТС',
  LK_RECEIPT: 'Поэкземплярный вывод',
  LK_GTIN_RECEIPT: 'Объёмно-сортовой вывод',
};
const reasons: Record<string, string> = {
  BALANCE_CORRECTION: 'Корректировка остатков',
  BEYOND_EEC_EXPORT: 'Экспорт за пределы ЕАЭС',
  BY_SAMPLES: 'Продажа по образцам',
  CAR_SERVICE_USE: 'Использование в автосервисе',
  CONFISCATION: 'Конфискация',
  DESTRUCTION: 'Уничтожение',
  DISTANCE: 'Дистанционная продажа',
  DONATION: 'Безвозмездная передача',
  EAS_TRADE: 'Продажа в ЕАЭС',
  EXPIRATION: 'Истечение срока годности',
  LOSS: 'Утрата',
  OTHER: 'Иная причина',
  OWN_USE: 'Собственные нужды',
  PACKING: 'Упаковка',
  PRODUCTION_USE: 'Производственные нужды',
  RETAIL: 'Розничная продажа',
  STATE_CONTRACT: 'Государственный контракт',
  STATE_SECRET: 'Государственная тайна',
  UTILIZATION: 'Утилизация',
  VENDING: 'Продажа через торговый автомат',
};
const documents: Record<string, string> = {
  RECEIPT: 'Кассовый чек',
  SALES_RECEIPT: 'Товарный чек',
  CONSIGNMENT_NOTE: 'Товарная накладная',
  UTD: 'Универсальный передаточный документ',
  CUSTOMS_DECLARATION: 'Таможенная декларация',
  DESTRUCTION_ACT: 'Акт уничтожения',
  DIGITAL_CERTIFICATE: 'Электронный сертификат',
  ORTHOPEDIC_PRODUCT_ACT: 'Акт приёма-передачи товара',
  OTHER: 'Иной документ',
};
const countries = { '051': 'Армения', '112': 'Беларусь', '398': 'Казахстан', '417': 'Киргизия' };
const taxNumberLength: Record<string, number> = { '051': 8, '112': 9, '398': 12, '417': 14 };
const retailDocuments = ['RECEIPT', 'SALES_RECEIPT', 'OTHER'];
const withdrawalDocuments: Record<string, string[]> = {
  RETAIL: retailDocuments,
  BY_SAMPLES: [...retailDocuments, 'CONSIGNMENT_NOTE', 'UTD'],
  DISTANCE: [...retailDocuments, 'CONSIGNMENT_NOTE', 'UTD'],
  BEYOND_EEC_EXPORT: ['CUSTOMS_DECLARATION', 'OTHER'],
  CONFISCATION: ['CONSIGNMENT_NOTE', 'UTD', 'OTHER'],
  DESTRUCTION: ['DESTRUCTION_ACT', 'OTHER'],
  DONATION: ['CONSIGNMENT_NOTE', 'OTHER'],
  PRODUCTION_USE: ['DIGITAL_CERTIFICATE', 'ORTHOPEDIC_PRODUCT_ACT', 'OTHER'],
};
const osuReasons = new Set([
  'BALANCE_CORRECTION',
  'BEYOND_EEC_EXPORT',
  'CONFISCATION',
  'DESTRUCTION',
  'DONATION',
  'EAS_TRADE',
  'EXPIRATION',
  'LOSS',
  'OTHER',
  'OWN_USE',
  'PRODUCTION_USE',
  'STATE_CONTRACT',
  'STATE_SECRET',
  'UTILIZATION',
]);
const introductionRows: Record<string, { array: 'products' | 'products_list'; code: string }> = {
  LP_INTRODUCE_GOODS: { array: 'products', code: 'uit_code' },
  LP_GOODS_IMPORT: { array: 'products', code: 'uit_code' },
  LK_CONTRACT_COMMISSIONING: { array: 'products_list', code: 'uit' },
  CROSSBORDER: { array: 'products_list', code: 'ki' },
  LP_FTS_INTRODUCE: { array: 'products_list', code: 'cis' },
  LK_UNIVERSAL_INTRODUCE: { array: 'products', code: 'uit_code' },
};
const metadataTypes = new Set([
  'LP_INTRODUCE_GOODS',
  'LP_GOODS_IMPORT',
  'LK_CONTRACT_COMMISSIONING',
  'CROSSBORDER',
]);
const innPattern = /^(?:\d{10}|\d{12})$/;
const tnvedPattern = /^\d{10}$/;

export type TurnoverFields = Record<string, string>;
export type TurnoverField = {
  key: string;
  label: string;
  required?: boolean;
  type?: 'date';
  options?: [string, string][];
  pattern?: RegExp;
  maxLength?: number;
};
const field = (
  key: string,
  label: string,
  options: Omit<TurnoverField, 'key' | 'label'> = {},
): TurnoverField => ({ key, label, ...options });
const required = (key: string, label: string, options: Omit<TurnoverField, 'key' | 'label'> = {}) =>
  field(key, label, { ...options, required: true });
const choices = (keys: string[], labels: Record<string, string>): [string, string][] =>
  keys.map((key) => [key, labels[key] ?? key]);
const declarationFields = [
  required('declaration_number', 'Номер декларации на товары', {
    pattern: /^\d{8}\/\d{6}\/\d{7}$/,
  }),
  required('declaration_date', 'Дата декларации на товары', { type: 'date' }),
];

export function allowedTurnoverTypes(
  caps: TurnoverCapabilities | undefined,
  group: string,
  operation: TurnoverOperation,
) {
  const rule = caps?.productGroupRules?.find((item) => item.productGroup === group);
  return (caps?.documentTypes ?? []).filter(
    (item) =>
      item.operation === operation &&
      (!rule ||
        (operation === 'Introduction'
          ? rule.introductionDocumentTypes.includes(item.documentType)
          : item.documentType !== 'LK_GTIN_RECEIPT' || rule.supportsOsu)),
  );
}

export function hasStructuredTurnover(type: string, group: string) {
  return (
    type === 'LK_RECEIPT' ||
    type === 'LK_GTIN_RECEIPT' ||
    type === 'LP_INTRODUCE_GOODS' ||
    (group === 'autofluids' && Object.hasOwn(introductionRows, type))
  );
}

export const needsTurnoverMetadata = (type: string, group: string) =>
  group === 'autofluids' && metadataTypes.has(type);

function withdrawalFields(
  type: string,
  group: string,
  caps: TurnoverCapabilities,
  values: TurnoverFields,
) {
  const osu = type === 'LK_GTIN_RECEIPT';
  const action = values.action;
  const reasonCodes =
    caps.productGroupRules?.find((item) => item.productGroup === group)?.withdrawalReasons ??
    caps.withdrawalReasons;
  const fields = [
    required('action', 'Причина вывода', {
      options: choices(
        osu ? reasonCodes.filter((item) => osuReasons.has(item)) : reasonCodes,
        reasons,
      ),
    }),
    required('action_date', 'Дата вывода', { type: 'date' }),
  ];
  if (!action) return fields;
  if (action === 'OTHER')
    fields.push(
      required('withdrawal_type_other', 'Описание причины', { maxLength: osu ? 255 : 1024 }),
    );
  if (['DONATION', 'OWN_USE', 'PRODUCTION_USE'].includes(action)) {
    fields.push(
      field('buyer_inn', 'ИНН покупателя', {
        required: action === 'DONATION',
        pattern: innPattern,
      }),
    );
  }
  if (action === 'STATE_CONTRACT' || action === 'STATE_SECRET') {
    fields.push(
      required(
        'state_contract_id',
        'Идентификатор государственного контракта',
        action === 'STATE_SECRET' ? { pattern: /^\d{12}[123]\d{12}$/ } : { maxLength: 255 },
      ),
    );
  }
  if (action === 'EAS_TRADE') {
    fields.push(
      field('destination_country_code', 'Страна назначения', {
        options: Object.entries(countries),
        required: !osu,
      }),
    );
    fields.push(field('importer_id', 'Налоговый номер импортёра', { maxLength: 14 }));
  }
  const forbidsDocument = ['EAS_TRADE', 'STATE_CONTRACT', 'STATE_SECRET'].includes(action);
  const needsDocument = osu || !['BY_SAMPLES', 'DISTANCE', 'VENDING', 'PACKING'].includes(action);
  if (!forbidsDocument) {
    const types =
      osu && action === 'PRODUCTION_USE' ? ['OTHER'] : (withdrawalDocuments[action] ?? ['OTHER']);
    fields.push(
      field('document_type', 'Тип первичного документа', {
        options: choices(types, documents),
        required: needsDocument,
      }),
    );
    if (values.document_type) {
      fields.push(required('document_number', 'Номер первичного документа', { maxLength: 255 }));
      fields.push(required('document_date', 'Дата первичного документа', { type: 'date' }));
      if (values.document_type === 'OTHER')
        fields.push(
          required('primary_document_custom_name', 'Название первичного документа', {
            maxLength: 255,
          }),
        );
    }
  }
  const useCost = ['RETAIL', 'BY_SAMPLES', 'DISTANCE', 'VENDING', 'PACKING'].includes(action);
  const buyerCost = ['DONATION', 'OWN_USE', 'PRODUCTION_USE'].includes(action);
  if ((!osu && useCost) || (buyerCost && (!osu || values.buyer_inn))) {
    fields.push(
      field('product_cost', 'Стоимость одной позиции, копейки', {
        required: useCost || Boolean(values.buyer_inn),
        pattern: /^\d{1,12}(?:[.,]\d{1,2})?$/,
      }),
    );
  }
  return fields;
}

export function turnoverFields(
  type: string,
  group: string,
  caps: TurnoverCapabilities,
  values: TurnoverFields,
): TurnoverField[] {
  if (type === 'LK_RECEIPT' || type === 'LK_GTIN_RECEIPT')
    return withdrawalFields(type, group, caps, values);
  const fields: TurnoverField[] = [];
  if (type === 'LP_GOODS_IMPORT' || type === 'LP_FTS_INTRODUCE') fields.push(...declarationFields);
  if (type === 'LP_GOODS_IMPORT') {
    fields.push(required('customs_code', 'Код таможни', { pattern: /^\d{8}$/ }));
    fields.push(
      required('decision_code', 'Код решения', {
        options: ['10', '11', '12', '13', '14'].map((code) => [code, code]),
      }),
    );
  }
  if (type === 'LK_CONTRACT_COMMISSIONING') {
    fields.push(
      required('participant_role', 'Роль участника', {
        options: [
          ['producer', 'Производитель'],
          ['owner', 'Собственник'],
        ],
      }),
    );
    if (values.participant_role)
      fields.push(
        required(
          'other_inn',
          values.participant_role === 'producer' ? 'ИНН собственника' : 'ИНН производителя',
          { pattern: innPattern },
        ),
      );
  }
  if (type === 'CROSSBORDER') {
    fields.push(
      required('country_oksm', 'Страна экспортёра', { options: Object.entries(countries) }),
      required('sender_tax_number', 'Налоговый номер экспортёра', { maxLength: 14 }),
      required('exporter_name', 'Наименование экспортёра', { maxLength: 255 }),
      required('import_date', 'Дата ввоза', { type: 'date' }),
      required('primary_document_number', 'Номер первичного документа', { maxLength: 255 }),
      required('primary_document_date', 'Дата первичного документа', { type: 'date' }),
    );
  }
  if (type === 'LP_INTRODUCE_GOODS' || needsTurnoverMetadata(type, group))
    fields.push(field('tnved_code', 'ТН ВЭД для КИ без сведений', { pattern: tnvedPattern }));
  if (type === 'LP_FTS_INTRODUCE') {
    fields.push(field('tn_ved', 'ТН ВЭД', { pattern: tnvedPattern }));
    fields.push(
      field('production_country_code', 'Код страны производства', { pattern: /^\d{3}$/ }),
    );
  }
  if (type === 'LP_INTRODUCE_GOODS' || type === 'LK_CONTRACT_COMMISSIONING')
    fields.push(
      field('production_date', 'Дата производства для КИ без сведений', { type: 'date' }),
    );
  if (type === 'LP_INTRODUCE_GOODS') {
    fields.push(
      field('vsd_number', 'Номер ВСД', {
        pattern: /^(?:[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}|[\da-f]{4}(?:-[\da-f]{4}){7})$/i,
      }),
      field('certificate_type', 'Вид разрешительного документа', {
        options: [
          ['CONFORMITY_CERTIFICATE', 'Сертификат соответствия'],
          ['CONFORMITY_DECLARATION', 'Декларация о соответствии'],
          ['STATE_REGISTRATION_CERTIFICATE', 'Свидетельство о государственной регистрации'],
        ],
      }),
    );
    if (values.certificate_type)
      fields.push(
        required('certificate_number', 'Номер разрешительного документа', { maxLength: 255 }),
        required('certificate_date', 'Дата разрешительного документа', { type: 'date' }),
      );
  }
  return fields;
}

export function parseTurnoverCodes(text: string, limit: number) {
  let codes: string[];
  try {
    codes = parseCodesCheckText(text).map(toTrueApiInformationCode);
  } catch (error) {
    if (error instanceof Error && error.message === 'tooManyCodes')
      throw new Error(`Допустимо до ${limit} кодов.`);
    throw new Error('Добавьте КИ по одному в строке. Допускается CSV с одним столбцом.');
  }
  if (codes.length > limit) throw new Error(`Допустимо до ${limit} кодов.`);
  if (codes.some((code) => !code || code.length > 512 || /[\u0000-\u001f\u007f]/.test(code)))
    throw new Error('КИ должен содержать от 1 до 512 символов без управляющих знаков.');
  if (new Set(codes).size !== codes.length) throw new Error('Уберите повторяющиеся КИ.');
  return codes;
}

function osuProducts(text: string, maxCodes: number) {
  const entries = text
    .trim()
    .replace(/^\uFEFF/, '')
    .split(/\r?\n|\r/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (/^gtin\s*;\s*(количество|gtin_quantity)$/i.test(entries[0] ?? '')) entries.shift();
  if (!entries.length || entries.length > maxCodes)
    throw new Error(`Добавьте от 1 до ${maxCodes} строк GTIN.`);
  const seen = new Set<string>();
  return entries.map((entry, index) => {
    const [gtin, count, extra] = entry.split(';').map((value) => value.trim());
    const quantity = Number(count);
    if (
      extra !== undefined ||
      !/^\d{14}$/.test(gtin) ||
      !/^\d+$/.test(count ?? '') ||
      !Number.isSafeInteger(quantity) ||
      quantity < 1 ||
      seen.has(gtin)
    )
      throw new Error(
        `Проверьте строку ${index + 1}. Укажите уникальный 14-значный GTIN и целое количество через точку с запятой.`,
      );
    seen.add(gtin);
    return { gtin, gtin_quantity: quantity };
  });
}

function dateMatchesDeclaration(number: string, date: string) {
  const [year, month, day] = date.split('-');
  return number.split('/')[1] === day + month + year.slice(-2);
}

export function makeTurnoverDocument(
  caps: TurnoverCapabilities,
  group: string,
  type: string,
  fields: TurnoverFields,
  text: string,
  manualJson: string | null,
  metadata: Map<string, TurnoverCodeInfo>,
) {
  if (manualJson !== null) {
    let value: unknown;
    try {
      value = JSON.parse(manualJson);
    } catch {
      throw new Error('Проверьте синтаксис JSON.');
    }
    if (
      !value ||
      typeof value !== 'object' ||
      Array.isArray(value) ||
      Object.hasOwn(value, 'product_document')
    )
      throw new Error('Укажите JSON-объект документа без поля product_document.');
    return manualJson;
  }
  const input: Record<string, string> = {};
  for (const spec of turnoverFields(type, group, caps, fields)) {
    const value = fields[spec.key]?.trim() ?? '';
    if (!value && spec.required) throw new Error(`Заполните поле «${spec.label}».`);
    if (!value) continue;
    if (
      (spec.pattern && !spec.pattern.test(value)) ||
      (spec.maxLength && value.length > spec.maxLength) ||
      (spec.options && !spec.options.some(([key]) => key === value))
    )
      throw new Error(`Проверьте значение поля «${spec.label}».`);
    input[spec.key] = value;
  }
  if (
    input.declaration_number &&
    !dateMatchesDeclaration(input.declaration_number, input.declaration_date)
  )
    throw new Error('Дата в номере ДТ должна совпадать с датой декларации.');
  if (
    input.sender_tax_number &&
    (!/^\d+$/.test(input.sender_tax_number) ||
      input.sender_tax_number.length !== taxNumberLength[input.country_oksm])
  )
    throw new Error('Проверьте налоговый номер экспортёра для выбранной страны.');
  if (
    input.importer_id &&
    (!/^\d+$/.test(input.importer_id) ||
      !(input.destination_country_code
        ? input.importer_id.length === taxNumberLength[input.destination_country_code]
        : [8, 9, 12, 14].includes(input.importer_id.length)))
  )
    throw new Error('Проверьте налоговый номер импортёра для выбранной страны.');

  const {
    product_cost: cost,
    tnved_code: tnved,
    tn_ved: ftsTnved,
    production_country_code: country,
    production_date: date,
    vsd_number: vsdNumber,
    certificate_type: certificateType,
    certificate_number: certificateNumber,
    certificate_date: certificateDate,
    participant_role: role,
    other_inn: otherInn,
    ...root
  } = input;
  const unitCost = cost === undefined ? undefined : Number(cost.replace(',', '.'));
  const inn = caps.participantInn;
  if (type === 'LK_GTIN_RECEIPT') {
    if (input.action === 'DONATION' && unitCost !== 0)
      throw new Error('Для дарения при ОСУ укажите стоимость 0.');
    const products = osuProducts(text, caps.maxCodes).map((row) => ({
      ...row,
      product_cost: unitCost,
    }));
    return JSON.stringify({ inn, ...root, products });
  }
  const codes = parseTurnoverCodes(text, caps.maxCodes);
  if (type === 'LK_RECEIPT') {
    const primary =
      input.action === 'RETAIL'
        ? {
            primary_document_type: input.document_type,
            primary_document_number: input.document_number,
            primary_document_date: input.document_date + 'T00:00:00.000Z',
            primary_document_custom_name: input.primary_document_custom_name,
          }
        : {};
    return JSON.stringify({
      inn,
      ...root,
      products: codes.map((cis) => ({ cis, product_cost: unitCost, ...primary })),
    });
  }
  const schema = introductionRows[type];
  if (!schema) throw new Error('Для выбранного вида укажите официальный JSON документа.');
  const participant =
    type === 'LK_CONTRACT_COMMISSIONING'
      ? {
          producer_inn: role === 'producer' ? inn : otherInn,
          owner_inn: role === 'owner' ? inn : otherInn,
          production_order: 'CONTRACT_PRODUCTION',
        }
      : type === 'LP_INTRODUCE_GOODS'
        ? {
            participant_inn: inn,
            producer_inn: inn,
            owner_inn: inn,
            production_type: 'OWN_PRODUCTION',
          }
        : type === 'CROSSBORDER' || type === 'LP_FTS_INTRODUCE'
          ? { trade_participant_inn: inn }
          : { participant_inn: inn };
  const requiresMetadata = needsTurnoverMetadata(type, group);
  const products = codes.map((code) => {
    const info = metadata.get(code);
    const codeTnved = info?.tnVedCode ?? tnved;
    if (requiresMetadata && !tnvedPattern.test(codeTnved ?? ''))
      throw new Error('Получите сведения о КИ или заполните ТН ВЭД для кодов без сведений.');
    if (info?.packageType && info.packageType !== 'UNIT')
      throw new Error('Для агрегатов и наборов используйте официальный JSON с составом.');
    return {
      [schema.code]: code,
      tnved_code: codeTnved,
      tn_ved: ftsTnved,
      production_country_code: country,
      vsd_number: vsdNumber,
      certificate_document_data: certificateType
        ? [
            {
              certificate_type: certificateType,
              certificate_number: certificateNumber,
              certificate_date: certificateDate,
            },
          ]
        : undefined,
      production_date:
        type === 'LP_INTRODUCE_GOODS' || type === 'LK_CONTRACT_COMMISSIONING'
          ? info?.producedDate?.slice(0, 10) || date
          : undefined,
    };
  });
  const reason = type === 'LK_UNIVERSAL_INTRODUCE' ? { reason_type: 'RESALE' } : {};
  return JSON.stringify({ ...participant, ...root, ...reason, [schema.array]: products });
}
