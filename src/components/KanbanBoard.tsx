import React from 'react';
import {
  AlertCircle,
  Clock,
  ExternalLink,
  ChevronRight,
  MoreHorizontal,
  Flame,
  User,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  RedmineIssue,
  RedmineStatus,
  RedmineTracker,
  RedminePriority,
} from '../types/redmine';

interface KanbanColumnConfig {
  id: string;
  title: string;
  subtitle: string;
  statusIds: number[];
  accentColor: string;
  bgHeader: string;
}

const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: 'new',
    title: 'Mới tạo',
    subtitle: 'Chưa bắt đầu',
    statusIds: [1],
    accentColor: 'border-blue-500 text-blue-700 bg-blue-50',
    bgHeader: 'bg-blue-50/60',
  },
  {
    id: 'in_progress',
    title: 'Đang làm',
    subtitle: 'In Progress / Pending',
    statusIds: [2, 8],
    accentColor: 'border-amber-500 text-amber-700 bg-amber-50',
    bgHeader: 'bg-amber-50/60',
  },
  {
    id: 'qa_testing',
    title: 'Kiểm thử QA',
    subtitle: 'Ready / Testing / Resolved',
    statusIds: [16, 12, 3],
    accentColor: 'border-purple-500 text-purple-700 bg-purple-50',
    bgHeader: 'bg-purple-50/60',
  },
  {
    id: 'deployment',
    title: 'STG & PROD',
    subtitle: 'QA Verified / STG / PROD',
    statusIds: [7, 11, 9],
    accentColor: 'border-cyan-500 text-cyan-700 bg-cyan-50',
    bgHeader: 'bg-cyan-50/60',
  },
  {
    id: 'closed',
    title: 'Đã hoàn tất',
    subtitle: 'Closed / Verified',
    statusIds: [5, 6, 10],
    accentColor: 'border-emerald-500 text-emerald-700 bg-emerald-50',
    bgHeader: 'bg-emerald-50/60',
  },
  {
    id: 'blocked',
    title: 'Bị chặn / Lỗi',
    subtitle: 'Blocked / Failed',
    statusIds: [18, 4, 17],
    accentColor: 'border-rose-500 text-rose-700 bg-rose-50',
    bgHeader: 'bg-rose-50/60',
  },
];

interface KanbanBoardProps {
  issues: RedmineIssue[];
  statuses: RedmineStatus[];
  trackers: RedmineTracker[];
  priorities: RedminePriority[];
  onSelectIssue: (issue: RedmineIssue) => void;
  onQuickStatusChange: (issueId: number, newStatusId: number) => Promise<void>;
  baseUrl: string;
}

export const KanbanBoard: React.FC<KanbanBoardProps> = ({
  issues,
  statuses,
  onSelectIssue,
  onQuickStatusChange,
  baseUrl,
}) => {
  const isOverdue = (dateStr?: string, statusName?: string) => {
    if (!dateStr) return false;
    if (statusName?.toLowerCase().includes('close') || statusName?.toLowerCase().includes('verified')) {
      return false;
    }
    const today = new Date().toISOString().split('T')[0];
    return dateStr < today;
  };

  const getTrackerStyle = (trackerName: string = '') => {
    const t = trackerName.toLowerCase();
    if (t.includes('bug')) return 'bg-rose-100 text-rose-800 border-rose-200';
    if (t.includes('defect')) return 'bg-orange-100 text-orange-800 border-orange-200';
    if (t.includes('story') || t.includes('user story')) return 'bg-indigo-100 text-indigo-800 border-indigo-200';
    if (t.includes('implement')) return 'bg-sky-100 text-sky-800 border-sky-200';
    if (t.includes('epic')) return 'bg-purple-100 text-purple-800 border-purple-200';
    if (t.includes('improve') || t.includes('enhancement')) return 'bg-teal-100 text-teal-800 border-teal-200';
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  const getPriorityBadge = (priorityName: string = '') => {
    const p = priorityName.toLowerCase();
    if (p.includes('must') || p.includes('high') || p.includes('urgent') || p.includes('immediate')) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
          <Flame className="w-2.5 h-2.5 text-rose-600" />
          {priorityName}
        </span>
      );
    }
    if (p.includes('should') || p.includes('normal')) {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
          {priorityName}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
        {priorityName}
      </span>
    );
  };

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex gap-4 min-w-[1300px] items-start">
        {KANBAN_COLUMNS.map((col) => {
          const colIssues = issues.filter((iss) => col.statusIds.includes(iss.status.id));

          return (
            <div
              key={col.id}
              className="w-80 flex-shrink-0 bg-slate-100/70 rounded-xl border border-slate-200 flex flex-col max-h-[calc(100vh-230px)]"
            >
              {/* Column Header */}
              <div className={`p-3 border-b border-slate-200 rounded-t-xl ${col.bgHeader}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${col.accentColor.split(' ')[0].replace('border', 'bg')}`} />
                    <h3 className="font-bold text-sm text-slate-800">{col.title}</h3>
                    <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-white text-slate-700 border border-slate-200 shadow-2xs">
                      {colIssues.length}
                    </span>
                  </div>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">{col.subtitle}</div>
              </div>

              {/* Cards Container */}
              <div className="p-2.5 space-y-2.5 overflow-y-auto flex-1">
                {colIssues.length === 0 ? (
                  <div className="py-8 text-center text-xs text-slate-400 italic">
                    Không có công việc nào
                  </div>
                ) : (
                  colIssues.map((issue) => {
                    const overdue = isOverdue(issue.due_date, issue.status.name);

                    return (
                      <div
                        key={issue.id}
                        onClick={() => onSelectIssue(issue)}
                        className={`bg-white rounded-lg p-3 border hover:shadow-md transition-all cursor-pointer group relative ${
                          overdue
                            ? 'border-rose-300 ring-1 ring-rose-200 shadow-2xs'
                            : 'border-slate-200 hover:border-indigo-300 shadow-2xs'
                        }`}
                      >
                        {/* Top Metadata */}
                        <div className="flex items-center justify-between gap-1 mb-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${getTrackerStyle(
                                issue.tracker?.name
                              )}`}
                            >
                              {issue.tracker?.name}
                            </span>
                            <a
                              href={`${baseUrl}/issues/${issue.id}`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-[11px] font-mono font-semibold text-slate-500 hover:text-indigo-600 inline-flex items-center gap-0.5"
                            >
                              #{issue.id}
                              <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </a>
                          </div>

                          <div>{getPriorityBadge(issue.priority?.name)}</div>
                        </div>

                        {/* Title */}
                        <h4 className="text-xs font-semibold text-slate-800 line-clamp-2 leading-relaxed mb-2">
                          {issue.subject}
                        </h4>

                        {/* Progress bar */}
                        <div className="mb-2.5">
                          <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                            <span>Tiến độ</span>
                            <span className="font-semibold text-slate-700">{issue.done_ratio}%</span>
                          </div>
                          <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                issue.done_ratio === 100
                                  ? 'bg-emerald-500'
                                  : issue.done_ratio > 50
                                  ? 'bg-indigo-500'
                                  : 'bg-amber-500'
                              }`}
                              style={{ width: `${issue.done_ratio}%` }}
                            />
                          </div>
                        </div>

                        {/* Card Footer: Assignee & Date & Quick Action */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-[11px]">
                          {/* Assignee */}
                          <div className="flex items-center gap-1.5 text-slate-600 truncate max-w-[120px]">
                            <div className="w-5 h-5 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                              {issue.assigned_to ? issue.assigned_to.name?.[0] || 'U' : '?'}
                            </div>
                            <span className="truncate" title={issue.assigned_to?.name || 'Chưa gán'}>
                              {issue.assigned_to?.name || 'Chưa gán'}
                            </span>
                          </div>

                          {/* Due date or Overdue */}
                          <div className="flex items-center gap-1">
                            {issue.due_date ? (
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                  overdue
                                    ? 'bg-rose-100 text-rose-800 font-semibold'
                                    : 'text-slate-500 bg-slate-50'
                                }`}
                                title={`Hạn chót: ${issue.due_date}`}
                              >
                                {overdue ? (
                                  <AlertCircle className="w-3 h-3 text-rose-600" />
                                ) : (
                                  <Calendar className="w-3 h-3 text-slate-400" />
                                )}
                                <span>{issue.due_date.slice(5)}</span>
                              </span>
                            ) : null}

                            {/* Quick status mover */}
                            <select
                              value={issue.status.id}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => onQuickStatusChange(issue.id, Number(e.target.value))}
                              title="Chuyển trạng thái nhanh"
                              className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-700 py-0.5 px-1 rounded border-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                            >
                              {statuses.map((st) => (
                                <option key={st.id} value={st.id}>
                                  {st.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
