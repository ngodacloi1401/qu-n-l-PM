import type { PersonalTask } from '../types/personalTask';
import { parseExcelWorkbook, autoDetectMapping, convertRowsToTasks } from './personalTaskExcel';

export interface GoogleSheetsSyncConfig {
  sheetUrl: string;
  autoSync: boolean;
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
        autoSync: Boolean(parsed.autoSync),
        syncMode: parsed.syncMode === 'replace' ? 'replace' : 'merge',
        lastSyncedAt: typeof parsed.lastSyncedAt === 'number' ? parsed.lastSyncedAt : undefined,
        lastTaskCount: typeof parsed.lastTaskCount === 'number' ? parsed.lastTaskCount : undefined,
        selectedSheetName: typeof parsed.selectedSheetName === 'string' ? parsed.selectedSheetName : undefined,
      };
    }
  } catch {}
  return { sheetUrl: '', autoSync: false, syncMode: 'merge' };
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

/**
 * Base64 string to ArrayBuffer in browser.
 */
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
 * Download and parse tasks directly from a Google Sheets URL via backend proxy.
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

  // Choose preferred sheet or first sheet with rows
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
  // Mark source as 'excel' (Google Sheets is an online spreadsheet)
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
