import type { PersonalTask, ExcelColumnMapping, ExcelParsedSheet, TaskPriority, TaskStatus } from '../types/personalTask';

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
  };

  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (!norm) return;

    if (mapping.weekCol === -1 && (norm.includes('tuan') || norm.includes('week'))) {
      mapping.weekCol = idx;
    } else if (
      mapping.assignedDateCol === -1 &&
      (norm.includes('ngaygiao') || norm.includes('ngaybatdau') || norm.includes('startdate') || norm.includes('ngaytao'))
    ) {
      mapping.assignedDateCol = idx;
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
  await workbook.xlsx.load(fileBuffer);

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

      // If this row has 3+ non-empty cells with text like "tuần", "việc", "trạng thái", "tên", etc.
      const rowText = cells.join(' ').toLowerCase();
      if (
        nonEmptyCount >= 3 &&
        (rowText.includes('việc') ||
          rowText.includes('tên') ||
          rowText.includes('tuần') ||
          rowText.includes('trạng thái') ||
          rowText.includes('deadline') ||
          rowText.includes('task'))
      ) {
        headerRowIndex = r;
        foundHeaders = cells;
        break;
      }
    }

    // Fallback if not detected: use row 1
    if (foundHeaders.length === 0 && worksheet.rowCount > 0) {
      headerRowIndex = 1;
      const row = worksheet.getRow(1);
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        foundHeaders[colNumber - 1] = cell.value ? String(cell.value).trim() : `Cột ${colNumber}`;
      });
    }

    // Trim trailing empty headers
    while (foundHeaders.length > 0 && !foundHeaders[foundHeaders.length - 1]) {
      foundHeaders.pop();
    }

    // Read remaining rows as data
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

function parsePriority(val: any): TaskPriority {
  const str = String(val || '').toLowerCase();
  if (str.includes('gấp') || str.includes('urgent') || str.includes('khẩn') || str.includes('p1')) return 'urgent';
  if (str.includes('cao') || str.includes('high') || str.includes('p2')) return 'high';
  if (str.includes('thấp') || str.includes('low') || str.includes('p4')) return 'low';
  return 'normal';
}

function parseStatus(val: any): TaskStatus {
  const str = String(val || '').toLowerCase();
  if (str.includes('hoàn thành') || str.includes('done') || str.includes('đã xong') || str.includes('closed')) return 'done';
  if (str.includes('đang làm') || str.includes('doing') || str.includes('in progress') || str.includes('tiến hành')) return 'in_progress';
  if (str.includes('review') || str.includes('chờ duyệt') || str.includes('chờ review') || str.includes('kiểm tra')) return 'review';
  if (str.includes('hoãn') || str.includes('tạm hoãn') || str.includes('defer') || str.includes('pause')) return 'deferred';
  return 'todo';
}

function formatDateString(val: any): string {
  if (!val) return '';
  if (val instanceof Date) {
    return val.toISOString().split('T')[0];
  }
  const s = String(val).trim();
  // Check if dd/mm/yyyy
  const dmyMatch = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return s;
}

/**
 * Convert sheet rows into PersonalTask[] using the given column mapping.
 */
export function convertRowsToTasks(
  rows: (string | number | null)[][],
  mapping: ExcelColumnMapping,
  defaultWeek: string = ''
): PersonalTask[] {
  const nowStr = new Date().toISOString();

  return rows
    .map((row, idx) => {
      const getVal = (col: number) => (col >= 0 && col < row.length ? String(row[col] ?? '').trim() : '');

      const title = getVal(mapping.titleCol);
      if (!title) return null; // Ignore rows without title

      const week = getVal(mapping.weekCol) || defaultWeek || 'Kế hoạch tuần';
      const assignedDate = formatDateString(getVal(mapping.assignedDateCol));
      const category = getVal(mapping.categoryCol) || 'Chung';
      const description = getVal(mapping.descriptionCol);
      const priority = parsePriority(getVal(mapping.priorityCol));
      const estimatedHours = getVal(mapping.estimatedHoursCol);
      const status = parseStatus(getVal(mapping.statusCol));
      const resultNote = getVal(mapping.resultNoteCol);
      const dueDate = formatDateString(getVal(mapping.dueDateCol));
      const delayReason = getVal(mapping.delayReasonCol);

      const task: PersonalTask = {
        id: `task_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 7)}`,
        week,
        assignedDate,
        category,
        title,
        description,
        priority,
        estimatedHours,
        status,
        resultNote,
        dueDate,
        delayReason,
        source: 'excel',
        createdAt: nowStr,
        updatedAt: nowStr,
      };

      return task;
    })
    .filter((t): t is PersonalTask => t !== null);
}

/**
 * Export PersonalTask[] into an Excel file (.xlsx) and trigger browser download.
 */
export async function exportPersonalTasksToExcel(tasks: PersonalTask[], filename = 'Ke_hoach_dau_viec_ca_nhan.xlsx') {
  const { default: ExcelJS } = await import('exceljs');
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Personal Task Hub';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Kế hoạch đầu việc');

  // Header row
  const headers = [
    'Tuần',
    'Ngày giao',
    'Nhóm việc',
    'Tên việc cần làm',
    'Mô tả chi tiết',
    'Mức độ ưu tiên',
    'Thời lượng (h)',
    'Trạng thái',
    'Kết quả công việc',
    'Deadline',
    'Lý do trễ hạn',
    'Nguồn',
  ];

  const headerRow = worksheet.addRow(headers);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF1E293B' }, // Slate-800
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.height = 28;

  // Add tasks
  tasks.forEach((t) => {
    const priorityLabel =
      t.priority === 'urgent' ? 'Gấp' : t.priority === 'high' ? 'Cao' : t.priority === 'low' ? 'Thấp' : 'Bình thường';

    const statusLabel =
      t.status === 'done'
        ? 'Hoàn thành'
        : t.status === 'in_progress'
        ? 'Đang làm'
        : t.status === 'review'
        ? 'Chờ review'
        : t.status === 'deferred'
        ? 'Tạm hoãn'
        : 'Chưa làm';

    const row = worksheet.addRow([
      t.week || '',
      t.assignedDate || '',
      t.category || '',
      t.title || '',
      t.description || '',
      priorityLabel,
      t.estimatedHours || '',
      statusLabel,
      t.resultNote || '',
      t.dueDate || '',
      t.delayReason || '',
      t.source === 'redmine' ? 'Redmine' : t.source === 'excel' ? 'Excel' : 'Thủ công',
    ]);

    // Colorize status cell
    const statusCell = row.getCell(8);
    if (t.status === 'done') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } }; // Light green
      statusCell.font = { color: { argb: 'FF166534' }, bold: true };
    } else if (t.status === 'in_progress') {
      statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF08A' } }; // Light yellow
      statusCell.font = { color: { argb: 'FF854D0E' }, bold: true };
    }

    // Colorize priority cell
    const prioCell = row.getCell(6);
    if (t.priority === 'urgent') {
      prioCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } }; // Light red
      prioCell.font = { color: { argb: 'FF991B1B' }, bold: true };
    }

    // Result note color (red text if pending/issue, like in user excel)
    const resultCell = row.getCell(9);
    if (t.resultNote && t.status !== 'done') {
      resultCell.font = { color: { argb: 'FFB91C1C' } };
    }
  });

  // Auto-fit column widths
  worksheet.columns = [
    { width: 22 }, // Tuần
    { width: 14 }, // Ngày giao
    { width: 18 }, // Nhóm việc
    { width: 35 }, // Tên việc
    { width: 45 }, // Mô tả chi tiết
    { width: 16 }, // Mức độ ưu tiên
    { width: 14 }, // Thời lượng
    { width: 16 }, // Trạng thái
    { width: 40 }, // Kết quả công việc
    { width: 14 }, // Deadline
    { width: 30 }, // Lý do trễ hạn
    { width: 12 }, // Nguồn
  ];

  // Enable word wrap for multiline columns
  worksheet.getColumn(4).alignment = { wrapText: true, vertical: 'top' };
  worksheet.getColumn(5).alignment = { wrapText: true, vertical: 'top' };
  worksheet.getColumn(9).alignment = { wrapText: true, vertical: 'top' };
  worksheet.getColumn(11).alignment = { wrapText: true, vertical: 'top' };

  // Generate buffer and trigger browser download
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
