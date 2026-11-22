import { Fragment, useState } from 'react';
import { Controller, useFormContext, useWatch, type Path } from 'react-hook-form';
import { Alert, Autocomplete, Button, createFilterOptions, Grid, TextField, Typography, type TextFieldProps } from '@mui/material';
import { api } from './store';
import { useNotify, useWorkspace } from './common';
import { isRussianOrganizationIdentifier, OrganizationLookup } from './OrganizationLookup';
import { DeclarationCountryField } from './DeclarationCountryField';
import { DeclarationManufacturerSites } from './DeclarationManufacturerSites';
import { errorMessage, type Organization, type Party, type SaveDeclaration } from './types';

export const applicantAddressPrintKey = 'Место нахождения и адрес места осуществления деятельности';

export function DeclarationField({ name, label, multiline = false, type, required = false, disabled = false, rows = 3, onValueChange, inputProps }: { name: Path<SaveDeclaration>; label: string; multiline?: boolean; type?: string; required?: boolean; disabled?: boolean; rows?: number; onValueChange?: () => void; inputProps?: TextFieldProps['inputProps'] }) {
  const { control } = useFormContext<SaveDeclaration>();
  return <Controller control={control} name={name} render={({ field, fieldState }) => <TextField {...field} value={field.value ?? ''} label={label} required={required} multiline={multiline} minRows={multiline ? rows : undefined} type={type} disabled={disabled} error={!!fieldState.error} helperText={fieldState.error?.message} inputProps={inputProps} InputLabelProps={type === 'date' ? { shrink: true } : undefined} onChange={e => { field.onChange(type === 'date' && e.target.value === '' ? null : e.target.value); onValueChange?.(); }}/>}/>;
}

function ApplicantPrintAddress({ readOnly }: { readOnly: boolean }) {
  const { control, getValues, setValue } = useFormContext<SaveDeclaration>();
  const overrides = useWatch({ control, name: 'workspace.printOverrides' });

  function update(value: string) {
    const next = { ...getValues('workspace.printOverrides') };
    if (value.trim()) next[applicantAddressPrintKey] = value;
    else delete next[applicantAddressPrintKey];
    setValue('workspace.printOverrides', next, { shouldDirty: true });
  }

  return <TextField label="Адрес для печатной формы" multiline minRows={2} disabled={readOnly}
    value={overrides?.[applicantAddressPrintKey] ?? ''} onChange={event => update(event.target.value)}
    helperText="Заполните, если адрес в макете отличается от адреса в реквизитах."
    inputProps={{ maxLength: 20000 }}/>;
}

export function DeclarationParty({ side, readOnly }: { side: 'applicant' | 'manufacturer'; readOnly: boolean }) {
  const { firmId, canEdit } = useWorkspace();
  const notify = useNotify();
  const organizations = api.useOrganizationsQuery(firmId);
  const [saveOrganization, savingOrganization] = api.useSaveOrganizationMutation();
  const { control, setValue, getValues } = useFormContext<SaveDeclaration>();
  const current = useWatch({ control, name: side });
  const printAddress = useWatch({ control, name: 'workspace.printOverrides' })?.[applicantAddressPrintKey] ?? '';
  const manufacturerCountryCode = useWatch({ control, name: 'workspace.manufacturerCountryCode' });
  const [source, setSource] = useState<'directory' | 'registry' | 'manual'>('directory');
  const [directoryQuery, setDirectoryQuery] = useState('');
  const [searchRegistryOnOpen, setSearchRegistryOnOpen] = useState(false);
  const [showRequisites, setShowRequisites] = useState(false);
  const kind = side === 'applicant' ? 'Applicant' : 'Manufacturer';
  const directoryCompanies = (organizations.currentData ?? []).filter(org => !org.isArchived);
  const rows = directoryCompanies.filter(org => org.kind === 'Both' || org.kind === kind);
  const directoryIdentifier = directoryQuery.trim();
  const registryIdentifier = isRussianOrganizationIdentifier(directoryIdentifier) ? directoryIdentifier : undefined;
  const [inn, ogrn, kpp, companyName, country, address] = [current.inn, current.ogrn, current.kpp, current.name, current.country, current.address].map(value => value.trim());
  const matchingCard = directoryCompanies.find(org => {
    if (inn || ogrn) return org.kpp === kpp && (inn && org.inn ? org.inn === inn : !!ogrn && org.ogrn === ogrn);
    return !org.inn && !org.ogrn && org.name === companyName && org.country === country && org.address === address;
  });
  const cardHasDifferentRole = matchingCard && matchingCard.kind !== kind && matchingCard.kind !== 'Both';

  async function addToDirectory() {
    if (readOnly || !canEdit || savingOrganization.isLoading || matchingCard) return;
    try {
      await saveOrganization({ firmId, data: { ...getValues(side), kind, autoRefresh: false } }).unwrap();
      notify('Компания добавлена в справочник');
    } catch (error) {
      notify(errorMessage(error), 'error');
    }
  }

  function resetAddressIdentifier() {
    if (getValues('workspace.manufacturerAddressIdentifier'))
      setValue('workspace.manufacturerAddressIdentifier', null, { shouldDirty: true });
  }
  function apply(party: Party, keepApplicantAddress = false) {
    const previous = getValues(side);
    const previousPrintAddress = keepApplicantAddress ? getValues('workspace.printOverrides')?.[applicantAddressPrintKey] : undefined;
    if (side === 'manufacturer') {
      if (previous.country !== party.country || previous.address !== party.address) resetAddressIdentifier();
      if (previous.country !== party.country) setValue('workspace.manufacturerCountryCode', null, { shouldDirty: true });
    }
    setValue(side, party, { shouldDirty: true });
    if (previousPrintAddress) {
      setValue('workspace.printOverrides', {
        ...getValues('workspace.printOverrides'),
        [applicantAddressPrintKey]: previousPrintAddress,
      }, { shouldDirty: true });
    }
  }

  function applyDirectoryCompany(org: Organization) {
    const { name, inn, ogrn, kpp, country, address, email, phone, signatory, position, shortName, legalForm, registrationDate, registrationAuthority, managerName, managerPosition } = org;
    apply({ name, inn, ogrn, kpp, country, address, email, phone, signatory, position, shortName, legalForm, registrationDate, registrationAuthority, managerName, managerPosition });
    setDirectoryQuery('');
  }

  return <div className="builder-party">
    <div className="builder-source" role="group" aria-label="Источник реквизитов">
      {([['directory', 'Справочник'], ['registry', 'Реестр DaData'], ['manual', 'Вручную']] as const).map(([key, label]) => <Button key={key} type="button" size="small" aria-pressed={source === key} onClick={() => {
        if (source === key) return;
        setSearchRegistryOnOpen(false);
        setSource(key);
      }}>{label}</Button>)}
    </div>
    {source === 'directory' && <>
      {organizations.error && <Alert severity="error" action={<Button onClick={() => void organizations.refetch()}>Повторить</Button>}>Не удалось загрузить справочник компаний.</Alert>}
      <Autocomplete disabled={readOnly} loading={organizations.isFetching && !organizations.currentData} options={rows} getOptionLabel={o => o.name} filterOptions={createFilterOptions({ stringify: (o: Organization) => `${o.name} ${o.shortName} ${o.inn} ${o.ogrn} ${o.kpp}` })}
        clearOnBlur={false} inputValue={directoryQuery} onInputChange={(_, input, reason) => { if (reason === 'input' || reason === 'clear') setDirectoryQuery(input); }}
        renderOption={({ key: _key, ...props }, org) => <li {...props} key={org.id}><div><strong>{org.name}</strong><Typography variant="body2" color="text.secondary">
          {[org.inn && `ИНН ${org.inn}`, org.ogrn && `ОГРН ${org.ogrn}`, org.kpp && `КПП ${org.kpp}`].filter(Boolean).join(' · ') || org.country}
        </Typography></div></li>}
        value={null} onChange={(_, org) => { if (org) applyDirectoryCompany(org); }}
        renderInput={params => <TextField {...params} label="Подставить из справочника" placeholder="Название, ИНН, ОГРН или КПП"/>} noOptionsText="В справочнике нет совпадений"/>
      <p className="builder-context-note">Поиск по названию, ИНН, ОГРН или КПП. Контакты и подписант подставятся из сохранённой карточки.</p>
      <Button type="button" disabled={readOnly} onClick={() => {
        setSearchRegistryOnOpen(true);
        setSource('registry');
      }}>Найти по ИНН / ОГРН в DaData</Button>
    </>}
    {source === 'registry' && <OrganizationLookup key={`${firmId}:${side}`} inline value={current}
      initialIdentifier={registryIdentifier} searchOnOpen={searchRegistryOnOpen} directoryKind={kind}
      declarationApplicant={side === 'applicant' ? { printAddress } : undefined}
      disabled={readOnly} onClose={() => setSource('directory')}
      onApply={(party, origin) => {
        apply({ ...getValues(side), ...party }, origin?.keepDeclarationAddress);
        setDirectoryQuery('');
        setSource('directory');
      }}/>}
    {source !== 'registry' && <details className="builder-requisites" open={source === 'manual' || showRequisites} onToggle={event => setShowRequisites(event.currentTarget.open)} key={source}><summary>Реквизиты и подписант</summary><div className="builder-field-stack">
      {([['name','Полное наименование'],['shortName','Сокращённое наименование'],['legalForm','Организационно-правовая форма'],['inn','ИНН'],['ogrn','ОГРН / ОГРНИП'],['kpp','КПП'],['country','Страна'],['address','Адрес'],['email','Электронная почта'],['phone','Телефон']] as const).map(([key,label]) => <Fragment key={key}>
        {side === 'manufacturer' && key === 'country' ? <DeclarationCountryField label={label} disabled={readOnly}
          value={{ country: current.country, countryCode: manufacturerCountryCode }} onChange={({ country, countryCode }) => {
            if (getValues('manufacturer.country') !== country) resetAddressIdentifier();
            setValue('manufacturer.country', country, { shouldDirty: true });
            setValue('workspace.manufacturerCountryCode', countryCode, { shouldDirty: true });
          }}/> : <DeclarationField name={`${side}.${key}`} label={label} disabled={readOnly} multiline={key === 'address'} onValueChange={side === 'manufacturer' && key === 'address' ? resetAddressIdentifier : undefined}/>}
        {side === 'applicant' && key === 'address' && <ApplicantPrintAddress readOnly={readOnly}/>}
      </Fragment>)}
      {side === 'applicant' && <><DeclarationField name="applicant.signatory" label="ФИО подписанта" disabled={readOnly}/><DeclarationField name="applicant.position" label="Должность подписанта" disabled={readOnly}/></>}
      <details><summary>Регистрационные сведения организации</summary><Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={12}><DeclarationField name={`${side}.registrationDate`} label="Дата регистрации организации" type="date" disabled={readOnly}/></Grid>
        {([['registrationAuthority','Регистрирующий орган'],['managerName','Руководитель по данным источника'],['managerPosition','Должность руководителя']] as const).map(([key,label]) => <Grid item xs={12} key={key}><DeclarationField name={`${side}.${key}`} label={label} disabled={readOnly}/></Grid>)}
      </Grid></details>
    </div></details>}
    {source !== 'registry' && cardHasDifferentRole && <p className="builder-context-note">Компания уже есть в справочнике. Для подстановки в обеих ролях выберите в карточке назначение «Заявитель и изготовитель».</p>}
    {source !== 'registry' && canEdit && !readOnly && companyName && country && !matchingCard && <Button type="button"
      disabled={savingOrganization.isLoading || organizations.isFetching} onClick={() => void addToDirectory()}>{savingOrganization.isLoading ? 'Добавляем…' : 'Добавить в справочник'}</Button>}
    {side === 'manufacturer' && !readOnly && <Button onClick={() => apply({ ...getValues('applicant') })}>Совпадает с заявителем</Button>}
    {side === 'manufacturer' && <DeclarationManufacturerSites readOnly={readOnly}/>}
  </div>;
}
