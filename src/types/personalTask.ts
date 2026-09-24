export interface PersonalTask {
  id: string;
  week: string; // e.g. "Tuần 09 (24/2-27/02)"
  assignedDate: string; // Start date (YYYY-MM-DD)
  category: string; // Category / Nhóm việc (e.g. CAD ADDIN SHOP DRAWING, Platform, HOTFIX...)
  title: string; // Subject / Tên việc cần làm
  description: string; // Mô tả chi tiết

  // Redmine Aligned Fields:
  trackerId?: number; // e.g. 6 (Bug), 4 (Task), 1 (User Story), 16 (Feature)...
  trackerName?: string; // e.g. "Bug", "Task", "Feature"
  statusId?: number;
  statusName: string; // e.g. "New", "In Progress", "Resolved", "Feedback", "Closed"...
  priorityId?: number;
  priorityName: string; // e.g. "Normal", "High", "Urgent", "Must Have", "Should Have"...

  assigneeId?: number;
  assigneeName?: string;
  parentTaskId?: string | number; // e.g. 41470
  targetVersionId?: number;
  targetVersionName?: string;
  doneRatio?: number; // 0 - 100%
  estimatedHours?: string | number; // Giờ ước tính (Hours)

  // Custom fields per tracker (Regression Bug, Not bug, Review, Report By, Story points, ProjectCode...):
  customFields?: Record<string, any>;

  resultNote: string; // Kết quả công việc / Ghi chú tiến độ
  dueDate: string; // Hạn chót / Due date
  delayReason?: string; // Lý do trễ hạn
  source: 'excel' | 'manual' | 'redmine';
  redmineIssueId?: number;
  projectId?: number;
  projectName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExcelColumnMapping {
  weekCol: number;
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
  trackerCol?: number;
  parentTaskCol?: number;
  doneRatioCol?: number;
}

export interface ExcelParsedSheet {
  name: string;
  headers: string[];
  rows: (string | number | null)[][];
  totalRows: number;
}
