import type { PersonalTask, ExcelColumnMapping, ExcelParsedSheet } from '../types/personalTask';

// Normalize text for flexible column matching
function normalizeHeader(str: string): string {
  return (str || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Auto-detect column indices based on header names.
 */
export function autoDetectMapping(headers: string[]): ExcelColumnMapping {
  const mapping: ExcelColumnMapping = {
    projectCol: -1,
    weekCol: -1,
    assignedDateCol: -1,
    categoryCol: -1,
    titleCol: -1,
    descriptionCol: -1,
    priorityCol: -1,
    estimatedHoursCol: -1,
    statusCol: -1,
    resultNoteCol: -1,
    dueDateCol: -1,
    delayReasonCol: -1,
    trackerCol: -1,
    parentTaskCol: -1,
    doneRatioCol: -1,
  };

  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (!norm) return;

    if (mapping.projectCol === -1 && (norm.includes('duan') || norm.includes('project'))) {
      mapping.projectCol = idx;
    }
    if (mapping.weekCol === -1 && (norm.includes('tuan') || norm.includes('week'))) {
      mapping.weekCol = idx;
    } else if (
      mapping.assignedDateCol === -1 &&
      (norm.includes('ngaygiao') || norm.includes('ngaybatdau') || norm.includes('startdate') || norm.includes('ngaytao'))
    ) {
      mapping.assignedDateCol = idx;
    } else if (
      mapping.trackerCol === -1 &&
      (norm.includes('tracker') || norm.includes('loaiviec') || norm.includes('loaicongviec'))
    ) {
      mapping.trackerCol = idx;
    } else if (
      mapping.categoryCol === -1 &&
      (norm.includes('nhomviec') || norm.includes('nhom') || norm.includes('category') || norm.includes('duan') || norm.includes('project'))
    ) {
      mapping.categoryCol = idx;
    } else if (
      mapping.titleCol === -1 &&
      (norm.includes('tenviec') || norm.includes('tencongviec') || norm.includes('congviec') || norm.includes('noidung') || norm.includes('subject') || norm.includes('task') || norm.includes('tieude'))
    ) {
      mapping.titleCol = idx;
    } else if (
      mapping.descriptionCol === -1 &&
      (norm.includes('mota') || norm.includes('chitiet') || norm.includes('description') || norm.includes('noidungchitiet'))
    ) {
      mapping.descriptionCol = idx;
    } else if (
      mapping.priorityCol === -1 &&
      (norm.includes('uutien') || norm.includes('priority') || norm.includes('mucdo') || norm.includes('dokhan'))
    ) {
      mapping.priorityCol = idx;
    } else if (
      mapping.estimatedHoursCol === -1 &&
      (norm.includes('thoiluong') || norm.includes('gio') || norm.includes('hours') || norm.includes('estimate') || norm.includes('thoigian'))
    ) {
      mapping.estimatedHoursCol = idx;
    } else if (
      mapping.statusCol === -1 &&
      (norm.includes('trangthai') || norm.includes('status') || norm.includes('tinhtrang') || norm.includes('tiendo'))
    ) {
      mapping.statusCol = idx;
    } else if (
      mapping.resultNoteCol === -1 &&
      (norm.includes('ketqua') || norm.includes('ghichu') || norm.includes('ketquacongviec') || norm.includes('result') || norm.includes('note') || norm.includes('danhgia'))
    ) {
      mapping.resultNoteCol = idx;
    } else if (
      mapping.dueDateCol === -1 &&
      (norm.includes('deadline') || norm.includes('hanchot') || norm.includes('ngayhet') || norm.includes('duedate') || norm.includes('ngayhoanthanh') || norm.includes('han'))
    ) {
      mapping.dueDateCol = idx;
    } else if (
      mapping.delayReasonCol === -1 &&
      (norm.includes('lydo') || norm.includes('trehan') || norm.includes('nguyennhan') || norm.includes('delay'))
    ) {
      mapping.delayReasonCol = idx;
    } else if (
      mapping.parentTaskCol === -1 &&
      (norm.includes('parent') || norm.includes('taskcha') || norm.includes('parenttask'))
    ) {
      mapping.parentTaskCol = idx;
    } else if (
      mapping.doneRatioCol === -1 &&
      (norm.includes('done') || norm.includes('phantram') || norm.includes('progress'))
    ) {
      mapping.doneRatioCol = idx;
    }
  });

  return mapping;
}

/**
 * Parse an Excel File (Buffer / ArrayBuffer) using ExcelJS.
 */
export async function parseExcelWorkbook(fileBuffer: ArrayBuffer): Promise<ExcelParsedSheet[]> {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();

  // ExcelJS can fail with certain ArrayBuffer sources (Google Sheets, WPS).
  // Try multiple buffer representations as fallback.
  let loaded = false;
  const attempts: Array<{ data: any; label: string }> = [
    { data: fileBuffer, label: 'ArrayBuffer' },
    { data: new Uint8Array(fileBuffer), label: 'Uint8Array' },
  ];

  let lastError: any = null;
  for (const attempt of attempts) {
    try {
      await workbook.xlsx.load(attempt.data as any);
      loaded = true;
      break;
    } catch (err: any) {
      lastError = err;
      console.warn(`ExcelJS load failed with ${attempt.label}:`, err?.message || err);
    }
  }

  if (!loaded) {
    const msg = lastError?.message || String(lastError);
    if (msg.includes('sheets') || msg.includes('undefined') || msg.includes('Cannot read')) {
      throw new Error(
        'Không thể đọc file Excel. File có thể ở định dạng không tương thích (.xls cũ, hoặc xuất từ Google Sheets/WPS). ' +
        'Hãy mở file bằng Microsoft Excel rồi "Save As" lại dạng .xlsx, sau đó thử import lại.'
      );
    }
    throw new Error(`Lỗi khi đọc file Excel: ${msg}`);
  }

  if (!workbook.worksheets || workbook.worksheets.length === 0) {
    throw new Error('File Excel không chứa sheet nào hoặc định dạng không hợp lệ. Vui lòng dùng file .xlsx chuẩn.');
  }

  const sheets: ExcelParsedSheet[] = [];

  workbook.eachSheet((worksheet) => {
    let headerRowIndex = 1;
    let foundHeaders: string[] = [];

    // Scan first 10 rows to detect the most probable header row
    for (let r = 1; r <= Math.min(10, worksheet.rowCount); r++) {
      const row = worksheet.getRow(r);
      const cells: string[] = [];
      let nonEmptyCount = 0;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const val = cell.value ? String(cell.value).trim() : '';
        cells[colNumber - 1] = val;
        if (val) nonEmptyCount++;
      });

      const rowText = cells.join(' ').toLowerCase();
      if (
        nonEmptyCount >= 3 &&
        (rowText.includes('việc') ||
          rowText.includes('tên') ||
          rowText.includes('tuần') ||
          rowText.includes('trạng thái') ||
          rowText.includes('deadline') ||
          rowText.includes('task') ||
          rowText.includes('status') ||
          rowText.includes('priority'))
      ) {
        headerRowIndex = r;
        foundHeaders = cells;
        break;
      }
    }

    if (foundHeaders.length === 0 && worksheet.rowCount > 0) {
      headerRowIndex = 1;
      const row = worksheet.getRow(1);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        foundHeaders[colNumber - 1] = cell.value ? String(cell.value).trim() : `Cột ${colNumber}`;
      });
    }

    while (foundHeaders.length > 0 && !foundHeaders[foundHeaders.length - 1]) {
      foundHeaders.pop();
    }

    const rows: (string | number | null)[][] = [];
    for (let r = headerRowIndex + 1; r <= worksheet.rowCount; r++) {
      const row = worksheet.getRow(r);
      const rowValues: (string | number | null)[] = [];
      let hasData = false;

      for (let c = 0; c < foundHeaders.length; c++) {
        const cell = row.getCell(c + 1);
        let val: any = cell.value;
        if (val && typeof val === 'object') {
          if (val instanceof Date) {
            val = val.toISOString().split('T')[0];
          } else if (val.text) {
            val = val.text;
          } else if (val.result !== undefined) {
            val = val.result;
          } else {
            val = String(val);
          }
        }
        if (val !== null && val !== undefined && String(val).trim() !== '') {
          hasData = true;
          rowValues[c] = typeof val === 'number' ? val : String(val).trim();
        } else {
          rowValues[c] = '';
        }
      }

      if (hasData) {
        rows.push(rowValues);
      }
    }

    sheets.push({
      name: worksheet.name,
      headers: foundHeaders,
      rows,
      totalRows: rows.length,
    });
  });

  return sheets;
}

// Map Excel priority text to Redmine Priority Name
function parseRedminePriority(val: any): string {
  const str = String(val || '').toLowerCase().trim();
  if (str.includes('urgent') || str.includes('gấp') || str.includes('khẩn') || str.includes('p1') || str.includes('immediate')) return 'Urgent';
  if (str.includes('must have') || str.includes('must')) return 'Must Have';
  if (str.includes('should have') || str.includes('should')) return 'Should Have';
  if (str.includes('could have') || str.includes('could')) return 'Could Have';
  if (str.includes('won\'t have') || str.includes('wont have')) return "Won't Have";
  if (str.includes('cao') || str.includes('high') || str.includes('p2')) return 'High';
  if (str.includes('thấp') || str.includes('low') || str.includes('p4')) return 'Low';
  return 'Normal';
}

// Map Excel status text to Redmine Status Name
function parseRedmineStatus(val: any): string {
  const str = String(val || '').toLowerCase().trim();
  if (str.includes('closed') || str.includes('đóng') || str.includes('hoàn thành') || str.includes('done') || str.includes('xong')) return 'Closed';
  if (str.includes('resolved') || str.includes('đã giải quyết')) return 'Resolved';
  if (str.includes('qa testing') || str.includes('testing') || str.includes('test')) return 'QA testing';
  if (str.includes('qa verified') || str.includes('verified')) return 'QA Verified';
  if (str.includes('ready for qa') || str.includes('ready')) return 'Ready For QA';
  if (str.includes('feedback') || str.includes('phản hồi') || str.includes('review') || str.includes('chờ review')) return 'Feedback';
  if (str.includes('in progress') || str.includes('đang làm') || str.includes('doing') || str.includes('tiến hành')) return 'In Progress';
  if (str.includes('pending') || str.includes('tạm hoãn') || str.includes('hoãn')) return 'Pending';
  return 'New';
}

function formatDateString(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

/**
 * Convert sheet rows into PersonalTask[] with Redmine-aligned schema.
 */
export function convertRowsToTasks(
  rows: (string | number | null)[][],
  mapping: ExcelColumnMapping,
  defaultWeek: string = ''
): PersonalTask[] {
  const nowStr = new Date().toISOString();

  return rows
    .map((row, idx) => {
      const getVal = (col?: number) => (col !== undefined && col >= 0 && col < row.length ? String(row[col] ?? '').trim() : '');

      const title = getVal(mapping.titleCol);
      if (!title) return null;

      const week = getVal(mapping.weekCol) || defaultWeek || '';
      const assignedDate = formatDateString(getVal(mapping.assignedDateCol));
      const trackerName = getVal(mapping.trackerCol) || 'Task';
      const rawProject = getVal(mapping.projectCol);
      const category = getVal(mapping.categoryCol) || rawProject || 'Chung';
      const projectName = rawProject || (category !== 'Chung' ? category : undefined);
      const description = getVal(mapping.descriptionCol);
      const priorityName = parseRedminePriority(getVal(mapping.priorityCol));
      const estimatedHours = getVal(mapping.estimatedHoursCol);
      const statusName = parseRedmineStatus(getVal(mapping.statusCol));
      const resultNote = getVal(mapping.resultNoteCol);
      const dueDate = formatDateString(getVal(mapping.dueDateCol));
      const delayReason = getVal(mapping.delayReasonCol);
      const parentTaskId = getVal(mapping.parentTaskCol);
      const doneRatioVal = getVal(mapping.doneRatioCol);
      const doneRatio = doneRatioVal ? parseInt(doneRatioVal.replace('%', ''), 10) : statusName === 'Closed' ? 100 : statusName === 'In Progress' ? 50 : 0;

      const task: PersonalTask = {
        id: `task_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        week,
        assignedDate,
        trackerName,
        category,
        projectName,
        title,
        description,
        priorityName,
        estimatedHours,
        statusName,
        resultNote,
        dueDate,
        delayReason,
        parentTaskId: parentTaskId || undefined,
        doneRatio: Number.isFinite(doneRatio) ? doneRatio : 0,
        source: 'excel',
        createdAt: nowStr,
        updatedAt: nowStr,
      };

      return task;
    })
    .filter((t): t is PersonalTask => t !== null);
}

/**
 * Export PersonalTask[] into styled Excel (.xlsx) file.
 */
export async function exportPersonalTasksToExcel(tasks: PersonalTask[], filename = 'Ke_hoach_dau_viec_ca_nhan.xlsx') {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Redmine PM Workspace';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Kế hoạch đầu việc');

  const headers = [
    'Tuần',
    'Ngày bắt đầu',
    'Tracker',
    'Nhóm việc (Category)',
    'Tên việc cần làm (Subject)',
    'Mô tả chi tiết',
    'Mức độ ưu tiên (Priority)',
    'Thời lượng (h)',
    '% Hoàn thành',
    'Trạng thái (Status)',
    'Kết quả công việc / Tiến độ',
    'Hạn chót (Deadline)',
    'Task cha',
    'Lý do trễ hạn',
    'Nguồn',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  tasks.forEach((t) => {
    const row = worksheet.addRow([
      t.week || '',
      t.assignedDate || '',
      t.trackerName || 'Task',
      t.category || '',
      t.title || '',
      t.description || '',
      t.priorityName || 'Normal',
      t.estimatedHours || '',
      t.doneRatio !== undefined ? `${t.doneRatio}%` : '0%',
      t.statusName || 'New',
      t.resultNote || '',
      t.dueDate || '',
      t.parentTaskId ? `#${t.parentTaskId}` : '',
      t.delayReason || '',
      t.source === 'redmine' ? 'Redmine' : t.source === 'excel' ? 'Excel' : 'Thủ công',
    ]);

    const statusCell = row.getCell(10);
    const sName = (t.statusName || '').toLowerCase();
    if (sName.includes('closed') || sName.includes('resolved') || sName.includes('verified')) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
      statusCell.font = { color: { argb: 'FF166534' }, bold: true };
    } else if (sName.includes('in progress') || sName.includes('testing')) {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } };
      statusCell.font = { color: { argb: 'FF854D0E' }, bold: true };
    }

    const prioCell = row.getCell(7);
    const pName = (t.priorityName || '').toLowerCase();
    if (pName.includes('urgent') || pName.includes('immediate') || pName.includes('must have')) {
      prioCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
      prioCell.font = { color: { argb: 'FF991B1B' }, bold: true };
    }

    const resultCell = row.getCell(11);
    if (t.resultNote && !sName.includes('closed')) {
      resultCell.font = { color: { argb: 'FFB91C1C' } };
    }
  });

  worksheet.columns = [
    { width: 22 },
    { width: 14 },
    { width: 12 },
    { width: 18 },
    { width: 35 },
    { width: 45 },
    { width: 18 },
    { width: 14 },
    { width: 14 },
    { width: 16 },
    { width: 40 },
    { width: 14 },
    { width: 12 },
    { width: 28 },
    { width: 12 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Download an empty Excel template with predefined headers
 * matching the expected import format for personal tasks.
 */
export async function downloadExcelTemplate() {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Redmine PM Workspace';
  workbook.created = new Date();

  const ws = workbook.addWorksheet('Kế hoạch đầu việc');

  const headers = [
    'Tuần',
    'Ngày bắt đầu',
    'Tracker',
    'Nhóm việc / Dự án',
    'Tên việc cần làm',
    'Mô tả chi tiết',
    'Mức độ ưu tiên (Priority)',
    'Thời lượng (giờ)',
    '% Hoàn thành',
    'Trạng thái (Status)',
    'Kết quả công việc / Ghi chú',
    'Hạn chót (Deadline)',
    'Task cha',
    'Lý do trễ hạn',
  ];

  const headerRow = ws.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 32;

  // Add a sample row to guide users
  ws.addRow([
    'Tuần 01 (01/01-05/01)',
    '2025-01-01',
    'Task',
    'Platform',
    'Ví dụ: Làm tính năng ABC',
    'Mô tả chi tiết công việc cần làm',
    'Normal',
    '8',
    '0%',
    'New',
    '',
    '2025-01-05',
    '',
    '',
  ]);

  // Add notes explaining valid values
  const noteRow = ws.addRow([
    '(Xóa 2 dòng này khi dùng)',
    '',
    'Bug / Task / Feature / User Story / Sub-Task',
    '',
    '',
    '',
    'Low / Normal / High / Urgent / Immediate',
    '',
    '0-100',
    'New / In Progress / Resolved / Feedback / Closed / QA testing / Ready For QA / QA Verified / Pending / Rejected',
    '',
    'YYYY-MM-DD hoặc DD/MM/YYYY',
    '#ID',
    '',
  ]);
  noteRow.font = { italic: true, color: { argb: 'FF6B7280' }, size: 9 };

  ws.columns = [
    { width: 24 }, { width: 14 }, { width: 14 }, { width: 20 },
    { width: 35 }, { width: 40 }, { width: 20 }, { width: 14 },
    { width: 14 }, { width: 20 }, { width: 35 }, { width: 16 },
    { width: 12 }, { width: 28 },
  ];

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'Template_Ke_hoach_dau_viec.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
