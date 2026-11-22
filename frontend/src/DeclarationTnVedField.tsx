import { useEffect, useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Stack, TextField, Typography } from '@mui/material';
import { useDispatch } from 'react-redux';
import { useWorkspace } from './common';
import type { AppDispatch } from './store';
import type { SaveDeclaration } from './types';
import { TnVedPicker } from './TnVedPicker';
import { declarationTnVedCodes } from './declarationTnVedCodes';
import { tnvedApi, type TnVedCode } from './tnvedApi';

const codeFormat = /^[0-9]{4,10}$/;
const inputHint = 'Введите до 30 кодов по 4–10 цифр через запятую или добавьте из справочника.';

export function DeclarationTnVedField({ readOnly }: { readOnly: boolean }) {
  const { firmId } = useWorkspace(); const { control, getValues, setValue } = useFormContext<SaveDeclaration>();
  const value = useWatch({ control, name: 'product.tnVed' });
  const productName = useWatch({ control, name: 'product.name' });
  const [selected, setSelected] = useState<TnVedCode | null>(null);
  const [verification, setVerification] = useState<{ key: string; missing: string[]; unavailable: boolean }>();
  const dispatch = useDispatch<AppDispatch>();
  const codes = declarationTnVedCodes(value);
  const raw = value?.trim();
  const tokens = raw ? raw.split(/[,;]|\r\n|[\r\n]/) : [];
  const formatInvalid = tokens.length > 30 || tokens.some(code => !codeFormat.test(code.trim()));
  const check = !readOnly && !formatInvalid && codes.length > 0;
  const settings = tnvedApi.useTnVedSettingsQuery(firmId, { skip: !check });
  const configured = check && settings.currentData?.isConfigured === true;
  const codeList = codes.join(',');
  const verificationKey = `${firmId}:${codeList}`;
  const currentCheck = verification?.key === verificationKey ? verification : undefined;

  useEffect(() => {
    if (!configured) return;
    let active = true;
    const timer = window.setTimeout(async () => {
      const requested = codeList.split(',');
      const results = await Promise.all(requested.map(query => dispatch(tnvedApi.endpoints.tnVedSearch.initiate(
        { firmId, query, page: 1, pageSize: 1 }, { subscribe: false },
      )).unwrap().catch(() => undefined)));
      if (active) setVerification({
        key: verificationKey,
        missing: requested.filter((code, index) => Array.isArray(results[index]?.items) && !results[index]?.items.some(row => row.code.startsWith(code))),
        unavailable: results.some(result => !Array.isArray(result?.items)),
      });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [codeList, configured, dispatch, firmId, verificationKey]);

  const missing = configured ? currentCheck?.missing ?? [] : [];
  let hint = inputHint;
  if (configured && !currentCheck) hint = 'Проверяем коды в справочнике ТН ВЭД…';
  if (check && (settings.isError || settings.currentData?.isConfigured === false || currentCheck?.unavailable))
    hint = 'Справочник ТН ВЭД недоступен. Коды можно сохранить в черновике.';
  if (missing.length) hint = `В справочнике ТН ВЭД не найдены коды: ${missing.join(', ')}. Проверьте их перед передачей в ФГИС.`;

  return <Stack spacing={1}>
    <Controller control={control} name="product.tnVed" render={({ field, fieldState }) => <TextField {...field} label="Код ТН ВЭД" disabled={readOnly}
      multiline inputProps={{ maxLength: 1000 }} error={!!fieldState.error || missing.length > 0 || formatInvalid && fieldState.isTouched} helperText={fieldState.error?.message ?? hint}/>}/>
    {!readOnly && <TnVedPicker firmId={firmId} value={value} productName={productName} append={codes.length > 0} disabled={codes.length >= 30} onSelect={node => {
      const current = declarationTnVedCodes(getValues('product.tnVed'));
      if (current.length >= 30 || current.includes(node.code)) return;
      setValue('product.tnVed', [...current, node.code].join(', '), { shouldDirty: true, shouldValidate: true });
      setSelected(node);
    }}/>}
    {selected && codes.includes(selected.code) && <Typography variant="caption" color="text.secondary">{selected.code} · {selected.text}</Typography>}
  </Stack>;
}
