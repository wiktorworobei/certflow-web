import { useAppearance } from '../../theme';
export function useTheme() {
  const { preference, mode, setPreference } = useAppearance();
  return { theme: preference, resolvedTheme: mode, setTheme: (value: string) => setPreference(value === 'system' || value === 'dark' ? value : 'light') };
}
