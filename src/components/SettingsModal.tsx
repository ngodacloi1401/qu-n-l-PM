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
  MessageSquare,
} from 'lucide-react';
import {
  getStoredConfig,
  saveStoredConfig,
  getStoredGeminiKey,
  saveStoredGeminiKey,
  getStoredOpenAIKey,
  saveStoredOpenAIKey,
  getStoredAnthropicKey,
  saveStoredAnthropicKey,
  getStoredSlackToken,
  saveStoredSlackToken,
  getStoredSlackMemberId,
  saveStoredSlackMemberId,
  testSlackToken,
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
  const [openAIKey, setOpenAIKey] = useState(getStoredOpenAIKey());
  const [anthropicKey, setAnthropicKey] = useState(getStoredAnthropicKey());
  const [slackToken, setSlackToken] = useState(getStoredSlackToken());
  const [slackMemberId, setSlackMemberId] = useState(getStoredSlackMemberId());

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const [testingSlack, setTestingSlack] = useState(false);
  const [slackTestResult, setSlackTestResult] = useState<{ success: boolean; message: string } | null>(null);

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

  const handleTestSlack = async () => {
    if (!slackToken.trim()) {
      setSlackTestResult({
        success: false,
        message: 'Vui lòng nhập Slack User OAuth Token (xoxp-...) trước khi kiểm tra.',
      });
      return;
    }
    setTestingSlack(true);
    setSlackTestResult(null);
    try {
      const res = await testSlackToken(slackToken.trim());
      if (res.ok) {
        if (res.userId && !slackMemberId) {
          setSlackMemberId(res.userId);
        }
        setSlackTestResult({
          success: true,
          message: `Kết nối thành công với tài khoản Slack @${res.user || 'bạn'} (Workspace: ${res.team || 'AnyBIM'}, ID: ${res.userId || 'N/A'})!`,
        });
      } else {
        setSlackTestResult({
          success: false,
          message: res.error || 'Xác thực Slack thất bại',
        });
      }
    } catch (err: any) {
      setSlackTestResult({
        success: false,
        message: err.message || 'Lỗi khi kiểm tra kết nối Slack',
      });
    } finally {
      setTestingSlack(false);
    }
  };

  const handleSave = () => {
    saveStoredConfig({
      baseUrl: baseUrl.trim().replace(/\/+$/, ''),
      apiKey: apiKey.trim(),
    });
    saveStoredGeminiKey(geminiKey.trim());
    saveStoredOpenAIKey(openAIKey.trim());
    saveStoredAnthropicKey(anthropicKey.trim());
    saveStoredSlackToken(slackToken.trim());
    saveStoredSlackMemberId(slackMemberId.trim());
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
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-bold">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Cài đặt kết nối & Cá nhân hóa</h3>
              <p className="text-xs text-slate-500">Cấu hình Redmine, Slack cá nhân và API keys AI</p>
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
            <label className="text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1.5">
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

          {/* Slack Integration Section */}
          <div className="pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-indigo-600" />
                <span>Kết nối Slack Cá nhân (Thông báo &amp; Lịch họp)</span>
              </label>
              <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                Multi-User
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mb-2.5">
              Cung cấp Slack Token hoặc Member ID của riêng bạn để trung tâm thông báo chỉ hiển thị mention, cảnh báo và link họp Google Meet liên quan đến bạn.
            </p>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] font-medium text-slate-600 block mb-1">
                  Slack User OAuth Token (xoxp-...)
                </label>
                <input
                  type="password"
                  value={slackToken}
                  onChange={(e) => setSlackToken(e.target.value)}
                  placeholder="xoxp-1234567890-... (User OAuth Token)"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-600">
                    Slack Member ID cá nhân
                  </label>
                  <span className="text-[10px] text-slate-400">
                    (Vào Slack → Click Avatar → ... → Copy member ID)
                  </span>
                </div>
                <input
                  type="text"
                  value={slackMemberId}
                  onChange={(e) => setSlackMemberId(e.target.value)}
                  placeholder="Ví dụ: U0BJU7SLNC8"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleTestSlack}
                  disabled={testingSlack || !slackToken.trim()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${testingSlack ? 'animate-spin text-indigo-600' : ''}`} />
                  <span>{testingSlack ? 'Đang kiểm tra...' : 'Kiểm tra kết nối Slack'}</span>
                </button>
              </div>

              {slackTestResult && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-start gap-2 border ${
                    slackTestResult.success
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-rose-50 text-rose-800 border-rose-200'
                  }`}
                >
                  {slackTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1 text-[11px] leading-relaxed">
                    {slackTestResult.message}
                  </div>
                </div>
              )}
            </div>
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
              Dùng khi chọn nhà cung cấp Gemini trong AI PM Copilot.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>OpenAI API Key (ChatGPT &amp; Codex)</span>
              </label>
              <a href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer" className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5">
                <span>Lấy API key</span><ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input type="password" value={openAIKey} onChange={(e) => setOpenAIKey(e.target.value)} placeholder="sk-... (OpenAI API Key)" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500" />
            <p className="text-[11px] text-slate-400 mt-1">Dùng chung cho model GPT và Codex qua OpenAI API; gói ChatGPT cá nhân không tự cung cấp API key.</p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-orange-600" />
                <span>Anthropic API Key (Claude)</span>
              </label>
              <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noreferrer" className="text-[11px] text-indigo-600 hover:underline flex items-center gap-0.5">
                <span>Lấy API key</span><ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input type="password" value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} placeholder="sk-ant-... (Anthropic API Key)" className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-indigo-500" />
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
