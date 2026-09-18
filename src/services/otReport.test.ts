import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createOTWorkbook, isOTSubject, summarizeOT, OTRecord } from './otReport';
import { fetchReportTimeEntries } from './redmineApi';

const record = (id: number, hours: number, userId = 1, projectId = 84): OTRecord => ({
  entry: { id, hours, user: { id: userId, name: 'Thành viên' }, project: { id: projectId, name: 'Dự án' }, issue: { id: 100 }, activity: { id: 3, name: 'Development' }, spent_on: '2026-09-18', created_on: '', updated_on: '', comments: '=SUM(A1:A2)' },
  issue: { id: 100, subject: '[OT] Kiểm thử', project: { id: projectId, name: 'Dự án' }, tracker: { id: 4, name: 'Task' }, status: { id: 5, name: 'Closed' }, priority: { id: 1, name: 'Normal' }, author: { id: 1, name: 'Thành viên' }, done_ratio: 100, created_on: '', updated_on: '' },
});

test('recognizes the OT word in actual Redmine subject styles', () => {
  for (const text of ['OT', '[OT] Deploy', 'ot - Test', 'Task OT', '(OT) Làm thêm']) assert.equal(isOTSubject(text), true, text);
  for (const text of ['NOT', 'total hours', 'HOTFIX', 'Testing', '']) assert.equal(isOTSubject(text), false, text);
});

test('sums logs without duplicating issue counts or merging equal user names', () => {
  const rows = summarizeOT([record(1, 2.5), record(2, 1.25), record(3, 3, 2), record(4, 2, 1, 92)]);
  assert.equal(rows.length, 3);
  assert.equal(rows.reduce((n, r) => n + r.hours, 0), 8.75);
  const first = rows.find(r => r.userId === 1 && r.projectId === 84)!;
  assert.deepEqual([first.hours, first.logs, first.issues], [3.75, 2, 1]);
  assert.throws(() => summarizeOT([record(1, NaN)]), /không hợp lệ/);
});

test('xlsx roundtrip preserves numeric hours, dates, formulas and literal comments', async () => {
  const records = [record(1, 2.5), record(2, 1.25)];
  const workbook = await createOTWorkbook(records, summarizeOT(records), { from: '2026-09-01', to: '2026-09-18', project: 'Dự án', baseUrl: 'https://redmine.anybim.vn' });
  const bytes = await workbook.xlsx.writeBuffer();
  const { default: ExcelJS } = await import('exceljs');
  const reopened = new ExcelJS.Workbook();
  await reopened.xlsx.load(bytes);
  assert.equal(reopened.worksheets.length, 2);
  assert.equal(reopened.worksheets[0].getCell('E8').value, 3.75);
  assert.equal(reopened.worksheets[0].getCell('B5').result, 3.75);
  assert.equal(reopened.worksheets[1].getCell('H2').value, 2.5);
  assert.equal(reopened.worksheets[1].getCell('J2').value, '=SUM(A1:A2)');
  assert.ok(reopened.worksheets[1].getCell('A2').value instanceof Date);
  assert.equal(reopened.worksheets[1].getCell('L2').hyperlink, 'https://redmine.anybim.vn/issues/100');
});

test('report pagination reads all pages and rejects incomplete responses', async () => {
  const originalFetch = globalThis.fetch;
  const originalStorage = globalThis.localStorage;
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => null } });
  const queries: URLSearchParams[] = [];
  let calls = 0;
  globalThis.fetch = async (input) => {
    const q = new URL(String(input), 'http://localhost').searchParams;
    queries.push(q);
    const entries = calls++ === 0 ? [record(1, 2).entry, record(2, 3).entry] : [record(3, 4).entry];
    return new Response(JSON.stringify({ time_entries: entries, total_count: 3 }));
  };
  try {
    const entries = await fetchReportTimeEntries('84', '2026-09-01', '2026-09-18');
    assert.equal(entries.length, 3);
    assert.deepEqual(queries.map(q => q.get('offset')), ['0', '2']);
    assert.equal(queries[1].get('from'), '2026-09-01');
    assert.equal(queries[1].get('project_id'), '84');
    globalThis.fetch = async () => new Response(JSON.stringify({ time_entries: [], total_count: 1 }));
    await assert.rejects(() => fetchReportTimeEntries('all', '2026-09-01', '2026-09-18'), /chưa đầy đủ/);
    globalThis.fetch = async () => new Response('{}', { status: 403 });
    await assert.rejects(() => fetchReportTimeEntries('all', '2026-09-01', '2026-09-18'), /Không thể tải/);
  } finally {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: originalStorage });
  }
});
