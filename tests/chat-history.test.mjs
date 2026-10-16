import test from 'node:test';import assert from 'node:assert/strict';
import {chatPeriod} from '../admin/chat-history.js';import {readAdminRoute,adminRouteUrl,resumeAdminRoute,RETURN_ROUTE_KEY} from '../admin/routing.js';
const user='00000000-0000-4000-8000-000000000001';
test('chat periods use inclusive KST days with an exclusive end, bounded to 93 days',()=>{
 assert.deepEqual(chatPeriod('2026-10-01','2026-10-07'),{from:'2026-09-30T15:00:00.000Z',until:'2026-10-07T15:00:00.000Z'});
 for(const [a,b] of [['2026-02-30','2026-03-01'],['2026-10-08','2026-10-07'],['2026-01-01','2026-12-31']])assert.throws(()=>chatPeriod(a,b));
});
test('chat paths retain owner, room and clicked message across OAuth without carrying text or tokens',()=>{
 const path=`/admin/chats/${user}/room-one?message=m-42`,route=readAdminRoute(path);
 assert.equal(route.user,user);assert.equal(route.id,'room-one');assert.equal(route.message,'m-42');assert.equal(adminRouteUrl(route),path);
 assert.equal(adminRouteUrl(readAdminRoute(path+'&token=secret&body=private')),path);
 const storage={getItem:k=>k===RETURN_ROUTE_KEY?path:null,removeItem:()=>{}};
 assert.equal(adminRouteUrl(resumeAdminRoute({href:'https://cande.fyi/admin?code=fixture'},storage)),path);
 assert.equal(readAdminRoute('/admin/chats/not-a-user/room-one').id,null);
 assert.equal(readAdminRoute(`/admin/chats/${user}/room-one/extra`).id,null);
 const special='room with / and #';assert.equal(readAdminRoute(adminRouteUrl({tab:'chats',user,id:special,message:'message/one'})).id,special);
});
