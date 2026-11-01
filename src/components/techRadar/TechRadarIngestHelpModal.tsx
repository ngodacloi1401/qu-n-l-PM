import React, { useState } from 'react';
import { X, Copy, Check, Terminal, Code, Sparkles, Send } from 'lucide-react';

interface TechRadarIngestHelpModalProps {
  onClose: () => void;
  onSeedSample: () => void;
}

export const TechRadarIngestHelpModal: React.FC<TechRadarIngestHelpModalProps> = ({
  onClose,
  onSeedSample,
}) => {
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedJson, setCopiedJson] = useState(false);

  const curlExample = `curl -X POST http://localhost:3000/api/tech-radar/articles \\
  -H "Content-Type: application/json" \\
  -d '{
    "title": "DeepSeek R1 & Đột phá Mô hình Reasoning Mở",
    "category": "global-ai",
    "publishedDate": "2026-11-01",
    "sourceName": "AI Research Daily",
    "sourceUrl": "https://arxiv.org",
    "author": "Tech Radar Bot",
    "summary": "Mô hình reasoning mở đạt benchmark tương đương các mô hình hàng đầu với chi phí tối ưu.",
    "keyTakeaways": [
      "Chi phí inference giảm 80% nhờ kỹ thuật distilled chain-of-thought",
      "Doanh nghiệp dịch chuyển sang self-host private cloud"
    ],
    "contentMarkdown": "### Đột phá công nghệ\\nNội dung chi tiết phân tích...",
    "tags": ["Reasoning", "OpenSource", "DeepSeek"],
    "hotScore": 950
  }'`;

  const jsonBatchExample = `{
  "articles": [
    {
      "title": "Bản tin 1...",
      "category": "big-tech-releases",
      "summary": "...",
      "keyTakeaways": ["..."]
    },
    {
      "title": "Bản tin 2...",
      "category": "github-trending",
      "summary": "...",
      "keyTakeaways": ["..."]
    }
  ]
}`;

  const handleCopy = (text: string, setCopied: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">API Nạp Tự Động Báo Cáo Research</h2>
              <p className="text-xs text-slate-500">Cách bot, script hoặc subagent đẩy tin tức hằng ngày vào Radar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 text-sm text-slate-700 max-h-[75vh] overflow-y-auto">
          <div>
            <h3 className="font-semibold text-slate-900 mb-1">1. Endpoint Nạp Báo Cáo</h3>
            <div className="flex items-center gap-2 bg-slate-900 text-emerald-400 px-3.5 py-2 rounded-lg font-mono text-xs">
              <span className="font-bold text-amber-400">POST</span>
              <span>/api/tech-radar/articles</span>
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              Hỗ trợ nạp 1 bài viết đơn lẻ hoặc mảng nhiều bài viết (batch). Hệ thống tự động chống trùng lặp dựa trên <code className="text-indigo-600 bg-indigo-50 px-1 rounded font-mono">sourceUrl</code> hoặc <code className="text-indigo-600 bg-indigo-50 px-1 rounded font-mono">title</code>.
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-semibold text-slate-900 flex items-center gap-1.5">
                <Code className="w-4 h-4 text-indigo-600" />
                <span>Ví dụ lệnh cURL đẩy bài từ terminal / cron script:</span>
              </h3>
              <button
                onClick={() => handleCopy(curlExample, setCopiedCurl)}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
              >
                {copiedCurl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCurl ? 'Đã chép' : 'Sao chép cURL'}</span>
              </button>
            </div>
            <pre className="p-3.5 bg-slate-950 text-slate-200 rounded-xl font-mono text-xs overflow-x-auto leading-5">
              <code>{curlExample}</code>
            </pre>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <h3 className="font-semibold text-slate-900">2. Nạp hàng loạt (Batch JSON):</h3>
              <button
                onClick={() => handleCopy(jsonBatchExample, setCopiedJson)}
                className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium cursor-pointer"
              >
                {copiedJson ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedJson ? 'Đã chép' : 'Sao chép JSON'}</span>
              </button>
            </div>
            <pre className="p-3 bg-slate-100 text-slate-800 rounded-xl font-mono text-xs overflow-x-auto">
              <code>{jsonBatchExample}</code>
            </pre>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Muốn nạp ngay bộ bài mẫu thịnh hành để xem thử?
            </span>
            <button
              onClick={() => {
                onSeedSample();
                onClose();
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold border border-indigo-200 transition-colors cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
              <span>Khởi tạo bài viết mẫu ngay</span>
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-sm font-medium transition-colors cursor-pointer"
          >
            Đã hiểu
          </button>
        </div>
      </div>
    </div>
  );
};
