import type { RedmineIssue, RedmineStatus } from '../types/redmine';

export function vietnamToday(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}
export function isIssueClosed(issue: RedmineIssue, statuses: RedmineStatus[]) {
  const configured = statuses.find(s => s.id === issue.status.id);
  if (configured && typeof configured.is_closed === 'boolean') return configured.is_closed;
  return ['closed', 'close-duplicated', 'client verified'].includes(issue.status.name.trim().toLowerCase());
}
export function calculatePMAnalytics(issues: RedmineIssue[], statuses: RedmineStatus[], today = vietnamToday()) {
  const closed = issues.filter(i => isIssueClosed(i, statuses)).length;
  const inProgress = issues.filter(i => !isIssueClosed(i, statuses) && i.status.name.trim().toLowerCase() === 'in progress').length;
  const overdueIssues = issues.filter(i => i.due_date && i.due_date < today && !isIssueClosed(i, statuses));
  const blockedIssues = issues.filter(i => !isIssueClosed(i, statuses) && ['blocked by', 'blocked', 'failed'].includes(i.status.name.trim().toLowerCase()));
  const assignees = new Map<number, { id: number; name: string; total: number; completed: number; inProgress: number }>();
  for (const issue of issues) {
    const id = issue.assigned_to?.id ?? -1;
    const row = assignees.get(id) ?? { id, name: issue.assigned_to?.name ?? 'Chưa phân công', total: 0, completed: 0, inProgress: 0 };
    row.total++;
    if (isIssueClosed(issue, statuses)) row.completed++;
    else if (issue.status.name.trim().toLowerCase() === 'in progress') row.inProgress++;
    assignees.set(id, row);
  }
  const workloadAll = [...assignees.values()].sort((a, b) => b.total - a.total || a.id - b.id);
  return { total: issues.length, closed, inProgress, overdueIssues, blockedIssues, completionRate: issues.length ? Math.round(closed / issues.length * 100) : 0,
    workloadAll, workload: workloadAll.slice(0, 10) };
}
