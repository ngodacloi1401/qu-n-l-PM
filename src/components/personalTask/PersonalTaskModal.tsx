import React, { useState } from 'react';
import {
  X,
  Check,
  Calendar,
  Clock,
  AlertCircle,
  CheckSquare,
  Square,
  Plus,
  Trash2,
  ExternalLink,
  Tag,
  Folder,
  Layers,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import type { PersonalTask, SubTaskItem } from '../../types/personalTask';
import type { RedmineStatus, RedminePriority } from '../../types/redmine';
import { NotionStatusPicker, NOTION_PERSONAL_STATUS_NAMES } from './NotionStatusPicker';

interface PersonalTaskModalProps {
  task: PersonalTask | null;
  existingWeeks?: string[];
  existingCategories?: string[];
  statuses?: RedmineStatus[];
  priorities?: RedminePriority[];
  // Backwards compatibility props (ignored for personal tasks)
  trackers?: any[];
  customFields?: any[];
  categories?: any[];
  versions?: any[];
  memberships?: any[];
  projects?: any[];
  currentUser?: any;
  onClose: () => void;
  onSave: (task: PersonalTask) => void;
  onDelete?: (id: string) => void;
}

const DEFAULT_PRIORITIES = ['Low', 'Normal', 'High', 'Urgent'];

export const PersonalTaskModal: React.FC<PersonalTaskModalProps> = ({
  task,
  existingWeeks = [],
  existingCategories = [],
  onClose,
  onSave,
  onDelete,
}) => {
  // Title & Basic Properties
  const [title, setTitle] = useState(task?.title || '');
  const [category, setCategory] = useState<string>(task?.category || 'Chung');
  const [week, setWeek] = useState(
    task?.week ||
    existingWeeks[0] ||
    (() => {
      const d = new Date();
      return `Tuần ${String(Math.ceil(d.getDate() / 7)).padStart(2, '0')}`;
    })
  );
  const [statusName, setStatusName] = useState<string>(task?.statusName || 'To Do');
  const [priorityName, setPriorityName] = useState<string>(task?.priorityName || 'Normal');
  const [assignedDate, setAssignedDate] = useState(
    task?.assignedDate || new Date().toISOString().split('T')[0]
  );

  // Due Date & Time
  const initialDue = task?.dueDate || '';
  const [dueDate, setDueDate] = useState(initialDue.slice(0, 10));
  const [dueTime, setDueTime] = useState(() => {
    const match = initialDue.match(/[T\s](\d{1,2}:\d{2})/);
    return match ? match[1] : '';
  });

  // Trello-style Subtask Checklist
  const [subtasks, setSubtasks] = useState<SubTaskItem[]>(task?.subtasks || []);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Hours & Progress
  const [estimatedHours, setEstimatedHours] = useState(
    task?.estimatedHours !== undefined ? String(task.estimatedHours) : ''
  );
  const [doneRatio, setDoneRatio] = useState<number>(task?.doneRatio !== undefined ? task.doneRatio : 0);

  // Notes & Description
  const [description, setDescription] = useState(task?.description || '');
  const [resultNote, setResultNote] = useState(task?.resultNote || '');
  const [delayReason, setDelayReason] = useState(task?.delayReason || '');
  const [showAdvancedNotes, setShowAdvancedNotes] = useState(Boolean(task?.resultNote || task?.delayReason));
  const [error, setError] = useState<string | null>(null);

  // Quick preset dates calculation
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  // Friday of this week
  const dayOfWeek = today.getDay(); // 0 is Sun, 5 is Fri
  const diffToFriday = 5 - dayOfWeek;
  const friday = new Date(today);
  friday.setDate(today.getDate() + (diffToFriday >= 0 ? diffToFriday : diffToFriday + 7));
  const fridayStr = friday.toISOString().split('T')[0];

  // Next Monday
  const diffToNextMon = ((8 - dayOfWeek) % 7) || 7;
  const nextMonday = new Date(today);
  nextMonday.setDate(today.getDate() + diffToNextMon);
  const nextMondayStr = nextMonday.toISOString().split('T')[0];

  // Subtask handlers
  const handleAddSubtask = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newSubtaskTitle.trim()) return;
    const newItem: SubTaskItem = {
      id: `st_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    const updated = [...subtasks, newItem];
    setSubtasks(updated);
    setNewSubtaskTitle('');
    const completedCount = updated.filter((s) => s.completed).length;
    setDoneRatio(Math.round((completedCount / updated.length) * 100));
  };

  const handleToggleSubtask = (id: string) => {
    const updated = subtasks.map((s) => (s.id === id ? { ...s, completed: !s.completed } : s));
    setSubtasks(updated);
    const completedCount = updated.filter((s) => s.completed).length;
    const ratio = Math.round((completedCount / updated.length) * 100);
    setDoneRatio(ratio);
    if (ratio === 100 && statusName !== 'Done') {
      setStatusName('Done');
    } else if (ratio < 100 && statusName === 'Done') {
      setStatusName('In Progress');
    }
  };

  const handleDeleteSubtask = (id: string) => {
    const updated = subtasks.filter((s) => s.id !== id);
    setSubtasks(updated);
    if (updated.length > 0) {
      const completedCount = updated.filter((s) => s.completed).length;
      setDoneRatio(Math.round((completedCount / updated.length) * 100));
    }
  };

  // Quick toggle task completed
  const isCurrentlyDone =
    statusName.toLowerCase() === 'done' ||
    statusName.toLowerCase() === 'closed' ||
    statusName.toLowerCase() === 'hoàn thành' ||
    doneRatio >= 100;

  const handleQuickToggleDone = () => {
    if (isCurrentlyDone) {
      setStatusName('In Progress');
      setDoneRatio(subtasks.length > 0 ? Math.round((subtasks.filter((s) => s.completed).length / subtasks.length) * 100) : 50);
    } else {
      setStatusName('Done');
      setDoneRatio(100);
      if (subtasks.length > 0) {
        setSubtasks(subtasks.map((s) => ({ ...s, completed: true })));
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Vui lòng nhập Tiêu đề công việc');
      return;
    }

    const nowStr = new Date().toISOString();
    const updatedTask: PersonalTask = {
      id: task?.id || `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      week: week.trim() || 'Kế hoạch tuần',
      assignedDate: assignedDate || nowStr.split('T')[0],
      category: category.trim() || 'Chung',
      title: title.trim(),
      description: description.trim(),
      statusName,
      priorityName,
      doneRatio,
      estimatedHours: estimatedHours.trim() || undefined,
      resultNote: resultNote.trim(),
      dueDate: dueDate ? (dueTime ? `${dueDate} ${dueTime}` : dueDate) : '',
      delayReason: delayReason.trim(),
      source: task?.source || 'manual',
      slackUrl: task?.slackUrl,
      slackSender: task?.slackSender,
      redmineIssueId: task?.redmineIssueId,
      projectId: task?.projectId,
      projectName: task?.projectName,
      assigneeName: task?.assigneeName,
      subtasks: subtasks.length > 0 ? subtasks : undefined,
      createdAt: task?.createdAt || nowStr,
      updatedAt: nowStr,
    };

    onSave(updatedTask);
    onClose();
  };

  const completedSubtasksCount = subtasks.filter((s) => s.completed).length;
  const subtasksProgressPercent = subtasks.length > 0 ? Math.round((completedSubtasksCount / subtasks.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Minimalist Notion/Trello Header */}
        <div className="px-6 py-3.5 bg-slate-50/80 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-xl select-none" role="img" aria-label="Task icon">
              {task?.source === 'slack' ? '💬' : '📝'}
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-bold text-slate-700 bg-white border border-slate-200 px-2.5 py-0.5 rounded-md shadow-2xs">
                {task?.source === 'slack' ? 'Slack Action' : 'Việc cá nhân'}
              </span>
              {task?.source === 'slack' && task.slackSender && (
                <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-md">
                  @{task.slackSender}
                </span>
              )}
              {isCurrentlyDone && (
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md flex items-center gap-1">
                  <Check className="w-3 h-3" /> Đã hoàn thành
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleQuickToggleDone}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${isCurrentlyDone
                  ? 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                  : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                }`}
            >
              {isCurrentlyDone ? (
                <>
                  <RotateCcw className="w-3.5 h-3.5" /> Mở lại
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" /> Đánh dấu xong
                </>
              )}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-lg transition-colors cursor-pointer"
              title="Đóng"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Large Notion-Style Page Title */}
          <div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nhập tên / tiêu đề công việc..."
              className="w-full text-lg sm:text-xl font-bold text-slate-900 placeholder-slate-400 px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 transition-all outline-none"
              autoFocus
            />
          </div>

          {/* Slack Origin Callout Banner (Notion Callout) */}
          {task?.source === 'slack' && (
            <div className="p-3.5 bg-gradient-to-r from-indigo-50/90 to-blue-50/60 border border-indigo-200/80 rounded-xl flex items-start justify-between gap-3 text-xs">
              <div className="flex items-start gap-2.5">
                <span className="text-lg">💬</span>
                <div>
                  <div className="font-bold text-indigo-950 flex items-center gap-1.5">
                    Nhiệm vụ tạo từ tin nhắn Slack
                    {task.slackSender && <span className="font-semibold text-indigo-700">(@{task.slackSender})</span>}
                  </div>
                  <p className="text-indigo-800/80 text-[11px] mt-0.5">
                    Tin nhắn yêu cầu hoặc thông báo trao đổi trực tiếp trên kênh trao đổi của bạn.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {task.slackUrl && (
                  <a
                    href={task.slackUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-white hover:bg-indigo-50 border border-indigo-200 rounded-lg text-indigo-700 font-bold text-xs shadow-2xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Mở tin Slack</span>
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Notion Properties Grid */}
          <div className="bg-slate-50/70 border border-slate-200/80 rounded-2xl p-4 space-y-3.5">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Status Property */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold flex items-center gap-1.5 text-xs">
                  <Layers className="w-4 h-4 text-slate-400" /> Trạng thái
                </span>
                <div className="w-48 flex justify-end">
                  <NotionStatusPicker
                    value={statusName}
                    onChange={(name) => setStatusName(name)}
                    customStatusNames={NOTION_PERSONAL_STATUS_NAMES}
                  />
                </div>
              </div>

              {/* Priority Property */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold flex items-center gap-1.5 text-xs">
                  <Sparkles className="w-4 h-4 text-slate-400" /> Mức ưu tiên
                </span>
                <select
                  value={priorityName}
                  onChange={(e) => setPriorityName(e.target.value)}
                  className="w-48 text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg font-bold text-slate-800 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-500"
                >
                  {DEFAULT_PRIORITIES.map((p) => (
                    <option key={p} value={p}>
                      {p === 'Urgent' ? '🔴 Urgent (Khẩn cấp)' : p === 'High' ? '🟠 High (Cao)' : p === 'Normal' ? '🔵 Normal (Bình thường)' : '⚪ Low (Thấp)'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category / Project Tag */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold flex items-center gap-1.5 text-xs">
                  <Tag className="w-4 h-4 text-slate-400" /> Nhóm việc / Thẻ
                </span>
                <div className="w-48">
                  <input
                    type="text"
                    list="modal-cat-datalist"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="VD: CAD, Họp, Báo cáo..."
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-800 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-500"
                  />
                  <datalist id="modal-cat-datalist">
                    {Array.from(new Set(['Họp trực tuyến', 'Slack Action', 'CAD Shop Drawing', 'Platform', 'Báo cáo', ...existingCategories])).map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Week / Batch */}
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold flex items-center gap-1.5 text-xs">
                  <Folder className="w-4 h-4 text-slate-400" /> Tuần / Kế hoạch
                </span>
                <div className="w-48">
                  <input
                    type="text"
                    list="modal-week-datalist"
                    value={week}
                    onChange={(e) => setWeek(e.target.value)}
                    placeholder="VD: Tuần 09..."
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg font-semibold text-slate-800 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-500"
                  />
                  <datalist id="modal-week-datalist">
                    {existingWeeks.map((w) => (
                      <option key={w} value={w} />
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Deadline & Time with quick presets */}
              <div className="sm:col-span-2 pt-2 border-t border-slate-200/60">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-slate-500 font-semibold flex items-center gap-1.5 text-xs">
                    <Clock className="w-4 h-4 text-slate-400" /> Hạn chót (Deadline)
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value)}
                      className="text-xs px-2.5 py-1.5 border border-slate-200 rounded-lg text-slate-800 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-500"
                    />
                    <input
                      type="time"
                      value={dueTime}
                      onChange={(e) => setDueTime(e.target.value)}
                      className="w-24 text-xs px-2 py-1.5 border border-slate-200 rounded-lg text-slate-800 bg-white shadow-2xs focus:ring-1 focus:ring-emerald-500"
                      title="Giờ hạn chót"
                    />
                  </div>
                </div>

                {/* Quick preset buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-semibold uppercase mr-1">Đặt nhanh:</span>
                  <button
                    type="button"
                    onClick={() => {
                      setDueDate(todayStr);
                      setDueTime('18:00');
                    }}
                    className="px-2 py-0.5 rounded bg-white hover:bg-slate-200/80 border border-slate-200 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    Hôm nay 18:00
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDueDate(tomorrowStr);
                      setDueTime('18:00');
                    }}
                    className="px-2 py-0.5 rounded bg-white hover:bg-slate-200/80 border border-slate-200 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    Ngày mai 18:00
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDueDate(fridayStr);
                      setDueTime('18:00');
                    }}
                    className="px-2 py-0.5 rounded bg-white hover:bg-slate-200/80 border border-slate-200 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    Thứ 6 tuần này
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDueDate(nextMondayStr);
                      setDueTime('09:00');
                    }}
                    className="px-2 py-0.5 rounded bg-white hover:bg-slate-200/80 border border-slate-200 text-[11px] font-medium text-slate-700 transition-colors cursor-pointer"
                  >
                    Thứ 2 tuần tới
                  </button>
                  {dueDate && (
                    <button
                      type="button"
                      onClick={() => {
                        setDueDate('');
                        setDueTime('');
                      }}
                      className="px-2 py-0.5 rounded text-rose-600 hover:bg-rose-50 border border-transparent text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      Xóa hạn
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Trello-Style Subtask Checklist */}
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Danh sách việc con (Checklist)
                </h4>
              </div>
              {subtasks.length > 0 && (
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  {completedSubtasksCount} / {subtasks.length} ({subtasksProgressPercent}%)
                </span>
              )}
            </div>

            {/* Checklist Progress Bar */}
            {subtasks.length > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-1.5 rounded-full transition-all duration-300"
                  style={{ width: `${subtasksProgressPercent}%` }}
                />
              </div>
            )}

            {/* Subtasks List */}
            {subtasks.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {subtasks.map((st) => (
                  <div
                    key={st.id}
                    className="flex items-center justify-between gap-2 p-2 hover:bg-slate-50 rounded-xl group transition-colors border border-transparent hover:border-slate-200"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleSubtask(st.id)}
                      className="flex items-center gap-2.5 text-left flex-1 cursor-pointer select-none"
                    >
                      {st.completed ? (
                        <div className="w-4 h-4 rounded bg-emerald-600 flex items-center justify-center text-white shrink-0">
                          <Check className="w-3 h-3 stroke-[3]" />
                        </div>
                      ) : (
                        <div className="w-4 h-4 rounded border-2 border-slate-300 hover:border-emerald-500 shrink-0 transition-colors" />
                      )}
                      <span
                        className={`text-xs ${st.completed ? 'line-through text-slate-400 font-normal' : 'text-slate-800 font-medium'
                          }`}
                      >
                        {st.title}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteSubtask(st.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-600 rounded transition-all cursor-pointer"
                      title="Xóa việc con"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add Subtask Input Form */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                value={newSubtaskTitle}
                onChange={(e) => setNewSubtaskTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSubtask();
                  }
                }}
                placeholder="+ Thêm mục con mới... (nhấn Enter để thêm)"
                className="flex-1 text-xs px-3 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-200 rounded-xl focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
              />
              <button
                type="button"
                onClick={() => handleAddSubtask()}
                disabled={!newSubtaskTitle.trim()}
                className="px-3 py-2 bg-slate-800 hover:bg-slate-900 disabled:opacity-40 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Thêm
              </button>
            </div>
          </div>

          {/* Description & Detailed Notes (Notion Page Body) */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Nội dung chi tiết & Ghi chú (Description):
            </label>
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Thêm mô tả chi tiết, nội dung cuộc họp hoặc ghi chú thực hiện..."
              className="w-full text-xs p-3 border border-slate-200 rounded-xl text-slate-800 bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          {/* Toggle for Advanced Notes (Result Note & Delay Reason) */}
          <div className="pt-1">
            <button
              type="button"
              onClick={() => setShowAdvancedNotes(!showAdvancedNotes)}
              className="text-xs text-slate-500 hover:text-slate-800 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <span>{showAdvancedNotes ? '▼ Thu gọn ghi chú bổ sung' : '▶ Ghi chú kết quả & lý do trễ (nâng cao)'}</span>
            </button>

            {showAdvancedNotes && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3 border-t border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kết quả thực hiện:
                  </label>
                  <textarea
                    rows={2}
                    value={resultNote}
                    onChange={(e) => setResultNote(e.target.value)}
                    placeholder="Kết quả hoàn thành, link sản phẩm hoặc file đính kèm..."
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Lý do trễ hạn (nếu có):
                  </label>
                  <textarea
                    rows={2}
                    value={delayReason}
                    onChange={(e) => setDelayReason(e.target.value)}
                    placeholder="Nguyên nhân trễ hẹn, phụ thuộc bên thứ 3..."
                    className="w-full text-xs px-3 py-2 border border-slate-200 rounded-xl text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Form Actions Footer */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-between">
            {task && onDelete ? (
              <button
                type="button"
                onClick={() => {
                  if (confirm('Bạn có chắc muốn xóa thẻ công việc này?')) {
                    onDelete(task.id);
                    onClose();
                  }
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xóa việc</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-1.5 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <Check className="w-4 h-4" />
                <span>{task ? 'Lưu thay đổi' : 'Tạo việc cá nhân'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
