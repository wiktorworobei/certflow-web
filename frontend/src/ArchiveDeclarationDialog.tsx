import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from '@mui/material';
import { ArchiveOutlined } from '@mui/icons-material';
import { api } from './store';
import { useNotify, useWorkspace } from './common';
import { errorMessage, type Declaration } from './types';

type ArchiveTarget = Pick<Declaration, 'id' | 'reference' | 'title' | 'revision'>;

export function ArchiveDeclarationDialog({ declaration, onClose, onArchived }: {
  declaration: ArchiveTarget; onClose: () => void; onArchived?: (document: Declaration) => void;
}) {
  const { firmId, canEdit } = useWorkspace(); const notify = useNotify();
  const [archive, { isLoading }] = api.useChangeStatusMutation();
  const [comment, setComment] = useState(''); const [error, setError] = useState('');
  async function confirmArchive() {
    if (!canEdit || isLoading) return;
    setError('');
    try {
      const result = await archive({ firmId, id: declaration.id, revision: declaration.revision, status: 'Archived', reason: comment }).unwrap();
      onArchived?.(result); onClose(); notify('Декларация отправлена в архив');
    } catch (error) { setError(errorMessage(error)); }
  }
  return <Dialog open onClose={() => !isLoading && onClose()} aria-labelledby="archive-declaration-title" maxWidth="sm" fullWidth>
    <DialogTitle id="archive-declaration-title">Отправить в архив?</DialogTitle>
    <DialogContent>
      <Typography sx={{ fontWeight: 600, mb: 1 }}>{declaration.title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>{declaration.reference}</Typography>
      <Typography sx={{ mb: 2 }}>Декларация исчезнет из рабочего списка и останется доступна во вкладке «Архив». Данные, файлы и история сохранятся.</Typography>
      <TextField label="Комментарий к архивированию" multiline minRows={2} value={comment} disabled={isLoading} onChange={e => setComment(e.target.value)} inputProps={{ maxLength: 2000 }}/>
      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
    </DialogContent>
    <DialogActions sx={{ p: 2.5 }}>
      <Button autoFocus disabled={isLoading} onClick={onClose}>Отмена</Button>
      <Button variant="contained" startIcon={<ArchiveOutlined/>} disabled={isLoading || !canEdit} onClick={() => void confirmArchive()}>{isLoading ? 'Отправляем…' : 'Отправить в архив'}</Button>
    </DialogActions>
  </Dialog>;
}
