import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useState, type ReactNode } from 'react';
import { alpha, createTheme, CssBaseline, ThemeProvider } from '@mui/material';
import { applyDesignTokens, getDesignTokens, isColorTheme, type ColorTheme } from './designTokens';

export type ThemePreference = 'light' | 'dark' | 'system';
const storageKey = 'certflow.theme';
const colorKey = 'certflow.color-theme';
function readPreference(): ThemePreference {
  try { const value = localStorage.getItem(storageKey); if (value === 'light' || value === 'dark') return value; } catch { /* Storage is optional. */ }
  return 'system';
}
function readColorTheme(): ColorTheme {
  try { const value = localStorage.getItem(colorKey); if (isColorTheme(value)) return value; } catch { /* Storage is optional. */ }
  return 'sapphire';
}
const AppearanceContext = createContext({
  preference: 'system' as ThemePreference, mode: 'light' as 'light' | 'dark', colorTheme: 'sapphire' as ColorTheme,
  storageError: false, setPreference: (_value: ThemePreference) => {}, setColorTheme: (_value: ColorTheme) => {},
});
export const useAppearance = () => useContext(AppearanceContext);

export function AppearanceProvider({ children }: { children: ReactNode }) {
  const [preference, setValue] = useState<ThemePreference>(readPreference);
  const [colorTheme, setColorValue] = useState<ColorTheme>(readColorTheme);
  const [storageError, setStorageError] = useState(false);
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const mode = preference === 'system' ? systemDark ? 'dark' : 'light' : preference;
  const tokens = useMemo(() => getDesignTokens(colorTheme, mode), [colorTheme, mode]);
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const change = () => setSystemDark(media.matches);
    const sync = (event: StorageEvent) => {
      if (event.key === storageKey || event.key === null) setValue(readPreference());
      if (event.key === colorKey || event.key === null) setColorValue(readColorTheme());
    };
    media.addEventListener('change', change); window.addEventListener('storage', sync);
    return () => { media.removeEventListener('change', change); window.removeEventListener('storage', sync); };
  }, []);
  useLayoutEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.dataset.colorTheme = colorTheme;
    root.classList.toggle('dark', mode === 'dark');
    root.style.colorScheme = mode;
    applyDesignTokens(root, tokens);
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', tokens.canvas);
  }, [mode, colorTheme, tokens]);
  function save(key: string, value: string) {
    try { localStorage.setItem(key, value); setStorageError(false); } catch { setStorageError(true); }
  }
  function setPreference(value: ThemePreference) { setValue(value); save(storageKey, value); }
  function setColorTheme(value: ColorTheme) { setColorValue(value); save(colorKey, value); }
  const theme = useMemo(() => {
    const t = tokens; const primary = t.accent;
    return createTheme({
      palette: {
        mode, primary: { main: primary, contrastText: t.onAccent }, secondary: { main: t.muted },
        background: { default: t.canvas, paper: t.surface }, text: { primary: t.text, secondary: t.muted }, divider: t.border,
        success: { main: t.success }, warning: { main: t.warning }, error: { main: t.danger }, info: { main: t.info },
        action: { hover: alpha(primary, .055), selected: alpha(primary, .09) },
      },
      typography: {
        fontFamily: 'Inter, Arial, sans-serif',
        h4: { fontWeight: 700, fontSize: 'clamp(1.65rem, 2.4vw, 2rem)', letterSpacing: '-.045em', lineHeight: 1.25 },
        h5: { fontWeight: 600, fontSize: 22, letterSpacing: '-.035em', lineHeight: 1.4 },
        h6: { fontWeight: 600, fontSize: 16, letterSpacing: '-.025em', lineHeight: 1.5 },
        body1: { fontSize: 14, lineHeight: 1.7 }, body2: { fontSize: 13, lineHeight: 1.65 },
        button: { textTransform: 'none', fontWeight: 600, fontSize: 13 },
      },
      shape: { borderRadius: 14 },
      components: {
        MuiButton: { defaultProps: { disableElevation: true }, styleOverrides: {
          root: { borderRadius: 9, padding: '10px 17px', minHeight: 44, transition: 'background-color .16s, box-shadow .16s', '&.Mui-focusVisible': { outline: `3px solid ${primary}`, outlineOffset: 3 } },
          contained: { '&:hover': { boxShadow: `0 3px 10px ${alpha(primary, .2)}` } },
          outlined: { borderColor: t.border, color: t.text, backgroundColor: t.surface, '&:hover': { borderColor: primary, backgroundColor: alpha(primary, .06) } },
          sizeSmall: { minHeight: 36, padding: '6px 12px', fontSize: 12, '@media (hover: none) and (pointer: coarse)': { minHeight: 44 } },
        } },
        MuiIconButton: { styleOverrides: { root: { borderRadius: 9, minWidth: 36, minHeight: 36, '@media (hover: none) and (pointer: coarse)': { minWidth: 44, minHeight: 44 }, '&:hover': { backgroundColor: alpha(primary, .08) }, '&.Mui-focusVisible': { outline: `3px solid ${primary}`, outlineOffset: 2 } } } },
        MuiCheckbox: { styleOverrides: { root: { '@media (hover: none) and (pointer: coarse)': { minWidth: 44, minHeight: 44 } } } },
        MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
        MuiOutlinedInput: { styleOverrides: {
          root: { backgroundColor: t.surface, fontSize: 14, minHeight: 46, borderRadius: 9, transition: 'box-shadow .16s', '&.Mui-focused': { boxShadow: `0 0 0 3px ${alpha(primary, .12)}` } },
          notchedOutline: { borderColor: t.border }, input: { paddingBlock: 12, '@media (max-width: 620px), (hover: none) and (pointer: coarse)': { fontSize: 16 } },
        } },
        MuiInputLabel: { styleOverrides: { root: { fontSize: 14 } } },
        MuiFormHelperText: { styleOverrides: { root: { fontSize: 12, lineHeight: 1.6, marginLeft: 0 } } },
        MuiPaper: { defaultProps: { elevation: 0 }, styleOverrides: { root: { backgroundImage: 'none' } } },
        MuiTableCell: { styleOverrides: {
          root: { borderColor: t.border, padding: '18px 20px', fontSize: 13, fontVariantNumeric: 'tabular-nums' },
          head: { color: t.muted, fontWeight: 600, fontSize: 11, letterSpacing: '.035em', backgroundColor: t.surfaceSoft },
        } },
        MuiTableRow: { styleOverrides: { root: { '&:last-child td': { borderBottom: 0 }, '&.document-row:hover': { backgroundColor: alpha(primary, .045) } } } },
        MuiDialog: { styleOverrides: { paper: { borderRadius: 18, border: `1px solid ${t.border}`, boxShadow: '0 24px 100px #00000030', '@media (max-width: 600px)': { margin: 16, width: 'calc(100% - 32px)', maxHeight: 'calc(100% - 32px)' } } } },
        MuiDialogTitle: { styleOverrides: { root: { fontSize: 20, fontWeight: 600, padding: 24, letterSpacing: '-.025em' } } },
        MuiTab: { styleOverrides: { root: { textTransform: 'none', minHeight: 52, fontSize: 13, fontWeight: 500, '&.Mui-selected': { fontWeight: 600 } } } },
        MuiTabs: { styleOverrides: { indicator: { height: 3, borderRadius: '3px 3px 0 0' } } },
        MuiAlert: { styleOverrides: {
          root: { fontSize: 13, borderRadius: 10, alignItems: 'center', overflowWrap: 'anywhere' },
          standardInfo: { backgroundColor: t.infoSoft, color: t.info },
          standardSuccess: { backgroundColor: t.successSoft, color: t.success },
          standardWarning: { backgroundColor: t.warningSoft, color: t.warning },
          standardError: { backgroundColor: t.dangerSoft, color: t.danger },
        } },
        MuiChip: { styleOverrides: { root: { borderRadius: 6, fontWeight: 500 }, sizeSmall: { fontSize: 12 } } },
        MuiMenu: { styleOverrides: { paper: { border: `1px solid ${t.border}`, borderRadius: 12, marginTop: 6, boxShadow: '0 12px 35px #00000018' } } },
        MuiMenuItem: { styleOverrides: { root: { fontSize: 13, minHeight: 44, borderRadius: 6, margin: '3px 6px' } } },
        MuiTooltip: { defaultProps: { arrow: true }, styleOverrides: { tooltip: { fontSize: 12, padding: '8px 12px' } } },
        MuiLinearProgress: { styleOverrides: { root: { backgroundColor: alpha(primary, .12) } } },
      },
    });
  }, [mode, tokens]);
  return <AppearanceContext.Provider value={{ preference, mode, colorTheme, storageError, setPreference, setColorTheme }}><ThemeProvider theme={theme}><CssBaseline/>{children}</ThemeProvider></AppearanceContext.Provider>;
}
