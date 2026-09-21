import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import app from '../api/index';
import { verifyPassword, createSessionToken, verifySessionToken, DEFAULT_APP_PASSWORD } from '../lib/auth';

test('verifyPassword validates default password Vicky xinh đẹp and rejects wrong passwords', () => {
  assert.equal(verifyPassword('Vicky xinh đẹp'), true);
  assert.equal(verifyPassword('  Vicky xinh đẹp  '), true);
  assert.equal(verifyPassword('vicky xinh đẹp'), false);
  assert.equal(verifyPassword('wrong-password'), false);
  assert.equal(verifyPassword(''), false);
  assert.equal(verifyPassword(null as any), false);
});

test('session token signs and verifies with expiry', () => {
  const token = createSessionToken();
  assert.equal(verifySessionToken(token), true);
  assert.equal(verifySessionToken(token + 'tampered'), false);
  assert.equal(verifySessionToken('invalid.token'), false);
  assert.equal(verifySessionToken(null), false);

  // Expired token
  const expiredToken = `${Date.now() - 1000}.nonce.fake`;
  assert.equal(verifySessionToken(expiredToken), false);
});

test('auth routes login, check, and protect endpoints', async () => {
  process.env.TEST_ENFORCE_AUTH = 'true';
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as { port: number }).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Unauthenticated request to protected endpoint should return 401
    const unauthRes = await fetch(`${baseUrl}/api/redmine/me`);
    assert.equal(unauthRes.status, 401);
    const unauthData = await unauthRes.json();
    assert.equal(unauthData.code, 'UNAUTHORIZED');

    // 2. Login with wrong password should fail with 401
    const wrongLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'wrong' }),
    });
    assert.equal(wrongLoginRes.status, 401);
    const wrongLoginData = await wrongLoginRes.json();
    assert.equal(wrongLoginData.ok, false);

    // 3. Login with correct password 'Vicky xinh đẹp' succeeds
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: DEFAULT_APP_PASSWORD }),
    });
    assert.equal(loginRes.status, 200);
    const loginData = await loginRes.json();
    assert.equal(loginData.ok, true);
    assert.ok(typeof loginData.token === 'string' && loginData.token.length > 20);

    const validToken = loginData.token;

    // 4. Check auth status with valid token
    const checkRes = await fetch(`${baseUrl}/api/auth/check`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.equal(checkRes.status, 200);
    const checkData = await checkRes.json();
    assert.equal(checkData.authenticated, true);

    // 5. Calling protected endpoint with valid token should bypass 401
    const authedRes = await fetch(`${baseUrl}/api/redmine/me`, {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    assert.notEqual(authedRes.status, 401);

    // 6. Logout route returns 200
    const logoutRes = await fetch(`${baseUrl}/api/auth/logout`, { method: 'POST' });
    assert.equal(logoutRes.status, 200);
  } finally {
    delete process.env.TEST_ENFORCE_AUTH;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
