import type { SavedTheme, ThemeSettings } from '../data/model.ts';
import {
  type Rgb,
  clamp01,
  contrast,
  fromHsl,
  luminance,
  mix,
  parseHex,
  toHex,
  toHsl,
} from './color.ts';

// The whole palette is derived from two colors — background and accent — exactly like the
// native app (Theme.ApplyColors), so any pair gives a consistent interface.

export const PRESETS = {
  light: { bg: '#F3F4F6', accent: '#3B5BDB' },
  dark: { bg: '#15171B', accent: '#7D93F2' },
} as const;

const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];
const rgb = (hex: string): Rgb => parseHex(hex) ?? BLACK;

export interface Palette {
  dark: boolean;
  /** CSS custom properties, e.g. `--bg`. */
  vars: Record<string, string>;
}

export function isDarkBackground(bg: string): boolean {
  return luminance(rgb(bg)) < 0.2;
}

export function generatePalette(bgHex: string, accentHex: string): Palette {
  const bg = rgb(bgHex);
  const dark = isDarkBackground(bgHex);
  const toward = dark ? WHITE : BLACK;

  const surface = dark ? mix(bg, WHITE, 0.045) : mix(bg, WHITE, 0.75);
  const palette: Record<string, Rgb> = dark
    ? {
        '--surface': surface,
        '--surface-2': mix(bg, WHITE, 0.085),
        '--card': mix(bg, WHITE, 0.075),
        '--card-hover': mix(bg, WHITE, 0.115),
        '--border': mix(bg, WHITE, 0.13),
        '--border-strong': mix(bg, WHITE, 0.25),
        '--hover': mix(bg, WHITE, 0.1),
        '--text': mix(WHITE, bg, 0.08),
        '--muted': mix(WHITE, bg, 0.38),
      }
    : {
        '--surface': surface,
        '--surface-2': mix(bg, BLACK, 0.03),
        '--card': mix(bg, WHITE, 0.45),
        '--card-hover': mix(bg, BLACK, 0.035),
        '--border': mix(bg, BLACK, 0.09),
        '--border-strong': mix(bg, BLACK, 0.2),
        '--hover': mix(bg, BLACK, 0.055),
        '--text': mix(BLACK, bg, 0.1),
        '--muted': mix(BLACK, bg, 0.5),
      };

  // The accent must stay readable on surfaces: lighten or darken it until contrast is enough.
  let accent = rgb(accentHex);
  for (let i = 0; i < 20 && contrast(accent, surface) < 3; i++) accent = mix(accent, toward, 0.07);

  const work = rgb(dark ? '#F06262' : '#E03131');
  const rest = rgb(dark ? '#4CC06A' : '#2B8A3E');
  const idle = rgb('#8A919C');
  const danger = rgb(dark ? '#F06262' : '#D9363E');
  const amber = rgb('#F2A93B');

  Object.assign(palette, {
    '--bg': bg,
    '--accent': accent,
    '--accent-hover': mix(accent, toward, 0.15),
    '--accent-soft': mix(bg, accent, dark ? 0.2 : 0.12),
    '--on-accent': luminance(accent) > 0.35 ? rgb('#11131A') : WHITE,
    '--work': work,
    '--work-hover': mix(work, toward, 0.12),
    '--work-soft': mix(bg, work, dark ? 0.2 : 0.1),
    '--rest': rest,
    '--rest-hover': mix(rest, toward, 0.12),
    '--rest-soft': mix(bg, rest, dark ? 0.2 : 0.1),
    '--idle': idle,
    '--idle-soft': mix(bg, idle, dark ? 0.14 : 0.12),
    '--danger': danger,
    '--danger-soft': mix(bg, danger, dark ? 0.18 : 0.1),
    '--warn-bg': mix(bg, amber, dark ? 0.16 : 0.18),
    '--warn-text': rgb(dark ? '#F2C66D' : '#7A5200'),
    '--q1': work,
    '--q2': accent,
    '--q3': rgb(dark ? '#F2A93B' : '#E8890C'),
    '--q4': idle,
  });

  const vars: Record<string, string> = {};
  for (const [name, value] of Object.entries(palette)) vars[name] = toHex(value);
  vars['--overlay'] = dark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(15, 18, 25, 0.35)';
  vars['--shadow'] = dark ? '0 12px 40px rgba(0, 0, 0, 0.5)' : '0 12px 40px rgba(16, 24, 40, 0.18)';
  return { dark, vars };
}

/** Which background/accent pair the settings select. Mirrors the native ThemeController. */
export function resolveThemeColors(
  theme: ThemeSettings,
  saved: SavedTheme[],
  systemDark: boolean,
): { bg: string; accent: string } {
  const system = systemDark ? PRESETS.dark : PRESETS.light;
  switch (theme.mode) {
    case 'light':
      return PRESETS.light;
    case 'dark':
      return PRESETS.dark;
    case 'custom':
      return { bg: theme.customBg, accent: theme.customAccent };
    case 'random':
      return theme.randomBg && theme.randomAccent
        ? { bg: theme.randomBg, accent: theme.randomAccent }
        : system;
    case 'saved': {
      const s = saved.find((t) => t.id === theme.savedId);
      return s ? { bg: s.bg, accent: s.accent } : system;
    }
    default:
      return system;
  }
}

/* ---------- Matching colors ---------- */

/** Backgrounds that go with the accent; `jitter` (0..1 random source) gives variations. */
export function suggestBackgrounds(accentHex: string, jitter?: () => number): string[] {
  const [h, s] = toHsl(rgb(accentHex));
  const j = (range: number) => (jitter ? (jitter() * 2 - 1) * range : 0);
  return [
    fromHsl(h + j(10), clamp01(Math.min(s, 0.5) * 0.45 + j(0.08)), clamp01(0.965 + j(0.015))),
    fromHsl(h + j(15), clamp01(0.18 + j(0.08)), clamp01(0.915 + j(0.03))),
    fromHsl(h + 180 + j(20), clamp01(0.16 + j(0.08)), clamp01(0.94 + j(0.02))),
    fromHsl(h + j(10), clamp01(0.08 + j(0.05)), clamp01(0.07 + j(0.02))),
    fromHsl(h + j(10), clamp01(Math.min(s, 0.5) * 0.5 + j(0.08)), clamp01(0.11 + j(0.03))),
    fromHsl(h + j(15), clamp01(0.32 + j(0.1)), clamp01(0.16 + j(0.03))),
  ].map(toHex);
}

/** Analogous, complementary and triadic accents. */
export function suggestAccents(accentHex: string): string[] {
  const [h, s, l] = toHsl(rgb(accentHex));
  return [-30, 30, 180, 120, 240].map((d) => toHex(fromHsl(h + d, s, l)));
}

export function randomTheme(random: () => number): { bg: string; accent: string } {
  const h = random() * 360;
  const accent = fromHsl(h, 0.55 + random() * 0.3, 0.5 + random() * 0.12);
  const bh = h + (random() * 40 - 20);
  const bg =
    random() < 0.5
      ? fromHsl(bh, 0.12 + random() * 0.25, 0.06 + random() * 0.08)
      : fromHsl(bh, 0.1 + random() * 0.3, 0.93 + random() * 0.04);
  return { bg: toHex(bg), accent: toHex(accent) };
}
