import React, { useState, useMemo, useEffect } from 'react';
import {
  FileSpreadsheet,
  Plus,
  ArrowDownToLine,
  Download,
  Search,
  Filter,
  Kanban,
  TableProperties,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Flame,
  Layers,
  RotateCcw,
  User,
} from 'lucide-react';
import type { PersonalTask } from '../../types/personalTask';
import type {
  RedmineIssue,
  RedmineUser,
  RedmineStatus,
  RedmineTracker,
  RedminePriority,
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
  getStoredConfig,
} from '../../services/redmineApi';
import {
  getSavedTasks,
  saveTasks,
  getUserScopeKey,
  getInitialSampleTasks,
  INITIAL_SAMPLE_TASKS,
} from '../../services/personalTaskStorage';
import { exportPersonalTasksToExcel } from '../../services/personalTaskExcel';
import { PersonalTaskTable } from './PersonalTaskTable';
import { PersonalTaskKanban } from './PersonalTaskKanban';
import { ExcelImportModal } from './ExcelImportModal';
import { PersonalTaskModal } from './PersonalTaskModal';
import { RedmineSyncModal } from './RedmineSyncModal';

interface PersonalTaskViewProps {
  redmineIssues: RedmineIssue[];
  currentUser: RedmineUser | null;
  baseUrl: string;
  statuses?: RedmineStatus[];
  trackers?: RedmineTracker[];
  priorities?: RedminePriority[];
  customFields?: RedmineCustomField[];
  categories?: RedmineIssueCategory[];
  versions?: RedmineVersion[];
  memberships?: RedmineMembership[];
  projects?: RedmineProject[];
  selectedProjectId?: string;
}

export const PersonalTaskView: React.FC<PersonalTaskViewProps> = ({
  redmineIssues,
  currentUser,
  baseUrl,
  statuses = DEFAULT_REDMINE_STATUSES,
  trackers = DEFAULT_REDMINE_TRACKERS,
  priorities = DEFAULT_REDMINE_PRIORITIES,
  customFields = DEFAULT_REDMINE_CUSTOM_FIELDS,
  categories = [],
  versions = [],
  memberships = [],
  projects = [],
  selectedProjectId,
}) => {
  // Redmine user display name and scope key for storage isolation
  const currentUserName = currentUser
    ? `${currentUser.firstname} ${currentUser.lastname}`.trim() || currentUser.login
    : '';
  const currentApiKey = useMemo(() => getStoredConfig().apiKey, []);
  const userScopeKey = useMemo(
    () => getUserScopeKey(currentUser, currentApiKey),
    [currentUser, currentApiKey]
  );

  const [tasks, setTasks] = useState<PersonalTask[]>(() =>
    getSavedTasks(userScopeKey, currentUserName)
  );
  const [subView, setSubView] = useState<'table' | 'kanban'>('table');

  // Reload tasks when user or scope changes
  useEffect(() => {
    const freshApiKey = getStoredConfig().apiKey;
    const freshScopeKey = getUserScopeKey(currentUser, freshApiKey);
    setTasks(getSavedTasks(freshScopeKey, currentUserName));
  }, [userScopeKey, currentUserName, currentUser]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [selectedTracker, setSelectedTracker] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRedmineSyncModal, setShowRedmineSyncModal] = useState(false);
  const [editingTask, setEditingTask] = useState<PersonalTask | null>(null);

  // Save changes to localStorage whenever tasks change (scoped by user account)
  useEffect(() => {
    saveTasks(tasks, userScopeKey);
  }, [tasks, userScopeKey]);

  // Unique weeks and categories for filter dropdowns
  const availableWeeks = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.week) set.add(t.week);
    });
    return Array.from(set);
  }, [tasks]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return Array.from(set);
  }, [tasks]);

  const existingRedmineIds = useMemo(() => {
    const set = new Set<number>();
    tasks.forEach((t) => {
      if (t.redmineIssueId) set.add(t.redmineIssueId);
    });
    return set;
  }, [tasks]);

  // Task operations
  const handleUpdateTask = (updated: PersonalTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
  };

  const handleSaveModalTask = (task: PersonalTask) => {
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = task;
        return next;
      }
      return [task, ...prev];
    });
  };

  const handleDeleteTask = (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
  };

  const handleImportTasks = (newTasks: PersonalTask[], mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      setTasks(newTasks);
    } else {
      setTasks((prev) => [...newTasks, ...prev]);
    }
  };

  const handleExportExcel = () => {
    exportPersonalTasksToExcel(filteredTasks, `Ke_hoach_dau_viec_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleResetSampleData = () => {
    if (confirm('Khôi phục danh sách dữ liệu mẫu chuẩn Redmine ban đầu?')) {
      const sample = getInitialSampleTasks(currentUserName);
      setTasks(sample);
      saveTasks(sample, userScopeKey);
    }
  };

  // KPI Calculations
  const todayStr = new Date().toISOString().split('T')[0];

  const isClosedTask = (t: PersonalTask) => {
    const s = statuses.find((st) => st.name === t.statusName);
    if (s) return s.is_closed;
    const lower = (t.statusName || '').toLowerCase();
    return lower.includes('closed') || lower.includes('done') || lower.includes('hoàn thành');
  };

  const totalCount = tasks.length;
  const inProgressCount = tasks.filter((t) => !isClosedTask(t) && t.statusName?.toLowerCase().includes('in progress')).length;
  const doneCount = tasks.filter((t) => isClosedTask(t)).length;
  const urgentCount = tasks.filter((t) => {
    const p = (t.priorityName || '').toLowerCase();
    return !isClosedTask(t) && (p.includes('urgent') || p.includes('must have') || p.includes('gấp'));
  }).length;
  const overdueCount = tasks.filter((t) => t.dueDate && t.dueDate < todayStr && !isClosedTask(t)).length;
  const dueTodayCount = tasks.filter((t) => t.dueDate && t.dueDate === todayStr && !isClosedTask(t)).length;
  const donePercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedWeek !== 'all' && t.week !== selectedWeek) return false;
      if (selectedTracker !== 'all' && t.trackerName !== selectedTracker) return false;
      if (selectedCategory !== 'all' && t.category !== selectedCategory) return false;
      if (selectedStatus !== 'all' && t.statusName !== selectedStatus) return false;
      if (selectedPriority !== 'all' && t.priorityName !== selectedPriority) return false;
      if (overdueOnly && (!t.dueDate || t.dueDate >= todayStr || isClosedTask(t))) return false;

      if (search) {
        const q = search.toLowerCase();
        const inTitle = t.title.toLowerCase().includes(q);
        const inDesc = t.description?.toLowerCase().includes(q);
        const inResult = t.resultNote?.toLowerCase().includes(q);
        const inWeek = t.week?.toLowerCase().includes(q);
        const inCat = t.category?.toLowerCase().includes(q);
        const inTracker = t.trackerName?.toLowerCase().includes(q);
        const inParent = String(t.parentTaskId || '').includes(q);
        if (!inTitle && !inDesc && !inResult && !inWeek && !inCat && !inTracker && !inParent) return false;
      }

      return true;
    });
  }, [tasks, selectedWeek, selectedTracker, selectedCategory, selectedStatus, selectedPriority, overdueOnly, search, todayStr, statuses]);

  return (
    <div className="space-y-5">
      {/* User Account Scope Indicator Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white px-5 py-3.5 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-3 border border-slate-800">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 font-bold text-sm">
            {currentUser?.firstname ? currentUser.firstname.charAt(0).toUpperCase() : 'U'}
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-slate-300">Việc cá nhân của:</span>
              <span className="text-xs font-bold text-white tracking-wide">
                {currentUserName || currentUser?.login || 'Người dùng Redmine'}
              </span>
              {currentUser?.id && (
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-indigo-500/30 text-indigo-300 border border-indigo-400/30 font-semibold">
                  Redmine #{currentUser.id}
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              Dữ liệu được lưu độc lập theo tài khoản Redmine / API Key hiện tại
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowRedmineSyncModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
            <span>Lấy việc gán cho tôi từ Redmine</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {/* Total */}
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">Tổng việc</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{totalCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        {/* In Progress */}
        <div className="bg-white p-3.5 rounded-xl border border-amber-200 bg-amber-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">In Progress</div>
            <div className="text-xl font-bold text-amber-900 mt-0.5">{inProgressCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Closed / Done</div>
            <div className="text-xl font-bold text-emerald-800 mt-0.5">
              {doneCount} <span className="text-xs font-normal text-emerald-600">({donePercent}%)</span>
            </div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-800">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>

        {/* Urgent */}
        <div className="bg-white p-3.5 rounded-xl border border-rose-200 bg-rose-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Must Have / Gấp</div>
            <div className="text-xl font-bold text-rose-800 mt-0.5">{urgentCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-rose-100 flex items-center justify-center text-rose-800">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        {/* Overdue */}
        <div className="bg-white p-3.5 rounded-xl border border-red-200 bg-red-50/30 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-red-700 uppercase tracking-wider">Quá hạn</div>
            <div className="text-xl font-bold text-red-800 mt-0.5">{overdueCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center text-red-800">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        {/* Today */}
        <div className="bg-white p-3.5 rounded-xl border border-indigo-200 bg-indigo-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wider">Hạn hôm nay</div>
            <div className="text-xl font-bold text-indigo-900 mt-0.5">{dueTodayCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center text-indigo-700">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Action Bar */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-4">
        {/* Left: View switcher & Search */}
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button
              onClick={() => setSubView('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableProperties className="w-3.5 h-3.5" />
              <span>Bảng Excel</span>
            </button>
            <button
              onClick={() => setSubView('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                subView === 'kanban' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Kanban</span>
            </button>
          </div>

          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tiêu đề, tracker, task cha, ghi chú tiến độ..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Nhập từ Excel</span>
          </button>

          <button
            onClick={() => setShowRedmineSyncModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span className="hidden sm:inline">Lấy việc Redmine</span>
          </button>

          <button
            onClick={() => {
              setEditingTask(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm việc</span>
          </button>

          <button
            onClick={handleExportExcel}
            title="Xuất danh sách ra file Excel"
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-300 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
          </button>

          <button
            onClick={handleResetSampleData}
            title="Khôi phục dữ liệu mẫu ban đầu"
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Row */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
          <Filter className="w-3.5 h-3.5" />
          <span>Lọc:</span>
        </div>

        {/* Week filter */}
        <select
          value={selectedWeek}
          onChange={(e) => setSelectedWeek(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
        >
          <option value="all">Tất cả tuần</option>
          {availableWeeks.map((w) => (
            <option key={w} value={w}>
              {w}
            </option>
          ))}
        </select>

        {/* Tracker filter */}
        <select
          value={selectedTracker}
          onChange={(e) => setSelectedTracker(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
        >
          <option value="all">Tất cả Tracker</option>
          {trackers.map((trk) => (
            <option key={trk.id} value={trk.name}>
              {trk.name}
            </option>
          ))}
        </select>

        {/* Category filter */}
        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
        >
          <option value="all">Tất cả Category</option>
          {availableCategories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {/* Status Redmine filter */}
        <select
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
        >
          <option value="all">Tất cả Status Redmine</option>
          {statuses.map((st) => (
            <option key={st.id} value={st.name}>
              {st.name}
            </option>
          ))}
        </select>

        {/* Priority Redmine filter */}
        <select
          value={selectedPriority}
          onChange={(e) => setSelectedPriority(e.target.value)}
          className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
        >
          <option value="all">Tất cả Priority Redmine</option>
          {priorities.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name}
            </option>
          ))}
        </select>

        {/* Overdue checkbox */}
        <label className="flex items-center gap-1.5 font-medium text-slate-700 cursor-pointer pl-2 border-l border-slate-200">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
            className="rounded text-red-600 focus:ring-red-500"
          />
          <span className={overdueOnly ? 'text-rose-700 font-bold' : ''}>Chỉ việc quá hạn</span>
        </label>

        {(selectedWeek !== 'all' ||
          selectedTracker !== 'all' ||
          selectedCategory !== 'all' ||
          selectedStatus !== 'all' ||
          selectedPriority !== 'all' ||
          overdueOnly ||
          search) && (
          <button
            onClick={() => {
              setSelectedWeek('all');
              setSelectedTracker('all');
              setSelectedCategory('all');
              setSelectedStatus('all');
              setSelectedPriority('all');
              setOverdueOnly(false);
              setSearch('');
            }}
            className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold underline cursor-pointer ml-auto"
          >
            Xóa bộ lọc (Hiển thị {filteredTasks.length}/{tasks.length})
          </button>
        )}
      </div>

      {/* Render Table or Kanban */}
      {subView === 'table' ? (
        <PersonalTaskTable
          tasks={filteredTasks}
          statuses={statuses}
          priorities={priorities}
          onUpdateTask={handleUpdateTask}
          onEditTask={(t) => {
            setEditingTask(t);
            setShowCreateModal(true);
          }}
          onDeleteTask={handleDeleteTask}
        />
      ) : (
        <PersonalTaskKanban
          tasks={filteredTasks}
          statuses={statuses}
          onUpdateTask={handleUpdateTask}
          onEditTask={(t) => {
            setEditingTask(t);
            setShowCreateModal(true);
          }}
        />
      )}

      {/* Modals */}
      {showImportModal && (
        <ExcelImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportTasks}
        />
      )}

      {showCreateModal && (
        <PersonalTaskModal
          task={editingTask}
          existingWeeks={availableWeeks}
          existingCategories={availableCategories}
          statuses={statuses}
          priorities={priorities}
          trackers={trackers}
          customFields={customFields}
          categories={categories}
          versions={versions}
          memberships={memberships}
          projects={projects}
          currentUser={currentUser}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTask(null);
          }}
          onSave={handleSaveModalTask}
          onDelete={handleDeleteTask}
        />
      )}

      {showRedmineSyncModal && (
        <RedmineSyncModal
          issues={redmineIssues}
          currentUser={currentUser}
          baseUrl={baseUrl}
          onClose={() => setShowRedmineSyncModal(false)}
          onImport={(newTasks) => setTasks((prev) => [...newTasks, ...prev])}
          existingTaskRedmineIds={existingRedmineIds}
        />
      )}
    </div>
  );
};
