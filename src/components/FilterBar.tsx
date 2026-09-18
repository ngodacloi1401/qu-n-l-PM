import React from 'react';
import {
  Search,
  Filter,
  X,
  AlertTriangle,
  Layers,
  Flag,
  UserCheck,
  Milestone,
} from 'lucide-react';
import {
  RedmineStatus,
  RedmineTracker,
  RedminePriority,
  RedmineMembership,
  RedmineVersion,
} from '../types/redmine';

export interface FilterState {
  search: string;
  trackerId: string;
  statusId: string;
  priorityId: string;
  assigneeId: string;
  versionId: string;
  onlyOverdue: boolean;
  onlyMyTasks: boolean;
}

interface FilterBarProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  trackers: RedmineTracker[];
  statuses: RedmineStatus[];
  priorities: RedminePriority[];
  memberships: RedmineMembership[];
  versions: RedmineVersion[];
  currentUserId?: number;
  totalResults: number;
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filters,
  onFilterChange,
  trackers,
  statuses,
  priorities,
  memberships,
  versions,
  currentUserId,
  totalResults,
}) => {
  const updateField = (key: keyof FilterState, value: any) => {
    onFilterChange({ ...filters, [key]: value });
  };

  const hasActiveFilters =
    filters.search !== '' ||
    filters.trackerId !== 'all' ||
    filters.statusId !== 'all' ||
    filters.priorityId !== 'all' ||
    filters.assigneeId !== 'all' ||
    filters.versionId !== 'all' ||
    filters.onlyOverdue ||
    filters.onlyMyTasks;

  const resetFilters = () => {
    onFilterChange({
      search: '',
      trackerId: 'all',
      statusId: 'all',
      priorityId: 'all',
      assigneeId: 'all',
      versionId: 'all',
      onlyOverdue: false,
      onlyMyTasks: false,
    });
  };

  return (
    <div className="bg-white p-3 sm:p-4 rounded-xl border border-slate-200 shadow-xs mb-5">
      {/* Top row: search + quick toggles */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="filter-search-input"
            type="text"
            placeholder="Tìm theo tiêu đề, nội dung, hoặc gõ #ID công việc..."
            value={filters.search}
            onChange={(e) => updateField('search', e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
          {filters.search && (
            <button
              onClick={() => updateField('search', '')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick check toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          {currentUserId && (
            <button
              id="filter-my-tasks-btn"
              onClick={() => updateField('onlyMyTasks', !filters.onlyMyTasks)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
                filters.onlyMyTasks
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Của tôi</span>
            </button>
          )}

          <button
            id="filter-overdue-btn"
            onClick={() => updateField('onlyOverdue', !filters.onlyOverdue)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors cursor-pointer ${
              filters.onlyOverdue
                ? 'bg-rose-50 text-rose-700 border-rose-300 shadow-2xs'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
            <span>Quá hạn</span>
          </button>

          {hasActiveFilters && (
            <button
              id="filter-reset-btn"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Xóa bộ lọc</span>
            </button>
          )}

          <div className="text-xs font-medium text-slate-500 ml-auto md:ml-0 pl-2 border-l border-slate-200">
            {totalResults} công việc
          </div>
        </div>
      </div>

      {/* Bottom row: Dropdowns */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-3 mt-3 border-t border-slate-100">
        {/* Tracker */}
        <div className="relative">
          <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Layers className="w-3 h-3" />
            Loại việc (Tracker)
          </div>
          <select
            id="filter-tracker-select"
            value={filters.trackerId}
            onChange={(e) => updateField('trackerId', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Tất cả loại việc</option>
            {trackers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="relative">
          <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Trạng thái
          </div>
          <select
            id="filter-status-select"
            value={filters.statusId}
            onChange={(e) => updateField('statusId', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="open">Đang mở (Chưa đóng)</option>
            {statuses.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} {s.is_closed ? '(Đã đóng)' : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="relative">
          <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Flag className="w-3 h-3" />
            Độ ưu tiên
          </div>
          <select
            id="filter-priority-select"
            value={filters.priorityId}
            onChange={(e) => updateField('priorityId', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Tất cả mức ưu tiên</option>
            {priorities.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Assignee */}
        <div className="relative">
          <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <UserCheck className="w-3 h-3" />
            Người phụ trách
          </div>
          <select
            id="filter-assignee-select"
            value={filters.assigneeId}
            onChange={(e) => updateField('assigneeId', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Tất cả thành viên</option>
            <option value="unassigned">Chưa phân công</option>
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

        {/* Milestone */}
        <div className="relative">
          <div className="text-[11px] font-semibold text-slate-400 mb-1 flex items-center gap-1">
            <Milestone className="w-3 h-3" />
            Milestone / Phiên bản
          </div>
          <select
            id="filter-version-select"
            value={filters.versionId}
            onChange={(e) => updateField('versionId', e.target.value)}
            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="all">Tất cả Milestone</option>
            {versions.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} {v.status !== 'open' ? `(${v.status})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};
