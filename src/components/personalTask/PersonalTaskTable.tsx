import React, { useState } from 'react';
import {
  CheckCircle2,
  Circle,
  Clock,
  AlertCircle,
  MoreVertical,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Calendar,
} from 'lucide-react';
import type { PersonalTask, TaskPriority, TaskStatus } from '../../types/personalTask';

interface PersonalTaskTableProps {
  tasks: PersonalTask[];
  onUpdateTask: (task: PersonalTask) => void;
  onEditTask: (task: PersonalTask) => void;
  onDeleteTask: (id: string) => void;
}

export const PersonalTaskTable: React.FC<PersonalTaskTableProps> = ({
  tasks,
  onUpdateTask,
  onEditTask,
  onDeleteTask,
}) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleToggleDone = (task: PersonalTask, e: React.MouseEvent) => {
    e.stopPropagation();
    const newStatus: TaskStatus = task.status === 'done' ? 'todo' : 'done';
    onUpdateTask({
      ...task,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleStatusChange = (task: PersonalTask, newStatus: TaskStatus, e: React.ChangeEvent<HTMLSelectElement>) => {
    e.stopPropagation();
    onUpdateTask({
      ...task,
      status: newStatus,
      updatedAt: new Date().toISOString(),
    });
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const getDeadlineBadge = (dueDate: string, status: TaskStatus) => {
    if (!dueDate) return null;
    if (status === 'done') return <span className="text-slate-400 font-mono text-xs">{dueDate}</span>;

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

  const renderPriorityBadge = (priority: TaskPriority) => {
    switch (priority) {
      case 'urgent':
        return (
          <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md bg-rose-100 text-rose-800 border border-rose-200">
            🔴 Gấp
          </span>
        );
      case 'high':
        return (
          <span className="inline-flex items-center text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 border border-amber-200">
            🟠 Cao
          </span>
        );
      case 'low':
        return (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
            ⚪ Thấp
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
            🔵 Bình thường
          </span>
        );
    }
  };

  if (tasks.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 mx-auto flex items-center justify-center mb-3">
          <Calendar className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-bold text-slate-800">Không có đầu việc nào</h4>
        <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
          Chưa có việc nào trong danh sách hoặc bộ lọc không khớp. Hãy thêm việc mới hoặc nhập file Excel để bắt đầu.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead>
            <tr className="bg-slate-800 text-white text-xs font-semibold uppercase tracking-wider">
              <th className="py-3 px-3 w-10 text-center">#</th>
              <th className="py-3 px-3 w-36">Tuần</th>
              <th className="py-3 px-3 w-28">Nhóm việc</th>
              <th className="py-3 px-3 min-w-[240px]">Tên việc cần làm</th>
              <th className="py-3 px-3 w-28 text-center">Ưu tiên</th>
              <th className="py-3 px-3 w-20 text-center">Thời lượng</th>
              <th className="py-3 px-3 w-36 text-center">Trạng thái</th>
              <th className="py-3 px-3 min-w-[200px]">Kết quả / Tiến độ</th>
              <th className="py-3 px-3 w-32 text-center">Deadline</th>
              <th className="py-3 px-3 w-20 text-right pr-4">Hành động</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 text-xs">
            {tasks.map((task, idx) => {
              const isExpanded = expandedId === task.id;
              const isDone = task.status === 'done';

              return (
                <React.Fragment key={task.id}>
                  <tr
                    onClick={() => toggleExpand(task.id)}
                    className={`transition-colors cursor-pointer group ${
                      isDone
                        ? 'bg-slate-50/70 hover:bg-slate-100/70 text-slate-400'
                        : task.priority === 'urgent'
                        ? 'bg-rose-50/20 hover:bg-rose-50/40 text-slate-800'
                        : 'hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    {/* Expand & Checkbox */}
                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleToggleDone(task, e)}
                        title={isDone ? 'Đánh dấu chưa hoàn thành' : 'Đánh dấu hoàn thành'}
                        className="p-1 rounded text-slate-400 hover:text-emerald-600 transition-colors cursor-pointer"
                      >
                        {isDone ? (
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
                        <span className="truncate max-w-[120px]">{task.week || 'Kế hoạch tuần'}</span>
                      </div>
                    </td>

                    {/* Nhóm việc */}
                    <td className="py-3 px-3 whitespace-nowrap">
                      <span className="inline-block px-2 py-0.5 rounded font-semibold text-[11px] bg-slate-100 text-slate-700 border border-slate-200 truncate max-w-[100px]">
                        {task.category || 'Chung'}
                      </span>
                    </td>

                    {/* Tên việc */}
                    <td className="py-3 px-3">
                      <div className="flex flex-col">
                        <span
                          className={`font-semibold text-xs leading-snug ${
                            isDone ? 'line-through text-slate-400' : 'text-slate-900 group-hover:text-indigo-600'
                          }`}
                        >
                          {task.title}
                        </span>
                        {task.source === 'redmine' && (
                          <span className="inline-flex items-center gap-1 text-[10px] text-red-600 font-mono mt-0.5">
                            Redmine #{task.redmineIssueId}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Mức độ ưu tiên */}
                    <td className="py-3 px-3 text-center whitespace-nowrap">
                      {renderPriorityBadge(task.priority)}
                    </td>

                    {/* Thời lượng */}
                    <td className="py-3 px-3 text-center font-mono text-slate-600">
                      {task.estimatedHours ? `${task.estimatedHours}h` : '-'}
                    </td>

                    {/* Trạng thái (Dropdown Inline) */}
                    <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={task.status}
                        onChange={(e) => handleStatusChange(task, e.target.value as TaskStatus, e)}
                        className={`text-xs font-bold py-1 px-2 rounded-lg border focus:outline-none cursor-pointer transition-colors ${
                          task.status === 'done'
                            ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                            : task.status === 'in_progress'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : task.status === 'review'
                            ? 'bg-blue-50 text-blue-800 border-blue-300'
                            : task.status === 'deferred'
                            ? 'bg-slate-100 text-slate-700 border-slate-300'
                            : 'bg-slate-50 text-slate-700 border-slate-300'
                        }`}
                      >
                        <option value="todo">Chưa làm</option>
                        <option value="in_progress">Đang làm</option>
                        <option value="review">Chờ review</option>
                        <option value="done">Hoàn thành</option>
                        <option value="deferred">Tạm hoãn</option>
                      </select>
                    </td>

                    {/* Kết quả / Tiến độ */}
                    <td className="py-3 px-3">
                      {task.resultNote ? (
                        <p
                          className={`text-xs line-clamp-2 ${
                            !isDone && task.resultNote ? 'text-red-700 font-medium' : 'text-slate-600'
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
                      {getDeadlineBadge(task.dueDate, task.status)}
                    </td>

                    {/* Hành động */}
                    <td className="py-3 px-3 text-right pr-4 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => onEditTask(task)}
                          title="Chỉnh sửa việc này"
                          className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm('Bạn có muốn xóa đầu việc này?')) {
                              onDeleteTask(task.id);
                            }
                          }}
                          title="Xóa việc này"
                          className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr className="bg-slate-50/80 border-b border-slate-200">
                      <td colSpan={10} className="p-4 pl-12 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <h6 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                              Mô tả chi tiết:
                            </h6>
                            <p className="text-xs text-slate-800 whitespace-pre-line bg-white p-3 rounded-lg border border-slate-200">
                              {task.description || '(Không có mô tả chi tiết)'}
                            </p>
                          </div>

                          <div>
                            <h6 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                              Kết quả công việc / Ghi chú:
                            </h6>
                            <div className="bg-white p-3 rounded-lg border border-slate-200">
                              <p className={`text-xs whitespace-pre-line ${task.resultNote ? 'text-red-700 font-medium' : 'text-slate-500 italic'}`}>
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

                        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                          <div className="flex gap-4">
                            <span>Ngày giao: {task.assignedDate || 'Không có'}</span>
                            <span>Hạn: {task.dueDate || 'Không có'}</span>
                            <span>Thời lượng: {task.estimatedHours ? `${task.estimatedHours}h` : 'N/A'}</span>
                            <span>Nguồn: {task.source === 'redmine' ? 'Redmine' : task.source === 'excel' ? 'Excel' : 'Thủ công'}</span>
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
