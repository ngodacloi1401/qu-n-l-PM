import React, { useEffect, useRef, useState } from 'react';
import { Send, Plus, Sparkles, RefreshCw } from 'lucide-react';
import type { RedmineIssue, RedmineProject, RedmineStatus } from '../types/redmine';
import { AVAILABLE_AI_MODELS, askGeminiChat, getAvailableAIModels, getStoredConfig } from '../services/redmineApi';
import type { ChatMessage, ChatScope } from '../services/aiPayload';
import { cacheScope, readLocalCache, writeLocalCache } from '../services/localCache';

interface Session { id: string; title: string; messages: ChatMessage[] }
interface SessionStore { sessions: Session[]; activeId: string }
const newSession = (): Session => ({ id: crypto.randomUUID(), title: 'Phiên mới', messages: [] });
const MODEL_KEY = 'redmine_ai_model';
const savedModel = () => localStorage.getItem(MODEL_KEY) || 'gemini-2.5-flash';

export function AICopilotView({ issues, statuses, selectedProject, projectId, totalAvailable, isDataLoading, scope }: {
  issues: RedmineIssue[]; statuses: RedmineStatus[]; selectedProject: RedmineProject | undefined; projectId: string; totalAvailable: number; isDataLoading: boolean; scope: ChatScope;
}) {
  const [model, setModel] = useState(savedModel);
  const [custom, setCustom] = useState(() => AVAILABLE_AI_MODELS.some(m => m.id === savedModel()) ? '' : savedModel());
  const [customMode, setCustomMode] = useState(() => !AVAILABLE_AI_MODELS.some(m => m.id === savedModel()));
  const [modelOptions, setModelOptions] = useState(AVAILABLE_AI_MODELS);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsSource, setModelsSource] = useState<'api' | 'fallback'>('fallback');
  const [store, setStore] = useState<SessionStore>({ sessions: [], activeId: '' });
  const [storageKey, setStorageKey] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  const alive = useRef(true);
  const bottom = useRef<HTMLDivElement>(null);
  const active = store.sessions.find(s => s.id === store.activeId);
  const activeModel = customMode ? custom.trim() : model;

  const loadModels = async () => {
    setModelsLoading(true);
    try {
      const available = await getAvailableAIModels();
      if (available.length) {
        setModelOptions(available);
        setModelsSource('api');
        const current = customMode ? custom.trim() : model;
        if (available.some(item => item.id === current)) { setModel(current); setCustomMode(false); }
      }
    } catch { setModelOptions(AVAILABLE_AI_MODELS); setModelsSource('fallback'); }
    finally { setModelsLoading(false); }
  };

  useEffect(() => { void loadModels(); }, []);

  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    (async () => {
      const config = getStoredConfig();
      const key = `${await cacheScope(config.baseUrl, config.apiKey)}:ai-sessions:${projectId}`;
      const saved = await readLocalCache<SessionStore>(key);
      if (cancelled) return;
      if (saved?.sessions?.length) setStore({ sessions: saved.sessions, activeId: saved.sessions.some(s => s.id === saved.activeId) ? saved.activeId : saved.sessions[0].id });
      else { const session = newSession(); setStore({ sessions: [session], activeId: session.id }); }
      setStorageKey(key);
    })().catch(() => { if (!cancelled) setError('Không thể mở phiên AI. Hãy tải lại trang.'); });
    return () => { cancelled = true; alive.current = false; };
  }, [projectId]);
  useEffect(() => { if (storageKey && store.sessions.length) void writeLocalCache(storageKey, store); }, [storageKey, store]);
  useEffect(() => { if (activeModel) localStorage.setItem(MODEL_KEY, activeModel); }, [activeModel]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [active?.messages.length, busy]);

  const submit = async (text: string, retry = false) => {
    if (lock.current || isDataLoading || !active || !storageKey || !text.trim()) return;
    if (!activeModel) { setError('Nhập mã model AI trước khi gửi.'); return; }
    lock.current = true; setBusy(true); setError('');
    const messages: ChatMessage[] = retry ? active.messages : [...active.messages, { role: 'user', text: text.trim().slice(0, 4000) }];
    const sessionId = active.id;
    const pending = { ...store, sessions: store.sessions.map(s => s.id === sessionId ? { ...s, title: s.messages.length ? s.title : text.trim().slice(0, 60), messages } : s) };
    setStore(pending); if (!retry) setDraft('');
    await writeLocalCache(storageKey, pending);
    try {
      const response = await askGeminiChat(messages, selectedProject?.name || 'Tất cả dự án', issues, statuses, totalAvailable, activeModel, scope);
      const answer: ChatMessage = { role: 'assistant', text: response.result, model: response.usedModel || activeModel };
      const latest = await readLocalCache<SessionStore>(storageKey) || pending;
      const existing = latest.sessions.find(s => s.id === sessionId);
      if (JSON.stringify(existing?.messages) === JSON.stringify(messages)) {
        const completed = { ...latest, sessions: latest.sessions.map(s => s.id === sessionId ? { ...s, messages: [...messages, answer] } : s) };
        await writeLocalCache(storageKey, completed);
        if (alive.current) setStore(completed);
      }
    } catch (e: any) { if (alive.current) setError(e.message || 'Không thể nhận phản hồi AI.'); }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  };

  return <div className="space-y-4">
    <div className="bg-slate-900 text-white rounded-xl p-5 flex flex-wrap items-end justify-between gap-4">
      <div><h2 className="font-bold flex items-center gap-2"><Sparkles className="w-5 h-5" />AI PM · Chat theo phiên</h2><p className="text-xs text-slate-300 mt-2">{selectedProject?.name || 'Tất cả dự án'} · AI sử dụng toàn bộ {issues.length}/{totalAvailable} công việc của dự án.{isDataLoading ? ' Đang đồng bộ dữ liệu…' : (scope.loadedCount ?? issues.length) < totalAvailable ? ' Hãy chờ tải đủ dữ liệu trước khi hỏi.' : ''}</p></div>
      <div className="space-y-2 w-full sm:w-64">
        <div className="flex items-center justify-between"><label htmlFor="ai-model-select" className="text-xs">Model AI</label><button type="button" onClick={() => void loadModels()} disabled={busy || modelsLoading} className="text-[11px] text-slate-300 hover:text-white disabled:opacity-40"><RefreshCw className={`inline w-3 h-3 mr-1 ${modelsLoading ? 'animate-spin' : ''}`} />Cập nhật</button></div>
        <select id="ai-model-select" value={customMode ? 'custom' : model} disabled={busy} onChange={e => { setCustomMode(e.target.value === 'custom'); if (e.target.value !== 'custom') setModel(e.target.value); }} className="block w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm">
          {modelOptions.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}<option value="custom">Nhập mã Model khác</option>
        </select>
        {customMode && <input aria-label="Mã model AI tùy chỉnh" value={custom} onChange={e => setCustom(e.target.value)} disabled={busy} className="w-full bg-slate-800 border border-slate-600 rounded-lg p-2 text-sm" placeholder="vd: gemini-2.5-flash" />}
        <p className="text-[11px] text-slate-400">{modelsSource === 'api' ? 'Danh sách theo quyền của Gemini API Key hiện tại.' : 'Đang dùng danh sách dự phòng; vẫn có thể nhập mã model khác.'}</p>
      </div>
    </div>
    <div className="flex flex-wrap gap-2 items-center">
      <label htmlFor="ai-session-select" className="text-sm">Phiên làm việc</label>
      <select id="ai-session-select" value={store.activeId} disabled={busy || !storageKey} onChange={e => { setStore(s => ({ ...s, activeId: e.target.value })); setError(''); setDraft(''); }} className="border border-slate-300 bg-white rounded-lg p-2 text-sm max-w-xs">
        {store.sessions.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
      </select>
      <button disabled={busy || !storageKey} onClick={() => { const session = newSession(); setStore(s => ({ sessions: [session, ...s.sessions], activeId: session.id })); setError(''); setDraft(''); }} className="border border-slate-300 rounded-lg px-3 py-2 text-sm bg-white disabled:opacity-40"><Plus className="w-4 h-4 inline mr-1" />Phiên mới</button>
    </div>
    <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
      <div role="log" aria-label="Lịch sử chat AI" aria-live="polite" className="p-4 space-y-4 max-h-[60vh] min-h-64 overflow-auto">
        {!active?.messages.length && <p className="text-sm text-slate-500">Hỏi về tiến độ, công việc quá hạn, phân công hoặc một issue cụ thể như #40730. Bạn có thể hỏi tiếp dựa trên câu trả lời trước.</p>}
        {active?.messages.map((m, index) => <div key={index} className={`rounded-xl p-3 text-sm whitespace-pre-wrap ${m.role === 'user' ? 'bg-indigo-50 ml-6' : 'bg-slate-50 mr-6'}`}>
          <p className="text-xs font-semibold text-slate-500 mb-2">{m.role === 'user' ? 'Bạn' : `AI · ${m.model || 'Gemini'}`}</p>{m.text}
        </div>)}
        {busy && <p role="status" className="text-sm text-indigo-600">AI đang trả lời…</p>}<div ref={bottom} />
      </div>
      <div className="border-t border-slate-200 p-4 space-y-3">
        {error && <div role="alert" className="text-sm text-rose-700 bg-rose-50 rounded-lg p-3">{error}{active?.messages.at(-1)?.role === 'user' && <button disabled={busy} onClick={() => submit(active.messages.at(-1)!.text, true)} className="ml-3 underline">Thử lại</button>}</div>}
        <div className="flex flex-wrap gap-2">{['Tổng hợp Standup hôm nay', 'Phân tích rủi ro và issue quá hạn', 'Đề xuất hành động tiếp theo cho PM'].map(text => <button key={text} disabled={busy || isDataLoading || !storageKey} onClick={() => submit(text)} className="text-xs border border-slate-200 rounded-full px-3 py-1.5 text-slate-600 disabled:opacity-40">{text}</button>)}</div>
        <form onSubmit={e => { e.preventDefault(); void submit(draft); }} className="flex gap-2 items-end">
          <textarea aria-label="Tin nhắn cho AI" value={draft} onChange={e => setDraft(e.target.value)} maxLength={4000} disabled={busy || !storageKey} rows={3} placeholder="Nhập câu hỏi hoặc yêu cầu báo cáo…" onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); void submit(draft); } }} className="flex-1 min-w-0 border border-slate-300 rounded-lg p-3 text-sm" />
          <button type="submit" disabled={busy || isDataLoading || !storageKey || !draft.trim()} className="bg-indigo-600 text-white rounded-lg px-4 py-3 text-sm disabled:opacity-40"><Send className="w-4 h-4 inline mr-1" />Gửi</button>
        </form>
        <p className="text-xs text-slate-500">Phiên lưu trên trình duyệt, riêng theo dự án và kết nối Redmine. Mỗi câu hỏi gửi thống kê và danh sách nén của toàn bộ issue trong dự án, cùng chi tiết các issue liên quan. Shift + Enter để xuống dòng.</p>
      </div>
    </div>
  </div>;
}
