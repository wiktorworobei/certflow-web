import { useEffect, useState } from 'react';
import { Autocomplete, Link, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { normativeApi, normativeLabel } from './normativeApi';

export function NormativeDocumentsField({ firmId, value, onChange, disabled }: { firmId: string; value: string[]; onChange: (value: string[]) => void; disabled: boolean }) {
  const [input, setInput] = useState(''); const [query, setQuery] = useState('');
  useEffect(() => { const timer = setTimeout(() => setQuery(input.trim()), 250); return () => clearTimeout(timer); }, [input]);
  const result = normativeApi.useNormativeSearchQuery({ firmId, query, page: 1, pageSize: 50 }, { skip: disabled });
  const waiting = input.trim() !== query;
  const rows = result.error || waiting ? [] : result.currentData?.items ?? []; const options = [...new Set(rows.map(normativeLabel))];
  return <Stack gap={.75} role="group" aria-label="Регламенты и стандарты декларации"><Autocomplete multiple freeSolo filterSelectedOptions options={options} filterOptions={options => options} value={value} disabled={disabled}
    loading={result.isFetching || waiting} onInputChange={(_, text) => setInput(text)} onChange={(_, selected) => onChange([...new Set(selected)])}
    noOptionsText="В справочнике нет документов" renderOption={(props, option) => { const row = rows.find(x => normativeLabel(x) === option); return <li {...props} key={option}><Stack><Typography variant="body2">{option}</Typography>{row && <Typography variant="caption" color="text.secondary">{row.status}{row.isManuallyEdited ? ' · ручные сведения' : ''}</Typography>}</Stack></li>; }}
    renderInput={params => <TextField {...params} label="Технические регламенты / стандарты" helperText={result.error ? 'Справочник недоступен. Можно ввести значение вручную и нажать Enter.' : 'Выберите сохранённый документ или введите значение и нажмите Enter. Применимость проверяет специалист.'}/>}/>
    {!disabled && <Link component={RouterLink} to="/directories?tab=standards" variant="caption" sx={{ alignSelf: 'flex-start' }}>Открыть справочник ГОСТов и техрегламентов</Link>}
  </Stack>;
}
