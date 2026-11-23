import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation } from 'react-router-dom';
import { Alert, Button, Chip, Grid, TextField, Typography } from '@mui/material';
import { ArrowForwardRounded, SaveOutlined } from '@mui/icons-material';
import { api } from './store';
import { ErrorState, Loading, Section, useWorkspace } from './common';
import { errorMessage } from './types';

export function MarkingConnectionSettings() {
  const { firm, firmId, isAdmin, canEdit } = useWorkspace();
  const { hash } = useLocation();
  const sectionRef = useRef<HTMLDivElement>(null);
  const query = api.useMarkingSettingsQuery(firmId); const connections = api.useMarkingConnectionsQuery(firmId, { pollingInterval: 60000, refetchOnMountOrArgChange: true });
  const settings = query.currentData;
  const sessions = connections.currentData;
  const [save, { isLoading }] = api.useSaveMarkingSettingsMutation();
  const [form, setForm] = useState({ omsId: '', connectionId: '', participantInn: '' }); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  useEffect(() => { if (settings) setForm({ omsId: settings.omsId, connectionId: settings.connectionId, participantInn: settings.participantInn }); }, [settings]);
  useEffect(() => {
    if (hash !== '#marking-connection') return;
    const frame = requestAnimationFrame(() => {
      sectionRef.current?.focus({ preventScroll: true });
      sectionRef.current?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(frame);
  }, [hash]);
  return <div id="marking-connection" ref={sectionRef} tabIndex={-1} style={{ scrollMarginTop: 96 }}>
  <Section title="Честный знак и Наша марка" subtitle={`Настройки ЧЗ для компании «${firm?.name}». Внешний вход выполняется отдельно для каждого пользователя.`}>
    {query.error ? <ErrorState error={query.error} retry={query.refetch}/> : !settings ? <Loading/> : <>
      {connections.isError && <Alert severity="warning" sx={{ mb: 2 }}>Не удалось проверить внешние сессии. <Button size="small" onClick={() => void connections.refetch()}>Повторить</Button></Alert>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}><Chip size="small" color={settings.profile === 'Production' ? 'warning' : 'info'} label={settings.profile === 'Production' ? 'ЧЗ · рабочий контур' : 'ЧЗ · песочница'}/><Chip size="small" color={sessions?.chz ? 'success' : 'default'} variant="outlined" label={sessions?.chz ? 'ЧЗ · сессия активна' : 'ЧЗ · вход не выполнен'}/>{sessions?.dmKod.map(session => <Chip key={session.environment} size="small" variant="outlined" color="success" label={`Наша марка · ${session.environment} · сессия активна`}/>)}</div>
      <form onSubmit={async event => { event.preventDefault(); if (!isAdmin || isLoading) return; setError(''); setNotice(''); try { await save({ firmId, data: form }).unwrap(); setNotice('Настройки сохранены. Выполните вход по сертификату в разделе «ЧЗ и Наша марка».'); } catch (e) { setError(errorMessage(e)); } }}>
        <Grid container spacing={2}><Grid item xs={12} md={4}><TextField label="ИНН участника ЧЗ" value={form.participantInn} disabled={!isAdmin || isLoading} onChange={e => setForm({ ...form, participantInn: e.target.value })} inputProps={{ maxLength: 12, inputMode: 'numeric' }}/></Grid><Grid item xs={12} md={4}><TextField label="OMS ID" value={form.omsId} disabled={!isAdmin || isLoading} onChange={e => setForm({ ...form, omsId: e.target.value })} inputProps={{ maxLength: 36 }}/></Grid><Grid item xs={12} md={4}><TextField label="Connection ID" value={form.connectionId} disabled={!isAdmin || isLoading} onChange={e => setForm({ ...form, connectionId: e.target.value })} inputProps={{ maxLength: 36 }}/></Grid></Grid>
        <Typography color="text.secondary" variant="body2" sx={{ mt: 2, mb: 2 }}>OMS ID и Connection ID доступны в СУЗ → «Устройства». Для входа в ЧЗ нужны сертификат и КриптоПро на вашем компьютере. Изменение этих параметров завершает сессии ЧЗ компании.</Typography>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>{isAdmin && <Button variant="contained" type="submit" startIcon={<SaveOutlined/>} disabled={isLoading}>{isLoading ? 'Сохраняем…' : 'Сохранить настройки ЧЗ'}</Button>}{canEdit && <Button component={RouterLink} to="/marking?tab=chz" variant="outlined" endIcon={<ArrowForwardRounded/>}>Войти в Честный знак</Button>}{canEdit && <Button component={RouterLink} to="/marking?tab=dmkod" endIcon={<ArrowForwardRounded/>}>Войти в Нашу марку</Button>}</div>
      </form>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ mt: 2 }}>{notice}</Alert>}
    </>}
  </Section></div>;
}
