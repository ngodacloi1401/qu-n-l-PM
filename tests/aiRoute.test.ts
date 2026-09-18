import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import app from '../api/index';

test('AI API accepts the report limit and returns JSON errors for oversized bodies', async () => {
  const previousKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address() as { port: number };
  const url = `http://127.0.0.1:${address.port}/api/gemini/pm-insights`;
  try {
    const allowed = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'standup', padding: 'x'.repeat(125000) }) });
    assert.equal(allowed.status, 400);
    assert.match((await allowed.json()).error, /GEMINI_API_KEY/);
    const tooLarge = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ padding: 'x'.repeat(300000) }) });
    assert.equal(tooLarge.status, 413);
    assert.match(tooLarge.headers.get('content-type')!, /application\/json/);
    assert.match((await tooLarge.json()).error, /quá lớn/);
  } finally {
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
