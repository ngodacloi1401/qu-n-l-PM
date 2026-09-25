import type { RedmineIssue } from '../types/redmine';
import type { RedmineStatus } from '../types/redmine';
import { calculatePMAnalytics, vietnamToday } from './pmAnalytics';

export type ChatArtifactKind = 'docx' | 'xlsx' | 'csv' | 'md' | 'txt' | 'json';
export interface ChatArtifact {
  id: string;
  name: string;
  kind: ChatArtifactKind;
  title?: string;
  content: string;
}
export interface ChatMessage { role: 'user' | 'assistant'; text: string; model?: string; artifacts?: ChatArtifact[] }
export interface ChatScope { loadedCount?: number; availableModels?: string[] }
export function detectRequestedArtifactKind(text: string): ChatArtifactKind | null {
  const normalized = text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd');
  const asksForFile = /\b(tao|xuat|lam|soan|tai|generate|export)\b/.test(normalized);
  if (!asksForFile) return null;
  if (/\b(xlsx|excel|bang tinh)\b/.test(normalized)) return 'xlsx';
  if (/\bcsv\b/.test(normalized)) return 'csv';
  if (/\bjson\b/.test(normalized)) return 'json';
  if (/\b(markdown|\.md)\b/.test(normalized)) return 'md';
  if (/\b(txt|van ban)\b/.test(normalized)) return 'txt';
  if (/\b(docx|word|google docs?|gg docs?|file|tep)\b/.test(normalized)) return 'docx';
  return null;
}
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
  const requestedArtifact = detectRequestedArtifactKind(messages.at(-1)?.text || '');
  if (requestedArtifact && history.at(-1)?.role === 'user') {
    history[history.length - 1].text += `\n\n[Yêu cầu xử lý tệp của ứng dụng: Hãy soạn đầy đủ nội dung và xuất artifact kind=${requestedArtifact} theo đúng định dạng <pm_artifacts> trong system instruction. Ứng dụng sẽ tự tạo tệp và nút tải xuống; không được từ chối vì không có quyền truy cập ổ đĩa hoặc Google Drive.]`;
  }
  const breakdown = (select: (issue: RedmineIssue) => { id: number; name: string } | undefined) => {
    const rows = new Map<number, { id: number; name: string; count: number }>();
    issues.forEach(i => { const v = select(i); if (!v) return; const row = rows.get(v.id) ?? { id: v.id, name: v.name.slice(0, 80), count: 0 }; row.count++; rows.set(v.id, row); });
    return [...rows.values()];
  };
  const loadedCount = scope.loadedCount ?? issues.length;
  const compactRows = (subjectLength: number) => issues.map(i => [
    i.id, i.subject.slice(0, subjectLength), i.project?.id ?? null, i.tracker?.id ?? null, i.status?.id ?? null,
    i.priority?.id ?? null, i.assigned_to?.id ?? null, i.done_ratio ?? 0, i.start_date ?? '', i.due_date ?? '',
    i.estimated_hours ?? null, i.spent_hours ?? null, i.updated_on?.slice(0, 10) ?? '',
  ]);
  const context = {
    today: vietnamToday(), loadedCount, totalAvailable, allIssueCount: issues.length,
    availableModels: (scope.availableModels || []).slice(0, 100),
    detailedIssueCount: bounded.issues.length, isComplete: loadedCount === totalAvailable && issues.length === totalAvailable,
    issueSchema: ['id', 'subject', 'projectId', 'trackerId', 'statusId', 'priorityId', 'assigneeId', 'doneRatio', 'startDate', 'dueDate', 'estimatedHours', 'spentHours', 'updatedDate'],
    allIssues: compactRows(160),
    statuses: breakdown(i => i.status).map(row => ({ ...row, is_closed: statuses.find(s => s.id === row.id)?.is_closed })),
    trackers: breakdown(i => i.tracker), priorities: breakdown(i => i.priority), projects: breakdown(i => i.project),
    workload: stats.workloadAll.map(row => ({ ...row, name: row.name.slice(0, 80) })),
  };
  const payload = { ...bounded, mode: 'chat', messages: history, context };
  const bytes = () => new TextEncoder().encode(JSON.stringify(payload)).byteLength;
  if (bytes() > 3_300_000) context.allIssues = compactRows(80);
  if (bytes() > 3_300_000) context.allIssues = compactRows(0);
  while (history.length > 1 && bytes() > 3_600_000) {
    history.shift(); while (history.at(0)?.role === 'assistant') history.shift();
  }
  if (bytes() > 3_800_000) throw new Error('Dữ liệu dự án vượt giới hạn gửi AI. Hãy chọn một dự án cụ thể thay vì Tất cả dự án.');
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
