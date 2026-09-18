import type { RedmineIssue, RedmineTimeEntry } from '../types/redmine';

export const isOTSubject = (subject: string) => /(^|[^a-z0-9])OT([^a-z0-9]|$)/i.test(subject);
export interface OTRecord { entry: RedmineTimeEntry; issue: RedmineIssue }
export interface OTSummary { userId: number; user: string; projectId: number; project: string; trackerId: number; tracker: string; hours: number; logs: number; issues: number }

export function summarizeOT(records: OTRecord[]): OTSummary[] {
  const groups = new Map<string, OTSummary & { ids: Set<number> }>();
  for (const { entry, issue } of records) {
    const key = `${entry.user.id}:${entry.project.id}:${issue.tracker.id}`;
    let group = groups.get(key);
    if (!group) {
      group = { userId: entry.user.id, user: entry.user.name, projectId: entry.project.id, project: entry.project.name, trackerId: issue.tracker.id, tracker: issue.tracker.name, hours: 0, logs: 0, issues: 0, ids: new Set() };
      groups.set(key, group);
    }
    if (!Number.isFinite(Number(entry.hours)) || Number(entry.hours) < 0) throw new Error(`Giờ công không hợp lệ tại log #${entry.id}`);
    group.hours += Number(entry.hours);
    group.logs++;
    group.ids.add(issue.id);
    group.issues = group.ids.size;
  }
  return [...groups.values()].map(({ ids, ...group }) => group).sort((a, b) => b.hours - a.hours || a.user.localeCompare(b.user));
}

// Import ExcelJS only when exporting, so the normal workspace stays lightweight.
export async function createOTWorkbook(records: OTRecord[], summary: OTSummary[], context: { from: string; to: string; project: string; baseUrl: string }) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Redmine PM';
  workbook.created = new Date();
  const overview = workbook.addWorksheet('Tong hop OT');
  overview.addRow(['TỔNG HỢP OT']);
  overview.addRow(['Từ ngày', new Date(`${context.from}T00:00:00Z`), 'Đến ngày', new Date(`${context.to}T00:00:00Z`)]);
  overview.getCell('B2').numFmt = overview.getCell('D2').numFmt = 'dd/mm/yyyy';
  overview.addRow(['Dự án', context.project]);
  overview.addRow(['Quy tắc', 'Giờ log của issue có từ OT trong subject, không phân biệt hoa/thường.']);
  overview.addRow(['Tổng giờ OT', { formula: `SUM(E8:E${Math.max(8, summary.length + 7)})`, result: summary.reduce((n, r) => n + r.hours, 0) }]);
  overview.getCell('B5').numFmt = '0.00';
  overview.addRow([]);
  overview.addRow(['Thành viên', 'ID thành viên', 'Dự án', 'Tracker', 'Giờ OT', 'Lượt log', 'Issue OT']);
  summary.forEach(r => overview.addRow([r.user, r.userId, r.project, r.tracker, r.hours, r.logs, r.issues]));
  const detail = workbook.addWorksheet('Chi tiet OT');
  detail.addRow(['Ngày', 'Thành viên', 'ID thành viên', 'Dự án', 'Tracker', 'Issue ID', 'Subject', 'Giờ OT', 'Hoạt động', 'Ghi chú', 'Log ID', 'Nguồn']);
  for (const { entry: e, issue: i } of records) {
    const url = `${context.baseUrl.replace(/\/+$/, '')}/issues/${i.id}`;
    detail.addRow([new Date(`${e.spent_on}T00:00:00Z`), e.user.name, e.user.id, e.project.name, i.tracker.name, i.id, i.subject, Number(e.hours), e.activity?.name || '', e.comments || '', e.id, { text: url, hyperlink: url }]);
  }
  detail.getColumn(1).numFmt = 'dd/mm/yyyy';
  detail.getColumn(8).numFmt = '0.00';
  overview.getColumn(5).numFmt = '0.00';
  for (const [sheet, header, widths] of [[overview, 7, [28, 18, 30, 28, 14, 14, 14]], [detail, 1, [14, 28, 18, 30, 28, 12, 60, 14, 26, 60, 12, 48]]] as const) {
    widths.forEach((w, index) => { sheet.getColumn(index + 1).width = w; });
    sheet.views = [{ state: 'frozen', ySplit: header, showGridLines: false }];
    sheet.autoFilter = { from: { row: header, column: 1 }, to: { row: Math.max(header, sheet.rowCount), column: widths.length } };
    sheet.eachRow((row, rowNumber) => {
      row.font = { name: 'Arial', size: 10 };
      row.alignment = { vertical: 'middle', wrapText: rowNumber > header };
      if (rowNumber === header) {
        row.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
        row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF334155' } };
        row.height = 30;
      }
    });
  }
  overview.getCell('A1').font = { name: 'Arial', size: 14, bold: true };
  overview.getColumn(2).width = 76;
  return workbook;
}

export async function downloadOTExcel(records: OTRecord[], summary: OTSummary[], context: Parameters<typeof createOTWorkbook>[2]) {
  const workbook = await createOTWorkbook(records, summary, context);
  const buffer = await workbook.xlsx.writeBuffer();
  const url = URL.createObjectURL(new Blob([new Uint8Array(buffer)], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `OT_${context.from}_${context.to}.xlsx`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
