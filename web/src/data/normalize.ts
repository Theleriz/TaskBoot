import { newId } from './ids.ts';
import {
  type AppData,
  type CheckItem,
  type Folder,
  type LinkItem,
  type Note,
  type SavedTheme,
  type Secret,
  type Settings,
  type Task,
  type ThemeSettings,
  DEFAULT_THEME_COLORS,
  DURATION_LIMITS,
  QUADRANTS,
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

export function normalizeTask(v: unknown, now = Date.now()): Task | null {
  if (!isRecord(v)) return null;
  const title = str(v.title).trim();
  if (!title) return null;
  return {
    id: str(v.id),
    title,
    quadrant: oneOf(QUADRANTS, v.quadrant, 'q2'),
    status: oneOf(STATUSES, v.status, 'todo'),
    createdAt: time(v.createdAt, now),
    description: str(v.description),
    checklist: normalizeChecklist(v.checklist),
    links: normalizeLinks(v.links),
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

export function normalizeSettings(v: unknown): Settings {
  const s = isRecord(v) ? v : {};
  const settings: Settings = {
    workMinutes: duration(s.workMinutes, DURATION_LIMITS.workMinutes),
    restMinutes: duration(s.restMinutes, DURATION_LIMITS.restMinutes),
    theme: normalizeTheme(s.theme),
    themes: normalizeSavedThemes(s.themes),
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

/** Expects data already migrated to the current schema (see migrate()). */
export function normalizeAppData(v: unknown, now = Date.now()): AppData {
  const d = isRecord(v) ? v : {};
  const keep = <T>(x: T | null): x is T => x !== null;
  const tasks = uniqueIds(
    list(d.tasks)
      .map((t) => normalizeTask(t, now))
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
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    tasks,
    folders,
    notes: uniqueIds(
      list(d.notes)
        .map((n) => normalizeNote(n, now, folderIds, taskIds))
        .filter(keep),
    ),
    secrets: uniqueIds(
      list(d.secrets)
        .map((s) => normalizeSecret(s, now))
        .filter(keep),
    ),
    settings: normalizeSettings(d.settings),
  };
}

export function createEmptyData(): AppData {
  return normalizeAppData({});
}
