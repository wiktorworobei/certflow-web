import { Link as RouterLink } from 'react-router-dom';
import { Button, Chip, Paper, Typography } from '@mui/material';
import { ArrowForwardRounded, CheckCircleOutlineRounded, LinkOutlined } from '@mui/icons-material';
import { api } from './store';
import { dateTime } from './types';
import { ErrorState, Loading, useWorkspace } from './common';
import { PersonalDaDataSettings } from './PersonalDaDataSettings';
import { MarkingConnectionSettings } from './MarkingConnectionSettings';

export function IntegrationConnections() {
  const { firmId } = useWorkspace();
  const integrations = api.useIntegrationsQuery(firmId);
  const settings = api.useDaDataSettingsQuery(undefined, { refetchOnMountOrArgChange: true });
  const marking = api.useMarkingConnectionsQuery(firmId, { refetchOnMountOrArgChange: true, pollingInterval: 60000 });
  const data = settings.data;
  const verified = !!(data?.enabled && data.isConfigured && data.verifiedAt);
  const names = [...(verified ? ['DaData'] : []), ...(marking.data?.chz ? ['Честный знак'] : []), ...(marking.data?.dmKod.length ? ['Наша марка'] : [])];
  if (integrations.isLoading || settings.isLoading) return <Loading/>;
  if (integrations.error || settings.error) return <ErrorState error={integrations.error || settings.error} retry={() => { void integrations.refetch(); void settings.refetch(); }}/>;
  return <>
    <Paper className={`connection-summary ${names.length ? 'is-connected' : ''}`} component="section" aria-label="Успешные подключения"><div className="connection-summary-icon">{names.length ? <CheckCircleOutlineRounded/> : <LinkOutlined/>}</div><div><Typography component="h2" variant="h6">{names.length ? `${names.join(' · ')}${names.length === 1 && verified ? ' · соединение проверено' : ' · доступ настроен'}` : 'Успешных подключений пока нет'}</Typography><Typography color="text.secondary" variant="body2">{names.length && (marking.data?.chz || marking.data?.dmKod.length) ? 'Для ЧЗ и Нашей марки показаны действующие внешние сессии вашего аккаунта. Доступность API проверяется в разделе «ЧЗ и Наша марка».' : verified ? `Последняя успешная проверка: ${dateTime(data!.verifiedAt!)}. Доступ ${data?.source === 'Personal' ? 'через личный ключ' : 'через ключ сервера'}.` : data?.isConfigured ? 'Ключ DaData сохранён. Проверьте его, чтобы подтвердить доступ к сервису.' : 'Добавьте API-ключ DaData и проверьте соединение, чтобы начать поиск организаций.'}</Typography></div><Chip size="small" color={names.length ? 'success' : 'default'} variant="outlined" label={`${names.length} подключено`}/></Paper>
    <div className="connections-heading"><div><Typography variant="h6" component="h2">Внешние сервисы</Typography><Typography color="text.secondary" variant="body2">Состояние доступа для вашего аккаунта.</Typography></div><Button component={RouterLink} to="/development-plan" endIcon={<ArrowForwardRounded/>}>План разработки</Button></div>
    <div className="connections-grid">{integrations.data?.map(integration => {
      const isDaData = integration.id === 'organizations';
      const isTnVed = integration.id === 'classifiers';
      const isChz = integration.id === 'marking'; const active = isDaData ? verified : isChz ? !!marking.data?.chz : isTnVed && integration.status === 'Configured';
      const label = isTnVed ? active ? 'Загружен' : 'Не загружен' : isChz ? marking.isError ? 'Не удалось проверить' : active ? 'Сессия активна' : 'Вход не выполнен' : !isDaData ? 'Не подключено' : !data?.enabled ? 'Отключено' : verified ? 'Проверено' : data?.isConfigured ? 'Требует проверки' : 'Нет ключа';
      return <Paper key={integration.id} className={`connection-card ${isDaData ? 'connection-featured' : ''}`}><div className="connection-card-top"><div className={`connection-logo ${isDaData ? 'dadata-logo' : ''}`}>{isDaData ? 'Da' : integration.id === 'fgis' ? 'ФГ' : isChz ? 'ЧЗ' : integration.id === 'laboratories' ? 'ИЛ' : integration.id === 'registry' ? 'РЕ' : 'КЛ'}</div><Chip label={label} size="small" color={active ? 'success' : 'default'} variant="outlined"/></div><Typography component="h3" variant="h6">{integration.name}</Typography><div className="connection-card-meta"><LinkOutlined/>{isDaData ? verified ? 'Доступ подтверждён запросом к сервису' : data?.hasPersonalKey ? 'Личный API-ключ сохранён' : data?.source === 'Server' ? 'Используется ключ сервера' : 'Настройте доступ ниже' : isChz ? marking.data?.chz ? `Сессия до ${dateTime(marking.data.chz.expiresAtUtc)} · ${marking.data.profile}` : 'Выполните вход по сертификату' : isTnVed ? active ? 'Поиск по кодам из загруженного файла' : 'Загрузите справочник кодов на сервер' : 'Обмен данными не настроен'}</div>{isChz && <Button size="small" component={RouterLink} to="/marking?tab=chz" endIcon={<ArrowForwardRounded/>}>Открыть Честный знак</Button>}{!isDaData && <Button size="small" component={RouterLink} to={`/development-plan?module=${integration.id}`} endIcon={<ArrowForwardRounded/>}>О модуле</Button>}</Paper>;
    })}<Paper className="connection-card"><div className="connection-card-top"><div className="connection-logo">НМ</div><Chip size="small" color={marking.data?.dmKod.length ? 'success' : 'default'} variant="outlined" label={marking.isError ? 'Не удалось проверить' : marking.data?.dmKod.length ? 'Сессия активна' : 'Вход не выполнен'}/></div><Typography component="h3" variant="h6">Наша марка / DMkod</Typography><Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>{marking.data?.dmKod.length ? marking.data.dmKod.map(s => `${s.environment} · до ${dateTime(s.accessTokenExpiresAtUtc)}`).join('; ') : 'Отдельные подключения к тестовому и рабочему контуру.'}</Typography><Button size="small" component={RouterLink} to="/marking?tab=dmkod" endIcon={<ArrowForwardRounded/>}>Открыть Нашу марку</Button></Paper></div>
    <PersonalDaDataSettings/>
    <MarkingConnectionSettings/>
  </>;
}
