import { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, Tab, Tabs, TextField } from '@mui/material';
import { AutoAwesomeOutlined, FileDownloadOutlined } from '@mui/icons-material';
import { api, documentBlob, download } from './store';
import { useNotify, useWorkspace } from './common';
import { errorMessage, type Declaration, type SaveDeclaration } from './types';
import { emptyWorkspace } from './workspaceTypes';

type PrintField = { key: string; label: string; text: string };
type Preview = { url: string; document: Declaration; fields: PrintField[]; renderedRevision: number };
export function DeclarationGeneration({ document, onSaved }: { document?: Declaration; onSaved: (document: Declaration) => void }) {
  const form = useFormContext<SaveDeclaration>(); const { firmId, canEdit } = useWorkspace(); const notify = useNotify();
  const [save] = api.useSaveDeclarationMutation(); const [loadFields] = api.useLazyPrintFieldsQuery();
  const [busy, setBusy] = useState(false); const running = useRef(false);
  const [preview, setPreview] = useState<Preview | null>(null); const [fields, setFields] = useState<PrintField[]>([]);
  const [failure, setFailure] = useState(''); const [view, setView] = useState('edit'); const [resetOverrides, setResetOverrides] = useState(false);
  const scope = useRef(firmId); scope.current = firmId; const active = useRef(true);
  const editable = canEdit && (!document || document.status === 'Draft' || document.status === 'InReview');
  const changed = !!preview && (resetOverrides || fields.some((field, index) => field.text !== preview.fields[index]?.text));
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setPreview(null); setFailure(''); setFields([]); }, [firmId]);
  const previewUrl = preview?.url;
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  useEffect(() => { const leave = (event: BeforeUnloadEvent) => { if (changed) event.preventDefault(); }; window.addEventListener('beforeunload', leave); return () => window.removeEventListener('beforeunload', leave); }, [changed]);
  async function build(saved: Declaration): Promise<Preview> {
    const [blob, nextFields] = await Promise.all([
      documentBlob(`/firms/${firmId}/declarations/${saved.id}/export/pdf?revision=${saved.revision}`),
      loadFields({ firmId, id: saved.id, revision: saved.revision }, false).unwrap(),
    ]);
    return { url: URL.createObjectURL(blob), document: saved, fields: nextFields, renderedRevision: saved.revision };
  }
  async function generate() {
    if (running.current) return;
    await form.handleSubmit(async values => {
      running.current = true; setBusy(true); setFailure(''); const requestedFirm = firmId;
      try {
        let saved = document;
        if (!saved || form.formState.isDirty) { saved = await save({ firmId, id: saved?.id, data: values }).unwrap(); if (!active.current || scope.current !== requestedFirm) return; onSaved(saved); }
        const result = await build(saved);
        if (active.current && scope.current === requestedFirm) { setPreview(result); setFields(result.fields); setResetOverrides(false); setView(editable ? 'edit' : 'preview'); }
        else URL.revokeObjectURL(result.url);
      } catch (error) { if (active.current && scope.current === requestedFirm) { setFailure(errorMessage(error)); notify(errorMessage(error), 'error'); } }
      finally { running.current = false; if (active.current) setBusy(false); }
    }, () => notify('Заполните обязательные поля в разделе «Основные».', 'error'))();
  }
  async function apply(): Promise<Preview> {
    if (!preview) throw new Error('Сначала сформируйте декларацию.');
    if (!changed) {
      if (preview.renderedRevision === preview.document.revision) return preview;
      const rebuilt = await build(preview.document); setPreview(rebuilt); setFields(rebuilt.fields); return rebuilt;
    }
    const overrides: Record<string, string> = resetOverrides ? {} : { ...preview.document.workspace?.printOverrides };
    if (!resetOverrides) for (let index = 0; index < fields.length; index++) if (fields[index].text !== preview.fields[index]?.text) overrides[fields[index].key] = fields[index].text;
    const data = { ...form.getValues(), revision: preview.document.revision, workspace: { ...(form.getValues().workspace ?? emptyWorkspace()), printOverrides: overrides } };
    const saved = await save({ firmId, id: preview.document.id, data }).unwrap();
    if (!active.current || scope.current !== firmId) throw new Error('Рабочая компания изменилась.');
    onSaved(saved);
    // Retain the saved revision even if rebuilding fails, so retries use concurrency protection.
    setPreview({ ...preview, document: saved, fields }); setResetOverrides(false);
    const result = await build(saved);
    if (!active.current || scope.current !== firmId) { URL.revokeObjectURL(result.url); throw new Error('Рабочая компания изменилась.'); }
    setPreview(result); setFields(result.fields); return result;
  }
  async function output(format?: 'docx' | 'pdf') {
    if (running.current) return; running.current = true; setBusy(true); setFailure('');
    try { const result = await apply(); if (format) await download(`/firms/${firmId}/declarations/${result.document.id}/export/${format}?revision=${result.document.revision}`, `${result.document.reference}.${format}`); else { setView('preview'); notify('Макет обновлён'); } }
    catch (error) { setFailure(errorMessage(error)); } finally { running.current = false; if (active.current) setBusy(false); }
  }
  function close() { if (!busy && (!changed || window.confirm('Ручные правки не сохранены. Закрыть редактор?'))) setPreview(null); }
  return <>
    <Button variant="contained" className="generate-declaration-button" startIcon={<AutoAwesomeOutlined/>} disabled={busy || (!document && !canEdit) || (form.formState.isDirty && !canEdit)} onClick={() => void generate()}>{busy ? 'Формируем документ…' : 'Сформировать декларацию'}</Button>
    <Dialog open={!!preview} onClose={close} maxWidth="lg" fullWidth className="declaration-preview-dialog" aria-labelledby="declaration-preview-title">
      <DialogTitle id="declaration-preview-title">Декларация о соответствии<span className="declaration-preview-caption">{preview?.document.reference} · версия {preview?.document.revision}{changed ? ' · есть ручные правки' : ''}</span></DialogTitle>
      <DialogContent>
        <Alert severity="info" sx={{ mb: 2 }}>Проверьте текст и приложения. При скачивании текущие правки сохранятся в макете. Отправка во ФГИС и подписание не выполнялись.</Alert>
        {failure && <Alert severity="error" sx={{ mb: 2 }}>{failure}</Alert>}
        <Tabs value={view} onChange={(_, value) => setView(value)} aria-label="Режим макета" sx={{ mb: 2 }}><Tab value="edit" label="Редактирование"/><Tab value="preview" label="Предпросмотр PDF"/></Tabs>
        {view === 'edit' ? <Stack spacing={2.5}>
          <Alert severity={editable ? 'info' : 'warning'}>{editable ? 'Изменяется печатный текст. Исходные реквизиты в разделах карточки сохраняются отдельно. После изменения исходных данных проверьте ручные правки или сбросьте их.' : 'Для изменения макета верните декларацию в черновик; нужны права специалиста или администратора.'}</Alert>
          {fields.map((field, index) => <TextField key={field.key} label={field.label} value={field.text} multiline minRows={2} fullWidth disabled={busy || !editable || resetOverrides} inputProps={{ maxLength: 20000 }} onChange={event => setFields(previous => previous.map((item, i) => i === index ? { ...item, text: event.target.value } : item))}/>)}
          {editable && <Button disabled={busy || resetOverrides || !Object.keys(preview?.document.workspace?.printOverrides ?? {}).length} onClick={() => setResetOverrides(true)}>Сбросить ручные правки</Button>}
          {resetOverrides && <Alert severity="warning">При обновлении или скачивании макет будет заново заполнен данными карточки.</Alert>}
        </Stack> : <>{changed && <Alert severity="warning" sx={{ mb: 2 }}>Есть изменения. Нажмите «Обновить предпросмотр», чтобы увидеть текущий текст.</Alert>}{preview && <iframe className="declaration-pdf-preview" title="Предпросмотр декларации" src={preview.url}/>}</>}
      </DialogContent>
      <DialogActions><Button disabled={busy} onClick={close}>Закрыть</Button>{editable && <Button disabled={busy} onClick={() => void output()}>Обновить предпросмотр</Button>}<Button disabled={busy} startIcon={<FileDownloadOutlined/>} onClick={() => void output('pdf')}>Скачать PDF</Button><Button variant="contained" disabled={busy} startIcon={<FileDownloadOutlined/>} onClick={() => void output('docx')}>Скачать Word</Button></DialogActions>
    </Dialog>
  </>;
}
