// Isolated real-browser regression: no auth or production notifications.
// PLAYWRIGHT_MODULE_PATH / CHROMIUM_EXECUTABLE_PATH may select local runtimes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const campaign={id:'a7a2bc52-c0db-44d3-8a7a-4a57a3e6aaac',title:'예약 안내',body:'본문도 표시합니다.',audience:{},icon_key:'bell',target_screen:'friends',status:'scheduled',scheduled_at:'2099-10-01T00:00:00Z',created_at:'2026-10-01T00:00:00Z',recipient_count:10,sent_count:4,failed_count:0,trackable_sent_count:2,opened_count:1};
const bundle=await build({stdin:{contents:`import {createAnnouncements} from './admin/announcements.js'; window.mount=()=>createAnnouncements(()=>window.fakeClient);`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife'});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.QA_SCREENSHOT_DIR)fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});
 const html=fs.readFileSync('admin/index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
 await page.route("http://127.0.0.1:54321/**", route=>route.fulfill({contentType:"text/html",body:html}));await page.goto("http://127.0.0.1:54321/");await page.addStyleTag({content:fs.readFileSync('admin/admin.css','utf8')});await page.addScriptTag({content:bundle.outputFiles[0].text});
 await page.evaluate(campaign=>{
  document.body.classList.add("signed-in");window.calls=[];window.campaign=campaign;window.failSend=true;window.confirm=()=>true;
  window.fakeClient={auth:{getSession:async()=>({data:{session:{}}})},functions:{invoke:async(_name,options)=>{
   const body=options.body;if(!body)return {data:{announcements:[],campaigns:[window.campaign],pushReady:true}};
   window.calls.push(body);if(body.action==='preview')return {data:{recipients:10}};
   if(body.action==='send'&&window.failSend){window.failSend=false;return {error:new Error('network')}};
   if(body.action==='cancel')window.campaign.status='canceled';
   return {data:{recipients:10,scheduledAt:body.scheduledAt}};
  }}};
  for(const id of ['sidebar','topbar','editor','push'])document.getElementById(id).hidden=false;
  document.getElementById('dashboard').hidden=true;document.getElementById('status').hidden=true;
  document.querySelector('[data-tab=dashboard]').setAttribute('aria-pressed','false');document.querySelector('[data-tab=push]').setAttribute('aria-pressed','true');document.getElementById('breadcrumb-current').textContent='푸시 알림';document.getElementById('reload').hidden=true;document.getElementById('page-title').textContent='푸시 알림';document.getElementById('page-description').textContent='발송 이력을 확인하고 새 알림을 보내세요.';
  window.api=window.mount();return window.api.load();
 },campaign);
 await page.getByRole('button',{name:'예약 안내',exact:true}).click();
 await page.locator('#push-detail-fields').getByText('50.0% · 1 / 2',{exact:true}).waitFor();
 assert(await page.locator('#push-cancel-reservation').isVisible());if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/push-detail.png'});
 await page.locator('#push-cancel-reservation').click();await page.locator('#push-status').getByText('예약을 취소했습니다.',{exact:true}).waitFor();
 if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/push-history.png'});await page.locator('#push-add').click();assert(!(await page.locator('#push-scheduled-field').isVisible()));
 await page.locator('#push-title').fill('새 알림');await page.locator('#push-body').fill('새 본문');await page.locator('[name="push-icon"][value="star"]').check();
 await page.locator('#push-timing').selectOption('scheduled');assert(await page.locator('#push-scheduled-field').isVisible());
 const time=new Date(Date.now()+86400000+9*3600000).toISOString().slice(0,16);await page.locator('#push-scheduled-at').fill(time);
 await page.locator('#push-send').click();await page.locator('#push-dialog-status').getByText('먼저 대상 수를 확인해 주세요.',{exact:true}).waitFor();
 await page.locator('#push-preview').click();await page.locator('#push-recipient-count').getByText('알림을 허용한 기기 10대',{exact:true}).waitFor();
 if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/push-schedule-desktop.png'});}
 await page.locator('#push-send').click();await page.locator('#push-dialog-status').getByText(/요청을 완료하지 못/).waitFor();
 await page.locator('#push-send').click();await page.locator('#push-status').getByText(/발송을 예약했습니다/).waitFor();
 const calls=await page.evaluate(()=>window.calls);const sends=calls.filter(c=>c.action==='send');assert.equal(sends.length,2);assert.equal(sends[0].requestId,sends[1].requestId);assert.equal(sends[0].iconKey,'star');assert.equal(sends[0].scheduledAt,new Date(time+'+09:00').toISOString());
 await page.locator('#push-add').click();assert(await page.locator('[name="push-icon"][value="default"]').isChecked());
 await page.setViewportSize({width:390,height:844});await page.locator('#push-timing').selectOption('scheduled');
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert(await page.locator('#push-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
 if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/push-schedule-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS real browser: DOM wiring, detail CTR, cancel, preview gate, KST schedule, retry UUID, icon reset, 390px overflow');
} finally {await browser.close();}
