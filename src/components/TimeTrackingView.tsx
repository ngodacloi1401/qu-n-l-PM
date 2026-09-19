import React, { useEffect, useRef, useState } from 'react';
import {
  Clock,
  Plus,
  Calendar,
  User,
  FileText,
  Check,
  AlertCircle,
  TrendingUp,
  Download,
  RefreshCw,
} from 'lucide-react';
import { RedmineTimeEntry, RedmineProject } from '../types/redmine';
import { fetchReportTimeEntries, logTimeEntry } from '../services/redmineApi';
import { downloadTimeEntriesExcel } from '../services/timeReport';

interface TimeTrackingViewProps {
  selectedProject: RedmineProject | undefined;
  onRefresh: () => void;
}

export const TimeTrackingView: React.FC<TimeTrackingViewProps> = ({
  selectedProject,
  onRefresh,
}) => {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
  const [from, setFrom] = useState(today.slice(0, 7) + '-01');
  const [to, setTo] = useState(today);
  const [entries, setEntries] = useState<RedmineTimeEntry[]>([]);
  const [loadingEntries, setLoadingEntries] = useState(true);
  const [reload, setReload] = useState(0);
  const [entryPage, setEntryPage] = useState(1);
  const [selectedUserId, setSelectedUserId] = useState('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const requestId = useRef(0);
  useEffect(() => { const id = ++requestId.current; setLoadingEntries(true); setErrorMsg(null); setEntryPage(1); fetchReportTimeEntries(String(selectedProject?.id || 'all'), from, to, reload > 0).then(rows => { if (id === requestId.current) setEntries(rows); }).catch(e => { if (id === requestId.current) setErrorMsg(e.message); }).finally(() => { if (id === requestId.current) setLoadingEntries(false); }); }, [selectedProject?.id, from, to, reload]);
  useEffect(() => { setSelectedUserId('all'); }, [selectedProject?.id, from, to]);
  const [showLogModal, setShowLogModal] = useState(false);
  const [issueId, setIssueId] = useState<string>('');
  const [hours, setHours] = useState<string>('1.0');
  const [comments, setComments] = useState<string>('');
  const [spentOn, setSpentOn] = useState<string>(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const users = [...new Map(entries.map((entry) => [entry.user.id, entry.user])).values()].sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  const filteredEntries = selectedUserId === 'all' ? entries : entries.filter((entry) => String(entry.user.id) === selectedUserId);
  const totalHours = filteredEntries.reduce((acc, curr) => acc + (Number(curr.hours) || 0), 0);

  // Group by user
  const userHoursMap: Record<string, number> = {};
  filteredEntries.forEach((te) => {
    const uname = te.user?.name || 'Khác';
    userHoursMap[uname] = (userHoursMap[uname] || 0) + (Number(te.hours) || 0);
  });
  const userHoursList = Object.entries(userHoursMap).sort((a, b) => b[1] - a[1]);
  const entryPageSize = 100;
  const entryPageCount = Math.max(1, Math.ceil(filteredEntries.length / entryPageSize));
  const visibleEntries = filteredEntries.slice((entryPage - 1) * entryPageSize, entryPage * entryPageSize);

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
        setReload((n) => n + 1);
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

        <div className="flex flex-wrap gap-2 items-end">
          <label className="text-xs">Từ ngày<input aria-label="Log time từ ngày" type="date" value={from} onChange={e => setFrom(e.target.value)} className="block border rounded p-2 mt-1" /></label>
          <label className="text-xs">Đến ngày<input aria-label="Log time đến ngày" type="date" value={to} onChange={e => setTo(e.target.value)} className="block border rounded p-2 mt-1" /></label>
          <label className="text-xs">Thành viên<select aria-label="Lọc log time theo thành viên" value={selectedUserId} onChange={e => { setSelectedUserId(e.target.value); setEntryPage(1); }} className="block border rounded p-2 mt-1 min-w-44 bg-white"><option value="all">Tất cả thành viên</option>{users.map(user => <option key={user.id} value={user.id}>{user.name}</option>)}</select></label>
          <button disabled={loadingEntries} onClick={() => setReload(n => n + 1)} className="border rounded-lg px-3 py-2 text-xs"><RefreshCw className={"inline w-4 h-4 mr-1 " + (loadingEntries ? 'animate-spin' : '')} />Tải lại</button>
          <button disabled={loadingEntries || !filteredEntries.length} onClick={() => downloadTimeEntriesExcel(filteredEntries, { project: selectedProject?.name || 'Tất cả dự án', from, to })} className="bg-emerald-600 text-white rounded-lg px-3 py-2 text-xs disabled:opacity-40"><Download className="inline w-4 h-4 mr-1" />Xuất Excel</button>
        <button
          onClick={() => setShowLogModal(true)}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Ghi nhận giờ làm (+ Log Time)</span>
        </button></div>
      </div>
      {loadingEntries && <div role="status" className="p-3 bg-indigo-50 text-indigo-700 rounded-lg text-sm"><RefreshCw className="inline w-4 h-4 mr-2 animate-spin" />Đang tải đầy đủ nhật ký giờ làm…</div>}
      {!loadingEntries && errorMsg && !showLogModal && <div role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm"><AlertCircle className="inline w-4 h-4 mr-2" />{errorMsg}</div>}

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">
            Tổng giờ đã log
          </div>
          <div className="text-2xl font-bold text-slate-900">{totalHours.toFixed(1)} hrs</div>
          <div className="text-xs text-slate-500 mt-1">{filteredEntries.length} lượt ghi nhận{selectedUserId !== 'all' ? ` / ${entries.length} tổng lượt` : ''} trong khoảng ngày</div>
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
            {filteredEntries.length > 0 ? (totalHours / filteredEntries.length).toFixed(1) : 0} hrs
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
            Chi tiết lượt ghi nhận ({filteredEntries.length}{selectedUserId !== 'all' ? ` / ${entries.length}` : ''})
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
                {filteredEntries.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400">
                      Chưa có nhật ký thời gian nào
                    </td>
                  </tr>
                ) : (
                  visibleEntries.map((entry) => (
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
          {filteredEntries.length > entryPageSize && (
            <div className="flex items-center justify-between gap-3 pt-3 text-xs text-slate-500">
              <span>Hiển thị {(entryPage - 1) * entryPageSize + 1}–{Math.min(entryPage * entryPageSize, filteredEntries.length)} / {filteredEntries.length} lượt log</span>
              <div className="flex items-center gap-2">
                <button className="border rounded px-2 py-1 disabled:opacity-40" disabled={entryPage === 1} onClick={() => setEntryPage((p) => Math.max(1, p - 1))}>Trang trước</button>
                <span>{entryPage} / {entryPageCount}</span>
                <button className="border rounded px-2 py-1 disabled:opacity-40" disabled={entryPage === entryPageCount} onClick={() => setEntryPage((p) => Math.min(entryPageCount, p + 1))}>Trang sau</button>
              </div>
            </div>
          )}
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
                <input
                  type="number"
                  min="1"
                  value={issueId}
                  onChange={(e) => setIssueId(e.target.value)}
                  placeholder="Nhập ID công việc; để trống nếu log cho dự án"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-[11px] text-slate-400 mt-1">Có thể nhập bất kỳ ID nào trong toàn bộ dữ liệu Redmine; không bị giới hạn 50 công việc đầu.</p>
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
