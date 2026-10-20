import { describe, expect, it } from 'vitest';
import { createEmptyData } from '../data/normalize.ts';
import { contrast, parseHex } from './color.ts';
import {
  PRESETS,
  generatePalette,
  randomTheme,
  resolveThemeColors,
  suggestAccents,
  suggestBackgrounds,
} from './palette.ts';
import { seededRandom } from './random.ts';

const rgb = (hex: string) => parseHex(hex) ?? [0, 0, 0];

describe('generatePalette', () => {
  it('detects light and dark backgrounds', () => {
    expect(generatePalette(PRESETS.light.bg, PRESETS.light.accent).dark).toBe(false);
    expect(generatePalette(PRESETS.dark.bg, PRESETS.dark.accent).dark).toBe(true);
  });

  it('defines every variable the styles use', () => {
    const { vars } = generatePalette('#FFFFFF', '#3B5BDB');
    for (const name of [
      '--bg',
      '--surface',
      '--surface-2',
      '--card',
      '--border',
      '--text',
      '--muted',
      '--accent',
      '--accent-soft',
      '--on-accent',
      '--work',
      '--rest',
      '--q1',
      '--q4',
      '--warn-bg',
      '--overlay',
    ]) {
      expect(vars[name], name).toBeTruthy();
    }
  });

  it('keeps the accent readable on the surface (contrast >= 3)', () => {
    for (const [bg, accent] of [
      ['#FFFFFF', '#FFF59D'],
      ['#101010', '#202040'],
      ['#F5F1E8', '#E8F0FF'],
    ] as const) {
      const { vars } = generatePalette(bg, accent);
      expect(
        contrast(rgb(vars['--accent'] ?? ''), rgb(vars['--surface'] ?? '')),
      ).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('resolveThemeColors', () => {
  const settings = createEmptyData().settings;

  it('follows the system in system mode', () => {
    expect(resolveThemeColors(settings.theme, [], true)).toEqual(PRESETS.dark);
    expect(resolveThemeColors(settings.theme, [], false)).toEqual(PRESETS.light);
  });

  it('uses custom and saved colors', () => {
    expect(
      resolveThemeColors(
        { ...settings.theme, mode: 'custom', customBg: '#000000', customAccent: '#FF0000' },
        [],
        false,
      ),
    ).toEqual({ bg: '#000000', accent: '#FF0000' });
    const saved = [{ id: 's', name: 'S', bg: '#111111', accent: '#222222' }];
    expect(
      resolveThemeColors({ ...settings.theme, mode: 'saved', savedId: 's' }, saved, false),
    ).toEqual({ bg: '#111111', accent: '#222222' });
  });
});

describe('suggestions', () => {
  it('suggests six backgrounds and five accents as hex colors', () => {
    const bgs = suggestBackgrounds('#3B5BDB');
    expect(bgs).toHaveLength(6);
    expect(suggestAccents('#3B5BDB')).toHaveLength(5);
    for (const c of bgs) expect(c).toMatch(/^#[0-9A-F]{6}$/);
  });

  it('gives the same variations for the same seed', () => {
    expect(suggestBackgrounds('#3B5BDB', seededRandom(42))).toEqual(
      suggestBackgrounds('#3B5BDB', seededRandom(42)),
    );
    expect(randomTheme(seededRandom(7))).toEqual(randomTheme(seededRandom(7)));
  });
});
