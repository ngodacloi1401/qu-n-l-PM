import React, { useState, useMemo } from 'react';
import { X, Check, Calendar, Clock, Tag, AlertCircle, FileText, Bug, Layers, User, Hash, CheckCircle2 } from 'lucide-react';
import type { PersonalTask } from '../../types/personalTask';
import type {
  RedmineStatus,
  RedminePriority,
  RedmineTracker,
  RedmineCustomField,
  RedmineIssueCategory,
  RedmineVersion,
  RedmineMembership,
  RedmineProject,
} from '../../types/redmine';
import {
  DEFAULT_REDMINE_STATUSES,
  DEFAULT_REDMINE_PRIORITIES,
  DEFAULT_REDMINE_TRACKERS,
  DEFAULT_REDMINE_CUSTOM_FIELDS,
} from '../../services/redmineApi';

interface PersonalTaskModalProps {
  task: PersonalTask | null;
  existingWeeks: string[];
  existingCategories: string[];
  statuses?: RedmineStatus[];
  priorities?: RedminePriority[];
  trackers?: RedmineTracker[];
  customFields?: RedmineCustomField[];
  categories?: RedmineIssueCategory[];
  versions?: RedmineVersion[];
  memberships?: RedmineMembership[];
  projects?: RedmineProject[];
  onClose: () => void;
  onSave: (task: PersonalTask) => void;
  onDelete?: (id: string) => void;
}

export const PersonalTaskModal: React.FC<PersonalTaskModalProps> = ({
  task,
  existingWeeks,
  existingCategories,
  statuses = DEFAULT_REDMINE_STATUSES,
  priorities = DEFAULT_REDMINE_PRIORITIES,
  trackers = DEFAULT_REDMINE_TRACKERS,
  customFields = DEFAULT_REDMINE_CUSTOM_FIELDS,
  categories = [],
  versions = [],
  memberships = [],
  projects = [],
  onClose,
  onSave,
  onDelete,
}) => {
  // Tracker selection
  const initialTrackerId = task?.trackerId || trackers[0]?.id || 6;
  const [trackerId, setTrackerId] = useState<number>(initialTrackerId);

  // Standard Redmine fields
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [statusName, setStatusName] = useState<string>(task?.statusName || statuses[0]?.name || 'New');
  const [priorityName, setPriorityName] = useState<string>(task?.priorityName || priorities[0]?.name || 'Normal');
  const [assigneeName, setAssigneeName] = useState<string>(task?.assigneeName || 'Ngô Đắc Lợi');
  const [category, setCategory] = useState<string>(task?.category || 'CAD ADDIN SHOP DRAWING');
  const [targetVersionName, setTargetVersionName] = useState<string>(task?.targetVersionName || '');
  const [parentTaskId, setParentTaskId] = useState<string>(task?.parentTaskId ? String(task.parentTaskId) : '');
  const [assignedDate, setAssignedDate] = useState(task?.assignedDate || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [estimatedHours, setEstimatedHours] = useState(task?.estimatedHours !== undefined ? String(task.estimatedHours) : '');
  const [doneRatio, setDoneRatio] = useState<number>(task?.doneRatio !== undefined ? task.doneRatio : 0);

  // Week planning & note fields (for weekly management)
  const [week, setWeek] = useState(task?.week || existingWeeks[0] || 'Tuần 09 (24/2-27/02)');
  const [resultNote, setResultNote] = useState(task?.resultNote || '');
  const [delayReason, setDelayReason] = useState(task?.delayReason || '');

  // Custom fields per tracker
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>(task?.customFields || {});
  const [error, setError] = useState<string | null>(null);

  const selectedTracker = trackers.find((t) => t.id === trackerId);

  // Filter custom fields applicable to the selected tracker
  const applicableCustomFields = useMemo(() => {
    return customFields.filter((cf) => {
      if (!cf.trackers || cf.trackers.length === 0) return true;
      return cf.trackers.some((t) => t.id === trackerId);
    });
  }, [customFields, trackerId]);

  const handleCustomFieldChange = (fieldName: string, value: any) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldName]: value,
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập Subject / Tiêu đề công việc');
      return;
    }

    const matchedStatus = statuses.find((s) => s.name === statusName);
    const matchedPriority = priorities.find((p) => p.name === priorityName);

    const nowStr = new Date().toISOString();
    const updatedTask: PersonalTask = {
      id: task?.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      week: week.trim() || 'Kế hoạch tuần',
      assignedDate,
      category: category.trim() || 'Chung',
      title: title.trim(),
      description: description.trim(),
      trackerId,
      trackerName: selectedTracker?.name || 'Task',
      statusId: matchedStatus?.id,
      statusName,
      priorityId: matchedPriority?.id,
      priorityName,
      assigneeName: assigneeName.trim(),
      parentTaskId: parentTaskId.trim() ? Number(parentTaskId) || parentTaskId.trim() : undefined,
      targetVersionName: targetVersionName.trim() || undefined,
      doneRatio,
      estimatedHours: estimatedHours.trim() || undefined,
      customFields: customFieldValues,
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
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {task ? 'Chỉnh sửa thuộc tính công việc (Change properties)' : 'Thêm mới công việc chuẩn Redmine'}
              </h3>
              <p className="text-xs text-slate-500">
                Trạng thái, ưu tiên và các trường tùy biến tự động thay đổi theo Tracker
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
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

          {/* Tracker Selection Box (Highlighted like Redmine screenshot) */}
          <div className="p-3.5 bg-amber-50/60 border-2 border-amber-300 rounded-xl flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-amber-700" />
              <label className="text-xs font-bold text-amber-900">
                Loại việc (Tracker) <span className="text-rose-500">*</span>:
              </label>
            </div>
            <select
              value={trackerId}
              onChange={(e) => setTrackerId(Number(e.target.value))}
              className="text-xs px-3 py-1.5 bg-white border border-amber-300 rounded-lg font-bold text-slate-800 shadow-xs focus:ring-2 focus:ring-amber-500 cursor-pointer min-w-[200px]"
            >
              {trackers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Tiêu đề (Subject) <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: [Product] Tạo bộ hồ sơ căn hộ - các phân hệ nằm nhiều vị trí..."
              className="w-full text-xs px-3.5 py-2 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Mô tả chi tiết (Description)</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Nhập mô tả yêu cầu hoặc các bước thực hiện..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Standard Redmine Row 1: Status & Parent task */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Trạng thái (Status Redmine) <span className="text-rose-500">*</span>
              </label>
              <select
                value={statusName}
                onChange={(e) => setStatusName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-white"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.name}>
                    {s.name} {s.is_closed ? '(Closed)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Task cha (Parent task #ID)</label>
              <input
                type="text"
                value={parentTaskId}
                onChange={(e) => setParentTaskId(e.target.value)}
                placeholder="VD: 41470"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800 font-mono"
              />
            </div>
          </div>

          {/* Standard Redmine Row 2: Priority & Start Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Mức ưu tiên (Priority Redmine) <span className="text-rose-500">*</span>
              </label>
              <select
                value={priorityName}
                onChange={(e) => setPriorityName(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl font-semibold text-slate-800 bg-white"
              >
                {priorities.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ngày bắt đầu (Start date)</label>
              <input
                type="date"
                value={assignedDate}
                onChange={(e) => setAssignedDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
              />
            </div>
          </div>

          {/* Standard Redmine Row 3: Assignee & Due date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Người nhận (Assignee)</label>
              <div className="relative">
                <input
                  type="text"
                  list="assignees-datalist"
                  value={assigneeName}
                  onChange={(e) => setAssigneeName(e.target.value)}
                  placeholder="Ngô Đắc Lợi"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
                />
                <datalist id="assignees-datalist">
                  {memberships.map((m) =>
                    m.user ? <option key={m.id} value={m.user.name} /> : null
                  )}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Hạn hoàn thành (Due date)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
              />
            </div>
          </div>

          {/* Standard Redmine Row 4: Category & Estimated time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Danh mục (Category)</label>
              <div className="relative">
                <input
                  type="text"
                  list="categories-datalist"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="CAD ADDIN SHOP DRAWING"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
                />
                <datalist id="categories-datalist">
                  {categories.map((c) => (
                    <option key={c.id} value={c.name} />
                  ))}
                  {existingCategories.map((ec) => (
                    <option key={ec} value={ec} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Thời lượng ước tính (Hours)</label>
              <input
                type="text"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                placeholder="2.0"
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
              />
            </div>
          </div>

          {/* Standard Redmine Row 5: Target version & % Done */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Phiên bản (Target version)</label>
              <div className="relative">
                <input
                  type="text"
                  list="versions-datalist"
                  value={targetVersionName}
                  onChange={(e) => setTargetVersionName(e.target.value)}
                  placeholder="04.11 Bản vẽ SHOP CAD [Product]"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
                />
                <datalist id="versions-datalist">
                  {versions.map((v) => (
                    <option key={v.id} value={v.name} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                <span>Tiến độ hoàn thành (% Done)</span>
                <span className="font-bold text-indigo-600">{doneRatio}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="10"
                value={doneRatio}
                onChange={(e) => setDoneRatio(Number(e.target.value))}
                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600 mt-2"
              />
            </div>
          </div>

          {/* DYNAMIC TRACKER CUSTOM FIELDS (Exactly as in user's Redmine screenshot!) */}
          {applicableCustomFields.length > 0 && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                <span>Trường dữ liệu riêng của {selectedTracker?.name || 'Tracker'} ({applicableCustomFields.length} trường)</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {applicableCustomFields.map((cf) => {
                  const val = customFieldValues[cf.name] ?? (cf.default_value || '');
                  const isList = cf.field_format === 'list' && Array.isArray(cf.possible_values) && cf.possible_values.length > 0;
                  const isBool = cf.field_format === 'bool';

                  return (
                    <div key={cf.id}>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {cf.name} {cf.is_required && <span className="text-rose-500">*</span>}
                      </label>

                      {isList ? (
                        <select
                          value={val}
                          onChange={(e) => handleCustomFieldChange(cf.name, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                        >
                          <option value="">-- Please select --</option>
                          {cf.possible_values?.map((pv: any, idx: number) => {
                            const optVal = typeof pv === 'object' ? pv.value : pv;
                            const optLabel = typeof pv === 'object' ? pv.label || pv.value : pv;
                            return (
                              <option key={idx} value={optVal}>
                                {optLabel}
                              </option>
                            );
                          })}
                        </select>
                      ) : isBool ? (
                        <select
                          value={val}
                          onChange={(e) => handleCustomFieldChange(cf.name, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                        >
                          <option value="0">No (Không)</option>
                          <option value="1">Yes (Có)</option>
                        </select>
                      ) : (
                        <input
                          type={cf.field_format === 'int' || cf.field_format === 'float' ? 'number' : cf.field_format === 'date' ? 'date' : 'text'}
                          placeholder={`Nhập ${cf.name}...`}
                          value={val}
                          onChange={(e) => handleCustomFieldChange(cf.name, e.target.value)}
                          className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Weekly Management Fields */}
          <div className="p-4 bg-indigo-50/40 border border-indigo-100 rounded-xl space-y-3">
            <h4 className="text-xs font-bold text-indigo-900 uppercase tracking-wider flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-indigo-600" />
              <span>Ghi chú quản lý tuần & tiến độ</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Tuần / Đợt kế hoạch</label>
                <input
                  type="text"
                  list="weeks-datalist"
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                  placeholder="Tuần 09 (24/2-27/02)"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
                <datalist id="weeks-datalist">
                  {existingWeeks.map((w) => (
                    <option key={w} value={w} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-700 mb-1">Lý do trễ hạn (nếu có)</label>
                <input
                  type="text"
                  value={delayReason}
                  onChange={(e) => setDelayReason(e.target.value)}
                  placeholder="Chờ tài liệu API bên thứ 3..."
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 mb-1">
                Kết quả công việc / Ghi chú tiến độ (cột theo dõi của PM)
              </label>
              <textarea
                rows={2}
                value={resultNote}
                onChange={(e) => setResultNote(e.target.value)}
                placeholder="Ghi nhận kết quả hoàn thành hoặc các phát sinh, vướng mắc cần giải quyết..."
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
              />
            </div>
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
                Xóa công việc
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
              <span>{task ? 'Lưu thay đổi' : 'Thêm công việc'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
