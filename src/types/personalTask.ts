export type TaskPriority = 'urgent' | 'high' | 'normal' | 'low';
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done' | 'deferred';

export interface PersonalTask {
  id: string;
  week: string; // e.g. "Tuần 09 (24/2-27/02)"
  assignedDate: string; // e.g. "2026-02-24" or "24/02/2026"
  category: string; // Nhóm việc: Platform, HOTFIX, Quản trị, BIM...
  title: string; // Tên việc cần làm
  description: string; // Mô tả chi tiết
  priority: TaskPriority; // Mức độ ưu tiên
  estimatedHours?: string | number; // Thời lượng
  status: TaskStatus; // Trạng thái
  resultNote: string; // Kết quả công việc / Ghi chú tiến độ
  dueDate: string; // Deadline
  delayReason?: string; // Lý do trễ hạn
  source: 'excel' | 'manual' | 'redmine';
  redmineIssueId?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExcelColumnMapping {
  weekCol: number; // -1 if not mapped
  assignedDateCol: number;
  categoryCol: number;
  titleCol: number;
  descriptionCol: number;
  priorityCol: number;
  estimatedHoursCol: number;
  statusCol: number;
  resultNoteCol: number;
  dueDateCol: number;
  delayReasonCol: number;
}

export interface ExcelParsedSheet {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
  totalRows: number;
}

export interface PersonalTaskFilter {
  search: string;
  week: string;
  category: string;
  status: string;
  priority: string;
  overdueOnly: boolean;
}
