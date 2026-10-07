import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCurrentWeekRange,
  isPersonalTaskDone,
  isRedmineIssueClosed,
  parseDeadline,
  formatTimeRemaining,
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

test('parseDeadline handles date only and date-time strings accurately', () => {
  // Date only -> defaults to 17:30
  const d1 = parseDeadline('2026-10-07');
  assert.ok(d1);
  assert.equal(d1?.dateStr, '2026-10-07');
  assert.equal(d1?.timeStr, '17:30');
  assert.equal(d1?.hasExplicitTime, false);

  // Date with time
  const d2 = parseDeadline('2026-10-07 14:15');
  assert.ok(d2);
  assert.equal(d2?.dateStr, '2026-10-07');
  assert.equal(d2?.timeStr, '14:15');
  assert.equal(d2?.hasExplicitTime, true);

  // ISO string
  const d3 = parseDeadline('2026-10-07T09:00:00.000Z');
  assert.ok(d3);
  assert.equal(d3?.dateStr, '2026-10-07');
  assert.equal(d3?.timeStr, '09:00');

  // Invalid strings
  assert.equal(parseDeadline(''), null);
  assert.equal(parseDeadline('invalid-date'), null);
});

test('formatTimeRemaining outputs correct human labels for hours and days', () => {
  // 2 hours 30 mins remaining
  const remainMs = 2.5 * 3600 * 1000;
  assert.match(formatTimeRemaining(remainMs), /Còn 2 giờ 30p/);

  // 1 day 4 hours remaining
  const dayMs = 28 * 3600 * 1000;
  assert.match(formatTimeRemaining(dayMs), /Còn 1 ngày 4h/);

  // Overdue 3 hours
  const overdueMs = -3 * 3600 * 1000;
  assert.match(formatTimeRemaining(overdueMs), /Quá hạn 3 giờ/);
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

test('computeWeeklyNotifications strictly excludes tasks from past weeks/years and includes exact dates and hours', () => {
  // Reference: Wednesday, Oct 07, 2026 at 10:00:00
  // Week 41 is 2026-10-05 (Monday) to 2026-10-11 (Sunday)
  const refNow = new Date('2026-10-07T10:00:00');

  const personalTasks: PersonalTask[] = [
    // 1. Overdue within this week (Monday 2026-10-05) -> INCLUDED in thisWeek & overdue
    {
      id: 'pt-mon',
      title: 'Việc hạn thứ Hai tuần này',
      week: 'Tuần 41 (05/10 - 11/10)',
      dueDate: '2026-10-05 17:00',
      statusName: 'In Progress',
      priorityName: 'High',
    } as PersonalTask,

    // 2. Due today (Wednesday 2026-10-07 at 17:30) -> INCLUDED in thisWeek & dueToday
    {
      id: 'pt-today',
      title: 'Việc hạn 17:30 hôm nay',
      week: 'Tuần 41 (05/10 - 11/10)',
      dueDate: '2026-10-07 17:30',
      statusName: 'New',
      priorityName: 'Urgent',
    } as PersonalTask,

    // 3. Due tomorrow (Thursday 2026-10-08 at 09:00) -> INCLUDED in thisWeek & dueTomorrow
    {
      id: 'pt-tomorrow',
      title: 'Việc hạn sáng mai',
      week: 'Tuần 41',
      dueDate: '2026-10-08 09:00',
      statusName: 'New',
      priorityName: 'Normal',
    } as PersonalTask,

    // 4. OLD OVERDUE FROM 2025 (e.g. 2025-12-02) -> MUST BE EXCLUDED!
    {
      id: 'pt-old-2025',
      title: 'Việc cũ từ năm 2025',
      week: 'Tuần 49/2025',
      dueDate: '2025-12-02',
      statusName: 'New',
    } as PersonalTask,

    // 5. OLD OVERDUE FROM LAST MONTH (2026-09-12) -> MUST BE EXCLUDED!
    {
      id: 'pt-old-sep',
      title: 'Việc cũ từ tháng 9',
      week: 'Tuần 37',
      dueDate: '2026-09-12',
      statusName: 'New',
    } as PersonalTask,

    // 6. Completed task -> MUST BE EXCLUDED!
    {
      id: 'pt-completed',
      title: 'Việc đã xong',
      week: 'Tuần 41',
      dueDate: '2026-10-07 12:00',
      statusName: 'Done',
      doneRatio: 100,
    } as PersonalTask,
  ];

  const redmineIssues: RedmineIssue[] = [
    // 1. Issue due Friday this week (2026-10-09) assigned to user -> INCLUDED
    {
      id: 201,
      subject: 'Review spec hệ thống',
      due_date: '2026-10-09',
      status: { id: 1, name: 'New' },
      priority: { id: 4, name: 'High' },
      assigned_to: { id: 99, name: 'Lợi Ngô' },
    } as RedmineIssue,

    // 2. Old issue from 2025-12-02 -> MUST BE EXCLUDED!
    {
      id: 28014,
      subject: 'UAT - Test import danh mục 2025',
      due_date: '2025-12-02',
      status: { id: 1, name: 'New' },
      priority: { id: 2, name: 'Normal' },
      assigned_to: { id: 99, name: 'Lợi Ngô' },
    } as RedmineIssue,

    // 3. Issue assigned to someone else -> MUST BE EXCLUDED!
    {
      id: 301,
      subject: 'Việc của người khác',
      due_date: '2026-10-07',
      status: { id: 1, name: 'New' },
      assigned_to: { id: 88, name: 'Người khác' },
    } as RedmineIssue,
  ];

  const summary = computeWeeklyNotifications({
    personalTasks,
    redmineIssues,
    currentUserId: 99,
    now: refNow,
  });

  // Verify: old 2025 and old month issues are completely excluded!
  assert.equal(summary.thisWeek.some((i) => i.id === 'personal-pt-old-2025'), false);
  assert.equal(summary.thisWeek.some((i) => i.id === 'personal-pt-old-sep'), false);
  assert.equal(summary.thisWeek.some((i) => i.id === 'redmine-28014'), false);
  assert.equal(summary.thisWeek.some((i) => i.id === 'redmine-301'), false);

  // Included items in this week: pt-mon, pt-today, pt-tomorrow, redmine-201
  assert.equal(summary.thisWeek.length, 4);

  // pt-mon is overdue (was due Monday 17:00, now is Wed 10:00)
  assert.equal(summary.overdue.length, 1);
  assert.equal(summary.overdue[0].id, 'personal-pt-mon');
  assert.match(summary.overdue[0].timeRemainingLabel, /Quá hạn/);

  // pt-today is due today at 17:30
  assert.equal(summary.dueToday.length, 1);
  assert.equal(summary.dueToday[0].id, 'personal-pt-today');
  assert.equal(summary.dueToday[0].dayLabel, 'Hôm nay');
  assert.equal(summary.dueToday[0].dueTimeFormatted, '17:30');
  assert.match(summary.dueToday[0].timeRemainingLabel, /Còn 7 giờ/);

  // pt-tomorrow is due tomorrow at 09:00
  assert.equal(summary.dueTomorrow.length, 1);
  assert.equal(summary.dueTomorrow[0].id, 'personal-pt-tomorrow');
  assert.equal(summary.dueTomorrow[0].dayLabel, 'Ngày mai');
  assert.equal(summary.dueTomorrow[0].dueTimeFormatted, '09:00');

  // Total action required is strictly small and deduplicated
  assert.equal(summary.totalActionRequired, 3);
});

test('computeWeeklyNotifications does not double-count tasks that are both due today and overdue', () => {
  const refNow = new Date('2026-10-07T12:22:00'); // Wednesday 12:22

  const personalTasks: PersonalTask[] = [
    {
      id: 'pt-overdue-today',
      title: 'Task due today at 11:54 (28 mins overdue)',
      dueDate: '2026-10-07 11:54',
      statusName: 'New',
    } as PersonalTask,
  ];

  const summary = computeWeeklyNotifications({
    personalTasks,
    now: refNow,
  });

  // Task is both overdue and due today
  assert.equal(summary.overdue.length, 1);
  assert.equal(summary.dueToday.length, 1);
  assert.equal(summary.thisWeek.length, 1);

  // BUT totalActionRequired must be 1, NOT 2!
  assert.equal(summary.totalActionRequired, 1);
});
