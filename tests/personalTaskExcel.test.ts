import test from 'node:test';
import assert from 'node:assert/strict';
import { autoDetectMapping, convertRowsToTasks } from '../src/services/personalTaskExcel';

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
  assert.equal(tasks[0].priorityName, 'Urgent');
  assert.equal(tasks[0].statusName, 'In Progress');
  assert.equal(tasks[0].dueDate, '2026-02-27');

  assert.equal(tasks[1].title, 'Fix lỗi dropdown');
  assert.equal(tasks[1].statusName, 'Closed');
  assert.equal(tasks[1].dueDate, '2026-03-04');
});
