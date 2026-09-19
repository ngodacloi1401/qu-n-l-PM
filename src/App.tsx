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
  updateIssue,
  getStoredConfig,
  getDateFilterQuery,
  FetchProgress,
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
import { KanbanBoard } from './components/KanbanBoard';
import { TableView } from './components/TableView';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { TimeTrackingView } from './components/TimeTrackingView';
import { OTReportView } from './components/OTReportView';
import { AICopilotView } from './components/AICopilotView';
import { IssueDetailModal } from './components/IssueDetailModal';
import { CreateIssueModal } from './components/CreateIssueModal';
import { SettingsModal } from './components/SettingsModal';
import { AlertCircle, RefreshCw, Layers } from 'lucide-react';
import { isIssueClosed, vietnamToday } from './services/pmAnalytics';

export default function App() {
  const [currentUser, setCurrentUser] = useState<RedmineUser | null>(null);
  const [projects, setProjects] = useState<RedmineProject[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('84'); // Hawee BIM by default or 'all'
  const [issues, setIssues] = useState<RedmineIssue[]>([]);
  const [totalAvailableCount, setTotalAvailableCount] = useState<number>(0);
  const [fetchProgress, setFetchProgress] = useState<FetchProgress | null>(null);
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
  const [error, setError] = useState<string | null>(null);

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
      if (pri && pri.length > 0) setPriorities(pri);
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
    loadInitialData();
  }, [loadInitialData]);

  // Load project-specific data (issues, members, versions, categories, time entries)
  const loadProjectData = useCallback(
    async (projId: string, currentFilters: FilterState, force = false) => {
      const currentRequestId = ++fetchRequestIdRef.current;
      setIsLoading(true);
      setError(null);
      setFetchProgress(null);
      setSnapshotAt(0);
      setIssues([]);
      setTotalAvailableCount(0);

      try {
        const maxTotalNum = Number.MAX_SAFE_INTEGER;

        const [issuesRes, mems, vers, cats] = await Promise.all([
          fetchAllIssues(
            {
              project_id: projId === 'all' ? undefined : projId,
              status_id: '*',
            },
            (prog: FetchProgress) => {
              if (fetchRequestIdRef.current === currentRequestId) {
                setFetchProgress(prog);
              }
            },
            maxTotalNum,
            { force, onCached: snapshot => {
              if (fetchRequestIdRef.current === currentRequestId) {
                setIssues(snapshot.issues.slice(0, maxTotalNum));
                setTotalAvailableCount(snapshot.total_count);
                setSnapshotAt(snapshot.fetchedAt);
              }
            } }
          ),
          getMemberships(projId).catch(() => []),
          getVersions(projId).catch(() => []),
          getIssueCategories(projId).catch(() => []),
        ]);

        if (fetchRequestIdRef.current === currentRequestId) {
          setIssues(issuesRes.issues);
          setTotalAvailableCount(issuesRes.total_count);
          setSnapshotAt(issuesRes.fetchedAt);
          setMemberships(mems);
          setVersions(vers);
          setCategories(cats);
        }
      } catch (err: any) {
        if (fetchRequestIdRef.current === currentRequestId) {
          setError(err.message || 'Lỗi khi tải dữ liệu công việc từ Redmine');
        }
      } finally {
        if (fetchRequestIdRef.current === currentRequestId) {
          setIsLoading(false);
          setFetchProgress(null);
        }
      }
    },
    []
  );

  // Trigger server fetch ONLY when project or server-side date/limit filters change
  useEffect(() => {
    if (selectedProjectId) {
      loadProjectData(selectedProjectId, filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    selectedProjectId,
  ]);

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
  const filteredIssues = useMemo(() => {
    const today = vietnamToday();
    const dateQuery = getDateFilterQuery(filters.timePeriod, filters.dateField, { specificMonth: filters.specificMonth, customStart: filters.customStart, customEnd: filters.customEnd });
    const expression = dateQuery[filters.dateField];

    return issues.filter((iss) => {
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
  }, [issues, filters, currentUser, statuses]);

  const selectedProject = projects.find((p) => String(p.id) === selectedProjectId);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col selection:bg-indigo-500 selection:text-white">
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
        baseUrl={config.baseUrl}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
        {isLoading && <div role="status" className="mb-4 p-3 bg-indigo-50 border border-indigo-200 rounded-xl text-sm text-indigo-800"><RefreshCw className="inline w-4 h-4 mr-2 animate-spin" />{fetchProgress ? `Đang tải dữ liệu Redmine: ${fetchProgress.loaded}/${fetchProgress.total} công việc (${Math.round(fetchProgress.loaded / Math.max(fetchProgress.total, 1) * 100)}%)` : 'Đang chuẩn bị và kiểm tra dữ liệu Redmine…'}</div>}
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
          <span>Dữ liệu lưu trên trình duyệt: {issues.length}/{totalAvailableCount} công việc · {new Date(snapshotAt).toLocaleString('vi-VN')}{isLoading ? ' · Đang đồng bộ…' : ''}</span>
          <button className="text-indigo-600 underline" onClick={() => {
            const blob = new Blob([JSON.stringify({ schemaVersion: 1, projectId: selectedProjectId, snapshotAt: new Date(snapshotAt).toISOString(), loadedCount: issues.length, totalAvailableCount, issues }, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a'); link.href = url; link.download = `redmine-issues-${selectedProjectId}.json`;
            document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
          }}>Xuất dữ liệu đã tải (JSON)</button>
        </div>}
        {(activeView === 'kanban' || activeView === 'list' || activeView === 'analytics' || activeView === 'ai') && (
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
            onFetchAll={() => {
              const updatedFilters: FilterState = { ...filters, fetchLimit: 'all' };
              setFilters(updatedFilters);
            }}
            onRefresh={() => loadProjectData(selectedProjectId, filters, true)}
          />
        )}

        {/* View Switcher */}
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

        <div hidden={activeView !== 'ai'}>
          <AICopilotView
            key={`${selectedProjectId}:${config.baseUrl}:${config.apiKey}`}
            projectId={selectedProjectId}
            isDataLoading={isLoading}
            totalAvailable={totalAvailableCount}
            statuses={statuses}
            issues={filteredIssues}
            scope={{ loadedCount: issues.length, filters: { ...filters } }}
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

