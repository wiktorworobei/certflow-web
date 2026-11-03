import { useEffect, useId, useState } from 'react';
import { Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, Link, List, ListItemButton, MenuItem, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { CheckCircleOutlineRounded, CloseRounded, MenuBookOutlined, SearchRounded } from '@mui/icons-material';
import { dateTime, errorMessage } from './types';
import { okpd2Api, type Okpd2Code } from './okpd2Api';

interface Props {
  firmId: string; value: string; productName?: string; disabled?: boolean;
  onSelect: (code: Okpd2Code) => void;
}

export function Okpd2Picker({ firmId, value, productName = '', disabled = false, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [firmId, disabled]);
  return <>
    <Button type="button" size="small" variant="outlined" startIcon={<MenuBookOutlined/>} disabled={disabled} onClick={() => setOpen(true)}>Подобрать код ОКПД2</Button>
    {open && <Okpd2Dialog key={firmId} firmId={firmId} value={value} productName={productName} onClose={() => setOpen(false)} onSelect={code => { if (!disabled) onSelect(code); setOpen(false); }}/>}
  </>;
}

function Okpd2Dialog({ firmId, value, productName, onClose, onSelect }: Omit<Props, 'disabled'> & { onClose: () => void }) {
  const titleId = useId(); const theme = useTheme(); const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [query, setQuery] = useState(value.trim()); const [debounced, setDebounced] = useState(value.trim());
  const [section, setSection] = useState(''); const [exact, setExact] = useState(false);
  const [selected, setSelected] = useState<Okpd2Code | null>(null);
  const settings = okpd2Api.useOkpd2SettingsQuery(firmId, { refetchOnMountOrArgChange: true });
  const available = settings.currentData?.isConfigured === true;
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query.trim()), 350); return () => window.clearTimeout(timer); }, [query]);
  const waiting = query.trim() !== debounced;
  const search = okpd2Api.useOkpd2SearchQuery({ firmId, query: debounced, section: exact ? '' : section, exact }, { skip: !available || waiting || !debounced });
  const data = available && !waiting && !!debounced ? search.currentData : undefined;
  const loading = available && (waiting || (!!debounced && search.isFetching));
  const searchError = available && !waiting && !!debounced ? search.error : undefined;
  function changeQuery(next: string) { setQuery(next); setSelected(null); }
  return <Dialog open onClose={onClose} maxWidth="md" fullWidth fullScreen={mobile} aria-labelledby={titleId}
    sx={mobile ? { '& .MuiDialog-paper.MuiDialog-paper': { m: 0, width: '100%', maxWidth: '100%', height: '100dvh', maxHeight: '100dvh', borderRadius: 0 } } : undefined}>
    <DialogTitle id={`${titleId}-heading`} sx={{ pr: 7 }}>
      <Stack direction="row" alignItems="center" spacing={1}><MenuBookOutlined color="primary"/><span id={titleId}>Подбор кода ОКПД2</span></Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>Найдите продукцию в справочнике DaData и выберите подходящий код.</Typography>
      <IconButton aria-label="Закрыть подбор ОКПД2" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}><CloseRounded/></IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
      {settings.isFetching && !settings.currentData && <LinearProgress aria-label="Проверка подключения DaData"/>}
      {settings.error && <Alert severity="error" action={<Button color="inherit" onClick={() => void settings.refetch()}>Повторить</Button>}>{errorMessage(settings.error)}</Alert>}
      {settings.currentData?.isConfigured === false && <Alert severity="info" sx={{ mb: 2 }}>
        {settings.currentData.enabled ? <>Добавьте API-ключ DaData в <Link href="#/settings" onClick={onClose}>настройках</Link>.</> : 'Поиск DaData отключён администратором сервера.'} Код ОКПД2 можно ввести вручную в поле продукции.
      </Alert>}
      <Stack spacing={1.5} sx={{ mt: 1, mb: 2 }}>
        <TextField autoFocus fullWidth label="Код или название продукции" placeholder="Например: калоши или 95.23.10.133" value={query} disabled={!available}
          onChange={event => changeQuery(event.target.value)} inputProps={{ maxLength: 300 }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setDebounced(query.trim()); } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded/></InputAdornment>,
            endAdornment: query ? <InputAdornment position="end"><IconButton size="small" aria-label="Очистить поиск ОКПД2" onClick={() => changeQuery('')}><CloseRounded/></IconButton></InputAdornment> : undefined }}/>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
          <TextField select label="Способ поиска" value={exact ? 'exact' : 'suggest'} disabled={!available} sx={{ flex: 1, minWidth: 0 }}
            onChange={event => { setExact(event.target.value === 'exact'); setSelected(null); }}>
            <MenuItem value="suggest">По коду или названию</MenuItem><MenuItem value="exact">Точный код</MenuItem>
          </TextField>
          <TextField select label="Раздел ОКПД2" value={section} disabled={!available || exact} sx={{ flex: 1, minWidth: 0 }} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}
            onChange={event => { setSection(event.target.value); setSelected(null); }}>
            <MenuItem value="">Все разделы</MenuItem>
            {Array.from('ABCDEFGHIJKLMNOPQRSTU').map(letter => <MenuItem key={letter} value={letter}>Раздел {letter}</MenuItem>)}
          </TextField>
        </Stack>
        {!!productName?.trim() && <Button type="button" variant="outlined" disabled={!available} sx={{ alignSelf: 'flex-start' }} onClick={() => { setExact(false); changeQuery(productName.trim().slice(0, 300)); }}>Искать по названию продукции</Button>}
      </Stack>
      <Typography variant="body2" color="text.secondary" role="status" sx={{ mb: 1.5 }}>
        {loading ? 'Ищем коды…' : data ? `Получено подсказок: ${data.items.length}` : 'Введите код или название продукции'}
      </Typography>
      <Box sx={{ height: 3 }}>{loading && <LinearProgress aria-label="Поиск кодов ОКПД2"/>}</Box>
      {searchError && <Alert severity="error" sx={{ my: 1.5 }} action={<Button color="inherit" onClick={() => void search.refetch()}>Повторить</Button>}>{errorMessage(searchError)}</Alert>}
      {!loading && !searchError && data?.items.length === 0 && <Alert severity="info">Ничего не найдено. Уточните код, название или раздел продукции.</Alert>}
      <List aria-label="Найденные коды ОКПД2" disablePadding sx={{ maxHeight: { xs: 280, sm: 340 }, overflowY: 'auto', borderRadius: 2 }}>
        {!loading && !searchError && data?.items.map(code => <ListItemButton key={code.code} selected={selected?.code === code.code}
          onClick={() => setSelected(code)} sx={{ gap: 1.5, py: 1.5, alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider' }}>
          <CheckCircleOutlineRounded color={selected?.code === code.code ? 'primary' : 'disabled'} sx={{ mt: .25 }}/>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography component="div" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums' }}>{code.code}</Typography>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{code.name}</Typography>
            {code.section && <Typography variant="caption" color="text.secondary">Раздел {code.section}</Typography>}
          </Box>
        </ListItemButton>)}
      </List>
      {selected && <Box component="section" aria-label="Выбранный код ОКПД2" sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'primary.main', borderRadius: 2 }}>
        <Typography fontWeight={700}>{selected.code}</Typography>
        <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{selected.name}</Typography>
      </Box>}
      {data && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>
        DaData · Получено {dateTime(data.retrievedAt)}{data.fromCache ? ' · Из кеша' : ''}. Показано до 20 подсказок; уточните запрос для других результатов.
      </Typography>}
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
      <Button type="button" onClick={onClose}>Отмена</Button>
      <Button type="button" variant="contained" disabled={!selected || !available || loading || !!searchError} onClick={() => { if (selected) onSelect(selected); }}>Подставить код</Button>
    </DialogActions>
  </Dialog>;
}
