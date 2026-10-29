import { emptyLaboratoryDetails } from './evidenceTypes';
import type { Laboratory } from './types';
export const laboratoryRecordKinds = { Laboratory: 'Испытательные лаборатории', CertificationBody: 'Органы по сертификации', InspectionBody: 'Инспекционные органы', Unspecified: 'Тип требует уточнения' };
const labels: Record<string,string> = { name:'Полное наименование',accreditationNumber:'Аттестат',address:'Адрес деятельности',recordKind:'Тип записи',country:'Страна',shortName:'Краткое обозначение',nationalRegistryId:'Номер национального реестра',registryStatus:'Статус в едином реестре',legalAddress:'Юридический адрес',headName:'Руководитель',type:'Тип лаборатории',accreditationStatus:'Статус аккредитации',validFrom:'Начало аккредитации',validUntil:'Окончание аккредитации',scope:'Область аккредитации',registryUrl:'Ссылка на реестр',phone:'Телефон',email:'Почта',manuallyCheckedAt:'Дата ручной сверки',verificationNote:'Комментарий',certificateDocument:'Удостоверяющий документ',supplierCode:'Номер поставщика' };
export function laboratoryChanges(before: Laboratory, after: Laboratory) {
  const fields = (lab: Laboratory) => ({name:lab.name.trim(),accreditationNumber:lab.accreditationNumber.trim(),address:lab.address.trim(),recordKind:lab.recordKind ?? 'Laboratory',...emptyLaboratoryDetails(),...lab.details});
  const a = fields(before); const b = fields(after);
  return Object.keys({...a,...b}).filter(key => JSON.stringify(a[key as keyof typeof a] ?? '') !== JSON.stringify(b[key as keyof typeof b] ?? ''))
    .map(key => ({key,label:labels[key] ?? key,before:String(a[key as keyof typeof a] ?? ''),after:String(b[key as keyof typeof b] ?? '')}));
}
