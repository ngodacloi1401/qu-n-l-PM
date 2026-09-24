import React, { useState, useRef } from 'react';
import { Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, X, ArrowRight, Table2, Download } from 'lucide-react';
import type { ExcelParsedSheet, ExcelColumnMapping, PersonalTask } from '../../types/personalTask';
import { parseExcelWorkbook, autoDetectMapping, convertRowsToTasks, downloadExcelTemplate } from '../../services/personalTaskExcel';

interface ExcelImportModalProps {
  onClose: () => void;
  onImport: (newTasks: PersonalTask[], mode: 'append' | 'replace') => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ onClose, onImport }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sheets, setSheets] = useState<ExcelParsedSheet[]>([]);
  const [selectedSheetIndex, setSelectedSheetIndex] = useState<number>(0);
  const [mapping, setMapping] = useState<ExcelColumnMapping | null>(null);
  const [importMode, setImportMode] = useState<'append' | 'replace'>('append');
  const [customWeek, setCustomWeek] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    setError(null);
    try {
      const buffer = await file.arrayBuffer();
      const parsedSheets = await parseExcelWorkbook(buffer);

      if (parsedSheets.length === 0 || parsedSheets.every((s) => s.rows.length === 0)) {
        throw new Error('Không tìm thấy dữ liệu hợp lệ trong file Excel. Vui lòng kiểm tra lại file.');
      }

      setSheets(parsedSheets);

      // Default to the first sheet that has rows, or sheet with 'kế hoạch' in name
      const bestSheetIdx = parsedSheets.findIndex((s) => s.name.toLowerCase().includes('kế hoạch') && s.rows.length > 0);
      const chosenIdx = bestSheetIdx !== -1 ? bestSheetIdx : parsedSheets.findIndex((s) => s.rows.length > 0);
      const activeIdx = chosenIdx !== -1 ? chosenIdx : 0;
      setSelectedSheetIndex(activeIdx);

      // Auto detect mapping
      const autoMap = autoDetectMapping(parsedSheets[activeIdx].headers);
      setMapping(autoMap);
    } catch (err: any) {
      console.error(err);
      setError(err?.message || 'Lỗi khi đọc file Excel');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSheetChange = (idx: number) => {
    setSelectedSheetIndex(idx);
    const newSheet = sheets[idx];
    if (newSheet) {
      const autoMap = autoDetectMapping(newSheet.headers);
      setMapping(autoMap);
    }
  };

  const currentSheet = sheets[selectedSheetIndex];

  // Helper to change column index in mapping
  const updateMappingCol = (field: keyof ExcelColumnMapping, colIndex: number) => {
    if (!mapping) return;
    setMapping({ ...mapping, [field]: colIndex });
  };

  const handleConfirmImport = () => {
    if (!currentSheet || !mapping) return;
    if (mapping.titleCol === -1) {
      setError('Vui lòng chọn cột chứa "Tên việc cần làm" để tiến hành nhập.');
      return;
    }

    try {
      const tasks = convertRowsToTasks(currentSheet.rows, mapping, customWeek || currentSheet.name);
      if (tasks.length === 0) {
        setError('Không tạo được việc nào từ dữ liệu đã chọn. Hãy kiểm tra cột "Tên việc cần làm".');
        return;
      }
      onImport(tasks, importMode);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Có lỗi xảy ra khi nhập dữ liệu');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900 leading-snug">Nhập đầu việc từ Excel</h3>
              <p className="text-xs text-slate-500">
                Tự động nhận diện cột hoặc tùy chỉnh mapping linh hoạt (không cần file chuẩn)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {error && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-sm flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-rose-600" />
              <div>{error}</div>
            </div>
          )}

          {sheets.length === 0 ? (
            /* Upload step */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-emerald-500 bg-slate-50/70 hover:bg-emerald-50/30 rounded-2xl p-10 text-center cursor-pointer transition-all flex flex-col items-center justify-center group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="w-16 h-16 rounded-2xl bg-white shadow-sm border border-slate-200 flex items-center justify-center text-emerald-600 group-hover:scale-105 transition-transform mb-4">
                <Upload className="w-8 h-8" />
              </div>
              <h4 className="text-base font-semibold text-slate-800">
                {isProcessing ? 'Đang đọc và phân tích file Excel...' : 'Kéo thả hoặc bấm để chọn file Excel (.xlsx)'}
              </h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Hỗ trợ cả file quản lý công việc theo tuần, kế hoạch tháng của team hoặc cá nhân
              </p>
              <button
                type="button"
                className="mt-4 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium shadow-xs transition-colors"
              >
                Chọn file từ máy tính
              </button>

              <div className="mt-5 pt-4 border-t border-slate-200 w-full flex justify-center">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    downloadExcelTemplate();
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Tải file mẫu (Template Excel)</span>
                </button>
              </div>
            </div>
          ) : (
            /* Mapping step */
            <div className="space-y-6">
              {/* Sheet selector */}
              <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-slate-100/70 rounded-xl border border-slate-200">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">Sheet dữ liệu:</span>
                  <div className="flex gap-2 flex-wrap">
                    {sheets.map((s, idx) => (
                      <button
                        key={s.name}
                        onClick={() => handleSheetChange(idx)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                          selectedSheetIndex === idx
                            ? 'bg-emerald-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 hover:bg-slate-200 border border-slate-200'
                        }`}
                      >
                        {s.name} ({s.totalRows} dòng)
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={() => {
                    setSheets([]);
                    setMapping(null);
                  }}
                  className="text-xs text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Chọn file khác
                </button>
              </div>

              {/* Column Mapping Section */}
              {currentSheet && mapping && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <Table2 className="w-4 h-4 text-emerald-600" />
                      Ghép nối cột dữ liệu (Column Mapping)
                    </h4>
                    <span className="text-xs text-slate-500">
                      Tự động gán cột dựa trên tên tiêu đề ({currentSheet.headers.length} cột phát hiện)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    {/* Tên việc (Required) */}
                    <div className="bg-white p-3 rounded-lg border border-emerald-300 shadow-xs">
                      <label className="block text-xs font-bold text-emerald-800 mb-1">
                        Tên việc cần làm <span className="text-rose-600">*</span>
                      </label>
                      <select
                        value={mapping.titleCol}
                        onChange={(e) => updateMappingCol('titleCol', Number(e.target.value))}
                        className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded font-medium text-slate-800 focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value={-1}>-- Chọn cột --</option>
                        {currentSheet.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Cột ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Tuần */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Tuần / Đợt kế hoạch</label>
                      <select
                        value={mapping.weekCol}
                        onChange={(e) => updateMappingCol('weekCol', Number(e.target.value))}
                        className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                      >
                        <option value={-1}>-- Không map (nhập mặc định) --</option>
                        {currentSheet.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Cột ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Nhóm việc */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Nhóm việc / Dự án</label>
                      <select
                        value={mapping.categoryCol}
                        onChange={(e) => updateMappingCol('categoryCol', Number(e.target.value))}
                        className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                      >
                        <option value={-1}>-- Không map --</option>
                        {currentSheet.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Cột ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Trạng thái */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Trạng thái (Status)</label>
                      <select
                        value={mapping.statusCol}
                        onChange={(e) => updateMappingCol('statusCol', Number(e.target.value))}
                        className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                      >
                        <option value={-1}>-- Không map --</option>
                        {currentSheet.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Cột ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Mức độ ưu tiên */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Mức độ ưu tiên</label>
                      <select
                        value={mapping.priorityCol}
                        onChange={(e) => updateMappingCol('priorityCol', Number(e.target.value))}
                        className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                      >
                        <option value={-1}>-- Không map --</option>
                        {currentSheet.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Cột ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Deadline */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Hạn chót (Deadline)</label>
                      <select
                        value={mapping.dueDateCol}
                        onChange={(e) => updateMappingCol('dueDateCol', Number(e.target.value))}
                        className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                      >
                        <option value={-1}>-- Không map --</option>
                        {currentSheet.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Cột ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Mô tả chi tiết */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Mô tả chi tiết</label>
                      <select
                        value={mapping.descriptionCol}
                        onChange={(e) => updateMappingCol('descriptionCol', Number(e.target.value))}
                        className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                      >
                        <option value={-1}>-- Không map --</option>
                        {currentSheet.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Cột ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Kết quả công việc */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Kết quả công việc / Ghi chú</label>
                      <select
                        value={mapping.resultNoteCol}
                        onChange={(e) => updateMappingCol('resultNoteCol', Number(e.target.value))}
                        className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                      >
                        <option value={-1}>-- Không map --</option>
                        {currentSheet.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Cột ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Thời lượng */}
                    <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Thời lượng (giờ)</label>
                      <select
                        value={mapping.estimatedHoursCol}
                        onChange={(e) => updateMappingCol('estimatedHoursCol', Number(e.target.value))}
                        className="w-full text-xs py-1.5 px-2 bg-slate-50 border border-slate-300 rounded text-slate-800"
                      >
                        <option value={-1}>-- Không map --</option>
                        {currentSheet.headers.map((h, i) => (
                          <option key={i} value={i}>
                            {h || `Cột ${i + 1}`}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Fallback default week if week column is not mapped */}
                  {mapping.weekCol === -1 && (
                    <div className="mt-3 flex items-center gap-3 text-xs text-slate-600 bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                      <span>Tên tuần áp dụng cho các việc nhập này:</span>
                      <input
                        type="text"
                        value={customWeek}
                        onChange={(e) => setCustomWeek(e.target.value)}
                        placeholder="VD: Tuần 09 (24/2-27/02)"
                        className="px-2.5 py-1 bg-white border border-amber-300 rounded text-xs text-slate-800 font-medium focus:outline-none"
                      />
                    </div>
                  )}

                  {/* Preview Table (First 3 rows) */}
                  <div className="mt-4">
                    <h5 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Xem trước dữ liệu mẫu (3 dòng đầu):
                    </h5>
                    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white shadow-xs max-h-48 text-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-slate-700 border-b border-slate-200">
                            {currentSheet.headers.map((h, i) => (
                              <th key={i} className="p-2 border-r border-slate-200 font-semibold whitespace-nowrap">
                                {h || `Cột ${i + 1}`}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {currentSheet.rows.slice(0, 3).map((row, rIdx) => (
                            <tr key={rIdx} className="border-b border-slate-100 hover:bg-slate-50">
                              {currentSheet.headers.map((_, cIdx) => (
                                <td key={cIdx} className="p-2 border-r border-slate-100 max-w-xs truncate text-slate-600">
                                  {String(row[cIdx] ?? '')}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {sheets.length > 0 && (
          <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <label className="text-xs font-semibold text-slate-700">Chế độ nhập:</label>
              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'append'}
                  onChange={() => setImportMode('append')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span>Thêm vào danh sách hiện có</span>
              </label>
              <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                <input
                  type="radio"
                  name="importMode"
                  checked={importMode === 'replace'}
                  onChange={() => setImportMode('replace')}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span>Ghi đè thay thế toàn bộ</span>
              </label>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                onClick={handleConfirmImport}
                className="inline-flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Nhập {currentSheet?.rows.length || 0} việc vào bảng</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
