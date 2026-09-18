import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readIssueListResponse } from './issueResponse';

test('plain text function crashes and authorization errors retain HTTP status', async () => {
  for (const status of [401, 403, 429, 500, 504]) {
    await assert.rejects(() => readIssueListResponse(new Response('FUNCTION_INVOCATION_FAILED', { status })), new RegExp(`HTTP ${status}`));
  }
});
test('successful malformed responses are not presented as an empty project', async () => {
  await assert.rejects(() => readIssueListResponse(new Response('<html>SPA</html>')), /không hợp lệ/);
  await assert.rejects(() => readIssueListResponse(new Response('{"error":"failure"}')), /không hợp lệ/);
  assert.deepEqual(await readIssueListResponse(new Response('{"issues":[],"total_count":0}')), { issues: [], total_count: 0 });
  assert.equal((await readIssueListResponse(new Response('{"issues":[{"id":1}],"total_count":3044}'))).total_count, 3044);
});
