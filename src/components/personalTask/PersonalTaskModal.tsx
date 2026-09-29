import React, { useState, useMemo } from 'react';
import { X, Check, Calendar, Clock, Tag, AlertCircle, FileText, Bug, Layers, User, Hash, CheckCircle2, ChevronDown, ChevronUp } from 'lucide-react';
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
  RedmineUser,
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
  currentUser?: RedmineUser | null;
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
  currentUser,
  onClose,
  onSave,
  onDelete,
}) => {
  // Tracker selection
  const initialTrackerId = task?.trackerId || trackers[0]?.id || 6;
  const [trackerId, setTrackerId] = useState<number>(initialTrackerId);

  // Compute current logged in user name
  const currentUserName = currentUser ? `${currentUser.firstname} ${currentUser.lastname}`.trim() || currentUser.login : '';

  // Standard Redmine fields
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [statusName, setStatusName] = useState<string>(task?.statusName || statuses[0]?.name || 'New');
  const [priorityName, setPriorityName] = useState<string>(task?.priorityName || priorities[0]?.name || 'Normal');
  const [assigneeName, setAssigneeName] = useState<string>(task?.assigneeName || currentUserName || '');
  const [category, setCategory] = useState<string>(task?.category || 'CAD ADDIN SHOP DRAWING');
  const [targetVersionName, setTargetVersionName] = useState<string>(task?.targetVersionName || '');
  const [parentTaskId, setParentTaskId] = useState<string>(task?.parentTaskId ? String(task.parentTaskId) : '');
  const [assignedDate, setAssignedDate] = useState(task?.assignedDate || new Date().toISOString().split('T')[0]);
  const [dueDate, setDueDate] = useState(task?.dueDate || '');
  const [estimatedHours, setEstimatedHours] = useState(task?.estimatedHours !== undefined ? String(task.estimatedHours) : '');
  const [doneRatio, setDoneRatio] = useState<number>(task?.doneRatio !== undefined ? task.doneRatio : 0);

  const [week, setWeek] = useState(task?.week || existingWeeks[0] || '');
  const [resultNote, setResultNote] = useState(task?.resultNote || '');
  const [delayReason, setDelayReason] = useState(task?.delayReason || '');

  // Custom fields per tracker
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>(task?.customFields || {});
  const [showAdvanced, setShowAdvanced] = useState(false);
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
      assigneeId: task?.assigneeId || (assigneeName === currentUserName ? currentUser?.id : undefined),
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
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                {task ? 'Chỉnh sửa công việc' : 'Tạo mới công việc'}
              </h3>
              <p className="text-xs text-slate-500">
                Quản lý tiến độ cá nhân, deadline và ghi chú thực hiện
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

          {/* Subject */}
          <div>
            <label className="block text-xs font-bold text-slate-800 mb-1">
              Tên / Tiêu đề công việc <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Kiểm tra bản vẽ kiến trúc tầng 3, Báo cáo tiến độ tuần..."
              className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl font-medium focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nội dung chi tiết</label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Ghi chú các bước thực hiện, checklist hoặc nội dung cần làm..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800 focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Core Row 1: Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Trạng thái <span className="text-rose-500">*</span>
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
              <label className="block text-xs font-bold text-slate-800 mb-1">
                Mức ưu tiên <span className="text-rose-500">*</span>
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
          </div>

          {/* Core Row 2: Due Date & Week */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Hạn hoàn thành (Deadline)</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Tuần / Đợt kế hoạch</label>
              <input
                type="text"
                list="weeks-datalist"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                placeholder="VD: Tuần 09, Tuần 10..."
                className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
              />
              <datalist id="weeks-datalist">
                {existingWeeks.map((w) => (
                  <option key={w} value={w} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Core Row 3: Result Notes / Remarks */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Kết quả hoàn thành / Ghi chú PM
            </label>
            <textarea
              rows={2}
              value={resultNote}
              onChange={(e) => setResultNote(e.target.value)}
              placeholder="Ghi nhận kết quả, link file báo cáo hoặc vướng mắc cần giải quyết..."
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl text-slate-800"
            />
          </div>

          {/* Toggle Redmine Advanced Options */}
          <div className="pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-indigo-600 transition-colors py-1 cursor-pointer"
            >
              <Layers className="w-3.5 h-3.5" />
              <span>{showAdvanced ? 'Ẩn thông tin nâng cao (Redmine)' : 'Hiển thị tùy chọn nâng cao Redmine (Tracker, Version, Task cha...)'}</span>
              {showAdvanced ? <ChevronUp className="w-3.5 h-3.5 ml-0.5" /> : <ChevronDown className="w-3.5 h-3.5 ml-0.5" />}
            </button>
          </div>

          {showAdvanced && (
            <div className="space-y-4 pt-2 border-t border-dashed border-slate-200 bg-slate-50/70 p-4 rounded-xl">
              {/* Tracker Selection */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-amber-700" />
                  <label className="text-xs font-bold text-slate-800">Loại việc (Tracker):</label>
                </div>
                <select
                  value={trackerId}
                  onChange={(e) => setTrackerId(Number(e.target.value))}
                  className="text-xs px-3 py-1.5 bg-white border border-slate-300 rounded-lg font-semibold text-slate-800 cursor-pointer min-w-[180px]"
                >
                  {trackers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Advanced Row 1: Parent task & Assignee */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Task cha (Parent ID)</label>
                  <input
                    type="text"
                    value={parentTaskId}
                    onChange={(e) => setParentTaskId(e.target.value)}
                    placeholder="VD: 41470"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Người nhận (Assignee)</label>
                  <input
                    type="text"
                    list="assignees-datalist"
                    value={assigneeName}
                    onChange={(e) => setAssigneeName(e.target.value)}
                    placeholder={currentUserName || 'Người nhận việc'}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  />
                  <datalist id="assignees-datalist">
                    {memberships.map((m) =>
                      m.user ? <option key={m.id} value={m.user.name} /> : null
                    )}
                  </datalist>
                </div>
              </div>

              {/* Advanced Row 2: Category & Version */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Category / Nhóm việc</label>
                  <input
                    type="text"
                    list="categories-datalist"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="CAD ADDIN SHOP DRAWING"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white"
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

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Phiên bản (Target version)</label>
                  <input
                    type="text"
                    list="versions-datalist"
                    value={targetVersionName}
                    onChange={(e) => setTargetVersionName(e.target.value)}
                    placeholder="Phiên bản phát hành..."
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  />
                  <datalist id="versions-datalist">
                    {versions.map((v) => (
                      <option key={v.id} value={v.name} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Advanced Row 3: Estimated Hours & Progress */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Thời lượng ước tính (Giờ)</label>
                  <input
                    type="text"
                    value={estimatedHours}
                    onChange={(e) => setEstimatedHours(e.target.value)}
                    placeholder="2.0"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded-xl bg-white"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between text-xs font-medium text-slate-700 mb-1">
                    <span>Tiến độ hoàn thành</span>
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

              {/* Custom fields if any */}
              {applicableCustomFields.length > 0 && (
                <div className="pt-2 border-t border-slate-200">
                  <div className="text-[11px] font-bold text-slate-700 mb-2">Trường tùy biến ({applicableCustomFields.length})</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {applicableCustomFields.map((cf) => {
                      const val = customFieldValues[cf.name] ?? (cf.default_value || '');
                      const isList = cf.field_format === 'list' && Array.isArray(cf.possible_values) && cf.possible_values.length > 0;
                      const isBool = cf.field_format === 'bool';

                      return (
                        <div key={cf.id}>
                          <label className="block text-[11px] font-medium text-slate-600 mb-1">
                            {cf.name}
                          </label>
                          {isList ? (
                            <select
                              value={val}
                              onChange={(e) => handleCustomFieldChange(cf.name, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            >
                              <option value="">-- Chọn --</option>
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
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            >
                              <option value="0">Không</option>
                              <option value="1">Có</option>
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={val}
                              onChange={(e) => handleCustomFieldChange(cf.name, e.target.value)}
                              className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}
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
