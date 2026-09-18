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
  getTimeEntries,
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
  RedmineTimeEntry,
  ViewMode,
} from './types/redmine';
import { Header } from './components/Header';
import { FilterBar, FilterState } from './components/FilterBar';
import { KanbanBoard } from './components/KanbanBoard';
import { TableView } from './components/TableView';
import { DashboardAnalytics } from './components/DashboardAnalytics';
import { TimeTrackingView } from './components/TimeTrackingView';
import { OTReportView } from './components/OTReportView';
import { TrackerExplorer } from './components/TrackerExplorer';
import { AICopilotView } from './components/AICopilotView';
import { IssueDetailModal } from './components/IssueDetailModal';
import { CreateIssueModal } from './components/CreateIssueModal';
import { SettingsModal } from './components/SettingsModal';
import { DeployModal } from './components/DeployModal';
import { AlertCircle, RefreshCw, Layers } from 'lucide-react';

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
  const [customFields, setCustomFields] = useState<RedmineCustomField[]>([]);
  const [categories, setCategories] = useState<RedmineIssueCategory[]>([]);
  const [memberships, setMemberships] = useState<RedmineMembership[]>([]);
  const [versions, setVersions] = useState<RedmineVersion[]>([]);
  const [timeEntries, setTimeEntries] = useState<RedmineTimeEntry[]>([]);

  const [activeView, setActiveView] = useState<ViewMode>('kanban');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals
  const [selectedIssueForModal, setSelectedIssueForModal] = useState<RedmineIssue | null>(null);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [showSettingsModal, setShowSettingsModal] = useState<boolean>(false);
  const [showDeployModal, setShowDeployModal] = useState<boolean>(false);

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
    fetchLimit: 100,
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
    async (projId: string, currentFilters: FilterState) => {
      const currentRequestId = ++fetchRequestIdRef.current;
      setIsLoading(true);
      setError(null);
      setFetchProgress(null);

      try {
        const dateQuery = getDateFilterQuery(
          currentFilters.timePeriod,
          currentFilters.dateField,
          {
            specificMonth: currentFilters.specificMonth,
            customStart: currentFilters.customStart,
            customEnd: currentFilters.customEnd,
          }
        );

        const maxTotalNum = currentFilters.fetchLimit === 'all' ? 5000 : currentFilters.fetchLimit;

        const [issuesRes, mems, vers, cats, times] = await Promise.all([
          fetchAllIssues(
            {
              project_id: projId === 'all' ? undefined : projId,
              status_id: '*',
              ...dateQuery,
            },
            (prog: FetchProgress) => {
              if (fetchRequestIdRef.current === currentRequestId) {
                setFetchProgress(prog);
              }
            },
            maxTotalNum
          ),
          getMemberships(projId).catch(() => []),
          getVersions(projId).catch(() => []),
          getIssueCategories(projId).catch(() => []),
          getTimeEntries(projId).catch(() => []),
        ]);

        if (fetchRequestIdRef.current === currentRequestId) {
          setIssues(issuesRes.issues);
          setTotalAvailableCount(issuesRes.total_count);
          setMemberships(mems);
          setVersions(vers);
          setCategories(cats);
          setTimeEntries(times);
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
    filters.timePeriod,
    filters.dateField,
    filters.specificMonth,
    filters.customStart,
    filters.customEnd,
    filters.fetchLimit,
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
    const today = new Date().toISOString().split('T')[0];

    return issues.filter((iss) => {
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
          const sName = iss.status.name.toLowerCase();
          if (sName.includes('close') || sName.includes('verified')) return false;
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
        const sName = iss.status.name.toLowerCase();
        if (sName.includes('close') || sName.includes('verified')) return false;
      }

      // Only My Tasks
      if (filters.onlyMyTasks && currentUser) {
        if (iss.assigned_to?.id !== currentUser.id) return false;
      }

      return true;
    });
  }, [issues, filters, currentUser]);

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
        onRefresh={() => loadProjectData(selectedProjectId, filters)}
        isLoading={isLoading}
        onOpenCreate={() => setShowCreateModal(true)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onOpenDeploy={() => setShowDeployModal(true)}
        baseUrl={config.baseUrl}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-5">
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
        {(activeView === 'kanban' || activeView === 'list') && (
          <FilterBar
            filters={filters}
            onFilterChange={setFilters}
            trackers={trackers}
            statuses={statuses}
            priorities={priorities}
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
              loadProjectData(selectedProjectId, updatedFilters);
            }}
            onRefresh={() => loadProjectData(selectedProjectId, filters)}
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
            issues={issues}
            versions={versions}
            statuses={statuses}
            onSelectIssue={(iss) => setSelectedIssueForModal(iss)}
          />
        )}

        {activeView === 'time' && (
          <TimeTrackingView
            timeEntries={timeEntries}
            issues={issues}
            selectedProject={selectedProject}
            onRefresh={() => loadProjectData(selectedProjectId, filters)}
          />
        )}

        {activeView === 'ot' && (
          <OTReportView key={`${selectedProjectId}:${config.baseUrl}:${config.apiKey}`} projectId={selectedProjectId} projectName={selectedProject?.name || 'Tất cả dự án'} baseUrl={config.baseUrl} onSelectIssue={setSelectedIssueForModal} />
        )}

        {activeView === 'trackers' && (
          <TrackerExplorer key={`${selectedProjectId}:${config.baseUrl}:${config.apiKey}`} trackers={trackers} projectId={selectedProjectId} baseUrl={config.baseUrl} onSelectIssue={setSelectedIssueForModal} />
        )}

        {activeView === 'ai' && (
          <AICopilotView
            issues={issues}
            selectedProject={selectedProject}
          />
        )}
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

      {showDeployModal && (
        <DeployModal onClose={() => setShowDeployModal(false)} />
      )}
    </div>
  );
}

