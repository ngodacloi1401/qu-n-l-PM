import React from 'react';
import { Clock, AlertCircle, Edit2, ArrowRight, ArrowLeft, ExternalLink } from 'lucide-react';
import type { PersonalTask } from '../../types/personalTask';
import type { RedmineStatus } from '../../types/redmine';

interface PersonalTaskKanbanProps {
  tasks: PersonalTask[];
  statuses: RedmineStatus[];
  onUpdateTask: (task: PersonalTask) => void;
  onEditTask: (task: PersonalTask) => void;
  readOnly?: boolean;
  baseUrl?: string;
}

interface KanbanColConfig {
  id: string; // group key
  title: string;
  badgeBg: string;
  badgeText: string;
  borderTop: string;
  matchStatuses: string[];
}

export const PersonalTaskKanban: React.FC<PersonalTaskKanbanProps> = ({
  tasks,
  statuses,
  onUpdateTask,
  onEditTask,
  readOnly = false,
  baseUrl = '',
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Standard 4 columns aligned with Redmine lifecycle:
  // 1. Mới / To Do (New, Ready...)
  // 2. Đang làm (In Progress...)
  // 3. Kiểm thử / Chờ duyệt (QA testing, QA Verified, Feedback, Ready For QA...)
  // 4. Hoàn thành / Đã đóng (Resolved, Closed, On PROD, Client Verified...)
  const columns: KanbanColConfig[] = [
    {
      id: 'new',
      title: 'New (Mới tạo)',
      badgeBg: 'bg-slate-100',
      badgeText: 'text-slate-700',
      borderTop: 'border-t-slate-400',
      matchStatuses: ['new', 'mới', 'chưa làm', 'to do'],
    },
    {
      id: 'in_progress',
      title: 'In Progress (Đang làm)',
      badgeBg: 'bg-amber-100',
      badgeText: 'text-amber-800',
      borderTop: 'border-t-amber-500',
      matchStatuses: ['in progress', 'đang làm', 'doing', 'on stg', 'pending'],
    },
    {
      id: 'review',
      title: 'QA / Feedback (Chờ duyệt)',
      badgeBg: 'bg-blue-100',
      badgeText: 'text-blue-800',
      borderTop: 'border-t-blue-500',
      matchStatuses: ['qa testing', 'ready for qa', 'qa verified', 'feedback', 'review', 'kiểm tra'],
    },
    {
      id: 'closed',
      title: 'Closed / Resolved (Đã đóng)',
      badgeBg: 'bg-emerald-100',
      badgeText: 'text-emerald-800',
      borderTop: 'border-t-emerald-500',
      matchStatuses: ['closed', 'resolved', 'close-duplicated', 'on prod', 'client verified', 'hoàn thành', 'done'],
    },
  ];

  const getColForTask = (statusName: string): string => {
    const s = (statusName || '').toLowerCase().trim();
    for (const col of columns) {
      if (col.matchStatuses.some((m) => s.includes(m))) {
        return col.id;
      }
    }
    return 'new';
  };

  const moveStatus = (task: PersonalTask, direction: 'next' | 'prev') => {
    if (readOnly) return;
    const colOrder = ['new', 'in_progress', 'review', 'closed'];
    const currentCol = getColForTask(task.statusName);
    const currentIdx = colOrder.indexOf(currentCol);
    if (currentIdx === -1) return;

    const nextIdx = direction === 'next' ? currentIdx + 1 : currentIdx - 1;
    if (nextIdx >= 0 && nextIdx < colOrder.length) {
      const targetColId = colOrder[nextIdx];
      let targetStatusName = 'New';
      if (targetColId === 'in_progress') targetStatusName = 'In Progress';
      else if (targetColId === 'review') targetStatusName = 'QA testing';
      else if (targetColId === 'closed') targetStatusName = 'Closed';

      onUpdateTask({
        ...task,
        statusName: targetStatusName,
        doneRatio: targetColId === 'closed' ? 100 : targetColId === 'new' ? 0 : 50,
        updatedAt: new Date().toISOString(),
      });
    }
  };

  const openTask = (task: PersonalTask) => {
    if (readOnly && task.redmineIssueId && baseUrl) {
      window.open(`${baseUrl.replace(/\/$/, '')}/issues/${task.redmineIssueId}`, '_blank', 'noopener,noreferrer');
      return;
    }
    onEditTask(task);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 items-start">
      {columns.map((col) => {
        const colTasks = tasks.filter((t) => getColForTask(t.statusName) === col.id);

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
                  const isClosed = col.id === 'closed';
                  const isOverdue = task.dueDate && task.dueDate < todayStr && !isClosed;
                  const isToday = task.dueDate && task.dueDate === todayStr && !isClosed;
                  const pName = (task.priorityName || '').toLowerCase();
                  const isUrgent = pName.includes('urgent') || pName.includes('must have');
                  const isHigh = pName.includes('high') || pName.includes('should have');

                  return (
                    <div
                      key={task.id}
                      className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-xs hover:shadow-md transition-all group"
                    >
                      {/* Tracker & Priority */}
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                            {task.trackerName || 'Task'}
                          </span>
                          <span className="text-[10px] font-semibold text-slate-500 truncate max-w-[100px]">
                            {task.category || 'Chung'}
                          </span>
                        </div>

                        {isUrgent ? (
                          <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                            🔴 {task.priorityName}
                          </span>
                        ) : isHigh ? (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                            🟠 {task.priorityName}
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-500 font-medium">{task.priorityName}</span>
                        )}
                      </div>

                      {/* Title */}
                      <h5
                        onClick={() => openTask(task)}
                        className={`text-xs font-bold text-slate-900 group-hover:text-indigo-600 leading-snug cursor-pointer mb-1.5 ${
                          isClosed ? 'line-through text-slate-400' : ''
                        }`}
                      >
                        {task.parentTaskId && (
                          <span className="font-mono text-[10px] text-slate-500 mr-1 font-bold">
                            #{task.parentTaskId}
                          </span>
                        )}
                        {task.title}
                      </h5>

                      {/* Project / Week & Assignee */}
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-2">
                        <span className="truncate max-w-[150px] font-medium text-slate-600">
                          {task.source === 'redmine'
                            ? (task.projectName || task.category || '')
                            : (task.week || task.projectName || task.category || '')}
                        </span>
                        {task.assigneeName && <span className="truncate max-w-[100px]">{task.assigneeName}</span>}
                      </div>

                      {/* Result Note if present */}
                      {task.resultNote && (
                        <p
                          className={`text-[11px] p-2 rounded-lg bg-slate-50 mb-2 line-clamp-2 ${
                            !isClosed ? 'text-red-700 font-medium' : 'text-slate-600'
                          }`}
                        >
                          {task.resultNote}
                        </p>
                      )}

                      {/* Status pill & Footer */}
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
                          {readOnly ? (
                            <button onClick={() => openTask(task)} title="Mở issue trên Redmine" className="inline-flex items-center gap-1 px-1.5 py-1 hover:bg-red-50 rounded text-red-600 hover:text-red-800 cursor-pointer">
                              <ExternalLink className="w-3.5 h-3.5" /><span className="text-[10px] font-semibold">Redmine</span>
                            </button>
                          ) : <>
                          {col.id !== 'new' && (
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
                            title="Chỉnh sửa thuộc tính"
                            className="p-1 hover:bg-slate-100 rounded text-slate-400 hover:text-indigo-600 cursor-pointer"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {col.id !== 'closed' && (
                            <button
                              onClick={() => moveStatus(task, 'next')}
                              title="Chuyển sang trạng thái tiếp theo"
                              className="p-1 hover:bg-indigo-50 rounded text-indigo-600 hover:text-indigo-800 cursor-pointer"
                            >
                              <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                          </>}
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
