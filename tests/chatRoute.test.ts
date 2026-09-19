import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import app from '../api/index';
import { createChatRequest } from '../lib/geminiChat';
import { buildAIChatPayload, type ChatMessage } from '../src/services/aiPayload';
import type { RedmineIssue } from '../src/types/redmine';
import { listGeminiTextModels } from '../lib/geminiModels';

test('Gemini chat carries both turns to the SDK with current context and selected model', async () => {
  const originalFetch = globalThis.fetch;
  const captured: any[] = [];
  globalThis.fetch = async (url, init) => {
    if (!String(url).startsWith('https://generativelanguage.googleapis.com/')) throw new Error('Unexpected outbound request');
    captured.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'Phản hồi kiểm thử' }] }, finishReason: 'STOP' }] }), { headers: { 'Content-Type': 'application/json' } });
  };
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  const messages: ChatMessage[] = [{ role: 'user', text: 'Phân tích dự án' }];
  try {
    const send = async () => {
      const response = await originalFetch(`http://127.0.0.1:${port}/api/gemini/pm-insights`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gemini-api-key': 'test-only-key' }, body: JSON.stringify(buildAIChatPayload(messages, 'Test Project', [], [], 100, 'gemini-2.5-flash-lite')) });
      assert.equal(response.status, 200, await response.clone().text()); return response.json();
    };
    const first = await send(); assert.equal(first.usedModel, 'gemini-2.5-flash-lite');
    messages.push({ role: 'assistant', text: first.result }, { role: 'user', text: 'Nói rõ hơn về nhận định trước' });
    await send();
    assert.equal(captured.length, 2);
    assert.deepEqual(captured[1].contents.map((m: any) => m.role), ['user', 'model', 'user']);
    assert.equal(captured[1].contents[1].parts[0].text, first.result);
    assert.match(JSON.stringify(captured[1].systemInstruction), /Test Project/);
    assert.match(JSON.stringify(captured[1].systemInstruction), /allIssues/);
  } finally { globalThis.fetch = originalFetch; await new Promise<void>(resolve => server.close(() => resolve())); }
});

test('ten thousand project issues remain complete in the compact AI context', () => {
  const issues = Array.from({ length: 10_000 }, (_, index) => ({
    id: index + 1,
    subject: `Công việc ${index + 1} ${'x'.repeat(120)}`,
    status: { id: index % 2 ? 5 : 2, name: index % 2 ? 'Closed' : 'In Progress' },
    tracker: { id: 4, name: 'Task' }, priority: { id: 1, name: 'Normal' },
    assigned_to: { id: index % 100, name: `User ${index % 100}` },
  } as RedmineIssue));
  const payload = buildAIChatPayload([{ role: 'user', text: 'Tổng hợp toàn dự án' }], 'Large Project', issues, [], 10_000, 'gemini-2.5-flash', { loadedCount: 10_000 });
  assert.equal(payload.context.isComplete, true);
  assert.equal(payload.context.allIssues.length, 10_000);
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) <= 3_800_000);
});

test('chat validation rejects invalid roles and includes every issue within the request bound', () => {
  assert.throws(() => createChatRequest({ messages: [{ role: 'system', text: 'x' }] }), /không hợp lệ/);
  assert.throws(() => createChatRequest({ messages: [{ role: 'assistant', text: 'x' }] }), /bắt đầu/);
  const messages: ChatMessage[] = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? 'user' : 'assistant', text: 'ữ'.repeat(8000) }));
  const issue = { id: 123, subject: 'ữ'.repeat(1000), status: { id: 1, name: 'QA Verified' }, tracker: { id: 4, name: 'Task' }, project: { id: 84, name: 'Test' }, priority: { id: 1, name: 'Normal' } } as RedmineIssue;
  const payload = buildAIChatPayload(messages, 'Test', Array(5000).fill(issue), [], 6650, 'gemini-2.5-flash');
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) <= 3_800_000);
  assert.equal(payload.context.allIssues.length, 5000);
  assert.equal(payload.context.allIssueCount, 5000);
  assert.equal(payload.context.isComplete, false);
  assert.equal(payload.statistics.totalIssues, 5000);
  assert.ok(payload.messages.length <= 24);
  assert.equal(createChatRequest(payload).contents.at(-1)?.role, 'user');
});

test('a specifically requested issue outside the default sample is included', () => {
  const base = { subject: 'Task', status: { id: 1, name: 'New' }, tracker: { id: 4, name: 'Task' }, priority: { id: 1, name: 'Normal' } };
  const issues = Array.from({ length: 5000 }, (_, n) => ({ ...base, id: n + 1000 } as RedmineIssue));
  const payload = buildAIChatPayload([{ role: 'user', text: 'Giải thích #5999' }], 'Test', issues, [], 5000, 'gemini-2.5-flash');
  assert.equal(payload.issues[0].id, 5999);
  const followup = buildAIChatPayload([{ role: 'user', text: 'Giải thích #5999' }, { role: 'assistant', text: 'Issue #5999 là Task' }, { role: 'user', text: 'Việc đó ai phụ trách?' }], 'Test', issues, [], 5000, 'gemini-2.5-flash');
  assert.equal(followup.issues[0].id, 5999);
  const incomplete = buildAIChatPayload([{ role: 'user', text: 'Tổng hợp dự án' }], 'Test', issues.slice(0, 10), [], 5000, 'gemini-2.5-flash', { loadedCount: 10 });
  assert.equal(incomplete.context.isComplete, false);
  assert.equal(incomplete.context.allIssueCount, 10);
  assert.equal(incomplete.statistics.totalIssues, 10);
});

test('Gemini model discovery keeps text generateContent models and excludes media endpoints', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ models: [
    { name: 'models/gemini-3.8-flash', baseModelId: 'gemini-3.8-flash', displayName: 'Gemini 3.8 Flash', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-3.1-flash-image', baseModelId: 'gemini-3.1-flash-image', displayName: 'Image', supportedGenerationMethods: ['generateContent'] },
    { name: 'models/gemini-embedding-001', baseModelId: 'gemini-embedding-001', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
    { name: 'models/gemini-2.5-pro', baseModelId: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', supportedGenerationMethods: ['generateContent'] },
  ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  try {
    const models = await listGeminiTextModels('test-key');
    assert.deepEqual(models.map(model => model.id), ['gemini-3.8-flash', 'gemini-2.5-pro']);
  } finally { globalThis.fetch = originalFetch; }
});
