import type { Express, Request, Response } from 'express';
import { testSlackConnection, getPersonalSlackAlerts } from './slackService.js';

export function registerSlackRoutes(app: Express) {
  // Test connection to Slack with user-provided token OR memberId
  app.post('/api/slack/test', async (req: Request, res: Response) => {
    try {
      const { token, memberId } = req.body || {};
      if (!token && !memberId) {
        return res.status(400).json({
          ok: false,
          error: 'Vui lòng cung cấp ít nhất 1 thông tin: Slack Token hoặc Slack Member ID',
        });
      }
      const result = await testSlackConnection({ token, memberId });
      return res.json(result);
    } catch (error: any) {
      return res.status(500).json({ ok: false, error: error.message || 'Lỗi server khi kiểm tra Slack' });
    }
  });

  // Get personalized Slack alerts
  app.get(['/api/notifications/alerts', '/api/slack/alerts'], async (req: Request, res: Response) => {
    try {
      const token = (req.headers['x-slack-token'] as string) || undefined;
      const memberId = (req.headers['x-slack-user-id'] as string) || undefined;
      const userName = (req.headers['x-user-name'] as string) || undefined;

      const alerts = await getPersonalSlackAlerts({ token, memberId, userName });
      return res.json(alerts);
    } catch (error: any) {
      return res.status(500).json({ error: error.message || 'Lỗi khi tải thông báo Slack' });
    }
  });
}
