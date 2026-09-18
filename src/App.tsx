import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getCurrentUser,
  getProjects,
  getIssues,
  getStatuses,
  getTrackers,
  getPriorities,
  getMemberships,
  getVersions,
  getTimeEntries,
  updateIssue,
  getStoredConfig,
} from './services/redmineApi';
import {
  RedmineUser,
  RedmineProject,
  RedmineIssue,
  RedmineStatus,
  RedmineTracker,
  RedminePriority,
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
  const [statuses, setStatuses] = useState<RedmineStatus[]>([]);
  const [trackers, setTrackers] = useState<RedmineTracker[]>([]);
  const [priorities, setPriorities] = useState<RedminePriority[]>([]);
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
  });

  const config = getStoredConfig();

  // Initial load
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [user, projs, sts, trk, pri] = await Promise.all([
        getCurrentUser().catch((e) => {
          console.error(e);
          return null;
        }),
        getProjects().catch(() => []),
        getStatuses().catch(() => []),
        getTrackers().catch(() => []),
        getPriorities().catch(() => []),
      ]);

      if (user) setCurrentUser(user);
      if (projs.length > 0) {
        setProjects(projs);
        // Default to Hawee BIM if exists, else first project
        const hawee = projs.find((p) => p.name.includes('HAWEE BIM'));
        if (hawee) setSelectedProjectId(String(hawee.id));
        else setSelectedProjectId(String(projs[0].id));
      }
      setStatuses(sts);
      setTrackers(trk);
      setPriorities(pri);
    } catch (err: any) {
      setError(err.message || 'Không thể kết nối đến máy chủ Redmine');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load project-specific data (issues, members, versions, time entries)
  const loadProjectData = useCallback(async (projId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const [issuesRes, mems, vers, times] = await Promise.all([
        getIssues({
          project_id: projId === 'all' ? undefined : projId,
          limit: 100,
          status_id: '*',
        }),
        getMemberships(projId),
        getVersions(projId),
        getTimeEntries(projId),
      ]);

      setIssues(issuesRes.issues);
      setMemberships(mems);
      setVersions(vers);
      setTimeEntries(times);
    } catch (err: any) {
      setError(err.message || 'Lỗi khi tải dữ liệu công việc từ Redmine');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedProjectId) {
      loadProjectData(selectedProjectId);
    }
  }, [selectedProjectId, loadProjectData]);

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
      loadProjectData(selectedProjectId);
    }
  };

  // Filter issues client-side for smooth real-time response
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
        onRefresh={() => loadProjectData(selectedProjectId)}
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
              onClick={() => loadProjectData(selectedProjectId)}
              className="font-bold underline text-rose-700 hover:text-rose-900 cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Filters bar: shown for Kanban and List */}
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
            totalResults={filteredIssues.length}
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
            onRefresh={() => loadProjectData(selectedProjectId)}
          />
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
          onUpdated={() => loadProjectData(selectedProjectId)}
          baseUrl={config.baseUrl}
        />
      )}

      {showCreateModal && (
        <CreateIssueModal
          projects={projects}
          defaultProjectId={selectedProjectId}
          trackers={trackers}
          priorities={priorities}
          memberships={memberships}
          versions={versions}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => loadProjectData(selectedProjectId)}
        />
      )}

      {showSettingsModal && (
        <SettingsModal
          onClose={() => setShowSettingsModal(false)}
          onSaved={() => {
            loadInitialData();
            loadProjectData(selectedProjectId);
          }}
        />
      )}

      {showDeployModal && (
        <DeployModal onClose={() => setShowDeployModal(false)} />
      )}
    </div>
  );
}
