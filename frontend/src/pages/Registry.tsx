import { useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Button, Checkbox, Chip, FormControlLabel, IconButton, InputAdornment, LinearProgress, Menu, MenuItem, Paper, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Tooltip, Typography } from '@mui/material';
import { AddRounded } from '@mui/icons-material';
import { SearchRounded } from '@mui/icons-material';
import { FileDownloadOutlined } from '@mui/icons-material';
import { MoreHorizRounded } from '@mui/icons-material';
import { DescriptionOutlined } from '@mui/icons-material';
import { ContentCopyOutlined } from '@mui/icons-material';
import { PictureAsPdfOutlined } from '@mui/icons-material';
import { ArrowForwardRounded } from '@mui/icons-material';
import { ArchiveOutlined } from '@mui/icons-material';
import { ArchiveDeclarationDialog } from '../ArchiveDeclarationDialog';
import { DeleteForeverOutlined } from '@mui/icons-material';
import { ArchiveSelectionDialog, type ArchiveSelection } from '../ArchiveSelectionDialog';
import { api, download } from '../store';
import { EmptyState, ErrorState, Loading, PageTitle, StatusChip, useNotify, useWorkspace } from '../common';
import { date, dateTime, errorMessage, statusLabels, type DeclarationRow, type Status } from '../types';

export function DocumentTable({ rows, compact = false, archived = false }: { rows: DeclarationRow[]; compact?: boolean; archived?: boolean }) {
  const navigate = useNavigate(); const { firmId, canEdit } = useWorkspace(); const notify = useNotify();
  const [copy, { isLoading: copying }] = api.useCopyDeclarationMutation();
  const [menu, setMenu] = useState<{ element: HTMLElement; row: DeclarationRow } | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<DeclarationRow | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [batch, setBatch] = useState<{ items: ArchiveSelection[]; purge: boolean } | null>(null);
  const selectable = canEdit && !compact;
  const chosen = rows.filter(row => selected.includes(row.id));
  const toggle = (id: string) => setSelected(ids => ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);
  async function copyRow(row: DeclarationRow) { setMenu(null); try { const result = await copy({ firmId, id: row.id }).unwrap(); notify('Создана новая копия документа'); navigate(`/declarations/${result.id}`); } catch (e) { notify(errorMessage(e), 'error'); } }
  async function exportRow(row: DeclarationRow, format: string) { setMenu(null); try { await download(`/firms/${firmId}/declarations/${row.id}/export/${format}`, `${row.reference}.${format}`); } catch (e) { notify(errorMessage(e), 'error'); } }
  if (!rows.length) return <EmptyState title={archived ? 'Архивные декларации не найдены' : 'Документы не найдены'} text={archived ? 'Измените параметры поиска или отправьте декларацию в архив из меню документа.' : 'Создайте декларацию или измените параметры поиска.'}/>;
  return <>{selectable && <div className="document-select-all"><FormControlLabel label="Выбрать все на странице" control={<Checkbox checked={chosen.length === rows.length} indeterminate={chosen.length > 0 && chosen.length < rows.length} onChange={e => setSelected(e.target.checked ? rows.map(x => x.id) : [])}/>}/></div>}{selectable && chosen.length > 0 && <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5, px: 2.5, py: 1.5 }}><Typography>Выбрано: {chosen.length}</Typography><Button startIcon={archived ? <DeleteForeverOutlined/> : <ArchiveOutlined/>} color={archived ? 'error' : 'primary'} onClick={() => setBatch({ items: chosen, purge: archived })}>{archived ? 'Удалить выбранные навсегда' : 'В архив выбранные'}</Button><Button onClick={() => setSelected([])}>Снять выбор</Button></Box>}<TableContainer className="document-table"><Table aria-label="Реестр деклараций"><TableHead><TableRow>{selectable && <TableCell padding="checkbox"><Checkbox inputProps={{ 'aria-label': 'Выбрать все декларации на странице' }} checked={chosen.length === rows.length} indeterminate={chosen.length > 0 && chosen.length < rows.length} onChange={e => setSelected(e.target.checked ? rows.map(x => x.id) : [])}/></TableCell>}<TableCell>ДОКУМЕНТ</TableCell><TableCell>ЗАЯВИТЕЛЬ / ПРОДУКЦИЯ</TableCell><TableCell>СТАТУС</TableCell>{!compact && <TableCell>ДЕЙСТВУЕТ ДО</TableCell>}<TableCell>ОБНОВЛЕНО</TableCell><TableCell width={52}/></TableRow></TableHead><TableBody>{rows.map(row => <TableRow hover selected={selected.includes(row.id)} key={row.id} className="document-row" onClick={() => navigate(`/declarations/${row.id}`)}>
    {selectable && <TableCell className="document-select" padding="checkbox" onClick={e => e.stopPropagation()}><Checkbox checked={selected.includes(row.id)} inputProps={{ 'aria-label': `Выбрать ${row.reference}` }} onChange={() => toggle(row.id)}/></TableCell>}
    <TableCell className="document-main-cell" sx={{ minWidth: 220 }}><div className="document-name"><div className="document-icon"><DescriptionOutlined sx={{ fontSize: 20 }}/></div><div><RouterLink to={`/declarations/${row.id}`} onClick={e => e.stopPropagation()} className="document-title" title={row.title}>{row.title}</RouterLink><div className="document-subtitle">{row.reference}{row.isSample && <span className="sample-dot" title="Учебный пример"/>}</div></div></div></TableCell>
    <TableCell data-label="Заявитель / продукция" sx={{ maxWidth: 270 }}><div className="table-primary" title={row.applicant}>{row.applicant || 'Заявитель не указан'}</div><div className="table-secondary" title={row.product}>{row.product || 'Продукция не указана'}</div></TableCell>
    <TableCell data-label="Статус" sx={{ whiteSpace: 'nowrap' }}><StatusChip status={row.status}/></TableCell>{!compact && <TableCell data-label="Действует до" sx={{ whiteSpace: 'nowrap' }}>{date(row.validUntil)}</TableCell>}<TableCell data-label="Обновлено" sx={{ whiteSpace: 'nowrap', color: 'var(--faint)', fontSize: 12 }}>{dateTime(row.updatedAt)}</TableCell><TableCell className="document-actions-cell"><IconButton aria-label={`Действия ${row.reference}`} size="small" onClick={e => { e.stopPropagation(); setMenu({ element: e.currentTarget, row }); }}><MoreHorizRounded fontSize="small"/></IconButton></TableCell>
  </TableRow>)}</TableBody></Table></TableContainer><Menu anchorEl={menu?.element} open={!!menu} onClose={() => setMenu(null)}>{menu && [
    <MenuItem key="open" onClick={() => { navigate(`/declarations/${menu.row.id}`); setMenu(null); }}><ArrowForwardRounded fontSize="small" sx={{ mr: 1.5 }}/>Открыть документ</MenuItem>,
    ...(canEdit ? [<MenuItem key="copy" disabled={copying} onClick={() => void copyRow(menu.row)}><ContentCopyOutlined fontSize="small" sx={{ mr: 1.5 }}/>Создать копию</MenuItem>] : []),
    <MenuItem key="docx" onClick={() => void exportRow(menu.row, 'docx')}><DescriptionOutlined fontSize="small" sx={{ mr: 1.5 }}/>Скачать Word</MenuItem>,
    <MenuItem key="pdf" onClick={() => void exportRow(menu.row, 'pdf')}><PictureAsPdfOutlined fontSize="small" sx={{ mr: 1.5 }}/>Скачать PDF</MenuItem>,
    ...(canEdit && menu.row.status !== 'Archived' ? [<MenuItem key="archive" onClick={() => { setArchiveTarget(menu.row); setMenu(null); }}><ArchiveOutlined fontSize="small" sx={{ mr: 1.5 }}/>В архив</MenuItem>] : []),
    ...(canEdit && menu.row.status === 'Archived' ? [<MenuItem key="purge" sx={{ color: 'error.main' }} onClick={() => { setBatch({ items: [menu.row], purge: true }); setMenu(null); }}><DeleteForeverOutlined fontSize="small" sx={{ mr: 1.5 }}/>Удалить навсегда</MenuItem>] : []),
  ]}</Menu>{archiveTarget && <ArchiveDeclarationDialog declaration={archiveTarget} onClose={() => setArchiveTarget(null)}/>}{batch && <ArchiveSelectionDialog entity="declarations" items={batch.items} purge={batch.purge} onClose={() => setBatch(null)} onComplete={() => setSelected([])}/>}</>;
}

export function Registry() {
  const { firmId, canEdit } = useWorkspace(); const notify = useNotify(); const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get('search') ?? ''); const [exporting, setExporting] = useState(false);
  const value = params.get('status'); const status = value && value in statusLabels ? value as Status : undefined;
  const page = Math.max(1, Number(params.get('page')) || 1); const pageSize = Math.min(50, Math.max(10, Number(params.get('pageSize')) || 10));
  const filters = { search: params.get('search') || undefined, status, page, pageSize, expiring: params.get('expiring') === 'true' || undefined };
  const { currentData: data, error, isLoading, isFetching, refetch } = api.useDeclarationsQuery({ firmId, filters });
  const { data: dashboard } = api.useDashboardQuery(firmId);
  useEffect(() => { const timer = setTimeout(() => { if ((params.get('search') ?? '') !== search) setParams(p => { search ? p.set('search', search) : p.delete('search'); p.delete('page'); return p; }, { replace: true }); }, 300); return () => clearTimeout(timer); }, [search, params, setParams]);
  useEffect(() => {
    if (!data || isFetching || page <= 1) return;
    const lastPage = Math.max(1, Math.ceil(data.total / pageSize));
    if (page > lastPage) setParams(p => { p.set('page', String(lastPage)); return p; }, { replace: true });
  }, [data, isFetching, page, pageSize, setParams]);
  const change = (key: string, v?: string) => setParams(p => { v ? p.set(key, v) : p.delete(key); if (key !== 'page') p.delete('page'); if (key === 'status' && v === 'Archived') p.delete('expiring'); return p; });
  async function exportCsv() {
    setExporting(true); const query = new URLSearchParams(); if (filters.search) query.set('search', filters.search); if (status) query.set('status', status); if (filters.expiring) query.set('expiring', 'true');
    try { await download(`/firms/${firmId}/declarations/export.csv?${query}`, 'declarations.csv'); notify('Реестр выгружен в CSV'); } catch (e) { notify(errorMessage(e), 'error'); } finally { setExporting(false); }
  }
  return <>
    <PageTitle eyebrow="РАЗРЕШИТЕЛЬНЫЕ ДОКУМЕНТЫ" title="Декларации" subtitle="Создавайте документы, проверяйте сведения и управляйте сроками."><Button variant="outlined" startIcon={<FileDownloadOutlined/>} onClick={() => void exportCsv()} disabled={exporting || !data?.total}>{exporting ? 'Выгружаем…' : 'Экспорт CSV'}</Button>{canEdit && <Button component={RouterLink} to="/declarations/new" variant="contained" startIcon={<AddRounded/>}>Новая декларация</Button>}</PageTitle>
    <div className="registry-summary"><span><strong>{dashboard?.total ?? '—'}</strong> документов в работе</span><i/><span><span className="legend-dot" style={{ background: 'var(--info)' }}/>{dashboard?.inReview ?? 0} на проверке</span><i/><span><span className="legend-dot" style={{ background: 'var(--warning)' }}/>{dashboard?.ready ?? 0} готовы к регистрации</span></div>
    <Paper className="table-card"><div className="registry-filter-tabs">{([['', 'В работе'], ['Draft', 'Черновики'], ['InReview', 'На проверке'], ['Ready', 'Готовы'], ['Registered', 'Зарегистрированы'], ['Archived', 'Архив']] as const).map(([key, label]) => <button key={key} aria-pressed={(status ?? '') === key} className={(status ?? '') === key ? 'filter-tab selected' : 'filter-tab'} onClick={() => change('status', key || undefined)}>{label}{!key && <span>{dashboard?.total ?? 0}</span>}</button>)}</div>
      <div className="registry-toolbar"><TextField placeholder="Найти по названию, заявителю или номеру…" value={search} onChange={e => setSearch(e.target.value)} inputProps={{ 'aria-label': 'Поиск деклараций', maxLength: 200 }} InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded sx={{ fontSize: 20, color: 'var(--faint)' }}/></InputAdornment> }} sx={{ maxWidth: 430 }}/><Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>{filters.expiring && <Chip label="Срок до 30 дней" size="small" onDelete={() => change('expiring')}/>}<TextField select value={status ?? ''} onChange={e => change('status', e.target.value)} SelectProps={{ displayEmpty: true }} inputProps={{ 'aria-label': 'Фильтр по статусу' }} sx={{ minWidth: 190, width: 190 }}><MenuItem value="">Любой статус</MenuItem>{Object.entries(statusLabels).map(([s, label]) => <MenuItem key={s} value={s}>{label}</MenuItem>)}</TextField></Box></div>
      <Box sx={{ height: 2 }}>{isFetching && !isLoading && <LinearProgress sx={{ height: 2 }}/>}</Box>
      {isLoading ? <Loading/> : error ? <Box sx={{ p: 3 }}><ErrorState error={error} retry={refetch}/></Box> : data && <><DocumentTable key={`${firmId}:${params.toString()}`} rows={data.items} archived={status === 'Archived'}/><div className="table-footer"><Typography variant="body2" color="text.secondary" sx={{ pl: 2.5 }}>Найдено: {data.total}</Typography><TablePagination component="div" count={data.total} page={page - 1} rowsPerPage={pageSize} rowsPerPageOptions={[10, 20, 50]} onPageChange={(_, p) => change('page', String(p + 1))} onRowsPerPageChange={e => change('pageSize', e.target.value)} labelRowsPerPage="Строк:" labelDisplayedRows={({ from, to, count }) => `${from}–${to} из ${count}`} getItemAriaLabel={type => type === 'next' ? 'Следующая страница' : 'Предыдущая страница'}/></div></>}
    </Paper><div className="registry-footnote"><DescriptionOutlined sx={{ fontSize: 15 }}/><span>Сведения и статусы документов ведутся специалистами вашей компании.</span><Tooltip title="Экспорт содержит все документы, соответствующие текущим фильтрам"><span className="muted-small">CSV · Word · PDF</span></Tooltip></div>
  </>;
}
