import type { PersonalTask } from '../types/personalTask';

const STORAGE_KEY_PREFIX = 'personal_tasks_data_v2';

/**
 * Generate a short, stable hash string from a string.
 */
function hashKey(str: string): string {
  if (!str) return 'default';
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Build a user-scoped key based on Redmine user ID, login, or API key.
 * This guarantees complete data isolation between different Redmine accounts.
 */
export function getUserScopeKey(
  currentUser?: { id?: number; login?: string; firstname?: string; lastname?: string } | null,
  apiKey?: string
): string {
  if (currentUser?.id) {
    return `${STORAGE_KEY_PREFIX}_uid_${currentUser.id}`;
  }
  if (currentUser?.login) {
    return `${STORAGE_KEY_PREFIX}_login_${currentUser.login.toLowerCase()}`;
  }
  const key = apiKey || (() => {
    try {
      return localStorage.getItem('redmine_pm_api_key') || '';
    } catch {
      return '';
    }
  })();
  if (key) {
    return `${STORAGE_KEY_PREFIX}_key_${hashKey(key)}`;
  }
  return `${STORAGE_KEY_PREFIX}_default`;
}

/**
 * Generate initial sample tasks, customized to the current user's name if known.
 */
export function getInitialSampleTasks(userName?: string): PersonalTask[] {
  const assignee = userName?.trim() || 'Tôi';
  return [
    {
      id: 'sample_task_1',
      week: 'Tuần 09 (24/2-27/02)',
      assignedDate: '2026-02-24',
      category: 'CAD ADDIN SHOP DRAWING',
      trackerId: 6,
      trackerName: 'Bug',
      title: '[Product] Tạo bộ hồ sơ căn hộ - các phân hệ nằm nhiều vị trí trong Model',
      description: '1. Áp dụng template để hoàn thiện issue trên Redmine\n2. Hướng dẫn nhóm triển khai và đối soát checklist',
      priorityId: 29,
      priorityName: 'Must Have',
      statusId: 2,
      statusName: 'In Progress',
      assigneeName: assignee,
      parentTaskId: 41470,
      doneRatio: 40,
      estimatedHours: '2.5',
      customFields: {
        'Regression Bug': '0',
        'Not bug': '0',
        'Review': '0',
        'Report By': 'QA/BA',
        'Bugs_step_to_reproduce': 'Yes',
        'Actual/Expect Result': 'Yes',
      },
      resultNote: 'Đang rà soát lại 3 mẫu checklist chính; dự kiến bàn giao trong tuần',
      dueDate: '2026-02-27',
      delayReason: '',
      source: 'excel',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sample_task_2',
      week: 'Tuần 09 (24/2-27/02)',
      assignedDate: '2026-02-25',
      category: 'Platform',
      trackerId: 6,
      trackerName: 'Bug',
      title: 'Fix issue tạo subtask không hiển thị người nhận',
      description: 'Xử lý lỗi subtask khi tạo từ modal giao việc không hiển thị danh sách người gán',
      priorityId: 29,
      priorityName: 'Urgent',
      statusId: 2,
      statusName: 'In Progress',
      assigneeName: assignee,
      parentTaskId: 41200,
      doneRatio: 70,
      estimatedHours: '1.5',
      customFields: {
        'Regression Bug': '1',
        'Report By': 'Planning',
      },
      resultNote: 'Đang debug luồng API dropdown; cần deploy hotfix trước 17h',
      dueDate: '2026-02-25',
      delayReason: '',
      source: 'excel',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sample_task_3',
      week: 'Tuần 09 (24/2-27/02)',
      assignedDate: '2026-02-24',
      category: 'Platform',
      trackerId: 4,
      trackerName: 'Task',
      title: 'Xây dựng phương án tích hợp quản lý đầu việc cá nhân',
      description: 'Nghiên cứu cơ chế đọc file Excel linh hoạt, map cột tự động và gom việc Redmine về một màn hình',
      priorityId: 30,
      priorityName: 'High',
      statusId: 5,
      statusName: 'Closed',
      assigneeName: assignee,
      doneRatio: 100,
      estimatedHours: '4.0',
      resultNote: 'Đã hoàn thiện prototype và giao diện quản lý đầu việc chuẩn Redmine',
      dueDate: '2026-02-26',
      delayReason: '',
      source: 'excel',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'sample_task_4',
      week: 'Tuần 10 (03/3-07/03)',
      assignedDate: '2026-03-03',
      category: 'Quản trị',
      trackerId: 1,
      trackerName: 'User Story',
      title: 'Đánh giá KPI và báo cáo tiến độ tuần',
      description: 'Tổng hợp số giờ OT, tỷ lệ hoàn thành công việc và gửi ban điều hành',
      priorityId: 30,
      priorityName: 'Normal',
      statusId: 1,
      statusName: 'New',
      assigneeName: assignee,
      doneRatio: 0,
      estimatedHours: '2.0',
      resultNote: 'Chuẩn bị dữ liệu từ hệ thống',
      dueDate: '2026-03-06',
      delayReason: '',
      source: 'manual',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
  ];
}

export const INITIAL_SAMPLE_TASKS: PersonalTask[] = getInitialSampleTasks();

/**
 * Migrate data from old non-user-scoped key to the new user-scoped key once.
 */
function migrateOldData(newKey: string): PersonalTask[] | null {
  try {
    const oldKey = STORAGE_KEY_PREFIX;
    const oldData = localStorage.getItem(oldKey);
    if (oldData) {
      const parsed = JSON.parse(oldData);
      if (Array.isArray(parsed) && parsed.length > 0) {
        localStorage.setItem(newKey, oldData);
        localStorage.removeItem(oldKey);
        return parsed;
      }
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Get saved personal tasks for the current Redmine user.
 * @param scopeKey - The user scope key from getUserScopeKey() or an API key string
 * @param userName - The display name of the user for initializing sample tasks
 */
export function getSavedTasks(scopeKey?: string, userName?: string): PersonalTask[] {
  try {
    const key = scopeKey && scopeKey.startsWith(STORAGE_KEY_PREFIX)
      ? scopeKey
      : getUserScopeKey(null, scopeKey);

    const raw = localStorage.getItem(key);
    if (!raw) {
      const migrated = migrateOldData(key);
      if (migrated) return migrated;

      const initialTasks = getInitialSampleTasks(userName);
      localStorage.setItem(key, JSON.stringify(initialTasks));
      return initialTasks;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : getInitialSampleTasks(userName);
  } catch (err) {
    console.error('Failed to load personal tasks from localStorage', err);
    return getInitialSampleTasks(userName);
  }
}

/**
 * Save personal tasks for the current Redmine user.
 * @param tasks - The tasks array to persist.
 * @param scopeKey - The user scope key from getUserScopeKey() or an API key string
 */
export function saveTasks(tasks: PersonalTask[], scopeKey?: string): void {
  try {
    const key = scopeKey && scopeKey.startsWith(STORAGE_KEY_PREFIX)
      ? scopeKey
      : getUserScopeKey(null, scopeKey);

    localStorage.setItem(key, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save personal tasks to localStorage', err);
  }
}
