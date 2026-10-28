import { useEffect, useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, LinearProgress, Stack, TextField, Typography } from '@mui/material';
import { SearchRounded } from '@mui/icons-material';
import { useWorkspace } from './common';
import type { Product, SaveDeclaration } from './types';
import { catalogApiService } from './marking/lib/honest-sign/catalogApiService';
import type { CatalogProduct } from './marking/lib/honest-sign/catalogTypes';

const fields = [
  ['name', 'Наименование продукции'], ['identification', 'Модель, марка, артикул и другие признаки'],
  ['tnVed', 'ТН ВЭД'], ['okpd2', 'ОКПД2'], ['gtin', 'GTIN'], ['storageConditions', 'Условия хранения'],
] as const;
const productData = (item: CatalogProduct): Partial<Product> => ({
  name: item.name, identification: item.identification, tnVed: item.tnved,
  okpd2: item.okpd2, gtin: item.gtin, storageConditions: item.storageConditions,
});

export function DeclarationProductCatalog({ readOnly }: { readOnly: boolean }) {
  const { firmId } = useWorkspace();
  const { getValues, setValue } = useFormContext<SaveDeclaration>();
  const [open, setOpen] = useState(false);
  const [gtin, setGtin] = useState('');
  const [items, setItems] = useState<CatalogProduct[] | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), [firmId]);
  function close() { pending.current?.abort(); setLoading(false); setOpen(false); }
  async function search() {
    pending.current?.abort();
    const controller = new AbortController(); pending.current = controller;
    setLoading(true); setError(''); setItems(null);
    try {
      const result = await catalogApiService.products(gtin.trim(), controller.signal);
      if (!controller.signal.aborted) setItems(result);
    } catch (e) {
      if (!controller.signal.aborted) setError(e instanceof Error ? e.message : 'Не удалось загрузить товар из ЧЗ.');
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }
  function apply(item: CatalogProduct) {
    const values = productData(item);
    for (const [key] of fields) if (values[key]?.trim()) setValue(`product.${key}`, values[key]!, { shouldDirty: true, shouldValidate: true });
    close();
  }
  return <>
    <Box sx={{ p: 2.5, mb: 1, border: '1px solid', borderColor: 'divider', borderRadius: 2, bgcolor: 'action.hover' }}>
      <Typography variant="subtitle1" fontWeight={600}>Товар из «Честного знака» или вручную</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: .5, mb: 2 }}>Найдите существующую карточку по GTIN и подставьте её данные или заполните сведения о продукции вручную.</Typography>
      {!readOnly && <Button variant="outlined" startIcon={<SearchRounded/>} onClick={() => { setGtin(getValues('product.gtin') ?? ''); setItems(null); setError(''); setOpen(true); }}>Выбрать товар из ЧЗ</Button>}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1.5 }}>Поиск требует подключения ЧЗ. Сведения о товаре сохраняются в декларации и доступны для ручного редактирования.</Typography>
    </Box>
    <Dialog open={open} onClose={close} maxWidth="md" fullWidth aria-labelledby="declaration-product-search-title">
      <DialogTitle id="declaration-product-search-title">Выбрать товар из ЧЗ</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary" sx={{ mb: 2 }}>Введите GTIN товара. Будут показаны карточки, доступные через подключённый аккаунт Национального каталога.</Typography>
        <Stack component="form" direction={{ xs: 'column', sm: 'row' }} spacing={1.5} onSubmit={event => { event.preventDefault(); void search(); }}>
          <TextField label="GTIN для поиска в ЧЗ" value={gtin} autoFocus onChange={event => { pending.current?.abort(); setLoading(false); setGtin(event.target.value); setItems(null); setError(''); }} inputProps={{ maxLength: 14, inputMode: 'numeric' }} helperText="8, 12, 13 или 14 цифр штрихкода"/>
          <Button type="submit" variant="contained" disabled={loading || !/^(\d{8}|\d{12,14})$/.test(gtin.trim())} sx={{ alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>{loading ? 'Ищем…' : 'Найти в ЧЗ'}</Button>
        </Stack>
        {loading && <LinearProgress sx={{ mt: 2 }}/>}
        {error && <Alert severity="error" sx={{ mt: 2 }}>{error} Проверьте подключение и права в разделе «Маркировка → Честный знак». Ошибка запроса не означает, что карточки нет.</Alert>}
        {items?.length === 0 && <Alert severity="info" sx={{ mt: 2 }}>Для этого GTIN доступная карточка не найдена. Можно заполнить сведения о товаре вручную.</Alert>}
        {items?.map((item, index) => <Box key={`${item.gtin}-${index}`} sx={{ mt: 2, p: 2.5, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 2 }}><Typography variant="h6">{item.name || 'Товар без наименования'}</Typography><Chip size="small" label={`Статус НК: ${item.status}`}/></Stack>
          <Box component="dl" sx={{ m: 0 }}>{fields.filter(([key]) => productData(item)[key]).map(([key, label]) => <Box key={key} sx={{ mb: 1.5 }}><Typography component="dt" variant="caption" color="text.secondary">{label}</Typography><Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere' }}>{productData(item)[key]}</Typography></Box>)}</Box>
          <Alert severity="info" sx={{ mb: 2 }}>Подстановка заменит перечисленные поля декларации. Поля, отсутствующие в карточке, сведения о партии и участниках останутся без изменений.</Alert>
          <Button variant="contained" onClick={() => apply(item)}>Подставить данные товара</Button>
        </Box>)}
      </DialogContent>
      <DialogActions>
        {items?.length === 0 && <Button onClick={() => { setValue('product.gtin', gtin.trim().padStart(14, '0'), { shouldDirty: true }); close(); }}>Заполнить товар вручную</Button>}
        <Button onClick={close}>Закрыть</Button>
      </DialogActions>
    </Dialog>
  </>;
}
