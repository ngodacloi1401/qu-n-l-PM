import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Download,
  Trash2,
  X,
  Link2,
  Sparkles,
  Copy,
  Check,
  UploadCloud,
  DownloadCloud,
  CheckCheck,
  ShieldCheck,
  Mail,
  Zap,
  Info,
} from 'lucide-react';
import type { PersonalTask } from '../../types/personalTask';
import {
  getGoogleSheetsSyncConfig,
  saveGoogleSheetsSyncConfig,
  clearGoogleSheetsSyncConfig,
  fetchGoogleSheetTasks,
  mergePersonalTasks,
  testAppsScriptConnection,
  pushAllTasksToGoogleSheet,
  pullTasksFromAppsScript,
  fetchServiceAccountStatus,
  testServiceAccountConnection,
  pullTasksFromServiceAccount,
  pushAllTasksToServiceAccount,
  APPS_SCRIPT_TEMPLATE,
  type GoogleSheetsSyncConfig,
  type ServiceAccountStatus,
} from '../../services/googleSheetsSync';
import { downloadExcelTemplate } from '../../services/personalTaskExcel';

interface GoogleSheetsSyncModalProps {
  userScopeKey: string;
  tasks: PersonalTask[];
  onTasksUpdated: (updatedTasks: PersonalTask[], message: string) => void;
  onClose: () => void;
}

export const GoogleSheetsSyncModal: React.FC<GoogleSheetsSyncModalProps> = ({
  userScopeKey,
  tasks,
  onTasksUpdated,
  onClose,
}) => {
  const [config, setConfig] = useState<GoogleSheetsSyncConfig>(() =>
    getGoogleSheetsSyncConfig(userScopeKey)
  );

  const [activeTab, setActiveTab] = useState<'service-account' | 'apps-script' | '1way'>(() => {
    if (config.syncMethod === 'apps-script' || (!config.syncMethod && config.scriptUrl)) {
      return 'apps-script';
    }
    return 'service-account';
  });

  // Service Account State
  const [saStatus, setSaStatus] = useState<ServiceAccountStatus | null>(null);
  const [saLoading, setSaLoading] = useState(false);
  const [copiedSaEmail, setCopiedSaEmail] = useState(false);
  const [saSheetUrl, setSaSheetUrl] = useState(config.sheetUrl || '');
  const [saAutoPush, setSaAutoPush] = useState(config.autoPush !== false);
  const [saConnectionStatus, setSaConnectionStatus] = useState<string | null>(null);

  // Apps Script (2-way manual) State
  const [scriptUrlInput, setScriptUrlInput] = useState(config.scriptUrl || '');
  const [scriptAutoPush, setScriptAutoPush] = useState(config.autoPush !== false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [scriptConnectionStatus, setScriptConnectionStatus] = useState<string | null>(null);

  // 1-way Read-Only State
  const [urlInput, setUrlInput] = useState(config.sheetUrl || '');
  const [syncMode, setSyncMode] = useState<'merge' | 'replace'>(config.syncMode || 'merge');
  const [autoSync, setAutoSync] = useState(config.autoSync || false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Load server status on mount
  useEffect(() => {
    let isMounted = true;
    setSaLoading(true);
    fetchServiceAccountStatus()
      .then((status) => {
        if (isMounted) {
          setSaStatus(status);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setSaLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    setSaSheetUrl(config.sheetUrl || '');
    setScriptUrlInput(config.scriptUrl || '');
    setScriptAutoPush(config.autoPush !== false);
    setSaAutoPush(config.autoPush !== false);
    setUrlInput(config.sheetUrl || '');
    setSyncMode(config.syncMode || 'merge');
    setAutoSync(config.autoSync || false);
  }, [config]);

  const handleCopySaEmail = async () => {
    const email = saStatus?.clientEmail || '';
    if (!email) return;
    try {
      await navigator.clipboard.writeText(email);
      setCopiedSaEmail(true);
      setTimeout(() => setCopiedSaEmail(false), 3000);
    } catch {
      setErrorMsg('Không thể tự động sao chép email. Vui lòng copy thủ công.');
    }
  };

  const handleCopyScript = async () => {
    try {
      await navigator.clipboard.writeText(APPS_SCRIPT_TEMPLATE);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 3000);
    } catch {
      setErrorMsg('Không thể tự động sao chép mã. Vui lòng chọn và sao chép thủ công.');
    }
  };

  // --- SERVICE ACCOUNT ACTIONS ---
  const handleTestServiceAccount = async () => {
    const url = saSheetUrl.trim();
    if (!url) {
      setErrorMsg('Vui lòng nhập đường link Google Sheets trước khi kiểm tra.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSaConnectionStatus(null);

    try {
      const res = await testServiceAccountConnection(url);
      setSaConnectionStatus(`Kết nối thành công! Sheet "${res.sheetTitle || 'Sheet1'}" hiện có ${res.count ?? 0} công việc.`);
      setSuccessMsg('Đã kết nối thành công tới file Google Sheet của bạn!');
    } catch (err: any) {
      setErrorMsg(err.message || 'Không thể kết nối tới Google Sheet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveServiceAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const url = saSheetUrl.trim();
    if (!url) {
      setErrorMsg('Vui lòng nhập đường link Google Sheets.');
      return;
    }

    const updatedConfig: GoogleSheetsSyncConfig = {
      ...config,
      sheetUrl: url,
      syncMethod: 'service-account',
      autoPush: saAutoPush,
      autoSync: true,
    };

    saveGoogleSheetsSyncConfig(userScopeKey, updatedConfig);
    setConfig(updatedConfig);
    setSuccessMsg('Đã kích hoạt đồng bộ 2 chiều tự động qua Google Service Account!');
    setTimeout(() => onClose(), 1200);
  };

  const handlePushAllViaServiceAccount = async () => {
    const url = saSheetUrl.trim() || config.sheetUrl;
    if (!url) {
      setErrorMsg('Vui lòng nhập link Google Sheet trước.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await pushAllTasksToServiceAccount(url, tasks);
      const msg = `Đã đẩy toàn bộ ${res.count} công việc lên Google Sheet thành công!`;
      setSuccessMsg(msg);
      saveGoogleSheetsSyncConfig(userScopeKey, {
        ...config,
        sheetUrl: url,
        syncMethod: 'service-account',
        autoPush: saAutoPush,
        lastSyncedAt: Date.now(),
        lastTaskCount: res.count,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi đẩy dữ liệu lên Google Sheet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePullViaServiceAccount = async () => {
    const url = saSheetUrl.trim() || config.sheetUrl;
    if (!url) {
      setErrorMsg('Vui lòng nhập link Google Sheet trước.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const incoming = await pullTasksFromServiceAccount(url);
      if (!incoming.length) {
        throw new Error('Google Sheet chưa có dòng công việc nào (hoặc chỉ có tiêu đề).');
      }

      const merged = mergePersonalTasks(tasks, incoming);
      onTasksUpdated(merged, `Đã kéo ${incoming.length} công việc từ Google Sheet về máy.`);
      setSuccessMsg(`Đã kéo thành công ${incoming.length} công việc từ Google Sheet.`);
      saveGoogleSheetsSyncConfig(userScopeKey, {
        ...config,
        sheetUrl: url,
        syncMethod: 'service-account',
        autoPush: saAutoPush,
        lastSyncedAt: Date.now(),
        lastTaskCount: incoming.length,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi kéo công việc từ Google Sheet.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- APPS SCRIPT ACTIONS ---
  const handleTestAppsScript = async () => {
    const url = scriptUrlInput.trim();
    if (!url) {
      setErrorMsg('Vui lòng dán URL Ứng dụng web Google Apps Script trước khi kiểm tra.');
      return;
    }

    setTestingConnection(true);
    setErrorMsg(null);
    setScriptConnectionStatus(null);

    try {
      const res = await testAppsScriptConnection(url);
      setScriptConnectionStatus(`Kết nối thành công! Đang liên kết với sheet "${res.sheetName || 'Active'}".`);
      setSuccessMsg('Đã xác thực Google Apps Script hoạt động chính xác.');
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi kết nối với Google Apps Script.');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleSaveAppsScript = (e: React.FormEvent) => {
    e.preventDefault();
    const url = scriptUrlInput.trim();
    if (!url) {
      setErrorMsg('Vui lòng dán URL Google Apps Script.');
      return;
    }

    const updatedConfig: GoogleSheetsSyncConfig = {
      ...config,
      scriptUrl: url,
      syncMethod: 'apps-script',
      autoPush: scriptAutoPush,
    };

    saveGoogleSheetsSyncConfig(userScopeKey, updatedConfig);
    setConfig(updatedConfig);
    setSuccessMsg('Đã kích hoạt chế độ đồng bộ 2 chiều qua Apps Script!');
    setTimeout(() => onClose(), 1200);
  };

  const handlePushAllToAppsScript = async () => {
    const url = scriptUrlInput.trim() || config.scriptUrl;
    if (!url) {
      setErrorMsg('Vui lòng nhập URL Google Apps Script trước.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await pushAllTasksToGoogleSheet(url, tasks);
      const msg = `Đã đẩy toàn bộ ${res.count} công việc lên Google Sheet thành công!`;
      setSuccessMsg(msg);
      saveGoogleSheetsSyncConfig(userScopeKey, {
        ...config,
        scriptUrl: url,
        syncMethod: 'apps-script',
        autoPush: scriptAutoPush,
        lastSyncedAt: Date.now(),
        lastTaskCount: res.count,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi đẩy dữ liệu lên Google Sheet.');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePullFromAppsScript = async () => {
    const url = scriptUrlInput.trim() || config.scriptUrl;
    if (!url) {
      setErrorMsg('Vui lòng nhập URL Google Apps Script trước.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const incoming = await pullTasksFromAppsScript(url);
      if (!incoming.length) {
        throw new Error('Google Sheet chưa có dữ liệu công việc nào.');
      }

      const merged = mergePersonalTasks(tasks, incoming);
      onTasksUpdated(merged, `Đã kéo ${incoming.length} công việc từ Google Sheet về máy.`);
      setSuccessMsg(`Đã kéo thành công ${incoming.length} công việc từ Google Sheet.`);
      saveGoogleSheetsSyncConfig(userScopeKey, {
        ...config,
        scriptUrl: url,
        syncMethod: 'apps-script',
        autoPush: scriptAutoPush,
        lastSyncedAt: Date.now(),
        lastTaskCount: incoming.length,
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi kéo dữ liệu từ Google Sheet.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- 1-WAY ACTIONS ---
  const handleSync1Way = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUrl = urlInput.trim();
    if (!targetUrl) {
      setErrorMsg('Vui lòng nhập đường link Google Sheets.');
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const result = await fetchGoogleSheetTasks(targetUrl);
      const incomingTasks = result.tasks;

      if (!incomingTasks.length) {
        throw new Error('Không tìm thấy dòng công việc nào trong sheet.');
      }

      const updatedTasks =
        syncMode === 'replace' ? incomingTasks : mergePersonalTasks(tasks, incomingTasks);

      const now = Date.now();
      const updatedConfig: GoogleSheetsSyncConfig = {
        ...config,
        sheetUrl: targetUrl,
        syncMode,
        autoSync,
        lastSyncedAt: now,
        lastTaskCount: incomingTasks.length,
        selectedSheetName: result.sheetName,
      };

      saveGoogleSheetsSyncConfig(userScopeKey, updatedConfig);
      setConfig(updatedConfig);

      const msg = `Đã đồng bộ ${incomingTasks.length} công việc từ Google Sheet (Sheet: "${result.sheetName}").`;
      setSuccessMsg(msg);
      onTasksUpdated(updatedTasks, msg);

      setTimeout(() => onClose(), 1500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi khi đồng bộ từ Google Sheets.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnlink = () => {
    if (!window.confirm('Bạn có chắc muốn hủy liên kết Google Sheet này không? (Công việc hiện tại trên bảng sẽ không bị xóa).')) {
      return;
    }
    clearGoogleSheetsSyncConfig(userScopeKey);
    const emptyConfig: GoogleSheetsSyncConfig = {
      sheetUrl: '',
      scriptUrl: '',
      syncMethod: 'service-account',
      autoSync: false,
      autoPush: true,
      syncMode: 'merge',
    };
    setConfig(emptyConfig);
    setSaSheetUrl('');
    setUrlInput('');
    setScriptUrlInput('');
    setSaConnectionStatus(null);
    setScriptConnectionStatus(null);
    setSuccessMsg('Đã hủy liên kết Google Sheet.');
    setErrorMsg(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden relative max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-3 border-b border-slate-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200 flex-shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Đồng bộ Google Sheets
                </h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                  Hai chiều (2-Way)
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Thêm/sửa việc trên Sheet &harr; Tự động cập nhật trên App và ngược lại
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1.5 pt-3 pb-2 border-b border-slate-100 flex-shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              setActiveTab('service-account');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              activeTab === 'service-account'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Chỉ cần Link (Tự động 2 chiều)</span>
            <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/30 text-amber-100 font-normal">Mới</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('apps-script');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              activeTab === 'apps-script'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Thủ công (Apps Script)</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('1way');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer flex-shrink-0 ${
              activeTab === '1way'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <DownloadCloud className="w-3.5 h-3.5" />
            <span>Chỉ kéo về (1 chiều)</span>
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pr-1 py-3 space-y-4">
          {/* Alerts */}
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1 leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* TAB 1: SERVICE ACCOUNT (ZERO-SCRIPT UX) */}
          {activeTab === 'service-account' && (
            <div className="space-y-4">
              {/* Server Status & Email Card */}
              {saStatus?.configured ? (
                <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl text-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-emerald-900 flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600" />
                      Bước 1: Chia sẻ file Google Sheet cho Email Robot hệ thống
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full border border-emerald-300">
                      Sẵn sàng 2 chiều
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-600 leading-relaxed">
                    Mở file Google Sheet &gt; Nhấn nút <strong>Chia sẻ (Share)</strong> góc trên bên phải &gt; Thêm email bên dưới với quyền <strong>Người chỉnh sửa (Editor)</strong>:
                  </p>

                  <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-emerald-300">
                    <Mail className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <span className="font-mono text-xs text-slate-800 select-all flex-1 truncate">
                      {saStatus.clientEmail}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopySaEmail}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold rounded text-xs transition-colors cursor-pointer flex-shrink-0"
                    >
                      {copiedSaEmail ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedSaEmail ? 'Đã chép!' : 'Sao chép email'}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs space-y-2">
                  <div className="font-bold text-amber-900 flex items-center gap-1.5">
                    <Info className="w-4 h-4 text-amber-600" />
                    Máy chủ đang chờ cấu hình Google Service Account
                  </div>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Để kích hoạt tính năng tự động chỉ bằng đường link, vui lòng đặt file credentials <strong><code>google-service-account.json</code></strong> vào thư mục dự án hoặc cấu hình biến môi trường <strong><code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code></strong> và <strong><code>GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY</code></strong> trong file <code>.env</code>.
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Trong khi chờ cấu hình, bạn có thể bấm sang tab <strong>Thủ công (Apps Script)</strong> hoặc <strong>Chỉ kéo về (1 chiều)</strong> để sử dụng ngay!
                  </p>
                </div>
              )}

              {/* Step 2 Form */}
              <form onSubmit={handleSaveServiceAccount} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                      Bước 2: Dán đường link Google Sheets của bạn
                    </span>
                    {config.syncMethod === 'service-account' && config.sheetUrl && (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Đang kích hoạt tự động 2 chiều
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      required
                      value={saSheetUrl}
                      onChange={(e) => setSaSheetUrl(e.target.value)}
                      placeholder="https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5.../edit"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleTestServiceAccount}
                      disabled={isLoading || !saSheetUrl.trim()}
                      className="px-3 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1 disabled:opacity-50 cursor-pointer flex-shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                      <span>{isLoading ? 'Đang thử…' : 'Kiểm tra'}</span>
                    </button>
                  </div>
                  {saConnectionStatus && (
                    <div className="mt-1 text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {saConnectionStatus}
                    </div>
                  )}
                </div>

                {/* Auto Push Checkbox */}
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                  <label className="flex items-center justify-between cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={saAutoPush}
                        onChange={(e) => setSaAutoPush(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Tự động ghi lên Google Sheet tức thì (Realtime Push)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Tạo việc mới, đổi trạng thái hoặc kéo thả Kanban trên App sẽ tự động cập nhật dòng tương ứng trên Sheet ngay lập tức.
                        </div>
                      </div>
                    </div>
                    <CheckCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  </label>
                </div>

                {/* Quick 2-way Operations */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-700">Thao tác đồng bộ tức thời:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handlePushAllViaServiceAccount}
                      disabled={isLoading || !saSheetUrl.trim()}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <UploadCloud className="w-4 h-4 text-indigo-600" />
                      <span>Đẩy tất cả {tasks.length} việc lên Sheet</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePullViaServiceAccount}
                      disabled={isLoading || !saSheetUrl.trim()}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <DownloadCloud className="w-4 h-4 text-emerald-600" />
                      <span>Kéo công việc từ Sheet về máy</span>
                    </button>
                  </div>
                </div>

                {/* Submit button */}
                <div className="flex items-center justify-between pt-2">
                  {config.sheetUrl && config.syncMethod === 'service-account' ? (
                    <button
                      type="button"
                      onClick={handleUnlink}
                      className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hủy liên kết 2 chiều</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <button
                    type="submit"
                    disabled={!saSheetUrl.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Lưu &amp; Kích hoạt 2 chiều</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 2: APPS SCRIPT (MANUAL 2-WAY) */}
          {activeTab === 'apps-script' && (
            <div className="space-y-4">
              {/* Setup Guide Banner */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-2">
                <div className="font-bold text-slate-800 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-amber-500" />
                    Cài đặt 2 chiều trong 1 phút (không cần tài khoản Google Cloud):
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyScript}
                    className="inline-flex items-center gap-1 px-2.5 py-1 bg-white border border-slate-300 hover:border-emerald-500 text-emerald-700 font-semibold rounded-lg text-xs shadow-2xs transition-colors cursor-pointer"
                  >
                    {copiedScript ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedScript ? 'Đã sao chép!' : 'Sao chép mã Script'}</span>
                  </button>
                </div>

                <ol className="list-decimal list-inside space-y-1.5 text-[11px] text-slate-600 pl-1 leading-relaxed">
                  <li>
                    Mở file Google Sheets &gt; Chọn menu <strong>Tiện ích mở rộng (Extensions)</strong> &gt; <strong>Apps Script</strong>.
                  </li>
                  <li>
                    Xóa hết code cũ, nhấn nút <strong>Sao chép mã Script</strong> ở trên và dán vào &gt; Nhấn <strong>Lưu (Ctrl+S)</strong>.
                  </li>
                  <li>
                    Nhấn nút <strong>Triển khai (Deploy)</strong> góc trên bên phải &gt; <strong>Tùy chọn triển khai mới (New deployment)</strong>:
                    <div className="pl-4 mt-0.5 space-y-0.5 text-slate-700 font-medium">
                      &bull; Chọn loại: <strong>Ứng dụng web (Web app)</strong><br />
                      &bull; Ai có quyền truy cập (Who has access): Chọn <strong>Bất kỳ ai (Anyone)</strong> &gt; Bấm <strong>Triển khai (Deploy)</strong>.
                    </div>
                  </li>
                  <li>
                    Sao chép <strong>URL ứng dụng web</strong> (kết thúc bằng <code className="bg-slate-200 px-1 rounded text-slate-800">/exec</code>) và dán vào ô bên dưới.
                  </li>
                </ol>
              </div>

              {/* Web App URL Input Form */}
              <form onSubmit={handleSaveAppsScript} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                      URL Ứng dụng web Google Apps Script (/exec)
                    </span>
                    {config.syncMethod === 'apps-script' && config.scriptUrl && (
                      <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                        <CheckCheck className="w-3.5 h-3.5" />
                        Đang kích hoạt Apps Script 2 chiều
                      </span>
                    )}
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="url"
                      required
                      value={scriptUrlInput}
                      onChange={(e) => setScriptUrlInput(e.target.value)}
                      placeholder="https://script.google.com/macros/s/AKfycb.../exec"
                      className="flex-1 px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all font-mono"
                    />
                    <button
                      type="button"
                      onClick={handleTestAppsScript}
                      disabled={testingConnection || !scriptUrlInput.trim()}
                      className="px-3 py-2 border border-slate-300 hover:bg-slate-100 rounded-xl text-xs font-semibold text-slate-700 flex items-center gap-1 disabled:opacity-50 cursor-pointer flex-shrink-0"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${testingConnection ? 'animate-spin' : ''}`} />
                      <span>{testingConnection ? 'Đang thử…' : 'Kiểm tra'}</span>
                    </button>
                  </div>
                  {scriptConnectionStatus && (
                    <div className="mt-1 text-[11px] font-medium text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {scriptConnectionStatus}
                    </div>
                  )}
                </div>

                {/* Auto Push Checkbox */}
                <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200">
                  <label className="flex items-center justify-between cursor-pointer select-none">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={scriptAutoPush}
                        onChange={(e) => setScriptAutoPush(e.target.checked)}
                        className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                      />
                      <div>
                        <div className="text-xs font-bold text-slate-900">
                          Tự động ghi lên Google Sheet tức thì (Realtime Push)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Tạo việc mới, đổi trạng thái hoặc kéo thả Kanban trên App sẽ tự động cập nhật dòng tương ứng trên Sheet ngay lập tức.
                        </div>
                      </div>
                    </div>
                    <CheckCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  </label>
                </div>

                {/* Manual 2-way Actions */}
                <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                  <div className="text-xs font-bold text-slate-700">Thao tác đồng bộ tức thời:</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={handlePushAllToAppsScript}
                      disabled={isLoading || !scriptUrlInput.trim()}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <UploadCloud className="w-4 h-4 text-indigo-600" />
                      <span>Đẩy tất cả {tasks.length} việc lên Sheet</span>
                    </button>

                    <button
                      type="button"
                      onClick={handlePullFromAppsScript}
                      disabled={isLoading || !scriptUrlInput.trim()}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <DownloadCloud className="w-4 h-4 text-emerald-600" />
                      <span>Kéo công việc từ Sheet về máy</span>
                    </button>
                  </div>
                </div>

                {/* Save button */}
                <div className="flex items-center justify-between pt-2">
                  {config.scriptUrl && config.syncMethod === 'apps-script' ? (
                    <button
                      type="button"
                      onClick={handleUnlink}
                      className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Hủy liên kết 2 chiều</span>
                    </button>
                  ) : (
                    <div />
                  )}

                  <button
                    type="submit"
                    disabled={!scriptUrlInput.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                    <span>Lưu &amp; Kích hoạt 2 chiều</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* TAB 3: ONE-WAY READ VIA PUBLIC LINK */}
          {activeTab === '1way' && (
            <form onSubmit={handleSync1Way} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                    Đường link Google Sheets (chế độ xem)
                  </span>
                </label>
                <input
                  type="url"
                  required
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="https://docs.google.com/spreadsheets/d/1AbC.../edit?usp=sharing"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all font-mono"
                />
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1">
                <div className="font-semibold text-slate-800">Yêu cầu quyền truy cập:</div>
                <p className="text-[11px] text-slate-600">
                  Mở file trên Google Sheets &gt; Nhấn <strong>Chia sẻ</strong> &gt; Đổi quyền thành <strong>"Bất kỳ ai có đường liên kết đều có thể xem"</strong>.
                </p>
                <div className="pt-1 flex items-center justify-between border-t border-slate-200 mt-2">
                  <span className="text-[11px] text-slate-500">Chưa có mẫu?</span>
                  <button
                    type="button"
                    onClick={downloadExcelTemplate}
                    className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold hover:underline cursor-pointer"
                  >
                    <Download className="w-3 h-3" />
                    Tải mẫu Excel chuẩn
                  </button>
                </div>
              </div>

              {/* Mode Selection */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                  Cách nạp công việc vào bảng:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                      syncMode === 'merge'
                        ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 font-medium'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="syncMode"
                      value="merge"
                      checked={syncMode === 'merge'}
                      onChange={() => setSyncMode('merge')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-bold">Gộp việc (Khuyên dùng)</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Giữ lại việc đang có, chỉ thêm việc mới hoặc cập nhật việc trùng tiêu đề.
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs cursor-pointer transition-colors ${
                      syncMode === 'replace'
                        ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 font-medium'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="syncMode"
                      value="replace"
                      checked={syncMode === 'replace'}
                      onChange={() => setSyncMode('replace')}
                      className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                    />
                    <div>
                      <div className="font-bold">Thay thế toàn bộ</div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Xóa danh sách việc cá nhân hiện tại và nạp 100% việc từ Sheet.
                      </div>
                    </div>
                  </label>
                </div>
              </div>

              {/* Auto Sync Toggle */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <label className="flex items-center justify-between cursor-pointer select-none">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={autoSync}
                      onChange={(e) => setAutoSync(e.target.checked)}
                      className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
                    />
                    <div>
                      <div className="text-xs font-bold text-slate-800">
                        Tự động đồng bộ mỗi khi mở tab Công việc cá nhân
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5">
                        Hệ thống sẽ tự kéo dữ liệu mới nhất từ Sheet mà không cần bạn bấm nút.
                      </div>
                    </div>
                  </div>
                  <RefreshCw className="w-4 h-4 text-slate-400" />
                </label>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-between pt-2">
                {config.sheetUrl && config.syncMethod !== 'service-account' ? (
                  <button
                    type="button"
                    onClick={handleUnlink}
                    className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Hủy liên kết link</span>
                  </button>
                ) : (
                  <div />
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading || !urlInput.trim()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                    <span>{isLoading ? 'Đang tải…' : 'Đồng bộ ngay'}</span>
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 flex-shrink-0">
          <div>
            {config.lastSyncedAt ? (
              <span>Đồng bộ lần cuối: {new Date(config.lastSyncedAt).toLocaleString('vi-VN')}</span>
            ) : (
              <span>Chưa từng đồng bộ</span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 font-medium cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
