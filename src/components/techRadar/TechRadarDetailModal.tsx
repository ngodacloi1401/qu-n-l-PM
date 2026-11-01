import React from 'react';
import {
  X,
  ExternalLink,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Calendar,
  Globe,
  Flame,
  MessageSquare,
  Share2,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { TechRadarArticle } from '../../types/techRadar';
import { TECH_RADAR_CATEGORIES } from '../../types/techRadar';

interface TechRadarDetailModalProps {
  article: TechRadarArticle | null;
  onClose: () => void;
  onToggleBookmark: (id: string, current: boolean) => void;
  onToggleRead: (id: string, current: boolean) => void;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export const TechRadarDetailModal: React.FC<TechRadarDetailModalProps> = ({
  article,
  onClose,
  onToggleBookmark,
  onToggleRead,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}) => {
  if (!article) return null;

  const categoryMeta = TECH_RADAR_CATEGORIES.find((c) => c.id === article.category);

  // Render basic markdown into styled elements
  const renderMarkdown = (content: string) => {
    const parts = content.split('```');
    return (
      <div className="space-y-4 text-slate-800 text-sm sm:text-base leading-relaxed">
        {parts.map((part, index) => {
          if (index % 2 === 1) {
            // Code block
            const lines = part.split('\n');
            const lang = lines[0]?.trim() || '';
            const code = lines.slice(1).join('\n');
            return (
              <div key={index} className="my-4 rounded-xl overflow-hidden border border-slate-800 shadow-sm">
                {lang && (
                  <div className="bg-slate-900 px-4 py-1.5 text-xs font-mono text-slate-400 border-b border-slate-800">
                    {lang}
                  </div>
                )}
                <pre className="bg-slate-950 p-4 text-xs sm:text-sm text-slate-200 font-mono overflow-x-auto leading-6">
                  <code>{code || part}</code>
                </pre>
              </div>
            );
          }

          // Regular paragraphs, headers, bullet points
          const paragraphs = part.split('\n\n');
          return (
            <div key={index} className="space-y-3">
              {paragraphs.map((p, pIdx) => {
                const trimmed = p.trim();
                if (!trimmed) return null;

                if (trimmed.startsWith('### ')) {
                  return (
                    <h3 key={pIdx} className="text-lg sm:text-xl font-bold text-slate-900 mt-6 mb-2">
                      {trimmed.replace(/^### /, '')}
                    </h3>
                  );
                }
                if (trimmed.startsWith('#### ')) {
                  return (
                    <h4 key={pIdx} className="text-base sm:text-lg font-semibold text-slate-900 mt-4 mb-1">
                      {trimmed.replace(/^#### /, '')}
                    </h4>
                  );
                }
                if (trimmed.startsWith('> ')) {
                  return (
                    <blockquote
                      key={pIdx}
                      className="border-l-4 border-indigo-500 pl-4 py-2 italic text-slate-600 bg-slate-50 rounded-r-lg my-3"
                    >
                      {trimmed.replace(/^> /, '')}
                    </blockquote>
                  );
                }
                if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
                  const items = trimmed.split('\n');
                  return (
                    <ul key={pIdx} className="list-disc list-inside space-y-1 pl-2 text-slate-700">
                      {items.map((it, itIdx) => (
                        <li key={itIdx}>{it.replace(/^[-*]\s+/, '')}</li>
                      ))}
                    </ul>
                  );
                }

                return (
                  <p key={pIdx} className="text-slate-700 whitespace-pre-line">
                    {trimmed}
                  </p>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };

  const handleCopyLink = () => {
    if (article.sourceUrl) {
      navigator.clipboard.writeText(article.sourceUrl);
      alert('Đã sao chép liên kết nguồn!');
    } else {
      navigator.clipboard.writeText(window.location.href);
      alert('Đã sao chép liên kết bài viết!');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden">
        {/* Modal Top Bar */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/80">
          <div className="flex items-center gap-3">
            <span
              className={`px-3 py-1 rounded-full text-xs font-semibold border ${
                categoryMeta?.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              {categoryMeta?.name || article.category}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <Calendar className="w-3.5 h-3.5" />
              <span>{article.publishedDate}</span>
            </div>
            {article.sourceName && (
              <div className="hidden sm:flex items-center gap-1 text-xs text-slate-500 font-medium">
                <span>• Nguồn:</span>
                <span className="text-slate-700">{article.sourceName}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Prev / Next navigation */}
            {hasPrev && onPrev && (
              <button
                onClick={onPrev}
                title="Bài trước đó"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            {hasNext && onNext && (
              <button
                onClick={onNext}
                title="Bài tiếp theo"
                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            )}

            {/* Bookmark */}
            <button
              onClick={() => onToggleBookmark(article.id, !!article.isBookmarked)}
              title={article.isBookmarked ? 'Bỏ lưu bài này' : 'Lưu vào mục Yêu thích'}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                article.isBookmarked
                  ? 'bg-amber-50 text-amber-600 border-amber-200 hover:bg-amber-100'
                  : 'text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              {article.isBookmarked ? <BookmarkCheck className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            </button>

            {/* Read status toggle */}
            <button
              onClick={() => onToggleRead(article.id, !!article.isRead)}
              title={article.isRead ? 'Đánh dấu chưa đọc' : 'Đánh dấu đã đọc'}
              className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                article.isRead
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-200 hover:bg-emerald-100'
                  : 'text-slate-500 border-slate-200 hover:bg-slate-100 hover:text-slate-800'
              }`}
            >
              <CheckCircle2 className="w-4 h-4" />
            </button>

            {/* Copy / Share */}
            <button
              onClick={handleCopyLink}
              title="Sao chép link"
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors cursor-pointer"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              title="Đóng cửa sổ"
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Content */}
        <div className="overflow-y-auto p-6 sm:p-8 space-y-6">
          {/* Main Title */}
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {article.title}
            </h1>
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs sm:text-sm text-slate-500">
              {article.author && <span>Tác giả: <strong className="text-slate-700 font-semibold">{article.author}</strong></span>}
              {article.hotScore ? (
                <span className="flex items-center gap-1 text-amber-600 font-semibold bg-amber-50 px-2 py-0.5 rounded">
                  <Flame className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  {article.hotScore} điểm quan tâm
                </span>
              ) : null}
              {article.discussionCount ? (
                <span className="flex items-center gap-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                  <MessageSquare className="w-3.5 h-3.5" />
                  {article.discussionCount} thảo luận
                </span>
              ) : null}
              {article.sourceUrl && (
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-semibold hover:underline"
                >
                  <Globe className="w-3.5 h-3.5" />
                  <span>Xem nguồn gốc ({article.sourceName})</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Quick TL;DR Box */}
          {article.summary && (
            <div className="p-4 sm:p-5 rounded-xl bg-gradient-to-r from-indigo-50/80 to-purple-50/80 border border-indigo-100">
              <div className="flex items-center gap-2 text-indigo-900 font-bold text-sm mb-2">
                <Sparkles className="w-4 h-4 text-indigo-600" />
                <span>Tóm tắt nhanh (TL;DR)</span>
              </div>
              <p className="text-slate-700 text-sm sm:text-base leading-relaxed">
                {article.summary}
              </p>
            </div>
          )}

          {/* Key Takeaways */}
          {article.keyTakeaways && article.keyTakeaways.length > 0 && (
            <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                Điểm tin then chốt (Key Takeaways)
              </h3>
              <ul className="space-y-2.5">
                {article.keyTakeaways.map((point, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-sm sm:text-base text-slate-800">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold">
                      ✓
                    </span>
                    <span className="leading-relaxed">{point}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Detailed Content */}
          <div className="pt-2 border-t border-slate-100">
            {renderMarkdown(article.contentMarkdown || article.summary)}
          </div>

          {/* Tags */}
          {article.tags && article.tags.length > 0 && (
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Chủ đề:</span>
              {article.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium transition-colors"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            {article.sourceUrl ? (
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 font-semibold"
              >
                <span>Mở bài viết gốc trên {article.sourceName}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span>Cập nhật qua Tech Radar Intelligence System</span>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
