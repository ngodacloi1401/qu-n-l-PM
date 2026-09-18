import type { RedmineIssue } from '../types/redmine';
import type { RedmineStatus } from '../types/redmine';
import { calculatePMAnalytics, vietnamToday } from './pmAnalytics';

export interface ChatMessage { role: 'user' | 'assistant'; text: string; model?: string }
export interface ChatScope { loadedCount?: number; filters?: Record<string, string | number | boolean> }
export function buildAIChatPayload(messages: ChatMessage[], projectName: string, issues: RedmineIssue[], statuses: RedmineStatus[], totalAvailable: number, model: string, scope: ChatScope = {}) {
  const latest = messages.at(-1)?.text.toLowerCase() ?? '';
  const references = messages.slice(-8).map(m => m.text).join('\n');
  const ids = new Set([...references.matchAll(/#?(\d{3,})/g)].map(m => Number(m[1])));
  const stats = calculatePMAnalytics(issues, statuses);
  const important = new Set([...stats.overdueIssues, ...stats.blockedIssues].map(i => i.id));
  const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const query = normalize(latest);
  const memberMatch = (i: RedmineIssue) => !!i.assigned_to?.name && query.includes(normalize(i.assigned_to.name));
  const sample = [...issues].sort((a, b) => Number(ids.has(b.id)) - Number(ids.has(a.id)) || Number(memberMatch(b)) - Number(memberMatch(a)) || Number(important.has(b.id)) - Number(important.has(a.id)));
  const bounded = buildAIReportPayload('risk', projectName, sample, { totalIssues: stats.total, closedCount: stats.closed, inProgressCount: stats.inProgress, overdueCount: stats.overdueIssues.length, blockedCount: stats.blockedIssues.length }, model);
  const history = messages.slice(-24).map(m => ({ role: m.role, text: m.text.slice(0, 8000) }));
  while (history.at(0)?.role === 'assistant') history.shift();
  const breakdown = (select: (issue: RedmineIssue) => { id: number; name: string }) => {
    const rows = new Map<number, { id: number; name: string; count: number }>();
    issues.forEach(i => { const v = select(i); const row = rows.get(v.id) ?? { id: v.id, name: v.name.slice(0, 80), count: 0 }; row.count++; rows.set(v.id, row); });
    return [...rows.values()].slice(0, 100);
  };
  const loadedCount = scope.loadedCount ?? issues.length;
  const filters = Object.fromEntries(Object.entries(scope.filters || {}).map(([k, v]) => [k, typeof v === 'string' ? v.slice(0, 200) : v]));
  const payload = { ...bounded, mode: 'chat', messages: history, context: { today: vietnamToday(), loadedCount, displayedCount: issues.length, filters, totalAvailable, sampleCount: bounded.issues.length, isComplete: loadedCount === totalAvailable,
    statuses: breakdown(i => i.status).map(row => ({ ...row, is_closed: statuses.find(s => s.id === row.id)?.is_closed })), trackers: breakdown(i => i.tracker), workload: stats.workloadAll.slice(0, 100).map(row => ({ ...row, name: row.name.slice(0, 80) })) } };
  while (history.length > 1 && new TextEncoder().encode(JSON.stringify(payload)).byteLength > 200000) {
    history.shift(); while (history.at(0)?.role === 'assistant') history.shift();
  }
  return payload;
}

// Keep the request small before it crosses Express / hosting body limits.
// Overall counts still describe all loaded issues; only detail is sampled.
export function buildAIReportPayload(mode: 'standup' | 'risk' | 'general', projectName: string, issues: RedmineIssue[], statistics: any, model?: string) {
  const limit = mode === 'risk' ? 35 : mode === 'standup' ? 30 : 20;
  const named = (value: { id: number; name: string } | undefined) => value ? { id: value.id, name: value.name.slice(0, 80) } : undefined;
  const stats: Record<string, number | string> = {};
  for (const key of ['totalIssues', 'inProgressCount', 'closedCount', 'overdueCount', 'blockedCount']) {
    if (Number.isFinite(statistics?.[key])) stats[key] = statistics[key];
  }
  if (typeof statistics?.userNoteForAI === 'string') stats.userNoteForAI = statistics.userNoteForAI.slice(0, 1000);
  return {
    mode, projectName: projectName.slice(0, 200), model: model?.slice(0, 100), statistics: stats,
    issues: issues.slice(0, limit).map(i => ({
      id: i.id, subject: i.subject.slice(0, 200), description: i.description?.slice(0, 300),
      project: named(i.project), tracker: named(i.tracker), status: named(i.status), priority: named(i.priority), assigned_to: named(i.assigned_to),
      done_ratio: i.done_ratio, start_date: i.start_date, due_date: i.due_date, estimated_hours: i.estimated_hours, spent_hours: i.spent_hours,
    })),
  };
}

export async function readAIReportResponse(res: Response) {
  const text = await res.text();
  let data: any;
  try { data = JSON.parse(text); } catch { /* Hosting and body-parser errors can be HTML/plain text. */ }
  if (!res.ok) {
    if (typeof data?.error === 'string') throw new Error(data.error);
    const messages: Record<number, string> = {
      413: 'Dữ liệu báo cáo vượt giới hạn máy chủ (HTTP 413). Hãy tải lại trang để dùng phiên bản mới.',
      401: 'Gemini API Key không hợp lệ (HTTP 401). Kiểm tra khóa trong Cài đặt.',
      403: 'Gemini API Key không có quyền sử dụng model (HTTP 403). Kiểm tra quyền của khóa.',
      429: 'Gemini đã hết quota hoặc vượt giới hạn lượt gọi (HTTP 429). Kiểm tra quota trong Google AI Studio và thử lại sau.',
      502: 'Máy chủ AI chưa phản hồi được (HTTP 502). Hãy thử lại sau.',
      503: 'Dịch vụ AI tạm thời không khả dụng (HTTP 503). Hãy thử lại sau.',
      504: 'Tạo báo cáo AI vượt thời gian chờ (HTTP 504). Hãy thử lại hoặc chọn model nhanh hơn.',
    };
    throw new Error(messages[res.status] || `API báo cáo AI gặp lỗi HTTP ${res.status}. Hãy thử lại sau.`);
  }
  if (typeof data?.result !== 'string' || !data.result.trim()) throw new Error('API không trả về nội dung báo cáo AI hợp lệ. Kiểm tra bản triển khai máy chủ.');
  return data;
}
