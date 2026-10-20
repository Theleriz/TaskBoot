import { useState } from 'react';
import { type ThemeMode } from '../../data/model.ts';
import { newId } from '../../data/ids.ts';
import { useAppData, useToast } from '../../state/hooks.ts';
import { deleteTheme, saveTheme, setTheme } from '../../state/ops.ts';
import { parseHex, toHex } from '../../theme/color.ts';
import {
  randomTheme,
  resolveThemeColors,
  suggestAccents,
  suggestBackgrounds,
} from '../../theme/palette.ts';
import { seededRandom } from '../../theme/random.ts';
import { useSystemDark } from '../../theme/useSystemDark.ts';
import { IconButton } from '../../ui/Icon.tsx';
import { Box } from './Box.tsx';

const MODES: Array<{ mode: ThemeMode; title: string }> = [
  { mode: 'system', title: 'Системная' },
  { mode: 'light', title: 'Светлая' },
  { mode: 'dark', title: 'Тёмная' },
  { mode: 'custom', title: 'Своя' },
  { mode: 'random', title: 'Случайная' },
];

const BG_PRESETS = [
  '#F3F4F6',
  '#FFFFFF',
  '#F5F1E8',
  '#EDF3EF',
  '#15171B',
  '#1B1E2B',
  '#10161A',
  '#221A1F',
];
const ACCENT_PRESETS = [
  '#3B5BDB',
  '#7048E8',
  '#D6336C',
  '#E8590C',
  '#2B8A3E',
  '#0C8599',
  '#F59F00',
  '#495057',
];

const PREVIEW_VARS = [
  '--bg',
  '--surface',
  '--card',
  '--border',
  '--accent',
  '--accent-soft',
  '--text',
  '--muted',
];

function Swatch({
  color,
  selected = false,
  onPick,
}: {
  color: string;
  selected?: boolean;
  onPick?: () => void;
}) {
  return (
    <button
      type="button"
      className={`swatch${selected ? ' selected' : ''}`}
      style={{ background: color }}
      title={color}
      aria-label={color}
      aria-pressed={onPick ? selected : undefined}
      disabled={!onPick}
      onClick={onPick}
    />
  );
}

function Swatches({
  colors,
  current,
  onPick,
}: {
  colors: string[];
  current: string;
  onPick: (c: string) => void;
}) {
  return (
    <div className="swatches indent">
      {colors.map((c, i) => (
        <Swatch key={`${i}-${c}`} color={c} selected={c === current} onPick={() => onPick(c)} />
      ))}
    </div>
  );
}

function ColorRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hex: string) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const invalid = draft !== null && parseHex(draft) === null;

  const commit = () => {
    if (draft === null) return;
    const rgb = parseHex(draft);
    if (rgb && toHex(rgb) !== value) onChange(toHex(rgb));
    if (rgb) setDraft(null);
  };

  return (
    <div className="color-row">
      <span className="color-label">{label}</span>
      <input
        type="color"
        aria-label={`${label}: выбрать цвет`}
        value={value.toLowerCase()}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
      />
      <input
        className={`input mono${invalid ? ' invalid' : ''}`}
        aria-label={`${label}: код цвета`}
        maxLength={7}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') setDraft(null);
        }}
      />
    </div>
  );
}

export function ThemeSettings() {
  const { data, apply } = useAppData();
  const toast = useToast();
  const systemDark = useSystemDark();
  const theme = data.settings.theme;
  const current = resolveThemeColors(theme, data.settings.themes, systemDark);
  const [suggestSeed, setSuggestSeed] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [nameInvalid, setNameInvalid] = useState(false);

  const setCustom = (bg: string, accent: string) =>
    apply((d) => setTheme(d, { mode: 'custom', customBg: bg, customAccent: accent }));

  const pickMode = (mode: ThemeMode) => {
    if (mode === 'random' && !(theme.randomBg && theme.randomAccent)) {
      const r = randomTheme(Math.random);
      apply((d) => setTheme(d, { mode, randomBg: r.bg, randomAccent: r.accent }));
    } else {
      apply((d) => setTheme(d, { mode }));
    }
  };

  const hint = (() => {
    switch (theme.mode) {
      case 'light':
        return 'Светлая тема.';
      case 'dark':
        return 'Тёмная тема.';
      case 'custom':
        return 'Цвета задаются ниже, в разделе «Свои цвета».';
      case 'random':
        return 'Случайное сочетание. Новое — кнопкой «Сгенерировать» ниже.';
      case 'saved': {
        const s = data.settings.themes.find((t) => t.id === theme.savedId);
        return s ? `Сохранённая тема «${s.name}».` : 'Сохранённая тема.';
      }
      default:
        return 'Светлая или тёмная — как в настройках системы.';
    }
  })();

  const jitter = suggestSeed === null ? undefined : seededRandom(suggestSeed);

  return (
    <>
      <Box title="Тема оформления" color="var(--accent)">
        <div className="chips" role="radiogroup" aria-label="Режим темы">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              role="radio"
              className="chip"
              aria-checked={theme.mode === m.mode}
              onClick={() => pickMode(m.mode)}
            >
              {m.title}
            </button>
          ))}
        </div>
        <p className="hint">{hint}</p>
        <div className="swatches preview">
          {PREVIEW_VARS.map((v) => (
            <Swatch key={v} color={`var(${v})`} />
          ))}
        </div>
        <p className="hint">
          Фон {current.bg} · акцент {current.accent}
        </p>
      </Box>

      <Box title="Свои цвета" color="var(--q3)">
        <p className="setting-sub">Любое изменение здесь включает режим «Своя».</p>
        <ColorRow
          label="Фон"
          value={theme.customBg}
          onChange={(c) => setCustom(c, theme.customAccent)}
        />
        <Swatches
          colors={BG_PRESETS}
          current={theme.customBg}
          onPick={(c) => setCustom(c, theme.customAccent)}
        />
        <ColorRow
          label="Акцент"
          value={theme.customAccent}
          onChange={(c) => setCustom(theme.customBg, c)}
        />
        <Swatches
          colors={ACCENT_PRESETS}
          current={theme.customAccent}
          onPick={(c) => setCustom(theme.customBg, c)}
        />
        <div className="sec-head suggest-head">
          <span className="muted">Фоны, подходящие к акценту</span>
          <button
            type="button"
            className="btn small"
            onClick={() => setSuggestSeed(Math.floor(Math.random() * 2 ** 31))}
          >
            Ещё варианты
          </button>
        </div>
        <Swatches
          colors={suggestBackgrounds(theme.customAccent, jitter)}
          current={theme.customBg}
          onPick={(c) => setCustom(c, theme.customAccent)}
        />
        <div className="sec-head suggest-head">
          <span className="muted">Сочетающиеся акценты</span>
        </div>
        <Swatches
          colors={suggestAccents(theme.customAccent)}
          current={theme.customAccent}
          onPick={(c) => setCustom(theme.customBg, c)}
        />
      </Box>

      <Box title="Случайная тема" color="var(--rest)">
        <p className="setting-sub">Случайный акцент и подходящий к нему светлый или тёмный фон.</p>
        <div className="row">
          <button
            type="button"
            className="btn primary"
            onClick={() => {
              const r = randomTheme(Math.random);
              apply((d) => setTheme(d, { mode: 'random', randomBg: r.bg, randomAccent: r.accent }));
            }}
          >
            Сгенерировать
          </button>
          {theme.randomBg && theme.randomAccent && (
            <span className="muted pair">
              Последняя: <Swatch color={theme.randomBg} /> <Swatch color={theme.randomAccent} />
            </span>
          )}
        </div>
      </Box>

      <Box title="Сохранённые темы" color="var(--q1)">
        <form
          className="inline-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim()) {
              setNameInvalid(true);
              return;
            }
            const id = newId();
            apply((d) => saveTheme(d, name, current.bg, current.accent, id));
            toast(`Тема «${name.trim()}» сохранена`);
            setName('');
          }}
        >
          <input
            className={`input${nameInvalid ? ' invalid' : ''}`}
            placeholder="Название темы"
            maxLength={60}
            aria-label="Название темы"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameInvalid(false);
            }}
          />
          <button className="btn primary" type="submit">
            Сохранить текущую
          </button>
        </form>
        {nameInvalid && <div className="field-error">Введите название темы</div>}
        <ul className="list saved-list">
          {data.settings.themes.length === 0 && <li className="empty">пусто</li>}
          {data.settings.themes.map((t) => {
            const active = theme.mode === 'saved' && theme.savedId === t.id;
            return (
              <li key={t.id} className="saved-row">
                <button
                  type="button"
                  className={`saved-apply${active ? ' active' : ''}`}
                  title="Применить"
                  onClick={() => apply((d) => setTheme(d, { mode: 'saved', savedId: t.id }))}
                >
                  <span className="pair">
                    <Swatch color={t.bg} />
                    <Swatch color={t.accent} />
                  </span>
                  <span className="saved-name">{t.name}</span>
                  {active && <span className="saved-mark">используется</span>}
                </button>
                <IconButton
                  icon="x"
                  label="Удалить тему"
                  danger
                  onClick={() => {
                    if (window.confirm(`Удалить тему «${t.name}»?`))
                      apply((d) => deleteTheme(d, t.id));
                  }}
                />
              </li>
            );
          })}
        </ul>
      </Box>
    </>
  );
}
