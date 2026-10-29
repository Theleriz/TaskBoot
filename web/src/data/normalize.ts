import { clozeNumbers } from './cloze.ts';
import { newId } from './ids.ts';
import {
  type AppData,
  type CardRating,
  type CardState,
  type CheckItem,
  type Deck,
  type Flashcard,
  type Folder,
  type Goal,
  type LinkItem,
  type DayActivity,
  type Note,
  type ReviewEntry,
  type SavedTheme,
  type Schedule,
  type Secret,
  type Settings,
  type Task,
  type ThemeSettings,
  type Workspace,
  type WorkspaceTab,
  DAY_ACTIVITY_FIELDS,
  DEFAULT_WORKSPACE,
  WORKSPACE_TABS,
  BASIC_SLOT,
  CARD_KINDS,
  CARD_STATES,
  DEFAULT_THEME_COLORS,
  DURATION_LIMITS,
  NEW_CARDS_LIMITS,
  QUADRANTS,
  RATINGS,
  REVIEW_LOG_LIMIT,
  STATUSES,
  THEME_MODES,
} from './model.ts';
import { CURRENT_SCHEMA_VERSION } from './schema.ts';
import { normalizeUrl } from './url.ts';

// Turns anything (a parsed JSON file, legacy storage) into valid AppData.
// Same rules as the legacy web app and the native Store: records without a title are dropped,
// missing fields get empty defaults (N-23, F-98), enums fall back to defaults,
// durations are clamped (F-34) and duplicate ids are replaced.

type UnknownRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const time = (v: unknown, fallback: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const oneOf = <T extends string>(values: readonly T[], v: unknown, fallback: T): T =>
  values.includes(v as T) ? (v as T) : fallback;

function hexColor(v: unknown): string | null {
  return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v.trim()) ? v.trim().toUpperCase() : null;
}

/** Gives every record a unique id, generating new ones for missing or repeated ids. */
function uniqueIds<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  for (const item of items) {
    if (!item.id || seen.has(item.id)) item.id = newId();
    seen.add(item.id);
  }
  return items;
}

function normalizeChecklist(v: unknown): CheckItem[] {
  return uniqueIds(
    list(v)
      .filter(isRecord)
      .map((i) => ({ id: str(i.id), text: str(i.text).trim(), done: i.done === true }))
      .filter((i) => i.text.length > 0),
  );
}

function normalizeLinks(v: unknown): LinkItem[] {
  const links: LinkItem[] = [];
  for (const l of list(v).filter(isRecord)) {
    const url = normalizeUrl(l.url);
    if (url) links.push({ id: str(l.id), url, label: str(l.label).trim() });
  }
  return uniqueIds(links);
}

export function normalizeTask(
  v: unknown,
  now = Date.now(),
  goalIds: ReadonlySet<string> = new Set(),
): Task | null {
  if (!isRecord(v)) return null;
  const title = str(v.title).trim();
  if (!title) return null;
  const status = oneOf(STATUSES, v.status, 'todo');
  return {
    id: str(v.id),
    title,
    quadrant: oneOf(QUADRANTS, v.quadrant, 'q2'),
    status,
    createdAt: time(v.createdAt, now),
    // Only a done task has a completion time.
    doneAt:
      status === 'done' && typeof v.doneAt === 'number' && Number.isFinite(v.doneAt)
        ? v.doneAt
        : null,
    // A task in progress or done is on the boards, whatever the flag says.
    backlog: v.backlog === true && status === 'todo',
    goalId: typeof v.goalId === 'string' && goalIds.has(v.goalId) ? v.goalId : null,
    description: str(v.description),
    checklist: normalizeChecklist(v.checklist),
    links: normalizeLinks(v.links),
  };
}

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

function normalizeGoal(v: unknown, now: number): Goal | null {
  if (!isRecord(v)) return null;
  const title = str(v.title).trim();
  if (!title) return null;
  const deadline = str(v.deadline);
  return {
    id: str(v.id),
    title,
    description: str(v.description),
    deadline: DAY_KEY.test(deadline) ? deadline : null,
    createdAt: time(v.createdAt, now),
  };
}

function normalizeFolder(v: unknown, now: number): Folder | null {
  if (!isRecord(v)) return null;
  const name = str(v.name).trim();
  if (!name) return null;
  const parentId = typeof v.parentId === 'string' && v.parentId ? v.parentId : null;
  return { id: str(v.id), name, parentId, createdAt: time(v.createdAt, now) };
}

/**
 * Folders whose parent is missing move to the root. A cycle (A inside B inside A) is broken by
 * moving one of its folders to the root; folders hanging below the cycle keep their parent.
 */
function fixFolderTree(folders: Folder[]): Folder[] {
  const byId = new Map(folders.map((f) => [f.id, f]));
  for (const f of folders) {
    if (f.parentId !== null && (!byId.has(f.parentId) || f.parentId === f.id)) f.parentId = null;
  }
  for (const f of folders) {
    const path = new Set<string>();
    for (let node: Folder | undefined = f; node; node = byId.get(node.parentId ?? '')) {
      if (path.has(node.id)) {
        node.parentId = null;
        break;
      }
      path.add(node.id);
    }
  }
  return folders;
}

function normalizeNote(
  v: unknown,
  now: number,
  folderIds: ReadonlySet<string>,
  taskIds: ReadonlySet<string>,
): Note | null {
  if (!isRecord(v)) return null;
  const title = str(v.title).trim();
  if (!title) return null;
  const createdAt = time(v.createdAt, now);
  const folderId = typeof v.folderId === 'string' && folderIds.has(v.folderId) ? v.folderId : null;
  const links = list(v.taskIds).filter(
    (id): id is string => typeof id === 'string' && taskIds.has(id),
  );
  return {
    id: str(v.id),
    title,
    text: str(v.text),
    folderId,
    taskIds: [...new Set(links)],
    createdAt,
    updatedAt: time(v.updatedAt, createdAt),
  };
}

function normalizeSecret(v: unknown, now: number): Secret | null {
  if (!isRecord(v)) return null;
  const name = str(v.name).trim();
  if (!name) return null;
  return { id: str(v.id), name, value: str(v.value), createdAt: time(v.createdAt, now) };
}

function duration(v: unknown, limits: { min: number; max: number; default: number }): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return limits.default;
  const minutes = Math.round(v);
  // Zero or less is treated as "not set", like the legacy apps did.
  if (minutes <= 0) return limits.default;
  return Math.min(limits.max, Math.max(limits.min, minutes));
}

/** Unlike durations, zero is a valid count ("no new cards today"). */
function count(v: unknown, limits: { min: number; max: number; default: number }): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) return limits.default;
  return Math.min(limits.max, Math.max(limits.min, Math.round(v)));
}

function normalizeTheme(v: unknown): ThemeSettings {
  const t = isRecord(v) ? v : {};
  return {
    mode: oneOf(THEME_MODES, t.mode, 'system'),
    customBg: hexColor(t.customBg) ?? DEFAULT_THEME_COLORS.bg,
    customAccent: hexColor(t.customAccent) ?? DEFAULT_THEME_COLORS.accent,
    randomBg: hexColor(t.randomBg),
    randomAccent: hexColor(t.randomAccent),
    savedId: typeof t.savedId === 'string' && t.savedId ? t.savedId : null,
  };
}

function normalizeSavedThemes(v: unknown): SavedTheme[] {
  const themes: SavedTheme[] = [];
  for (const t of list(v).filter(isRecord)) {
    const name = str(t.name).trim();
    const bg = hexColor(t.bg);
    const accent = hexColor(t.accent);
    if (name && bg && accent) themes.push({ id: str(t.id), name, bg, accent });
  }
  return uniqueIds(themes);
}

/** Unknown tabs and repeated ones are dropped; a workspace without tabs is dropped too. */
function normalizeWorkspaces(v: unknown): Workspace[] {
  const workspaces: Workspace[] = [];
  for (const w of list(v).filter(isRecord)) {
    const name = str(w.name).trim();
    const tabs = [
      ...new Set(
        list(w.tabs).filter((t): t is WorkspaceTab => WORKSPACE_TABS.includes(t as WorkspaceTab)),
      ),
    ];
    if (name && tabs.length > 0) workspaces.push({ id: str(w.id), name, tabs });
  }
  return workspaces.length > 0
    ? uniqueIds(workspaces)
    : [{ ...DEFAULT_WORKSPACE, tabs: [...DEFAULT_WORKSPACE.tabs] }];
}

/** Counters are whole numbers ≥ 0; empty days and malformed keys are dropped. */
function normalizeActivity(v: unknown): Record<string, DayActivity> {
  const out: Record<string, DayActivity> = {};
  if (!isRecord(v)) return out;
  for (const [key, value] of Object.entries(v)) {
    if (!DAY_KEY.test(key) || !isRecord(value)) continue;
    const day = Object.fromEntries(
      DAY_ACTIVITY_FIELDS.map((f) => [f, Math.max(0, Math.round(num(value[f])))]),
    ) as unknown as DayActivity;
    if (DAY_ACTIVITY_FIELDS.some((f) => day[f] > 0)) out[key] = day;
  }
  return out;
}

export function normalizeSettings(v: unknown): Settings {
  const s = isRecord(v) ? v : {};
  const settings: Settings = {
    workMinutes: duration(s.workMinutes, DURATION_LIMITS.workMinutes),
    restMinutes: duration(s.restMinutes, DURATION_LIMITS.restMinutes),
    newCardsPerDay: count(s.newCardsPerDay, NEW_CARDS_LIMITS),
    theme: normalizeTheme(s.theme),
    themes: normalizeSavedThemes(s.themes),
    workspaces: normalizeWorkspaces(s.workspaces),
  };
  // A saved theme that no longer exists falls back to the system theme.
  if (
    settings.theme.mode === 'saved' &&
    !settings.themes.some((t) => t.id === settings.theme.savedId)
  ) {
    settings.theme.mode = 'system';
    settings.theme.savedId = null;
  }
  return settings;
}

/* ---------- Flashcards (schema 3) ---------- */

const num = (v: unknown, fallback = 0): number =>
  typeof v === 'number' && Number.isFinite(v) ? v : fallback;

/** The schedule of a review item that was never studied (what ts-fsrs creates). */
export function emptySchedule(now: number): Schedule {
  return {
    due: now,
    stability: 0,
    difficulty: 0,
    elapsedDays: 0,
    scheduledDays: 0,
    learningSteps: 0,
    reps: 0,
    lapses: 0,
    state: 0,
    lastReview: null,
  };
}

function normalizeSchedule(v: unknown, now: number): Schedule {
  if (!isRecord(v)) return emptySchedule(now);
  const state = CARD_STATES.includes(v.state as CardState) ? (v.state as CardState) : 0;
  return {
    due: num(v.due, now),
    stability: Math.max(0, num(v.stability)),
    difficulty: Math.max(0, num(v.difficulty)),
    elapsedDays: Math.max(0, num(v.elapsedDays)),
    scheduledDays: Math.max(0, num(v.scheduledDays)),
    learningSteps: Math.max(0, Math.round(num(v.learningSteps))),
    reps: Math.max(0, Math.round(num(v.reps))),
    lapses: Math.max(0, Math.round(num(v.lapses))),
    state,
    lastReview:
      typeof v.lastReview === 'number' && Number.isFinite(v.lastReview) ? v.lastReview : null,
  };
}

function normalizeDeck(v: unknown, now: number): Deck | null {
  if (!isRecord(v)) return null;
  const name = str(v.name).trim();
  if (!name) return null;
  return { id: str(v.id), name, createdAt: time(v.createdAt, now) };
}

/**
 * Review items follow the card: one for a basic card, one per gap number for a cloze card.
 * Known items keep their schedules; new ones start fresh. A cloze card without gaps cannot be
 * studied, so it becomes a basic card.
 */
export function cardSlots(kind: Flashcard['kind'], front: string): string[] {
  return kind === 'cloze' ? clozeNumbers(front) : [BASIC_SLOT];
}

function normalizeCard(
  v: unknown,
  now: number,
  noteIds: ReadonlySet<string>,
): (Flashcard & { deckId: string }) | null {
  if (!isRecord(v)) return null;
  const front = str(v.front);
  if (!front.trim()) return null;
  let kind = oneOf(CARD_KINDS, v.kind, 'basic');
  if (kind === 'cloze' && clozeNumbers(front).length === 0) kind = 'basic';
  const stored = isRecord(v.schedules) ? v.schedules : {};
  const schedules: Record<string, Schedule> = {};
  for (const slot of cardSlots(kind, front)) schedules[slot] = normalizeSchedule(stored[slot], now);
  const createdAt = time(v.createdAt, now);
  return {
    id: str(v.id),
    deckId: str(v.deckId),
    kind,
    front,
    back: str(v.back),
    noteId: typeof v.noteId === 'string' && noteIds.has(v.noteId) ? v.noteId : null,
    schedules,
    createdAt,
    updatedAt: time(v.updatedAt, createdAt),
  };
}

function normalizeReview(v: unknown, cardIds: ReadonlySet<string>): ReviewEntry | null {
  if (!isRecord(v)) return null;
  const cardId = str(v.cardId);
  const rating = v.rating as CardRating;
  if (!cardIds.has(cardId) || !RATINGS.includes(rating) || typeof v.at !== 'number') return null;
  return {
    cardId,
    slot: str(v.slot),
    rating,
    state: CARD_STATES.includes(v.state as CardState) ? (v.state as CardState) : 0,
    at: v.at,
  };
}

/** Cards whose deck is missing go to a recovered deck instead of being lost. */
function normalizeFlashcards(
  d: Record<string, unknown>,
  now: number,
  noteIds: ReadonlySet<string>,
) {
  const keep = <T>(x: T | null): x is T => x !== null;
  const decks = uniqueIds(
    list(d.decks)
      .map((x) => normalizeDeck(x, now))
      .filter(keep),
  );
  const cards = uniqueIds(
    list(d.cards)
      .map((x) => normalizeCard(x, now, noteIds))
      .filter(keep),
  );
  const deckIds = new Set(decks.map((x) => x.id));
  const orphans = cards.filter((c) => !deckIds.has(c.deckId));
  if (orphans.length > 0) {
    const recovered = { id: newId(), name: 'Без колоды', createdAt: now };
    decks.push(recovered);
    for (const c of orphans) c.deckId = recovered.id;
  }
  const cardIds = new Set(cards.map((c) => c.id));
  const reviews = list(d.reviews)
    .map((x) => normalizeReview(x, cardIds))
    .filter(keep)
    .slice(-REVIEW_LOG_LIMIT);
  return { decks, cards, reviews };
}

/** Expects data already migrated to the current schema (see migrate()). */
export function normalizeAppData(v: unknown, now = Date.now()): AppData {
  const d = isRecord(v) ? v : {};
  const keep = <T>(x: T | null): x is T => x !== null;
  const goals = uniqueIds(
    list(d.goals)
      .map((g) => normalizeGoal(g, now))
      .filter(keep),
  );
  const goalIds = new Set(goals.map((g) => g.id));
  const tasks = uniqueIds(
    list(d.tasks)
      .map((t) => normalizeTask(t, now, goalIds))
      .filter(keep),
  );
  // Duplicate folder ids get new values before the tree is checked, so parent links stay unambiguous.
  const folders = fixFolderTree(
    uniqueIds(
      list(d.folders)
        .map((f) => normalizeFolder(f, now))
        .filter(keep),
    ),
  );
  const folderIds = new Set(folders.map((f) => f.id));
  const taskIds = new Set(tasks.map((t) => t.id));
  const notes = uniqueIds(
    list(d.notes)
      .map((n) => normalizeNote(n, now, folderIds, taskIds))
      .filter(keep),
  );
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks,
    goals,
    folders,
    notes,
    secrets: uniqueIds(
      list(d.secrets)
        .map((s) => normalizeSecret(s, now))
        .filter(keep),
    ),
    ...normalizeFlashcards(d, now, new Set(notes.map((n) => n.id))),
    activity: normalizeActivity(d.activity),
    settings: normalizeSettings(d.settings),
  };
}

export function createEmptyData(): AppData {
  return normalizeAppData({});
}
