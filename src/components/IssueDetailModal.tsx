import React, { useState, useEffect } from 'react';
import {
  X,
  ExternalLink,
  Calendar,
  Clock,
  User,
  Flag,
  CheckCircle2,
  MessageSquare,
  AlertCircle,
  Check,
  Send,
  History,
  Layers,
} from 'lucide-react';
import {
  RedmineIssue,
  RedmineStatus,
  RedminePriority,
  RedmineMembership,
} from '../types/redmine';
import { getIssueDetail, updateIssue } from '../services/redmineApi';

interface IssueDetailModalProps {
  issue: RedmineIssue;
  statuses: RedmineStatus[];
  priorities: RedminePriority[];
  memberships: RedmineMembership[];
  onClose: () => void;
  onUpdated: () => void;
  baseUrl: string;
}

export const IssueDetailModal: React.FC<IssueDetailModalProps> = ({
  issue: initialIssue,
  statuses,
  priorities,
  memberships,
  onClose,
  onUpdated,
  baseUrl,
}) => {
  const [issue, setIssue] = useState<RedmineIssue>(initialIssue);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Editable fields
  const [statusId, setStatusId] = useState<number>(initialIssue.status.id);
  const [doneRatio, setDoneRatio] = useState<number>(initialIssue.done_ratio);
  const [priorityId, setPriorityId] = useState<number>(initialIssue.priority.id);
  const [assigneeId, setAssigneeId] = useState<number | undefined>(initialIssue.assigned_to?.id);
  const [dueDate, setDueDate] = useState<string>(initialIssue.due_date || '');
  const [estimatedHours, setEstimatedHours] = useState<number | undefined>(initialIssue.estimated_hours);

  // Note/comment
  const [note, setNote] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Fetch full details including journals/history
  useEffect(() => {
    let isMounted = true;
    setLoadingDetail(true);
    getIssueDetail(initialIssue.id)
      .then((full) => {
        if (isMounted) {
          setIssue(full);
          setStatusId(full.status.id);
          setDoneRatio(full.done_ratio);
          setPriorityId(full.priority.id);
          setAssigneeId(full.assigned_to?.id);
          setDueDate(full.due_date || '');
          setEstimatedHours(full.estimated_hours);
        }
      })
      .catch((err) => {
        console.error('Failed to load issue detail:', err);
      })
      .finally(() => {
        if (isMounted) setLoadingDetail(false);
      });

    return () => {
      isMounted = false;
    };
  }, [initialIssue.id]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setErrorMsg(null);
    setSaveSuccess(false);

    try {
      await updateIssue(issue.id, {
        status_id: statusId,
        done_ratio: doneRatio,
        priority_id: priorityId === issue.priority.id ? undefined : priorityId,
        assigned_to_id: assigneeId,
        due_date: dueDate || undefined,
        estimated_hours: estimatedHours,
        notes: note.trim() || undefined,
      });

      setSaveSuccess(true);
      setNote('');

      // Refresh detail
      const refreshed = await getIssueDetail(issue.id);
      setIssue(refreshed);
      onUpdated();

      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi cập nhật công việc');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex justify-end animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col overflow-hidden border-l border-slate-200">
        {/* Drawer Header */}
        <div className="p-4 sm:px-6 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
              #{issue.id}
            </span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
              {issue.tracker?.name}
            </span>
            <a
              href={`${baseUrl}/issues/${issue.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-medium"
            >
              <span>Mở Redmine Web</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Title */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 leading-snug">{issue.subject}</h2>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
              <span>Dự án: <strong className="text-slate-700">{issue.project?.name}</strong></span>
              <span>•</span>
              <span>Tạo bởi: {issue.author?.name}</span>
            </div>
          </div>

          {/* Messages */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
              <Check className="w-4 h-4 flex-shrink-0" />
              <span>Đã cập nhật công việc trên Redmine thành công!</span>
            </div>
          )}

          {/* Quick Edit Controls */}
          <form onSubmit={handleSave} className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-4">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-indigo-600" />
              Cập nhật nhanh thông tin PM
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Trạng thái</label>
                <select
                  value={statusId}
                  onChange={(e) => setStatusId(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {statuses.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name} {st.is_closed ? '(Closed)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Priority */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mức ưu tiên</label>
                <select
                  value={priorityId}
                  onChange={(e) => setPriorityId(Number(e.target.value))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  {!priorities.some(pr => pr.id === issue.priority.id) && <option value={issue.priority.id}>{issue.priority.name} (ưu tiên hiện tại)</option>}
                  {priorities.map((pr) => (
                    <option key={pr.id} value={pr.id}>
                      {pr.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Assignee */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Người phụ trách</label>
                <select
                  value={assigneeId || ''}
                  onChange={(e) => setAssigneeId(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Chưa gán (Unassigned) --</option>
                  {memberships.map((m) => {
                    if (!m.user) return null;
                    return (
                      <option key={m.id} value={m.user.id}>
                        {m.user.name}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Due Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Hạn chót (Due Date)</label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Estimated Hours */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Giờ ước tính (Estimated)</label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={estimatedHours || ''}
                  onChange={(e) => setEstimatedHours(e.target.value ? Number(e.target.value) : undefined)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  placeholder="e.g. 4.0"
                />
              </div>

              {/* Done Ratio Slider */}
              <div>
                <div className="flex items-center justify-between text-xs font-semibold text-slate-700 mb-1">
                  <span>Tiến độ hoàn thành</span>
                  <span className="font-bold text-indigo-600">{doneRatio}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={doneRatio}
                  onChange={(e) => setDoneRatio(Number(e.target.value))}
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                />
              </div>
            </div>

            {/* Note / Comment */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Thêm ghi chú / comment trao đổi
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Nhập ghi chú cập nhật cho team..."
                className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                disabled={isSaving}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-50 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSaving ? 'Đang lưu lên Redmine...' : 'Lưu cập nhật'}</span>
              </button>
            </div>
          </form>

          {/* Description */}
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Mô tả chi tiết
            </h3>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
              {issue.description ? issue.description : <span className="italic text-slate-400">Không có mô tả</span>}
            </div>
          </div>

          {/* History / Journals */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              Lịch sử trao đổi & thay đổi ({issue.journals?.length || 0})
            </h3>

            {loadingDetail ? (
              <div className="text-xs text-slate-400 py-4 text-center">Đang tải lịch sử...</div>
            ) : !issue.journals || issue.journals.length === 0 ? (
              <div className="text-xs text-slate-400 py-4 text-center italic">
                Chưa có lịch sử trao đổi nào
              </div>
            ) : (
              <div className="space-y-3">
                {issue.journals.map((journal) => (
                  <div key={journal.id} className="p-3 bg-white rounded-lg border border-slate-200 shadow-2xs space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span className="font-semibold text-slate-800">{journal.user?.name}</span>
                      <span>{new Date(journal.created_on).toLocaleString('vi-VN')}</span>
                    </div>

                    {journal.details && journal.details.length > 0 && (
                      <div className="text-[11px] text-slate-500 bg-slate-50 p-2 rounded border border-slate-100 space-y-0.5">
                        {journal.details.map((d, i) => (
                          <div key={i}>
                            <strong>{d.name}</strong> thay đổi từ <span className="line-through">{d.old_value || 'None'}</span> thành{' '}
                            <span className="font-semibold text-slate-800">{d.new_value || 'None'}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {journal.notes && (
                      <div className="text-xs text-slate-700 whitespace-pre-wrap pt-1">
                        {journal.notes}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
