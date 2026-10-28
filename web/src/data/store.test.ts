import { IDBFactory } from 'fake-indexeddb';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Transport } from '../bridge/client.ts';
import { createBridgeClient } from '../bridge/client.ts';
import type { RequestMessage } from '../bridge/protocol.ts';
import { DataFormatError, SchemaTooNewError, StorageError } from './errors.ts';
import { type KeyValueStore, createIdbKeyValue } from './idb.ts';
import { LEGACY_KEYS } from './legacy.ts';
import { createEmptyData } from './normalize.ts';
import { CURRENT_SCHEMA_VERSION } from './schema.ts';
import {
  BROWSER_DATA_KEY,
  IDB_DATA_KEY,
  createBrowserDataStore,
  createBrowserStore,
  createDataStore,
  createIndexedDbStore,
  createMemoryStore,
  createShellStore,
} from './store.ts';

beforeEach(() => {
  localStorage.clear();
});

describe('browser store', () => {
  it('starts empty when nothing is stored', async () => {
    const result = await createBrowserStore(localStorage).load();
    expect(result).toEqual({ data: createEmptyData(), origin: 'new' });
  });

  it('imports the legacy web app keys once and leaves them untouched (N-22)', async () => {
    localStorage.setItem(LEGACY_KEYS.tasks, JSON.stringify([{ id: 'a', title: 'Old task' }]));
    localStorage.setItem(LEGACY_KEYS.settings, JSON.stringify({ workMinutes: 30 }));
    localStorage.setItem(LEGACY_KEYS.notes, '{broken');

    const store = createBrowserStore(localStorage);
    const first = await store.load();
    expect(first.origin).toBe('legacy');
    expect(first.data.tasks[0]).toMatchObject({ title: 'Old task', checklist: [], links: [] });
    expect(first.data.settings.workMinutes).toBe(30);
    expect(first.data.notes).toEqual([]);

    await store.save(first.data);
    const second = await store.load();
    expect(second.origin).toBe('stored');
    expect(second.data).toEqual(first.data);
    expect(localStorage.getItem(LEGACY_KEYS.tasks)).toContain('Old task');
  });

  it('keeps a copy of broken data and reports it', async () => {
    localStorage.setItem(BROWSER_DATA_KEY, '{broken');
    await expect(createBrowserStore(localStorage).load()).rejects.toThrow(DataFormatError);
    const backups = Object.keys(localStorage).filter((k) =>
      k.startsWith(`${BROWSER_DATA_KEY}.corrupt-`),
    );
    expect(backups).toHaveLength(1);
    expect(localStorage.getItem(backups[0] ?? '')).toBe('{broken');
  });

  it('refuses data from a newer app without touching it', async () => {
    const newer = JSON.stringify({ schemaVersion: 99, tasks: [] });
    localStorage.setItem(BROWSER_DATA_KEY, newer);
    await expect(createBrowserStore(localStorage).load()).rejects.toThrow(SchemaTooNewError);
    expect(localStorage.getItem(BROWSER_DATA_KEY)).toBe(newer);
  });

  it('turns storage failures into StorageError', async () => {
    const full = {
      getItem: () => null,
      setItem: () => {
        throw new Error('QuotaExceededError');
      },
    } as unknown as Storage;
    await expect(createBrowserStore(full).save(createEmptyData())).rejects.toThrow(StorageError);
  });
});

describe('IndexedDB store', () => {
  // A fresh database per test.
  const kv = () => createIdbKeyValue(new IDBFactory());
  const indexedDbStore = (store: KeyValueStore) =>
    createIndexedDbStore(store, createBrowserStore(localStorage));

  it('starts empty when nothing is stored anywhere', async () => {
    const result = await indexedDbStore(kv()).load();
    expect(result).toEqual({ data: createEmptyData(), origin: 'new' });
  });

  it('moves data from localStorage once and leaves the old key untouched', async () => {
    const old = createEmptyData();
    old.tasks.push({
      id: 't1',
      title: 'From v2.0',
      quadrant: 'q1',
      status: 'doing',
      createdAt: 1,
      doneAt: null,
      backlog: false,
      goalId: null,
      description: '',
      checklist: [],
      links: [],
    });
    // v2.0.0 stored schema 1.
    const v1 = JSON.stringify({ ...old, schemaVersion: 1, folders: undefined });
    localStorage.setItem(BROWSER_DATA_KEY, v1);

    const store = indexedDbStore(kv());
    const first = await store.load();
    expect(first.origin).toBe('moved');
    expect(first.data.tasks[0]?.title).toBe('From v2.0');

    first.data.settings.workMinutes = 25;
    await store.save(first.data);
    const second = await store.load();
    expect(second.origin).toBe('stored');
    expect(second.data).toEqual(first.data);
    expect(localStorage.getItem(BROWSER_DATA_KEY)).toBe(v1);
  });

  it('imports the legacy web app keys when there is nothing newer', async () => {
    localStorage.setItem(LEGACY_KEYS.tasks, JSON.stringify([{ id: 'a', title: 'Old task' }]));
    const result = await indexedDbStore(kv()).load();
    expect(result.origin).toBe('legacy');
    expect(result.data.tasks[0]?.title).toBe('Old task');
  });

  it('keeps a copy of broken data and reports it', async () => {
    const store = kv();
    await store.set(IDB_DATA_KEY, '{broken');
    await expect(indexedDbStore(store).load()).rejects.toThrow(DataFormatError);
    const backups = (await store.keys()).filter((k) => k.startsWith(`${IDB_DATA_KEY}.corrupt-`));
    expect(backups).toHaveLength(1);
    await expect(store.get(backups[0] ?? '')).resolves.toBe('{broken');
  });

  it('refuses data from a newer app without touching it', async () => {
    const store = kv();
    const newer = JSON.stringify({ schemaVersion: 99, tasks: [] });
    await store.set(IDB_DATA_KEY, newer);
    await expect(indexedDbStore(store).load()).rejects.toThrow(SchemaTooNewError);
    await expect(store.get(IDB_DATA_KEY)).resolves.toBe(newer);
  });

  it('falls back to localStorage for the session when IndexedDB does not open', async () => {
    const broken: KeyValueStore = {
      get: () => Promise.reject(new Error('InvalidStateError')),
      set: () => Promise.reject(new Error('InvalidStateError')),
      keys: () => Promise.reject(new Error('InvalidStateError')),
    };
    const store = indexedDbStore(broken);
    const first = await store.load();
    expect(first.origin).toBe('new');
    first.data.settings.restMinutes = 7;
    await store.save(first.data);
    expect(localStorage.getItem(BROWSER_DATA_KEY)).toContain('"restMinutes":7');
  });

  it('turns write failures into StorageError', async () => {
    const full: KeyValueStore = {
      get: () => Promise.resolve(undefined),
      set: () => Promise.reject(new Error('QuotaExceededError')),
      keys: () => Promise.resolve([]),
    };
    const store = createIndexedDbStore(full, null);
    await store.load();
    await expect(store.save(createEmptyData())).rejects.toThrow(StorageError);
  });
});

describe('memory store', () => {
  it('keeps saved data until reload', async () => {
    const store = createMemoryStore();
    const data = createEmptyData();
    data.settings.workMinutes = 50;
    await store.save(data);
    expect((await store.load()).data.settings.workMinutes).toBe(50);
    expect(store.persistent).toBe(false);
  });
});

/** Fake WebView2 host that answers storage requests from an in-memory "file". */
function fakeShell(initialFile: string | null) {
  let file = initialFile;
  let handler: ((message: unknown) => void) | null = null;
  const transport: Transport = {
    send(message: RequestMessage) {
      queueMicrotask(() => {
        if (message.method === 'storage.load') {
          handler?.({ kind: 'response', id: message.id, ok: true, result: { json: file } });
        } else if (message.method === 'storage.save') {
          file = (message.payload as { json: string }).json;
          handler?.({ kind: 'response', id: message.id, ok: true, result: null });
        } else {
          handler?.({
            kind: 'response',
            id: message.id,
            ok: false,
            error: { code: 'unknown_method', message: 'nope' },
          });
        }
      });
    },
    listen(h) {
      handler = h;
      return () => {
        handler = null;
      };
    },
  };
  return { transport, file: () => file };
}

describe('shell store', () => {
  it('loads and saves data.json through the bridge', async () => {
    const shell = fakeShell(null);
    const store = createShellStore(createBridgeClient(shell.transport));

    const first = await store.load();
    expect(first.origin).toBe('new');

    first.data.settings.restMinutes = 20;
    await store.save(first.data);
    expect(JSON.parse(shell.file() ?? 'null')).toMatchObject({
      schemaVersion: CURRENT_SCHEMA_VERSION,
      settings: { restMinutes: 20 },
    });

    const second = await store.load();
    expect(second).toMatchObject({ origin: 'stored', data: { settings: { restMinutes: 20 } } });
  });

  it('reads an existing native data.json (schema 0)', async () => {
    const shell = fakeShell(JSON.stringify({ tasks: [{ id: 'a', title: 'Native' }] }));
    const result = await createShellStore(createBridgeClient(shell.transport)).load();
    expect(result.data.tasks[0]?.title).toBe('Native');
  });
});

describe('createDataStore', () => {
  it('uses browser storage outside the shell', () => {
    expect(createDataStore(window).kind).toBe('browser');
  });

  it('prefers IndexedDB and keeps localStorage as the source to move from', async () => {
    localStorage.setItem(BROWSER_DATA_KEY, JSON.stringify({ schemaVersion: 1, tasks: [] }));
    const win = { indexedDB: new IDBFactory(), localStorage } as unknown as Window;
    const store = createBrowserDataStore(win);
    expect(store).toMatchObject({ kind: 'browser', persistent: true });
    expect((await store.load()).origin).toBe('moved');
  });

  it('uses the bridge inside WebView2', () => {
    const fakeWindow = {
      chrome: {
        webview: { postMessage() {}, addEventListener() {}, removeEventListener() {} },
      },
    } as unknown as Window;
    expect(createDataStore(fakeWindow).kind).toBe('shell');
  });

  it('falls back to memory when storage is blocked', () => {
    const blocked = {
      get localStorage(): Storage {
        throw new Error('SecurityError');
      },
    } as unknown as Window;
    expect(createDataStore(blocked)).toMatchObject({ kind: 'memory', persistent: false });
  });
});
