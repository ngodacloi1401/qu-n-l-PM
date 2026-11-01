import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Globe,
  Sparkles,
  Building2,
  GitFork,
  Flame,
  Bot,
  Search,
  Calendar,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
  Terminal,
  Grid,
  List as ListIcon,
  MessageSquare,
  ArrowUpRight,
  TrendingUp,
  Tag,
  SlidersHorizontal,
} from 'lucide-react';
import type { TechRadarArticle, TechRadarCategory } from '../../types/techRadar';
import { TECH_RADAR_CATEGORIES } from '../../types/techRadar';
import {
  fetchRadarArticles,
  updateRadarArticle,
  seedSampleRadarArticles,
} from '../../services/techRadarApi';
import { TechRadarDetailModal } from './TechRadarDetailModal';
import { TechRadarIngestHelpModal } from './TechRadarIngestHelpModal';

export const TechRadarView: React.FC = () => {
  const [articles, setArticles] = useState<TechRadarArticle[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [todayCount, setTodayCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState<TechRadarCategory>('all');
  const [dateFilter, setDateFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [bookmarkedOnly, setBookmarkedOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Modals
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState<boolean>(false);

  // Load articles
  const loadArticles = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetchRadarArticles({
        category: selectedCategory,
        date: dateFilter,
        search: searchQuery,
        bookmarked: bookmarkedOnly,
      });
      setArticles(res.articles || []);
      setTotalCount(res.total || 0);
      setTodayCount(res.todayCount || 0);
    } catch (err: any) {
      console.error('[TechRadarView] Load error:', err);
      setError(err.message || 'Không thể tải tin tức công nghệ');
    } finally {
      setIsLoading(false);
    }
  }, [selectedCategory, dateFilter, searchQuery, bookmarkedOnly]);

  useEffect(() => {
    loadArticles();
  }, [loadArticles]);

  // Toggle bookmark
  const handleToggleBookmark = async (id: string, current: boolean) => {
    try {
      const next = !current;
      setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, isBookmarked: next } : a)));
      await updateRadarArticle(id, { isBookmarked: next });
    } catch (err) {
      console.error('Failed to toggle bookmark:', err);
      // rollback
      setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, isBookmarked: current } : a)));
    }
  };

  // Toggle read status
  const handleToggleRead = async (id: string, current: boolean) => {
    try {
      const next = !current;
      setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: next } : a)));
      await updateRadarArticle(id, { isRead: next });
    } catch (err) {
      console.error('Failed to toggle read:', err);
      // rollback
      setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, isRead: current } : a)));
    }
  };

  // Seed sample
  const handleSeedSample = async () => {
    try {
      setIsLoading(true);
      await seedSampleRadarArticles();
      await loadArticles();
    } catch (err: any) {
      alert('Lỗi khi nạp dữ liệu mẫu: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Compute category counts
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: articles.length };
    for (const a of articles) {
      counts[a.category] = (counts[a.category] || 0) + 1;
    }
    return counts;
  }, [articles]);

  const bookmarkedTotal = useMemo(() => {
    return articles.filter((a) => a.isBookmarked).length;
  }, [articles]);

  // Selected article object for modal
  const selectedArticle = useMemo(() => {
    if (!selectedArticleId) return null;
    return articles.find((a) => a.id === selectedArticleId) || null;
  }, [selectedArticleId, articles]);

  const currentIndex = useMemo(() => {
    if (!selectedArticleId) return -1;
    return articles.findIndex((a) => a.id === selectedArticleId);
  }, [selectedArticleId, articles]);

  const handlePrevArticle = () => {
    if (currentIndex > 0) {
      setSelectedArticleId(articles[currentIndex - 1].id);
    }
  };

  const handleNextArticle = () => {
    if (currentIndex >= 0 && currentIndex < articles.length - 1) {
      setSelectedArticleId(articles[currentIndex + 1].id);
    }
  };

  // Category Icon Resolver
  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Sparkles':
        return <Sparkles className="w-4 h-4 text-blue-500" />;
      case 'Building2':
        return <Building2 className="w-4 h-4 text-purple-500" />;
      case 'GitFork':
        return <GitFork className="w-4 h-4 text-emerald-500" />;
      case 'Flame':
        return <Flame className="w-4 h-4 text-amber-500 fill-amber-500" />;
      case 'Bot':
        return <Bot className="w-4 h-4 text-cyan-500" />;
      default:
        return <Globe className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Hero / Magazine Header Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-gradient-to-tr from-indigo-600 to-purple-600 rounded-xl text-white shadow-md">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
                  <span>Radar Công nghệ & Điểm tin AI</span>
                  <span className="text-[11px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200 uppercase tracking-wide">
                    Daily Digest
                  </span>
                </h1>
                <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                  Tạp chí cập nhật tự động hằng ngày: Toàn cảnh thế giới AI, GitHub repos trending, release mới của Big Tech & thảo luận cộng đồng
                </p>
              </div>
            </div>
          </div>

          {/* Quick Stats & Action Controls */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="hidden sm:flex items-center gap-3 px-3.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
              <div className="text-slate-600">
                Tổng số: <strong className="text-slate-900 font-bold">{totalCount}</strong> tin
              </div>
              <div className="w-px h-3.5 bg-slate-300" />
              <div className="text-emerald-700">
                Hôm nay: <strong className="font-bold">{todayCount}</strong> mới
              </div>
              <div className="w-px h-3.5 bg-slate-300" />
              <div className="text-amber-700">
                Đã lưu: <strong className="font-bold">{bookmarkedTotal}</strong> ⭐
              </div>
            </div>

            {/* Ingest Help Button */}
            <button
              onClick={() => setShowHelpModal(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold border border-slate-200 transition-colors cursor-pointer"
              title="Xem hướng dẫn API nạp bài tự động từ script / bot"
            >
              <Terminal className="w-3.5 h-3.5 text-indigo-600" />
              <span>API Nạp Tự Động</span>
            </button>

            {/* Refresh Button */}
            <button
              onClick={loadArticles}
              disabled={isLoading}
              title="Làm mới điểm tin"
              className={`p-2 bg-white hover:bg-slate-100 text-slate-700 rounded-lg border border-slate-200 transition-colors cursor-pointer ${
                isLoading ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-indigo-600' : ''}`} />
            </button>
          </div>
        </div>

        {/* Categories Tab Navigation */}
        <div className="mt-5 pt-5 border-t border-slate-100 flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
          {TECH_RADAR_CATEGORIES.map((cat) => {
            const isActive = selectedCategory === cat.id;
            const count = categoryCounts[cat.id] ?? 0;
            return (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-sm ring-1 ring-slate-900'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 hover:text-slate-900'
                }`}
              >
                {getCategoryIcon(cat.iconName)}
                <span>{cat.name}</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isActive ? 'bg-slate-800 text-slate-200' : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Content Area */}
      <div>
        {/* Filter and Search Bar */}
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 mb-6">
          {/* Search Input */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm theo chủ đề, tiêu đề, công ty, tag (ví dụ: DeepSeek, Claude, GitHub, reasoning...)"
              className="w-full pl-9 pr-4 py-2 bg-slate-50 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Date filter dropdown */}
            <div className="relative flex items-center">
              <Calendar className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="pl-8 pr-7 py-2 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
              >
                <option value="all">Tất cả ngày</option>
                <option value={new Date().toISOString().slice(0, 10)}>Hôm nay</option>
                <option value={new Date(Date.now() - 86400000).toISOString().slice(0, 10)}>Hôm qua</option>
              </select>
            </div>

            {/* Bookmarked Filter Pill */}
            <button
              onClick={() => setBookmarkedOnly(!bookmarkedOnly)}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                bookmarkedOnly
                  ? 'bg-amber-50 text-amber-800 border-amber-300 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200'
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 ${bookmarkedOnly ? 'fill-amber-500 text-amber-500' : ''}`} />
              <span>Đã lưu</span>
            </button>

            {/* Layout switch */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                title="Chế độ Tạp chí (Lưới)"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                title="Chế độ Danh sách"
                className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                  viewMode === 'list' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <ListIcon className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="py-20 flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mb-3" />
            <p className="text-sm font-semibold text-slate-700">Đang cập nhật luồng tin tức công nghệ...</p>
            <p className="text-xs text-slate-400 mt-1">Đang đồng bộ dữ liệu research mới nhất</p>
          </div>
        )}

        {/* Error State */}
        {!isLoading && error && (
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center">
            <p className="text-sm font-semibold text-rose-800">{error}</p>
            <button
              onClick={loadArticles}
              className="mt-3 px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer"
            >
              Thử lại
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !error && articles.length === 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-xl mx-auto shadow-xs">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Sparkles className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-900">Chưa có bài viết nào phù hợp bộ lọc</h3>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 mb-6">
              Bạn có thể làm mới bộ lọc, tìm kiếm từ khóa khác, hoặc nạp ngay bộ bài nghiên cứu mẫu để đọc thử.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={handleSeedSample}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Nạp bộ tin tức mẫu thịnh hành
              </button>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setDateFilter('all');
                  setSearchQuery('');
                  setBookmarkedOnly(false);
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Xóa tất cả bộ lọc
              </button>
            </div>
          </div>
        )}

        {/* Grid Mode (Magazine Cards) */}
        {!isLoading && !error && articles.length > 0 && viewMode === 'grid' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {articles.map((article) => {
              const categoryMeta = TECH_RADAR_CATEGORIES.find((c) => c.id === article.category);
              return (
                <article
                  key={article.id}
                  onClick={() => {
                    setSelectedArticleId(article.id);
                    if (!article.isRead) {
                      handleToggleRead(article.id, false);
                    }
                  }}
                  className={`bg-white rounded-2xl border transition-all duration-200 hover:shadow-lg hover:border-indigo-300 flex flex-col justify-between overflow-hidden cursor-pointer group ${
                    article.isRead ? 'border-slate-200/80 bg-white/90' : 'border-slate-300 shadow-xs'
                  }`}
                >
                  {/* Card Header */}
                  <div className="p-5 pb-3">
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                          categoryMeta?.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {categoryMeta?.name || article.category}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {article.hotScore ? (
                          <span
                            title="Điểm độ hot / upvotes"
                            className="flex items-center gap-0.5 text-[11px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md"
                          >
                            <Flame className="w-3 h-3 fill-amber-500 text-amber-500" />
                            {article.hotScore}
                          </span>
                        ) : null}

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleBookmark(article.id, !!article.isBookmarked);
                          }}
                          className={`p-1 rounded-md transition-colors ${
                            article.isBookmarked
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'text-slate-300 hover:text-slate-600'
                          }`}
                        >
                          <Bookmark className={`w-4 h-4 ${article.isBookmarked ? 'fill-amber-400' : ''}`} />
                        </button>
                      </div>
                    </div>

                    {/* Title */}
                    <h2 className="text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors line-clamp-2 leading-snug">
                      {article.title}
                    </h2>

                    {/* Source and Date */}
                    <div className="flex items-center gap-2 mt-2 text-[11px] text-slate-400 font-medium">
                      <span>{article.sourceName}</span>
                      <span>•</span>
                      <span>{article.publishedDate}</span>
                      {!article.isRead && (
                        <span className="w-2 h-2 rounded-full bg-indigo-600 ml-auto" title="Chưa đọc" />
                      )}
                    </div>

                    {/* Summary */}
                    <p className="text-xs text-slate-600 mt-3 line-clamp-3 leading-relaxed">
                      {article.summary}
                    </p>

                    {/* Key Takeaways preview (first 2 items) */}
                    {article.keyTakeaways && article.keyTakeaways.length > 0 && (
                      <div className="mt-3.5 pt-3 border-t border-slate-100 space-y-1.5">
                        {article.keyTakeaways.slice(0, 2).map((point, pIdx) => (
                          <div key={pIdx} className="flex items-start gap-1.5 text-[11px] text-slate-700">
                            <span className="text-emerald-600 font-bold leading-none mt-0.5">✓</span>
                            <span className="line-clamp-1">{point}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Card Footer */}
                  <div className="px-5 py-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between text-[11px]">
                    <div className="flex items-center gap-1.5 overflow-hidden">
                      {article.tags?.slice(0, 2).map((tag, tIdx) => (
                        <span key={tIdx} className="text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200">
                          #{tag}
                        </span>
                      ))}
                    </div>

                    <span className="inline-flex items-center gap-1 font-semibold text-indigo-600 group-hover:translate-x-0.5 transition-transform">
                      <span>Đọc tiếp</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {/* List Mode (Compact View) */}
        {!isLoading && !error && articles.length > 0 && viewMode === 'list' && (
          <div className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100 shadow-xs overflow-hidden">
            {articles.map((article) => {
              const categoryMeta = TECH_RADAR_CATEGORIES.find((c) => c.id === article.category);
              return (
                <div
                  key={article.id}
                  onClick={() => {
                    setSelectedArticleId(article.id);
                    if (!article.isRead) {
                      handleToggleRead(article.id, false);
                    }
                  }}
                  className="p-4 sm:p-5 hover:bg-slate-50 transition-colors cursor-pointer flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                          categoryMeta?.badgeColor || 'bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {categoryMeta?.name || article.category}
                      </span>
                      <span className="text-xs text-slate-400">• {article.publishedDate}</span>
                      <span className="text-xs text-slate-500 font-medium">• {article.sourceName}</span>
                      {article.hotScore ? (
                        <span className="flex items-center gap-0.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded">
                          <Flame className="w-3 h-3 fill-amber-500 text-amber-500" />
                          {article.hotScore}
                        </span>
                      ) : null}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">
                      {article.title}
                    </h3>
                    <p className="text-xs text-slate-500 line-clamp-1 mt-1">{article.summary}</p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleBookmark(article.id, !!article.isBookmarked);
                      }}
                      className={`p-1.5 rounded-lg border transition-colors ${
                        article.isBookmarked
                          ? 'bg-amber-50 text-amber-600 border-amber-200'
                          : 'text-slate-400 border-slate-200 hover:text-slate-800'
                      }`}
                    >
                      <Bookmark className={`w-4 h-4 ${article.isBookmarked ? 'fill-amber-500' : ''}`} />
                    </button>
                    <span className="text-xs font-semibold text-indigo-600 group-hover:underline flex items-center gap-1">
                      <span>Chi tiết</span>
                      <ArrowUpRight className="w-3.5 h-3.5" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Reader Modal */}
      {selectedArticle && (
        <TechRadarDetailModal
          article={selectedArticle}
          onClose={() => setSelectedArticleId(null)}
          onToggleBookmark={handleToggleBookmark}
          onToggleRead={handleToggleRead}
          onPrev={handlePrevArticle}
          onNext={handleNextArticle}
          hasPrev={currentIndex > 0}
          hasNext={currentIndex >= 0 && currentIndex < articles.length - 1}
        />
      )}

      {/* Ingest Help Modal */}
      {showHelpModal && (
        <TechRadarIngestHelpModal
          onClose={() => setShowHelpModal(false)}
          onSeedSample={handleSeedSample}
        />
      )}
    </div>
  );
};
