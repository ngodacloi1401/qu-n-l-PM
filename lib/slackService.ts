import fs from 'fs';
import path from 'path';

export interface SlackAlertItem {
  id: string;
  channelId: string;
  channelName: string;
  senderName: string;
  senderId?: string;
  title: string;
  summary: string;
  cleanText: string;
  ts: string;
  timeStr: string;
  urgency: 'Cao' | 'Trung bình' | 'Thấp';
  category: string;
  reason?: string;
  meetUrl?: string | null;
  slackUrl: string;
}

export interface SlackAuthTestResult {
  ok: boolean;
  user?: string;
  userId?: string;
  team?: string;
  url?: string;
  message?: string;
  matchedAlertsCount?: number;
  error?: string;
}

/**
 * Kiểm tra tính hợp lệ của Slack User OAuth Token (xoxp-...) HOẶC Slack Member ID cá nhân (U0...)
 */
export async function testSlackConnection(
  options: { token?: string; memberId?: string } | string
): Promise<SlackAuthTestResult> {
  const token = typeof options === 'string' ? options : options?.token;
  const memberId = typeof options === 'string' ? undefined : options?.memberId;

  // 1. Kiểm tra bằng Slack Token nếu có
  if (token && typeof token === 'string' && token.trim()) {
    try {
      const res = await fetch('https://slack.com/api/auth.test', {
        headers: {
          Authorization: `Bearer ${token.trim()}`,
        },
        signal: AbortSignal.timeout(6000),
      });

      const data: any = await res.json();
      if (data.ok) {
        return {
          ok: true,
          user: data.user,
          userId: data.user_id,
          team: data.team,
          url: data.url,
          message: `Kết nối thành công với tài khoản Slack @${data.user} (Workspace: ${data.team || 'AnyBIM'}, ID: ${data.user_id})!`,
        };
      }

      return {
        ok: false,
        error: data.error ? `Slack từ chối: ${data.error}` : 'Xác thực Slack không thành công.',
      };
    } catch (err: any) {
      return {
        ok: false,
        error: `Không thể kết nối đến máy chủ Slack API: ${err.message || 'Lỗi mạng hoặc Timeout'}`,
      };
    }
  }

  // 2. Kiểm tra bằng Member ID (Không cần token)
  if (memberId && typeof memberId === 'string' && memberId.trim()) {
    const cleanId = memberId.trim().toUpperCase();
    if (!/^U[A-Z0-9]{8,}$/.test(cleanId)) {
      return {
        ok: false,
        error: 'Định dạng Slack Member ID không hợp lệ (Member ID thường bắt đầu bằng chữ U và có ít nhất 9 ký tự, ví dụ: U0BJ70JNERZ). Vui lòng kiểm tra lại trên Slack.',
      };
    }

    const localAlerts = getLocalSlackAlerts();
    const matched = localAlerts.filter((a) =>
      a.cleanText.toUpperCase().includes(cleanId) ||
      a.cleanText.toUpperCase().includes(`<@${cleanId}>`) ||
      a.senderId?.toUpperCase() === cleanId
    );

    return {
      ok: true,
      userId: cleanId,
      user: cleanId,
      matchedAlertsCount: matched.length,
      message: `Đã nhận diện hợp lệ Member ID: ${cleanId}. Hệ thống sẽ lọc chính xác các thông báo cá nhân, lịch họp Google Meet và thông báo kênh cho bạn (hiện tìm thấy ${matched.length} tin nhắn trực tiếp liên quan)!`,
    };
  }

  return {
    ok: false,
    error: 'Vui lòng nhập ít nhất 1 trong 2: Slack User Token hoặc Slack Member ID.',
  };
}

/**
 * Nạp thông báo từ file local public/data/slack_alerts.json
 */
export function getLocalSlackAlerts(): SlackAlertItem[] {
  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'slack_alerts.json');
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (err) {
    console.warn('Lỗi khi đọc file slack_alerts.json:', err);
  }
  return [];
}

/**
 * Lấy danh sách thông báo Slack cá nhân hóa cho từng user:
 * 1. Nếu có token: Thử gọi Slack Web API (search.messages) để lấy tin nhắn mention & Google Meet
 * 2. Nếu có memberId/userName hoặc token search thất bại: Lọc danh sách thông báo theo ID/Name của user
 * 3. Mặc định fallback: Trả về danh sách thông báo công khai / lịch họp
 */
export async function getPersonalSlackAlerts(options: {
  token?: string;
  memberId?: string;
  userName?: string;
}): Promise<SlackAlertItem[]> {
  const { token, memberId, userName } = options;
  const localAlerts = getLocalSlackAlerts();

  // 1. Nếu người dùng cấu hình Slack Token cá nhân: Thử truy vấn live
  if (token && token.trim()) {
    try {
      let resolvedMemberId = memberId?.trim();
      if (!resolvedMemberId) {
        const auth = await testSlackConnection({ token: token.trim() });
        if (auth.ok && auth.userId) {
          resolvedMemberId = auth.userId;
        }
      }

      const queryParts: string[] = ['meet.google.com'];
      if (resolvedMemberId) {
        queryParts.push(`<@${resolvedMemberId}>`);
      }
      if (userName && userName.trim()) {
        queryParts.push(`@${userName.trim()}`);
      }

      const query = queryParts.join(' OR ');
      const searchRes = await fetch(
        `https://slack.com/api/search.messages?query=${encodeURIComponent(query)}&sort=timestamp&sort_dir=desc&count=25`,
        {
          headers: {
            Authorization: `Bearer ${token.trim()}`,
          },
          signal: AbortSignal.timeout(6000),
        }
      );

      if (searchRes.ok) {
        const searchData: any = await searchRes.json();
        if (searchData.ok && searchData.messages?.matches && searchData.messages.matches.length > 0) {
          const liveAlerts: SlackAlertItem[] = searchData.messages.matches.map((m: any) => {
            const rawText = m.text || '';
            const meetMatch = rawText.match(/https?:\/\/meet\.google\.com\/[a-zA-Z0-9_-]+/);
            const isUrgent =
              rawText.toLowerCase().includes('khẩn') ||
              rawText.toLowerCase().includes('urgent') ||
              Boolean(meetMatch) ||
              rawText.includes('@channel') ||
              rawText.includes('@here');

            const date = new Date(parseFloat(m.ts || '0') * 1000);
            const timeStr = !isNaN(date.getTime())
              ? `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')} ${date.getDate()}/${date.getMonth() + 1}`
              : 'Gần đây';

            return {
              id: `${m.channel?.id || 'ch'}:${m.ts || Date.now()}`,
              channelId: m.channel?.id || '',
              channelName: m.channel?.name ? `#${m.channel.name}` : '#slack',
              senderName: m.username || m.user || 'Slack User',
              senderId: m.user,
              title: meetMatch
                ? '🎥 [Lịch họp / Google Meet]'
                : isUrgent
                ? '🚨 [Thông báo Khẩn / Mention]'
                : '💬 [Tin nhắn Slack]',
              summary: rawText.length > 140 ? rawText.slice(0, 140) + '...' : rawText,
              cleanText: rawText,
              ts: m.ts || String(Date.now() / 1000),
              timeStr,
              urgency: (isUrgent ? 'Cao' : 'Trung bình') as 'Cao' | 'Trung bình' | 'Thấp',
              category: meetMatch ? 'Họp trực tuyến' : 'Thông báo',
              reason: meetMatch ? 'Google Meet Link' : isUrgent ? 'Direct Mention / Alert' : 'Discussion',
              meetUrl: meetMatch ? meetMatch[0] : null,
              slackUrl:
                m.permalink ||
                `https://slack.com/archives/${m.channel?.id}/p${(m.ts || '').replace('.', '')}`,
            };
          });

          return liveAlerts;
        }
      }
    } catch (err) {
      console.warn('Không thể truy vấn live từ Slack API, sử dụng bộ lọc fallback:', err);
    }
  }

  // 2. Lọc danh sách thông báo theo Member ID hoặc Tên nếu có
  if (memberId || userName) {
    const targetId = memberId?.trim().toLowerCase();
    const targetName = userName?.trim().toLowerCase();

    const filtered = localAlerts.filter((item) => {
      // Luôn giữ các tin có link Google Meet và thông báo toàn kênh (@channel, @here)
      if (item.meetUrl) return true;
      if (item.cleanText.includes('@channel') || item.cleanText.includes('@here')) return true;

      const text = item.cleanText.toLowerCase();
      if (targetId && text.includes(targetId)) return true;
      if (targetName && (text.includes(`@${targetName}`) || text.includes(targetName))) return true;

      return false;
    });

    if (filtered.length > 0) {
      return filtered;
    }
  }

  // 3. Fallback mặc định
  return localAlerts;
}
