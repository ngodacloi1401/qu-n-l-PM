import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadIssueSnapshot, type IssueSnapshot } from './issueCache';
import { cacheScope, writeLocalCache } from './localCache';
import type { RedmineIssue } from '../types/redmine';

const issue = (id: number, subject = 'Task'): RedmineIssue => ({ id, subject, updated_on: new Date().toISOString() } as RedmineIssue);
const snapshot = (issues: RedmineIssue[], complete = true): IssueSnapshot => ({ issues, complete, total_count: complete ? issues.length : 5000, fetchedAt: Date.now() - 120000, syncStartedAt: new Date().toISOString(), revision: 'v1' });
const unexpected = async (): Promise<any> => { throw new Error('Unexpected network call'); };

test('fresh complete cache serves partial views without network', async () => {
  const saved = { ...snapshot([issue(1), issue(2)]), fetchedAt: Date.now() };
  await writeLocalCache('fresh', saved);
  let displayed = false;
  const result = await loadIssueSnapshot('fresh', 'v1', 1, true, unexpected, unexpected, unexpected, { onCached: () => { displayed = true; } });
  assert.equal(displayed, true);
  assert.equal(result.issues.length, 2);
});

test('stale complete cache merges only changed issues, replacing duplicates', async () => {
  await writeLocalCache('delta', snapshot([issue(1), issue(2)]));
  const result = await loadIssueSnapshot('delta', 'v1', 5000, true, unexpected, async since => {
    assert.ok(Date.parse(since) < Date.now() - 100000);
    return { issues: [issue(1, '[OT] Changed'), issue(3)], total_count: 2 };
  }, async () => 3);
  assert.equal(result.complete, true);
  assert.equal(result.issues.length, 3);
  assert.equal(result.issues.find(i => i.id === 1)?.subject, '[OT] Changed');
});

test('deleted issues force authoritative reload', async () => {
  await writeLocalCache('deleted', snapshot([issue(1), issue(2)]));
  const result = await loadIssueSnapshot('deleted', 'v1', 5000, true,
    async () => ({ issues: [issue(2)], total_count: 1 }), async () => ({ issues: [], total_count: 0 }), async () => 1);
  assert.deepEqual(result.issues.map(i => i.id), [2]);
});

test('100 cached rows never stand in for all 5000 rows', async () => {
  await writeLocalCache('partial', { ...snapshot([issue(1)], false), fetchedAt: Date.now() });
  let calls = 0;
  const result = await loadIssueSnapshot('partial', 'v1', 5000, true, async () => {
    calls++; return { issues: [issue(1), issue(2)], total_count: 2 };
  }, unexpected, unexpected);
  assert.equal(calls, 1); assert.equal(result.complete, true);
});

test('force refresh bypasses fresh cache and credential scopes stay separate', async () => {
  await writeLocalCache('force', { ...snapshot([issue(1)]), fetchedAt: Date.now() });
  let calls = 0;
  await loadIssueSnapshot('force', 'v1', 1, false, async () => {
    calls++; return { issues: [issue(2)], total_count: 1 };
  }, unexpected, unexpected, { force: true });
  assert.equal(calls, 1);
  assert.notEqual(await cacheScope('https://example.com', 'a'), await cacheScope('https://example.com', 'b'));
});
