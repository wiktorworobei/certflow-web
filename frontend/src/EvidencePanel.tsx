import { useFormContext, useWatch } from 'react-hook-form';
import { Alert, Button, Checkbox, FormControlLabel, Grid, MenuItem, TextField, Typography } from '@mui/material';
import { AddRounded, DeleteOutlineRounded, FileDownloadOutlined } from '@mui/icons-material';
import { download } from './store';
import { Section, useNotify, useWorkspace } from './common';
import { errorMessage, type Attachment, type Declaration, type Report, type SaveDeclaration } from './types';
import { emptyDirection, emptyEvidence, emptyEvidenceDocument, emptyLaboratoryDetails, emptyReportDetails, type EvidenceDocument, type EvidenceWorkflow, type LaboratoryDirection, type ReportDetails } from './evidenceTypes';
import { LaboratoryFields } from './LaboratoryFields';
import { LaboratoryPicker } from './LaboratoryPicker';

function FileField({ value, files, disabled, label, onChange }: { value?: string | null; files: Attachment[]; disabled: boolean; label: string; onChange: (value: string | null) => void }) {
  return <TextField select label={label} value={value ?? ''} disabled={disabled} onChange={e => onChange(e.target.value || null)} helperText="Выберите файл из вкладки «Файлы и история»."><MenuItem value="">Не выбран</MenuItem>{files.map(f => <MenuItem key={f.id} value={f.id}>{f.fileName}</MenuItem>)}</TextField>;
}

function Documents({ values, onChange, files, readOnly, customs = false }: { values: EvidenceDocument[]; onChange: (value: EvidenceDocument[]) => void; files: Attachment[]; readOnly: boolean; customs?: boolean }) {
  const patch = (i: number, value: Partial<EvidenceDocument>) => onChange(values.map((d, n) => i === n ? { ...d, ...value } : d));
  return <><Typography variant="h6" sx={{ my: 2 }}>{customs ? 'Таможенное оформление образцов' : 'Другие доказательные документы'}</Typography>{values.map((d,i) => <div className="report-form" key={d.id}><Grid container spacing={2}>
    <Grid item xs={12} sm={6}><TextField label="Тип документа" select value={d.kind} disabled={readOnly} onChange={e => patch(i,{ kind: e.target.value })}>{(customs ? [['GTD','ДТ / ГТД'],['Other','Другой документ ввоза']] : [['TypeCertificate','Сертификат на тип продукции'],['ManagementCertificate','Сертификат системы менеджмента'],['TechnicalDocument','Технический документ'],['Other','Другой документ']]).map(([k,v]) => <MenuItem key={k} value={k}>{v}</MenuItem>)}</TextField></Grid>
    <Grid item xs={12} sm={6}><TextField label="Номер доказательного документа" value={d.number} disabled={readOnly} onChange={e => patch(i,{ number: e.target.value })}/></Grid>
    <Grid item xs={12} sm={6}><TextField type="date" InputLabelProps={{ shrink: true }} label="Дата доказательного документа" value={d.date ?? ''} disabled={readOnly} onChange={e => patch(i,{ date: e.target.value || null })}/></Grid>
    <Grid item xs={12} sm={6}><TextField label="Выдавший орган / организация" value={d.issuer} disabled={readOnly} onChange={e => patch(i,{ issuer: e.target.value })}/></Grid>
    <Grid item xs={12}><TextField label="Описание документа" value={d.description} multiline disabled={readOnly} onChange={e => patch(i,{ description: e.target.value })}/></Grid>
    <Grid item xs={12}><FileField label="Файл доказательного документа" value={d.attachmentId} files={files} disabled={readOnly} onChange={attachmentId => patch(i,{ attachmentId })}/></Grid>
    {!readOnly && <Grid item xs={12}><Button color="error" startIcon={<DeleteOutlineRounded/>} onClick={() => onChange(values.filter((_,n) => n !== i))}>Убрать документ</Button></Grid>}
  </Grid></div>)}{!readOnly && <Button startIcon={<AddRounded/>} onClick={() => onChange([...values,{ ...emptyEvidenceDocument(), kind: customs ? 'GTD' : 'Other' }])}>{customs ? 'Добавить таможенный документ' : 'Добавить доказательный документ'}</Button>}</>;
}

export function EvidencePanel({ readOnly, document, onFiles }: { readOnly: boolean; document?: Declaration; onFiles: () => void }) {
  const { firmId } = useWorkspace(); const notify = useNotify();
  const { control, setValue, formState: { isDirty } } = useFormContext<SaveDeclaration>();
  const values = useWatch({ control }); const reports = (values.reports ?? []) as Report[];
  const evidence: EvidenceWorkflow = { ...emptyEvidence(), requireScans: false, ...(values.evidence as EvidenceWorkflow | undefined) };
  const files = document?.attachments ?? [];
  const update = (p: Partial<EvidenceWorkflow>) => setValue('evidence', { ...evidence, ...p }, { shouldDirty: true });
  const report = (i: number, p: Partial<Report>) => setValue('reports', reports.map((r,n) => i === n ? { ...r, ...p } : r), { shouldDirty: true });
  const details = (i: number, p: Partial<ReportDetails>) => report(i,{ details: { ...emptyReportDetails(), ...reports[i].details, ...p } });
  const direction = (i: number, p: Partial<LaboratoryDirection>) => update({ directions: evidence.directions.map((d,n) => i === n ? { ...d, ...p } : d) });
  return <>
    <Section title="Основания и испытания" subtitle="Направления, образцы и выданные документы, на основании которых принимается декларация.">
      <Alert severity="info" sx={{ mb: 2 }}>Состав доказательств определяет специалист по применимому регламенту. Для схем ЕАЭС 3д, 4д и 6д проверяются сведения об аккредитации; для 5д — сертификат на тип. Эти проверки не заменяют внешнюю экспертизу.</Alert>
      <Grid container spacing={2}><Grid item xs={12}><TextField label="Нормативное основание и пояснение выбранной схемы" multiline minRows={2} value={evidence.legalBasis} disabled={readOnly} onChange={e => update({ legalBasis: e.target.value })}/></Grid>
      <Grid item xs={12}><TextField label="Стандарты и методы испытаний" multiline value={evidence.standards} disabled={readOnly} onChange={e => update({ standards: e.target.value })}/></Grid></Grid>
      <FormControlLabel control={<Checkbox checked={evidence.requireScans} disabled={readOnly} onChange={e => update({ requireScans: e.target.checked })}/>} label="Проверять наличие файлов протоколов, актов и других оснований"/>
      <FormControlLabel control={<Checkbox checked={evidence.requireAccreditation} disabled={readOnly} onChange={e => update({ requireAccreditation: e.target.checked })}/>} label="Дополнительно требовать аккредитованную лабораторию по регламенту"/>
      <Button onClick={onFiles}>Открыть файлы декларации</Button>
    </Section>
    <Section title="Направления в лаборатории" actions={!readOnly && <Button startIcon={<AddRounded/>} onClick={() => update({ directions: [...evidence.directions,emptyDirection()] })}>Добавить направление</Button>}>
      {!evidence.directions.length && <Typography color="text.secondary">Направления не добавлены. Полученные ранее протоколы можно указать отдельно ниже.</Typography>}
      {evidence.directions.map((d,i) => <div className="report-form" key={d.id}><Typography variant="h6" sx={{ mb: 2 }}>Направление {i+1}</Typography><Grid container spacing={2}>
        <Grid item xs={12} sm={6}><TextField label="Номер направления" value={d.number} disabled={readOnly} onChange={e => direction(i,{ number: e.target.value })}/></Grid>
        <Grid item xs={12} sm={6}><TextField label="Дата направления" type="date" InputLabelProps={{ shrink: true }} value={d.date ?? ''} disabled={readOnly} onChange={e => direction(i,{ date: e.target.value || null })}/></Grid>
        <Grid item xs={12}><LaboratoryPicker label="Лаборатория направления из справочника" disabled={readOnly} onPick={l => direction(i,{ laboratoryName:l.name,laboratoryAddress:l.address,accreditationNumber:l.accreditationNumber,
          laboratoryCountry:l.details?.country ?? '',laboratoryType:l.details?.type ?? 'Unknown',accreditationValidFrom:l.details?.validFrom ?? null,accreditationValidUntil:l.details?.validUntil ?? null,
          laboratoryCertificateDocument:l.details?.certificateDocument ?? '',laboratorySupplierCode:l.details?.supplierCode ?? '' })}/></Grid>
        <Grid item xs={12}><TextField label="Лаборатория направления" value={d.laboratoryName} disabled={readOnly} onChange={e => direction(i,{ laboratoryName: e.target.value })}/></Grid>
        <Grid item xs={12}><TextField label="Адрес лаборатории направления" value={d.laboratoryAddress} disabled={readOnly} onChange={e => direction(i,{ laboratoryAddress: e.target.value })}/></Grid>
        <Grid item xs={12}><TextField label="Аккредитация лаборатории направления" value={d.accreditationNumber} disabled={readOnly} onChange={e => direction(i,{ accreditationNumber: e.target.value })}/></Grid>
        <Grid item xs={12} sm={6}><TextField label="Страна лаборатории направления" value={d.laboratoryCountry ?? ''} disabled={readOnly} onChange={e => direction(i,{ laboratoryCountry:e.target.value })}/></Grid>
        <Grid item xs={12} sm={6}><TextField select label="Тип лаборатории направления" value={d.laboratoryType ?? 'Unknown'} disabled={readOnly} onChange={e => direction(i,{ laboratoryType:e.target.value as LaboratoryDirection['laboratoryType'] })}>{Object.entries({Unknown:'Не указан',Accredited:'Аккредитованная',NonAccredited:'Без аттестата',Manufacturer:'Лаборатория изготовителя'}).map(([key,label])=><MenuItem key={key} value={key}>{label}</MenuItem>)}</TextField></Grid>
        <Grid item xs={12} sm={6}><TextField type="date" InputLabelProps={{shrink:true}} label="Аттестат направления действует с" value={d.accreditationValidFrom ?? ''} disabled={readOnly} onChange={e => direction(i,{ accreditationValidFrom:e.target.value || null })}/></Grid>
        <Grid item xs={12} sm={6}><TextField type="date" InputLabelProps={{shrink:true}} label="Аттестат направления действует до" value={d.accreditationValidUntil ?? ''} disabled={readOnly} onChange={e => direction(i,{ accreditationValidUntil:e.target.value || null })}/></Grid>
        <Grid item xs={12} sm={6}><TextField label="Удостоверяющий документ направления" value={d.laboratoryCertificateDocument ?? ''} disabled={readOnly} onChange={e => direction(i,{ laboratoryCertificateDocument:e.target.value })}/></Grid>
        <Grid item xs={12} sm={6}><TextField label="Номер поставщика направления" value={d.laboratorySupplierCode ?? ''} disabled={readOnly} onChange={e => direction(i,{ laboratorySupplierCode:e.target.value })}/></Grid>
        <Grid item xs={12} sm={6}><TextField label="Номер акта отбора" value={d.samplingActNumber} disabled={readOnly} onChange={e => direction(i,{ samplingActNumber: e.target.value })}/></Grid>
        <Grid item xs={12} sm={6}><TextField label="Дата акта отбора" type="date" InputLabelProps={{ shrink: true }} value={d.samplingActDate ?? ''} disabled={readOnly} onChange={e => direction(i,{ samplingActDate: e.target.value || null })}/></Grid>
        <Grid item xs={12}><FileField label="Файл акта отбора" files={files} value={d.samplingActAttachmentId} disabled={readOnly} onChange={samplingActAttachmentId => direction(i,{ samplingActAttachmentId })}/></Grid>
        <Grid item xs={12}><TextField label="Комментарий для лаборатории" multiline value={d.comment} disabled={readOnly} onChange={e => direction(i,{ comment: e.target.value })}/></Grid>
      </Grid><Typography variant="h6" sx={{ my: 2 }}>Образцы</Typography>
        {d.samples.map((s,n) => <Grid container spacing={2} key={s.id} sx={{ mb: 3 }}><Grid item xs={12} sm={6}><TextField label="Название образца" value={s.name} disabled={readOnly} onChange={e => direction(i,{ samples:d.samples.map((v,k)=>k===n?{...v,name:e.target.value}:v) })}/></Grid>
        <Grid item xs={12} sm={6}><TextField label="Идентификация образца" value={s.identification} disabled={readOnly} onChange={e => direction(i,{ samples:d.samples.map((v,k)=>k===n?{...v,identification:e.target.value}:v) })}/></Grid>
        <Grid item xs={6} sm={3}><TextField label="Количество образцов" type="number" inputProps={{ min: 0.001, step:'any' }} value={s.quantity} disabled={readOnly} onChange={e => direction(i,{ samples:d.samples.map((v,k)=>k===n?{...v,quantity:Number(e.target.value)}:v) })}/></Grid>
        <Grid item xs={6} sm={3}><TextField label="Единица количества" value={s.unit} disabled={readOnly} onChange={e => direction(i,{ samples:d.samples.map((v,k)=>k===n?{...v,unit:e.target.value}:v) })}/></Grid>
        <Grid item xs={12} sm={6}><TextField label="Дата изготовления образца" type="date" InputLabelProps={{ shrink:true }} value={s.manufacturedAt ?? ''} disabled={readOnly} onChange={e => direction(i,{ samples:d.samples.map((v,k)=>k===n?{...v,manufacturedAt:e.target.value || null}:v) })}/></Grid>
        {!readOnly && <Grid item xs={12}><Button color="error" onClick={() => direction(i,{ samples:d.samples.filter((_,k)=>k!==n) })}>Убрать образец {n+1}</Button></Grid>}</Grid>)}
        {!readOnly && <Button startIcon={<AddRounded/>} onClick={() => direction(i,{ samples:[...d.samples,{ id:crypto.randomUUID(),name:'',identification:'',quantity:1,unit:'шт.',manufacturedAt:null }] })}>Добавить образец</Button>}
        <Documents values={d.customsDocuments} onChange={customsDocuments => direction(i,{ customsDocuments })} files={files} readOnly={readOnly} customs/>
        <div style={{ display:'flex',gap:12,flexWrap:'wrap',marginTop:16 }}>{document && <Button disabled={isDirty} startIcon={<FileDownloadOutlined/>} onClick={async()=>{try{await download(`/firms/${firmId}/declarations/${document.id}/directions/${d.id}/export`,`${d.number || 'direction'}.docx`);}catch(e){notify(errorMessage(e),'error');}}}>Скачать направление</Button>}
        {!readOnly && <Button color="error" disabled={reports.some(r=>r.details?.directionId===d.id)} onClick={() => update({ directions:evidence.directions.filter((_,n)=>n!==i) })}>Удалить направление</Button>}</div>
        {reports.some(r=>r.details?.directionId===d.id) && <Typography variant="body2" color="text.secondary">Перед удалением снимите связь направления с протоколами.</Typography>}
      </div>)}
    </Section>
    <Section title="Протоколы испытаний" actions={!readOnly && <Button startIcon={<AddRounded/>} onClick={() => setValue('reports',[...reports,{number:'',date:null,laboratoryName:'',accreditationNumber:'',details:emptyReportDetails()}],{shouldDirty:true})}>Добавить протокол</Button>}>
      {!reports.length && <Typography color="text.secondary">Протоколы пока не добавлены.</Typography>}
      {reports.map((r,i) => {const v={...emptyReportDetails(),...r.details}; return <div className="report-form" key={r.id ?? i}><Typography variant="h6" sx={{mb:2}}>Протокол {i+1}</Typography><Grid container spacing={2}>
        <Grid item xs={12} sm={6}><TextField label="Номер протокола" value={r.number} disabled={readOnly} onChange={e=>report(i,{number:e.target.value})}/></Grid>
        <Grid item xs={12} sm={6}><TextField label="Дата протокола" type="date" InputLabelProps={{shrink:true}} value={r.date ?? ''} disabled={readOnly} onChange={e=>report(i,{date:e.target.value || null})}/></Grid>
        <Grid item xs={12}><LaboratoryPicker label="Лаборатория из справочника" disabled={readOnly} onPick={l => report(i,{laboratoryName:l.name,accreditationNumber:l.accreditationNumber,details:{...v,...emptyLaboratoryDetails(),...l.details,laboratoryAddress:l.address,scopeConfirmed:false}})}/></Grid>
        <Grid item xs={12}><TextField label="Наименование лаборатории" value={r.laboratoryName} disabled={readOnly} onChange={e=>report(i,{laboratoryName:e.target.value})}/></Grid>
        <Grid item xs={12}><TextField label="Номер аккредитации" value={r.accreditationNumber} disabled={readOnly} onChange={e=>report(i,{accreditationNumber:e.target.value})}/></Grid>
        <Grid item xs={12}><TextField label="Адрес лаборатории протокола" value={v.laboratoryAddress} disabled={readOnly} onChange={e=>details(i,{laboratoryAddress:e.target.value})}/></Grid>
        <LaboratoryFields value={v} onChange={value=>details(i,value)} disabled={readOnly}/>
        <Grid item xs={12}><FormControlLabel control={<Checkbox checked={v.scopeConfirmed} disabled={readOnly} onChange={e=>details(i,{scopeConfirmed:e.target.checked})}/>} label="Специалист сверил область аккредитации с продукцией и методами испытаний"/></Grid>
        <Grid item xs={12}><TextField select label="Связанное направление" value={v.directionId ?? ''} disabled={readOnly} onChange={e=>details(i,{directionId:e.target.value || null})}><MenuItem value="">Ранее полученный протокол, без направления</MenuItem>{evidence.directions.map(d=><MenuItem value={d.id} key={d.id}>{d.number || 'Без номера'} · {d.laboratoryName}</MenuItem>)}</TextField></Grid>
        <Grid item xs={12}><FileField label="Файл протокола" files={files} value={v.attachmentId} disabled={readOnly} onChange={attachmentId=>details(i,{attachmentId})}/></Grid>
        <Grid item xs={12}><TextField label="Комментарий к протоколу" multiline value={v.comment} disabled={readOnly} onChange={e=>details(i,{comment:e.target.value})}/></Grid>
      </Grid>{!readOnly && <Button color="error" sx={{mt:2}} onClick={()=>setValue('reports',reports.filter((_,n)=>n!==i),{shouldDirty:true})}>Удалить протокол {i+1}</Button>}</div>;})}
      <Documents values={evidence.documents} onChange={documents=>update({documents})} files={files} readOnly={readOnly}/>
    </Section>
  </>;
}
