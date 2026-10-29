import { useEffect, useId, useState } from 'react';
import { Alert, Box, Breadcrumbs, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, InputAdornment, LinearProgress, Link, List, ListItemButton, Stack, TextField, Typography, useMediaQuery, useTheme } from '@mui/material';
import { AccountTreeOutlined, ArrowBackRounded, CheckCircleOutlineRounded, ChevronRightRounded, CloseRounded, FolderOutlined, SearchRounded } from '@mui/icons-material';
import { date, errorMessage } from './types';
import { tnvedApi, type TnVedNode } from './tnvedApi';

interface Props {
  firmId: string; value: string; productName?: string; disabled?: boolean;
  onSelect: (node: TnVedNode) => void;
}
const formatCode = (code: string) => [code.slice(0, 4), code.slice(4, 6), code.slice(6, 9), code.slice(9)].filter(Boolean).join(' ');
const period = (node: TnVedNode) => [node.validFrom && `с ${date(node.validFrom)}`, node.validTo && `по ${date(node.validTo)}`].filter(Boolean).join(' ');

export function TnVedPicker({ firmId, value, productName = '', disabled = false, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  useEffect(() => { setOpen(false); }, [firmId, disabled]);
  return <>
    <Button type="button" size="small" variant="outlined" startIcon={<AccountTreeOutlined/>} disabled={disabled} onClick={() => setOpen(true)}>
      Подобрать код ТН ВЭД
    </Button>
    {open && <TnVedDialog key={firmId} firmId={firmId} value={value} productName={productName} onClose={() => setOpen(false)} onSelect={node => { if (!disabled) onSelect(node); setOpen(false); }}/>}
  </>;
}

function TnVedDialog({ firmId, value, productName, onClose, onSelect }: Omit<Props, 'disabled'> & { onClose: () => void }) {
  const titleId = useId(); const theme = useTheme(); const mobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [query, setQuery] = useState(value.trim()); const [debounced, setDebounced] = useState(value.trim());
  const [trail, setTrail] = useState<TnVedNode[]>([]); const [origin, setOrigin] = useState('');
  const [selected, setSelected] = useState<TnVedNode | null>(null);
  const settings = tnvedApi.useTnVedSettingsQuery(firmId, { refetchOnMountOrArgChange: true });
  const configured = settings.currentData?.isConfigured === true;
  const searching = !!query.trim(); const validQuery = query.trim().length >= 2 && query.trim().length <= 200;
  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query.trim()), 350); return () => window.clearTimeout(timer); }, [query]);
  const tree = tnvedApi.useTnVedTreeQuery({ firmId, parentId: trail.at(-1)?.id ?? 10 }, { skip: !configured || searching });
  const search = tnvedApi.useTnVedSearchQuery({ firmId, query: debounced }, { skip: !configured || !searching || !validQuery || debounced !== query.trim() });
  const result = searching ? search : tree;
  const waiting = searching && validQuery && query.trim() !== debounced;
  const data = waiting ? undefined : result.currentData;
  const loading = configured && (waiting || result.isFetching);
  function changeQuery(next: string) { setQuery(next); setSelected(null); }
  function root() { setTrail([]); setOrigin(''); changeQuery(''); }
  function enter(node: TnVedNode) {
    setSelected(null);
    if (searching) { setOrigin(query.trim()); setTrail([node]); setQuery(''); }
    else setTrail(current => [...current, node]);
  }
  function back() {
    setSelected(null);
    if (trail.length > 1) setTrail(current => current.slice(0, -1));
    else if (origin) { setTrail([]); setQuery(origin); setOrigin(''); }
    else root();
  }
  return <Dialog open onClose={onClose} maxWidth="lg" fullWidth fullScreen={mobile} aria-labelledby={titleId}
    sx={mobile ? { '& .MuiDialog-paper.MuiDialog-paper': { m: 0, width: '100%', maxWidth: '100%', height: '100dvh', maxHeight: '100dvh', borderRadius: 0 } } : undefined}>
    <DialogTitle id={titleId} sx={{ pr: 7 }}>
      <Stack direction="row" alignItems="center" spacing={1}><AccountTreeOutlined color="primary"/><span>Подбор кода ТН ВЭД</span></Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mt: .75 }}>Найдите товар по коду или названию либо пройдите по разделам классификатора.</Typography>
      <IconButton aria-label="Закрыть подбор ТН ВЭД" onClick={onClose} sx={{ position: 'absolute', right: 12, top: 12 }}><CloseRounded/></IconButton>
    </DialogTitle>
    <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
      {settings.isFetching && !settings.currentData && <LinearProgress aria-label="Проверка подключения ТКС"/>}
      {settings.error && <Alert severity="error" action={<Button color="inherit" onClick={() => void settings.refetch()}>Повторить</Button>}>{errorMessage(settings.error)}</Alert>}
      {settings.currentData?.isConfigured === false && <Alert severity="info">Справочник ТН ВЭД пока не подключён. Администратору нужно настроить клиентский сертификат ТКС на сервере. Код можно ввести вручную в поле продукции.</Alert>}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 1 }}>
        <TextField autoFocus fullWidth label="Код или название товара" placeholder="Например: 8479 или оборудование" value={query} disabled={!configured}
          onChange={event => changeQuery(event.target.value)} inputProps={{ maxLength: 200 }}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); setDebounced(query.trim()); } }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchRounded/></InputAdornment>,
            endAdornment: query ? <InputAdornment position="end"><IconButton size="small" aria-label="Очистить поиск ТН ВЭД" onClick={() => changeQuery('')}><CloseRounded/></IconButton></InputAdornment> : undefined }}/>
        {!!productName?.trim() && <Button type="button" variant="outlined" disabled={!configured} sx={{ flexShrink: 0, maxWidth: { sm: 230 } }} onClick={() => changeQuery(productName.trim().slice(0, 200))}>Искать по названию продукции</Button>}
      </Stack>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ my: 2, minWidth: 0 }}>
        {!searching && trail.length > 0 && <IconButton aria-label="На уровень выше в ТН ВЭД" onClick={back} size="small"><ArrowBackRounded/></IconButton>}
        <Breadcrumbs aria-label="Путь в классификаторе ТН ВЭД" sx={{ minWidth: 0, '& ol': { flexWrap: 'wrap' } }}>
          <Link component="button" type="button" underline="hover" onClick={root}>Все разделы</Link>
          {searching ? <Typography variant="body2">Результаты поиска</Typography> : [
            ...(origin ? [<Link key="search" component="button" type="button" underline="hover" onClick={() => { setTrail([]); changeQuery(origin); setOrigin(''); }}>Результаты поиска</Link>] : []),
            ...trail.map((node, i) => <Link key={node.id} component="button" type="button" underline="hover" sx={{ textAlign: 'left' }} onClick={() => { setTrail(trail.slice(0, i + 1)); setSelected(null); }}>{node.code ? formatCode(node.code) : node.text}</Link>),
          ]}
        </Breadcrumbs>
      </Stack>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.7fr) minmax(0, 1fr)' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden', minWidth: 0 }}>
          <Box sx={{ height: 3 }}>{loading && <LinearProgress aria-label="Загрузка кодов ТН ВЭД"/>}</Box>
          {configured && (!searching || validQuery) && result.error && !waiting && <Alert severity="error" sx={{ m: 1.5 }} action={<Button color="inherit" onClick={() => void result.refetch()}>Повторить</Button>}>{errorMessage(result.error)}</Alert>}
          {configured && searching && !validQuery && <Typography sx={{ p: 3 }} color="text.secondary">Введите минимум 2 символа для поиска.</Typography>}
          {configured && !loading && !result.error && data?.items.length === 0 && <Typography role="status" sx={{ p: 3 }} color="text.secondary">{searching ? 'Ничего не найдено. Уточните название, попробуйте часть кода или откройте все разделы.' : 'В этом разделе нет кодов. Вернитесь на уровень выше.'}</Typography>}
          <List aria-label={searching ? 'Найденные коды ТН ВЭД' : 'Разделы ТН ВЭД'} disablePadding sx={{ maxHeight: { xs: 300, md: 420 }, minHeight: 120, overflowY: 'auto' }}>
            {!loading && !result.error && data?.items.map(node => <ListItemButton disableRipple key={node.id} selected={selected?.id === node.id} disabled={!node.isActive && !node.hasChildren}
              onClick={() => node.hasChildren ? enter(node) : setSelected(node)} sx={{ gap: 1.5, py: 1.75, alignItems: 'flex-start', borderBottom: '1px solid', borderColor: 'divider' }}>
              {node.hasChildren ? <FolderOutlined color="primary" sx={{ mt: .25 }}/> : <CheckCircleOutlineRounded color={selected?.id === node.id ? 'primary' : 'disabled'} sx={{ mt: .25 }}/>}
              <Box sx={{ flex: 1, minWidth: 0 }}>
                {node.code && <Typography component="div" fontWeight={700} sx={{ fontVariantNumeric: 'tabular-nums', letterSpacing: '.04em' }}>{formatCode(node.code)}</Typography>}
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{node.text}</Typography>
                {(node.validFrom || node.validTo) && <Typography variant="caption" color={node.isActive ? 'text.secondary' : 'error.main'}>{node.isActive ? 'Действует' : 'Не действует'} {period(node)}</Typography>}
              </Box>
              {node.hasChildren && <ChevronRightRounded color="action"/>}
            </ListItemButton>)}
          </List>
          {data?.truncated && <Alert severity="info">Показаны первые 200 результатов. Уточните запрос.</Alert>}
        </Box>
        <Box component="section" aria-label="Выбранный код ТН ВЭД" sx={{ p: 2.5, border: '1px solid', borderColor: selected ? 'primary.main' : 'divider', borderRadius: 2, bgcolor: 'action.hover', minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">Код для продукции</Typography>
          {selected ? <>
            <Typography variant="h5" sx={{ mt: 1, fontVariantNumeric: 'tabular-nums', overflowWrap: 'anywhere' }}>{formatCode(selected.code!)}</Typography>
            <Chip size="small" color="success" variant="outlined" label="Полный код · 10 цифр" sx={{ my: 1.5 }}/>
            <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>{selected.text}</Typography>
            {period(selected) && <Typography variant="caption" component="p" color="text.secondary" sx={{ mt: 1 }}>Действует {period(selected)}</Typography>}
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Нажмите «Подставить код», чтобы заполнить поле ТН ВЭД.</Typography>
          </> : <>
            <Typography variant="subtitle1" sx={{ mt: 1 }}>Выберите конечный код</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>Открывайте папки, чтобы уточнить группу товара. Для подстановки выберите действующий код из 10 цифр.</Typography>
            {!!value && <Typography variant="body2" sx={{ mt: 2 }}>Сейчас в продукции: <strong>{value}</strong></Typography>}
          </>}
        </Box>
      </Box>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 2 }}>Источник: ТКС · ТН ВЭД ЕАЭС{data ? ` · Получено ${new Date(data.retrievedAt).toLocaleString('ru-RU')}${data.fromCache ? ' · из кэша' : ''}` : ''}</Typography>
    </DialogContent>
    <DialogActions sx={{ px: 3, py: 2, flexWrap: 'wrap', gap: 1 }}>
      <Button type="button" onClick={onClose}>Отмена</Button>
      <Button type="button" variant="contained" disabled={!selected?.isActive || selected.hasChildren || loading} onClick={() => { if (selected?.isActive && !selected.hasChildren) onSelect(selected); }}>Подставить код</Button>
    </DialogActions>
  </Dialog>;
}
