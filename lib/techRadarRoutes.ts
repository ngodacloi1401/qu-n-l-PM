import type { Express, Request, Response } from 'express';
import {
  getAllArticles,
  addArticles,
  updateArticle,
  deleteArticle,
  seedSampleArticles,
} from './techRadarService.js';

export function registerTechRadarRoutes(app: Express) {
  // 1. Get articles list with filtering and search
  app.get('/api/tech-radar/articles', (req: Request, res: Response) => {
    try {
      const category = (req.query.category as string) || undefined;
      const date = (req.query.date as string) || undefined;
      const timeRange = (req.query.timeRange as string) || (req.query.range as string) || undefined;
      const month = (req.query.month as string) || undefined;
      const week = (req.query.week as string) || undefined;
      const search = (req.query.search as string) || undefined;
      const bookmarkedOnly = req.query.bookmarked === 'true' || req.query.bookmarked === '1';
      const limit = req.query.limit ? Number(req.query.limit) : 100;
      const offset = req.query.offset ? Number(req.query.offset) : 0;

      const result = getAllArticles({
        category,
        date,
        timeRange,
        month,
        week,
        search,
        bookmarkedOnly,
        limit,
        offset,
      });

      return res.json({
        ok: true,
        ...result,
      });
    } catch (error: any) {
      console.error('[TechRadarRoute] Error getting articles:', error);
      return res.status(500).json({ ok: false, error: error.message || 'Lỗi khi tải danh sách điểm tin' });
    }
  });

  // 2. Ingest one or multiple articles automatically from bot / agent / cron
  app.post('/api/tech-radar/articles', (req: Request, res: Response) => {
    try {
      const body = req.body;
      let itemsToIngest: any[] = [];

      if (Array.isArray(body)) {
        itemsToIngest = body;
      } else if (Array.isArray(body?.articles)) {
        itemsToIngest = body.articles;
      } else if (body && typeof body === 'object') {
        itemsToIngest = [body];
      }

      if (itemsToIngest.length === 0) {
        return res.status(400).json({
          ok: false,
          error: 'Vui lòng cung cấp ít nhất 1 bài viết trong payload (định dạng object hoặc mảng articles)',
        });
      }

      const validItems = itemsToIngest.filter((item) => item && typeof item.title === 'string' && item.title.trim().length > 0);
      if (validItems.length === 0) {
        return res.status(400).json({
          ok: false,
          error: 'Bài viết không hợp lệ: tiêu đề (title) là bắt buộc',
        });
      }

      const { added, updated } = addArticles(validItems);

      return res.status(201).json({
        ok: true,
        message: `Đã nạp thành công ${added} bài viết mới, cập nhật ${updated} bài viết`,
        added,
        updated,
      });
    } catch (error: any) {
      console.error('[TechRadarRoute] Error ingesting articles:', error);
      return res.status(500).json({ ok: false, error: error.message || 'Lỗi khi nạp bài viết điểm tin' });
    }
  });

  // 3. Update article status (isBookmarked, isRead, etc.)
  app.patch('/api/tech-radar/articles/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const updates = req.body || {};

      const updated = updateArticle(id, updates);
      if (!updated) {
        return res.status(404).json({ ok: false, error: 'Không tìm thấy bài viết với id tương ứng' });
      }

      return res.json({ ok: true, article: updated });
    } catch (error: any) {
      console.error('[TechRadarRoute] Error updating article:', error);
      return res.status(500).json({ ok: false, error: error.message || 'Lỗi khi cập nhật bài viết' });
    }
  });

  // 4. Delete article
  app.delete('/api/tech-radar/articles/:id', (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const ok = deleteArticle(id);
      if (!ok) {
        return res.status(404).json({ ok: false, error: 'Không tìm thấy bài viết cần xóa' });
      }
      return res.json({ ok: true, message: 'Đã xóa bài viết thành công' });
    } catch (error: any) {
      console.error('[TechRadarRoute] Error deleting article:', error);
      return res.status(500).json({ ok: false, error: error.message || 'Lỗi khi xóa bài viết' });
    }
  });

  // 5. Seed sample articles for demonstration
  app.post('/api/tech-radar/seed', (_req: Request, res: Response) => {
    try {
      const { count } = seedSampleArticles();
      return res.json({ ok: true, message: `Đã khởi tạo thành công ${count} bài viết điểm tin AI mẫu`, count });
    } catch (error: any) {
      console.error('[TechRadarRoute] Error seeding articles:', error);
      return res.status(500).json({ ok: false, error: error.message || 'Lỗi khi khởi tạo dữ liệu mẫu' });
    }
  });
}
