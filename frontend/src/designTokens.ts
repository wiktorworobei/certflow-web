export type ColorMode = 'light' | 'dark';

type Palette = {
  id: string;
  title: string;
  description: string;
  accent: string;
  darkAccent: string;
  tint: string;
  darkTint: string;
  sidebar: string;
};

export const colorThemes = [
  { id: 'znaq', title: 'ZNAQ', description: 'Фирменный угольный и лаймовый акцент', accent: '#233b2c', darkAccent: '#d6ff5f', tint: '#f3f5f0', darkTint: '#0e1611', sidebar: '#101a14' },
  { id: 'sapphire', title: 'Сапфир', description: 'Кобальтовый синий и прохладные поверхности', accent: '#3655c9', darkAccent: '#a6b8ff', tint: '#eef2fc', darkTint: '#111522', sidebar: '#19274b' },
  { id: 'ocean', title: 'Океан', description: 'Глубокая бирюза и прохладные голубые оттенки', accent: '#087587', darkAccent: '#77d5e3', tint: '#ebf5f7', darkTint: '#101b20', sidebar: '#102f3b' },
  { id: 'sage', title: 'Шалфей', description: 'Мягкая зелень и серо-зелёные поверхности', accent: '#34734e', darkAccent: '#99d7aa', tint: '#eef5ed', darkTint: '#141c17', sidebar: '#24392c' },
  { id: 'sandstone', title: 'Песчаник', description: 'Песочные поверхности и медные акценты', accent: '#92572e', darkAccent: '#edbc93', tint: '#f7efe4', darkTint: '#201a16', sidebar: '#422d22' },
  { id: 'graphite', title: 'Графит', description: 'Сдержанная серо-стальная палитра', accent: '#4b5265', darkAccent: '#c0c8dd', tint: '#f0f1f4', darkTint: '#18191e', sidebar: '#2c303a' },
  { id: 'dragonfly', title: 'Стрекозы', description: 'Нефритовые оттенки и лёгкий узор крыльев', accent: '#176b65', darkAccent: '#8bdfce', tint: '#e9f5ef', darkTint: '#101e1c', sidebar: '#123c34' },
  { id: 'iris', title: 'Ирис', description: 'Чернильно-фиолетовый и мягкая лаванда', accent: '#6844a3', darkAccent: '#cbb2ff', tint: '#f2edf9', darkTint: '#1b1528', sidebar: '#302047' },
  { id: 'cranberry', title: 'Клюква', description: 'Ягодный акцент и холодные розовые оттенки', accent: '#9a3b62', darkAccent: '#f2aac7', tint: '#faedf2', darkTint: '#24161e', sidebar: '#461e32' },
  { id: 'amber', title: 'Янтарь', description: 'Тёплый кремовый фон и золотистые акценты', accent: '#7d580b', darkAccent: '#efc674', tint: '#faf2de', darkTint: '#201a10', sidebar: '#3e2e14' },
  { id: 'spruce', title: 'Хвоя', description: 'Густой хвойный зелёный и мятные акценты', accent: '#216446', darkAccent: '#7adfc0', tint: '#e9f4ec', darkTint: '#111e17', sidebar: '#15352a' },
  { id: 'cocoa', title: 'Какао', description: 'Кофейные и пудровые оттенки', accent: '#79534f', darkAccent: '#e3b8ad', tint: '#f8efed', darkTint: '#211818', sidebar: '#3e292c' },
] as const satisfies readonly Palette[];

export type ColorTheme = typeof colorThemes[number]['id'];

export function isColorTheme(value: unknown): value is ColorTheme {
  return colorThemes.some(theme => theme.id === value);
}

function mix(from: string, to: string, amount: number) {
  const channels = [1, 3, 5].map(index => {
    const start = Number.parseInt(from.slice(index, index + 2), 16);
    const end = Number.parseInt(to.slice(index, index + 2), 16);
    return Math.round(start + (end - start) * amount).toString(16).padStart(2, '0');
  });
  return `#${channels.join('')}`;
}

/** Shared by MUI, the shell and the Radix integration portals. */
export function getDesignTokens(id: ColorTheme, mode: ColorMode) {
  const palette = colorThemes.find(theme => theme.id === id) ?? colorThemes[0];
  const dark = mode === 'dark';
  const canvas = dark ? palette.darkTint : palette.tint;
  const surface = dark
    ? (id === 'znaq' ? '#17221b' : mix(canvas, palette.darkAccent, .065))
    : mix('#ffffff', canvas, .24);
  const action = dark ? palette.darkAccent : palette.accent;
  const text = dark ? mix('#ffffff', palette.darkAccent, .13) : mix('#16171a', palette.accent, .32);
  const onAccent = dark ? mix('#0d1012', palette.sidebar, .42) : '#ffffff';
  const sidebar = dark ? mix(palette.sidebar, '#090b10', .24) : palette.sidebar;
  const sidebarStrong = mix('#ffffff', palette.darkAccent, .17);
  const sidebarText = mix('#ffffff', palette.darkAccent, .38);
  const sidebarMuted = mix(sidebarText, sidebar, .26);
  const sidebarAccent = palette.darkAccent;
  const sidebarOnAccent = mix('#0d1012', palette.sidebar, .42);
  const accentSoft = mix(surface, action, dark ? .13 : .09);
  return {
    canvas,
    surface,
    surfaceSoft: mix(surface, canvas, .66),
    surfaceHover: mix(surface, action, dark ? .12 : .09),
    topbar: mix(surface, action, dark ? .045 : .035),
    text,
    muted: mix(text, surface, dark ? .27 : .28),
    faint: mix(text, surface, dark ? .32 : .30),
    border: mix(surface, action, dark ? .21 : .18),
    controlBorder: mix(surface, text, dark ? .47 : .58),
    accent: action,
    accentSolid: palette.accent,
    action,
    actionHover: mix(action, dark ? '#ffffff' : palette.sidebar, dark ? .2 : .24),
    onAccent,
    accentSoft,
    accentText: action,
    hero: mix(surface, canvas, .46),
    heroBorder: mix(surface, action, dark ? .3 : .24),
    success: dark ? '#8cdbb5' : '#207348',
    successSoft: dark ? '#1c372c' : '#eaf6ef',
    warning: dark ? '#efcb88' : '#865d17',
    warningSoft: dark ? '#393020' : '#fcf3df',
    danger: dark ? '#f2abb5' : '#b13c50',
    dangerSoft: dark ? '#3b2630' : '#fceff2',
    info: dark ? '#a0c5ff' : '#315eaa',
    infoSoft: dark ? '#20314b' : '#edf3fc',
    sidebar,
    sidebarText,
    sidebarStrong,
    sidebarMuted,
    sidebarBorder: mix(sidebar, sidebarAccent, .16),
    sidebarPanel: mix(sidebar, sidebarAccent, .08),
    sidebarHover: mix(sidebar, sidebarAccent, .1),
    sidebarActive: mix(sidebar, sidebarAccent, .18),
    sidebarActiveBorder: mix(sidebar, sidebarAccent, .33),
    sidebarAccent,
    sidebarAccentHover: mix(sidebarAccent, '#ffffff', .22),
    sidebarOnAccent,
    shadow: dark ? '0 4px 16px #00000014' : '0 3px 12px #182a1c06',
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
