import { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle } from '@mui/material';
import { AutoAwesomeOutlined, FileDownloadOutlined } from '@mui/icons-material';
import { api, documentBlob, download } from './store';
import { useNotify, useWorkspace } from './common';
import { errorMessage, type Declaration, type SaveDeclaration } from './types';

export function DeclarationGeneration({ document, onSaved }: { document?: Declaration; onSaved: (document: Declaration) => void }) {
  const form = useFormContext<SaveDeclaration>(); const { firmId, canEdit } = useWorkspace(); const notify = useNotify();
  const [save] = api.useSaveDeclarationMutation();
  const [busy, setBusy] = useState(false); const running = useRef(false);
  const [preview, setPreview] = useState<{ url: string; document: Declaration } | null>(null);
  const [failure, setFailure] = useState(''); const [downloading, setDownloading] = useState(false);
  const scope = useRef(firmId); scope.current = firmId;
  const active = useRef(true);
  useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
  useEffect(() => { setPreview(null); setFailure(''); }, [firmId]);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);
  async function generate() {
    if (running.current) return;
    await form.handleSubmit(async values => {
      running.current = true; setBusy(true); setFailure(''); const requestedFirm = firmId;
      try {
        let saved = document;
        if (!saved || form.formState.isDirty) {
          saved = await save({ firmId, id: saved?.id, data: values }).unwrap();
          if (!active.current || scope.current !== requestedFirm) return;
          onSaved(saved);
        }
        const blob = await documentBlob(`/firms/${firmId}/declarations/${saved.id}/export/pdf?revision=${saved.revision}`);
        if (active.current && scope.current === requestedFirm) setPreview({ url: URL.createObjectURL(blob), document: saved });
      } catch (error) { if (active.current && scope.current === requestedFirm) { setFailure(errorMessage(error)); notify(errorMessage(error), 'error'); } }
      finally { running.current = false; if (active.current) setBusy(false); }
    }, () => notify('Заполните обязательные поля в разделе «Основные».', 'error'))();
  }
  return <>
    <Button variant="contained" className="generate-declaration-button" startIcon={<AutoAwesomeOutlined/>} disabled={busy || (!document && !canEdit) || (form.formState.isDirty && !canEdit)} onClick={() => void generate()}>{busy ? 'Формируем документ…' : 'Сформировать декларацию'}</Button>
    <Dialog open={!!preview} onClose={() => !downloading && setPreview(null)} maxWidth="lg" fullWidth className="declaration-preview-dialog">
      <DialogTitle>Декларация о соответствии<span className="declaration-preview-caption">{preview?.document.reference} · версия {preview?.document.revision}</span></DialogTitle>
      <DialogContent><Alert severity="info" sx={{ mb: 2 }}>Документ сформирован для проверки. Отправка во ФГИС и подписание не выполнялись.</Alert>
        {failure && <Alert severity="error" sx={{ mb: 2 }}>{failure}</Alert>}
        {preview && <iframe className="declaration-pdf-preview" title="Предпросмотр декларации" src={preview.url}/>}
      </DialogContent>
      <DialogActions><Button disabled={downloading} onClick={() => setPreview(null)}>Закрыть</Button><Button component="a" href={preview?.url} download={`${preview?.document.reference}.pdf`} startIcon={<FileDownloadOutlined/>}>Скачать PDF</Button><Button variant="contained" disabled={downloading} startIcon={<FileDownloadOutlined/>} onClick={async () => {
        if (!preview) return; setDownloading(true); setFailure('');
        try { await download(`/firms/${firmId}/declarations/${preview.document.id}/export/docx?revision=${preview.document.revision}`, `${preview.document.reference}.docx`); }
        catch (error) { setFailure(errorMessage(error)); } finally { setDownloading(false); }
      }}>Скачать Word</Button></DialogActions>
    </Dialog>
  </>;
}
