import { useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, MenuItem, Pagination, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { FileDownloadOutlined, FolderOpenOutlined, RefreshRounded, UploadFileOutlined } from '@mui/icons-material';
import { api, store } from './store';
import { ErrorState, Loading, Section, useWorkspace } from './common';
import { dateTime, errorMessage, type ImportMarkingBatch, type MarkingBatchCode, type Page } from './types';
import { apiClient } from './marking/lib/api-client';
import { parseBatchCodes } from './marking/lib/batch-file';
import { isValidCatalogGtin } from './marking/lib/honest-sign/catalogForm';
import { formatDataMatrixCodeForDisplay } from './marking/lib/honest-sign/codeNormalization';
import { assertMarkingScope, captureMarkingScope } from './marking/lib/workspace-scope';
import { downloadInBrowser } from './marking/lib/save-file';

function requestError(error: unknown) {
  if (isAxiosError(error)) return error.response?.data?.message || error.response?.data?.detail || 'Не удалось выполнить запрос. Повторите попытку.';
  return error instanceof Error ? error.message : errorMessage(error);
}

export function MarkingBatches({ selectedId, onSelect }: { selectedId: string; onSelect: (id: string) => void }) {
  const { firmId, canEdit } = useWorkspace(); const [search, setSearch] = useState(''); const [term, setTerm] = useState(''); const [page, setPage] = useState(1);
  const [onlySelected, setOnlySelected] = useState(true); const [opened, setOpened] = useState('');
  useEffect(() => { setPage(1); }, [selectedId]);
  const query = api.useMarkingBatchesQuery({ firmId, search: term, declarationId: onlySelected && selectedId ? selectedId : undefined, page });
  return <>
    {canEdit && <BatchImport selectedId={selectedId} onSelect={onSelect} onSaved={id => { setPage(1); setOpened(id); }}/>} 
    <Section title="Журнал партий" subtitle="Сохранённые составы кодов и связанные декларации. Локальное подтверждение состава не означает принятие отчёта в ЧЗ.">
      <form className="marking-batch-search" onSubmit={event => { event.preventDefault(); setTerm(search.trim()); setPage(1); }}><TextField label="Поиск партии, GTIN или документа" value={search} onChange={e => setSearch(e.target.value)} inputProps={{ maxLength: 200 }}/><Button type="submit" variant="outlined">Найти</Button><Button aria-label="Обновить журнал партий" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshRounded/></Button></form>
      {selectedId && <FormControlLabel control={<Checkbox checked={onlySelected} onChange={e => { setOnlySelected(e.target.checked); setPage(1); }}/>} label="Только выбранная декларация"/>}
      {query.isLoading ? <Loading/> : query.error ? <ErrorState error={query.error} retry={query.refetch}/> : <>
        {!query.data?.items.length && <Typography color="text.secondary" sx={{ my: 3 }}>Партии не найдены. Измените поиск или сохраните первый состав кодов.</Typography>}
        <div className="marking-batch-list">{query.data?.items.map(row => <article className="marking-link-row" key={row.id}><div><Typography component="h3" variant="h6">{row.title}</Typography><Typography color="text.secondary" variant="body2">{row.codes} кодов · {row.boxes} коробов · {row.pallets} палет · {dateTime(row.uploadedAtUtc)}</Typography>{row.declarations.map(link => <Typography key={link.id} variant="body2" color="text.secondary">{link.declarationReference} · GTIN {link.gtin}{link.batchNumber && ` · Партия ${link.batchNumber}`} · {link.provider} / {link.environment}</Typography>)}{!row.declarations.length && <Chip label="Без связи с декларацией" size="small" variant="outlined" sx={{ mt: 1 }}/>}</div><Button variant="outlined" startIcon={<FolderOpenOutlined/>} onClick={() => setOpened(row.id)}>Открыть партию</Button></article>)}</div>
        {!!query.data?.total && <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mt: 3, flexWrap: 'wrap', gap: 1 }}><Typography variant="body2" color="text.secondary">Всего партий: {query.data.total}</Typography><Pagination aria-label="Страницы журнала партий" page={page} count={Math.ceil(query.data.total / 10)} onChange={(_, value) => setPage(value)}/></Stack>}
      </>}
    </Section>
    {!!opened && <BatchDialog key={opened} id={opened} onClose={() => setOpened('')}/>}
  </>;
}

function BatchImport({ selectedId, onSelect, onSaved }: { selectedId: string; onSelect: (id: string) => void; onSaved: (id: string) => void }) {
  const { firmId, user } = useWorkspace(); const declarations = api.useDeclarationsQuery({ firmId, filters: { pageSize: 100 } });
  const selected = api.useDeclarationQuery({ firmId, id: selectedId }, { skip: !selectedId });
  const [gtin, setGtin] = useState(''); const [title, setTitle] = useState(''); const [batch, setBatch] = useState(''); const [order, setOrder] = useState('');
  const [codes, setCodes] = useState(''); const [confirmed, setConfirmed] = useState(false); const [busy, setBusy] = useState(false); const [reading, setReading] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [pending, setPending] = useState<ImportMarkingBatch | null>(null);
  const recoveryKey = `certflow.batch-attempt.v1:${user?.id}:${firmId}`;
  const [recovery, setRecovery] = useState(() => { try { const value = sessionStorage.getItem(recoveryKey) ?? ''; return /^[\da-f-]{36}$/i.test(value) ? value : ''; } catch { return ''; } });
  const locked = busy || reading || !!pending || !!recovery;
  const inFlight = useRef(false); const input = useRef<HTMLInputElement>(null);
  useEffect(() => { if (selected.currentData?.id === selectedId) { setGtin(value => value || selected.currentData?.product.gtin || ''); setTitle(value => value || `Партия · ${selected.currentData?.product.name || selected.currentData?.title}`.slice(0, 200)); } }, [selected.currentData, selectedId]);
  const remember = (id: string) => { setRecovery(id); try { if (id) sessionStorage.setItem(recoveryKey, id); else sessionStorage.removeItem(recoveryKey); } catch { /* Retry remains available in this tab. */ } };
  const save = async () => {
    if (inFlight.current || reading) return;
    setError(''); setNotice(''); let request = pending;
    if (!request) {
      try {
        const values = parseBatchCodes(codes);
        if (!selectedId || !title.trim() || !isValidCatalogGtin(gtin) || !confirmed || !values.length) throw new Error('Выберите декларацию, укажите название и корректный GTIN, добавьте коды и подтвердите состав.');
        request = { id: crypto.randomUUID(), declarationId: selectedId, title: title.trim(), gtin, batchNumber: batch, externalOrderId: order, physicalOutcomesConfirmed: true, codes: values };
      } catch (e) { setError(requestError(e)); return; }
      setPending(request); remember(request.id);
    }
    inFlight.current = true; setBusy(true);
    try {
      const response = await apiClient.post<{ id: string; replayed: boolean }>(`/api/firms/${firmId}/marking/batches`, request);
      setPending(null); remember(''); setCodes(''); setConfirmed(false); store.dispatch(api.util.invalidateTags(['Marking']));
      setNotice(response.data.replayed ? 'Сохранение подтверждено. Повторная партия не создавалась.' : 'Состав партии сохранён и связан с декларацией.'); onSaved(response.data.id);
    } catch (e) {
      setError(requestError(e));
      if (isAxiosError(e) && [400, 401, 403, 404, 413, 422].includes(e.response?.status ?? 0)) { setPending(null); remember(''); }
    } finally { inFlight.current = false; setBusy(false); }
  };
  const checkRecovery = async () => {
    setBusy(true); setError('');
    try { await apiClient.get(`/api/firms/${firmId}/marking/batches/${recovery}`); remember(''); setPending(null); store.dispatch(api.util.invalidateTags(['Marking'])); onSaved(recovery); setNotice('Сохранение партии подтверждено.'); }
    catch (e) { setError(isAxiosError(e) && e.response?.status === 404 ? 'Партия пока не найдена. Повторите проверку позже или очистите попытку перед новым импортом.' : requestError(e)); }
    finally { setBusy(false); }
  };
  return <Section title="Состав партии для отчёта" subtitle="Импорт для ЧЗ. Кодовая строка сохраняется полностью; отправка отчёта выполняется отдельно с подписью.">
    {!!recovery && !pending && <Alert severity="info" sx={{ mb: 2 }}>Осталась незавершённая попытка сохранения. <Button disabled={busy} onClick={() => void checkRecovery()}>Проверить сохранение</Button><Button disabled={busy} onClick={() => { remember(''); setError(''); }}>Очистить попытку</Button></Alert>}
    <form onSubmit={event => { event.preventDefault(); void save(); }}>
      <fieldset className="marking-link-form marking-batch-fields" disabled={locked}>
        <TextField disabled={locked} className="full-width" select label="Декларация партии" value={selectedId} onChange={e => { setGtin(''); setTitle(''); onSelect(e.target.value); }} required><MenuItem value="">Выберите декларацию</MenuItem>{selectedId && !declarations.data?.items.some(row => row.id === selectedId) && <MenuItem value={selectedId}>{selected.currentData?.reference || 'Выбранная декларация'}</MenuItem>}{declarations.data?.items.map(row => <MenuItem key={row.id} value={row.id}>{row.reference} · {row.title}</MenuItem>)}</TextField>
        <TextField disabled={locked} label="Название партии" value={title} onChange={e => setTitle(e.target.value)} required inputProps={{ maxLength: 200 }}/><TextField disabled={locked} label="GTIN партии" value={gtin} onChange={e => setGtin(e.target.value)} required inputProps={{ maxLength: 14 }}/>
        <TextField disabled={locked} label="Номер партии" value={batch} onChange={e => setBatch(e.target.value)} inputProps={{ maxLength: 200 }}/><TextField disabled={locked} label="Внешний заказ партии" value={order} onChange={e => setOrder(e.target.value)} inputProps={{ maxLength: 128 }}/>
        <div className="full-width"><Button variant="outlined" startIcon={<UploadFileOutlined/>} onClick={() => input.current?.click()} disabled={locked}>{reading ? 'Читаем файл…' : 'Загрузить коды из TXT / CSV'}</Button><input ref={input} type="file" disabled={locked} accept=".txt,.csv,text/plain,text/csv" hidden aria-label="Файл с кодами партии" onChange={async event => {
          const file = event.target.files?.[0]; event.target.value = ''; if (!file) return;
          const scope = captureMarkingScope(); setReading(true); setError(''); setNotice('');
          try { if (file.size > 16 * 1024 * 1024) throw new Error('Размер файла не должен превышать 16 МБ.'); const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer()); const values = parseBatchCodes(text); if (!values.length) throw new Error('В файле нет кодов.'); assertMarkingScope(scope); setCodes(values.join('\n')); setNotice(`Загружено кодов: ${values.length}. Проверьте состав перед сохранением.`); }
          catch (e) { setError(requestError(e)); } finally { setReading(false); }
        }}/><Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>UTF-8, один полный код в строке. Допускается CSV с одной колонкой. GS и криптохвост сохраняются.</Typography></div>
        <TextField disabled={locked} className="full-width" label="Полные коды Data Matrix, по одному в строке" multiline minRows={6} value={codes} onChange={e => setCodes(e.target.value)} helperText="Разделитель GS можно указать как <GS> или \u001d." required/>
        <FormControlLabel className="full-width" control={<Checkbox disabled={locked} checked={confirmed} onChange={e => setConfirmed(e.target.checked)}/>} label="Коды нанесены, физический результат и состав партии проверены"/>
      </fieldset>
      {!!pending && !busy && <Alert severity="info" sx={{ mb: 2 }}>Результат сохранения не подтверждён. Повтор проверит сохранение этой партии и не создаст её копию.</Alert>}
      <Button variant="contained" type="submit" disabled={busy || reading || (!pending && (!confirmed || !!recovery))}>{busy ? 'Сохраняем…' : pending ? 'Проверить и повторить сохранение' : 'Сохранить партию и связать с декларацией'}</Button>
    </form>
    {declarations.error && <ErrorState error={declarations.error} retry={declarations.refetch}/>}{error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}{notice && <Alert severity="success" sx={{ mt: 2 }}>{notice}</Alert>}
  </Section>;
}

function BatchDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const { firmId, canEdit } = useWorkspace(); const metadata = api.useMarkingBatchQuery({ firmId, id });
  const [page, setPage] = useState(1); const [result, setResult] = useState<Page<MarkingBatchCode> | null>(null); const [error, setError] = useState(''); const [loading, setLoading] = useState(false); const [downloading, setDownloading] = useState(false); const [reload, setReload] = useState(0);
  useEffect(() => {
    if (!canEdit) return; const controller = new AbortController(); setLoading(true); setResult(null); setError('');
    void apiClient.get<Page<MarkingBatchCode>>(`/api/firms/${firmId}/marking/batches/${id}/codes`, { params: { page, pageSize: 50 }, signal: controller.signal })
      .then(response => { if (!controller.signal.aborted) setResult(response.data); }).catch(e => { if (!controller.signal.aborted) setError(requestError(e)); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [canEdit, firmId, id, page, reload]);
  return <Dialog open onClose={onClose} fullWidth maxWidth="lg" aria-labelledby="batch-dialog-title"><DialogTitle id="batch-dialog-title">{metadata.data?.title || 'Сохранённая партия'}</DialogTitle><DialogContent dividers>
    {metadata.isLoading ? <Loading/> : metadata.error ? <ErrorState error={metadata.error} retry={metadata.refetch}/> : metadata.data && <>
      <Stack direction="row" gap={1} flexWrap="wrap" sx={{ mb: 2 }}><Chip label={`${metadata.data.codes} кодов`} size="small"/><Chip label={`${metadata.data.boxes} коробов · ${metadata.data.pallets} палет`} size="small" variant="outlined"/><Chip label={metadata.data.compositionConfirmed ? 'Состав подтверждён оператором' : 'Состав не подтверждён'} size="small" variant="outlined"/></Stack>
      {metadata.data.declarations.map(link => <div key={link.id} className="marking-batch-declaration"><Button component={RouterLink} to={`/declarations/${link.declarationId}`} onClick={onClose}>{link.declarationReference}</Button><Typography variant="body2">GTIN {link.gtin}{link.batchNumber && ` · Партия ${link.batchNumber}`}{link.externalOrderId && ` · Заказ ${link.externalOrderId}`} · {link.provider} / {link.environment}</Typography></div>)}
      <Alert severity="info" sx={{ my: 2 }}>Здесь показан сохранённый состав. Статус нанесения и результат обработки отчёта проверяются отдельно в ЧЗ.</Alert>
      {!canEdit ? <Typography color="text.secondary">Просмотр полных кодов и скачивание доступны специалисту или администратору компании.</Typography> : loading ? <Loading/> : error ? <Alert severity="error" action={<Button onClick={() => setReload(n => n + 1)}>Повторить</Button>}>{error}</Alert> : result && <>
        <TableContainer><Table size="small" aria-label="Состав кодов партии"><TableHead><TableRow><TableCell>№</TableCell><TableCell>Полный код</TableCell><TableCell>Короб / палета</TableCell></TableRow></TableHead><TableBody>{result.items.map(row => <TableRow key={row.sequenceNumber}><TableCell>{row.sequenceNumber}</TableCell><TableCell><code className="marking-full-code">{formatDataMatrixCodeForDisplay(row.code)}</code></TableCell><TableCell>{row.boxSscc || '—'}{row.palletSscc && <><br/>{row.palletSscc}</>}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
        <Pagination aria-label="Страницы кодов партии" sx={{ mt: 2 }} page={page} count={Math.max(1, Math.ceil(result.total / 50))} onChange={(_, n) => setPage(n)}/>
      </>}
    </>}
  </DialogContent><DialogActions>{canEdit && metadata.data && <Button startIcon={<FileDownloadOutlined/>} disabled={downloading} onClick={async () => { setDownloading(true); try { const response = await apiClient.get(`/api/firms/${firmId}/marking/batches/${id}/download`, { responseType: 'blob' }); downloadInBrowser(response.data, `marking-${id}.txt`); } catch (e) { setError(requestError(e)); } finally { setDownloading(false); } }}>{downloading ? 'Скачиваем…' : 'Скачать полные коды TXT'}</Button>}<Button onClick={onClose}>Закрыть</Button></DialogActions></Dialog>;
}
