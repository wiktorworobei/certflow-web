import { useEffect, useState, type ReactNode, type SyntheticEvent } from 'react';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Button, Chip, MenuItem, Tab, Tabs, TextField, Typography } from '@mui/material';
import { ChevronRightRounded, DescriptionOutlined, FactCheckOutlined, FolderOutlined, ScienceOutlined } from '@mui/icons-material';
import { DeclarationField as Field } from './DeclarationFields';
import { EvidencePanel } from './EvidencePanel';
import { FilesPanel, HistoryPanel, InventoryPanel, WorkspaceSectionPanel } from './DeclarationWorkspacePanel';
import { FgisPublicationPanel } from './FgisPublicationPanel';
import type { Declaration, SaveDeclaration } from './types';

const caseGroups = [
  { id: 'details', title: 'Данные дела', description: 'Организация работы и заявка', icon: <DescriptionOutlined/>, sections: ['main', 'application', 'foreign', 'history', 'wording'] },
  { id: 'testing', title: 'Испытания и основания', description: 'Протоколы, лаборатории, производство', icon: <ScienceOutlined/>, sections: ['testing'] },
  { id: 'files', title: 'Файлы и приложения', description: 'Сканы, приложения и опись', icon: <FolderOutlined/>, sections: ['scans', 'appendices', 'closure'] },
  { id: 'publication', title: 'Публикация', description: 'Комплект ФГИС и проверка реестра', icon: <FactCheckOutlined/>, sections: ['fgis'] },
] as const;
type CaseGroup = typeof caseGroups[number]['id'];
const openEvent = 'znaq:open-declaration-case';

export function openDeclarationCase(id: string) {
  window.dispatchEvent(new CustomEvent(openEvent, { detail: id }));
}

export function DeclarationCaseWorkspace({ document: saved, readOnly, disabled }: { document?: Declaration; readOnly: boolean; disabled: boolean }) {
  const form = useFormContext<SaveDeclaration>();
  const overrides = useWatch({ control: form.control, name: 'workspace.printOverrides' }) ?? {};
  const reports = useWatch({ control: form.control, name: 'reports' }) ?? [];
  const sections = useWatch({ control: form.control, name: 'workspace.sections' });
  const [group, setGroup] = useState<CaseGroup>('details');
  const [opened, setOpened] = useState<Record<string, boolean>>({ main: true, testing: true, scans: true, fgis: true });
  useEffect(() => {
    function open(event: Event) {
      const id = (event as CustomEvent<string>).detail;
      const target = caseGroups.find(item => item.sections.some(section => section === id)); if (!target) return;
      setGroup(target.id); setOpened(previous => ({ ...previous, [id]: true }));
      window.requestAnimationFrame(() => document.getElementById(`declaration-case-${id}`)?.scrollIntoView({ block: 'start', behavior: 'auto' }));
    }
    window.addEventListener(openEvent, open); return () => window.removeEventListener(openEvent, open);
  }, []);
  function state(id: string) {
    return { open: !!opened[id], onToggle: (event: SyntheticEvent<HTMLDetailsElement>) => { const isOpen = event.currentTarget.open; setOpened(previous => previous[id] === isOpen ? previous : { ...previous, [id]: isOpen }); } };
  }
  function block(id: string, title: string, description: string, children: ReactNode, badge?: string) {
    return <details {...state(id)} id={`declaration-case-${id}`} className="builder-case-block"><summary><ChevronRightRounded className="builder-case-chevron"/><span><strong>{title}</strong><small>{description}</small></span>{badge && <span className="builder-case-badge">{badge}</span>}</summary><div className="builder-case-block-content">{children}</div></details>;
  }
  function resetOverride(key: string) { const next = { ...form.getValues('workspace.printOverrides') }; delete next[key]; form.setValue('workspace.printOverrides', next, { shouldDirty: true }); }
  const locked = readOnly || disabled;
  return <section className="builder-case" aria-label="Дело декларации">
    <div className="builder-case-heading"><div><div className="eyebrow">РАБОЧИЕ МАТЕРИАЛЫ</div><Typography variant="h6" component="h2">Дело декларации</Typography><p>Выберите блок: сведения о работе, основания, вложения или подготовка к публикации.</p></div><div className="builder-case-counters"><Chip size="small" variant="outlined" label={`Протоколы: ${reports.length}`}/><Chip size="small" variant="outlined" label={`Файлы: ${saved?.attachments.length ?? 0}`}/></div></div>
    <Tabs className="builder-case-tabs" value={group} onChange={(_, value: CaseGroup) => setGroup(value)} variant="scrollable" scrollButtons="auto" allowScrollButtonsMobile aria-label="Блоки дела декларации">{caseGroups.map(item => <Tab key={item.id} id={`case-tab-${item.id}`} aria-controls={`case-panel-${item.id}`} aria-label={item.title} value={item.id} icon={item.icon} iconPosition="start" label={<span><strong>{item.title}</strong><small>{item.description}</small></span>}/>)}</Tabs>
    <div id="case-panel-details" role="tabpanel" aria-labelledby="case-tab-details" hidden={group !== 'details'}>
      {block('main', 'Организация работы', 'Название в реестре, вид документа и схема декларирования.', <div className="builder-case-fields"><div className="builder-field-group"><Typography component="h3">Карточка документа</Typography><Field name="title" label="Название декларации" required disabled={locked}/><p>По этому названию вы найдёте декларацию в рабочем реестре.</p></div><div className="builder-field-group"><Typography component="h3">Вид и схема</Typography><Controller control={form.control} name="kind" render={({ field }) => <TextField {...field} label="Вид документа" select disabled={locked}>{['Декларация ТР ЕАЭС', 'Декларация ГОСТ Р', 'Декларация ТР РФ'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}</TextField>}/><Field name="scheme" label="Схема декларирования" required disabled={locked}/></div></div>)}
      {block('application', 'Заявка и договор', 'Реквизиты заявки, договор и сведения о прилагаемых документах.', <WorkspaceSectionPanel embedded section="application" title="Заявка и документы" contentLabel="Сведения о заявке, договоре и прилагаемых документах" numbered readOnly={locked}/>, sections?.application?.number || undefined)}
      {block('foreign', 'Иностранные документы', 'Переводы и дополнительные сведения по иностранным документам.', <WorkspaceSectionPanel embedded section="foreign" title="Иностранные документы" contentLabel="Сведения об иностранных документах и переводах" readOnly={locked}/>)}
      {block('history', 'История изменений', 'Сохранение, изменения статуса и другие события документа.', <HistoryPanel document={saved}/>)}
      {Object.keys(overrides).length > 0 && block('wording', 'Ручные формулировки на листе', 'Просмотр текстов, заданных вручную, и восстановление из реквизитов.', <>{Object.entries(overrides).map(([key, text]) => <div className="builder-override" key={key}><strong>{key}</strong><p>{text || '(пустой текст)'}</p><Button disabled={locked} onClick={() => resetOverride(key)}>Восстановить из реквизитов</Button></div>)}</>, `${Object.keys(overrides).length}`)}
    </div>
    <div id="case-panel-testing" role="tabpanel" aria-labelledby="case-tab-testing" hidden={group !== 'testing'}>
      {block('testing', 'Основания, лаборатории и испытания', 'Протоколы, отбор образцов и доказательные документы.', <><EvidencePanel readOnly={locked} document={saved} onFiles={() => openDeclarationCase('scans')}/><WorkspaceSectionPanel embedded section="testing" title="Анализ состояния производства" contentLabel="Сведения об анализе производства" readOnly={locked}/></>, `Протоколов: ${reports.length}`)}
    </div>
    <div id="case-panel-files" role="tabpanel" aria-labelledby="case-tab-files" hidden={group !== 'files'}>
      {block('scans', 'Файлы и доказательные материалы', 'Загрузите сканы, укажите назначение и состав комплекта ФГИС.', <FilesPanel document={saved} readOnly={locked} showHistory={false}/>, `Файлов: ${saved?.attachments.length ?? 0}`)}
      {block('appendices', 'Приложения к декларации', 'Продукция, адреса, стандарты и свободное приложение на печатных листах.', <div className="builder-appendix-grid">{(['appendix-products', 'appendix-addresses', 'appendix-standards', 'appendix-free'] as const).map((key, i) => <div className="builder-field-group" key={key}><Typography component="h3">{['Продукция', 'Адреса производства', 'Стандарты', 'Свободное приложение'][i]}</Typography><p>{['Модели, марки, артикулы и дополнительные позиции.', 'Площадки и адреса осуществления деятельности.', 'Перечень применённых стандартов.', 'Сведения, для которых нужен отдельный лист.'][i]}</p><Field name={`workspace.sections.${key}.content`} label={['Приложение Продукция', 'Приложение Адреса', 'Приложение ГОСТы', 'Свободное приложение'][i]} multiline disabled={locked}/></div>)}</div>)}
      {block('closure', 'Опись и закрытие дела', 'Проверьте состав файлов и зафиксируйте завершение работы.', <><InventoryPanel document={saved} onFiles={() => openDeclarationCase('scans')}/><WorkspaceSectionPanel embedded section="closure" title="Закрытие дела" contentLabel="Результаты и сведения о закрытии дела" readOnly={locked}/></>)}
    </div>
    <div id="case-panel-publication" role="tabpanel" aria-labelledby="case-tab-publication" hidden={group !== 'publication'}>
      {block('fgis', 'Подготовка к публикации ФГИС', 'Соберите комплект, перенесите сведения и проверьте зарегистрированный документ.', <FgisPublicationPanel document={saved} onFiles={() => openDeclarationCase('scans')}/>)}
    </div>
  </section>;
}
