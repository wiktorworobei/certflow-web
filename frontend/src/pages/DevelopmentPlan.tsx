import { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { Accordion, AccordionDetails, AccordionSummary, Button, Chip, Grid, Link, Paper, Typography } from '@mui/material';
import { ArrowForwardRounded, CheckCircleOutlineRounded, ExpandMoreRounded, OpenInNewRounded, RouteOutlined, SettingsOutlined } from '@mui/icons-material';
import { PageTitle, Section } from '../common';
import { integrationGuides } from './integrationGuide';
import './integrations.css';

const currentCapabilities = [
  ['Собственный реестр', 'Создавайте карточки, сохраняйте компании, лаборатории, протоколы и приложения в рабочем пространстве.'],
  ['Реестр лабораторий из CSV', 'Выгрузка ЕАЭС, поиск и фильтры, исходная запись и ручные правки с подтверждением. Подстановка реквизитов в направления и протоколы. Живая проверка ФГИС ещё не подключена.'],
  ['Макеты и выгрузки', 'Скачивайте направления Word, макеты Word/PDF, реестр CSV и полный комплект ZIP с описью файлов.'],
  ['Ручной учёт регистрации', 'Вносите номер, ссылку, даты и статус документа самостоятельно. Эти сведения не проходят автоматическую сверку с реестром.'],
];
const stages = [
  ['01', 'Подготовка деклараций', 'Компании, лаборатории, направления, образцы, протоколы, основания и полный комплект файлов.'],
  ['02', 'ФГИС и внешние реестры', 'Подтвердить интерфейс передачи черновиков, источник статусов и проверку аккредитации.'],
  ['03', 'ЧЗ и Наша марка', 'Проверить существующие подключения с аккаунтами компании и сертификатом.'],
];

export function DevelopmentPlan() {
  const [params] = useSearchParams(); const moduleId = params.get('module');
  const [expanded, setExpanded] = useState<string[]>(moduleId ? [moduleId] : []);
  const [filter, setFilter] = useState('Все модули');
  const guides = integrationGuides.filter(guide => filter === 'Все модули' || guide.stage === filter);
  const allExpanded = guides.every(guide => expanded.includes(guide.id));
  useEffect(() => {
    if (!moduleId || !integrationGuides.some(guide => guide.id === moduleId)) return;
    setFilter('Все модули'); setExpanded(previous => previous.includes(moduleId) ? previous : [...previous, moduleId]);
    const frame = requestAnimationFrame(() => document.getElementById(`integration-${moduleId}`)?.scrollIntoView({ block: 'start' }));
    return () => cancelAnimationFrame(frame);
  }, [moduleId]);

  return <>
    <PageTitle eyebrow="РАЗВИТИЕ CERTFLOW" title="План разработки" subtitle="Что уже работает, зачем нужны следующие модули и как мы придём к полному процессу."><Button component={RouterLink} to="/settings" variant="outlined" startIcon={<SettingsOutlined/>}>Настроить подключения</Button></PageTitle>
    <div className="plan-hero"><div><span className="hero-kicker"><RouteOutlined/> СЕРТИФИКАЦИЯ И ВНЕШНИЕ СЕРВИСЫ</span><Typography component="h2">Каждый модуль —<br/>следующий шаг в процессе.</Typography><p>Текущий продукт: подготовка деклараций, лабораторные документы, интеграции с Росаккредитацией, ЧЗ и Нашей маркой. Здесь видно, что реализовано и какие внешние доступы ещё нужны.</p></div><div className="plan-hero-aside"><span className="plan-status-pill"><CheckCircleOutlineRounded/> Базовый реестр работает</span><strong>{integrationGuides.length}</strong><span>направлений интеграции</span><small>Готовность модуля и доступ к сервису проверяются отдельно.</small></div></div>

    <Section title="Уже в приложении" subtitle="Основа ежедневной работы с документами.">
      <Grid container spacing={3}>{currentCapabilities.map(([title, text]) => <Grid item xs={12} md={4} key={title}>
        <Typography sx={{ fontWeight: 600, mb: 1 }}>{title}</Typography><Typography color="text.secondary">{text}</Typography>
      </Grid>)}</Grid>
    </Section>

    <Paper className="plan-dadata"><div className="connection-logo dadata-logo">Da</div><div><Typography component="h3" variant="h6">DaData · модуль готов</Typography><Typography color="text.secondary">Поиск по ИНН / ОГРН, выбор организации и подтверждение реквизитов. Личный ключ и проверка соединения находятся в настройках.</Typography></div><Button component={RouterLink} to="/settings" endIcon={<ArrowForwardRounded/>}>Подключить аккаунт</Button></Paper>

    <Section title="В каком порядке подключать" subtitle="Предлагаемая последовательность по процессу из видео. Состав этапов можно уточнить под первую компанию.">
      <div className="integration-roadmap">{stages.map(([number, title, text]) => <div className="integration-stage" key={number}>
        <span className="integration-step-number">{number}</span>
        <div><Typography component="h3" sx={{ fontWeight: 600, mb: 1 }}>{title}</Typography><Typography color="text.secondary">{text}</Typography></div>
      </div>)}</div>
      <div className="integration-chain" aria-label="Связь документов и учёта">
        {['Лаборатория', 'Образцы и протоколы', 'Декларация', 'ЧЗ / Наша марка'].map((label, i) => <span key={label}>{i > 0 && <ArrowForwardRounded aria-hidden="true"/>}{label}</span>)}
      </div>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5 }}>Направления, образцы, выданные документы и их файлы связываются с декларацией; товар определяется по GTIN.</Typography>
    </Section>

    <div className="integration-guide-heading">
      <div><Typography variant="h5" component="h2">Подробно о каждом подключении</Typography><Typography color="text.secondary" sx={{ mt: 1 }}>Назначение, обмен данными, пример работы и подготовка к подключению.</Typography></div>
      <Button variant="outlined" onClick={() => setExpanded(allExpanded ? [] : guides.map(guide => guide.id))}>{allExpanded ? 'Свернуть все' : 'Развернуть все'}</Button>
    </div>
    <div className="plan-filters" role="group" aria-label="Направления разработки">{['Все модули', 'Декларации', 'ЧЗ и Наша марка'].map(label => <Button key={label} aria-pressed={filter === label} className={filter === label ? 'plan-filter selected' : 'plan-filter'} onClick={() => setFilter(label)}>{label}</Button>)}</div>
    <div className="integration-guides">{guides.map(guide => <Accordion
      className="integration-guide" id={`integration-${guide.id}`} key={guide.id}
      expanded={expanded.includes(guide.id)} disableGutters
      onChange={(_, open) => setExpanded(previous => open ? [...previous, guide.id] : previous.filter(id => id !== guide.id))}
    >
      <AccordionSummary expandIcon={<ExpandMoreRounded/>} id={`guide-${guide.id}-title`} aria-controls={`guide-${guide.id}-content`}>
        <span className="integration-guide-number">{String(integrationGuides.indexOf(guide) + 1).padStart(2, '0')}</span>
        <div className="integration-guide-label"><Typography component="h3">{guide.title}</Typography><span>{guide.shortTitle}</span></div>
        <Chip className="integration-stage-chip" label={guide.stage} size="small" variant="outlined"/>
      </AccordionSummary>
      <AccordionDetails>
        <div className="integration-purpose"><Typography component="h4">Зачем вам это нужно</Typography><Typography>{guide.purpose}</Typography></div>
        <div className="integration-detail-grid">
          <div><Typography component="h4">Какие данные передаются</Typography><ul>{guide.exchange.map(text => <li key={text}>{text}</li>)}</ul></div>
          <div><Typography component="h4">Что потребуется для подключения</Typography><ul>{guide.preparation.map(text => <li key={text}>{text}</li>)}</ul></div>
        </div>
        <div className="integration-example"><Typography component="h4">Пример в работе</Typography><Typography>{guide.example}</Typography></div>
        <div className="integration-current"><Typography component="h4">Что есть в CertFlow сейчас</Typography><Typography>{guide.current}</Typography></div>
        {guide.note && <Typography className="integration-guide-note">{guide.note}</Typography>}
        <div className="integration-guide-footer"><Typography variant="body2">По видео · {guide.video} Таймкоды приблизительные.</Typography>
          {guide.resources && <div className="integration-resources">{guide.resources.map(resource => <Link key={resource.url} href={resource.url} target="_blank" rel="noopener noreferrer">{resource.title}<OpenInNewRounded aria-hidden="true"/></Link>)}</div>}
        </div>
      </AccordionDetails>
    </Accordion>)}</div>

    <Paper className="integration-scope-note">
      <Typography component="h2" sx={{ fontWeight: 600, mb: 1 }}>Какие подключения можно отложить</Typography>
      <Typography color="text.secondary">Для первого рабочего процесса подпись декларации выполняется в кабинете заявителя. Направления и комплекты можно передавать лабораториям вручную. Автоматический обмен подключается после согласования форматов и доступов. Word и PDF формируются самим CertFlow.</Typography>
    </Paper>
  </>;
}
