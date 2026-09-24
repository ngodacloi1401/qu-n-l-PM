import React, { useState, useMemo } from 'react';
import { X, CheckCircle2, Search, ArrowDownToLine, Tag } from 'lucide-react';
import type { RedmineIssue, RedmineUser } from '../../types/redmine';
import type { PersonalTask } from '../../types/personalTask';

interface RedmineSyncModalProps {
  issues: RedmineIssue[];
  currentUser: RedmineUser | null;
  baseUrl: string;
  onClose: () => void;
  onImport: (newTasks: PersonalTask[]) => void;
  existingTaskRedmineIds: Set<number>;
}

export const RedmineSyncModal: React.FC<RedmineSyncModalProps> = ({
  issues,
  currentUser,
  baseUrl,
  onClose,
  onImport,
  existingTaskRedmineIds,
}) => {
  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);
  const [targetWeek, setTargetWeek] = useState('Tuần 09 (24/2-27/02)');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const availableIssues = useMemo(() => {
    return issues.filter((iss) => {
      if (onlyMine && currentUser) {
        if (iss.assigned_to?.id !== currentUser.id) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const matchesSubject = iss.subject.toLowerCase().includes(q);
        const matchesId = String(iss.id).includes(q);
        const matchesProject = iss.project.name.toLowerCase().includes(q);
        if (!matchesSubject && !matchesId && !matchesProject) return false;
      }
      return true;
    });
  }, [issues, currentUser, onlyMine, search]);

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => {
    if (selectedIds.size === availableIssues.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(availableIssues.map((i) => i.id)));
    }
  };

  const handleConfirm = () => {
    const nowStr = new Date().toISOString();
    const toImport = issues.filter((iss) => selectedIds.has(iss.id));

    const newTasks: PersonalTask[] = toImport.map((iss) => {
      const customFieldMap: Record<string, any> = {};
      if (iss.custom_fields) {
        iss.custom_fields.forEach((cf) => {
          customFieldMap[cf.name] = cf.value;
        });
      }

      return {
        id: `task_redmine_${iss.id}_${Date.now()}`,
        week: targetWeek,
        assignedDate: iss.start_date || iss.created_on?.split('T')[0] || '',
        category: iss.category?.name || iss.project.name || 'CAD ADDIN SHOP DRAWING',
        title: iss.subject,
        description: iss.description || '',
        trackerId: iss.tracker?.id,
        trackerName: iss.tracker?.name || 'Task',
        statusId: iss.status?.id,
        statusName: iss.status?.name || 'New',
        priorityId: iss.priority?.id,
        priorityName: iss.priority?.name || 'Normal',
        assigneeId: iss.assigned_to?.id,
        assigneeName: iss.assigned_to?.name || '',
        parentTaskId: iss.parent?.id,
        targetVersionId: iss.fixed_version?.id,
        targetVersionName: iss.fixed_version?.name,
        doneRatio: iss.done_ratio !== undefined ? iss.done_ratio : 0,
        estimatedHours: iss.estimated_hours ? String(iss.estimated_hours) : undefined,
        customFields: customFieldMap,
        resultNote: '',
        dueDate: iss.due_date || '',
        delayReason: '',
        source: 'redmine',
        redmineIssueId: iss.id,
        projectId: iss.project.id,
        projectName: iss.project.name,
        createdAt: nowStr,
        updatedAt: nowStr,
      };
    });

    onImport(newTasks);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-600 flex items-center justify-center text-white font-bold text-sm">
              <ArrowDownToLine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Kéo công việc từ Redmine sang việc cá nhân</h3>
              <p className="text-xs text-slate-500">
                Đồng bộ nguyên trạng Tracker, Status, Priority và các Custom Fields từ Redmine
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

        {/* Toolbar */}
        <div className="p-4 bg-slate-50/50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tìm issue theo ID, tên công việc..."
                className="w-full text-xs pl-9 pr-3 py-2 bg-white border border-slate-300 rounded-xl focus:ring-1 focus:ring-red-500"
              />
            </div>

            <label className="flex items-center gap-1.5 text-xs text-slate-700 font-medium cursor-pointer whitespace-nowrap">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="rounded text-red-600 focus:ring-red-500"
              />
              <span>Chỉ việc của tôi</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-medium">Gán vào tuần:</span>
            <input
              type="text"
              value={targetWeek}
              onChange={(e) => setTargetWeek(e.target.value)}
              placeholder="VD: Tuần 09 (24/2-27/02)"
              className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg font-medium text-slate-800"
            />
          </div>
        </div>

        {/* List of Issues */}
        <div className="overflow-y-auto flex-1 p-4 divide-y divide-slate-100">
          <div className="flex items-center justify-between pb-2 text-xs font-semibold text-slate-500">
            <button
              onClick={selectAll}
              className="text-red-600 hover:text-red-700 hover:underline cursor-pointer"
            >
              {selectedIds.size === availableIssues.length && availableIssues.length > 0
                ? 'Bỏ chọn tất cả'
                : `Chọn tất cả (${availableIssues.length})`}
            </button>
            <span>Đã chọn: {selectedIds.size} việc</span>
          </div>

          {availableIssues.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              Không tìm thấy issue nào phù hợp với bộ lọc.
            </div>
          ) : (
            availableIssues.map((iss) => {
              const isSelected = selectedIds.has(iss.id);
              const alreadyImported = existingTaskRedmineIds.has(iss.id);

              return (
                <div
                  key={iss.id}
                  onClick={() => toggleSelect(iss.id)}
                  className={`p-3 rounded-xl flex items-start gap-3 transition-colors cursor-pointer my-1 ${
                    isSelected ? 'bg-red-50/70 border border-red-200' : 'hover:bg-slate-50 border border-transparent'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="mt-1 rounded text-red-600 focus:ring-red-500 pointer-events-none"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-slate-900">#{iss.id}</span>
                      <span className="text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                        {iss.tracker?.name}
                      </span>
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {iss.project.name}
                      </span>
                      <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        {iss.status?.name}
                      </span>
                      <span className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                        {iss.priority?.name}
                      </span>
                      {alreadyImported && (
                        <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded">
                          Đã có trong bảng việc
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-slate-900 mt-1 line-clamp-1">{iss.subject}</div>
                    <div className="flex items-center gap-4 text-xs text-slate-500 mt-1">
                      <span>Người nhận: {iss.assigned_to?.name || 'Chưa gán'}</span>
                      {iss.due_date && <span>Hạn: {iss.due_date}</span>}
                      {iss.estimated_hours && <span>Ước tính: {iss.estimated_hours}h</span>}
                      {iss.done_ratio !== undefined && <span>{iss.done_ratio}%</span>}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            Tổng cộng: {availableIssues.length} issue có sẵn trong Redmine
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Gom {selectedIds.size} việc vào bảng</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
