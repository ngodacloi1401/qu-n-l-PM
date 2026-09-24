import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { X, CheckCircle2, Search, ArrowDownToLine, Tag, RefreshCw, Loader2, User } from 'lucide-react';
import type { RedmineIssue, RedmineUser } from '../../types/redmine';
import type { PersonalTask } from '../../types/personalTask';
import { getIssues } from '../../services/redmineApi';

interface RedmineSyncModalProps {
  issues: RedmineIssue[];
  currentUser: RedmineUser | null;
  baseUrl: string;
  onClose: () => void;
  onImport: (newTasks: PersonalTask[]) => void;
  existingTaskRedmineIds: Set<number>;
}

export const RedmineSyncModal: React.FC<RedmineSyncModalProps> = ({
  issues: propIssues,
  currentUser,
  baseUrl,
  onClose,
  onImport,
  existingTaskRedmineIds,
}) => {
  const [search, setSearch] = useState('');
  const [onlyMine, setOnlyMine] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [remoteIssues, setRemoteIssues] = useState<RedmineIssue[]>([]);
  const [isLoadingRemote, setIsLoadingRemote] = useState(false);
  const [remoteError, setRemoteError] = useState<string | null>(null);

  // Fetch issues assigned to me directly from Redmine using current user credentials
  const fetchMyIssues = useCallback(async () => {
    setIsLoadingRemote(true);
    setRemoteError(null);
    try {
      const res = await getIssues({
        assigned_to_id: currentUser ? currentUser.id : 'me',
        status_id: '*',
        limit: 100,
      });
      if (res && Array.isArray(res.issues)) {
        setRemoteIssues(res.issues);
      }
    } catch (err: any) {
      console.warn('Could not fetch personal issues directly from Redmine:', err);
      setRemoteError(err.message || 'Không thể tải trực tiếp từ Redmine');
    } finally {
      setIsLoadingRemote(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchMyIssues();
  }, [fetchMyIssues]);

  // Combine prop issues and directly fetched remote issues (deduplicated by issue id)
  const allIssues = useMemo(() => {
    const map = new Map<number, RedmineIssue>();
    // Remote issues first (these are guaranteed assigned to me from Redmine)
    remoteIssues.forEach((iss) => map.set(iss.id, iss));
    // Prop issues next
    propIssues.forEach((iss) => {
      if (!map.has(iss.id)) {
        map.set(iss.id, iss);
      }
    });
    return Array.from(map.values());
  }, [remoteIssues, propIssues]);

  const currentUserName = currentUser
    ? `${currentUser.firstname} ${currentUser.lastname}`.trim() || currentUser.login
    : '';

  const availableIssues = useMemo(() => {
    return allIssues.filter((iss) => {
      if (onlyMine && currentUser) {
        if (iss.assigned_to?.id !== currentUser.id) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const matchesSubject = iss.subject?.toLowerCase().includes(q);
        const matchesId = String(iss.id).includes(q);
        const matchesProject = iss.project?.name?.toLowerCase().includes(q);
        if (!matchesSubject && !matchesId && !matchesProject) return false;
      }
      return true;
    });
  }, [allIssues, currentUser, onlyMine, search]);

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
    const toImport = allIssues.filter((iss) => selectedIds.has(iss.id));

    const newTasks: PersonalTask[] = toImport.map((iss) => {
      const customFieldMap: Record<string, any> = {};
      if (iss.custom_fields) {
        iss.custom_fields.forEach((cf) => {
          customFieldMap[cf.name] = cf.value;
        });
      }

      return {
        id: `task_redmine_${iss.id}_${Date.now()}`,
        week: '',
        assignedDate: iss.start_date || iss.created_on?.split('T')[0] || '',
        category: iss.category?.name || iss.project?.name || 'CAD ADDIN SHOP DRAWING',
        title: iss.subject,
        description: iss.description || '',
        trackerId: iss.tracker?.id,
        trackerName: iss.tracker?.name || 'Task',
        statusId: iss.status?.id,
        statusName: iss.status?.name || 'New',
        priorityId: iss.priority?.id,
        priorityName: iss.priority?.name || 'Normal',
        assigneeId: iss.assigned_to?.id,
        assigneeName: iss.assigned_to?.name || currentUserName,
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
        projectId: iss.project?.id,
        projectName: iss.project?.name,
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
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">Kéo công việc từ Redmine sang việc cá nhân</h3>
                {currentUser && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1">
                    <User className="w-3 h-3" />
                    <span>{currentUserName || currentUser.login}</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500">
                Tự động lấy các issue được gán cho tài khoản Redmine của bạn (Tracker, Status, Priority, Custom Fields)
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

            <button
              onClick={fetchMyIssues}
              disabled={isLoadingRemote}
              className="p-2 text-slate-600 hover:text-red-600 hover:bg-red-50 rounded-lg border border-slate-200 transition-colors cursor-pointer disabled:opacity-50"
              title="Tải lại việc từ Redmine"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingRemote ? 'animate-spin text-red-600' : ''}`} />
            </button>
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
            <div className="flex items-center gap-3">
              {isLoadingRemote && (
                <span className="text-xs text-red-600 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Đang tải từ Redmine...
                </span>
              )}
              <span>Đã chọn: {selectedIds.size} việc</span>
            </div>
          </div>

          {availableIssues.length === 0 ? (
            <div className="py-12 text-center text-slate-500 text-sm">
              {isLoadingRemote ? 'Đang tải danh sách issue từ Redmine...' : 'Không tìm thấy issue nào phù hợp với bộ lọc.'}
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
                        {iss.project?.name}
                      </span>
                      <span className="text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded">
                        {iss.status?.name}
                      </span>
                      <span className="text-xs font-medium text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded">
                        {iss.priority?.name}
                      </span>
                      {iss.assigned_to && (
                        <span className="text-[11px] text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200">
                          {iss.assigned_to.name}
                        </span>
                      )}
                      {alreadyImported && (
                        <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-1.5 py-0.5 rounded font-medium">
                          Đã thêm
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-slate-900 mt-1">{iss.subject}</div>
                    <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-4">
                      {iss.start_date && <span>Bắt đầu: {iss.start_date}</span>}
                      {iss.due_date && <span>Hạn: {iss.due_date}</span>}
                      {iss.estimated_hours && <span>Ước tính: {iss.estimated_hours}h</span>}
                      <span>Tiến độ: {iss.done_ratio ?? 0}%</span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {baseUrl && (
              <a
                href={`${baseUrl}/issues`}
                target="_blank"
                rel="noreferrer"
                className="text-red-600 hover:underline"
              >
                Mở Redmine trong tab mới →
              </a>
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
              type="button"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              className="inline-flex items-center gap-1.5 px-5 py-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Đồng bộ ({selectedIds.size}) vào việc cá nhân</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
