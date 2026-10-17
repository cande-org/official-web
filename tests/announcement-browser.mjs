import {pagedFixtureClient} from './pagination-fixture-client.mjs';
// Exercise real admin modules and browser history, with synthetic data and zero production writes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {ADMIN_TABS} from '../admin/routing.js';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const seed=JSON.parse(fs.readFileSync('../mental/server/supabase/content/initial.json','utf8'));
const legalSeed=JSON.parse(fs.readFileSync('../mental/server/supabase/seed/legal-documents-v1.json','utf8')).documents;
const source=await build({entryPoints:['admin/admin.js'],bundle:true,write:false,format:'esm',plugins:[{name:'fixture-client',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'client',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export const createClient=()=>{if(new URL(location.href).searchParams.has('code'))history.replaceState({},'', '/admin');return (${pagedFixtureClient.toString()})(window.fakeClient);};`,loader:'js'}));}}]});
const origin='http://127.0.0.1:54321', id='00000000-0000-4000-8000-000000000001', old='00000000-0000-4000-8000-000000000002';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];const shots=process.env.NOTICE_SHOTS; if(shots)fs.mkdirSync(shots,{recursive:true});
try{
 async function boot(path,{loggedOut=false}={}){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);page.setDefaultNavigationTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
  await page.route(origin+'/**',r=>{const u=new URL(r.request().url());const file=u.pathname;
   if(file==='/admin/config.json')return r.fulfill({contentType:'application/json',body:JSON.stringify({url:'https://fixture.invalid',key:'fixture'})});
   if(file==='/admin/admin.js')return r.fulfill({contentType:'text/javascript',body:source.outputFiles[0].text});
   if(file==='/admin/admin.css')return r.fulfill({contentType:'text/css',body:fs.readFileSync('admin/admin.css','utf8')});
   if(file.endsWith('.otf'))return r.fulfill({contentType:'font/otf',body:fs.readFileSync('.'+file)});
   if(file==='/assets/app-icon.png')return r.fulfill({contentType:'image/png',body:fs.readFileSync('assets/app-icon.png')});
   return r.fulfill({contentType:'text/html',body:fs.readFileSync('admin/index.html','utf8')});
  });
  await page.addInitScript(({seed,legalSeed,id,old,loggedOut})=>{
   window.session=loggedOut&&!sessionStorage.getItem('fixture:signed-in')?null:{};window.calls=[];
   const push={id,title:'[QA] Push',body:'Synthetic body',target_screen:'friends',status:'complete',created_at:'2026-10-01',audience:{},sent_count:2};
   const notice=window.notice??(window.notice={id,title:'정병발사에 오신 것을 환영해요!',body:'화나고 억울한 날, 친구 단톡방에 보내기 전에\n여기서 먼저 한바탕 털어놓아 주세요.\n\n내 취향대로 만든 나만의 AI 친구\n1. 내 이름과 프로필 사진을 설정해요.\n2. AI 친구의 이름·사진·성향을 고르고 채팅방을 만들어요.',created_at:'2026-10-12'});
   const member={id,nickname:'Synthetic member',providers:['google'],push_devices:1,ios_devices:1,android_devices:0,tracking_devices:1};
   const support={id,category:'아이디어',subject:'[QA] Support',content:'Synthetic support body',preview:'Synthetic support body',created_at:'2026-10-01',status:'open'};
   window.fakeClient={auth:{getSession:async()=>({data:{session:window.session}}),onAuthStateChange:f=>window.signoutListener=f,signOut:async()=>{window.session=null;window.signoutListener('SIGNED_OUT');},signInWithOAuth:async options=>{window.oauthOptions=options;sessionStorage.setItem('fixture:signed-in','1');location.assign('/admin?code=fixture');return{};}},functions:{invoke:async(name,options)=>{
    window.calls.push({name,body:options?.body});const body=options?.body;
    if(name==='admin-content')return{data:{draft:seed,revision:1,published_revision:1,contracts:seed.products.map(p=>({key:p.key,id:'synthetic-sku',credits:10})),metadata:[]}};
    if(name==='admin-announcements'){if(body?.action==='save'){Object.assign(notice,{title:body.title,body:body.body,body_runs:body.bodyRuns});return {data:{}};}
     if(body?.action==='detail'){if(window.deferDetail)return new Promise(resolve=>window.resolveDetail=resolve);return{data:{item:{...(body.kind==='push'?push:notice),id:old,title:'[QA] Older record'}}};}
     return{data:{announcements:[notice],campaigns:[push],pushReady:true}};
    }
    if(name==='admin-members')return{data:{members:[member],total:1}};
    if(name==='admin-support')return{data:{requests:[support],total:1}};
    if(name==='admin-legal')return{data:{documents:legalSeed.map(d=>({...d,revision:1,currentVersionId:d.id,versions:[{...d,publishedAt:'2026-10-05'}]}))}};
    if(name==='admin-access')return{data:{admins:[],history:[]}};
    return{error:new Error('unused fixture')};
   }}};
  },{seed,legalSeed,id,old,loggedOut});
  await page.goto(origin+path);await page.locator(loggedOut?'#login':'#editor').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#status').textContent!=='콘텐츠를 불러오는 중…');return page;
 }
 const page=await boot('/admin/announcements');
 await page.locator('#announcement-list .row-title').click();
 const field=page.locator('#announcement-body'),font=page.locator('[data-announcement-font="munmak"]');
 assert.equal(await font.isEnabled(),false);
 const body=await field.inputValue(),selected='내 취향대로 만든 나만의 AI 친구';
 const start=body.indexOf(selected),end=start+selected.length;
 await field.evaluate((el,{start,end})=>{el.focus();el.setSelectionRange(start,end);el.dispatchEvent(new Event('select'));},{start,end});
 await font.click();await page.evaluate(()=>document.fonts.ready);
 assert.equal(await page.locator('#announcement-body-preview .notice-font-munmak').textContent(),selected);
 assert.equal(await page.locator('#announcement-body-preview').textContent(),body);
 if(shots)await page.screenshot({path:shots+'/admin-mixed-fonts.png'});
 await page.locator('#announcement-form [type="submit"]').click();await page.locator('#announcement-dialog').waitFor({state:'hidden'});
 const saved=await page.evaluate(()=>window.calls.findLast(c=>c.body?.action==='save').body);
 assert.equal(saved.bodyRuns.map(r=>r.text).join(''),saved.body);
 assert.equal(saved.bodyRuns.find(r=>r.font==='munmak').text,selected);
 await page.locator('#announcement-list .row-title').click();
 assert.equal(await page.locator('#announcement-body-preview .notice-font-munmak').textContent(),selected);
 await field.fill(body.replace('친구 단톡방','진짜 친구 단톡방'));
 assert.equal(await page.locator('#announcement-body-preview .notice-font-munmak').textContent(),selected);
 assert((await page.locator('#announcement-body-preview').textContent()).includes('진짜 친구 단톡방'));
 await field.evaluate(el=>{el.setSelectionRange(0,el.value.length);el.dispatchEvent(new Event('select'));});
 await page.locator('[data-announcement-font="pretendard"]').click();assert.equal(await page.locator('#announcement-body-preview .notice-font-munmak').count(),0);
 await field.fill('<img src=x onerror="window.hacked=1">');
 assert.equal(await page.locator('#announcement-body-preview img').count(),0);
 assert.equal(await page.locator('#announcement-body-preview').textContent(),'<img src=x onerror="window.hacked=1">');
 assert.deepEqual(errors,[]);console.log('PASS notice browser: selection, mixed fonts, save payload, reopen, edit preservation, plain fallback and literal HTML');
}finally{await browser.close();}
