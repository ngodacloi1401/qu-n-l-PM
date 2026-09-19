import { test } from 'node:test';
import assert from 'node:assert/strict';
import { calculatePMAnalytics, vietnamToday } from './pmAnalytics';
import type { RedmineIssue } from '../types/redmine';

test('Redmine open QA Verified issues remain overdue; configured closed status is authoritative', () => {
  const issue = (id: number, name: string): RedmineIssue => ({ id, status: { id, name }, due_date: '2026-09-17', assigned_to: { id, name: 'Trùng tên' } } as RedmineIssue);
  const rows = [issue(1, 'QA Verified'), issue(2, 'Custom Done'), issue(3, 'Closed')];
  const stats = calculatePMAnalytics(rows, [{ id: 1, name: 'QA Verified', is_closed: false }, { id: 2, name: 'Custom Done', is_closed: true }, { id: 3, name: 'Closed', is_closed: false }], '2026-09-18');
  assert.equal(stats.closed, 1);
  assert.equal(stats.completionRate, 33);
  assert.deepEqual(stats.overdueIssues.map(i => i.id), [1, 3]);
  assert.equal(stats.workload.length, 3);
});

test('Vietnam calendar date handles UTC midnight boundary and due today is not overdue', () => {
  assert.equal(vietnamToday(new Date('2026-09-17T18:00:00Z')), '2026-09-18');
  const issue = { id: 1, status: { id: 1, name: 'New' }, due_date: '2026-09-18' } as RedmineIssue;
  assert.equal(calculatePMAnalytics([issue], [], '2026-09-18').overdueIssues.length, 0);
});

test('analytics processes ten thousand issues with Redmine status semantics', () => {
  const rows = Array.from({ length: 10_000 }, (_, index) => ({
    id: index + 1,
    status: index % 2 ? { id: 5, name: 'Closed' } : { id: 2, name: 'In Progress' },
    due_date: '2026-09-17',
    assigned_to: { id: index % 100, name: `User ${index % 100}` },
  } as RedmineIssue));
  const stats = calculatePMAnalytics(rows, [
    { id: 2, name: 'In Progress', is_closed: false },
    { id: 5, name: 'Closed', is_closed: true },
  ], '2026-09-18');
  assert.equal(stats.total, 10_000);
  assert.equal(stats.closed, 5_000);
  assert.equal(stats.inProgress, 5_000);
  assert.equal(stats.overdueIssues.length, 5_000);
  assert.equal(stats.workloadAll.length, 100);
});
