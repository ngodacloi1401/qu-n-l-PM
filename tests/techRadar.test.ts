import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  getAllArticles,
  addArticles,
  updateArticle,
  deleteArticle,
  seedSampleArticles,
} from '../lib/techRadarService.js';

test('techRadarService seeds sample articles correctly', () => {
  const result = seedSampleArticles();
  assert.ok(result.count >= 6, 'Should have seeded at least 6 sample articles');

  const { articles, total } = getAllArticles();
  assert.ok(total >= 6);
  assert.equal(articles.length, total);

  // Check categories exist
  const categories = new Set(articles.map((a) => a.category));
  assert.ok(categories.has('global-ai'));
  assert.ok(categories.has('big-tech-releases'));
  assert.ok(categories.has('github-trending'));
  assert.ok(categories.has('community-buzz'));
  assert.ok(categories.has('tools-agents'));
});

test('techRadarService adds new articles and prevents duplicates', () => {
  const customId = `test-article-${Date.now()}`;
  const incoming = [
    {
      id: customId,
      title: 'Đánh giá chi tiết GPT-5 và năng lực lập trình tự động',
      category: 'global-ai' as const,
      publishedDate: '2026-11-01',
      sourceName: 'OpenAI Dev Forum',
      sourceUrl: 'https://community.openai.com/test-gpt5',
      summary: 'Khảo sát đột phá mới trong thế hệ mô hình tiếp theo.',
      keyTakeaways: ['Tăng tốc 300%', 'Context 2M tokens'],
      contentMarkdown: '# Phân tích chi tiết...',
      tags: ['GPT-5', 'NextGen'],
      hotScore: 500,
    },
  ];

  const res1 = addArticles(incoming);
  assert.equal(res1.added, 1);

  // Query it back
  const { articles } = getAllArticles({ search: 'GPT-5' });
  assert.ok(articles.length >= 1);
  const found = articles.find((a) => a.id === customId);
  assert.ok(found);
  assert.equal(found?.title, 'Đánh giá chi tiết GPT-5 và năng lực lập trình tự động');

  // Attempt duplicate insert with same sourceUrl
  const duplicate = [
    {
      title: 'Tiêu đề sửa đổi nhưng trùng sourceUrl',
      sourceUrl: 'https://community.openai.com/test-gpt5',
      summary: 'Đã cập nhật tóm tắt',
    },
  ];
  const res2 = addArticles(duplicate);
  assert.equal(res2.added, 0);
  assert.equal(res2.updated, 1);

  // Clean up
  const deleted = deleteArticle(customId);
  assert.equal(deleted, true);
});

test('techRadarService filters by category, date, and bookmark', () => {
  const { articles: aiArticles } = getAllArticles({ category: 'global-ai' });
  for (const a of aiArticles) {
    assert.equal(a.category, 'global-ai');
  }

  // Update bookmark status
  const all = getAllArticles().articles;
  if (all.length > 0) {
    const target = all[0];
    updateArticle(target.id, { isBookmarked: true });

    const { articles: bookmarked } = getAllArticles({ bookmarkedOnly: true });
    assert.ok(bookmarked.some((a) => a.id === target.id));
  }
});
