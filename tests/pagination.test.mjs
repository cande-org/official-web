import test from 'node:test';import assert from 'node:assert/strict';import {pageNumbers} from '../admin/pagination.js';
test('numbered pages keep edges and a five-page window without inventing pages',()=>{
 assert.deepEqual(pageNumbers(1,1),[1]);assert.deepEqual(pageNumbers(1,3),[1,2,3]);assert.deepEqual(pageNumbers(1,20),[1,2,3,4,5,'…',20]);assert.deepEqual(pageNumbers(10,20),[1,'…',8,9,10,11,12,'…',20]);assert.deepEqual(pageNumbers(20,20),[1,'…',16,17,18,19,20]);
});
