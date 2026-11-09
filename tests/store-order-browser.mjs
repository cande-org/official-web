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
  const initial={draft:seed,contracts:seed.products.map(p=>({key:p.key,subscription:p.key.endsWith('Monthly')})),revision:1,published_revision:1,published_at:'2026-11-08T00:00:00Z',publishedFortuneTheme:'cookie'};
  window.fixture=JSON.parse(sessionStorage.getItem('fixture:content')||JSON.stringify(initial));
  window.calls=[];window.session={};
  window.fakeClient={auth:{getSession:async()=>({data:{session:window.session}}),onAuthStateChange:f=>window.signedOut=f,signOut:async()=>{window.session=null;window.signedOut('SIGNED_OUT');}},functions:{invoke:async(name,o)=>{
   if(name==='admin-animation')return {data:{packages:[]}};
   if(name!=='admin-content')return {error:{context:new Response('{}',{status:503})}};
   const b=o?.body;
   if(b){window.calls.push(structuredClone(b));if(window.conflict)return {error:{context:new Response('{}',{status:409})}};
    if(b.revision!==window.fixture.revision)throw Error('fixture revision mismatch');
    window.fixture.draft=structuredClone(b.content);window.fixture.revision++;
    if(b.action==='publish'){window.fixture.published_revision=window.fixture.revision;window.fixture.publishedFortuneTheme=b.content.fortuneTheme||'cookie';window.fixture.publishedStoreSectionOrder=b.content.storeSectionOrder||'credits_first';}
    sessionStorage.setItem('fixture:content',JSON.stringify(window.fixture));
   }
   return {data:structuredClone(window.fixture)};
  }}};
 },{seed});
 await page.goto(origin+'/admin/products');
 await page.locator('#store-section-order').waitFor({state:'visible'});
 const initialProducts=structuredClone(seed.products);
 assert.equal(await page.locator('#store-section-order').inputValue(),'credits_first');
 assert.match(await page.locator('#store-order-published').innerText(),/대화권 먼저/);
 const shot=async name=>{if(out)await page.screenshot({animations:'disabled',fullPage:true,path:out+'/'+name+'.png'});};
 await shot('admin-credits-first');
 await page.locator('#preview').click();assert.equal(await page.locator('#preview-body h2').first().innerText(),'필요할 때 충전');await page.locator('#close-preview').click();
 await page.locator('#store-section-order').selectOption('subscriptions_first');
 assert.match(await page.locator('#dirty').innerText(),/저장하지/);
 await page.locator('#preview').click();assert.equal(await page.locator('#preview-body h2').first().innerText(),'월간 멤버십');await page.locator('#close-preview').click();
 assert.match(await page.locator('#store-order-published').innerText(),/대화권 먼저/);
 await page.locator('#form button[type=submit]').click();
 await page.waitForFunction(()=>window.fixture.revision===2);
 await page.reload();await page.locator('#store-section-order').waitFor({state:'visible'});
 assert.equal(await page.locator('#store-section-order').inputValue(),'subscriptions_first');
 assert.match(await page.locator('#store-order-published').innerText(),/대화권 먼저/);
 await shot('admin-subscriptions-draft');
 await page.locator('#publish').click();
 await page.waitForFunction(()=>document.querySelector('#store-order-published').textContent.includes('구독권 먼저'));
 await shot('admin-subscriptions-published');
 await page.locator('#store-section-order').selectOption('credits_first');
 await page.evaluate(()=>window.conflict=true);await page.locator('#publish').click();
 await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('다른 관리자가'));
 assert.match(await page.locator('#store-order-published').innerText(),/구독권 먼저/);
 await page.evaluate(()=>window.conflict=false);await page.locator('#publish').click();
 await page.waitForFunction(()=>document.querySelector('#store-order-published').textContent.includes('대화권 먼저'));
 assert.deepEqual(await page.evaluate(()=>window.fixture.draft.products),initialProducts);
 assert.deepEqual(await page.evaluate(()=>window.fixture.draft.faqs),seed.faqs);
 assert.equal(await page.evaluate(()=>window.fixture.draft.paymentNotice),seed.paymentNotice);
 for(const width of [360,390,430]){
  await page.setViewportSize({width,height:844});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await shot('admin-'+width);
 }
 assert.deepEqual(errors,[]);
 if(out)fs.writeFileSync(out+'/verification.json',JSON.stringify({ok:true,synthetic:true,productionWrites:0,checks:['credits-first default','selection stages draft','preview follows draft group order without publication','save and reload preserves draft','publish independently changes visible public order','reverse publication','409 conflict preserves published order','products, prices, FAQ and notice unchanged','360/390/430 no horizontal overflow'],errors},null,2));
 console.log('PASS store order: default, draft/save/reload, publish both orders, conflict, other content unchanged, mobile widths');
 await context.close();
} finally {await browser.close();}
