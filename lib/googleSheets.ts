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

export function registerGoogleSheetsRoutes(app: Express) {
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
    // Construct Google Sheets XLSX export URL
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
      // If Google redirects to an HTML login page despite 200 OK
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

      // Return base64 encoded buffer for client-side multi-sheet parsing
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
}
