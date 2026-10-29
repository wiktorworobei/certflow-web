import { useEffect, useState } from 'react';
import { Autocomplete, TextField, Typography } from '@mui/material';
import { api } from './store';
import { useWorkspace } from './common';
import type { Laboratory } from './types';

export function LaboratoryPicker({ label, disabled, onPick }: { label: string; disabled: boolean; onPick: (lab: Laboratory) => void }) {
  const { firmId } = useWorkspace(); const [input, setInput] = useState(''); const [search, setSearch] = useState('');
  useEffect(() => { const timer = setTimeout(() => setSearch(input), 250); return () => clearTimeout(timer); }, [input]);
  useEffect(() => { setInput(''); setSearch(''); }, [firmId]);
  const result = api.useLaboratorySearchQuery({ firmId, search, recordKind: 'Laboratory', pageSize: 50 });
  return <Autocomplete options={result.currentData?.items ?? []} value={null} inputValue={input} disabled={disabled} loading={result.isFetching}
    filterOptions={options => options} getOptionLabel={lab => `${lab.name} · ${lab.accreditationNumber}`}
    isOptionEqualToValue={(a,b) => a.id === b.id} onInputChange={(_, value) => setInput(value)}
    onChange={(_, lab) => { if (lab && lab.firmId === firmId) onPick(lab); }}
    renderOption={(props, lab) => <li {...props} key={lab.id}><div><Typography sx={{ overflowWrap: 'anywhere' }}>{lab.name}</Typography><Typography variant="caption" color="text.secondary">{lab.accreditationNumber || 'Без аттестата'} · {lab.details?.country} · {lab.registrySource ? 'CSV' : 'Вручную'}{lab.manuallyEditedFields?.length ? ' + ручные правки' : ''}</Typography></div></li>}
    noOptionsText={result.error ? 'Не удалось загрузить справочник' : 'Лаборатории не найдены'}
    renderInput={params => <TextField {...params} label={label} helperText={result.error ? 'Ошибка загрузки. Повторите поиск.' : 'Поиск по названию, аттестату, стране, ТР или области. Показаны первые 50 совпадений.'}/>}/>;
}
