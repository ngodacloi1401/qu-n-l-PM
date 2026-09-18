// IndexedDB stores Redmine records, never API keys. Scope keys use a one-way
// fingerprint so two credentials / servers cannot reuse each other's cache.
const memory = new Map<string, unknown>();
let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('redmine-pm-cache', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('snapshots');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}
export async function cacheScope(baseUrl: string, apiKey: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${baseUrl.replace(/\/+$/, '')}|${apiKey}`));
  return [...new Uint8Array(bytes)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function readLocalCache<T>(key: string): Promise<T | undefined> {
  if (typeof indexedDB === 'undefined') return memory.get(key) as T | undefined;
  try {
    const db = await openDatabase();
    return await new Promise<T | undefined>((resolve, reject) => {
      const request = db.transaction('snapshots', 'readonly').objectStore('snapshots').get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch { return memory.get(key) as T | undefined; }
}
export async function writeLocalCache<T>(key: string, value: T) {
  memory.set(key, value);
  if (typeof indexedDB === 'undefined') return;
  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction('snapshots', 'readwrite');
      transaction.objectStore('snapshots').put(value, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  } catch { /* Private browsing / full disks keep a session-only cache. */ }
}

export function cacheRevision() { return localStorage.getItem('redmine_pm_cache_revision') || ''; }
export function invalidateAfterMutation() { localStorage.setItem('redmine_pm_cache_revision', crypto.randomUUID()); }
