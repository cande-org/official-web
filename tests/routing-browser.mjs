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
   if(file==='/assets/app-icon.png')return r.fulfill({contentType:'image/png',body:fs.readFileSync('assets/app-icon.png')});
   return r.fulfill({contentType:'text/html',body:fs.readFileSync('admin/index.html','utf8')});
  });
  await page.addInitScript(({seed,legalSeed,id,old,loggedOut})=>{
   window.session=loggedOut&&!sessionStorage.getItem('fixture:signed-in')?null:{};window.calls=[];
   const push={id,title:'[QA] Push',body:'Synthetic body',target_screen:'friends',status:'complete',created_at:'2026-10-01',audience:{},sent_count:2};
   const notice={id,title:'[QA] Notice',body:'Synthetic notice',created_at:'2026-10-01'};
   const member={id,nickname:'Synthetic member',providers:['google'],push_devices:1,ios_devices:1,android_devices:0,tracking_devices:1};
   const support={id,category:'아이디어',subject:'[QA] Support',content:'Synthetic support body',preview:'Synthetic support body',created_at:'2026-10-01',status:'open'};
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
    if(name==='admin-access')return{data:{admins:[],history:[]}};
    return{error:new Error('unused fixture')};
   }}};
  },{seed,legalSeed,id,old,loggedOut});
  await page.goto(origin+path);await page.locator(loggedOut?'#login':'#editor').waitFor({state:'visible'});await page.waitForFunction(()=>document.querySelector('#status').textContent!=='콘텐츠를 불러오는 중…');return page;
 }
 const page=await boot('/admin/push');
 for(const tab of ADMIN_TABS){await page.locator(`[data-tab="${tab}"]`).click();await page.waitForURL(origin+'/admin/'+tab);assert.equal(await page.locator(`[data-tab="${tab}"]`).getAttribute('aria-pressed'),'true');}
 async function detail(tab,button,dialog){await page.locator(`[data-tab="${tab}"]`).click();await page.locator(button).first().click();await page.locator(dialog).waitFor({state:'visible'});}
 await detail('push','#push-history .row-title','#push-detail-dialog');await page.waitForURL(origin+'/admin/push/'+id);
 await page.goBack();await page.waitForURL(origin+'/admin/push');await page.locator('#push-detail-dialog').waitFor({state:'hidden'});
 await page.goForward();await page.locator('#push-detail-dialog').waitFor({state:'visible'});assert.equal(new URL(page.url()).pathname,'/admin/push/'+id);
 await page.reload();await page.locator('#push-detail-dialog').waitFor({state:'visible'});assert((await page.locator('#push-detail-fields').innerText()).includes('Synthetic body'));
 await page.locator('#push-detail-close').click();await page.waitForURL(origin+'/admin/push');
 await detail('announcements','#announcement-list .row-title','#announcement-dialog');await page.waitForURL(origin+'/admin/announcements/'+id);
 await page.reload();await page.locator('#announcement-dialog').waitFor({state:'visible'});await page.locator('#announcement-title').fill('Unsaved edit');let reject=true;const confirm=dialog=>reject?dialog.dismiss():dialog.accept();page.on('dialog',confirm);
 await page.goBack();await page.waitForFunction(()=>location.pathname.endsWith('/'+ '00000000-0000-4000-8000-000000000001'));assert.equal(await page.locator('#announcement-title').inputValue(),'Unsaved edit');assert(await page.locator('#announcement-dialog').isVisible());
 reject=false;await page.goBack();await page.waitForURL(origin+'/admin/announcements');await page.locator('#announcement-dialog').waitFor({state:'hidden'});page.off('dialog',confirm);
 await detail('products','#product-list .row-title','#item-dialog');await page.waitForURL(origin+'/admin/products/'+seed.products[0].key);await page.locator('#item-close').click();await page.waitForURL(origin+'/admin/products');
 await detail('faqs','#faq-list .row-title','#item-dialog');await page.waitForURL(origin+'/admin/faqs/'+seed.faqs[0].id);await page.locator('#item-close').click();await page.waitForURL(origin+'/admin/faqs');
 await detail('members','#member-list .row-title','#member-detail-dialog');await page.waitForURL(origin+'/admin/members/'+id);await page.locator('#member-detail-close').click();await page.waitForURL(origin+'/admin/members');
 await detail('support','#support-list .row-title','#support-detail-dialog');await page.waitForURL(origin+'/admin/support/'+id);await page.locator('#support-detail-close').click();await page.waitForURL(origin+'/admin/support');
 await detail('legal','#legal-list button','#legal-dialog');await page.waitForURL(origin+'/admin/legal/'+legalSeed[0].key+'?version='+legalSeed[0].id);await page.locator('#legal-close').click();await page.waitForURL(origin+'/admin/legal');
 await page.locator('[data-tab="push"]').click();await page.locator('#push-add').click();await page.waitForURL(origin+'/admin/push/new');await page.locator('#push-close').click();await page.waitForURL(origin+'/admin/push');
 await page.close();
 for(const tab of ['push','announcements']){const p=await boot('/admin/'+tab+'/'+old);await p.locator(tab==='push'?'#push-detail-dialog':'#announcement-dialog').waitFor({state:'visible'});assert(await p.evaluate(()=>window.calls.some(c=>c.body?.action==='detail')));await p.close();}
 const login=await boot('/admin/push/'+old,{loggedOut:true});assert.equal(await login.locator('#push-detail-dialog').isVisible(),false);await login.locator('#signin').click();await login.waitForURL(origin+'/admin/push/'+old);await login.locator('#push-detail-dialog').waitFor({state:'visible'});assert.equal(await login.evaluate(()=>sessionStorage.getItem('mental:admin:return-route:v1')),null);assert(!login.url().includes('code='));await login.close();
 const race=await boot('/admin/push');await race.evaluate(()=>{window.deferDetail=true;history.pushState({},'', '/admin/push/00000000-0000-4000-8000-000000000002');dispatchEvent(new PopStateEvent('popstate'));});await race.waitForFunction(()=>!!window.resolveDetail);await race.locator('[data-tab="members"]').click();await race.evaluate(()=>window.resolveDetail({data:{item:{id:'00000000-0000-4000-8000-000000000002',title:'stale'}}}));assert.equal(await race.locator('#push-detail-dialog').isVisible(),false);await race.locator('#logout').click();assert(await race.locator('#editor').isHidden());await race.close();
 assert.deepEqual(errors,[]);console.log('PASS admin path routing: 11 menus, 7 detail types, history, reload, unsaved guard, older records, OAuth callback after SDK removes code, stale detail and logout');
}finally{await browser.close();}
