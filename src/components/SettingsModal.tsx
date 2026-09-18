import React, { useState } from 'react';
import {
  X,
  Settings,
  Key,
  Globe,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  RotateCcw,
  ExternalLink,
  Sparkles,
} from 'lucide-react';
import {
  getStoredConfig,
  saveStoredConfig,
  getStoredGeminiKey,
  saveStoredGeminiKey,
  DEFAULT_REDMINE_URL,
  DEFAULT_REDMINE_KEY,
} from '../services/redmineApi';

interface SettingsModalProps {
  onClose: () => void;
  onSaved: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ onClose, onSaved }) => {
  const currentConfig = getStoredConfig();
  const [baseUrl, setBaseUrl] = useState(currentConfig.baseUrl);
  const [apiKey, setApiKey] = useState(currentConfig.apiKey);
  const [geminiKey, setGeminiKey] = useState(getStoredGeminiKey());

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch('/api/redmine/me', {
        headers: {
          'x-redmine-url': baseUrl.trim().replace(/\/+$/, ''),
          'x-redmine-api-key': apiKey.trim(),
        },
      });

      if (!res.ok) {
        throw new Error(`Mã lỗi HTTP ${res.status}: Không thể xác thực với Redmine`);
      }

      const data = await res.json();
      if (data.user) {
        setTestResult({
          success: true,
          message: `Kết nối thành công! Đã xác thực người dùng: ${data.user.firstname} ${data.user.lastname} (${data.user.login})`,
        });
      } else {
        throw new Error('Không nhận được thông tin người dùng từ Redmine');
      }
    } catch (err: any) {
      setTestResult({
        success: false,
        message: err.message || 'Kiểm tra kết nối thất bại',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleSave = () => {
    saveStoredConfig({
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      apiKey: apiKey.trim(),
    });
    saveStoredGeminiKey(geminiKey.trim());
    onSaved();
    onClose();
  };

  const handleResetDefault = () => {
    setBaseUrl(DEFAULT_REDMINE_URL);
    setApiKey(DEFAULT_REDMINE_KEY);
    setTestResult(null);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cài đặt kết nối & AI Copilot</h3>
              <p className="text-xs text-slate-500">Cấu hình Redmine API & Khóa Gemini AI</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {testResult && (
          <div
            className={`mb-4 p-3 rounded-lg text-xs flex items-center gap-2 border ${
              testResult.success
                ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                : 'bg-rose-50 text-rose-800 border-rose-200'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            )}
            <span>{testResult.message}</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Base URL */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-slate-500" />
              Địa chỉ Redmine URL
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://redmine.anybim.vn"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Redmine API Key */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-slate-500" />
                Redmine API Access Key
              </label>
              <a
                href={`${baseUrl}/my/account`}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5"
              >
                <span>Lấy key tại My account</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="440da87a37415860..."
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Gemini API Key */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>Google Gemini API Key (Báo cáo AI)</span>
              </label>
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5"
              >
                <span>Lấy key miễn phí</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              value={geminiKey}
              onChange={(e) => setGeminiKey(e.target.value)}
              placeholder="AIzaSy... (Khóa API Gemini)"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Cần thiết để chạy các tính năng AI Copilot (Báo cáo Standup, Phân tích rủi ro PM).
            </p>
          </div>

          {/* Test connection button */}
          <div className="pt-1 flex items-center justify-between">
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${testing ? 'animate-spin' : ''}`} />
              <span>{testing ? 'Đang kiểm tra...' : 'Kiểm tra kết nối Redmine'}</span>
            </button>

            <button
              type="button"
              onClick={handleResetDefault}
              className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-800 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Khôi phục mặc định AnyBIM</span>
            </button>
          </div>

          {/* Modal Footer */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            >
              Lưu cấu hình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
