import test from 'node:test';
import assert from 'node:assert/strict';
import { exitReasonLabel } from '../admin/exit-feedback.js';
import { adminRouteUrl, readAdminRoute, resumeAdminRoute, RETURN_ROUTE_KEY } from '../admin/routing.js';
test('exit feedback menu survives refresh and OAuth without accepting a detail or external return', () => {
  const path = '/admin/exit-feedback';
  assert.equal(adminRouteUrl(readAdminRoute(path)), path);
  assert.equal(readAdminRoute(path + '/untrusted').id, null);
  assert.equal(adminRouteUrl(resumeAdminRoute({ href: 'https://cande.fyi/admin?code=fixture' }, {
    getItem: key => key === RETURN_ROUTE_KEY ? path : null, removeItem() {}
  })), path);
});
test('reason wording preserves the different account and membership cost labels', () => {
  assert.equal(exitReasonLabel('account', 'cost'), '이용 요금이 부담돼요');
  assert.equal(exitReasonLabel('membership', 'cost'), '가격이 부담돼요');
  assert.equal(exitReasonLabel('account', 'privacy'), '개인정보나 대화 기록이 걱정돼요');
  assert.equal(exitReasonLabel('membership', 'break'), '잠시 쉬어가고 싶어요');
  assert.equal(exitReasonLabel('account', '<script>'), '알 수 없는 사유');
});
