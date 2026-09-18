import React, { useState } from 'react';
import {
  ExternalLink,
  AlertCircle,
  Clock,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Eye,
  Calendar,
  Layers,
} from 'lucide-react';
import {
  RedmineIssue,
  RedmineStatus,
  RedminePriority,
} from '../types/redmine';

interface TableViewProps {
  issues: RedmineIssue[];
  statuses: RedmineStatus[];
  priorities: RedminePriority[];
  onSelectIssue: (issue: RedmineIssue) => void;
  onQuickStatusChange: (issueId: number, newStatusId: number) => Promise<void>;
  baseUrl: string;
}

export const TableView: React.FC<TableViewProps> = ({
  issues,
  statuses,
  onSelectIssue,
  onQuickStatusChange,
  baseUrl,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 20;

  const totalPages = Math.ceil(issues.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const visibleIssues = issues.slice(startIndex, startIndex + pageSize);

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
    return 'bg-slate-100 text-slate-700 border-slate-200';
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table responsive container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4 w-20">#ID</th>
              <th className="py-3 px-3 w-28">Loại việc</th>
              <th className="py-3 px-4 min-w-[280px]">Tiêu đề công việc</th>
              <th className="py-3 px-3 w-36">Trạng thái</th>
              <th className="py-3 px-3 w-28">Độ ưu tiên</th>
              <th className="py-3 px-3 w-40">Người phụ trách</th>
              <th className="py-3 px-3 w-36">Milestone</th>
              <th className="py-3 px-3 w-28">Tiến độ</th>
              <th className="py-3 px-3 w-28">Hạn chót</th>
              <th className="py-3 px-4 w-24 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {visibleIssues.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-slate-400">
                  Không tìm thấy công việc nào phù hợp với bộ lọc hiện tại.
                </td>
              </tr>
            ) : (
              visibleIssues.map((issue) => {
                const overdue = isOverdue(issue.due_date, issue.status.name);

                return (
                  <tr
                    key={issue.id}
                    className={`hover:bg-slate-50/90 transition-colors group cursor-pointer ${
                      overdue ? 'bg-rose-50/30' : ''
                    }`}
                    onClick={() => onSelectIssue(issue)}
                  >
                    {/* ID */}
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">
                      <div className="flex items-center gap-1">
                        <span>#{issue.id}</span>
                        <a
                          href={`${baseUrl}/issues/${issue.id}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          title="Mở trên AnyBIM Redmine"
                          className="text-slate-400 hover:text-indigo-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    </td>

                    {/* Tracker */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getTrackerStyle(
                          issue.tracker?.name
                        )}`}
                      >
                        {issue.tracker?.name}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="py-3 px-4 font-semibold text-slate-800">
                      <div className="line-clamp-2 max-w-md hover:text-indigo-600 transition-colors">
                        {issue.subject}
                      </div>
                      {issue.project && (
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5">
                          {issue.project.name}
                        </div>
                      )}
                    </td>

                    {/* Status Dropdown */}
                    <td className="py-3 px-3" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={issue.status.id}
                        onChange={(e) => onQuickStatusChange(issue.id, Number(e.target.value))}
                        className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-2 py-1 font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer"
                      >
                        {statuses.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                          issue.priority?.name.toLowerCase().includes('must')
                            ? 'bg-rose-50 text-rose-700 border border-rose-200'
                            : issue.priority?.name.toLowerCase().includes('should')
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {issue.priority?.name}
                      </span>
                    </td>

                    {/* Assignee */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                        <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                          {issue.assigned_to ? issue.assigned_to.name?.[0] || 'U' : '?'}
                        </div>
                        <span className="truncate text-slate-700 font-medium">
                          {issue.assigned_to?.name || '—'}
                        </span>
                      </div>
                    </td>

                    {/* Milestone */}
                    <td className="py-3 px-3 text-slate-500 truncate max-w-[140px]">
                      {issue.fixed_version?.name || '—'}
                    </td>

                    {/* Progress % */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-14 h-2 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
                          <div
                            className={`h-full rounded-full ${
                              issue.done_ratio === 100
                                ? 'bg-emerald-500'
                                : issue.done_ratio > 50
                                ? 'bg-indigo-500'
                                : 'bg-amber-500'
                            }`}
                            style={{ width: `${issue.done_ratio}%` }}
                          />
                        </div>
                        <span className="font-semibold text-slate-700 text-[11px]">
                          {issue.done_ratio}%
                        </span>
                      </div>
                    </td>

                    {/* Due Date */}
                    <td className="py-3 px-3">
                      {issue.due_date ? (
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
                            overdue
                              ? 'bg-rose-100 text-rose-800 font-bold'
                              : 'text-slate-600'
                          }`}
                        >
                          {overdue && <AlertCircle className="w-3 h-3 text-rose-600" />}
                          {issue.due_date}
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>

                    {/* Action */}
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => onSelectIssue(issue)}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 text-slate-600 rounded text-[11px] font-semibold transition-colors cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>Xem</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/70 border-t border-slate-200">
          <div className="text-xs text-slate-500 font-medium">
            Hiển thị {startIndex + 1} - {Math.min(startIndex + pageSize, issues.length)} trong{' '}
            <span className="font-bold text-slate-800">{issues.length}</span> công việc
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
