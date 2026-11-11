import { Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import { ErrorState, Loading, useWorkspace } from './common';
import { api } from './store';
import { dateTime, type Organization, type OrganizationRegistryChange } from './types';

const fieldLabels: Record<OrganizationRegistryChange['field'], string> = {
  name: 'Полное наименование', inn: 'ИНН', ogrn: 'ОГРН / ОГРНИП', kpp: 'КПП', country: 'Страна', address: 'Адрес',
  email: 'Электронная почта', phone: 'Телефон', signatory: 'ФИО подписанта', position: 'Должность подписанта',
  shortName: 'Сокращённое наименование', legalForm: 'Организационно-правовая форма', registrationDate: 'Дата регистрации',
  registrationAuthority: 'Регистрирующий орган', managerName: 'Руководитель', managerPosition: 'Должность руководителя',
  registryStatus: 'Статус организации', dataInvalid: 'Недостоверные сведения'
};
const statuses: Record<string, string> = { ACTIVE: 'Действующая', LIQUIDATING: 'Ликвидируется', LIQUIDATED: 'Ликвидирована', BANKRUPT: 'Банкротство', REORGANIZING: 'Реорганизация' };
function valueLabel(field: OrganizationRegistryChange['field'], value: string | null) {
  if (value === null || value.trim() === '') return 'Не указано';
  if (field === 'registryStatus') return statuses[value] ?? value;
  if (field === 'dataInvalid') return value === 'true' ? 'Да' : 'Нет';
  if (field === 'registrationDate' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value.split('-').reverse().join('.');
  return value;
}

export function OrganizationChangesDialog({ org, onClose, onRefresh }: { org: Organization; onClose: () => void; onRefresh: () => void }) {
  const { firmId, canEdit } = useWorkspace();
  const comparison = api.useOrganizationChangesQuery({ firmId, id: org.id }, { refetchOnMountOrArgChange: true });
  const data = comparison.currentData;
  return <Dialog open onClose={onClose} maxWidth="md" fullWidth aria-labelledby="organization-changes-title" PaperProps={{ sx: { m: { xs: 1.5, sm: 4 }, width: { xs: 'calc(100% - 24px)', sm: 'calc(100% - 64px)' } } }}>
    <DialogTitle id="organization-changes-title">Изменения в компании</DialogTitle>
    <DialogContent>
      <Typography sx={{ mb: 1 }}><strong>{data?.name ?? org.name}</strong></Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>Сравните сохранённые реквизиты с данными DaData перед обновлением. Просмотр не изменяет карточку и не снимает флаг.</Typography>
      {comparison.isFetching ? <Loading/> : comparison.error ? <ErrorState error={comparison.error} retry={() => void comparison.refetch()}/> : data && <>
        {data.checkedAt && <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Проверено {dateTime(data.checkedAt)}</Typography>}
        {data.error && <Alert severity="warning" sx={{ mb: 2 }}>{data.error}{data.detailsAvailable ? ' Показаны данные последней успешной проверки.' : ''}</Alert>}
        {!data.detailsAvailable ? <Alert severity="info" action={<Button onClick={() => void comparison.refetch()}>Повторить</Button>}>Не удалось получить подробности изменений. Повторите проверку позже.</Alert> : data.changes.length === 0 ? <Alert severity="info">По последней проверке отличий от сохранённой карточки нет. Флаг сохраняется до обновления пользователем.</Alert> : <>
          <TableContainer sx={{ display: { xs: 'none', sm: 'block' } }}><Table aria-label="Сравнение реквизитов компании" sx={{ tableLayout: 'fixed', '& th, & td': { whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', verticalAlign: 'top' } }}>
            <TableHead><TableRow><TableCell sx={{ width: '28%' }}>Поле</TableCell><TableCell>Старое значение (в карточке)</TableCell><TableCell>Новое значение (DaData)</TableCell></TableRow></TableHead>
            <TableBody>{data.changes.map(change => <TableRow key={change.field}>
              <TableCell component="th" scope="row">{fieldLabels[change.field] ?? change.field}{change.isManual && <Chip size="small" label="Ручное поле" sx={{ mt: 1 }}/>}</TableCell>
              <TableCell>{valueLabel(change.field, change.oldValue)}</TableCell><TableCell>{valueLabel(change.field, change.newValue)}</TableCell>
            </TableRow>)}</TableBody>
          </Table></TableContainer>
          <Box sx={{ display: { xs: 'grid', sm: 'none' }, gap: 2 }}>{data.changes.map(change => <Box key={change.field} sx={{ p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflowWrap: 'anywhere' }}>
            <Typography fontWeight={600}>{fieldLabels[change.field] ?? change.field}</Typography>{change.isManual && <Chip size="small" label="Ручное поле" sx={{ mt: 1 }}/>}
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>Старое значение (в карточке)</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{valueLabel(change.field, change.oldValue)}</Typography>
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>Новое значение (DaData)</Typography><Typography sx={{ whiteSpace: 'pre-wrap' }}>{valueLabel(change.field, change.newValue)}</Typography>
          </Box>)}</Box>
          {data.changes.some(change => change.isManual) && <Alert severity="info" sx={{ mt: 2 }}>Ручные поля останутся прежними, если при обновлении выбрать «Сохранить ручные поля».</Alert>}
        </>}
      </>}
    </DialogContent>
    <DialogActions sx={{ p: 2.5 }}><Button onClick={onClose}>Закрыть</Button>{canEdit && <Button variant="contained" disabled={comparison.isFetching || !data?.detailsAvailable || !!comparison.error} onClick={onRefresh}>Обновить компанию</Button>}</DialogActions>
  </Dialog>;
}
