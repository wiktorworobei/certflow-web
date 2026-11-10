import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField } from '@mui/material';
import { useNotify, useWorkspace } from '../common';
import { api } from '../store';
import { emptyDeclaration, errorMessage } from '../types';
import { emptyWorkspace } from '../workspaceTypes';
import { Registry } from './Registry';

export function NewDeclaration() {
  const { firmId, canEdit } = useWorkspace();
  const navigate = useNavigate(); const notify = useNotify();
  const [save, { isLoading: saving }] = api.useSaveDeclarationMutation();
  const [title, setTitle] = useState(''); const [titleError, setTitleError] = useState(''); const [serverError, setServerError] = useState('');
  const pending = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const close = () => { if (!pending.current) navigate('/declarations', { replace: true }); };
  async function create(event: FormEvent) {
    event.preventDefault();
    if (pending.current || !canEdit) return;
    const name = title.trim();
    if (!name || name.length > 250) { setTitleError(!name ? 'Введите название декларации' : 'Название должно содержать не более 250 символов'); return; }
    pending.current = true; setTitleError(''); setServerError('');
    try {
      const result = await save({ firmId, data: { ...emptyDeclaration(), title: name, workspace: emptyWorkspace() } }).unwrap();
      if (!mounted.current) return;
      notify('Декларация сохранена в черновик');
      navigate(`/declarations/${result.id}`, { replace: true });
    } catch (error) { if (mounted.current) setServerError(errorMessage(error)); }
    finally { pending.current = false; }
  }
  if (!canEdit) return <Alert severity="warning">У вас нет прав на создание документов.</Alert>;
  return <>
    <Registry/>
    <Dialog open onClose={close} maxWidth="sm" fullWidth aria-labelledby="new-declaration-title" aria-describedby="new-declaration-description" PaperProps={{ component: 'form', onSubmit: create, noValidate: true }}>
      <DialogTitle id="new-declaration-title">Новая декларация</DialogTitle>
      <DialogContent>
        <DialogContentText id="new-declaration-description" sx={{ mb: 2 }}>Укажите название декларации. После нажатия «Продолжить» она сохранится в черновик, и вы сможете заполнить данные. Изменения сохраняются автоматически каждую минуту.</DialogContentText>
        <TextField autoFocus required fullWidth label="Название декларации" value={title} disabled={saving} onChange={event => { setTitle(event.target.value); setTitleError(''); }} error={!!titleError} helperText={titleError || 'До 250 символов. Название можно изменить позже.'} inputProps={{ maxLength: 250 }}/>
        {serverError && <Alert severity="error" sx={{ mt: 2 }}>{serverError}</Alert>}
      </DialogContent>
      <DialogActions sx={{ p: 2.5 }}><Button onClick={close} disabled={saving}>Отмена</Button><Button type="submit" variant="contained" disabled={saving}>{saving ? 'Сохраняем…' : 'Продолжить'}</Button></DialogActions>
    </Dialog>
  </>;
}
