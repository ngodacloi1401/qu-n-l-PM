import React, { useState } from 'react';
import { Lock, Eye, EyeOff, ShieldCheck, AlertCircle, ArrowRight, Loader2, Key, UserCheck, ExternalLink } from 'lucide-react';
import { loginWithPassword, loginWithRedmineKey, getStoredConfig } from '../services/redmineApi';

interface AuthGateProps {
  onAuthenticated: () => void;
}

export const AuthGate: React.FC<AuthGateProps> = ({ onAuthenticated }) => {
  const currentConfig = getStoredConfig();
  const [authMode, setAuthMode] = useState<'redmine' | 'password'>('redmine');
  const [apiKey, setApiKey] = useState(currentConfig.apiKey || '');
  const [password, setPassword] = useState('');
  const [showSecret, setShowSecret] = useState(false);
  const [remember, setRemember] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (authMode === 'redmine') {
      if (!apiKey.trim()) {
        setError('Vui lòng nhập Redmine API Access Key của bạn.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await loginWithRedmineKey(apiKey.trim(), currentConfig.baseUrl, remember);
        if (res.ok) {
          onAuthenticated();
        } else {
          setError(res.error || 'Redmine API Key không chính xác hoặc không thể xác thực.');
        }
      } catch {
        setError('Có lỗi xảy ra khi kết nối đến máy chủ xác thực.');
      } finally {
        setIsLoading(false);
      }
    } else {
      if (!password.trim()) {
        setError('Vui lòng nhập mật khẩu truy cập.');
        return;
      }

      setIsLoading(true);
      try {
        const res = await loginWithPassword(password.trim(), remember);
        if (res.ok) {
          onAuthenticated();
        } else {
          setError(res.error || 'Mật khẩu không chính xác. Vui lòng thử lại.');
          setPassword('');
        }
      } catch {
        setError('Có lỗi xảy ra khi kết nối đến máy chủ.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 flex flex-col items-center justify-center p-4 selection:bg-indigo-500 selection:text-white relative overflow-hidden">
      {/* Decorative ambient background glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        {/* Top Logo / Icon */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-500 text-white shadow-xl shadow-indigo-500/20 mb-4 ring-4 ring-indigo-500/10">
            <Lock className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white sm:text-3xl">
            AnyBIM Project Management
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Hệ thống quản lý và báo cáo tiến độ nội bộ
          </p>
        </div>

        {/* Card Box */}
        <div className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-black/40">
          {/* Mode Switcher Tabs */}
          <div className="flex p-1 bg-slate-950/70 border border-slate-800 rounded-xl mb-5">
            <button
              type="button"
              onClick={() => { setAuthMode('redmine'); setError(null); }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                authMode === 'redmine'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Tài khoản Redmine</span>
            </button>
            <button
              type="button"
              onClick={() => { setAuthMode('password'); setError(null); }}
              className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                authMode === 'password'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Mật khẩu hệ thống</span>
            </button>
          </div>

          <div className="mb-5">
            <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>{authMode === 'redmine' ? 'Xác thực từng người dùng' : 'Mật khẩu bảo vệ'}</span>
            </div>
            <h2 className="text-base font-bold text-slate-100">
              {authMode === 'redmine' ? 'Đăng nhập bằng tài khoản Redmine' : 'Nhập mật khẩu truy cập'}
            </h2>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              {authMode === 'redmine'
                ? 'Nhập Redmine API Key của riêng bạn để tự động nhận diện danh tính, nạp việc cá nhân và lọc thông báo Slack.'
                : 'Mật khẩu dùng chung cho quản trị viên và phiên demo nội bộ.'}
            </p>
          </div>

          {error && (
            <div className="mb-5 p-3.5 bg-rose-500/10 border border-rose-500/20 rounded-xl flex items-start gap-3 text-xs text-rose-300 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {authMode === 'redmine' ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Redmine API Access Key
                  </label>
                  <a
                    href="https://redmine.anybim.vn/my/account"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-indigo-400 hover:text-indigo-300 flex items-center gap-0.5 underline"
                  >
                    <span>Lấy key tại My account</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                </div>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    autoFocus
                    disabled={isLoading}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="Dán mã API Key Redmine của bạn..."
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm font-mono text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Mật khẩu truy cập
                </label>
                <div className="relative">
                  <input
                    type={showSecret ? 'text' : 'password'}
                    autoFocus
                    disabled={isLoading}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu..."
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-950/60 border border-slate-700/80 rounded-xl text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecret(!showSecret)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 p-1 cursor-pointer"
                    tabIndex={-1}
                  >
                    {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between text-xs text-slate-400">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                />
                <span>Ghi nhớ phiên trên thiết bị này</span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading || (authMode === 'redmine' ? !apiKey.trim() : !password.trim())}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-sm font-semibold shadow-lg shadow-indigo-600/25 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed mt-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xác thực danh tính...</span>
                </>
              ) : (
                <>
                  <span>{authMode === 'redmine' ? 'Đăng nhập vào Workspace' : 'Mở khóa ứng dụng'}</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Footer info */}
        <div className="text-center mt-6 text-[11px] text-slate-500 flex items-center justify-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
          <span>Phiên làm việc được ký số bảo mật SHA-256 HMAC</span>
        </div>
      </div>
    </div>
  );
};
