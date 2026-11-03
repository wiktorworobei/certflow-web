import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Grid, LinearProgress, Link, MenuItem, Pagination, Stack, TextField, Typography } from '@mui/material';
import { AddRounded, CloudDownloadOutlined, DeleteOutlineRounded, EditOutlined, OpenInNewRounded, RefreshRounded } from '@mui/icons-material';
import { EmptyState, ErrorState, Loading, useNotify, useWorkspace } from './common';
import { dateTime, errorMessage } from './types';
import { normativeApi, normativeKinds, type NormativeDocument, type NormativeInput, type NormativeKind, type NormativeSourceSearch } from './normativeApi';

export function NormativeDirectory() {
  const { firmId, canEdit } = useWorkspace(); const notify = useNotify();
  const [kind, setKind] = useState(''); const [query, setQuery] = useState(''); const [search, setSearch] = useState(''); const [page, setPage] = useState(1);
  const [editor, setEditor] = useState<(NormativeInput & { id?: string; original?: NormativeDocument }) | null>(null);
  const [remove, setRemove] = useState<NormativeDocument | null>(null); const [sourceOpen, setSourceOpen] = useState(false); const [error, setError] = useState('');
  const [save, saving] = normativeApi.useSaveNormativeMutation(); const [refresh, refreshing] = normativeApi.useRefreshNormativeMutation(); const [destroy, deleting] = normativeApi.useDeleteNormativeMutation();
  const scope = useRef(firmId); useEffect(() => { scope.current = firmId; return () => { scope.current = ''; }; }, [firmId]);
  useEffect(() => { const timer = setTimeout(() => { setSearch(query.trim()); setPage(1); }, 250); return () => clearTimeout(timer); }, [query]);
  const result = normativeApi.useNormativeSearchQuery({ firmId, kind, query: search, page, pageSize: 25 });
  const data = result.currentData; const busy = saving.isLoading || refreshing.isLoading || deleting.isLoading;
  const edit = (row: NormativeDocument) => { setError(''); setEditor({ ...row, original: row }); };
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!editor || !canEdit) return; setError('');
    const { id, original: _, ...input } = editor;
    try { await save({ firmId, id, data: input }).unwrap(); if (scope.current === firmId) { setEditor(null); notify('Документ сохранён в справочнике'); } }
    catch (e) { if (scope.current === firmId) setError(errorMessage(e)); }
  }
  async function update(row: NormativeDocument) {
    try { const updated = await refresh({ firmId, id: row.id, revision: row.revision }).unwrap(); if (scope.current === firmId) notify(updated.isManuallyEdited ? 'Сведения источника обновлены. Ручные правки сохранены.' : 'Сведения Росстандарта обновлены'); }
    catch (e) { if (scope.current === firmId) notify(errorMessage(e), 'error'); }
  }
  const change = (key: keyof NormativeInput, value: string) => setEditor(current => current ? { ...current, [key]: value } : null);
  return <Box sx={{ p: { xs: 2, md: 3 } }}>
    <Stack direction={{ xs: 'column', md: 'row' }} gap={2} justifyContent="space-between" sx={{ mb: 2.5 }}>
      <Box><Typography component="h2" variant="h6">ГОСТы и технические регламенты</Typography><Typography color="text.secondary" variant="body2">Сохраняйте нужные документы и выбирайте их при подготовке деклараций.</Typography></Box>
      {canEdit && <Stack direction="row" gap={1} flexWrap="wrap"><Button startIcon={<AddRounded/>} onClick={() => { setError(''); setEditor({ kind: 'Standard', designation: '', name: '', status: 'Не проверен', notes: '', sourceUrl: '' }); }}>Добавить вручную</Button><Button variant="contained" startIcon={<CloudDownloadOutlined/>} onClick={() => setSourceOpen(true)}>Загрузить из Росстандарта</Button></Stack>}
    </Stack>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) 280px' }, gap: 2, mb: 2 }}>
      <TextField fullWidth label="Поиск ГОСТа или техрегламента" value={query} onChange={e => setQuery(e.target.value)} inputProps={{ maxLength: 200 }} sx={{ minWidth: 0 }}/>
      <TextField fullWidth select label="Тип документа" value={kind} onChange={e => { setKind(e.target.value); setPage(1); }} sx={{ minWidth: 0 }}><MenuItem value="">Все документы</MenuItem>{Object.entries(normativeKinds).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField>
    </Box>
    <Box sx={{ minHeight: 3 }}>{result.isFetching && <LinearProgress aria-label="Поиск нормативных документов"/>}</Box>
    {result.error ? <ErrorState error={result.error} retry={() => void result.refetch()}/> : !data ? <Loading/> : data.items.length === 0 ? <EmptyState title="Документы не найдены" text="Добавьте запись вручную или найдите документ в каталоге Росстандарта."/> : <Stack divider={<Box sx={{ borderBottom: '1px solid', borderColor: 'divider' }}/>}>{data.items.map(row => <Box key={row.id} sx={{ py: 2.5, minWidth: 0 }}>
      <Stack direction="row" flexWrap="wrap" alignItems="center" gap={1} sx={{ mb: 1 }}><Typography fontWeight={700}>{row.designation}</Typography><Chip size="small" variant="outlined" label={row.status}/><Chip size="small" variant="outlined" label={normativeKinds[row.kind]}/>{row.isManuallyEdited && <Chip size="small" color="warning" variant="outlined" label="Ручные сведения"/>}</Stack>
      <Typography sx={{ overflowWrap: 'anywhere' }}>{row.name}</Typography>
      {row.notes && <Typography color="text.secondary" variant="body2" sx={{ mt: 1, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{row.notes}</Typography>}
      <Typography color="text.secondary" variant="caption" component="p" sx={{ mt: 1 }}>{row.sourceKey ? `${row.sourceProvider} · получено ${dateTime(row.sourceCheckedAt ?? "")}` : 'Добавлено вручную · статус указан пользователем'}</Typography>
      {row.sourceKey && row.isManuallyEdited && <Typography color="text.secondary" variant="body2">Статус в источнике: {row.sourceStatus}. При обновлении ручные реквизиты сохраняются.</Typography>}
      <Stack direction="row" flexWrap="wrap" gap={1} sx={{ mt: 1 }}>
        {row.sourceUrl && <Button size="small" component="a" href={row.sourceUrl} target="_blank" rel="noreferrer" endIcon={<OpenInNewRounded/>}>Открыть источник</Button>}
        {canEdit && <><Button size="small" startIcon={<EditOutlined/>} disabled={busy} onClick={() => edit(row)}>Изменить</Button>{row.sourceKey && <Button size="small" startIcon={<RefreshRounded/>} disabled={busy} onClick={() => void update(row)}>Обновить сведения</Button>}<Button size="small" color="error" startIcon={<DeleteOutlineRounded/>} disabled={busy} onClick={() => { setError(''); setRemove(row); }}>Удалить</Button></>}
      </Stack>
    </Box>)}</Stack>}
    {!!data && data.total > 25 && <Pagination aria-label="Страницы нормативных документов" count={Math.ceil(data.total / 25)} page={page} onChange={(_, next) => setPage(next)} sx={{ mt: 2 }} size="small" siblingCount={0}/>}
    <Typography color="text.secondary" variant="body2" sx={{ mt: 3 }}>Статус относится к моменту получения. Применимость документа проверяет специалист. <Link component={RouterLink} to="/development-plan?module=standards">Источники и подключение API ГОСТов</Link></Typography>
    {sourceOpen && <NormativeSourceDialog key={firmId} firmId={firmId} onClose={() => setSourceOpen(false)}/>}
    <Dialog open={!!editor} onClose={() => !busy && setEditor(null)} fullWidth maxWidth="md" aria-labelledby="normative-editor-title"><form onSubmit={submit}>
      <DialogTitle id="normative-editor-title">{editor?.id ? 'Редактирование нормативного документа' : 'Новый нормативный документ'}</DialogTitle>
      <DialogContent sx={{ pt: '12px !important' }}>{error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}{editor && <>
        {editor.original?.sourceKey && <Alert severity="info" sx={{ mb: 2 }}>Правки сохраняются отдельно от сведений Росстандарта. Обновление источника не перезапишет ваши реквизиты.</Alert>}
        <Grid container spacing={2}><Grid item xs={12} sm={5}><TextField select fullWidth label="Тип документа" value={editor.kind} disabled={!!editor.original?.sourceKey} onChange={e => change('kind', e.target.value)}>{Object.entries(normativeKinds).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField></Grid>
          <Grid item xs={12} sm={7}><TextField required fullWidth label="Обозначение" value={editor.designation} onChange={e => change('designation', e.target.value)} inputProps={{ maxLength: 300 }}/></Grid>
          <Grid item xs={12}><TextField required fullWidth multiline label="Наименование нормативного документа" value={editor.name} onChange={e => change('name', e.target.value)} inputProps={{ maxLength: 5000 }}/></Grid>
          <Grid item xs={12} sm={5}><TextField required fullWidth label="Статус документа" value={editor.status} onChange={e => change('status', e.target.value)} inputProps={{ maxLength: 200 }}/></Grid>
          <Grid item xs={12} sm={7}><TextField fullWidth label="Ссылка на источник" value={editor.sourceUrl} disabled={!!editor.original?.sourceKey} onChange={e => change('sourceUrl', e.target.value)} helperText="HTTPS-ссылка, если есть" inputProps={{ maxLength: 2048 }}/></Grid>
          <Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Примечание" value={editor.notes} onChange={e => change('notes', e.target.value)} inputProps={{ maxLength: 10000 }}/></Grid>
        </Grid>
        {editor.original?.sourceKey && <Box sx={{ mt: 3, p: 2, bgcolor: 'action.hover', borderRadius: 2 }}><Typography fontWeight={700}>Последние сведения источника</Typography><Typography>{editor.original.sourceDesignation} · {editor.original.sourceStatus}</Typography><Typography variant="body2">{editor.original.sourceName}</Typography><Typography variant="caption" color="text.secondary">{dateTime(editor.original.sourceCheckedAt ?? "")}</Typography></Box>}
      </>}</DialogContent><DialogActions sx={{ p: 2.5 }}><Button disabled={busy} onClick={() => setEditor(null)}>Отмена</Button><Button variant="contained" type="submit" disabled={busy}>{saving.isLoading ? 'Сохраняем…' : 'Сохранить документ'}</Button></DialogActions>
    </form></Dialog>
    <Dialog open={!!remove} onClose={() => !busy && setRemove(null)} fullWidth maxWidth="sm" aria-labelledby="normative-remove-title"><DialogTitle id="normative-remove-title">Удалить документ из справочника?</DialogTitle><DialogContent><Typography>{remove?.designation}. Сведения в ранее сохранённых декларациях сохранятся.</Typography>{error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}</DialogContent><DialogActions><Button disabled={busy} onClick={() => setRemove(null)}>Отмена</Button><Button disabled={busy} color="error" onClick={async () => { if (!remove) return; try { await destroy({ firmId, id: remove.id, revision: remove.revision }).unwrap(); if (scope.current === firmId) setRemove(null); } catch (e) { if (scope.current === firmId) setError(errorMessage(e)); } }}>Удалить</Button></DialogActions></Dialog>
  </Box>;
}

function NormativeSourceDialog({ firmId, onClose }: { firmId: string; onClose: () => void }) {
  const [kind, setKind] = useState<NormativeKind>('Standard'); const [query, setQuery] = useState('');
  const [request, setRequest] = useState<NormativeSourceSearch | null>(null); const [error, setError] = useState(''); const [success, setSuccess] = useState('');
  const result = normativeApi.useNormativeSourceQuery(request!, { skip: !request }); const data = result.currentData;
  const [importRows, importing] = normativeApi.useImportNormativeMutation(); const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  async function load(keys: string[]) {
    if (!request) return; setError(''); setSuccess('');
    try { const saved = await importRows({ ...request, sourceKeys: keys }).unwrap(); if (alive.current) setSuccess(`Добавлено: ${saved.added}. Уже в справочнике: ${saved.existing}.`); }
    catch (e) { if (alive.current) setError(errorMessage(e)); }
  }
  const busy = result.isFetching || importing.isLoading;
  return <Dialog open onClose={() => !importing.isLoading && onClose()} maxWidth="md" fullWidth aria-labelledby="normative-source-title"><DialogTitle id="normative-source-title">Загрузка из каталога Росстандарта</DialogTitle><DialogContent sx={{ pt: '12px !important' }}>
    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Поиск реквизитов на protect.gost.ru. Сохраните нужные записи в справочник своей компании.</Typography>
    <Box component="form" onSubmit={e => { e.preventDefault(); setError(''); setSuccess(''); if (request?.kind === kind && request.query === query.trim() && request.page === 1) void result.refetch(); else setRequest({ firmId, kind, query: query.trim(), page: 1 }); }} sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'minmax(0, 1fr) minmax(0, 1.4fr)' }, gap: 2, mb: 2 }}>
      <TextField fullWidth select label="Искать в каталоге" value={kind} onChange={e => setKind(e.target.value as NormativeKind)} disabled={busy} sx={{ minWidth: 0 }}>{Object.entries(normativeKinds).map(([k, v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField>
      <TextField fullWidth label="Обозначение или название" value={query} onChange={e => setQuery(e.target.value)} disabled={busy} inputProps={{ maxLength: 200 }} sx={{ minWidth: 0 }}/><Button type="submit" variant="contained" disabled={busy} sx={{ justifySelf: 'start' }}>Найти в Росстандарте</Button>
    </Box>
    {busy && <LinearProgress aria-label="Загрузка каталога Росстандарта"/>}
    {(result.error || error) && <Alert severity="error" sx={{ mt: 2 }}>{error || errorMessage(result.error)}</Alert>}
    {success && <Alert severity="success" sx={{ mt: 2 }}>{success}</Alert>}
    {data && !result.isFetching && !result.error && <><Typography variant="body2" color="text.secondary" sx={{ my: 2 }}>Найдено: {data.total.toLocaleString('ru-RU')} · {dateTime(data.checkedAt)} · страница {data.page}</Typography>
      {data.items.length === 0 ? <EmptyState title="В источнике ничего не найдено" text="Уточните обозначение или часть названия."/> : <Stack spacing={1.5}>{data.items.map(row => <Box key={row.sourceKey} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}><Stack direction="row" flexWrap="wrap" gap={1} alignItems="center"><Typography fontWeight={700}>{row.designation}</Typography><Chip size="small" variant="outlined" label={row.status}/></Stack><Typography variant="body2" sx={{ my: 1, overflowWrap: 'anywhere' }}>{row.name}</Typography><Stack direction="row" flexWrap="wrap" gap={1}><Button size="small" disabled={busy} onClick={() => void load([row.sourceKey])}>Сохранить в справочник</Button><Button size="small" component="a" href={row.sourceUrl} target="_blank" rel="noreferrer" endIcon={<OpenInNewRounded/>}>Источник</Button></Stack></Box>)}</Stack>}
      {data.total > data.pageSize && <Pagination aria-label="Страницы каталога Росстандарта" page={data.page} count={Math.ceil(data.total / data.pageSize)} siblingCount={0} size="small" disabled={busy} onChange={(_, page) => request && setRequest({ ...request, page })} sx={{ mt: 2 }}/>}</>}
  </DialogContent><DialogActions sx={{ p: 2.5, flexWrap: 'wrap', gap: 1 }}><Button disabled={importing.isLoading} onClick={onClose}>Закрыть</Button><Button disabled={busy || !data?.items.length || !!result.error} variant="contained" startIcon={<CloudDownloadOutlined/>} onClick={() => data && void load(data.items.map(x => x.sourceKey))}>Сохранить всю страницу</Button></DialogActions></Dialog>;
}
