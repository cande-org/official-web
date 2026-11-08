// Real admin modules -> real local HTTP validators/storage -> native QA reuses
// the published state. No production settings, users or billing are touched.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const origin=process.env.ANIMATION_FIXTURE_URL||'http://127.0.0.1:54329';
const out=process.env.QA_SCREENSHOT_DIR;
if(out)fs.mkdirSync(out,{recursive:true});
const source=await build({entryPoints:['admin/admin.js'],bundle:true,write:false,format:'esm',plugins:[{name:'fixture',setup(b){b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'client',namespace:'fixture'}));b.onLoad({filter:/.*/,namespace:'fixture'},()=>({loader:'js',contents:`export const createClient=()=>window.fakeClient;`}));}}]});
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];
try{
 await fetch(origin+'/reset',{method:'POST'});
 const context=await browser.newContext({viewport:{width:1440,height:1000},...(out?{recordVideo:{dir:path.join(out,'raw-video'),size:{width:1440,height:1000}}}:{})});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.route(origin+'/**',r=>{
  const p=new URL(r.request().url()).pathname;
  if(['/admin-content','/admin-animation','/app-content','/state','/health'].includes(p)||p.startsWith('/storage/'))return r.continue();
  if(p==='/admin/config.json')return r.fulfill({contentType:'application/json',body:JSON.stringify({url:'https://fixture.invalid',key:'fixture'})});
  if(p==='/admin/admin.js')return r.fulfill({contentType:'text/javascript',body:source.outputFiles[0].text});
  if(p==='/admin/admin.css')return r.fulfill({contentType:'text/css',body:fs.readFileSync('admin/admin.css','utf8')});
  if(p.startsWith('/assets/'))return r.fulfill({contentType:p.endsWith('.json')?'application/json':'image/png',body:fs.readFileSync('.'+p)});
  return r.fulfill({contentType:'text/html',body:fs.readFileSync('admin/index.html','utf8')});
 });
 await page.route('https://tzuxtejuscgyvgfmlijt.supabase.co/storage/v1/object/public/mental-animations/**',async r=>{
  const response=await fetch(origin+'/storage/'+new URL(r.request().url()).pathname.split('/').at(-1));
  await r.fulfill({status:response.status,contentType:'application/json',body:Buffer.from(await response.arrayBuffer())});
 });
 await page.addInitScript(({origin})=>{
  window.fakeClient={auth:{getSession:async()=>({data:{session:{}}}),onAuthStateChange:f=>window.signedOut=f,signOut:async()=>window.signedOut('SIGNED_OUT')},functions:{invoke:async(name,o={})=>{
   if(!['admin-content','admin-animation'].includes(name))return {error:{context:new Response('{}',{status:503})}};
   const response=await fetch(origin+'/'+name,{method:o.method||'POST',headers:{'Content-Type':'application/json'},...(o.body?{body:JSON.stringify(o.body)}:{})});
   return response.ok?{data:await response.json()}:{error:{context:new Response('{}',{status:response.status})}};
  }}};
 },{origin});
 async function shot(name){if(out){await page.screenshot({path:path.join(out,name+'.png'),animations:'disabled',fullPage:true});if(/^0[1-4]-/.test(name))await page.waitForTimeout(1200);}}
 await page.goto(origin+'/admin/fortune');await page.locator('#fortune').waitFor({state:'visible'});
 assert.equal(await page.locator('#page-title').innerText(),'대화권 애니메이션');
 await shot('01-before-upload');
 await page.locator('#animation-upload').setInputFiles({name:'invalid.animation.json',mimeType:'application/json',buffer:Buffer.from('{"schemaVersion":999}')});
 await page.waitForFunction(()=>document.querySelector('#animation-upload-status').textContent.includes('손상'));
 assert.equal((await (await fetch(origin+'/state')).json()).packages.length,0);
 const cookie=JSON.parse(fs.readFileSync('assets/animations/cookie.animation.json','utf8'));
 await page.locator('#animation-upload').setInputFiles({name:'cookie.animation.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(cookie))});
 await page.waitForFunction(()=>document.querySelector('#animation-upload-status').textContent.includes('업로드 완료'));
 await page.waitForFunction(()=>document.querySelector('#animation-preview-status').textContent.includes('두 번'));
 assert.equal(await page.locator('#fortune-published').innerText(),'포춘쿠키');
 const before=(await (await fetch(origin+'/state')).json()).published_revision;
 await shot('02-uploaded-draft');
 const cookieIdle=await page.locator('#animation-canvas').evaluate(c=>c.toDataURL());
 await page.locator('#animation-play').dblclick();await page.waitForFunction(()=>document.querySelector('#animation-preview-status').textContent.includes('미리보기 완료'));
 assert.notEqual(await page.locator('#animation-canvas').evaluate(c=>c.toDataURL()),cookieIdle);
 await page.locator('#form button[type=submit]').click();await page.waitForFunction(()=>document.querySelector('#dirty').textContent==='저장된 초안');
 assert.equal((await (await fetch(origin+'/state')).json()).published_revision,before);
 await page.reload();await page.locator('#fortune').waitFor({state:'visible'});
 assert.equal(await page.locator('#animation-source').inputValue(),'remote');
 await page.locator('#publish').click();await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('앱에 공개했습니다'));
 await shot('03-cookie-published');
 const pepero=JSON.parse(fs.readFileSync('assets/animations/pepero.animation.json','utf8'));
 pepero.id='season-remote-v1';pepero.name='빼빼로 · 원격';pepero.caption='원격으로 받은 빼빼로를 부러뜨려 보세요!';
 await page.locator('#animation-upload').setInputFiles({name:'season.animation.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(pepero))});
 await page.waitForFunction(()=>document.querySelector('#animation-upload-status').textContent.includes('업로드 완료'));
 await page.waitForFunction(()=>document.querySelector('#animation-caption').textContent.includes('원격으로'));
 assert.equal(await page.locator('#fortune-published').innerText(),'포춘쿠키');
 await page.locator('#animation-play-all').click();await page.waitForFunction(()=>document.querySelector('#animation-preview-status').textContent.includes('미리보기 완료'));
 await page.locator('[data-animation-demo=cookie]').dblclick();await page.waitForFunction(()=>document.querySelector('#animation-caption').textContent==='포춘쿠키를 깨보세요!'&&document.querySelector('#animation-preview-status').textContent.includes('미리보기 완료'));
 assert.equal(await page.locator('#animation-source').inputValue(),'remote');
 assert.equal((await (await fetch(origin+'/state')).json()).draft.fortuneAnimation.id,'cookie-original-v1');
 await page.locator('#publish').click();await page.waitForFunction(()=>document.querySelector('#fortune-published').textContent==='빼빼로 · 원격');
 await shot('04-remote-published');
 const live=await (await fetch(origin+'/app-content')).json();
 assert.equal(live.fortuneAnimation.id,'season-remote-v1');
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await shot('remote-'+width);}
 // Uploaded previous versions remain selectable; upload itself never publishes.
 assert.equal(await page.locator('#animation-package option').count(),3);
 await page.setViewportSize({width:1440,height:1000});
 await page.locator('#logout').click();assert(await page.locator('#editor').isHidden());
 assert.deepEqual(errors,[]);
 const video=page.video();await context.close();if(out)fs.renameSync(await video.path(),path.join(out,'admin-remote.webm'));
 const report={ok:true,syntheticAuth:true,productionWrites:0,invalidUploadRejected:true,uploadDoesNotPublish:true,draftSurvivesReload:true,publishReachesPublicApi:true,customId:live.fortuneAnimation.id,previousVersions:2,responsiveWidths:[360,390,430],pageErrors:errors,published:live.fortuneAnimation};
 if(out)fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
 console.log('PASS remote animation upload -> draft -> preview -> publish -> public API; custom package, restart, mobile, invalid upload, logout');
}finally{await browser.close();}
