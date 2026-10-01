import test from 'node:test';
import assert from 'node:assert/strict';
import { extractGoogleSpreadsheetId } from '../lib/googleSheets.js';
import { mergePersonalTasks } from '../src/services/googleSheetsSync.js';
import type { PersonalTask } from '../src/types/personalTask.js';

test('extractGoogleSpreadsheetId extracts spreadsheet ID and gid accurately', () => {
  // Standard sharing link
  const url1 = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit?usp=sharing';
  const res1 = extractGoogleSpreadsheetId(url1);
  assert.equal(res1?.spreadsheetId, '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  assert.equal(res1?.gid, undefined);

  // Link with gid hash
  const url2 = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=123456789';
  const res2 = extractGoogleSpreadsheetId(url2);
  assert.equal(res2?.spreadsheetId, '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  assert.equal(res2?.gid, '123456789');

  // Link with gid query parameter
  const url3 = 'https://docs.google.com/spreadsheets/d/abc-123_XYZ/export?format=xlsx&gid=987';
  const res3 = extractGoogleSpreadsheetId(url3);
  assert.equal(res3?.spreadsheetId, 'abc-123_XYZ');
  assert.equal(res3?.gid, '987');

  // Invalid links
  assert.equal(extractGoogleSpreadsheetId(''), null);
  assert.equal(extractGoogleSpreadsheetId('https://google.com'), null);
  assert.equal(extractGoogleSpreadsheetId('https://example.com/spreadsheets/d/123'), null);
});

test('mergePersonalTasks merges new tasks and updates existing tasks while preserving workflow status', () => {
  const existing: PersonalTask[] = [
    {
      id: 'task-1',
      title: 'Soạn thảo tài liệu nghiệm thu',
      week: 'Tuần 05',
      category: 'Tài liệu',
      statusName: 'In Progress',
      priorityName: 'Normal',
      dueDate: '2026-10-05',
      description: 'Mô tả ban đầu',
      resultNote: '',
      assignedDate: '2026-10-01',
      source: 'excel',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
    {
      id: 'task-2',
      title: 'Họp khách hàng',
      week: 'Tuần 05',
      category: 'Họp',
      statusName: 'Closed',
      priorityName: 'High',
      dueDate: '2026-10-02',
      description: 'Đã xong',
      resultNote: '',
      assignedDate: '2026-10-01',
      source: 'manual',
      createdAt: '2026-10-01T00:00:00.000Z',
      updatedAt: '2026-10-01T00:00:00.000Z',
    },
  ];

  const incoming: PersonalTask[] = [
    // Updated task 1: new description and due date from sheet
    {
      id: 'incoming-1',
      title: 'Soạn thảo tài liệu nghiệm thu',
      week: 'Tuần 05',
      category: 'Tài liệu bàn giao',
      statusName: 'New', // Sheet says New, but existing is In Progress
      priorityName: 'Urgent',
      dueDate: '2026-10-07',
      description: 'Mô tả cập nhật từ Google Sheet',
      resultNote: '',
      assignedDate: '2026-10-01',
      source: 'excel',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    },
    // New task 3 from sheet
    {
      id: 'incoming-3',
      title: 'Kiểm thử tính năng mới',
      week: 'Tuần 05',
      category: 'QA',
      statusName: 'New',
      priorityName: 'Normal',
      dueDate: '2026-10-08',
      description: 'Chạy test suite',
      resultNote: '',
      assignedDate: '2026-10-03',
      source: 'excel',
      createdAt: '2026-10-01T10:00:00.000Z',
      updatedAt: '2026-10-01T10:00:00.000Z',
    },
  ];

  const merged = mergePersonalTasks(existing, incoming);

  assert.equal(merged.length, 3);

  // Check updated task 1
  const updatedTask1 = merged.find((t) => t.id === 'task-1');
  assert.ok(updatedTask1);
  assert.equal(updatedTask1?.description, 'Mô tả cập nhật từ Google Sheet');
  assert.equal(updatedTask1?.dueDate, '2026-10-07');
  assert.equal(updatedTask1?.category, 'Tài liệu bàn giao');
  assert.equal(updatedTask1?.priorityName, 'Urgent');
  // Workflow status is preserved from user Kanban progress
  assert.equal(updatedTask1?.statusName, 'In Progress');

  // Check untouched task 2
  const task2 = merged.find((t) => t.id === 'task-2');
  assert.ok(task2);
  assert.equal(task2?.statusName, 'Closed');

  // Check new task 3
  const task3 = merged.find((t) => t.title === 'Kiểm thử tính năng mới');
  assert.ok(task3);
  assert.equal(task3?.category, 'QA');
});
