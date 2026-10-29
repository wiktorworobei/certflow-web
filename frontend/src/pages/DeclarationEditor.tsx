import { EvidencePanel } from '../EvidencePanel';
import type { EvidenceWorkflow } from '../evidenceTypes';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Controller, FormProvider, useForm, useFormContext, useWatch, type Path } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Alert, Autocomplete, createFilterOptions, Button, Dialog, DialogActions, DialogContent, DialogTitle, Divider, Grid, IconButton, LinearProgress, Menu, MenuItem, Paper, Tab, Tabs, TextField, Tooltip, Typography } from '@mui/material';
import { ArrowBackRounded } from '@mui/icons-material';
import { SaveOutlined } from '@mui/icons-material';
import { DeleteOutlineRounded } from '@mui/icons-material';
import { FileDownloadOutlined } from '@mui/icons-material';
import { UploadFileOutlined } from '@mui/icons-material';
import { DescriptionOutlined } from '@mui/icons-material';
import { CheckCircleRounded } from '@mui/icons-material';
import { RadioButtonUncheckedRounded } from '@mui/icons-material';
import { KeyboardArrowDownRounded } from '@mui/icons-material';
import { ArchiveOutlined, UnarchiveOutlined } from '@mui/icons-material';
import { ArchiveDeclarationDialog } from '../ArchiveDeclarationDialog';
import { ArchiveSelectionDialog, type ArchiveSelection } from '../ArchiveSelectionDialog';
import { api, download } from '../store';
import { OrganizationLookup } from '../OrganizationLookup';
import { DeclarationProductCatalog } from '../DeclarationProductCatalog';
import { DeclarationTnVedField } from '../DeclarationTnVedField';
import { ErrorState, Loading, Section, StatusChip, useNotify, useWorkspace } from '../common';
import { dateTime, emptyDeclaration, errorMessage, statusLabels, type Declaration, type Party, type Product, type SaveDeclaration, type Status } from '../types';

const schema: yup.ObjectSchema<SaveDeclaration> = yup.object({
  evidence: yup.mixed<EvidenceWorkflow>().optional(),
  title: yup.string().trim().required('Укажите название документа').max(250), kind: yup.string().required(), scheme: yup.string().required(),
  applicant: yup.mixed<Party>().defined(), manufacturer: yup.mixed<Party>().defined(), product: yup.mixed<Product>().defined(),
  regulations: yup.array(yup.string().defined()).defined(), reports: yup.array(yup.mixed<import('../types').Report>().defined()).defined(),
  additionalInfo: yup.string().defined(), adoptedAt: yup.string().nullable().defined(), validUntil: yup.string().nullable().defined(), revision: yup.number().defined(),
});
const regulations = ['ТР ТС 004/2011 «О безопасности низковольтного оборудования»', 'ТР ТС 010/2011 «О безопасности машин и оборудования»', 'ТР ТС 017/2011 «О безопасности продукции лёгкой промышленности»', 'ТР ТС 020/2011 «Электромагнитная совместимость технических средств»', 'ТР ТС 025/2012 «О безопасности мебельной продукции»'];
const transitions: Record<Status, Status[]> = { Draft: ['InReview', 'Archived'], InReview: ['Ready', 'Draft', 'Archived'], Ready: ['Registered', 'Draft', 'Archived'], Registered: ['Suspended', 'Revoked', 'Archived'], Suspended: ['Registered', 'Revoked', 'Archived'], Revoked: ['Archived'], Archived: [] };

function Field({ name, label, multiline = false, type, required = false, helper, disabled = false, rows = 3 }: { name: Path<SaveDeclaration>; label: string; multiline?: boolean; type?: string; required?: boolean; helper?: string; disabled?: boolean; rows?: number }) {
  const { control } = useFormContext<SaveDeclaration>();
  return <Controller control={control} name={name} render={({ field, fieldState }) => <TextField {...field} value={field.value ?? ''} label={label} required={required} multiline={multiline} minRows={multiline ? rows : undefined} type={type} disabled={disabled} error={!!fieldState.error} helperText={fieldState.error?.message ?? helper} InputLabelProps={type === 'date' ? { shrink: true } : undefined} onChange={e => field.onChange(type === 'date' && e.target.value === '' ? null : e.target.value)}/>}/>;
}

function PartyPanel({ side, label, readOnly }: { side: 'applicant' | 'manufacturer'; label: string; readOnly: boolean }) {
  const { firmId } = useWorkspace(); const { data: organizations = [] } = api.useOrganizationsQuery(firmId);
  const { setValue, getValues, control } = useFormContext<SaveDeclaration>();
  const currentParty = useWatch({ control, name: side });
  return <Section title={label} subtitle="Выберите компанию из справочника или заполните сведения вручную. После подстановки можно изменить любые реквизиты, включая телефон и регистрирующий орган."><Grid container spacing={2.5}>
    <Grid item xs={12}><OrganizationLookup value={currentParty} directoryKind={side === 'applicant' ? 'Applicant' : 'Manufacturer'} disabled={readOnly} onApply={data => setValue(side, { ...getValues(side), ...data }, { shouldDirty: true })}/></Grid>
    <Grid item xs={12}><Autocomplete disabled={readOnly} options={organizations.filter(o => o.kind === 'Both' || o.kind === (side === 'applicant' ? 'Applicant' : 'Manufacturer'))} getOptionLabel={o => o.name} filterOptions={createFilterOptions({ stringify: (o: typeof organizations[number]) => `${o.name} ${o.shortName} ${o.inn} ${o.ogrn} ${o.kpp}` })} renderOption={(props, org) => <li {...props} key={org.id}><div><strong>{org.name}</strong><Typography variant="body2" color="text.secondary">ИНН {org.inn || '—'} · КПП {org.kpp || '—'}</Typography></div></li>} value={null} onChange={(_, org) => { if (org) { const { name, inn, ogrn, kpp, country, address, email, phone, signatory, position, shortName, legalForm, registrationDate, registrationAuthority, managerName, managerPosition } = org; setValue(side, { name, inn, ogrn, kpp, country, address, email, phone, signatory, position, shortName, legalForm, registrationDate, registrationAuthority, managerName, managerPosition } as Party, { shouldDirty: true }); } }} renderInput={params => <TextField {...params} label="Подставить из справочника" placeholder="Название, ИНН, ОГРН или КПП"/>} noOptionsText="Добавьте компанию в справочники"/></Grid>
    <Grid item xs={12}><Field name={`${side}.name`} label="Полное наименование" disabled={readOnly}/></Grid>
    <Grid item xs={12} sm={6}><Field name={`${side}.shortName`} label="Сокращённое наименование" disabled={readOnly}/></Grid><Grid item xs={12} sm={6}><Field name={`${side}.legalForm`} label="Организационно-правовая форма" disabled={readOnly}/></Grid>
    <Grid item xs={12} sm={4}><Field name={`${side}.registrationDate`} label="Дата регистрации организации" type="date" disabled={readOnly}/></Grid><Grid item xs={12} sm={8}><Field name={`${side}.registrationAuthority`} label="Регистрирующий орган" disabled={readOnly}/></Grid>
    <Grid item xs={12} sm={6}><Field name={`${side}.managerName`} label="Руководитель по данным источника" disabled={readOnly}/></Grid><Grid item xs={12} sm={6}><Field name={`${side}.managerPosition`} label="Должность руководителя" disabled={readOnly}/></Grid>
    <Grid item xs={12} sm={4}><Field name={`${side}.inn`} label="ИНН" disabled={readOnly}/></Grid><Grid item xs={12} sm={4}><Field name={`${side}.ogrn`} label="ОГРН / ОГРНИП" disabled={readOnly}/></Grid><Grid item xs={12} sm={4}><Field name={`${side}.kpp`} label="КПП" disabled={readOnly}/></Grid>
    <Grid item xs={12} sm={4}><Field name={`${side}.country`} label="Страна" disabled={readOnly}/></Grid><Grid item xs={12} sm={8}><Field name={`${side}.address`} label="Адрес" disabled={readOnly}/></Grid>
    <Grid item xs={12} sm={6}><Field name={`${side}.email`} label="Электронная почта" disabled={readOnly}/></Grid><Grid item xs={12} sm={6}><Field name={`${side}.phone`} label="Телефон" disabled={readOnly}/></Grid>
    {side === 'applicant' && <><Grid item xs={12} sm={6}><Field name="applicant.signatory" label="ФИО подписанта" disabled={readOnly}/></Grid><Grid item xs={12} sm={6}><Field name="applicant.position" label="Должность подписанта" disabled={readOnly}/></Grid></>}
  </Grid></Section>;
}


function FilesPanel({ document }: { document?: Declaration }) {
  const { getValues, setValue, formState: { isDirty } } = useFormContext<SaveDeclaration>();
  const { firmId, canEdit } = useWorkspace(); const notify = useNotify();
  const [upload, { isLoading: uploading }] = api.useUploadMutation(); const [remove, { isLoading: removing }] = api.useRemoveAttachmentMutation();
  const [deleting, setDeleting] = useState<{ id: string; name: string } | null>(null);
  async function uploadFile(file?: File) {
    if (!file || !document) return;
    if (file.size > 20 * 1024 * 1024) { notify('Файл должен быть не больше 20 МБ', 'error'); return; }
    try { const previousRevision = getValues('revision'); const result = await upload({ firmId, id: document.id, file }).unwrap(); if (previousRevision === document.revision && result.revision === previousRevision + 1) setValue('revision',result.revision,{shouldDirty:false}); notify('Файл добавлен'); } catch (e) { notify(errorMessage(e), 'error'); }
  }
  return <><Section title="Документы и сканы" subtitle="Протоколы, заявления и другие материалы к декларации.">
    {!document ? <Alert severity="info">Сохраните декларацию, чтобы прикрепить файлы.</Alert> : <>{canEdit && <Button component="label" className="file-dropzone" disabled={uploading} startIcon={<UploadFileOutlined/>}>{uploading ? 'Загружаем файл…' : 'Добавить файл'}<span>PDF, DOCX, PNG, JPEG · до 20 МБ</span><input type="file" hidden accept=".pdf,.docx,.png,.jpg,.jpeg" onChange={e => { void uploadFile(e.target.files?.[0]); e.target.value = ''; }}/></Button>}
      {document.attachments.map(file => <div className="attachment-row" key={file.id}><DescriptionOutlined sx={{ color: 'var(--accent-text)' }}/><div><strong>{file.fileName}</strong><span>{Math.max(1, Math.round(file.length / 1024))} КБ · {dateTime(file.createdAt)}</span></div><IconButton aria-label={`Скачать ${file.fileName}`} onClick={async () => { try { await download(`/firms/${firmId}/declarations/${document.id}/attachments/${file.id}`, file.fileName); } catch (e) { notify(errorMessage(e), 'error'); } }}><FileDownloadOutlined fontSize="small"/></IconButton>{canEdit && <IconButton aria-label={`Удалить ${file.fileName}`} disabled={removing || isDirty} onClick={() => setDeleting({ id: file.id, name: file.fileName })}><DeleteOutlineRounded fontSize="small"/></IconButton>}</div>)}
      {!document.attachments.length && <Typography color="text.secondary" sx={{ mt: 2 }}>Файлы ещё не добавлены.</Typography>}</>}
  </Section><Section title="История изменений">{document?.events.length ? <div className="document-history">{document.events.map((event, i) => <div key={`${event.occurredAt}-${i}`}><i/><div><strong>{event.description}</strong><span>{event.actor} · {dateTime(event.occurredAt)}</span></div></div>)}</div> : <Typography color="text.secondary">История появится после первого сохранения.</Typography>}</Section>
    <Dialog open={!!deleting} onClose={() => setDeleting(null)} maxWidth="xs" fullWidth><DialogTitle>Удалить файл?</DialogTitle><DialogContent><Typography>{deleting?.name}</Typography></DialogContent><DialogActions><Button onClick={() => setDeleting(null)}>Отмена</Button><Button color="error" disabled={removing || isDirty} onClick={async () => { if (!document || !deleting) return; try { await remove({ firmId, id: document.id, attachmentId: deleting.id }).unwrap(); setDeleting(null); notify('Файл удалён'); } catch (e) { notify(errorMessage(e), 'error'); } }}>Удалить</Button></DialogActions></Dialog>
  </>;
}

export function DeclarationEditor() {
  const { id } = useParams(); const navigate = useNavigate(); const notify = useNotify(); const { firmId, canEdit } = useWorkspace();
  const { data: document, isLoading, error, refetch } = api.useDeclarationQuery({ firmId, id: id ?? '' }, { skip: !id });
  const [save, { isLoading: saving }] = api.useSaveDeclarationMutation(); const [changeStatus, { isLoading: changing }] = api.useChangeStatusMutation();
  const form = useForm<SaveDeclaration>({ defaultValues: emptyDeclaration(), resolver: yupResolver(schema) });
  const { reset, handleSubmit, control, watch, formState: { isDirty } } = form;
  const dirty = useRef(isDirty); dirty.current = isDirty; const loadedId = useRef<string | undefined>(undefined);
  useEffect(() => { if (document && (!dirty.current || loadedId.current !== document.id)) { reset(document); loadedId.current = document.id; } }, [document, reset]);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) event.preventDefault(); }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload); }, []);
  const [tab, setTab] = useState(0); const [serverError, setServerError] = useState('');
  const [statusMenu, setStatusMenu] = useState<HTMLElement | null>(null); const [statusTarget, setStatusTarget] = useState<Status | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ArchiveSelection | null>(null);
  useEffect(() => { setRestoreTarget(null); }, [firmId, id]);
  const [reason, setReason] = useState(''); const [registrationNumber, setRegistrationNumber] = useState(''); const [registryUrl, setRegistryUrl] = useState(''); const [statusError, setStatusError] = useState('');
  const readOnly = !canEdit || !!document && document.status !== 'Draft' && document.status !== 'InReview';
  const values = watch();
  const checks = [
    ['Заявитель и его адрес', !!values.applicant?.name && !!values.applicant?.address],
    ['Изготовитель и его адрес', !!values.manufacturer?.name && !!values.manufacturer?.address],
    ['Продукция и ТН ВЭД', !!values.product?.name && !!values.product?.tnVed],
    ['Технические регламенты', !!values.regulations?.length],
    ['Основания декларации', document && !isDirty ? !document.missingRequirements.some(v => /протокол|аккредитац|образц|направлен|доказатель|сертификат на тип|скан|файл/i.test(v)) : !!values.reports?.length && values.reports.every(r => r.number && r.date && r.laboratoryName)],
  ] as const;
  const complete = checks.filter(c => c[1]).length;
  const close = () => { if (!isDirty || window.confirm('Изменения не сохранены. Покинуть карточку?')) navigate('/declarations'); };
  async function submit(data: SaveDeclaration) {
    setServerError('');
    try { const result = await save({ firmId, id, data }).unwrap(); reset(result); loadedId.current = result.id; notify('Декларация сохранена'); if (!id) navigate(`/declarations/${result.id}`, { replace: true }); }
    catch (e) { setServerError(errorMessage(e)); }
  }
  async function exportDocument(format: string) {
    if (!document) return;
    try { await download(`/firms/${firmId}/declarations/${document.id}/export/${format}`, `${document.reference}.${format}`); } catch (e) { notify(errorMessage(e), 'error'); }
  }
  async function confirmStatus() {
    if (!document || !statusTarget) return; setStatusError('');
    try { const result = await changeStatus({ firmId, id: document.id, status: statusTarget, revision: document.revision, reason, registrationNumber, registryUrl }).unwrap(); reset(result); setStatusTarget(null); notify('Статус обновлён'); }
    catch (e) { setStatusError(errorMessage(e)); }
  }
  if (isLoading) return <Loading/>;
  if (error) return <ErrorState error={error} retry={refetch}/>;
  if (!id && !canEdit) return <Alert severity="warning">У вас нет прав на создание документов.</Alert>;
  return <>
    <button className="back-link" onClick={close}><ArrowBackRounded sx={{ fontSize: 17 }}/>К реестру деклараций</button>
    {document?.status === 'Archived' && <Alert severity="info" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => navigate('/declarations?status=Archived')}>Открыть архив</Button>}>Декларация находится в архиве. Данные, файлы и история сохранены.</Alert>}
    {document && <Button variant="text" sx={{ mb: 2 }} disabled={isDirty} onClick={() => navigate(`/marking?declarationId=${document.id}`)}>Товары в ЧЗ и Нашей марке</Button>}
    <div className="editor-title"><div><div className="eyebrow">{document?.reference ?? 'НОВЫЙ ДОКУМЕНТ'}{document?.isSample && <span className="sample-label">Учебный пример</span>}</div><Typography variant="h4" component="h1">{document?.title ?? 'Новая декларация'}</Typography><div className="editor-title-meta"><StatusChip status={document?.status ?? 'Draft'}/><span>{document ? `Обновлено ${dateTime(document.updatedAt)}` : 'Заполните основные сведения и сохраните документ'}</span>{isDirty && <span className="unsaved-label">Есть изменения</span>}</div></div><div className="page-actions">
      {document && <Tooltip title={isDirty ? 'Сначала сохраните изменения' : 'Скачать информационный макет'}><span><Button variant="outlined" startIcon={<FileDownloadOutlined/>} disabled={isDirty} onClick={() => void exportDocument('docx')}>Word</Button></span></Tooltip>}
      {document && <Button variant="outlined" disabled={isDirty} onClick={() => void exportDocument('pdf')}>PDF</Button>}
      {document && <Button variant="outlined" disabled={isDirty} onClick={() => void exportDocument('zip')}>Комплект ZIP</Button>}
      {document && canEdit && document.status !== 'Archived' && <Tooltip title={isDirty ? 'Сначала сохраните изменения' : 'Убрать из рабочего списка, сохранив документ'}><span><Button variant="outlined" startIcon={<ArchiveOutlined/>} disabled={isDirty || saving || changing} onClick={() => setStatusTarget('Archived')}>В архив</Button></span></Tooltip>}
      {document && canEdit && document.status === 'Archived' && <Button variant="contained" startIcon={<UnarchiveOutlined/>} disabled={saving || changing} onClick={() => setRestoreTarget({ id: document.id, revision: document.revision, title: document.title })}>Восстановить из архива</Button>}
      {!readOnly && <Button variant="contained" startIcon={<SaveOutlined/>} disabled={saving} onClick={() => void handleSubmit(data => submit(data), () => { setTab(0); notify('Проверьте обязательные поля', 'error'); })()}>{saving ? 'Сохраняем…' : 'Сохранить'}</Button>}
    </div></div>
    {serverError && <Alert severity="error" onClose={() => setServerError('')} sx={{ mb: 2 }}>{serverError}</Alert>}
    {readOnly && canEdit && <Alert severity="info" sx={{ mb: 2 }}>Данные этого документа защищены от изменения. Для готовой декларации можно вернуться в черновик; зарегистрированный документ можно использовать как основу для копии.</Alert>}
    <FormProvider {...form}><div className="editor-grid"><div className="editor-main"><Paper className="editor-tabs"><Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto" aria-label="Разделы декларации">{['Сведения', 'Участники', 'Продукция', 'Испытания', 'Файлы и история'].map(label => <Tab label={label} key={label}/>)}</Tabs></Paper>
      {tab === 0 && <><Section title="Основные сведения" subtitle="Внутреннее название помогает найти документ в реестре."><Grid container spacing={2.5}>
        <Grid item xs={12}><Field name="title" label="Название декларации" required disabled={readOnly}/></Grid>
        <Grid item xs={12} sm={8}><Controller control={control} name="kind" render={({ field }) => <TextField {...field} label="Вид документа" select disabled={readOnly}>{['Декларация ТР ЕАЭС', 'Декларация ГОСТ Р', 'Декларация ТР РФ'].map(v => <MenuItem value={v} key={v}>{v}</MenuItem>)}</TextField>}/></Grid><Grid item xs={12} sm={4}><Field name="scheme" label="Схема декларирования" required disabled={readOnly}/></Grid>
        <Grid item xs={12}><Controller control={control} name="regulations" render={({ field }) => <Autocomplete multiple freeSolo options={regulations} value={field.value} disabled={readOnly} onChange={(_, value) => field.onChange(value)} renderInput={p => <TextField {...p} label="Технические регламенты / стандарты" helperText="Выберите из подборки или введите значение и нажмите Enter. Применимость проверяет специалист."/>}/>}/></Grid>
        <Grid item xs={12} sm={6}><Field name="adoptedAt" label="Дата принятия" type="date" disabled={readOnly}/></Grid><Grid item xs={12} sm={6}><Field name="validUntil" label="Действует до" type="date" disabled={readOnly}/></Grid>
        <Grid item xs={12}><Field name="additionalInfo" label="Дополнительные сведения" multiline disabled={readOnly}/></Grid>
      </Grid></Section>{document?.registrationNumber && <Section title="Регистрационные сведения"><Typography sx={{ fontWeight: 600 }}>{document.registrationNumber}</Typography>{document.registryUrl && <Button component="a" href={document.registryUrl} target="_blank" rel="noopener noreferrer" sx={{ mt: 1 }}>Открыть запись в реестре ↗</Button>}<Typography color="text.secondary" variant="body2" sx={{ mt: 1 }}>Сведения внесены вручную. Автоматическая проверка в ФГИС не выполнялась.</Typography></Section>}</>}
      {tab === 1 && <><PartyPanel side="applicant" label="Заявитель" readOnly={readOnly}/><PartyPanel side="manufacturer" label="Изготовитель" readOnly={readOnly}/></>}
      {tab === 2 && <Section title="Сведения о продукции" subtitle="Опишите продукцию и её идентификационные признаки."><Grid container spacing={2.5}>
        <Grid item xs={12}><DeclarationProductCatalog key={`${firmId}:${id ?? 'new'}`} readOnly={readOnly}/></Grid>
        <Grid item xs={12}><Field name="product.name" label="Наименование продукции" multiline disabled={readOnly}/></Grid><Grid item xs={12}><Field name="product.identification" label="Модель, марка, артикул и другие признаки" multiline disabled={readOnly}/></Grid>
        <Grid item xs={12} sm={4}><DeclarationTnVedField key={firmId} readOnly={readOnly}/></Grid><Grid item xs={12} sm={4}><Field name="product.okpd2" label="ОКПД2" disabled={readOnly}/></Grid><Grid item xs={12} sm={4}><Field name="product.gtin" label="GTIN" disabled={readOnly}/></Grid>
        <Grid item xs={12} sm={6}><Controller control={control} name="product.productionType" render={({ field }) => <TextField {...field} select label="Объект декларирования" disabled={readOnly}><MenuItem value="Serial">Серийный выпуск</MenuItem><MenuItem value="Batch">Партия</MenuItem><MenuItem value="Single">Единичное изделие</MenuItem></TextField>}/></Grid><Grid item xs={12} sm={6}><Field name="product.batchDetails" label="Сведения о партии / изделии" disabled={readOnly}/></Grid>
        <Grid item xs={12}><Field name="product.storageConditions" label="Условия хранения и эксплуатации" multiline disabled={readOnly}/></Grid>
      </Grid></Section>}
      {tab === 3 && <EvidencePanel readOnly={readOnly} document={document} onFiles={() => setTab(4)}/>}{tab === 4 && <FilesPanel document={document}/>}
    </div><aside className="editor-aside"><Paper className="checklist-card"><Typography variant="h6">Готовность документа</Typography><div className="checklist-progress"><strong>{complete}<span> / {checks.length}</span></strong><Typography variant="body2" color="text.secondary">разделов заполнено</Typography></div><LinearProgress variant="determinate" value={complete / checks.length * 100} sx={{ height: 6, borderRadius: 4, bgcolor: 'var(--accent-soft)', mb: 3 }}/>{checks.map(([label, ok]) => <div className="checklist-item" key={label}>{ok ? <CheckCircleRounded sx={{ color: 'var(--success)', fontSize: 18 }}/> : <RadioButtonUncheckedRounded sx={{ color: 'var(--faint)', fontSize: 18 }}/>}<span>{label}</span></div>)}<Divider sx={{ my: 2.5 }}/>{document && !isDirty && document.missingRequirements.length > 0 && <Alert severity="warning" sx={{mb:2}}><Typography variant="body2">Нужно дополнить:</Typography><ul>{document.missingRequirements.map(item => <li key={item}>{item}</li>)}</ul></Alert>}<Typography color="text.secondary" variant="body2">Базовые проверки помогают подготовить документ. Содержание и применимость требований проверяет специалист.</Typography>
      {document && canEdit && transitions[document.status].length > 0 && <Button variant="outlined" fullWidth endIcon={<KeyboardArrowDownRounded/>} sx={{ mt: 2.5 }} disabled={isDirty} onClick={e => setStatusMenu(e.currentTarget)}>Изменить статус</Button>}
    </Paper><div className="editor-hint"><DescriptionOutlined fontSize="small"/><p>Данные участников сохраняются в документе. Изменение справочника не переписывает ранее оформленные декларации.</p></div></aside></div></FormProvider>
    <Menu anchorEl={statusMenu} open={!!statusMenu} onClose={() => setStatusMenu(null)}>{document && transitions[document.status].map(status => <MenuItem key={status} onClick={() => { setStatusTarget(status); setStatusMenu(null); setReason(''); setRegistrationNumber(''); setRegistryUrl(''); setStatusError(''); }}>{status === 'Registered' && document.status === 'Ready' ? 'Учесть регистрацию' : status === 'Archived' ? 'В архив' : statusLabels[status]}</MenuItem>)}</Menu>
    {document && statusTarget === 'Archived' && <ArchiveDeclarationDialog declaration={document} onClose={() => setStatusTarget(null)} onArchived={result => reset(result)}/>}
    {restoreTarget && <ArchiveSelectionDialog key={`${firmId}:${id}`} entity="declarations" items={[restoreTarget]} action="restore" onClose={() => setRestoreTarget(null)} onComplete={() => void refetch()}/>}
    <Dialog open={!!statusTarget && statusTarget !== 'Archived'} onClose={() => !changing && setStatusTarget(null)} maxWidth="sm" fullWidth><DialogTitle>{statusTarget === 'Registered' && document?.status === 'Ready' ? 'Учесть регистрацию документа' : statusTarget ? statusLabels[statusTarget] : ''}</DialogTitle><DialogContent><Typography color="text.secondary" sx={{ mb: 2 }}>Изменение будет записано в историю декларации.</Typography>
      {statusTarget === 'Registered' && document?.status === 'Ready' && <><Alert severity="info" sx={{ mb: 2 }}>Укажите сведения уже зарегистрированного документа. Это действие не отправляет декларацию в ФГИС и не подтверждает регистрацию автоматически.</Alert><TextField label="Регистрационный номер" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} sx={{ mb: 2 }} required/><TextField label="HTTPS-ссылка на запись в реестре" value={registryUrl} onChange={e => setRegistryUrl(e.target.value)} sx={{ mb: 2 }}/></>}
      <TextField multiline minRows={3} label={statusTarget === 'Revoked' || statusTarget === 'Suspended' ? 'Причина (обязательно)' : 'Комментарий'} value={reason} onChange={e => setReason(e.target.value)} inputProps={{ maxLength: 2000 }}/>{statusError && <Alert severity="error" sx={{ mt: 2 }}>{statusError}</Alert>}
    </DialogContent><DialogActions sx={{ p: 2.5 }}><Button onClick={() => setStatusTarget(null)} disabled={changing}>Отмена</Button><Button variant="contained" disabled={changing} onClick={() => void confirmStatus()}>{changing ? 'Сохраняем…' : 'Подтвердить'}</Button></DialogActions></Dialog>
  </>;
}
