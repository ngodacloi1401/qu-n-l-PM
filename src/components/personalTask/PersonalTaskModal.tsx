import React, { useState, useEffect } from 'react';
import { X, Check, Calendar, Clock, Tag, AlertCircle, FileText } from 'lucide-react';
import type { PersonalTask, TaskPriority, TaskStatus } from '../../types/personalTask';

interface PersonalTaskModalProps {
  task: PersonalTask | null; // null for creating new
  existingWeeks: string[];
  existingCategories: string[];
  onClose: () => void;
  onSave: (task: PersonalTask) => void;
  onDelete?: (id: string) => void;
}

export const PersonalTaskModal: React.FC<PersonalTaskModalProps> = ({
  task,
  existingWeeks,
  existingCategories,
  onClose,
  onSave,
  onDelete,
}) => {
  const [title, setTitle] = useState(task?.title || '');
  const [week, setWeek] = useState(task?.week || existingWeeks[0] || 'Kế hoạch tuần');
  const [assignedDate, setAssignedDate] = useState(task?.assignedDate || new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState(task?.category || 'Platform');
  const [description, setDescription] = useState(task?.description || '');
  const [priority, setPriority] = useState<TaskPriority>(task?.priority || 'normal');
  const [estimatedHours, setEstimatedHours] = useState(task?.estimatedHours !== undefined ? String(task.estimatedHours) : '2.0');
  const [status, setStatus] = useState<TaskStatus>(task?.status || 'todo');
  const [resultNote, setResultNote] = useState(task?.resultNote || '');
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [delayReason, setDelayReason] = useState(task?.delayReason || '');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập tên việc cần làm');
      return;
    }

    const nowStr = new Date().toISOString();
    const updatedTask: PersonalTask = {
      id: task?.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      week: week.trim() || 'Kế hoạch tuần',
      assignedDate,
      category: category.trim() || 'Chung',
      title: title.trim(),
      description: description.trim(),
      priority,
      estimatedHours: estimatedHours.trim(),
      status,
      resultNote: resultNote.trim(),
      dueDate,
      delayReason: delayReason.trim(),
      source: task?.source || 'manual',
      redmineIssueId: task?.redmineIssueId,
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
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              <FileText className="w-4 h-4" />
            </div>
            <h3 className="text-base font-bold text-slate-900">
              {task ? 'Chỉnh sửa đầu việc cá nhân' : 'Thêm mới đầu việc cá nhân'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Tên việc */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Tên việc cần làm <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Xem lại template standard / Fix lỗi subtask..."
              className="w-full text-sm px-3.5 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
          </div>

          {/* Tuần & Nhóm việc */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tuần / Đợt kế hoạch</label>
              <div className="relative">
                <input
                  type="text"
                  list="weeks-datalist"
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                  placeholder="Tuần 09 (24/2-27/02)"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
                <datalist id="weeks-datalist">
                  {existingWeeks.map((w) => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Nhóm việc (Category)</label>
              <div className="relative">
                <input
                  type="text"
                  list="categories-datalist"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="Platform, HOTFIX, BIM..."
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-1 focus:ring-indigo-500"
                />
                <datalist id="categories-datalist">
                  {existingCategories.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </div>

          {/* Ngày giao, Deadline & Thời lượng */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ngày giao / Bắt đầu</label>
              <input
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-xl text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Hạn chót (Deadline)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-xl text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Thời lượng (giờ)</label>
              <input
                type="text"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="2.0"
                className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-xl text-slate-800"
              />
            </div>
          </div>

          {/* Trạng thái & Mức độ ưu tiên */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Trạng thái công việc</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-medium text-slate-800 bg-white"
              >
                <option value="todo">⚪ Chưa làm</option>
                <option value="in_progress">🟡 Đang làm</option>
                <option value="review">🔵 Chờ review</option>
                <option value="done">🟢 Hoàn thành</option>
                <option value="deferred">⚫ Tạm hoãn</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mức độ ưu tiên</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-medium text-slate-800 bg-white"
              >
                <option value="urgent">🔴 Gấp (Khẩn cấp)</option>
                <option value="high">🟠 Cao</option>
                <option value="normal">🔵 Bình thường</option>
                <option value="low">⚪ Thấp</option>
              </select>
            </div>
          </div>

          {/* Mô tả chi tiết */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mô tả chi tiết / Các đầu mục con</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="1. Áp dụng template để hoàn thiện issue&#10;2. Bàn giao và đối soát..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Kết quả công việc */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Kết quả công việc / Ghi chú tiến độ (cột sếp hay theo dõi)
            </label>
            <textarea
              rows={2}
              value={resultNote}
              onChange={(e) => setResultNote(e.target.value)}
              placeholder="Ghi nhận kết quả hoàn thành hoặc các phát sinh, vướng mắc cần giải quyết..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Lý do trễ hạn (nếu có) */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Lý do trễ hạn (nếu có)</label>
            <input
              type="text"
              value={delayReason}
              onChange={(e) => setDelayReason(e.target.value)}
              placeholder="Chờ tài liệu API bên thứ 3 / Họp khẩn..."
              className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded-xl text-slate-800"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {task && onDelete && (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Bạn có chắc muốn xóa đầu việc này?')) {
                    onDelete(task.id);
                    onClose();
                  }
                }}
                className="text-xs font-semibold text-rose-600 hover:text-rose-800 cursor-pointer"
              >
                Xóa đầu việc
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleSubmit}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>{task ? 'Lưu thay đổi' : 'Thêm việc'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
