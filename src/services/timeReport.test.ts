import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { RedmineTimeEntry } from '../types/redmine';
import { createTimeEntriesWorkbook } from './timeReport';

test('time-entry workbook exports every row and aggregates hours by Redmine user', async () => {
  const entries = [
    { id: 1, spent_on: '2026-09-18', hours: 1.5, user: { id: 7, name: 'An' }, project: { id: 84, name: 'PM' }, issue: { id: 101 }, activity: { id: 9, name: 'Development' }, comments: 'A' },
    { id: 2, spent_on: '2026-09-19', hours: 2.25, user: { id: 7, name: 'An' }, project: { id: 84, name: 'PM' }, issue: { id: 102 }, activity: { id: 9, name: 'Development' }, comments: 'B' },
    { id: 3, spent_on: '2026-09-19', hours: 3, user: { id: 8, name: 'Bình' }, project: { id: 84, name: 'PM' }, activity: { id: 10, name: 'Meeting' }, comments: '' },
  ] as RedmineTimeEntry[];
  const workbook = await createTimeEntriesWorkbook(entries, { project: 'PM', from: '2026-09-01', to: '2026-09-19' });
  const detail = workbook.getWorksheet('Nhật ký giờ làm')!;
  const summary = workbook.getWorksheet('Tổng hợp')!;
  assert.equal(detail.rowCount, entries.length + 2);
  assert.equal(detail.getCell('G3').value, 1.5);
  assert.deepEqual([summary.getCell('A2').value, summary.getCell('B2').value, summary.getCell('C2').value], ['An', 3.75, 2]);
  assert.deepEqual([summary.getCell('A3').value, summary.getCell('B3').value, summary.getCell('C3').value], ['Bình', 3, 1]);
});
