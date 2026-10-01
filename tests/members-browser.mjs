// Real admin shell with isolated clients; no production auth/data/messages.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const source=await build({entryPoints:['admin/admin.js'],bundle:true,write:false,format:'esm',plugins:[{name:'fixture-client',setup(build){build.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'client',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const createClient=()=>window.fakeClient;',loader:'js'}));}}]});
const seed=JSON.parse(fs.readFileSync(process.env.MEMBER_SEED_PATH||'../mental/server/supabase/content/initial.json','utf8'));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync('admin/index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
 await page.route('http://127.0.0.1:54321/**',r=>r.fulfill({contentType:'text/html',body:html}));await page.goto('http://127.0.0.1:54321/');await page.addStyleTag({content:fs.readFileSync('admin/admin.css','utf8')});
 await page.evaluate(seed=>{
  window.fetch=async()=>new Response(JSON.stringify({url:'https://fixture.invalid',key:'fixture'}),{headers:{'Content-Type':'application/json'}});
  window.memberRows=Array.from({length:21},(_,i)=>({id:`00000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,nickname:`가상 회원 ${i+1}`,email:`member-${i+1}@example.com`,is_admin:false,created_at:'2026-10-01T00:00:00Z',last_active_at:'2026-10-01T01:00:00Z',last_sign_in_at:'2026-10-01T00:00:00Z',providers:['google'],push_devices:i===1?0:1,ios_devices:i===1?0:1,android_devices:0,tracking_devices:1}));
  window.memberCalls=[];window.session={};window.signoutListener=()=>{};
  window.fakeClient={auth:{getSession:async()=>({data:{session:window.session}}),onAuthStateChange:f=>window.signoutListener=f,signOut:async()=>{window.session=null;window.signoutListener('SIGNED_OUT');}},functions:{invoke:async(name,options)=>{
   const body=options?.body;
   if(name==='admin-content')return {data:{draft:seed,revision:1,published_revision:1,published_at:'2026-10-01T00:00:00Z',contracts:[],metadata:[]}};
   if(name==='admin-announcements')return {data:body?{recipients:1}:{announcements:[],campaigns:[],pushReady:true}};
   if(name!=='admin-members')return {error:new Error('fixture: metrics not loaded')};
   window.memberCalls.push(body);
   if(window.pauseMembers){await new Promise(resolve=>window.releaseMembers=resolve);window.pauseMembers=false;}
   let rows=window.memberRows;
   if(body.action==='detail')rows=rows.filter(m=>m.id===body.id);
   else if(body.query)rows=rows.filter(m=>`${m.nickname} ${m.email} ${m.id}`.toLowerCase().includes(body.query.toLowerCase()));
   const total=rows.length,start=((body.page||1)-1)*(body.size||20);return {data:{members:rows.slice(start,start+(body.size||20)),total}};
  }}};
 },seed);
 await page.addScriptTag({type:'module',content:source.outputFiles[0].text});await page.locator('#editor').waitFor({state:'visible'});
 await page.locator('[data-tab="members"]').click();await page.locator('#member-count').getByText('1–20 / 21명',{exact:true}).waitFor();assert.equal(await page.locator('#member-list tbody tr').count(),20);assert(await page.locator('#form').isHidden());
 await page.locator('#member-next').click();await page.locator('#member-count').getByText('21–21 / 21명',{exact:true}).waitFor();
 await page.locator('#member-search').fill('member-1@example.com');await page.locator('#member-search-form button[type="submit"]').click();await page.locator('#member-count').getByText('1–1 / 1명',{exact:true}).waitFor();
 await page.locator('#member-list').getByRole('button',{name:'복사',exact:true}).click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'00000000-0000-4000-8000-000000000001');
 if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/members-table.png'});}
 await page.locator('#member-list tbody tr').click();await page.locator('#member-detail-fields').getByText('가상 회원 1',{exact:true}).waitFor();assert.equal(await page.locator('#member-detail-uid').inputValue(),'00000000-0000-4000-8000-000000000001');
 if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/member-detail.png'});
 await page.locator('#member-detail-copy').click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'00000000-0000-4000-8000-000000000001');
 await page.locator('#member-detail-push').click();await page.locator('#push-dialog').waitFor({state:'visible'});assert.equal(await page.locator('#push-user-ids').inputValue(),'00000000-0000-4000-8000-000000000001');assert(!(await page.locator('#push-send').isDisabled()));assert(await page.locator('#members').isHidden());
 await page.locator('#push-cancel').click();await page.locator('[data-tab="members"]').click();await page.locator('#member-count').getByText('1–1 / 1명',{exact:true}).waitFor();
 await page.locator('#member-search').fill('member-2@example.com');await page.locator('#member-search-form button[type="submit"]').click();await page.locator('#member-list').getByRole('button',{name:'가상 회원 2',exact:true}).click();await page.locator('#member-detail-fields').getByText('가상 회원 2',{exact:true}).waitFor();assert(await page.locator('#member-detail-push').isDisabled());
 await page.setViewportSize({width:390,height:844});assert(await page.locator('#member-detail-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/member-detail-mobile.png'});
 await page.locator('#member-detail-done').click();await page.setViewportSize({width:1440,height:1000});
 await page.locator('#member-search').fill('no-match');await page.locator('#member-search-form button[type="submit"]').click();await page.getByText('검색 조건에 맞는 회원이 없습니다.',{exact:true}).waitFor();
 await page.evaluate(()=>{window.pauseMembers=true;});await page.locator('#member-refresh').click();await page.waitForFunction(()=>typeof window.releaseMembers==='function');
 await page.locator('#logout').click();await page.evaluate(()=>window.releaseMembers());await page.waitForFunction(()=>!document.getElementById('member-list').children.length);
 assert(await page.locator('#editor').isHidden());assert.equal(await page.locator('#member-detail-uid').inputValue(),'');assert(!(await page.locator('#member-detail-dialog').isVisible()));assert.deepEqual(errors,[]);
 console.log('PASS full admin browser: member nav/table/page/search/copy/detail, push ready prefill, no-device block, 390px, empty state, logout stale response protection');
}finally{await browser.close();}
