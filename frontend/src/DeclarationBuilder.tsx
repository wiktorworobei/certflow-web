import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Alert, Button, CircularProgress, LinearProgress, MenuItem, TextField, Typography } from '@mui/material';
import { ArrowForwardRounded, EditOutlined, RestartAltRounded } from '@mui/icons-material';
import { api } from './store';
import { apiUrl } from './apiUrl';
import { useWorkspace } from './common';
import { errorMessage, type Declaration, type DeclarationPrintLayout, type SaveDeclaration } from './types';
import { DeclarationField as Field, DeclarationParty } from './DeclarationFields';
import { DeclarationProductCatalog } from './DeclarationProductCatalog';
import { DeclarationTnVedField } from './DeclarationTnVedField';
import { DeclarationOkpd2Field } from './DeclarationOkpd2Field';
import { NormativeDocumentsField } from './NormativeDocumentsField';
import { EvidencePanel } from './EvidencePanel';
import { FilesPanel, InventoryPanel, WorkspaceSectionPanel } from './DeclarationWorkspacePanel';
import { FgisPublicationPanel } from './FgisPublicationPanel';
import './declarationBuilder.css';

type Group = 'applicant' | 'manufacturer' | 'product' | 'regulations' | 'evidence' | 'dates' | 'additional' | 'scheme' | 'appendices';
const groups: Record<Group, { title: string; keys: string[] }> = {
  applicant: { title: 'Заявитель', keys: ['Заявитель','Место нахождения и адрес места осуществления деятельности','Основной государственный регистрационный номер','Контактные сведения','в лице','Подпись заявителя'] },
  manufacturer: { title: 'Изготовитель', keys: ['Изготовитель','Место нахождения и адрес места осуществления деятельности по изготовлению продукции'] },
  product: { title: 'Продукция', keys: ['заявляет, что','Код (коды) ТН ВЭД ЕАЭС','production'] },
  regulations: { title: 'Технические регламенты', keys: ['соответствует требованиям'] },
  evidence: { title: 'Основания и испытания', keys: ['Декларация о соответствии принята на основании','Стандарты и методы испытаний','Нормативное основание'] },
  dates: { title: 'Срок действия', keys: ['Дата принятия декларации о соответствии','Декларация о соответствии действительна до'] },
  additional: { title: 'Дополнительная информация', keys: ['Дополнительная информация'] },
  scheme: { title: 'Схема и вид документа', keys: ['Схема декларирования соответствия'] },
  appendices: { title: 'Приложения', keys: ['appendix-products','appendix-addresses','appendix-standards','appendix-free'] },
};
const groupForKey = (key: string) => (Object.keys(groups) as Group[]).find(group => groups[group].keys.includes(key));
export function openDeclarationCase(id: string) {
  const element = document.getElementById(`declaration-case-${id}`); if (element instanceof HTMLDetailsElement) { element.open = true; element.scrollIntoView({ block: 'start', behavior: 'auto' }); }
}

export function DeclarationBuilder({ document: saved, readOnly, disabled, onPreviewState }: { document?: Declaration; readOnly: boolean; disabled: boolean; onPreviewState: (ready: boolean) => void }) {
  const form = useFormContext<SaveDeclaration>(); const { firmId } = useWorkspace();
  const values = useWatch({ control: form.control }) as SaveDeclaration;
  const [loadPreview] = api.useDeclarationPreviewMutation();
  const [preview, setPreview] = useState<DeclarationPrintLayout>(); const [failure, setFailure] = useState(''); const [pending, setPending] = useState(true); const [retry, setRetry] = useState(0);
  const [selected, setSelected] = useState<Group>('applicant'); const [selectedKey, setSelectedKey] = useState('Заявитель');
  const [editing, setEditing] = useState<{ key: string; text: string }>(); const contextRef = useRef<HTMLElement>(null);
  const signature = JSON.stringify({ title: values.title, kind: values.kind, scheme: values.scheme, applicant: values.applicant, manufacturer: values.manufacturer, product: values.product, regulations: values.regulations, reports: values.reports, additionalInfo: values.additionalInfo, adoptedAt: values.adoptedAt, validUntil: values.validUntil, evidence: values.evidence, workspace: values.workspace, revision: values.revision });
  const checks = [!!values.applicant?.name && !!values.applicant?.address, !!values.manufacturer?.name && !!values.manufacturer?.address, !!values.product?.name && !!values.product?.tnVed, !!values.regulations?.length, !!values.reports?.length && values.reports.every(r => r.number && r.date && r.laboratoryName), !!values.adoptedAt && !!values.validUntil];
  const count = checks.filter(Boolean).length;
  useEffect(() => {
    let active = true; let request: ReturnType<typeof loadPreview> | undefined;
    setPending(true); onPreviewState(false); setFailure('');
    const timer = window.setTimeout(() => {
      request = loadPreview({ firmId, id: saved?.id, data: JSON.parse(signature) });
      request.unwrap().then(result => { if (active) { setPreview(result); setPending(false); onPreviewState(true); } }).catch(error => { if (active) { setFailure(errorMessage(error)); setPending(false); } });
    }, 250);
    return () => { active = false; window.clearTimeout(timer); request?.abort(); };
  }, [signature, firmId, saved?.id, loadPreview, retry, onPreviewState]);
  useEffect(() => {
    // Source edits explicitly replace only the dependent print overrides; unrelated edits survive.
    const subscription = form.watch((_, { name }) => {
      if (!name || name.startsWith('workspace.printOverrides')) return;
      const group: Group | undefined = name.startsWith('applicant') ? 'applicant' : name.startsWith('manufacturer') ? 'manufacturer' : name.startsWith('product.storageConditions') || name === 'additionalInfo' || name.startsWith('workspace.sections.declaration.content') ? 'additional' : name.startsWith('product') ? 'product' : name.startsWith('regulations') ? 'regulations' : name.startsWith('reports') || name.startsWith('evidence') ? 'evidence' : name === 'adoptedAt' || name === 'validUntil' ? 'dates' : name === 'scheme' ? 'scheme' : undefined;
      const appendix = name.match(/^workspace\.sections\.(appendix-(?:products|addresses|standards|free))\.content$/)?.[1];
      const keys = appendix ? [appendix] : group ? groups[group].keys : [];
      const overrides = form.getValues('workspace.printOverrides'); if (!overrides || !keys.some(key => key in overrides)) return;
      const next = { ...overrides }; keys.forEach(key => delete next[key]); form.setValue('workspace.printOverrides', next, { shouldDirty: true });
    }); return () => subscription.unsubscribe();
  }, [form]);
  function choose(group: Group, key = groups[group].keys[0]) {
    setSelected(group); setSelectedKey(key); setEditing(undefined);
    if (window.matchMedia('(max-width: 900px)').matches) contextRef.current?.scrollIntoView({ block: 'start', behavior: 'auto' });
  }
  function next() { const order: Group[] = ['applicant','manufacturer','product','regulations','evidence','dates']; const start = order.indexOf(selected); for (let i = 1; i <= order.length; i++) { const index = (start + i) % order.length; if (!checks[index]) { choose(order[index]); return; } } choose('additional'); }
  function editText(key: string) { if (readOnly || disabled) return; const field = preview?.fields.find(f => f.key === key); if (field) setEditing({ key, text: field.text }); }
  function changeText(text: string) {
    if (!editing || readOnly || disabled) return; setEditing({ ...editing, text });
    const direct = { 'Заявитель': 'applicant.name', 'Изготовитель': 'manufacturer.name', 'Код (коды) ТН ВЭД ЕАЭС': 'product.tnVed', 'Схема декларирования соответствия': 'scheme' } as const;
    const path = direct[editing.key as keyof typeof direct];
    if (path) form.setValue(path, text, { shouldDirty: true });
    else if (editing.key.startsWith('appendix-')) {
      const key = editing.key as 'appendix-products'; const section = form.getValues(`workspace.sections.${key}`) ?? { number:'',date:null,content:'',notes:'' };
      form.setValue(`workspace.sections.${key}`, { ...section, content: text }, { shouldDirty: true }); resetOverride(editing.key);
    } else form.setValue('workspace.printOverrides', { ...form.getValues('workspace.printOverrides'), [editing.key]: text }, { shouldDirty: true });
  }
  function resetOverride(key: string) { const overrides = { ...form.getValues('workspace.printOverrides') }; delete overrides[key]; form.setValue('workspace.printOverrides', overrides, { shouldDirty: true }); }
  const selectedField = preview?.fields.find(field => field.key === selectedKey);
  const hasOverride = Object.hasOwn(values.workspace?.printOverrides ?? {}, selectedKey);
  return <div className="declaration-builder" aria-label="Конструктор декларации">
    <style>{`@font-face{font-family:'Declaration Serif';src:url('${apiUrl('/document-fonts/NotoSerif-Regular')}')}@font-face{font-family:'Declaration Serif';font-weight:700;src:url('${apiUrl('/document-fonts/NotoSerif-Bold')}')}@font-face{font-family:'Declaration Sans';src:url('${apiUrl('/document-fonts/NotoSans-Regular')}')}@font-face{font-family:'Declaration Sans';font-weight:700;src:url('${apiUrl('/document-fonts/NotoSans-Bold')}')}`}</style>
    <div className="builder-heading"><div><Typography component="h2" variant="h6">Соберите декларацию</Typography><p>Нажмите на фрагмент листа. Двойное нажатие — правка текста.</p></div><Button variant="outlined" endIcon={<ArrowForwardRounded/>} onClick={next} disabled={disabled}>Следующее поле</Button></div>
    <div className="builder-progress-label"><span role="status" aria-live="polite">{pending ? 'Обновляем документ…' : failure ? 'Макет требует проверки' : 'Экран, Word и PDF используют общий макет'}</span><span>{count} из 6 частей заполнено</span></div>
    <LinearProgress variant="determinate" value={count / 6 * 100}/>
    {failure && <Alert severity="error" action={<Button onClick={() => setRetry(v => v + 1)}>Повторить</Button>}>{failure} Последний показанный лист ещё не обновлён.</Alert>}
    <div className="builder-workspace">
      <div className="builder-sheets" aria-label="Листы декларации" aria-busy={pending}>
        {!preview && <div className="builder-empty-sheet"><CircularProgress size={24}/><p>{failure ? 'Не удалось сформировать документ' : 'Открываем декларацию…'}</p></div>}
        {preview?.pages.map((page, pageIndex) => {
          const zones = [...new Set(page.lines.map(line => line.key).filter((key): key is string => !!key && !!groupForKey(key)))].map(key => {
            const lines = page.lines.filter(line => line.key === key); const top = Math.min(...lines.map(line => line.y - line.size - 3)); const bottom = Math.max(...lines.map(line => line.y + 5));
            return { key, top, height: bottom - top, group: groupForKey(key)! };
          });
          return <div key={pageIndex} className="builder-sheet" style={{ aspectRatio: `${preview.width}/${preview.height}` }}>
            <svg viewBox={`0 0 ${preview.width} ${preview.height}`} role="img" aria-label={`Декларация о соответствии, страница ${pageIndex + 1}`}>
              {page.images.map((image,i) => <image key={i} href={`data:image/png;base64,${image.data}`} x={image.x} y={image.y} width={image.width} height={image.height}/>)}
              {zones.filter(zone => zone.key === selectedKey).map(zone => <rect key={zone.key} className="builder-selected-mark" x={44} y={zone.top} width={preview.width-88} height={zone.height} rx={2}/>)}
              {page.lines.map((line,i) => <text key={i} y={line.y} fontSize={line.size} fontFamily={line.family === 'Noto Serif' ? 'Declaration Serif' : 'Declaration Sans'}>{line.runs.map((run,j) => <tspan key={j} x={run.x} fontWeight={run.bold ? 700 : 400}>{run.text}</tspan>)}</text>)}
            </svg>
            {zones.map(zone => <button key={zone.key} type="button" className={`builder-hit${zone.key === selectedKey ? ' is-selected' : ''}`} aria-label={`Редактировать: ${preview.fields.find(f => f.key === zone.key)?.label ?? zone.key}`} aria-pressed={zone.key === selectedKey} style={{ top: `${zone.top/preview.height*100}%`, height: `${zone.height/preview.height*100}%` }} onClick={() => choose(zone.group,zone.key)} onDoubleClick={() => editText(zone.key)} disabled={disabled}/>)}
            {editing && zones.some(zone => zone.key === editing.key) && (() => { const zone = zones.find(zone => zone.key === editing.key)!; return <div className="builder-inline-editor" style={{ top: `${zone.top/preview.height*100}%` } as CSSProperties}><label htmlFor={`print-text-${pageIndex}`}>{selectedField?.label}</label><textarea id={`print-text-${pageIndex}`} aria-label={`Текст фрагмента: ${selectedField?.label}`} autoFocus disabled={readOnly || disabled} value={editing.text} maxLength={20000} rows={Math.min(12,Math.max(3,editing.text.split('\n').length))} onChange={event => changeText(event.target.value)} onKeyDown={event => { if (event.key === 'Escape' || event.key === 'Enter' && event.ctrlKey) setEditing(undefined); }}/><Button size="small" onClick={() => setEditing(undefined)}>Готово</Button></div>; })()}
          </div>;
        })}
        <div className="builder-sheet-actions"><Button size="small" onClick={() => choose('additional')}>+ Дополнительная информация</Button><Button size="small" onClick={() => choose('appendices')}>+ Приложение</Button></div>
      </div>
      <aside className="builder-context" ref={contextRef} aria-label="Выбранный фрагмент">
        <div className="eyebrow">ВЫ ЗАПОЛНЯЕТЕ</div><Typography variant="h6" component="h2">{groups[selected].title}</Typography>
        {selectedField && <div className="builder-print-actions"><Button size="small" startIcon={<EditOutlined/>} disabled={readOnly || disabled} onClick={() => editText(selectedKey)}>Текст на листе</Button>{hasOverride && <Button size="small" startIcon={<RestartAltRounded/>} disabled={readOnly || disabled} onClick={() => resetOverride(selectedKey)}>Из реквизитов</Button>}</div>}
        {hasOverride && <Alert severity="info">У этого фрагмента ручная формулировка. Изменение связанных реквизитов заменит её автоматически.</Alert>}
        {editing && !preview?.pages.some(page => page.lines.some(line => line.key === editing.key)) && <div className="builder-field-stack"><TextField label={`Текст фрагмента: ${selectedField?.label}`} value={editing.text} multiline minRows={3} autoFocus disabled={readOnly || disabled} onChange={event => changeText(event.target.value)} inputProps={{ maxLength: 20000 }}/><Button onClick={() => setEditing(undefined)}>Готово</Button></div>}
        <fieldset disabled={disabled} className="builder-context-fields">
          {(selected === 'applicant' || selected === 'manufacturer') && <DeclarationParty key={selected} side={selected} readOnly={readOnly}/>}
          {selected === 'product' && <div className="builder-field-stack"><DeclarationProductCatalog key={`${firmId}:${saved?.id ?? 'new'}`} readOnly={readOnly}/><Field name="product.name" label="Наименование продукции" multiline disabled={readOnly}/><Field name="product.identification" label="Модель, марка, артикул и другие признаки" multiline disabled={readOnly}/><DeclarationTnVedField readOnly={readOnly}/><DeclarationOkpd2Field readOnly={readOnly}/><Field name="product.gtin" label="GTIN" disabled={readOnly}/><Controller control={form.control} name="product.productionType" render={({field}) => <TextField {...field} select label="Объект декларирования" disabled={readOnly}><MenuItem value="Serial">Серийный выпуск</MenuItem><MenuItem value="Batch">Партия</MenuItem><MenuItem value="Single">Единичное изделие</MenuItem></TextField>}/><Field name="product.batchDetails" label="Сведения о партии / изделии" disabled={readOnly}/><Field name="product.storageConditions" label="Условия хранения и эксплуатации" multiline disabled={readOnly}/></div>}
          {selected === 'regulations' && <Controller control={form.control} name="regulations" render={({field}) => <NormativeDocumentsField firmId={firmId} value={field.value} disabled={readOnly} onChange={field.onChange}/>}/>}
          {selected === 'dates' && <div className="builder-field-stack"><Field name="adoptedAt" label="Дата принятия" type="date" disabled={readOnly}/><Field name="validUntil" label="Действует до" type="date" disabled={readOnly}/></div>}
          {selected === 'additional' && <div className="builder-field-stack"><Field name="additionalInfo" label="Дополнительные сведения" multiline disabled={readOnly}/><Field name="product.storageConditions" label="Условия хранения и эксплуатации" multiline disabled={readOnly}/><Field name="workspace.sections.declaration.content" label="Дополнительный текст к декларации" multiline disabled={readOnly}/></div>}
          {selected === 'scheme' && <div className="builder-field-stack"><Controller control={form.control} name="kind" render={({field}) => <TextField {...field} label="Вид документа" select disabled={readOnly}>{['Декларация ТР ЕАЭС','Декларация ГОСТ Р','Декларация ТР РФ'].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField>}/><Field name="scheme" label="Схема декларирования" required disabled={readOnly}/></div>}
          {selected === 'evidence' && <><p className="builder-context-note">Протоколы, лаборатории и доказательные документы находятся в деле под листом. Их реквизиты заполняют этот фрагмент.</p><Button onClick={() => openDeclarationCase('testing')}>Открыть основания и испытания</Button></>}
          {selected === 'appendices' && <div className="builder-field-stack">{(['appendix-products','appendix-addresses','appendix-standards','appendix-free'] as const).map((key,i) => <Field key={key} name={`workspace.sections.${key}.content`} label={['Приложение Продукция','Приложение Адреса','Приложение ГОСТы','Свободное приложение'][i]} multiline disabled={readOnly}/>)}</div>}
        </fieldset>
        <p className="builder-context-note">Изменения сразу попадают в документ. Сохраните декларацию, чтобы записать их в реестр.</p>
      </aside>
    </div>
    <section className="builder-case" aria-label="Дело декларации"><Typography variant="h6" component="h2">Дело декларации</Typography><p>Сведения для работы, файлы и подготовка комплекта — рядом с документом.</p>
      <details open id="declaration-case-main"><summary>Организация работы</summary><div className="builder-case-fields"><Field name="title" label="Название декларации" required disabled={readOnly || disabled}/><div className="builder-field-stack"><Controller control={form.control} name="kind" render={({field}) => <TextField {...field} label="Вид документа" select disabled={readOnly || disabled}>{['Декларация ТР ЕАЭС','Декларация ГОСТ Р','Декларация ТР РФ'].map(v => <MenuItem key={v} value={v}>{v}</MenuItem>)}</TextField>}/><Field name="scheme" label="Схема декларирования" required disabled={readOnly || disabled}/></div></div></details>
      <details id="declaration-case-testing"><summary>Основания, лаборатории и испытания</summary><EvidencePanel readOnly={readOnly || disabled} document={saved} onFiles={() => openDeclarationCase('scans')}/><WorkspaceSectionPanel section="testing" title="Анализ состояния производства" readOnly={readOnly || disabled}/></details>
      <details id="declaration-case-scans"><summary>Файлы и доказательные материалы</summary><FilesPanel document={saved} readOnly={readOnly || disabled}/></details>
      <details id="declaration-case-application"><summary>Заявка и документы</summary><WorkspaceSectionPanel section="application" title="Заявка и документы" contentLabel="Сведения о заявке, договоре и прилагаемых документах" numbered readOnly={readOnly || disabled}/></details>
      <details id="declaration-case-closure"><summary>Опись и закрытие дела</summary><InventoryPanel document={saved} onFiles={() => openDeclarationCase('scans')}/><WorkspaceSectionPanel section="closure" title="Закрытие дела" readOnly={readOnly || disabled}/></details>
      <details id="declaration-case-fgis"><summary>Подготовка к публикации ФГИС</summary><FgisPublicationPanel document={saved} onFiles={() => openDeclarationCase('scans')}/></details>
      <details id="declaration-case-foreign"><summary>Foreign</summary><WorkspaceSectionPanel section="foreign" title="Foreign" readOnly={readOnly || disabled}/></details>
      {!!Object.keys(values.workspace?.printOverrides ?? {}).length && <details><summary>Ручные формулировки на листе</summary>{Object.entries(values.workspace?.printOverrides ?? {}).map(([key,text]) => <div className="builder-override" key={key}><strong>{key}</strong><p>{text || '(пустой текст)'}</p><Button disabled={readOnly || disabled} onClick={() => resetOverride(key)}>Восстановить из реквизитов</Button></div>)}</details>}
    </section>
  </div>;
}
