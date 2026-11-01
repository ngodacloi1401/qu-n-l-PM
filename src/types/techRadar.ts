export type TechRadarCategory =
  | 'all'
  | 'global-ai'
  | 'big-tech-releases'
  | 'github-trending'
  | 'community-buzz'
  | 'tools-agents';

export interface TechRadarCategoryMeta {
  id: TechRadarCategory;
  name: string;
  description: string;
  iconName: string;
  badgeColor: string;
}

export const TECH_RADAR_CATEGORIES: TechRadarCategoryMeta[] = [
  {
    id: 'all',
    name: 'Tất cả tin tức',
    description: 'Toàn bộ điểm tin công nghệ & thế giới AI',
    iconName: 'Globe',
    badgeColor: 'bg-slate-100 text-slate-800 border-slate-200',
  },
  {
    id: 'global-ai',
    name: 'Thế giới AI',
    description: 'Chuyển động lớn, chính sách, đột phá công nghệ AI toàn cầu',
    iconName: 'Sparkles',
    badgeColor: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  {
    id: 'big-tech-releases',
    name: 'Big Tech Releases',
    description: 'Bản phát hành mới nhất từ OpenAI, Google, Anthropic, DeepSeek, Meta...',
    iconName: 'Building2',
    badgeColor: 'bg-purple-50 text-purple-700 border-purple-200',
  },
  {
    id: 'github-trending',
    name: 'GitHub Repos Nổi bật',
    description: 'Các open-source AI repo hot nhất trong ngày, thư viện và framework mới',
    iconName: 'GitFork',
    badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    id: 'community-buzz',
    name: 'Cộng đồng Thảo luận',
    description: 'Chủ đề các hội đồng & chuyên gia thế giới tranh luận sôi nổi (X, Reddit, HN)',
    iconName: 'Flame',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    id: 'tools-agents',
    name: 'Công cụ & Agents',
    description: 'Công cụ thực chiến, AI Coding Assistants, Agentic AI, giải pháp tự động hóa',
    iconName: 'Bot',
    badgeColor: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  },
];

export interface TechRadarArticle {
  id: string;
  title: string;
  category: TechRadarCategory;
  publishedDate: string; // YYYY-MM-DD
  sourceName: string;   // e.g. 'OpenAI Blog', 'GitHub Trending', 'X (Twitter)', 'Reddit r/LocalLLaMA', 'Hacker News'
  sourceUrl?: string;
  author?: string;
  summary: string;       // TL;DR ngắn gọn súc tích
  keyTakeaways: string[]; // Các điểm cốt lõi đáng chú ý nhất
  contentMarkdown: string; // Bài phân tích chi tiết đầy đủ
  tags: string[];
  hotScore?: number;     // Upvotes / stars / điểm đánh giá độ hot
  discussionCount?: number;
  isBookmarked?: boolean;
  isRead?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TechRadarStats {
  totalArticles: number;
  todayCount: number;
  bookmarkedCount: number;
  categoryCounts: Record<string, number>;
}
