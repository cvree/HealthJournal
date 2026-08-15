/* Where the sync key lives between launches.

   The alternative — asking for the passphrase on every cold start — is the
   thing that makes people turn encryption off, so it is not an option. Storing
   the passphrase, or anything a passphrase can be recovered from, is worse.

   The way out is a property of WebCrypto that IndexedDB happens to respect: a
   `CryptoKey` derived as non-extractable can be structured-cloned into
   IndexedDB and read back as a usable key, while never being readable *as
   bytes* by any code, including this app's own. The browser holds the material;
   the page holds a handle to it.

   So: derive once, store the handle, and the passphrase is never written down
   anywhere. Signing out deletes the handle, and the next device — or the same
   device after a sign-out — has to know the passphrase again. */

const DB_NAME = "fhj-sync";
const STORE = "keys";
const KEY_ID = "sync-key";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === "undefined") { reject(new Error("no indexedDB")); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
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

/** Stash the derived key. Failure is not fatal — the session keeps working with
    the key in memory, and the passphrase is asked for again next launch. */
export async function storeKey(key: CryptoKey): Promise<void> {
  try { await tx("readwrite", (s) => s.put(key, KEY_ID)); } catch { /* memory-only session */ }
}

export async function loadKey(): Promise<CryptoKey | null> {
  try {
    const v = await tx<CryptoKey | undefined>("readonly", (s) => s.get(KEY_ID));
    /* Anything that isn't a live CryptoKey — an older build's format, a
       partially-cleared store — is treated as absent rather than trusted. */
    return v && typeof (v as any).algorithm === "object" ? (v as CryptoKey) : null;
  } catch {
    return null;
  }
}

export async function clearKey(): Promise<void> {
  try { await tx("readwrite", (s) => s.delete(KEY_ID)); } catch { /* nothing to clear */ }
}
