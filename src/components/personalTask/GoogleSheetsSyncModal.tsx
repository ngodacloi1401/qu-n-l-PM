import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Download,
  Trash2,
  X,
  Link2,
  HelpCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import type { PersonalTask } from '../../types/personalTask';
import {
  getGoogleSheetsSyncConfig,
  saveGoogleSheetsSyncConfig,
  clearGoogleSheetsSyncConfig,
  fetchGoogleSheetTasks,
  mergePersonalTasks,
  type GoogleSheetsSyncConfig,
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
  const [urlInput, setUrlInput] = useState(config.sheetUrl);
  const [syncMode, setSyncMode] = useState<'merge' | 'replace'>(config.syncMode || 'merge');
  const [autoSync, setAutoSync] = useState(config.autoSync || false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Sync state if user changes inputs
  useEffect(() => {
    setUrlInput(config.sheetUrl);
    setSyncMode(config.syncMode || 'merge');
    setAutoSync(config.autoSync || false);
  }, [config]);

  const handleSync = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
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
        throw new Error('Không tìm thấy dòng công việc nào trong sheet. Vui lòng kiểm tra lại nội dung bảng tính.');
      }

      let updatedTasks: PersonalTask[] = [];
      if (syncMode === 'replace') {
        updatedTasks = incomingTasks;
      } else {
        updatedTasks = mergePersonalTasks(tasks, incomingTasks);
      }

      const now = Date.now();
      const updatedConfig: GoogleSheetsSyncConfig = {
        sheetUrl: targetUrl,
        syncMode,
        autoSync,
        lastSyncedAt: now,
        lastTaskCount: incomingTasks.length,
        selectedSheetName: result.sheetName,
      };

      saveGoogleSheetsSyncConfig(userScopeKey, updatedConfig);
      setConfig(updatedConfig);

      const msg =
        syncMode === 'replace'
          ? `Đã nạp mới ${incomingTasks.length} công việc từ Google Sheet (Sheet: "${result.sheetName}").`
          : `Đã đồng bộ ${incomingTasks.length} công việc từ Google Sheet (Sheet: "${result.sheetName}").`;

      setSuccessMsg(msg);
      onTasksUpdated(updatedTasks, msg);

      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Lỗi đồng bộ Google Sheets:', err);
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
      autoSync: false,
      syncMode: 'merge',
    };
    setConfig(emptyConfig);
    setUrlInput('');
    setSuccessMsg('Đã hủy liên kết Google Sheet.');
    setErrorMsg(null);
  };

  const formatLastSynced = (timestamp?: number) => {
    if (!timestamp) return 'Chưa từng đồng bộ';
    return new Intl.DateTimeFormat('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(timestamp));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 overflow-hidden relative">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Tự động Đồng bộ từ Google Sheets
              </h3>
              <p className="text-xs text-slate-500">
                Thêm/sửa công việc trên Google Sheets, ứng dụng tự động nạp vào Việc cá nhân
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Alerts */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 leading-relaxed">{errorMsg}</div>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSync} className="mt-4 space-y-4">
          {/* Input Google Sheet Link */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-emerald-600" />
                Đường link file Google Sheets (URL)
              </span>
              {config.sheetUrl && (
                <span className="text-[11px] font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Đang liên kết
                </span>
              )}
            </label>
            <input
              type="url"
              required
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/1AbC.../edit?usp=sharing"
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition-all font-mono"
            />
          </div>

          {/* Quick Guide Banner */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600 space-y-1.5">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-indigo-500" />
              Cách lấy link Google Sheets hoạt động:
            </div>
            <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 pl-1">
              <li>Mở file trên Google Sheets &gt; Nhấn nút <strong>"Chia sẻ"</strong> (góc trên bên phải).</li>
              <li>Tại mục <em>Quyền truy cập chung</em>, chọn <strong>"Bất kỳ ai có đường liên kết"</strong> (Người xem).</li>
              <li>Nhấn <strong>"Sao chép đường liên kết"</strong> rồi dán vào ô trên.</li>
            </ol>
            <div className="pt-1 flex items-center justify-between border-t border-slate-200/60 mt-1">
              <span className="text-[11px] text-slate-500">Chưa có bảng mẫu?</span>
              <button
                type="button"
                onClick={downloadExcelTemplate}
                className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-semibold hover:underline cursor-pointer"
              >
                <Download className="w-3 h-3" />
                Tải file mẫu Excel chuẩn để tải lên Drive
              </button>
            </div>
          </div>

          {/* Sync Mode Selection */}
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
            <div className="text-xs font-bold text-slate-700">Chế độ đồng bộ:</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  syncMode === 'merge'
                    ? 'bg-emerald-50/50 border-emerald-300 text-slate-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
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
                <div className="text-xs">
                  <div className="font-semibold text-slate-900">Gộp &amp; Cập nhật (Merge)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Giữ việc cũ, cập nhật việc trùng và bổ sung việc mới thêm trên Sheet.
                  </div>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-2.5 rounded-lg border cursor-pointer transition-colors ${
                  syncMode === 'replace'
                    ? 'bg-amber-50/50 border-amber-300 text-slate-900'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                }`}
              >
                <input
                  type="radio"
                  name="syncMode"
                  value="replace"
                  checked={syncMode === 'replace'}
                  onChange={() => setSyncMode('replace')}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500"
                />
                <div className="text-xs">
                  <div className="font-semibold text-slate-900">Ghi đè toàn bộ (Replace)</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Làm mới toàn bộ danh sách theo đúng dữ liệu file Sheet.
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Auto-sync Checkbox */}
          <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-slate-300"
              />
              <span className="text-xs font-semibold text-slate-800">
                Tự động đồng bộ mỗi khi mở tab Việc cá nhân
              </span>
            </label>
            <Sparkles className="w-4 h-4 text-amber-500 flex-shrink-0" />
          </div>

          {/* Sync History / Meta info */}
          {config.lastSyncedAt && (
            <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400" />
                Lần đồng bộ gần nhất: {formatLastSynced(config.lastSyncedAt)}
              </span>
              <span>Đã nạp: {config.lastTaskCount || 0} công việc</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            {config.sheetUrl ? (
              <button
                type="button"
                onClick={handleUnlink}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Hủy liên kết</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-3.5 py-2 text-slate-600 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                disabled={isLoading || !urlInput.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-50 text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>{isLoading ? 'Đang tải & Đồng bộ…' : 'Đồng bộ ngay'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
