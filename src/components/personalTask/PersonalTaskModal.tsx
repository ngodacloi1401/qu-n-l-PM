import React, { useState } from 'react';
import { X, Check, Calendar, Clock, AlertCircle, FileText, CheckCircle2, Flame, Folder } from 'lucide-react';
import type { PersonalTask } from '../../types/personalTask';
import type { RedmineStatus, RedminePriority } from '../../types/redmine';

interface PersonalTaskModalProps {
  task: PersonalTask | null;
  existingWeeks?: string[];
  existingCategories?: string[];
  statuses?: RedmineStatus[];
  priorities?: RedminePriority[];
  // Backwards compatibility props (ignored for personal tasks)
  trackers?: any[];
  customFields?: any[];
  categories?: any[];
  versions?: any[];
  memberships?: any[];
  projects?: any[];
  currentUser?: any;
  onClose: () => void;
  onSave: (task: PersonalTask) => void;
  onDelete?: (id: string) => void;
}

const DEFAULT_STATUSES = [
  'New',
  'In Progress',
  'Resolved',
  'Closed',
  'Feedback',
];

const DEFAULT_PRIORITIES = [
  'Low',
  'Normal',
  'High',
  'Urgent',
];

export const PersonalTaskModal: React.FC<PersonalTaskModalProps> = ({
  task,
  existingWeeks = [],
  existingCategories = [],
  statuses,
  priorities,
  onClose,
  onSave,
  onDelete,
}) => {
  // Available status and priority options
  const statusOptions = statuses && statuses.length > 0 ? statuses.map((s) => s.name) : DEFAULT_STATUSES;
  const priorityOptions = priorities && priorities.length > 0 ? priorities.map((p) => p.name) : DEFAULT_PRIORITIES;

  // Personal Task Core Fields
  const [title, setTitle] = useState(task?.title || '');
  const [category, setCategory] = useState<string>(task?.category || 'Công việc chung');
  const [week, setWeek] = useState(
    task?.week ||
      existingWeeks[0] ||
      (() => {
        const d = new Date();
        return `Tuần ${String(Math.ceil(d.getDate() / 7)).padStart(2, '0')}`;
      })
  );
  const [statusName, setStatusName] = useState<string>(task?.statusName || statusOptions[0] || 'New');
  const [priorityName, setPriorityName] = useState<string>(task?.priorityName || 'Normal');
  const [assignedDate, setAssignedDate] = useState(task?.assignedDate || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [estimatedHours, setEstimatedHours] = useState(
    task?.estimatedHours !== undefined ? String(task.estimatedHours) : ''
  );
  const [doneRatio, setDoneRatio] = useState<number>(task?.doneRatio !== undefined ? task.doneRatio : 0);
  const [description, setDescription] = useState(task?.description || '');
  const [resultNote, setResultNote] = useState(task?.resultNote || '');
  const [delayReason, setDelayReason] = useState(task?.delayReason || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập Tiêu đề công việc cá nhân');
      return;
    }

    const nowStr = new Date().toISOString();
    const updatedTask: PersonalTask = {
      id: task?.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      week: week.trim() || 'Kế hoạch tuần',
      assignedDate: assignedDate || nowStr.split('T')[0],
      category: category.trim() || 'Chung',
      title: title.trim(),
      description: description.trim(),
      statusName,
      priorityName,
      doneRatio,
      estimatedHours: estimatedHours.trim() || undefined,
      resultNote: resultNote.trim(),
      dueDate,
      delayReason: delayReason.trim(),
      source: task?.source === 'excel' ? 'excel' : 'manual',
      createdAt: task?.createdAt || nowStr,
      updatedAt: nowStr,
    };

    onSave(updatedTask);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-900 to-teal-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                {task ? 'Chỉnh sửa việc cá nhân' : 'Tạo mới việc cá nhân / Excel'}
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                  Kế hoạch độc lập
                </span>
              </h3>
              <p className="text-xs text-emerald-200/80">
                Quản lý tiến độ cá nhân, deadline và ghi chú thực hiện (không phụ thuộc Redmine)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-emerald-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Subject */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Tên / Tiêu đề công việc <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Hoàn thiện hồ sơ nghiệm thu CAD tầng 3, Báo cáo tiến độ tuần..."
              className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
              autoFocus
            />
          </div>

          {/* Row 1: Category & Week */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nhóm việc / Dự án cá nhân:
              </label>
              <input
                type="text"
                list="modal-cat-datalist"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="VD: CAD Shop Drawing, Platform, Báo cáo..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-medium text-slate-800 bg-white"
              />
              <datalist id="modal-cat-datalist">
                {existingCategories.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Đợt / Tuần kế hoạch:
              </label>
              <input
                type="text"
                list="modal-week-datalist"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                placeholder="VD: Tuần 09, Đợt 1..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-medium text-slate-800 bg-white"
              />
              <datalist id="modal-week-datalist">
                {existingWeeks.map((w) => (
                  <option key={w} value={w} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Row 2: Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Trạng thái:
              </label>
              <select
                value={statusName}
                onChange={(e) => setStatusName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-white"
              >
                {statusOptions.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mức ưu tiên:
              </label>
              <select
                value={priorityName}
                onChange={(e) => setPriorityName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-white"
              >
                {priorityOptions.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Row 3: Assigned Date & Deadline */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Ngày bắt đầu:
              </label>
              <input
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hạn chót (Deadline):
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Row 4: Done Ratio (% Hoàn thành) & Estimated Hours */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Tiến độ hoàn thành:</label>
                <span className="text-xs font-bold text-emerald-700">{doneRatio}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={doneRatio}
                onChange={(e) => setDoneRatio(Number(e.target.value))}
                className="w-full accent-emerald-600 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thời lượng ước tính (Giờ):
              </label>
              <input
                type="text"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="VD: 4h, 8h, 16h..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800 bg-white"
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mô tả chi tiết / Các bước thực hiện:
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú chi tiết checklist, yêu cầu cần đạt..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {/* Result Note & Delay Reason */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kết quả thực hiện / Ghi chú:
              </label>
              <textarea
                rows={2}
                value={resultNote}
                onChange={(e) => setResultNote(e.target.value)}
                placeholder="Kết quả hoàn thành, file đính kèm hoặc vướng mắc..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Lý do trễ hạn (nếu có):
              </label>
              <textarea
                rows={2}
                value={delayReason}
                onChange={(e) => setDelayReason(e.target.value)}
                placeholder="Nguyên nhân trễ hẹn, phụ thuộc bên thứ 3..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            {task && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Bạn có chắc muốn xóa công việc này?')) {
                    onDelete(task.id);
                    onClose();
                  }
                }}
                className="px-3 py-1.5 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-bold transition-colors cursor-pointer"
              >
                Xóa việc
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{task ? 'Lưu thay đổi' : 'Tạo việc cá nhân'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
