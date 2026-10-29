import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { ArchiveOutlined, DeleteForeverOutlined, UnarchiveOutlined } from '@mui/icons-material';
import { api } from './store';
import { useNotify, useWorkspace } from './common';
import { errorMessage, type ArchiveAction } from './types';

export interface ArchiveSelection { id: string; revision: number | string; title: string }

export function ArchiveSelectionDialog({ entity, items, action = 'archive', onClose, onComplete }: {
  entity: 'declarations' | 'organizations'; items: ArchiveSelection[]; action?: ArchiveAction; onClose: () => void; onComplete: () => void;
}) {
  const purge = action === 'purge'; const restore = action === 'restore';
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
        ? await archiveDocs({ firmId, action, reason, items: items.map(x => ({ id: x.id, revision: Number(x.revision) })) }).unwrap()
        : await archiveOrgs({ firmId, action, reason, items: items.map(x => ({ id: x.id, revision: String(x.revision) })) }).unwrap();
      onComplete(); onClose();
      notify(`${restore ? 'Восстановлено из архива' : purge ? 'Безвозвратно удалено' : 'Отправлено в архив'}: ${result.count}.${result.pendingFiles ? ` Файлов ожидает очистки: ${result.pendingFiles}. Сервер повторит удаление автоматически.` : ''}`);
    } catch (e) { setError(errorMessage(e)); }
  }
  return <Dialog open onClose={() => !busy && onClose()} aria-labelledby="archive-selection-title" maxWidth="sm" fullWidth>
    <DialogTitle id="archive-selection-title">{restore ? 'Восстановить из архива?' : purge ? 'Удалить из архива навсегда?' : 'Архивировать выбранные записи?'}</DialogTitle>
    <DialogContent>
      <Typography sx={{ mb: 1 }}>Выбрано {entity === 'declarations' ? 'деклараций' : 'компаний'}: <strong>{items.length}</strong></Typography>
      <ul style={{ maxHeight: 180, overflow: 'auto', paddingLeft: 22 }}>{items.map(x => <li key={x.id}>{x.title}</li>)}</ul>
      {purge ? <>
        <Alert severity="warning" sx={{ mb: 2 }}>{entity === 'declarations' ? 'Карточки, вложенные файлы и история будут удалены без возможности восстановления.' : 'Карточки компаний будут удалены без возможности восстановления. Сохранённые реквизиты в декларациях останутся.'}</Alert>
        <TextField label="Для подтверждения введите УДАЛИТЬ" value={confirmation} onChange={e => setConfirmation(e.target.value)} disabled={busy} autoComplete="off"/>
      </> : <>
        <Typography sx={{ mb: 2 }}>{restore
          ? entity === 'declarations' ? 'Документы вернутся в рабочий список с прежними статусами. Данные, файлы и история сохранятся. Если прежний статус нельзя определить по истории, документ вернётся в черновики.' : 'Компании вернутся в справочник и станут доступны для подстановки. Автообновление возобновится у компаний, где оно было включено. Сохранённые декларации не изменятся.'
          : entity === 'declarations' ? 'Документы исчезнут из рабочего списка. Данные, файлы и история сохранятся во вкладке «Архив».' : 'Компании перейдут во вкладку «Архив компаний», исчезнут из подстановки и перестанут обновляться из DaData. Реквизиты в декларациях сохранятся.'}</Typography>
        <TextField label={restore ? 'Комментарий к восстановлению' : 'Комментарий к архивированию'} value={reason} onChange={e => setReason(e.target.value)} disabled={busy} multiline minRows={2} inputProps={{ maxLength: 2000 }}/>
      </>}
      {items.length > 1000 && <Alert severity="error" sx={{ mt: 2 }}>За один раз можно обработать до 1000 записей. Уточните поиск.</Alert>}
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </DialogContent>
    <DialogActions sx={{ p: 2.5 }}><Button disabled={busy} onClick={onClose}>Отмена</Button><Button variant="contained" color={purge ? 'error' : 'primary'} startIcon={restore ? <UnarchiveOutlined/> : purge ? <DeleteForeverOutlined/> : <ArchiveOutlined/>} disabled={busy || !canEdit || !items.length || items.length > 1000 || (purge && confirmation !== 'УДАЛИТЬ')} onClick={() => void submit()}>{busy ? 'Выполняем…' : restore ? 'Восстановить' : purge ? 'Удалить навсегда' : 'Отправить в архив'}</Button></DialogActions>
  </Dialog>;
}
