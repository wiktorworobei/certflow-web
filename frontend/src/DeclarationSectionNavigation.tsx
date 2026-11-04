import { Checkbox, FormControlLabel, Paper, Typography } from '@mui/material';
import { useFormContext, useWatch } from 'react-hook-form';
import { declarationTabs, type DeclarationTab } from './workspaceTypes';
import type { SaveDeclaration } from './types';

export function DeclarationSectionNavigation({ tab, onChange, readOnly }: { tab: DeclarationTab; onChange: (tab: DeclarationTab) => void; readOnly: boolean }) {
  const { control, getValues, setValue } = useFormContext<SaveDeclaration>();
  const sections = useWatch({ control, name: 'workspace.sections' }) ?? {};
  const complete = declarationTabs.filter(([key]) => sections[key]?.completed).length;
  return <Paper className="editor-tabs workspace-tabs">
    <div className="workspace-navigation-heading"><div><Typography component="h2">Разделы декларации</Typography><span>Отмечайте выполненные пункты по мере подготовки</span></div><span className="workspace-counter">{complete} из {declarationTabs.length}</span></div>
    <div className="workspace-section-grid" role="tablist" aria-label="Разделы декларации">
      {declarationTabs.map(([key, label], index) => <div key={key} className={`workspace-step${tab === key ? ' is-active' : ''}${sections[key]?.completed ? ' is-complete' : ''}`}>
        <button type="button" role="tab" aria-selected={tab === key} id={`declaration-tab-${key}`} aria-controls={`declaration-panel-${key}`} tabIndex={tab === key ? 0 : -1} onClick={() => onChange(key)} onKeyDown={event => {
          const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowDown' ? 3 : event.key === 'ArrowUp' ? -3 : 0;
          if (!offset && event.key !== 'Home' && event.key !== 'End') return;
          event.preventDefault();
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? declarationTabs.length - 1 : (index + offset + declarationTabs.length) % declarationTabs.length;
          onChange(declarationTabs[next][0]); document.getElementById(`declaration-tab-${declarationTabs[next][0]}`)?.focus();
        }}><span className="workspace-step-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span><span>{label}</span></button>
        <FormControlLabel className="workspace-step-check" label={sections[key]?.completed ? 'Выполнено' : 'Отметить выполненным'} control={<Checkbox size="small" checked={!!sections[key]?.completed} disabled={readOnly} inputProps={{ 'aria-label': `Выполнено: ${label}` }} onChange={(_, completed) => {
          const section = getValues(`workspace.sections.${key}`) ?? { number: '', date: null, content: '', notes: '' };
          setValue(`workspace.sections.${key}`, { ...section, completed }, { shouldDirty: true });
        }}/>}/>
      </div>)}
    </div>
  </Paper>;
}
