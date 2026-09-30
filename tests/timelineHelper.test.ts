import test from 'node:test';
import assert from 'node:assert/strict';
import {
  convertIssuesToTimelineItems,
  convertPersonalTasksToTimelineItems,
  generateTimelineDays,
  packTimelineLanes,
  formatViDate,
  toDateString,
} from '../src/services/timelineHelper.js';
import type { RedmineIssue } from '../src/types/redmine.js';
import type { PersonalTask } from '../src/types/personalTask.js';

test('formatViDate formats YYYY-MM-DD accurately', () => {
  assert.equal(formatViDate('2026-09-30'), '30 thg 9, 2026');
  assert.equal(formatViDate('2026-10-03'), '3 thg 10, 2026');
  assert.equal(formatViDate(''), '');
});

test('convertIssuesToTimelineItems separates scheduled and unscheduled items', () => {
  const issues: RedmineIssue[] = [
    {
      id: 101,
      subject: 'Task with full dates',
      start_date: '2026-09-20',
      due_date: '2026-09-25',
      project: { id: 84, name: 'Project A' },
      status: { id: 2, name: 'In Progress' },
      tracker: { id: 4, name: 'Task' },
    } as any,
    {
      id: 102,
      subject: 'Task with only due date',
      due_date: '2026-09-30',
      project: { id: 84, name: 'Project A' },
      status: { id: 1, name: 'New' },
    } as any,
    {
      id: 103,
      subject: 'Task without any date',
      project: { id: 84, name: 'Project A' },
      status: { id: 1, name: 'New' },
    } as any,
  ];

  const result = convertIssuesToTimelineItems(issues, '2026-09-30');
  assert.equal(result.scheduledItems.length, 2);
  assert.equal(result.unscheduledItems.length, 1);

  // Check fallback date for single due date
  const item102 = result.scheduledItems.find(i => i.id === 'redmine-102');
  assert.ok(item102);
  assert.equal(item102.startDate, '2026-09-30');
  assert.equal(item102.dueDate, '2026-09-30');
  assert.equal(item102.hasFallbackDate, true);
});

test('generateTimelineDays produces consecutive calendar days with Today marker', () => {
  const center = new Date('2026-09-30T12:00:00Z');
  const { days } = generateTimelineDays(center, 5, 5);

  assert.equal(days.length, 11);
  assert.equal(days[5].dateStr, '2026-09-30');
});

test('packTimelineLanes packs overlapping items into separate lanes', () => {
  const center = new Date('2026-09-30T12:00:00Z');
  const { days } = generateTimelineDays(center, 10, 20);

  const items = [
    {
      id: 'item-1',
      title: 'Item 1',
      startDate: '2026-09-25',
      dueDate: '2026-09-30',
      statusName: 'In Progress',
      doneRatio: 50,
      source: 'personal',
      hasFallbackDate: false,
    },
    {
      id: 'item-2',
      title: 'Item 2 (overlaps item 1)',
      startDate: '2026-09-28',
      dueDate: '2026-10-02',
      statusName: 'In Progress',
      doneRatio: 20,
      source: 'personal',
      hasFallbackDate: false,
    },
    {
      id: 'item-3',
      title: 'Item 3 (after item 1, same lane reusable)',
      startDate: '2026-10-05',
      dueDate: '2026-10-10',
      statusName: 'Done',
      doneRatio: 100,
      source: 'personal',
      hasFallbackDate: false,
    },
  ];

  const { placedItems, totalLanes } = packTimelineLanes(items as any, days, 50);

  assert.equal(placedItems.length, 3);
  assert.ok(totalLanes >= 2, 'Overlapping items must require at least 2 lanes');

  const p1 = placedItems.find(p => p.item.id === 'item-1');
  const p2 = placedItems.find(p => p.item.id === 'item-2');
  const p3 = placedItems.find(p => p.item.id === 'item-3');

  assert.notEqual(p1?.laneIndex, p2?.laneIndex, 'Item 1 and Item 2 must be on different lanes');
  assert.equal(p1?.laneIndex, p3?.laneIndex, 'Item 3 can reuse Item 1 lane since it starts after item 1 ends');
});
