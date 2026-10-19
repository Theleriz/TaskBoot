import { BridgeError, type BridgeClient, createBridgeClient } from '../bridge/client.ts';
import { createWebViewTransport, getWebView } from '../bridge/webview.ts';
import { DataFormatError, StorageError } from './errors.ts';
import { readLegacyData } from './legacy.ts';
import type { AppData } from './model.ts';
import { createEmptyData } from './normalize.ts';
import { parseAppDataJson } from './parse.ts';

export interface LoadResult {
  data: AppData;
  /**
   * stored — read from this store;
   * legacy — nothing stored yet, imported from the legacy web app's keys in this browser;
   * new — nothing found, empty data.
   */
  origin: 'stored' | 'legacy' | 'new';
}

/**
 * Where AppData lives. load() throws DataFormatError (stored data is broken; a backup copy is kept)
 * or SchemaTooNewError (data from a newer app; the caller must not save over it).
 * save() throws StorageError.
 */
export interface DataStore {
  readonly kind: 'browser' | 'shell' | 'memory';
  /** false when data will be lost on reload (storage unavailable). */
  readonly persistent: boolean;
  load(): Promise<LoadResult>;
  save(data: AppData): Promise<void>;
}

/** Current data lives under one key; the legacy keys stay untouched (N-22). */
export const BROWSER_DATA_KEY = 'taskTracker.data';

export function createBrowserStore(storage: Storage, key = BROWSER_DATA_KEY): DataStore {
  return {
    kind: 'browser',
    persistent: true,

    async load() {
      const raw = storage.getItem(key);
      if (raw === null) {
        const legacy = readLegacyData(storage);
        return legacy
          ? { data: legacy, origin: 'legacy' }
          : { data: createEmptyData(), origin: 'new' };
      }
      try {
        return { data: parseAppDataJson(raw), origin: 'stored' };
      } catch (e) {
        if (e instanceof DataFormatError) {
          // Keep the broken copy so nothing is lost when the app saves fresh data over the key.
          try {
            storage.setItem(`${key}.corrupt-${Date.now()}`, raw);
          } catch {
            /* no space for a backup; the error below still reaches the user */
          }
        }
        throw e;
      }
    },

    async save(data) {
      try {
        storage.setItem(key, JSON.stringify(data));
      } catch (e) {
        throw new StorageError(
          'Could not save: browser storage is full or blocked. ' +
            (e instanceof Error ? e.message : ''),
        );
      }
    },
  };
}

/** Data in %APPDATA%\TaskTracker\data.json, read and written by the Windows shell. */
export function createShellStore(bridge: BridgeClient): DataStore {
  return {
    kind: 'shell',
    persistent: true,

    async load() {
      const { json } = await bridge.request('storage.load', null);
      if (json === null) return { data: createEmptyData(), origin: 'new' };
      // The native app keeps its own .corrupt backup of a broken data.json.
      return { data: parseAppDataJson(json), origin: 'stored' };
    },

    async save(data) {
      try {
        await bridge.request('storage.save', { json: JSON.stringify(data, null, 2) });
      } catch (e) {
        if (e instanceof BridgeError) throw new StorageError(`Could not save: ${e.message}`);
        throw e;
      }
    },
  };
}

/** Keeps data in memory only (tests, or when browser storage is unavailable). */
export function createMemoryStore(
  initial: AppData | null = null,
): DataStore & { snapshot(): AppData | null } {
  let saved: string | null = initial ? JSON.stringify(initial) : null;
  return {
    kind: 'memory',
    persistent: false,
    async load() {
      return saved === null
        ? { data: createEmptyData(), origin: 'new' }
        : { data: parseAppDataJson(saved), origin: 'stored' };
    },
    async save(data) {
      saved = JSON.stringify(data);
    },
    snapshot() {
      return saved === null ? null : (JSON.parse(saved) as AppData);
    },
  };
}

function availableLocalStorage(win: Window): Storage | null {
  try {
    const s = win.localStorage;
    const probe = '__taskTracker_probe__';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** Picks the store for the current environment: shell bridge, browser storage, or memory. */
export function createDataStore(win: Window = window): DataStore {
  const webview = getWebView(win);
  if (webview) return createShellStore(createBridgeClient(createWebViewTransport(webview)));
  const storage = availableLocalStorage(win);
  return storage ? createBrowserStore(storage) : createMemoryStore();
}
