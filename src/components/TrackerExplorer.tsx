import React, { useEffect, useState } from 'react';
import { getIssues, getIssueDetail } from '../services/redmineApi';
import type { RedmineIssue, RedmineTracker } from '../types/redmine';

export function TrackerExplorer({ trackers, projectId, baseUrl, onSelectIssue }: { trackers: RedmineTracker[]; projectId: string; baseUrl: string; onSelectIssue: (issue: RedmineIssue) => void }) {
  const [trackerId, setTrackerId] = useState('');
  const [issues, setIssues] = useState<RedmineIssue[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  const activeId = trackerId || String(trackers[0]?.id || '');
  const tracker = trackers.find(t => String(t.id) === activeId);
  useEffect(() => { setPage(0); }, [projectId]);
  useEffect(() => {
    if (!activeId) return;
    let cancelled = false;
    setLoading(true); setIssues([]); setTotal(0); setError('');
    (async () => {
      const res = await getIssues({ project_id: projectId, tracker_id: activeId, status_id: '*', limit: 10, offset: page * 10, sort: 'updated_on:desc,id:desc' });
      const details = await Promise.all(res.issues.map(i => getIssueDetail(i.id)));
      if (!cancelled) { setIssues(details); setTotal(res.total_count); }
    })().catch(e => { if (!cancelled) setError(e.message || 'Không thể đọc tracker.'); }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [activeId, projectId, page, reload, baseUrl]);
  const fields = [...new Map(issues.flatMap(i => (i.custom_fields || []).map(f => [f.id, f] as const))).values()];
  return <div className="space-y-5">
    <div className="flex justify-between items-start gap-3"><div><h2 className="font-bold text-lg">Chi tiết từng tracker</h2><p className="text-sm text-slate-500">Đọc trực tiếp issue và trường dữ liệu Redmine trong dự án đang chọn, gồm cả issue đóng.</p></div><button onClick={() => setReload(n => n + 1)} disabled={loading} className="px-3 py-2 border rounded-lg text-sm">Tải lại</button></div>
    <div className="flex flex-wrap gap-2">{trackers.map(t => <button key={t.id} onClick={() => { setTrackerId(String(t.id)); setPage(0); }} className={`px-3 py-2 rounded-lg border text-sm ${activeId === String(t.id) ? 'bg-indigo-50 border-indigo-300 text-indigo-700 font-semibold' : 'bg-white border-slate-200'}`}>{t.name}</button>)}</div>
    {tracker && <div className="p-4 bg-white border border-slate-200 rounded-xl"><h3 className="font-bold">{tracker.name} (#{tracker.id})</h3><p className="text-sm mt-2 whitespace-pre-wrap">{tracker.description || 'Redmine chưa cung cấp mô tả tracker.'}</p>{tracker.default_status && <p className="text-xs text-slate-500 mt-2">Trạng thái mặc định: {tracker.default_status.name}</p>}</div>}
    {error && <p role="alert" className="p-4 bg-rose-50 text-rose-700 rounded-lg">{error}</p>}
    {loading ? <p role="status" className="p-8 text-center text-slate-500">Đang đọc chi tiết issue của tracker…</p> : !error && <>
      <div className="flex flex-wrap justify-between gap-3"><p className="font-semibold">{total} issue · Trang {page + 1}/{Math.max(1, Math.ceil(total / 10))}</p><div className="flex gap-2"><button disabled={!page} onClick={() => setPage(p => p - 1)} className="border rounded px-3 py-1 disabled:opacity-40">Trước</button><button disabled={(page + 1) * 10 >= total} onClick={() => setPage(p => p + 1)} className="border rounded px-3 py-1 disabled:opacity-40">Sau</button></div></div>
      <div className="bg-slate-100 rounded-lg p-4 text-sm"><p className="font-semibold">Trường tùy chỉnh xuất hiện trên {issues.length} issue của trang này</p><p className="mt-1">{fields.length ? fields.map(f => `${f.name} (#${f.id})`).join(', ') : 'Không có trường tùy chỉnh trong dữ liệu trang này.'}</p></div>
      {!issues.length && <p className="p-6 text-center text-slate-500">Tracker chưa có issue trong phạm vi dự án này.</p>}
      {issues.map(i => <article key={i.id} className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex justify-between gap-3"><button onClick={() => onSelectIssue(i)} className="font-semibold text-indigo-600 text-left hover:underline">#{i.id} {i.subject}</button><a href={`${baseUrl.replace(/\/+$/, '')}/issues/${i.id}`} target="_blank" rel="noreferrer" className="text-xs text-slate-500 whitespace-nowrap hover:underline">Mở Redmine</a></div>
        <p className="text-xs text-slate-500">{i.project.name} · {i.status.name} · {i.assigned_to?.name || 'Chưa giao'} · Tiến độ {i.done_ratio}% · Ước tính {i.estimated_hours ?? '—'} giờ · Đã log {i.spent_hours ?? '—'} giờ</p>
        <p className="text-sm text-slate-700 whitespace-pre-wrap max-h-48 overflow-auto">{i.description || 'Không có mô tả.'}</p>
        {!!i.custom_fields?.length && <dl className="grid sm:grid-cols-2 gap-2 text-xs">{i.custom_fields.map(f => <div key={f.id} className="bg-slate-50 p-2 rounded"><dt className="font-semibold">{f.name}</dt><dd className="mt-1 whitespace-pre-wrap break-words">{Array.isArray(f.value) ? f.value.join(', ') || '—' : String(f.value ?? '') || '—'}</dd></div>)}</dl>}
      </article>)}
    </>}
  </div>;
}
