import {
  RedmineConfig,
  RedmineUser,
  RedmineProject,
  RedmineIssue,
  RedmineStatus,
  RedmineTracker,
  RedminePriority,
  RedmineCustomField,
  RedmineIssueCategory,
  RedmineMembership,
  RedmineVersion,
  RedmineTimeEntry,
  TimePeriodType,
  DateFieldType,
} from '../types/redmine';

const STORAGE_KEY_URL = 'redmine_pm_base_url';
const STORAGE_KEY_API_KEY = 'redmine_pm_api_key';

export const DEFAULT_REDMINE_URL = 'https://redmine.anybim.vn';
export const DEFAULT_REDMINE_KEY = '485a0bd120e3515ab2442afe570f2a6829a55342';

export const DEFAULT_REDMINE_STATUSES: RedmineStatus[] = [
  { id: 1, name: 'New', is_closed: false },
  { id: 2, name: 'In Progress', is_closed: false },
  { id: 16, name: 'Ready For QA', is_closed: false },
  { id: 12, name: 'QA testing', is_closed: false },
  { id: 7, name: 'QA Verified', is_closed: false },
  { id: 4, name: 'Failed', is_closed: false },
  { id: 11, name: 'On STG', is_closed: false },
  { id: 9, name: 'On PROD', is_closed: false },
  { id: 3, name: 'Resolved', is_closed: false },
  { id: 10, name: 'Client Verified', is_closed: true },
  { id: 8, name: 'Pending', is_closed: false },
  { id: 18, name: 'Blocked By', is_closed: false },
  { id: 17, name: "Can't reproduce", is_closed: false },
  { id: 5, name: 'Closed', is_closed: true },
  { id: 6, name: 'Close-Duplicated', is_closed: true },
];

export function getStoredConfig(): RedmineConfig {
  const url = localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_REDMINE_URL;
  let key = localStorage.getItem(STORAGE_KEY_API_KEY);
  // Auto migrate from old key
  if (!key || key === '440da87a37415860ff240080d18ba34b21536eb8') {
    key = DEFAULT_REDMINE_KEY;
    localStorage.setItem(STORAGE_KEY_API_KEY, DEFAULT_REDMINE_KEY);
  }
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

export function formatRedmineDate(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getDateFilterForPeriod(
  period: TimePeriodType,
  options: {
    specificMonth?: string; // 'YYYY-MM'
    customStart?: string; // 'YYYY-MM-DD'
    customEnd?: string; // 'YYYY-MM-DD'
  } = {}
): string | undefined {
  const now = new Date();
  if (period === 'all') return undefined;

  if (period === 'today') {
    const todayStr = formatRedmineDate(now);
    return `><${todayStr}|${todayStr}`;
  }

  if (period === 'this_week') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `><${formatRedmineDate(monday)}|${formatRedmineDate(sunday)}`;
  }

  if (period === 'last_week') {
    const d = new Date(now);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1) - 7;
    const monday = new Date(d.setDate(diff));
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    return `><${formatRedmineDate(monday)}|${formatRedmineDate(sunday)}`;
  }

  if (period === 'this_month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return `><${formatRedmineDate(start)}|${formatRedmineDate(end)}`;
  }

  if (period === 'last_month') {
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const end = new Date(now.getFullYear(), now.getMonth(), 0);
    return `><${formatRedmineDate(start)}|${formatRedmineDate(end)}`;
  }

  if (period === 'specific_month' && options.specificMonth) {
    const [y, m] = options.specificMonth.split('-').map(Number);
    if (y && m) {
      const start = new Date(y, m - 1, 1);
      const end = new Date(y, m, 0);
      return `><${formatRedmineDate(start)}|${formatRedmineDate(end)}`;
    }
  }

  if (period === 'custom') {
    if (options.customStart && options.customEnd) {
      return `><${options.customStart}|${options.customEnd}`;
    } else if (options.customStart) {
      return `>=${options.customStart}`;
    } else if (options.customEnd) {
      return `<=${options.customEnd}`;
    }
  }

  return undefined;
}

export function getDateFilterQuery(
  period: TimePeriodType,
  dateField: DateFieldType,
  options: {
    specificMonth?: string;
    customStart?: string;
    customEnd?: string;
  } = {}
): Record<string, string> {
  const filterVal = getDateFilterForPeriod(period, options);
  if (!filterVal) return {};
  return { [dateField]: filterVal };
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
  created_on?: string;
  updated_on?: string;
  due_date?: string;
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

export interface FetchProgress {
  loaded: number;
  total: number;
  isFinished: boolean;
}

export async function fetchAllIssues(
  params: IssueFilterParams = {},
  onProgress?: (progress: FetchProgress) => void,
  maxTotal: number = 3500
): Promise<{ issues: RedmineIssue[]; total_count: number }> {
  const firstPage = await getIssues({ ...params, limit: 100, offset: 0 });
  const total = firstPage.total_count;
  let allIssues: RedmineIssue[] = [...firstPage.issues];

  onProgress?.({
    loaded: allIssues.length,
    total,
    isFinished: allIssues.length >= total || allIssues.length >= maxTotal,
  });

  if (total <= 100 || allIssues.length >= maxTotal) {
    return { issues: allIssues.slice(0, maxTotal), total_count: total };
  }

  const targetCount = Math.min(total, maxTotal);
  const remainingOffsets: number[] = [];
  for (let offset = 100; offset < targetCount; offset += 100) {
    remainingOffsets.push(offset);
  }

  // Fetch in batches of 4
  const batchSize = 4;
  for (let i = 0; i < remainingOffsets.length; i += batchSize) {
    const batch = remainingOffsets.slice(i, i + batchSize);
    const results = await Promise.all(
      batch.map((offset) => getIssues({ ...params, limit: 100, offset }))
    );
    for (const res of results) {
      allIssues = allIssues.concat(res.issues);
    }
    onProgress?.({
      loaded: Math.min(allIssues.length, targetCount),
      total,
      isFinished: allIssues.length >= targetCount,
    });
  }

  return { issues: allIssues.slice(0, maxTotal), total_count: total };
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
  category_id?: number;
  fixed_version_id?: number;
  parent_issue_id?: number;
  estimated_hours?: number;
  start_date?: string;
  due_date?: string;
  custom_fields?: { id: number; value: any }[];
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
    category_id?: number;
    priority_id?: number;
    notes?: string;
    estimated_hours?: number;
    start_date?: string;
    due_date?: string;
    custom_fields?: { id: number; value: any }[];
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

export async function getCustomFields(): Promise<RedmineCustomField[]> {
  const res = await fetch('/api/redmine/custom_fields', { headers: getHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.custom_fields || [];
}

export async function getIssueCategories(projectId: number | string): Promise<RedmineIssueCategory[]> {
  const res = await fetch(`/api/redmine/issue_categories?project_id=${projectId}`, { headers: getHeaders() });
  if (!res.ok) return [];
  const data = await res.json();
  return data.issue_categories || [];
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

export interface AIModelOption {
  id: string;
  name: string;
  description: string;
  badge?: string;
  isDefault?: boolean;
}

export const AVAILABLE_AI_MODELS: AIModelOption[] = [
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    description: 'Tốc độ siêu nhanh, ổn định & tối ưu Standup (Khuyên dùng)',
    badge: 'Khuyên dùng',
    isDefault: true,
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    description: 'Phân tích sâu, văn phong quản trị dự án chi tiết',
    badge: 'Mạnh mẽ',
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    description: 'Mô hình suy luận Flash mới nhất',
    badge: 'Mới',
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    description: 'Bản Flash cập nhật liên tục từ Google AI',
  },
];

export interface GeminiPMResponse {
  result: string;
  usedModel?: string;
  requestedModel?: string;
  fallbackOccurred?: boolean;
}

export async function askGeminiPM(
  mode: 'standup' | 'risk' | 'general',
  projectName: string,
  issues: RedmineIssue[],
  statistics: any,
  model?: string
): Promise<GeminiPMResponse> {
  const res = await fetch('/api/gemini/pm-insights', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode, projectName, issues, statistics, model }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Không thể tạo báo cáo AI lúc này');
  }
  const data = await res.json();
  return {
    result: data.result || '',
    usedModel: data.usedModel,
    requestedModel: data.requestedModel,
    fallbackOccurred: data.fallbackOccurred,
  };
}
