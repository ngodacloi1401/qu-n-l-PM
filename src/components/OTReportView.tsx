import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Download, RefreshCw } from 'lucide-react';
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
  const input = 'border border-slate-300 rounded-lg p-2 text-sm bg-white';
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between gap-4">
      <div><h2 className="font-bold text-lg text-slate-900">Tổng hợp OT</h2><p className="text-sm text-slate-500">Giờ đã log vào issue có từ “OT” trong subject, gồm cả issue đã đóng.</p></div>
      <div className="flex gap-2"><button onClick={() => { forceNext.current = true; setReload(n => n + 1); }} disabled={loading || syncing} className={input}><RefreshCw className="w-4 h-4 inline mr-2" />Tải lại</button><button onClick={exportExcel} disabled={loading || syncing || !!error || exporting || !filtered.length} className="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm disabled:opacity-40"><Download className="w-4 h-4 inline mr-2" />{exporting ? 'Đang xuất…' : 'Xuất Excel'}</button></div>
    </div>
    <div className="flex flex-wrap items-end gap-3"><label className="text-xs text-slate-600">Từ ngày<input aria-label="OT từ ngày" type="date" value={from} onChange={e => setFrom(e.target.value)} className={`${input} block mt-1`} /></label><label className="text-xs text-slate-600">Đến ngày<input aria-label="OT đến ngày" type="date" value={to} onChange={e => setTo(e.target.value)} className={`${input} block mt-1`} /></label><select aria-label="Thành viên OT" value={userId} onChange={e => setUserId(e.target.value)} className={input}><option value="all">Tất cả thành viên</option>{users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}</select><select aria-label="Tracker OT" value={trackerId} onChange={e => setTrackerId(e.target.value)} className={input}><option value="all">Tất cả tracker</option>{trackers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}</select></div>
    {error && <p role="alert" className="bg-rose-50 text-rose-700 p-4 rounded-lg">{error}</p>}
    {!!savedAt && <p className="text-xs text-slate-500">Dữ liệu lưu trên trình duyệt lúc {new Date(savedAt).toLocaleString('vi-VN')}.{syncing ? ' Đang đồng bộ với Redmine…' : ' Tải lại để kiểm tra cập nhật ngay.'}</p>}
    {loading ? <p role="status" className="p-8 text-center text-slate-500">{progress}</p> : !error && <>
      <div className="grid sm:grid-cols-3 gap-4">{[['Tổng giờ OT', `${total.toFixed(2)} giờ`], ['Thành viên OT', new Set(filtered.map(r => r.entry.user.id)).size], ['Issue OT có log', new Set(filtered.map(r => r.issue.id)).size]].map(([label, value]) => <div key={label} className="bg-white border border-slate-200 rounded-xl p-4"><p className="text-sm text-slate-500">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></div>)}</div>
      {!filtered.length ? <p className="p-8 bg-white rounded-xl text-center text-slate-500">Không có giờ OT đã log trong phạm vi đã chọn.</p> : <>
        <div className="bg-white rounded-xl border border-slate-200 overflow-auto"><table className="w-full text-sm text-left"><thead className="bg-slate-100"><tr>{['Thành viên', 'Dự án', 'Tracker', 'Giờ OT', 'Lượt log', 'Issue OT'].map(h => <th className="p-3" key={h}>{h}</th>)}</tr></thead><tbody>{summary.map(r => <tr key={`${r.userId}:${r.projectId}:${r.trackerId}`} className="border-t border-slate-100"><td className="p-3">{r.user}</td><td className="p-3">{r.project}</td><td className="p-3">{r.tracker}</td><td className="p-3 font-semibold">{r.hours.toFixed(2)}</td><td className="p-3">{r.logs}</td><td className="p-3">{r.issues}</td></tr>)}</tbody></table></div>
        <h3 className="font-semibold">Chi tiết giờ OT ({filtered.length} lượt log)</h3>
        <div className="bg-white rounded-xl border border-slate-200 max-h-96 overflow-auto"><table className="w-full text-sm text-left"><thead className="sticky top-0 bg-slate-100"><tr>{['Ngày', 'Thành viên', 'Issue / Subject', 'Tracker', 'Giờ OT', 'Ghi chú'].map(h => <th key={h} className="p-3">{h}</th>)}</tr></thead><tbody>{filtered.map(({ entry: e, issue: i }) => <tr key={e.id} className="border-t border-slate-100"><td className="p-3 whitespace-nowrap">{e.spent_on}</td><td className="p-3">{e.user.name}</td><td className="p-3"><button onClick={() => onSelectIssue(i)} className="text-indigo-600 text-left hover:underline">#{i.id} {i.subject}</button></td><td className="p-3">{i.tracker.name}</td><td className="p-3">{Number(e.hours).toFixed(2)}</td><td className="p-3">{e.comments || '—'}</td></tr>)}</tbody></table></div>
      </>}
    </>}
  </div>;
}
