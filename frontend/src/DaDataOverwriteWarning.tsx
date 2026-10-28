import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Typography } from '@mui/material';
import { useWorkspace } from './common';
import type { Organization } from './types';

type Reason = 'refresh' | 'save' | 'apply';
const preferenceKey = (userId: string) => `certflow.dadata-overwrite-warning.v1.${userId}`;

export function useDaDataOverwriteWarning() {
  const { user, firmId } = useWorkspace();
  const [reason, setReason] = useState<Reason | null>(null);
  const [hideNextTime, setHideNextTime] = useState(false);
  const [target, setTarget] = useState<Pick<Organization, 'name' | 'inn' | 'kpp'> | null>(null);
  const resolver = useRef<((accepted: boolean) => void) | null>(null);
  const requestedScope = useRef<string | null>(null);
  const scope = `${user?.id ?? ''}:${firmId}`;
  const currentScope = useRef(scope); currentScope.current = scope;
  useEffect(() => () => { resolver.current?.(false); resolver.current = null; requestedScope.current = null; }, [scope]);

  function confirmOverwrite(nextReason: Reason, existing?: Pick<Organization, 'name' | 'inn' | 'kpp'>): Promise<boolean> {
    if (!user || resolver.current) return Promise.resolve(false);
    try { if (localStorage.getItem(preferenceKey(user.id)) === 'hidden') return Promise.resolve(true); } catch { /* Show the warning if preferences cannot be read. */ }
    setHideNextTime(false); setReason(nextReason); setTarget(existing ?? null);
    requestedScope.current = scope;
    const originScope = scope;
    return new Promise(resolve => { resolver.current = accepted => resolve(accepted && currentScope.current === originScope); });
  }
  function finish(accepted: boolean) {
    if (accepted && hideNextTime && user && resolver.current && requestedScope.current === currentScope.current) {
      try { localStorage.setItem(preferenceKey(user.id), 'hidden'); } catch { /* The action can proceed without saving this optional preference. */ }
    }
    const resolve = resolver.current; resolver.current = null; requestedScope.current = null; setReason(null); resolve?.(accepted);
  }
  const warningDialog = <Dialog open={reason !== null} onClose={() => finish(false)} maxWidth="sm" fullWidth aria-labelledby="dadata-overwrite-warning-title">
    <DialogTitle id="dadata-overwrite-warning-title">{reason === 'apply' ? 'Реквизиты формы будут заменены' : 'Ручные данные будут перезаписаны'}</DialogTitle>
    <DialogContent>
      {target && <Typography sx={{ mb: 2 }}>Запись в справочнике: <strong>{target.name}</strong> · ИНН {target.inn || '—'} · КПП {target.kpp || 'не указан'}</Typography>}
      <Typography sx={{ mb: 2 }}>{reason === 'apply'
        ? 'В открытой форме уже заполнены реквизиты. Подстановка заменит отличающиеся значения и очистит поля, которых нет в ответе DaData. Сам справочник этим действием не изменяется.'
        : reason === 'save'
        ? 'Сохранение результата поиска заменит реквизиты существующей компании данными DaData, включая прежние ручные изменения. Новые дополнения, введённые вами в окне поиска, сохранятся как ручные.'
        : 'Подстановка или обновление из DaData заменит текущие реквизиты компании, включая изменения, внесённые вручную.'}</Typography>
      <Alert severity="warning">Поля, которых нет в ответе DaData, будут очищены. Это касается и телефона, электронной почты и регистрирующего органа. Подписант и его должность также сбрасываются: при подстановке руководителя можно выбрать отдельно.</Alert>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Ночное обновление сохраняет поля, заполненные или изменённые вручную, и обновляет остальные сведения. Сохранённые декларации автоматически не меняются.</Typography>
      <FormControlLabel sx={{ mt: 1.5 }} control={<Checkbox checked={hideNextTime} onChange={event => setHideNextTime(event.target.checked)}/>} label="Больше не показывать"/>
    </DialogContent>
    <DialogActions sx={{ p: 2.5 }}><Button onClick={() => finish(false)}>Отмена</Button><Button variant="contained" color="warning" onClick={() => finish(true)}>Продолжить</Button></DialogActions>
  </Dialog>;
  return { confirmOverwrite, warningDialog };
}
