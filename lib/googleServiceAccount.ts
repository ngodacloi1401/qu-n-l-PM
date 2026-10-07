import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { extractGoogleSpreadsheetId } from './googleSheets.js';

export interface ServiceAccountCredentials {
  type?: string;
  project_id?: string;
  private_key_id?: string;
  private_key: string;
  client_email: string;
  client_id?: string;
  auth_uri?: string;
  token_uri?: string;
  auth_provider_x509_cert_url?: string;
  client_x509_cert_url?: string;
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // timestamp in ms
}

let cachedToken: CachedToken | null = null;

/**
 * Loads Google Service Account credentials from environment variables or json file.
 */
export function getServiceAccountCredentials(): ServiceAccountCredentials | null {
  // 1. From direct JSON string in env
  if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
    try {
      const parsed = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
      if (parsed.client_email && parsed.private_key) return parsed;
    } catch {
      // ignore parse error
    }
  }

  // 2. From individual env variables
  if (process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    let privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    // Replace escaped newlines if any
    if (privateKey.includes('\\n')) {
      privateKey = privateKey.replace(/\\n/g, '\n');
    }
    return {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: privateKey,
      project_id: process.env.GOOGLE_PROJECT_ID,
    };
  }

  // 3. From file: google-service-account.json or credentials/google-service-account.json
  const candidatePaths = [
    path.resolve(process.cwd(), 'google-service-account.json'),
    path.resolve(process.cwd(), 'credentials', 'google-service-account.json'),
    process.env.GOOGLE_APPLICATION_CREDENTIALS ? path.resolve(process.env.GOOGLE_APPLICATION_CREDENTIALS) : null,
  ].filter(Boolean) as string[];

  for (const filePath of candidatePaths) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (parsed.client_email && parsed.private_key) {
          return parsed;
        }
      }
    } catch {
      // continue to next path
    }
  }

  return null;
}

/**
 * Returns the status of the Service Account configuration on this server.
 */
export function getServiceAccountStatus() {
  const creds = getServiceAccountCredentials();
  if (!creds) {
    return {
      configured: false,
      clientEmail: null,
      projectId: null,
      hint: 'Chưa tìm thấy file google-service-account.json hoặc biến môi trường GOOGLE_SERVICE_ACCOUNT_EMAIL & GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.',
    };
  }
  return {
    configured: true,
    clientEmail: creds.client_email,
    projectId: creds.project_id || null,
    hint: 'Google Service Account đã sẵn sàng kết nối.',
  };
}

/**
 * Creates an OAuth2 Access Token using RFC 7523 JWT Bearer grant.
 * Zero external dependencies: uses Node.js crypto module.
 */
export async function getGoogleAccessToken(creds?: ServiceAccountCredentials): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60000) {
    return cachedToken.accessToken;
  }

  const credentials = creds || getServiceAccountCredentials();
  if (!credentials || !credentials.client_email || !credentials.private_key) {
    throw new Error('Chưa cấu hình Google Service Account trên hệ thống. Vui lòng thêm file google-service-account.json vào thư mục dự án.');
  }

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

  const nowSeconds = Math.floor(now / 1000);
  const claim = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    exp: nowSeconds + 3600,
    iat: nowSeconds,
  };

  const base64UrlEncode = (obj: object | string): string => {
    const str = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return Buffer.from(str)
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  };

  const unsignedToken = `${base64UrlEncode(header)}.${base64UrlEncode(claim)}`;

  // Sign with RSA-SHA256
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(unsignedToken);
  sign.end();
  const signature = sign.sign(credentials.private_key, 'base64url');

  const jwt = `${unsignedToken}.${signature}`;

  const tokenResp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    throw new Error(`Google OAuth2 xác thực thất bại (${tokenResp.status}): ${errText}`);
  }

  const tokenData = (await tokenResp.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    accessToken: tokenData.access_token,
    expiresAt: now + (tokenData.expires_in || 3600) * 1000,
  };

  return cachedToken.accessToken;
}

export interface SheetRowTask {
  id?: string;
  week?: string;
  title: string;
  category?: string;
  dueDate?: string;
  priorityName?: string;
  statusName?: string;
  description?: string;
  estimatedHours?: string | number;
  doneRatio?: number;
  updatedAt?: string;
}

const DEFAULT_HEADERS = [
  'ID',
  'Tuần',
  'Tên việc',
  'Nhóm việc',
  'Hạn chót',
  'Mức ưu tiên',
  'Trạng thái',
  'Mô tả',
  'Giờ ước tính',
  'Tiến độ (%)',
  'Cập nhật',
];

/**
 * Resolves spreadsheetId from URL or raw ID.
 */
export function resolveSpreadsheetId(urlOrId: string): string {
  const trimmed = urlOrId.trim();
  const extracted = extractGoogleSpreadsheetId(trimmed);
  if (extracted) return extracted.spreadsheetId;
  // If it's already an ID
  if (/^[a-zA-Z0-9-_]{20,}$/.test(trimmed)) {
    return trimmed;
  }
  throw new Error('Đường link Google Sheets không hợp lệ. Vui lòng dùng link dạng https://docs.google.com/spreadsheets/d/...');
}

/**
 * Gets sheet title or creates default "Tasks" sheet.
 */
export async function getFirstSheetTitle(spreadsheetId: string, accessToken: string): Promise<string> {
  const metaResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!metaResp.ok) {
    if (metaResp.status === 403 || metaResp.status === 401) {
      const creds = getServiceAccountCredentials();
      const email = creds?.client_email || 'Service Account của hệ thống';
      throw new Error(
        `Không có quyền truy cập Google Sheet này. Hãy mở file Sheet > Bấm "Chia sẻ" > Thêm email "${email}" với quyền "Người chỉnh sửa (Editor)".`
      );
    }
    if (metaResp.status === 404) {
      throw new Error('Không tìm thấy file Google Sheet này (HTTP 404). Hãy kiểm tra lại đường link.');
    }
    const errText = await metaResp.text();
    throw new Error(`Lỗi Google Sheets API (${metaResp.status}): ${errText}`);
  }

  const metaData = (await metaResp.json()) as { sheets?: Array<{ properties?: { title?: string } }> };
  return metaData.sheets?.[0]?.properties?.title || 'Sheet1';
}

/**
 * Reads all tasks from Google Sheet via Service Account.
 */
export async function readTasksFromServiceAccount(urlOrId: string): Promise<{ sheetTitle: string; tasks: SheetRowTask[] }> {
  const spreadsheetId = resolveSpreadsheetId(urlOrId);
  const accessToken = await getGoogleAccessToken();
  const sheetTitle = await getFirstSheetTitle(spreadsheetId, accessToken);

  const range = encodeURIComponent(`'${sheetTitle}'!A1:Z5000`);
  const valuesResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!valuesResp.ok) {
    const err = await valuesResp.text();
    throw new Error(`Không thể đọc dữ liệu Sheet (${valuesResp.status}): ${err}`);
  }

  const data = (await valuesResp.json()) as { values?: string[][] };
  const rows = data.values || [];

  if (rows.length === 0) {
    return { sheetTitle, tasks: [] };
  }

  // Find header row or default indices
  const headerRow = rows[0].map((c) => String(c || '').trim().toLowerCase());
  const findCol = (candidates: string[]): number => {
    return headerRow.findIndex((col) => candidates.some((cand) => col.includes(cand)));
  };

  const idIdx = findCol(['id', 'mã']);
  const weekIdx = findCol(['tuần', 'week']);
  const titleIdx = findCol(['tên việc', 'tiêu đề', 'công việc', 'title', 'task', 'subject']);
  const catIdx = findCol(['nhóm việc', 'chuyên mục', 'category', 'dự án', 'project']);
  const dueIdx = findCol(['hạn chót', 'kết thúc', 'deadline', 'due']);
  const priorityIdx = findCol(['ưu tiên', 'priority', 'mức ưu tiên']);
  const statusIdx = findCol(['trạng thái', 'tình trạng', 'status']);
  const descIdx = findCol(['mô tả', 'ghi chú', 'description', 'note']);
  const hoursIdx = findCol(['giờ', 'ước tính', 'estimated', 'hours']);
  const progressIdx = findCol(['tiến độ', 'done ratio', 'progress', '%']);

  const actualTitleIdx = titleIdx !== -1 ? titleIdx : 1;

  const tasks: SheetRowTask[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const rawTitle = row[actualTitleIdx];
    if (!rawTitle || !String(rawTitle).trim()) continue;

    const rawProgress = progressIdx !== -1 && row[progressIdx] !== undefined ? row[progressIdx] : '';
    let parsedProgress = 0;
    if (rawProgress) {
      const num = parseFloat(String(rawProgress).replace('%', '').trim());
      if (!isNaN(num)) parsedProgress = Math.max(0, Math.min(100, Math.round(num)));
    }

    tasks.push({
      id: idIdx !== -1 && row[idIdx] ? String(row[idIdx]).trim() : undefined,
      week: weekIdx !== -1 && row[weekIdx] ? String(row[weekIdx]).trim() : undefined,
      title: String(rawTitle).trim(),
      category: catIdx !== -1 && row[catIdx] ? String(row[catIdx]).trim() : undefined,
      dueDate: dueIdx !== -1 && row[dueIdx] ? String(row[dueIdx]).trim() : undefined,
      priorityName: priorityIdx !== -1 && row[priorityIdx] ? String(row[priorityIdx]).trim() : 'Normal',
      statusName: statusIdx !== -1 && row[statusIdx] ? String(row[statusIdx]).trim() : 'New',
      description: descIdx !== -1 && row[descIdx] ? String(row[descIdx]).trim() : '',
      estimatedHours: hoursIdx !== -1 && row[hoursIdx] ? String(row[hoursIdx]).trim() : '',
      doneRatio: parsedProgress,
      updatedAt: new Date().toISOString(),
    });
  }

  return { sheetTitle, tasks };
}

function formatTaskRow(t: SheetRowTask): (string | number)[] {
  return [
    t.id || '',
    t.week || '',
    t.title || '',
    t.category || '',
    t.dueDate || '',
    t.priorityName || 'Normal',
    t.statusName || 'New',
    t.description || '',
    t.estimatedHours || '',
    t.doneRatio ?? 0,
    t.updatedAt || new Date().toISOString(),
  ];
}

/**
 * Writes or updates tasks in Google Sheet via Service Account.
 */
export async function pushTasksToServiceAccount(
  urlOrId: string,
  tasks: SheetRowTask[],
  mode: 'replace_all' | 'append' = 'replace_all'
): Promise<{ success: boolean; count: number; sheetTitle: string }> {
  const spreadsheetId = resolveSpreadsheetId(urlOrId);
  const accessToken = await getGoogleAccessToken();
  const sheetTitle = await getFirstSheetTitle(spreadsheetId, accessToken);

  if (mode === 'replace_all') {
    // Format 2D array: Header + Rows
    const values: (string | number)[][] = [DEFAULT_HEADERS];
    for (const t of tasks) {
      values.push(formatTaskRow(t));
    }

    // 1. Clear old data
    const clearRange = encodeURIComponent(`'${sheetTitle}'!A1:Z5000`);
    await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${clearRange}:clear`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // 2. Write new values
    const updateRange = encodeURIComponent(`'${sheetTitle}'!A1`);
    const updateResp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${updateRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    if (!updateResp.ok) {
      const err = await updateResp.text();
      throw new Error(`Lỗi cập nhật Google Sheet (${updateResp.status}): ${err}`);
    }

    return { success: true, count: tasks.length, sheetTitle };
  } else {
    // Append rows
    const values: (string | number)[][] = tasks.map(formatTaskRow);

    const appendRange = encodeURIComponent(`'${sheetTitle}'!A1`);
    const appendResp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values }),
      }
    );

    if (!appendResp.ok) {
      const err = await appendResp.text();
      throw new Error(`Lỗi thêm dòng vào Google Sheet (${appendResp.status}): ${err}`);
    }

    return { success: true, count: tasks.length, sheetTitle };
  }
}

/**
 * Pushes a single task update, insert or delete.
 */
export async function pushSingleTaskToServiceAccount(
  urlOrId: string,
  task: SheetRowTask,
  action: 'create' | 'update' | 'delete'
): Promise<{ success: boolean; action: string }> {
  const spreadsheetId = resolveSpreadsheetId(urlOrId);
  const accessToken = await getGoogleAccessToken();
  const sheetTitle = await getFirstSheetTitle(spreadsheetId, accessToken);

  // Read existing IDs in column A
  const colARange = encodeURIComponent(`'${sheetTitle}'!A:A`);
  const colResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${colARange}`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  let rows: string[][] = [];
  if (colResp.ok) {
    const data = (await colResp.json()) as { values?: string[][] };
    rows = data.values || [];
  }

  // If Sheet is empty, initialize header
  if (rows.length === 0) {
    const initRange = encodeURIComponent(`'${sheetTitle}'!A1`);
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${initRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [DEFAULT_HEADERS] }),
      }
    );
    rows = [['ID']];
  }

  // Find row index (1-based)
  let foundRowIndex = -1;
  if (task.id) {
    for (let i = 0; i < rows.length; i++) {
      if (rows[i] && rows[i][0] && String(rows[i][0]).trim() === String(task.id).trim()) {
        foundRowIndex = i + 1; // Sheets rows are 1-based
        break;
      }
    }
  }

  const rowData = formatTaskRow(task);

  if (action === 'delete') {
    if (foundRowIndex > 1) {
      // Clear this row
      const rowRange = encodeURIComponent(`'${sheetTitle}'!A${foundRowIndex}:K${foundRowIndex}`);
      await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rowRange}:clear`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        }
      );
    }
    return { success: true, action: 'delete' };
  }

  if (action === 'update' && foundRowIndex > 1) {
    // Update existing row
    const rowRange = encodeURIComponent(`'${sheetTitle}'!A${foundRowIndex}:K${foundRowIndex}`);
    const updateResp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${rowRange}?valueInputOption=USER_ENTERED`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [rowData] }),
      }
    );

    if (!updateResp.ok) {
      const err = await updateResp.text();
      throw new Error(`Cập nhật dòng ${foundRowIndex} thất bại: ${err}`);
    }
    return { success: true, action: 'update' };
  }

  // Otherwise (action === 'create' or task not found yet) -> Append row
  const appendRange = encodeURIComponent(`'${sheetTitle}'!A1`);
  const appendResp = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${appendRange}:append?valueInputOption=USER_ENTERED`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ values: [rowData] }),
    }
  );

  if (!appendResp.ok) {
    const err = await appendResp.text();
    throw new Error(`Thêm công việc vào Sheet thất bại: ${err}`);
  }

  return { success: true, action: 'create' };
}
