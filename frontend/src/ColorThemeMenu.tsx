import { useState } from 'react';
import { IconButton, ListItemText, Menu, MenuItem, Tooltip } from '@mui/material';
import { CheckRounded, PaletteOutlined } from '@mui/icons-material';
import { colorThemes, getDesignTokens } from './designTokens';
import { useAppearance } from './theme';

export function ColorThemeMenu() {
  const { colorTheme, mode, setColorTheme } = useAppearance();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const activeTheme = colorThemes.find(option => option.id === colorTheme);

  return <>
    <Tooltip title={`Цветовая тема: ${activeTheme?.title ?? 'ZNAQ'}`}>
      <IconButton
        className="theme-switch"
        aria-label="Выбрать цветовую тему"
        aria-controls={anchor ? 'color-theme-menu' : undefined}
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        onClick={event => setAnchor(event.currentTarget)}
      >
        <PaletteOutlined fontSize="small"/>
      </IconButton>
    </Tooltip>
    <Menu
      anchorEl={anchor}
      open={!!anchor}
      onClose={() => setAnchor(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      PaperProps={{ sx: { maxHeight: 'min(70dvh, 600px)' } }}
      MenuListProps={{ id: 'color-theme-menu', 'aria-label': 'Цветовая тема' }}
    >
      {colorThemes.map(option => {
        const { sidebar, sidebarAccent, surface, action } = getDesignTokens(option.id, mode);
        const selected = colorTheme === option.id;
        return <MenuItem
          key={option.id}
          role="menuitemradio"
          aria-checked={selected}
          selected={selected}
          onClick={() => { setColorTheme(option.id); setAnchor(null); }}
          sx={{ minWidth: 188, gap: 1.25 }}
        >
          <span className="theme-menu-swatch" aria-hidden="true" style={{ background: surface }}>
            <span style={{ background: sidebar, color: sidebarAccent }}/>
            <span style={{ color: action }}/>
          </span>
          <ListItemText>{option.title}</ListItemText>
          {selected && <CheckRounded fontSize="small"/>}
        </MenuItem>;
      })}
    </Menu>
  </>;
}
