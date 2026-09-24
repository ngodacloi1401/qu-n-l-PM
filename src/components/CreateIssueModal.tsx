import React, { useState, useMemo } from 'react';
import { X, Plus, AlertCircle, Check, Sparkles, Layers, Tag, Calendar, User, Clock, Link2 } from 'lucide-react';
import {
  RedmineProject,
  RedmineTracker,
  RedmineStatus,
  RedminePriority,
  RedmineMembership,
  RedmineVersion,
  RedmineCustomField,
  RedmineIssueCategory,
} from '../types/redmine';
import { createIssue, DEFAULT_REDMINE_STATUSES } from '../services/redmineApi';

interface CreateIssueModalProps {
  projects: RedmineProject[];
  defaultProjectId: string;
  trackers: RedmineTracker[];
  statuses?: RedmineStatus[];
  priorities: RedminePriority[];
  memberships: RedmineMembership[];
  versions: RedmineVersion[];
  customFields?: RedmineCustomField[];
  categories?: RedmineIssueCategory[];
  onClose: () => void;
  onCreated: () => void;
}

export const CreateIssueModal: React.FC<CreateIssueModalProps> = ({
  projects,
  defaultProjectId,
  trackers,
  statuses = DEFAULT_REDMINE_STATUSES,
  priorities,
  memberships,
  versions,
  customFields = [],
  categories = [],
  onClose,
  onCreated,
}) => {
  const initialProjectId =
    defaultProjectId !== 'all' && defaultProjectId
      ? Number(defaultProjectId)
      : projects[0]?.id || 84;

  const [projectId, setProjectId] = useState<number>(initialProjectId);
  const [trackerId, setTrackerId] = useState<number>(trackers[0]?.id || 4);
  const [statusId, setStatusId] = useState<number>(statuses[0]?.id || 1);
  const [subject, setSubject] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [priorityId, setPriorityId] = useState<number>(priorities[0]?.id || 29);
  const [assigneeId, setAssigneeId] = useState<number | undefined>(undefined);
  const [categoryId, setCategoryId] = useState<number | undefined>(undefined);
  const [versionId, setVersionId] = useState<number | undefined>(undefined);
  const [startDate, setStartDate] = useState<string>('');
  const [dueDate, setDueDate] = useState<string>('');
  const [estimatedHours, setEstimatedHours] = useState<string>('');
  const [parentIssueId, setParentIssueId] = useState<string>('');
  const [customFieldValues, setCustomFieldValues] = useState<Record<number, any>>({});

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Filter custom fields applicable to selected tracker
  const applicableCustomFields = useMemo(() => {
    return customFields.filter((cf) => {
      if (!cf.trackers || cf.trackers.length === 0) return true;
      return cf.trackers.some((t) => t.id === trackerId);
    });
  }, [customFields, trackerId]);

  const handleCustomFieldChange = (fieldId: number, value: any) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [fieldId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      setErrorMsg('Vui lòng nhập tiêu đề công việc');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      const formattedCustomFields = Object.entries(customFieldValues)
        .filter(([_, val]) => val !== undefined && val !== '')
        .map(([id, val]) => ({
          id: Number(id),
          value: val,
        }));

      await createIssue({
        project_id: projectId,
        tracker_id: trackerId,
        status_id: statusId,
        subject: subject.trim(),
        description: description.trim() || undefined,
        priority_id: priorityId,
        assigned_to_id: assigneeId,
        category_id: categoryId,
        fixed_version_id: versionId,
        parent_issue_id: parentIssueId ? Number(parentIssueId) : undefined,
        start_date: startDate || undefined,
        due_date: dueDate || undefined,
        estimated_hours: estimatedHours ? parseFloat(estimatedHours) : undefined,
        custom_fields: formattedCustomFields.length > 0 ? formattedCustomFields : undefined,
      });

      onCreated();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tạo công việc mới');
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedTracker = trackers.find((t) => t.id === trackerId);

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Tạo công việc mới (New Issue)</h3>
              <p className="text-xs text-slate-500">
                Đồng bộ trực tiếp lên hệ thống Redmine • Loại việc:{' '}
                <span className="font-semibold text-indigo-600">{selectedTracker?.name || 'Issue'}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Project, Tracker & Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Dự án *</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Loại việc (Tracker) *</label>
              <select
                value={trackerId}
                onChange={(e) => setTrackerId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
              >
                {trackers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Trạng thái (Status) *</label>
              <select
                value={statusId}
                onChange={(e) => setStatusId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
              >
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.is_closed ? '(Closed)' : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Tiêu đề công việc *
            </label>
            <input
              type="text"
              required
              placeholder="VD: Fix lỗi kết xuất bản vẽ 3D, Cập nhật tài liệu API module..."
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Mô tả yêu cầu chi tiết (Description)
            </label>
            <textarea
              rows={4}
              placeholder="Mô tả bối cảnh, các bước tái hiện, yêu cầu nghiệm thu (Acceptance criteria)..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Priority & Assignee */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Độ ưu tiên (Priority) *</label>
              <select
                value={priorityId}
                onChange={(e) => setPriorityId(Number(e.target.value))}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
              >
                {priorities.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Người thực hiện (Assignee)</label>
              <select
                value={assigneeId || ''}
                onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Chưa phân công --</option>
                {memberships.map((m) => {
                  if (!m.user) return null;
                  return (
                    <option key={m.id} value={m.user.id}>
                      {m.user.name}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Category & Version */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {categories.length > 0 && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Danh mục (Category)</label>
                <select
                  value={categoryId || ''}
                  onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Không chọn danh mục --</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Phiên bản mục tiêu (Target version)</label>
              <select
                value={versionId || ''}
                onChange={(e) => setVersionId(e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">-- Không chọn phiên bản --</option>
                {versions.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Dates & Estimated Hours & Parent */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày bắt đầu</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Hạn hoàn thành</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Giờ ước tính (h)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                placeholder="e.g. 8.0"
                value={estimatedHours}
                onChange={(e) => setEstimatedHours(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Task cha (#ID)</label>
              <input
                type="number"
                min="1"
                placeholder="e.g. 1024"
                value={parentIssueId}
                onChange={(e) => setParentIssueId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Custom Fields for selected tracker */}
          {applicableCustomFields.length > 0 && (
            <div className="pt-3 border-t border-slate-100">
              <h4 className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-indigo-600" />
                <span>Trường tùy chỉnh của {selectedTracker?.name || 'Tracker'} ({applicableCustomFields.length})</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {applicableCustomFields.map((cf) => {
                  const val = customFieldValues[cf.id] ?? (cf.default_value || '');
                  const isList = cf.field_format === 'list' && Array.isArray(cf.possible_values) && cf.possible_values.length > 0;
                  const isBool = cf.field_format === 'bool';

                  return (
                    <div key={cf.id}>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        {cf.name} {cf.is_required && <span className="text-rose-500">*</span>}
                      </label>
                      {isList ? (
                        <select
                          required={cf.is_required}
                          value={val}
                          onChange={(e) => handleCustomFieldChange(cf.id, e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Chọn {cf.name} --</option>
                          {cf.possible_values?.map((pv: any, idx: number) => {
                            const optionVal = typeof pv === 'object' ? pv.value : pv;
                            const optionLabel = typeof pv === 'object' ? (pv.label || pv.value) : pv;
                            return (
                              <option key={idx} value={optionVal}>
                                {optionLabel}
                              </option>
                            );
                          })}
                        </select>
                      ) : isBool ? (
                        <select
                          value={val}
                          onChange={(e) => handleCustomFieldChange(cf.id, e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="">-- Chưa chọn --</option>
                          <option value="1">Có (Yes)</option>
                          <option value="0">Không (No)</option>
                        </select>
                      ) : (
                        <input
                          type={cf.field_format === 'int' || cf.field_format === 'float' ? 'number' : cf.field_format === 'date' ? 'date' : 'text'}
                          required={cf.is_required}
                          placeholder={`Nhập ${cf.name}...`}
                          value={val}
                          onChange={(e) => handleCustomFieldChange(cf.id, e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{isSubmitting ? 'Đang tạo lên Redmine...' : 'Tạo công việc'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

