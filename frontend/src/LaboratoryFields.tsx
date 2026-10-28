import { Alert, Grid, MenuItem, TextField } from '@mui/material';
import type { LaboratoryDetails } from './evidenceTypes';

export const laboratoryTypes = { Unknown: 'Не указан', Accredited: 'Аккредитованная', NonAccredited: 'Неаккредитованная', Manufacturer: 'Лаборатория изготовителя' };
export const accreditationStatuses = { Unknown: 'Не проверен', Active: 'Действует (ручная сверка)', Suspended: 'Приостановлена', Revoked: 'Прекращена', Expired: 'Срок истёк' };
export function LaboratoryFields({ value, onChange, disabled = false }: { value: LaboratoryDetails; onChange: (value: LaboratoryDetails) => void; disabled?: boolean }) {
  const patch = (p: Partial<LaboratoryDetails>) => onChange({ ...value, ...p });
  return <><Grid item xs={12}><Alert severity="info">Сведения вводит специалист. Автоматической проверки реестра лабораторий пока нет. Статус и дата ниже отражают ручную сверку.</Alert></Grid>
    <Grid item xs={12} sm={6}><TextField label="Страна лаборатории" value={value.country} disabled={disabled} onChange={e => patch({ country: e.target.value })}/></Grid>
    <Grid item xs={12} sm={6}><TextField select label="Тип лаборатории" value={value.type} disabled={disabled} onChange={e => patch({ type: e.target.value as LaboratoryDetails['type'] })}>{Object.entries(laboratoryTypes).map(([k,v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField></Grid>
    <Grid item xs={12} sm={6}><TextField label="Статус аккредитации по ручной сверке" select value={value.accreditationStatus} disabled={disabled} onChange={e => patch({ accreditationStatus: e.target.value as LaboratoryDetails['accreditationStatus'] })}>{Object.entries(accreditationStatuses).map(([k,v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField></Grid>
    <Grid item xs={12} sm={6}><TextField type="date" InputLabelProps={{ shrink: true }} label="Дата ручной сверки" value={value.manuallyCheckedAt ?? ''} disabled={disabled} onChange={e => patch({ manuallyCheckedAt: e.target.value || null })}/></Grid>
    <Grid item xs={12} sm={6}><TextField type="date" InputLabelProps={{ shrink: true }} label="Аккредитация действует с" value={value.validFrom ?? ''} disabled={disabled} onChange={e => patch({ validFrom: e.target.value || null })}/></Grid>
    <Grid item xs={12} sm={6}><TextField type="date" InputLabelProps={{ shrink: true }} label="Аккредитация действует до" value={value.validUntil ?? ''} disabled={disabled} onChange={e => patch({ validUntil: e.target.value || null })}/></Grid>
    <Grid item xs={12}><TextField label="Область аккредитации" multiline minRows={2} value={value.scope} disabled={disabled} onChange={e => patch({ scope: e.target.value })}/></Grid>
    <Grid item xs={12}><TextField label="HTTPS-ссылка на лабораторию в реестре" value={value.registryUrl} disabled={disabled} onChange={e => patch({ registryUrl: e.target.value })}/></Grid>
    <Grid item xs={12} sm={6}><TextField label="Телефон лаборатории" value={value.phone} disabled={disabled} onChange={e => patch({ phone: e.target.value })}/></Grid>
    <Grid item xs={12} sm={6}><TextField label="Почта лаборатории" value={value.email} disabled={disabled} onChange={e => patch({ email: e.target.value })}/></Grid>
    <Grid item xs={12}><TextField label="Комментарий к сверке" multiline value={value.verificationNote} disabled={disabled} onChange={e => patch({ verificationNote: e.target.value })}/></Grid>
  </>;
}
