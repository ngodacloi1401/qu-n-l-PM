import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  FileText,
  ShieldAlert,
  Zap,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  Lightbulb,
  Cpu,
  Info,
  Sliders,
} from 'lucide-react';
import { RedmineIssue, RedmineProject } from '../types/redmine';
import { askGeminiPM, AVAILABLE_AI_MODELS, GeminiPMResponse } from '../services/redmineApi';

interface AICopilotViewProps {
  issues: RedmineIssue[];
  selectedProject: RedmineProject | undefined;
}

const STORAGE_KEY_MODEL = 'redmine_ai_model';

export const AICopilotView: React.FC<AICopilotViewProps> = ({
  issues,
  selectedProject,
}) => {
  const [mode, setMode] = useState<'standup' | 'risk' | 'general'>('standup');
  const [selectedModel, setSelectedModel] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MODEL);
    if (saved && AVAILABLE_AI_MODELS.some((m) => m.id === saved)) {
      return saved;
    }
    return 'gemini-2.5-flash';
  });
  const [customModel, setCustomModel] = useState<string>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MODEL);
    return saved && !AVAILABLE_AI_MODELS.some(m => m.id === saved) ? saved : '';
  });
  const [isCustomMode, setIsCustomMode] = useState<boolean>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_MODEL);
    return !!saved && !AVAILABLE_AI_MODELS.some(m => m.id === saved);
  });

  const [loading, setLoading] = useState(false);
  const [reportData, setReportData] = useState<GeminiPMResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extraPrompt, setExtraPrompt] = useState('');
  const [showExtraPrompt, setShowExtraPrompt] = useState(false);

  // Sync model to localStorage
  useEffect(() => {
    if (!isCustomMode) {
      localStorage.setItem(STORAGE_KEY_MODEL, selectedModel);
    } else if (customModel.trim()) {
      localStorage.setItem(STORAGE_KEY_MODEL, customModel.trim());
    }
  }, [selectedModel, customModel, isCustomMode]);

  const activeModelId = isCustomMode ? customModel.trim() : selectedModel;
  const currentModelMeta = AVAILABLE_AI_MODELS.find((m) => m.id === selectedModel);

  const generateReport = async (chosenMode: 'standup' | 'risk' | 'general') => {
    if (!activeModelId) { setErrorMsg('Nhập mã model AI trước khi tạo báo cáo.'); return; }
    setLoading(true);
    setErrorMsg(null);
    setMode(chosenMode);

    try {
      const today = new Date().toISOString().split('T')[0];
      const stats = {
        totalIssues: issues.length,
        inProgressCount: issues.filter((i) => i.status.name.toLowerCase().includes('progress')).length,
        closedCount: issues.filter((i) =>
          i.status.name.toLowerCase().includes('close') || i.status.name.toLowerCase().includes('verified')
        ).length,
        overdueCount: issues.filter((i) => i.due_date && i.due_date < today && !i.status.name.toLowerCase().includes('close')).length,
        blockedCount: issues.filter((i) =>
          i.status.name.toLowerCase().includes('block') || i.status.name.toLowerCase().includes('fail')
        ).length,
      };

      const projectName = selectedProject ? selectedProject.name : 'Dự án Redmine (Tất cả)';
      
      // If extra user notes provided, attach to request stats/context
      const enrichedStats = extraPrompt.trim()
        ? { ...stats, userNoteForAI: extraPrompt.trim() }
        : stats;

      const response = await askGeminiPM(
        chosenMode,
        projectName,
        issues,
        enrichedStats,
        activeModelId
      );

      setReportData(response);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tạo báo cáo AI');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!reportData?.result) return;
    navigator.clipboard.writeText(reportData.result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Copilot Header */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col gap-5">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300 shrink-0">
                <Sparkles className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-bold">AI PM Copilot Workspace</h2>
                  <span className="bg-purple-500/30 text-purple-200 text-xs px-2.5 py-0.5 rounded-full border border-purple-400/30 flex items-center gap-1">
                    <Cpu className="w-3 h-3" />
                    <span>{isCustomMode ? (activeModelId || "Chưa nhập model") : currentModelMeta?.name || activeModelId}</span>
                  </span>
                </div>
                <p className="text-xs text-purple-200/80 mt-1">
                  Tự động tổng hợp báo cáo Daily Standup, phân tích rủi ro & điểm nghẽn dự án AnyBIM
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-2 w-full md:w-72">
              <label htmlFor="ai-model-select" className="text-xs text-purple-200">Model AI</label>
              <select
                id="ai-model-select"
                value={isCustomMode ? 'custom' : selectedModel}
                disabled={loading}
                onChange={e => {
                  const value = e.target.value;
                  setIsCustomMode(value === 'custom');
                  if (value !== 'custom') setSelectedModel(value);
                }}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white"
              >
                {AVAILABLE_AI_MODELS.map(model => <option key={model.id} value={model.id}>{model.name}</option>)}
                <option value="custom">Nhập mã Model khác</option>
              </select>
              {isCustomMode && <input
                aria-label="Mã model AI tùy chỉnh"
                placeholder="vd: gemini-2.5-flash"
                value={customModel}
                disabled={loading}
                onChange={e => setCustomModel(e.target.value)}
                className="w-full bg-slate-900 border border-slate-600 rounded-lg px-3 py-2 text-xs text-white"
              />}
            </div>
          </div>

          {/* Action Buttons & Optional Custom Prompt */}
          <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-3 border-t border-white/10">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => generateReport('standup')}
                disabled={loading}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'standup' && reportData?.result
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <FileText className="w-4 h-4" />
                <span>Báo cáo Standup</span>
              </button>

              <button
                onClick={() => generateReport('risk')}
                disabled={loading}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'risk' && reportData?.result
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Phân tích Rủi ro & Blockers</span>
              </button>

              <button
                onClick={() => generateReport('general')}
                disabled={loading}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  mode === 'general' && reportData?.result
                    ? 'bg-purple-500 text-white shadow-sm'
                    : 'bg-white/10 hover:bg-white/20 text-white'
                }`}
              >
                <Lightbulb className="w-4 h-4" />
                <span>Tối ưu hóa PM</span>
              </button>
            </div>

            <button
              onClick={() => setShowExtraPrompt(!showExtraPrompt)}
              className="inline-flex items-center gap-1.5 text-2xs text-purple-200/80 hover:text-white px-2.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 cursor-pointer self-start md:self-auto transition-colors"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showExtraPrompt ? 'Ẩn ghi chú thêm' : '+ Thêm lưu ý cho AI'}</span>
            </button>
          </div>

          {/* Optional Extra Instruction for AI */}
          {showExtraPrompt && (
            <div className="bg-black/30 p-3 rounded-xl border border-white/10 space-y-1.5">
              <label className="text-2xs text-purple-200/90 font-medium">
                Yêu cầu bổ sung cho báo cáo (tùy chọn):
              </label>
              <input
                type="text"
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                placeholder="Ví dụ: Tập trung vào deadline ngày mai, hoặc nhấn mạnh vấn đề nhân sự..."
                className="w-full bg-slate-900/80 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400"
              />
            </div>
          )}
        </div>
      </div>

      {/* Error notification */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-rose-600" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-800">Không thể tạo báo cáo AI</p>
            <p>{errorMsg}</p>
            <p className="text-2xs text-rose-600/80 mt-1">
              Khóa Gemini được cấu hình trong menu Cài đặt (⚙️). Nếu thông báo là hết quota hoặc quá thời gian chờ, hãy kiểm tra quota hoặc thử lại sau.
            </p>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-xs">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">
            {activeModelId} đang phân tích {issues.length} công việc trong dự án...
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Đang tổng hợp tiến độ thực tế từ Redmine, phân tích rủi ro và biên soạn văn bản PM
          </p>
        </div>
      )}

      {/* Fallback Notice */}
      {!loading && reportData?.fallbackOccurred && (
        <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center gap-2">
          <Info className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            Báo cáo được tạo bằng model dự phòng <b>{reportData.usedModel}</b> vì model <b>{reportData.requestedModel}</b> chưa phản hồi thành công.
          </span>
        </div>
      )}

      {/* Report Container */}
      {!loading && reportData?.result && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3.5 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {mode === 'standup'
                  ? 'Bản báo cáo Daily Standup dự án'
                  : mode === 'risk'
                  ? 'Báo cáo Kiểm toán Rủi ro & Điểm nghẽn'
                  : 'Đề xuất tối ưu quy trình PM'}
              </h3>
              {reportData.usedModel && (
                <span className="text-2xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full font-medium border border-purple-200">
                  Model: {reportData.usedModel}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => generateReport(mode)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                title="Tạo lại báo cáo mới"
              >
                <RefreshCw className="w-3.5 h-3.5 text-slate-500" />
                <span>Tạo lại</span>
              </button>

              <button
                onClick={copyToClipboard}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-700">Đã sao chép!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                    <span>Sao chép báo cáo</span>
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="p-6 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
            {reportData.result}
          </div>
        </div>
      )}

      {/* Empty State / Call to Action */}
      {!loading && !reportData?.result && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto border border-purple-200">
            <Zap className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              Sẵn sàng tạo báo cáo thông minh cho PM
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Chọn model AI và loại báo cáo phía trên để tổng hợp thống kê và các công việc mẫu từ Redmine.
            </p>
          </div>
          <button
            onClick={() => generateReport('standup')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tạo báo cáo Standup ngay ({currentModelMeta?.name || activeModelId})</span>
          </button>
        </div>
      )}
    </div>
  );
};
