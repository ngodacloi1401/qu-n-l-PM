import React, { useEffect, useRef, useState } from 'react';
import { Send, Plus, Sparkles, RefreshCw, Bot, MessageSquare, Trash2, Square, Database, Copy, Check, Download, FileText, FileSpreadsheet, Pencil, X, KeyRound, Brain } from 'lucide-react';
import type { RedmineIssue, RedmineProject, RedmineStatus } from '../types/redmine';
import { FALLBACK_AI_MODELS, askAIChat, getAvailableAIModels, getStoredConfig, type AIProvider } from '../services/redmineApi';
import { detectGoogleWorkspaceCreate, type ChatMessage, type ChatScope, type ReasoningEffort } from '../services/aiPayload';
import { cacheScope, readLocalCache, writeLocalCache } from '../services/localCache';
import { downloadAnswerAsDocx, downloadChatArtifact, ensureRequestedChatArtifacts } from '../services/chatArtifacts';

interface Session { id: string; title: string; messages: ChatMessage[] }
interface SessionStore { sessions: Session[]; activeId: string }
const newSession = (): Session => ({ id: crypto.randomUUID(), title: 'Phiên mới', messages: [] });
const upgradeSessionArtifacts = (session: Session): Session => ({
  ...session,
  messages: session.messages.map((message, index, messages) => {
    if (message.role !== 'assistant' || message.artifacts?.length || messages[index - 1]?.role !== 'user') return message;
    const parsed = ensureRequestedChatArtifacts(messages[index - 1].text, message.text);
    return parsed.artifacts.length ? { ...message, text: parsed.text, artifacts: parsed.artifacts } : message;
  }),
});
const PROVIDER_KEY = 'redmine_ai_provider';
const PROVIDERS: Array<{ id: AIProvider; name: string }> = [
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'openai', name: 'OpenAI / ChatGPT' },
  { id: 'codex', name: 'OpenAI Codex' },
  { id: 'anthropic', name: 'Anthropic / Claude' },
];
const savedProvider = (): AIProvider => {
  const value = localStorage.getItem(PROVIDER_KEY);
  return value === 'openai' || value === 'codex' || value === 'anthropic' ? value : 'gemini';
};
const savedModel = (provider: AIProvider) => localStorage.getItem(`redmine_ai_model_${provider}`)
  || (provider === 'gemini' ? localStorage.getItem('redmine_ai_model') : '')
  || FALLBACK_AI_MODELS[provider].find(item => item.isDefault)?.id
  || FALLBACK_AI_MODELS[provider][0].id;
const EFFORTS: Array<{ id: ReasoningEffort; name: string; description: string }> = [
  { id: 'minimal', name: 'Tối thiểu', description: 'Phản hồi nhanh nhất' },
  { id: 'low', name: 'Thấp', description: 'Suy luận nhẹ, ưu tiên tốc độ' },
  { id: 'medium', name: 'Trung bình', description: 'Cân bằng tốc độ và chất lượng' },
  { id: 'high', name: 'Cao', description: 'Suy luận sâu nhất' },
];
const savedEffort = (provider: AIProvider): ReasoningEffort => {
  const value = localStorage.getItem(`redmine_ai_effort_${provider}`);
  return value === 'minimal' || value === 'medium' || value === 'high' ? value : 'low';
};

const QUICK_PROMPTS = [
  { title: 'Tóm tắt tiến độ', text: 'Tóm tắt tiến độ dự án hiện tại, các việc đang làm và các điểm PM cần chú ý.' },
  { title: 'Rủi ro và quá hạn', text: 'Phân tích các công việc quá hạn, bị chặn và rủi ro chính. Đề xuất thứ tự xử lý.' },
  { title: 'Phân bổ nguồn lực', text: 'Phân tích khối lượng công việc theo thành viên và đề xuất cách cân bằng nguồn lực.' },
  { title: 'Kế hoạch hành động', text: 'Đề xuất kế hoạch hành động cụ thể tiếp theo cho PM dựa trên toàn bộ dữ liệu dự án.' },
];

function MessageBody({ text }: { text: string }) {
  const parts = text.split('```');
  return <div className="space-y-3 leading-7">
    {parts.map((part, index) => index % 2
      ? <pre key={index} className="overflow-x-auto rounded-xl bg-slate-950 text-slate-100 p-4 text-xs leading-6"><code>{part.replace(/^\w+\n/, '')}</code></pre>
      : <div key={index} className="whitespace-pre-wrap">{part}</div>)}
  </div>;
}

const messageTime = (value?: string) => value
  ? new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
  : '';

export function AICopilotView({ issues, statuses, selectedProject, projectId, totalAvailable, isDataLoading, scope, configRevision, onOpenSettings }: {
  issues: RedmineIssue[]; statuses: RedmineStatus[]; selectedProject: RedmineProject | undefined; projectId: string; totalAvailable: number; isDataLoading: boolean; scope: ChatScope; configRevision: number; onOpenSettings: () => void;
}) {
  const [provider, setProvider] = useState<AIProvider>(savedProvider);
  const initialModel = savedModel(savedProvider());
  const [model, setModel] = useState(initialModel);
  const [custom, setCustom] = useState(() => FALLBACK_AI_MODELS[savedProvider()].some(m => m.id === initialModel) ? '' : initialModel);
  const [customMode, setCustomMode] = useState(() => !FALLBACK_AI_MODELS[savedProvider()].some(m => m.id === initialModel));
  const [modelOptions, setModelOptions] = useState(FALLBACK_AI_MODELS[savedProvider()]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsSource, setModelsSource] = useState<'api' | 'fallback'>('fallback');
  const [modelNotice, setModelNotice] = useState('');
  const [store, setStore] = useState<SessionStore>({ sessions: [], activeId: '' });
  const [storageKey, setStorageKey] = useState('');
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [busySessionId, setBusySessionId] = useState('');
  const [error, setError] = useState('');
  const [sessionErrors, setSessionErrors] = useState<Record<string, string>>({});
  const [copiedMessage, setCopiedMessage] = useState<number | null>(null);
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [downloading, setDownloading] = useState('');
  const [actionNotice, setActionNotice] = useState('');
  const [streamingText, setStreamingText] = useState('');
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(() => savedEffort(savedProvider()));
  const [effortMenuOpen, setEffortMenuOpen] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  const abortRef = useRef<AbortController | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const active = store.sessions.find(s => s.id === store.activeId);
  const activeModel = customMode ? custom.trim() : model;

  const loadModels = async (targetProvider: AIProvider = provider, targetModel = activeModel, targetCustomMode = customMode) => {
    setModelsLoading(true);
    setModelNotice('');
    try {
      const available = await getAvailableAIModels(targetProvider);
      if (available.length) {
        setModelOptions(available);
        setModelsSource('api');
        const current = targetModel;
        if (available.some(item => item.id === current)) { setModel(current); setCustomMode(false); }
        else if (!targetCustomMode) {
          const saved = savedModel(targetProvider);
          const next = available.find(item => item.id === saved) || available[0];
          setModel(next.id); setModelNotice(`Model cũ không khả dụng với API key. Đã chuyển sang ${next.name}.`);
        }
      }
    } catch (error: any) {
      setModelOptions(FALLBACK_AI_MODELS[targetProvider]); setModelsSource('fallback');
      setModelNotice(error?.message || 'Không thể tải danh sách model. Kiểm tra API key trong Cài đặt.');
    }
    finally { setModelsLoading(false); }
  };

  useEffect(() => {
    const nextModel = savedModel(provider);
    const fallback = FALLBACK_AI_MODELS[provider];
    setModel(nextModel);
    setCustom(fallback.some(item => item.id === nextModel) ? '' : nextModel);
    setCustomMode(!fallback.some(item => item.id === nextModel));
    setModelOptions(fallback);
    setModelsSource('fallback');
    setReasoningEffort(savedEffort(provider));
    setEffortMenuOpen(false);
    localStorage.setItem(PROVIDER_KEY, provider);
    void loadModels(provider, nextModel, !fallback.some(item => item.id === nextModel));
  }, [provider, configRevision]);

  useEffect(() => {
    let cancelled = false;
    alive.current = true;
    (async () => {
      const config = getStoredConfig();
      const key = `${await cacheScope(config.baseUrl, config.apiKey)}:ai-sessions:${projectId}`;
      const saved = await readLocalCache<SessionStore>(key);
      if (cancelled) return;
      if (saved?.sessions?.length) {
        const sessions = saved.sessions.map(upgradeSessionArtifacts);
        setStore({ sessions, activeId: sessions.some(s => s.id === saved.activeId) ? saved.activeId : sessions[0].id });
      }
      else { const session = newSession(); setStore({ sessions: [session], activeId: session.id }); }
      setStorageKey(key);
    })().catch(() => { if (!cancelled) setError('Không thể mở phiên AI. Hãy tải lại trang.'); });
    return () => { cancelled = true; alive.current = false; };
  }, [projectId]);
  useEffect(() => { if (storageKey && store.sessions.length) void writeLocalCache(storageKey, store); }, [storageKey, store]);
  useEffect(() => { if (activeModel) localStorage.setItem(`redmine_ai_model_${provider}`, activeModel); }, [activeModel, provider]);
  useEffect(() => { localStorage.setItem(`redmine_ai_effort_${provider}`, reasoningEffort); }, [provider, reasoningEffort]);
  useEffect(() => { bottom.current?.scrollIntoView({ block: 'nearest' }); }, [active?.messages.length, busy]);
  useEffect(() => {
    if (!textareaRef.current) return;
    textareaRef.current.style.height = '0px';
    textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 180)}px`;
  }, [draft]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const submit = async (text: string, retry = false) => {
    if (lock.current || isDataLoading || !active || !storageKey || !text.trim()) return;
    if (!activeModel) { setError('Nhập mã model AI trước khi gửi.'); return; }
    const workspaceTarget = retry ? null : detectGoogleWorkspaceCreate(text);
    if (workspaceTarget) {
      const opened = window.open(workspaceTarget.url, '_blank');
      if (opened) {
        opened.opener = null;
        setActionNotice(`Đã tạo ${workspaceTarget.name} trong tab mới. AI đang soạn nội dung cho tệp.`);
      } else {
        setActionNotice(`Trình duyệt đã chặn tab ${workspaceTarget.name}. Hãy cho phép cửa sổ bật lên rồi gửi lại yêu cầu.`);
      }
    } else setActionNotice('');
    lock.current = true; setBusy(true); setBusySessionId(active.id); setStreamingText(''); setError('');
    const controller = new AbortController();
    abortRef.current = controller;
    const userMessage: ChatMessage = { role: 'user', text: text.trim().slice(0, 4000), createdAt: new Date().toISOString() };
    const messages: ChatMessage[] = retry
      ? active.messages
      : editingMessageIndex === null
        ? [...active.messages, userMessage]
        : [...active.messages.slice(0, editingMessageIndex), userMessage];
    const sessionId = active.id;
    setSessionErrors(current => ({ ...current, [sessionId]: '' }));
    const pending = { ...store, sessions: store.sessions.map(s => s.id === sessionId ? { ...s, title: s.messages.length ? s.title : text.trim().slice(0, 60), messages } : s) };
    setStore(pending); if (!retry) { setDraft(''); setEditingMessageIndex(null); }
    await writeLocalCache(storageKey, pending);
    try {
      const response = await askAIChat(provider, messages, selectedProject?.name || 'Tất cả dự án', issues, statuses, totalAvailable, activeModel, { ...scope, availableModels: modelsSource === 'api' ? modelOptions.map(item => item.id) : [] }, controller.signal, partial => {
        if (alive.current) setStreamingText(partial);
      }, reasoningEffort);
      if (response.fallbackOccurred && response.usedModel) {
        const option = modelOptions.find(item => item.id === response.usedModel);
        setModel(response.usedModel); setCustomMode(!option); if (!option) setCustom(response.usedModel);
        setModelNotice(`Model ${activeModel} không dùng được. Hệ thống đã chuyển sang ${option?.name || response.usedModel}.`);
      }
      const parsed = ensureRequestedChatArtifacts(messages.at(-1)?.text || text, response.result);
      const answer: ChatMessage = { role: 'assistant', text: parsed.text, model: response.usedModel || activeModel, artifacts: parsed.artifacts, createdAt: new Date().toISOString() };
      const latest = await readLocalCache<SessionStore>(storageKey) || pending;
      const existing = latest.sessions.find(s => s.id === sessionId);
      if (JSON.stringify(existing?.messages) === JSON.stringify(messages)) {
        const completed = { ...latest, sessions: latest.sessions.map(s => s.id === sessionId ? { ...s, messages: [...messages, answer] } : s) };
        await writeLocalCache(storageKey, completed);
        if (alive.current) setStore(completed);
      }
    } catch (e: any) {
      if (alive.current && e?.name !== 'AbortError') setSessionErrors(current => ({ ...current, [sessionId]: e.message || 'Không thể nhận phản hồi AI.' }));
    }
    finally { abortRef.current = null; lock.current = false; if (alive.current) { setBusy(false); setBusySessionId(''); setStreamingText(''); } }
  };

  const createNewSession = () => {
    const session = newSession();
    setStore(current => ({ sessions: [session, ...current.sessions], activeId: session.id }));
    setError('');
    setDraft('');
    setEditingMessageIndex(null);
    setActionNotice('');
  };

  const deleteSession = (sessionId: string) => {
    if (!window.confirm('Xóa phiên trò chuyện này?')) return;
    setStore(current => {
      const remaining = current.sessions.filter(session => session.id !== sessionId);
      if (!remaining.length) {
        const session = newSession();
        return { sessions: [session], activeId: session.id };
      }
      return { sessions: remaining, activeId: current.activeId === sessionId ? remaining[0].id : current.activeId };
    });
    setError('');
    setDraft('');
    setEditingMessageIndex(null);
    setActionNotice('');
  };

  const copyMessage = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMessage(index);
      window.setTimeout(() => setCopiedMessage(current => current === index ? null : current), 1500);
    } catch {
      setError('Không thể sao chép tin nhắn trên trình duyệt này.');
    }
  };

  const editMessage = (index: number) => {
    const message = active?.messages[index];
    if (!message || message.role !== 'user') return;
    setDraft(message.text);
    setEditingMessageIndex(index);
    setError('');
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const downloadArtifact = async (key: string, action: () => Promise<void>) => {
    if (downloading) return;
    setDownloading(key);
    setError('');
    try { await action(); }
    catch (error: any) { setError(error?.message || 'Không thể tạo tệp để tải xuống.'); }
    finally { setDownloading(''); }
  };

  const activeBusy = busy && busySessionId === active?.id;
  const visibleError = (active?.id && sessionErrors[active.id]) || error;

  return <div className="h-full min-h-0 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex">
    <aside className="hidden lg:flex min-h-0 w-64 shrink-0 bg-slate-950 text-white flex-col border-r border-slate-800 overflow-hidden">
      <div className="p-3 border-b border-slate-800">
        <button onClick={createNewSession} disabled={!storageKey} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-white text-slate-900 px-3 py-2.5 text-sm font-semibold hover:bg-slate-100 disabled:opacity-40">
          <Plus className="w-4 h-4" />Cuộc trò chuyện mới
        </button>
      </div>
      <div className="px-3 pt-4 pb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Lịch sử trò chuyện</div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-3 space-y-1">
        {store.sessions.map(session => <div key={session.id} className={`group flex items-center rounded-lg ${session.id === store.activeId ? 'bg-slate-800' : 'hover:bg-slate-900'}`}>
          <button onClick={() => { setStore(current => ({ ...current, activeId: session.id })); setError(''); setDraft(''); setEditingMessageIndex(null); }} className="flex-1 min-w-0 flex items-center gap-2 px-3 py-2.5 text-left text-sm">
            {busySessionId === session.id ? <RefreshCw className="w-4 h-4 shrink-0 text-indigo-300 animate-spin" /> : <MessageSquare className="w-4 h-4 shrink-0 text-slate-400" />}<span className="truncate">{session.title}</span>
          </button>
          <button aria-label={`Xóa ${session.title}`} disabled={busySessionId === session.id} onClick={() => deleteSession(session.id)} className="p-2 mr-1 text-slate-500 hover:text-rose-300 opacity-0 group-hover:opacity-100 focus:opacity-100 disabled:hidden"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>)}
      </div>
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-400 flex items-start gap-2">
        <Database className="w-4 h-4 shrink-0 mt-0.5" /><span>Phiên chat được lưu riêng trên trình duyệt cho dự án này.</span>
      </div>
    </aside>

    <section className="flex-1 min-w-0 min-h-0 flex flex-col bg-white overflow-hidden">
      <header className="min-h-16 px-4 sm:px-5 py-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-sm"><Sparkles className="w-4.5 h-4.5" /></div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-slate-900 truncate">AI PM Copilot</div>
            <div className="text-[11px] text-slate-500 truncate">{selectedProject?.name || 'Tất cả dự án'} · {issues.length}/{totalAvailable} công việc</div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          <select aria-label="Phiên làm việc" value={store.activeId} disabled={!storageKey} onChange={e => { setStore(current => ({ ...current, activeId: e.target.value })); setError(''); setDraft(''); setEditingMessageIndex(null); }} className="lg:hidden max-w-36 border border-slate-200 rounded-lg px-2 py-2 text-xs bg-slate-50">
            {store.sessions.map(session => <option key={session.id} value={session.id}>{session.title}</option>)}
          </select>
          <button onClick={createNewSession} disabled={!storageKey} className="lg:hidden p-2 rounded-lg border border-slate-200 text-slate-600"><Plus className="w-4 h-4" /></button>
          <select id="ai-provider-select" aria-label="Nhà cung cấp AI" value={provider} disabled={busy} onChange={e => setProvider(e.target.value as AIProvider)} className="max-w-40 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700">
            {PROVIDERS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <select id="ai-model-select" aria-label="Model AI" value={customMode ? 'custom' : model} disabled={busy || modelsLoading} onChange={e => { setCustomMode(e.target.value === 'custom'); if (e.target.value !== 'custom') setModel(e.target.value); }} className="max-w-44 bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-2 text-xs font-medium text-slate-700">
            {modelOptions.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}<option value="custom">Model khác…</option>
          </select>
          <div className="relative">
            <button type="button" aria-label="Mức độ suy luận" aria-expanded={effortMenuOpen} disabled={busy} onClick={() => setEffortMenuOpen(value => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-40"><Brain className="h-4 w-4 text-violet-600" />Suy luận {EFFORTS.find(item => item.id === reasoningEffort)?.name}</button>
            {effortMenuOpen && <div className="absolute right-0 top-full z-30 mt-2 w-64 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
              {EFFORTS.map(item => <button key={item.id} type="button" onClick={() => { setReasoningEffort(item.id); setEffortMenuOpen(false); }} className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left hover:bg-violet-50 ${reasoningEffort === item.id ? 'bg-violet-50' : ''}`}><span><span className="block text-sm font-semibold text-slate-800">{item.name}</span><span className="block text-[11px] text-slate-500">{item.description}</span></span>{reasoningEffort === item.id && <Check className="h-4 w-4 text-violet-600" />}</button>)}
            </div>}
          </div>
          <button type="button" aria-label="Cập nhật danh sách model" title="Cập nhật danh sách model" onClick={() => void loadModels()} disabled={busy || modelsLoading} className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-40"><RefreshCw className={`w-4 h-4 ${modelsLoading ? 'animate-spin' : ''}`} /></button>
        </div>
      </header>

      {(customMode || modelNotice || isDataLoading) && <div className="px-4 sm:px-6 py-2 border-b border-slate-100 bg-slate-50 flex flex-wrap items-center gap-2">
        {customMode && <input aria-label="Mã model AI tùy chỉnh" value={custom} onChange={e => setCustom(e.target.value)} disabled={busy} className="min-w-56 flex-1 max-w-md bg-white border border-slate-300 rounded-lg px-3 py-2 text-xs" placeholder={provider === 'gemini' ? 'vd: gemini-2.5-flash' : provider === 'codex' ? 'vd: gpt-5.3-codex' : provider === 'openai' ? 'vd: gpt-6-astra' : 'vd: claude-sonnet-5'} />}
        {modelNotice && <><span role="status" className="text-xs text-amber-700">{modelNotice}</span><button type="button" onClick={onOpenSettings} className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-amber-800 hover:bg-amber-50"><KeyRound className="h-3.5 w-3.5" />Cấu hình API key</button></>}
        {isDataLoading && <span role="status" className="text-xs text-indigo-700 flex items-center gap-1.5"><RefreshCw className="w-3.5 h-3.5 animate-spin" />Đang chuẩn bị đầy đủ dữ liệu dự án…</span>}
      </div>}

      <div role="log" aria-label="Lịch sử chat AI" aria-live="polite" className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white">
        {!storageKey && <div className="h-full flex items-center justify-center text-sm text-slate-500"><RefreshCw className="w-4 h-4 animate-spin mr-2" />Đang mở phiên trò chuyện…</div>}
        {storageKey && !active?.messages.length && <div className="h-full max-w-3xl mx-auto px-5 py-10 flex flex-col justify-center">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-indigo-200 mb-5"><Bot className="w-6 h-6" /></div>
          <h2 className="text-2xl font-semibold text-slate-900">Tôi có thể hỗ trợ gì cho dự án?</h2>
          <p className="text-sm text-slate-500 mt-2 max-w-xl">Hỏi về tiến độ, quá hạn, phân công nguồn lực hoặc một issue cụ thể. AI sử dụng toàn bộ dữ liệu đã tải của dự án và ghi nhớ nội dung trong phiên này.</p>
          <div className="grid sm:grid-cols-2 gap-3 mt-7">
            {QUICK_PROMPTS.map(prompt => <button key={prompt.title} disabled={busy || isDataLoading} onClick={() => void submit(prompt.text)} className="text-left rounded-xl border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/40 transition-colors disabled:opacity-40">
              <div className="text-sm font-semibold text-slate-800">{prompt.title}</div><div className="text-xs text-slate-500 mt-1 line-clamp-2">{prompt.text}</div>
            </button>)}
          </div>
        </div>}

        {!!active?.messages.length && <div className="max-w-3xl mx-auto px-4 sm:px-6 py-7 space-y-7">
          {active.messages.map((message, index) => message.role === 'user'
            ? <div key={index} className="flex justify-end pl-10"><div className="max-w-[85%]">
                <div className="rounded-2xl rounded-br-md bg-slate-900 text-white px-4 py-3 text-sm"><MessageBody text={message.text} /></div>
                <div className="mt-1.5 flex items-center justify-end gap-2 text-[11px] text-slate-400">
                  {messageTime(message.createdAt) && <span>{messageTime(message.createdAt)}</span>}
                  <button type="button" title="Sao chép tin nhắn" aria-label="Sao chép tin nhắn" onClick={() => void copyMessage(message.text, index)} className="rounded-md p-1 hover:bg-slate-100 hover:text-slate-700">{copiedMessage === index ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}</button>
                  <button type="button" title="Chỉnh sửa và gửi lại từ đây" aria-label="Chỉnh sửa tin nhắn" disabled={activeBusy} onClick={() => editMessage(index)} className="rounded-md p-1 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"><Pencil className="w-3.5 h-3.5" /></button>
                </div>
              </div></div>
            : <div key={index} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></div>
                <div className="min-w-0 flex-1 text-sm text-slate-800">
                  <div className="text-xs font-semibold text-slate-500 mb-2">AI PM <span className="font-normal">· {message.model || activeModel}</span></div>
                  <MessageBody text={message.text} />
                  {!!message.artifacts?.length && <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {message.artifacts.map(artifact => <button key={artifact.id} type="button" disabled={!!downloading} onClick={() => void downloadArtifact(artifact.id, () => downloadChatArtifact(artifact))} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-left hover:border-indigo-300 hover:bg-indigo-50 disabled:opacity-50">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-indigo-600 border border-slate-200">{artifact.kind === 'xlsx' ? <FileSpreadsheet className="w-4.5 h-4.5" /> : <FileText className="w-4.5 h-4.5" />}</span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-800">{artifact.title || artifact.name}</span><span className="block truncate text-[11px] text-slate-500">{artifact.name}</span></span>
                      {downloading === artifact.id ? <RefreshCw className="w-4 h-4 shrink-0 animate-spin text-indigo-600" /> : <Download className="w-4 h-4 shrink-0 text-slate-400 group-hover:text-indigo-600" />}
                    </button>)}
                  </div>}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <button type="button" onClick={() => void copyMessage(message.text, index)} className="inline-flex items-center gap-1 hover:text-slate-700">{copiedMessage === index ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}{copiedMessage === index ? 'Đã sao chép' : 'Sao chép'}</button>
                    <button type="button" disabled={!!downloading} onClick={() => void downloadArtifact(`answer-${index}`, () => downloadAnswerAsDocx(message.text, `tra-loi-ai-${index + 1}.docx`))} className="inline-flex items-center gap-1 hover:text-indigo-700 disabled:opacity-50">{downloading === `answer-${index}` ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}Tải câu trả lời .docx</button>
                  </div>
                </div>
              </div>)}
          {activeBusy && <div role="status" className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white flex items-center justify-center shrink-0"><Bot className="w-4 h-4" /></div>
            {streamingText
              ? <div className="min-w-0 flex-1 text-sm text-slate-800"><div className="text-xs font-semibold text-slate-500 mb-2">AI PM <span className="font-normal">· {activeModel} · đang trả lời</span></div><MessageBody text={streamingText} /></div>
              : <div className="flex items-center gap-1.5 pt-3"><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" /><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:120ms]" /><span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce [animation-delay:240ms]" /></div>}
          </div>}
          <div ref={bottom} />
        </div>}
      </div>

      <footer className="border-t border-slate-200 bg-white px-3 sm:px-5 py-3">
        <div className="max-w-3xl mx-auto">
          {visibleError && <div role="alert" className="mb-2 text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5">{visibleError}{active?.messages.at(-1)?.role === 'user' && <button disabled={busy} onClick={() => void submit(active.messages.at(-1)!.text, true)} className="ml-3 font-semibold underline">Thử lại</button>}</div>}
          {actionNotice && <div role="status" className="mb-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{actionNotice}</div>}
          {editingMessageIndex !== null && <div className="mb-2 flex items-center justify-between gap-3 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-800"><span>Đang sửa tin nhắn. Khi gửi, cuộc trò chuyện sẽ tiếp tục từ tin nhắn này.</span><button type="button" onClick={() => { setEditingMessageIndex(null); setDraft(''); }} className="inline-flex items-center gap-1 font-semibold hover:text-indigo-950"><X className="w-3.5 h-3.5" />Hủy</button></div>}
          <form onSubmit={event => { event.preventDefault(); void submit(draft); }} className="relative rounded-2xl border border-slate-300 bg-white shadow-sm focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100">
            <textarea ref={textareaRef} aria-label="Tin nhắn cho AI" value={draft} onChange={event => setDraft(event.target.value)} maxLength={4000} disabled={!storageKey} rows={1} placeholder={isDataLoading ? 'Đang chuẩn bị dữ liệu dự án…' : busy && !activeBusy ? 'AI đang trả lời ở cuộc trò chuyện khác…' : 'Nhắn tin cho AI PM…'} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void submit(draft); } }} className="block w-full resize-none bg-transparent pl-4 pr-14 py-3.5 text-sm min-h-12 max-h-44 focus:outline-none disabled:bg-slate-50 rounded-2xl" />
            {activeBusy
              ? <button type="button" onClick={() => abortRef.current?.abort()} aria-label="Dừng trả lời" title="Dừng trả lời" className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center"><Square className="w-3 h-3 fill-current" /></button>
              : <button type="submit" disabled={busy || isDataLoading || !storageKey || !draft.trim()} aria-label="Gửi tin nhắn" title={busy ? 'Đợi câu trả lời hiện tại hoặc bấm Dừng tại phiên đang xử lý' : 'Gửi tin nhắn'} className="absolute right-2 bottom-2 w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400"><Send className="w-4 h-4" /></button>}
          </form>
          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] text-slate-400">
            <span>Enter để gửi · Shift + Enter để xuống dòng</span><span>{activeModel || 'Chưa chọn model'}</span>
          </div>
        </div>
      </footer>
    </section>
  </div>;
}
