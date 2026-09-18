import {
  RedmineConfig,
  RedmineUser,
  RedmineProject,
  RedmineIssue,
  RedmineStatus,
  RedmineTracker,
  RedminePriority,
  RedmineMembership,
  RedmineVersion,
  RedmineTimeEntry,
} from '../types/redmine';

const STORAGE_KEY_URL = 'redmine_pm_base_url';
const STORAGE_KEY_API_KEY = 'redmine_pm_api_key';

export const DEFAULT_REDMINE_URL = 'https://redmine.anybim.vn';
export const DEFAULT_REDMINE_KEY = '440da87a37415860ff240080d18ba34b21536eb8';

export function getStoredConfig(): RedmineConfig {
  const url = localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_REDMINE_URL;
  const key = localStorage.getItem(STORAGE_KEY_API_KEY) || DEFAULT_REDMINE_KEY;
  return { baseUrl: url, apiKey: key };
}

export function saveStoredConfig(config: RedmineConfig): void {
  localStorage.setItem(STORAGE_KEY_URL, config.baseUrl);
  localStorage.setItem(STORAGE_KEY_API_KEY, config.apiKey);
}

function getHeaders(): HeadersInit {
  const cfg = getStoredConfig();
  return {
    'Content-Type': 'application/json',
    'x-redmine-url': cfg.baseUrl,
    'x-redmine-api-key': cfg.apiKey,
  };
}

export async function getCurrentUser(): Promise<RedmineUser> {
  const res = await fetch('/api/redmine/me', { headers: getHeaders() });
  if (!res.ok) throw new Error('Không thể kết nối đến Redmine hoặc API Key không hợp lệ');
  const data = await res.json();
  return data.user;
}

export async function getProjects(): Promise<RedmineProject[]> {
  const res = await fetch('/api/redmine/projects?limit=100', { headers: getHeaders() });
  if (!res.ok) throw new Error('Lỗi khi tải danh sách dự án');
  const data = await res.json();
  return data.projects || [];
}

export interface IssueFilterParams {
  project_id?: string | number;
  status_id?: string | number;
  assigned_to_id?: string | number;
  tracker_id?: string | number;
  fixed_version_id?: string | number;
  priority_id?: string | number;
  limit?: number;
  offset?: number;
  sort?: string;
}

export async function getIssues(params: IssueFilterParams = {}): Promise<{ issues: RedmineIssue[]; total_count: number }> {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== 'all') {
      query.set(k, String(v));
    }
  }

  const res = await fetch(`/api/redmine/issues?${query.toString()}`, { headers: getHeaders() });
  if (!res.ok) throw new Error('Lỗi khi tải danh sách công việc');
  const data = await res.json();
  return {
    issues: data.issues || [],
    total_count: data.total_count || (data.issues ? data.issues.length : 0),
  };
}

export async function getIssueDetail(id: number): Promise<RedmineIssue> {
  const res = await fetch(`/api/redmine/issues/${id}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`Không tìm thấy công việc #${id}`);
  const data = await res.json();
  return data.issue;
}

export async function createIssue(issuePayload: {
  project_id: number;
  tracker_id: number;
  subject: string;
  description?: string;
  priority_id?: number;
  assigned_to_id?: number;
  fixed_version_id?: number;
  estimated_hours?: number;
  start_date?: string;
  due_date?: string;
}): Promise<RedmineIssue> {
  const res = await fetch('/api/redmine/issues', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ issue: issuePayload }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.errors ? errorData.errors.join(', ') : 'Lỗi khi tạo công việc mới');
  }
  const data = await res.json();
  return data.issue;
}

export async function updateIssue(
  id: number,
  issueUpdates: {
    status_id?: number;
    done_ratio?: number;
    assigned_to_id?: number;
    priority_id?: number;
    notes?: string;
    estimated_hours?: number;
    due_date?: string;
  }
): Promise<void> {
  const res = await fetch(`/api/redmine/issues/${id}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify({ issue: issueUpdates }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.errors ? errorData.errors.join(', ') : 'Lỗi khi cập nhật công việc');
  }
}

export async function deleteIssue(id: number): Promise<void> {
  const res = await fetch(`/api/redmine/issues/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Không thể xóa công việc');
}

export async function getStatuses(): Promise<RedmineStatus[]> {
  const res = await fetch('/api/redmine/statuses', { headers: getHeaders() });
  if (!res.ok) throw new Error('Lỗi khi tải trạng thái');
  const data = await res.json();
  return data.issue_statuses || [];
}

export async function getTrackers(): Promise<RedmineTracker[]> {
  const res = await fetch('/api/redmine/trackers', { headers: getHeaders() });
  if (!res.ok) throw new Error('Lỗi khi tải loại công việc');
  const data = await res.json();
  return data.trackers || [];
}

export async function getPriorities(): Promise<RedminePriority[]> {
  const res = await fetch('/api/redmine/priorities', { headers: getHeaders() });
  if (!res.ok) throw new Error('Lỗi khi tải mức độ ưu tiên');
  const data = await res.json();
  return data.issue_priorities || [];
}

export async function getMemberships(projectId: number | string): Promise<RedmineMembership[]> {
  const res = await fetch(`/api/redmine/memberships?project_id=${projectId}`, { headers: getHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.memberships || [];
}

export async function getVersions(projectId: number | string): Promise<RedmineVersion[]> {
  const res = await fetch(`/api/redmine/versions?project_id=${projectId}`, { headers: getHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.versions || [];
}

export async function getTimeEntries(projectId?: number | string): Promise<RedmineTimeEntry[]> {
  const url = projectId && projectId !== 'all'
    ? `/api/redmine/time_entries?project_id=${projectId}&limit=100`
    : '/api/redmine/time_entries?limit=100';
  const res = await fetch(url, { headers: getHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.time_entries || [];
}

export async function logTimeEntry(entry: {
  issue_id?: number;
  project_id?: number;
  hours: number;
  activity_id?: number;
  comments?: string;
  spent_on?: string;
}): Promise<void> {
  const res = await fetch('/api/redmine/time_entries', {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ time_entry: entry }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.errors ? err.errors.join(', ') : 'Lỗi khi ghi nhận giờ làm');
  }
}

export async function askGeminiPM(
  mode: 'standup' | 'risk' | 'general',
  projectName: string,
  issues: RedmineIssue[],
  statistics: any
): Promise<string> {
  const res = await fetch('/api/gemini/pm-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, projectName, issues, statistics }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Không thể tạo báo cáo AI lúc này');
  }
  const data = await res.json();
  return data.result || '';
}
