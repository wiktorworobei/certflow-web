import { useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Stack, TextField, Typography } from '@mui/material';
import { useWorkspace } from './common';
import type { SaveDeclaration } from './types';
import { Okpd2Picker } from './Okpd2Picker';
import type { Okpd2Code } from './okpd2Api';

export function DeclarationOkpd2Field({ readOnly }: { readOnly: boolean }) {
  const { firmId } = useWorkspace(); const { control, setValue } = useFormContext<SaveDeclaration>();
  const value = useWatch({ control, name: 'product.okpd2' });
  const productName = useWatch({ control, name: 'product.name' });
  const [selected, setSelected] = useState<Okpd2Code | null>(null);
  return <Stack spacing={1}>
    <Controller control={control} name="product.okpd2" render={({ field, fieldState }) => <TextField {...field} label="ОКПД2" disabled={readOnly}
      error={!!fieldState.error} helperText={fieldState.error?.message ?? 'Введите код вручную или подберите через DaData'}/>}/>
    {!readOnly && <Okpd2Picker firmId={firmId} value={value} productName={productName} onSelect={code => {
      setValue('product.okpd2', code.code, { shouldDirty: true, shouldValidate: true }); setSelected(code);
    }}/>}
    {selected?.code === value && <Typography variant="caption" color="text.secondary">{selected.name}</Typography>}
  </Stack>;
}
