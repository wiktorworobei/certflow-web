import { useEffect, useId, useState } from 'react';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, List, ListItemButton, Pagination, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { CheckCircleOutlineRounded, CloseRounded, MenuBookOutlined, SearchRounded } from '@mui/icons-material';
import { date, errorMessage } from './types';
import { tnvedApi, type TnVedCode } from './tnvedApi';

interface Props {
  firmId: string; value: string; productName?: string; disabled?: boolean;
  onSelect: (code: TnVedCode) => void;
}
const formatCode = (code: string) => [code.slice(0, 4), code.slice(4, 6), code.slice(6, 9), code.slice(9)].filter(Boolean).join(' ');

export function TnVedPicker({ firmId, value, productName = '', disabled = false, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [firmId, disabled]);
  return <>
    <Button type="button" size="small" variant="outlined" startIcon={<MenuBookOutlined/>} disabled={disabled} onClick={() => setOpen(true)}>Подобрать код ТН ВЭД</Button>
    {open && <TnVedDialog key={firmId} firmId={firmId} value={value} productName={productName} onClose={() => setOpen(false)} onSelect={code => { if (!disabled) onSelect(code); setOpen(false); }}/>}
  </>;
}

function TnVedDialog({ firmId, value, productName, onClose, onSelect }: Omit<Props, 'disabled'> & { onClose: () => void }) {
  const titleId = useId(); const theme = useTheme(); const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [query, setQuery] = useState(value.trim()); const [debounced, setDebounced] = useState(value.trim());
  const [page, setPage] = useState(1); const [selected, setSelected] = useState<TnVedCode | null>(null);
  const settings = tnvedApi.useTnVedSettingsQuery(firmId, { refetchOnMountOrArgChange: true });
  const available = settings.currentData?.isConfigured === true;
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query.trim()), 250); return () => window.clearTimeout(timer); }, [query]);
  const waiting = query.trim() !== debounced;
  const search = tnvedApi.useTnVedSearchQuery({ firmId, query: debounced, page }, { skip: !available || waiting });
  const data = waiting ? undefined : search.currentData;
  const loading = available && (waiting || search.isFetching);
  function changeQuery(next: string) { setQuery(next); setPage(1); setSelected(null); }
  return <Dialog open onClose={onClose} maxWidth="lg" fullWidth fullScreen={mobile} aria-labelledby={titleId}
    sx={mobile ? { '& .MuiDialog-paper.MuiDialog-paper': { m: 0, width: '100%', maxWidth: '100%', height: '100dvh', maxHeight: '100dvh', borderRadius: 0 } } : undefined}>
    <DialogTitle id={titleId} sx={{ pr: 7 }}>
      <Stack direction="row" alignItems="center" spacing={1}><MenuBookOutlined color="primary"/><span>Подбор кода ТН ВЭД</span></Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>Найдите код по номеру или наименованию и подставьте его в продукцию.</Typography>
      <IconButton aria-label="Закрыть подбор ТН ВЭД" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}><CloseRounded/></IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
      {settings.isFetching && !settings.currentData && <LinearProgress aria-label="Загрузка справочника ТН ВЭД"/>}
      {settings.error && <Alert severity="error" action={<Button color="inherit" onClick={() => void settings.refetch()}>Повторить</Button>}>{errorMessage(settings.error)}</Alert>}
      {settings.currentData?.isConfigured === false && <Alert severity="info">Справочник ТН ВЭД пока не загружен. Код можно ввести вручную в поле продукции.</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1, mb: 2 }}>
        <TextField autoFocus fullWidth label="Код или название товара" placeholder="Например: 0101 или насос центробежный" value={query} disabled={!available}
          onChange={event => changeQuery(event.target.value)} inputProps={{ maxLength: 200 }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setDebounced(query.trim()); } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded/></InputAdornment>,
            endAdornment: query ? <InputAdornment position="end"><IconButton size="small" aria-label="Очистить поиск ТН ВЭД" onClick={() => changeQuery('')}><CloseRounded/></IconButton></InputAdornment> : undefined }}/>
        {!!productName?.trim() && <Button type="button" variant="outlined" disabled={!available} sx={{ flexShrink: 0, maxWidth: { sm: 230 } }} onClick={() => changeQuery(productName.trim().slice(0, 200))}>Искать по названию продукции</Button>}
      </Stack>
      <Typography variant="body2" color="text.secondary" role="status" sx={{ mb: 1.5 }}>
        {loading ? 'Ищем коды…' : data ? `Найдено: ${data.total.toLocaleString('ru-RU')}` : 'Поиск в справочнике'}
        {settings.currentData?.dataDate ? ` · Данные на ${date(settings.currentData.dataDate)}` : ''}
      </Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.7fr) minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', minWidth: 0 }}>
          <Box sx={{ height: 3 }}>{loading && <LinearProgress aria-label="Поиск кодов ТН ВЭД"/>}</Box>
          {available && search.error && !waiting && <Alert severity="error" sx={{ m: 1.5 }} action={<Button color="inherit" onClick={() => void search.refetch()}>Повторить</Button>}>{errorMessage(search.error)}</Alert>}
          {available && !loading && !search.error && data?.total === 0 && <Typography sx={{ p: 3 }} color="text.secondary">Ничего не найдено. Попробуйте часть кода или несколько слов из наименования.</Typography>}
          <List aria-label="Найденные коды ТН ВЭД" disablePadding sx={{ maxHeight: { xs: 300, md: 420 }, minHeight: 120, overflowY: 'auto' }}>
            {!loading && !search.error && data?.items.map(code => <ListItemButton disableRipple key={code.code} selected={selected?.code === code.code}
              onClick={() => setSelected(code)} sx={{ gap: 1.5, py: 1.75, alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider' }}>
              <CheckCircleOutlineRounded color={selected?.code === code.code ? 'primary' : 'disabled'} sx={{ mt: .25 }}/>
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography component="div" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}>{formatCode(code.code)}</Typography>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{code.text}</Typography>
              </Box>
            </ListItemButton>)}
          </List>
          {!!data && data.total > data.pageSize && <Stack alignItems="center" sx={{ py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
            <Pagination aria-label="Страницы кодов ТН ВЭД" size="small" siblingCount={mobile ? 0 : 1} count={Math.ceil(data.total / data.pageSize)} page={page} onChange={(_, next) => { setPage(next); setSelected(null); }}/>
          </Stack>}
        </Box>
        <Box component="section" aria-label="Выбранный код ТН ВЭД" sx={{ p: 2.5, border: '1px solid', borderColor: selected ? 'primary.main' : 'divider', borderRadius: 2, bgcolor: 'action.hover', minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">Код для продукции</Typography>
          {selected ? <>
            <Typography variant="h5" sx={{ mt: 1, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{formatCode(selected.code)}</Typography>
            <Chip size="small" color="primary" variant="outlined" label="Полный код · 10 цифр" sx={{ my: 1.5 }}/>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{selected.text}</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Нажмите «Подставить код», чтобы заполнить поле ТН ВЭД.</Typography>
          </> : <>
            <Typography variant="subtitle1" sx={{ mt: 1 }}>Выберите код из списка</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Поиск находит начало кода и слова в наименовании. Пробелы в номере кода допускаются.</Typography>
            {!!value && <Typography variant="body2" sx={{ mt: 2 }}>Сейчас в продукции: <strong>{value}</strong></Typography>}
          </>}
        </Box>
      </Box>
      {settings.currentData?.sourceFile && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>Источник: {settings.currentData.sourceFile} · {settings.currentData.codeCount.toLocaleString('ru-RU')} кодов</Typography>}
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
      <Button type="button" onClick={onClose}>Отмена</Button>
      <Button type="button" variant="contained" disabled={!selected || loading} onClick={() => { if (selected) onSelect(selected); }}>Подставить код</Button>
    </DialogActions>
  </Dialog>;
}
