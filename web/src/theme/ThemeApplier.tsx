import { useEffect } from 'react';
import { useAppData, usePlatform } from '../state/hooks.ts';
import { generatePalette, resolveThemeColors } from './palette.ts';
import { useSystemDark } from './useSystemDark.ts';

/** Writes the current theme into CSS variables on <html> (N-08) and tells the shell about it. */
export function ThemeApplier() {
  const { data } = useAppData();
  const platform = usePlatform();
  const systemDark = useSystemDark();
  const { bg, accent } = resolveThemeColors(data.settings.theme, data.settings.themes, systemDark);

  useEffect(() => {
    const palette = generatePalette(bg, accent);
    const root = document.documentElement;
    for (const [name, value] of Object.entries(palette.vars)) root.style.setProperty(name, value);
    root.style.colorScheme = palette.dark ? 'dark' : 'light';
    platform.setWindowDark(palette.dark);
  }, [bg, accent, platform]);

  return null;
}
