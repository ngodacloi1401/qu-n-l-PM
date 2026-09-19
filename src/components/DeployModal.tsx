import React, { useState } from 'react';
import {
  X,
  GitBranch,
  ExternalLink,
  Copy,
  Check,
  Terminal,
  ShieldCheck,
  CheckCircle2,
  Server,
} from 'lucide-react';

interface DeployModalProps {
  onClose: () => void;
}

export const DeployModal: React.FC<DeployModalProps> = ({ onClose }) => {
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  const gitCommands = `git init
git add .
git commit -m "feat: Redmine PM Workspace with Vercel serverless proxy"
git branch -M main
git remote add origin https://github.com/ngodacloi1401/app-audio.git
git push -u origin main --force`;

  const copySnippet = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 text-white flex items-center justify-center font-bold">
              <GitBranch className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Deploy lên GitHub & Vercel
              </h3>
              <p className="text-xs text-slate-500">
                Dự án app-audio ({' '}
                <a
                  href="https://github.com/ngodacloi1401/app-audio"
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 underline"
                >
                  ngodacloi1401/app-audio
                </a>{' '}
                )
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Status highlight */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 flex items-start gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" />
            <div>
              <strong className="font-semibold block">Cấu hình Vercel đã sẵn sàng 100%!</strong>
              <span>
                Toàn bộ các file <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">vercel.json</code> và serverless proxy <code className="font-mono bg-emerald-100 px-1 py-0.5 rounded">/api/index.ts</code> đã được tạo sẵn để Vercel tự động build và deploy ngay khi bạn push code.
              </span>
            </div>
          </div>

          {/* Step 1: Git Push */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Terminal className="w-3.5 h-3.5 text-indigo-600" />
                Bước 1: Push mã nguồn lên GitHub Repo
              </span>
              <button
                onClick={() => copySnippet(gitCommands, 1)}
                className="inline-flex items-center gap-1 text-[11px] text-slate-600 hover:text-indigo-600 cursor-pointer"
              >
                {copiedIndex === 1 ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span className="text-emerald-700 font-semibold">Đã chép</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Sao chép lệnh</span>
                  </>
                )}
              </button>
            </div>

            <pre className="p-3 bg-slate-900 text-slate-100 rounded-xl text-xs font-mono overflow-x-auto leading-relaxed">
              {gitCommands}
            </pre>
          </div>

          {/* Step 2: Vercel Env Vars */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-600" />
              Bước 2: Cài đặt Biến Môi trường trên Vercel
            </span>
            <p className="text-xs text-slate-500">
              Vào mục <strong>Settings &gt; Environment Variables</strong> trên dự án Vercel của bạn và thêm:
            </p>

            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-mono space-y-1.5">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-indigo-600 font-bold">REDMINE_URL</span>=
                  <span className="text-slate-800">https://redmine.anybim.vn</span>
                </div>
                <button
                  onClick={() => copySnippet('https://redmine.anybim.vn', 2)}
                  className="text-[11px] text-slate-500 hover:text-indigo-600"
                >
                  {copiedIndex === 2 ? 'Đã chép' : 'Copy'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-indigo-600 font-bold">REDMINE_API_KEY</span>=
                  <span className="text-slate-800">440da87a37415860ff240080d18ba34b21536eb8</span>
                </div>
                <button
                  onClick={() => copySnippet('440da87a37415860ff240080d18ba34b21536eb8', 3)}
                  className="text-[11px] text-slate-500 hover:text-indigo-600"
                >
                  {copiedIndex === 3 ? 'Đã chép' : 'Copy'}
                </button>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-indigo-600 font-bold">GEMINI_API_KEY</span>=
                  <span className="text-slate-500">[Khóa API Gemini của bạn]</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-indigo-600 font-bold">OPENAI_API_KEY</span>=
                  <span className="text-slate-500">[Khóa API OpenAI của bạn]</span>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-indigo-600 font-bold">ANTHROPIC_API_KEY</span>=
                  <span className="text-slate-500">[Khóa API Anthropic của bạn]</span>
                </div>
              </div>
            </div>
          </div>

          {/* Direct Links */}
          <div className="pt-2 flex items-center gap-2 flex-wrap">
            <a
              href="https://vercel.com/ngodacloi1401-1798s-projects/app-audio/4da3eiPJ9Pm98gyuByDXKcyrvzUM"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-black hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-2xs transition-colors"
            >
              <span>Mở Vercel Deployment</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href="https://github.com/ngodacloi1401/app-audio"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg text-xs font-semibold border border-slate-200 transition-colors"
            >
              <span>Mở GitHub Repository</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          {/* Modal Footer */}
          <div className="flex justify-end pt-3 border-t border-slate-100">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
