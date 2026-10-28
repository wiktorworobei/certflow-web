import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { ArchiveOutlined, DeleteForeverOutlined } from '@mui/icons-material';
import { api } from './store';
import { useNotify, useWorkspace } from './common';
import { errorMessage } from './types';

export interface ArchiveSelection { id: string; revision: number | string; title: string }

export function ArchiveSelectionDialog({ entity, items, purge = false, onClose, onComplete }: {
  entity: 'declarations' | 'organizations'; items: ArchiveSelection[]; purge?: boolean; onClose: () => void; onComplete: () => void;
}) {
  const { firmId, canEdit } = useWorkspace(); const notify = useNotify();
  const [archiveDocs, docsState] = api.useArchiveDeclarationsMutation();
  const [archiveOrgs, orgsState] = api.useArchiveOrganizationsMutation();
  const [reason, setReason] = useState(''); const [confirmation, setConfirmation] = useState(''); const [error, setError] = useState('');
  const busy = docsState.isLoading || orgsState.isLoading;
  async function submit() {
    if (!canEdit || busy || !items.length || (purge && confirmation !== 'УДАЛИТЬ')) return;
    setError('');
    try {
      const result = entity === 'declarations'
        ? await archiveDocs({ firmId, purge, reason, items: items.map(x => ({ id: x.id, revision: Number(x.revision) })) }).unwrap()
        : await archiveOrgs({ firmId, purge, reason, items: items.map(x => ({ id: x.id, revision: String(x.revision) })) }).unwrap();
      onComplete(); onClose();
      notify(`${purge ? 'Безвозвратно удалено' : 'Отправлено в архив'}: ${result.count}.${result.pendingFiles ? ` Файлов ожидает очистки: ${result.pendingFiles}. Сервер повторит удаление автоматически.` : ''}`);
    } catch (e) { setError(errorMessage(e)); }
  }
  return <Dialog open onClose={() => !busy && onClose()} aria-labelledby="archive-selection-title" maxWidth="sm" fullWidth>
    <DialogTitle id="archive-selection-title">{purge ? 'Удалить из архива навсегда?' : 'Архивировать выбранные записи?'}</DialogTitle>
    <DialogContent>
      <Typography sx={{ mb: 1 }}>Выбрано {entity === 'declarations' ? 'деклараций' : 'компаний'}: <strong>{items.length}</strong></Typography>
      <ul style={{ maxHeight: 180, overflow: 'auto', paddingLeft: 22 }}>{items.map(x => <li key={x.id}>{x.title}</li>)}</ul>
      {purge ? <>
        <Alert severity="warning" sx={{ mb: 2 }}>{entity === 'declarations' ? 'Карточки, вложенные файлы и история будут удалены без возможности восстановления.' : 'Карточки компаний будут удалены без возможности восстановления. Сохранённые реквизиты в декларациях останутся.'}</Alert>
        <TextField label="Для подтверждения введите УДАЛИТЬ" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} autoComplete="off"/>
      </> : <>
        <Typography sx={{ mb: 2 }}>{entity === 'declarations' ? 'Документы исчезнут из рабочего списка. Данные, файлы и история сохранятся во вкладке «Архив».' : 'Компании перейдут во вкладку «Архив компаний», исчезнут из подстановки и перестанут обновляться из DaData. Реквизиты в декларациях сохранятся.'}</Typography>
        <TextField label="Комментарий к архивированию" value={reason} onChange={e => setReason(e.target.value)} disabled={busy} multiline minRows={2} inputProps={{ maxLength: 2000 }}/>
      </>}
      {items.length > 1000 && <Alert severity="error" sx={{ mt: 2 }}>За один раз можно обработать до 1000 записей. Уточните поиск.</Alert>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </DialogContent>
    <DialogActions sx={{ p: 2.5 }}><Button disabled={busy} onClick={onClose}>Отмена</Button><Button variant="contained" color={purge ? 'error' : 'primary'} startIcon={purge ? <DeleteForeverOutlined/> : <ArchiveOutlined/>} disabled={busy || !canEdit || !items.length || items.length > 1000 || (purge && confirmation !== 'УДАЛИТЬ')} onClick={() => void submit()}>{busy ? 'Выполняем…' : purge ? 'Удалить навсегда' : 'Отправить в архив'}</Button></DialogActions>
  </Dialog>;
}
