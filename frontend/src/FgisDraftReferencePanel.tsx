import { useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useNotify, useWorkspace } from './common';
import { fgisApi } from './fgisApi';
import { dateTime, errorMessage, type Declaration } from './types';

export function FgisDraftReferencePanel({ document, disabled }: { document: Declaration; disabled: boolean }) {
  const { firmId, canEdit } = useWorkspace();
  const notify = useNotify();
  const [record, { isLoading }] = fgisApi.useRecordFgisDraftMutation();
  const [edit, setEdit] = useState(false);
  const [documentId, setDocumentId] = useState('');
  const [assignedNumber, setAssignedNumber] = useState('');
  const [failure, setFailure] = useState('');
  const reference = document.workspace?.fgisDraft;
  const permitted = canEdit && ['Draft', 'InReview', 'Ready'].includes(document.status);
  const validId = /^[1-9][0-9]{0,17}$/.test(documentId.trim());

  async function save() {
    if (!permitted || disabled || isLoading || !validId) return;
    setFailure('');
    try {
      await record({ firmId, id: document.id, revision: document.revision, documentId: documentId.trim(), assignedNumber: assignedNumber.trim() }).unwrap();
      setEdit(false);
      notify('Сведения о черновике сохранены');
    } catch (error) {
      setFailure(errorMessage(error));
    }
  }

  async function copy() {
    if (!reference) return;
    const text = [
      `Черновик декларации ${document.reference}`,
      `Кабинет заявителя: ${reference.cabinetUrl}`,
      `Открытая карточка после регистрации: ${reference.registryUrl}`,
      ...(reference.assignedNumber ? [`Номер, присвоенный в ФГИС: ${reference.assignedNumber}`] : []),
    ].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      notify('Сведения скопированы');
    } catch {
      notify('Буфер обмена недоступен. Скопируйте ссылки из карточки.', 'error');
    }
  }

  return <Stack spacing={1.5}>
    <Typography variant="h6">Черновик в кабинете заявителя</Typography>
    {reference ? <>
      <Typography>ФГИС ID {reference.documentId}{reference.assignedNumber ? ` · Номер ${reference.assignedNumber}` : ''}</Typography>
      <Typography variant="body2" color="text.secondary">Внесено {dateTime(reference.recordedAtUtc)} · {reference.recordedBy}</Typography>
      <div className="page-actions">
        <Button component="a" href={reference.cabinetUrl} target="_blank" rel="noopener noreferrer">Открыть черновик</Button>
        <Button component="a" href={reference.registryUrl} target="_blank" rel="noopener noreferrer">Открыть карточку реестра</Button>
        <Button onClick={() => void copy()}>Скопировать сведения</Button>
      </div>
    </> : <Typography color="text.secondary">После сохранения черновика в ФГИС внесите его ID и номер. Ссылки появятся в деле декларации.</Typography>}
    {permitted && <div><Button variant="outlined" disabled={disabled} onClick={() => {
      setDocumentId(reference?.documentId ?? '');
      setAssignedNumber(reference?.assignedNumber ?? '');
      setFailure('');
      setEdit(true);
    }}>{reference ? 'Уточнить сведения' : 'Указать черновик ФГИС'}</Button></div>}
    <Dialog open={edit} onClose={() => !isLoading && setEdit(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Сведения о черновике ФГИС</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <Typography>Возьмите ID из адреса открытого черновика в кабинете заявителя. Номер можно добавить, когда он появится в ФГИС.</Typography>
          <TextField label="ФГИС ID документа" autoFocus required value={documentId} onChange={event => setDocumentId(event.target.value)} disabled={isLoading} inputProps={{ inputMode: 'numeric', maxLength: 18 }}/>
          <TextField label="Номер, присвоенный в ФГИС" value={assignedNumber} onChange={event => setAssignedNumber(event.target.value)} disabled={isLoading} inputProps={{ maxLength: 150 }}/>
          {failure && <Alert severity="error">{failure}</Alert>}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button disabled={isLoading} onClick={() => setEdit(false)}>Отмена</Button>
        <Button variant="contained" disabled={isLoading || disabled || !validId} onClick={() => void save()}>Сохранить сведения</Button>
      </DialogActions>
    </Dialog>
  </Stack>;
}
