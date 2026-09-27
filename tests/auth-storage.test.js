import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_AUTH_KEY as key, prepareAuthStorage } from '../admin/auth-storage.js';
const memory=()=>{const map=new Map();return{getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
test('existing session and in-flight PKCE survive the storage migration',()=>{
 const persistent=memory(),legacy=memory();legacy.setItem(key,'existing-session');legacy.setItem(`${key}-code-verifier`,'existing-verifier');
 assert.equal(prepareAuthStorage(persistent,legacy),persistent);
 assert.equal(persistent.getItem(key),'existing-session');assert.equal(persistent.getItem(`${key}-code-verifier`),'existing-verifier');assert.equal(legacy.getItem(key),null);
});
test('newer persistent session wins over an old tab and logout cannot resurrect it',()=>{
 const persistent=memory(),legacy=memory();persistent.setItem(key,'new-session');legacy.setItem(key,'old-session');prepareAuthStorage(persistent,legacy);
 assert.equal(persistent.getItem(key),'new-session');persistent.removeItem(key);legacy.setItem(key,'stale-tab-session');prepareAuthStorage(persistent,legacy);
 assert.equal(persistent.getItem(key),null);assert.equal(legacy.getItem(key),null);
});
