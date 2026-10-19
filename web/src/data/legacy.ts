import type { AppData } from './model.ts';
import { parseAppData } from './parse.ts';

/** Keys of the legacy single-file web app (web/legacy). They are only read, never written (N-22). */
export const LEGACY_KEYS = {
  tasks: 'taskTracker.tasks',
  settings: 'taskTracker.settings',
  notes: 'taskTracker.notes',
  secrets: 'taskTracker.secrets',
} as const;

function readJson(storage: Storage, key: string): unknown {
  const raw = storage.getItem(key);
  if (raw === null) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    // The legacy app keeps its own `.corrupt` copy; a broken part is imported as empty.
    return undefined;
  }
}

/** Data saved by the legacy web app in this browser, or null if it never ran here. */
export function readLegacyData(storage: Storage): AppData | null {
  const keys = Object.values(LEGACY_KEYS);
  if (!keys.some((k) => storage.getItem(k) !== null)) return null;

  return parseAppData({
    tasks: readJson(storage, LEGACY_KEYS.tasks),
    settings: readJson(storage, LEGACY_KEYS.settings),
    notes: readJson(storage, LEGACY_KEYS.notes),
    secrets: readJson(storage, LEGACY_KEYS.secrets),
  });
}
