import { useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Alert, Button, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Grid, IconButton, MenuItem, TextField, Typography } from '@mui/material';
import { DeleteOutlineRounded, DescriptionOutlined, FileDownloadOutlined, UploadFileOutlined } from '@mui/icons-material';
import { Section, useNotify, useWorkspace } from './common';
import { api, download } from './store';
import { dateTime, errorMessage, type Declaration, type SaveDeclaration } from './types';
import { declarationTabs, emptyWorkspace, fileKinds, type DeclarationTab, type WorkspaceAttachment } from './workspaceTypes';

export function WorkspaceSectionPanel({ section, title, contentLabel = 'Содержание раздела', readOnly, numbered = false }: { section: DeclarationTab; title: string; contentLabel?: string; readOnly: boolean; numbered?: boolean }) {
  const { control } = useFormContext<SaveDeclaration>();
  return <Section title={title} subtitle="Сведения сохраняются вместе с декларацией и входят в комплект документов."><Grid container spacing={2.5}>
    {numbered && <><Grid item xs={12} sm={6}><Controller control={control} name={`workspace.sections.${section}.number`} render={({ field }) => <TextField {...field} value={field.value ?? ''} label="Номер заявки" disabled={readOnly} inputProps={{ maxLength: 150 }}/>}/></Grid><Grid item xs={12} sm={6}><Controller control={control} name={`workspace.sections.${section}.date`} render={({ field }) => <TextField {...field} value={field.value ?? ''} type="date" label="Дата заявки" InputLabelProps={{ shrink: true }} disabled={readOnly} onChange={e => field.onChange(e.target.value || null)}/>}/></Grid></>}
    <Grid item xs={12}><Controller control={control} name={`workspace.sections.${section}.content`} render={({ field }) => <TextField {...field} value={field.value ?? ''} label={contentLabel} multiline minRows={6} disabled={readOnly} inputProps={{ maxLength: 20000 }}/>}/></Grid>
    <Grid item xs={12}><Controller control={control} name={`workspace.sections.${section}.notes`} render={({ field }) => <TextField {...field} value={field.value ?? ''} label="Заметки к разделу" multiline minRows={2} disabled={readOnly} inputProps={{ maxLength: 10000 }}/>}/></Grid>
  </Grid></Section>;
}

function AttachmentMetadata({ attachmentId, readOnly }: { attachmentId: string; readOnly: boolean }) {
  const { control, getValues, setValue } = useFormContext<SaveDeclaration>();
  const files = useWatch({ control, name: 'workspace.files' }) ?? [];
  const value: WorkspaceAttachment = files.find(f => f.attachmentId === attachmentId) ?? { attachmentId, kind: 'Other', section: 'scans', description: '', includeInFgis: false };
  function change(patch: Partial<WorkspaceAttachment>) {
    const current = getValues('workspace') ?? emptyWorkspace();
    setValue('workspace.files', [...current.files.filter(f => f.attachmentId !== attachmentId), { ...value, ...patch }], { shouldDirty: true });
  }
  return <Grid container spacing={2} sx={{ pt: 1, pb: 2 }}>
    <Grid item xs={12} sm={5}><TextField select label="Тип документа" value={value.kind} disabled={readOnly} onChange={e => change({ kind: e.target.value })}>{fileKinds.map(([key, name]) => <MenuItem key={key} value={key}>{name}</MenuItem>)}</TextField></Grid>
    <Grid item xs={12} sm={7}><TextField select label="Раздел документа" value={value.section} disabled={readOnly} onChange={e => change({ section: e.target.value as DeclarationTab })}>{declarationTabs.map(([key, name]) => <MenuItem key={key} value={key}>{name}</MenuItem>)}</TextField></Grid>
    <Grid item xs={12}><TextField label="Описание файла" value={value.description} disabled={readOnly} inputProps={{ maxLength: 1000 }} onChange={e => change({ description: e.target.value })}/></Grid>
    <Grid item xs={12}><FormControlLabel control={<Checkbox checked={value.includeInFgis} disabled={readOnly} onChange={(_, checked) => change({ includeInFgis: checked })}/>} label="Включить в комплект ФГИС"/></Grid>
  </Grid>;
}

export function FilesPanel({ document, readOnly }: { document?: Declaration; readOnly: boolean }) {
  const { getValues, setValue, formState: { isDirty } } = useFormContext<SaveDeclaration>();
  const { firmId, canEdit } = useWorkspace(); const notify = useNotify();
  const [upload, { isLoading: uploading }] = api.useUploadMutation(); const [remove, { isLoading: removing }] = api.useRemoveAttachmentMutation();
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  async function uploadFile(file?: File) {
    if (!file || !document) return;
    if (file.size > 20 * 1024 * 1024) { notify('Файл должен быть не больше 20 МБ', 'error'); return; }
    try {
      const revision = getValues('revision'); const result = await upload({ firmId, id: document.id, file }).unwrap();
      if (revision === document.revision && result.revision === revision + 1) setValue('revision', result.revision, { shouldDirty: false });
      notify('Файл добавлен. Укажите его тип и при необходимости включите в комплект ФГИС.');
    } catch (e) { notify(errorMessage(e), 'error'); }
  }
  return <><Section title="Документы и сканы" subtitle="PDF, DOCX, PNG, JPEG · до 20 МБ на файл · до 50 файлов. Типы и назначение файлов сохраняются кнопкой «Сохранить».">
    {!document ? <Alert severity="info">Сохраните декларацию, чтобы прикрепить файлы.</Alert> : <>{canEdit && <Button component="label" className="file-dropzone" disabled={uploading || removing} startIcon={<UploadFileOutlined/>}>{uploading ? 'Загружаем файл…' : 'Добавить файл'}<span>Заявки, протоколы, акты, договоры и приложения</span><input type="file" hidden accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={e => { void uploadFile(e.target.files?.[0]); e.target.value = ''; }}/></Button>}
    {document.attachments.map(file => <div className="workspace-file" key={file.id}><div className="attachment-row"><DescriptionOutlined sx={{ color: 'var(--accent-text)' }}/><div><strong>{file.fileName}</strong><span>{Math.max(1, Math.round(file.length / 1024))} КБ · {dateTime(file.createdAt)}</span></div><IconButton aria-label={`Скачать ${file.fileName}`} onClick={async () => { try { await download(`/firms/${firmId}/declarations/${document.id}/attachments/${file.id}`, file.fileName); } catch (e) { notify(errorMessage(e), 'error'); } }}><FileDownloadOutlined fontSize="small"/></IconButton>{canEdit && <IconButton aria-label={`Удалить ${file.fileName}`} disabled={removing || uploading || isDirty} onClick={() => setDeleting({ id: file.id, name: file.fileName })}><DeleteOutlineRounded fontSize="small"/></IconButton>}</div><AttachmentMetadata attachmentId={file.id} readOnly={readOnly}/></div>)}
    {!document.attachments.length && <Typography color="text.secondary" sx={{ mt: 2 }}>Файлы ещё не добавлены.</Typography>}</>}
  </Section><HistoryPanel document={document}/>
  <Dialog open={!!deleting} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth><DialogTitle>Удалить файл?</DialogTitle><DialogContent><Typography>{deleting?.name}</Typography></DialogContent><DialogActions><Button onClick={() => setDeleting(null)}>Отмена</Button><Button color="error" disabled={removing || isDirty} onClick={async () => { if (!document || !deleting) return; try { await remove({ firmId, id: document.id, attachmentId: deleting.id }).unwrap(); setDeleting(null); notify('Файл удалён'); } catch (e) { notify(errorMessage(e), 'error'); } }}>Удалить</Button></DialogActions></Dialog></>;
}

export function HistoryPanel({ document }: { document?: Declaration }) {
  return <Section title="История изменений">{document?.events.length ? <div className="document-history">{document.events.map((event, i) => <div key={`${event.occurredAt}-${i}`}><i/><div><strong>{event.description}</strong><span>{event.actor} · {dateTime(event.occurredAt)}</span></div></div>)}</div> : <Typography color="text.secondary">История появится после первого сохранения.</Typography>}</Section>;
}

export function InventoryPanel({ document, onFiles }: { document?: Declaration; onFiles: () => void }) {
  const { control } = useFormContext<SaveDeclaration>(); const metadata = useWatch({ control, name: 'workspace.files' }) ?? [];
  return <Section title="Опись комплекта" subtitle="Список прикреплённых файлов. Внешний статус документов автоматически не проверялся.">
    {document?.attachments.length ? document.attachments.map((file, index) => {
      const item = metadata.find(f => f.attachmentId === file.id);
      return <div className="workspace-inventory-row" key={file.id}><span>{index + 1}. {file.fileName}</span><Chip size="small" variant="outlined" label={fileKinds.find(([key]) => key === item?.kind)?.[1] ?? 'Другой документ'}/>{item?.includeInFgis && <Chip size="small" color="primary" label="В комплект ФГИС"/>}</div>;
    }) : <Typography color="text.secondary">В комплекте пока нет файлов.</Typography>}
    <Button onClick={onFiles} sx={{ mt: 2 }}>Открыть сканы и вложения</Button>
  </Section>;
}
