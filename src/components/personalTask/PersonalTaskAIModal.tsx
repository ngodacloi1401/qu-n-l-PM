import React, { useState, useEffect } from 'react';
import { X, Sparkles, Plus, Check, Loader2, Calendar, AlertCircle, Trash2, ArrowRight, Bot, Cpu } from 'lucide-react';
import type { PersonalTask } from '../../types/personalTask';
import { askAIChat, FALLBACK_AI_MODELS, getAvailableAIModels, type AIModelOption, type AIProvider } from '../../services/redmineApi';

interface GeneratedTaskDraft {
  title: string;
  category: string;
  dueDate: string;
  priorityName: string;
  statusName: string;
  description: string;
}

interface PersonalTaskAIModalProps {
  onClose: () => void;
  onAddTasks: (tasks: PersonalTask[]) => void;
  projectName?: string;
}

const PROVIDERS: Array<{ id: AIProvider; name: string }> = [
  { id: 'gemini', name: 'Google Gemini' },
  { id: 'openai', name: 'OpenAI / ChatGPT' },
  { id: 'codex', name: 'OpenAI Codex' },
  { id: 'anthropic', name: 'Anthropic / Claude' },
];

const savedProvider = (): AIProvider => {
  const value = localStorage.getItem('redmine_ai_provider');
  return value === 'openai' || value === 'codex' || value === 'anthropic' ? value : 'gemini';
};

const savedModel = (prov: AIProvider): string => {
  const custom = localStorage.getItem(`redmine_ai_model_${prov}`) || (prov === 'gemini' ? localStorage.getItem('redmine_ai_model') : '');
  if (custom) return custom;
  const list = FALLBACK_AI_MODELS[prov] || [];
  return list.find(m => m.isDefault)?.id || list[0]?.id || 'gemini-2.0-flash';
};

export const PersonalTaskAIModal: React.FC<PersonalTaskAIModalProps> = ({
  onClose,
  onAddTasks,
  projectName = 'Dự án chung',
}) => {
  const [provider, setProvider] = useState<AIProvider>(savedProvider);
  const [modelOptions, setModelOptions] = useState<AIModelOption[]>(() => FALLBACK_AI_MODELS[savedProvider()] || []);
  const [selectedModel, setSelectedModel] = useState<string>(() => savedModel(savedProvider()));
  const [prompt, setPrompt] = useState('');
  const [week, setWeek] = useState(() => {
    const d = new Date();
    return `Tuần ${String(Math.ceil(d.getDate() / 7)).padStart(2, '0')}`;
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<GeneratedTaskDraft[]>([]);

  useEffect(() => {
    let active = true;
    getAvailableAIModels(provider)
      .then(models => {
        if (!active || !models.length) return;
        setModelOptions(models);
        if (!models.some(m => m.id === selectedModel)) {
          const pref = savedModel(provider);
          const next = models.find(m => m.id === pref) || models.find(m => m.isDefault) || models[0];
          if (next) setSelectedModel(next.id);
        }
      })
      .catch(() => {
        if (!active) return;
        const fallbacks = FALLBACK_AI_MODELS[provider] || [];
        setModelOptions(fallbacks);
        if (!fallbacks.some(m => m.id === selectedModel)) {
          const def = fallbacks.find(m => m.isDefault) || fallbacks[0];
          if (def) setSelectedModel(def.id);
        }
      });
    return () => { active = false; };
  }, [provider]);

  const handleProviderChange = (newProvider: AIProvider) => {
    setProvider(newProvider);
    const fallbacks = FALLBACK_AI_MODELS[newProvider] || [];
    setModelOptions(fallbacks);
    const pref = savedModel(newProvider);
    setSelectedModel(pref);
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setIsLoading(true);
    setError(null);
    setDrafts([]);

    const systemPrompt = `Bạn là một trợ lý quản lý công việc và Project Manager thông minh.
Người dùng muốn lên kế hoạch hoặc tạo công việc với yêu cầu: "${prompt}".
Dự án: "${projectName}". Tuần kế hoạch: "${week}".

Hãy phân tích và chia nhỏ yêu cầu này thành các đầu việc (tasks) cụ thể, khả thi và rõ ràng.
Chỉ trả về DUY NHẤT một chuỗi JSON hợp lệ (không kèm markdown \`\`\`json, không kèm giải thích ngoài JSON) theo đúng định dạng mảng:
[
  {
    "title": "Tiêu đề công việc ngắn gọn, rõ ràng",
    "category": "Nhóm việc (VD: Kỹ thuật, Báo cáo, Kiểm tra, Thiết kế...)",
    "dueDate": "YYYY-MM-DD (Hạn chót ước tính)",
    "priorityName": "Normal" hoặc "High" hoặc "Urgent" hoặc "Low",
    "statusName": "New",
    "description": "Các bước thực hiện hoặc checklist chi tiết"
  }
]`;

    try {
      const resp = await askAIChat(
        provider,
        [{ role: 'user', text: systemPrompt }],
        projectName,
        [],
        [],
        0,
        selectedModel,
        { availableModels: modelOptions.map(m => m.id) },
        undefined,
        undefined,
        'low'
      );

      const raw = resp.result.trim();
      const cleanJson = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
      const parsed: GeneratedTaskDraft[] = JSON.parse(cleanJson);

      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error('AI không tạo được danh sách công việc. Vui lòng thử mô tả chi tiết hơn.');
      }

      setDrafts(parsed);
    } catch (err: any) {
      console.error('Lỗi sinh kế hoạch AI:', err);
      setError(err?.message || 'Có lỗi khi kết nối với AI. Hãy chọn model khác hoặc kiểm tra API Key trong Cài đặt.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplyTasks = () => {
    if (drafts.length === 0) return;

    const nowStr = new Date().toISOString();
    const createdTasks: PersonalTask[] = drafts.map((d, index) => ({
      id: `task_ai_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
      week: week.trim() || 'Kế hoạch',
      assignedDate: nowStr.split('T')[0],
      category: d.category || 'Chung',
      title: d.title,
      description: d.description || '',
      trackerName: 'Task',
      statusName: d.statusName || 'New',
      priorityName: d.priorityName || 'Normal',
      dueDate: d.dueDate || '',
      doneRatio: 0,
      resultNote: '',
      source: 'manual',
      createdAt: nowStr,
      updatedAt: nowStr,
    }));

    onAddTasks(createdTasks);
    onClose();
  };

  const removeDraft = (index: number) => {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  };

  const updateDraft = (index: number, field: keyof GeneratedTaskDraft, val: string) => {
    setDrafts((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: val };
      return next;
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-indigo-900 via-purple-900 to-indigo-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/30 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                Trợ lý AI Lập kế hoạch công việc
                <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-indigo-500/40 text-indigo-200 border border-indigo-400/30">
                  {PROVIDERS.find(p => p.id === provider)?.name || 'AI Copilot'}
                </span>
              </h3>
              <p className="text-xs text-indigo-200/80">
                Gõ ý tưởng hoặc mục tiêu bằng tiếng Việt, AI sẽ tự động phân rã thành đầu việc cụ thể
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-indigo-300 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
          {/* AI Model & Provider Selector */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600 flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-indigo-600" />
                Dịch vụ AI:
              </span>
              <select
                value={provider}
                onChange={(e) => handleProviderChange(e.target.value as AIProvider)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2 flex-1 min-w-[200px] justify-end">
              <span className="font-semibold text-slate-600 flex items-center gap-1.5 shrink-0">
                <Cpu className="w-3.5 h-3.5 text-indigo-600" />
                Mô hình:
              </span>
              <select
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 max-w-[240px] truncate"
              >
                {modelOptions.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id} {m.badge ? `(${m.badge})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Prompt Form */}
          <form onSubmit={handleGenerate} className="space-y-3">
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Mô tả công việc hoặc mục tiêu bạn cần làm:
                </label>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Ví dụ: Lên kế hoạch tuần tới hoàn thiện hồ sơ nghiệm thu CAD tầng 3, kiểm thử tính năng bóc tách khối lượng và họp báo cáo với PM..."
                  className="w-full text-xs px-3.5 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 font-medium"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-600">Đợt / Tuần kế hoạch:</label>
                <input
                  type="text"
                  value={week}
                  onChange={(e) => setWeek(e.target.value)}
                  placeholder="VD: Tuần 09"
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs font-bold text-slate-800 bg-slate-50 w-28"
                />
              </div>

              <button
                type="submit"
                disabled={isLoading || !prompt.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>AI đang phân tích & lên việc...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Phân tích & Tạo việc bằng AI</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Quick Suggestion Pills */}
          <div className="pt-2 border-t border-slate-100 flex items-center gap-2 flex-wrap">
            <span className="text-[11px] font-semibold text-slate-500">Gợi ý nhanh:</span>
            {[
              'Hoàn thiện tài liệu nghiệm thu & checklist bàn giao',
              'Kiểm tra lỗi (bug) & kiểm thử chức năng trước khi release',
              'Lập kế hoạch sprint 2 tuần: phân tích yêu cầu, code, test',
            ].map((text, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setPrompt(text)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
              >
                {text}
              </button>
            ))}
          </div>

          {/* Generated Results List */}
          {drafts.length > 0 && (
            <div className="space-y-3 pt-3 border-t border-slate-200">
              <div className="flex items-center justify-between">
                <div className="font-bold text-slate-800 flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-600" />
                  <span>AI đã tạo {drafts.length} đầu việc (Bạn có thể chỉnh sửa trước khi lưu):</span>
                </div>
              </div>

              <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                {drafts.map((d, idx) => (
                  <div key={idx} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2 relative group hover:border-indigo-300 transition-colors">
                    <button
                      type="button"
                      onClick={() => removeDraft(idx)}
                      title="Xóa đầu việc này"
                      className="absolute top-3 right-3 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer p-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="flex items-center gap-2 pr-6">
                      <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-700 font-bold text-[11px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <input
                        type="text"
                        value={d.title}
                        onChange={(e) => updateDraft(idx, 'title', e.target.value)}
                        className="flex-1 font-bold text-slate-900 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-indigo-500 focus:bg-white px-1.5 py-0.5 rounded text-xs"
                      />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
                      <div>
                        <span className="text-slate-500 block mb-0.5">Nhóm việc:</span>
                        <input
                          type="text"
                          value={d.category}
                          onChange={(e) => updateDraft(idx, 'category', e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-slate-800 text-xs"
                        />
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Hạn chót:</span>
                        <input
                          type="date"
                          value={d.dueDate}
                          onChange={(e) => updateDraft(idx, 'dueDate', e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-slate-800 text-xs"
                        />
                      </div>

                      <div>
                        <span className="text-slate-500 block mb-0.5">Mức ưu tiên:</span>
                        <select
                          value={d.priorityName}
                          onChange={(e) => updateDraft(idx, 'priorityName', e.target.value)}
                          className="w-full px-2 py-1 bg-white border border-slate-200 rounded text-slate-800 text-xs font-semibold"
                        >
                          <option value="Normal">Normal (Bình thường)</option>
                          <option value="High">High (Cao)</option>
                          <option value="Urgent">Urgent (Gấp)</option>
                          <option value="Low">Low (Thấp)</option>
                        </select>
                      </div>
                    </div>

                    {d.description && (
                      <div className="text-[11px] text-slate-600 bg-white p-2 rounded border border-slate-200">
                        {d.description}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-slate-600 hover:text-slate-800 font-semibold text-xs transition-colors cursor-pointer"
          >
            Đóng
          </button>

          {drafts.length > 0 && (
            <button
              type="button"
              onClick={handleApplyTasks}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Đưa {drafts.length} việc này vào Kanban</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
