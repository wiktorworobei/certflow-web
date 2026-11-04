import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { AddRounded, DeleteOutlineRounded } from '@mui/icons-material';
import { CertificatePicker, useSigningCertificates } from './CertificatePicker';
import { certificateError, linkCertificate, removeCertificate, type LinkedCertificate } from './certificateAuthentication';
import { api, signedOut } from './store';
import { ErrorState, Loading, Section, useNotify } from './common';
import { date } from './types';

export function CertificateSettings() {
  const { data: credentials, isLoading, error: listError, refetch } = api.useCertificatesQuery();
  const certificates = useSigningCertificates();
  const dispatch = useDispatch(); const notify = useNotify();
  const [adding, setAdding] = useState(false); const [removing, setRemoving] = useState<LinkedCertificate | null>(null);
  const [password, setPassword] = useState(''); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const close = () => { if (!busy) { setAdding(false); setRemoving(null); setPassword(''); setError(''); } };
  async function submit(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      if (removing) {
        await removeCertificate(removing.id, password);
        dispatch(signedOut()); dispatch(api.util.resetApiState());
        notify('Сертификат отвязан. Все сеансы завершены. Войдите снова.');
      } else {
        await linkCertificate(certificates.selected, password);
        setAdding(false); setPassword(''); await refetch(); notify('Сертификат привязан. Теперь можно входить по ЭЦП.');
      }
    } catch (e) { setError(certificateError(e)); }
    finally { setBusy(false); }
  }
  return <Section title="Вход по ЭЦП" subtitle="Привяжите личный сертификат, чтобы входить без пароля.">
    <Stack spacing={2}>
      {isLoading ? <Loading/> : listError ? <ErrorState error={listError} retry={refetch}/> : credentials?.length ? credentials.map(c => <Box key={c.id} sx={{ border: '1px solid var(--border)', borderRadius: 2, p: 2, minWidth: 0, overflowWrap: 'anywhere' }}>
        <Typography variant="body2" fontWeight={600}>{c.subject}</Typography>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ my: 1 }}>{c.issuer}<br/>Действует до {date(c.validUntil)}<br/>Отпечаток: {c.thumbprint}</Typography>
        <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
          <Chip size="small" color={new Date(c.validUntil).getTime() <= Date.now() ? 'warning' : 'success'} label={new Date(c.validUntil).getTime() <= Date.now() ? 'Срок истёк' : 'Привязан'}/>
          <Button size="small" color="error" startIcon={<DeleteOutlineRounded/>} onClick={() => { setRemoving(c); setPassword(''); setError(''); }}>Отвязать</Button>
        </Stack>
      </Box>) : <Typography color="text.secondary" variant="body2">Сертификаты пока не привязаны. Добавьте сертификат и подтвердите привязку текущим паролем.</Typography>}
      <Button variant="outlined" startIcon={<AddRounded/>} onClick={() => { setAdding(true); setPassword(''); setError(''); }}>Привязать сертификат</Button>
      <Typography variant="caption" color="text.secondary">Закрытый ключ остаётся на вашем носителе. После перевыпуска сертификата привяжите новый сертификат.</Typography>
    </Stack>
    <Dialog open={adding || !!removing} onClose={close} maxWidth="sm" fullWidth>
      <Box component="form" onSubmit={submit}>
        <DialogTitle>{removing ? 'Отвязать сертификат ЭЦП' : 'Привязать сертификат ЭЦП'}</DialogTitle>
        <DialogContent sx={{ pt: '12px !important' }}>
          {removing ? <Alert severity="warning" sx={{ mb: 2 }}>Вход с этим сертификатом станет недоступен. Все ваши сеансы будут завершены, включая текущий. Для входа останутся пароль и другие привязанные сертификаты.</Alert> : <CertificatePicker state={certificates} disabled={busy}/>}
          <TextField label="Текущий пароль" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} disabled={busy} inputProps={{ maxLength: 200 }} helperText="Подтвердите изменение способов входа в вашу учётную запись" sx={{ mt: 3 }}/>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}><Button onClick={close} disabled={busy}>Отмена</Button><Button type="submit" variant="contained" color={removing ? 'error' : 'primary'} disabled={busy || !password || adding && (!certificates.selected || certificates.loading)}>{busy ? 'Подтверждаем…' : removing ? 'Отвязать и выйти' : 'Привязать'}</Button></DialogActions>
      </Box>
    </Dialog>
  </Section>;
}
