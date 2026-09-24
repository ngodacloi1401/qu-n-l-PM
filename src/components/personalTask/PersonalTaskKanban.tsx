import React from 'react';
import { Clock, AlertCircle, Edit2, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';
import type { PersonalTask, TaskStatus, TaskPriority } from '../../types/personalTask';

interface PersonalTaskKanbanProps {
  tasks: PersonalTask[];
  onUpdateTask: (task: PersonalTask) => void;
  onEditTask: (task: PersonalTask) => void;
}

interface KanbanCol {
  id: TaskStatus;
  title: string;
  badgeBg: string;
  badgeText: string;
  borderTop: string;
}

const COLUMNS: KanbanCol[] = [
  { id: 'todo', title: 'Chưa làm', badgeBg: 'bg-slate-100', badgeText: 'text-slate-700', borderTop: 'border-t-slate-400' },
  { id: 'in_progress', title: 'Đang làm', badgeBg: 'bg-amber-100', badgeText: 'text-amber-800', borderTop: 'border-t-amber-500' },
  { id: 'review', title: 'Chờ review', badgeBg: 'bg-blue-100', badgeText: 'text-blue-800', borderTop: 'border-t-blue-500' },
  { id: 'done', title: 'Hoàn thành', badgeBg: 'bg-emerald-100', badgeText: 'text-emerald-800', borderTop: 'border-t-emerald-500' },
];

export const PersonalTaskKanban: React.FC<PersonalTaskKanbanProps> = ({
  tasks,
  onUpdateTask,
  onEditTask,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  const moveStatus = (task: PersonalTask, direction: 'next' | 'prev') => {
    const statusOrder: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];
    const currentIdx = statusOrder.indexOf(task.status);
    if (currentIdx === -1) return;

    const nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (nextIdx >= 0 && nextIdx < statusOrder.length) {
      onUpdateTask({
        ...task,
        status: statusOrder[nextIdx],
        updatedAt: new Date().toISOString(),
      });
    }
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      {COLUMNS.map((col) => {
        const colTasks = tasks.filter((t) => t.status === col.id);

        return (
          <div
            key={col.id}
            className={`bg-slate-100/70 rounded-2xl border border-slate-200 border-t-4 ${col.borderTop} p-3 flex flex-col max-h-[calc(100vh-220px)]`}
          >
            {/* Column Header */}
            <div className="flex items-center justify-between px-2 py-1.5 mb-2">
              <div className="flex items-center gap-2">
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">{col.title}</h4>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${col.badgeBg} ${col.badgeText}`}>
                  {colTasks.length}
                </span>
              </div>
            </div>

            {/* Task list in column */}
            <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
              {colTasks.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 bg-white/60 rounded-xl border border-dashed border-slate-200">
                  Không có việc nào
                </div>
              ) : (
                colTasks.map((task) => {
                  const isOverdue = task.dueDate && task.dueDate < todayStr && task.status !== 'done';
                  const isToday = task.dueDate && task.dueDate === todayStr && task.status !== 'done';

                  return (
                    <div
                      key={task.id}
                      className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs hover:shadow-md transition-all group"
                    >
                      {/* Category & Priority */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="text-[10px] font-semibold text-slate-600 bg-slate-100 px-2 py-0.5 rounded truncate max-w-[120px]">
                          {task.category || 'Chung'}
                        </span>

                        {task.priority === 'urgent' ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                            🔴 Gấp
                          </span>
                        ) : task.priority === 'high' ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                            🟠 Cao
                          </span>
                        ) : null}
                      </div>

                      {/* Title */}
                      <h5
                        onClick={() => onEditTask(task)}
                        className={`text-xs font-bold text-slate-900 group-hover:text-indigo-600 leading-snug cursor-pointer mb-1.5 ${
                          task.status === 'done' ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {task.title}
                      </h5>

                      {/* Week & Redmine badge */}
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mb-2">
                        <span className="truncate max-w-[140px] font-medium">{task.week}</span>
                        {task.source === 'redmine' && (
                          <span className="text-red-600 font-mono font-bold">#{task.redmineIssueId}</span>
                        )}
                      </div>

                      {/* Result Note if present */}
                      {task.resultNote && (
                        <p className={`text-[11px] p-2 rounded-lg bg-slate-50 mb-2 line-clamp-2 ${
                          task.status !== 'done' ? 'text-red-700 font-medium' : 'text-slate-600'
                        }`}>
                          {task.resultNote}
                        </p>
                      )}

                      {/* Footer: Due date & Actions */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px]">
                        <div>
                          {isOverdue ? (
                            <span className="text-rose-700 font-bold flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> {task.dueDate}
                            </span>
                          ) : isToday ? (
                            <span className="text-amber-700 font-bold flex items-center gap-1">
                              <Clock className="w-3 h-3" /> Hôm nay
                            </span>
                          ) : task.dueDate ? (
                            <span className="text-slate-400">{task.dueDate}</span>
                          ) : (
                            <span className="text-slate-300">-</span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {col.id !== 'todo' && (
                            <button
                              onClick={() => moveStatus(task, 'prev')}
                              title="Chuyển về trạng thái trước"
                              className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-700 cursor-pointer"
                            >
                              <ArrowLeft className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => onEditTask(task)}
                            title="Sửa"
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {col.id !== 'done' && (
                            <button
                              onClick={() => moveStatus(task, 'next')}
                              title="Chuyển sang trạng thái tiếp theo"
                              className="p-1 hover:bg-indigo-50 rounded text-indigo-600 hover:text-indigo-800 cursor-pointer"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
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
  );
};
