import { useState } from 'react';
import { Alert, Box, Button, MenuItem, TextField, Typography } from '@mui/material';
import { RefreshRounded } from '@mui/icons-material';
import { certificateError, findSigningCertificates, type CertificateSummary } from './certificateAuthentication';
import { date } from './types';

export function useSigningCertificates() {
  const [certificates, setCertificates] = useState<CertificateSummary[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  async function reload() {
    setLoading(true); setError('');
    try {
      const items = await findSigningCertificates();
      setCertificates(items);
      setSelected(previous => items.some(c => c.thumbprint === previous) ? previous : items.length === 1 ? items[0].thumbprint : '');
    } catch (e) { setCertificates([]); setSelected(''); setError(certificateError(e)); }
    finally { setLoading(false); }
  }
  return { certificates, selected, setSelected, loading, error, reload };
}

export function CertificatePicker({ state, disabled = false }: { state: ReturnType<typeof useSigningCertificates>; disabled?: boolean }) {
  const selected = state.certificates.find(c => c.thumbprint === state.selected);
  return <Box sx={{ display: 'grid', gap: 2, minWidth: 0 }}>
    <Typography variant="body2" color="text.secondary">Подключите носитель ЭЦП. Для доступа к сертификатам нужны КриптоПро CSP и расширение КриптоПро ЭЦП Browser plug-in.</Typography>
    <Button variant="outlined" startIcon={<RefreshRounded/>} onClick={state.reload} disabled={disabled || state.loading}>
      {state.loading ? 'Ищем сертификаты…' : state.certificates.length ? 'Обновить сертификаты' : 'Найти сертификаты'}
    </Button>
    {state.error && <Alert severity="error">{state.error}</Alert>}
    {state.certificates.length > 0 && <TextField select label="Сертификат ЭЦП" value={state.selected} onChange={e => state.setSelected(e.target.value)} disabled={disabled || state.loading} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
      <MenuItem value="" disabled>Выберите сертификат</MenuItem>
      {state.certificates.map(c => <MenuItem key={c.thumbprint} value={c.thumbprint} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
        {c.name || c.subjectName || c.thumbprint} · до {date(c.validTo ? String(c.validTo) : undefined)} · {c.thumbprint.slice(-8)}
      </MenuItem>)}
    </TextField>}
    {selected && <Box sx={{ minWidth: 0, overflowWrap: 'anywhere' }}>
      <Typography variant="body2">{selected.subjectName || selected.name}</Typography>
      <Typography variant="caption" color="text.secondary">Выдан: {selected.issuerName || '—'}<br/>Действует до {date(selected.validTo ? String(selected.validTo) : undefined)}</Typography>
    </Box>}
  </Box>;
}
