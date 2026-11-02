import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

export interface TechRadarArticle {
  id: string;
  title: string;
  category: 'global-ai' | 'big-tech-releases' | 'github-trending' | 'community-buzz' | 'tools-agents';
  publishedDate: string; // YYYY-MM-DD
  sourceName: string;
  sourceUrl?: string;
  author?: string;
  summary: string;
  keyTakeaways: string[];
  contentMarkdown: string;
  tags: string[];
  hotScore?: number;
  discussionCount?: number;
  isBookmarked?: boolean;
  isRead?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface GetArticlesFilter {
  category?: string;
  date?: string;
  timeRange?: string; // 'all' | 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month'
  month?: string;     // '2026-11', '2026-10', etc.
  week?: string;
  search?: string;
  bookmarkedOnly?: boolean;
  limit?: number;
  offset?: number;
}

const DATA_DIR = resolve('data');
const DATA_FILE = resolve('data', 'tech-radar-articles.json');

let memoryArticlesCache: TechRadarArticle[] | null = null;

export function getLocalDateString(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getWeekRange(refDate: Date = new Date()): { startStr: string; endStr: string } {
  const d = new Date(refDate);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    startStr: getLocalDateString(monday),
    endStr: getLocalDateString(sunday),
  };
}

export function matchesTimeFilter(publishedDate: string, filter?: GetArticlesFilter): boolean {
  if (!filter) return true;

  // 1. Specific single date
  if (filter.date && filter.date !== 'all') {
    if (publishedDate !== filter.date) return false;
  }

  // 2. Specific month (e.g. '2026-11', '2026-10')
  if (filter.month && filter.month !== 'all') {
    if (!publishedDate.startsWith(filter.month)) return false;
  }

  // 3. Time range presets
  const timeRange = filter.timeRange;
  if (!timeRange || timeRange === 'all') return true;

  const now = new Date();
  const todayStr = getLocalDateString(now);

  if (timeRange === 'today') {
    return publishedDate === todayStr;
  }

  if (timeRange === 'yesterday') {
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    return publishedDate === getLocalDateString(yesterday);
  }

  if (timeRange === 'this_week') {
    const { startStr, endStr } = getWeekRange(now);
    return publishedDate >= startStr && publishedDate <= endStr;
  }

  if (timeRange === 'last_week') {
    const lastWeekRef = new Date(now);
    lastWeekRef.setDate(now.getDate() - 7);
    const { startStr, endStr } = getWeekRange(lastWeekRef);
    return publishedDate >= startStr && publishedDate <= endStr;
  }

  if (timeRange === 'this_month') {
    const currentMonth = todayStr.slice(0, 7);
    return publishedDate.startsWith(currentMonth);
  }

  if (timeRange === 'last_month') {
    const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthStr = getLocalDateString(lastMonthDate).slice(0, 7);
    return publishedDate.startsWith(lastMonthStr);
  }

  return true;
}

function ensureDataFile(): TechRadarArticle[] {
  if (memoryArticlesCache && memoryArticlesCache.length >= 20) {
    return memoryArticlesCache;
  }
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!existsSync(DATA_FILE)) {
      const initial = getSampleArticles();
      try {
        writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      } catch (err) {
        console.warn('[TechRadarService] Could not write initial file, using memory:', err);
      }
      memoryArticlesCache = initial;
      return initial;
    }
    const raw = readFileSync(DATA_FILE, 'utf-8');
    if (!raw.trim()) {
      const initial = getSampleArticles();
      try {
        writeFileSync(DATA_FILE, JSON.stringify(initial, null, 2), 'utf-8');
      } catch (err) {
        console.warn('[TechRadarService] Could not write initial file, using memory:', err);
      }
      memoryArticlesCache = initial;
      return initial;
    }
    const parsed = JSON.parse(raw);
    // If parsed has fewer than 20 articles, merge with latest comprehensive samples
    if (Array.isArray(parsed) && parsed.length < 20) {
      const samples = getSampleArticles();
      const merged = [...parsed];
      for (const s of samples) {
        if (!merged.some((m) => m.id === s.id || m.title.trim() === s.title.trim())) {
          merged.push(s);
        }
      }
      try {
        writeFileSync(DATA_FILE, JSON.stringify(merged, null, 2), 'utf-8');
      } catch (err) {
        console.warn('[TechRadarService] Could not persist merged sample:', err);
      }
      memoryArticlesCache = merged;
      return merged;
    }
    memoryArticlesCache = parsed;
    return memoryArticlesCache!;
  } catch (error) {
    console.error('[TechRadarService] Failed to read data file, using sample:', error);
    memoryArticlesCache = getSampleArticles();
    return memoryArticlesCache;
  }
}

function persistArticles(articles: TechRadarArticle[]) {
  memoryArticlesCache = articles;
  try {
    if (!existsSync(DATA_DIR)) {
      mkdirSync(DATA_DIR, { recursive: true });
    }
    writeFileSync(DATA_FILE, JSON.stringify(articles, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[TechRadarService] Could not persist to disk (serverless/read-only), kept in memory:', err);
  }
}

export function getAllArticles(filter?: GetArticlesFilter): {
  articles: TechRadarArticle[];
  total: number;
  todayCount: number;
  thisWeekCount: number;
  thisMonthCount: number;
  availableMonths: string[];
} {
  let list = ensureDataFile();
  const todayStr = getLocalDateString(new Date());
  const now = new Date();
  const { startStr: weekStart, endStr: weekEnd } = getWeekRange(now);
  const currentMonth = todayStr.slice(0, 7);

  const todayCount = list.filter((a) => a.publishedDate === todayStr).length;
  const thisWeekCount = list.filter((a) => a.publishedDate >= weekStart && a.publishedDate <= weekEnd).length;
  const thisMonthCount = list.filter((a) => a.publishedDate.startsWith(currentMonth)).length;

  // Extract all distinct months available in data
  const monthsSet = new Set<string>();
  for (const a of list) {
    if (a.publishedDate && a.publishedDate.length >= 7) {
      monthsSet.add(a.publishedDate.slice(0, 7));
    }
  }
  const availableMonths = Array.from(monthsSet).sort().reverse();

  // 1. Filter Category
  if (filter?.category && filter.category !== 'all') {
    list = list.filter((a) => a.category === filter.category);
  }

  // 2. Filter Time (date, timeRange, month)
  list = list.filter((a) => matchesTimeFilter(a.publishedDate, filter));

  // 3. Filter Bookmarks
  if (filter?.bookmarkedOnly) {
    list = list.filter((a) => a.isBookmarked);
  }

  // 4. Search query
  if (filter?.search && filter.search.trim()) {
    const q = filter.search.trim().toLowerCase();
    list = list.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.summary.toLowerCase().includes(q) ||
        a.sourceName.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  // Sort: newest published date first, then highest hotScore
  list.sort((a, b) => {
    if (a.publishedDate !== b.publishedDate) {
      return b.publishedDate.localeCompare(a.publishedDate);
    }
    return (b.hotScore || 0) - (a.hotScore || 0);
  });

  const total = list.length;
  const offset = filter?.offset || 0;
  const limit = filter?.limit || 100;
  const paginated = list.slice(offset, offset + limit);

  return {
    articles: paginated,
    total,
    todayCount,
    thisWeekCount,
    thisMonthCount,
    availableMonths,
  };
}

export function addArticles(incoming: Array<Partial<TechRadarArticle>>): { added: number; updated: number } {
  const current = ensureDataFile();
  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();
  const todayStr = getLocalDateString(new Date());

  for (const item of incoming) {
    if (!item.title || !item.title.trim()) continue;
    const itemTitle = item.title.trim();

    // Check duplicate by sourceUrl or exact title
    const existingIndex = current.findIndex(
      (existing) =>
        (item.sourceUrl && existing.sourceUrl && existing.sourceUrl === item.sourceUrl) ||
        (existing.title.toLowerCase().trim() === itemTitle.toLowerCase())
    );

    if (existingIndex >= 0) {
      current[existingIndex] = {
        ...current[existingIndex],
        ...item,
        updatedAt: now,
      };
      updated++;
    } else {
      const newArticle: TechRadarArticle = {
        id: item.id || `radar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: itemTitle,
        category: item.category || 'global-ai',
        publishedDate: item.publishedDate || todayStr,
        sourceName: item.sourceName || 'Tech Daily Research',
        sourceUrl: item.sourceUrl || '',
        author: item.author || 'AI Radar Intelligence',
        summary: item.summary || itemTitle,
        keyTakeaways: Array.isArray(item.keyTakeaways) ? item.keyTakeaways : [],
        contentMarkdown: item.contentMarkdown || item.summary || itemTitle,
        tags: Array.isArray(item.tags) ? item.tags : ['AI', 'Tech'],
        hotScore: typeof item.hotScore === 'number' ? item.hotScore : 100,
        discussionCount: typeof item.discussionCount === 'number' ? item.discussionCount : 0,
        isBookmarked: false,
        isRead: false,
        createdAt: now,
        updatedAt: now,
      };
      current.unshift(newArticle);
      added++;
    }
  }

  persistArticles(current);
  return { added, updated };
}

export function updateArticle(id: string, updates: Partial<TechRadarArticle>): TechRadarArticle | null {
  const current = ensureDataFile();
  const index = current.findIndex((a) => a.id === id);
  if (index === -1) return null;

  const now = new Date().toISOString();
  current[index] = {
    ...current[index],
    ...updates,
    updatedAt: now,
  };

  persistArticles(current);
  return current[index];
}

export function deleteArticle(id: string): boolean {
  const current = ensureDataFile();
  const next = current.filter((a) => a.id !== id);
  if (next.length === current.length) return false;

  persistArticles(next);
  return true;
}

export function seedSampleArticles(): { count: number } {
  const samples = getSampleArticles();
  persistArticles(samples);
  return { count: samples.length };
}

function relDate(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return getLocalDateString(d);
}

function getSampleArticles(): TechRadarArticle[] {
  const d0 = relDate(0);   // Hôm nay (2026-11-02)
  const d1 = relDate(1);   // Hôm qua (2026-11-01)
  const d2 = relDate(2);   // 2 ngày trước (2026-10-31)
  const d3 = relDate(3);   // 3 ngày trước (2026-10-30)
  const d5 = relDate(5);   // 5 ngày trước (2026-10-28)
  const d7 = relDate(7);   // 7 ngày trước (2026-10-26)
  const d10 = relDate(10); // 10 ngày trước (2026-10-23)
  const d14 = relDate(14); // 14 ngày trước (2026-10-19)
  const d18 = relDate(18); // 18 ngày trước (2026-10-15)
  const d24 = relDate(24); // 24 ngày trước (2026-10-09)
  const d35 = relDate(35); // 35 ngày trước (Tháng 9)
  const d42 = relDate(42); // 42 ngày trước (Tháng 9)

  const nowIso = new Date().toISOString();

  return [
    // ----------------------------------------------------
    // HÔM NAY (d0)
    // ----------------------------------------------------
    {
      id: 'radar-sample-01',
      title: 'Đột phá Mô hình Reasoning Mở: Xu hướng AI Open-Weights làm rung chuyển ngành công nghệ',
      category: 'global-ai',
      publishedDate: d0,
      sourceName: 'ArXiv & AI Research Daily',
      sourceUrl: 'https://arxiv.org',
      author: 'Global AI Observatory',
      summary: 'Các mô hình reasoning mã nguồn mở với chi phí huấn luyện thấp đang đạt benchmark tương đương các mô hình thương mại đóng hàng đầu, tạo bước ngoặt lớn cho tự chủ công nghệ doanh nghiệp.',
      keyTakeaways: [
        'Chi phí inference giảm hơn 80% nhờ kỹ thuật tối ưu hóa chuỗi suy nghĩ (Chain-of-Thought) chưng cất (distilled).',
        'Các doanh nghiệp công nghệ toàn cầu bắt đầu dịch chuyển sang tự host mô hình cục bộ (on-premise / private cloud) thay vì phụ thuộc 100% vào closed APIs.',
        'Hội đồng công nghệ thế giới thảo luận sâu về an toàn AI khi năng lực suy luận mạnh mẽ được phân phối rộng rãi ra công chúng.',
      ],
      contentMarkdown: `### 🌐 Bối cảnh & Tác động Toàn cầu

Trong những tuần gần đây, cộng đồng nghiên cứu AI quốc tế chứng kiến sự trỗi dậy mạnh mẽ của thế hệ **mô hình Reasoning mã nguồn mở**. Sự chuyển dịch này không chỉ là một cột mốc kỹ thuật, mà còn là một cuộc tái định hình cấu trúc thị trường trí tuệ nhân tạo.

#### 1. Tại sao cả thế giới đang nói về điều này?
Trước đây, năng lực suy luận từng bước (Step-by-step Reasoning / System 2 Thinking) gần như là độc quyền của các hệ thống AI đóng đắt đỏ. Tuy nhiên, các kỹ thuật huấn luyện mới sử dụng **Reinforcement Learning từ quy tắc toán học & lập trình (Rule-based RL)** mà không cần lượng dữ liệu gán nhãn thủ công khổng lồ đã chứng minh:
- Chi phí huấn luyện có thể giảm từ hàng trăm triệu USD xuống còn vài triệu USD.
- Khả năng toán học, logic giải thuật và debug code đạt điểm số tiệm cận các hệ thống top đầu.

#### 2. Phản ứng từ các tổ chức và chuyên gia quốc tế
- **Cộng đồng nguồn mở**: Đánh giá đây là "khoảnh khắc Linux của kỷ nguyên AI", mở ra cơ hội xây dựng các giải pháp tự chủ cho các công ty kỹ thuật và xây dựng/BIM.
- **Các viện nghiên cứu**: Cảnh báo về việc cần thiết lập các tiêu chuẩn an toàn kiểm thử tự động trước khi triển khai quy mô lớn.`,
      tags: ['Reasoning', 'OpenSource', 'AI Trends', 'Global Tech'],
      hotScore: 1450,
      discussionCount: 420,
      isBookmarked: true,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-02',
      title: 'Anthropic công bố Claude 3.7 Sonnet: Mô hình Hybrid Reasoning đầu tiên trên thị trường',
      category: 'big-tech-releases',
      publishedDate: d0,
      sourceName: 'Anthropic Newsroom',
      sourceUrl: 'https://www.anthropic.com/news',
      author: 'Anthropic Engineering',
      summary: 'Anthropic vừa ra mắt Claude 3.7 Sonnet, mô hình đầu tiên cho phép lập trình viên điều chỉnh ngân sách suy luận (Thinking Budget) linh hoạt giữa phản hồi tức thì và suy nghĩ chuyên sâu.',
      keyTakeaways: [
        'Hỗ trợ chế độ Hybrid: Người dùng hoặc PM có thể chọn thời gian suy nghĩ từ 1 giây đến hàng chục giây tùy độ phức tạp của bài toán.',
        'Đạt kỷ lục mới trên SWE-bench Verified (70.3%) - chuẩn đo lường khả năng sửa lỗi và lập trình phần mềm thực tế.',
        'Tích hợp sâu tính năng Computer Use và Agent Tool Calling mượt mà hơn 40% so với thế hệ trước.',
      ],
      contentMarkdown: `### 🚀 Bước tiến mới của AI Lập trình & Phân tích Hệ thống

Anthropic chính thức trình làng **Claude 3.7 Sonnet**, đánh dấu sự xuất hiện của kiến trúc **Hybrid Reasoning** đầu tiên cho phép kết hợp phản hồi nhanh và tư duy suy luận sâu trong cùng một mô hình duy nhất.

\`\`\`json
{
  "model": "claude-3-7-sonnet-20250219",
  "thinking": {
    "type": "enabled",
    "budget_tokens": 4096
  }
}
\`\`\`

#### Điểm nổi bật đáng chú ý:
1. **Kiểm soát chi phí & thời gian phản hồi (Thinking Budget)**: Lập trình viên có thể cấp quota tokens suy luận cho mô hình. Khi gặp task đơn giản, mô hình phản hồi ngay; khi gặp lỗi logic hóc búa, mô hình tự động "nghĩ kỹ" trước khi xuất kết quả.
2. **SWE-bench Verified 70.3%**: Mô hình giải quyết thành công hơn 70% các pull request thực tế trên GitHub mà không cần con người can thiệp.`,
      tags: ['Claude 3.7', 'Anthropic', 'Coding AI', 'SWE-bench', 'Release'],
      hotScore: 1820,
      discussionCount: 615,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-03',
      title: 'Top GitHub Trending: Browser-Use & Agentic Automation vượt mốc 35,000 Stars',
      category: 'github-trending',
      publishedDate: d0,
      sourceName: 'GitHub Trending Weekly',
      sourceUrl: 'https://github.com/browser-use/browser-use',
      author: 'Open Source Community',
      summary: 'Thư viện mã nguồn mở Browser-Use đang dẫn đầu xu hướng AI Agents điều khiển trình duyệt web, cho phép agent tự động đăng nhập, trích xuất dữ liệu và tương tác với các ứng dụng web phức tạp.',
      keyTakeaways: [
        'Sử dụng Vision Models kết hợp DOM tree parser để thao tác như người thật trên giao diện web.',
        'Giải quyết bài toán tích hợp với các hệ thống web cũ (Legacy ERP / Web Forms) không có REST API.',
        'Được các kỹ sư tự động hóa toàn cầu đánh giá là công cụ không thể thiếu trong bộ công cụ kiểm thử và thu thập dữ liệu.',
      ],
      contentMarkdown: `### ⭐ Hiện tượng GitHub: Browser-Use & Agentic Web Automation

Thư viện **Browser-Use** đã trở thành một trong những repository tăng trưởng nhanh nhất trên GitHub với hơn 35k stars chỉ sau vài tuần.

#### Khả năng cốt lõi:
- **Tự động nhận diện nút bấm & ô nhập liệu**: Sử dụng tọa độ pixel và cấu trúc accessibility tree.
- **Vượt qua các form đa bước**: Phù hợp cho việc cào dữ liệu báo cáo, kiểm tra trang web dự án hoặc tự động đăng nhập xác minh báo cáo Redmine.`,
      tags: ['GitHub Trending', 'Browser-Use', 'AI Agents', 'Automation'],
      hotScore: 1190,
      discussionCount: 280,
      isBookmarked: false,
      isRead: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-07',
      title: 'Hacker News Tranh Luận: Liệu Lập Trình Viên Có Đang Phụ Thuộc Quá Mức Vào AI Coding?',
      category: 'community-buzz',
      publishedDate: d0,
      sourceName: 'Hacker News Frontpage',
      sourceUrl: 'https://news.ycombinator.com',
      author: 'HN Community Editorial',
      summary: 'Chủ đề đứng Top 1 Hacker News với hơn 800 bình luận: Liệu việc tạo mã tự động tốc độ cao có đang làm suy giảm tư duy giải thuật sâu và khả năng tự debug ở các kỹ sư trẻ?',
      keyTakeaways: [
        '72% người tham gia đồng thuận rằng AI giúp tăng tốc triển khai boilerplate nhưng làm tăng chi phí bảo trì nếu không hiểu sâu kiến trúc.',
        'Xu hướng kiểm thử tự động (TDD & Property-based testing) đang trở thành "bức tường bảo vệ" bắt buộc khi làm việc cùng Agent.',
        'Các công ty công nghệ lớn bắt đầu phỏng vấn kỹ năng Code Review và System Design thay vì viết LeetCode thủ công.',
      ],
      contentMarkdown: `### 💬 Diễn đàn Công nghệ: Bàn luận về Tương lai Nghề Kỹ Sư Phần Mềm

Bài viết "The Great Code Acceleration Trap" vừa gây bão trên Hacker News và nhận được hàng trăm quan điểm từ các cựu kỹ sư Google, Meta và các founder startup.

> *"AI có thể viết mã trong 5 giây, nhưng một lỗi kiến trúc âm thầm có thể tốn 5 tuần để dọn dẹp nếu người review không nắm vững bức tranh tổng thể."*`,
      tags: ['Hacker News', 'Developer Mindset', 'Software Engineering', 'Code Review'],
      hotScore: 1670,
      discussionCount: 840,
      isBookmarked: true,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-08',
      title: 'Model Context Protocol (MCP): Tiêu chuẩn Mở Kết Nối AI Với Toàn Bộ Hạ Tầng Dữ Liệu',
      category: 'tools-agents',
      publishedDate: d0,
      sourceName: 'Anthropic & Linux Foundation',
      sourceUrl: 'https://modelcontextprotocol.io',
      author: 'MCP Working Group',
      summary: 'Giao thức mở Model Context Protocol (MCP) đang nhanh chóng trở thành tiêu chuẩn công nghiệp (USB-C cho AI), cho phép các trợ lý AI đọc ghi an toàn vào SQLite, PostgreSQL, Git, Slack và CAD.',
      keyTakeaways: [
        'Loại bỏ hoàn toàn sự rời rạc của các API wrapper riêng lẻ cho từng LLM.',
        'Cung cấp cơ chế phân quyền (read-only, sandboxed execution) chặt chẽ bảo vệ dữ liệu doanh nghiệp.',
        'Hơn 500 MCP servers đã được cộng đồng mã nguồn mở đóng góp chỉ trong 2 tháng.',
      ],
      contentMarkdown: `### 🛠️ Cách Mạng Kết Nối: Model Context Protocol (MCP)

Giao thức **MCP** cho phép các ứng dụng AI tương tác an toàn với kho dữ liệu địa phương hoặc đám mây qua kiến trúc Client-Server tiêu chuẩn.

\`\`\`json
{
  "mcpServers": {
    "redmine-db": {
      "command": "node",
      "args": ["./dist/mcp-redmine.js"]
    }
  }
}
\`\`\``,
      tags: ['MCP', 'Standard', 'Integration', 'Data Tools'],
      hotScore: 1320,
      discussionCount: 310,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },

    // ----------------------------------------------------
    // HÔM QUA (d1)
    // ----------------------------------------------------
    {
      id: 'radar-sample-04',
      title: 'Hội đồng Công nghệ Thảo luận: Tương lai của AI Coding Assistants - Cursor vs Windsurf vs Claude Code',
      category: 'community-buzz',
      publishedDate: d1,
      sourceName: 'Hacker News & X Tech Community',
      sourceUrl: 'https://news.ycombinator.com',
      author: 'Tech Industry Roundtable',
      summary: 'Cuộc tranh luận sôi nổi xoay quanh việc liệu các IDE AI chuyên dụng như Cursor/Windsurf hay các CLI Agents chạy trực tiếp trong terminal sẽ định hình cách kỹ sư phần mềm làm việc trong 3 năm tới.',
      keyTakeaways: [
        'Hơn 85% kỹ sư cấp cao khẳng định AI đã thay đổi hoàn toàn quy trình viết code từ gõ phím sang thẩm định kiến trúc và review mã.',
        'Tranh cãi lớn về độ an toàn mã nguồn: Doanh nghiệp lo ngại về rò rỉ IP khi telemetry của các extension IDE gửi context lên cloud.',
        'Xu hướng mới: Terminal-native agents (Agent chạy trực tiếp trong shell với quyền hạn khoanh vùng) đang bứt phá mạnh mẽ.',
      ],
      contentMarkdown: `### 💬 Diễn đàn Công nghệ: Đâu là chuẩn mực mới của Lập trình cùng AI?

Chủ đề thảo luận nóng tuần này trên các cộng đồng lập trình viên thế giới (Hacker News, Reddit r/programming) xoay quanh cuộc đua giữa các nền tảng AI Coding.

#### Nhận định của các Tech Leads:
> *"Một kỹ sư giỏi trong năm 2026 không phải là người nhớ thuộc lòng cú pháp thư viện, mà là người biết đặt đề bài chính xác (prompt specification), phân tích ranh giới hệ thống (system boundaries) và thiết lập bộ test tự động nghiêm ngặt để agent tự kiểm chứng."*`,
      tags: ['Community Debate', 'HackerNews', 'Coding Assistants', 'Cursor', 'Productivity'],
      hotScore: 1450,
      discussionCount: 689,
      isBookmarked: true,
      isRead: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-05',
      title: 'Google DeepMind nâng cấp Gemini 2.5 Flash: Đột phá tốc độ và Cửa sổ ngữ cảnh 1 Triệu Tokens',
      category: 'big-tech-releases',
      publishedDate: d1,
      sourceName: 'Google DeepMind Research Blog',
      sourceUrl: 'https://deepmind.google/technologies/gemini',
      author: 'Google AI Team',
      summary: 'Google ra mắt phiên bản tối ưu của Gemini 2.5 Flash với độ trễ phản hồi giảm một nửa, hỗ trợ phân tích đa phương thức (văn bản, âm thanh, video, code) trong cùng một cửa sổ ngữ cảnh 1,000,000 tokens.',
      keyTakeaways: [
        'Thời gian Time-to-First-Token (TTFT) đạt dưới 200ms, nhanh nhất trong phân khúc mô hình lớn.',
        'Khả năng đọc toàn bộ kho tài liệu kỹ thuật, tiêu chuẩn BIM hoặc codebase hàng chục nghìn dòng chỉ trong 1 truy vấn duy nhất.',
        'Cung cấp tính năng Native Tool Calling với độ chính xác cú pháp 99.2%.',
      ],
      contentMarkdown: `### ⚡ Gemini 2.5 Flash: Đỉnh cao Tốc độ & Khối lượng Xử lý Dữ liệu

Google DeepMind vừa tung ra bản cập nhật lớn cho dòng mô hình **Gemini Flash**, hướng trực tiếp đến các ứng dụng thời gian thực và xử lý tài liệu khối lượng cực lớn.`,
      tags: ['Google AI', 'Gemini Flash', 'DeepMind', 'Big Context', 'Model Release'],
      hotScore: 1120,
      discussionCount: 295,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-06',
      title: 'Hệ sinh thái Multi-Agent Frameworks bùng nổ: So sánh CrewAI, LangGraph và AutoGen',
      category: 'tools-agents',
      publishedDate: d1,
      sourceName: 'Towards Data Science & Medium',
      sourceUrl: 'https://towardsdatascience.com',
      author: 'AI Architecture Review',
      summary: 'Phân tích so sánh 3 framework xây dựng hệ thống đa tác nhân (Multi-Agent Systems) phổ biến nhất hiện nay: Khi nào nên dùng đồ thị tuần tự (LangGraph) và khi nào nên dùng mô hình phân vai quản lý (CrewAI).',
      keyTakeaways: [
        'LangGraph chiếm ưu thế tuyệt đối trong các ứng dụng doanh nghiệp đòi hỏi độ kiểm soát trạng thái (State Machine) chặt chẽ và khả năng rollback.',
        'CrewAI trực quan, dễ làm quen với các kịch bản phân vai nhân sự (ví dụ: Agent BA -> Agent Dev -> Agent QA).',
        'Cơ chế Human-in-the-loop (con người duyệt trước khi agent thực thi) trở thành tiêu chuẩn bắt buộc cho mọi workflow sản xuất.',
      ],
      contentMarkdown: `### 🛠️ Kiến trúc Hệ thống Đa Tác nhân (Multi-Agent Architecture)

Khi một AI đơn lẻ không đủ khả năng đảm đương một quy trình nghiệp vụ phức tạp, giải pháp kết hợp **nhiều Agent chuyên trách** phối hợp cùng nhau đang trở thành kiến trúc chuẩn mực.`,
      tags: ['Multi-Agent', 'LangGraph', 'CrewAI', 'Architecture', 'Enterprise AI'],
      hotScore: 940,
      discussionCount: 210,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-09',
      title: 'Hội nghị Thượng đỉnh Quốc tế: Thống nhất Khung Đánh giá An toàn cho Autonomous Agents',
      category: 'global-ai',
      publishedDate: d1,
      sourceName: 'Global AI Safety Summit',
      sourceUrl: 'https://aisafetyinstitute.org',
      author: 'International Policy Panel',
      summary: 'Các đại diện từ 28 quốc gia và viện nghiên cứu hàng đầu thông qua khung tiêu chuẩn kiểm định độc lập cho các hệ thống AI có quyền hạn tự động thực thi hành vi trên mạng Internet.',
      keyTakeaways: [
        'Yêu cầu cơ chế "Kill-Switch" vật lý và khoanh vùng sandbox cho các agent có quyền truy cập thẻ tín dụng và server production.',
        'Quy định trách nhiệm giải trình rõ ràng giữa đơn vị phát triển mô hình gốc và đơn vị tích hợp giải pháp.',
        'Ủng hộ việc công khai bộ dữ liệu red-teaming để cộng đồng bảo mật cùng tham gia vá lỗ hổng.',
      ],
      contentMarkdown: `### 🌐 An Toàn AI Đa Quốc Gia

Hội nghị Thượng đỉnh An toàn AI vừa kết thúc với tuyên bố chung về việc thiết lập các tiêu chuẩn thẩm định cho các hệ thống Agent tự hành.`,
      tags: ['AI Safety', 'Policy', 'Governance', 'Global Standards'],
      hotScore: 1040,
      discussionCount: 215,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-10',
      title: 'Open-Manus: Nền tảng General Agent Mã Nguồn Mở Tự Động Hóa Đa Nhiệm Trên Terminal',
      category: 'github-trending',
      publishedDate: d1,
      sourceName: 'GitHub Trending Daily',
      sourceUrl: 'https://github.com/mannaandpoem/OpenManus',
      author: 'OpenManus Team',
      summary: 'Dự án nguồn mở OpenManus mô phỏng trải nghiệm Agent đa nhiệm (General Agent), cho phép lập trình viên chỉ cần gõ yêu cầu bằng ngôn ngữ tự nhiên để agent tự lên kế hoạch, viết code, chạy kiểm thử và hoàn thành task.',
      keyTakeaways: [
        'Không yêu cầu bất kỳ extension bản quyền đắt tiền nào, hoàn toàn tương thích với các mô hình local qua Ollama / vLLM.',
        'Hỗ trợ cơ chế Planning & Tool Execution vòng lặp kín (Closed-loop feedback).',
        'Thu hút hơn 12,000 stars chỉ trong 5 ngày ra mắt.',
      ],
      contentMarkdown: `### ⭐ Hiện tượng Mã Nguồn Mở: OpenManus

OpenManus chứng minh rằng kiến trúc Agent không cần phải quá phức tạp để đạt được hiệu quả thực chiến cao.`,
      tags: ['OpenManus', 'Autonomous Agent', 'GitHub Trending', 'Terminal'],
      hotScore: 1530,
      discussionCount: 390,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },

    // ----------------------------------------------------
    // TUẦN NÀY & TUẦN TRƯỚC (d2 -> d7)
    // ----------------------------------------------------
    {
      id: 'radar-sample-11',
      title: 'OpenAI Giới Thiệu Operator: Kỷ Nguyên AI Tự Động Thao Tác Trình Duyệt Web Cho Doanh Nghiệp',
      category: 'big-tech-releases',
      publishedDate: d3,
      sourceName: 'OpenAI Product Announcement',
      sourceUrl: 'https://openai.com/index',
      author: 'OpenAI Research & Applied',
      summary: 'OpenAI chính thức phát hành Operator phiên bản preview - công cụ cho phép ChatGPT tự động mở trình duyệt, đặt vé, điền bảng tính và thu thập dữ liệu nghiên cứu thị trường theo lệnh.',
      keyTakeaways: [
        'Sử dụng mô hình CUA (Computer-Using Agent) được tinh chỉnh chuyên biệt cho nhận diện layout web.',
        'Hỗ trợ chế độ giám sát từng bước: Người dùng có thể nhấn dừng hoặc can thiệp bất kỳ lúc nào.',
        'Bắt đầu triển khai cho các khách hàng doanh nghiệp gói ChatGPT Pro & Enterprise.',
      ],
      contentMarkdown: `### 🤖 OpenAI Operator: Từ Chatbot Sang Đại Lý Hành Động

Sự kiện ra mắt Operator đánh dấu bước chuyển trọng tâm của OpenAI từ trả lời câu hỏi sang **hoàn thành công việc thực tế**.`,
      tags: ['OpenAI', 'Operator', 'CUA', 'Web Automation', 'Release'],
      hotScore: 1980,
      discussionCount: 920,
      isBookmarked: true,
      isRead: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-12',
      title: 'vLLM v0.7 Ra Mắt: Tối Ưu Hóa Throughput 2.5x Cho Các Mô Hình Reasoning Suy Luận Dài',
      category: 'github-trending',
      publishedDate: d5,
      sourceName: 'vLLM Project Updates',
      sourceUrl: 'https://github.com/vllm-project/vllm',
      author: 'vLLM Core Contributors',
      summary: 'Bản cập nhật lớn v0.7 của vLLM bổ sung Chunked Prefill tối ưu cho các prompt siêu dài và cơ chế quản lý PagedAttention thế hệ mới giúp tăng gấp đôi số lượng người dùng đồng thời.',
      keyTakeaways: [
        'Giảm 45% tiêu thụ VRAM khi xử lý các chuỗi tư duy reasoning (Chain-of-thought) vượt quá 16k tokens.',
        'Tương thích hoàn hảo với các mô hình DeepSeek R1, Llama 3.3 và Qwen 2.5.',
        'Hỗ trợ biên dịch mô hình với Torch.compile cho tốc độ sinh token cực đại trên kiến trúc NVIDIA Ada & Blackwell.',
      ],
      contentMarkdown: `### ⚡ vLLM v0.7: Động Cơ Inference Chuẩn Doanh Nghiệp

Khi các mô hình AI sinh ra chuỗi suy nghĩ dài hàng ngàn tokens, chi phí và throughput phục vụ trở thành rào cản lớn nhất. Bản nâng cấp v0.7 giải quyết trực diện điểm nghẽn này.`,
      tags: ['vLLM', 'Inference Engine', 'Throughput', 'Optimization'],
      hotScore: 1250,
      discussionCount: 310,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-13',
      title: 'Cộng đồng r/LocalLLaMA: Mô Hình 14B Quantized Chạy Cực Mượt Trên Card Đồ Họa Phổ Thông',
      category: 'community-buzz',
      publishedDate: d5,
      sourceName: 'Reddit r/LocalLLaMA',
      sourceUrl: 'https://reddit.com/r/LocalLLaMA',
      author: 'Open Source Community Benchmark',
      summary: 'Thử nghiệm cộng đồng cho thấy mô hình 14B Q4_K_M chạy trên RTX 3060/4060 đạt tốc độ 35 tokens/giây, đủ năng lực phân tích logic phức tạp mà hoàn toàn bảo mật ngoại tuyến.',
      keyTakeaways: [
        'Không cần đầu tư cụm máy chủ đắt tiền, một chiếc laptop đồ họa tầm trung đã có thể chạy trợ lý cá nhân chuyên sâu.',
        'Khả năng tóm tắt tài liệu và phân tích mã nguồn đạt độ chính xác 91% so với mô hình gốc 16-bit.',
        'Khẳng định xu hướng AI On-device và Local Privacy đang lan rộng mạnh mẽ trong giới lập trình viên.',
      ],
      contentMarkdown: `### 💬 Sức Mạnh AI Tại Bàn Làm Việc Của Lập Trình Viên

Cộng đồng r/LocalLLaMA vừa chia sẻ loạt benchmark chi tiết chứng minh sự tiến bộ vượt bậc của các thuật toán lượng tử hóa hiện đại (GGUF, EXL2).`,
      tags: ['LocalLLaMA', 'Quantization', 'GGUF', 'OnDevice AI'],
      hotScore: 1410,
      discussionCount: 480,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-14',
      title: 'Làn Sóng "Sovereign AI": Các Quốc Gia Và Tập Đoàn Xây Dựng Hạ Tầng AI Tự Chủ',
      category: 'global-ai',
      publishedDate: d7,
      sourceName: 'Financial Times & TechCrunch Analysis',
      sourceUrl: 'https://ft.com/tech',
      author: 'Global Tech Strategy Report',
      summary: 'Các chính phủ và tập đoàn lớn trên toàn cầu đang chi hàng tỷ USD để xây dựng trung tâm dữ liệu AI riêng và phát triển mô hình ngôn ngữ dựa trên dữ liệu văn hóa bản địa.',
      keyTakeaways: [
        'Mục tiêu tránh phụ thuộc vào hạ tầng đám mây độc quyền từ một số ít Big Tech phương Tây.',
        'Ưu tiên hàng đầu là bảo vệ bí mật công nghệ, hồ sơ dự án quốc gia và dữ liệu nhạy cảm của doanh nghiệp.',
        'Mở ra thị trường trị giá hơn 200 tỷ USD cho các giải pháp Hybrid Cloud và phần mềm quản lý AI on-premise.',
      ],
      contentMarkdown: `### 🌐 Chiến Lược Tự Chủ Công Nghệ: Sovereign AI

Khái niệm "Sovereign AI" (AI Chủ Quyền) không còn là khẩu hiệu chính sách mà đã trở thành ngân sách đầu tư thực tế tại châu Âu, Nhật Bản, Singapore và các nước đang phát triển.`,
      tags: ['Sovereign AI', 'Infrastructure', 'Geopolitics', 'Enterprise'],
      hotScore: 1090,
      discussionCount: 260,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-15',
      title: 'AI Ứng Dụng Trong Xây Dựng & BIM: Tự Động Rà Soát Va Chạm Bản Vẽ Và Đo Bóc Khối Lượng',
      category: 'tools-agents',
      publishedDate: d7,
      sourceName: 'AnyBIM & Engineering Technology Review',
      sourceUrl: 'https://anybim.vn',
      author: 'Hawee & AnyBIM R&D',
      summary: 'Nghiên cứu ứng dụng thị giác máy tính và LLM đa phương thức để tự động đối chiếu bản vẽ Shop Drawing CAD với mô hình Revit BIM, giảm 70% thời gian rà soát va chạm hệ thống MEP.',
      keyTakeaways: [
        'Tự động trích xuất thông số kỹ thuật (ống gió, thang máng cáp, đường ống nước) từ file DWG và đối chiếu với tiêu chuẩn thiết kế.',
        'Tích hợp cảnh báo sớm xung đột tiến độ trực tiếp lên bảng quản lý Redmine PM Workspace.',
        'Tiềm năng tiết kiệm hàng trăm giờ lao động kỹ sư trên mỗi gói thầu thi công cơ điện.',
      ],
      contentMarkdown: `### 🏗️ Công Nghệ AI Cho Kỹ Thuật Cơ Điện & BIM

Sự kết hợp giữa công nghệ AI tiên tiến và chuyên môn sâu ngành cơ điện (MEP) đang tạo ra bước nhảy vọt về năng suất thi công và kiểm soát chất lượng tại công trường.`,
      tags: ['BIM', 'CAD Shop', 'Hawee', 'AnyBIM', 'Construction AI'],
      hotScore: 1720,
      discussionCount: 340,
      isBookmarked: true,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-16',
      title: 'Meta AI Tiết Lộ Kiến Trúc Llama 4: Mixture-Of-Experts 400B Được Tối Ưu Cho Coding & Reasoning',
      category: 'big-tech-releases',
      publishedDate: d7,
      sourceName: 'Meta AI Research',
      sourceUrl: 'https://ai.meta.com/blog',
      author: 'Mark Zuckerberg & Meta AI Team',
      summary: 'Meta xác nhận dòng mô hình Llama 4 đang trong giai đoạn huấn luyện trên cụm 100,000 chip H100, sử dụng kiến trúc MoE thưa thớt (Sparse MoE) để đạt hiệu năng tương đương GPT-4o với chi phí chạy thấp hơn đáng kể.',
      keyTakeaways: [
        'Kích hoạt chỉ 32B parameters cho mỗi token được sinh ra trên tổng quy mô 400B tham số.',
        'Cam kết tiếp tục giữ triết lý mã nguồn mở (Open Weights) cho cộng đồng lập trình viên toàn cầu.',
        'Dự kiến phát hành chính thức vào đầu năm 2026 với khả năng hỗ trợ native multi-modal và voice.',
      ],
      contentMarkdown: `### 🦙 Llama 4: Đòn Phản Công Nguồn Mở Của Meta

Meta tiếp tục khẳng định vị thế dẫn đầu trong hệ sinh thái AI mã nguồn mở với thế hệ Llama 4 được thiết kế đặc thù cho các tác vụ lập trình và suy luận phức tạp.`,
      tags: ['Meta AI', 'Llama 4', 'MoE', 'OpenWeights', 'Upcoming'],
      hotScore: 1650,
      discussionCount: 520,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },

    // ----------------------------------------------------
    // THÁNG 10 (d10 -> d24)
    // ----------------------------------------------------
    {
      id: 'radar-sample-17',
      title: 'Ollama v0.6 Bổ Sung Tính Năng Phân Tán Mô Hình Lớn Trên Nhiều GPU Tiêu Dùng',
      category: 'github-trending',
      publishedDate: d10,
      sourceName: 'Ollama Blog & GitHub',
      sourceUrl: 'https://ollama.com/blog',
      author: 'Ollama Core Team',
      summary: 'Ollama phiên bản mới hỗ trợ phân chia lớp mô hình (Layer Splitting) tự động giữa CPU và nhiều GPU trên máy tính cá nhân, giúp chạy mượt mà các mô hình 70B mà không gặp lỗi Out-Of-Memory.',
      keyTakeaways: [
        'Cung cấp giao diện CLI và REST API chuẩn tương thích 100% với định dạng OpenAI SDK.',
        'Hỗ trợ quản lý Context Window động và nạp nhiều mô hình đồng thời vào bộ nhớ.',
        'Được đánh giá là công cụ chạy AI cục bộ dễ sử dụng nhất hiện nay.',
      ],
      contentMarkdown: `### ⭐ Ollama v0.6: Chuẩn Mực Triển Khai AI Local

Ollama tiếp tục hoàn thiện trải nghiệm lập trình viên khi cho phép chạy các mô hình mã nguồn mở đồ sộ chỉ bằng một câu lệnh \`ollama run\`.`,
      tags: ['Ollama', 'Local AI', 'GPU', 'Developer Tool'],
      hotScore: 1380,
      discussionCount: 310,
      isBookmarked: false,
      isRead: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-18',
      title: 'Tranh Cãi Lớn Trên X/Twitter: "Prompt Engineering Đã Chết, Kỷ Nguyên Context Engineering Lên Ngôi"',
      category: 'community-buzz',
      publishedDate: d14,
      sourceName: 'Tech Twitter / X Discussion',
      sourceUrl: 'https://x.com',
      author: 'AI Thought Leaders on X',
      summary: 'Các nhà nghiên cứu hàng đầu của Karpathy và Anthropic khẳng định: Thời kỳ trau chuốt từng câu chữ trong prompt đã qua, kỹ năng phân bổ ngữ cảnh (Context Curation & Retrieval Harness) mới là yếu tố quyết định chất lượng AI.',
      keyTakeaways: [
        'Mô hình hiện đại đủ thông minh để hiểu ý định người dùng, sự khác biệt nằm ở dữ liệu ngữ cảnh chính xác được đưa vào prompt.',
        'Các kỹ thuật RAG lai (Hybrid RAG: Vector Search + Keyword + Knowledge Graph) trở thành kiến trúc bắt buộc.',
        'Cộng đồng kỹ sư đồng thuận chuyển đổi chức danh từ "Prompt Engineer" sang "AI Systems Engineer".',
      ],
      contentMarkdown: `### 💬 Bước Chuyển Dịch Trong Tư Duy Tương Tác Cùng AI

Bài viết của cựu giám đốc AI Tesla - Andrej Karpathy đã châm ngòi cho một làn sóng thảo luận lớn trên toàn mạng xã hội X.`,
      tags: ['Context Engineering', 'X Discussion', 'Karpathy', 'RAG'],
      hotScore: 1890,
      discussionCount: 1120,
      isBookmarked: true,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-19',
      title: 'Báo Cáo Stanford: Đánh Giá Chi Phí Năng Lượng Và Tác Động Môi Trường Của AI Reasoning',
      category: 'global-ai',
      publishedDate: d18,
      sourceName: 'Stanford HAI Research',
      sourceUrl: 'https://hai.stanford.edu',
      author: 'Stanford Institute for Human-Centered AI',
      summary: 'Nghiên cứu chỉ ra rằng các mô hình suy luận đa bước tiêu thụ năng lượng gấp 4 đến 8 lần so với các mô hình phản hồi một lượt truyền thống, thúc đẩy nhu cầu cấp thiết về các kiến trúc vi xử lý tiết kiệm điện.',
      keyTakeaways: [
        'Mỗi câu hỏi toán học chuyên sâu tốn năng lượng tương đương với việc thắp sáng một bóng đèn LED trong 1 giờ.',
        'Các trung tâm dữ liệu đang chuyển dịch mạnh mẽ sang năng lượng hạt nhân sạch và làm mát bằng chất lỏng trực tiếp (Direct Liquid Cooling).',
        'Kêu gọi các tổ chức thiết kế giải pháp AI "xanh" (Green AI) chỉ kích hoạt chế độ suy nghĩ sâu khi thực sự cần thiết.',
      ],
      contentMarkdown: `### 🌐 Thách Thức Năng Lượng Trong Kỷ Nguyên Trí Tuệ Nhân Tạo

Báo cáo toàn diện từ Viện Stanford HAI đưa ra bức tranh chân thực về chi phí tài nguyên phía sau những câu trả lời xuất sắc của AI.`,
      tags: ['Stanford', 'Green AI', 'Energy', 'Sustainability', 'Research'],
      hotScore: 980,
      discussionCount: 240,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-20',
      title: 'OpenAI Ra Mắt o3-mini: Năng Lực Suy Luận STEM Đỉnh Cao Với Chi Phí Rẻ Hơn 95%',
      category: 'big-tech-releases',
      publishedDate: d18,
      sourceName: 'OpenAI Developer Changelog',
      sourceUrl: 'https://platform.openai.com/docs',
      author: 'OpenAI API Platform Team',
      summary: 'Mô hình o3-mini mang năng lực tư duy toán học, lập trình và suy luận logic ngang tầm o1 nhưng có chi phí token rẻ hơn đáng kể và hỗ trợ tính năng Structured Outputs chuẩn xác.',
      keyTakeaways: [
        'Hỗ trợ tham số reasoning_effort linh hoạt (low, medium, high).',
        'Thời gian phản hồi nhanh gấp 3 lần so với mô hình o1 ban đầu.',
        'Trở thành lựa chọn mặc định cho các pipeline tự động phân tích mã nguồn và kiểm thử hệ thống.',
      ],
      contentMarkdown: `### 🚀 OpenAI o3-mini: Bình Dân Hóa Năng Lực Suy Luận Cấp Cao

OpenAI tiếp tục chu kỳ phát hành thần tốc với phiên bản mini của dòng mô hình suy luận o3, giải quyết bài toán cân bằng giữa chi phí và độ chính xác.`,
      tags: ['OpenAI', 'o3-mini', 'Reasoning', 'API', 'Developer'],
      hotScore: 1780,
      discussionCount: 560,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-21',
      title: 'LangGraph Studio: Môi Trường Trực Quan Hóa Đồ Thị Trạng Thái Agent Thời Gian Thực',
      category: 'tools-agents',
      publishedDate: d24,
      sourceName: 'LangChain Official Announcement',
      sourceUrl: 'https://blog.langchain.dev',
      author: 'Harrison Chase & LangChain Team',
      summary: 'LangGraph Studio cung cấp giao diện đồ họa cho phép lập trình viên theo dõi từng bước di chuyển của Agent trong đồ thị trạng thái, gỡ lỗi (step-by-step debug) và chỉnh sửa biến runtime ngay lập tức.',
      keyTakeaways: [
        'Cho phép can thiệp (Human-in-the-loop) vào bất kỳ nút nào trong đồ thị để sửa payload trước khi truyền sang agent tiếp theo.',
        'Rút ngắn thời gian debug các luồng agent phức tạp từ vài ngày xuống vài phút.',
        'Hỗ trợ export đồ thị thành tài liệu kiến trúc phục vụ thẩm định bảo mật doanh nghiệp.',
      ],
      contentMarkdown: `### 🛠️ LangGraph Studio: Trực Quan Hóa Thế Giới Agent

Việc phát triển và gỡ lỗi hệ thống đa tác nhân (Multi-Agent Systems) từng là cơn ác mộng vì tính phi tuyến tính. LangGraph Studio giải quyết triệt để điểm đau này.`,
      tags: ['LangGraph', 'LangChain', 'Studio', 'Visualization', 'DevTools'],
      hotScore: 1140,
      discussionCount: 220,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-22',
      title: 'Hội Thảo Châu Âu Về Bản Quyền Dữ Liệu AI: Phán Quyết Bước Ngoặt Về Nguyên Tắc "Fair Use"',
      category: 'community-buzz',
      publishedDate: d24,
      sourceName: 'EU Court & IP Law Journal',
      sourceUrl: 'https://curia.europa.eu',
      author: 'European Legal Observatory',
      summary: 'Tòa án Châu Âu ra phán quyết khẳng định việc thu thập dữ liệu công khai trên Internet để huấn luyện mô hình cơ sở không vi phạm bản quyền nếu tuân thủ quyền từ chối (Opt-out robot.txt) của chủ sở hữu.',
      keyTakeaways: [
        'Giảm bớt áp lực pháp lý nặng nề cho các công ty khởi nghiệp AI tại khu vực Châu Âu.',
        'Yêu cầu các hãng AI lớn phải công bố danh mục nguồn dữ liệu đã sử dụng để huấn luyện.',
        'Tạo tiền lệ quan trọng cho các vụ kiện tương tự đang diễn ra tại Hoa Kỳ và Nhật Bản.',
      ],
      contentMarkdown: `### 💬 Pháp Lý AI: Dấu Mốc Lịch Sử Cho Các Nhà Phát Triển

Phán quyết mới nhất từ các cơ quan tư pháp Châu Âu mang lại hành lang pháp lý rõ ràng hơn cho toàn bộ ngành công nghiệp trí tuệ nhân tạo.`,
      tags: ['Copyright', 'Legal', 'FairUse', 'Europe', 'Policy'],
      hotScore: 890,
      discussionCount: 340,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },

    // ----------------------------------------------------
    // THÁNG 9 (d35 & d42)
    // ----------------------------------------------------
    {
      id: 'radar-sample-23',
      title: 'Báo Cáo Toàn Cầu: Tỷ Lệ Ứng Dụng AI Vào Quản Lý Dự Án (PM) Tăng Trưởng 140%',
      category: 'global-ai',
      publishedDate: d35,
      sourceName: 'Project Management Institute (PMI) Report',
      sourceUrl: 'https://pmi.org',
      author: 'PMI Global Research Team',
      summary: 'Khảo sát hơn 5,000 Project Manager toàn cầu: Hơn 65% PM đã sử dụng các trợ lý AI hàng ngày để tóm tắt biên bản họp, theo dõi rủi ro tiến độ và tự động hóa báo cáo tuần.',
      keyTakeaways: [
        'Các dự án tích hợp AI ghi nhận tỷ lệ hoàn thành đúng hạn cao hơn 28% so với phương pháp thủ công truyền thống.',
        'Vai trò của PM chuyển dần từ người đốc thúc công việc thành nhà thiết kế chiến lược và người tối ưu hóa luồng giá trị.',
        'Khuyến nghị các doanh nghiệp trang bị các công cụ PM Workspace tích hợp sẵn trí tuệ nhân tạo.',
      ],
      contentMarkdown: `### 🌐 Báo Cáo PMI: AI Đang Thay Đổi Diện Mạo Quản Trị Dự Án Như Thế Nào?

Báo cáo thường niên của Viện Quản trị Dự án Thế giới (PMI) chỉ ra làn sóng chuyển đổi số mạnh mẽ trong cộng đồng các Project Manager toàn cầu.`,
      tags: ['PMI', 'Project Management', 'Productivity', 'Adoption'],
      hotScore: 1210,
      discussionCount: 380,
      isBookmarked: true,
      isRead: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-24',
      title: 'Smolagents Từ Hugging Face: Triết Lý Code Actions Giúp Agent Chạy Nhanh Gấp 3 Lần',
      category: 'github-trending',
      publishedDate: d35,
      sourceName: 'Hugging Face Blog',
      sourceUrl: 'https://huggingface.co/blog/smolagents',
      author: 'Aymeric Roucher & HF Team',
      summary: 'Thư viện Smolagents đề xuất Agent nên viết mã thực thi trực tiếp (Code Actions) thay vì xuất JSON tool calls rườm rà, giúp giảm số lượng token và tăng tốc độ xử lý bài toán.',
      keyTakeaways: [
        'Mã nguồn thư viện siêu gọn nhẹ (chỉ khoảng 1,000 dòng code Python).',
        'Khả năng phối hợp linh hoạt với các mô hình Hugging Face Hub và Local Transformers.',
        'Hỗ trợ sandbox an toàn ngăn chặn các lệnh hệ thống nguy hiểm.',
      ],
      contentMarkdown: `### ⭐ Hiện Tượng Tối Giản: Smolagents

Hugging Face một lần nữa chứng minh: Đôi khi các giải pháp tối giản lại mang lại hiệu năng cao nhất trong thế giới AI phức tạp.`,
      tags: ['HuggingFace', 'Smolagents', 'CodeAgents', 'Python'],
      hotScore: 1390,
      discussionCount: 275,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-25',
      title: 'Mistral AI Phát Hành Pixtral Large 124B: Đỉnh Cao Thị Giác Máy Tính Đa Phương Thức',
      category: 'big-tech-releases',
      publishedDate: d42,
      sourceName: 'Mistral AI News',
      sourceUrl: 'https://mistral.ai/news',
      author: 'Mistral Research Lab',
      summary: 'Mistral AI ra mắt Pixtral Large với khả năng đọc hiểu sơ đồ kỹ thuật, phân tích biểu đồ tài chính và giải mã văn bản viết tay với độ chính xác vượt trội các giải pháp thương mại.',
      keyTakeaways: [
        'Hỗ trợ đầu vào hình ảnh độ phân giải không giới hạn (native aspect ratio).',
        'Mã nguồn mở phục vụ nghiên cứu và cung cấp API thương mại với giá cạnh tranh.',
        'Khả năng đọc hiểu bản vẽ CAD và sơ đồ nguyên lý MEP vượt trội.',
      ],
      contentMarkdown: `### 🚀 Pixtral Large: Sức Mạnh Thị Giác AI Đến Từ Châu Âu

Mistral AI tiếp tục khẳng định vị thế với mô hình đa phương thức mã nguồn mở mạnh mẽ nhất hiện nay trong phân khúc 124B parameters.`,
      tags: ['Mistral AI', 'Pixtral', 'Vision AI', 'MultiModal', 'OpenSource'],
      hotScore: 1540,
      discussionCount: 460,
      isBookmarked: false,
      isRead: false,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
    {
      id: 'radar-sample-26',
      title: 'Tự Động Hóa Quản Lý Redmine & Slack Bằng AI: Dự Báo Trễ Hạn Và Cân Bằng Tải Nhân Sự',
      category: 'tools-agents',
      publishedDate: d42,
      sourceName: 'AnyBIM Engineering Best Practices',
      sourceUrl: 'https://redmine.anybim.vn',
      author: 'AnyBIM PM Taskforce',
      summary: 'Quy trình tích hợp Redmine issues, Slack action logs và dữ liệu chấm công OT vào một AI pipeline thống nhất, giúp cảnh báo nguy cơ chậm tiến độ trước 3 ngày so với deadline.',
      keyTakeaways: [
        'Tự động phân loại mức độ khẩn cấp của các tin nhắn trao đổi trên Slack và chuyển thành ticket Redmine.',
        'Biểu đồ nhiệt phân bổ nguồn lực giúp PM phát hiện sớm tình trạng quá tải của các thành viên chủ chốt.',
        'Đã triển khai thực tế trên hơn 15 dự án BIM cơ điện tại Việt Nam.',
      ],
      contentMarkdown: `### 🛠️ Thực Tiễn Ứng Dụng: AI & Quản Lý Tiến Độ Doanh Nghiệp

Kinh nghiệm thực chiến từ đội ngũ kỹ sư AnyBIM trong việc chuyển đổi hệ thống quản lý công việc từ bị động sang chủ động dự báo rủi ro.`,
      tags: ['Redmine', 'Slack', 'AnyBIM', 'BestPractices', 'PM Automation'],
      hotScore: 1610,
      discussionCount: 390,
      isBookmarked: true,
      isRead: true,
      createdAt: nowIso,
      updatedAt: nowIso,
    },
  ];
}
