import React from 'react';
import {
  Kanban,
  TableProperties,
  BarChart3,
  Clock,
  Sparkles,
  Plus,
  RefreshCw,
  Settings,
  GitBranch,
  ExternalLink,
  Building2,
} from 'lucide-react';
import { RedmineProject, RedmineUser, ViewMode } from '../types/redmine';

interface HeaderProps {
  currentUser: RedmineUser | null;
  projects: RedmineProject[];
  selectedProjectId: string;
  onSelectProject: (id: string) => void;
  activeView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  onRefresh: () => void;
  isLoading: boolean;
  onOpenCreate: () => void;
  onOpenSettings: () => void;
  onOpenDeploy: () => void;
  baseUrl: string;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  projects,
  selectedProjectId,
  onSelectProject,
  activeView,
  onSelectView,
  onRefresh,
  isLoading,
  onOpenCreate,
  onOpenSettings,
  onOpenDeploy,
  baseUrl,
}) => {
  const selectedProject = projects.find((p) => String(p.id) === selectedProjectId);

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand & Project Selector */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-sm font-bold text-lg tracking-wider">
                PM
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-bold text-slate-900 leading-tight">
                    Redmine PM Workspace
                  </h1>
                </div>
                <p className="text-xs text-slate-500 hidden md:block">
                  Quản lý dự án & tiến độ công việc Redmine cho Project Manager
                </p>
              </div>
            </div>

            {/* Project Picker */}
            <div className="h-6 w-px bg-slate-200 hidden sm:block" />

            <div className="relative flex items-center">
              <Building2 className="w-4 h-4 text-slate-400 absolute left-3 pointer-events-none" />
              <select
                id="project-selector"
                value={selectedProjectId}
                onChange={(e) => onSelectProject(e.target.value)}
                className="pl-9 pr-8 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-300 rounded-lg text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors cursor-pointer"
              >
                <option value="all">Tất cả dự án ({projects.length})</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick Actions & User Profile */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Create New Issue Button */}
            <button
              id="btn-create-issue"
              onClick={onOpenCreate}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-lg text-sm font-medium shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Tạo công việc</span>
            </button>

            {/* Refresh Button */}
            <button
              id="btn-refresh"
              onClick={onRefresh}
              disabled={isLoading}
              title="Làm mới dữ liệu Redmine"
              className={`p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-all cursor-pointer ${
                isLoading ? 'opacity-60 pointer-events-none' : ''
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>

            {/* GitHub & Vercel Deploy info */}
            <button
              id="btn-deploy-guide"
              onClick={onOpenDeploy}
              title="Hướng dẫn Deploy Vercel & GitHub"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              <GitBranch className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden lg:inline">GitHub / Vercel</span>
            </button>

            {/* Settings Modal Toggle */}
            <button
              id="btn-settings"
              onClick={onOpenSettings}
              title="Cài đặt kết nối Redmine"
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              <Settings className="w-4 h-4" />
            </button>

            {/* Redmine Web Link */}
            {selectedProject ? (
              <a
                href={`${baseUrl}/projects/${selectedProject.identifier}`}
                target="_blank"
                rel="noreferrer"
                title="Mở dự án trên AnyBIM Redmine web"
                className="hidden xl:inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 px-2 py-1"
              >
                <span>Redmine Web</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            ) : (
              <a
                href={baseUrl}
                target="_blank"
                rel="noreferrer"
                title="Mở AnyBIM Redmine web"
                className="hidden xl:inline-flex items-center gap-1 text-xs text-slate-500 hover:text-indigo-600 px-2 py-1"
              >
                <span>Redmine Web</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {/* User Profile Badge */}
            {currentUser && (
              <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="w-8 h-8 rounded-full bg-slate-800 text-amber-300 font-semibold text-xs flex items-center justify-center shadow-xs">
                  {currentUser.firstname?.[0] || 'L'}
                  {currentUser.lastname?.[0] || 'N'}
                </div>
                <div className="hidden lg:block text-left leading-tight">
                  <div className="text-xs font-semibold text-slate-900">
                    {currentUser.firstname} {currentUser.lastname}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    PM ({currentUser.login || 'loi_nd'})
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* View Navigation Tabs */}
        <div className="flex items-center justify-between border-t border-slate-100 -mb-px overflow-x-auto no-scrollbar">
          <nav className="flex space-x-1 sm:space-x-4 py-2">
            <button
              id="tab-kanban"
              onClick={() => onSelectView('kanban')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeView === 'kanban'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Kanban className="w-4 h-4" />
              <span>Bảng Kanban</span>
            </button>

            <button
              id="tab-list"
              onClick={() => onSelectView('list')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeView === 'list'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <TableProperties className="w-4 h-4" />
              <span>Danh sách việc</span>
            </button>

            <button
              id="tab-analytics"
              onClick={() => onSelectView('analytics')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeView === 'analytics'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Báo cáo & Phân tích PM</span>
            </button>

            <button
              id="tab-time"
              onClick={() => onSelectView('time')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeView === 'time'
                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Nhật ký giờ làm (Time Log)</span>
            </button>

            <button
              id="tab-ot"
              onClick={() => onSelectView('ot')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors ${activeView === 'ot' ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              <Clock className="w-4 h-4" /><span>Tổng hợp OT</span>
            </button>
            <button
              id="tab-ai"
              onClick={() => onSelectView('ai')}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                activeView === 'ai'
                  ? 'bg-purple-50 text-purple-700 border border-purple-200'
                  : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50/50'
              }`}
            >
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span>AI PM Copilot</span>
              <span className="bg-purple-200 text-purple-800 text-[10px] font-bold px-1.5 py-0.2 rounded-full">
                Gemini
              </span>
            </button>
          </nav>

          {selectedProject && (
            <div className="hidden md:flex items-center text-xs text-slate-500 gap-2 pr-2">
              <span>Đang xem:</span>
              <span className="font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                {selectedProject.name}
              </span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
