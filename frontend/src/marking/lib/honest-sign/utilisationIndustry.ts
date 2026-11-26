import type { UtilisationCisType } from './utilisationReport';

const production = new Set(
  'autofluids milk tobacco otp ncp beer bio nabeer wheelchairs softdrinks antiseptic petfood conserve vetbio fertilizers pyrotechnics seafood vetpharma vegetableoil grocery sweets meat frozen chemistry toys fire radio nicotindev gadgets bicycle books heater cableraw polymer carparts homeware industrial'.split(
    ' ',
  ),
);
const expiration = new Set(
  'autofluids milk water beer bio nabeer softdrinks antiseptic petfood conserve vetbio fertilizers pyrotechnics seafood vetpharma vegetableoil grocery sweets meat frozen'.split(
    ' ',
  ),
);
const noExpiration = new Set(
  'tobacco otp ncp radio nicotindev gadgets bicycle books heater cableraw polymer carparts homeware industrial titan opticfiber furslp'.split(
    ' ',
  ),
);
const future = new Set(
  'autofluids antiseptic petfood conserve vetbio fertilizers pyrotechnics seafood vetpharma vegetableoil grocery sweets chemistry toys construction fire'.split(
    ' ',
  ),
);
const groupNoDates = new Set('milk beer nabeer softdrinks seafood frozen construction'.split(' '));
const setNoDates = new Set(['nabeer', 'frozen']);
const timed = new Set(['tobacco', 'otp', 'ncp', 'pharma']);
const alternatives = new Set(['milk', 'vegetableoil', 'grocery', 'sweets', 'meat', 'frozen']);
const timedExpiry = new Set(['milk', 'meat']);

export function getUtilisationDateRules(group: string, cis: UtilisationCisType) {
  const noDates =
    (cis === 'GROUP' && groupNoDates.has(group)) || (cis === 'SET' && setNoDates.has(group));
  return {
    noDates,
    productionRequired: !noDates && cis === 'UNIT' && production.has(group),
    expirationRequired: group === 'pharma' || (!noDates && cis === 'UNIT' && expiration.has(group)),
    expirationAllowed: !noDates && !noExpiration.has(group),
    future: future.has(group),
    productionTimestamp: timed.has(group),
    expiryConditions: alternatives.has(group),
    expiryTimestamp: timedExpiry.has(group),
  };
}

const fieldLabels = {
  participantId: 'ИНН участника',
  kpp: 'КПП',
  fiasId: 'Идентификатор ФИАС',
  alcoholVolume: 'Крепость, %',
  documentNumber: 'Номер документа',
  documentDate: 'Дата документа',
  documentSource: 'Кем выдан документ',
  seriesNumber: 'Серия',
  batchNumber: 'Номер партии',
  usedInProduction: 'Использовано в производстве',
  vetisGuid: 'Идентификатор ВетИС',
  productionLineId: 'Идентификатор линии',
  productionOrderId: 'Производственный заказ',
  brandcode: 'Код бренда',
  sourceReportId: 'Идентификатор исходного отчёта',
  subjectId: 'Идентификатор места деятельности',
  orderType: 'Тип заказа',
  ownerId: 'Идентификатор владельца',
  packingId: 'Идентификатор места упаковки',
  controlId: 'Идентификатор места контроля',
  customsReceiverId: 'Идентификатор получателя по таможенной декларации',
};
type Field = keyof typeof fieldLabels;
export type UtilisationIndustryValues = Partial<Record<Field, string>>;
const tobaccoFields: Field[] = [
  'productionLineId',
  'productionOrderId',
  'brandcode',
  'sourceReportId',
  'kpp',
  'fiasId',
];
const fieldsByGroup: Record<string, Field[]> = {
  tobacco: tobaccoFields,
  otp: tobaccoFields,
  ncp: tobaccoFields,
  pharma: [
    'subjectId',
    'seriesNumber',
    'orderType',
    'ownerId',
    'packingId',
    'controlId',
    'customsReceiverId',
  ],
  milk: ['usedInProduction'],
  water: ['usedInProduction'],
  beer: ['participantId', 'kpp', 'fiasId', 'alcoholVolume', 'documentNumber', 'documentDate'],
  bio: ['vetisGuid'],
  nabeer: ['kpp', 'fiasId'],
  wheelchairs: ['seriesNumber', 'batchNumber'],
  softdrinks: ['participantId', 'kpp', 'fiasId'],
  vetpharma: ['seriesNumber'],
  chemistry: ['alcoholVolume', 'participantId'],
  toys: ['participantId'],
  construction: ['kpp', 'fiasId'],
  radio: ['participantId', 'kpp', 'fiasId'],
  nicotindev: ['kpp', 'fiasId'],
  gadgets: ['kpp', 'fiasId'],
  titan: ['documentNumber', 'documentDate', 'documentSource'],
};
const uuid = /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i;
const uuidFields: Field[] = [
  'fiasId',
  'ownerId',
  'packingId',
  'controlId',
  'customsReceiverId',
  'vetisGuid',
];

export function getUtilisationIndustryFields(
  group: string,
  cis: UtilisationCisType,
  values: UtilisationIndustryValues,
) {
  const subject = values.subjectId?.trim() ?? '';
  const subjectIsInn = /^\d{14}$/.test(subject);
  const subjectIsUuid = uuid.test(subject);
  return (fieldsByGroup[group] ?? [])
    .filter((key) => {
      if (group !== 'pharma') return key !== 'alcoholVolume' || cis !== 'SET';
      if (key === 'orderType') return subjectIsInn;
      if (key === 'ownerId') return subjectIsInn && values.orderType === '2';
      if (['packingId', 'controlId', 'customsReceiverId'].includes(key)) return subjectIsUuid;
      return true;
    })
    .map((key) => ({
      key,
      label: fieldLabels[key],
      required:
        group === 'titan' ||
        (key === 'participantId' && (group === 'beer' || group === 'softdrinks')) ||
        (key === 'alcoholVolume' &&
          ((group === 'beer' && cis !== 'SET') || (group === 'chemistry' && cis === 'UNIT'))) ||
        ((group === 'beer' || group === 'softdrinks') &&
          ((key === 'kpp' && values.participantId?.trim().length === 10) ||
            (key === 'fiasId' && values.participantId?.trim().length === 12))) ||
        (key === 'seriesNumber' && group === 'vetpharma' && cis === 'UNIT') ||
        (group === 'pharma' &&
          ['subjectId', 'seriesNumber', 'orderType', 'ownerId', 'packingId'].includes(key)),
    }));
}

export function areUtilisationIndustryFieldsValid(
  group: string,
  cis: UtilisationCisType,
  values: UtilisationIndustryValues,
  codes: string[] = [],
  today?: string,
) {
  for (const { key, required } of getUtilisationIndustryFields(group, cis, values)) {
    const value = values[key]?.trim() ?? '';
    if (!value && !required) continue;
    if (!value || value.length > 256 || /[\x00-\x1f\x7f]/.test(value)) return false;
    if (uuidFields.includes(key) && !uuid.test(value)) return false;
    if (key === 'participantId' && !/^(?:\d{10}|\d{12})$/.test(value)) return false;
    if (key === 'subjectId' && !/^\d{14}$/.test(value) && !uuid.test(value)) return false;
    if (key === 'kpp' && !/^\d{1,9}$/.test(value)) return false;
    if (key === 'alcoholVolume' && !/^\d{1,2}(?:\.\d)?$/.test(value)) return false;
    if (key === 'orderType' && !/^[12]$/.test(value)) return false;
    if (key === 'usedInProduction' && !/^[01]$/.test(value)) return false;
    if (key === 'documentDate' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  }
  if (group === 'beer' && Boolean(values.documentNumber?.trim()) !== Boolean(values.documentDate))
    return false;
  if (
    group === 'pharma' &&
    uuid.test(values.subjectId ?? '') &&
    values.customsReceiverId &&
    !values.controlId
  )
    return false;
  if (
    group === 'nicotindev' &&
    today &&
    today >= '2026-10-01' &&
    !values.kpp?.trim() &&
    !values.fiasId?.trim()
  )
    return false;
  return (
    group !== 'wheelchairs' ||
    cis !== 'UNIT' ||
    codes.length === 0 ||
    Boolean(values.seriesNumber?.trim() || values.batchNumber?.trim()) ||
    codes.every((code) => /\x1d97[^\x1d]+/.test(code))
  );
}

export function buildUtilisationIndustryAttributes(
  group: string,
  cis: UtilisationCisType,
  values: UtilisationIndustryValues,
) {
  return Object.fromEntries(
    getUtilisationIndustryFields(group, cis, values).flatMap(({ key }) => {
      const value = values[key]?.trim();
      return value
        ? [[key, key === 'orderType' || key === 'usedInProduction' ? Number(value) : value]]
        : [];
    }),
  );
}

export function formatUtilisationProductionTime(value: string) {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[+-]\d{4}$/.test(value)) return value;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const offset = -date.getTimezoneOffset();
  const hours = String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0');
  const minutes = String(Math.abs(offset) % 60).padStart(2, '0');
  return `${value.length === 16 ? `${value}:00` : value}${offset >= 0 ? '+' : '-'}${hours}${minutes}`;
}
