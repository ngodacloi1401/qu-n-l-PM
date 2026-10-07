import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {
  resolveSpreadsheetId,
  getServiceAccountStatus,
  getServiceAccountCredentials,
} from '../lib/googleServiceAccount.js';
import { registerGoogleSheetsRoutes } from '../lib/googleSheets.js';

test('resolveSpreadsheetId extracts ID from Google Sheets URL or raw ID', () => {
  // Sharing link
  const url1 = 'https://docs.google.com/spreadsheets/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms/edit#gid=0';
  assert.equal(resolveSpreadsheetId(url1), '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');

  // Export link
  const url2 = 'https://docs.google.com/spreadsheets/d/2PACX-1vSampleSpreadsheetId12345/export?format=xlsx';
  assert.equal(resolveSpreadsheetId(url2), '2PACX-1vSampleSpreadsheetId12345');

  // Raw spreadsheet ID (>= 20 chars)
  const rawId = '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms';
  assert.equal(resolveSpreadsheetId(rawId), rawId);

  // Invalid strings should throw
  assert.throws(() => resolveSpreadsheetId(''), /không hợp lệ/);
  assert.throws(() => resolveSpreadsheetId('https://example.com/not-a-sheet'), /không hợp lệ/);
  assert.throws(() => resolveSpreadsheetId('short-id'), /không hợp lệ/);
});

test('getServiceAccountStatus returns configured: false when no credentials exist', () => {
  // Clear any potential env vars
  const origEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const origKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const origJson = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  try {
    const status = getServiceAccountStatus();
    assert.equal(typeof status.configured, 'boolean');
    assert.ok(status.hint);
  } finally {
    if (origEmail) process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = origEmail;
    if (origKey) process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = origKey;
    if (origJson) process.env.GOOGLE_SERVICE_ACCOUNT_JSON = origJson;
  }
});

test('getServiceAccountCredentials correctly parses environment variables when set', () => {
  const testEmail = 'robot-pm-test@anybim-project.iam.gserviceaccount.com';
  const testKey = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC\n-----END PRIVATE KEY-----';

  process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = testEmail;
  process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY = testKey;
  process.env.GOOGLE_PROJECT_ID = 'anybim-project';

  try {
    const creds = getServiceAccountCredentials();
    assert.ok(creds);
    assert.equal(creds?.client_email, testEmail);
    assert.equal(creds?.project_id, 'anybim-project');

    const status = getServiceAccountStatus();
    assert.equal(status.configured, true);
    assert.equal(status.clientEmail, testEmail);
  } finally {
    delete process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
    delete process.env.GOOGLE_PROJECT_ID;
  }
});

test('Google Service Account API routes validate request payloads correctly', async () => {
  const app = express();
  app.use(express.json());
  registerGoogleSheetsRoutes(app);

  const server = app.listen(0);
  const port = (server.address() as any).port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. GET status
    const statusRes = await fetch(`${baseUrl}/api/google-sheets/service-account/status`);
    assert.equal(statusRes.status, 200);
    const statusData = await statusRes.json();
    assert.equal(typeof statusData.configured, 'boolean');

    // 2. POST test without URL
    const testRes = await fetch(`${baseUrl}/api/google-sheets/service-account/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(testRes.status, 400);

    // 3. POST pull without URL
    const pullRes = await fetch(`${baseUrl}/api/google-sheets/service-account/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(pullRes.status, 400);

    // 4. POST push-task without task
    const pushTaskRes = await fetch(`${baseUrl}/api/google-sheets/service-account/push-task`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://docs.google.com/spreadsheets/d/12345678901234567890/edit' }),
    });
    assert.equal(pushTaskRes.status, 400);

    // 5. POST push-all without tasks array
    const pushAllRes = await fetch(`${baseUrl}/api/google-sheets/service-account/push-all`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: 'https://docs.google.com/spreadsheets/d/12345678901234567890/edit' }),
    });
    assert.equal(pushAllRes.status, 400);
  } finally {
    server.close();
  }
});
