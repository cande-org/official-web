// Isolated real-browser regression: no auth or production notifications.
// PLAYWRIGHT_MODULE_PATH / CHROMIUM_EXECUTABLE_PATH may select local runtimes.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const image='https://tzuxtejuscgyvgfmlijt.supabase.co/storage/v1/object/public/mental-push-images/a7a2bc52-c0db-44d3-8a7a-4a57a3e6aaac.jpg';
const campaign={image_url:image,id:'a7a2bc52-c0db-44d3-8a7a-4a57a3e6aaac',title:'예약 안내',body:'본문도 표시합니다.',audience:{},icon_key:'bell',target_screen:'friends',status:'scheduled',scheduled_at:'2099-10-01T00:00:00Z',created_at:'2026-10-01T00:00:00Z',recipient_count:10,sent_count:4,failed_count:0,trackable_sent_count:2,opened_count:1};
const bundle=await build({stdin:{contents:`import {createAnnouncements} from './admin/announcements.js'; window.mount=()=>createAnnouncements(()=>window.fakeClient);`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife'});
const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.CHROMIUM_EXECUTABLE_PATH}:{})});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(process.env.QA_SCREENSHOT_DIR)fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});
 const html=fs.readFileSync('admin/index.html','utf8').replace(/<script[\s\S]*?<\/script>/g,'').replace(/<link[^>]+>/g,'');
 await page.route("http://127.0.0.1:54321/**", route=>route.fulfill({contentType:"text/html",body:html}));await page.goto("http://127.0.0.1:54321/");await page.addStyleTag({content:fs.readFileSync('admin/admin.css','utf8')});await page.addScriptTag({content:bundle.outputFiles[0].text});
 const picture=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d');x.fillStyle='#f0b738';x.fillRect(0,0,320,240);x.fillStyle='#35807c';x.fillRect(160,0,160,240);return c.toDataURL('image/jpeg').split(',')[1];});
 await page.route('https://tzuxtejuscgyvgfmlijt.supabase.co/storage/**',route=>route.fulfill({contentType:'image/jpeg',body:Buffer.from(picture,'base64')}));
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
 assert(await page.locator('#push-cancel-reservation').isVisible());assert.equal(await page.locator('.push-detail-image').getAttribute('src'),image);if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/push-detail.png'});
 await page.locator('#push-cancel-reservation').click();await page.locator('#push-status').getByText('예약을 취소했습니다.',{exact:true}).waitFor();
 if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/push-history.png'});await page.locator('#push-add').click();assert(!(await page.locator('#push-scheduled-field').isVisible()));
 await page.locator('#push-title').fill('새 알림');await page.locator('#push-body').fill('새 본문');assert.equal(await page.locator('[name="push-icon"]').count(),0);
 // Real PNG decode + canvas JPEG compression, replacement/removal, and upload retry.
 const png=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d');x.fillStyle='#f0b738';x.fillRect(0,0,320,240);x.fillStyle='#35807c';x.fillRect(160,0,160,240);return c.toDataURL('image/png').split(',')[1];}),'base64');
 await page.locator('#push-photo').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:png});
 await page.locator('#push-photo-dialog').waitFor({state:'visible'});await page.locator('#push-photo-apply').click();await page.locator('#push-photo-preview').waitFor({state:'visible'});
 assert((await page.locator('#push-photo-image').getAttribute('src')).startsWith('data:image/jpeg;'));
 const square=await page.locator('#push-photo-image').evaluate(img=>({w:img.naturalWidth,h:img.naturalHeight}));assert.deepEqual(square,{w:240,h:240});
 const originalUrl=await page.locator('#push-photo-image').getAttribute('src');
 await page.locator('#push-photo-edit').click();await page.locator('#push-photo-x').fill('100');await page.locator('#push-photo-x').dispatchEvent('input');
 await page.locator('#push-photo-zoom').fill('2');await page.locator('#push-photo-zoom').dispatchEvent('input');
 await page.locator('#push-photo-apply').click();
 await page.waitForFunction(()=>document.getElementById('push-photo-image').naturalWidth===120);
 const pixel=await page.locator('#push-photo-image').evaluate(img=>{const c=document.createElement('canvas');c.width=c.height=120;const x=c.getContext('2d');x.drawImage(img,0,0);return [...x.getImageData(5,5,1,1).data];});assert(Math.abs(pixel[0]-53)<8&&Math.abs(pixel[1]-128)<8&&Math.abs(pixel[2]-124)<8);
 const croppedUrl=await page.locator('#push-photo-image').getAttribute('src');assert.notEqual(croppedUrl,originalUrl);
 await page.locator('#push-photo-edit').click();await page.locator('#push-photo-reset').click();await page.locator('#push-photo-cancel').click();assert.equal(await page.locator('#push-photo-image').getAttribute('src'),croppedUrl);
 await page.locator('#push-photo').setInputFiles({name:'replacement.png',mimeType:'image/png',buffer:png});await page.locator('#push-photo-dialog').waitFor({state:'visible'});await page.keyboard.press('Escape');assert.equal(await page.locator('#push-photo-image').getAttribute('src'),croppedUrl);
 assert.equal((await page.evaluate(()=>window.calls)).filter(c=>c.action==='upload').length,0);
 // Portrait selection reaches the bottom edge; square transparent WEBP becomes white JPEG.
 const portrait=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=100;c.height=300;const ctx=c.getContext('2d');ctx.fillStyle='#f0b738';ctx.fillRect(0,0,100,200);ctx.fillStyle='#35807c';ctx.fillRect(0,200,100,100);return c.toDataURL('image/jpeg').split(',')[1];}),'base64');
 await page.locator('#push-photo').setInputFiles({name:'portrait.jpg',mimeType:'image/jpeg',buffer:portrait});await page.locator('#push-photo-dialog').waitFor({state:'visible'});
 await page.locator('#push-photo-y').fill('100');await page.locator('#push-photo-y').dispatchEvent('input');await page.locator('#push-photo-apply').click();
 await page.waitForFunction(()=>document.getElementById('push-photo-image').naturalWidth===100);
 const bottom=await page.locator('#push-photo-image').evaluate(img=>{const c=document.createElement('canvas');c.width=c.height=100;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return [...ctx.getImageData(50,50,1,1).data];});assert(Math.abs(bottom[0]-53)<8&&Math.abs(bottom[1]-128)<8&&Math.abs(bottom[2]-124)<8);
 const transparent=Buffer.from(await page.evaluate(()=>{const c=document.createElement('canvas');c.width=c.height=200;return c.toDataURL('image/webp').split(',')[1];}),'base64');
 await page.locator('#push-photo').setInputFiles({name:'square.webp',mimeType:'image/webp',buffer:transparent});await page.locator('#push-photo-dialog').waitFor({state:'visible'});await page.locator('#push-photo-apply').click();
 await page.waitForFunction(()=>document.getElementById('push-photo-image').naturalWidth===200);
 const white=await page.locator('#push-photo-image').evaluate(img=>{const c=document.createElement('canvas');c.width=c.height=200;const ctx=c.getContext('2d');ctx.drawImage(img,0,0);return [...ctx.getImageData(100,100,1,1).data];});assert.deepEqual(white,[255,255,255,255]);


 if(process.env.QA_PHOTO_FIXTURE_PATH)fs.writeFileSync(process.env.QA_PHOTO_FIXTURE_PATH,Buffer.from((await page.locator('#push-photo-image').getAttribute('src')).split(',')[1],'base64'));
 if(process.env.QA_SCREENSHOT_DIR){await page.locator('#push-dialog').evaluate(d=>d.scrollTop=0);await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/push-photo-desktop.png'});}
 await page.locator('#push-photo-remove').click();assert(!(await page.locator('#push-photo-preview').isVisible()));
 await page.locator('#push-photo').setInputFiles({name:'bad.jpg',mimeType:'image/jpeg',buffer:Buffer.from('not image')});
 await page.locator('#push-dialog-status').getByText(/사진을 읽지 못/).waitFor();
 await page.locator('#push-photo').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:png});
 await page.locator('#push-photo-dialog').waitFor({state:'visible'});await page.locator('#push-photo-apply').click();await page.locator('#push-photo-preview').waitFor({state:'visible'});
 const ids=['a7a2bc52-c0db-44d3-8a7a-4a57a3e6aaac','b7a2bc52-c0db-44d3-8a7a-4a57a3e6aaac'];
 await page.locator('#push-user-ids').fill(',;');await page.locator('#push-preview').click();await page.locator('#push-dialog-status').getByText('회원 UID를 입력하거나 입력란을 비워 주세요.',{exact:true}).waitFor();assert.equal((await page.evaluate(()=>window.calls)).filter(c=>c.action==='preview').length,0);
 await page.locator('#push-user-ids').fill(ids[1]+','+ids[0]+'\n'+ids[0].toUpperCase());
 await page.locator('#push-timing').selectOption('scheduled');assert(await page.locator('#push-scheduled-field').isVisible());
 const time=new Date(Date.now()+86400000+9*3600000).toISOString().slice(0,16);await page.locator('#push-scheduled-at').fill(time);
 await page.locator('#push-send').click();await page.locator('#push-dialog-status').getByText('먼저 대상 수를 확인해 주세요.',{exact:true}).waitFor();
 await page.locator('#push-preview').click();await page.locator('#push-recipient-count').getByText('알림을 허용한 기기 10대',{exact:true}).waitFor();
 if(process.env.QA_SCREENSHOT_DIR){fs.mkdirSync(process.env.QA_SCREENSHOT_DIR,{recursive:true});await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/push-schedule-desktop.png'});}
 await page.locator('#push-send').click();await page.locator('#push-dialog-status').getByText(/요청을 완료하지 못/).waitFor();
 await page.locator('#push-send').click();await page.locator('#push-status').getByText(/발송을 예약했습니다/).waitFor();
 const calls=await page.evaluate(()=>window.calls);const sends=calls.filter(c=>c.action==='send');assert.equal(sends.length,2);assert.equal(sends[0].requestId,sends[1].requestId);assert.equal(sends[0].iconKey,undefined);assert(sends[0].imageId);assert.equal(sends[0].imageId,sends[1].imageId);assert.equal(calls.filter(c=>c.action==='upload').length,1);assert.equal(calls.find(c=>c.action==='upload').id,sends[0].imageId);assert.deepEqual(sends[0].audience.userIds,ids);assert.deepEqual(calls.find(c=>c.action==='preview').audience.userIds,ids);assert.equal(sends[0].scheduledAt,new Date(time+'+09:00').toISOString());
 await page.locator('#push-add').click();assert.equal(await page.locator('#push-user-ids').inputValue(),'');assert(!(await page.locator('#push-photo-preview').isVisible()));
 await page.setViewportSize({width:390,height:844});await page.locator('#push-timing').selectOption('scheduled');
 await page.locator('#push-photo').setInputFiles({name:'fixture.png',mimeType:'image/png',buffer:png});await page.locator('#push-photo-dialog').waitFor({state:'visible'});
 assert(await page.locator('#push-photo-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
 const box=await page.locator('#push-photo-canvas').boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(box.x+10,box.y+box.height/2);await page.mouse.up();assert(Number(await page.locator('#push-photo-x').inputValue())>50);
 if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/push-photo-crop-mobile.png'});
 await page.locator('#push-photo-apply').click();await page.locator('#push-photo-preview').waitFor({state:'visible'});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert(await page.locator('#push-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth));
 if(process.env.QA_SCREENSHOT_DIR)await page.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/push-schedule-mobile.png'});
 assert.deepEqual(errors,[]);console.log('PASS real browser: DOM wiring, detail CTR, cancel, preview gate, KST schedule, retry UUID, multi-UID validation/dedup/payload/reset, no presets, landscape/portrait/square crop pixels, drag/zoom/re-edit/cancel, JPEG/PNG/WEBP normalization, photo upload retry/history, 390px crop overflow');
} finally {await browser.close();}
