import type { PersonalTask } from '../types/personalTask';
import { parseExcelWorkbook, autoDetectMapping, convertRowsToTasks } from './personalTaskExcel';

export interface GoogleSheetsSyncConfig {
  sheetUrl: string; // One-way read/export URL
  scriptUrl?: string; // Two-way Apps Script Web App URL
  autoSync: boolean; // Auto-pull on tab open
  autoPush?: boolean; // Auto-push to sheet on task create/update/drag-and-drop
  syncMode: 'merge' | 'replace';
  lastSyncedAt?: number;
  lastTaskCount?: number;
  selectedSheetName?: string;
}

const STORAGE_PREFIX = 'pm_google_sheets_config_';

export function getGoogleSheetsSyncConfig(scopeKey: string): GoogleSheetsSyncConfig {
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${scopeKey}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        sheetUrl: typeof parsed.sheetUrl === 'string' ? parsed.sheetUrl : '',
        scriptUrl: typeof parsed.scriptUrl === 'string' ? parsed.scriptUrl : '',
        autoSync: Boolean(parsed.autoSync),
        autoPush: parsed.autoPush !== undefined ? Boolean(parsed.autoPush) : true,
        syncMode: parsed.syncMode === 'replace' ? 'replace' : 'merge',
        lastSyncedAt: typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : undefined,
        lastTaskCount: typeof parsed.lastTaskCount === 'number' ? parsed.lastTaskCount : undefined,
        selectedSheetName: typeof parsed.selectedSheetName === 'string' ? parsed.selectedSheetName : undefined,
      };
    }
  } catch {}
  return { sheetUrl: '', scriptUrl: '', autoSync: false, autoPush: true, syncMode: 'merge' };
}

export function saveGoogleSheetsSyncConfig(scopeKey: string, config: GoogleSheetsSyncConfig): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${scopeKey}`, JSON.stringify(config));
  } catch {}
}

export function clearGoogleSheetsSyncConfig(scopeKey: string): void {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${scopeKey}`);
  } catch {}
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export interface GoogleSheetsSyncResult {
  tasks: PersonalTask[];
  sheetName: string;
  totalSheets: number;
}

/**
 * One-way: Download and parse tasks directly from a public Google Sheets URL.
 */
export async function fetchGoogleSheetTasks(
  sheetUrl: string,
  preferredSheetName?: string
): Promise<GoogleSheetsSyncResult> {
  if (!sheetUrl || !sheetUrl.trim()) {
    throw new Error('Vui lòng cung cấp đường link Google Sheets.');
  }

  const res = await fetch('/api/google-sheets/fetch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: sheetUrl.trim() }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Lỗi tải file Google Sheets (${res.status}).`);
  }

  if (!data.base64) {
    throw new Error('Không nhận được dữ liệu từ Google Sheets.');
  }

  const arrayBuffer = base64ToArrayBuffer(data.base64);
  const parsedSheets = await parseExcelWorkbook(arrayBuffer);

  if (!parsedSheets.length || parsedSheets.every((s) => s.rows.length === 0)) {
    throw new Error('Không tìm thấy dữ liệu hợp lệ trong file Google Sheets. Hãy đảm bảo sheet có dữ liệu và dòng tiêu đề.');
  }

  let targetSheet = parsedSheets[0];
  if (preferredSheetName) {
    const found = parsedSheets.find((s) => s.name.toLowerCase() === preferredSheetName.toLowerCase());
    if (found && found.rows.length > 0) {
      targetSheet = found;
    }
  }
  if (targetSheet.rows.length === 0) {
    const withRows = parsedSheets.find((s) => s.rows.length > 0);
    if (withRows) targetSheet = withRows;
  }

  const mapping = autoDetectMapping(targetSheet.headers);
  if (mapping.titleCol === -1) {
    throw new Error(
      `Sheet "${targetSheet.name}" không có cột tiêu đề công việc (cần cột "Tên việc", "Công việc" hoặc "Task").`
    );
  }

  const tasks = convertRowsToTasks(targetSheet.rows, mapping, targetSheet.name);
  tasks.forEach((t) => {
    t.source = 'excel';
  });

  return {
    tasks,
    sheetName: targetSheet.name,
    totalSheets: parsedSheets.length,
  };
}

/**
 * Intelligent task merger for Google Sheets sync:
 * - Matches tasks by ID or (normalized title + week).
 * - Updates fields (description, dueDate, priority, category) while preserving current Kanban status if already moved.
 * - Adds new tasks from Google Sheet without duplicating existing ones.
 */
export function mergePersonalTasks(
  existingTasks: PersonalTask[],
  incomingTasks: PersonalTask[]
): PersonalTask[] {
  const result: PersonalTask[] = [...existingTasks];
  const now = new Date().toISOString();

  for (const incoming of incomingTasks) {
    const incomingNormTitle = (incoming.title || '').trim().toLowerCase();
    const incomingWeek = (incoming.week || '').trim().toLowerCase();

    const existingIndex = result.findIndex((t) => {
      if (t.id === incoming.id) return true;
      const tNormTitle = (t.title || '').trim().toLowerCase();
      const tWeek = (t.week || '').trim().toLowerCase();
      return tNormTitle === incomingNormTitle && (!incomingWeek || tWeek === incomingWeek);
    });

    if (existingIndex >= 0) {
      const existing = result[existingIndex];
      result[existingIndex] = {
        ...existing,
        title: incoming.title || existing.title,
        description: incoming.description || existing.description,
        category: incoming.category || existing.category,
        dueDate: incoming.dueDate || existing.dueDate,
        priorityName: incoming.priorityName || existing.priorityName,
        priorityId: incoming.priorityId ?? existing.priorityId,
        estimatedHours: incoming.estimatedHours ?? existing.estimatedHours,
        assignedDate: incoming.assignedDate || existing.assignedDate,
        trackerName: incoming.trackerName || existing.trackerName,
        trackerId: incoming.trackerId ?? existing.trackerId,
        updatedAt: now,
      };
    } else {
      result.push({
        ...incoming,
        createdAt: incoming.createdAt || now,
        updatedAt: now,
      });
    }
  }

  return result;
}

// -----------------------------------------------------------------------------
// TWO-WAY SYNCHRONIZATION (Google Apps Script Web App Integration)
// -----------------------------------------------------------------------------

export const APPS_SCRIPT_TEMPLATE = `/**
 * AnyBIM PM Workspace - Google Sheets Two-Way Sync Script
 * Hướng dẫn 3 bước:
 * 1. Mở file Google Sheets -> Tiện ích mở rộng (Extensions) -> Apps Script
 * 2. Xóa hết code cũ, dán toàn bộ đoạn code này vào -> Nhấn Lưu (Ctrl+S)
 * 3. Nhấn nút "Triển khai" (Deploy) góc trên bên phải -> "Tùy chọn triển khai mới" (New deployment)
 *    - Chọn loại: "Ứng dụng web" (Web app)
 *    - Mô tả: AnyBIM Sync Webhook
 *    - Thực thi dưới dạng (Execute as): "Tôi" (Me)
 *    - Ai có quyền truy cập (Who has access): "Bất kỳ ai" (Anyone) -> Nhấn "Triển khai" (Deploy)
 * 4. Sao chép "URL ứng dụng web" (kết thúc bằng /exec) và dán vào App
 */

var HEADERS = [
  "ID",
  "Tuần",
  "Tên công việc",
  "Nhóm việc",
  "Hạn chót",
  "Mức ưu tiên",
  "Trạng thái",
  "Mô tả",
  "Giờ ước tính",
  "Cập nhật lúc"
];

function getOrCreateSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getActiveSheet();
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#e2e8f0");
  }
  return sheet;
}

function doGet(e) {
  try {
    var sheet = getOrCreateSheet();
    var data = sheet.getDataRange().getValues();
    return ContentService.createTextOutput(JSON.stringify({ status: "success", data: data }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    var sheet = getOrCreateSheet();
    var contents = e.postData ? e.postData.contents : "{}";
    var payload = JSON.parse(contents);
    var action = payload.action || "ping";

    if (action === "ping") {
      return ContentService.createTextOutput(JSON.stringify({
        status: "success",
        message: "Kết nối 2 chiều thành công!",
        sheetName: sheet.getName(),
        rows: sheet.getLastRow()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "pull") {
      var data = sheet.getDataRange().getValues();
      return ContentService.createTextOutput(JSON.stringify({ status: "success", data: data }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "create") {
      var t = payload.task || {};
      var row = [
        t.id || ("task-" + new Date().getTime()),
        t.week || "",
        t.title || "",
        t.category || "",
        t.dueDate || "",
        t.priorityName || "Normal",
        t.statusName || "New",
        t.description || "",
        t.estimatedHours || "",
        new Date().toISOString()
      ];
      sheet.appendRow(row);
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Đã thêm dòng mới vào Google Sheet" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "update") {
      var t = payload.task || {};
      var data = sheet.getDataRange().getValues();
      var foundRow = -1;

      for (var i = 1; i < data.length; i++) {
        var rowId = String(data[i][0] || "").trim();
        var rowTitle = String(data[i][2] || "").trim().toLowerCase();
        var rowWeek = String(data[i][1] || "").trim().toLowerCase();

        if ((t.id && rowId === String(t.id).trim()) ||
            (rowTitle === String(t.title || "").trim().toLowerCase() && (!t.week || rowWeek === String(t.week).trim().toLowerCase()))) {
          foundRow = i + 1;
          break;
        }
      }

      if (foundRow > 0) {
        if (t.week !== undefined) sheet.getRange(foundRow, 2).setValue(t.week);
        if (t.title !== undefined) sheet.getRange(foundRow, 3).setValue(t.title);
        if (t.category !== undefined) sheet.getRange(foundRow, 4).setValue(t.category);
        if (t.dueDate !== undefined) sheet.getRange(foundRow, 5).setValue(t.dueDate);
        if (t.priorityName !== undefined) sheet.getRange(foundRow, 6).setValue(t.priorityName);
        if (t.statusName !== undefined) sheet.getRange(foundRow, 7).setValue(t.statusName);
        if (t.description !== undefined) sheet.getRange(foundRow, 8).setValue(t.description);
        if (t.estimatedHours !== undefined) sheet.getRange(foundRow, 9).setValue(t.estimatedHours);
        sheet.getRange(foundRow, 10).setValue(new Date().toISOString());
        return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Đã cập nhật dòng " + foundRow }))
          .setMimeType(ContentService.MimeType.JSON);
      } else {
        var newRow = [
          t.id || ("task-" + new Date().getTime()),
          t.week || "",
          t.title || "",
          t.category || "",
          t.dueDate || "",
          t.priorityName || "Normal",
          t.statusName || "New",
          t.description || "",
          t.estimatedHours || "",
          new Date().toISOString()
        ];
        sheet.appendRow(newRow);
        return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Đã thêm mới dòng lên Google Sheet" }))
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (action === "delete") {
      var t = payload.task || {};
      var data = sheet.getDataRange().getValues();
      for (var i = 1; i < data.length; i++) {
        var rowId = String(data[i][0] || "").trim();
        var rowTitle = String(data[i][2] || "").trim().toLowerCase();
        if ((t.id && rowId === String(t.id).trim()) || (rowTitle === String(t.title || "").trim().toLowerCase())) {
          sheet.deleteRow(i + 1);
          return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Đã xóa dòng khỏi Google Sheet" }))
            .setMimeType(ContentService.MimeType.JSON);
        }
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", message: "Không tìm thấy dòng để xóa" }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    if (action === "syncAll") {
      var tasks = Array.isArray(payload.tasks) ? payload.tasks : [];
      sheet.clearContents();
      sheet.appendRow(HEADERS);
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold").setBackground("#e2e8f0");
      var rows = tasks.map(function(t) {
        return [
          t.id || "",
          t.week || "",
          t.title || "",
          t.category || "",
          t.dueDate || "",
          t.priorityName || "Normal",
          t.statusName || "New",
          t.description || "",
          t.estimatedHours || "",
          t.updatedAt || new Date().toISOString()
        ];
      });
      if (rows.length > 0) {
        sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
      }
      return ContentService.createTextOutput(JSON.stringify({ status: "success", count: rows.length }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: "Lệnh action không hợp lệ" }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ status: "error", message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}`;

/**
 * Ping / Test connection with the Google Apps Script Web App.
 */
export async function testAppsScriptConnection(
  scriptUrl: string
): Promise<{ success: boolean; message: string; sheetName?: string; rows?: number }> {
  const res = await fetch('/api/google-sheets/sync-2way', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scriptUrl, action: 'ping' }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') {
    throw new Error(data.error || data.message || `Lỗi kết nối tới Apps Script (${res.status}).`);
  }

  return {
    success: true,
    message: data.message || 'Kết nối 2 chiều thành công!',
    sheetName: data.sheetName,
    rows: data.rows,
  };
}

/**
 * Two-way push: Send a created, updated, or deleted task directly to Google Sheet.
 */
export async function pushTaskToGoogleSheet(
  scriptUrl: string,
  task: PersonalTask,
  action: 'create' | 'update' | 'delete'
): Promise<boolean> {
  if (!scriptUrl || !scriptUrl.trim()) return false;

  try {
    const res = await fetch('/api/google-sheets/sync-2way', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scriptUrl: scriptUrl.trim(), action, task }),
    });

    const data = await res.json().catch(() => ({}));
    return Boolean(res.ok && data.status === 'success');
  } catch (err) {
    console.warn('[pushTaskToGoogleSheet Error]:', err);
    return false;
  }
}

/**
 * Two-way push: Overwrite or push all current personal tasks up to Google Sheet.
 */
export async function pushAllTasksToGoogleSheet(
  scriptUrl: string,
  tasks: PersonalTask[]
): Promise<{ count: number }> {
  if (!scriptUrl || !scriptUrl.trim()) {
    throw new Error('Vui lòng cấu hình URL Web App Google Apps Script trước.');
  }

  const res = await fetch('/api/google-sheets/sync-2way', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scriptUrl: scriptUrl.trim(), action: 'syncAll', tasks }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success') {
    throw new Error(data.error || data.message || `Lỗi đẩy dữ liệu lên Google Sheet (${res.status}).`);
  }

  return { count: data.count || tasks.length };
}

/**
 * Two-way pull: Pull rows from Google Sheet via Apps Script Web App.
 */
export async function pullTasksFromAppsScript(scriptUrl: string): Promise<PersonalTask[]> {
  if (!scriptUrl || !scriptUrl.trim()) {
    throw new Error('Vui lòng cấu hình URL Web App Google Apps Script trước.');
  }

  const res = await fetch('/api/google-sheets/sync-2way', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scriptUrl: scriptUrl.trim(), action: 'pull' }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.status !== 'success' || !Array.isArray(data.data)) {
    throw new Error(data.error || data.message || `Lỗi kéo dữ liệu từ Apps Script (${res.status}).`);
  }

  const rawRows: any[][] = data.data;
  if (rawRows.length <= 1) {
    return [];
  }

  const headers = rawRows[0].map((h: any) => String(h || '').trim());
  const rows = rawRows.slice(1);
  const mapping = autoDetectMapping(headers);

  if (mapping.titleCol === -1) {
    throw new Error('Không tìm thấy cột tiêu đề công việc trong Google Sheet.');
  }

  const tasks = convertRowsToTasks(rows, mapping, 'Google Sheet');
  tasks.forEach((t) => {
    t.source = 'excel';
  });

  return tasks;
}
