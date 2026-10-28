import type { CSSProperties } from 'react';
import { Alert, Button, Chip, Typography } from '@mui/material';
import { CheckRounded, DarkModeOutlined, DesktopWindowsOutlined, LightModeOutlined, PaletteOutlined } from '@mui/icons-material';
import { Section } from './common';
import { colorThemes, getDesignTokens } from './designTokens';
import { useAppearance } from './theme';
import './appearance.css';

const modes = [
  { id: 'light', title: 'Светлая', text: 'Светлое рабочее пространство', icon: <LightModeOutlined/> },
  { id: 'dark', title: 'Тёмная', text: 'Мягкий контраст в тёмных тонах', icon: <DarkModeOutlined/> },
  { id: 'system', title: 'Как в системе', text: 'По настройкам вашего устройства', icon: <DesktopWindowsOutlined/> },
] as const;

export function AppearanceSettings() {
  const { preference, mode, colorTheme, storageError, setPreference, setColorTheme } = useAppearance();
  return <Section title="Оформление" subtitle="Создайте пространство, в котором приятно работать.">
    <div className="appearance-heading"><div><Typography component="h2" variant="h6">Режим интерфейса</Typography><Typography variant="body2" color="text.secondary">Выберите освещение, комфортное для ваших глаз.</Typography></div><Chip size="small" variant="outlined" label={mode === 'dark' ? 'Сейчас тёмная тема' : 'Сейчас светлая тема'}/></div>
    <div className="appearance-modes" role="group" aria-label="Режим интерфейса">{modes.map(option => <Button key={option.id} color="inherit" className={`mode-option ${preference === option.id ? 'selected' : ''}`} aria-pressed={preference === option.id} onClick={() => setPreference(option.id)}>
      <span className="mode-icon">{option.icon}</span><span className="mode-label"><strong>{option.title}</strong><span>{option.text}</span></span><span className="appearance-check">{preference === option.id && <CheckRounded/>}</span>
    </Button>)}</div>
    <div className="appearance-heading appearance-colors-heading"><div><Typography component="h2" variant="h6">Цветовая тема</Typography><Typography variant="body2" color="text.secondary">Выберите свою палитру. Каждая тема работает в светлом и тёмном режиме.</Typography></div><PaletteOutlined sx={{ color: 'text.secondary' }}/></div>
    <div className="color-theme-grid" role="group" aria-label="Цветовая тема">{colorThemes.map(option => {
      const t = getDesignTokens(option.id, mode);
      const previewStyle = { '--preview-canvas': t.canvas, '--preview-surface': t.surface, '--preview-accent': t.accent, '--preview-sidebar': t.sidebar, '--preview-line': t.border, '--preview-soft': t.accentSoft } as CSSProperties;
      return <Button key={option.id} color="inherit" className={`color-theme-option ${colorTheme === option.id ? 'selected' : ''}`} aria-pressed={colorTheme === option.id} aria-label={`Тема ${option.title}`} onClick={() => setColorTheme(option.id)}>
        <span className="color-theme-preview" data-preview-theme={option.id} style={previewStyle} aria-hidden="true"><span className="color-preview-nav"><i/><b/><b/><b/></span><span className="color-preview-main"><span className="color-preview-bar"/><strong/><span className="color-preview-stats"><i/><i/><i/></span><span className="color-preview-table"><i/><i/><i/></span></span></span>
        <span className="color-theme-label"><span className="color-theme-dot" style={{ background: option.accent }}/><strong>{option.title}</strong><span className="appearance-check">{colorTheme === option.id && <CheckRounded/>}</span></span><span className="color-theme-description">{option.description}</span>
      </Button>;
    })}</div>
    <div className="appearance-note"><span className="appearance-note-icon"><CheckRounded/></span><Typography variant="body2" color="text.secondary">{storageError ? 'Тема применена для текущего сеанса.' : 'Выбор сохраняется в этом браузере.'} Палитру и режим можно быстро изменить в верхней панели.</Typography></div>
    {storageError && <Alert severity="warning" sx={{ mt: 2 }}>Браузер не разрешил сохранить оформление. После перезагрузки может потребоваться выбрать тему снова.</Alert>}
  </Section>;
}
