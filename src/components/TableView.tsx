import React, { useState, useMemo } from 'react';
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
  SlidersHorizontal,
  Check,
  ArrowUp,
  ArrowDown,
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

type SortField =
  | 'id'
  | 'project'
  | 'tracker'
  | 'status'
  | 'priority'
  | 'subject'
  | 'assigned_to'
  | 'author'
  | 'start_date'
  | 'due_date'
  | 'done_ratio'
  | 'estimated_hours'
  | 'spent_hours'
  | 'updated_on'
  | 'created_on'
  | 'version';

interface ColumnDef {
  key: SortField;
  label: string;
  defaultVisible: boolean;
  minWidth?: string;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'id', label: '#ID', defaultVisible: true, minWidth: 'w-20' },
  { key: 'project', label: 'Dự án', defaultVisible: true, minWidth: 'w-32' },
  { key: 'tracker', label: 'Loại việc', defaultVisible: true, minWidth: 'w-28' },
  { key: 'status', label: 'Trạng thái', defaultVisible: true, minWidth: 'w-36' },
  { key: 'priority', label: 'Độ ưu tiên', defaultVisible: true, minWidth: 'w-28' },
  { key: 'subject', label: 'Tiêu đề công việc', defaultVisible: true, minWidth: 'min-w-[280px]' },
  { key: 'assigned_to', label: 'Người thực hiện', defaultVisible: true, minWidth: 'w-36' },
  { key: 'author', label: 'Tác giả', defaultVisible: false, minWidth: 'w-32' },
  { key: 'start_date', label: 'Bắt đầu', defaultVisible: false, minWidth: 'w-28' },
  { key: 'due_date', label: 'Hạn hoàn thành', defaultVisible: true, minWidth: 'w-28' },
  { key: 'done_ratio', label: '% Xong', defaultVisible: true, minWidth: 'w-24' },
  { key: 'estimated_hours', label: 'Ước tính (h)', defaultVisible: true, minWidth: 'w-24' },
  { key: 'spent_hours', label: 'Đã chi (h)', defaultVisible: false, minWidth: 'w-24' },
  { key: 'updated_on', label: 'Cập nhật', defaultVisible: true, minWidth: 'w-28' },
  { key: 'created_on', label: 'Ngày tạo', defaultVisible: false, minWidth: 'w-28' },
  { key: 'version', label: 'Phiên bản', defaultVisible: true, minWidth: 'w-32' },
];

export const TableView: React.FC<TableViewProps> = ({
  issues,
  statuses,
  priorities,
  onSelectIssue,
  onQuickStatusChange,
  baseUrl,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [sortField, setSortField] = useState<SortField>('updated_on');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showColumnMenu, setShowColumnMenu] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<SortField, boolean>>(() => {
    const init: Record<string, boolean> = {};
    ALL_COLUMNS.forEach((col) => {
      init[col.key] = col.defaultVisible;
    });
    return init as Record<SortField, boolean>;
  });

  const toggleColumn = (key: SortField) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDir('asc');
    }
  };

  // Sorted issues
  const sortedIssues = useMemo(() => {
    return [...issues].sort((a, b) => {
      let valA: any = '';
      let valB: any = '';

      switch (sortField) {
        case 'id':
          valA = a.id;
          valB = b.id;
          break;
        case 'project':
          valA = a.project?.name || '';
          valB = b.project?.name || '';
          break;
        case 'tracker':
          valA = a.tracker?.name || '';
          valB = b.tracker?.name || '';
          break;
        case 'status':
          valA = a.status?.name || '';
          valB = b.status?.name || '';
          break;
        case 'priority':
          valA = a.priority?.id || 0;
          valB = b.priority?.id || 0;
          break;
        case 'subject':
          valA = a.subject || '';
          valB = b.subject || '';
          break;
        case 'assigned_to':
          valA = a.assigned_to?.name || '';
          valB = b.assigned_to?.name || '';
          break;
        case 'author':
          valA = a.author?.name || '';
          valB = b.author?.name || '';
          break;
        case 'start_date':
          valA = a.start_date || '';
          valB = b.start_date || '';
          break;
        case 'due_date':
          valA = a.due_date || '';
          valB = b.due_date || '';
          break;
        case 'done_ratio':
          valA = a.done_ratio || 0;
          valB = b.done_ratio || 0;
          break;
        case 'estimated_hours':
          valA = a.estimated_hours || 0;
          valB = b.estimated_hours || 0;
          break;
        case 'spent_hours':
          valA = a.spent_hours || 0;
          valB = b.spent_hours || 0;
          break;
        case 'updated_on':
          valA = a.updated_on || '';
          valB = b.updated_on || '';
          break;
        case 'created_on':
          valA = a.created_on || '';
          valB = b.created_on || '';
          break;
        case 'version':
          valA = a.fixed_version?.name || '';
          valB = b.fixed_version?.name || '';
          break;
        default:
          valA = a.id;
          valB = b.id;
      }

      if (valA < valB) return sortDir === 'asc' ? -1 : 1;
      if (valA > valB) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [issues, sortField, sortDir]);

  const totalPages = Math.ceil(sortedIssues.length / pageSize) || 1;
  const startIndex = (currentPage - 1) * pageSize;
  const visibleIssues = sortedIssues.slice(startIndex, startIndex + pageSize);

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

  const getPriorityStyle = (priorityName: string = '') => {
    const p = priorityName.toLowerCase();
    if (p.includes('must') || p.includes('high') || p.includes('urgent') || p.includes('immediate')) {
      return 'bg-rose-50 text-rose-700 border border-rose-200 font-bold';
    }
    if (p.includes('should') || p.includes('normal')) {
      return 'bg-amber-50 text-amber-700 border border-amber-200 font-semibold';
    }
    return 'bg-slate-100 text-slate-600 border border-slate-200';
  };

  const formatDateDisplay = (dStr?: string) => {
    if (!dStr) return '—';
    try {
      const d = new Date(dStr);
      return d.toLocaleDateString('vi-VN');
    } catch {
      return dStr.slice(0, 10);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
      {/* Header controls: Columns Selector + Page Size */}
      <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
          <span>Danh sách công việc chuẩn Redmine</span>
          <span className="px-2 py-0.5 bg-white border border-slate-200 rounded-full text-slate-500 font-normal">
            {sortedIssues.length} công việc
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Columns Visibility Dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowColumnMenu(!showColumnMenu)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-md text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-500" />
              <span>Tùy biến cột ({Object.values(visibleColumns).filter(Boolean).length})</span>
            </button>

            {showColumnMenu && (
              <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-slate-200 rounded-xl shadow-xl z-30 p-2 text-xs space-y-1 max-h-80 overflow-y-auto">
                <div className="font-bold text-slate-800 px-2 py-1 border-b border-slate-100 mb-1 flex items-center justify-between">
                  <span>Chọn cột hiển thị:</span>
                  <button
                    onClick={() => setShowColumnMenu(false)}
                    className="text-slate-400 hover:text-slate-700 font-normal"
                  >
                    Đóng
                  </button>
                </div>
                {ALL_COLUMNS.map((col) => (
                  <label
                    key={col.key}
                    className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer text-slate-700 font-medium select-none"
                  >
                    <input
                      type="checkbox"
                      checked={!!visibleColumns[col.key]}
                      onChange={() => toggleColumn(col.key)}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{col.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Page size */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Hiển thị:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="bg-white border border-slate-200 rounded px-2 py-1 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
            >
              <option value={20}>20</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={500}>500</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table responsive container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-semibold text-slate-500 uppercase tracking-wider select-none">
              {visibleColumns.id && (
                <th
                  onClick={() => handleSort('id')}
                  className="py-3 px-3 w-20 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>#ID</span>
                    {sortField === 'id' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.project && (
                <th
                  onClick={() => handleSort('project')}
                  className="py-3 px-3 w-32 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Dự án</span>
                    {sortField === 'project' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.tracker && (
                <th
                  onClick={() => handleSort('tracker')}
                  className="py-3 px-3 w-28 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Loại việc</span>
                    {sortField === 'tracker' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.status && (
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-3 w-36 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Trạng thái</span>
                    {sortField === 'status' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.priority && (
                <th
                  onClick={() => handleSort('priority')}
                  className="py-3 px-3 w-28 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Độ ưu tiên</span>
                    {sortField === 'priority' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.subject && (
                <th
                  onClick={() => handleSort('subject')}
                  className="py-3 px-4 min-w-[280px] cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Tiêu đề công việc</span>
                    {sortField === 'subject' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.assigned_to && (
                <th
                  onClick={() => handleSort('assigned_to')}
                  className="py-3 px-3 w-36 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Người thực hiện</span>
                    {sortField === 'assigned_to' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.author && (
                <th
                  onClick={() => handleSort('author')}
                  className="py-3 px-3 w-32 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Tác giả</span>
                    {sortField === 'author' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.start_date && (
                <th
                  onClick={() => handleSort('start_date')}
                  className="py-3 px-3 w-28 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Bắt đầu</span>
                    {sortField === 'start_date' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.due_date && (
                <th
                  onClick={() => handleSort('due_date')}
                  className="py-3 px-3 w-28 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Hạn chót</span>
                    {sortField === 'due_date' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.done_ratio && (
                <th
                  onClick={() => handleSort('done_ratio')}
                  className="py-3 px-3 w-24 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>% Xong</span>
                    {sortField === 'done_ratio' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.estimated_hours && (
                <th
                  onClick={() => handleSort('estimated_hours')}
                  className="py-3 px-3 w-24 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Ước tính (h)</span>
                    {sortField === 'estimated_hours' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.spent_hours && (
                <th
                  onClick={() => handleSort('spent_hours')}
                  className="py-3 px-3 w-24 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Đã chi (h)</span>
                    {sortField === 'spent_hours' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.updated_on && (
                <th
                  onClick={() => handleSort('updated_on')}
                  className="py-3 px-3 w-28 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Cập nhật</span>
                    {sortField === 'updated_on' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.created_on && (
                <th
                  onClick={() => handleSort('created_on')}
                  className="py-3 px-3 w-28 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Ngày tạo</span>
                    {sortField === 'created_on' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              {visibleColumns.version && (
                <th
                  onClick={() => handleSort('version')}
                  className="py-3 px-3 w-32 cursor-pointer hover:bg-slate-100 transition-colors"
                >
                  <div className="flex items-center gap-1">
                    <span>Phiên bản</span>
                    {sortField === 'version' ? (
                      sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-indigo-600" /> : <ArrowDown className="w-3 h-3 text-indigo-600" />
                    ) : (
                      <ArrowUpDown className="w-2.5 h-2.5 text-slate-300" />
                    )}
                  </div>
                </th>
              )}

              <th className="py-3 px-4 w-20 text-right">Chi tiết</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
            {visibleIssues.length === 0 ? (
              <tr>
                <td colSpan={20} className="py-12 text-center text-slate-400">
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
                    {visibleColumns.id && (
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
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
                    )}

                    {/* Project */}
                    {visibleColumns.project && (
                      <td className="py-2.5 px-3 text-slate-600 text-xs">
                        <span className="truncate max-w-[130px] block font-medium">
                          {issue.project?.name || '—'}
                        </span>
                      </td>
                    )}

                    {/* Tracker */}
                    {visibleColumns.tracker && (
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${getTrackerStyle(
                            issue.tracker?.name
                          )}`}
                        >
                          {issue.tracker?.name}
                        </span>
                      </td>
                    )}

                    {/* Status Dropdown */}
                    {visibleColumns.status && (
                      <td className="py-2.5 px-3" onClick={(e) => e.stopPropagation()}>
                        <select
                          value={issue.status.id}
                          onChange={(e) => onQuickStatusChange(issue.id, Number(e.target.value))}
                          className="text-xs bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded px-2 py-1 font-semibold text-slate-800 focus:ring-2 focus:ring-indigo-500 cursor-pointer max-w-[140px] truncate"
                        >
                          {statuses.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    )}

                    {/* Priority */}
                    {visibleColumns.priority && (
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] ${getPriorityStyle(
                            issue.priority?.name
                          )}`}
                        >
                          {issue.priority?.name}
                        </span>
                      </td>
                    )}

                    {/* Subject */}
                    {visibleColumns.subject && (
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        <div className="line-clamp-2 hover:text-indigo-600 transition-colors">
                          {issue.subject}
                        </div>
                      </td>
                    )}

                    {/* Assignee */}
                    {visibleColumns.assigned_to && (
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5 truncate max-w-[140px]">
                          <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-bold flex-shrink-0">
                            {issue.assigned_to ? issue.assigned_to.name?.[0] || 'U' : '?'}
                          </div>
                          <span className="truncate text-slate-700 font-medium">
                            {issue.assigned_to?.name || '—'}
                          </span>
                        </div>
                      </td>
                    )}

                    {/* Author */}
                    {visibleColumns.author && (
                      <td className="py-2.5 px-3 text-slate-600 text-xs truncate max-w-[120px]">
                        {issue.author?.name || '—'}
                      </td>
                    )}

                    {/* Start Date */}
                    {visibleColumns.start_date && (
                      <td className="py-2.5 px-3 text-slate-600 text-xs font-mono">
                        {issue.start_date || '—'}
                      </td>
                    )}

                    {/* Due Date */}
                    {visibleColumns.due_date && (
                      <td className="py-2.5 px-3">
                        {issue.due_date ? (
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono font-medium ${
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
                    )}

                    {/* Progress % */}
                    {visibleColumns.done_ratio && (
                      <td className="py-2.5 px-3">
                        <div className="flex items-center gap-1.5">
                          <div className="w-10 h-1.5 bg-slate-100 rounded-full overflow-hidden flex-shrink-0">
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
                    )}

                    {/* Estimated Hours */}
                    {visibleColumns.estimated_hours && (
                      <td className="py-2.5 px-3 text-slate-600 text-xs font-mono text-center">
                        {issue.estimated_hours ? `${issue.estimated_hours}h` : '—'}
                      </td>
                    )}

                    {/* Spent Hours */}
                    {visibleColumns.spent_hours && (
                      <td className="py-2.5 px-3 text-slate-600 text-xs font-mono text-center">
                        {issue.spent_hours ? `${issue.spent_hours}h` : '—'}
                      </td>
                    )}

                    {/* Updated on */}
                    {visibleColumns.updated_on && (
                      <td className="py-2.5 px-3 text-slate-500 text-xs" title={issue.updated_on}>
                        {formatDateDisplay(issue.updated_on)}
                      </td>
                    )}

                    {/* Created on */}
                    {visibleColumns.created_on && (
                      <td className="py-2.5 px-3 text-slate-500 text-xs" title={issue.created_on}>
                        {formatDateDisplay(issue.created_on)}
                      </td>
                    )}

                    {/* Milestone */}
                    {visibleColumns.version && (
                      <td className="py-2.5 px-3 text-slate-500 truncate max-w-[130px]">
                        {issue.fixed_version?.name || '—'}
                      </td>
                    )}

                    {/* Action */}
                    <td className="py-2.5 px-4 text-right">
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
        <div className="flex items-center justify-between px-4 py-3 bg-slate-50/80 border-t border-slate-200">
          <div className="text-xs text-slate-500 font-medium">
            Hiển thị {startIndex + 1} - {Math.min(startIndex + pageSize, sortedIssues.length)} trong{' '}
            <span className="font-bold text-slate-800">{sortedIssues.length}</span> công việc
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

