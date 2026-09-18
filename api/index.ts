import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import { geminiErrorResponse } from '../lib/geminiErrors';

const app = express();
app.use(express.json({ limit: '256kb' }));
app.use((error: any, _req: Request, res: Response, next: any) => {
  if (error?.type === 'entity.too.large') return res.status(413).json({ error: 'Dữ liệu báo cáo quá lớn. Hãy tải lại trang để dùng phiên bản mới.' });
  next(error);
});

const getRedmineConfig = (req: Request) => {
  const customUrl = req.headers['x-redmine-url'] as string | undefined;
  const customKey = req.headers['x-redmine-api-key'] as string | undefined;

  const baseUrl = (customUrl?.trim() || process.env.REDMINE_URL || 'https://redmine.anybim.vn').replace(/\/+$/, '');
  const apiKey = customKey?.trim() || process.env.REDMINE_API_KEY || '485a0bd120e3515ab2442afe570f2a6829a55342';

  return { baseUrl, apiKey };
};

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

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/redmine/me', async (req: Request, res: Response) => {
  try {
    const result = await fetchRedmine(req, '/users/current.json');
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch user' });
  }
});

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

app.get('/api/redmine/issues', async (req: Request, res: Response) => {
  try {
    const params: Record<string, any> = {
      limit: '100',
      offset: '0',
      sort: 'updated_on:desc',
      include: 'attachments,relations',
      ...req.query,
    };

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

app.get('/api/redmine/statuses', async (req: Request, res: Response) => {
  try {
    const result = await fetchRedmine(req, '/issue_statuses.json');
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch statuses' });
  }
});

app.get('/api/redmine/trackers', async (req: Request, res: Response) => {
  try {
    const result = await fetchRedmine(req, '/trackers.json');
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch trackers' });
  }
});

app.get('/api/redmine/priorities', async (req: Request, res: Response) => {
  try {
    const result = await fetchRedmine(req, '/enumerations/issue_priorities.json');
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch priorities' });
  }
});

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

app.get('/api/redmine/custom_fields', async (req: Request, res: Response) => {
  try {
    const result = await fetchRedmine(req, '/custom_fields.json');
    return res.status(result.status).json(result.data);
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Failed to fetch custom fields' });
  }
});

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

app.post('/api/gemini/pm-insights', async (req: Request, res: Response) => {
  try {
    const { mode, projectName, issues, statistics, model } = req.body;
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
        timeout: 25000,
        retryOptions: { attempts: 1 },
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    let prompt = '';
    if (mode === 'standup') {
      prompt = `Bạn là Trợ lý PM cho dự án "${projectName}".
Thống kê: ${JSON.stringify(statistics || {})}
Dữ liệu: ${JSON.stringify(issues?.slice(0, 30) || [])}
Hãy viết báo cáo Standup hàng ngày cô đọng bằng Tiếng Việt gồm 4 phần: Tổng quan, Việc đang làm, Điểm nghẽn rủi ro, Hành động khuyến nghị.`;
    } else if (mode === 'risk') {
      prompt = `Bạn là Chuyên gia PM Audit cho dự án "${projectName}".
Thống kê: ${JSON.stringify(statistics || {})}
Dữ liệu: ${JSON.stringify(issues?.slice(0, 35) || [])}
Hãy phân tích rủi ro, cảnh báo quá hạn, phân bổ tải công việc và đề xuất giải pháp.`;
    } else {
      prompt = `Bạn là AI PM Assistant cho dự án "${projectName}".
Dựa vào dữ liệu: ${JSON.stringify({ statistics, sampleIssues: issues?.slice(0, 20) })}
Hãy phân tích và đưa ra 3 lời khuyên tối ưu hóa luồng công việc cụ thể cho PM Redmine bằng Tiếng Việt.`;
    }

    const primaryModel = (typeof model === 'string' && model.trim()) ? model.trim() : 'gemini-2.5-flash';
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
        const generatePromise = ai.models.generateContent({
          model: candidate,
          contents: prompt,
        });
        const response: any = await generatePromise;
        if (response && response.text) {
          responseText = response.text;
          resolvedModel = candidate;
          break;
        }
      } catch (err: any) {
        lastError = err;
        if (![404, 500, 502, 503, 504].includes(Number(err?.status || err?.code))) break;
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
    const failure = geminiErrorResponse(error);
    return res.status(failure.status).json({ error: failure.error });
  }
});

export default app;
