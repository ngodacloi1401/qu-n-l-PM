import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  getCurrentUser,
  getProjects,
  fetchAllIssues,
  getStatuses,
  getTrackers,
  getPriorities,
  getCustomFields,
  getIssueCategories,
  getMemberships,
  getVersions,
  getIssues,
  updateIssue,
  getStoredConfig,
  getDateFilterQuery,
  getIssueDetail,
  FetchProgress,
  IssueFilterParams,
  DEFAULT_REDMINE_PRIORITIES,
} from './services/redmineApi';
import {
  RedmineUser,
  RedmineProject,
  RedmineIssue,
  RedmineStatus,
  RedmineTracker,
  RedminePriority,
  RedmineCustomField,
  RedmineIssueCategory,
  RedmineMembership,
  RedmineVersion,
  ViewMode,
} from './types/redmine';
import { Header } from './components/Header';
import { FilterBar, FilterState } from './components/FilterBar';
import { AuthGate } from './components/AuthGate';
import { checkAuthStatus, logout } from './services/redmineApi';
import { KanbanBoard } from './components/KanbanBoard';
import { TableView } from './components/TableView';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { TimeTrackingView } from './components/TimeTrackingView';
import { OTReportView } from './components/OTReportView';
import { AICopilotView } from './components/AICopilotView';
import { IssueDetailModal } from './components/IssueDetailModal';
import { CreateIssueModal } from './components/CreateIssueModal';
import { SettingsModal } from './components/SettingsModal';
import { PersonalTaskView } from './components/personalTask/PersonalTaskView';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { isIssueClosed, vietnamToday } from './services/pmAnalytics';

export default function App() {
  const [currentUser, setCurrentUser] = useState<RedmineUser | null>(null);
  const [projects, setProjects] = useState<RedmineProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('84'); // Hawee BIM by default or 'all'
  const [issues, setIssues] = useState<RedmineIssue[]>([]);
  const [totalAvailableCount, setTotalAvailableCount] = useState<number>(0);
  const [fetchProgress, setFetchProgress] = useState<FetchProgress | null>(null);
  const [priorityIssues, setPriorityIssues] = useState<RedmineIssue[]>([]);
  const [filterProgress, setFilterProgress] = useState<FetchProgress | null>(null);
  const [isFilterLoading, setIsFilterLoading] = useState(false);
  const [statuses, setStatuses] = useState<RedmineStatus[]>([]);
  const [trackers, setTrackers] = useState<RedmineTracker[]>([]);
  const [priorities, setPriorities] = useState<RedminePriority[]>([]);
  const [snapshotAt, setSnapshotAt] = useState(0);
  const [customFields, setCustomFields] = useState<RedmineCustomField[]>([]);
  const [categories, setCategories] = useState<RedmineIssueCategory[]>([]);
  const [memberships, setMemberships] = useState<RedmineMembership[]>([]);
  const [versions, setVersions] = useState<RedmineVersion[]>([]);

  const [activeView, setActiveView] = useState<ViewMode>('kanban');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    checkAuthStatus().then((authed) => {
      setIsAuthenticated(authed);
    });
  }, []);

  const handleLogout = async () => {
    await logout();
    setIsAuthenticated(false);
    setIssues([]);
    setProjects([]);
  };

  // Modals
  const [selectedIssueForModal, setSelectedIssueForModal] = useState<RedmineIssue | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);

  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Filters
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    trackerId: 'all',
    statusId: 'all',
    priorityId: 'all',
    assigneeId: 'all',
    versionId: 'all',
    onlyOverdue: false,
    onlyMyTasks: false,
    timePeriod: 'all',
    dateField: 'created_on',
    specificMonth: defaultMonth,
    customStart: '',
    customEnd: '',
    fetchLimit: 'all',
  });

  const config = getStoredConfig();
  const fetchRequestIdRef = useRef<number>(0);
  const filterRequestIdRef = useRef<number>(0);
  const lastLoadedProjectIdRef = useRef<string | null>(null);
  const needsProjectIssues = activeView === 'kanban' || activeView === 'list' || activeView === 'analytics' || activeView === 'ai';

  // Initial load of global Redmine metadata
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [user, projs, sts, trk, pri, cfs] = await Promise.all([
        getCurrentUser().catch((e) => {
          console.error(e);
          return null;
        }),
        getProjects().catch(() => []),
        getStatuses().catch(() => []),
        getTrackers().catch(() => []),
        getPriorities().catch(() => []),
        getCustomFields().catch(() => []),
      ]);

      if (user) setCurrentUser(user);
      if (sts && sts.length > 0) setStatuses(sts);
      if (trk && trk.length > 0) setTrackers(trk);
      if (pri && pri.length > 0) {
        const merged = [...DEFAULT_REDMINE_PRIORITIES];
        pri.forEach((p) => {
          if (!merged.some((m) => m.name.toLowerCase() === p.name.toLowerCase())) {
            merged.push(p);
          }
        });
        setPriorities(merged);
      }
      if (cfs && cfs.length > 0) setCustomFields(cfs);

      if (projs.length > 0) {
        setProjects(projs);
        const hawee = projs.find((p) => p.name.includes('HAWEE BIM'));
        if (hawee) {
          setSelectedProjectId(String(hawee.id));
        } else {
          setSelectedProjectId(String(projs[0].id));
        }
      }
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối đến máy chủ Redmine');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      loadInitialData();
    }
  }, [isAuthenticated, loadInitialData]);

  // Load project-specific data (issues, members, versions, categories, time entries)
  const loadProjectData = useCallback(
    async (projId: string, currentFilters: FilterState, force = false) => {
      const isSwitchingProject = lastLoadedProjectIdRef.current !== projId;
      lastLoadedProjectIdRef.current = projId;
      const currentRequestId = ++fetchRequestIdRef.current;
      const isCurrent = () => fetchRequestIdRef.current === currentRequestId;
      let hasData = false;
      setError(null);
      setFetchProgress(null);
      if (isSwitchingProject) {
        setSnapshotAt(0);
        setIssues([]);
        setTotalAvailableCount(0);
        setPriorityIssues([]);
        setFilterProgress(null);
        hasData = false;
        setIsLoading(true);
      }
      setIsSyncing(true);

      try {
        const maxTotalNum = Number.MAX_SAFE_INTEGER;

        const [issuesRes, mems, vers, cats] = await Promise.all([
          fetchAllIssues(
            {
              project_id: projId === 'all' ? undefined : projId,
              status_id: '*',
            },
            (prog: FetchProgress) => {
              if (isCurrent()) {
                setFetchProgress(prog);
              }
            },
            maxTotalNum,
            {
              force,
              onCached: snapshot => {
                if (isCurrent()) {
                  setIssues(snapshot.issues.slice(0, maxTotalNum));
                  setTotalAvailableCount(snapshot.total_count);
                  setSnapshotAt(snapshot.fetchedAt);
                  // Cache hit -> show data immediately
                  hasData = true;
                  setIsLoading(false);
                }
              },
              onBatch: (batchIssues, total) => {
                if (isCurrent()) {
                  setIssues(batchIssues.slice(0, maxTotalNum));
                  setTotalAvailableCount(total);
                  setSnapshotAt(previous => previous || Date.now());
                  // First batch arrived -> stop blocking the UI
                  if (!hasData && batchIssues.length > 0) {
                    hasData = true;
                    setIsLoading(false);
                  }
                }
              },
            }
          ),
          getMemberships(projId).catch(() => []),
          getVersions(projId).catch(() => []),
          getIssueCategories(projId).catch(() => []),
        ]);

        if (isCurrent()) {
          setIssues(issuesRes.issues);
          setTotalAvailableCount(issuesRes.total_count);
          setSnapshotAt(issuesRes.fetchedAt);
          setMemberships(mems);
          setVersions(vers);
          setCategories(cats);
        }
      } catch (err: any) {
        if (isCurrent()) {
          setError(err.message || 'Lỗi khi tải dữ liệu công việc từ Redmine');
        }
      } finally {
        if (isCurrent()) {
          setIsLoading(false);
          setIsSyncing(false);
          setFetchProgress(null);
        }
      }
    },
    []
  );

  // Time log and OT own their date-scoped requests. Only issue-based tabs start
  // the full project sync.
  useEffect(() => {
    if (isAuthenticated && selectedProjectId && needsProjectIssues) {
      loadProjectData(selectedProjectId, filters);
    } else if (!needsProjectIssues) {
      // Ignore UI updates from an older project request. Its network work can
      // finish in the background and populate the browser cache.
      fetchRequestIdRef.current += 1;
      setIsLoading(false);
      setIsSyncing(false);
      setFetchProgress(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isAuthenticated,
    selectedProjectId,
    needsProjectIssues,
  ]);

  const hasActiveFilters = useMemo(() => Boolean(
    filters.search.trim() || filters.trackerId !== 'all' || filters.statusId !== 'all'
    || filters.priorityId !== 'all' || filters.assigneeId !== 'all' || filters.versionId !== 'all'
    || filters.onlyOverdue || filters.onlyMyTasks || filters.timePeriod !== 'all'
  ), [filters]);

  const prioritizedFilterParams = useMemo<IssueFilterParams>(() => {
    const params: IssueFilterParams = {
      project_id: selectedProjectId === 'all' ? undefined : selectedProjectId,
      status_id: filters.statusId === 'all' ? '*' : filters.statusId,
    };
    if (filters.trackerId !== 'all') params.tracker_id = filters.trackerId;
    if (filters.priorityId !== 'all') params.priority_id = filters.priorityId;
    if (filters.versionId !== 'all') params.fixed_version_id = filters.versionId;
    if (filters.onlyMyTasks && currentUser) params.assigned_to_id = currentUser.id;
    else if (filters.assigneeId === 'unassigned') params.assigned_to_id = '!*';
    else if (filters.assigneeId !== 'all') params.assigned_to_id = filters.assigneeId;
    if (filters.onlyOverdue) {
      const yesterday = new Date(`${vietnamToday()}T00:00:00+07:00`);
      yesterday.setDate(yesterday.getDate() - 1);
      params.due_date = `<=${new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(yesterday)}`;
      if (filters.statusId === 'all') params.status_id = 'open';
    }
    Object.assign(params, getDateFilterQuery(filters.timePeriod, filters.dateField, {
      specificMonth: filters.specificMonth, customStart: filters.customStart, customEnd: filters.customEnd,
    }));
    const search = filters.search.trim();
    if (search && !/^#?\d+$/.test(search)) params.subject = `~${search.slice(0, 120)}`;
    return params;
  }, [selectedProjectId, filters, currentUser]);

  // Load exactly what the active tab needs first. The authoritative project sync
  // continues separately and fills the browser cache in the background.
  useEffect(() => {
    const incomplete = isSyncing || (totalAvailableCount > 0 && issues.length < totalAvailableCount);
    const requestId = ++filterRequestIdRef.current;
    const supportsIssuePreview = activeView === 'kanban' || activeView === 'list' || activeView === 'analytics';
    if (!isAuthenticated || !selectedProjectId || !supportsIssuePreview || !incomplete) {
      setPriorityIssues([]); setFilterProgress(null); setIsFilterLoading(false); return;
    }
    const timer = window.setTimeout(() => {
      const isCurrent = () => filterRequestIdRef.current === requestId;
      setPriorityIssues([]); setFilterProgress(null); setIsFilterLoading(true);
      const search = filters.search.trim();
      const exactId = search.match(/^#?(\d+)$/)?.[1];
      const request = (async () => {
        if (exactId) {
          const issue = await getIssueDetail(Number(exactId));
          const matchesProject = selectedProjectId === 'all' || String(issue.project?.id) === selectedProjectId;
          return { issues: matchesProject ? [issue] : [], total_count: matchesProject ? 1 : 0, fetchedAt: Date.now() };
        }

        if (activeView === 'list') {
          // The table initially renders 25 rows, so fetch its first sorted page.
          const preview = await getIssues({ ...prioritizedFilterParams, limit: 25, offset: 0, sort: 'updated_on:desc' });
          if (isCurrent()) setPriorityIssues(preview.issues);
          if (!hasActiveFilters) return { ...preview, fetchedAt: Date.now() };
        } else if (activeView === 'kanban') {
          // Give every visible status column useful cards instead of taking one
          // arbitrary 100-row project page that can populate only a few columns.
          const selectedStatus = prioritizedFilterParams.status_id !== '*'
            ? [String(prioritizedFilterParams.status_id)]
            : statuses.map(status => String(status.id));
          if (selectedStatus.length) {
            const pages = await Promise.all(selectedStatus.map(statusId => getIssues({
              ...prioritizedFilterParams,
              status_id: statusId,
              limit: 20,
              offset: 0,
              sort: 'updated_on:desc',
            })));
            const previewIssues = [...new Map(pages.flatMap(page => page.issues).map(issue => [issue.id, issue])).values()];
            if (isCurrent()) setPriorityIssues(previewIssues);
            if (!hasActiveFilters) return { issues: previewIssues, total_count: pages.reduce((sum, page) => sum + page.total_count, 0), fetchedAt: Date.now() };
          }
        }

        // Analytics needs the complete filtered set. Filtered List/Kanban data
        // also keeps filling after their first visible rows have appeared.
        return fetchAllIssues(prioritizedFilterParams, progress => { if (isCurrent()) setFilterProgress(progress); }, Number.MAX_SAFE_INTEGER, {
          onCached: snapshot => { if (isCurrent()) setPriorityIssues(snapshot.issues); },
          onBatch: batch => { if (isCurrent()) setPriorityIssues(batch); },
        });
      })();
      request.then(result => { if (isCurrent()) setPriorityIssues(result.issues); })
        .catch(() => { /* The full background sync continues if Redmine rejects a filter. */ })
        .finally(() => { if (isCurrent()) { setIsFilterLoading(false); setFilterProgress(null); } });
    }, filters.search.trim() ? 350 : 80);
    return () => window.clearTimeout(timer);
  }, [isAuthenticated, selectedProjectId, activeView, hasActiveFilters, prioritizedFilterParams, filters.search, isSyncing, statuses]);

  // Handle quick status change on Kanban or Table
  const handleQuickStatusChange = async (issueId: number, newStatusId: number) => {
    try {
      // Optimistic update
      const newStatusObj = statuses.find((s) => s.id === newStatusId);
      if (newStatusObj) {
        setIssues((prev) =>
          prev.map((iss) =>
            iss.id === issueId
              ? {
                  ...iss,
                  status: { id: newStatusId, name: newStatusObj.name },
                  done_ratio: newStatusObj.is_closed ? 100 : iss.done_ratio,
                }
              : iss
          )
        );
      }

      await updateIssue(issueId, { status_id: newStatusId });
    } catch (err: any) {
      console.error('Failed to change status:', err);
      // Revert by re-fetching
      loadProjectData(selectedProjectId, filters);
    }
  };

  // Filter issues client-side for ultra-fast, smooth, zero-reload response
  const visibleIssueSource = useMemo(() => {
    const merged = new Map(priorityIssues.map(issue => [issue.id, issue]));
    issues.forEach(issue => merged.set(issue.id, issue));
    return [...merged.values()];
  }, [issues, priorityIssues]);

  const filteredIssues = useMemo(() => {
    const today = vietnamToday();
    const dateQuery = getDateFilterQuery(filters.timePeriod, filters.dateField, { specificMonth: filters.specificMonth, customStart: filters.customStart, customEnd: filters.customEnd });
    const expression = dateQuery[filters.dateField];

    return visibleIssueSource.filter((iss) => {
      if (expression) {
        const value = String(iss[filters.dateField] || '').slice(0, 10);
        if (!value) return false;
        if (expression.startsWith('><')) { const [from, to] = expression.slice(2).split('|'); if (value < from || value > to) return false; }
        else if (expression.startsWith('>=') && value < expression.slice(2)) return false;
        else if (expression.startsWith('<=') && value > expression.slice(2)) return false;
      }
      // Search
      if (filters.search.trim()) {
        const query = filters.search.toLowerCase().trim();
        const idMatch = `#${iss.id}`.includes(query) || String(iss.id) === query;
        const subjectMatch = iss.subject.toLowerCase().includes(query);
        const descMatch = iss.description?.toLowerCase().includes(query);
        if (!idMatch && !subjectMatch && !descMatch) return false;
      }

      // Tracker
      if (filters.trackerId !== 'all') {
        if (String(iss.tracker.id) !== String(filters.trackerId)) return false;
      }

      // Status
      if (filters.statusId !== 'all') {
        if (filters.statusId === 'open') {
          if (isIssueClosed(iss, statuses)) return false;
        } else {
          if (String(iss.status.id) !== String(filters.statusId)) return false;
        }
      }

      // Priority
      if (filters.priorityId !== 'all') {
        if (String(iss.priority.id) !== String(filters.priorityId)) return false;
      }

      // Assignee
      if (filters.assigneeId !== 'all') {
        if (filters.assigneeId === 'unassigned') {
          if (iss.assigned_to) return false;
        } else {
          if (String(iss.assigned_to?.id) !== String(filters.assigneeId)) return false;
        }
      }

      // Version / Milestone
      if (filters.versionId !== 'all') {
        if (String(iss.fixed_version?.id) !== String(filters.versionId)) return false;
      }

      // Overdue
      if (filters.onlyOverdue) {
        if (!iss.due_date || iss.due_date >= today) return false;
        if (isIssueClosed(iss, statuses)) return false;
      }

      // Only My Tasks
      if (filters.onlyMyTasks && currentUser) {
        if (iss.assigned_to?.id !== currentUser.id) return false;
      }

      return true;
    });
  }, [visibleIssueSource, filters, currentUser, statuses]);

  const selectedProject = projects.find((p) => String(p.id) === selectedProjectId);

  if (isAuthenticated === false) {
    return <AuthGate onAuthenticated={() => setIsAuthenticated(true)} />;
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-medium tracking-wide">Đang kiểm tra bảo mật...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`${activeView === 'ai' ? 'h-screen overflow-hidden' : 'min-h-screen'} bg-slate-50 flex flex-col selection:bg-indigo-500 selection:text-white`}>
      {/* Top App Header */}
      <Header
        currentUser={currentUser}
        projects={projects}
        selectedProjectId={selectedProjectId}
        onSelectProject={(id) => setSelectedProjectId(id)}
        activeView={activeView}
        onSelectView={(v) => setActiveView(v)}
        onRefresh={() => loadProjectData(selectedProjectId, filters, true)}
        isLoading={isLoading}
        onOpenCreate={() => setShowCreateModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onLock={handleLogout}
        baseUrl={config.baseUrl}
      />

      {/* Main Content Area */}
      <main className={`flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5 ${activeView === 'ai' ? 'min-h-0 flex flex-col overflow-hidden' : ''}`}>
        {isLoading && (activeView === 'kanban' || activeView === 'list' || activeView === 'analytics') && <div role="status" className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800"><RefreshCw className="inline w-4 h-4 mr-2 animate-spin" />{fetchProgress ? `Đang tải trang dữ liệu đầu tiên: ${fetchProgress.loaded}/${fetchProgress.total} công việc` : 'Đang chuẩn bị và kiểm tra dữ liệu Redmine…'}</div>}
        {isFilterLoading && (activeView === 'kanban' || activeView === 'list' || activeView === 'analytics') && <div role="status" className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-center gap-2"><RefreshCw className="w-3.5 h-3.5 animate-spin flex-shrink-0" /><span>Đang tải dữ liệu cần hiển thị cho {activeView === 'kanban' ? 'Kanban' : activeView === 'list' ? 'Danh sách việc' : 'Báo cáo PM'}{hasActiveFilters ? ' theo bộ lọc đã chọn' : ''}{filterProgress ? `: ${filterProgress.loaded}/${filterProgress.total}` : '…'}; phần còn lại tiếp tục đồng bộ nền.</span></div>}
        {/* Error notification */}
        {error && (
          <div className="mb-5 p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={() => loadProjectData(selectedProjectId, filters)}
              className="font-bold underline text-rose-700 hover:text-rose-900 cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Filters bar: shown for Kanban, List, and Analytics */}
        {!!snapshotAt && (activeView === 'kanban' || activeView === 'list' || activeView === 'analytics') && <div className="mb-3 flex flex-wrap justify-between gap-2 text-xs text-slate-500">
          <span>Dữ liệu lưu trên trình duyệt: {issues.length}/{totalAvailableCount} công việc · {new Date(snapshotAt).toLocaleString('vi-VN')}{isSyncing ? ' · Đang đồng bộ…' : ''}</span>
          <button className="text-indigo-600 underline" onClick={() => {
            const blob = new Blob([JSON.stringify({ schemaVersion: 1, projectId: selectedProjectId, snapshotAt: new Date(snapshotAt).toISOString(), loadedCount: issues.length, totalAvailableCount, issues }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url; link.download = `redmine-issues-${selectedProjectId}.json`;
            document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
          }}>Xuất dữ liệu đã tải (JSON)</button>
        </div>}
        {(activeView === 'kanban' || activeView === 'list' || activeView === 'analytics') && (
          <FilterBar
            filters={filters}
            onFilterChange={setFilters}
            trackers={trackers}
            statuses={statuses}
            priorities={[...new Map([...priorities, ...issues.map(i => i.priority)].map(p => [p.id, p])).values()]}
            memberships={memberships}
            versions={versions}
            currentUserId={currentUser?.id}
            totalLoaded={issues.length}
            totalAvailable={totalAvailableCount}
            isLoading={isLoading}
            fetchProgress={fetchProgress}
            onRefresh={() => loadProjectData(selectedProjectId, filters, true)}
          />
        )}

        {/* View Switcher */}
        {activeView === 'personal' && (
          <PersonalTaskView
            currentUser={currentUser}
            baseUrl={config.baseUrl}
            statuses={statuses}
            trackers={trackers}
            priorities={[...new Map([...priorities, ...issues.map(i => i.priority)].filter(Boolean).map(p => [p.id || p.name, p])).values()]}
            customFields={customFields}
            categories={categories}
            versions={versions}
            memberships={memberships}
            projects={projects}
            selectedProjectId={selectedProjectId}
          />
        )}

        {activeView === 'kanban' && (
          <KanbanBoard
            issues={filteredIssues}
            statuses={statuses}
            trackers={trackers}
            priorities={priorities}
            onSelectIssue={(iss) => setSelectedIssueForModal(iss)}
            onQuickStatusChange={handleQuickStatusChange}
            baseUrl={config.baseUrl}
          />
        )}

        {activeView === 'list' && (
          <TableView
            issues={filteredIssues}
            statuses={statuses}
            priorities={priorities}
            onSelectIssue={(iss) => setSelectedIssueForModal(iss)}
            onQuickStatusChange={handleQuickStatusChange}
            baseUrl={config.baseUrl}
          />
        )}

        {activeView === 'analytics' && (
          <DashboardAnalytics
            issues={filteredIssues}
            loadedCount={issues.length}
            totalAvailable={totalAvailableCount}
            versions={versions}
            statuses={statuses}
            onSelectIssue={(iss) => setSelectedIssueForModal(iss)}
          />
        )}

        {activeView === 'time' && (
          <TimeTrackingView
            selectedProject={selectedProject}
            onRefresh={() => loadProjectData(selectedProjectId, filters)}
          />
        )}

        {activeView === 'ot' && (
          <OTReportView key={`${selectedProjectId}:${config.baseUrl}:${config.apiKey}`} projectId={selectedProjectId} projectName={selectedProject?.name || 'Tất cả dự án'} baseUrl={config.baseUrl} onSelectIssue={setSelectedIssueForModal} />
        )}

        <div hidden={activeView !== 'ai'} className={activeView === 'ai' ? 'min-h-0 flex-1' : ''}>
          <AICopilotView
            key={`${selectedProjectId}:${config.baseUrl}:${config.apiKey}`}
            projectId={selectedProjectId}
            isDataLoading={isLoading || isSyncing}
            totalAvailable={totalAvailableCount}
            statuses={statuses}
            issues={issues}
            scope={{ loadedCount: issues.length }}
            selectedProject={selectedProject}
          />
        </div>
      </main>

      {/* Modals */}
      {selectedIssueForModal && (
        <IssueDetailModal
          issue={selectedIssueForModal}
          statuses={statuses}
          priorities={priorities}
          memberships={memberships}
          onClose={() => setSelectedIssueForModal(null)}
          onUpdated={() => loadProjectData(selectedProjectId, filters)}
          baseUrl={config.baseUrl}
        />
      )}

      {showCreateModal && (
        <CreateIssueModal
          projects={projects}
          defaultProjectId={selectedProjectId}
          trackers={trackers}
          statuses={statuses}
          priorities={priorities}
          customFields={customFields}
          categories={categories}
          memberships={memberships}
          versions={versions}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => loadProjectData(selectedProjectId, filters)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          onSaved={() => {
            loadInitialData();
            loadProjectData(selectedProjectId, filters);
          }}
        />
      )}

    </div>
  );
}

