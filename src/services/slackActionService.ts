import type { PersonalTask, SubTaskItem } from '../types/personalTask';
import type { SlackAlertItem } from '../components/WeeklyNotificationDropdown';

export type SlackActionStatus = 'pending' | 'in_progress' | 'done';

const STORAGE_PREFIX = 'pm_slack_action_status_v1';

function getStorageKey(userId?: number | string | null): string {
  if (userId) return `${STORAGE_PREFIX}_uid_${userId}`;
  return `${STORAGE_PREFIX}_default`;
}

/**
 * Lấy toàn bộ bảng ánh xạ trạng thái xử lý các tin nhắn Slack của người dùng
 */
export function getSlackHandledMap(userId?: number | string | null): Record<string, SlackActionStatus> {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Lỗi khi đọc trạng thái xử lý Slack:', err);
  }
  return {};
}

/**
 * Lưu hoặc cập nhật trạng thái xử lý của một thông báo Slack
 */
export function setSlackItemStatus(
  alertId: string,
  status: SlackActionStatus,
  userId?: number | string | null
): Record<string, SlackActionStatus> {
  const current = getSlackHandledMap(userId);
  if (status === 'pending') {
    delete current[alertId];
  } else {
    current[alertId] = status;
  }
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(current));
  } catch (err) {
    console.warn('Lỗi khi lưu trạng thái xử lý Slack:', err);
  }
  return { ...current };
}

/**
 * Đổi trạng thái xử lý giữa 'done' và 'pending'
 */
export function toggleSlackItemDone(
  alertId: string,
  userId?: number | string | null
): Record<string, SlackActionStatus> {
  const current = getSlackHandledMap(userId);
  const nextStatus: SlackActionStatus = current[alertId] === 'done' ? 'pending' : 'done';
  return setSlackItemStatus(alertId, nextStatus, userId);
}

/**
 * Làm sạch nội dung tin nhắn Slack thành tiêu đề công việc gọn gàng chuẩn Trello/Notion
 */
export function cleanSlackTaskTitle(rawText: string, fallbackTitle?: string): string {
  let cleaned = (rawText || '')
    .replace(/<@[A-Z0-9]+>/g, '') // remove Slack user IDs <@U0123>
    .replace(/<!(?:channel|here|everyone)>/gi, '') // remove special tags <!channel>
    .replace(/@(channel|here|everyone)\b/gi, '') // remove @channel, @here, @everyone
    .replace(/https?:\/\/[^\s]+/g, '') // remove URLs
    .replace(/^[💬📢🎥🚨\[\]\w\s:]*?([A-Za-z0-9\p{L}])/u, '$1') // strip leading emoji prefixes
    .replace(/\s+/g, ' ')
    .trim();

  // Strip leading user mentions like "@User Name:" or "@User:"
  cleaned = cleaned.replace(/^@[\p{L}\w\s_.-]+?:\s*/u, '').trim();

  // Capitalize first letter
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
  }

  if (cleaned.length > 85) {
    cleaned = cleaned.substring(0, 82) + '...';
  }

  if (!cleaned && fallbackTitle) {
    cleaned = fallbackTitle.replace(/^[💬📢🎥🚨\[\]\w\s:]+/, '').trim();
  }

  return cleaned || 'Xử lý yêu cầu từ Slack';
}

/**
 * Trích xuất danh sách công việc con (Checklist) từ nội dung tin nhắn Slack
 */
export function extractSlackSubtasks(text: string, isMeet: boolean, senderName: string): SubTaskItem[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const bulletItems: string[] = [];

  for (const line of lines) {
    const match = line.match(/^[-*•]\s+(.+)$/) || line.match(/^\d+[.)]\s+(.+)$/);
    if (match && match[1].trim().length > 2) {
      bulletItems.push(match[1].trim());
    }
  }

  if (bulletItems.length > 0) {
    return bulletItems.map((item, idx) => ({
      id: `st_${Date.now()}_${idx}`,
      title: item,
      completed: false,
    }));
  }

  if (isMeet) {
    return [
      { id: `st_${Date.now()}_1`, title: 'Tham gia họp Google Meet đúng giờ', completed: false },
      { id: `st_${Date.now()}_2`, title: 'Tổng kết nội dung & hành động tiếp theo', completed: false },
    ];
  }

  return [
    { id: `st_${Date.now()}_1`, title: 'Xem xét và xử lý nội dung yêu cầu', completed: false },
    { id: `st_${Date.now()}_2`, title: `Phản hồi xác nhận cho @${senderName} trên Slack`, completed: false },
  ];
}

/**
 * Chuyển một thông báo Slack thành bản nháp PersonalTask để đưa vào Bảng Việc Cá Nhân
 */
export function convertSlackAlertToTaskDraft(
  alert: SlackAlertItem,
  userName?: string
): Omit<PersonalTask, 'id' | 'createdAt' | 'updatedAt'> {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  // Trích xuất tiêu đề gọn gàng chuẩn Notion/Trello
  const cleanTitle = cleanSlackTaskTitle(alert.cleanText, alert.title);

  // Dự đoán độ ưu tiên
  const isUrgent = alert.urgency === 'Cao' || Boolean(alert.meetUrl) || /gấp|khẩn|urgent|trong ngày/i.test(alert.cleanText);

  // Dự đoán hạn chót: Nếu có chữ "trong ngày" hoặc hôm nay thì là hôm nay 18:00
  const defaultDueDate = `${todayStr} 18:00`;

  // Tạo sẵn checklist subtasks Trello-style
  const subtasks = extractSlackSubtasks(alert.cleanText, Boolean(alert.meetUrl), alert.senderName);

  return {
    week: `Tuần ${Math.ceil(now.getDate() / 7)} (${todayStr})`,
    assignedDate: todayStr,
    category: alert.meetUrl ? 'Họp trực tuyến' : 'Slack Action',
    title: cleanTitle,
    description: `Nội dung gốc từ Slack (${alert.channelName}):\n${alert.cleanText}\n\nNgười gửi: ${alert.senderName}\nThời gian: ${alert.timeStr}\nLink Slack: ${alert.slackUrl}`,
    statusName: 'In Progress',
    priorityName: isUrgent ? 'High' : 'Normal',
    doneRatio: 0,
    estimatedHours: alert.meetUrl ? 1 : 2,
    resultNote: `Tạo từ thông báo Slack (${alert.timeStr}). Cần xác nhận phản hồi sau khi hoàn thành.`,
    dueDate: defaultDueDate,
    source: 'slack',
    slackUrl: alert.slackUrl,
    slackSender: alert.senderName,
    assigneeName: userName,
    subtasks,
  };
}

