import React, { useState } from 'react';
import {
  Search,
  Filter,
  X,
  AlertTriangle,
  Layers,
  Flag,
  UserCheck,
  Milestone,
  Calendar,
  CalendarRange,
  Clock,
  RefreshCw,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react';
import {
  RedmineStatus,
  RedmineTracker,
  RedminePriority,
  RedmineMembership,
  RedmineVersion,
  TimePeriodType,
  DateFieldType,
} from '../types/redmine';
import { FetchProgress } from '../services/redmineApi';

export interface FilterState {
  search: string;
  trackerId: string;
  statusId: string;
  priorityId: string;
  assigneeId: string;
  versionId: string;
  onlyOverdue: boolean;
  onlyMyTasks: boolean;
  timePeriod: TimePeriodType;
  dateField: DateFieldType;
  specificMonth: string; // 'YYYY-MM'
  customStart: string; // 'YYYY-MM-DD'
  customEnd: string; // 'YYYY-MM-DD'
  fetchLimit: number | 'all';
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
  totalLoaded: number;
  totalAvailable: number;
  isLoading: boolean;
  fetchProgress: FetchProgress | null;
  onRefresh: () => void;
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
  totalLoaded,
  totalAvailable,
  isLoading,
  fetchProgress,
  onRefresh,
}) => {
  const [showCustomDateModal, setShowCustomDateModal] = useState(false);
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const updateField = <K extends keyof FilterState>(key: K, value: FilterState[K]) => {
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
    filters.onlyMyTasks ||
    filters.timePeriod !== 'all';

  const resetFilters = () => {
    onFilterChange({
      ...filters,
      search: '',
      trackerId: 'all',
      statusId: 'all',
      priorityId: 'all',
      assigneeId: 'all',
      versionId: 'all',
      onlyOverdue: false,
      onlyMyTasks: false,
      timePeriod: 'all',
      customStart: '',
      customEnd: '',
    });
  };

  const handlePeriodChange = (period: TimePeriodType) => {
    if (period === 'specific_month' && !filters.specificMonth) {
      updateField('specificMonth', currentMonthStr);
    }
    updateField('timePeriod', period);
  };

  return (
    <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 shadow-xs mb-5 space-y-3">
      {/* Row 1: Search & Quick toggles & Fetch Controls */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            id="filter-search-input"
            type="text"
            placeholder="Tìm theo tiêu đề, mô tả, hoặc gõ #ID (VD: #1234)..."
            value={filters.search}
            onChange={(e) => updateField('search', e.target.value)}
            className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs sm:text-sm text-slate-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all placeholder:text-slate-400"
          />
          {filters.search && (
            <button
              onClick={() => updateField('search', '')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
              title="Xóa tìm kiếm"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Quick Toggles */}
        <div className="flex items-center gap-2 flex-wrap">
          {currentUserId && (
            <button
              id="filter-my-tasks-btn"
              onClick={() => updateField('onlyMyTasks', !filters.onlyMyTasks)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                filters.onlyMyTasks
                  ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-2xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Việc của tôi</span>
            </button>
          )}

          <button
            id="filter-overdue-btn"
            title="Quá hạn = hạn hoàn thành trước hôm nay và trạng thái chưa được Redmine đánh dấu Đã đóng"
            onClick={() => updateField('onlyOverdue', !filters.onlyOverdue)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
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

          {/* Sync / Refresh */}
          <button
            onClick={onRefresh}
            disabled={isLoading}
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 border border-slate-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
            title="Làm mới dữ liệu từ Redmine"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
          </button>

          {/* Progressive data count */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200 text-xs">
            <span className="font-semibold text-slate-700">
              {totalLoaded}
              {totalAvailable > totalLoaded ? (
                <span className="text-slate-400 font-normal"> / {totalAvailable} việc · tải nền</span>
              ) : (
                <span className="text-slate-400 font-normal"> việc</span>
              )}
            </span>
          </div>
        </div>
      </div>

      {/* Progress bar if fetching multiple pages */}
      {fetchProgress && !fetchProgress.isFinished && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 flex items-center justify-between gap-3 text-xs text-indigo-700">
          <div className="flex items-center gap-2">
            <RefreshCw className="w-3.5 h-3.5 animate-spin text-indigo-600" />
            <span>
              Đã hiển thị dữ liệu hiện có; đang đồng bộ nền: <strong>{fetchProgress.loaded}</strong> / {fetchProgress.total} công việc
            </span>
          </div>
          <div className="w-32 bg-indigo-200 rounded-full h-2 overflow-hidden">
            <div
              className="bg-indigo-600 h-2 transition-all duration-300 rounded-full"
              style={{ width: `${Math.min(100, Math.round((fetchProgress.loaded / (fetchProgress.total || 1)) * 100))}%` }}
            />
          </div>
        </div>
      )}

      {/* Row 2: Time Management Bar (Tháng / Tuần / Mọi lúc) */}
      <div className="bg-slate-50/80 p-2.5 rounded-lg border border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5">
        {/* Left: Quick Time Presets */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1 mr-1">
            <Calendar className="w-3.5 h-3.5 text-indigo-500" />
            Thời gian:
          </span>

          <button
            onClick={() => handlePeriodChange('all')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              filters.timePeriod === 'all'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Tất cả
          </button>

          <button
            onClick={() => handlePeriodChange('this_month')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              filters.timePeriod === 'this_month'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Tháng này
          </button>

          <button
            onClick={() => handlePeriodChange('last_month')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              filters.timePeriod === 'last_month'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Tháng trước
          </button>

          <button
            onClick={() => handlePeriodChange('this_week')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              filters.timePeriod === 'this_week'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Tuần này
          </button>

          <button
            onClick={() => handlePeriodChange('last_week')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              filters.timePeriod === 'last_week'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Tuần trước
          </button>

          <button
            onClick={() => handlePeriodChange('today')}
            className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              filters.timePeriod === 'today'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            Hôm nay
          </button>

          {/* Specific Month Picker */}
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md px-1.5 py-0.5">
            <span className="text-[10px] text-slate-400 font-medium">Tháng:</span>
            <input
              type="month"
              value={filters.specificMonth || currentMonthStr}
              onChange={(e) => {
                updateField('specificMonth', e.target.value);
                updateField('timePeriod', 'specific_month');
              }}
              className="text-xs bg-transparent border-none text-slate-700 font-semibold focus:outline-none cursor-pointer"
            />
          </div>

          {/* Custom Date Range Toggle */}
          <button
            onClick={() => {
              setShowCustomDateModal(!showCustomDateModal);
              if (filters.timePeriod !== 'custom') {
                updateField('timePeriod', 'custom');
              }
            }}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              filters.timePeriod === 'custom'
                ? 'bg-indigo-600 text-white shadow-2xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <CalendarRange className="w-3 h-3" />
            <span>Tùy chọn ngày</span>
            <ChevronDown className="w-3 h-3 ml-0.5" />
          </button>
        </div>

        {/* Right: Date field to filter against */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span className="text-[11px] text-slate-400">Lọc theo:</span>
          <select
            value={filters.dateField}
            onChange={(e) => updateField('dateField', e.target.value as DateFieldType)}
            className="bg-white border border-slate-200 rounded-md px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="created_on">Ngày tạo (created_on)</option>
            <option value="updated_on">Ngày cập nhật (updated_on)</option>
            <option value="due_date">Hạn hoàn thành (due_date)</option>
          </select>
        </div>
      </div>

      {/* Expanded Custom Date Range Input if active */}
      {(showCustomDateModal || filters.timePeriod === 'custom') && (
        <div className="bg-indigo-50/50 p-2.5 rounded-lg border border-indigo-200/60 flex items-center gap-3 flex-wrap text-xs">
          <span className="font-semibold text-indigo-900 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-indigo-600" />
            Khoảng thời gian:
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px]">Từ ngày:</span>
            <input
              type="date"
              value={filters.customStart}
              onChange={(e) => {
                updateField('customStart', e.target.value);
                updateField('timePeriod', 'custom');
              }}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-medium text-slate-800 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 text-[11px]">Đến ngày:</span>
            <input
              type="date"
              value={filters.customEnd}
              onChange={(e) => {
                updateField('customEnd', e.target.value);
                updateField('timePeriod', 'custom');
              }}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-medium text-slate-800 focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          {(filters.customStart || filters.customEnd) && (
            <button
              onClick={() => {
                updateField('customStart', '');
                updateField('customEnd', '');
                updateField('timePeriod', 'all');
              }}
              className="text-slate-400 hover:text-slate-600 text-xs underline cursor-pointer"
            >
              Hủy khoảng ngày
            </button>
          )}
        </div>
      )}

      {/* Row 3: Standard Redmine Dropdowns (Tracker, Status, Priority, Assignee, Milestone) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 pt-2 border-t border-slate-100">
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

