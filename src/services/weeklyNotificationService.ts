import type { PersonalTask } from '../types/personalTask';
import type { RedmineIssue } from '../types/redmine';

export interface WeeklyNotificationItem {
  id: string;
  source: 'personal' | 'redmine';
  title: string;
  dueDate?: string;
  statusName: string;
  priorityName: string;
  categoryOrProject?: string;
  isOverdue: boolean;
  isDueSoon: boolean; // Due today or within next 2 days
  isThisWeek: boolean;
  rawPersonalTask?: PersonalTask;
  rawRedmineIssue?: RedmineIssue;
}

export interface WeeklyNotificationSummary {
  overdue: WeeklyNotificationItem[];
  dueSoon: WeeklyNotificationItem[];
  thisWeek: WeeklyNotificationItem[];
  totalActionRequired: number; // overdue + dueSoon
  currentWeekLabel: string;
  weekStartStr: string;
  weekEndStr: string;
}

/**
 * Gets start and end dates of current week (Monday to Sunday) in YYYY-MM-DD.
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
 * Computes weekly notification summary from personal tasks and redmine issues.
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
  const { startStr, endStr, weekNumber } = getCurrentWeekRange(now);

  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  // Next 2 days for due soon
  const twoDaysLater = new Date(now);
  twoDaysLater.setDate(now.getDate() + 2);
  const twoDaysLaterStr = `${twoDaysLater.getFullYear()}-${String(twoDaysLater.getMonth() + 1).padStart(2, '0')}-${String(twoDaysLater.getDate()).padStart(2, '0')}`;

  const allItems: WeeklyNotificationItem[] = [];

  // 1. Process Personal Tasks
  for (const pt of personalTasks) {
    if (isPersonalTaskDone(pt)) continue; // ignore completed tasks

    const dueDate = pt.dueDate ? pt.dueDate.trim().slice(0, 10) : undefined;
    const isOverdue = Boolean(dueDate && dueDate < todayStr);
    const isDueSoon = Boolean(dueDate && dueDate >= todayStr && dueDate <= twoDaysLaterStr);

    // Is this week?
    const hasWeekMatch = Boolean(
      pt.week &&
      (pt.week.toLowerCase().includes(`tuần ${weekNumber}`) ||
        pt.week.toLowerCase().includes(`w${weekNumber}`) ||
        pt.week.toLowerCase().includes(`t${weekNumber}`))
    );
    const dueDateInWeek = Boolean(dueDate && dueDate >= startStr && dueDate <= endStr);
    const isThisWeek = isOverdue || isDueSoon || dueDateInWeek || hasWeekMatch;

    if (isOverdue || isDueSoon || isThisWeek) {
      allItems.push({
        id: `personal-${pt.id}`,
        source: 'personal',
        title: pt.title,
        dueDate: pt.dueDate || undefined,
        statusName: pt.statusName || 'New',
        priorityName: pt.priorityName || 'Normal',
        categoryOrProject: pt.category || 'Cá nhân',
        isOverdue,
        isDueSoon,
        isThisWeek,
        rawPersonalTask: pt,
      });
    }
  }

  // 2. Process Redmine Issues (assigned to current user, or all if no user filter)
  for (const issue of redmineIssues) {
    if (isRedmineIssueClosed(issue)) continue; // ignore closed issues

    // Filter to current user if provided
    if (currentUserId && issue.assigned_to?.id !== currentUserId) {
      continue;
    }

    const dueDate = issue.due_date ? issue.due_date.trim().slice(0, 10) : undefined;
    const isOverdue = Boolean(dueDate && dueDate < todayStr);
    const isDueSoon = Boolean(dueDate && dueDate >= todayStr && dueDate <= twoDaysLaterStr);
    const dueDateInWeek = Boolean(dueDate && dueDate >= startStr && dueDate <= endStr);
    const isThisWeek = isOverdue || isDueSoon || dueDateInWeek;

    if (isOverdue || isDueSoon || isThisWeek) {
      allItems.push({
        id: `redmine-${issue.id}`,
        source: 'redmine',
        title: `#${issue.id} - ${issue.subject}`,
        dueDate: issue.due_date || undefined,
        statusName: issue.status?.name || 'New',
        priorityName: issue.priority?.name || 'Normal',
        categoryOrProject: issue.project?.name || 'Redmine',
        isOverdue,
        isDueSoon,
        isThisWeek,
        rawRedmineIssue: issue,
      });
    }
  }

  const overdue = allItems.filter((i) => i.isOverdue);
  const dueSoon = allItems.filter((i) => i.isDueSoon);
  const thisWeek = allItems.filter((i) => i.isThisWeek);

  const currentWeekLabel = `Tuần ${weekNumber} (${startStr.slice(5).replace('-', '/')} - ${endStr.slice(5).replace('-', '/')})`;

  return {
    overdue,
    dueSoon,
    thisWeek,
    totalActionRequired: overdue.length + dueSoon.length,
    currentWeekLabel,
    weekStartStr: startStr,
    weekEndStr: endStr,
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
