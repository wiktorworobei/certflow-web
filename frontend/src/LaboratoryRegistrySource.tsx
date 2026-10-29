import { Alert, Box, Typography } from '@mui/material';
import { date, dateTime, type Laboratory } from './types';

export function LaboratoryRegistrySource({ lab }: { lab: Laboratory }) {
  const source = lab.registrySource; if (!source) return null;
  const original = source.original;
  return <Box sx={{ my: 2, minWidth: 0 }}>
    <Alert severity={lab.manuallyEditedFields?.length ? 'warning' : 'info'}>
      Данные из CSV, импортированы {dateTime(source.importedAtUtc)}. Это сохранённая выгрузка, текущий статус во ФГИС автоматически не проверен.
      {!!lab.manuallyEditedFields?.length && <Typography variant="body2">Есть ручные изменения: {lab.manuallyEditedFields.length}. {lab.manuallyEditedBy && `Изменил: ${lab.manuallyEditedBy}.`}</Typography>}
    </Alert>
    <Box component="details" sx={{ mt: 1 }}><Typography component="summary" sx={{ cursor: 'pointer' }}>Исходная запись CSV</Typography>
      <Box component="dl" sx={{ m: 0, mt: 1, '& dd': { m: 0, mb: 1, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }, '& dt': { color: 'text.secondary', fontSize: 12 } }}>
        {Object.entries({ 'Строка CSV': original.rowNumber, 'Страна': original.country, 'Номер национального реестра': original.nationalId,
          'Полное наименование': original.name, 'Статус в едином реестре': original.registryStatus, 'Статус аккредитации': original.accreditationStatus,
          'Аттестат': original.accreditationNumber, 'Регистрация аттестата': date(original.registeredAt), 'Действует до': date(original.validUntil),
          'Юридический адрес': original.legalAddress, 'Адрес деятельности': original.activityAddress, 'Руководитель': original.headName,
          'Телефон': original.phone, 'Продукция и регламенты': original.scope }).map(([key, value]) => <div key={key}><dt>{key}</dt><dd>{value || 'Не указано в выгрузке'}</dd></div>)}
      </Box><Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>SHA-256: {source.sha256}. Тип записи определён по наименованию и может требовать уточнения.</Typography>
    </Box>
  </Box>;
}
