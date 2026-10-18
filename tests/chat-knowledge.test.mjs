import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readAdminRoute,adminRouteUrl} from '../admin/routing.js';
import {splitKnowledgeLines} from '../admin/chat-knowledge.js';
test('knowledge URLs survive detail/new routing without accepting foreign redirects',()=>{
 for(const id of ['new','00000000-0000-4000-8000-000000000361'])assert.equal(readAdminRoute(adminRouteUrl({tab:'knowledge',id})).id,id);
 assert.equal(readAdminRoute('/admin/knowledge/not-a-uuid').id,null);
 assert.deepEqual(splitKnowledgeLines('  별칭\n\n별칭\n다른 이름  '),['별칭','다른 이름']);
});
