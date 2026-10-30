import { useState } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Stack, TextField, Typography } from '@mui/material';
import { useWorkspace } from './common';
import type { SaveDeclaration } from './types';
import { TnVedPicker } from './TnVedPicker';
import type { TnVedCode } from './tnvedApi';

export function DeclarationTnVedField({ readOnly }: { readOnly: boolean }) {
  const { firmId } = useWorkspace(); const { control, setValue } = useFormContext<SaveDeclaration>();
  const value = useWatch({ control, name: 'product.tnVed' });
  const productName = useWatch({ control, name: 'product.name' });
  const [selected, setSelected] = useState<TnVedCode | null>(null);
  return <Stack spacing={1}>
    <Controller control={control} name="product.tnVed" render={({ field, fieldState }) => <TextField {...field} label="Код ТН ВЭД" disabled={readOnly}
      inputProps={{ inputMode: 'numeric', maxLength: 10 }} error={!!fieldState.error} helperText={fieldState.error?.message ?? '4–10 цифр вручную или полный код из справочника'}/>}/>
    {!readOnly && <TnVedPicker firmId={firmId} value={value} productName={productName} onSelect={node => {
      setValue('product.tnVed', node.code!, { shouldDirty: true, shouldValidate: true }); setSelected(node);
    }}/>}
    {selected?.code === value && <Typography variant="caption" color="text.secondary">{selected.text}</Typography>}
  </Stack>;
}
