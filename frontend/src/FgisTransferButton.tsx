import { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, TextField, Typography } from '@mui/material';
import { OpenInNewRounded, SendOutlined } from '@mui/icons-material';
import { api } from './store';
import { useWorkspace } from './common';
import type { Declaration, SaveDeclaration } from './types';
import { fgisPayload, requestFgis, type FgisTab, type FgisTransferResult } from './fgisTransfer';

export function FgisTransferButton({ document, disabled = false }: { document: Declaration; disabled?: boolean }) {
  const { firmId, canEdit } = useWorkspace();
  const { formState: { isDirty } } = useFormContext<SaveDeclaration>();
  const [fetchDeclaration] = api.useLazyDeclarationQuery();
  const [open, setOpen] = useState(false); const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false); const [tabs, setTabs] = useState<FgisTab[]>([]); const [tabId, setTabId] = useState('');
  const [error, setError] = useState(''); const [result, setResult] = useState<FgisTransferResult>(); const [mapping, setMapping] = useState(false);
  const unavailable = disabled || isDirty || !canEdit || !['Draft', 'InReview', 'Ready'].includes(document.status);
  const current = useRef({ unavailable, revision: document.revision }); current.current = { unavailable, revision: document.revision };
  const mounted = useRef(true); useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function check() {
    setBusy(true); setError(''); setConnected(false); setTabs([]); setTabId(''); setResult(undefined); setMapping(false);
    try {
      const response = await requestFgis('status');
      if (!mounted.current) return;
      setConnected(true); setTabs(response.tabs ?? []);
      if (response.tabs?.length === 1) setTabId(String(response.tabs[0].id));
    } catch (e) { if (mounted.current) setError((e as Error).message); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function transfer(action: 'fill' | 'map') {
    if (!tabId || unavailable || busy) return;
    setBusy(true); setError(''); setResult(undefined); setMapping(false);
    try {
      const fresh = await fetchDeclaration({ firmId, id: document.id }, false).unwrap();
      if (!mounted.current) return;
      if (current.current.unavailable || fresh.revision !== document.revision || current.current.revision !== document.revision || !['Draft', 'InReview', 'Ready'].includes(fresh.status))
        throw new Error('Декларация изменилась. Сохраните изменения и откройте перенос заново.');
      const response = await requestFgis(action, { tabId: Number(tabId), payload: fgisPayload(fresh) });
      if (mounted.current) { setResult(response.result); setMapping(!!response.mapping); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : 'Не удалось получить актуальные данные декларации. Обновите карточку.'); }
    finally { if (mounted.current) setBusy(false); }
  }
  const filled = result?.fields.filter(f => f.status === 'filled').length ?? 0;
  const unchanged = result?.fields.filter(f => f.status === 'unchanged').length ?? 0;
  const remaining = result?.fields.filter(f => !['filled', 'unchanged'].includes(f.status)) ?? [];
  return <>
    <Button variant="outlined" startIcon={<SendOutlined/>} disabled={unavailable} onClick={() => { setOpen(true); void check(); }}>Перенести в ФГИС</Button>
    <Dialog open={open} onClose={() => !busy && setOpen(false)} maxWidth="md" fullWidth>
      <DialogTitle>Перенести в ФГИС · {document.reference}</DialogTitle>
      <DialogContent>
        <Typography sx={{ mb: 2 }}>Откройте черновик декларации в кабинете ФГИС в этом же браузере. Перенос заполнит доступные поля текущего раздела. После перехода в другой раздел повторите заполнение.</Typography>
        <Alert severity="info" sx={{ mb: 2 }}>Проверьте сведения перед подписанием в кабинете. Справочники с поиском и файлы заполняются вручную. Уже заполненные отличающиеся значения сохраняются.</Alert>
        {!!Object.keys(document.workspace?.printOverrides ?? {}).length && <Alert severity="warning" sx={{ mb: 2 }}>Переносятся структурированные реквизиты карточки. Ручные формулировки на печатном листе и тексты приложений проверьте и перенесите отдельно.</Alert>}
        {!connected && <div>
          <Typography component="ol" sx={{ pl: 3 }}>
            <li><a href={`${import.meta.env.BASE_URL}fgis-extension.zip`} download style={{ textDecoration: 'underline', textUnderlineOffset: 3 }}>Скачайте расширение «ZNAQ → ФГИС»</a> и распакуйте ZIP.</li>
            <li>Откройте страницу расширений: <code>edge://extensions</code> в Edge, <code>chrome://extensions</code> в Chrome, <code>browser://extensions</code> в Яндекс Браузере. Включите режим разработчика и выберите «Загрузить распакованное расширение».</li>
            <li>В этой вкладке ZNAQ нажмите значок расширения, затем «Подключить эту вкладку ZNAQ».</li>
          </Typography>
          <Button onClick={() => void check()} disabled={busy}>Проверить подключение</Button>
        </div>}
        {connected && !tabs.length && <Alert severity="warning" sx={{ mb: 2 }}>Открытых вкладок srd.fsa.gov.ru не найдено. Откройте кабинет в том же браузере и профиле, войдите и откройте черновик декларации.</Alert>}
        {connected && tabs.length > 0 && <TextField select label="Вкладка кабинета ФГИС" value={tabId} disabled={busy} onChange={e => { setTabId(e.target.value); setResult(undefined); setMapping(false); }} sx={{ my: 2 }}>{tabs.map(tab => <MenuItem key={tab.id} value={String(tab.id)}>{tab.title} · вкладка {tab.id}</MenuItem>)}</TextField>}
        {connected && <Button onClick={() => void check()} disabled={busy}>Обновить список вкладок</Button>}
        {unavailable && <Alert severity="warning" sx={{ mt: 2 }}>Для переноса сохраните декларацию. Доступны статусы «Черновик», «На проверке», «Готова к регистрации» и права редактирования.</Alert>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        {mapping && <Alert severity="info" sx={{ mt: 2 }}>В кабинете ФГИС открыта панель сопоставления. Выберите реквизит, затем нажмите на его поле в форме. После настройки нажмите здесь «Заполнить открытый раздел».</Alert>}
        {result && <div role="status" aria-live="polite">
          <Alert severity={remaining.length ? 'warning' : 'success'} sx={{ mt: 2 }}>Заполнено: {filled}. Уже совпадало: {unchanged}. Требуют внимания или другого раздела: {remaining.length}. Проверьте данные в кабинете.</Alert>
          {!!remaining.length && <details style={{ marginTop: 16 }}><summary>Поля, которые нужно проверить</summary><ul>{remaining.map(field => <li key={field.key}><strong>{field.label}</strong>: {field.message}</li>)}</ul></details>}
        </div>}
        <details style={{ marginTop: 16 }}><summary>Передаваемые сведения · версия {document.revision}</summary><dl>{fgisPayload(document).fields.map(field => <div key={field.key} style={{ marginBottom: 12 }}><dt><strong>{field.group} · {field.label}</strong></dt><dd style={{ marginLeft: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{field.value}</dd></div>)}</dl></details>
      </DialogContent>
      <DialogActions sx={{ p: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={() => setOpen(false)} disabled={busy}>Закрыть</Button>
        <Button component="a" href="https://srd.fsa.gov.ru/srd" target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewRounded/>}>Открыть кабинет</Button>
        <Button disabled={!connected || !tabId || busy || unavailable} onClick={() => void transfer('map')}>Сопоставить поля</Button>
        <Button variant="contained" disabled={!connected || !tabId || busy || unavailable} onClick={() => void transfer('fill')}>{busy ? 'Проверяем…' : 'Заполнить открытый раздел'}</Button>
      </DialogActions>
    </Dialog>
  </>;
}
