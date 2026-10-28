import { useState } from 'react';
import { IconButton, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { CheckRounded, PaletteOutlined } from '@mui/icons-material';
import { colorThemes } from './designTokens';
import { useAppearance } from './theme';

export function ColorThemeMenu() {
  const { colorTheme, setColorTheme } = useAppearance();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return <><Tooltip title="Цветовая тема"><IconButton className="theme-switch" aria-label="Выбрать цветовую тему" aria-controls={anchor ? 'color-theme-menu' : undefined} aria-haspopup="menu" aria-expanded={!!anchor} onClick={event => setAnchor(event.currentTarget)}><PaletteOutlined fontSize="small"/></IconButton></Tooltip>
    <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} MenuListProps={{ id: 'color-theme-menu', 'aria-label': 'Цветовая тема' }}>{colorThemes.map(option => <MenuItem key={option.id} role="menuitemradio" aria-checked={colorTheme === option.id} selected={colorTheme === option.id} onClick={() => { setColorTheme(option.id); setAnchor(null); }} sx={{ minWidth: 200 }}><ListItemIcon><span style={{ width: 16, height: 16, borderRadius: '50%', background: option.accent }}/></ListItemIcon><ListItemText>{option.title}</ListItemText>{colorTheme === option.id && <CheckRounded fontSize="small" sx={{ ml: 2 }}/>}</MenuItem>)}</Menu>
  </>;
}
