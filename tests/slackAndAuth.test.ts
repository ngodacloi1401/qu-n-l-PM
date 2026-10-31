import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSessionToken, verifySessionToken, getUserFromToken } from '../lib/auth';
import { getPersonalSlackAlerts, testSlackConnection } from '../lib/slackService';

test('createSessionToken stores user payload and getUserFromToken decodes it accurately', () => {
  const user = {
    id: 99,
    login: 'loind',
    firstname: 'Lợi',
    lastname: 'Ngô',
    mail: 'loind@anybim.vn',
  };

  const token = createSessionToken(7, user);
  assert.equal(verifySessionToken(token), true);

  const decoded = getUserFromToken(token);
  assert.ok(decoded);
  assert.equal(decoded.id, 99);
  assert.equal(decoded.login, 'loind');
  assert.equal(decoded.firstname, 'Lợi');

  // Verify legacy 3-part token still verifies but returns null for user
  const legacyToken = createSessionToken(7);
  assert.equal(verifySessionToken(legacyToken), true);
  assert.equal(getUserFromToken(legacyToken), null);
});

test('testSlackConnection rejects empty or invalid token format safely', async () => {
  const emptyRes = await testSlackConnection('');
  assert.equal(emptyRes.ok, false);
  assert.match(emptyRes.error || '', /không được để trống/i);

  const badRes = await testSlackConnection('xoxp-invalid-fake-token-test');
  assert.equal(badRes.ok, false);
  assert.ok(badRes.error);
});

test('getPersonalSlackAlerts filters alerts when memberId or userName is provided', async () => {
  const alerts = await getPersonalSlackAlerts({
    memberId: 'U0BJU7SLNC8',
    userName: 'TuanNT',
  });

  assert.ok(Array.isArray(alerts));
  assert.ok(alerts.length > 0);

  // Every returned alert should either have a Google Meet link, be a channel broadcast, or match the user
  for (const item of alerts) {
    const isBroadcast = item.cleanText.includes('@channel') || item.cleanText.includes('@here');
    const isMeet = Boolean(item.meetUrl);
    const matchesUser =
      item.cleanText.toLowerCase().includes('u0bju7slnc8') ||
      item.cleanText.toLowerCase().includes('tuannt') ||
      item.senderId === 'U0BJU7SLNC8' ||
      item.senderName?.toLowerCase().includes('tuannt');

    assert.ok(
      isBroadcast || isMeet || matchesUser,
      `Alert ${item.id} should match filter criteria`
    );
  }
});
