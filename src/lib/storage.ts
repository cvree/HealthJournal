/* IndexedDB-backed polyfill for the Claude artifact `window.storage` API.
   Installed only when the real artifact storage is absent, so the same
   App.tsx runs unchanged inside Claude.ai and as a local/deployed site.

   API (mirrors the artifact):
     await window.storage.get(key)         -> { key, value } | throws if missing
     await window.storage.set(key, value)  -> { key, value }
     await window.storage.delete(key)      -> { key, deleted: true }
     await window.storage.list(prefix?)    -> { keys: string[] }

   IndexedDB is used (not localStorage) because photo blobs are stored as
   base64 strings that can exceed localStorage's ~5MB quota. */

const DB_NAME = "fhj-local";
const STORE = "kv";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      })
  );
}

const localStore = {
  async get(key: string) {
    const value = await tx<string | undefined>("readonly", (s) => s.get(key));
    if (value === undefined) throw new Error(`Key not found: ${key}`);
    return { key, value, shared: false };
  },
  async set(key: string, value: string) {
    await tx("readwrite", (s) => s.put(String(value), key));
    return { key, value, shared: false };
  },
  async delete(key: string) {
    await tx("readwrite", (s) => s.delete(key));
    return { key, deleted: true, shared: false };
  },
  async list(prefix?: string) {
    const keys = (await tx<IDBValidKey[]>("readonly", (s) => s.getAllKeys())) as string[];
    return { keys: prefix ? keys.filter((k) => k.startsWith(prefix)) : keys, prefix };
  },
};

/** Install the polyfill unless the artifact runtime already provides storage. */
export function installStorage() {
  if (typeof window === "undefined") return;
  if ((window as any).storage) return; // running inside Claude.ai — keep the real one
  if (!("indexedDB" in window)) return; // App.tsx falls back to in-memory on its own
  (window as any).storage = localStore;
}
