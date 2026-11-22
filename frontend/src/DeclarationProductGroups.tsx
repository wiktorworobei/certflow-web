import { useId, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { AddRounded } from '@mui/icons-material';
import { useFormContext, useWatch } from 'react-hook-form';
import type { SaveDeclaration } from './types';
import type { DeclarationProductGroup } from './workspaceTypes';

const maxGroups = 30;
const designation = /^(?:ТР\s+(?:ТС|ЕАЭС)\s*)?\d{3}\s*\/\s*\d{4}\b/i;

function isSameGroup(a: DeclarationProductGroup, b: DeclarationProductGroup) {
  const compare = (value: string) => value.trim().toLowerCase();
  return compare(a.regulation) === compare(b.regulation) && compare(a.code) === compare(b.code) &&
    (!!a.code.trim() || compare(a.name) === compare(b.name));
}

export function DeclarationProductGroups({ readOnly }: { readOnly: boolean }) {
  const { control, getValues, setValue } = useFormContext<SaveDeclaration>();
  const regulations = [...new Set((useWatch({ control, name: 'regulations' }) ?? []).map(value => value.trim()).filter(value => designation.test(value)))];
  const groups = useWatch({ control, name: 'workspace.productGroups' }) ?? [];
  const titleId = useId();
  const [editing, setEditing] = useState<{ index: number; group: DeclarationProductGroup }>();

  const group = editing?.group;
  const candidate = group && { regulation: group.regulation.trim(), code: group.code.trim(), name: group.name.trim() };
  const duplicate = candidate && groups.some((row, index) => index !== editing?.index && isSameGroup(row, candidate));
  const canApply = candidate && regulations.includes(candidate.regulation) && candidate.name && !duplicate;

  function changeField(key: keyof DeclarationProductGroup, value: string) {
    setEditing(current => current && { ...current, group: { ...current.group, [key]: value } });
  }

  function update(next: DeclarationProductGroup[]) {
    setValue('workspace.productGroups', next, { shouldDirty: true });
  }

  function apply() {
    if (!editing || !candidate || !canApply || readOnly) return;
    const current = getValues('workspace.productGroups') ?? [];
    update(editing.index < 0 ? [...current, candidate] : current.map((row, index) => index === editing.index ? candidate : row));
    setEditing(undefined);
  }

  return <Stack spacing={1.25} component="section" aria-labelledby={titleId}>
    <Typography component="h3" variant="subtitle2" id={titleId}>Группы продукции ЕАЭС</Typography>
    {!readOnly && !regulations.length && <Typography variant="body2" color="text.secondary">Добавьте технический регламент ТС или ЕАЭС, чтобы указать группу продукции.</Typography>}
    {readOnly && !groups.length && <Typography variant="body2" color="text.secondary">Группы не указаны.</Typography>}
    {groups.map((row, index) => <Stack key={JSON.stringify([row.regulation, row.code, row.name])} spacing={.5} sx={{ p: 1.5, border: 1, borderColor: 'divider', borderRadius: 1, overflowWrap: 'anywhere' }}>
      <Typography variant="body2" fontWeight={600}>{row.code && `${row.code} · `}{row.name}</Typography>
      <Typography variant="caption" color="text.secondary">{row.regulation}</Typography>
      {!regulations.includes(row.regulation.trim()) && <Alert severity="warning">Регламент этой группы убран из декларации.</Alert>}
      {!readOnly && <Stack direction="row" spacing={1} flexWrap="wrap">
        <Button type="button" size="small" disabled={!regulations.length} onClick={() => setEditing({ index, group: row })}>Изменить</Button>
        <Button type="button" size="small" color="error" onClick={() => update(groups.filter((_, i) => i !== index))}>Удалить</Button>
      </Stack>}
    </Stack>)}
    {!readOnly && <Button type="button" size="small" variant="outlined" startIcon={<AddRounded/>}
      disabled={regulations.length === 0 || groups.length >= maxGroups}
      onClick={() => setEditing({ index: -1, group: { regulation: regulations.length === 1 ? regulations[0] : '', code: '', name: '' } })}>Добавить группу ЕАЭС</Button>}
    {editing && group && <Dialog open onClose={() => setEditing(undefined)} maxWidth="sm" fullWidth aria-labelledby={`${titleId}-edit`}>
      <DialogTitle id={`${titleId}-edit`}>{editing.index < 0 ? 'Добавить группу продукции ЕАЭС' : 'Изменить группу продукции ЕАЭС'}</DialogTitle>
      <DialogContent dividers>
        <Box className="builder-field-stack">
          <TextField select label="Технический регламент группы" required value={regulations.includes(group.regulation.trim()) ? group.regulation.trim() : ''} onChange={event => changeField('regulation', event.target.value)}>
            {regulations.map(regulation => <MenuItem key={regulation} value={regulation} sx={{ whiteSpace: 'normal' }}>{regulation}</MenuItem>)}
          </TextField>
          <TextField label="Код группы" value={group.code} onChange={event => changeField('code', event.target.value)} inputProps={{ maxLength: 64 }} helperText="Укажите код из справочника ФГИС, если он известен."/>
          <TextField label="Наименование группы" required multiline minRows={2} value={group.name} onChange={event => changeField('name', event.target.value)} inputProps={{ maxLength: 500 }}/>
          {duplicate && <Alert severity="warning">Эта группа уже указана для выбранного регламента.</Alert>}
        </Box>
      </DialogContent>
      <DialogActions><Button type="button" onClick={() => setEditing(undefined)}>Отмена</Button><Button type="button" variant="contained" disabled={!canApply || readOnly} onClick={apply}>Применить</Button></DialogActions>
    </Dialog>}
  </Stack>;
}
