import type { PersonalTask } from '../types/personalTask';
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
 * Chuyển một thông báo Slack thành bản nháp PersonalTask để đưa vào Bảng Việc Cá Nhân
 */
export function convertSlackAlertToTaskDraft(
  alert: SlackAlertItem,
  userName?: string
): Omit<PersonalTask, 'id' | 'createdAt' | 'updatedAt'> {
  const now = new Date();
  const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  
  // Trích xuất tiêu đề ngắn gọn
  let cleanTitle = alert.cleanText
    .replace(/<@[A-Z0-9]+>/g, '')
    .replace(/https?:\/\/[^\s]+/g, '')
    .trim();
  if (cleanTitle.length > 80) {
    cleanTitle = cleanTitle.substring(0, 77) + '...';
  }
  if (!cleanTitle) {
    cleanTitle = alert.title.replace(/^[💬📢🎥🚨\[\]\w\s:]+/, '').trim() || 'Xử lý yêu cầu từ Slack';
  }

  // Dự đoán độ ưu tiên
  const isUrgent = alert.urgency === 'Cao' || Boolean(alert.meetUrl) || /gấp|khẩn|urgent|trong ngày/i.test(alert.cleanText);

  // Dự đoán hạn chót: Nếu có chữ "trong ngày" hoặc hôm nay thì là hôm nay 18:00
  const defaultDueDate = `${todayStr} 18:00`;

  return {
    week: `Tuần ${Math.ceil(now.getDate() / 7)} (${todayStr})`,
    assignedDate: todayStr,
    category: alert.meetUrl ? 'Họp trực tuyến' : 'Slack Action',
    title: `[Slack @${alert.senderName}] ${cleanTitle}`,
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
  };
}
