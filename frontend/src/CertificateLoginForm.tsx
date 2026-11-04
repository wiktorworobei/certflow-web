import { Box, Button, Typography } from '@mui/material';
import { KeyRounded } from '@mui/icons-material';
import { CertificatePicker, useSigningCertificates } from './CertificatePicker';
import { certificateError, loginWithCertificate } from './certificateAuthentication';
import type { AuthResponse } from './types';

export function CertificateLoginForm({ busy, setBusy, onLogin, onError }: {
  busy: boolean; setBusy: (busy: boolean) => void; onLogin: (auth: AuthResponse) => Promise<void>; onError: (error: string) => void;
}) {
  const certificates = useSigningCertificates();
  async function submit(event: React.FormEvent) {
    event.preventDefault(); onError(''); setBusy(true);
    try { await onLogin(await loginWithCertificate(certificates.selected)); }
    catch (error) { onError(certificateError(error)); }
    finally { setBusy(false); }
  }
  return <Box component="form" onSubmit={submit}>
    <CertificatePicker state={certificates} disabled={busy}/>
    <Button fullWidth variant="contained" type="submit" startIcon={<KeyRounded/>} disabled={busy || certificates.loading || !certificates.selected} aria-busy={busy} sx={{ mt: 3, py: 1.7 }}>
      {busy ? 'Подтверждаем вход…' : 'Войти по ЭЦП'}
    </Button>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Первый раз войдите по паролю и привяжите сертификат: «Настройки → Профиль и безопасность».</Typography>
  </Box>;
}
