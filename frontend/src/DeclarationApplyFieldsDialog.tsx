import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { Alert, Autocomplete, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, TextField, Typography } from '@mui/material';
import { useNotify, useWorkspace } from './common';
import { applicantAddressPrintKey } from './DeclarationFields';
import { declarationChoiceLabel, useDeclarationChoices } from './declarationReusePicker';
import { api } from './store';
import { errorMessage, type DeclarationRow, type Party, type SaveDeclaration } from './types';

interface FieldOption {
  key: string;
  group: string;
  label: string;
  value: (source: SaveDeclaration) => string | null | undefined;
}

const partyLabels: Record<keyof Party, string> = {
  phone: 'Телефон', email: 'Электронная почта', name: 'Полное наименование', shortName: 'Сокращённое наименование',
  legalForm: 'Организационно-правовая форма', inn: 'ИНН', ogrn: 'ОГРН / ОГРНИП', kpp: 'КПП', country: 'Страна',
  address: 'Адрес', signatory: 'ФИО подписанта', position: 'Должность подписанта', registrationDate: 'Дата регистрации',
  registrationAuthority: 'Регистрирующий орган', managerName: 'Руководитель', managerPosition: 'Должность руководителя',
};
const partyOptions = (side: 'applicant' | 'manufacturer', group: string): FieldOption[] =>
  (Object.keys(partyLabels) as (keyof Party)[]).map(key => ({ key: `${side}.${key}`, group, label: partyLabels[key], value: source => source[side][key] }));
const fieldOptions: FieldOption[] = [
  ...partyOptions('applicant', 'Заявитель'),
  { key: 'applicant.printAddress', group: 'Заявитель', label: 'Адрес для печатной формы', value: source => source.workspace?.printOverrides?.[applicantAddressPrintKey] },
  ...partyOptions('manufacturer', 'Изготовитель'),
  { key: 'application.authorizedRepresentativeAgreementNumber', group: 'Заявка и договор', label: 'Номер договора уполномоченного лица', value: source => source.workspace?.authorizedRepresentativeAgreementNumber },
];
const targetLimit = 100;
const fieldLabel = (field: FieldOption) => `${field.group} — ${field.label}`;

export function DeclarationApplyFieldsDialog({ declarationId, isDirty, prepareSource, refreshSource, onClose }: {
  declarationId: string;
  isDirty: boolean;
  prepareSource: () => Promise<number | undefined>;
  refreshSource: () => void;
  onClose: () => void;
}) {
  const { firmId } = useWorkspace();
  const { getValues } = useFormContext<SaveDeclaration>();
  const notify = useNotify();
  const [search, setSearch] = useState('');
  const [targets, setTargets] = useState<DeclarationRow[]>([]);
  const [fields, setFields] = useState<FieldOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [failure, setFailure] = useState<{ message: string; refresh?: boolean }>();
  const [apply] = api.useApplyDeclarationFieldsMutation();
  const choices = useDeclarationChoices(firmId, search, 'editable', declarationId);
  const source = getValues();

  async function submit() {
    if (!fields.length || !targets.length || submitting) return;
    setSubmitting(true);
    setFailure(undefined);
    try {
      const revision = await prepareSource();
      if (revision === undefined) {
        setFailure({ message: 'Не удалось подготовить исходный макет. Проверьте ошибки сохранения и повторите действие.' });
        return;
      }
      const result = await apply({ firmId, id: declarationId, revision,
        items: targets.map(({ id, revision }) => ({ id, revision })), fields: fields.map(field => field.key),
      }).unwrap();
      notify(result.count ? `Обновлено ${result.count} из ${targets.length} выбранных макетов` : 'В выбранных макетах уже указаны эти значения');
      onClose();
    } catch (error) {
      const status = (error as { status?: number })?.status;
      setFailure({ message: errorMessage(error), refresh: status === 409 || status === 404 });
    } finally {
      setSubmitting(false);
    }
  }

  return <Dialog open fullWidth maxWidth="sm" onClose={() => !submitting && onClose()} aria-labelledby="declaration-apply-fields-title">
    <DialogTitle id="declaration-apply-fields-title">Обновить поля в других макетах</DialogTitle>
    <DialogContent>
      <Stack spacing={2}>
        <DialogContentText>Выберите поля и макеты, в которые нужно перенести текущие значения.</DialogContentText>
        <Autocomplete multiple filterSelectedOptions options={fieldOptions} value={fields} disabled={submitting}
          groupBy={option => option.group} getOptionLabel={fieldLabel}
          renderOption={({ key, ...props }, option) => <li key={key} {...props} aria-label={fieldLabel(option)}>{option.label}</li>}
          noOptionsText="Поля не найдены" onChange={(_, value) => { setFields(value); setFailure(undefined); }}
          renderInput={params => <TextField {...params} label="Поля для обновления"/>}
        />
        <Autocomplete multiple filterSelectedOptions options={[...targets, ...choices.options.filter(row => !targets.some(target => target.id === row.id))]}
          value={targets} disabled={submitting} loading={choices.loading} loadingText="Ищем макеты…" noOptionsText="Редактируемые макеты не найдены"
          getOptionLabel={declarationChoiceLabel} isOptionEqualToValue={(a, b) => a.id === b.id} filterOptions={rows => rows}
          getOptionDisabled={() => targets.length >= targetLimit}
          onInputChange={(_, value) => setSearch(value)}
          onChange={(_, value) => { setTargets(value); setFailure(undefined); }}
          renderInput={params => <TextField {...params} label="Макеты для обновления" placeholder="Внутренний номер или название"
            inputProps={{ ...params.inputProps, maxLength: 200 }} helperText={targets.length === targetLimit ? `Выбрано максимум ${targetLimit} макетов` : undefined}/>}
        />
        {choices.error && <Alert severity="error" action={<Button onClick={choices.retry}>Повторить</Button>}>Не удалось найти макеты.</Alert>}
        {fields.length > 0 && <Stack component="dl" spacing={0.5} sx={{ m: 0 }}>
          {fields.map(field => <div key={field.key}>
            <Typography component="dt" variant="body2" color="text.secondary">{fieldLabel(field)}</Typography>
            <Typography component="dd" variant="body2" sx={{ m: 0, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{field.value(source)?.trim() || 'Очистить поле'}</Typography>
          </div>)}
        </Stack>}
        {isDirty && <Alert severity="info">Перед обновлением выбранных макетов будут сохранены изменения в текущем.</Alert>}
        {failure && <Alert severity="error" action={failure.refresh && <Button onClick={() => {
          setTargets([]); setFailure(undefined); choices.retry(); refreshSource();
        }}>Обновить список</Button>}>{failure.message}</Alert>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button disabled={submitting} onClick={onClose}>Отмена</Button>
      <Button variant="contained" disabled={submitting || !fields.length || !targets.length} onClick={() => void submit()}>
        {submitting ? 'Обновляем…' : 'Обновить выбранные макеты'}
      </Button>
    </DialogActions>
  </Dialog>;
}
