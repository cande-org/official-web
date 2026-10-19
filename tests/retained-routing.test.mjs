import test from 'node:test';
import assert from 'node:assert/strict';
import {readAdminRoute,adminRouteUrl,ADMIN_TABS} from '../admin/routing.js';
const archive='00000000-0000-4000-8000-000000000001';
test('retained records stay in normal menus with explicit source and independent archive keys',()=>{
 assert(!ADMIN_TABS.includes('retained'));
 for(const path of [`/admin/members/${archive}?account=deleted`,`/admin/chats/${archive}/room?message=msg&account=deleted`,`/admin/friends/${archive}/friend?account=deleted`,`/admin/payments/shared?account=deleted&archive=${archive}`,`/admin/ads/shared?account=deleted&archive=${archive}`,`/admin/chats?account=deleted&owner=${archive}`])assert.equal(adminRouteUrl(readAdminRoute(path)),path);
 const route=readAdminRoute(`/admin/payments/shared?account=deleted&archive=${archive}&access_token=secret&callback=https://evil.invalid`);
 assert.equal(route.archive,archive);assert(!adminRouteUrl(route).includes('secret'));
 assert(!adminRouteUrl(readAdminRoute('/admin/payments/shared?account=deleted&archive=bad')).includes('archive='));
 assert(!adminRouteUrl(readAdminRoute('/admin/chats?owner=bad&account=bogus')).includes('?'));
});
