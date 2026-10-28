import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, Link, Radio, RadioGroup, TextField, Typography } from '@mui/material';
import { SearchRounded } from '@mui/icons-material';
import { api } from './store';
import { useWorkspace } from './common';
import { date, dateTime, emptyParty, errorMessage, type OrganizationInput, type OrganizationLookupResult, type OrganizationRequisites, type Party } from './types';
import { useDaDataOverwriteWarning } from './DaDataOverwriteWarning';

const organizationStatuses: Record<string, string> = { ACTIVE: 'Действующая', LIQUIDATING: 'Ликвидируется', LIQUIDATED: 'Ликвидирована', BANKRUPT: 'Банкротство', REORGANIZING: 'Реорганизация' };

export function OrganizationLookup({ value, onApply, disabled = false, directoryKind }: { value: Party; onApply: (data: OrganizationRequisites, origin?: Pick<OrganizationInput, 'replaceFromDaData' | 'manuallyEditedFields'>) => void; disabled?: boolean; directoryKind?: OrganizationInput['kind'] }) {
  const { firmId } = useWorkspace();
  const { confirmOverwrite, warningDialog } = useDaDataOverwriteWarning();
  const integrations = api.useIntegrationsQuery(firmId);
  const configured = integrations.data?.find(integration => integration.id === 'organizations')?.status === 'Configured';
  const [lookup, { isLoading }] = api.useLookupOrganizationMutation();
  const [saveOrganization, saving] = api.useSaveOrganizationMutation();
  const [matchOrganization] = api.useLazyMatchOrganizationQuery();
  const [preparing, setPreparing] = useState(false);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(''); const [kpp, setKpp] = useState('');
  const [error, setError] = useState(''); const [result, setResult] = useState<OrganizationLookupResult | null>(null);
  const [selected, setSelected] = useState(-1); const [useManager, setUseManager] = useState(false);
  const [useStandardAddress, setUseStandardAddress] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [phone, setPhone] = useState('');
  const [registrationAuthority, setRegistrationAuthority] = useState('');
  const [manualFields, setManualFields] = useState<(keyof Party)[]>([]);
  const busy = isLoading || saving.isLoading || preparing;
  const generation = useRef(0);
  const activeRequest = useRef<{ abort: () => void } | null>(null);
  useEffect(() => () => { generation.current++; activeRequest.current?.abort(); }, []);
  const candidate = result?.items[selected];

  function selectCandidate(index: number, items = result?.items ?? []) {
    setManualFields([]);
    setSelected(index); setUseManager(false); setUseStandardAddress(false);
    const item = items[index]; setPhone(item?.phone ?? '');
    setRegistrationAuthority(item?.registrationAuthority?.trim() ?? '');
  }
  function clearResult() { setResult(null); setSelected(-1); setError(''); setUseManager(false); setUseStandardAddress(false); setPhone(''); setRegistrationAuthority(''); setManualFields([]); }
  function close() { if (saving.isLoading || preparing) return; generation.current++; activeRequest.current?.abort(); setOpen(false); clearResult(); }
  async function search(identifier = query, branchKpp = kpp) {
    if (saving.isLoading) return;
    const digits = identifier.trim(); const branch = branchKpp.trim(); clearResult();
    if (!/^(\d{10}|\d{12}|\d{13}|\d{15})$/.test(digits)) { setError('Введите ИНН из 10 или 12 цифр либо ОГРН / ОГРНИП из 13 или 15 цифр.'); return; }
    if (branch && !/^\d{9}$/.test(branch)) { setError('КПП должен содержать 9 цифр.'); return; }
    const current = ++generation.current;
    const request = lookup({ firmId, query: digits, ...(branch ? { kpp: branch } : {}) });
    activeRequest.current = request;
    try {
      const response = await request.unwrap();
      if (generation.current === current) { setResult(response); selectCandidate(response.items.length === 1 ? 0 : -1, response.items); }
    } catch (e) { if (generation.current === current) setError(errorMessage(e)); }
    finally { if (generation.current === current) activeRequest.current = null; }
  }
  function requisites(): OrganizationRequisites {
    return { ...emptyParty(), name: candidate!.name, inn: candidate!.inn, ogrn: candidate!.ogrn, kpp: candidate!.kpp, address: useStandardAddress ? candidate!.standardizedAddress : candidate!.address ?? '', country: 'Россия',
      shortName: candidate!.shortName ?? '', legalForm: candidate!.legalForm ?? '', registrationDate: candidate!.registrationDate ?? null,
      registrationAuthority: registrationAuthority.trim(), phone: phone.trim(), email: candidate!.email ?? '', managerName: candidate!.managerName ?? '', managerPosition: candidate!.managerPosition ?? '',
      ...(useManager && candidate!.managerName ? { signatory: candidate!.managerName, position: candidate!.managerPosition } : {}) };
  }
  function sourceManualFields(): (keyof Party)[] {
    return [...new Set<keyof Party>([...manualFields, ...(useManager && candidate?.managerName ? ['signatory', 'position'] as const : [])])];
  }
  async function apply() {
    if (!candidate || disabled || busy) return;
    const data = requisites(); const current = generation.current;
    const replacesFormValues = (Object.keys(data) as (keyof Party)[]).some(key =>
      !['inn', 'ogrn', 'kpp'].includes(key) && typeof value[key] === 'string' && String(value[key]).trim() !== '' && String(value[key]).trim() !== String(data[key] ?? '').trim());
    setPreparing(true);
    try {
      if (replacesFormValues && !await confirmOverwrite('apply')) return;
      if (generation.current !== current) return;
      onApply(data, { replaceFromDaData: true, manuallyEditedFields: sourceManualFields() });
      setOpen(false); clearResult();
    } finally { setPreparing(false); }
  }
  async function saveAndApply() {
    if (!candidate || !directoryKind || disabled || busy) return;
    const data = requisites(); const current = ++generation.current;
    setPreparing(true); setError('');
    try {
      const existing = (await matchOrganization({ firmId, inn: data.inn, ogrn: data.ogrn, kpp: data.kpp }, false).unwrap()).organization;
      if (generation.current !== current) return;
      if (existing && !await confirmOverwrite('save', existing)) return;
      if (generation.current !== current) return;
      const saved = await saveOrganization({ firmId, data: { ...value, ...data, kind: directoryKind, autoRefresh, replaceFromDaData: true,
        manuallyEditedFields: sourceManualFields(), ...(existing ? { existingOrganizationId: existing.id } : {}) } }).unwrap();
      if (generation.current === current) {
        onApply({ ...data, phone: saved.phone, address: saved.address, shortName: saved.shortName,
          legalForm: saved.legalForm, registrationDate: saved.registrationDate, registrationAuthority: saved.registrationAuthority,
          managerName: saved.managerName, managerPosition: saved.managerPosition });
        setOpen(false); clearResult();
      }
    } catch (error) { if (generation.current === current) setError(errorMessage(error)); }
    finally { setPreparing(false); }
  }

  return <>
    <Button type="button" disabled={disabled} startIcon={<SearchRounded/>} onClick={() => { const identifier = value.ogrn || value.inn; clearResult(); setQuery(identifier); setKpp(value.kpp); setOpen(true); if (configured && /^(\d{10}|\d{12}|\d{13}|\d{15})$/.test(identifier)) void search(identifier, value.kpp); }}>Найти по ИНН / ОГРН</Button>
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth aria-labelledby="organization-lookup-title">
      <DialogTitle id="organization-lookup-title">Поиск реквизитов в DaData</DialogTitle>
      <DialogContent sx={{ pt: '10px !important' }}>
        <fieldset disabled={saving.isLoading || preparing} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <Typography color="text.secondary" sx={{ mb: 2.5 }}>Найдите российскую организацию или ИП и проверьте реквизиты. Телефон и регистрирующий орган можно дополнить вручную ниже. Ночное обновление сохраняет ручные дополнения в справочнике; ручное обновление из DaData заменяет их после предупреждения.</Typography>
        {integrations.isLoading ? <Typography sx={{ mb: 2 }}>Проверяем настройку подключения…</Typography> : integrations.error ? <Alert severity="warning" sx={{ mb: 2 }} action={<Button onClick={() => void integrations.refetch()}>Повторить</Button>}>Не удалось получить состояние подключения. Ручной ввод доступен.</Alert> : !configured && <Alert severity="info" sx={{ mb: 2 }}>Добавьте свой API-ключ DaData в <Link href="#/settings" target="_blank" rel="noopener noreferrer">настройках личного кабинета</Link> и нажмите «Сохранить и проверить». Пока можно заполнить реквизиты вручную.</Alert>}
        <Grid container spacing={2} alignItems="flex-start">
          <Grid item xs={12} sm={7}><TextField autoFocus label="ИНН или ОГРН / ОГРНИП" value={query} disabled={isLoading} inputProps={{ maxLength: 15, inputMode: 'numeric' }} onChange={e => { setQuery(e.target.value); clearResult(); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (configured && !isLoading) void search(); } }}/></Grid>
          <Grid item xs={12} sm={5}><TextField label="КПП филиала (необязательно)" helperText="Уточните филиал, если знаете КПП" value={kpp} disabled={isLoading} inputProps={{ maxLength: 9, inputMode: 'numeric' }} onChange={e => { setKpp(e.target.value); clearResult(); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (configured && !isLoading) void search(); } }}/></Grid>
        </Grid>
        <Button type="button" variant="outlined" sx={{ mt: 1.5, mb: 2.5 }} disabled={!configured || isLoading} onClick={() => void search()} startIcon={isLoading ? <CircularProgress size={16}/> : <SearchRounded/>}>{isLoading ? 'Ищем в DaData…' : 'Найти организацию'}</Button>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {result && result.items.length === 0 && <Alert severity="info">Организация не найдена. Проверьте ИНН / ОГРН и КПП либо заполните реквизиты вручную.</Alert>}
        {result && result.items.length > 1 && <Box sx={{ mb: 2 }}><Typography sx={{ fontWeight: 600, mb: 1 }}>Найдено записей: {result.items.length}. Выберите организацию или филиал.</Typography><RadioGroup aria-label="Найденные организации" value={selected} onChange={e => { selectCandidate(Number(e.target.value)); }}>{result.items.map((item, index) => <FormControlLabel key={`${item.inn}-${item.kpp}-${index}`} value={index} control={<Radio/>} sx={{ alignItems: 'flex-start', my: .5 }} label={<div><Typography sx={{ fontWeight: 500, mt: 1 }}>{item.name}</Typography><Typography variant="body2" color="text.secondary">ИНН {item.inn} · КПП {item.kpp || '—'} · {item.branchType === 'BRANCH' ? 'Филиал' : item.type === 'INDIVIDUAL' ? 'ИП' : 'Головная организация'}</Typography></div>}/>)}</RadioGroup><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>За один поиск показываем до 10 записей. Для точного филиала укажите КПП.</Typography></Box>}
        {candidate && <Box sx={{ bgcolor: 'var(--accent-soft)', border: '1px solid var(--hero-border)', borderRadius: 2, p: { xs: 2, sm: 2.5 } }}>
          <Typography component="h3" sx={{ fontWeight: 600, mb: 2 }}>Проверьте найденные реквизиты</Typography>
          <Grid container spacing={2}>{[
            ['Полное наименование', candidate.name], ['Статус организации', organizationStatuses[candidate.status] || 'Не указан'],
            ['ИНН', candidate.inn], ['ОГРН / ОГРНИП', candidate.ogrn], ['КПП', candidate.kpp], ['Адрес по данным источника', candidate.address],
            ['Руководитель из источника', candidate.managerName], ['Должность руководителя', candidate.managerPosition],
            ['Сокращённое наименование', candidate.shortName], ['Организационно-правовая форма', candidate.legalForm],
            ['Дата регистрации', date(candidate.registrationDate)],
          ].map(([label, text]) => <Grid item xs={12} sm={label === 'Полное наименование' || label === 'Адрес по данным источника' ? 12 : 6} key={label}><Typography variant="body2" color="text.secondary">{label}</Typography><Typography sx={{ mt: .5, overflowWrap: 'anywhere' }}>{text || 'Не указано'}</Typography></Grid>)}</Grid>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}><TextField label="Телефон" type="tel" value={phone} disabled={busy} inputProps={{ maxLength: 100 }} onChange={e => { setPhone(e.target.value); setManualFields(fields => [...new Set<keyof Party>([...fields, 'phone'])]); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } }} helperText="Добавьте или измените контактный телефон самостоятельно"/></Grid>
            <Grid item xs={12} sm={6}><TextField label="Регистрирующий орган" value={registrationAuthority} disabled={busy} inputProps={{ maxLength: 1000 }} onChange={e => { setRegistrationAuthority(e.target.value); setManualFields(fields => [...new Set<keyof Party>([...fields, 'registrationAuthority'])]); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } }} helperText="Можно заполнить вручную, если DaData не вернула сведения"/></Grid>
          </Grid>
          {(candidate.dataInvalid || candidate.status !== 'ACTIVE') && <Alert severity="warning" sx={{ mt: 2 }}>{candidate.dataInvalid ? 'Источник отметил недостоверность части сведений. Проверьте данные перед использованием.' : 'Проверьте статус организации перед использованием её реквизитов.'}</Alert>}
          <FormControlLabel sx={{ mt: 1.5 }} control={<Checkbox checked={useManager} disabled={!candidate.managerName} onChange={e => setUseManager(e.target.checked)}/>} label="Подставить руководителя как подписанта"/>
          <Typography variant="body2" color="text.secondary">Этот выбор заменит ФИО и должность подписанта в форме. Полномочия подписанта подтверждаются отдельно.</Typography>
          {candidate.standardizedAddress && candidate.standardizedAddress !== candidate.address && <Box sx={{ mt: 2 }}><FormControlLabel control={<Checkbox checked={useStandardAddress} onChange={e => setUseStandardAddress(e.target.checked)}/>} label="Использовать адрес, приведённый DaData к стандартному виду"/><Typography variant="body2" color="text.secondary">{candidate.standardizedAddress}</Typography></Box>}
        </Box>}
        {candidate && directoryKind && <FormControlLabel sx={{ mt: 2 }} control={<Checkbox checked={autoRefresh} disabled={busy} onChange={e => setAutoRefresh(e.target.checked)}/>} label="Автоматически обновлять компанию в справочнике ночью"/>}
        {result && <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Источник: DaData · Получено {dateTime(result.retrievedAt)}{result.fromCache ? ' · Из кеша сервера' : ''}. {directoryKind ? 'Сохраните компанию в справочник для повторного выбора или подставьте только в форму. Саму декларацию сохраните отдельно.' : 'Изменения попадут только в открытую форму; сохраните её отдельно.'}</Typography>}
        </fieldset>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, flexWrap: 'wrap', gap: 1 }}><Button type="button" disabled={saving.isLoading || preparing} onClick={close}>Отмена</Button><Button type="button" variant={directoryKind ? 'outlined' : 'contained'} disabled={!candidate || busy || disabled} onClick={apply}>Подставить реквизиты</Button>{directoryKind && <Button type="button" variant="contained" disabled={!candidate || busy || disabled} onClick={() => void saveAndApply()}>{saving.isLoading ? 'Сохраняем…' : 'Сохранить в справочник и подставить'}</Button>}</DialogActions>
    </Dialog>
    {warningDialog}
  </>;
}
