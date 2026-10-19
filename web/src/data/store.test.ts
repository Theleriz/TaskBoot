import { beforeEach, describe, expect, it } from 'vitest';
import type { Transport } from '../bridge/client.ts';
import { createBridgeClient } from '../bridge/client.ts';
import type { RequestMessage } from '../bridge/protocol.ts';
import { DataFormatError, SchemaTooNewError, StorageError } from './errors.ts';
import { LEGACY_KEYS } from './legacy.ts';
import { createEmptyData } from './normalize.ts';
import {
  BROWSER_DATA_KEY,
  createBrowserStore,
  createDataStore,
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
      schemaVersion: 1,
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
