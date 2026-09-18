import React, { useState } from 'react';
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
} from 'lucide-react';
import { RedmineIssue, RedmineProject } from '../types/redmine';
import { askGeminiPM } from '../services/redmineApi';

interface AICopilotViewProps {
  issues: RedmineIssue[];
  selectedProject: RedmineProject | undefined;
}

export const AICopilotView: React.FC<AICopilotViewProps> = ({
  issues,
  selectedProject,
}) => {
  const [mode, setMode] = useState<'standup' | 'risk' | 'general'>('standup');
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const generateReport = async (chosenMode: 'standup' | 'risk' | 'general') => {
    setLoading(true);
    setErrorMsg(null);
    setMode(chosenMode);

    try {
      const today = new Date().toISOString().split('T')[0];
      const stats = {
        totalIssues: issues.length,
        inProgressCount: issues.filter((i) => i.status.name.toLowerCase().includes('progress')).length,
        closedCount: issues.filter((i) => i.status.name.toLowerCase().includes('close') || i.status.name.toLowerCase().includes('verified')).length,
        overdueCount: issues.filter((i) => i.due_date && i.due_date < today && !i.status.name.toLowerCase().includes('close')).length,
        blockedCount: issues.filter((i) => i.status.name.toLowerCase().includes('block') || i.status.name.toLowerCase().includes('fail')).length,
      };

      const projectName = selectedProject ? selectedProject.name : 'Dự án Redmine (Tất cả)';
      const result = await askGeminiPM(chosenMode, projectName, issues, stats);
      setReport(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi tạo báo cáo AI');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    if (!report) return;
    navigator.clipboard.writeText(report);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Copilot Header */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 rounded-2xl p-6 text-white shadow-md relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">AI PM Copilot (Gemini 3.8 Flash)</h2>
                <span className="bg-purple-500/30 text-purple-200 text-xs px-2 py-0.5 rounded-full border border-purple-400/30">
                  Project Intelligence
                </span>
              </div>
              <p className="text-xs text-purple-200/80 mt-1">
                Tự động tổng hợp báo cáo Daily Standup, phân tích điểm nghẽn và đưa ra khuyến nghị quản trị
              </p>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => generateReport('standup')}
              disabled={loading}
              className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                mode === 'standup' && report
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
                mode === 'risk' && report
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
                mode === 'general' && report
                  ? 'bg-purple-500 text-white shadow-sm'
                  : 'bg-white/10 hover:bg-white/20 text-white'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              <span>Tối ưu hóa PM</span>
            </button>
          </div>
        </div>
      </div>

      {/* Error notification */}
      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-xs">
          <RefreshCw className="w-8 h-8 text-purple-600 animate-spin mx-auto mb-3" />
          <h3 className="text-sm font-bold text-slate-800">
            Gemini đang phân tích {issues.length} công việc trong dự án...
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Đang tổng hợp tiến độ, phát hiện điểm nghẽn và soạn báo cáo PM
          </p>
        </div>
      )}

      {/* Report Container */}
      {!loading && report && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600" />
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                {mode === 'standup'
                  ? 'Bản báo cáo Daily Standup dự án'
                  : mode === 'risk'
                  ? 'Báo cáo Kiểm toán Rủi ro & Điểm nghẽn'
                  : 'Đề xuất tối ưu quy trình PM'}
              </h3>
            </div>

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

          <div className="p-6 text-sm text-slate-800 leading-relaxed whitespace-pre-wrap font-sans">
            {report}
          </div>
        </div>
      )}

      {/* Empty State / Call to Action */}
      {!loading && !report && (
        <div className="bg-white p-12 rounded-xl border border-slate-200 text-center shadow-xs space-y-4">
          <div className="w-14 h-14 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto border border-purple-200">
            <Zap className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto">
            <h3 className="text-base font-bold text-slate-900">
              Sẵn sàng tạo báo cáo thông minh cho PM
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Bấm vào các nút phía trên để AI tự động đọc dữ liệu công việc hiện tại trên AnyBIM Redmine và soạn báo cáo chỉ trong vài giây.
            </p>
          </div>
          <button
            onClick={() => generateReport('standup')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
          >
            <Sparkles className="w-4 h-4" />
            <span>Tạo báo cáo Standup ngay</span>
          </button>
        </div>
      )}
    </div>
  );
};
