import { Button, Checkbox, FormControlLabel, Stack } from '@mui/material';
import { useFormContext, useWatch } from 'react-hook-form';
import { DeclarationField as Field } from './DeclarationFields';
import type { SaveDeclaration } from './types';

export function canRecordOpenValidity(kind: string | undefined, productionType: string | undefined) {
  return kind === 'Декларация ТР ЕАЭС' && productionType === 'Batch';
}

function lastDayOfTerm(adoptedAt: string | null, years: number) {
  if (!adoptedAt || !/^\d{4}-\d{2}-\d{2}$/.test(adoptedAt)) return;
  const date = new Date(`${adoptedAt}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.getUTCFullYear() + years > 9999) return;
  date.setUTCFullYear(date.getUTCFullYear() + years);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
}

export function DeclarationValidityFields({ readOnly }: { readOnly: boolean }) {
  const { control, setValue } = useFormContext<SaveDeclaration>();
  const adoptedAt = useWatch({ control, name: 'adoptedAt' });
  const kind = useWatch({ control, name: 'kind' });
  const productionType = useWatch({ control, name: 'product.productionType' });
  const validityNotEstablished = useWatch({ control, name: 'workspace.validityNotEstablished' });
  const showOpenValidity = canRecordOpenValidity(kind, productionType);
  const openValidity = showOpenValidity && validityNotEstablished === true;

  function changeOpenValidity(checked: boolean) {
    if (checked) setValue('validUntil', null, { shouldDirty: true });
    setValue('workspace.validityNotEstablished', checked, { shouldDirty: true });
  }

  return <div className="builder-field-stack">
    <Field name="adoptedAt" label="Дата принятия" type="date" disabled={readOnly}/>
    {showOpenValidity && <FormControlLabel label="Срок не установлен" control={
      <Checkbox checked={openValidity} disabled={readOnly} onChange={(_, checked) => changeOpenValidity(checked)}/>
    }/>}
    <Field name="validUntil" label="Действует до" type="date" disabled={readOnly || openValidity}/>
    {!readOnly && !openValidity && <Stack direction="row" flexWrap="wrap" useFlexGap gap={0.5} role="group" aria-label="Срок от даты принятия">
      {[1, 2, 3, 4, 5].map(years => {
        const expiry = lastDayOfTerm(adoptedAt, years);
        return <Button key={years} size="small" variant="outlined" disabled={!expiry}
          onClick={() => expiry && setValue('validUntil', expiry, { shouldDirty: true })}>+{years} {years === 1 ? 'год' : years === 5 ? 'лет' : 'года'}</Button>;
      })}
    </Stack>}
  </div>;
}
