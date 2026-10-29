import { useEffect, useRef, useState } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { SearchRounded } from '@mui/icons-material';
import { useWorkspace } from './common';
import { date, dateTime, type SaveDeclaration } from './types';
import { catalogIsoDate, catalogProductData, catalogProductFields as fields, importCatalogDeclaration } from './declarationCatalogImport';
import { catalogApiService } from './marking/lib/honest-sign/catalogApiService';
import type { DeclarationCatalogProduct as CatalogProduct } from './marking/lib/honest-sign/catalogTypes';
import type { PermitLookup } from './marking/lib/honest-sign/catalogPermitTypes';

export function DeclarationProductCatalog({ readOnly }: { readOnly: boolean }) {
  const { firmId } = useWorkspace();
  const { getValues, setValue, control } = useFormContext<SaveDeclaration>();
  const source = useWatch({ control, name: 'evidence.catalogDeclaration' });
  const [open, setOpen] = useState(false);
  const [gtin, setGtin] = useState(''); const [inn, setInn] = useState('');
  const [items, setItems] = useState<CatalogProduct[] | null>(null);
  const [error, setError] = useState(''); const [loading, setLoading] = useState(false);
  const [permits, setPermits] = useState<PermitLookup | null>(null);
  const [permitsError, setPermitsError] = useState(''); const [permitsLoading, setPermitsLoading] = useState(false);
  const [selected, setSelected] = useState(''); const [productIndex, setProductIndex] = useState(0);
  const [resultFirm, setResultFirm] = useState(''); const [searchedInn, setSearchedInn] = useState('');
  const pending = useRef<AbortController | null>(null); const pendingPermits = useRef<AbortController | null>(null);
  function abort() { pending.current?.abort(); pendingPermits.current?.abort(); }
  function clearSearch() {
    abort(); setLoading(false); setPermitsLoading(false); setItems(null); setPermits(null);
    setError(''); setPermitsError(''); setSelected(''); setProductIndex(0); setResultFirm('');
  }
  useEffect(() => { clearSearch(); setOpen(false); return abort; }, [firmId, readOnly]);
  function close() { abort(); setLoading(false); setPermitsLoading(false); setOpen(false); }
  async function loadPermits(productGtin: string, ownerInn: string) {
    pendingPermits.current?.abort();
    const controller = new AbortController(); pendingPermits.current = controller;
    setPermitsLoading(true); setPermits(null); setPermitsError(''); setSelected('');
    try {
      const response = await catalogApiService.permitsByProduct(firmId, productGtin, ownerInn, controller.signal);
      if (!controller.signal.aborted) setPermits(response);
    } catch (cause) {
      if (!controller.signal.aborted) setPermitsError(cause instanceof Error ? cause.message : 'Не удалось загрузить связанные декларации.');
    } finally { if (!controller.signal.aborted) setPermitsLoading(false); }
  }
  async function search() {
    if (readOnly) return;
    clearSearch();
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); const ownerInn = inn.trim();
    try {
      const result = await catalogApiService.lookupProduct(gtin.trim(), controller.signal);
      if (controller.signal.aborted) return;
      setItems(result); setResultFirm(firmId); setSearchedInn(ownerInn); setLoading(false);
      if (result.length) await loadPermits(result[0].gtin, ownerInn);
    } catch (cause) {
      if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Не удалось загрузить товар из ЧЗ.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  function applyProduct(item: CatalogProduct) {
    if (readOnly || resultFirm !== firmId) return;
    const values = catalogProductData(item);
    for (const [key] of fields) if (values[key]?.trim()) setValue(`product.${key}`, values[key]!, { shouldDirty: true, shouldValidate: true });
    if (source && source.gtin !== item.gtin) setValue('evidence.catalogDeclaration', null, { shouldDirty: true });
    close();
  }
  const declarations = permits?.documents.filter(document => document.attributeId === 23557) ?? [];
  const selectedDocument = selected === '' ? undefined : declarations[Number(selected)];
  const selectedProduct = items?.[productIndex];
  function applyDeclaration() {
    if (readOnly || resultFirm !== firmId || !selectedDocument || !selectedProduct || !permits || permitsLoading) return;
    const next = importCatalogDeclaration(getValues(), selectedProduct, selectedDocument, permits.retrievedAtUtc, searchedInn);
    for (const field of ['product', 'applicant', 'manufacturer', 'regulations', 'adoptedAt', 'validUntil', 'evidence'] as const)
      setValue(field, next[field], { shouldDirty: true, shouldValidate: true });
    close();
  }
  return <>
    <Box sx={{ p: 2.5, mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}>
      <Typography variant="subtitle1" fontWeight={600}>Товар из «Честного знака» или вручную</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>Найдите товар по GTIN, выберите связанную декларацию и проверьте сведения перед подстановкой.</Typography>
      {!readOnly && <Button variant="outlined" startIcon={<SearchRounded/>} onClick={() => { clearSearch(); setGtin(getValues('product.gtin') ?? ''); setInn(''); setOpen(true); }}>Выбрать товар из ЧЗ</Button>}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>Поиск требует подключения ЧЗ. Сведения о товаре сохраняются в декларации и доступны для ручного редактирования.</Typography>
      {source && <Box component="section" aria-label="Декларация-источник из НК" sx={{ mt: 2, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflowWrap: 'anywhere' }}>
        <Typography variant="subtitle2">Декларация-источник из НК: {source.number}</Typography>
        <Typography variant="body2">GTIN {source.gtin} · от {date(source.fromDate)} · действует до {date(source.toDate)}</Typography>
        <Typography variant="body2">Статус НК на момент загрузки: {source.status ?? 'НК не сообщил'}</Typography>
        <Typography variant="caption" component="p" color="text.secondary">Получено из НК: {dateTime(source.retrievedAtUtc)}</Typography>
        <Typography variant="caption" color="text.secondary">Номер источника хранится отдельно от регистрационного номера нашего документа.</Typography>
      </Box>}
    </Box>
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth aria-labelledby="declaration-product-search-title">
      <DialogTitle id="declaration-product-search-title">Выбрать товар из ЧЗ</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>Введите GTIN. Связанные декларации загружаются из опубликованной карточки НК; ИНН владельца можно указать для уточнения поиска.</Typography>
        <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} onSubmit={event => { event.preventDefault(); void search(); }}>
          <TextField label="GTIN для поиска в ЧЗ" value={gtin} autoFocus onChange={event => { clearSearch(); setGtin(event.target.value); }} inputProps={{ maxLength: 14, inputMode: 'numeric' }} helperText="8, 12, 13 или 14 цифр штрихкода"/>
          <TextField label="ИНН владельца карточки" value={inn} onChange={event => { clearSearch(); setInn(event.target.value); }} inputProps={{ maxLength: 12, inputMode: 'numeric', pattern: '([0-9]{10}|[0-9]{12})' }} helperText="Необязательно; 10 или 12 цифр"/>
          <Button type="submit" variant="contained" disabled={loading || !/^(\d{8}|\d{12,14})$/.test(gtin.trim()) || !!inn.trim() && !/^(\d{10}|\d{12})$/.test(inn.trim())} sx={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>{loading ? 'Ищем…' : 'Найти в ЧЗ'}</Button>
        </Stack>
        {loading && <LinearProgress sx={{ mt: 2 }}/>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error} Проверьте подключение и права в разделе «Маркировка → Честный знак». Ошибка запроса не означает, что карточки нет.</Alert>}
        {items?.length === 0 && <Alert severity="info" sx={{ mt: 2 }}>Для этого GTIN доступная карточка не найдена. Можно заполнить сведения о товаре вручную.</Alert>}
        {resultFirm === firmId && items?.map((item, index) => <Box key={`${item.gtin}-${index}`} sx={{ mt: 2, p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}><Typography variant="h6" sx={{ overflowWrap: 'anywhere' }}>{item.name || 'Товар без наименования'}</Typography><Chip size="small" label={`Статус НК: ${item.status}`}/></Stack>
          <Box component="dl" sx={{ m: 0 }}>{fields.filter(([key]) => catalogProductData(item)[key]).map(([key, label]) => <Box key={key} sx={{ mb: 1.5 }}><Typography component="dt" variant="caption" color="text.secondary">{label}</Typography><Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>{catalogProductData(item)[key]}</Typography></Box>)}</Box>
          <Alert severity="info" sx={{ mb: 2 }}>Подстановка заменит перечисленные поля декларации. Поля, отсутствующие в карточке, сведения о партии и участниках останутся без изменений.</Alert>
          <Button variant="outlined" onClick={() => applyProduct(item)}>Подставить данные товара</Button>
        </Box>)}
        {resultFirm === firmId && !!items?.length && <Box component="section" aria-label="Связанные декларации из ЧЗ" sx={{ mt: 3 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>Связанные декларации</Typography>
          {permitsLoading && <><Typography role="status">Загружаем связанные декларации…</Typography><LinearProgress sx={{ mt: 1 }}/></>}
          {permitsError && <Alert severity="error" action={<Button color="inherit" onClick={() => void loadPermits(items[0].gtin, searchedInn)}>Повторить загрузку деклараций</Button>}>{permitsError} Сведения о связанных документах пока не получены.</Alert>}
          {permits?.errors.map((item, index) => <Alert key={index} severity={item.registryRequestPending ? 'info' : 'warning'} sx={{ mt: 1 }}>{item.number && `${item.number}: `}{item.message}{item.registryRequestPending && ' НК запросил сведения в государственном реестре. Повторите загрузку позже.'}</Alert>)}
          {permits && !declarations.length && !permits.errors.length && <Alert severity="info">НК не вернул связанных деклараций о соответствии для этого GTIN. Можно подставить только данные товара.</Alert>}
          {!!declarations.length && <>
            {items.length > 1 && <TextField select label="Товар для подстановки" value={productIndex} onChange={event => setProductIndex(Number(event.target.value))} sx={{ mt: 2 }}>{items.map((item, index) => <MenuItem key={index} value={index}>{item.name || item.gtin}</MenuItem>)}</TextField>}
            <TextField select label="Декларация из ЧЗ" value={selected} onChange={event => setSelected(event.target.value)} sx={{ mt: 2 }} SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
              <MenuItem value="">Выберите декларацию</MenuItem>
              {declarations.map((item, index) => <MenuItem key={index} value={String(index)} sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>{item.number} · {item.fromDate || 'дата не указана'} · {item.status || 'статус не сообщён'}</MenuItem>)}
            </TextField>
          </>}
          {selectedDocument && <Box component="section" aria-label="Предпросмотр декларации из ЧЗ" sx={{ mt: 2, p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
            <Typography variant="subtitle1" fontWeight={600}>{selectedDocument.number}</Typography>
            <Box component="dl" sx={{ m: 0, mt: 2 }}>{([
              ['Статус НК', selectedDocument.status], ['Дата принятия', selectedDocument.fromDate], ['Действует до', selectedDocument.toDate],
              ['Наименование продукции', selectedDocument.productName], ['Идентификация продукции', selectedDocument.identification],
              ['ТН ВЭД', selectedDocument.tnved], ['Заявитель', selectedDocument.applicantName], ['Изготовитель', selectedDocument.manufacturerName], ['Технические регламенты', selectedDocument.regulations],
            ] as const).map(([label, value]) => <Box key={label} sx={{ mb: 1.5 }}><Typography component="dt" variant="caption" color="text.secondary">{label}</Typography><Typography component="dd" sx={{ m: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{value || 'НК не сообщил'}</Typography></Box>)}</Box>
            {selectedDocument.tnved && !/^\d{4,10}$/.test(selectedDocument.tnved.trim()) && <Alert severity="warning" sx={{ mb: 1 }}>НК вернул несколько кодов или нестандартный формат ТН ВЭД. Код из документа автоматически не переносится — уточните его в форме продукции.</Alert>}
            {(selectedDocument.fromDate && !catalogIsoDate(selectedDocument.fromDate) || selectedDocument.toDate && !catalogIsoDate(selectedDocument.toDate)) && <Alert severity="warning" sx={{ mb: 1 }}>Дата в неподдерживаемом формате не будет подставлена.</Alert>}
            <Alert severity="info" sx={{ mb: 2 }}>Будут подставлены товар, доступные даты, технические регламенты и наименования компаний выбранной декларации. При замене компании реквизиты прежней компании очищаются; их нужно дополнить. Номер и статус источника сохраняются отдельно. Протоколы, файлы и локальный статус документа сохраняются.</Alert>
            <Button variant="contained" disabled={permitsLoading || readOnly} onClick={applyDeclaration}>Подставить товар и выбранную декларацию</Button>
          </Box>}
        </Box>}
      </DialogContent>
      <DialogActions>
        {items?.length === 0 && <Button onClick={() => { if (!readOnly && resultFirm === firmId) setValue('product.gtin', gtin.trim().padStart(14, '0'), { shouldDirty: true }); close(); }}>Заполнить товар вручную</Button>}
        <Button onClick={close}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  </>;
}
