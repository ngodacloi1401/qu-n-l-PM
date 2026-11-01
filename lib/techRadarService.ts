import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

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
  search?: string;
  bookmarkedOnly?: boolean;
  limit?: number;
  offset?: number;
}

const DATA_DIR = resolve('data');
const DATA_FILE = resolve('data', 'tech-radar-articles.json');

let memoryArticlesCache: TechRadarArticle[] | null = null;

function ensureDataFile(): TechRadarArticle[] {
  if (memoryArticlesCache) {
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
    memoryArticlesCache = JSON.parse(raw);
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

export function getAllArticles(filter?: GetArticlesFilter): { articles: TechRadarArticle[]; total: number; todayCount: number } {
  let list = ensureDataFile();
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayCount = list.filter((a) => a.publishedDate === todayStr).length;

  if (filter?.category && filter.category !== 'all') {
    list = list.filter((a) => a.category === filter.category);
  }

  if (filter?.date && filter.date !== 'all') {
    list = list.filter((a) => a.publishedDate === filter.date);
  }

  if (filter?.bookmarkedOnly) {
    list = list.filter((a) => a.isBookmarked);
  }

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

  return { articles: paginated, total, todayCount };
}

export function addArticles(incoming: Array<Partial<TechRadarArticle>>): { added: number; updated: number } {
  const current = ensureDataFile();
  let added = 0;
  let updated = 0;
  const now = new Date().toISOString();
  const todayStr = now.slice(0, 10);

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
      // Update existing
      current[existingIndex] = {
        ...current[existingIndex],
        ...item,
        updatedAt: now,
      };
      updated++;
    } else {
      // Create new
      const newArticle: TechRadarArticle = {
        id: item.id || `radar-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: item.title.trim(),
        category: item.category || 'global-ai',
        publishedDate: item.publishedDate || todayStr,
        sourceName: item.sourceName || 'Tech Daily Research',
        sourceUrl: item.sourceUrl || '',
        author: item.author || 'AI Radar Intelligence',
        summary: item.summary || item.title,
        keyTakeaways: Array.isArray(item.keyTakeaways) ? item.keyTakeaways : [],
        contentMarkdown: item.contentMarkdown || item.summary || item.title,
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

function getSampleArticles(): TechRadarArticle[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  return [
    {
      id: 'radar-sample-01',
      title: 'Đột phá Mô hình Reasoning Mở: Xu hướng AI Open-Weights làm rung chuyển ngành công nghệ',
      category: 'global-ai',
      publishedDate: todayStr,
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
- **Các viện nghiên cứu**: Cảnh báo về việc cần thiết lập các tiêu chuẩn an toàn kiểm thử tự động trước khi triển khai quy mô lớn.

#### 3. Khuyến nghị ứng dụng
- Tận dụng các mô hình gọn nhẹ (7B - 14B) để chạy offline cho các tác vụ phân tích bản vẽ, parsing logic và hỗ trợ PM ngay trong mạng nội bộ.`,
      tags: ['Reasoning', 'OpenSource', 'AI Trends', 'Global Tech'],
      hotScore: 985,
      discussionCount: 342,
      isBookmarked: true,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'radar-sample-02',
      title: 'Anthropic công bố Claude 3.7 Sonnet: Mô hình Hybrid Reasoning đầu tiên trên thị trường',
      category: 'big-tech-releases',
      publishedDate: todayStr,
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
2. **SWE-bench Verified 70.3%**: Mô hình giải quyết thành công hơn 70% các pull request thực tế trên GitHub mà không cần con người can thiệp.
3. **Phù hợp với các hệ thống PM & ERP**: Phân tích các ràng buộc dự án phức tạp, tự động đối soát tiến độ và cảnh báo xung đột công việc chuẩn xác.`,
      tags: ['Claude 3.7', 'Anthropic', 'Coding AI', 'SWE-bench', 'Release'],
      hotScore: 1240,
      discussionCount: 512,
      isBookmarked: false,
      isRead: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'radar-sample-03',
      title: 'Top GitHub Trending: Browser-Use & Agentic Automation vượt mốc 35,000 Stars',
      category: 'github-trending',
      publishedDate: todayStr,
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

#### Mã nguồn ví dụ:
\`\`\`python
from browser_use import Agent
from langchain_openai import ChatOpenAI

agent = Agent(
    task="Đăng nhập vào hệ thống quản lý, tải báo cáo tuần và tóm tắt rủi ro tiến độ",
    llm=ChatOpenAI(model="gpt-4o"),
)
await agent.run()
\`\`\`

#### Khả năng cốt lõi:
- **Tự động nhận diện nút bấm & ô nhập liệu**: Sử dụng tọa độ pixel và cấu trúc accessibility tree.
- **Vượt qua các form đa bước**: Phù hợp cho việc cào dữ liệu báo cáo, kiểm tra trang web dự án hoặc tự động đăng nhập xác minh báo cáo Redmine.`,
      tags: ['GitHub Trending', 'Browser-Use', 'AI Agents', 'Automation'],
      hotScore: 890,
      discussionCount: 187,
      isBookmarked: false,
      isRead: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    {
      id: 'radar-sample-04',
      title: 'Hội đồng Công nghệ Thảo luận: Tương lai của AI Coding Assistants - Cursor vs Windsurf vs Claude Code',
      category: 'community-buzz',
      publishedDate: yesterday,
      sourceName: 'Hacker News & X Tech Community',
      sourceUrl: 'https://news.ycombinator.com',
      author: 'Tech Industry Roundtable',
      summary: 'Cuộc tranh luận sôi nổi trên Hacker News và Twitter xoay quanh việc liệu các IDE AI chuyên dụng như Cursor/Windsurf hay các CLI Agents chạy trực tiếp trong terminal sẽ định hình cách kỹ sư phần mềm làm việc trong 3 năm tới.',
      keyTakeaways: [
        'Hơn 85% kỹ sư cấp cao khẳng định AI đã thay đổi hoàn toàn quy trình viết code từ gõ phím sang thẩm định kiến trúc và review mã.',
        'Tranh cãi lớn về độ an toàn mã nguồn: Doanh nghiệp lo ngại về rò rỉ IP khi telemetry của các extension IDE gửi context lên cloud.',
        'Xu hướng mới: Terminal-native agents (Agent chạy trực tiếp trong shell với quyền hạn khoanh vùng) đang bứt phá mạnh mẽ.',
      ],
      contentMarkdown: `### 💬 Diễn đàn Công nghệ: Đâu là chuẩn mực mới của Lập trình cùng AI?

Chủ đề thảo luận nóng nhất tuần này trên các cộng đồng lập trình viên thế giới (Hacker News, Reddit r/programming) xoay quanh cuộc đua giữa các nền tảng AI Coding.

#### 1. Cuộc đối đầu giữa GUI IDE và Terminal Agents:
- **Trường phái GUI (Cursor, Windsurf)**: Tập trung vào visual feedback, diff visualizer và gợi ý inline tab mượt mà. Rất trực quan cho các lập trình viên frontend và fullstack.
- **Trường phái Terminal Native (Claude Code, Aider, Antigravity CLI)**: Trao toàn quyền cho agent chạy test, build, lint và tương tác với git trực tiếp. Khả năng giải quyết bug phức tạp trên toàn bộ codebase vượt trội hơn 2.5 lần so với chat thông thường.

#### 2. Nhận định của các Tech Leads:
> *"Một kỹ sư giỏi trong năm 2026 không phải là người nhớ thuộc lòng cú pháp thư viện, mà là người biết đặt đề bài chính xác (prompt specification), phân tích ranh giới hệ thống (system boundaries) và thiết lập bộ test tự động nghiêm ngặt để agent tự kiểm chứng."*`,
      tags: ['Community Debate', 'HackerNews', 'Coding Assistants', 'Cursor', 'Developer Productivity'],
      hotScore: 1450,
      discussionCount: 689,
      isBookmarked: true,
      isRead: false,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'radar-sample-05',
      title: 'Google DeepMind nâng cấp Gemini 2.5 Flash: Đột phá tốc độ và Cửa sổ ngữ cảnh 1 Triệu Tokens',
      category: 'big-tech-releases',
      publishedDate: yesterday,
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

Google DeepMind vừa tung ra bản cập nhật lớn cho dòng mô hình **Gemini Flash**, hướng trực tiếp đến các ứng dụng thời gian thực và xử lý tài liệu khối lượng cực lớn.

#### Những con số ấn tượng:
- **Cửa sổ ngữ cảnh (Context Window)**: 1,000,000 tokens (tương đương khoảng 700,000 từ tiếng Anh hoặc hàng nghìn trang hồ sơ dự án).
- **Chi phí cực rẻ**: Rẻ hơn 90% so với thế hệ GPT-4 đời đầu, cho phép chạy phân tích dữ liệu liên tục 24/7 mà không lo cạn ngân sách API.
- **Ứng dụng cho PM Workspace**: Tải toàn bộ danh sách 5,000 issues dự án Redmine vào ngữ cảnh để AI Copilot phân tích điểm nghẽn tiến độ chỉ trong 3 giây.`,
      tags: ['Google AI', 'Gemini Flash', 'DeepMind', 'Big Context', 'Model Release'],
      hotScore: 1120,
      discussionCount: 295,
      isBookmarked: false,
      isRead: false,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'radar-sample-06',
      title: 'Hệ sinh thái Multi-Agent Frameworks bùng nổ: So sánh CrewAI, LangGraph và AutoGen',
      category: 'tools-agents',
      publishedDate: yesterday,
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

Khi một AI đơn lẻ không đủ khả năng đảm đương một quy trình nghiệp vụ phức tạp, giải pháp kết hợp **nhiều Agent chuyên trách** phối hợp cùng nhau đang trở thành kiến trúc chuẩn mực.

| Tiêu chí | LangGraph | CrewAI | AutoGen |
| :--- | :--- | :--- | :--- |
| **Mô hình luồng** | Graph tuần hoàn / State Machine | Hierarchical / Sequential Roles | Conversational Chat |
| **Độ kiểm soát** | Rất cao (Cyclic graph, Checkpoint) | Trung bình (Dễ thiết lập) | Linh hoạt nhưng khó đoán |
| **Production-ready** | ⭐⭐⭐⭐⭐ (Khuyên dùng cho Doanh nghiệp) | ⭐⭐⭐⭐ (Rất tốt cho Prototype) | ⭐⭐⭐ (Nghiên cứu) |
| **Human Approval** | Tích hợp sẵn điểm dừng Breakpoint | Hỗ trợ qua delegation | Tùy biến |

#### Ứng dụng thực tế cho Quản lý Dự án:
- **Agent Thu thập**: Quét dữ liệu Redmine & Slack hàng ngày.
- **Agent Phân tích**: Phát hiện chậm tiến độ và rủi ro quá tải nhân sự.
- **Agent Báo cáo**: Tổng hợp bản tin gửi cho PM phê duyệt trước khi phát đi.`,
      tags: ['Multi-Agent', 'LangGraph', 'CrewAI', 'Architecture', 'Enterprise AI'],
      hotScore: 940,
      discussionCount: 210,
      isBookmarked: false,
      isRead: false,
      createdAt: new Date(Date.now() - 86400000).toISOString(),
      updatedAt: new Date(Date.now() - 86400000).toISOString(),
    },
  ];
}
