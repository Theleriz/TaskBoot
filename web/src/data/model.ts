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

/** A folder in the knowledge space (phase 1). Folders nest; `parentId: null` is the root. */
export interface Folder {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface Note {
  id: string;
  title: string;
  /** Markdown with KaTeX formulas. */
  text: string;
  /** null — the root of the knowledge space. */
  folderId: string | null;
  /** Linked tasks. The link is stored only here; a task finds its notes by this list. */
  taskIds: string[];
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

/* ---------- Flashcards (phase 1.5) ---------- */

export interface Deck {
  id: string;
  name: string;
  createdAt: number;
}

export const CARD_KINDS = ['basic', 'cloze'] as const;
/** basic — question and answer; cloze — text with gaps {{c1::…}}, one review item per gap number. */
export type CardKind = (typeof CARD_KINDS)[number];

/** FSRS states (ts-fsrs `State`): new, learning, review, relearning. */
export const CARD_STATES = [0, 1, 2, 3] as const;
export type CardState = (typeof CARD_STATES)[number];

/** Memory state of one review item. Times are Unix milliseconds. */
export interface Schedule {
  due: number;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: CardState;
  lastReview: number | null;
}

/** The only review item of a basic card. Cloze cards use the gap numbers: "1", "2", … */
export const BASIC_SLOT = '0';

export interface Flashcard {
  id: string;
  deckId: string;
  kind: CardKind;
  /** Markdown with KaTeX; for cloze cards — the text with gaps. */
  front: string;
  /** Markdown; for cloze cards — an optional extra shown with the answer. */
  back: string;
  /** The note the card was made from, if any. */
  noteId: string | null;
  /** Review items by slot (BASIC_SLOT or a gap number). */
  schedules: Record<string, Schedule>;
  createdAt: number;
  updatedAt: number;
}

export const RATINGS = [1, 2, 3, 4] as const;
/** Again, Hard, Good, Easy (ts-fsrs `Rating`). */
export type CardRating = (typeof RATINGS)[number];

/** One answer, kept for statistics (and a future FSRS parameter optimizer). */
export interface ReviewEntry {
  cardId: string;
  slot: string;
  rating: CardRating;
  /** State before the answer. */
  state: CardState;
  at: number;
}

/** The review history is capped: the oldest entries go first. About 100 bytes each. */
export const REVIEW_LOG_LIMIT = 20_000;

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
  /** New flashcards to learn per day, per deck. */
  newCardsPerDay: number;
  theme: ThemeSettings;
  themes: SavedTheme[];
}

export interface AppData {
  schemaVersion: number;
  tasks: Task[];
  folders: Folder[];
  notes: Note[];
  secrets: Secret[];
  decks: Deck[];
  cards: Flashcard[];
  reviews: ReviewEntry[];
  settings: Settings;
}

export const DURATION_LIMITS = {
  workMinutes: { min: 1, max: 180, default: 45 },
  restMinutes: { min: 1, max: 60, default: 15 },
} as const;

export const NEW_CARDS_LIMITS = { min: 0, max: 999, default: 20 } as const;

export const DEFAULT_THEME_COLORS = { bg: '#F3F4F6', accent: '#3B5BDB' } as const;
