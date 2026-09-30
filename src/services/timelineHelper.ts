import type { RedmineIssue } from '../types/redmine';
import type { PersonalTask } from '../types/personalTask';

export interface TimelineItem {
  id: string;
  title: string;
  startDate: string; // YYYY-MM-DD
  dueDate: string;   // YYYY-MM-DD
  statusName: string;
  statusId?: number;
  priorityName?: string;
  trackerName?: string;
  category?: string;
  assigneeName?: string;
  projectName?: string;
  doneRatio: number;
  source: 'personal' | 'redmine';
  rawIssue?: RedmineIssue;
  rawPersonalTask?: PersonalTask;
  hasFallbackDate: boolean;
}

export interface TimelineDay {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayNumber: number;
  dayOfWeek: number; // 0 = Sun, 1 = Mon, ...
  dayOfWeekName: string; // T2, T3, ...
  isToday: boolean;
  isWeekend: boolean;
  monthName: string;
  year: number;
}

/**
 * Format Date to YYYY-MM-DD string
 */
export function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Vietnamese date display helper
 */
export function formatViDate(dateStr?: string): string {
  if (!dateStr) return '';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  const [y, m, d] = parts;
  return `${Number(d)} thg ${Number(m)}, ${y}`;
}

/**
 * Convert Redmine Issues into normalized TimelineItems
 */
export function convertIssuesToTimelineItems(issues: RedmineIssue[], todayStr: string): {
  scheduledItems: TimelineItem[];
  unscheduledItems: TimelineItem[];
} {
  const scheduledItems: TimelineItem[] = [];
  const unscheduledItems: TimelineItem[] = [];

  for (const issue of issues) {
    const rawStart = issue.start_date?.trim();
    const rawDue = issue.due_date?.trim();
    const createdStr = issue.created_on ? issue.created_on.slice(0, 10) : todayStr;

    let startDate = rawStart || '';
    let dueDate = rawDue || '';
    let hasFallbackDate = false;

    if (!startDate && !dueDate) {
      // Completely unscheduled
      unscheduledItems.push({
        id: `redmine-${issue.id}`,
        title: issue.subject,
        startDate: '',
        dueDate: '',
        statusName: issue.status?.name || 'New',
        statusId: issue.status?.id,
        priorityName: issue.priority?.name || 'Normal',
        trackerName: issue.tracker?.name || '',
        category: issue.category?.name || '',
        assigneeName: issue.assigned_to?.name || '',
        projectName: issue.project?.name || '',
        doneRatio: issue.done_ratio || 0,
        source: 'redmine',
        rawIssue: issue,
        hasFallbackDate: true,
      });
      continue;
    }

    if (startDate && !dueDate) {
      dueDate = startDate;
      hasFallbackDate = true;
    } else if (!startDate && dueDate) {
      startDate = dueDate;
      hasFallbackDate = true;
    }

    // Ensure start <= due
    if (startDate > dueDate) {
      const temp = startDate;
      startDate = dueDate;
      dueDate = temp;
    }

    scheduledItems.push({
      id: `redmine-${issue.id}`,
      title: issue.subject,
      startDate,
      dueDate,
      statusName: issue.status?.name || 'New',
      statusId: issue.status?.id,
      priorityName: issue.priority?.name || 'Normal',
      trackerName: issue.tracker?.name || '',
      category: issue.category?.name || '',
      assigneeName: issue.assigned_to?.name || '',
      projectName: issue.project?.name || '',
      doneRatio: issue.done_ratio || 0,
      source: 'redmine',
      rawIssue: issue,
      hasFallbackDate,
    });
  }

  return { scheduledItems, unscheduledItems };
}

/**
 * Convert PersonalTasks into normalized TimelineItems
 */
export function convertPersonalTasksToTimelineItems(tasks: PersonalTask[], todayStr: string): {
  scheduledItems: TimelineItem[];
  unscheduledItems: TimelineItem[];
} {
  const scheduledItems: TimelineItem[] = [];
  const unscheduledItems: TimelineItem[] = [];

  for (const task of tasks) {
    const rawStart = task.assignedDate?.trim();
    const rawDue = task.dueDate?.trim();

    let startDate = rawStart || '';
    let dueDate = rawDue || '';
    let hasFallbackDate = false;

    if (!startDate && !dueDate) {
      unscheduledItems.push({
        id: `personal-${task.id}`,
        title: task.title,
        startDate: '',
        dueDate: '',
        statusName: task.statusName || 'New',
        statusId: task.statusId,
        priorityName: task.priorityName || 'Normal',
        trackerName: task.trackerName || '',
        category: task.category || '',
        assigneeName: task.assigneeName || '',
        projectName: task.projectName || '',
        doneRatio: task.doneRatio || 0,
        source: 'personal',
        rawPersonalTask: task,
        hasFallbackDate: true,
      });
      continue;
    }

    if (startDate && !dueDate) {
      dueDate = startDate;
      hasFallbackDate = true;
    } else if (!startDate && dueDate) {
      startDate = dueDate;
      hasFallbackDate = true;
    }

    if (startDate > dueDate) {
      const temp = startDate;
      startDate = dueDate;
      dueDate = temp;
    }

    scheduledItems.push({
      id: `personal-${task.id}`,
      title: task.title,
      startDate,
      dueDate,
      statusName: task.statusName || 'New',
      statusId: task.statusId,
      priorityName: task.priorityName || 'Normal',
      trackerName: task.trackerName || '',
      category: task.category || '',
      assigneeName: task.assigneeName || '',
      projectName: task.projectName || '',
      doneRatio: task.doneRatio || 0,
      source: 'personal',
      rawPersonalTask: task,
      hasFallbackDate,
    });
  }

  return { scheduledItems, unscheduledItems };
}

const VN_DAY_NAMES = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

/**
 * Generate calendar days for timeline window
 */
export function generateTimelineDays(
  centerDate: Date,
  daysBefore = 10,
  daysAfter = 35
): { days: TimelineDay[]; startDateStr: string; endDateStr: string } {
  const days: TimelineDay[] = [];
  const start = new Date(centerDate);
  start.setDate(start.getDate() - daysBefore);

  const todayStr = toDateString(new Date());
  const totalDays = daysBefore + daysAfter + 1;

  for (let i = 0; i < totalDays; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    const dateStr = toDateString(cur);
    const dayOfWeek = cur.getDay();

    days.push({
      date: cur,
      dateStr,
      dayNumber: cur.getDate(),
      dayOfWeek,
      dayOfWeekName: VN_DAY_NAMES[dayOfWeek],
      isToday: dateStr === todayStr,
      isWeekend: dayOfWeek === 0 || dayOfWeek === 6,
      monthName: `Tháng ${cur.getMonth() + 1}`,
      year: cur.getFullYear(),
    });
  }

  return {
    days,
    startDateStr: days[0]?.dateStr || '',
    endDateStr: days[days.length - 1]?.dateStr || '',
  };
}

export interface PlacedTimelineItem {
  item: TimelineItem;
  laneIndex: number;
  startIndex: number;
  endIndex: number;
  spanDays: number;
  leftPx: number;
  widthPx: number;
  isVisible: boolean;
}

/**
 * Pack timeline items into non-overlapping horizontal tracks / lanes
 * similar to Notion or Gantt chart lane layout.
 */
export function packTimelineLanes(
  items: TimelineItem[],
  days: TimelineDay[],
  colWidthPx: number
): { placedItems: PlacedTimelineItem[]; totalLanes: number } {
  if (days.length === 0) return { placedItems: [], totalLanes: 0 };

  const dayIndexMap = new Map<string, number>();
  days.forEach((d, idx) => dayIndexMap.set(d.dateStr, idx));

  const timelineStartStr = days[0].dateStr;
  const timelineEndStr = days[days.length - 1].dateStr;

  // Filter items that overlap with the current timeline window
  const candidates: {
    item: TimelineItem;
    startIdx: number;
    endIdx: number;
    spanDays: number;
  }[] = [];

  for (const item of items) {
    if (!item.startDate || !item.dueDate) continue;
    // Check overlap: item.startDate <= timelineEnd && item.dueDate >= timelineStart
    if (item.startDate > timelineEndStr || item.dueDate < timelineStartStr) {
      continue;
    }

    let startIdx = dayIndexMap.get(item.startDate);
    if (startIdx === undefined) {
      startIdx = item.startDate < timelineStartStr ? 0 : days.length - 1;
    }

    let endIdx = dayIndexMap.get(item.dueDate);
    if (endIdx === undefined) {
      endIdx = item.dueDate > timelineEndStr ? days.length - 1 : 0;
    }

    if (endIdx < startIdx) endIdx = startIdx;
    const spanDays = endIdx - startIdx + 1;

    candidates.push({ item, startIdx, endIdx, spanDays });
  }

  // Sort candidates by startIdx ascending, then longest duration first
  candidates.sort((a, b) => {
    if (a.startIdx !== b.startIdx) return a.startIdx - b.startIdx;
    return b.spanDays - a.spanDays;
  });

  // Track occupied intervals per lane
  const lanes: { endIdx: number }[] = [];
  const placedItems: PlacedTimelineItem[] = [];

  for (const cand of candidates) {
    let assignedLane = -1;

    for (let l = 0; l < lanes.length; l++) {
      if (lanes[l].endIdx < cand.startIdx) {
        assignedLane = l;
        lanes[l].endIdx = cand.endIdx;
        break;
      }
    }

    if (assignedLane === -1) {
      assignedLane = lanes.length;
      lanes.push({ endIdx: cand.endIdx });
    }

    const leftPx = cand.startIdx * colWidthPx;
    const widthPx = Math.max(cand.spanDays * colWidthPx - 6, colWidthPx - 6);

    placedItems.push({
      item: cand.item,
      laneIndex: assignedLane,
      startIndex: cand.startIdx,
      endIndex: cand.endIdx,
      spanDays: cand.spanDays,
      leftPx,
      widthPx,
      isVisible: true,
    });
  }

  return { placedItems, totalLanes: Math.max(lanes.length, 1) };
}
