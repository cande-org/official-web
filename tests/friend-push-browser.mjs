// Real DOM regression with synthetic data; no server, auth or customer sends.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const bundle=await build({stdin:{contents:`import {createFriendPush} from './admin/friend-push.js';window.mount=()=>createFriendPush(()=>window.fakeClient,document.getElementById('root'));`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife'});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_EXECUTABLE_PATH});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://friend-push-fixture.invalid/**',route=>route.fulfill({contentType:'text/html',body:'<html lang="ko"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="root" style="padding:24px;max-width:1180px;margin:auto"></main></body></html>'}));
 await page.goto('https://friend-push-fixture.invalid/admin/push');
 await page.addStyleTag({content:fs.readFileSync('admin/admin.css','utf8')});await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(async()=>{
  window.calls=[];window.confirm=()=>true;window.failQueue=true;
  window.config={id:1,revision:1,enabled:false,audience:'active_paid',min_credits:1,interval_hours:24,inactive_hours:1,strategy:'recent',start_hour:9,end_hour:21,batch_limit:20,daily_limit:1,prompt:'가상의 선톡 지침'};
  const user='a7a2bc52-c0db-44d3-8a7a-4a57a3e6aaac';
  const job={id:'b7a2bc52-c0db-44d3-8a7a-4a57a3e6aaac',user_id:user,friend_id:'fixture-friend',room_id:'fixture-room',message_id:'fixture-message',friend_snapshot:{nickname:'가상친구'},status:'saved',message_text:'가상의 안부 메시지',selection:{strategy:'recent',userMessages:12,availableCredits:20},created_at:'2026-11-10T01:00:00Z',deliveries:[{status:'sent',opened_at:'2026-11-10T01:03:00Z'}],prompt_revision:'studio-1+friend-push-v1'};
  window.fakeClient={auth:{getSession:async()=>({data:{session:{}}})},functions:{invoke:async(_name,{body})=>{
   window.calls.push(body);
   if(body.action==='state')return{data:{settings:window.config,publishedPromptRevision:1,configured:true}};
   if(body.action==='save'){window.config={...window.config,...body.settings,revision:body.revision+1};return{data:{settings:window.config}};}
   if(body.action==='list')return{data:{total:1,items:[job]}};
   if(body.action==='detail')return{data:{job:{...job,prompt_snapshot:{system:'가상의 성향 프롬프트',initiative:'가상의 선톡 지침'}},run:{source:'batch',settings:window.config},deliveries:[{status:'sent',mb_push_devices:{platform:'ios'},sent_at:'2026-11-10T01:01:00Z',opened_at:'2026-11-10T01:03:00Z'}]}};
   if(body.action==='preview')return{data:{recipients:1,devices:1,batchLimit:20,samples:[{user_id:user,friend_name:'가상친구',room_id:'fixture-room',selection:job.selection}]}};
   if(body.action==='queue'){if(window.failQueue){window.failQueue=false;return{error:new Error('synthetic network failure')};}return{data:{queued:1}};}
  }}};
  window.view=window.mount();await window.view.load();document.querySelector('.friend-push-panel').open=true;
 });
 assert(!(await page.locator('#friend-push-enabled').isChecked()));
 await page.locator('#friend-push-min_credits').fill('12');
 await page.getByRole('button',{name:'대상 미리보기',exact:true}).click();await page.getByText('변경한 선톡 설정을 먼저 저장해 주세요.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'설정 저장',exact:true}).click();await page.getByText('선톡 설정을 저장했습니다.',{exact:true}).waitFor();
 await page.getByRole('button',{name:'대상 미리보기',exact:true}).click();await page.getByText(/대상 1명 · 지원 앱 기기 1대/).waitFor();
 await page.getByRole('button',{name:'이번 배치 보내기',exact:true}).click();await page.getByText(/친구 선톡 요청을 완료하지 못했습니다/).waitFor();
 await page.getByRole('button',{name:'이번 배치 보내기',exact:true}).click();await page.getByText(/1명의 선톡 작업을 등록했습니다/).waitFor();
 const queues=(await page.evaluate(()=>window.calls)).filter(x=>x.action==='queue');assert.equal(queues.length,2);assert.equal(queues[0].requestId,queues[1].requestId);assert.equal(queues[0].revision,2);
 const out=process.env.QA_SCREENSHOT_DIR;if(out){fs.mkdirSync(out,{recursive:true});await page.screenshot({path:out+'/friend-push-desktop.png',fullPage:true});}
 await page.getByRole('button',{name:'상세',exact:true}).click();await page.getByRole('dialog').getByText('가상의 안부 메시지',{exact:true}).waitFor();
 await page.getByText('적용한 프롬프트',{exact:true}).click();await page.getByText(/가상의 성향 프롬프트/).waitFor();if(out)await page.screenshot({path:out+'/friend-push-detail.png'});
 await page.getByRole('button',{name:'닫기',exact:true}).click();await page.setViewportSize({width:390,height:844});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(out)await page.screenshot({path:out+'/friend-push-mobile.png',fullPage:true});
 assert.deepEqual(errors,[]);console.log('PASS friend push browser: save-before-preview, revision, exact request retry, recipient preview, persisted message/prompt/delivery detail, desktop/mobile layout');
}finally{await browser.close();}
