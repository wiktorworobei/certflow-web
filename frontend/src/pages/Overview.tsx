import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { Alert, Avatar, Button, LinearProgress, Paper, Typography } from '@mui/material';
import { AddRounded } from '@mui/icons-material';
import { DescriptionOutlined } from '@mui/icons-material';
import { FactCheckOutlined } from '@mui/icons-material';
import { TaskAltRounded } from '@mui/icons-material';
import { EventAvailableOutlined } from '@mui/icons-material';
import { ArrowForwardRounded } from '@mui/icons-material';
import { ArrowOutwardRounded } from '@mui/icons-material';
import { CorporateFareOutlined, TodayOutlined } from '@mui/icons-material';
import { api } from '../store';
import { EmptyState, ErrorState, Loading, PageTitle, StatusChip, useWorkspace } from '../common';
import { date, dateTime } from '../types';
import { DocumentTable } from './Registry';

export function Overview() {
  const { firmId, firm, user, canEdit } = useWorkspace(); const navigate = useNavigate();
  const { data, isLoading, error, refetch } = api.useDashboardQuery(firmId);
  if (isLoading) return <Loading/>;
  if (error || !data) return <ErrorState error={error} retry={refetch}/>;
  const stats = [
    { label: 'Всего деклараций', value: data.total, icon: <DescriptionOutlined/>, color: 'mint', note: 'В вашем рабочем пространстве', url: '/declarations' },
    { label: 'На проверке', value: data.inReview, icon: <FactCheckOutlined/>, color: 'blue', note: 'Ожидают согласования', url: '/declarations?status=InReview' },
    { label: 'Готовы к регистрации', value: data.ready, icon: <TaskAltRounded/>, color: 'sand', note: 'Сведения проверены', url: '/declarations?status=Ready' },
    { label: 'Истекает срок', value: data.expiring, icon: <EventAvailableOutlined/>, color: 'rose', note: 'В ближайшие 30 дней или ранее', url: '/declarations?expiring=true' },
  ];
  return <>
    <div className="overview-welcome"><PageTitle eyebrow="ВАШ РАБОЧИЙ ДЕНЬ" title={`Добрый день, ${user?.displayName || user?.userName}`} subtitle="Все документы под контролем. Начните с того, что важно сегодня.">{canEdit && <Button component={RouterLink} to="/declarations/new" variant="contained" startIcon={<AddRounded/>}>Новая декларация</Button>}</PageTitle><div className="welcome-details"><span><TodayOutlined/>{new Date().toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })}</span><span><CorporateFareOutlined/>{firm?.name}</span></div></div>
    <div className="stats-grid">{stats.map(s => <Paper key={s.label} className="stat-card" component="button" onClick={() => navigate(s.url)}><div className="stat-top"><span>{s.label}</span><div className={`stat-icon ${s.color}`}>{s.icon}</div></div><div className="stat-value">{s.value}<ArrowOutwardRounded/></div><div className="stat-note">{s.note}</div></Paper>)}</div>
    {data.recent.some(d => d.isSample) && <Alert severity="info" className="demo-alert" sx={{ mb: 3 }}>В реестре есть учебные примеры. Новые документы создаются с вашими данными.</Alert>}
    <Paper className="table-card"><div className="section-heading"><div><Typography variant="h6" component="h2">Последние документы</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .5 }}>Продолжите работу с декларациями</Typography></div><Button component={RouterLink} to="/declarations" endIcon={<ArrowForwardRounded/>}>Все документы</Button></div><DocumentTable rows={data.recent} compact/></Paper>
    <div className="overview-bottom"><Paper className="activity-card"><div className="section-heading"><Typography variant="h6" component="h2">История активности</Typography><span className="muted-small">Последние изменения</span></div>{data.activity.length === 0 ? <EmptyState title="История пока пуста" text="Здесь появятся действия с документами."/> : <div className="activity-list">{data.activity.slice(0, 5).map((a, i) => <button className="activity-row" key={`${a.occurredAt}-${i}`} onClick={() => navigate(`/declarations/${a.declarationId}`)}><div className="activity-dot"><DescriptionOutlined sx={{ fontSize: 17 }}/></div><div className="activity-text"><strong>{a.description}</strong><span>{a.reference} · {a.actor}</span></div><time>{dateTime(a.occurredAt)}</time></button>)}</div>}</Paper>
      <Paper className="readiness-card"><div className="section-heading"><Typography variant="h6" component="h2">Состояние реестра</Typography><FactCheckOutlined sx={{ color: 'text.secondary' }}/></div><div className="readiness-content"><div className="readiness-number">{data.total ? Math.round((data.ready + data.registered) / data.total * 100) : 0}<span>%</span></div><Typography color="text.secondary" variant="body2">документов готовы или зарегистрированы</Typography><LinearProgress aria-label="Доля готовых и зарегистрированных документов" variant="determinate" value={data.total ? (data.ready + data.registered) / data.total * 100 : 0} sx={{ mt: 3, mb: 3, height: 7, borderRadius: 10 }}/><div className="readiness-row"><span><i className="legend-dot" style={{ background: 'var(--accent)' }}/>Зарегистрированы</span><strong>{data.registered}</strong></div><div className="readiness-row"><span><i className="legend-dot" style={{ background: 'var(--warning)' }}/>Готовы к регистрации</span><strong>{data.ready}</strong></div><div className="readiness-row"><span><i className="legend-dot" style={{ background: 'var(--faint)' }}/>Черновики</span><strong>{data.draft}</strong></div></div></Paper>
    </div>
    {data.expiringDocuments.length > 0 && <Paper className="table-card" sx={{ mt: 3 }}><div className="section-heading"><Typography variant="h6" component="h2">Сроки требуют внимания</Typography></div>{data.expiringDocuments.map(d => <div key={d.id} className="expiry-row"><Avatar sx={{ bgcolor: 'var(--warning-soft)', color: 'var(--warning)' }}><EventAvailableOutlined/></Avatar><div><RouterLink to={`/declarations/${d.id}`}>{d.title}</RouterLink><Typography variant="body2" color="text.secondary">{d.registrationNumber || d.reference}</Typography></div><StatusChip status={d.status}/><span>до {date(d.validUntil)}</span></div>)}</Paper>}
  </>;
}
