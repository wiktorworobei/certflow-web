import { useEffect, useRef, useState } from 'react';
import { Alert, Autocomplete, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, FormControlLabel, Stack, TextField } from '@mui/material';
import { ContentCopyOutlined } from '@mui/icons-material';
import { useNotify, useWorkspace } from './common';
import type { DeclarationPartySide } from './declarationPartyCopy';
import { declarationChoiceLabel, useDeclarationChoices } from './declarationReusePicker';
import { api } from './store';
import { errorMessage, type Declaration, type DeclarationRow } from './types';

export function DeclarationPartyImport({ side, declarationId, disabled, onCopy }: {
  side: DeclarationPartySide;
  declarationId?: string;
  disabled: boolean;
  onCopy: (source: Declaration) => void;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Button size="small" startIcon={<ContentCopyOutlined/>} disabled={disabled} onClick={() => setOpen(true)}>
      Скопировать из другого макета
    </Button>
    {open && <CopyDialog side={side} declarationId={declarationId} disabled={disabled} onCopy={onCopy} onClose={() => setOpen(false)}/>}
  </>;
}

function CopyDialog({ side, declarationId, disabled, onCopy, onClose }: {
  side: DeclarationPartySide;
  declarationId?: string;
  disabled: boolean;
  onCopy: (source: Declaration) => void;
  onClose: () => void;
}) {
  const { firmId } = useWorkspace();
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [archived, setArchived] = useState(false);
  const [selected, setSelected] = useState<DeclarationRow | null>(null);
  const [load, { isFetching }] = api.useLazyDeclarationQuery();
  const request = useRef<ReturnType<typeof load> | null>(null);
  const [failure, setFailure] = useState('');
  const choices = useDeclarationChoices(firmId, selected ? '' : search, archived ? 'archived' : 'active', declarationId);
  const party = side === 'applicant' ? 'заявителя' : 'изготовителя';
  const locked = disabled || isFetching;

  useEffect(() => () => { request.current?.abort(); request.current = null; }, []);

  async function copy() {
    if (!selected || selected.id === declarationId || locked || request.current) return;
    setFailure('');
    const pending = load({ firmId, id: selected.id });
    request.current = pending;
    try {
      const source = await pending.unwrap();
      if (request.current !== pending) return;
      onCopy(source);
      notify(`Реквизиты ${party} перенесены из ${source.reference}`);
      onClose();
    } catch (error) {
      if (request.current === pending) setFailure(errorMessage(error));
    } finally {
      if (request.current === pending) request.current = null;
    }
  }

  return <Dialog open fullWidth maxWidth="sm" onClose={() => !isFetching && onClose()} aria-labelledby="declaration-party-copy-title">
    <DialogTitle id="declaration-party-copy-title">Скопировать из другого макета</DialogTitle>
    <DialogContent>
      <Stack spacing={1.5}>
        <DialogContentText>Выбранный макет заменит реквизиты {party} в текущем документе.</DialogContentText>
        <Autocomplete
          autoHighlight
          options={selected && !choices.options.some(row => row.id === selected.id) ? [selected, ...choices.options] : choices.options}
          value={selected}
          inputValue={search}
          disabled={locked}
          loading={choices.loading}
          loadingText="Ищем макеты…"
          noOptionsText="Макеты не найдены"
          getOptionLabel={declarationChoiceLabel}
          isOptionEqualToValue={(a, b) => a.id === b.id}
          filterOptions={rows => rows}
          onInputChange={(_, value, reason) => {
            if (reason === 'input' || reason === 'clear') { setSearch(value); setSelected(null); setFailure(''); }
          }}
          onChange={(_, value) => { setSelected(value); setSearch(value ? declarationChoiceLabel(value) : ''); setFailure(''); }}
          renderInput={params => <TextField {...params} autoFocus label="Исходный макет" placeholder="Внутренний номер или название" inputProps={{ ...params.inputProps, maxLength: 200 }}/>}
        />
        <FormControlLabel label="Искать в архиве" control={<Checkbox checked={archived} disabled={locked} onChange={event => {
          setArchived(event.target.checked); if (selected) setSearch(''); setSelected(null); setFailure('');
        }}/>}/>
        {choices.error && <Alert severity="error" action={<Button onClick={choices.retry}>Повторить</Button>}>Не удалось найти макеты.</Alert>}
        {failure && <Alert severity="error">{failure}</Alert>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={isFetching}>Отмена</Button>
      <Button variant="contained" disabled={!selected || locked} onClick={() => void copy()}>{isFetching ? 'Копируем…' : 'Скопировать реквизиты'}</Button>
    </DialogActions>
  </Dialog>;
}
