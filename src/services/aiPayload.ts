import type { RedmineIssue } from '../types/redmine';

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
