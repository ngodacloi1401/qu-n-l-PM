import type { PersonalTask } from '../types/personalTask';

const STORAGE_KEY = 'personal_tasks_data_v1';
const TEMPLATE_MAPPING_KEY = 'personal_task_excel_mapping_v1';

export const INITIAL_SAMPLE_TASKS: PersonalTask[] = [
  {
    id: 'sample_task_1',
    week: 'Tuần 09 (24/2-27/02)',
    assignedDate: '2026-02-24',
    category: 'Platform',
    title: 'Xem lại template standard',
    description: '1. Áp dụng template để hoàn thiện issue trên Redmine\n2. Hướng dẫn nhóm triển khai và đối soát checklist',
    priority: 'high',
    estimatedHours: '2.5',
    status: 'in_progress',
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
    category: 'HOTFIX',
    title: 'Fix issue tạo subtask không hiển thị người nhận',
    description: 'Xử lý lỗi subtask khi tạo từ modal giao việc không hiển thị danh sách người gán',
    priority: 'urgent',
    estimatedHours: '1.5',
    status: 'in_progress',
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
    title: 'Xây dựng phương án tích hợp quản lý đầu việc cá nhân',
    description: 'Nghiên cứu cơ chế đọc file Excel linh hoạt, map cột tự động và gom việc Redmine về một màn hình',
    priority: 'high',
    estimatedHours: '4.0',
    status: 'done',
    resultNote: 'Đã hoàn thiện prototype và giao diện quản lý đầu việc',
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
    title: 'Đánh giá KPI và báo cáo tiến độ tuần',
    description: 'Tổng hợp số giờ OT, tỷ lệ hoàn thành công việc và gửi ban điều hành',
    priority: 'normal',
    estimatedHours: '2.0',
    status: 'todo',
    resultNote: 'Chuẩn bị dữ liệu từ hệ thống',
    dueDate: '2026-03-06',
    delayReason: '',
    source: 'manual',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

export function getSavedTasks(): PersonalTask[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      // Save initial sample on first launch
      localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_SAMPLE_TASKS));
      return INITIAL_SAMPLE_TASKS;
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : INITIAL_SAMPLE_TASKS;
  } catch (err) {
    console.error('Failed to load personal tasks from localStorage', err);
    return INITIAL_SAMPLE_TASKS;
  }
}

export function saveTasks(tasks: PersonalTask[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
  } catch (err) {
    console.error('Failed to save personal tasks to localStorage', err);
  }
}

export function getSavedMappingTemplate(): Record<string, any> | null {
  try {
    const raw = localStorage.getItem(TEMPLATE_MAPPING_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveMappingTemplate(mapping: Record<string, any>): void {
  try {
    localStorage.setItem(TEMPLATE_MAPPING_KEY, JSON.stringify(mapping));
  } catch {}
}
