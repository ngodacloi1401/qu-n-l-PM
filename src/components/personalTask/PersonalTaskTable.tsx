import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  Calendar,
  Bug,
  Tag,
  Hash,
} from 'lucide-react';
import type { PersonalTask } from '../../types/personalTask';
import type { RedmineStatus, RedminePriority } from '../../types/redmine';

interface PersonalTaskTableProps {
  tasks: PersonalTask[];
  statuses: RedmineStatus[];
  priorities: RedminePriority[];
  onUpdateTask: (task: PersonalTask) => void;
  onEditTask: (task: PersonalTask) => void;
  onDeleteTask: (id: string) => void;
}

export const PersonalTaskTable: React.FC<PersonalTaskTableProps> = ({
  tasks,
  statuses,
  priorities,
  onUpdateTask,
  onEditTask,
  onDeleteTask,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const isTaskClosed = (statusName: string) => {
    const s = statuses.find((st) => st.name === statusName);
    if (s) return s.is_closed;
    const lower = (statusName || '').toLowerCase();
    return lower.includes('closed') || lower.includes('hoàn thành') || lower.includes('done');
  };

  const handleToggleDone = (task: PersonalTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const closed = isTaskClosed(task.statusName);
    const nextStatus = closed
      ? statuses.find((s) => !s.is_closed)?.name || 'In Progress'
      : statuses.find((s) => s.is_closed)?.name || 'Closed';

    onUpdateTask({
      ...task,
      statusName: nextStatus,
      doneRatio: closed ? 50 : 100,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleStatusChange = (task: PersonalTask, newStatusName: string, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    const matched = statuses.find((s) => s.name === newStatusName);
    onUpdateTask({
      ...task,
      statusId: matched?.id,
      statusName: newStatusName,
      doneRatio: matched?.is_closed ? 100 : task.doneRatio,
      updatedAt: new Date().toISOString(),
    });
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const getDeadlineBadge = (dueDate: string, isClosed: boolean) => {
    if (!dueDate) return null;
    if (isClosed) return <span className="text-slate-400 font-mono text-xs">{dueDate}</span>;

    if (dueDate < todayStr) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-700 bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-full">
          <AlertCircle className="w-3 h-3" />
          Quá hạn ({dueDate})
        </span>
      );
    } else if (dueDate === todayStr) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
          <Clock className="w-3 h-3" />
          Hôm nay
        </span>
      );
    }
    return <span className="text-slate-600 font-mono text-xs">{dueDate}</span>;
  };

  const renderPriorityBadge = (priorityName: string) => {
    const p = (priorityName || '').toLowerCase();
    if (p.includes('urgent') || p.includes('immediate') || p.includes('must have') || p.includes('gấp')) {
      return (
        <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
          🔴 {priorityName}
        </span>
      );
    }
    if (p.includes('high') || p.includes('should have') || p.includes('cao')) {
      return (
        <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
          🟠 {priorityName}
        </span>
      );
    }
    if (p.includes('low') || p.includes("won't have") || p.includes('thấp')) {
      return (
        <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
          ⚪ {priorityName}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
        🔵 {priorityName || 'Normal'}
      </span>
    );
  };

  const renderTrackerBadge = (trackerName?: string) => {
    const t = (trackerName || 'Task').toLowerCase();
    if (t.includes('bug') || t.includes('defect')) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded">
          <Bug className="w-3 h-3" />
          {trackerName || 'Bug'}
        </span>
      );
    }
    if (t.includes('story') || t.includes('feature')) {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-purple-700 bg-purple-50 border border-purple-200 px-1.5 py-0.5 rounded">
          ★ {trackerName}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
        {trackerName || 'Task'}
      </span>
    );
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
          <Calendar className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">Không có công việc nào</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Chưa có việc nào trong danh sách hoặc bộ lọc không khớp.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1100px]">
          <thead>
            <tr className="bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider">
              <th className="py-3 px-3 w-10 text-center">#</th>
              <th className="py-3 px-3 w-32">Tuần</th>
              <th className="py-3 px-3 w-24">Tracker</th>
              <th className="py-3 px-3 w-28">Category</th>
              <th className="py-3 px-3 min-w-[260px]">Subject (Tên việc)</th>
              <th className="py-3 px-3 w-28 text-center">Priority</th>
              <th className="py-3 px-3 w-16 text-center">Giờ</th>
              <th className="py-3 px-3 w-36 text-center">Status</th>
              <th className="py-3 px-3 min-w-[200px]">Kết quả / Tiến độ</th>
              <th className="py-3 px-3 w-28 text-center">Deadline</th>
              <th className="py-3 px-3 w-20 text-right pr-4">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {tasks.map((task) => {
              const isExpanded = expandedId === task.id;
              const isClosed = isTaskClosed(task.statusName);

              return (
                <React.Fragment key={task.id}>
                  <tr
                    onClick={() => toggleExpand(task.id)}
                    className={`transition-colors cursor-pointer group ${
                      isClosed
                        ? 'bg-slate-50/70 hover:bg-slate-100/70 text-slate-400'
                        : task.priorityName?.toLowerCase().includes('urgent') || task.priorityName?.toLowerCase().includes('must have')
                        ? 'bg-rose-50/20 hover:bg-rose-50/40 text-slate-800'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    {/* Checkbox */}
                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleToggleDone(task, e)}
                        title={isClosed ? 'Đánh dấu mở lại việc' : 'Đánh dấu hoàn thành / Closed'}
                        className="p-1 rounded text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                      >
                        {isClosed ? (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600 fill-emerald-50" />
                        ) : (
                          <Circle className="w-5 h-5 hover:text-slate-600" />
                        )}
                      </button>
                    </td>

                    {/* Tuần */}
                    <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => toggleExpand(task.id)}
                          className="p-0.5 text-slate-400 hover:text-slate-700"
                        >
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                        </button>
                        <span className="truncate max-w-[110px]">{task.week || 'Kế hoạch tuần'}</span>
                      </div>
                    </td>

                    {/* Tracker */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      {renderTrackerBadge(task.trackerName)}
                    </td>

                    {/* Category */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[110px]">
                        {task.category || 'Chung'}
                      </span>
                    </td>

                    {/* Subject */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {task.parentTaskId && (
                            <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded">
                              #{task.parentTaskId}
                            </span>
                          )}
                          <span
                            className={`font-semibold text-xs leading-snug ${
                              isClosed ? 'line-through text-slate-400' : 'text-slate-900 group-hover:text-indigo-600'
                            }`}
                          >
                            {task.title}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-0.5">
                          {task.assigneeName && <span>Gán: {task.assigneeName}</span>}
                          {task.doneRatio !== undefined && <span>{task.doneRatio}% done</span>}
                          {task.source === 'redmine' && (
                            <span className="text-red-600 font-mono font-bold">Redmine #{task.redmineIssueId}</span>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {renderPriorityBadge(task.priorityName)}
                    </td>

                    {/* Estimated Hours */}
                    <td className="py-3 px-3 text-center font-mono text-slate-600">
                      {task.estimatedHours ? `${task.estimatedHours}h` : '-'}
                    </td>

                    {/* Status Redmine (Dropdown Inline) */}
                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={task.statusName}
                        onChange={(e) => handleStatusChange(task, e.target.value, e)}
                        className={`text-xs font-bold py-1 px-2 rounded-lg border focus:outline-none cursor-pointer transition-colors max-w-[140px] truncate ${
                          isClosed
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : task.statusName.toLowerCase().includes('in progress')
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : task.statusName.toLowerCase().includes('qa') || task.statusName.toLowerCase().includes('feedback')
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : 'bg-slate-50 text-slate-700 border-slate-300'
                        }`}
                      >
                        {statuses.map((s) => (
                          <option key={s.id} value={s.name}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Kết quả / Tiến độ */}
                    <td className="py-3 px-3">
                      {task.resultNote ? (
                        <p
                          className={`text-xs line-clamp-2 ${
                            !isClosed && task.resultNote ? 'text-red-700 font-medium' : 'text-slate-600'
                          }`}
                        >
                          {task.resultNote}
                        </p>
                      ) : (
                        <span className="text-slate-300 italic text-[11px]">-</span>
                      )}
                    </td>

                    {/* Deadline */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {getDeadlineBadge(task.dueDate, isClosed)}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-3 text-right pr-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditTask(task)}
                          title="Chỉnh sửa thuộc tính"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Bạn có muốn xóa công việc này?')) {
                              onDeleteTask(task.id);
                            }
                          }}
                          title="Xóa việc"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail row with tracker custom fields */}
                  {isExpanded && (
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <td colSpan={11} className="p-4 pl-12 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h6 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                              Mô tả chi tiết (Description):
                            </h6>
                            <p className="text-xs text-slate-800 whitespace-pre-line bg-white p-3 rounded-lg border border-slate-200">
                              {task.description || '(Không có mô tả chi tiết)'}
                            </p>
                          </div>

                          <div>
                            <h6 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                              Kết quả công việc / Tiến độ:
                            </h6>
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                              <p
                                className={`text-xs whitespace-pre-line ${
                                  task.resultNote && !isClosed ? 'text-red-700 font-medium' : 'text-slate-600'
                                }`}
                              >
                                {task.resultNote || '(Chưa có ghi chú kết quả)'}
                              </p>
                              {task.delayReason && (
                                <div className="mt-2 pt-2 border-t border-slate-100 text-xs text-rose-700">
                                  <span className="font-semibold">Lý do trễ hạn:</span> {task.delayReason}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Tracker Custom Fields display */}
                        {task.customFields && Object.keys(task.customFields).length > 0 && (
                          <div className="p-3 bg-white rounded-lg border border-slate-200">
                            <h6 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-2">
                              Trường tùy biến ({task.trackerName}):
                            </h6>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                              {Object.entries(task.customFields).map(([k, v]) => (
                                <div key={k} className="p-2 bg-slate-50 rounded border border-slate-100">
                                  <div className="text-[10px] text-slate-500 font-medium">{k}</div>
                                  <div className="font-semibold text-slate-800">
                                    {v === '1' ? 'Yes' : v === '0' ? 'No' : String(v || '-')}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <div className="flex gap-4 flex-wrap">
                            <span>Bắt đầu: {task.assignedDate || 'Không có'}</span>
                            <span>Hạn: {task.dueDate || 'Không có'}</span>
                            {task.targetVersionName && <span>Version: {task.targetVersionName}</span>}
                            <span>Tiến độ: {task.doneRatio || 0}%</span>
                          </div>
                          <button
                            onClick={() => onEditTask(task)}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:underline cursor-pointer"
                          >
                            Mở form chỉnh sửa đầy đủ
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
