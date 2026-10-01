import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scheduledTime, clickMetrics } from '../admin/push-controls.js';
const now = Date.parse('2026-10-01T00:00:00Z');
test('KST reservations are explicit, independent of machine timezone', () => {
  assert.equal(scheduledTime('scheduled', '2026-10-01T10:30', now), '2026-10-01T01:30:00.000Z');
  assert.equal(scheduledTime('now', '', now), null);
});
test('reject invalid, past and over 90 day reservations', () => {
  for (const value of ['', '2026-02-30T10:00', '2026-10-01T09:00', '2027-02-01T10:00']) assert.throws(() => scheduledTime('scheduled', value, now));
});
test('CTR uses only successful deliveries to supporting clients', () => {
  assert.deepEqual(clickMetrics({sent_count:10,trackable_sent_count:4,opened_count:1}), {sent:10,tracked:4,opened:1,rate:'25.0%',summary:'25.0% · 1 / 4'});
  assert.equal(clickMetrics({sent_count:10}).summary,'집계 대상 없음');
  assert.equal(clickMetrics({trackable_sent_count:4}).rate,'0.0%');
});
