// Combined live/retained collections in the real admin shell. Synthetic clients only.
import fs from 'node:fs';import assert from 'node:assert/strict';import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const seed=JSON.parse(fs.readFileSync('../mental/server/supabase/content/initial.json','utf8'));
const source=await build({entryPoints:['admin/admin.js'],bundle:true,write:false,format:'esm',plugins:[{name:'fixture',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'client',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const createClient=()=>window.fakeClient;',loader:'js'}));}}]});
const origin='http://127.0.0.1:54321',archive='00000000-0000-4000-8000-000000000001',live='00000000-0000-4000-8000-000000000002';
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try{
 async function boot(path,{loggedOut=false}={}){
  const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route(origin+'/**',r=>{const p=new URL(r.request().url()).pathname;if(p==='/admin/config.json')return r.fulfill({contentType:'application/json',body:JSON.stringify({url:'https://fixture.invalid',key:'fixture'})});if(p==='/admin/admin.js')return r.fulfill({contentType:'text/javascript',body:source.outputFiles[0].text});if(p==='/admin/admin.css')return r.fulfill({contentType:'text/css',body:fs.readFileSync('admin/admin.css','utf8')});if(p.startsWith('/assets/'))return r.fulfill({contentType:p.endsWith('.svg')?'image/svg+xml':'image/png',body:fs.readFileSync('.'+p)});return r.fulfill({contentType:'text/html',body:fs.readFileSync('admin/index.html','utf8')});});
  await page.addInitScript(({seed,archive,live,loggedOut})=>{
   window.session=loggedOut&&!sessionStorage.getItem('fixture:login')?null:{};window.calls=[];
   const at='2026-10-19T01:00:00Z';
   const owner=(deleted)=>({user_id:deleted?null:live,archive_id:deleted?archive:null,account_status:deleted?'deleted':'active',deleted_at:deleted?at:null,is_guest:false});
   const member=deleted=>({id:deleted?archive:live,nickname:deleted?'가상 탈퇴 회원':'가상 이용 회원',email:deleted?null:'synthetic@example.com',created_at:at,last_active_at:at,is_admin:false,providers:deleted?[]:['google'],push_devices:deleted?0:1,ios_devices:deleted?0:1,android_devices:0,tracking_devices:1,...owner(deleted),retained_summary:deleted?{counts:{mb_rooms:1,mb_messages:71,mb_turns:25,mb_ad_rewards:1},turn_statuses:{succeeded:24,failed:1},payments:1,wallet:{free_credits:7,paid_credits:5,plan_limit:200,plan_used:10}}:null});
   const ops=(kind,deleted)=>({...owner(deleted),id:kind==='friends'?'friend':'shared',sort_at:at,created_at:at,updated_at:at,product_id:'jb_messages_10',event_type:'NON_RENEWING_PURCHASE',price:1000,currency:'KRW',status:'completed',store:'APP_STORE',verified_production:false,transaction_id:'synthetic-txn',credit_entries:[{delta:3,recorded_at:at,bucket:'FREE'}],credits:3,reward_day:'2026-10-19',nickname:'가상 친구',persona:'stable',is_default:false,is_deleted:false,has_custom_photo:false});
   const messages=Array.from({length:71},(_,i)=>({id:'m-'+String(i+1).padStart(3,'0'),room_id:'room',sender_kind:i%2?'ai':'user',sender_name:'가상 친구',content:i===35?'Synthetic <img src=x onerror="window.injected=true">':'가상 메시지 '+(i+1),sent_at:new Date(Date.UTC(2026,9,19,1,0,Math.floor(i/3))).toISOString()}));
   window.fakeClient={auth:{getSession:async()=>({data:{session:window.session}}),onAuthStateChange:fn=>window.signout=fn,signOut:async()=>{window.session=null;window.signout('SIGNED_OUT');},signInWithOAuth:async()=>{sessionStorage.setItem('fixture:login','1');location.assign('/admin?code=fixture');return{};}},functions:{invoke:async(name,o)=>{
    if(name==='admin-content')return{data:{draft:seed,revision:1,published_revision:1,contracts:[],metadata:[]}};
    const b=o.body;window.calls.push({name,...b});if(window.fail)return{error:{context:new Response('{}',{status:403})}};
    const choose=()=>[false,true].filter(d=>b.accountState==='all'||!b.accountState||b.accountState===(d?'deleted':'active'));
    if(name==='admin-members'){
     if(b.action==='history'){
      const result={data:{items:Array.from({length:b.page===2?5:20},(_,i)=>b.kind==='credits'?{id:i,bucket:'FREE',source:i?'TURN_DEBIT':'TURN_REFUND',delta:i?-1:1,balance_after:7,recorded_at:at}:{id:i,room_id:'room',status:i?'succeeded':'failed',credit_source:'free',created_at:at,error:i?null:'turn_expired'}),total:25,page:b.page,size:20}};
      if(window.deferHistory)return new Promise(resolve=>window.resolveHistory=()=>resolve(result));return result;
     }
     const rows=b.action==='detail'?[member(b.accountState==='deleted')]:choose().map(member).filter(m=>!b.query||(m.nickname+' '+m.id).includes(b.query));return{data:{members:rows,total:rows.length,page:1,size:b.size}};
    }
    if(name==='admin-chat-history'){
     if(b.action==='room'){
      if(b.accountState!=='deleted')return{error:{context:new Response('{}',{status:404})}};
      let rows=messages;if(b.direction==='before')rows=rows.filter(m=>m.sent_at<b.cursor.sentAt||m.sent_at===b.cursor.sentAt&&m.id<b.cursor.id).slice(-50);else if(b.direction==='after')rows=rows.filter(m=>m.sent_at>b.cursor.sentAt||m.sent_at===b.cursor.sentAt&&m.id>b.cursor.id).slice(0,50);else if(b.messageId){const n=rows.findIndex(m=>m.id===b.messageId);rows=rows.slice(Math.max(0,n-24),n+26);}else rows=rows.slice(-50);
      return{data:{room:{...owner(true),id:'room',title:'가상 보관 대화'},messages:rows,hasBefore:messages.indexOf(rows[0])>0,hasAfter:messages.indexOf(rows.at(-1))<70}};
     }
     const rows=choose().filter(d=>!b.userId||b.userId===(d?archive:live)).map(d=>({...owner(d),id:'m-036',room_id:'room',room_title:'가상 대화',sent_at:at,sender_kind:'user',preview:d?'탈퇴 회원의 가상 메시지':'이용 회원의 가상 메시지'}));return{data:{messages:rows,total:rows.length,page:1}};
    }
    if(name==='admin-operations'){
     if(b.action==='detail'){if(b.accountState==='deleted'&&b.archiveId!==archive)return{error:{context:new Response('{}',{status:404})}};return{data:{items:[ops(b.kind,b.accountState==='deleted')]}};}
     const rows=choose().filter(d=>!b.userId||b.userId===(d?archive:live)).map(d=>ops(b.kind,d));return{data:{items:rows,total:rows.length,page:1}};
    }
    return{error:new Error('unused fixture')};
   }}};
  },{seed,archive,live,loggedOut});
  await page.goto(origin+path);await page.locator(loggedOut?'#login':'#editor').waitFor({state:'visible'});return{page,errors};
 }
 const {page,errors}=await boot('/admin/members');
 await page.locator('#member-list tbody tr').nth(1).waitFor();assert.equal(await page.locator('[data-tab=retained]').count(),0);assert((await page.locator('#member-list').innerText()).includes('탈퇴 회원'));
 await page.locator('#member-account-state').selectOption('deleted');await page.locator('#member-search-form button[type=submit]').click();await page.waitForFunction(()=>document.querySelectorAll('#member-list tbody tr').length===1);
 await page.locator('#member-list .row-title').click();await page.locator('#member-history-list tbody tr').first().waitFor();assert.equal(new URL(page.url()).searchParams.get('account'),'deleted');assert.equal(await page.locator('#member-detail-key-label').innerText(),'보관용 키');assert.equal(await page.locator('#member-detail-push').isVisible(),false);assert((await page.locator('#member-retained-summary').innerText()).includes('실패 1'));assert((await page.locator('#member-history-list').innerText()).includes('turn_expired'));
 await page.locator('#member-history-next').click();await page.waitForFunction(()=>document.querySelector('#member-history-page').dataset.page==='2');assert.equal(await page.locator('#member-history-list tbody tr').count(),5);
 await page.locator('#member-history-kind').selectOption('credits');await page.waitForFunction(()=>document.querySelector('#member-history-list').textContent.includes('대화 실패 환급'));assert.equal(await page.locator('#member-history-list tbody tr').count(),20);
 const out=process.env.QA_SCREENSHOT_DIR;if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:out+'/retained-member-desktop.png'});}
 await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(out)await page.screenshot({path:out+'/retained-member-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.locator('#member-retained-links a').first().click();await page.locator('#chat-list .row-title').waitFor();assert.equal(await page.locator('#chat-account-state').inputValue(),'deleted');assert.equal(await page.locator('#chat-user').inputValue(),archive);
 await page.locator('#chat-list .row-title').click();await page.locator('#chat-messages article').first().waitFor();assert((await page.locator('#chat-room-meta').innerText()).includes('탈퇴 회원 · 보관용 키'));assert.equal(await page.locator('#chat-messages img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);assert.equal(new URL(page.url()).searchParams.get('account'),'deleted');
 await page.locator('#chat-older').click();await page.waitForFunction(()=>document.querySelectorAll('#chat-messages article').length>50);await page.locator('#chat-newer').click();await page.waitForFunction(()=>document.querySelectorAll('#chat-messages article').length===71);
 for(const width of [430,390,360]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}if(out)await page.screenshot({path:out+'/retained-chat-mobile.png'});
 await page.setViewportSize({width:1440,height:1000});await page.locator('#chat-close').click();await page.locator('#chat-reset').click();await page.waitForFunction(()=>document.querySelectorAll('#chat-list tbody tr').length===2);
 for(const kind of ['payments','ads','friends']){
  await page.locator(`[data-tab=${kind}]`).click();await page.locator(`#${kind}-list tbody tr`).nth(1).waitFor();assert((await page.locator(`#${kind}-list`).innerText()).includes('탈퇴 회원'));
  await page.locator(`#${kind}-list .row-actions button`).nth(1).click();await page.locator('#operation-fields').getByText('탈퇴 회원',{exact:true}).waitFor();assert((await page.locator('#operation-fields').innerText()).includes('보관용 키'));assert.equal(new URL(page.url()).searchParams.get('account'),'deleted');
  await page.reload();await page.locator('#operation-fields').getByText('탈퇴 회원',{exact:true}).waitFor();assert.equal((await page.evaluate(()=>window.calls.filter(c=>c.action==='detail'&&c.name==='admin-operations').at(-1))).archiveId,archive);await page.locator('#operation-close').click();
 }
 await page.goto(origin+`/admin/members/${archive}?account=deleted`);await page.locator('#member-history-list tbody tr').first().waitFor();await page.evaluate(()=>window.deferHistory=true);await page.locator('#member-history-kind').selectOption('credits');await page.waitForFunction(()=>!!window.resolveHistory);await page.locator('#member-detail-close').click();await page.locator('#logout').click();await page.evaluate(()=>window.resolveHistory());assert.equal(await page.locator('#member-history-list table').count(),0);assert.equal(await page.locator('#member-detail-uid').inputValue(),'');assert.deepEqual(errors,[]);await page.close();
 const auth=await boot(`/admin/payments/shared?account=deleted&archive=${archive}`,{loggedOut:true});await auth.page.locator('#signin').click();await auth.page.locator('#operation-fields').getByText('탈퇴 회원',{exact:true}).waitFor();assert.equal(new URL(auth.page.url()).searchParams.get('archive'),archive);assert.deepEqual(auth.errors,[]);await auth.page.close();
 console.log('PASS combined retained history: existing five menus, mixed/state/owner filters, archive key/status, member usage/credit paging, safe room context/history, detail source/reload/OAuth, 360/390/430 widths, stale/logout cleanup');
}finally{await browser.close();}
