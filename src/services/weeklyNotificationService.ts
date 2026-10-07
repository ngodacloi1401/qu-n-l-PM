import type { PersonalTask } from '../types/personalTask';
import type { RedmineIssue } from '../types/redmine';

export interface WeeklyNotificationItem {
  id: string;
  source: 'personal' | 'redmine';
  title: string;
  dueDateStr?: string; // YYYY-MM-DD or YYYY-MM-DD HH:mm
  dueTimeFormatted: string; // e.g. "17:30", "23:59"
  targetDateStr: string; // YYYY-MM-DD
  dayLabel: string; // "Hôm nay", "Ngày mai", "Thứ Hai (05/10)", v.v.
  timeRemainingLabel: string; // "Còn 2 giờ 30 phút", "Đã quá hạn 4 giờ"
  statusName: string;
  priorityName: string;
  categoryOrProject?: string;
  isOverdue: boolean; // Overdue within this week
  isDueToday: boolean;
  isDueTomorrow: boolean;
  isDueSoon: boolean; // Due today or tomorrow
  isThisWeek: boolean;
  rawPersonalTask?: PersonalTask;
  rawRedmineIssue?: RedmineIssue;
}

export interface WeeklyNotificationSummary {
  overdue: WeeklyNotificationItem[];
  dueToday: WeeklyNotificationItem[];
  dueTomorrow: WeeklyNotificationItem[];
  dueSoon: WeeklyNotificationItem[];
  thisWeek: WeeklyNotificationItem[];
  totalActionRequired: number; // overdue + dueSoon
  currentWeekLabel: string;
  weekStartStr: string;
  weekEndStr: string;
  weekNumber: number;
}

/**
 * Gets start and end dates of current week (Monday 00:00:00 to Sunday 23:59:59) in YYYY-MM-DD.
 */
export function getCurrentWeekRange(referenceDate = new Date()): {
  start: Date;
  end: Date;
  startStr: string;
  endStr: string;
  weekNumber: number;
} {
  const d = new Date(referenceDate);
  const day = d.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const formatDate = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const dayStr = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${dayStr}`;
  };

  // Calculate approximate ISO week number
  const temp = new Date(monday);
  temp.setHours(0, 0, 0, 0);
  temp.setDate(temp.getDate() + 3 - ((temp.getDay() + 6) % 7));
  const week1 = new Date(temp.getFullYear(), 0, 4);
  const weekNumber = 1 + Math.round(((temp.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);

  return {
    start: monday,
    end: sunday,
    startStr: formatDate(monday),
    endStr: formatDate(sunday),
    weekNumber,
  };
}

/**
 * Checks if a PersonalTask is finished.
 */
export function isPersonalTaskDone(task: PersonalTask): boolean {
  if (typeof task.doneRatio === 'number' && task.doneRatio >= 100) return true;
  const status = (task.statusName || '').trim().toLowerCase();
  return (
    status === 'done' ||
    status === 'closed' ||
    status === 'resolved' ||
    status === 'hoàn thành' ||
    status === 'đã xong' ||
    status === 'đóng'
  );
}

/**
 * Checks if a RedmineIssue is finished / closed.
 */
export function isRedmineIssueClosed(issue: RedmineIssue): boolean {
  const status = (issue.status?.name || '').trim().toLowerCase();
  return (
    status === 'closed' ||
    status === 'close-duplicated' ||
    status === 'client verified' ||
    status === 'resolved' ||
    status === 'hoàn thành' ||
    status === 'đã đóng' ||
    status === 'đóng'
  );
}

/**
 * Parses raw date/time string into a target Date object and formatted components.
 * Supports:
 * - "YYYY-MM-DD" -> defaults to 17:30 of that day
 * - "YYYY-MM-DD HH:mm" -> uses specified time
 * - "YYYY-MM-DDTHH:mm:ss" -> uses specified time
 */
export function parseDeadline(rawStr?: string, defaultHour = 17, defaultMinute = 30): {
  targetDate: Date;
  dateStr: string;
  timeStr: string;
  hasExplicitTime: boolean;
} | null {
  if (!rawStr || typeof rawStr !== 'string') return null;
  const trimmed = rawStr.trim();
  if (!trimmed) return null;

  // Match YYYY-MM-DD
  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!dateMatch) return null;

  const y = parseInt(dateMatch[1], 10);
  const m = parseInt(dateMatch[2], 10) - 1;
  const d = parseInt(dateMatch[3], 10);
  const dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;

  // Match time HH:mm if present
  const timeMatch = trimmed.match(/[T\s](\d{1,2}):(\d{2})/);
  let hour = defaultHour;
  let minute = defaultMinute;
  let hasExplicitTime = false;

  if (timeMatch) {
    hour = parseInt(timeMatch[1], 10);
    minute = parseInt(timeMatch[2], 10);
    hasExplicitTime = true;
  }

  const targetDate = new Date(y, m, d, hour, minute, 0, 0);
  const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  return { targetDate, dateStr, timeStr, hasExplicitTime };
}

/**
 * Computes human-friendly time remaining label (by hour and day).
 */
export function formatTimeRemaining(diffMs: number): string {
  const isPast = diffMs < 0;
  const absMs = Math.abs(diffMs);
  const totalMinutes = Math.floor(absMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const days = Math.floor(hours / 24);
  const remainHours = hours % 24;

  let timeDesc = '';
  if (days > 0) {
    timeDesc = `${days} ngày${remainHours > 0 ? ` ${remainHours}h` : ''}`;
  } else if (hours > 0) {
    timeDesc = `${hours} giờ${minutes > 0 ? ` ${minutes}p` : ''}`;
  } else {
    timeDesc = `${Math.max(1, minutes)} phút`;
  }

  return isPast ? `Quá hạn ${timeDesc}` : `Còn ${timeDesc}`;
}

const VI_WEEKDAYS = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

/**
 * Computes weekly notification summary strictly constrained to the CURRENT WEEK.
 * Strictly ignores past weeks/months/years.
 */
export function computeWeeklyNotifications({
  personalTasks = [],
  redmineIssues = [],
  currentUserId,
  now = new Date(),
}: {
  personalTasks?: PersonalTask[];
  redmineIssues?: RedmineIssue[];
  currentUserId?: number | null;
  now?: Date;
}): WeeklyNotificationSummary {
  const { start: weekStart, end: weekEnd, startStr, endStr, weekNumber } = getCurrentWeekRange(now);

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const tomorrowStr = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

  const allItems: WeeklyNotificationItem[] = [];

  // 1. Process Personal Tasks (Must belong to current week)
  for (const pt of personalTasks) {
    if (isPersonalTaskDone(pt)) continue; // ignore completed tasks

    // Check if task explicitly assigned to this week by week name
    const hasWeekMatch = Boolean(
      pt.week &&
      (pt.week.toLowerCase().includes(`tuần ${weekNumber}`) ||
        pt.week.toLowerCase().includes(`w${weekNumber}`) ||
        pt.week.toLowerCase().includes(`t${weekNumber}`))
    );

    const parsedDue = parseDeadline(pt.dueDate);
    const dueDateInCurrentWeek = Boolean(parsedDue && parsedDue.dateStr >= startStr && parsedDue.dateStr <= endStr);

    // STRICT FILTER: Task must belong to the current week either by week name or deadline in current week!
    if (!hasWeekMatch && !dueDateInCurrentWeek) {
      continue;
    }

    // Determine target deadline
    let targetDate: Date;
    let targetDateStr: string;
    let dueTimeFormatted: string;

    if (parsedDue) {
      targetDate = parsedDue.targetDate;
      targetDateStr = parsedDue.dateStr;
      dueTimeFormatted = parsedDue.timeStr;
    } else {
      // If task has no due date but is assigned to this week, default to end of week Sunday 17:30
      targetDate = new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 17, 30);
      targetDateStr = endStr;
      dueTimeFormatted = '17:30';
    }

    const diffMs = targetDate.getTime() - now.getTime();
    const isOverdue = diffMs < 0;
    const isDueToday = targetDateStr === todayStr;
    const isDueTomorrow = targetDateStr === tomorrowStr;
    const isDueSoon = isDueToday || isDueTomorrow;

    const dayOfWeek = targetDate.getDay();
    const dayLabel = isDueToday
      ? 'Hôm nay'
      : isDueTomorrow
      ? 'Ngày mai'
      : `${VI_WEEKDAYS[dayOfWeek]} (${targetDateStr.slice(5).replace('-', '/')})`;

    allItems.push({
      id: `personal-${pt.id}`,
      source: 'personal',
      title: pt.title,
      dueDateStr: pt.dueDate || undefined,
      dueTimeFormatted,
      targetDateStr,
      dayLabel,
      timeRemainingLabel: formatTimeRemaining(diffMs),
      statusName: pt.statusName || 'New',
      priorityName: pt.priorityName || 'Normal',
      categoryOrProject: pt.category || 'Cá nhân',
      isOverdue,
      isDueToday,
      isDueTomorrow,
      isDueSoon,
      isThisWeek: true,
      rawPersonalTask: pt,
    });
  }

  // 2. Process Redmine Issues (Must belong to current week)
  for (const issue of redmineIssues) {
    if (isRedmineIssueClosed(issue)) continue; // ignore closed issues

    // Filter to current user if specified
    if (currentUserId && issue.assigned_to?.id !== currentUserId) {
      continue;
    }

    const parsedDue = parseDeadline(issue.due_date);

    // STRICT FILTER FOR REDMINE: due_date MUST be within the current week!
    // Never include random issues from 2025 or other months!
    if (!parsedDue || parsedDue.dateStr < startStr || parsedDue.dateStr > endStr) {
      continue;
    }

    const targetDate = parsedDue.targetDate;
    const targetDateStr = parsedDue.dateStr;
    const dueTimeFormatted = parsedDue.timeStr;

    const diffMs = targetDate.getTime() - now.getTime();
    const isOverdue = diffMs < 0;
    const isDueToday = targetDateStr === todayStr;
    const isDueTomorrow = targetDateStr === tomorrowStr;
    const isDueSoon = isDueToday || isDueTomorrow;

    const dayOfWeek = targetDate.getDay();
    const dayLabel = isDueToday
      ? 'Hôm nay'
      : isDueTomorrow
      ? 'Ngày mai'
      : `${VI_WEEKDAYS[dayOfWeek]} (${targetDateStr.slice(5).replace('-', '/')})`;

    allItems.push({
      id: `redmine-${issue.id}`,
      source: 'redmine',
      title: `#${issue.id} - ${issue.subject}`,
      dueDateStr: issue.due_date || undefined,
      dueTimeFormatted,
      targetDateStr,
      dayLabel,
      timeRemainingLabel: formatTimeRemaining(diffMs),
      statusName: issue.status?.name || 'New',
      priorityName: issue.priority?.name || 'Normal',
      categoryOrProject: issue.project?.name || 'Redmine',
      isOverdue,
      isDueToday,
      isDueTomorrow,
      isDueSoon,
      isThisWeek: true,
      rawRedmineIssue: issue,
    });
  }

  // Sort items: Overdue first, then by earliest deadline
  allItems.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return (a.targetDateStr + a.dueTimeFormatted).localeCompare(b.targetDateStr + b.dueTimeFormatted);
  });

  const overdue = allItems.filter((i) => i.isOverdue);
  const dueToday = allItems.filter((i) => i.isDueToday);
  const dueTomorrow = allItems.filter((i) => i.isDueTomorrow);
  const dueSoon = allItems.filter((i) => i.isDueSoon);

  const currentWeekLabel = `Tuần ${weekNumber} (${startStr.slice(5).replace('-', '/')} - ${endStr.slice(5).replace('-', '/')})`;

  // Count unique items requiring attention (overdue or due soon) without double-counting
  const actionRequiredSet = new Set<string>();
  overdue.forEach((i) => actionRequiredSet.add(i.id));
  dueSoon.forEach((i) => actionRequiredSet.add(i.id));

  return {
    overdue,
    dueToday,
    dueTomorrow,
    dueSoon,
    thisWeek: allItems,
    totalActionRequired: actionRequiredSet.size,
    currentWeekLabel,
    weekStartStr: startStr,
    weekEndStr: endStr,
    weekNumber,
  };
}

// Browser Notification Helpers
const BROWSER_NOTIF_KEY = 'pm_browser_notification_enabled';

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function isBrowserNotificationEnabled(): boolean {
  if (!isBrowserNotificationSupported()) return false;
  try {
    return localStorage.getItem(BROWSER_NOTIF_KEY) === 'true' && Notification.permission === 'granted';
  } catch {
    return false;
  }
}

export function setBrowserNotificationEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(BROWSER_NOTIF_KEY, enabled ? 'true' : 'false');
  } catch {}
}

export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!isBrowserNotificationSupported()) return false;
  try {
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    setBrowserNotificationEnabled(granted);
    return granted;
  } catch {
    return false;
  }
}

export function sendBrowserNotification(title: string, options?: NotificationOptions): Notification | null {
  if (!isBrowserNotificationSupported() || Notification.permission !== 'granted') return null;
  try {
    return new Notification(title, {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      ...options,
    });
  } catch {
    return null;
  }
}
