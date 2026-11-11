import { useState } from 'react';
import { Alert, Box, Button, Chip, MenuItem, TextField, Typography } from '@mui/material';
import { marketplaceApi, type RegistrySection, type RegistryVerification as Verification } from './marketplaceApi';
import { dateTime, errorMessage, type Declaration } from './types';
import { useWorkspace } from './common';
import { Link as RouterLink } from 'react-router-dom';
import './registryChecks.css';

export const registrySections = [['rds', 'Декларации РФ'], ['rss', 'Сертификаты РФ'], ['reaeu', 'Документы ЕАЭС']] as const;
export function RegistryResult({ result }: { result: Verification }) {
  const doc = result.document;
  const statuses: Record<number, string> = { 6: 'Действует', 15: 'Приостановлен', 14: 'Прекращён', 11: 'Недействителен', 1: 'Архивный', 5: 'Выдано предписание', 10: 'Уведомление о прекращении', 16: 'Продлён', 3: 'Возобновлён' };
  function saveJson() { const url = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'registry-document.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); }
  return <Box className="registry-result" aria-live="polite">
    <div className="registry-result-heading"><Typography variant="h6" component="h3" sx={{ overflowWrap: 'anywhere' }}>{doc.numberDoc || 'Номер не указан'}</Typography><Chip label={result.statusLabel} variant="outlined"/>{result.statusInRussiaLabel && <Chip label={`На территории РФ: ${result.statusInRussiaLabel}`} variant="outlined"/>}</div>
    <dl className="registry-result-meta"><div><dt>Дата регистрации</dt><dd>{doc.regDate || 'Не указана'}</dd></div><div><dt>Действует по</dt><dd>{doc.endDate || 'Не указано'}</dd></div><div><dt>Изготовитель</dt><dd>{doc.manufacturerName || 'Не указан'}</dd></div><div><dt>Адрес изготовителя</dt><dd>{doc.manufacturerAddress || 'Не указан'}</dd></div></dl>
    {!!doc.products?.length && <div className="registry-result-block"><h3>Продукция</h3><ul>{doc.products.map((product, i) => <li key={i}>{product.productName || 'Наименование не указано'}{product.tnveds?.length ? ` · ТН ВЭД: ${product.tnveds.join(', ')}` : ''}{product.okpds?.length ? ` · ОКПД2: ${product.okpds.join(', ')}` : ''}</li>)}</ul></div>}
    {!!doc.techRegs?.length && <div className="registry-result-block"><h3>Технические регламенты</h3><Typography variant="body2">{doc.techRegs.join('; ')}</Typography></div>}
    {!!doc.statusChanges?.length && <div className="registry-result-block"><h3>История статусов реестра</h3>{doc.statusChanges.map((change, i) => <Typography key={i} variant="body2" sx={{ mb: 1 }}>{change.beginDate || 'Дата не указана'} · {change.idStatus == null ? 'Неизвестный статус' : statuses[change.idStatus] ?? `Статус ${change.idStatus}`}{change.basisSolutions?.length ? ` · ${change.basisSolutions.join('; ')}` : ''}</Typography>)}</div>}
    <div className="registry-form-actions">{result.registryUrl && <Button component="a" href={result.registryUrl} target="_blank" rel="noopener noreferrer" variant="outlined">Открыть карточку реестра</Button>}<Button onClick={saveJson}>Скачать сведения JSON</Button></div>
    <p className="registry-result-footnote">Проверено {dateTime(result.checkedAtUtc)}. Обновление источника: {doc.updated || 'не указано'}.</p>
  </Box>;
}

export function DeclarationRegistryCheck({ document, disabled }: { document: Declaration; disabled: boolean }) {
  const { firmId } = useWorkspace();
  const [section, setSection] = useState<RegistrySection>('rds'); const [regDate, setRegDate] = useState('');
  const [check, state] = marketplaceApi.useCheckDeclarationRegistryMutation();
  const result = state.data && state.originalArgs?.revision === document.revision && state.originalArgs.section === section && state.originalArgs.regDate === (regDate || undefined) ? state.data : undefined;
  return <Box sx={{ mt: 3 }}>
    <Typography variant="h6" sx={{ mb: 1 }}>Проверка по реестру Росаккредитации</Typography>
    <Typography color="text.secondary" sx={{ mb: 2 }}>Проверьте зарегистрированную декларацию по номеру {document.registrationNumber || 'из карточки'}. Результат можно сверить с сохранёнными данными декларации.</Typography>
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
      <TextField select label="Реестр" value={section} onChange={e => { setSection(e.target.value as RegistrySection); state.reset(); }} sx={{ minWidth: 220 }}>{registrySections.filter(([key]) => key !== 'rss').map(([key, label]) => <MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField>
      <TextField label="Дата регистрации (необязательно)" type="date" InputLabelProps={{ shrink: true }} value={regDate} onChange={e => { setRegDate(e.target.value); state.reset(); }} sx={{ minWidth: 260 }}/>
      <Button disabled={disabled || !document.registrationNumber || state.isLoading} onClick={() => void check({ firmId, id: document.id, revision: document.revision, section, regDate: regDate || undefined })}>{state.isLoading ? 'Проверяем…' : 'Проверить по реестру'}</Button>
    </Box>
    {!document.registrationNumber && <Alert severity="info" sx={{ mt: 2 }}>Укажите регистрационный номер декларации. Доступ к API настраивается в разделе «Настройки → Интеграции».</Alert>}
    <Button component={RouterLink} to="/registries" sx={{ mt: 2 }}>Поиск других документов и пакетные проверки</Button>
    {state.error && <Alert severity="error" sx={{ mt: 2 }}>{errorMessage(state.error)}</Alert>}
    {result && <RegistryResult result={result}/>}
  </Box>;
}
