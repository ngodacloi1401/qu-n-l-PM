import { readLocalCache, writeLocalCache } from './localCache';
import type { RedmineIssue } from '../types/redmine';

export interface IssueSnapshot { issues: RedmineIssue[]; total_count: number; complete: boolean; fetchedAt: number; syncStartedAt: string; revision: string }
export interface IssueCacheOptions { force?: boolean; onCached?: (snapshot: IssueSnapshot) => void; onBatch?: (issues: RedmineIssue[], total: number) => void | Promise<void> }
export const CACHE_FRESH_MS = 60000;
const pending = new Map<string, Promise<IssueSnapshot>>();
export function issueQueryKey(params: Record<string, any>) {
  return JSON.stringify(Object.entries(params).filter(([k, v]) => !['offset', 'limit'].includes(k) && v !== undefined && v !== 'all').sort(([a], [b]) => a.localeCompare(b)));
}

export async function loadIssueSnapshot(key: string, revision: string, maxTotal: number, canIncrement: boolean,
  full: () => Promise<{ issues: RedmineIssue[]; total_count: number }>,
  delta: (since: string) => Promise<{ issues: RedmineIssue[]; total_count: number }>,
  count: () => Promise<number>, options: IssueCacheOptions = {}): Promise<IssueSnapshot> {
  const cached = await readLocalCache<IssueSnapshot>(key);
  if (cached && cached.issues.length > 0) {
    options.onCached?.(cached);
  }
  const sufficient = cached && (cached.complete || cached.issues.length >= maxTotal);
  if (sufficient) {
    if (!options.force && cached.revision === revision && Date.now() - cached.fetchedAt < CACHE_FRESH_MS) return cached;
  }
  const requestKey = `${key}:${maxTotal}:${revision}`;
  if (pending.has(requestKey)) return pending.get(requestKey)!;
  const request = (async () => {
    const syncStartedAt = new Date().toISOString();
    let result: { issues: RedmineIssue[]; total_count: number };
    if (canIncrement && cached?.complete && Date.now() - Date.parse(cached.syncStartedAt) < 24 * 60 * 60 * 1000) {
      // Overlap the last sync by two minutes to include updates made while a page
      // was downloading and differences between client/server clocks.
      // Redmine date filters reject ISO timestamps containing milliseconds.
      // Reload the entire calendar day to keep updates within the overlap.
      const since = new Date(Date.parse(cached.syncStartedAt) - 120000).toISOString().slice(0, 10);
      let changes: { issues: RedmineIssue[]; total_count: number };
      let total: number;
      try { [changes, total] = await Promise.all([delta(since), count()]); }
      catch (error: any) {
        if (error?.status !== 422) throw error;
        const fresh = await full();
        changes = fresh;
        total = fresh.total_count;
        // Discard the old cache if a filter is unsupported by this Redmine.
        const refreshed = { issues: fresh.issues, total_count: total, complete: fresh.issues.length === total, fetchedAt: Date.now(), syncStartedAt, revision };
        await writeLocalCache(key, refreshed);
        return refreshed;
      }
      const merged = new Map(cached.issues.map(i => [i.id, i]));
      changes.issues.forEach(i => merged.set(i.id, i));
      // Deletions / loss of visibility require a fresh authoritative snapshot.
      result = merged.size === total ? { issues: [...merged.values()].sort((a, b) => b.updated_on.localeCompare(a.updated_on) || b.id - a.id), total_count: total } : await full();
    } else result = await full();
    const unique = [...new Map(result.issues.map(i => [i.id, i])).values()];
    const snapshot = { issues: unique, total_count: result.total_count, complete: unique.length === result.total_count, fetchedAt: Date.now(), syncStartedAt, revision };
    // Never downgrade a full snapshot because another view requested 100 rows.
    if (!cached?.complete || snapshot.complete) await writeLocalCache(key, snapshot);
    return snapshot;
  })();
  pending.set(requestKey, request);
  try { return await request; } finally { pending.delete(requestKey); }
}
