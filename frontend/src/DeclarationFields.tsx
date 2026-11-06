import { useState } from 'react';
import { Controller, useFormContext, useWatch, type Path } from 'react-hook-form';
import { Alert, Autocomplete, Button, createFilterOptions, Grid, TextField, Typography } from '@mui/material';
import { api } from './store';
import { useWorkspace } from './common';
import { OrganizationLookup } from './OrganizationLookup';
import type { Party, SaveDeclaration } from './types';

export function DeclarationField({ name, label, multiline = false, type, required = false, disabled = false, rows = 3 }: { name: Path<SaveDeclaration>; label: string; multiline?: boolean; type?: string; required?: boolean; disabled?: boolean; rows?: number }) {
  const { control } = useFormContext<SaveDeclaration>();
  return <Controller control={control} name={name} render={({ field, fieldState }) => <TextField {...field} value={field.value ?? ''} label={label} required={required} multiline={multiline} minRows={multiline ? rows : undefined} type={type} disabled={disabled} error={!!fieldState.error} helperText={fieldState.error?.message} InputLabelProps={type === 'date' ? { shrink: true } : undefined} onChange={e => field.onChange(type === 'date' && e.target.value === '' ? null : e.target.value)}/>}/>;
}

export function DeclarationParty({ side, readOnly }: { side: 'applicant' | 'manufacturer'; readOnly: boolean }) {
  const { firmId } = useWorkspace(); const organizations = api.useOrganizationsQuery(firmId);
  const { control, setValue, getValues } = useFormContext<SaveDeclaration>();
  const current = useWatch({ control, name: side });
  const [source, setSource] = useState<'directory' | 'inn' | 'manual'>('directory');
  const [showRequisites, setShowRequisites] = useState(false);
  const rows = (organizations.data ?? []).filter(o => o.kind === 'Both' || o.kind === (side === 'applicant' ? 'Applicant' : 'Manufacturer'));
  function apply(party: Party) { setValue(side, party, { shouldDirty: true }); }
  return <div className="builder-party">
    <div className="builder-source" role="group" aria-label="Источник реквизитов">{([['directory','Справочник'],['inn','По ИНН'],['manual','Вручную']] as const).map(([key,label]) => <Button key={key} size="small" aria-pressed={source === key} onClick={() => setSource(key)}>{label}</Button>)}</div>
    {source === 'directory' && <>
      {organizations.error && <Alert severity="error" action={<Button onClick={() => void organizations.refetch()}>Повторить</Button>}>Не удалось загрузить справочник компаний.</Alert>}
      <Autocomplete disabled={readOnly} loading={organizations.isLoading} options={rows} getOptionLabel={o => o.name} filterOptions={createFilterOptions({ stringify: (o: typeof rows[number]) => `${o.name} ${o.shortName} ${o.inn} ${o.ogrn} ${o.kpp}` })}
        renderOption={({ key: _key, ...props }, org) => <li {...props} key={org.id}><div><strong>{org.name}</strong><Typography variant="body2" color="text.secondary">ИНН {org.inn || '—'} · КПП {org.kpp || '—'}</Typography></div></li>}
        value={null} onChange={(_, org) => { if (org) { const { name, inn, ogrn, kpp, country, address, email, phone, signatory, position, shortName, legalForm, registrationDate, registrationAuthority, managerName, managerPosition } = org; apply({ name, inn, ogrn, kpp, country, address, email, phone, signatory, position, shortName, legalForm, registrationDate, registrationAuthority, managerName, managerPosition }); } }}
        renderInput={params => <TextField {...params} label="Подставить из справочника" placeholder="Название, ИНН, ОГРН или КПП"/>} noOptionsText="Совпадений нет. Используйте поиск по ИНН или ручной ввод."/>
      <p className="builder-context-note">Выбранная компания подставляется вместе с адресом, контактами и подписантом.</p>
      <Button disabled={readOnly} onClick={() => setSource('inn')}>Найти по ИНН / ОГРН</Button>
    </>}
    {source === 'inn' && <OrganizationLookup key={`${firmId}:${side}`} inline value={current} directoryKind={side === 'applicant' ? 'Applicant' : 'Manufacturer'} disabled={readOnly} onClose={() => setSource('directory')} onApply={party => { apply({ ...getValues(side), ...party }); setSource('directory'); }}/>}
    {source !== 'inn' && <details className="builder-requisites" open={source === 'manual' || showRequisites} onToggle={event => setShowRequisites(event.currentTarget.open)} key={source}><summary>Реквизиты и подписант</summary><div className="builder-field-stack">
      {([['name','Полное наименование'],['shortName','Сокращённое наименование'],['legalForm','Организационно-правовая форма'],['inn','ИНН'],['ogrn','ОГРН / ОГРНИП'],['kpp','КПП'],['country','Страна'],['address','Адрес'],['email','Электронная почта'],['phone','Телефон']] as const).map(([key,label]) => <DeclarationField key={key} name={`${side}.${key}`} label={label} disabled={readOnly} multiline={key === 'address'}/>)}
      {side === 'applicant' && <><DeclarationField name="applicant.signatory" label="ФИО подписанта" disabled={readOnly}/><DeclarationField name="applicant.position" label="Должность подписанта" disabled={readOnly}/></>}
      <details><summary>Регистрационные сведения организации</summary><Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={12}><DeclarationField name={`${side}.registrationDate`} label="Дата регистрации организации" type="date" disabled={readOnly}/></Grid>
        {([['registrationAuthority','Регистрирующий орган'],['managerName','Руководитель по данным источника'],['managerPosition','Должность руководителя']] as const).map(([key,label]) => <Grid item xs={12} key={key}><DeclarationField name={`${side}.${key}`} label={label} disabled={readOnly}/></Grid>)}
      </Grid></details>
    </div></details>}
    {side === 'manufacturer' && !readOnly && <Button onClick={() => apply({ ...getValues('applicant') })}>Совпадает с заявителем</Button>}
  </div>;
}
