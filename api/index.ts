import express, { Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const app = express();
app.use(express.json());

const getRedmineConfig = (req: Request) => {
  const customUrl = req.headers['x-redmine-url'] as string | undefined;
  const customKey = req.headers['x-redmine-api-key'] as string | undefined;

  const baseUrl = (customUrl?.trim() || process.env.REDMINE_URL || 'https://redmine.anybim.vn').replace(/\/+$/, '');
  const apiKey = customKey?.trim() || process.env.REDMINE_API_KEY || '440da87a37415860ff240080d18ba34b21536eb8';

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
    const {
      project_id,
      status_id,
      assigned_to_id,
      tracker_id,
      fixed_version_id,
      priority_id,
      limit = '100',
      offset = '0',
      sort = 'updated_on:desc',
      include = 'attachments,relations',
    } = req.query;

    const params: Record<string, any> = {
      limit,
      offset,
      sort,
      include,
    };

    if (project_id && project_id !== 'all') params.project_id = project_id;
    if (status_id && status_id !== 'all') params.status_id = status_id;
    if (assigned_to_id && assigned_to_id !== 'all') params.assigned_to_id = assigned_to_id;
    if (tracker_id && tracker_id !== 'all') params.tracker_id = tracker_id;
    if (fixed_version_id && fixed_version_id !== 'all') params.fixed_version_id = fixed_version_id;
    if (priority_id && priority_id !== 'all') params.priority_id = priority_id;

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

app.get('/api/redmine/time_entries', async (req: Request, res: Response) => {
  try {
    const { project_id, limit = '100' } = req.query;
    const params: Record<string, any> = { limit };
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
    const { mode, projectName, issues, statistics } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not set in environment.' });
    }
    const ai = new GoogleGenAI({ apiKey });

    let prompt = '';
    if (mode === 'standup') {
      prompt = `Bạn là Trợ lý PM cho dự án "${projectName}".
Thống kê: ${JSON.stringify(statistics || {})}
Dữ liệu: ${JSON.stringify(issues?.slice(0, 30) || [])}
Hãy viết báo cáo Standup hàng ngày cô đọng bằng Tiếng Việt gồm 4 phần: Tổng quan, Việc đang làm, Điểm nghẽn rủi ro, Hành động khuyến nghị.`;
    } else {
      prompt = `Bạn là Chuyên gia PM Audit cho dự án "${projectName}".
Thống kê: ${JSON.stringify(statistics || {})}
Dữ liệu: ${JSON.stringify(issues?.slice(0, 35) || [])}
Hãy phân tích rủi ro, cảnh báo quá hạn, phân bổ tải công việc và đề xuất giải pháp.`;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    return res.json({ result: response.text });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'AI generation failed' });
  }
});

export default app;
