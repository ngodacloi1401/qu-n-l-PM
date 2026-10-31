import test from 'node:test';
import assert from 'node:assert';
import { resolveRedmineCredentials } from '../lib/redmineCredentials';

test('resolveRedmineCredentials prefers explicit header key when supplied', () => {
  const config = resolveRedmineCredentials('https://custom.redmine.vn', 'header-secret-12345');
  assert.strictEqual(config.baseUrl, 'https://custom.redmine.vn');
  assert.strictEqual(config.apiKey, 'header-secret-12345');
  assert.strictEqual(config.source, 'header');
});

test('resolveRedmineCredentials falls back to env or Windows Credential Manager and caches result', () => {
  const start = Date.now();
  const config = resolveRedmineCredentials();
  assert.ok(config.baseUrl.startsWith('http'));
  // On this Windows system, redmine-auth.ps1 is available and credentials exist
  if (process.platform === 'win32') {
    assert.ok(config.apiKey.length >= 20, 'Expected API key resolved from Windows Credential Manager');
    assert.strictEqual(config.source, 'windows-credential');

    // Second call must be instant from memory cache
    const secondCallStart = Date.now();
    const config2 = resolveRedmineCredentials();
    const duration = Date.now() - secondCallStart;
    assert.strictEqual(config2.apiKey, config.apiKey);
    assert.ok(duration < 20, `Expected cached call to take <20ms, took ${duration}ms`);
  }
});
