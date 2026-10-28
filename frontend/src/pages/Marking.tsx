import { lazy, Suspense, useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { Toaster } from 'sonner';
import { Alert, Button, Chip, IconButton, MenuItem, Paper, Tab, Tabs, TextField, Typography } from '@mui/material';
import { AddRounded, DeleteOutlineRounded, OpenInNewRounded, SettingsOutlined } from '@mui/icons-material';
import { api } from '../store';
import { ErrorState, Loading, PageTitle, Section, useWorkspace } from '../common';
import { date, errorMessage, statusLabels } from '../types';
import { useAppearance } from '../theme';
import { MarkingBatches } from '../MarkingBatches';
import { MarkingDeclarationContext } from '../marking/DeclarationContext';
import i18n from '../marking/src/i18n';
import '../marking/marking.css';
import { useUtilisationReportsStore } from '../marking/lib/honest-sign/utilisationReportsStore';

const HonestSignApp = lazy(() => import('../marking/components/honest-sign/honest-sign-app').then(module => ({ default: module.HonestSignApp })));
const DmKodEnvironmentWorkspace = lazy(() => import('../marking/components/dmkod/dmkod-environment-workspace').then(module => ({ default: module.DmKodEnvironmentWorkspace })));

export function Marking() {
  const { firmId, canEdit } = useWorkspace(); const { mode } = useAppearance();
  const [params, setParams] = useSearchParams(); const value = params.get('tab');
  const tab = value === 'chz' || value === 'dmkod' || value === 'documents' ? value : 'links';
  const [query] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false }, mutations: { retry: false } } }));
  useEffect(() => () => { query.clear(); useUtilisationReportsStore.getState().clearReports(firmId); }, [query, firmId]);
  const [environment, setEnvironment] = useState<'TEST' | 'PROD'>('TEST');
  const settings = api.useMarkingSettingsQuery(firmId);
  const selectedId = params.get('declarationId') ?? '';
  const declaration = api.useDeclarationQuery({ firmId, id: selectedId }, { skip: !selectedId });
  return <><PageTitle eyebrow="ВНЕШНИЕ СЕРВИСЫ" title="ЧЗ и Наша марка" subtitle="Товары, коды и связи с декларациями в подключённых сервисах."><Button component={RouterLink} to="/settings" variant="outlined" startIcon={<SettingsOutlined/>}>Настройки подключения</Button></PageTitle>
    <Paper className="marking-top-tabs"><Tabs value={tab} onChange={(_, next) => { const updated = new URLSearchParams(params); updated.set('tab', next); setParams(updated); }} variant="scrollable" scrollButtons="auto" aria-label="Разделы ЧЗ и Нашей марки"><Tab value="links" label="Связи с декларациями"/><Tab value="chz" label="Честный знак" disabled={!canEdit}/><Tab value="dmkod" label="Наша марка" disabled={!canEdit}/><Tab value="documents" label="Партии и коды"/></Tabs></Paper>
    <div className={`marking-surface ${mode === 'dark' ? 'dark' : ''}`}><QueryClientProvider client={query}><I18nextProvider i18n={i18n}><MarkingDeclarationContext.Provider value={declaration.data ?? null}><Suspense fallback={<Loading/>}>
      {tab === 'links' && <DeclarationLinks selectedId={selectedId} onSelect={id => { const updated = new URLSearchParams(params); if (id) updated.set('declarationId', id); else updated.delete('declarationId'); setParams(updated, { replace: true }); }}/>} 
      {(tab === 'chz' || tab === 'dmkod') && !canEdit && <Alert severity="warning">Внешние операции доступны специалисту или администратору компании.</Alert>}
      {tab === 'chz' && canEdit && <><Alert severity={settings.data?.profile === 'Production' ? 'warning' : 'info'} sx={{ mb: 2 }}>Честный знак · {settings.data?.profile === 'Production' ? 'рабочий контур' : 'песочница'}. {selectedId && declaration.data ? `Выбрана декларация ${declaration.data.reference}. В каталоге можно подставить её сведения.` : 'Чтобы использовать реквизиты документа, сначала выберите декларацию во вкладке «Связи с декларациями».'}</Alert><HonestSignApp companyId={firmId}/></>}
      {tab === 'dmkod' && canEdit && <DmKodEnvironmentWorkspace companyId={firmId} environment={environment} onEnvironmentChange={setEnvironment}/>}
      {tab === 'documents' && <MarkingBatches selectedId={selectedId} onSelect={id => { const updated = new URLSearchParams(params); if (id) updated.set('declarationId', id); else updated.delete('declarationId'); setParams(updated, { replace: true }); }}/>}
      </Suspense><div id="marking-portals"/>
      <Toaster theme={mode} position="bottom-right" richColors/>
    </MarkingDeclarationContext.Provider></I18nextProvider></QueryClientProvider></div>
  </>;
}

function DeclarationLinks({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const { firmId, canEdit } = useWorkspace(); const all = api.useDeclarationsQuery({ firmId, filters: { pageSize: 100 } });
  const links = api.useMarkingLinksQuery({ firmId }); const settings = api.useMarkingSettingsQuery(firmId);
  const selected = api.useDeclarationQuery({ firmId, id: selectedId }, { skip: !selectedId });
  const [save, { isLoading }] = api.useSaveMarkingLinkMutation(); const [remove] = api.useDeleteMarkingLinkMutation();
  const [gtin, setGtin] = useState(''); const [provider, setProvider] = useState<'ChZ' | 'DMkod'>('ChZ'); const [env, setEnv] = useState<'TEST' | 'PROD'>('TEST');
  const [order, setOrder] = useState(''); const [batch, setBatch] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => { if (selected.currentData?.id === selectedId) setGtin(current => current || selected.currentData?.product.gtin || ''); }, [selected.currentData, selectedId]);
  const visible = links.data?.filter(row => !selectedId || row.declarationId === selectedId) ?? [];
  return <><Section title="Декларация → товар → партия" subtitle="Сохраняйте связь с GTIN и внешним заказом, чтобы находить документы для конкретного товара.">
    {all.error && <ErrorState error={all.error} retry={all.refetch}/>}
    <form className="marking-link-form" onSubmit={async event => { event.preventDefault(); setError(''); setNotice(''); try { await save({ firmId, data: { declarationId: selectedId, gtin, provider, environment: provider === 'ChZ' ? settings.data?.profile ?? 'Sandbox' : env, externalOrderId: order, batchNumber: batch } }).unwrap(); setNotice('Связь с декларацией сохранена.'); } catch (e) { setError(errorMessage(e)); } }}>
      <TextField className="full-width" label="Декларация для товара" select value={selectedId} disabled={all.isLoading} onChange={event => { setGtin(''); onSelect(event.target.value); }}><MenuItem value="">Все декларации</MenuItem>{selectedId && !all.data?.items.some(row => row.id === selectedId) && <MenuItem value={selectedId}>{selected.data ? `${selected.data.reference} · ${selected.data.title}` : 'Выбранная декларация'}</MenuItem>}{all.data?.items.map(row => <MenuItem key={row.id} value={row.id}>{row.reference} · {row.title}</MenuItem>)}</TextField>
      {selected.data && <Alert severity={selected.data.status === 'Suspended' || selected.data.status === 'Revoked' ? 'warning' : 'info'} className="full-width">{selected.data.registrationNumber || 'Регистрационный номер не указан'} · {statusLabels[selected.data.status]} · действует до {date(selected.data.validUntil)}. Сведения взяты из карточки CertFlow.</Alert>}
      {canEdit && <><TextField label="GTIN товара" value={gtin} required onChange={e => setGtin(e.target.value)} inputProps={{ maxLength: 14, inputMode: 'numeric' }}/><TextField select label="Внешний сервис" value={provider} onChange={e => setProvider(e.target.value as 'ChZ' | 'DMkod')}><MenuItem value="ChZ">Честный знак · {settings.data?.profile ?? 'Sandbox'}</MenuItem><MenuItem value="DMkod">Наша марка / DMkod</MenuItem></TextField>{provider === 'DMkod' && <TextField label="Контур Нашей марки" select value={env} onChange={e => setEnv(e.target.value as 'TEST' | 'PROD')}><MenuItem value="TEST">TEST · тестовый</MenuItem><MenuItem value="PROD">PROD · рабочий</MenuItem></TextField>}<TextField label="ID внешнего заказа (необязательно)" value={order} onChange={e => setOrder(e.target.value)} inputProps={{ maxLength: 128 }}/><TextField label="Номер партии (необязательно)" value={batch} onChange={e => setBatch(e.target.value)} inputProps={{ maxLength: 200 }}/><div className="full-width"><Button variant="contained" type="submit" startIcon={<AddRounded/>} disabled={!selectedId || isLoading}>{isLoading ? 'Сохраняем…' : 'Связать с декларацией'}</Button></div></>}
    </form>{error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ mt: 2 }}>{notice}</Alert>}
  </Section>
    {links.isLoading ? <Loading/> : links.error ? <ErrorState error={links.error} retry={links.refetch}/> : <Section title={`Связанные товары · ${visible.length}`}>
      {!visible.length && <Typography color="text.secondary">Связей пока нет. Выберите декларацию и укажите GTIN товара.</Typography>}
      <div className="marking-links">{visible.map(row => <article className="marking-link-row" key={row.id}><div><Typography variant="h6">{row.productName || row.declarationTitle}</Typography><Typography color="text.secondary" variant="body2">GTIN {row.gtin} · {row.provider} · {row.environment}</Typography><Typography color="text.secondary" variant="body2">{row.declarationReference} · {row.registrationNumber || 'Без регистрационного номера'}{row.batchNumber && ` · Партия ${row.batchNumber}`}{row.externalOrderId && ` · Заказ ${row.externalOrderId}`}</Typography>{row.codesDocumentId && <Chip label="Привязан состав кодов" size="small" sx={{ mt: 1 }}/>}</div><Button component={RouterLink} to={`/declarations/${row.declarationId}`} size="small" endIcon={<OpenInNewRounded/>}>Декларация</Button>{canEdit && <IconButton aria-label={`Удалить связь GTIN ${row.gtin}`} onClick={async () => { try { await remove({ firmId, id: row.id }).unwrap(); } catch (e) { setError(errorMessage(e)); } }}><DeleteOutlineRounded fontSize="small"/></IconButton>}</article>)}</div>
    </Section>}
  </>;
}
