import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw, Clock, Users, Hash, ExternalLink } from 'lucide-react';
import { fetchOTReport } from '../services/redmineApi';
import { downloadOTExcel, summarizeOT, OTRecord } from '../services/otReport';
import type { RedmineIssue } from '../types/redmine';

export function OTReportView({ projectId, projectName, baseUrl, onSelectIssue }: { projectId: string; projectName: string; baseUrl: string; onSelectIssue: (issue: RedmineIssue) => void }) {
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
  const [from, setFrom] = useState(`${today.slice(0, 7)}-01`);
  const [to, setTo] = useState(today);
  const [records, setRecords] = useState<OTRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [savedAt, setSavedAt] = useState(0);
  const forceNext = useRef(false);
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState('');
  const [reload, setReload] = useState(0);
  const [userId, setUserId] = useState('all');
  const [trackerId, setTrackerId] = useState('all');
  const request = useRef(0);

  useEffect(() => {
    const id = ++request.current;
    let cancelled = false;
    const current = () => !cancelled && id === request.current;
    setRecords([]); setSavedAt(0); setError(''); setLoading(true); setProgress('Đang tìm issue OT và tải giờ công…');
    if (!from || !to || from > to) { setError('Chọn khoảng ngày hợp lệ.'); setLoading(false); setSyncing(false); return; }
    const force = forceNext.current; forceNext.current = false;
    setSyncing(true);
    (async () => {
      const report = await fetchOTReport(projectId, from, to, { force, onCached: (rows, timestamp) => {
        if (current()) { setRecords(rows); setSavedAt(timestamp); setLoading(false); }
      } });
      summarizeOT(report.records);
      if (current()) { setRecords(report.records); setSavedAt(report.fetchedAt); }
    })().catch(e => { if (current()) setError(e.message || 'Không thể tải báo cáo OT.'); })
      .finally(() => { if (current()) { setLoading(false); setSyncing(false); setProgress(''); } });
    return () => { cancelled = true; };
  }, [projectId, from, to, reload, baseUrl]);

  const filtered = useMemo(() => records.filter(r => (userId === 'all' || String(r.entry.user.id) === userId) && (trackerId === 'all' || String(r.issue.tracker.id) === trackerId)), [records, userId, trackerId]);
  const summary = useMemo(() => summarizeOT(filtered), [filtered]);
  const total = summary.reduce((n, r) => n + r.hours, 0);
  const users = [...new Map(records.map(r => [r.entry.user.id, r.entry.user])).values()];
  const trackers = [...new Map(records.map(r => [r.issue.tracker.id, r.issue.tracker])).values()];
  const exportExcel = async () => {
    setExporting(true);
    try { await downloadOTExcel(filtered, summary, { from, to, project: projectName, baseUrl }); }
    catch (e: any) { setError(`Xuất Excel thất bại: ${e.message}`); }
    finally { setExporting(false); }
  };

  return <div className="space-y-5">
    {/* Top Banner — matches TimeTrackingView pattern */}
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-200">
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900">Tổng hợp OT</h2>
          <p className="text-xs text-slate-500">Giờ đã log vào issue có từ "OT" trong subject, gồm cả issue đã đóng.</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 items-end">
        <label className="text-xs text-slate-600">
          Từ ngày
          <input aria-label="OT từ ngày" type="date" value={from} onChange={e => setFrom(e.target.value)} className="block bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm mt-1" />
        </label>
        <label className="text-xs text-slate-600">
          Đến ngày
          <input aria-label="OT đến ngày" type="date" value={to} onChange={e => setTo(e.target.value)} className="block bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm mt-1" />
        </label>
        <label className="text-xs text-slate-600">
          Thành viên
          <select aria-label="Thành viên OT" value={userId} onChange={e => setUserId(e.target.value)} className="block bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm mt-1 min-w-36">
            <option value="all">Tất cả thành viên</option>
            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-600">
          Tracker
          <select aria-label="Tracker OT" value={trackerId} onChange={e => setTrackerId(e.target.value)} className="block bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-sm mt-1 min-w-36">
            <option value="all">Tất cả tracker</option>
            {trackers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        </label>
        <button onClick={() => { forceNext.current = true; setReload(n => n + 1); }} disabled={loading || syncing} className="inline-flex items-center gap-1.5 px-3 py-2 text-slate-700 hover:bg-slate-100 rounded-lg border border-slate-300 text-xs font-semibold transition-colors cursor-pointer disabled:opacity-40">
          <RefreshCw className={`w-4 h-4 ${loading || syncing ? 'animate-spin' : ''}`} />Tải lại
        </button>
        {baseUrl && (
          <a
            href={
              projectId !== 'all'
                ? `${baseUrl.replace(/\/+$/, '')}/projects/${projectId}/time_entries`
                : `${baseUrl.replace(/\/+$/, '')}/time_entries`
            }
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200 rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Mở trang Nhật ký giờ làm trên AnyBIM Redmine Web"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Mở Redmine (Giờ làm)</span>
          </a>
        )}
        <button onClick={exportExcel} disabled={loading || syncing || !!error || exporting || !filtered.length} className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer disabled:opacity-40">
          <Download className="w-4 h-4" />{exporting ? 'Đang xuất…' : 'Xuất Excel'}
        </button>
      </div>
    </div>

    {error && <p role="alert" className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-sm">{error}</p>}
    {!!savedAt && <p className="text-xs text-slate-500">Dữ liệu lưu trên trình duyệt lúc {new Date(savedAt).toLocaleString('vi-VN')}.{syncing ? ' Đang đồng bộ với Redmine…' : ' Tải lại để kiểm tra cập nhật ngay.'}</p>}

    {loading ? <p role="status" className="p-8 text-center text-slate-500">{progress}</p> : !error && <>
      {/* Metric Cards — matching DashboardAnalytics / TimeTracking */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Tổng giờ OT</span>
            <Clock className="w-4 h-4 text-orange-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{total.toFixed(2)} giờ</div>
          <div className="text-xs text-slate-500 mt-1">{filtered.length} lượt log trong khoảng ngày</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Thành viên OT</span>
            <Users className="w-4 h-4 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-indigo-600">{new Set(filtered.map(r => r.entry.user.id)).size} người</div>
          <div className="text-xs text-slate-500 mt-1">Có giờ OT đã log</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Issue OT có log</span>
            <Hash className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-emerald-600">{new Set(filtered.map(r => r.issue.id)).size} issue</div>
          <div className="text-xs text-slate-500 mt-1">Issue có chứa "OT" trong subject</div>
        </div>
      </div>

      {!filtered.length ? <p className="p-8 bg-white rounded-xl border border-slate-200 text-center text-slate-500">Không có giờ OT đã log trong phạm vi đã chọn.</p> : <>
        {/* Summary Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Thành viên', 'Dự án', 'Tracker', 'Giờ OT', 'Lượt log', 'Issue OT'].map(h => <th className="py-2.5 px-3 text-xs font-semibold text-slate-500" key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.map(r => <tr key={`${r.userId}:${r.projectId}:${r.trackerId}`} className="hover:bg-slate-50/80">
                <td className="py-2.5 px-3 font-semibold text-slate-800">{r.user}</td>
                <td className="py-2.5 px-3 text-slate-700">{r.project}</td>
                <td className="py-2.5 px-3 text-slate-700">{r.tracker}</td>
                <td className="py-2.5 px-3 font-mono font-bold text-orange-700">{r.hours.toFixed(2)}</td>
                <td className="py-2.5 px-3 text-slate-600">{r.logs}</td>
                <td className="py-2.5 px-3 text-slate-600">{r.issues}</td>
              </tr>)}
            </tbody>
          </table>
        </div>

        {/* Detail Table */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-3">Chi tiết giờ OT ({filtered.length} lượt log)</h3>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-sm text-left">
              <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Ngày', 'Thành viên', 'Issue / Subject', 'Tracker', 'Giờ OT', 'Ghi chú'].map(h => <th key={h} className="py-2.5 px-3 text-xs font-semibold text-slate-500">{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(({ entry: e, issue: i }) => <tr key={e.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-3 font-mono text-slate-600 whitespace-nowrap">{e.spent_on}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-800">{e.user.name}</td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      <button onClick={() => onSelectIssue(i)} className="text-indigo-600 text-left hover:underline truncate max-w-md">#{i.id} {i.subject}</button>
                      {baseUrl && (
                        <a
                          href={`${baseUrl.replace(/\/+$/, '')}/issues/${i.id}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Mở trên Redmine"
                          className="text-slate-400 hover:text-indigo-600 p-0.5 rounded hover:bg-slate-100 flex-shrink-0"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">{i.tracker.name}</td>
                  <td className="py-2.5 px-3 font-mono font-bold text-orange-700">{Number(e.hours).toFixed(2)}</td>
                  <td className="py-2.5 px-3 text-slate-500">{e.comments || '—'}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        </div>
      </>}
    </>}
  </div>;
}
