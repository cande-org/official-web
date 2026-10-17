// Exercise real admin modules and browser history, with synthetic data and zero production writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {ADMIN_TABS} from '../admin/routing.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const seed=JSON.parse(fs.readFileSync('../mental/server/supabase/content/initial.json','utf8'));
const legalSeed=JSON.parse(fs.readFileSync('../mental/server/supabase/seed/legal-documents-v1.json','utf8')).documents;
const source=await build({entryPoints:['admin/admin.js'],bundle:true,write:false,format:'esm',plugins:[{name:'fixture-client',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'client',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const createClient=()=>{if(new URL(location.href).searchParams.has('code'))history.replaceState({},'', '/admin');return window.fakeClient;};`,loader:'js'}));}}]});
const origin='http://127.0.0.1:54321', id='00000000-0000-4000-8000-000000000001', old='00000000-0000-4000-8000-000000000002';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];
try{
 async function boot(path,{loggedOut=false}={}){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route(origin+'/**',r=>{const u=new URL(r.request().url());const file=u.pathname;
   if(file==='/admin/config.json')return r.fulfill({contentType:'application/json',body:JSON.stringify({url:'https://fixture.invalid',key:'fixture'})});
   if(file==='/admin/admin.js')return r.fulfill({contentType:'text/javascript',body:source.outputFiles[0].text});
   if(file==='/admin/admin.css')return r.fulfill({contentType:'text/css',body:fs.readFileSync('admin/admin.css','utf8')});
   if(file.startsWith('/assets/admin-friend-'))return r.fulfill({contentType:'image/svg+xml',body:fs.readFileSync('.'+file,'utf8')});
   if(file==='/assets/app-icon.png')return r.fulfill({contentType:'image/png',body:fs.readFileSync('assets/app-icon.png')});
   return r.fulfill({contentType:'text/html',body:fs.readFileSync('admin/index.html','utf8')});
  });
  await page.route('https://tzuxtejuscgyvgfmlijt.supabase.co/**',r=>r.request().url().includes('/missing')?r.fulfill({status:404,body:'missing'}):r.fulfill({contentType:'image/png',body:fs.readFileSync('assets/app-icon.png')}));
  await page.addInitScript(({seed,legalSeed,id,old,loggedOut})=>{
   window.session=loggedOut&&!sessionStorage.getItem('fixture:signed-in')?null:{};window.calls=[];
   const push={id,title:'[QA] Push',body:'Synthetic body',target_screen:'friends',status:'complete',created_at:'2026-10-01',audience:{},sent_count:2};
   const notice={id,title:'[QA] Notice',body:'Synthetic notice',created_at:'2026-10-01'};
   const member={id,nickname:'Synthetic member',providers:['google'],push_devices:1,ios_devices:1,android_devices:0,tracking_devices:1};
   const support={id,category:'아이디어',subject:'[QA] Support',content:'Synthetic support body',preview:'Synthetic support body',created_at:'2026-10-01',status:'open'};
   window.photoRevision=0;window.records=Object.fromEntries(['payments','ads','friends'].map(kind=>[kind,Array.from({length:25},(_,i)=>({id:kind+'-'+String(i+1).padStart(3,'0'),user_id:id,sort_at:new Date(Date.UTC(2026,9,17,0,0,25-i)).toISOString(),created_at:'2026-10-17T00:00:00Z',updated_at:'2026-10-17T00:00:00Z',product_id:'jb_messages_10',event_type:'NON_RENEWING_PURCHASE',store:'APP_STORE',price:i===0?null:900,currency:'KRW',status:i===1?'refunded':'completed',verified_production:i===2,purchased_at:'2026-10-17T00:00:00Z',transaction_id:'synthetic-store-transaction',reward_day:'2026-10-17',credits:i===0?null:3,nickname:i===0?'Synthetic <img src=x onerror="window.injected=true">':'Synthetic friend '+(i+1),persona:i%3===0?'stable':i%3===1?'anxious':'avoidant',is_deleted:i===2,is_default:i<3,has_custom_photo:i<3,photo_url:i===0?'https://tzuxtejuscgyvgfmlijt.supabase.co/storage/v1/object/sign/mental-media/photo.png?token=fixture':i===1?'https://evil.invalid/photo.jpg':i===2?'https://tzuxtejuscgyvgfmlijt.supabase.co/storage/v1/object/sign/mental-media/missing.png?token=fixture':null,credit_entries:[]}))]));
   window.fakeClient={auth:{getSession:async()=>({data:{session:window.session}}),onAuthStateChange:f=>window.signoutListener=f,signOut:async()=>{window.session=null;window.signoutListener('SIGNED_OUT');},signInWithOAuth:async options=>{window.oauthOptions=options;sessionStorage.setItem('fixture:signed-in','1');location.assign('/admin?code=fixture');return{};}},functions:{invoke:async(name,options)=>{
    window.calls.push({name,body:options?.body});const body=options?.body;
    if(name==='admin-content')return{data:{draft:seed,revision:1,published_revision:1,contracts:seed.products.map(p=>({key:p.key,id:'synthetic-sku',credits:10})),metadata:[]}};
    if(name==='admin-announcements'){
     if(body?.action==='detail'){if(window.deferDetail)return new Promise(resolve=>window.resolveDetail=resolve);return{data:{item:{...(body.kind==='push'?push:notice),id:old,title:'[QA] Older record'}}};}
     return{data:{announcements:[notice],campaigns:[push],pushReady:true}};
    }
    if(name==='admin-members')return{data:{members:[member],total:1}};
    if(name==='admin-support')return{data:{requests:[support],total:1}};
    if(name==='admin-legal')return{data:{documents:legalSeed.map(d=>({...d,revision:1,currentVersionId:d.id,versions:[{...d,publishedAt:'2026-10-05'}]}))}};
    if(name==='admin-operations'){
     if(window.operationFail)return{error:{context:{status:403}}};
     if(body.action==='detail'){
      if(window.deferOperation)return new Promise(resolve=>window.resolveOperation=resolve);
      const row=window.records[body.kind].find(x=>x.id===body.id&&(body.kind!=='friends'||x.user_id===body.userId));
      if(!row)return{error:{context:{status:404}}};
      const item={...row};if(body.kind==='friends'&&item.photo_url?.includes('/photo.png'))item.photo_url+='&revision='+window.photoRevision++;
      return{data:{items:[item]}};
     }
     let list=window.records[body.kind].filter(x=>(!body.userId||x.user_id===body.userId)&&(body.kind!=='payments'||body.status==='all'||x.status===body.status)&&(body.kind!=='friends'||(body.persona==='all'||x.persona===body.persona)&&(body.state==='all'||x.is_deleted===(body.state==='deleted'))));
     let start=body.cursor?list.findIndex(x=>x.id===body.cursor.id)+1:0;const items=list.slice(start,start+body.size);return{data:{items,nextCursor:start+body.size<list.length?{at:items.at(-1).sort_at,id:items.at(-1).id,userId:id}:null}};
    }
    if(name==='admin-access')return{data:{admins:[],history:[]}};
    return{error:new Error('unused fixture')};
   }}};
  },{seed,legalSeed,id,old,loggedOut});
  await page.goto(origin+path);await page.locator(loggedOut?'#login':'#editor').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#status').textContent!=='콘텐츠를 불러오는 중…');return page;
 }

 const page=await boot('/admin/payments');const network=[];page.on('request',r=>network.push(r.url()));
 await page.locator('#payments-list .row-title').first().waitFor();assert.equal(await page.locator('#payments-list tbody tr').count(),20);assert((await page.locator('#payments-list').innerText()).includes('금액 미기록'));
 await page.locator('#payments-next').click();await page.waitForFunction(()=>document.querySelector('#payments-page').textContent==='2페이지');assert.equal(await page.locator('#payments-list tbody tr').count(),5);await page.locator('#payments-prev').click();await page.waitForFunction(()=>document.querySelector('#payments-page').textContent==='1페이지');
 await page.locator('#payments-list .row-title').first().click();await page.locator('#operation-fields dd').first().waitFor();assert(new URL(page.url()).pathname.includes('/admin/payments/payments-001'));assert((await page.locator('#operation-fields').innerText()).includes('금액 미기록'));await page.reload();await page.locator('#operation-fields dd').first().waitFor();await page.locator('#operation-close').click();await page.waitForURL(origin+'/admin/payments');
 await page.locator('#payments-state').selectOption('refunded');await page.locator('#payments-filters button[type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('#payments-list tbody tr').length===1);assert((await page.locator('#payments-list').innerText()).includes('환불'));
 const out=process.env.QA_SCREENSHOT_DIR;if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:out+'/payments.png'});}
 await page.locator('[data-tab="ads"]').click();await page.locator('#ads-list .row-title').first().waitFor();assert((await page.locator('#ads-list').innerText()).includes('원장 미기록'));await page.locator('#ads-list .row-title').nth(1).click();await page.locator('#operation-fields dd').first().waitFor();assert((await page.locator('#operation-fields').innerText()).includes('3회'));assert(new URL(page.url()).pathname.includes('/admin/ads/ads-002'));await page.locator('#operation-close').click();if(out)await page.screenshot({path:out+'/ads.png'});
 await page.locator('[data-tab="friends"]').click();await page.locator('#friends-list .row-title').first().waitFor();await page.waitForFunction(()=>document.querySelector('#friends-list img')?.naturalWidth>0);assert.equal(await page.locator('#friends-list .row-title img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);assert(!network.some(u=>u.includes('evil.invalid')));
 await page.locator('#friends-state').selectOption('all');await page.locator('#friends-filters button[type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('#friends-list tbody tr').length===20);await page.waitForFunction(()=>[...document.querySelectorAll('#friends-list .operation-photo .helper')].some(e=>e.textContent.includes('불러오지')));
 if(out)await page.screenshot({path:out+'/friends.png'});
 await page.locator('#friends-list .operation-photo-button').first().click();await page.locator('#operation-fields dd').first().waitFor();assert.equal(new URL(page.url()).pathname,'/admin/friends/'+id+'/friends-001');await page.waitForFunction(()=>document.querySelector('#operation-photo img')?.naturalWidth>0);const previous=await page.locator('#operation-photo img').getAttribute('src');await page.locator('#operation-refresh-photo').click();await page.waitForFunction(old=>document.querySelector('#operation-photo img')?.src!==old,previous);assert.equal(await page.locator('#operation-photo img').count(),1);
 for(const width of [430,390,360]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert(await page.locator('#operation-dialog').evaluate(d=>d.getBoundingClientRect().left>=0&&d.getBoundingClientRect().right<=innerWidth));if(out&&width===390)await page.screenshot({path:out+'/friend-mobile.png'});}
 await page.setViewportSize({width:1440,height:1000});await page.reload();await page.locator('#operation-fields dd').first().waitFor();await page.locator('#operation-close').click();await page.locator('#friends-user').fill('bad');await page.locator('#friends-filters button[type=submit]').click();await page.locator('#friends-status').getByText('회원 UID는 전체 UUID를 입력해 주세요.').waitFor();await page.locator('#friends-user').fill('');await page.evaluate(()=>window.operationFail=true);await page.locator('#friends-refresh').click();await page.locator('#friends-status').getByText('조회 권한이 없습니다.').waitFor();assert.equal(await page.locator('#friends-list table').count(),0);await page.close();
 const login=await boot('/admin/friends/'+id+'/friends-001',{loggedOut:true});await login.locator('#signin').click();await login.locator('#operation-fields dd').first().waitFor();assert.equal(new URL(login.url()).pathname,'/admin/friends/'+id+'/friends-001');await login.close();
 const race=await boot('/admin/friends');await race.locator('#friends-list .row-title').first().waitFor();await race.evaluate(()=>window.deferOperation=true);await race.locator('#friends-list .row-title').first().click();await race.waitForFunction(()=>!!window.resolveOperation);await race.goBack();await race.waitForFunction(()=>!document.querySelector('#operation-dialog').open);await race.evaluate(()=>window.resolveOperation({data:{items:[window.records.friends[0]]}}));assert.equal(await race.locator('#operation-photo img').count(),0);await race.locator('#logout').click();assert.equal(await race.locator('#friends-list table').count(),0);assert.equal(await race.locator('#operation-fields dd').count(),0);await race.close();
 assert.deepEqual(errors,[]);console.log('PASS operations: three menus/tables/details, payment missing/refund display, ad ledger coverage, safe/private photos and preset fallback, refresh, keyset filters, deep links/OAuth, mobile, permission and stale/logout handling');
}finally{await browser.close();}
