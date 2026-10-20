// A minimal key-value store on top of IndexedDB: one database, one object store, string values.
// The app keeps all its data as one JSON document, so this is all it needs (D-05: no library).

export interface KeyValueStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string): Promise<void>;
  keys(): Promise<string[]>;
}

export const IDB_NAME = 'taskTracker';
const OBJECT_STORE = 'kv';

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error('IndexedDB request failed.'));
  });
}

function openDatabase(factory: IDBFactory, name: string): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = factory.open(name, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(OBJECT_STORE);
    request.onsuccess = () => {
      const db = request.result;
      // Another tab with a newer app wants to upgrade the database: let it.
      db.onversionchange = () => db.close();
      resolve(db);
    };
    // `blocked` is not an error: the open waits until older connections close (see onversionchange).
    request.onerror = () => reject(request.error ?? new Error('Could not open IndexedDB.'));
  });
}

/** The database opens on first use; a failed open is retried on the next call. */
export function createIdbKeyValue(factory: IDBFactory, name = IDB_NAME): KeyValueStore {
  let db: Promise<IDBDatabase> | null = null;
  const database = () => {
    db ??= openDatabase(factory, name).catch((e: unknown) => {
      db = null;
      throw e;
    });
    return db;
  };

  return {
    async get(key) {
      const tx = (await database()).transaction(OBJECT_STORE, 'readonly');
      const value: unknown = await requestResult(tx.objectStore(OBJECT_STORE).get(key));
      return typeof value === 'string' ? value : undefined;
    },

    async keys() {
      const tx = (await database()).transaction(OBJECT_STORE, 'readonly');
      const keys = await requestResult(tx.objectStore(OBJECT_STORE).getAllKeys());
      return keys.filter((k): k is string => typeof k === 'string');
    },

    async set(key, value) {
      const tx = (await database()).transaction(OBJECT_STORE, 'readwrite');
      tx.objectStore(OBJECT_STORE).put(value, key);
      const done = new Promise<void>((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error('IndexedDB write failed.'));
        tx.onabort = () => reject(tx.error ?? new Error('IndexedDB write was aborted.'));
      });
      // Commit right away instead of waiting for the event loop: matters when the page is closing.
      tx.commit?.();
      await done;
    },
  };
}
