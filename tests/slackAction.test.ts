import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  convertSlackAlertToTaskDraft,
  getSlackHandledMap,
  setSlackItemStatus,
  toggleSlackItemDone,
} from '../src/services/slackActionService';
import type { SlackAlertItem } from '../src/components/WeeklyNotificationDropdown';

// Mock localStorage for node environment
const storageMock: Record<string, string> = {};
if (typeof globalThis.localStorage === 'undefined') {
  (globalThis as any).localStorage = {
    getItem: (key: string) => storageMock[key] || null,
    setItem: (key: string, val: string) => { storageMock[key] = val; },
    removeItem: (key: string) => { delete storageMock[key]; },
    clear: () => {
      for (const k of Object.keys(storageMock)) {
        delete storageMock[k];
      }
    },
  };
}

test('convertSlackAlertToTaskDraft correctly creates PersonalTask draft with slack metadata', () => {
  const alert: SlackAlertItem = {
    id: 'D0BKS3WNKS7:1793248377.446469',
    channelId: 'D0BKS3WNKS7',
    channelName: 'DM: Trang_lt',
    senderId: 'U0BJLDFLK2Q',
    senderName: 'Trang_lt',
    title: '💬 [DM: Trang_lt] Yêu cầu mới từ Trang_lt',
    summary: 'em gửi KH confirm trong ngày',
    cleanText: '<@U0BJ70JNERZ> em gửi KH confirm trong ngày https://meet.google.com/test',
    ts: '1793248377.446469',
    timeStr: '11:32 29/10',
    urgency: 'Cao',
    category: 'Yêu cầu',
    slackUrl: 'https://slack.com/archives/D0BKS3WNKS7/p1793248377446469',
    meetUrl: 'https://meet.google.com/test',
  };

  const draft = convertSlackAlertToTaskDraft(alert, 'Lợi');

  assert.equal(draft.source, 'slack');
  assert.equal(draft.slackUrl, alert.slackUrl);
  assert.equal(draft.slackSender, 'Trang_lt');
  assert.equal(draft.priorityName, 'High'); // Since urgency is Cao
  assert.equal(draft.category, 'Họp trực tuyến'); // Since meetUrl is present
  assert.equal(draft.assigneeName, 'Lợi');
  assert.match(draft.title, /\[Slack @Trang_lt\]/);
  assert.ok(draft.description.includes('https://slack.com/archives/D0BKS3WNKS7'));
});

test('slackActionService manages handled status with user isolation', () => {
  const userIdA = 101;
  const userIdB = 202;
  const alertId = 'alert_test_123';

  // Initially empty for user A
  let mapA = getSlackHandledMap(userIdA);
  assert.equal(mapA[alertId], undefined);

  // Mark done for user A
  mapA = setSlackItemStatus(alertId, 'done', userIdA);
  assert.equal(mapA[alertId], 'done');

  // User B should still have no status for this alert (isolation)
  const mapB = getSlackHandledMap(userIdB);
  assert.equal(mapB[alertId], undefined);

  // Toggle for user A: done -> pending
  mapA = toggleSlackItemDone(alertId, userIdA);
  assert.equal(mapA[alertId], undefined);

  // Toggle again: pending -> done
  mapA = toggleSlackItemDone(alertId, userIdA);
  assert.equal(mapA[alertId], 'done');
});
