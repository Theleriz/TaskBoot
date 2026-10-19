// Data model shared by the web app and the Windows shell.
// Field names match the native app's data.json and the legacy web app, so existing data
// imports without renaming (base spec 5.1, spec 02 5.1).

export const QUADRANTS = ['q1', 'q2', 'q3', 'q4'] as const;
export type Quadrant = (typeof QUADRANTS)[number];

export const STATUSES = ['todo', 'doing', 'done'] as const;
export type Status = (typeof STATUSES)[number];

export interface CheckItem {
  id: string;
  text: string;
  done: boolean;
}

export interface LinkItem {
  id: string;
  url: string;
  label: string;
}

export interface Task {
  id: string;
  title: string;
  quadrant: Quadrant;
  status: Status;
  /** Unix time in milliseconds. */
  createdAt: number;
  description: string;
  checklist: CheckItem[];
  links: LinkItem[];
}

export interface Note {
  id: string;
  title: string;
  text: string;
  createdAt: number;
  updatedAt: number;
}

/** Stored in plain text, like everything else (spec 02, 3.1). */
export interface Secret {
  id: string;
  name: string;
  value: string;
  createdAt: number;
}

export const THEME_MODES = ['system', 'light', 'dark', 'custom', 'random', 'saved'] as const;
export type ThemeMode = (typeof THEME_MODES)[number];

/** Colors are `#RRGGBB`. */
export interface ThemeSettings {
  mode: ThemeMode;
  customBg: string;
  customAccent: string;
  randomBg: string | null;
  randomAccent: string | null;
  savedId: string | null;
}

export interface SavedTheme {
  id: string;
  name: string;
  bg: string;
  accent: string;
}

export interface Settings {
  workMinutes: number;
  restMinutes: number;
  theme: ThemeSettings;
  themes: SavedTheme[];
}

export interface AppData {
  schemaVersion: number;
  tasks: Task[];
  notes: Note[];
  secrets: Secret[];
  settings: Settings;
}

export const DURATION_LIMITS = {
  workMinutes: { min: 1, max: 180, default: 45 },
  restMinutes: { min: 1, max: 60, default: 15 },
} as const;

export const DEFAULT_THEME_COLORS = { bg: '#F3F4F6', accent: '#3B5BDB' } as const;
