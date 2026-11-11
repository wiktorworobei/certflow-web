import { useState } from 'react';
import { Alert, Box, Button, Chip, MenuItem, TextField, Typography } from '@mui/material';
import { ErrorState, Loading, Section, useWorkspace } from './common';
import { dateTime, errorMessage } from './types';
import { marketplaceApi, saveMarketplace } from './marketplaceApi';
import { Link as RouterLink } from 'react-router-dom';
import { ArrowForwardRounded } from '@mui/icons-material';

const message = (e: unknown) => e instanceof Error ? e.message : errorMessage(e);
const row = { display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', my: 2,
  '& > .MuiTextField-root': { minWidth: { xs: 0, sm: 220 }, maxWidth: '100%' } } as const;

export function MarketplaceSettingsPanel() {
  const { firmId, isAdmin } = useWorkspace();
  const settings = marketplaceApi.useMarketplaceSettingsQuery(firmId);
  const [remove] = marketplaceApi.useDeleteMarketplaceMutation();
  const [environment, setEnvironment] = useState<string | null>(null); const [mode, setMode] = useState<string | null>(null);
  const [key, setKey] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const data = settings.data;
  async function save() {
    setBusy(true); setError(''); setNotice('');
    try { await saveMarketplace(firmId, { environment: environment ?? data!.environment, accessMode: mode ?? data!.accessMode, apiKey: key, revision: data!.revision }); setKey(''); setEnvironment(null); setMode(null); setNotice('Ключ сохранён. Выполните проверку документа, чтобы проверить доступ к выбранному реестру.'); await settings.refetch(); }
    catch (e) { setError(message(e)); } finally { setBusy(false); }
  }
  return <Section title="Реестры Росаккредитации — API Marketplaces" subtitle="Проверка сертификатов и деклараций РФ и ЕАЭС для выбранной компании.">
    {settings.isLoading ? <Loading/> : settings.error ? <ErrorState error={settings.error} retry={settings.refetch}/> : data && <>
      <Chip variant="outlined" label={!data.enabled ? 'Отключено на сервере' : data.isConfigured ? 'Ключ сохранён' : 'Ключ не добавлен'} sx={{ mb: 2 }}/>
      <Typography color="text.secondary">Ключ тестового контура запрашивается по адресу marketplace@fsa.gov.ru. Ключ рабочего контура выдаётся в личном кабинете маркетплейса ФГИС Росаккредитации.</Typography>
      <Box sx={row}>
        <TextField select label="Контур реестров" value={environment ?? data.environment} disabled={!isAdmin || busy} onChange={e => setEnvironment(e.target.value)} sx={{ minWidth: 220 }}><MenuItem value="Development">Тестовый</MenuItem><MenuItem value="Production">Рабочий</MenuItem></TextField>
        <TextField select label="Разрешённые операции" value={mode ?? data.accessMode} disabled={!isAdmin || busy} onChange={e => setMode(e.target.value)} sx={{ minWidth: 290 }}><MenuItem value="SyncOnly">Только одиночная проверка</MenuItem><MenuItem value="Marketplace">Маркетплейс — пакетные запросы</MenuItem><MenuItem value="Pcp">Оператор ПЦП — выгрузки</MenuItem></TextField>
      </Box>
      {isAdmin && <>
        <TextField label={data.isConfigured ? 'Новый API-ключ реестров' : 'API-ключ реестров'} type="password" autoComplete="new-password" value={key} onChange={e => setKey(e.target.value)} disabled={busy || !data.enabled} inputProps={{ maxLength: 2048, spellCheck: false }} helperText="Ключ сохраняется у компании в зашифрованном виде. При смене контура укажите его ключ."/>
        <Box sx={row}><Button variant="contained" disabled={busy || !data.enabled || (!key.trim() && !data.isConfigured)} onClick={() => void save()}>Сохранить доступ к реестрам</Button>
          <Button color="error" disabled={busy || !data.revision} onClick={async () => { setBusy(true); setError(''); setNotice(''); try { await remove({ firmId, revision: data.revision! }).unwrap(); setKey(''); setEnvironment(null); setMode(null); setNotice('Подключение удалено.'); } catch (e) { setError(message(e)); } finally { setBusy(false); } }}>Удалить подключение</Button></Box>
      </>}
      {!isAdmin && <Typography variant="body2" sx={{ mt: 1 }}>Настроить доступ может администратор компании.</Typography>}
      {data.updatedAtUtc && <Typography variant="body2" color="text.secondary">Настройки сохранены {dateTime(data.updatedAtUtc)}. Выбранный режим должен соответствовать правам выданного API-ключа.</Typography>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}{notice && <Alert severity="info" sx={{ mt: 2 }}>{notice}</Alert>}
      <Box sx={{ mt: 3 }}><Button component={RouterLink} to="/registries" variant="outlined" endIcon={<ArrowForwardRounded/>}>Открыть проверку документов</Button><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Поиск в реестрах, пакетные проверки, результаты запросов и выгрузки собраны в отдельном рабочем разделе.</Typography></Box>
    </>}
  </Section>;
}
