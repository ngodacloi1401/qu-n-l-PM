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
  assert.ok(emptyRes.error);

  const badRes = await testSlackConnection('xoxp-invalid-fake-token-test');
  assert.equal(badRes.ok, false);
  assert.ok(badRes.error);
});

test('testSlackConnection successfully validates and tests memberId without token', async () => {
  // Test with valid Member ID format (like user U0BJ70JNERZ)
  const validMemberRes = await testSlackConnection({ memberId: 'U0BJ70JNERZ' });
  assert.equal(validMemberRes.ok, true);
  assert.equal(validMemberRes.userId, 'U0BJ70JNERZ');
  assert.ok(validMemberRes.message && validMemberRes.message.includes('U0BJ70JNERZ'));

  // Test with invalid format
  const invalidRes = await testSlackConnection({ memberId: 'invalid-id' });
  assert.equal(invalidRes.ok, false);
  assert.match(invalidRes.error || '', /Member ID không hợp lệ/i);
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
