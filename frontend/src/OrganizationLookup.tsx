import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, Link, Radio, RadioGroup, TextField, Typography } from '@mui/material';
import { SearchRounded } from '@mui/icons-material';
import { api } from './store';
import { useWorkspace } from './common';
import { date, dateTime, emptyParty, errorMessage, type OrganizationInput, type OrganizationLookupResult, type OrganizationRequisites, type Party } from './types';
import { useDaDataOverwriteWarning } from './DaDataOverwriteWarning';

const organizationStatuses: Record<string, string> = { ACTIVE: 'Действующая', LIQUIDATING: 'Ликвидируется', LIQUIDATED: 'Ликвидирована', BANKRUPT: 'Банкротство', REORGANIZING: 'Реорганизация' };

type LookupOrigin = Pick<OrganizationInput, 'replaceFromDaData' | 'manuallyEditedFields'> & { keepDeclarationAddress?: boolean };
type AddressChoice = 'current' | 'source' | 'standardized';

export const isRussianOrganizationIdentifier = (value: string) => /^(\d{10}|\d{12}|\d{13}|\d{15})$/.test(value);

export function OrganizationLookup({ value, onApply, disabled = false, directoryKind, inline = false, onClose, declarationApplicant, initialIdentifier, searchOnOpen = false }: {
  value: Party;
  onApply: (data: OrganizationRequisites, origin?: LookupOrigin) => void;
  disabled?: boolean;
  directoryKind?: OrganizationInput['kind'];
  inline?: boolean;
  onClose?: () => void;
  declarationApplicant?: { printAddress: string };
  initialIdentifier?: string;
  searchOnOpen?: boolean;
}) {
  const { firmId } = useWorkspace();
  const { confirmOverwrite, warningDialog } = useDaDataOverwriteWarning();
  const integrations = api.useIntegrationsQuery(firmId);
  const configured = integrations.data?.find(integration => integration.id === 'organizations')?.status === 'Configured';
  const [lookup, { isLoading }] = api.useLookupOrganizationMutation();
  const [saveOrganization, saving] = api.useSaveOrganizationMutation();
  const [matchOrganization] = api.useLazyMatchOrganizationQuery();
  const [preparing, setPreparing] = useState(false);
  const [open, setOpen] = useState(false);
  const [prefill] = useState(() => {
    const query = inline ? (initialIdentifier ?? (value.ogrn || value.inn)) : '';
    const kpp = query && (query === value.ogrn || query === value.inn) ? value.kpp : '';
    return { query, kpp };
  });
  const [query, setQuery] = useState(prefill.query); const [kpp, setKpp] = useState(prefill.kpp);
  const [error, setError] = useState(''); const [result, setResult] = useState<OrganizationLookupResult | null>(null);
  const [selected, setSelected] = useState(-1); const [useManager, setUseManager] = useState(false);
  const [addressChoice, setAddressChoice] = useState<AddressChoice>('source');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [phone, setPhone] = useState('');
  const [registrationAuthority, setRegistrationAuthority] = useState('');
  const [manualFields, setManualFields] = useState<(keyof Party)[]>([]);
  const busy = isLoading || saving.isLoading || preparing;
  const generation = useRef(0);
  const activeRequest = useRef<{ abort: () => void } | null>(null);
  const autoSearched = useRef(false);
  const prefilledKpp = useRef(!!prefill.kpp);
  const currentAddress = declarationApplicant ? declarationApplicant.printAddress.trim() || value.address.trim() : '';
  const keepDeclarationAddress = addressChoice === 'current' && !!currentAddress;
  useEffect(() => () => { generation.current++; activeRequest.current?.abort(); autoSearched.current = false; }, []);
  useEffect(() => {
    if (!inline || !searchOnOpen || !configured || disabled || autoSearched.current) return;
    autoSearched.current = true;
    if (prefill.query === query.trim() && prefill.kpp === kpp && isRussianOrganizationIdentifier(prefill.query))
      void search(prefill.query, prefill.kpp);
  }, [inline, configured, disabled, searchOnOpen]);
  const candidate = result?.items[selected];

  function selectCandidate(index: number, items = result?.items ?? []) {
    const item = items[index];
    const sameApplicant = item && (value.inn || value.ogrn)
      && (!value.inn || value.inn === item.inn)
      && (!value.ogrn || value.ogrn === item.ogrn)
      && (!value.kpp || value.kpp === item.kpp);
    const useCurrent = currentAddress && (!sameApplicant || !(item?.address || item?.standardizedAddress));
    const foundAddress = currentAddress && !item?.address && item?.standardizedAddress ? 'standardized' : 'source';
    setManualFields([]);
    setSelected(index); setUseManager(false);
    setAddressChoice(useCurrent ? 'current' : foundAddress);
    setPhone(item?.phone ?? '');
    setRegistrationAuthority(item?.registrationAuthority?.trim() ?? '');
  }
  function clearResult() { setResult(null); setSelected(-1); setError(''); setUseManager(false); setAddressChoice('source'); setPhone(''); setRegistrationAuthority(''); setManualFields([]); }
  function updateQuery(next: string) {
    if (prefilledKpp.current && next.trim() !== query.trim()) {
      prefilledKpp.current = false;
      setKpp('');
    }
    setQuery(next);
    clearResult();
  }
  function close() { if (saving.isLoading || preparing) return; generation.current++; activeRequest.current?.abort(); setOpen(false); clearResult(); onClose?.(); }
  async function search(identifier = query, branchKpp = kpp) {
    if (saving.isLoading) return;
    const digits = identifier.trim(); const branch = branchKpp.trim(); clearResult();
    if (!isRussianOrganizationIdentifier(digits)) { setError('Введите ИНН из 10 или 12 цифр либо ОГРН / ОГРНИП из 13 или 15 цифр.'); return; }
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
    const address = addressChoice === 'standardized' ? candidate!.standardizedAddress : candidate!.address ?? '';
    return { ...emptyParty(), name: candidate!.name, inn: candidate!.inn, ogrn: candidate!.ogrn, kpp: candidate!.kpp, address, country: 'Россия',
      shortName: candidate!.shortName ?? '', legalForm: candidate!.legalForm ?? '', registrationDate: candidate!.registrationDate ?? null,
      registrationAuthority: registrationAuthority.trim(), phone: phone.trim(), email: candidate!.email ?? '', managerName: candidate!.managerName ?? '', managerPosition: candidate!.managerPosition ?? '',
      ...(useManager && candidate!.managerName ? { signatory: candidate!.managerName, position: candidate!.managerPosition } : {}) };
  }
  function sourceManualFields(): (keyof Party)[] {
    return [...new Set<keyof Party>([...manualFields, ...(useManager && candidate?.managerName ? ['signatory', 'position'] as const : [])])];
  }
  function formRequisites(data: OrganizationRequisites): OrganizationRequisites {
    return keepDeclarationAddress ? { ...data, address: value.address, country: value.country } : data;
  }
  async function apply() {
    if (!candidate || disabled || busy) return;
    const data = formRequisites(requisites()); const current = generation.current;
    const replacesFormValues = (Object.keys(data) as (keyof Party)[]).some(key =>
      !['inn', 'ogrn', 'kpp'].includes(key) && typeof value[key] === 'string' && String(value[key]).trim() !== '' && String(value[key]).trim() !== String(data[key] ?? '').trim());
    setPreparing(true);
    try {
      if (replacesFormValues && !await confirmOverwrite('apply')) return;
      if (generation.current !== current) return;
      onApply(data, { replaceFromDaData: true, manuallyEditedFields: sourceManualFields(), ...(keepDeclarationAddress ? { keepDeclarationAddress } : {}) });
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
        onApply(formRequisites({ ...data, phone: saved.phone, address: saved.address, shortName: saved.shortName,
          legalForm: saved.legalForm, registrationDate: saved.registrationDate, registrationAuthority: saved.registrationAuthority,
          managerName: saved.managerName, managerPosition: saved.managerPosition }), keepDeclarationAddress ? { keepDeclarationAddress } : undefined);
        setOpen(false); clearResult();
      }
    } catch (error) { if (generation.current === current) setError(errorMessage(error)); }
    finally { setPreparing(false); }
  }

  const content = <>
      <DialogTitle id="organization-lookup-title">Поиск реквизитов в DaData</DialogTitle>
      <DialogContent sx={{ pt: '10px !important' }}>
        <fieldset disabled={saving.isLoading || preparing} style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
        <Typography color="text.secondary" sx={{ mb: 2.5 }}>Найдите российскую организацию или ИП и проверьте реквизиты. Телефон и регистрирующий орган можно дополнить вручную ниже. Ночная проверка только отмечает изменения в справочнике. При обновлении кнопкой можно выбрать, сохранять ли ручные поля.</Typography>
        {integrations.isLoading ? <Typography sx={{ mb: 2 }}>Проверяем настройку подключения…</Typography> : integrations.error ? <Alert severity="warning" sx={{ mb: 2 }} action={<Button onClick={() => void integrations.refetch()}>Повторить</Button>}>Не удалось получить состояние подключения. Ручной ввод доступен.</Alert> : !configured && <Alert severity="info" sx={{ mb: 2 }}>Добавьте свой API-ключ DaData в <Link href="#/settings" target="_blank" rel="noopener noreferrer">настройках личного кабинета</Link> и нажмите «Сохранить и проверить». Пока можно заполнить реквизиты вручную.</Alert>}
        <Grid container spacing={2} alignItems="flex-start">
          <Grid item xs={12} sm={7}><TextField autoFocus label="ИНН или ОГРН / ОГРНИП" value={query} disabled={isLoading} inputProps={{ maxLength: 15, inputMode: 'numeric' }} onChange={e => updateQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (configured && !isLoading) void search(); } }}/></Grid>
          <Grid item xs={12} sm={5}><TextField label="КПП филиала (необязательно)" helperText="Уточните филиал, если знаете КПП" value={kpp} disabled={isLoading} inputProps={{ maxLength: 9, inputMode: 'numeric' }} onChange={e => { prefilledKpp.current = false; setKpp(e.target.value); clearResult(); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); if (configured && !isLoading) void search(); } }}/></Grid>
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
          {declarationApplicant && (value.name || value.managerName || value.managerPosition) && <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">Руководитель в декларации</Typography>
            <Typography sx={{ mt: .5 }}>{[value.managerName, value.managerPosition].filter(Boolean).join(' · ') || 'Не указан'}</Typography>
          </Box>}
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid item xs={12} sm={6}><TextField label="Телефон" type="tel" value={phone} disabled={busy} inputProps={{ maxLength: 100 }} onChange={e => { setPhone(e.target.value); setManualFields(fields => [...new Set<keyof Party>([...fields, 'phone'])]); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } }} helperText="Добавьте или измените контактный телефон самостоятельно"/></Grid>
            <Grid item xs={12} sm={6}><TextField label="Регистрирующий орган" value={registrationAuthority} disabled={busy} inputProps={{ maxLength: 1000 }} onChange={e => { setRegistrationAuthority(e.target.value); setManualFields(fields => [...new Set<keyof Party>([...fields, 'registrationAuthority'])]); }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.stopPropagation(); } }} helperText="Можно заполнить вручную, если DaData не вернула сведения"/></Grid>
          </Grid>
          {(candidate.dataInvalid || candidate.status !== 'ACTIVE') && <Alert severity="warning" sx={{ mt: 2 }}>{candidate.dataInvalid ? 'Источник отметил недостоверность части сведений. Проверьте данные перед использованием.' : 'Проверьте статус организации перед использованием её реквизитов.'}</Alert>}
          <FormControlLabel sx={{ mt: 1.5 }} control={<Checkbox checked={useManager} disabled={!candidate.managerName} onChange={e => setUseManager(e.target.checked)}/>} label="Подставить руководителя как подписанта"/>
          <Typography variant="body2" color="text.secondary">Этот выбор заменит ФИО и должность подписанта в форме. Полномочия подписанта подтверждаются отдельно.</Typography>
          {currentAddress && <Box sx={{ mt: 2 }}>
            <Typography component="h4" sx={{ fontWeight: 600 }}>Адрес заявителя</Typography>
            <RadioGroup aria-label="Адрес заявителя" value={addressChoice} onChange={e => setAddressChoice(e.target.value as AddressChoice)}>
              <FormControlLabel value="current" control={<Radio/>} label={<><strong>Сохранить текущий адрес</strong><br/>{currentAddress}</>}/>
              {candidate.address && <FormControlLabel value="source" control={<Radio/>} label={<><strong>Использовать найденный адрес</strong><br/>{candidate.address}</>}/>}
              {candidate.standardizedAddress && candidate.standardizedAddress !== candidate.address && <FormControlLabel value="standardized" control={<Radio/>} label={<><strong>Использовать стандартизованный адрес</strong><br/>{candidate.standardizedAddress}</>}/>}
            </RadioGroup>
          </Box>}
          {!currentAddress && candidate.standardizedAddress && candidate.standardizedAddress !== candidate.address && <Box sx={{ mt: 2 }}><FormControlLabel control={<Checkbox checked={addressChoice === 'standardized'} onChange={e => setAddressChoice(e.target.checked ? 'standardized' : 'source')}/>} label="Использовать адрес, приведённый DaData к стандартному виду"/><Typography variant="body2" color="text.secondary">{candidate.standardizedAddress}</Typography></Box>}
        </Box>}
        {candidate && directoryKind && <FormControlLabel sx={{ mt: 2 }} control={<Checkbox checked={autoRefresh} disabled={busy} onChange={e => setAutoRefresh(e.target.checked)}/>} label="Проверять изменения компании в DaData каждую ночь"/>}
        {result && <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Источник: DaData · Получено {dateTime(result.retrievedAt)}{result.fromCache ? ' · Из кеша сервера' : ''}. {directoryKind ? 'Сохраните компанию в справочник для повторного выбора или подставьте только в форму. Саму декларацию сохраните отдельно.' : 'Изменения попадут только в открытую форму; сохраните её отдельно.'}</Typography>}
        </fieldset>
      </DialogContent>
      <DialogActions sx={{ p: 2.5, flexWrap: 'wrap', gap: 1 }}><Button type="button" disabled={saving.isLoading || preparing} onClick={close}>Отмена</Button><Button type="button" variant={directoryKind ? 'outlined' : 'contained'} disabled={!candidate || busy || disabled} onClick={apply}>Подставить реквизиты</Button>{directoryKind && <Button type="button" variant="contained" disabled={!candidate || busy || disabled} onClick={() => void saveAndApply()}>{saving.isLoading ? 'Сохраняем…' : 'Сохранить в справочник и подставить'}</Button>}</DialogActions>
  </>;
  return <>
    {!inline && (<Button type="button" disabled={disabled} startIcon={<SearchRounded/>} onClick={() => { const identifier = value.ogrn || value.inn; clearResult(); setQuery(identifier); setKpp(value.kpp); prefilledKpp.current = !!value.kpp; setOpen(true); if (configured && isRussianOrganizationIdentifier(identifier)) void search(identifier, value.kpp); }}>Найти по ИНН / ОГРН</Button>)}
    {inline ? <Box className="builder-lookup" role="region" aria-labelledby="organization-lookup-title">{content}</Box> : <Dialog open={open} onClose={close} maxWidth="md" fullWidth aria-labelledby="organization-lookup-title">{content}</Dialog>}
    {warningDialog}
  </>;
}
