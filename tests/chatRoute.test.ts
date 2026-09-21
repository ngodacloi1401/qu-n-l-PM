process.env.NODE_ENV = 'test';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import app from '../api/index';
import { createChatRequest } from '../lib/geminiChat';
import { buildAIChatPayload, type ChatMessage } from '../src/services/aiPayload';
import type { RedmineIssue } from '../src/types/redmine';
import { listGeminiTextModels } from '../lib/geminiModels';
import { listAnthropicModels, listOpenAICodexModels, listOpenAIModels } from '../lib/aiProviders';

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

test('chat falls back to a model allowed by the active API key when the selected model is missing', async () => {
  const originalFetch = globalThis.fetch;
  const attempted: string[] = [];
  globalThis.fetch = async (url) => {
    const model = decodeURIComponent(String(url)).match(/models\/(.*?):generateContent/)?.[1] || '';
    attempted.push(model);
    if (model === 'gemini-missing') return new Response(JSON.stringify({ error: { code: 404, message: 'not found', status: 'NOT_FOUND' } }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ candidates: [{ content: { role: 'model', parts: [{ text: 'Đã dùng model khả dụng' }] }, finishReason: 'STOP' }] }), { headers: { 'Content-Type': 'application/json' } });
  };
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  try {
    const payload = buildAIChatPayload([{ role: 'user', text: 'Phân tích dự án' }], 'Test', [], [], 0, 'gemini-missing', { loadedCount: 0, availableModels: ['gemini-3.8-flash'] });
    const response = await originalFetch(`http://127.0.0.1:${port}/api/gemini/pm-insights`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-gemini-api-key': 'test-only-key' }, body: JSON.stringify(payload) });
    const data: any = await response.json();
    assert.equal(response.status, 200, JSON.stringify(data));
    assert.equal(data.usedModel, 'gemini-3.8-flash');
    assert.equal(data.fallbackOccurred, true);
    assert.deepEqual(attempted, ['gemini-missing', 'gemini-3.8-flash']);
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

test('OpenAI and Anthropic model discovery keeps chat models returned for the active key', async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async (url) => {
      if (String(url).includes('openai.com')) return new Response(JSON.stringify({ data: [
        { id: 'gpt-5.2' }, { id: 'gpt-5.3-codex' }, { id: 'gpt-image-1' }, { id: 'text-embedding-3-large' }, { id: 'o4-mini' },
      ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      return new Response(JSON.stringify({ data: [
        { id: 'claude-sonnet-5', display_name: 'Claude Sonnet 5' }, { id: 'not-claude', display_name: 'Other' },
      ] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    };
    assert.deepEqual((await listOpenAIModels('test-key')).map(item => item.id), ['o4-mini', 'gpt-5.2']);
    assert.deepEqual((await listOpenAICodexModels('test-key')).map(item => item.id), ['gpt-5.3-codex']);
    assert.deepEqual((await listAnthropicModels('test-key')).map(item => item.id), ['claude-sonnet-5']);
  } finally { globalThis.fetch = originalFetch; }
});

test('provider chat routes send the full PM prompt to OpenAI and Anthropic', async () => {
  const originalFetch = globalThis.fetch;
  const captured: Array<{ url: string; body: any; headers: Headers }> = [];
  globalThis.fetch = async (url, init) => {
    const target = String(url);
    captured.push({ url: target, body: JSON.parse(String(init?.body)), headers: new Headers(init?.headers) });
    if (target.includes('openai.com')) return new Response(JSON.stringify({ output_text: 'OpenAI đã phân tích dự án.' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    if (target.includes('anthropic.com')) return new Response(JSON.stringify({ content: [{ type: 'text', text: 'Claude đã phân tích dự án.' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    throw new Error(`Unexpected outbound request: ${target}`);
  };
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  try {
    const base = buildAIChatPayload([{ role: 'user', text: 'Tổng hợp toàn bộ dự án' }], 'Test Project', [], [], 0, 'gpt-5.2', { loadedCount: 0 });
    const openAI = await originalFetch(`http://127.0.0.1:${port}/api/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-openai-api-key': 'openai-test' }, body: JSON.stringify({ ...base, provider: 'openai' }) });
    assert.equal(openAI.status, 200, await openAI.clone().text());
    assert.equal((await openAI.json()).result, 'OpenAI đã phân tích dự án.');

    const codex = await originalFetch(`http://127.0.0.1:${port}/api/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-openai-api-key': 'openai-test' }, body: JSON.stringify({ ...base, provider: 'codex', model: 'gpt-5.3-codex' }) });
    assert.equal(codex.status, 200, await codex.clone().text());
    assert.equal((await codex.json()).result, 'OpenAI đã phân tích dự án.');

    const anthropic = await originalFetch(`http://127.0.0.1:${port}/api/ai/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-anthropic-api-key': 'anthropic-test' }, body: JSON.stringify({ ...base, provider: 'anthropic', model: 'claude-sonnet-5' }) });
    assert.equal(anthropic.status, 200, await anthropic.clone().text());
    assert.equal((await anthropic.json()).result, 'Claude đã phân tích dự án.');

    assert.equal(captured[0].body.model, 'gpt-5.2');
    assert.match(captured[0].body.instructions, /Test Project/);
    assert.equal(captured[0].body.store, false);
    assert.equal(captured[1].body.model, 'gpt-5.3-codex');
    assert.match(captured[1].body.instructions, /allIssues/);
    assert.equal(captured[2].body.model, 'claude-sonnet-5');
    assert.match(captured[2].body.system, /allIssues/);
    assert.equal(captured[2].headers.get('anthropic-version'), '2023-06-01');
  } finally { globalThis.fetch = originalFetch; await new Promise<void>(resolve => server.close(() => resolve())); }
});
