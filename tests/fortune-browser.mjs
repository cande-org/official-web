// Real admin shell, synthetic content API; never publishes production settings.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const out = process.env.QA_SCREENSHOT_DIR;
if (out) fs.mkdirSync(out, {recursive:true});
const seed = JSON.parse(fs.readFileSync('../mental/server/supabase/content/initial.json', 'utf8'));
const source = await build({entryPoints:['admin/admin.js'],bundle:true,write:false,format:'esm',plugins:[{name:'fixture',setup(b){
 b.onResolve({filter:/^@supabase\/supabase-js$/},()=>({path:'client',namespace:'fixture'}));
 b.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const createClient=()=>window.fakeClient;',loader:'js'}));
}}]});
const origin='http://127.0.0.1:54321';
const csp=JSON.parse(fs.readFileSync('vercel.json','utf8')).headers.find(h=>h.source==='/admin(.*)').headers.find(h=>h.key==='Content-Security-Policy').value;
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000},...(out?{recordVideo:{dir:path.join(out,'raw-video'),size:{width:1440,height:1000}}}:{})});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 page.on('dialog',d=>d.accept());
 await page.route(origin+'/**',r=>{
  const p=new URL(r.request().url()).pathname;
  if(p==='/admin/config.json')return r.fulfill({contentType:'application/json',body:JSON.stringify({url:'https://fixture.invalid',key:'fixture'})});
  if(p==='/admin/admin.js')return r.fulfill({contentType:'text/javascript',body:source.outputFiles[0].text});
  if(p==='/admin/admin.css')return r.fulfill({contentType:'text/css',body:fs.readFileSync('admin/admin.css','utf8')});
  if(p.startsWith('/assets/'))return r.fulfill({contentType:p.endsWith('.json')?'application/json':'image/png',body:fs.readFileSync('.'+p)});
  return r.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':csp},body:fs.readFileSync('admin/index.html','utf8')});
 });
 await page.addInitScript(({seed})=>{
  const initial={draft:seed,revision:1,published_revision:1,published_at:'2026-11-08T00:00:00Z',publishedFortuneTheme:'cookie'};
  window.fixture=JSON.parse(sessionStorage.getItem('fixture:content')||JSON.stringify(initial));
  window.calls=[];window.session={};
  window.fakeClient={auth:{getSession:async()=>({data:{session:window.session}}),onAuthStateChange:f=>window.signedOut=f,signOut:async()=>{window.session=null;window.signedOut('SIGNED_OUT');}},functions:{invoke:async(name,o)=>{
   if(name==='admin-animation')return {data:{packages:[]}};
   if(name!=='admin-content')return {error:{context:new Response('{}',{status:503})}};
   const b=o?.body;
   if(b){window.calls.push(structuredClone(b));if(window.conflict)return {error:{context:new Response('{}',{status:409})}};
    if(b.revision!==window.fixture.revision)throw Error('fixture revision mismatch');
    window.fixture.draft=structuredClone(b.content);window.fixture.revision++;
    if(b.action==='publish'){window.fixture.published_revision=window.fixture.revision;window.fixture.publishedFortuneTheme=b.content.fortuneTheme||'cookie';}
    sessionStorage.setItem('fixture:content',JSON.stringify(window.fixture));
   }
   return {data:structuredClone(window.fixture)};
  }}};
 },{seed});
 await page.goto(origin+'/admin/fortune');await page.locator('#fortune').waitFor({state:'visible'});
 assert.equal(await page.locator('#fortune-published').innerText(),'포춘쿠키');
 assert.equal(await page.locator('#fortune-theme').inputValue(),'cookie');
 await page.waitForFunction(()=>document.querySelector('#animation-preview-status').textContent.includes('더블클릭'));
 const pixels=()=>page.locator('#animation-canvas').evaluate(c=>c.toDataURL());
 const idle=await pixels();
 await page.locator('#animation-play').dblclick();
 await page.waitForFunction(()=>document.querySelector('#animation-preview-status').textContent.includes('미리보기 완료'));
 assert.notEqual(await pixels(),idle,'double-click must animate both phases');
 assert.equal(await page.locator('#dirty').innerText(),'저장된 초안');assert.equal((await page.evaluate(()=>window.calls)).length,0);
 await page.locator('#animation-replay').click();assert.equal(await pixels(),idle);
 await page.locator('#animation-play').press('Enter');await page.locator('#animation-play').press('Enter');
 await page.waitForFunction(()=>document.querySelector('#animation-preview-status').textContent.includes('미리보기 완료'));
 await page.locator('[data-animation-demo=pepero]').dblclick({delay:60});
 await page.waitForFunction(()=>document.querySelector('#animation-caption').textContent.includes('빼빼로')&&document.querySelector('#animation-preview-status').textContent.includes('미리보기 완료'));
 assert.equal(await page.locator('#fortune-theme').inputValue(),'cookie');assert.equal(await page.locator('#dirty').innerText(),'저장된 초안');
 await page.locator('#animation-play-all').click();await page.waitForFunction(()=>document.querySelector('#animation-preview-status').textContent.includes('미리보기 완료'));
 await page.locator('[data-animation-demo=cookie]').click();await page.waitForFunction(()=>document.querySelector('#animation-caption').textContent.includes('포춘쿠키')&&document.querySelector('#animation-preview-status').textContent.includes('미리보기 완료'));
 await page.locator('#animation-replay').click();await page.locator('#animation-play').dblclick();await page.locator('#animation-replay').click();
 await page.waitForTimeout(900);assert((await page.locator('#animation-preview-status').innerText()).includes('더블클릭'));assert.equal(await pixels(),idle);
 // A load failure clears the old picture, disables playback, and can be retried.
 await page.locator('[data-animation-demo=pepero]').click();await page.waitForFunction(()=>document.querySelector('#animation-caption').textContent.includes('빼빼로')&&document.querySelector('#animation-preview-status').textContent.includes('미리보기 완료'));
 let failCookie=true;await page.route(origin+'/assets/animations/cookie.animation.json',r=>{if(failCookie){failCookie=false;return r.fulfill({status:503,body:'unavailable'});}return r.fallback();});
 await page.locator('[data-animation-demo=cookie]').click();await page.waitForFunction(()=>document.querySelector('#animation-preview-status').textContent.includes('불러오지 못'));
 assert(await page.locator('#animation-play').isDisabled());assert(await page.locator('#animation-play-all').isDisabled());
 assert(await page.locator('#animation-canvas').evaluate(c=>!c.getContext('2d').getImageData(0,0,c.width,c.height).data.some((v,i)=>i%4===3&&v)));
 await page.locator('#animation-replay').click();await page.waitForFunction(()=>document.querySelector('#animation-preview-status').textContent.includes('더블클릭'));assert.equal(await pixels(),idle);
 if(out){await page.screenshot({animations:'disabled',fullPage:true,path:out+'/admin-cookie.png'});await page.waitForTimeout(1500);}
 await page.locator('#fortune-theme').selectOption('pepero');
 await page.waitForFunction(()=>document.querySelector('#animation-caption').textContent.includes('빼빼로'));
 assert.match(await page.locator('#dirty').innerText(),/저장하지/);
 assert.equal(await page.locator('#fortune-published').innerText(),'포춘쿠키');
 await page.locator('#form button[type=submit]').click();
 await page.waitForFunction(()=>window.fixture.revision===2);
 assert.equal(await page.locator('#fortune-published').innerText(),'포춘쿠키');
 if(out){await page.screenshot({animations:'disabled',path:out+'/admin-draft.png'});await page.waitForTimeout(1800);}
 await page.reload();await page.locator('#fortune').waitFor({state:'visible'});
 assert.equal(await page.locator('#fortune-theme').inputValue(),'pepero');
 assert.equal(await page.locator('#fortune-published').innerText(),'포춘쿠키');
 await page.locator('#publish').click();await page.waitForFunction(()=>document.querySelector('#fortune-published').textContent==='빼빼로');
 if(out){await page.screenshot({animations:'disabled',path:out+'/admin-published.png'});await page.waitForTimeout(2200);}
 await page.locator('#fortune-theme').selectOption('cookie');await page.evaluate(()=>window.conflict=true);await page.locator('#publish').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('다른 관리자가'));
 assert.equal(await page.locator('#fortune-published').innerText(),'빼빼로');
 assert.equal(await page.locator('#fortune-theme').inputValue(),'cookie');
 await page.evaluate(()=>window.conflict=false);await page.locator('#publish').click();
 await page.waitForFunction(()=>document.querySelector('#fortune-published').textContent==='포춘쿠키');
 const payloads=await page.evaluate(()=>window.calls);
 assert.equal(payloads.at(-1).content.fortuneTheme,'cookie');
 assert.deepEqual(payloads.at(-1).content.products,seed.products);
 assert.deepEqual(payloads.at(-1).content.faqs,seed.faqs);
 assert.equal(payloads.at(-1).content.paymentNotice,seed.paymentNotice);
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});await page.waitForFunction(()=>document.querySelector('#sidebar').getBoundingClientRect().right<=1);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no horizontal overflow');
  await page.locator('[data-animation-demo=pepero]').click();
  await page.waitForFunction(()=>document.querySelector('#animation-play').getAttribute('aria-busy')==='true');
  await page.waitForFunction(()=>document.querySelector('#animation-caption').textContent.includes('빼빼로')&&document.querySelector('#animation-preview-status').textContent.includes('미리보기 완료'));
  assert(await page.locator('#animation-canvas').evaluate(c=>{const r=c.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight;}),'preview canvas is in the viewport');
  if(out)await page.screenshot({animations:'disabled',path:out+'/admin-'+width+'.png'});
 }
 await page.setViewportSize({width:1440,height:1000});await page.locator('#animation-play-all').click();await page.locator('#logout').click();assert(await page.locator('#editor').isHidden());await page.waitForTimeout(900);assert.equal(await page.locator('#animation-preview-status').innerText(),'');assert(await page.locator('#animation-preview').isHidden());
 const video=page.video();await context.close();
 if(out)fs.renameSync(await video.path(),out+'/admin-demo.webm');
 assert.deepEqual(errors,[]);
 console.log('PASS fortune admin: builtin canvas pixels, real double-click, rapid keyboard taps, both thumbnail previews, full replay, reset cancels queued taps, load error/retry, production CSP, preview does not stage/publish, selection/save/publish/conflict, 360/390/430px playback visible, logout during playback');
 if(out)fs.writeFileSync(out+'/admin-verification.json',JSON.stringify({ok:true,synthetic:true,productionWrites:0,checks:['builtin canvas pixels','real double-click completes both phases','rapid keyboard taps','both thumbnail previews','full replay','reset cancels queued input','load failure clears pixels and retry recovers','production CSP','preview does not stage or publish','save vs publish','reload','conflict','both versions','other content unchanged','360/390/430 no overflow and playback scrolled into view','logout during playback','page errors empty']},null,2));
} finally {await browser.close();}
