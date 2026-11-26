import { useId } from 'react';
import { FormField } from './ui/form-field';
import { Input } from '../../components/ui/input';
import { Select } from './ui/select';
import {
  getUtilisationIndustryFields,
  type UtilisationIndustryValues,
} from '../../lib/honest-sign/utilisationIndustry';
import type { UtilisationCisType } from '../../lib/honest-sign/utilisationReport';

export function UtilisationIndustryFields({
  group,
  cis,
  values,
  disabled,
  onChange,
}: {
  group: string;
  cis: UtilisationCisType;
  values: UtilisationIndustryValues;
  disabled?: boolean;
  onChange: (values: UtilisationIndustryValues) => void;
}) {
  const id = useId();
  return getUtilisationIndustryFields(group, cis, values).map(({ key, label, required }) => (
    <FormField key={key} label={`${label}${required ? ' *' : ''}`} htmlFor={`${id}-${key}`}>
      {key === 'orderType' || key === 'usedInProduction' ? (
        <Select
          id={`${id}-${key}`}
          required={required}
          disabled={disabled}
          value={values[key] ?? ''}
          onChange={(event) => onChange({ ...values, [key]: event.target.value })}
        >
          <option value="">{key === 'orderType' ? 'Выберите тип' : 'По умолчанию'}</option>
          {key === 'orderType' ? (
            <>
              <option value="1">Для себя</option>
              <option value="2">Для владельца</option>
            </>
          ) : (
            <>
              <option value="0">Нет</option>
              <option value="1">Да</option>
            </>
          )}
        </Select>
      ) : (
        <Input
          id={`${id}-${key}`}
          type={key === 'documentDate' ? 'date' : 'text'}
          required={required}
          disabled={disabled}
          maxLength={256}
          value={values[key] ?? ''}
          onChange={(event) => onChange({ ...values, [key]: event.target.value })}
        />
      )}
    </FormField>
  ));
}
