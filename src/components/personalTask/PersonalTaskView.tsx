import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  FileSpreadsheet,
  Plus,
  Download,
  Search,
  Filter,
  Calendar,
  Clock,
  AlertCircle,
  CheckCircle2,
  Flame,
  Layers,
  RotateCcw,
  Sparkles,
  Link2,
} from 'lucide-react';
import type { PersonalTask } from '../../types/personalTask';
import type {
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
} from '../../services/personalTaskStorage';
import { exportPersonalTasksToExcel } from '../../services/personalTaskExcel';
import { PersonalTaskKanban } from './PersonalTaskKanban';
import { ExcelImportModal } from './ExcelImportModal';
import { PersonalTaskModal } from './PersonalTaskModal';
import { PersonalTaskAIModal } from './PersonalTaskAIModal';
import { GoogleSheetsSyncModal } from './GoogleSheetsSyncModal';
import {
  getGoogleSheetsSyncConfig,
  saveGoogleSheetsSyncConfig,
  fetchGoogleSheetTasks,
  mergePersonalTasks,
  pushTaskToGoogleSheet,
  pullTasksFromAppsScript,
} from '../../services/googleSheetsSync';

interface PersonalTaskViewProps {
  currentUser?: RedmineUser | null;
  baseUrl?: string;
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
  currentUser = null,
  baseUrl = '',
  statuses = DEFAULT_REDMINE_STATUSES,
  priorities = DEFAULT_REDMINE_PRIORITIES,
  trackers = DEFAULT_REDMINE_TRACKERS,
  customFields = DEFAULT_REDMINE_CUSTOM_FIELDS,
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

  // Load personal/Excel tasks (strictly exclude redmine source tasks)
  const [tasks, setTasks] = useState<PersonalTask[]>(() =>
    getSavedTasks(userScopeKey, currentUserName).filter((task) => task.source !== 'redmine')
  );
  const activeStorageScopeRef = useRef(userScopeKey);
  const skipNextStorageSaveRef = useRef(false);

  // Reload tasks when user or scope changes
  useEffect(() => {
    const freshApiKey = getStoredConfig().apiKey;
    const freshScopeKey = getUserScopeKey(currentUser, freshApiKey);
    if (activeStorageScopeRef.current === freshScopeKey) return;
    activeStorageScopeRef.current = freshScopeKey;
    skipNextStorageSaveRef.current = true;
    setTasks(getSavedTasks(freshScopeKey, currentUserName).filter((task) => task.source !== 'redmine'));
  }, [userScopeKey, currentUserName, currentUser]);

  // Save changes to localStorage whenever tasks change (scoped by user account)
  useEffect(() => {
    if (skipNextStorageSaveRef.current) {
      skipNextStorageSaveRef.current = false;
      return;
    }
    saveTasks(tasks, userScopeKey);
  }, [tasks, userScopeKey]);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedWeek, setSelectedWeek] = useState('all');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPriority, setSelectedPriority] = useState('all');
  const [overdueOnly, setOverdueOnly] = useState(false);

  // Modals
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAIModal, setShowAIModal] = useState(false);
  const [showGoogleSheetsModal, setShowGoogleSheetsModal] = useState(false);
  const [editingTask, setEditingTask] = useState<PersonalTask | null>(null);
  const [importNotice, setImportNotice] = useState<string | null>(null);

  // Dynamic filter options derived from ACTUAL personal task data
  const availableWeeks = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.week && t.week.trim()) set.add(t.week.trim());
    });
    return Array.from(set).sort();
  }, [tasks]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.category && t.category.trim()) set.add(t.category.trim());
    });
    return Array.from(set).sort();
  }, [tasks]);

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.statusName) set.add(t.statusName);
    });
    return Array.from(set).sort();
  }, [tasks]);

  const availablePriorities = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach((t) => {
      if (t.priorityName) set.add(t.priorityName);
    });
    return Array.from(set).sort();
  }, [tasks]);

  // Auto-reset filters if current value is no longer valid
  useEffect(() => {
    if (selectedCategory !== 'all' && !availableCategories.includes(selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [availableCategories, selectedCategory]);

  useEffect(() => {
    if (selectedStatus !== 'all' && !availableStatuses.includes(selectedStatus)) {
      setSelectedStatus('all');
    }
  }, [availableStatuses, selectedStatus]);

  useEffect(() => {
    if (selectedPriority !== 'all' && !availablePriorities.includes(selectedPriority)) {
      setSelectedPriority('all');
    }
  }, [availablePriorities, selectedPriority]);

  useEffect(() => {
    if (selectedWeek !== 'all' && !availableWeeks.includes(selectedWeek)) {
      setSelectedWeek('all');
    }
  }, [availableWeeks, selectedWeek]);

    // Auto-sync from Google Sheets on mount/tab open if enabled
  useEffect(() => {
    const config = getGoogleSheetsSyncConfig(userScopeKey);
    if (!config.autoSync) return;

    let cancelled = false;

    if (config.scriptUrl) {
      pullTasksFromAppsScript(config.scriptUrl)
        .then((incoming) => {
          if (cancelled || !incoming.length) return;
          setTasks((prev) => {
            const next = config.syncMode === 'replace' ? incoming : mergePersonalTasks(prev, incoming);
            return next;
          });
          setImportNotice(`Đã đồng bộ 2 chiều: ${incoming.length} công việc từ Google Sheets.`);
        })
        .catch((err) => {
          console.warn('Auto-sync from Apps Script skipped:', err.message);
        });
    } else if (config.sheetUrl) {
      fetchGoogleSheetTasks(config.sheetUrl, config.selectedSheetName)
        .then((res) => {
          if (cancelled || !res.tasks.length) return;
          setTasks((prev) => {
            const next = config.syncMode === 'replace' ? res.tasks : mergePersonalTasks(prev, res.tasks);
            return next;
          });
          saveGoogleSheetsSyncConfig(userScopeKey, {
            ...config,
            lastSyncedAt: Date.now(),
            lastTaskCount: res.tasks.length,
            selectedSheetName: res.sheetName,
          });
          setImportNotice(`Tự động đồng bộ ${res.tasks.length} công việc từ Google Sheets.`);
        })
        .catch((err) => {
          console.warn('Auto-sync Google Sheets skipped:', err.message);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [userScopeKey]);

  // Task operations — with auto-push to Google Sheet (2-way sync)
  const handleUpdateTask = (updated: PersonalTask) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

    // Auto-push status/field change to Google Sheet (async, non-blocking)
    const cfg = getGoogleSheetsSyncConfig(userScopeKey);
    if (cfg.scriptUrl && cfg.autoPush !== false) {
      pushTaskToGoogleSheet(cfg.scriptUrl, updated, 'update').catch(() => {});
    }
  };

  const handleSaveModalTask = (task: PersonalTask) => {
    let isNew = false;
    setTasks((prev) => {
      const idx = prev.findIndex((t) => t.id === task.id);
      if (idx !== -1) {
        const next = [...prev];
        next[idx] = task;
        return next;
      }
      isNew = true;
      return [task, ...prev];
    });

    // Auto-push create/update to Google Sheet (async, non-blocking)
    const cfg = getGoogleSheetsSyncConfig(userScopeKey);
    if (cfg.scriptUrl && cfg.autoPush !== false) {
      pushTaskToGoogleSheet(cfg.scriptUrl, task, isNew ? 'create' : 'update').catch(() => {});
    }
  };

  const handleDeleteTask = (id: string) => {
    const deletedTask = tasks.find((t) => t.id === id);
    setTasks((prev) => prev.filter((t) => t.id !== id));

    // Auto-push delete to Google Sheet (async, non-blocking)
    if (deletedTask) {
      const cfg = getGoogleSheetsSyncConfig(userScopeKey);
      if (cfg.scriptUrl && cfg.autoPush !== false) {
        pushTaskToGoogleSheet(cfg.scriptUrl, deletedTask, 'delete').catch(() => {});
      }
    }
  };

  const handleImportTasks = (newTasks: PersonalTask[], mode: 'append' | 'replace') => {
    if (mode === 'replace') {
      setTasks(newTasks);
    } else {
      setTasks((prev) => [...newTasks, ...prev.filter((task) => task.source !== 'redmine')]);
    }
    setSelectedWeek('all');
    setSelectedCategory('all');
    setSelectedStatus('all');
    setSelectedPriority('all');
    setOverdueOnly(false);
    setImportNotice(`Đã nhập thành công ${newTasks.length} công việc từ Excel.`);
  };

  const handleExportExcel = () => {
    exportPersonalTasksToExcel(
      filteredTasks,
      `Ke_hoach_ca_nhan_${new Date().toISOString().split('T')[0]}.xlsx`
    );
  };

  const handleResetSampleData = () => {
    if (confirm('Xóa toàn bộ công việc cá nhân và công việc đã nhập từ Excel?')) {
      setTasks([]);
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
    return !isClosedTask(t) && (p.includes('urgent') || p.includes('immediate') || p.includes('gấp') || p.includes('must have'));
  }).length;
  const overdueCount = tasks.filter((t) => t.dueDate && t.dueDate < todayStr && !isClosedTask(t)).length;
  const dueTodayCount = tasks.filter((t) => t.dueDate && t.dueDate === todayStr && !isClosedTask(t)).length;
  const donePercent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  // Filtered tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (selectedWeek !== 'all' && t.week !== selectedWeek) return false;
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
        if (!inTitle && !inDesc && !inResult && !inWeek && !inCat) return false;
      }

      return true;
    });
  }, [tasks, selectedWeek, selectedCategory, selectedStatus, selectedPriority, overdueOnly, search, todayStr, statuses]);

  return (
    <div className="space-y-5">
      {importNotice && (
        <div role="status" aria-live="polite" className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-3 rounded-xl flex items-center justify-between gap-3 text-sm">
          <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" />{importNotice}</span>
          <button type="button" onClick={() => setImportNotice(null)} className="text-emerald-700 underline text-xs cursor-pointer">Đóng</button>
        </div>
      )}

      {/* Header Banner: Independent Personal Task Space */}
      <div className="px-5 py-4 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4 border bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-950 text-white border-emerald-900">
        <div className="flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
            <FileSpreadsheet className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold flex items-center gap-2">
              Kế hoạch công việc cá nhân (Excel & Thủ công)
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/30 text-emerald-200 border border-emerald-400/30">
                Độc lập
              </span>
            </div>
            <p className="text-xs text-emerald-200/80 mt-0.5">
              Quản lý tiến độ cá nhân từ file Excel hoặc tạo mới. Lưu trữ độc lập trên trình duyệt, không lẫn lộn với Redmine.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAIModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-purple-200" />
            <span>AI Lên kế hoạch</span>
          </button>
                    <button
            onClick={() => setShowGoogleSheetsModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            title="Tự động đồng bộ từ Google Sheets"
          >
            <Link2 className="w-4 h-4 text-emerald-600" />
            <span>Google Sheets</span>
            {Boolean(getGoogleSheetsSyncConfig(userScopeKey).scriptUrl) ? (
              <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-200 text-emerald-900 rounded" title="Đang đồng bộ 2 chiều (Apps Script)">2 Chiều</span>
            ) : Boolean(getGoogleSheetsSyncConfig(userScopeKey).sheetUrl) ? (
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" title="Đang liên kết Google Sheets (1 chiều)" />
            ) : null}
          </button>
          <button
            onClick={() => setShowImportModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Nhập từ Excel</span>
          </button>
          <button
            onClick={() => {
              setEditingTask(null);
              setShowCreateModal(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white text-emerald-900 hover:bg-emerald-50 rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4 text-emerald-700" />
            <span>Thêm việc mới</span>
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
            <div className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider">Đang làm</div>
            <div className="text-xl font-bold text-amber-900 mt-0.5">{inProgressCount}</div>
          </div>
          <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center text-amber-800">
            <Clock className="w-5 h-5" />
          </div>
        </div>

        {/* Completed */}
        <div className="bg-white p-3.5 rounded-xl border border-emerald-200 bg-emerald-50/20 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider">Hoàn thành</div>
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
            <div className="text-[11px] font-semibold text-rose-700 uppercase tracking-wider">Ưu tiên cao / Gấp</div>
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
        {/* Left: Search */}
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tiêu đề, nhóm việc, ghi chú, đợt tuần..."
              className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:outline-none transition-colors"
            />
          </div>
        </div>

        {/* Right: Export & Clear Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-xl border border-slate-300 text-xs font-semibold transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Xuất Excel</span>
          </button>
          <button
            onClick={handleResetSampleData}
            title="Xóa toàn bộ dữ liệu công việc cá nhân"
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filter Row: Dynamic filters matching personal task content */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center gap-3 text-xs">
        <div className="flex items-center gap-1 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
          <Filter className="w-3.5 h-3.5" />
          <span>Lọc:</span>
        </div>

        {/* Week filter */}
        {availableWeeks.length > 0 && (
          <select
            value={selectedWeek}
            onChange={(e) => setSelectedWeek(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
          >
            <option value="all">Tất cả tuần / đợt</option>
            {availableWeeks.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        )}

        {/* Category filter */}
        {availableCategories.length > 0 && (
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
          >
            <option value="all">Tất cả nhóm việc</option>
            {availableCategories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}

        {/* Status filter */}
        {availableStatuses.length > 0 && (
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
          >
            <option value="all">Tất cả trạng thái</option>
            {availableStatuses.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}

        {/* Priority filter */}
        {availablePriorities.length > 0 && (
          <select
            value={selectedPriority}
            onChange={(e) => setSelectedPriority(e.target.value)}
            className="bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-700 font-medium"
          >
            <option value="all">Tất cả mức ưu tiên</option>
            {availablePriorities.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        )}

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
          selectedCategory !== 'all' ||
          selectedStatus !== 'all' ||
          selectedPriority !== 'all' ||
          overdueOnly ||
          search) && (
          <button
            onClick={() => {
              setSelectedWeek('all');
              setSelectedCategory('all');
              setSelectedStatus('all');
              setSelectedPriority('all');
              setOverdueOnly(false);
              setSearch('');
            }}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-semibold underline cursor-pointer ml-auto"
          >
            Xóa bộ lọc (Hiển thị {filteredTasks.length}/{tasks.length})
          </button>
        )}
      </div>

      {/* Empty state */}
      {filteredTasks.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 mb-4">
            <FileSpreadsheet className="w-8 h-8" />
          </div>
          <h4 className="text-base font-bold text-slate-800 mb-1">
            Chưa có công việc cá nhân nào
          </h4>
          <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
            Nhấn "Nhập từ Excel" để đưa file kế hoạch của bạn vào, hoặc "Thêm việc mới" để tạo thủ công, hoặc dùng "AI Lên kế hoạch".
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setShowImportModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Nhập file Excel</span>
            </button>
            <button
              onClick={() => {
                setEditingTask(null);
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tạo việc thủ công</span>
            </button>
          </div>
        </div>
      )}

      {/* Kanban view */}
      {filteredTasks.length > 0 && (
        <PersonalTaskKanban
          tasks={filteredTasks}
          statuses={statuses}
          onUpdateTask={handleUpdateTask}
          readOnly={false}
          baseUrl={baseUrl}
          onEditTask={(t) => {
            setEditingTask(t);
            setShowCreateModal(true);
          }}
        />
      )}

      {/* Modals */}
            {showGoogleSheetsModal && (
        <GoogleSheetsSyncModal
          userScopeKey={userScopeKey}
          tasks={tasks}
          onTasksUpdated={(updatedTasks, message) => {
            setTasks(updatedTasks);
            setImportNotice(message);
          }}
          onClose={() => setShowGoogleSheetsModal(false)}
        />
      )}

      {showImportModal && (
        <ExcelImportModal
          onClose={() => setShowImportModal(false)}
          onImport={handleImportTasks}
        />
      )}

      {showCreateModal && (
        <PersonalTaskModal
          task={editingTask}
          onClose={() => {
            setShowCreateModal(false);
            setEditingTask(null);
          }}
          onSave={handleSaveModalTask}
          onDelete={handleDeleteTask}
          statuses={statuses}
          priorities={priorities}
          existingWeeks={availableWeeks}
          existingCategories={availableCategories}
        />
      )}

      {showAIModal && (
        <PersonalTaskAIModal
          onClose={() => setShowAIModal(false)}
          onAddTasks={(newTasks) => {
            handleImportTasks(newTasks, 'append');
          }}
          projectName={projects.find((p) => String(p.id) === selectedProjectId)?.name || 'Dự án chung'}
        />
      )}
    </div>
  );
};
