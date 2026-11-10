import { DeclarationBuilder } from '../DeclarationBuilder';
import { declarationTabs, emptyWorkspace, type DeclarationWorkspace } from '../workspaceTypes';
import '../declarationWorkspace.css';
import type { EvidenceWorkflow } from '../evidenceTypes';
import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Menu, MenuItem, TextField, Tooltip, Typography } from '@mui/material';
import { ArrowBackRounded, SaveOutlined, FileDownloadOutlined, KeyboardArrowDownRounded, ArchiveOutlined, UnarchiveOutlined } from '@mui/icons-material';
import { ArchiveDeclarationDialog } from '../ArchiveDeclarationDialog';
import { ArchiveSelectionDialog, type ArchiveSelection } from '../ArchiveSelectionDialog';
import { api, download } from '../store';
import { ErrorState, Loading, StatusChip, useNotify, useWorkspace } from '../common';
import { dateTime, emptyDeclaration, errorMessage, statusLabels, type Party, type Product, type SaveDeclaration, type Status } from '../types';

const schema: yup.ObjectSchema<SaveDeclaration> = yup.object({
  evidence: yup.mixed<EvidenceWorkflow>().optional(),
  workspace: yup.mixed<DeclarationWorkspace>().optional(),
  title: yup.string().trim().required('Укажите название документа').max(250), kind: yup.string().required(), scheme: yup.string().required(),
  applicant: yup.mixed<Party>().defined(), manufacturer: yup.mixed<Party>().defined(), product: yup.mixed<Product>().defined(),
  regulations: yup.array(yup.string().defined()).defined(), reports: yup.array(yup.mixed<import('../types').Report>().defined()).defined(),
  additionalInfo: yup.string().defined(), adoptedAt: yup.string().nullable().defined(), validUntil: yup.string().nullable().defined(), revision: yup.number().defined(),
});
const transitions: Record<Status, Status[]> = { Draft: ['InReview', 'Archived'], InReview: ['Ready', 'Draft', 'Archived'], Ready: ['Registered', 'Draft', 'Archived'], Registered: ['Suspended', 'Revoked', 'Archived'], Suspended: ['Registered', 'Revoked', 'Archived'], Revoked: ['Archived'], Archived: [] };

function formValues(document?: SaveDeclaration): SaveDeclaration {
  const empty = emptyDeclaration();
  return { ...empty, ...document, title: document?.title ?? 'Новая декларация', applicant: { ...empty.applicant, ...document?.applicant }, manufacturer: { ...empty.manufacturer, ...document?.manufacturer }, product: { ...empty.product, ...document?.product },
    workspace: { ...emptyWorkspace(), ...document?.workspace, sections: Object.fromEntries(declarationTabs.map(([key]) => [key, { number: '', date: null, content: '', notes: '', completed: false, ...document?.workspace?.sections[key] }])) } };
}

// Use the response as the new baseline while keeping edits made during a request.
function keepNewerChanges(saved: unknown, submitted: unknown, current: unknown): unknown {
  if (JSON.stringify(submitted) === JSON.stringify(current)) return saved;
  if (Array.isArray(saved) && Array.isArray(submitted) && Array.isArray(current)) {
    return saved.length === submitted.length && submitted.length === current.length
      ? current.map((value, index) => keepNewerChanges(saved[index], submitted[index], value)) : current;
  }
  if (saved && submitted && current && typeof saved === 'object' && typeof submitted === 'object' && typeof current === 'object' && !Array.isArray(current)) {
    const result = { ...saved } as Record<string, unknown>;
    for (const [key, value] of Object.entries(current)) result[key] = keepNewerChanges((saved as Record<string, unknown>)[key], (submitted as Record<string, unknown>)[key], value);
    return result;
  }
  return current;
}

export function DeclarationEditor() {
  const { id: routeId } = useParams(); const id = routeId === 'new' ? undefined : routeId;
  const { firmId } = useWorkspace();
  return <DeclarationEditorForm key={`${firmId}:${id}`} id={id}/>;
}

function DeclarationEditorForm({ id }: { id?: string }) {
  const navigate = useNavigate(); const notify = useNotify(); const { firmId, canEdit } = useWorkspace();
  const { currentData: document, isLoading, error, refetch } = api.useDeclarationQuery({ firmId, id: id ?? '' }, { skip: !id });
  const [save, { isLoading: saving }] = api.useSaveDeclarationMutation(); const [changeStatus, { isLoading: changing }] = api.useChangeStatusMutation();
  const form = useForm<SaveDeclaration>({ defaultValues: formValues(), resolver: yupResolver(schema) });
  const { reset, handleSubmit, getValues, formState: { isDirty } } = form;
  const saveInFlight = useRef(false); const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const dirty = useRef(isDirty); dirty.current = isDirty; const loadedId = useRef<string | undefined>(undefined);
  useEffect(() => { if (document && !saveInFlight.current && (!dirty.current || loadedId.current !== document.id) && document.revision >= getValues('revision')) { reset(formValues(document)); loadedId.current = document.id; } }, [document, reset, getValues]);
  useEffect(() => { const beforeUnload = (event: BeforeUnloadEvent) => { if (dirty.current) event.preventDefault(); }; window.addEventListener('beforeunload', beforeUnload); return () => window.removeEventListener('beforeunload', beforeUnload); }, []);
  const [printReady, setPrintReady] = useState(false); const [exporting, setExporting] = useState(false); const [serverError, setServerError] = useState('');
  const [autosaving, setAutosaving] = useState(false); const [autosavedAt, setAutosavedAt] = useState<string>();
  useEffect(() => { if (!id) { reset(formValues()); loadedId.current = undefined; } }, [id, firmId, reset]);
  const [statusMenu, setStatusMenu] = useState<HTMLElement | null>(null); const [statusTarget, setStatusTarget] = useState<Status | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<ArchiveSelection | null>(null);
  useEffect(() => { setRestoreTarget(null); }, [firmId, id]);
  const [reason, setReason] = useState(''); const [registrationNumber, setRegistrationNumber] = useState(''); const [registryUrl, setRegistryUrl] = useState(''); const [statusError, setStatusError] = useState('');
  const readOnly = !canEdit || !!document && document.status !== 'Draft' && document.status !== 'InReview';
  const close = () => { if (!isDirty || window.confirm('Изменения не сохранены. Покинуть карточку?')) navigate('/declarations'); };
  async function submit(data: SaveDeclaration, submitted: SaveDeclaration, automatic = false) {
    if (saveInFlight.current || readOnly) return;
    saveInFlight.current = true;
    setServerError('');
    if (automatic) setAutosaving(true);
    try {
      const result = await save({ firmId, id, data }).unwrap();
      if (!mounted.current) return;
      const savedValues = formValues(result);
      const current = keepNewerChanges(savedValues, submitted, getValues()) as SaveDeclaration;
      reset(savedValues);
      if (JSON.stringify(current) !== JSON.stringify(savedValues)) reset(current, { keepDefaultValues: true });
      loadedId.current = result.id;
      if (automatic) setAutosavedAt(result.updatedAt); else notify('Декларация сохранена');
      if (!id) navigate(`/declarations/${result.id}`, { replace: true });
      return result;
    }
    catch (e) { if (mounted.current) setServerError(automatic ? `Не удалось автоматически сохранить декларацию. ${errorMessage(e)} Изменения остались в форме.` : errorMessage(e)); }
    finally { saveInFlight.current = false; if (mounted.current) setAutosaving(false); }
  }
  function saveForm(automatic = false) {
    const submitted = structuredClone(getValues());
    return handleSubmit(data => submit(data, submitted, automatic), () => {
      if (automatic) setServerError('Автосохранение не выполнено. Проверьте название, вид документа и схему декларирования. Изменения остались в форме.');
      else notify('Проверьте обязательные поля в деле декларации', 'error');
    })();
  }
  const autosave = useRef(() => {});
  autosave.current = () => {
    if (!id || !document || readOnly || !dirty.current || saveInFlight.current || saving || changing || exporting || statusTarget || restoreTarget || form.formState.isSubmitting) return;
    void saveForm(true);
  };
  useEffect(() => { const timer = window.setInterval(() => autosave.current(), 60_000); return () => window.clearInterval(timer); }, []);
  async function exportDocument(format: string) {
    if (exporting || saving || !printReady) return;
    const submitted = structuredClone(getValues());
    await handleSubmit(async data => {
      setExporting(true);
      try {
        const result = !document || isDirty ? await submit(data, submitted) : document;
        if (result) await download(`/firms/${firmId}/declarations/${result.id}/export/${format}?revision=${result.revision}`, `${result.reference}.${format}`);
      } catch (e) { notify(errorMessage(e), 'error'); }
      finally { setExporting(false); }
    }, () => notify('Проверьте обязательные поля в деле декларации.', 'error'))();
  }
  async function confirmStatus() {
    if (!document || !statusTarget) return; setStatusError('');
    try { const result = await changeStatus({ firmId, id: document.id, status: statusTarget, revision: document.revision, reason, registrationNumber, registryUrl }).unwrap(); reset(formValues(result)); setStatusTarget(null); notify('Статус обновлён'); }
    catch (e) { setStatusError(errorMessage(e)); }
  }
  if (isLoading && loadedId.current !== id) return <Loading/>;
  if (error && !document) return <ErrorState error={error} retry={refetch}/>;
  if (!id && !canEdit) return <Alert severity="warning">У вас нет прав на создание документов.</Alert>;
  return <FormProvider {...form}>
    <button className="back-link" onClick={close}><ArrowBackRounded sx={{ fontSize: 17 }}/>К реестру деклараций</button>
    {document?.status === 'Archived' && <Alert severity="info" sx={{ mb: 2 }} action={<Button color="inherit" onClick={() => navigate('/declarations?status=Archived')}>Открыть архив</Button>}>Декларация находится в архиве. Данные, файлы и история сохранены.</Alert>}
    {document && <Button variant="text" sx={{ mb: 2 }} disabled={isDirty} onClick={() => navigate(`/marking?declarationId=${document.id}`)}>Товары в ЧЗ и Нашей марке</Button>}
    <div className="editor-title"><div><div className="eyebrow">{document?.reference ?? 'НОВЫЙ ДОКУМЕНТ'}{document?.isSample && <span className="sample-label">Учебный пример</span>}</div><Typography variant="h4" component="h1">{document?.title ?? 'Новая декларация'}</Typography><div className="editor-title-meta"><StatusChip status={document?.status ?? 'Draft'}/><span>{document ? `Обновлено ${dateTime(document.updatedAt)}` : 'Заполните основные сведения и сохраните документ'}</span>{isDirty && <span className="unsaved-label">Есть изменения</span>}{!readOnly && <span role="status" aria-live="polite">{autosaving ? 'Автосохранение…' : autosavedAt ? `Автосохранено ${dateTime(autosavedAt)}` : 'Автосохранение каждую минуту'}</span>}</div></div><div className="page-actions">
      {['docx','pdf','zip'].map(format => <Button key={format} variant="outlined" startIcon={format === 'docx' ? <FileDownloadOutlined/> : undefined} disabled={!printReady || saving || exporting} onClick={() => void exportDocument(format)}>{format === 'docx' ? 'Word' : format === 'pdf' ? 'PDF' : 'Комплект ZIP'}</Button>)}
      {document && canEdit && document.status !== 'Archived' && <Tooltip title={isDirty ? 'Сначала сохраните изменения' : 'Убрать из рабочего списка, сохранив документ'}><span><Button variant="outlined" startIcon={<ArchiveOutlined/>} disabled={isDirty || saving || changing} onClick={() => setStatusTarget('Archived')}>В архив</Button></span></Tooltip>}
      {document && canEdit && document.status === 'Archived' && <Button variant="contained" startIcon={<UnarchiveOutlined/>} disabled={saving || changing} onClick={() => setRestoreTarget({ id: document.id, revision: document.revision, title: document.title })}>Восстановить из архива</Button>}
      {!readOnly && <Button variant="contained" startIcon={<SaveOutlined/>} disabled={saving || exporting} onClick={() => void saveForm()}>{saving ? 'Сохраняем…' : 'Сохранить'}</Button>}
    </div></div>
    {serverError && <Alert severity="error" onClose={() => setServerError('')} sx={{ mb: 2 }}>{serverError}</Alert>}
    {readOnly && canEdit && <Alert severity="info" sx={{ mb: 2 }}>Данные этого документа защищены от изменения. Для готовой декларации можно вернуться в черновик; зарегистрированный документ можно использовать как основу для копии.</Alert>}
    {document && canEdit && transitions[document.status].length > 0 && <Button variant="outlined" endIcon={<KeyboardArrowDownRounded/>} disabled={isDirty || saving || exporting} onClick={e => setStatusMenu(e.currentTarget)}>Изменить статус</Button>}
    {document && !isDirty && document.missingRequirements.length > 0 && <details className="builder-requirements"><summary>Нужно дополнить: {document.missingRequirements.length}</summary><ul>{document.missingRequirements.map(item => <li key={item}>{item}</li>)}</ul></details>}
    <DeclarationBuilder key={firmId} document={document} readOnly={readOnly} disabled={(saving && !autosaving) || exporting} onPreviewState={setPrintReady}/>
    <Menu anchorEl={statusMenu} open={!!statusMenu} onClose={() => setStatusMenu(null)}>{document && transitions[document.status].map(status => <MenuItem key={status} onClick={() => { setStatusTarget(status); setStatusMenu(null); setReason(''); setRegistrationNumber(''); setRegistryUrl(''); setStatusError(''); }}>{status === 'Registered' && document.status === 'Ready' ? 'Учесть регистрацию' : status === 'Archived' ? 'В архив' : statusLabels[status]}</MenuItem>)}</Menu>
    {document && statusTarget === 'Archived' && <ArchiveDeclarationDialog declaration={document} onClose={() => setStatusTarget(null)} onArchived={result => reset(formValues(result))}/>}
    {restoreTarget && <ArchiveSelectionDialog key={`${firmId}:${id}`} entity="declarations" items={[restoreTarget]} action="restore" onClose={() => setRestoreTarget(null)} onComplete={() => void refetch()}/>}
    <Dialog open={!!statusTarget && statusTarget !== 'Archived'} onClose={() => !changing && setStatusTarget(null)} maxWidth="sm" fullWidth><DialogTitle>{statusTarget === 'Registered' && document?.status === 'Ready' ? 'Учесть регистрацию документа' : statusTarget ? statusLabels[statusTarget] : ''}</DialogTitle><DialogContent><Typography color="text.secondary" sx={{ mb: 2 }}>Изменение будет записано в историю декларации.</Typography>
      {statusTarget === 'Registered' && document?.status === 'Ready' && <><Alert severity="info" sx={{ mb: 2 }}>Укажите сведения уже зарегистрированного документа. Это действие не отправляет декларацию в ФГИС и не подтверждает регистрацию автоматически.</Alert><TextField label="Регистрационный номер" value={registrationNumber} onChange={e => setRegistrationNumber(e.target.value)} sx={{ mb: 2 }} required/><TextField label="HTTPS-ссылка на запись в реестре" value={registryUrl} onChange={e => setRegistryUrl(e.target.value)} sx={{ mb: 2 }}/></>}
      <TextField multiline minRows={3} label={statusTarget === 'Revoked' || statusTarget === 'Suspended' ? 'Причина (обязательно)' : 'Комментарий'} value={reason} onChange={e => setReason(e.target.value)} inputProps={{ maxLength: 2000 }}/>{statusError && <Alert severity="error" sx={{ mt: 2 }}>{statusError}</Alert>}
    </DialogContent><DialogActions sx={{ p: 2.5 }}><Button onClick={() => setStatusTarget(null)} disabled={changing}>Отмена</Button><Button variant="contained" disabled={changing} onClick={() => void confirmStatus()}>{changing ? 'Сохраняем…' : 'Подтвердить'}</Button></DialogActions></Dialog>
  </FormProvider>;
}
