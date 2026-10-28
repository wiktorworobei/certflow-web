import { useState } from 'react';
import { Alert, Box, Button, Chip, Grid, Link, TextField, Typography } from '@mui/material';
import { CheckCircleOutlineRounded, DeleteOutlineRounded, SaveOutlined } from '@mui/icons-material';
import { ErrorState, Loading, Section } from './common';
import { api, savePersonalDaDataKey } from './store';
import { dateTime, errorMessage } from './types';

export function PersonalDaDataSettings() {
  const { data, isLoading, error: loadError, refetch } = api.useDaDataSettingsQuery();
  const [check] = api.useCheckDaDataKeyMutation(); const [remove] = api.useDeleteDaDataKeyMutation();
  const [apiKey, setApiKey] = useState(''); const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  async function act(action: 'save' | 'check' | 'delete') {
    setBusy(true); setError(''); setNotice('');
    try {
      if (action === 'save') {
        await savePersonalDaDataKey(apiKey.trim()); setApiKey('');
        setNotice('Личный ключ сохранён. Проверяем доступ к DaData…');
      }
      if (action === 'delete') {
        const state = await remove().unwrap(); setApiKey('');
        setNotice(state.source === 'Server' ? 'Личный ключ удалён. Поиск будет использовать серверное подключение.' : 'Личный ключ удалён. Добавьте новый ключ для поиска.');
      } else {
        await check().unwrap(); setNotice('Подключение проверено. Можно искать организации по ИНН / ОГРН.');
      }
    } catch (e) { setNotice(''); setError(errorMessage(e)); }
    finally { setBusy(false); }
  }
  return <Section title="Мой аккаунт DaData" subtitle="Личный ключ используется для поиска и ночного обновления сохранённых вами компаний в справочнике. Для фонового обновления проверяются ваши действующие права на компанию.">
    {isLoading ? <Loading/> : loadError ? <ErrorState error={loadError} retry={refetch}/> : <>
      <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, mb: 2 }}>
        <Chip size="small" variant="outlined" color={data?.enabled && data?.verifiedAt ? 'success' : 'default'} label={!data?.enabled ? 'Поиск отключён сервером' : data?.verifiedAt ? 'Доступ подтверждён' : data?.hasPersonalKey ? 'Личный ключ сохранён' : data?.source === 'Server' ? 'Ключ сервера · требуется проверка' : 'Ключ не добавлен'}/>
        {data?.verifiedAt && <Typography variant="body2" color="text.secondary">Проверен {dateTime(data.verifiedAt)}</Typography>}
      </Box>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Скопируйте API-ключ из <Link href="https://dadata.ru/profile/" target="_blank" rel="noopener noreferrer">личного кабинета DaData</Link>. Секретный ключ стандартизации для поиска организаций не нужен. После сохранения приложение проверит доступ одним запросом к сервису.</Typography>
      <Grid container spacing={2} alignItems="flex-start"><Grid item xs={12} md={8}><TextField label={data?.hasPersonalKey ? 'Новый API-ключ DaData' : 'API-ключ DaData'} type="password" autoComplete="new-password" value={apiKey} disabled={busy || !data?.enabled} onChange={e => setApiKey(e.target.value)} inputProps={{ maxLength: 256, spellCheck: false }} helperText="Сохранённый ключ не возвращается в браузер. Введите новый, только если хотите заменить его."/></Grid><Grid item xs={12} md={4}><Button type="button" variant="contained" startIcon={<SaveOutlined/>} disabled={busy || !data?.enabled || !apiKey.trim()} onClick={() => void act('save')}>{busy ? 'Выполняем…' : 'Сохранить и проверить'}</Button></Grid></Grid>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, mt: 1.5 }}><Button type="button" startIcon={<CheckCircleOutlineRounded/>} disabled={busy || !data?.isConfigured} onClick={() => void act('check')}>Проверить сохранённый ключ</Button>{data?.hasPersonalKey && <Button type="button" color="error" startIcon={<DeleteOutlineRounded/>} disabled={busy} onClick={() => void act('delete')}>Удалить личный ключ</Button>}<Link href="#/declarations/new" sx={{ alignSelf: 'center', fontSize: 13 }}>Перейти к новой декларации</Link></Box>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ mt: 2 }}>{notice}</Alert>}
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Поиск и автоматическое обновление расходуют лимит вашего аккаунта DaData. Ночные запросы выполняются сервером, даже если браузер закрыт. Автообновление можно выключить в карточке компании. Ключ хранится в зашифрованном виде и применяется сразу после сохранения.</Typography>
    </>}
  </Section>;
}
