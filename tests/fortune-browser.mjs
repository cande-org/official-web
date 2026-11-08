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
  if(p.startsWith('/assets/'))return r.fulfill({contentType:'image/png',body:fs.readFileSync('.'+p)});
  return r.fulfill({contentType:'text/html',body:fs.readFileSync('admin/index.html','utf8')});
 });
 await page.addInitScript(({seed})=>{
  const initial={draft:seed,revision:1,published_revision:1,published_at:'2026-11-08T00:00:00Z',publishedFortuneTheme:'cookie'};
  window.fixture=JSON.parse(sessionStorage.getItem('fixture:content')||JSON.stringify(initial));
  window.calls=[];window.session={};
  window.fakeClient={auth:{getSession:async()=>({data:{session:window.session}}),onAuthStateChange:f=>window.signedOut=f,signOut:async()=>{window.session=null;window.signedOut('SIGNED_OUT');}},functions:{invoke:async(name,o)=>{
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
 if(out){await page.screenshot({animations:'disabled',path:out+'/admin-cookie.png'});await page.waitForTimeout(1500);}
 await page.locator('#fortune-theme').selectOption('pepero');
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
 for(const width of [360,390,430]){await page.setViewportSize({width,height:844});await page.waitForFunction(()=>document.querySelector('#sidebar').getBoundingClientRect().right<=1);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));if(out)await page.screenshot({animations:'disabled',path:out+'/admin-'+width+'.png'});}
 await page.setViewportSize({width:1440,height:1000});await page.locator('#logout').click();assert(await page.locator('#editor').isHidden());
 const video=page.video();await context.close();
 if(out)fs.renameSync(await video.path(),out+'/admin-demo.webm');
 assert.deepEqual(errors,[]);
 console.log('PASS fortune admin: legacy cookie, selection, save vs publish, reload persistence, revision conflict, both directions, unrelated content preserved, no page errors');
 if(out)fs.writeFileSync(out+'/admin-verification.json',JSON.stringify({ok:true,synthetic:true,productionWrites:0,checks:['legacy cookie','save vs publish','reload','conflict','both versions','other content unchanged','360/390/430 no overflow','logout','page errors empty']},null,2));
} finally {await browser.close();}
