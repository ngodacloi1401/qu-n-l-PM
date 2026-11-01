import type { TechRadarArticle, TechRadarCategory } from '../types/techRadar';

export interface GetArticlesParams {
  category?: TechRadarCategory | string;
  date?: string;
  search?: string;
  bookmarked?: boolean;
  limit?: number;
  offset?: number;
}

export interface GetArticlesResponse {
  ok: boolean;
  articles: TechRadarArticle[];
  total: number;
  todayCount: number;
  error?: string;
}

export async function fetchRadarArticles(params?: GetArticlesParams): Promise<GetArticlesResponse> {
  const query = new URLSearchParams();
  if (params?.category && params.category !== 'all') query.append('category', params.category);
  if (params?.date && params.date !== 'all') query.append('date', params.date);
  if (params?.search && params.search.trim()) query.append('search', params.search.trim());
  if (params?.bookmarked) query.append('bookmarked', 'true');
  if (params?.limit) query.append('limit', String(params.limit));
  if (params?.offset) query.append('offset', String(params.offset));

  const url = `/api/tech-radar/articles${query.toString() ? `?${query.toString()}` : ''}`;
  const res = await fetch(url);
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Lỗi khi tải tin tức (${res.status})`);
  }
  return res.json();
}

export async function updateRadarArticle(id: string, updates: Partial<TechRadarArticle>): Promise<TechRadarArticle> {
  const res = await fetch(`/api/tech-radar/articles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(updates),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Lỗi khi cập nhật bài viết (${res.status})`);
  }

  const data = await res.json();
  return data.article;
}

export async function ingestRadarArticles(articles: Array<Partial<TechRadarArticle>>): Promise<{ added: number; updated: number }> {
  const res = await fetch('/api/tech-radar/articles', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ articles }),
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Lỗi khi nạp bài viết (${res.status})`);
  }

  return res.json();
}

export async function seedSampleRadarArticles(): Promise<void> {
  const res = await fetch('/api/tech-radar/seed', { method: 'POST' });
  if (!res.ok) {
    throw new Error('Không thể khởi tạo dữ liệu mẫu');
  }
}
