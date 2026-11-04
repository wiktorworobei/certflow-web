export type ColorMode = 'light' | 'dark';
export type ColorTheme = 'znaq' | 'sapphire' | 'ocean' | 'sage' | 'sandstone' | 'graphite' | 'dragonfly';

export const colorThemes: { id: ColorTheme; title: string; description: string; accent: string; darkAccent: string; tint: string; darkTint: string; sidebar: string }[] = [
  { id: 'znaq', title: 'ZNAQ', description: 'Фирменный угольный, матовые поверхности и лаймовый акцент', accent: '#233b2c', darkAccent: '#d6ff5f', tint: '#f3f5f0', darkTint: '#0e1611', sidebar: '#101a14' },
  { id: 'sapphire', title: 'Сапфир', description: 'Классический синий и прохладные поверхности', accent: '#3655c9', darkAccent: '#a6b8ff', tint: '#f3f5fc', darkTint: '#111522', sidebar: '#151e35' },
  { id: 'ocean', title: 'Океан', description: 'Глубокий бирюзовый и свежие оттенки', accent: '#087587', darkAccent: '#77d5e3', tint: '#f1f7f8', darkTint: '#101b20', sidebar: '#102e37' },
  { id: 'sage', title: 'Шалфей', description: 'Спокойная зелень для сосредоточенной работы', accent: '#34734e', darkAccent: '#99d7aa', tint: '#f3f7f3', darkTint: '#141c17', sidebar: '#1b3026' },
  { id: 'sandstone', title: 'Песчаник', description: 'Тёплые поверхности и медные акценты', accent: '#92572e', darkAccent: '#edbc93', tint: '#f8f5f0', darkTint: '#201a16', sidebar: '#33281f' },
  { id: 'graphite', title: 'Графит', description: 'Сдержанная палитра с минимумом цвета', accent: '#4b5265', darkAccent: '#c0c8dd', tint: '#f5f5f7', darkTint: '#18191e', sidebar: '#22242d' },
  { id: 'dragonfly', title: 'Стрекозы', description: 'Нефритовые оттенки и лёгкий узор крыльев', accent: '#176b65', darkAccent: '#8bdfce', tint: '#eff7f3', darkTint: '#101e1c', sidebar: '#15352f' },
];

export function isColorTheme(value: unknown): value is ColorTheme {
  return colorThemes.some(theme => theme.id === value);
}

/** Shared by MUI, the shell and the Radix integration portals. */
export function getDesignTokens(id: ColorTheme, mode: ColorMode) {
  const palette = colorThemes.find(theme => theme.id === id) ?? colorThemes[0];
  const dark = mode === 'dark';
  return {
    canvas: dark ? palette.darkTint : palette.tint,
    surface: dark ? id === 'znaq' ? '#17221b' : id === 'dragonfly' ? '#1b2d29' : '#20232d' : '#ffffff',
    surfaceSoft: dark ? id === 'znaq' ? '#121c16' : id === 'dragonfly' ? '#172722' : '#1b1e27' : id === 'znaq' ? '#f8faf6' : '#fafbfd',
    surfaceHover: dark ? id === 'znaq' ? '#26372c' : id === 'dragonfly' ? '#294239' : '#2b3040' : id === 'znaq' ? '#edf1e8' : '#f0f3f8',
    text: dark ? '#eef4ef' : '#18251d',
    muted: dark ? '#b2beb6' : '#56645b',
    faint: dark ? '#a0b0a5' : '#647269',
    border: id === 'znaq' ? dark ? '#33473a' : '#dce4d9' : id === 'dragonfly' ? dark ? '#36564b' : '#d3e3db' : dark ? '#373e50' : '#dde2ec',
    accent: dark ? palette.darkAccent : palette.accent,
    accentSolid: palette.accent,
    onAccent: dark ? '#142119' : '#ffffff',
    accentSoft: dark ? `${palette.darkAccent}16` : `${palette.accent}0c`,
    accentText: dark ? palette.darkAccent : palette.accent,
    hero: dark ? `${palette.darkAccent}0d` : '#ffffff',
    heroBorder: dark ? '#3c455c' : '#dde2ec',
    success: dark ? '#8cdbb5' : '#207348',
    successSoft: dark ? '#1c372c' : '#eaf6ef',
    warning: dark ? '#efcb88' : '#865d17',
    warningSoft: dark ? '#393020' : '#fcf3df',
    danger: dark ? '#f2abb5' : '#b13c50',
    dangerSoft: dark ? '#3b2630' : '#fceff2',
    info: dark ? '#a0c5ff' : '#315eaa',
    infoSoft: dark ? '#20314b' : '#edf3fc',
    sidebar: '#101a14',
    sidebarText: '#c4cfc7',
    sidebarMuted: '#a5b6aa',
    sidebarActive: '#d6ff5f0e',
    sidebarAccent: '#d6ff5f',
    shadow: dark ? '0 4px 16px #00000014' : '0 3px 12px #182a1c06',
    brand: '#d6ff5f',
    brandInk: '#142119',
  };
}

export type DesignTokens = ReturnType<typeof getDesignTokens>;

export function applyDesignTokens(root: HTMLElement, tokens: DesignTokens) {
  for (const [key, value] of Object.entries(tokens)) {
    const name = key.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);
    root.style.setProperty(`--${name}`, value);
    // Namespaced aliases cannot be shadowed by a feature's --accent / --muted.
    root.style.setProperty(`--cf-${name}`, value);
  }
}
