import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_TABS, createAdminRouter, readAdminRoute, adminRouteUrl, resumeAdminRoute, RETURN_ROUTE_KEY } from '../admin/routing.js';
const id = '00000000-0000-4000-8000-000000000001';
test('menu and detail paths canonicalize', () => {
  for (const tab of ADMIN_TABS) assert.equal(adminRouteUrl(readAdminRoute(`/admin/${tab}`)), `/admin/${tab}`);
  for (const tab of ['faqs','announcements','push','members','support']) assert.equal(adminRouteUrl(readAdminRoute(`/admin/${tab}/${id}`)), `/admin/${tab}/${id}`);
  assert.equal(adminRouteUrl(readAdminRoute(`/admin?tab=push&id=${id}`)), '/admin/dashboard');
  assert.equal(adminRouteUrl(readAdminRoute(`/admin/legal/privacy?version=${id}`)), `/admin/legal/privacy?version=${id}`);
  assert.equal(readAdminRoute('/admin/products/credits_10').id,'credits_10');
  assert.equal(readAdminRoute('/admin/push/new').id,'new');
});
test('route values cannot encode external redirects, tokens or unexpected detail paths', () => {
  for (const path of ['/admin/push/invalid','/admin/push/%2F%2Fevil.test','/admin/push/%ZZ','/admin/push/a/b','/admin/dashboard/'+id]) assert.equal(readAdminRoute(path).id,null);
  assert.deepEqual(readAdminRoute('/admin/nope?callbackurl=https://evil.test'), {tab:'dashboard',id:null,version:null});
  assert.equal(adminRouteUrl(readAdminRoute(`/admin/push/${id}?access_token=secret&callbackurl=https://evil.test`)), `/admin/push/${id}`);
});
test('OAuth restores only the validated route; callback secrets and stale return state are removed', () => {
  const values = new Map([[RETURN_ROUTE_KEY,`/admin/push/${id}`], ['mental:support:target',id]]);
  const storage = {getItem:k=>values.get(k),removeItem:k=>values.delete(k)};
  assert.equal(adminRouteUrl(resumeAdminRoute({href:'https://cande.fyi/admin?code=fixture'},storage)),`/admin/push/${id}`);
  assert.equal(values.size,0);
  values.set(RETURN_ROUTE_KEY,'/admin/members');
  assert.equal(adminRouteUrl(resumeAdminRoute({href:'https://cande.fyi/admin/push'},storage)), '/admin/push');
  assert.equal(values.size,0);
});
test('route remains usable if browser storage is unavailable', () => {
  assert.equal(adminRouteUrl(resumeAdminRoute({href:'https://cande.fyi/admin/support'}, {getItem(){throw Error();},removeItem(){throw Error();}})), '/admin/support');
});

test('history entries for in-page anchors do not discard or reopen the same detail', () => {
  let listener, calls=0;
  const win={location:{href:`https://cande.fyi/admin/push/${id}#page-title`}, history:{state:{adminRouteIndex:4}},addEventListener:(event,fn)=>{listener=fn;},removeEventListener:()=>{}};
  const router=createAdminRouter({window:win,onNavigate:()=>{calls++;},canNavigate:()=>{throw Error('Same view should stay intact');}});
  listener({state:{adminRouteIndex:4}});
  assert.equal(calls,0);assert.equal(router.current.id,id);router.dispose();
});
