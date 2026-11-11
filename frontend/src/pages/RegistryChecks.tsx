import { Alert, Button, Chip, Paper, Tab, Tabs, Typography } from '@mui/material';
import { CloudDownloadOutlined, HistoryRounded, ListAltRounded, SearchRounded, SettingsOutlined } from '@mui/icons-material';
import { useSearchParams } from 'react-router-dom';
import { ErrorState, Loading, PageTitle, Section, useWorkspace } from '../common';
import { marketplaceApi } from '../marketplaceApi';
import { MarketplaceSettingsPanel } from '../MarketplaceSettingsPanel';
import { RegistryBatch, RegistryExports, RegistryLookup, RegistryRequestHistory } from '../RegistryOperations';
import '../registryChecks.css';
import { RegistryMonitoringDashboard } from '../RegistryMonitoring';

const tabs = [
  ['lookup', 'Проверить документ', <SearchRounded/>], ['batch', 'Проверить список', <ListAltRounded/>],
  ['history', 'Запросы и результаты', <HistoryRounded/>], ['exports', 'Выгрузки ПЦП', <CloudDownloadOutlined/>],
  ['connection', 'Подключение', <SettingsOutlined/>],
  ['monitoring', 'Ежедневная проверка', <HistoryRounded/>],
] as const;

export function RegistryChecks() {
  const { firmId, canEdit, isAdmin } = useWorkspace(); const [params, setParams] = useSearchParams();
  const settings = marketplaceApi.useMarketplaceSettingsQuery(firmId);
  const tab = tabs.find(([id]) => id === params.get('tab'))?.[0] ?? 'lookup';
  const ready = !!(settings.data?.enabled && settings.data.isConfigured);
  function select(value: string, requestId?: string) { setParams(previous => { previous.set('tab', value); if (requestId) previous.set('request', requestId); return previous; }); }
  const connect = <Button onClick={() => select('connection')}>Настроить подключение</Button>;
  return <div className="registry-workspace">
    <PageTitle eyebrow="РОСАККРЕДИТАЦИЯ · РФ И ЕАЭС" title="Проверка документов" subtitle="Найдите сертификат или декларацию, проверьте статус и получите сведения из официального реестра.">
      {settings.data && <><Chip variant="outlined" label={settings.data.environment === 'Production' ? 'Рабочий контур' : 'Тестовый контур'}/><Chip variant="outlined" color={ready ? 'success' : 'default'} label={ready ? 'Ключ сохранён' : 'Требуется подключение'}/></>}
    </PageTitle>
    <Paper className="registry-workflow-guide"><div><span>1</span><strong>Выберите задачу</strong><p>Один документ, список или база реестра.</p></div><div><span>2</span><strong>Уточните сведения</strong><p>Номер, дату регистрации или ID документа.</p></div><div><span>3</span><strong>Получите результат</strong><p>Карточку документа или готовый файл.</p></div></Paper>
    <Paper className="registry-workflow-tabs"><Tabs value={tab} onChange={(_, value) => select(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Задачи проверки документов">{tabs.map(([id, label, icon]) => <Tab key={id} id={`registry-tab-${id}`} aria-controls="registry-operation-panel" value={id} icon={icon} iconPosition="start" label={label}/>)}</Tabs></Paper>
    <div id="registry-operation-panel" role="tabpanel" aria-labelledby={`registry-tab-${tab}`}>
      {settings.isLoading ? <Loading/> : settings.error ? <ErrorState error={settings.error} retry={settings.refetch}/> : <>
        {tab === 'monitoring' ? <RegistryMonitoringDashboard key={firmId}/> : tab === 'connection' ? <MarketplaceSettingsPanel key={firmId}/> : tab === 'history' ? <RegistryRequestHistory key={firmId} firmId={firmId} requestId={params.get('request') ?? ''} onSelect={requestId => select('history', requestId)} canFetch={ready && settings.data?.accessMode === 'Marketplace'}/> : !ready ? <Section title="Подключите реестры Росаккредитации"><Typography color="text.secondary" sx={{ mb: 2 }}>Для запросов нужен ключ выбранного контура. Администратор компании может добавить его во вкладке «Подключение».</Typography>{connect}</Section> : tab === 'lookup' ? <RegistryLookup key={firmId} firmId={firmId}/> : tab === 'batch' ? settings.data?.accessMode === 'Marketplace' && canEdit ? <RegistryBatch key={firmId} firmId={firmId} onCreated={requestId => select('history', requestId)}/> : <Section title="Пакетная проверка"><Alert severity="info">Постановка пакетных запросов доступна редактору компании с подключением «Маркетплейс». Права ключа выдаёт Росаккредитация.</Alert>{connect}<Button sx={{ mt: 2 }} onClick={() => select('history')}>Открыть историю запросов</Button></Section> : tab === 'exports' && <>{settings.data?.accessMode === 'Pcp' && isAdmin ? <RegistryExports key={firmId} firmId={firmId}/> : <Section title="Выгрузки для оператора ПЦП"><Typography color="text.secondary" sx={{ mb: 2 }}>Полные базы сертификатов, деклараций и документов ЕАЭС, а также изменения за день доступны администратору с ключом оператора ПЦП.</Typography>{connect}</Section>}</>}
      </>}
    </div>
  </div>;
}
