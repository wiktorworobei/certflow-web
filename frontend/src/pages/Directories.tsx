import { LaboratoryFields } from '../LaboratoryFields';
import { LaboratoryDirectory } from '../LaboratoryDirectory';
import { emptyLaboratoryDetails } from '../evidenceTypes';
import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, InputAdornment, MenuItem, Paper, Tab, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField, Typography } from '@mui/material';
import { RefreshRounded } from '@mui/icons-material';
import { AddRounded } from '@mui/icons-material';
import { SearchRounded } from '@mui/icons-material';
import { EditOutlined } from '@mui/icons-material';
import { ArchiveOutlined, DeleteForeverOutlined, DeleteOutlineRounded, UnarchiveOutlined } from '@mui/icons-material';
import { CorporateFareOutlined } from '@mui/icons-material';
import { ScienceOutlined } from '@mui/icons-material';
import type { ArchiveAction } from '../types';
import { api } from '../store';
import { EmptyState, ErrorState, Loading, PageTitle, useNotify, useWorkspace } from '../common';
import { dateTime, emptyParty, errorMessage, type Laboratory, type Organization, type OrganizationInput, type Party } from '../types';
import { OrganizationLookup } from '../OrganizationLookup';
import { useDaDataOverwriteWarning } from '../DaDataOverwriteWarning';
import { ArchiveSelectionDialog, type ArchiveSelection } from '../ArchiveSelectionDialog';

const kindLabel = { Applicant: 'Заявитель', Manufacturer: 'Изготовитель', Both: 'Заявитель и изготовитель' };
const registryStatuses: Record<string, string> = { ACTIVE: 'Действующая', LIQUIDATING: 'Ликвидируется', LIQUIDATED: 'Ликвидирована', BANKRUPT: 'Банкротство', REORGANIZING: 'Реорганизация' };
const canRefresh = (org: Party) => ['Россия', 'РФ', 'RU', 'Российская Федерация'].includes(org.country.trim()) && /^(\d{10}|\d{12}|\d{13}|\d{15})$/.test(org.ogrn || org.inn);
function RegistryState({ org }: { org: Organization }) {
  if (!canRefresh(org)) return <Typography variant="body2" color="text.secondary">Ручное ведение</Typography>;
  return <div style={{ maxWidth: 350, minWidth: 170 }}>
    {org.registryStatus && <Chip size="small" color={org.registryStatus === 'ACTIVE' && !org.dataInvalid ? 'success' : 'warning'} variant="outlined" label={registryStatuses[org.registryStatus] || org.registryStatus} sx={{ mb: .5 }}/>}
    <Typography variant="body2">{org.registryCheckedAt ? `Обновлено ${dateTime(org.registryCheckedAt)}` : 'Ещё не обновлялась'}</Typography>
    <Typography variant="caption" color="text.secondary">{org.autoRefresh !== false ? 'Автообновление включено' : 'Автообновление выключено'}</Typography>
    {!!org.manuallyEditedFields?.length && <Typography variant="body2" color="text.secondary">Ручных полей: {org.manuallyEditedFields.length} · защищены ночью</Typography>}
    {org.dataInvalid && <Typography variant="body2" color="warning.main">Источник отметил недостоверные сведения</Typography>}
    {org.registryError && <Typography role="alert" variant="body2" color="error.main" sx={{ mt: .5 }}>{org.registryError}{org.registryAttemptedAt ? ` · ${dateTime(org.registryAttemptedAt)}` : ''}</Typography>}
  </div>;
}
function OrganizationTable({ rows, archived, refreshing, onEdit, onRefresh, onDelete }: {
  rows: Organization[]; archived: boolean; refreshing: boolean; onEdit: (org: Organization) => void; onRefresh: (org: Organization) => void; onDelete: (org: Organization) => void;
}) {
  const { canEdit } = useWorkspace();
  const [selected, setSelected] = useState<string[]>([]);
  const [batch, setBatch] = useState<{ items: ArchiveSelection[]; action: ArchiveAction } | null>(null);
  const chosen = rows.filter(x => selected.includes(x.id));
  const targets = (orgs: Organization[]) => orgs.map(x => ({ id: x.id, revision: x.revision, title: x.name }));
  return <>
    {canEdit && <FormControlLabel className="organization-select-all" control={<Checkbox inputProps={{ 'aria-label': 'Выбрать все найденные компании' }} checked={chosen.length === rows.length} indeterminate={chosen.length > 0 && chosen.length < rows.length} onChange={e => setSelected(e.target.checked ? rows.map(x => x.id) : [])}/>} label="Выбрать все найденные компании"/>}
    {canEdit && chosen.length > 0 && <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, px: 2.5, py: 1.5 }}><Typography>Выбрано: {chosen.length}</Typography>{archived && <Button startIcon={<UnarchiveOutlined/>} onClick={() => setBatch({ items: targets(chosen), action: 'restore' })}>Восстановить выбранные</Button>}<Button startIcon={archived ? <DeleteForeverOutlined/> : <ArchiveOutlined/>} color={archived ? 'error' : 'primary'} onClick={() => setBatch({ items: targets(chosen), action: archived ? 'purge' : 'archive' })}>{archived ? 'Удалить выбранные навсегда' : 'В архив выбранные'}</Button><Button onClick={() => setSelected([])}>Снять выбор</Button></Box>}
    <TableContainer className="organization-list"><Table aria-label={archived ? 'Архив компаний' : 'Справочник компаний'}><TableHead><TableRow>{canEdit && <TableCell padding="checkbox"><Checkbox inputProps={{ 'aria-label': 'Выбрать все найденные компании' }} checked={chosen.length === rows.length} indeterminate={chosen.length > 0 && chosen.length < rows.length} onChange={e => setSelected(e.target.checked ? rows.map(x => x.id) : [])}/></TableCell>}<TableCell>КОМПАНИЯ</TableCell><TableCell>НАЗНАЧЕНИЕ</TableCell><TableCell>ИНН / ОГРН / КПП</TableCell><TableCell>{archived ? 'АРХИВИРОВАНИЕ' : 'АКТУАЛЬНОСТЬ'}</TableCell><TableCell/></TableRow></TableHead>
      <TableBody>{rows.map(org => <TableRow key={org.id} hover selected={selected.includes(org.id)}>
        {canEdit && <TableCell padding="checkbox"><Checkbox inputProps={{ 'aria-label': `Выбрать ${org.name}` }} checked={selected.includes(org.id)} onChange={() => setSelected(ids => ids.includes(org.id) ? ids.filter(x => x !== org.id) : [...ids, org.id])}/></TableCell>}
        <TableCell><strong>{org.name}</strong><div className="table-secondary">{org.address || 'Адрес не указан'} · {org.country}</div></TableCell><TableCell data-label="НАЗНАЧЕНИЕ">{kindLabel[org.kind]}</TableCell><TableCell data-label="ИНН / ОГРН / КПП">{org.inn || '—'}<div className="table-secondary">{org.ogrn}</div><div className="table-secondary">КПП {org.kpp || '—'}</div></TableCell>
        <TableCell data-label={archived ? 'АРХИВИРОВАНИЕ' : 'АКТУАЛЬНОСТЬ'}>{archived ? <><Typography variant="body2">{org.archivedAt ? dateTime(org.archivedAt) : '—'} · {org.archivedBy}</Typography><Typography variant="body2" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>{org.archiveComment}</Typography></> : <RegistryState org={org}/>}</TableCell>
        <TableCell>{canEdit && <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: .5 }}>{!archived && <><Button size="small" aria-label={`Редактировать ${org.name}`} disabled={refreshing} startIcon={<EditOutlined fontSize="small"/>} onClick={() => onEdit(org)}>Изменить</Button>{canRefresh(org) && <Button size="small" startIcon={<RefreshRounded/>} disabled={refreshing} aria-label={`Обновить ${org.name}`} onClick={() => onRefresh(org)}>Обновить</Button>}</>}{archived && <Button size="small" startIcon={<UnarchiveOutlined/>} disabled={refreshing} aria-label={`Восстановить ${org.name}`} onClick={() => setBatch({ items: targets([org]), action: 'restore' })}>Восстановить</Button>}<Button size="small" color={archived ? 'error' : 'primary'} startIcon={archived ? <DeleteForeverOutlined/> : <ArchiveOutlined/>} disabled={refreshing} aria-label={`${archived ? 'Удалить навсегда' : 'Архивировать'} ${org.name}`} onClick={() => setBatch({ items: targets([org]), action: archived ? 'purge' : 'archive' })}>{archived ? 'Удалить навсегда' : 'В архив'}</Button>{!archived && <Button size="small" color="error" startIcon={<DeleteOutlineRounded/>} disabled={refreshing} aria-label={`Удалить ${org.name}`} onClick={() => onDelete(org)}>Удалить</Button>}</Box>}</TableCell>
      </TableRow>)}</TableBody></Table></TableContainer>
    {batch && <ArchiveSelectionDialog entity="organizations" items={batch.items} action={batch.action} onClose={() => setBatch(null)} onComplete={() => setSelected([])}/>}
  </>;
}

export function Directories() {
  const { firmId, canEdit } = useWorkspace(); const notify = useNotify();
  const { confirmOverwrite, warningDialog } = useDaDataOverwriteWarning();
  const orgs = api.useOrganizationsQuery(firmId, { pollingInterval: 60000, refetchOnFocus: true });
  const schedule = api.useOrganizationRefreshScheduleQuery(firmId);
  const [refreshOrg, refreshState] = api.useRefreshOrganizationMutation();
  const [deleteOrg, deleteState] = api.useDeleteOrganizationMutation();
  const [matchOrg, matchState] = api.useLazyMatchOrganizationQuery();
  const [confirmingSave, setConfirmingSave] = useState(false);
  const saveScope = useRef(firmId);
  useEffect(() => { saveScope.current = firmId; return () => { saveScope.current = ''; }; }, [firmId]);
  const [saveOrg, orgSave] = api.useSaveOrganizationMutation(); const [saveLab, labSave] = api.useSaveLaboratoryMutation();
  const [tab, setTab] = useState(0); const [search, setSearch] = useState(''); const [error, setError] = useState('');
  const archive = api.useArchivedOrganizationsQuery(firmId, { skip: tab !== 2 });
  const currentOrganizations = tab === 2 ? archive : orgs;
  const [organization, setOrganization] = useState<(OrganizationInput & { id?: string }) | null>(null);
  const [laboratory, setLaboratory] = useState<(Omit<Laboratory, 'id' | 'firmId'> & { id?: string }) | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ firmId: string; id: string; name: string } | null>(null);
  const [deleteError, setDeleteError] = useState('');
  useEffect(() => { setDeleteTarget(null); setDeleteError(''); }, [firmId]);
  useEffect(() => { setOrganization(null); setLaboratory(null); setError(''); }, [firmId]);
  const term = search.trim().toLocaleLowerCase('ru');
  const orgRows = (currentOrganizations.currentData ?? []).filter(o => `${o.name} ${o.shortName} ${o.inn} ${o.ogrn} ${o.kpp} ${o.country}`.toLocaleLowerCase('ru').includes(term));
  const create = () => { setError(''); tab === 0 ? setOrganization({ ...emptyParty(), kind: 'Applicant', autoRefresh: true }) : setLaboratory({ name: '', accreditationNumber: '', address: '', details: emptyLaboratoryDetails() }); };
  async function refresh(org: Organization) {
    if (!await confirmOverwrite('refresh', org)) return;
    try {
      const updated = await refreshOrg({ firmId, id: org.id }).unwrap();
      notify(updated.registryError || `Реквизиты «${updated.name}» обновлены`, updated.registryError ? 'error' : 'success');
    } catch (error) { notify(errorMessage(error), 'error'); }
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');

    try {
      if (organization) {
        const { id, ...data } = organization;
        if (!id && data.replaceFromDaData && (data.inn.trim() || data.ogrn.trim())) {
          setConfirmingSave(true);
          const existing = (await matchOrg({ firmId, inn: data.inn, ogrn: data.ogrn, kpp: data.kpp }, false).unwrap()).organization;
          if (saveScope.current !== firmId) return;
          if (existing && !await confirmOverwrite('save', existing)) return;
          if (saveScope.current !== firmId) return;
          if (existing) data.existingOrganizationId = existing.id;
        }
        await saveOrg({ firmId, id, data }).unwrap(); setOrganization(null);
      }
      if (laboratory) { const { id, ...data } = laboratory; await saveLab({ firmId, id, data }).unwrap(); setLaboratory(null); }
      notify('Запись сохранена');
    } catch (e) { setError(errorMessage(e)); }
    finally { setConfirmingSave(false); }
  }
  const busy = orgSave.isLoading || labSave.isLoading || matchState.isFetching || confirmingSave;
  async function removeOrganization() {
    if (!deleteTarget || !canEdit) return;
    setDeleteError('');
    try {
      await deleteOrg({ firmId: deleteTarget.firmId, id: deleteTarget.id }).unwrap();
      setDeleteTarget(null); notify(`Компания «${deleteTarget.name}» удалена из справочника`);
    } catch (error) { setDeleteError(errorMessage(error)); }
  }
  function editOrganizationField(key: keyof Party, value: Party[keyof Party]) {
    setOrganization(current => current ? { ...current, [key]: value,
      ...(current.replaceFromDaData ? { manuallyEditedFields: [...new Set<keyof Party>([...(current.manuallyEditedFields ?? []), key])] } : {}) } : null);
  }
  const orgField = (key: keyof Party, label: string, required = false) => <TextField label={label} required={required} value={organization?.[key] ?? ''} onChange={e => editOrganizationField(key, e.target.value)} type={key === 'email' ? 'email' : key === 'phone' ? 'tel' : 'text'} helperText={key === 'registrationAuthority' ? 'Заполните или исправьте вручную, если сведений нет в DaData' : key === 'phone' ? 'Контактный телефон можно добавить или изменить самостоятельно' : undefined}/>;
  return <><PageTitle eyebrow="ПОВТОРНОЕ ИСПОЛЬЗОВАНИЕ ДАННЫХ" title="Справочники" subtitle="Сохраните реквизиты один раз и подставляйте их в новые декларации.">{canEdit && tab !== 2 && <Button variant="contained" startIcon={<AddRounded/>} onClick={create}>{tab === 0 ? 'Добавить компанию' : 'Добавить лабораторию'}</Button>}</PageTitle>
    {tab === 0 && <Alert severity="info" sx={{ mb: 2 }}>{schedule.data ? schedule.data.enabled ? `Российские компании с ИНН / ОГРН обновляются ежедневно в ${String(schedule.data.hour).padStart(2, '0')}:00 (${schedule.data.timeZoneId}). Если сервер был выключен, пропущенное обновление выполняется после запуска.` : 'Ночное обновление отключено на сервере. Обновляйте реквизиты кнопкой в строке компании.' : schedule.error ? 'Не удалось получить расписание обновления.' : 'Загружаем расписание обновления…'} Ночью ручные поля сохраняются. Кнопка «Обновить» заменяет их данными DaData и очищает отсутствующие значения после предупреждения. Обновление справочника не изменяет сохранённые декларации.</Alert>}
    <Paper className="table-card"><Tabs variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Разделы справочников" value={tab} onChange={(_, v) => { setTab(v); setSearch(''); }} sx={{ px: 2, borderBottom: '1px solid var(--border)' }}><Tab icon={<CorporateFareOutlined sx={{ fontSize: 18 }}/>} iconPosition="start" label={`Компании · ${orgs.data?.length ?? 0}`}/><Tab icon={<ScienceOutlined sx={{ fontSize: 18 }}/>} iconPosition="start" label="Лаборатории"/><Tab icon={<ArchiveOutlined sx={{ fontSize: 18 }}/>} iconPosition="start" label="Архив компаний"/></Tabs>{tab !== 1 && <div className="registry-toolbar"><TextField sx={{ maxWidth: 430 }} placeholder={tab !== 1 ? 'Название компании или ИНН' : 'Название или номер аккредитации'} inputProps={{ 'aria-label': 'Поиск в справочнике' }} value={search} onChange={e => setSearch(e.target.value)} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded fontSize="small"/></InputAdornment> }}/></div>}
      {tab === 1 ? <LaboratoryDirectory key={firmId}/> : currentOrganizations.isLoading || !currentOrganizations.currentData && currentOrganizations.isFetching ? <Loading/> : currentOrganizations.error ? <ErrorState error={currentOrganizations.error}/> : orgRows.length ? <OrganizationTable key={`${firmId}:${tab}:${search}`} rows={orgRows} archived={tab === 2} refreshing={refreshState.isLoading || deleteState.isLoading} onDelete={org => { setDeleteTarget({ firmId, id: org.id, name: org.name }); setDeleteError(''); }} onEdit={org => { setOrganization({ ...org }); setError(''); }} onRefresh={org => void refresh(org)}/> : <EmptyState title={tab === 2 ? 'Архив компаний пуст' : 'Компании не найдены'} text={tab === 2 ? 'Архивируйте компании из рабочего справочника или измените поиск.' : 'Добавьте заявителя или изготовителя в справочник.'}/>}
    </Paper><Typography color="text.secondary" variant="body2" sx={{ mt: 2.5 }}>Справочники доступны только участникам выбранной компании.</Typography>
    <Dialog aria-labelledby="directory-editor-title" open={!!organization || !!laboratory} onClose={() => !busy && (setOrganization(null), setLaboratory(null))} maxWidth="md" fullWidth><form onSubmit={submit}><DialogTitle id="directory-editor-title">{organization ? (organization.id ? 'Редактирование компании' : 'Новая компания') : (laboratory?.id ? 'Редактирование лаборатории' : 'Новая лаборатория')}</DialogTitle><DialogContent sx={{ pt: '15px !important' }}>{organization && <Alert severity="info" sx={{ mb: 2 }}>Все реквизиты можно заполнить и изменить вручную, в том числе телефон и регистрирующий орган. Ночью ручные поля сохраняются. Ручное обновление из DaData заменяет их после предупреждения и очищает отсутствующие значения.</Alert>}{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {organization && <div style={{ marginBottom: 20 }}><OrganizationLookup value={organization} disabled={busy} onApply={(data, origin) => setOrganization(current => current ? { ...current, ...data, ...origin } : null)}/></div>}
      {organization && <FormControlLabel sx={{ mb: 2 }} control={<Checkbox checked={organization.autoRefresh !== false} disabled={busy} onChange={e => setOrganization({ ...organization, autoRefresh: e.target.checked })}/>} label="Автоматически обновлять реквизиты из DaData каждую ночь (для российских компаний с ИНН / ОГРН)"/>}
      {organization && <Grid container spacing={2.5}><Grid item xs={12} sm={8}>{orgField('name', 'Полное наименование', true)}</Grid><Grid item xs={12} sm={4}><TextField select label="Назначение" value={organization.kind} onChange={e => setOrganization({ ...organization, kind: e.target.value as Organization['kind'] })}>{Object.entries(kindLabel).map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField></Grid><Grid item xs={12} sm={4}>{orgField('inn', 'ИНН')}</Grid><Grid item xs={12} sm={4}>{orgField('ogrn', 'ОГРН / ОГРНИП')}</Grid><Grid item xs={12} sm={4}>{orgField('kpp', 'КПП')}</Grid><Grid item xs={12} sm={4}>{orgField('country', 'Страна', true)}</Grid><Grid item xs={12} sm={8}>{orgField('address', 'Адрес')}</Grid><Grid item xs={12} sm={6}>{orgField('email', 'Электронная почта')}</Grid><Grid item xs={12} sm={6}>{orgField('phone', 'Телефон')}</Grid><Grid item xs={12} sm={6}>{orgField('signatory', 'ФИО подписанта')}</Grid><Grid item xs={12} sm={6}>{orgField('position', 'Должность')}</Grid></Grid>}
      {organization && <Grid container spacing={2.5} sx={{ mt: .5 }}><Grid item xs={12} sm={6}>{orgField('shortName', 'Сокращённое наименование')}</Grid><Grid item xs={12} sm={6}>{orgField('legalForm', 'Организационно-правовая форма')}</Grid><Grid item xs={12} sm={4}><TextField type="date" label="Дата регистрации организации" InputLabelProps={{ shrink: true }} value={organization.registrationDate ?? ''} onChange={e => editOrganizationField('registrationDate', e.target.value || null)}/></Grid><Grid item xs={12} sm={8}>{orgField('registrationAuthority', 'Регистрирующий орган')}</Grid><Grid item xs={12} sm={6}>{orgField('managerName', 'Руководитель по данным источника')}</Grid><Grid item xs={12} sm={6}>{orgField('managerPosition', 'Должность руководителя')}</Grid></Grid>}
      {laboratory && <Grid container spacing={2.5}><Grid item xs={12}><TextField required label="Наименование лаборатории" value={laboratory.name} onChange={e => setLaboratory({ ...laboratory, name: e.target.value })}/></Grid><Grid item xs={12}><TextField label="Номер аккредитации" value={laboratory.accreditationNumber} onChange={e => setLaboratory({ ...laboratory, accreditationNumber: e.target.value })}/></Grid><Grid item xs={12}><TextField label="Адрес" value={laboratory.address} onChange={e => setLaboratory({ ...laboratory, address: e.target.value })}/></Grid><LaboratoryFields value={{...emptyLaboratoryDetails(),...laboratory.details}} onChange={details => setLaboratory({...laboratory,details})}/></Grid>}
    </DialogContent><DialogActions sx={{ p: 2.5 }}><Button disabled={busy} onClick={() => { setOrganization(null); setLaboratory(null); }}>Отмена</Button><Button variant="contained" type="submit" disabled={busy}>{busy ? 'Сохраняем…' : 'Сохранить'}</Button></DialogActions></form></Dialog>
    <Dialog open={!!deleteTarget && deleteTarget.firmId === firmId} onClose={() => !deleteState.isLoading && setDeleteTarget(null)} aria-labelledby="delete-organization-title" maxWidth="sm" fullWidth>
      <DialogTitle id="delete-organization-title">Удалить компанию?</DialogTitle><DialogContent>
        <Typography>Удалить «{deleteTarget?.name}» из справочника? Компания больше не будет доступна для подстановки. Реквизиты в ранее созданных декларациях сохранятся.</Typography>
        {deleteError && <Alert severity="error" sx={{ mt: 2 }}>{deleteError}</Alert>}
      </DialogContent><DialogActions sx={{ p: 2.5 }}><Button disabled={deleteState.isLoading} onClick={() => setDeleteTarget(null)}>Отмена</Button><Button color="error" variant="contained" disabled={deleteState.isLoading || !canEdit} onClick={() => void removeOrganization()}>{deleteState.isLoading ? 'Удаляем…' : 'Удалить'}</Button></DialogActions>
    </Dialog>
    {warningDialog}
  </>;
}
