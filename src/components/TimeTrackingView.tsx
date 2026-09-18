import React, { useState } from 'react';
import {
  Clock,
  Plus,
  Calendar,
  User,
  FileText,
  Check,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { RedmineTimeEntry, RedmineIssue, RedmineProject } from '../types/redmine';
import { logTimeEntry } from '../services/redmineApi';

interface TimeTrackingViewProps {
  timeEntries: RedmineTimeEntry[];
  issues: RedmineIssue[];
  selectedProject: RedmineProject | undefined;
  onRefresh: () => void;
}

export const TimeTrackingView: React.FC<TimeTrackingViewProps> = ({
  timeEntries,
  issues,
  selectedProject,
  onRefresh,
}) => {
  const [showLogModal, setShowLogModal] = useState(false);
  const [issueId, setIssueId] = useState<string>('');
  const [hours, setHours] = useState<string>('1.0');
  const [comments, setComments] = useState<string>('');
  const [spentOn, setSpentOn] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const totalHours = timeEntries.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);

  // Group by user
  const userHoursMap: Record<string, number> = {};
  timeEntries.forEach((te) => {
    const uname = te.user?.name || 'Khác';
    userHoursMap[uname] = (userHoursMap[uname] || 0) + (Number(te.hours) || 0);
  });
  const userHoursList = Object.entries(userHoursMap).sort((a, b) => b[1] - a[1]);

  const handleLogTime = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const parsedHours = parseFloat(hours);
      if (isNaN(parsedHours) || parsedHours <= 0) {
        throw new Error('Số giờ phải lớn hơn 0');
      }

      await logTimeEntry({
        issue_id: issueId ? Number(issueId) : undefined,
        project_id: selectedProject ? selectedProject.id : undefined,
        hours: parsedHours,
        comments,
        spent_on: spentOn,
      });

      setSuccessMsg('Đã ghi nhận thời gian thành công vào Redmine!');
      setTimeout(() => {
        setShowLogModal(false);
        setComments('');
        setHours('1.0');
        onRefresh();
      }, 1000);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi ghi nhận giờ làm');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center border border-amber-200">
            <Clock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Nhật ký giờ làm & Chi phí nguồn lực (Time Entries)
            </h2>
            <p className="text-xs text-slate-500">
              Theo dõi giờ công các thành viên đã log trên AnyBIM Redmine
            </p>
          </div>
        </div>

        <button
          onClick={() => setShowLogModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Ghi nhận giờ làm (+ Log Time)</span>
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Tổng giờ đã log
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalHours.toFixed(1)} hrs</div>
          <div className="text-xs text-slate-500 mt-1">{timeEntries.length} lượt ghi nhận gần đây</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Số thành viên đã log
          </div>
          <div className="text-2xl font-bold text-indigo-600">{userHoursList.length} người</div>
          <div className="text-xs text-slate-500 mt-1">Đang đóng góp công sức vào dự án</div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Trung bình mỗi lượt log
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {timeEntries.length > 0 ? (totalHours / timeEntries.length).toFixed(1) : 0} hrs
          </div>
          <div className="text-xs text-slate-500 mt-1">Hiệu suất phân bổ công việc</div>
        </div>
      </div>

      {/* User Hours Breakdown & Recent Logs Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* User Hours Breakdown */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            Giờ làm theo thành viên
          </h3>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
            {userHoursList.length === 0 ? (
              <div className="text-xs text-slate-400 py-6 text-center">Chưa có dữ liệu giờ làm</div>
            ) : (
              userHoursList.map(([name, hrs], idx) => {
                const pct = totalHours > 0 ? Math.round((hrs / totalHours) * 100) : 0;
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs font-medium">
                      <span className="text-slate-800 font-semibold truncate max-w-[170px]">{name}</span>
                      <span className="text-slate-600 font-mono">
                        {hrs.toFixed(1)}h ({pct}%)
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detailed Time Entries Table */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-3 flex items-center gap-2">
            <FileText className="w-4 h-4 text-slate-600" />
            Chi tiết các lượt ghi nhận gần đây ({timeEntries.length})
          </h3>

          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold">
                  <th className="py-2.5 px-3">Ngày</th>
                  <th className="py-2.5 px-3">Thành viên</th>
                  <th className="py-2.5 px-3">Công việc / ID</th>
                  <th className="py-2.5 px-3">Số giờ</th>
                  <th className="py-2.5 px-3">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {timeEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Chưa có nhật ký thời gian nào
                    </td>
                  </tr>
                ) : (
                  timeEntries.map((entry) => (
                    <tr key={entry.id} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 font-mono text-slate-600">{entry.spent_on}</td>
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{entry.user?.name}</td>
                      <td className="py-2.5 px-3 text-slate-700">
                        {entry.issue ? (
                          <span className="font-mono text-indigo-600 font-bold">#{entry.issue.id}</span>
                        ) : (
                          <span className="text-slate-400">Dự án chung</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-700">
                        {Number(entry.hours).toFixed(1)}h
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 line-clamp-1 max-w-xs">
                        {entry.comments || '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Log Time Modal */}
      {showLogModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900 mb-1">Ghi nhận giờ làm vào Redmine</h3>
            <p className="text-xs text-slate-500 mb-4">
              Dữ liệu sẽ được lưu đồng bộ trực tiếp vào hệ thống Redmine
            </p>

            {errorMsg && (
              <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {successMsg && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-700 flex items-center gap-2">
                <Check className="w-4 h-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogTime} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Công việc (#ID Task)
                </label>
                <select
                  value={issueId}
                  onChange={(e) => setIssueId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                >
                  <option value="">-- Chọn công việc (hoặc để trống cho dự án chung) --</option>
                  {issues.slice(0, 50).map((iss) => (
                    <option key={iss.id} value={iss.id}>
                      #{iss.id} - {iss.subject}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Số giờ làm *
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0.1"
                    required
                    value={hours}
                    onChange={(e) => setHours(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày làm *
                  </label>
                  <input
                    type="date"
                    required
                    value={spentOn}
                    onChange={(e) => setSpentOn(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi chú công việc đã làm
                </label>
                <textarea
                  rows={3}
                  placeholder="Mô tả nội dung công việc bạn đã hoàn thành..."
                  value={comments}
                  onChange={(e) => setComments(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-xs font-semibold bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Đang lưu...' : 'Xác nhận Log Time'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
