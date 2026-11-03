import { Alert, Button, Chip, Divider, Step, StepLabel, Stepper, Typography } from '@mui/material';
import { FileDownloadOutlined, Inventory2Outlined, OpenInNewRounded, SendOutlined } from '@mui/icons-material';
import { useFormContext } from 'react-hook-form';
import { Link as RouterLink } from 'react-router-dom';
import { fgisApi } from './fgisApi';
import { download } from './store';
import { ErrorState, Loading, Section, useNotify, useWorkspace } from './common';
import { dateTime, errorMessage, type Declaration, type SaveDeclaration } from './types';

export function FgisPublicationPanel({ document, onFiles }: { document?: Declaration; onFiles: () => void }) {
  const { firmId, canEdit } = useWorkspace(); const notify = useNotify();
  const { formState: { isDirty } } = useFormContext<SaveDeclaration>();
  const { data, isLoading, error, refetch } = fgisApi.useFgisReviewQuery({ firmId, id: document?.id ?? '' }, { skip: !document });
  const [prepare, { isLoading: preparing }] = fgisApi.usePrepareFgisMutation();
  if (!document) return <Section title="Публикация ФГИС"><Alert severity="info">Сначала сохраните декларацию и прикрепите документы во вкладке «Сканы».</Alert></Section>;
  if (isLoading) return <Loading/>;
  if (error) return <ErrorState error={error} retry={refetch}/>;
  const current = data?.preparationIsCurrent && !isDirty;
  return <Section title="Публикация ФГИС" subtitle="Подготовка комплекта для передачи черновика в кабинет заявителя. Подписание и регистрация — отдельные действия.">
    <Stepper activeStep={current ? 1 : 0} alternativeLabel sx={{ mb: 3 }}><Step completed={!!current}><StepLabel>Подготовить комплект</StepLabel></Step><Step><StepLabel>Передать черновик</StepLabel></Step><Step><StepLabel>Подписать в кабинете</StepLabel></Step></Stepper>
    <Alert severity="info" sx={{ mb: 2 }}>{data?.connectorMessage}</Alert>
    <Chip label={data?.connectorConfigured ? 'Коннектор настроен' : 'Коннектор не подключён'} size="small" variant="outlined" sx={{ mb: 2 }}/>
    {isDirty && <Alert severity="warning" sx={{ mb: 2 }}>Сохраните изменения перед проверкой и подготовкой комплекта.</Alert>}
    {!!data?.missingRequirements.length && <Alert severity="warning" sx={{ mb: 2 }}>Нужно дополнить:<ul>{data.missingRequirements.map(item => <li key={item}>{item}</li>)}</ul></Alert>}
    {!data?.missingRequirements.length && !isDirty && <Alert severity="success" sx={{ mb: 2 }}>Базовые проверки пройдены. Выбрано файлов: {data?.selectedFiles}. Проверьте применимость схемы, аккредитацию и содержание документов.</Alert>}
    {data?.preparation && <Alert severity={current ? 'success' : 'warning'} sx={{ mb: 2 }}>{current ? 'Комплект подготовлен' : 'Комплект устарел — подготовьте его заново'} · {dateTime(data.preparation.preparedAtUtc)} · {data.preparation.preparedBy}<br/>Версия {data.preparation.revision} · файлов {data.preparation.files.length}. Отправка и подписание не выполнялись.</Alert>}
    <div className="page-actions">
      <Button variant="outlined" onClick={onFiles}>Выбрать документы</Button>
      <Button variant="contained" startIcon={<Inventory2Outlined/>} disabled={!canEdit || isDirty || preparing || !data || !!data.missingRequirements.length} onClick={async () => { try { await prepare({ firmId, id: document.id, revision: document.revision }).unwrap(); notify('Комплект подготовлен. Отправка в ФГИС не выполнялась.'); } catch (e) { notify(errorMessage(e), 'error'); } }}>{preparing ? 'Проверяем файлы…' : 'Подготовить комплект'}</Button>
      <Button variant="outlined" startIcon={<FileDownloadOutlined/>} disabled={!current} onClick={async () => { try { await download(`/firms/${firmId}/declarations/${document.id}/fgis/package?revision=${document.revision}`, `${document.reference}-fgis-review.zip`); } catch (e) { notify(errorMessage(e), 'error'); } }}>Скачать комплект</Button>
      <Button variant="contained" startIcon={<SendOutlined/>} disabled>Отправить черновик в ФГИС</Button>
    </div>
    <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>ZIP содержит данные декларации, разделы, выбранные файлы, опись SHA-256 и макеты. Это комплект для проверки и ручной работы; его формат не подтверждён как формат импорта ФГИС.</Typography>
    <Divider sx={{ my: 3 }}/>
    <Typography variant="h6" sx={{ mb: 1 }}>Следующий шаг после подготовки</Typography>
    <Typography color="text.secondary">Перенесите сведения и приложите документы в кабинете заявителя, проверьте черновик и подпишите его своей электронной подписью. Скачанный архив не означает отправку или регистрацию.</Typography>
    <Button component="a" href="https://srd.fsa.gov.ru/srd" target="_blank" rel="noopener noreferrer" endIcon={<OpenInNewRounded/>} sx={{ mt: 2 }}>Открыть кабинет заявителя</Button>
    <Button component={RouterLink} to="/development-plan?module=fgis" sx={{ mt: 2 }}>План подключения ФГИС</Button>
  </Section>;
}
