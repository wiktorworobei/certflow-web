import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { Alert, Avatar, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Paper, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { AddRounded } from '@mui/icons-material';
import { VerifiedUserOutlined } from '@mui/icons-material';
import { CorporateFareOutlined } from '@mui/icons-material';
import { api, authRequest, signedOut } from '../store';
import { EmptyState, ErrorState, Loading, PageTitle, Section, useNotify, useWorkspace } from '../common';
import { errorMessage, roleLabels, type Role } from '../types';
import { AppearanceSettings } from '../AppearanceSettings';
import { IntegrationConnections } from '../IntegrationConnections';

export function Team() {
  const { firmId, isAdmin } = useWorkspace(); const notify = useNotify();
  const { data, isLoading, error, refetch } = api.useTeamQuery(firmId, { skip: !isAdmin });
  const [create, { isLoading: creating }] = api.useCreateUserMutation();
  const [open, setOpen] = useState(false); const [formError, setFormError] = useState('');
  const blank = { userName: '', displayName: '', email: '', password: '', role: 'Manager' as Role };
  const [form, setForm] = useState(blank);
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setFormError('');
    try { await create({ firmId, ...form }).unwrap(); setOpen(false); setForm(blank); notify('Участник добавлен в компанию'); }
    catch (e) { setFormError(errorMessage(e)); }
  }
  if (!isAdmin) return <Alert severity="warning">Управление участниками доступно администратору компании.</Alert>;
  return <><PageTitle eyebrow="СОВМЕСТНАЯ РАБОТА" title="Команда" subtitle="Управляйте доступом специалистов к выбранной компании."><Button variant="contained" startIcon={<AddRounded/>} onClick={() => { setForm(blank); setFormError(''); setOpen(true); }}>Добавить участника</Button></PageTitle>
    <Paper className="table-card">{isLoading ? <Loading/> : error ? <div style={{ padding: 24 }}><ErrorState error={error} retry={refetch}/></div> : !data?.length ? <EmptyState title="Участников пока нет"/> : <TableContainer className="responsive-table team-table"><Table aria-label="Участники команды"><TableHead><TableRow><TableCell>УЧАСТНИК</TableCell><TableCell>ЛОГИН</TableCell><TableCell>ЭЛЕКТРОННАЯ ПОЧТА</TableCell><TableCell>РОЛЬ</TableCell></TableRow></TableHead><TableBody>{data.map(user => <TableRow key={user.id}><TableCell className="responsive-table-title"><div className="document-name"><Avatar sx={{ width: 36, height: 36, bgcolor: 'var(--accent-soft)', color: 'var(--accent-text)', fontSize: 14 }}>{user.displayName.slice(0, 1).toUpperCase()}</Avatar><strong>{user.displayName}</strong></div></TableCell><TableCell data-label="Логин">{user.userName}</TableCell><TableCell data-label="Электронная почта">{user.email || '—'}</TableCell><TableCell data-label="Роль"><Chip label={roleLabels[user.role]} size="small" variant="outlined" sx={{ fontSize: 12, borderColor: 'var(--border)' }}/></TableCell></TableRow>)}</TableBody></Table></TableContainer>}</Paper>
    <div className="role-grid">{([['Admin', 'Документы, справочники и добавление участников'], ['Manager', 'Создание, изменение, согласование и выгрузка документов'], ['Viewer', 'Просмотр документов и скачивание файлов']] as const).map(([role, description]) => <div key={role}><VerifiedUserOutlined fontSize="small"/><div><strong>{roleLabels[role]}</strong><p>{description}</p></div></div>)}</div>
    <Dialog open={open} onClose={() => !creating && setOpen(false)} maxWidth="sm" fullWidth><form onSubmit={submit}><DialogTitle>Новый участник</DialogTitle><DialogContent sx={{ pt: '12px !important' }}><Grid container spacing={2.5}><Grid item xs={12}><TextField label="Имя и фамилия" required value={form.displayName} inputProps={{ maxLength: 150 }} onChange={e => setForm({ ...form, displayName: e.target.value })}/></Grid><Grid item xs={12} sm={6}><TextField label="Логин" required autoComplete="off" value={form.userName} inputProps={{ maxLength: 64, pattern: '[a-zA-Z0-9._@+-]+' }} helperText="Латинские буквы, цифры и . _ @ + -" onChange={e => setForm({ ...form, userName: e.target.value })}/></Grid><Grid item xs={12} sm={6}><TextField label="Роль" select value={form.role} onChange={e => setForm({ ...form, role: e.target.value as Role })}>{Object.entries(roleLabels).map(([r, label]) => <MenuItem key={r} value={r}>{label}</MenuItem>)}</TextField></Grid><Grid item xs={12}><TextField label="Электронная почта" type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/></Grid><Grid item xs={12}><TextField label="Начальный пароль" type="password" required autoComplete="new-password" value={form.password} inputProps={{ minLength: 10, maxLength: 200 }} helperText="От 10 символов, буква, цифра и специальный символ" onChange={e => setForm({ ...form, password: e.target.value })}/></Grid></Grid>{formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}</DialogContent><DialogActions sx={{ p: 2.5 }}><Button disabled={creating} onClick={() => setOpen(false)}>Отмена</Button><Button variant="contained" type="submit" disabled={creating}>{creating ? 'Добавляем…' : 'Добавить участника'}</Button></DialogActions></form></Dialog>
  </>;
}

export function Settings() {
  const { user, firm } = useWorkspace(); const dispatch = useDispatch(); const notify = useNotify();
  const [params, setParams] = useSearchParams();
  const selected = params.get('tab'); const tab = selected === 'appearance' || selected === 'profile' ? selected : 'integrations';
  const [currentPassword, setCurrent] = useState(''); const [newPassword, setNew] = useState(''); const [confirm, setConfirm] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  async function change(event: React.FormEvent) {
    event.preventDefault(); setError('');
    if (newPassword !== confirm) { setError('Новые пароли не совпадают'); return; }
    setBusy(true);
    try { await authRequest('change-password', { currentPassword, newPassword }); dispatch(signedOut()); dispatch(api.util.resetApiState()); notify('Пароль изменён. Войдите с новым паролем.'); }
    catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
  }
  return <><PageTitle eyebrow="ПОД ВАШ РИТМ РАБОТЫ" title="Настройки" subtitle="Подключения, оформление и ваш профиль."/>
    <Paper className="settings-tabs"><Tabs value={tab} onChange={(_, value) => setParams({ tab: value })} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Разделы настроек"><Tab id="settings-integrations" aria-controls="settings-panel" value="integrations" label="Интеграции"/><Tab id="settings-appearance" aria-controls="settings-panel" value="appearance" label="Оформление"/><Tab id="settings-profile" aria-controls="settings-panel" value="profile" label="Профиль и безопасность"/></Tabs></Paper>
    <div id="settings-panel" role="tabpanel" aria-labelledby={`settings-${tab}`}>
    {tab === 'integrations' && <IntegrationConnections/>}
    {tab === 'appearance' && <AppearanceSettings/>}
    {tab === 'profile' && <div className="settings-grid"><Section title="Профиль"><div className="settings-profile"><Avatar className="profile-avatar" sx={{ width: 56, height: 56, fontSize: 23 }}>{user?.displayName.slice(0, 1).toUpperCase()}</Avatar><div><Typography variant="h6">{user?.displayName}</Typography><Typography color="text.secondary">{user?.userName}</Typography></div></div><dl className="profile-details"><dt>Электронная почта</dt><dd>{user?.email || 'Не указана'}</dd><dt>Компания</dt><dd>{firm?.name}</dd><dt>Права доступа</dt><dd>{firm ? roleLabels[firm.role] : '—'}</dd></dl><div className="settings-firm"><CorporateFareOutlined/><div><strong>Данные вашей компании</strong><p>Документы и справочники доступны её участникам.</p></div></div></Section>
      <Section title="Изменить пароль" subtitle="После изменения потребуется повторный вход на всех устройствах."><form onSubmit={change}><TextField type="password" label="Текущий пароль" autoComplete="current-password" required value={currentPassword} onChange={e => setCurrent(e.target.value)} sx={{ mb: 2.5 }}/><TextField type="password" label="Новый пароль" autoComplete="new-password" required value={newPassword} inputProps={{ minLength: 10, maxLength: 200 }} helperText="От 10 символов, буква, цифра и специальный символ" onChange={e => setNew(e.target.value)} sx={{ mb: 2.5 }}/><TextField type="password" label="Повторите новый пароль" autoComplete="new-password" required value={confirm} onChange={e => setConfirm(e.target.value)} sx={{ mb: 2.5 }}/>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}<Button variant="contained" type="submit" disabled={busy}>{busy ? 'Сохраняем…' : 'Изменить пароль'}</Button></form></Section>
    </div>}
    </div>
  </>;
}
