// Real admin rendering with isolated, delayed metrics; no production account/data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const source=await build({entryPoints:['admin/admin.js'],bundle:true,write:false,format:'esm',plugins:[{name:'fixture-client',setup(build){build.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'client',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const createClient=()=>window.fakeClient;',loader:'js'}));}}]});
const seed=JSON.parse(fs.readFileSync('../mental/server/supabase/content/initial.json','utf8'));
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'}), errors=[];page.on('pageerror',e=>errors.push(e.message));
 const html=fs.readFileSync('admin/index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
 await page.route('http://127.0.0.1:54321/**',r=>r.request().url().endsWith('/assets/app-icon.png')?r.fulfill({contentType:'image/png',body:fs.readFileSync('assets/app-icon.png')}):r.fulfill({contentType:'text/html',body:html}));await page.goto('http://127.0.0.1:54321/');await page.addStyleTag({content:fs.readFileSync('admin/admin.css','utf8')});
 await page.evaluate(seed=>{
  window.fetch=async()=>new Response(JSON.stringify({url:'https://fixture.invalid',key:'fixture'}),{headers:{'Content-Type':'application/json'}});
  window.calls=[];window.releases={};window.pauses={};window.session={};window.signoutListener=()=>{};
  window.fakeClient={auth:{getSession:async()=>({data:{session:window.session}}),onAuthStateChange:f=>window.signoutListener=f,signOut:async()=>{window.session=null;window.signoutListener('SIGNED_OUT');}},functions:{invoke:async(name)=>{
   if(name==='admin-content')return {data:{draft:seed,revision:1,published_revision:1,published_at:'2026-10-01T00:00:00Z',contracts:[],metadata:[]}};
   if(!name.startsWith('admin-metrics?'))return {error:new Error('unused fixture')};
   const q=new URLSearchParams(name.split('?')[1]),audience=q.get('audience');window.calls.push(Object.fromEntries(q));
   if(window.pauses[audience]){window.pauses[audience]=false;await new Promise(resolve=>window.releases[audience]=resolve);}
   if(window.failNext){window.failNext=false;return {error:{context:{status:403}}};}
   const n=audience==='member'?12:audience==='guest'?8:17, empty=q.get('start')==='2000-01-01', count=empty?0:n;
   const cohort={date:q.get('start'),members:count,eligible7d:count,pending7d:0,chatConverted7d:count/2,purchaseConverted7d:0,medianFirstChatSeconds:null,d1:{eligible:count,retained:count/2},d7:{eligible:count,retained:count/4},d30:{eligible:0,retained:0}};
   const bucket={date:q.get('start'),members:audience==='guest'?0:count,guests:audience==='member'?0:count,rooms:count,roomUsers:count,chatUsers:count,memberChatUsers:audience==='guest'?0:count,guestChatUsers:audience==='member'?0:count,turns:count*3,succeeded:count*3,failed:0};
   const growth={activeUsers:count,returningUsers:count/2,dau:count,wau:count,mau:count,purchases:0,buyers:0,adViews:0,adViewers:0,succeeded:count*3,failed:0,guestEligible7d:count,guestConverted7d:count/2,buckets:[{date:q.get('start'),activeUsers:count,returningUsers:count/2,purchases:0,buyers:0,adViews:0,adViewers:0}]};
   return {data:{schemaVersion:3,audience,cohortBasis:audience==='guest'?'guest_started':'member_joined',totalMembers:100,weekMembers:5,currentMembers:99,rangeChatUsers:count,rangeRoomUsers:count,buckets:[bucket],growth,cohorts:{summary:cohort,buckets:empty?[]:[cohort]},coverage:{lastCompleteDay:'2026-09-30',growthStartedAt:'2026-09-27T00:00:00Z'},lastProcessedAt:'2026-10-01T00:00:00Z',trackingStartedAt:'2026-09-27T00:00:00Z',pendingEvents:0,pendingNotifications:0,failedNotifications:0}};
  }}};
 },seed);
 await page.addScriptTag({type:'module',content:source.outputFiles[0].text});await page.locator('#metric-status').getByText(/^전체 이용자/).waitFor();
 assert.equal((await page.evaluate(()=>window.calls))[0].audience,'all');
 await page.locator('#metric-audience').selectOption('member');await page.locator('#metric-status').getByText(/^로그인 이용자/).waitFor();
 assert.equal(await page.locator('#metric-cards .metric-card').nth(3).locator('strong').innerText(),'12명');
 assert.equal(await page.locator('#growth-overview .metric-card').first().locator('strong').innerText(),'12명');
 assert(!(await page.locator('#growth-conversion').innerText()).includes('게스트 시작 → 회원가입'));
 assert((await page.locator('#metric-cards').innerText()).includes('누적 가입 · 전체'));
 if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/login-desktop.png'});}
 await page.locator('#metric-audience').selectOption('guest');await page.locator('#metric-status').getByText(/^비로그인 이용자/).waitFor();
 assert.equal(await page.locator('#metric-cards .metric-card').nth(3).locator('strong').innerText(),'8명');
 assert((await page.locator('#growth-retention').innerText()).includes('게스트 시작 코호트 리텐션'));
 assert((await page.locator('#growth-conversion').innerText()).includes('게스트 시작 → 첫 채팅'));
 assert((await page.locator('#metric-chart').innerText()).includes('게스트 시작'));
 for(const width of [768,430,390]){await page.setViewportSize({width,height:1000});await page.waitForTimeout(300);if(await page.evaluate(()=>document.body.classList.contains('menu-open')))await page.locator('#menu-close').click();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('#metric-audience').isVisible());assert(await page.locator('.metric-filters').evaluate(el=>[...el.querySelectorAll('input,select,button')].every(x=>{const b=x.getBoundingClientRect();return b.left>=0 && b.right<=innerWidth && b.width>=(x.tagName==='BUTTON'?30:70);})));}
 if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/guest-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});
 // Later filter wins even when an older response is still pending.
 await page.evaluate(()=>window.pauses.member=true);await page.locator('#metric-audience').selectOption('member');await page.waitForFunction(()=>!!window.releases.member);
 await page.locator('#metric-audience').selectOption('all');await page.locator('#metric-status').getByText(/^전체 이용자/).waitFor();
 await page.evaluate(()=>window.releases.member());await page.waitForTimeout(50);
 assert.equal(await page.locator('#growth-overview .metric-card').first().locator('strong').innerText(),'17명');assert(!(await page.locator('#metric-refresh').isDisabled()));
 await page.locator('#metric-start').fill('2000-01-01');await page.locator('#metric-end').fill('2000-01-01');await page.locator('#metric-refresh').click();await page.getByText('선택 기간에 신규 가입이 없습니다.',{exact:true}).waitFor();
 assert.equal(await page.locator('#growth-overview .metric-card').first().locator('strong').innerText(),'0명');
 await page.locator('#metric-start').fill('2001-01-01');await page.locator('#metric-refresh').click();assert((await page.locator('#metric-status').innerText()).includes('최대 366일'));assert.equal(await page.locator('#metric-cards').innerText(),'');
 await page.locator('#metric-start').fill('2000-01-01');await page.evaluate(()=>window.failNext=true);await page.locator('#metric-refresh').click();await page.getByText('지표 조회 권한이 없습니다.',{exact:true}).waitFor();assert.equal(await page.locator('#metric-cards').innerText(),'');
 await page.evaluate(()=>window.pauses.all=true);await page.locator('#metric-refresh').click();await page.waitForFunction(()=>!!window.releases.all);await page.locator('#logout').click();await page.evaluate(()=>window.releases.all());await page.waitForTimeout(50);assert(await page.locator('#editor').isHidden());assert.equal(await page.locator('#metric-cards').innerText(),'');
 assert.deepEqual(errors,[]);console.log('PASS metrics browser: all/member/guest, chart/cohort labels, global context, delayed filter/logout, empty/error/range, 1440/768/390px');
} finally {await browser.close();}
