import { useId, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { emptyReportDetails, type LaboratoryDirection } from './evidenceTypes';
import { LaboratoryPicker } from './LaboratoryPicker';
import type { Laboratory, Report } from './types';

const normalized = (value: string) => value.trim().toLocaleLowerCase('ru');

function localDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function ProtocolBatchDialog({ directionId: initialDirectionId, directions, reports, disabled, onClose, onAdd }: {
  directionId: string;
  directions: LaboratoryDirection[];
  reports: Report[];
  disabled: boolean;
  onClose: () => void;
  onAdd: (reports: Report[]) => void;
}) {
  const titleId = useId();
  const [entry, setEntry] = useState('');
  const [date, setDate] = useState('');
  const [directionId, setDirectionId] = useState(initialDirectionId);
  const [laboratory, setLaboratory] = useState<Laboratory | null>(null);
  const direction = directions.find(item => item.id === directionId);
  const seen = new Set<string>();
  const numbers = entry.split(/[,\r\n]+/).map(number => number.trim()).filter(number => {
    const key = normalized(number);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const longNumber = numbers.some(number => number.length > 150);
  const laboratoryName = direction?.laboratoryName ?? laboratory?.name ?? '';
  const accreditationNumber = direction?.accreditationNumber ?? laboratory?.accreditationNumber ?? '';
  const existingNumbers = new Set(reports.filter(report =>
    report.date === date && ((direction && report.details?.directionId === direction.id) ||
      (normalized(report.laboratoryName) === normalized(laboratoryName) &&
        normalized(report.accreditationNumber) === normalized(accreditationNumber)))).map(report => normalized(report.number)));
  const newNumbers = numbers.filter(number => !existingNumbers.has(normalized(number)));
  const duplicateCount = numbers.length - newNumbers.length;
  const canAdd = !disabled && /^\d{4}-\d{2}-\d{2}$/.test(date) && !longNumber && newNumbers.length > 0 && (!directionId || !!direction);

  function addReports() {
    if (!canAdd) return;
    const details = emptyReportDetails();
    if (direction) {
      Object.assign(details, {
        directionId: direction.id,
        laboratoryAddress: direction.laboratoryAddress,
        country: direction.laboratoryCountry ?? '',
        type: direction.laboratoryType ?? 'Unknown',
        validFrom: direction.accreditationValidFrom ?? null,
        validUntil: direction.accreditationValidUntil ?? null,
        certificateDocument: direction.laboratoryCertificateDocument ?? '',
        supplierCode: direction.laboratorySupplierCode ?? '',
      });
    } else if (laboratory) {
      Object.assign(details, laboratory.details, { laboratoryAddress: laboratory.address });
    }
    onAdd(newNumbers.map(number => ({ number, date, laboratoryName, accreditationNumber, details: { ...details } })));
  }

  return <Dialog open onClose={onClose} aria-labelledby={titleId} maxWidth="sm" fullWidth>
    <DialogTitle id={titleId}>Внести протоколы списком</DialogTitle>
    <DialogContent>
      <Stack spacing={2} sx={{ pt: 1 }}>
        <TextField
          label="Номера протоколов" multiline minRows={3} autoFocus value={entry} disabled={disabled}
          onChange={event => setEntry(event.target.value)} error={longNumber}
          helperText={longNumber ? 'Номер протокола должен содержать не более 150 знаков.' : 'Укажите номера через запятую или с новой строки.'}
        />
        <Stack spacing={0.5}>
          <TextField
            label="Общая дата протоколов" type="date" InputLabelProps={{ shrink: true }} required
            value={date} disabled={disabled} onChange={event => setDate(event.target.value)} inputProps={{ max: '9999-12-31' }}
          />
          <Stack direction="row" spacing={1}>
            <Button type="button" size="small" disabled={disabled} onClick={() => setDate(localDate(0))}>Сегодня</Button>
            <Button type="button" size="small" disabled={disabled} onClick={() => setDate(localDate(1))}>Вчера</Button>
          </Stack>
        </Stack>
        <TextField select label="Общее направление" value={directionId} disabled={disabled} onChange={event => setDirectionId(event.target.value)}>
          <MenuItem value="">Без направления</MenuItem>
          {directions.map(item => <MenuItem key={item.id} value={item.id}>{item.number || 'Без номера'} · {item.laboratoryName || 'Лаборатория не указана'}</MenuItem>)}
        </TextField>
        {direction?.date && date && date < direction.date &&
          <Alert severity="warning">Дата протоколов раньше даты направления. Для ранее полученных протоколов выберите «Без направления».</Alert>}
        {direction ? <Typography variant="body2">Лаборатория направления: {direction.laboratoryName || 'Не указана'}</Typography> : <>
          <LaboratoryPicker label="Общая лаборатория из справочника" disabled={disabled} onPick={setLaboratory}/>
          {laboratory && <Typography variant="body2">Выбрана лаборатория: {laboratory.name}</Typography>}
        </>}
        {duplicateCount > 0 && <Alert severity="info">Уже добавлено протоколов с этими реквизитами: {duplicateCount}.</Alert>}
      </Stack>
    </DialogContent>
    <DialogActions>
      <Button type="button" onClick={onClose}>Отмена</Button>
      <Button type="button" variant="contained" disabled={!canAdd} onClick={addReports}>Добавить протоколы</Button>
    </DialogActions>
  </Dialog>;
}
