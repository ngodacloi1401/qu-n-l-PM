import type { Express, Request, Response } from 'express';

export function extractGoogleSpreadsheetId(url: string): { spreadsheetId: string; gid?: string } | null {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed.includes('docs.google.com/spreadsheets')) return null;

  // Pattern matches:
  // https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0
  // https://docs.google.com/spreadsheets/d/e/2PACX-1v.../pubhtml
  const idMatch = trimmed.match(/\/spreadsheets\/(?:d|e)\/([a-zA-Z0-9-_]+)/);
  if (!idMatch || !idMatch[1]) return null;

  const spreadsheetId = idMatch[1];
  const gidMatch = trimmed.match(/[#&?]gid=([0-9]+)/);
  const gid = gidMatch ? gidMatch[1] : undefined;

  return { spreadsheetId, gid };
}

export function validateAppsScriptUrl(url: string): boolean {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  return /^https:\/\/script\.google\.com\/macros\/s\/[a-zA-Z0-9-_]+\/exec/i.test(trimmed);
}

export function registerGoogleSheetsRoutes(app: Express) {
  // 1. One-way export fetch from public Google Sheet URL
  app.post('/api/google-sheets/fetch', async (req: Request, res: Response) => {
    const rawUrl = req.body?.url;
    if (!rawUrl || typeof rawUrl !== 'string') {
      return res.status(400).json({ error: 'Vui lòng cung cấp đường link Google Sheets hợp lệ.' });
    }

    const trimmed = rawUrl.trim();
    const extracted = extractGoogleSpreadsheetId(trimmed);
    if (!extracted) {
      return res.status(400).json({
        error:
          'Đường link không phải là Google Sheets hợp lệ. Vui lòng sử dụng link có dạng: https://docs.google.com/spreadsheets/d/...',
      });
    }

    const { spreadsheetId, gid } = extracted;
    const exportUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=xlsx${gid ? `&gid=${gid}` : ''}`;

    try {
      const response = await fetch(exportUrl, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AnyBIM-PM-Workspace/1.0',
        },
        redirect: 'follow',
      });

      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({
            error: 'Không tìm thấy file Google Sheets này (HTTP 404). Hãy kiểm tra lại xem file có tồn tại không.',
          });
        }
        if (response.status === 401 || response.status === 403) {
          return res.status(403).json({
            error:
              'File Google Sheet đang bị khóa riêng tư. Hãy mở file trên Google Sheets -> Nhấn nút "Chia sẻ" -> Đổi quyền thành "Bất kỳ ai có đường liên kết đều có thể xem" rồi thử lại.',
          });
        }
        return res.status(response.status).json({
          error: `Không thể tải dữ liệu từ Google Sheets (Mã lỗi ${response.status}).`,
        });
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        const textPreview = await response.text();
        if (
          textPreview.includes('ServiceLogin') ||
          textPreview.includes('accounts.google.com') ||
          textPreview.includes('Sign in') ||
          textPreview.includes('Đăng nhập')
        ) {
          return res.status(403).json({
            error:
              'File Google Sheet chưa được mở quyền xem công khai. Hãy mở file trên Google Sheets -> Nhấn nút "Chia sẻ" -> Đổi quyền thành "Bất kỳ ai có đường liên kết đều có thể xem" rồi thử lại.',
          });
        }
      }

      const arrayBuffer = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      if (buffer.length === 0) {
        return res.status(400).json({ error: 'File Google Sheets trả về dữ liệu rỗng (0 byte).' });
      }

      return res.json({
        success: true,
        spreadsheetId,
        size: buffer.length,
        base64: buffer.toString('base64'),
      });
    } catch (err: any) {
      console.error('[GoogleSheetsFetch Error]:', err);
      return res.status(500).json({
        error: `Lỗi kết nối khi tải Google Sheets: ${err?.message || 'Không thể liên hệ với máy chủ Google.'}`,
      });
    }
  });

  // 2. Two-way Google Apps Script webhook integration (Push & Pull)
  app.post('/api/google-sheets/sync-2way', async (req: Request, res: Response) => {
    const scriptUrl = req.body?.scriptUrl;
    if (!scriptUrl || typeof scriptUrl !== 'string' || !validateAppsScriptUrl(scriptUrl)) {
      return res.status(400).json({
        error:
          'Đường link Web App Google Apps Script không hợp lệ. URL phải có dạng https://script.google.com/macros/s/.../exec',
      });
    }

    const action = req.body?.action || 'ping'; // 'ping' | 'create' | 'update' | 'delete' | 'syncAll' | 'pull'

    try {
      // If action is 'pull', we can do GET or POST with action=pull
      const payload = {
        action,
        task: req.body?.task,
        tasks: req.body?.tasks,
      };

      const response = await fetch(scriptUrl.trim(), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // Google Apps Script handles text/plain without CORS preflight block
        },
        body: JSON.stringify(payload),
        redirect: 'follow',
      });

      if (!response.ok) {
        return res.status(response.status).json({
          error: `Google Apps Script phản hồi mã lỗi ${response.status}. Hãy đảm bảo Web App được cấp quyền 'Anyone'.`,
        });
      }

      const text = await response.text();
      let data: any = {};
      try {
        data = JSON.parse(text);
      } catch {
        // In case Google returned an HTML error or redirect notice
        if (text.includes('Google Drive') || text.includes('script.google.com') || text.includes('accounts.google.com')) {
          return res.status(403).json({
            error:
              'Không có quyền truy cập Google Apps Script. Hãy kiểm tra lại cấu hình Deploy Web App: Mục "Who has access" (Ai có quyền truy cập) phải chọn "Anyone" (Bất kỳ ai).',
          });
        }
        return res.status(502).json({
          error: `Phản hồi từ Google Apps Script không phải là JSON: ${text.slice(0, 200)}`,
        });
      }

      return res.json(data);
    } catch (err: any) {
      console.error('[GoogleSheets2Way Error]:', err);
      return res.status(500).json({
        error: `Lỗi kết nối tới Google Apps Script: ${err?.message || 'Không thể gửi dữ liệu tới máy chủ Google.'}`,
      });
    }
  });
}
