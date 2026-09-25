import test from 'node:test';
import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import { autoDetectMapping, convertRowsToTasks, parseExcelWorkbook } from '../src/services/personalTaskExcel';

test('parseExcelWorkbook reads a real xlsx workbook', async () => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([
    ['Tên việc', 'Tuần', 'Trạng thái'],
    ['Kiểm tra import', 'Tuần 1', 'New'],
  ]);
  XLSX.utils.book_append_sheet(workbook, sheet, 'Kế hoạch');
  const bytes = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });

  const parsed = await parseExcelWorkbook(bytes);
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0].headers, ['Tên việc', 'Tuần', 'Trạng thái']);
  assert.equal(parsed[0].rows[0][0], 'Kiểm tra import');
});

test('autoDetectMapping detects Vietnamese header keywords accurately', () => {
  const headers = [
    'Tuần',
    'Ngày giao',
    'Nhóm việc',
    'Tên việc cần làm',
    'Mô tả chi tiết',
    'Mức độ ưu tiên',
    'Thời lượng',
    'Trạng thái',
    'Kết quả công việc',
    'Deadline',
    'Lý do trễ hạn',
  ];

  const mapping = autoDetectMapping(headers);

  assert.equal(mapping.weekCol, 0);
  assert.equal(mapping.assignedDateCol, 1);
  assert.equal(mapping.categoryCol, 2);
  assert.equal(mapping.titleCol, 3);
  assert.equal(mapping.descriptionCol, 4);
  assert.equal(mapping.priorityCol, 5);
  assert.equal(mapping.estimatedHoursCol, 6);
  assert.equal(mapping.statusCol, 7);
  assert.equal(mapping.resultNoteCol, 8);
  assert.equal(mapping.dueDateCol, 9);
  assert.equal(mapping.delayReasonCol, 10);
});

test('autoDetectMapping handles English and alternative headers', () => {
  const headers = ['Week', 'Start Date', 'Category', 'Task Name', 'Description', 'Priority', 'Hours', 'Status', 'Notes', 'Due Date'];
  const mapping = autoDetectMapping(headers);

  assert.equal(mapping.weekCol, 0);
  assert.equal(mapping.assignedDateCol, 1);
  assert.equal(mapping.categoryCol, 2);
  assert.equal(mapping.titleCol, 3);
  assert.equal(mapping.descriptionCol, 4);
  assert.equal(mapping.priorityCol, 5);
  assert.equal(mapping.estimatedHoursCol, 6);
  assert.equal(mapping.statusCol, 7);
  assert.equal(mapping.resultNoteCol, 8);
  assert.equal(mapping.dueDateCol, 9);
});

test('convertRowsToTasks converts parsed matrix into PersonalTask array', () => {
  const mapping = {
    weekCol: 0,
    assignedDateCol: 1,
    categoryCol: 2,
    titleCol: 3,
    descriptionCol: 4,
    priorityCol: 5,
    estimatedHoursCol: 6,
    statusCol: 7,
    resultNoteCol: 8,
    dueDateCol: 9,
    delayReasonCol: 10,
  };

  const rows = [
    [
      'Tuần 09 (24/2-27/02)',
      '24/02/2026',
      'Platform',
      'Xem lại template standard',
      '1. Áp dụng template',
      'Gấp',
      '2.5',
      'Đang làm',
      'Đang hoàn thiện',
      '27/02/2026',
      '',
    ],
    ['', '', '', '', '', '', '', '', '', '', ''], // empty row should be skipped because no title
    [
      'Tuần 10',
      '03/03/2026',
      'HOTFIX',
      'Fix lỗi dropdown',
      '',
      'Bình thường',
      '1.0',
      'Hoàn thành',
      'Đã push code',
      '04/03/2026',
      '',
    ],
  ];

  const tasks = convertRowsToTasks(rows, mapping);

  assert.equal(tasks.length, 2);
  assert.equal(tasks[0].title, 'Xem lại template standard');
  assert.equal(tasks[0].category, 'Platform');
  assert.equal(tasks[0].projectName, undefined);
  assert.equal(tasks[0].priorityName, 'Urgent');
  assert.equal(tasks[0].statusName, 'In Progress');
  assert.equal(tasks[0].dueDate, '2026-02-27');

  assert.equal(tasks[1].title, 'Fix lỗi dropdown');
  assert.equal(tasks[1].statusName, 'Closed');
  assert.equal(tasks[1].dueDate, '2026-03-04');
});

test('convertRowsToTasks only scopes a task when Excel has an explicit Project column', () => {
  const mapping = {
    projectCol: 0,
    weekCol: -1,
    assignedDateCol: -1,
    categoryCol: 1,
    titleCol: 2,
    descriptionCol: -1,
    priorityCol: -1,
    estimatedHoursCol: -1,
    statusCol: -1,
    resultNoteCol: -1,
    dueDateCol: -1,
    delayReasonCol: -1,
  };

  const [task] = convertRowsToTasks([['HAWEE BIM', 'Platform', 'Kiểm tra import']], mapping);
  assert.equal(task.projectName, 'HAWEE BIM');
  assert.equal(task.category, 'Platform');
});
