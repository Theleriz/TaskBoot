import { SchemaTooNewError } from './errors.ts';

/**
 * Version of the stored data format.
 * 0 — no `schemaVersion` field: native data.json and the legacy web app (same shape as 1).
 * 1 — phase 0.3: the same fields plus `schemaVersion`.
 * 2 — phase 1.1: knowledge space — `folders`, and `folderId` / `taskIds` in notes.
 *     Existing notes go to the root folder without links (filled in by normalization).
 * 3 — phase 1.5: flashcards — `decks`, `cards`, `reviews`, and `settings.newCardsPerDay`.
 * 4 — phase 2.1: `settings.workspaces`, daily `activity` counters, `doneAt` in tasks.
 *     Done tasks get `doneAt: null` (the time is unknown); counting starts with this version.
 * 5 — phase 2.3: `goals`, and `backlog` / `goalId` in tasks. The default workspace
 *     «Основное» gets the new «Бэклог» tab; other workspaces keep their tabs.
 * 6 — phase 2.4: no new fields; «Основное» gets the new «Статистика» tab at the end.
 *
 * To change the format: bump this number and add a migration from the previous version.
 */
export const CURRENT_SCHEMA_VERSION = 6;

type Data = Record<string, unknown>;

// MIGRATIONS[n] turns version n into version n + 1.
const MIGRATIONS: Record<number, (data: Data) => Data> = {
  0: (data) => ({ ...data, schemaVersion: 1 }),
  1: (data) => {
    const next: Data = { ...data, schemaVersion: 2, folders: [] };
    if (Array.isArray(data.notes)) {
      next.notes = data.notes.map((n: unknown) =>
        typeof n === 'object' && n !== null ? { ...n, folderId: null, taskIds: [] } : n,
      );
    }
    return next;
  },
  // Nothing to convert: the new lists start empty, the new setting gets its default.
  2: (data) => ({ ...data, schemaVersion: 3, decks: [], cards: [], reviews: [] }),
  // Workspaces get the default set in normalization; doneAt of old tasks stays unknown.
  3: (data) => ({ ...data, schemaVersion: 4, activity: {} }),
  // Tasks get `backlog: false` and no goal in normalization.
  4: (data) => {
    const next: Data = { ...data, schemaVersion: 5, goals: [] };
    const settings = data.settings;
    if (typeof settings === 'object' && settings !== null && !Array.isArray(settings)) {
      const s = settings as Data;
      if (Array.isArray(s.workspaces)) {
        next.settings = { ...s, workspaces: s.workspaces.map(withBacklogTab) };
      }
    }
    return next;
  },
  5: (data) => ({ ...data, schemaVersion: 6, settings: withMainTab(data.settings, 'stats') }),
};

/** Adds a new tab at the end of «Основное», unless it is there already. */
function withMainTab(settings: unknown, tab: string): unknown {
  if (typeof settings !== 'object' || settings === null || Array.isArray(settings)) return settings;
  const s = settings as Data;
  if (!Array.isArray(s.workspaces)) return settings;
  const workspaces = s.workspaces.map((w: unknown) => {
    if (typeof w !== 'object' || w === null) return w;
    const ws = w as Data;
    if (ws.id !== 'main' || !Array.isArray(ws.tabs) || ws.tabs.includes(tab)) return w;
    return { ...ws, tabs: [...(ws.tabs as unknown[]), tab] };
  });
  return { ...s, workspaces };
}

/** «Основное» gets the backlog tab right after «Канбан» (or at the end without it). */
function withBacklogTab(w: unknown): unknown {
  if (typeof w !== 'object' || w === null) return w;
  const ws = w as Data;
  if (ws.id !== 'main' || !Array.isArray(ws.tabs) || ws.tabs.includes('backlog')) return w;
  const tabs = [...(ws.tabs as unknown[])];
  const kanban = tabs.indexOf('kanban');
  tabs.splice(kanban === -1 ? tabs.length : kanban + 1, 0, 'backlog');
  return { ...ws, tabs };
}

export function schemaVersionOf(data: Data): number {
  const v = data.schemaVersion;
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
}

/** Brings data up to CURRENT_SCHEMA_VERSION. Throws SchemaTooNewError for data from a newer app. */
export function migrate(data: Data): Data {
  let version = schemaVersionOf(data);
  if (version > CURRENT_SCHEMA_VERSION) throw new SchemaTooNewError(version);

  let current = data;
  while (version < CURRENT_SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`Missing data migration from schema version ${version}.`);
    current = step(current);
    version += 1;
  }
  return current;
}
