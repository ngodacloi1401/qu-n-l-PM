import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from '@google/genai';
import { geminiErrorResponse } from './lib/geminiErrors.js';
import { createChatRequest } from './lib/geminiChat.js';
import { listGeminiTextModels } from './lib/geminiModels.js';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '4mb' }));
app.use((error: any, _req: Request, res: Response, next: any) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu báo cáo quá lớn. Hãy tải lại trang để dùng phiên bản mới.' });
  next(error);
});

// Redmine credentials helper
const getRedmineConfig = (req: Request) => {
  const customUrl = req.headers['x-redmine-url'] as string | undefined;
  const customKey = req.headers['x-redmine-api-key'] as string | undefined;

  const baseUrl = (customUrl?.trim() || process.env.REDMINE_URL || 'https://redmine.anybim.vn').replace(/\/+$/, '');
  const apiKey = customKey?.trim() || process.env.REDMINE_API_KEY || '485a0bd120e3515ab2442afe570f2a6829a55342';

  return { baseUrl, apiKey };
};

// Generic Redmine fetcher helper
async function fetchRedmine(
  req: Request,
  endpoint: string,
  options: {
    method?: string;
    body?: any;
    params?: Record<string, string | number | boolean | undefined>;
  } = {}
) {
  const { baseUrl, apiKey } = getRedmineConfig(req);
  let urlStr = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  if (options.params) {
    const searchParams = new URLSearchParams();
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined && v !== null && v !== '') {
        searchParams.append(k, String(v));
      }
    }
    const qs = searchParams.toString();
    if (qs) {
      urlStr += (urlStr.includes('?') ? '&' : '?') + qs;
    }
  }

  const headers: Record<string, string> = {
    'X-Redmine-API-Key': apiKey,
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  const fetchOptions: RequestInit = {
    method: options.method || 'GET',
    headers,
  };

  if (options.body && options.method !== 'GET') {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const response = await fetch(urlStr, fetchOptions);
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  return {
    status: response.status,
    ok: response.ok,
    data,
  };
}

// -------------------------------------------------------------
// API Routes
// -------------------------------------------------------------

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Current user profile
app.get('/api/redmine/me', async (req: Request, res: Response) => {
  try {
    const result = await fetchRedmine(req, '/users/current.json');
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch user' });
  }
});

// Projects list
app.get('/api/redmine/projects', async (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const result = await fetchRedmine(req, '/projects.json', {
      params: { limit, include: 'trackers,issue_categories,enabled_modules' },
    });
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch projects' });
  }
});

// Issues list with flexible query params
app.get('/api/redmine/issues', async (req: Request, res: Response) => {
  try {
    const params: Record<string, any> = {
      limit: '100',
      offset: '0',
      sort: 'updated_on:desc',
      include: 'attachments,relations',
      ...req.query,
    };

    // Clean up 'all' values
    // Keep cached clients using ISO cursors compatible with Redmine date filters.
    if (typeof params.updated_on === 'string') {
      params.updated_on = params.updated_on.replace(/^(>=|<=|=|>|<)?(\d{4}-\d{2}-\d{2})T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/, '$1$2');
    }

    for (const key of Object.keys(params)) {
      if (params[key] === 'all' || params[key] === undefined || params[key] === '') {
        delete params[key];
      }
    }

    const result = await fetchRedmine(req, '/issues.json', { params });
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch issues' });
  }
});

// Issue detail
app.get('/api/redmine/issues/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await fetchRedmine(req, `/issues/${id}.json`, {
      params: { include: 'journals,attachments,relations,children,watchers' },
    });
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch issue detail' });
  }
});

// Create issue
app.post('/api/redmine/issues', async (req: Request, res: Response) => {
  try {
    const result = await fetchRedmine(req, '/issues.json', {
      method: 'POST',
      body: req.body,
    });
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to create issue' });
  }
});

// Update issue
app.put('/api/redmine/issues/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await fetchRedmine(req, `/issues/${id}.json`, {
      method: 'PUT',
      body: req.body,
    });
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to update issue' });
  }
});

// Delete issue
app.delete('/api/redmine/issues/:id', async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const result = await fetchRedmine(req, `/issues/${id}.json`, {
      method: 'DELETE',
    });
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to delete issue' });
  }
});

// Issue statuses
app.get('/api/redmine/statuses', async (req: Request, res: Response) => {
  try {
    const result = await fetchRedmine(req, '/issue_statuses.json');
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch statuses' });
  }
});

// Trackers
app.get('/api/redmine/trackers', async (req: Request, res: Response) => {
  try {
    const result = await fetchRedmine(req, '/trackers.json');
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch trackers' });
  }
});

// Priorities
app.get('/api/redmine/priorities', async (req: Request, res: Response) => {
  try {
    const result = await fetchRedmine(req, '/enumerations/issue_priorities.json');
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch priorities' });
  }
});

// Project Memberships
app.get('/api/redmine/memberships', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.project_id;
    if (!projectId || projectId === 'all') {
      return res.json({ memberships: [] });
    }
    const result = await fetchRedmine(req, `/projects/${projectId}/memberships.json`, {
      params: { limit: 100 },
    });
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch memberships' });
  }
});

// Project Versions / Milestones
app.get('/api/redmine/versions', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.project_id;
    if (!projectId || projectId === 'all') {
      return res.json({ versions: [] });
    }
    const result = await fetchRedmine(req, `/projects/${projectId}/versions.json`);
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch versions' });
  }
});

// Custom Fields
app.get('/api/redmine/custom_fields', async (req: Request, res: Response) => {
  try {
    const result = await fetchRedmine(req, '/custom_fields.json');
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch custom fields' });
  }
});

// Project Issue Categories
app.get('/api/redmine/issue_categories', async (req: Request, res: Response) => {
  try {
    const projectId = req.query.project_id;
    if (!projectId || projectId === 'all') {
      return res.json({ issue_categories: [] });
    }
    const result = await fetchRedmine(req, `/projects/${projectId}/issue_categories.json`);
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch issue categories' });
  }
});

// Time entries
app.get('/api/redmine/time_entries', async (req: Request, res: Response) => {
  try {
    const { project_id, limit = '100', offset = '0', from, to, sort } = req.query;
    const params: Record<string, any> = { limit, offset, from, to, sort };
    if (project_id && project_id !== 'all') params.project_id = project_id;

    const result = await fetchRedmine(req, '/time_entries.json', { params });
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch time entries' });
  }
});

// Create time entry
app.post('/api/redmine/time_entries', async (req: Request, res: Response) => {
  try {
    const result = await fetchRedmine(req, '/time_entries.json', {
      method: 'POST',
      body: req.body,
    });
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to log time' });
  }
});

// -------------------------------------------------------------
// Gemini AI PM Copilot Route
// -------------------------------------------------------------
app.get('/api/gemini/models', async (req: Request, res: Response) => {
  const apiKey = ((req.headers['x-gemini-api-key'] as string | undefined)?.trim() || process.env.GEMINI_API_KEY || '').trim();
  if (!apiKey) return res.status(400).json({ error: 'Chưa cấu hình Gemini API Key.' });
  try { return res.json({ models: await listGeminiTextModels(apiKey) }); }
  catch (error: any) { return res.status(Number(error?.status) || 502).json({ error: error?.message || 'Không thể tải danh sách model Gemini.' }); }
});

app.post('/api/gemini/pm-insights', async (req: Request, res: Response) => {
  try {
    const { mode, projectName, issues, statistics, model } = req.body;
    let chat: ReturnType<typeof createChatRequest> | undefined;
    if (mode === 'chat') {
      try { chat = createChatRequest(req.body); }
      catch (error: any) { return res.status(400).json({ error: error.message }); }
    }
    const clientKey = (req.headers['x-gemini-api-key'] as string | undefined)?.trim();
    const apiKey = clientKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'Chưa cấu hình GEMINI_API_KEY. Vui lòng bấm vào biểu tượng Cài đặt (⚙️) ở góc trên bên phải màn hình để nhập Gemini API Key của bạn.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        timeout: 28000,
        retryOptions: { attempts: 1 },
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    console.log('[AI Route] Received request:', { mode, projectName, model: model || 'default' });

    let prompt = '';
    if (mode === 'standup') {
      prompt = `Bạn là Trợ lý Quản lý Dự án (PM AI Copilot) cho dự án "${projectName}".
Dưới đây là thống kê và danh sách công việc hiện tại của team:
Thống kê: ${JSON.stringify(statistics || {})}
Một số công việc gần đây / đang xử lý:
${JSON.stringify(issues?.slice(0, 30) || [])}

Hãy tạo một bản báo cáo Daily Standup ngắn gọn, chuyên nghiệp, rõ ràng bằng Tiếng Việt gồm:
1. 📌 Tổng quan tiến độ hôm nay (Số task đã xong, đang làm, tồn đọng)
2. 🚀 Công việc trọng tâm đang triển khai (Top In Progress)
3. ⚠️ Điểm nghẽn & Rủi ro (Blocked / Overdue / Bug chưa giải quyết)
4. 🎯 Hành động đề xuất cho PM (Gợi ý phân công, đôn đốc)`;
    } else if (mode === 'risk') {
      prompt = `Bạn là Chuyên gia PM Audit và Quản trị Rủi ro.
Hãy phân tích các rủi ro trong dự án "${projectName}" dựa trên dữ liệu sau:
Thống kê: ${JSON.stringify(statistics || {})}
Dữ liệu công việc: ${JSON.stringify(issues?.slice(0, 35) || [])}

Hãy xuất ra báo cáo bằng Tiếng Việt gồm:
1. 🔴 Mức độ rủi ro tổng thể (Thấp / Trung bình / Cao / Khẩn cấp) kèm lý do
2. 🔍 Danh sách các tác vụ có nguy cơ trễ hạn (Overdue / High Priority / Blocked)
3. 👥 Đánh giá tải công việc thành viên (Ai đang bị quá tải hoặc dồn việc)
4. 🛡️ Giải pháp khắc phục nhanh chóng cho PM`;
    } else {
      prompt = `Bạn là AI PM Assistant cho dự án "${projectName}".
Dựa vào dữ liệu sau:
${JSON.stringify({ statistics, sampleIssues: issues?.slice(0, 20) })}

Hãy phân tích và đưa ra 3 lời khuyên tối ưu hóa luồng công việc cụ thể, thực tế cho PM quản lý dự án trên Redmine bằng Tiếng Việt.`;
    }

    const primaryModel = (typeof model === 'string' && model.trim()) ? model.trim() : 'gemini-2.5-flash';

    // Fallback chain in case of model spike / 503 high demand / availability issues
    const candidateModels: string[] = [primaryModel];
    for (const m of [primaryModel === 'gemini-2.5-flash' ? 'gemini-2.5-flash-lite' : 'gemini-2.5-flash']) {
      if (!candidateModels.includes(m)) {
        candidateModels.push(m);
      }
    }

    let lastError: any = null;
    let responseText = '';
    let resolvedModel = primaryModel;

    for (const candidate of candidateModels) {
      try {
        console.log(`[AI Route] Attempting model: ${candidate}`);
        const generatePromise = ai.models.generateContent({
          model: candidate,
          contents: chat ? chat.contents : prompt,
          config: chat ? { systemInstruction: chat.systemInstruction, maxOutputTokens: 4096 } : undefined,
        });
        const response: any = await generatePromise;
        if (response && response.text) {
          responseText = response.text;
          resolvedModel = candidate;
          console.log(`[AI Route] Success with model: ${candidate}`);
          break;
        }
      } catch (err: any) {
        lastError = err;
        if (![404, 500, 502, 503, 504].includes(Number(err?.status || err?.code))) break;
        console.warn(`[AI Route] Model ${candidate} failed:`, geminiErrorResponse(err).status);
      }
    }

    if (!responseText) {
      const failure = geminiErrorResponse(lastError);
      return res.status(failure.status).json({ error: failure.error });
    }

    return res.json({
      result: responseText,
      usedModel: resolvedModel,
      requestedModel: primaryModel,
      fallbackOccurred: resolvedModel !== primaryModel,
    });
  } catch (error: any) {
    console.error('Gemini request failed:', geminiErrorResponse(error).status);
    const failure = geminiErrorResponse(error);
    return res.status(failure.status).json({ error: failure.error });
  }
});

// -------------------------------------------------------------
// Vite Middleware / Static Serving
// -------------------------------------------------------------
async function start() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Redmine PM Server running at http://0.0.0.0:${PORT}`);
  });
}

start();

export default app;
