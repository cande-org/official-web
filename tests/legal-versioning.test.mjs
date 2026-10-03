import test from 'node:test';
import assert from 'node:assert/strict';
import {nextLegalVersion, withLegalFooter} from '../admin/legal-versioning.js';

test('new drafts advance highest numeric version exactly, including drafts and rollover', () => {
  for (const [versions, expected] of [
    [[], '1.0'], [['1.0'], '1.1'], [['1.0', '1.1'], '1.2'],
    [['1.9', '1.8'], '2.0'], [['release', '1.10'], '1.2'],
    [['1.11', '1.09'], '1.21'], [['9.9'], '10.0'],
  ]) assert.equal(nextLegalVersion(versions.map(version => ({version}))), expected);
});

test('footer updates only trailing metadata and remains idempotent', () => {
  const original='본문의 시행일: 별도 안내\n다른 조항\n\n버전: 1.0\n시행일: 2026년 10월 5일';
  const expected='본문의 시행일: 별도 안내\n다른 조항\n\n버전: 1.2\n시행일: 2026년 11월 7일';
  assert.equal(withLegalFooter(original, '1.2', '2026-11-07'), expected);
  assert.equal(withLegalFooter(expected, '1.2', '2026-11-07'), expected);
  assert.equal(withLegalFooter('본문\r\n\r\n시행일: 이전 날짜\r\n버전: 이전 버전\r\n', '2.0', '2026-10-05'), '본문\n\n버전: 2.0\n시행일: 2026년 10월 5일');
  assert.equal(withLegalFooter('새 본문', 'custom-release', '2026-10-05'), '새 본문\n\n버전: custom-release\n시행일: 2026년 10월 5일');
  assert.equal(withLegalFooter('', '1.0', '2026-10-05'), '');
  assert.equal(withLegalFooter(original, '', '2026-10-05'), original);
  assert.equal(withLegalFooter(original, '1.2', '2026-02-30'), original);
});
