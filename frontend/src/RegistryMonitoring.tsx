import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Badge, Box, Button, Checkbox, Chip, FormControlLabel, IconButton, Menu, MenuItem, Pagination, TextField, Typography } from '@mui/material';
import { CheckRounded, NotificationsNoneRounded, RefreshRounded } from '@mui/icons-material';
import { ErrorState, Loading, Section, useWorkspace } from './common';
import { dateTime, errorMessage } from './types';
import { registryMonitoringApi, type RegistryWatch } from './registryMonitoringApi';
import { registrySections } from './RegistryVerification';
import type { RegistrySection } from './marketplaceApi';
import './registryChecks.css';

export function RegistryNotificationBell() {
  const { firmId } = useWorkspace(); const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const query = registryMonitoringApi.useRegistryNotificationsQuery({ firmId, unreadOnly: true, pageSize: 6 }, { pollingInterval: 60000, skip: !firmId });
  const [read, state] = registryMonitoringApi.useReadRegistryNotificationMutation(); const [error, setError] = useState('');
  const count = query.data?.unreadCount ?? 0;
  return <><IconButton className="registry-notification-bell" aria-label={`Уведомления реестра${count ? `: ${count} непрочитанных` : ''}`} aria-haspopup="menu" aria-expanded={!!anchor} onClick={e => { setAnchor(e.currentTarget); setError(''); }}><Badge badgeContent={count} max={99} color="error"><NotificationsNoneRounded fontSize="small"/></Badge></IconButton>
    <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} PaperProps={{ sx: { width: 430, maxWidth: 'calc(100vw - 24px)', p: 1 } }}>
      <Box sx={{ p: 1.5 }}><Typography variant="subtitle1">Изменения статусов деклараций</Typography><Typography variant="caption" color="text.secondary">Непрочитанных: {count}</Typography></Box>
      {query.error && <Box sx={{ p: 1 }}><ErrorState error={query.error} retry={query.refetch}/></Box>}
      {error && <Alert severity="error">{error}</Alert>}
      {!query.isLoading && !query.error && !query.data?.items?.length && <Typography sx={{ px: 1.5, py: 2 }} color="text.secondary">Новых уведомлений нет.</Typography>}
      {query.data?.items?.map(item => <MenuItem key={item.id} component={RouterLink} to={`/declarations/${item.declarationId}`} onClick={async () => { try { await read({ firmId, id: item.id }).unwrap(); setAnchor(null); } catch (e) { setError(errorMessage(e)); } }} sx={{ whiteSpace: 'normal', display: 'block', borderTop: '1px solid var(--border)', py: 1.5 }}><Typography variant="subtitle2">{item.title}</Typography><Typography variant="body2" sx={{ my: .7, overflowWrap: 'anywhere' }}>{item.message}</Typography><Typography variant="caption" color="text.secondary">{dateTime(item.occurredAtUtc)}</Typography></MenuItem>)}
      <Box sx={{ p: 1, display: 'flex', gap: 1, flexWrap: 'wrap' }}><Button component={RouterLink} to="/registries?tab=monitoring" onClick={() => setAnchor(null)}>Все уведомления</Button><Button disabled={!count || state.isLoading} onClick={async () => { try { await read({ firmId }).unwrap(); } catch (e) { setError(errorMessage(e)); } }}>Прочитать все</Button></Box>
    </Menu>
  </>;
}

export function RegistryWatchPanel({ id }: { id: string }) {
  const { firmId, canEdit } = useWorkspace(); const watch = registryMonitoringApi.useRegistryWatchQuery({ firmId, id });
  const summary = registryMonitoringApi.useRegistryMonitoringSummaryQuery(firmId);
  const [save, saveState] = registryMonitoringApi.useSaveRegistryWatchMutation(); const [run, runState] = registryMonitoringApi.useRunRegistryCheckMutation();
  const [section, setSection] = useState<RegistrySection | null>(null); const [date, setDate] = useState<string | null>(null); const [enabled, setEnabled] = useState<boolean | null>(null); const [error, setError] = useState('');
  const data = watch.currentData; const busy = saveState.isLoading || runState.isLoading;
  const changed = data && ((section ?? data.section) !== data.section || (date ?? data.regDate ?? '') !== (data.regDate ?? '') || (enabled ?? data.enabled) !== data.enabled);
  return <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid var(--border)' }}>
    <Typography variant="h6" sx={{ mb: 1 }}>Ежедневная проверка статуса</Typography>
    {watch.isLoading ? <Loading/> : watch.error ? <ErrorState error={watch.error} retry={watch.refetch}/> : data && <>
      {!data.eligible ? <Typography color="text.secondary">Проверка начнётся после учёта регистрации декларации и указания регистрационного номера.</Typography> : <>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Сервер проверяет документ ежедневно в {String(summary.data?.hour ?? 6).padStart(2, '0')}:00 ({summary.data?.timeZoneId ?? 'Europe/Minsk'}). Изменения появятся в уведомлениях.</Typography>
        {!summary.data?.connectionConfigured && <Alert severity="info" sx={{ my: 2 }}>Для автоматической проверки нужен API-ключ компании. <Button component={RouterLink} to="/registries?tab=connection">Подключить реестр</Button></Alert>}
        <FormControlLabel control={<Checkbox checked={enabled ?? data.enabled} disabled={!canEdit || busy} onChange={(_, value) => setEnabled(value)}/>} label="Проверять эту декларацию ежедневно"/>
        <div className="registry-input-grid"><TextField select label="Реестр для ежедневной проверки" value={section ?? data.section} disabled={!canEdit || busy} onChange={e => setSection(e.target.value as RegistrySection)}>{registrySections.filter(([key]) => key !== 'rss').map(([key, name]) => <MenuItem key={key} value={key}>{name}</MenuItem>)}</TextField><TextField type="date" label="Дата регистрации для проверки (необязательно)" InputLabelProps={{ shrink: true }} value={date ?? data.regDate ?? ''} disabled={!canEdit || busy} onChange={e => setDate(e.target.value)}/></div>
        {canEdit && <div className="registry-form-actions"><Button variant="outlined" disabled={!changed || busy} onClick={async () => { setError(''); try { await save({ firmId, id, enabled: enabled ?? data.enabled, section: section ?? data.section, regDate: (date ?? data.regDate) || null, revision: data.revision }).unwrap(); setSection(null); setDate(null); setEnabled(null); } catch (e) { setError(errorMessage(e)); } }}>Сохранить настройки проверки</Button><Button startIcon={<RefreshRounded/>} disabled={!!changed || busy || !summary.data?.connectionConfigured} onClick={async () => { setError(''); try { await run({ firmId, id }).unwrap(); } catch (e) { setError(errorMessage(e)); } }}>{runState.isLoading ? 'Проверяем…' : 'Проверить сейчас'}</Button></div>}
        <WatchStatus data={data}/>{error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
      </>}
    </>}
  </Box>;
}

function WatchStatus({ data }: { data: RegistryWatch }) {
  return <div className="registry-watch-status">{data.statusLabel && <><Chip size="small" variant="outlined" label={data.statusLabel}/>{data.statusInRussiaLabel && <Chip size="small" variant="outlined" label={`В РФ: ${data.statusInRussiaLabel}`}/>}</>}
    <Typography variant="caption" color="text.secondary">{data.checkedAtUtc ? `Успешная проверка: ${dateTime(data.checkedAtUtc)} · ${data.sourceEnvironment === 'Production' ? 'рабочий' : 'тестовый'} контур` : 'Успешных проверок пока нет.'}</Typography>
    {data.lastError && <Alert severity="warning">Последняя попытка {data.attemptedAtUtc ? dateTime(data.attemptedAtUtc) : ''}: {data.lastError}</Alert>}
  </div>;
}

export function RegistryMonitoringDashboard() {
  const { firmId, canEdit } = useWorkspace(); const [page, setPage] = useState(1); const [noticePage, setNoticePage] = useState(1);
  const summary = registryMonitoringApi.useRegistryMonitoringSummaryQuery(firmId, { pollingInterval: 60000 });
  const watches = registryMonitoringApi.useRegistryWatchesQuery({ firmId, page }, { pollingInterval: 60000 });
  const notices = registryMonitoringApi.useRegistryNotificationsQuery({ firmId, page: noticePage }, { pollingInterval: 60000 });
  const [read] = registryMonitoringApi.useReadRegistryNotificationMutation(); const [run, state] = registryMonitoringApi.useRunRegistryCheckMutation(); const [error, setError] = useState('');
  return <>
    <Section title="Автоматическая проверка зарегистрированных деклараций" subtitle="Сервер сверяет внешний статус и сохраняет результат. Уведомления о прочтении учитываются отдельно для каждого сотрудника.">
      {summary.error && <ErrorState error={summary.error} retry={summary.refetch}/>}
      {summary.data && <><div className="registry-monitor-summary"><div><strong>{String(summary.data.hour).padStart(2, '0')}:00</strong><span>Ежедневно · {summary.data.timeZoneId}</span></div><div><strong>{summary.data.registeredDocuments}</strong><span>Зарегистрировано</span></div><div><strong>{summary.data.checkedDocuments}</strong><span>Проверено</span></div><div><strong>{summary.data.failedDocuments}</strong><span>Ошибок проверки</span></div></div>
        {!summary.data.enabled && <Alert severity="info">Автоматическая проверка отключена на сервере.</Alert>}
        {!summary.data.connectionConfigured && <Alert severity="info">Добавьте API-ключ компании во вкладке «Подключение». После подключения зарегистрированные декларации попадут в ежедневную проверку.</Alert>}
        {summary.data.connectionConfigured && <Typography variant="body2" color="text.secondary">Контур: {summary.data.environment === 'Production' ? 'рабочий' : 'тестовый'}. Следующее плановое время: {dateTime(summary.data.nextRunUtc)}. После перезапуска сервер выполняет пропущенную проверку.</Typography>}
      </>}
    </Section>
    <Section title="Уведомления об изменениях" actions={<Button startIcon={<CheckRounded/>} disabled={!notices.data?.unreadCount} onClick={async () => { try { await read({ firmId }).unwrap(); } catch (e) { setError(errorMessage(e)); } }}>Прочитать все</Button>}>
      {notices.error ? <ErrorState error={notices.error} retry={notices.refetch}/> : !notices.data?.items?.length ? <Typography color="text.secondary">Изменений статусов пока не обнаружено.</Typography> : <>{notices.data.items.map(item => <div className={`registry-monitor-notice${item.isRead ? '' : ' is-unread'}`} key={item.id}><div><Typography variant="subtitle2">{item.title}</Typography><Typography variant="body2" sx={{ my: .7 }}>{item.message}</Typography><Typography variant="caption" color="text.secondary">{dateTime(item.occurredAtUtc)}</Typography></div><div><Button component={RouterLink} to={`/declarations/${item.declarationId}`}>Открыть декларацию</Button>{!item.isRead && <Button onClick={async () => { try { await read({ firmId, id: item.id }).unwrap(); } catch (e) { setError(errorMessage(e)); } }}>Прочитано</Button>}</div></div>)}<Pagination page={noticePage} count={Math.max(1, Math.ceil(notices.data.total / 10))} onChange={(_, value) => setNoticePage(value)} sx={{ mt: 2 }}/></>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </Section>
    <Section title="Декларации под наблюдением" subtitle="Проверки не меняют внутренний рабочий статус. Настроить реестр, дату и участие в проверке можно в разделе публикации карточки декларации.">
      {watches.isLoading ? <Loading/> : watches.error ? <ErrorState error={watches.error} retry={watches.refetch}/> : !watches.data?.items?.length ? <Typography color="text.secondary">Зарегистрированных деклараций пока нет.</Typography> : <>{watches.data.items.map(item => <div className="registry-monitor-document" key={item.declarationId}><div><Button component={RouterLink} to={`/declarations/${item.declarationId}`} sx={{ p: 0, justifyContent: 'flex-start' }}>{item.title}</Button><Typography variant="body2" sx={{ my: 1 }}>{item.registrationNumber || 'Регистрационный номер не указан'}</Typography><WatchStatus data={item}/></div><div><Chip size="small" label={!item.eligible ? 'Нужен номер' : item.enabled ? 'Ежедневно' : 'На паузе'} variant="outlined"/>{canEdit && <Button disabled={!item.eligible || !summary.data?.connectionConfigured || state.isLoading} onClick={async () => { setError(''); try { await run({ firmId, id: item.declarationId }).unwrap(); } catch (e) { setError(errorMessage(e)); } }}>Проверить сейчас</Button>}</div></div>)}<Pagination page={page} count={Math.max(1, Math.ceil(watches.data.total / 20))} onChange={(_, value) => setPage(value)} sx={{ mt: 2 }}/></>}
    </Section>
  </>;
}
