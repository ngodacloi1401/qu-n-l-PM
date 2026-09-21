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

import { buildAIReportPayload, buildAIChatPayload, readAIReportResponse, type ChatMessage, type ChatScope } from './aiPayload';
import { readIssueListResponse } from './issueResponse';
import { cacheScope, cacheRevision, invalidateAfterMutation, readLocalCache, writeLocalCache } from './localCache';
import { loadIssueSnapshot, issueQueryKey, IssueCacheOptions, IssueSnapshot } from './issueCache';
import { isOTSubject, OTRecord } from './otReport';

const STORAGE_KEY_URL = 'redmine_pm_base_url';
const STORAGE_KEY_API_KEY = 'redmine_pm_api_key';

export const DEFAULT_REDMINE_URL = 'https://redmine.anybim.vn';
export const DEFAULT_REDMINE_KEY = '';

const STORAGE_KEY_GEMINI_KEY = 'redmine_pm_gemini_api_key';
const STORAGE_KEY_OPENAI_KEY = 'redmine_pm_openai_api_key';
const STORAGE_KEY_ANTHROPIC_KEY = 'redmine_pm_anthropic_api_key';

export const DEFAULT_REDMINE_STATUSES: RedmineStatus[] = [
  { id: 1, name: 'New', is_closed: false },
  { id: 2, name: 'In Progress', is_closed: false },
  { id: 3, name: 'Resolved', is_closed: false },
  { id: 16, name: 'Ready For QA', is_closed: false },
  { id: 12, name: 'QA testing', is_closed: false },
  { id: 7, name: 'QA Verified', is_closed: false },
  { id: 4, name: 'Failed', is_closed: false },
  { id: 11, name: 'On STG', is_closed: false },
  { id: 9, name: 'On PROD', is_closed: false },
  { id: 5, name: 'Closed', is_closed: true },
  { id: 6, name: 'Close-Duplicated', is_closed: true },
  { id: 18, name: 'Blocked By', is_closed: false },
  { id: 17, name: "Can't reproduce", is_closed: false },
  { id: 8, name: 'Pending', is_closed: false },
  { id: 10, name: 'Client Verified', is_closed: true },
];

export const DEFAULT_REDMINE_TRACKERS: RedmineTracker[] = [
  { id: 2, name: 'Epic' },
  { id: 1, name: 'User Story' },
  { id: 10, name: 'Enhancement/Improvement' },
  { id: 7, name: 'Change request' },
  { id: 8, name: 'Implement' },
  { id: 4, name: 'Task' },
  { id: 5, name: 'Test' },
  { id: 3, name: 'Defect(GapBA)' },
  { id: 6, name: 'Bug' },
  { id: 9, name: 'UI Design' },
  { id: 11, name: 'Ecosystem' },
  { id: 12, name: 'System' },
  { id: 13, name: 'Subsystem' },
  { id: 14, name: 'Cluster' },
  { id: 15, name: 'Module' },
  { id: 16, name: 'Feature' },
  { id: 17, name: 'Function' },
];

export const DEFAULT_REDMINE_PRIORITIES: RedminePriority[] = [
  { id: 29, name: 'Must Have', is_default: true },
  { id: 30, name: 'Should Have', is_default: false },
  { id: 31, name: 'Could Have', is_default: false },
  { id: 32, name: "Won't Have", is_default: false },
];

export const DEFAULT_REDMINE_CUSTOM_FIELDS: RedmineCustomField[] = [
  {
    id: 48,
    name: 'IssueGroup',
    field_format: 'list',
    possible_values: ['Chung'],
    trackers: [
      { id: 2, name: 'Epic' },
      { id: 1, name: 'User Story' },
      { id: 10, name: 'Enhancement/Improvement' },
      { id: 7, name: 'Change request' },
      { id: 8, name: 'Implement' },
      { id: 4, name: 'Task' },
      { id: 5, name: 'Test' },
      { id: 6, name: 'Bug' },
    ],
  },
  {
    id: 43,
    name: 'ProjectCode',
    field_format: 'list',
    possible_values: ['HAWEE_BIM_2026', 'HAWEE_AI_KYTHUAT_2026', 'INERTIA_2026', 'HAWEE_2026'],
    trackers: [
      { id: 7, name: 'Change request' },
      { id: 8, name: 'Implement' },
      { id: 4, name: 'Task' },
      { id: 5, name: 'Test' },
      { id: 6, name: 'Bug' },
    ],
  },
  {
    id: 24,
    name: 'Report By',
    field_format: 'list',
    possible_values: ['QA/BA', 'Planning', 'PO/PM', 'Customers'],
    trackers: [
      { id: 1, name: 'User Story' },
      { id: 10, name: 'Enhancement/Improvement' },
      { id: 8, name: 'Implement' },
      { id: 4, name: 'Task' },
      { id: 6, name: 'Bug' },
    ],
  },
  {
    id: 17,
    name: 'Review',
    field_format: 'bool',
    possible_values: ['0', '1'],
    trackers: [
      { id: 1, name: 'User Story' },
      { id: 7, name: 'Change request' },
      { id: 10, name: 'Enhancement/Improvement' },
      { id: 4, name: 'Task' },
      { id: 5, name: 'Test' },
      { id: 6, name: 'Bug' },
    ],
  },
  {
    id: 23,
    name: 'Document/Srs-Urd/Acceptance',
    field_format: 'bool',
    possible_values: ['0', '1'],
    trackers: [
      { id: 1, name: 'User Story' },
      { id: 7, name: 'Change request' },
      { id: 10, name: 'Enhancement/Improvement' },
    ],
  },
  {
    id: 40,
    name: 'Code Optimizing',
    field_format: 'list',
    possible_values: ['Chưa làm', 'Đã làm'],
    trackers: [{ id: 4, name: 'Task' }],
  },
  {
    id: 46,
    name: 'Bugs_step_to_reproduce',
    field_format: 'list',
    possible_values: ['Yes', 'No'],
    trackers: [{ id: 6, name: 'Bug' }],
  },
  {
    id: 45,
    name: 'Actual/Expect Result',
    field_format: 'list',
    possible_values: ['Yes', 'No'],
    trackers: [{ id: 6, name: 'Bug' }],
  },
  {
    id: 3,
    name: 'Not bug',
    field_format: 'bool',
    possible_values: ['0', '1'],
    trackers: [{ id: 6, name: 'Bug' }],
  },
  {
    id: 1,
    name: 'Regression Bug',
    field_format: 'bool',
    possible_values: ['0', '1'],
    trackers: [{ id: 6, name: 'Bug' }],
  },
  {
    id: 47,
    name: 'Checklist QA-TEST',
    field_format: 'list',
    possible_values: ['Yes', 'No'],
    trackers: [{ id: 5, name: 'Test' }],
  },
  {
    id: 29,
    name: 'DEV-Testing',
    field_format: 'string',
    trackers: [{ id: 8, name: 'Implement' }],
  },
  {
    id: 28,
    name: 'Checklist DEV-CODE',
    field_format: 'string',
    trackers: [{ id: 8, name: 'Implement' }],
  },
];

export function getStoredConfig(): RedmineConfig {
  const url = localStorage.getItem(STORAGE_KEY_URL) || DEFAULT_REDMINE_URL;
  const key = localStorage.getItem(STORAGE_KEY_API_KEY) || DEFAULT_REDMINE_KEY;
  return { baseUrl: url, apiKey: key };
}

export function saveStoredConfig(config: RedmineConfig): void {
  localStorage.setItem(STORAGE_KEY_URL, config.baseUrl);
  localStorage.setItem(STORAGE_KEY_API_KEY, config.apiKey);
}

export function getStoredGeminiKey(): string {
  return localStorage.getItem(STORAGE_KEY_GEMINI_KEY) || '';
}

export function saveStoredGeminiKey(key: string): void {
  localStorage.setItem(STORAGE_KEY_GEMINI_KEY, key);
}

export function getStoredOpenAIKey(): string {
  return localStorage.getItem(STORAGE_KEY_OPENAI_KEY) || '';
}

export function saveStoredOpenAIKey(key: string): void {
  localStorage.setItem(STORAGE_KEY_OPENAI_KEY, key);
}

export function getStoredAnthropicKey(): string {
  return localStorage.getItem(STORAGE_KEY_ANTHROPIC_KEY) || '';
}


const STORAGE_KEY_AUTH_TOKEN = 'redmine_pm_auth_token';

function safeGetStorage(type: 'local' | 'session'): Storage | null {
  try {
    if (typeof globalThis === 'undefined') return null;
    if (type === 'local') return globalThis.localStorage || null;
    if (type === 'session') return globalThis.sessionStorage || null;
  } catch { return null; }
  return null;
}

export function getAuthToken(): string {
  try {
    const local = safeGetStorage('local');
    const session = safeGetStorage('session');
    return local?.getItem(STORAGE_KEY_AUTH_TOKEN) || session?.getItem(STORAGE_KEY_AUTH_TOKEN) || '';
  } catch { return ''; }
}

export function setAuthToken(token: string, remember = true): void {
  try {
    const storage = safeGetStorage(remember ? 'local' : 'session');
    storage?.setItem(STORAGE_KEY_AUTH_TOKEN, token);
  } catch {}
}

export function clearAuthToken(): void {
  try {
    safeGetStorage('local')?.removeItem(STORAGE_KEY_AUTH_TOKEN);
    safeGetStorage('session')?.removeItem(STORAGE_KEY_AUTH_TOKEN);
  } catch {}
}

export async function checkAuthStatus(): Promise<boolean> {
  const token = getAuthToken();
  if (!token) return false;
  try {
    const res = await fetch('/api/auth/check', {
      headers: {
        Authorization: `Bearer ${token}`,
        'x-app-token': token,
      },
    });
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.authenticated;
  } catch {
    return false;
  }
}

export async function loginWithPassword(password: string, remember = true): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok || !data.ok) {
      return { ok: false, error: data.error || 'Mật khẩu không chính xác' };
    }
    setAuthToken(data.token, remember);
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || 'Không thể kết nối đến máy chủ' };
  }
}

export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch {}
  clearAuthToken();
}

export function saveStoredAnthropicKey(key: string): void {
  localStorage.setItem(STORAGE_KEY_ANTHROPIC_KEY, key);
}

function getHeaders(): HeadersInit {
  const cfg = getStoredConfig();
  const geminiKey = getStoredGeminiKey();
  const openAIKey = getStoredOpenAIKey();
  const anthropicKey = getStoredAnthropicKey();
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-redmine-url': cfg.baseUrl,
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['x-app-token'] = token;
  }
  if (cfg.apiKey) {
    headers['x-redmine-api-key'] = cfg.apiKey;
  }
  if (geminiKey) {
    headers['x-gemini-api-key'] = geminiKey;
  }
  if (openAIKey) headers['x-openai-api-key'] = openAIKey;
  if (anthropicKey) headers['x-anthropic-api-key'] = anthropicKey;
  return headers;
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
  subject?: string;
}

export async function getIssues(params: IssueFilterParams = {}): Promise<{ issues: RedmineIssue[]; total_count: number }> {
  const query = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== 'all') {
      query.set(k, String(v));
    }
  }

  const res = await fetch(`/api/redmine/issues?${query.toString()}`, { headers: getHeaders() });
  return readIssueListResponse(res);
}

export interface FetchProgress {
  loaded: number;
  total: number;
  isFinished: boolean;
}

async function fetchIssuesFromServer(
  params: IssueFilterParams = {},
  onProgress?: (progress: FetchProgress) => void,
  maxTotal: number = 3500,
  onBatch?: (issues: RedmineIssue[], total: number) => void
): Promise<{ issues: RedmineIssue[]; total_count: number }> {
  const firstPage = await getIssues({ ...params, limit: 100, offset: 0 });
  const total = firstPage.total_count;
  let allIssues: RedmineIssue[] = [...firstPage.issues];

  onProgress?.({
    loaded: allIssues.length,
    total,
    isFinished: allIssues.length >= total || allIssues.length >= maxTotal,
  });
  onBatch?.(allIssues, total);

  if (total <= 100 || allIssues.length >= maxTotal) {
    return { issues: allIssues.slice(0, maxTotal), total_count: total };
  }

  const targetCount = Math.min(total, maxTotal);
  const remainingOffsets: number[] = [];
  for (let offset = 100; offset < targetCount; offset += 100) {
    remainingOffsets.push(offset);
  }

  // Fetch in batches of 6
  const batchSize = 6;
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
    onBatch?.(allIssues.slice(0, targetCount), total);
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
  invalidateAfterMutation();
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
  invalidateAfterMutation();
}

export async function deleteIssue(id: number): Promise<void> {
  const res = await fetch(`/api/redmine/issues/${id}`, {
    method: 'DELETE',
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error('Không thể xóa công việc');
  invalidateAfterMutation();
}

export async function getStatuses(): Promise<RedmineStatus[]> {
  try {
    const res = await fetch('/api/redmine/statuses', { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.issue_statuses && data.issue_statuses.length > 0) {
        return data.issue_statuses;
      }
    }
  } catch (err) {
    console.warn('Cannot fetch statuses from API, using default Redmine statuses:', err);
  }
  return DEFAULT_REDMINE_STATUSES;
}

export async function getTrackers(): Promise<RedmineTracker[]> {
  try {
    const res = await fetch('/api/redmine/trackers', { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.trackers && data.trackers.length > 0) {
        return data.trackers;
      }
    }
  } catch (err) {
    console.warn('Cannot fetch trackers from API, using default Redmine trackers:', err);
  }
  return DEFAULT_REDMINE_TRACKERS;
}

export async function getPriorities(): Promise<RedminePriority[]> {
  try {
    const res = await fetch('/api/redmine/priorities', { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.issue_priorities && data.issue_priorities.length > 0) {
        return data.issue_priorities;
      }
    }
  } catch (err) {
    console.warn('Cannot fetch priorities from API, using default Redmine priorities:', err);
  }
  return DEFAULT_REDMINE_PRIORITIES;
}

export async function getCustomFields(): Promise<RedmineCustomField[]> {
  try {
    const res = await fetch('/api/redmine/custom_fields', { headers: getHeaders() });
    if (res.ok) {
      const data = await res.json();
      if (data.custom_fields && data.custom_fields.length > 0) {
        return data.custom_fields;
      }
    }
  } catch (err) {
    // 403 Forbidden is expected for regular users on Redmine
  }
  return DEFAULT_REDMINE_CUSTOM_FIELDS;
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

async function currentCacheScope() {
  const config = getStoredConfig();
  return cacheScope(config.baseUrl, config.apiKey);
}

export async function fetchAllIssues(params: IssueFilterParams = {}, onProgress?: (progress: FetchProgress) => void, maxTotal = 3500, options: IssueCacheOptions = {}) {
  const key = `${await currentCacheScope()}:issues:${issueQueryKey(params)}`;
  const previous = await readLocalCache<IssueSnapshot>(key);
  const incremental = Object.keys(params).every(k => ['project_id', 'status_id'].includes(k)) && params.status_id === '*';
  const snapshot = await loadIssueSnapshot(key, cacheRevision(), maxTotal, incremental,
    () => fetchIssuesFromServer(params, onProgress, previous?.complete ? Number.MAX_SAFE_INTEGER : maxTotal, options.onBatch),
    since => fetchIssuesFromServer({ ...params, updated_on: `>=${since}` }, undefined, Number.MAX_SAFE_INTEGER),
    async () => (await getIssues({ ...params, limit: 1 })).total_count, options);
  onProgress?.({ loaded: Math.min(snapshot.issues.length, maxTotal), total: snapshot.total_count, isFinished: true });
  return { issues: snapshot.issues.slice(0, maxTotal), total_count: snapshot.total_count, fetchedAt: snapshot.fetchedAt };
}

export async function fetchOTReport(projectId: string, from: string, to: string, options: { force?: boolean; onCached?: (records: OTRecord[], fetchedAt: number) => void } = {}) {
  const scope = await currentCacheScope();
  const reportKey = `${scope}:ot:${projectId}:${from}:${to}`;
  const revision = cacheRevision();
  const cached = await readLocalCache<{ records: OTRecord[]; fetchedAt: number; revision: string }>(reportKey);
  if (cached) {
    options.onCached?.(cached.records, cached.fetchedAt);
    if (!options.force && cached.revision === revision && Date.now() - cached.fetchedAt < 60000) return cached;
  }
  const params = { project_id: projectId === 'all' ? undefined : projectId, status_id: '*' };
  const fullSnapshot = await readLocalCache<IssueSnapshot>(`${scope}:issues:${issueQueryKey(params)}`);
  // A complete local issue snapshot already contains the OT subjects. Otherwise
  // ask Redmine for subject matches (hundreds of rows, not the full project).
  const [result, entries] = await Promise.all([
    fetchAllIssues(fullSnapshot?.complete ? params : { ...params, subject: '~OT' }, undefined, Number.MAX_SAFE_INTEGER, { force: options.force }),
    fetchReportTimeEntries(projectId, from, to, options.force),
  ]);
  const issues = new Map(result.issues.filter(i => isOTSubject(i.subject)).map(i => [i.id, i]));
  const records = entries.flatMap(entry => {
    const issue = entry.issue ? issues.get(entry.issue.id) : undefined;
    return issue ? [{ entry, issue }] : [];
  });
  const report = { records, fetchedAt: Date.now(), revision };
  await writeLocalCache(reportKey, report);
  return report;
}

// Reports must read every page, including entries attached to closed issues.
export async function fetchReportTimeEntries(projectId: string, from: string, to: string, force = false): Promise<RedmineTimeEntry[]> {
  const key = `${await currentCacheScope()}:time:${projectId}:${from}:${to}`;
  const revision = cacheRevision();
  const cached = await readLocalCache<{ entries: RedmineTimeEntry[]; fetchedAt: number; revision: string }>(key);
  if (!force && cached?.revision === revision && Date.now() - cached.fetchedAt < 60000) return cached.entries;
  const entries = new Map<number, RedmineTimeEntry>();
  let offset = 0;
  while (true) {
    const query = new URLSearchParams({ limit: '100', offset: String(offset), from, to, sort: 'id:asc' });
    if (projectId !== 'all') query.set('project_id', projectId);
    const res = await fetch(`/api/redmine/time_entries?${query}`, { headers: getHeaders() });
    if (!res.ok) throw new Error('Không thể tải đầy đủ nhật ký giờ công từ Redmine');
    const data = await res.json();
    const page: RedmineTimeEntry[] = data.time_entries || [];
    for (const entry of page) entries.set(entry.id, entry);
    offset += page.length;
    if (offset >= data.total_count) break;
    if (!page.length) throw new Error('Redmine trả về dữ liệu giờ công chưa đầy đủ. Hãy tải lại.');
  }
  const result = [...entries.values()];
  await writeLocalCache(key, { entries: result, fetchedAt: Date.now(), revision });
  return result;
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
  invalidateAfterMutation();
}

export interface AIModelOption {
  id: string;
  name: string;
  description: string;
  badge?: string;
  isDefault?: boolean;
}

export type AIProvider = 'gemini' | 'openai' | 'codex' | 'anthropic';

export const AVAILABLE_AI_MODELS: AIModelOption[] = [
  { id: 'gemini-3.8-flash', name: 'Gemini 3.8 Flash', description: 'Model Flash mới nhất cho phân tích phức tạp', badge: 'Mới nhất' },
  { id: 'gemini-3.7-flash', name: 'Gemini 3.7 Flash', description: 'Model Flash ổn định cho quy trình nhiều bước' },
  { id: 'gemini-3.6-flash', name: 'Gemini 3.6 Flash', description: 'Cân bằng tốc độ và khả năng phân tích' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', description: 'Model Flash ổn định cho công việc hằng ngày' },
  { id: 'gemini-3.5-flash-lite', name: 'Gemini 3.5 Flash-Lite', description: 'Nhanh và tiết kiệm cho dữ liệu lớn' },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', description: 'Phân tích chuyên sâu; model preview', badge: 'Chuyên sâu' },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Khuyên dùng - Phản hồi siêu nhanh, thông minh & tối ưu nhất cho báo cáo PM',
    badge: 'Khuyên dùng',
    isDefault: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    description: 'Model nhẹ cho báo cáo ngắn',
    badge: 'Tốc độ cao',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    description: 'Model Flash-Lite thế hệ mới',
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    description: 'Mô hình tư duy chuyên sâu, phân tích rủi ro toàn diện',
    badge: 'Chuyên sâu',
  },
];

export const FALLBACK_AI_MODELS: Record<AIProvider, AIModelOption[]> = {
  gemini: AVAILABLE_AI_MODELS,
  openai: [
    { id: 'gpt-6-astra', name: 'GPT-6 Astra', description: 'Model OpenAI mạnh nhất', isDefault: true },
    { id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', description: 'Cân bằng chất lượng và chi phí' },
    { id: 'gpt-5.6-luna', name: 'GPT-5.6 Luna', description: 'Nhanh và tiết kiệm' },
    { id: 'gpt-5.2', name: 'GPT-5.2', description: 'Model OpenAI đa dụng' },
    { id: 'gpt-4.1', name: 'GPT-4.1', description: 'Model ổn định với ngữ cảnh dài' },
  ],
  codex: [
    { id: 'gpt-5.3-codex', name: 'GPT-5.3 Codex', description: 'Model Codex mới cho tác vụ coding dài', isDefault: true },
    { id: 'gpt-5.2-codex', name: 'GPT-5.2 Codex', description: 'Model Codex cho coding agent' },
    { id: 'gpt-5.1-codex-max', name: 'GPT-5.1 Codex Max', description: 'Model Codex cho tác vụ chạy dài' },
    { id: 'gpt-5.1-codex', name: 'GPT-5.1 Codex', description: 'Model Codex chuyên coding' },
  ],
  anthropic: [
    { id: 'claude-sonnet-5', name: 'Claude Sonnet 5', description: 'Model Claude cân bằng', isDefault: true },
    { id: 'claude-opus-5', name: 'Claude Opus 5', description: 'Model Claude chuyên sâu' },
    { id: 'claude-fable-5', name: 'Claude Fable 5', description: 'Model Claude thế hệ mới' },
    { id: 'claude-sonnet-4-6', name: 'Claude Sonnet 4.6', description: 'Model Claude ổn định' },
    { id: 'claude-opus-4-8', name: 'Claude Opus 4.8', description: 'Model Claude chuyên sâu' },
    { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', description: 'Model Claude nhanh và tiết kiệm' },
  ],
};

export async function getAvailableAIModels(provider: AIProvider = 'gemini'): Promise<AIModelOption[]> {
  const url = provider === 'gemini' ? '/api/gemini/models' : `/api/ai/models?provider=${provider}`;
  const res = await fetch(url, { headers: getHeaders() });
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { /* A stale deployment can return the SPA HTML shell. */ }
  if (!res.ok) {
    throw new Error(data?.error || 'Không thể tải danh sách model theo API Key');
  }
  const models = (Array.isArray(data?.models) ? data.models : []).map((item: any) => ({
    id: String(item.id), name: String(item.name || item.id), description: String(item.description || ''),
  })).filter((item: AIModelOption) => item.id);
  if (!models.length) throw new Error('Máy chủ chưa trả về danh sách model AI. Hãy thử lại sau khi bản mới được triển khai.');
  return models;
}

export interface GeminiPMResponse {
  result: string;
  usedModel?: string;
  requestedModel?: string;
  fallbackOccurred?: boolean;
}

export type AIPMResponse = GeminiPMResponse;

export async function askAIChat(provider: AIProvider, messages: ChatMessage[], projectName: string, issues: RedmineIssue[], statuses: RedmineStatus[], totalAvailable: number, model: string, scope: ChatScope = {}): Promise<AIPMResponse> {
  const payload = { ...buildAIChatPayload(messages, projectName, issues, statuses, totalAvailable, model, scope), provider };
  const url = provider === 'gemini' ? '/api/gemini/pm-insights' : '/api/ai/chat';
  const res = await fetch(url, { method: 'POST', headers: getHeaders(), body: JSON.stringify(payload) });
  return readAIReportResponse(res);
}

export async function askGeminiChat(messages: ChatMessage[], projectName: string, issues: RedmineIssue[], statuses: RedmineStatus[], totalAvailable: number, model: string, scope: ChatScope = {}): Promise<GeminiPMResponse> {
  return askAIChat('gemini', messages, projectName, issues, statuses, totalAvailable, model, scope);
}

export async function askGeminiPM(
  mode: 'standup' | 'risk' | 'general',
  projectName: string,
  issues: RedmineIssue[],
  statistics: any,
  model?: string
): Promise<GeminiPMResponse> {
  const headers = getHeaders();
  const res = await fetch('/api/gemini/pm-insights', {
    method: 'POST',
    headers,
    body: JSON.stringify(buildAIReportPayload(mode, projectName, issues, statistics, model)),
  });
  const data = await readAIReportResponse(res);
  return {
    result: data.result || '',
    usedModel: data.usedModel,
    requestedModel: data.requestedModel,
    fallbackOccurred: data.fallbackOccurred,
  };
}
