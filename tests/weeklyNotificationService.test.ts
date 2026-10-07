import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrentWeekRange,
  isPersonalTaskDone,
  isRedmineIssueClosed,
  computeWeeklyNotifications,
} from '../src/services/weeklyNotificationService.js';
import type { PersonalTask } from '../src/types/personalTask.js';
import type { RedmineIssue } from '../src/types/redmine.js';

test('getCurrentWeekRange calculates Monday to Sunday correctly', () => {
  // Wednesday, Oct 7, 2026
  const refDate = new Date('2026-10-07T12:00:00Z');
  const range = getCurrentWeekRange(refDate);

  assert.equal(range.start.getDay(), 1, 'Start should be Monday');
  assert.equal(range.end.getDay(), 0, 'End should be Sunday');
  assert.equal(range.startStr, '2026-10-05');
  assert.equal(range.endStr, '2026-10-11');
  assert.ok(range.weekNumber > 0);
});

test('isPersonalTaskDone checks completed status or 100% doneRatio', () => {
  const t1 = { id: '1', title: 'Task 1', doneRatio: 100, statusName: 'In Progress' } as PersonalTask;
  assert.equal(isPersonalTaskDone(t1), true);

  const t2 = { id: '2', title: 'Task 2', doneRatio: 50, statusName: 'Closed' } as PersonalTask;
  assert.equal(isPersonalTaskDone(t2), true);

  const t3 = { id: '3', title: 'Task 3', doneRatio: 80, statusName: 'Hoàn thành' } as PersonalTask;
  assert.equal(isPersonalTaskDone(t3), true);

  const t4 = { id: '4', title: 'Task 4', doneRatio: 20, statusName: 'New' } as PersonalTask;
  assert.equal(isPersonalTaskDone(t4), false);
});

test('isRedmineIssueClosed accurately identifies closed issues', () => {
  const i1 = { id: 1, subject: 'Issue 1', status: { id: 5, name: 'Closed' } } as RedmineIssue;
  assert.equal(isRedmineIssueClosed(i1), true);

  const i2 = { id: 2, subject: 'Issue 2', status: { id: 3, name: 'Resolved' } } as RedmineIssue;
  assert.equal(isRedmineIssueClosed(i2), true);

  const i3 = { id: 3, subject: 'Issue 3', status: { id: 1, name: 'New' } } as RedmineIssue;
  assert.equal(isRedmineIssueClosed(i3), false);

  const i4 = { id: 4, subject: 'Issue 4', status: { id: 2, name: 'In Progress' } } as RedmineIssue;
  assert.equal(isRedmineIssueClosed(i4), false);
});

test('computeWeeklyNotifications categorizes overdue, due soon, and this week tasks', () => {
  const refNow = new Date('2026-10-07T10:00:00Z'); // Wednesday

  const personalTasks: PersonalTask[] = [
    {
      id: 'pt-1',
      title: 'Việc đã trễ hạn',
      dueDate: '2026-10-04', // past date
      statusName: 'In Progress',
      priorityName: 'High',
    } as PersonalTask,
    {
      id: 'pt-2',
      title: 'Việc hạn hôm nay',
      dueDate: '2026-10-07', // today
      statusName: 'New',
      priorityName: 'Urgent',
    } as PersonalTask,
    {
      id: 'pt-3',
      title: 'Việc tuần sau',
      dueDate: '2026-10-20',
      statusName: 'New',
      priorityName: 'Normal',
    } as PersonalTask,
    {
      id: 'pt-completed',
      title: 'Việc đã xong',
      dueDate: '2026-10-01',
      statusName: 'Done',
      doneRatio: 100,
    } as PersonalTask,
  ];

  const redmineIssues: RedmineIssue[] = [
    {
      id: 101,
      subject: 'Bug khẩn cấp cần sửa',
      due_date: '2026-10-08', // tomorrow (due soon)
      status: { id: 1, name: 'New' },
      priority: { id: 4, name: 'High' },
      assigned_to: { id: 99, name: 'Lợi Ngô' },
    } as RedmineIssue,
    {
      id: 102,
      subject: 'Việc của người khác',
      due_date: '2026-10-07',
      status: { id: 1, name: 'New' },
      priority: { id: 2, name: 'Normal' },
      assigned_to: { id: 88, name: 'Người khác' },
    } as RedmineIssue,
  ];

  const summary = computeWeeklyNotifications({
    personalTasks,
    redmineIssues,
    currentUserId: 99,
    now: refNow,
  });

  // pt-1 is overdue
  assert.equal(summary.overdue.length, 1);
  assert.equal(summary.overdue[0].id, 'personal-pt-1');

  // pt-2 (today) + issue 101 (tomorrow) are due soon
  assert.equal(summary.dueSoon.length, 2);
  assert.ok(summary.dueSoon.some((i) => i.id === 'personal-pt-2'));
  assert.ok(summary.dueSoon.some((i) => i.id === 'redmine-101'));

  // issue 102 was assigned to someone else -> excluded
  assert.equal(summary.thisWeek.some((i) => i.id === 'redmine-102'), false);

  // totalActionRequired = overdue (1) + dueSoon (2) = 3
  assert.equal(summary.totalActionRequired, 3);
  assert.ok(summary.currentWeekLabel.includes('Tuần'));
});
