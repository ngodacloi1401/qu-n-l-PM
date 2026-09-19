import type { RedmineTimeEntry } from '../types/redmine';

export async function createTimeEntriesWorkbook(entries: RedmineTimeEntry[], meta: { project: string; from: string; to: string }) {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  const detail = workbook.addWorksheet('Nhật ký giờ làm');
  detail.addRow(['Từ ngày', meta.from, 'Đến ngày', meta.to, 'Dự án', meta.project]);
  detail.addRow(['ID log', 'Ngày', 'Thành viên', 'Dự án', 'Issue', 'Hoạt động', 'Số giờ', 'Ghi chú']);
  for (const e of entries) detail.addRow([e.id, new Date(`${e.spent_on}T00:00:00`), e.user?.name, e.project?.name, e.issue?.id || '', e.activity?.name, Number(e.hours), e.comments || '']);
  detail.getColumn(2).numFmt = 'dd/mm/yyyy'; detail.getColumn(7).numFmt = '0.00'; detail.columns.forEach(c => { c.width = 18; });
  detail.views = [{ state: 'frozen', ySplit: 2 }]; detail.autoFilter = { from: 'A2', to: 'H2' };
  const summary = workbook.addWorksheet('Tổng hợp');
  const byUser = new Map<number, { name: string; hours: number; logs: number }>();
  for (const e of entries) { const row = byUser.get(e.user.id) || { name: e.user.name, hours: 0, logs: 0 }; row.hours += Number(e.hours); row.logs++; byUser.set(e.user.id, row); }
  summary.addRow(['Thành viên', 'Tổng giờ', 'Lượt log']); [...byUser.values()].sort((a, b) => b.hours - a.hours).forEach(r => summary.addRow([r.name, r.hours, r.logs]));
  summary.getColumn(1).width = 28; summary.getColumn(2).width = 14; summary.getColumn(2).numFmt = '0.00'; summary.getColumn(3).width = 12;
  summary.views = [{ state: 'frozen', ySplit: 1 }]; summary.autoFilter = { from: 'A1', to: 'C1' };
  return workbook;
}

export async function downloadTimeEntriesExcel(entries: RedmineTimeEntry[], meta: { project: string; from: string; to: string }) {
  const workbook = await createTimeEntriesWorkbook(entries, meta);
  const bytes = await workbook.xlsx.writeBuffer(); const blob = new Blob([bytes as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `nhat-ky-gio-lam-${meta.from}-${meta.to}.xlsx`; document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
