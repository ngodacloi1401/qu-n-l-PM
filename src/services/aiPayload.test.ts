import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildAIReportPayload, readAIReportResponse } from './aiPayload';
import { geminiErrorResponse } from '../../lib/geminiErrors';
import type { RedmineIssue } from '../types/redmine';

test('large Redmine projects produce bounded AI requests while retaining overall counts', () => {
  const name = 'ữ'.repeat(2000);
  const issue = { id: 1, subject: name, description: name.repeat(10), project: { id: 84, name }, tracker: { id: 4, name }, status: { id: 1, name }, priority: { id: 1, name }, assigned_to: { id: 183, name }, journals: Array(100).fill({ notes: name }) } as unknown as RedmineIssue;
  const issues = Array(6650).fill(issue);
  const payload = buildAIReportPayload('risk', name, issues, { totalIssues: 6650, userNoteForAI: name.repeat(5) }, 'gemini-2.5-flash');
  assert.equal(payload.issues.length, 35);
  assert.equal(payload.statistics.totalIssues, 6650);
  assert.equal(String(payload.statistics.userNoteForAI).length, 1000);
  assert.ok(Buffer.byteLength(JSON.stringify(payload)) < 256 * 1024);
  assert.equal('journals' in payload.issues[0], false);
  assert.equal(buildAIReportPayload('standup', 'Test', issues, {}).issues.length, 30);
  assert.equal(buildAIReportPayload('general', 'Test', issues, {}).issues.length, 20);
});

test('HTML and plain-text hosting errors retain actionable HTTP status', async () => {
  for (const status of [413, 429, 500, 504]) {
    await assert.rejects(() => readAIReportResponse(new Response('<html>failure</html>', { status })), new RegExp(`HTTP ${status}`));
  }
  await assert.rejects(() => readAIReportResponse(new Response(JSON.stringify({ error: 'Khóa chưa cấu hình' }), { status: 400 })), /Khóa chưa cấu hình/);
  await assert.rejects(() => readAIReportResponse(new Response('<html>index</html>')), /không trả về/);
  await assert.rejects(() => readAIReportResponse(new Response('{"result":""}')), /không trả về/);
  assert.equal((await readAIReportResponse(new Response('{"result":"Báo cáo"}'))).result, 'Báo cáo');
});

test('Gemini errors distinguish invalid key, quota, model and timeout without leaking credentials', () => {
  assert.equal(geminiErrorResponse({ status: 403, message: 'secret' }).status, 403);
  assert.match(geminiErrorResponse({ status: 429 }).error, /quota/);
  assert.match(geminiErrorResponse({ status: 404 }).error, /Model/);
  assert.equal(geminiErrorResponse({ message: 'request timed out' }).status, 504);
  assert.equal(geminiErrorResponse({ status: 500, message: 'secret' }).error.includes('secret'), false);
});
