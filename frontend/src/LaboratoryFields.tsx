import { Alert, Grid, MenuItem, TextField } from '@mui/material';
import type { LaboratoryDetails } from './evidenceTypes';

export const laboratoryTypes = { Unknown: 'Не указан', Accredited: 'Аккредитованная', NonAccredited: 'Неаккредитованная', Manufacturer: 'Лаборатория изготовителя' };
export const accreditationStatuses = { Unknown: 'Не проверен', Active: 'Действует', Suspended: 'Приостановлена', PartiallySuspended: 'Частично приостановлена', Revoked: 'Прекращена', Expired: 'Срок истёк' };
export function LaboratoryFields({ value, onChange, disabled = false }: { value: LaboratoryDetails; onChange: (value: LaboratoryDetails) => void; disabled?: boolean }) {
  const patch = (p: Partial<LaboratoryDetails>) => onChange({ ...value, ...p });
  return <><Grid item xs={12}><Alert severity="info">Сведения могут поступать из CSV или заполняться специалистом. Автоматической проверки текущего реестра нет. Дату ручной сверки указывайте после самостоятельной проверки источника.</Alert></Grid>
    <Grid item xs={12} sm={6}><TextField label="Краткое обозначение лаборатории" value={value.shortName ?? ''} disabled={disabled} onChange={e => patch({ shortName: e.target.value })}/></Grid>
    <Grid item xs={12} sm={6}><TextField label="Идентификатор национального реестра" value={value.nationalRegistryId ?? ''} disabled={disabled} onChange={e => patch({ nationalRegistryId: e.target.value })}/></Grid>
    <Grid item xs={12} sm={6}><TextField label="Страна лаборатории" value={value.country} disabled={disabled} onChange={e => patch({ country: e.target.value })}/></Grid>
    <Grid item xs={12} sm={6}><TextField select label="Тип лаборатории" value={value.type} disabled={disabled} onChange={e => patch({ type: e.target.value as LaboratoryDetails['type'] })}>{Object.entries(laboratoryTypes).map(([k,v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField></Grid>
    <Grid item xs={12} sm={6}><TextField label="Статус аккредитации по ручной сверке" select value={value.accreditationStatus} disabled={disabled} onChange={e => patch({ accreditationStatus: e.target.value as LaboratoryDetails['accreditationStatus'] })}>{Object.entries(accreditationStatuses).map(([k,v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField></Grid>
    <Grid item xs={12} sm={6}><TextField type="date" InputLabelProps={{ shrink: true }} label="Дата ручной сверки" value={value.manuallyCheckedAt ?? ''} disabled={disabled} onChange={e => patch({ manuallyCheckedAt: e.target.value || null })}/></Grid>
    <Grid item xs={12} sm={6}><TextField type="date" InputLabelProps={{ shrink: true }} label="Аккредитация действует с" value={value.validFrom ?? ''} disabled={disabled} onChange={e => patch({ validFrom: e.target.value || null })}/></Grid>
    <Grid item xs={12} sm={6}><TextField type="date" InputLabelProps={{ shrink: true }} label="Аккредитация действует до" value={value.validUntil ?? ''} disabled={disabled} onChange={e => patch({ validUntil: e.target.value || null })}/></Grid>
    <Grid item xs={12}><TextField label="Статус в едином реестре" value={value.registryStatus ?? ''} disabled={disabled} onChange={e => patch({ registryStatus: e.target.value })}/></Grid>
    <Grid item xs={12}><TextField label="Юридический адрес лаборатории" multiline minRows={2} maxRows={5} value={value.legalAddress ?? ''} disabled={disabled} onChange={e => patch({ legalAddress: e.target.value })}/></Grid>
    <Grid item xs={12}><TextField label="Руководитель лаборатории" value={value.headName ?? ''} disabled={disabled} onChange={e => patch({ headName: e.target.value })}/></Grid>
    <Grid item xs={12}><TextField label="Область аккредитации" multiline minRows={2} maxRows={6} value={value.scope} disabled={disabled} onChange={e => patch({ scope: e.target.value })}/></Grid>
    <Grid item xs={12}><TextField label="HTTPS-ссылка на лабораторию в реестре" value={value.registryUrl} disabled={disabled} onChange={e => patch({ registryUrl: e.target.value })}/></Grid>
    <Grid item xs={12} sm={6}><TextField label="Телефон лаборатории" value={value.phone} disabled={disabled} onChange={e => patch({ phone: e.target.value })}/></Grid>
    <Grid item xs={12} sm={6}><TextField label="Почта лаборатории" value={value.email} disabled={disabled} onChange={e => patch({ email: e.target.value })}/></Grid>
    <Grid item xs={12}><TextField label="Комментарий к сверке" multiline value={value.verificationNote} disabled={disabled} onChange={e => patch({ verificationNote: e.target.value })}/></Grid>
    <Grid item xs={12} sm={6}><TextField label="Удостоверяющий документ лаборатории" value={value.certificateDocument ?? ''} disabled={disabled} onChange={e => patch({ certificateDocument: e.target.value })}/></Grid>
    <Grid item xs={12} sm={6}><TextField label="Номер поставщика лаборатории" value={value.supplierCode ?? ''} disabled={disabled} onChange={e => patch({ supplierCode: e.target.value })}/></Grid>
  </>;
}
