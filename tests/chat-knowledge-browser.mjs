// Real browser + real editor module, entirely synthetic API. No dev server.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const source=await build({stdin:{contents:`import {createChatKnowledge} from './admin/chat-knowledge.js';window.qaKnowledge=createChatKnowledge(()=>window.fakeClient,id=>history.replaceState({},'', '/admin/knowledge/'+id));window.qaKnowledge.load();`,resolveDir:process.cwd()},bundle:true,write:false,format:'iife'});
const html=fs.readFileSync('admin/index.html','utf8').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,'');
const origin='http://127.0.0.1:54321';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const errors=[];
const out=process.env.QA_SCREENSHOT_DIR;
if(out)fs.mkdirSync(out,{recursive:true});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));
 await page.route(origin+'/**',route=>route.fulfill({contentType:route.request().url().endsWith('.css')?'text/css':route.request().url().endsWith('.png')?'image/png':'text/html',body:route.request().url().endsWith('.css')?fs.readFileSync('admin/admin.css'):route.request().url().endsWith('.png')?fs.readFileSync('assets/app-icon.png'):html}));
 await page.goto(origin+'/admin/knowledge');
 await page.evaluate(()=>{
  document.getElementById('login').hidden=true;document.getElementById('editor').hidden=false;document.getElementById('knowledge').hidden=false;
  for(const id of ['dashboard','credits','form','products','faqs','notice','admins','prompts','announcements','push','members','legal','support','chats','payments','ads','friends']){const n=document.getElementById(id);if(n)n.hidden=true;}
  document.getElementById('status').textContent='';document.getElementById('revision').hidden=true;
  document.getElementById('page-title').textContent='인물·줄임말 사전';
  window.entries=Array.from({length:25},(_,i)=>({id:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),kind:'term',canonical_name:i===0?'가상 <img src=x onerror="window.injected=true">':'가상 용어 '+i,aliases:['별칭'+i],context_terms:['가상그룹'],summary:'합성 설명',role_style:'',source_urls:[],enabled:true,revision:1,verified_at:'2026-10-18',updated_at:'2026-10-18'}));
  window.calls=[];window.conflict=false;window.denied=false;
  window.fakeClient={functions:{invoke:async(name,{body:b})=>{
   window.calls.push(b);await new Promise(r=>setTimeout(r,10));
   if(window.denied)return {error:{context:{status:403}}};
   let saved=null;
   if(b.action==='get')return {data:{item:window.entries.find(e=>e.id===b.id)||null}};
   if(b.action==='save'){
    if(window.conflict)return {error:{context:{status:409}}};
    const old=window.entries.find(e=>e.id===b.id);saved={...b.entry,id:b.id||'00000000-0000-4000-8000-000000009999',revision:(old?.revision||0)+1,updated_at:'2026-10-18',verified_at:'2026-10-18'};
    window.entries=window.entries.filter(e=>e.id!==b.id);window.entries.unshift(saved);
   }
   if(b.action==='delete')window.entries=window.entries.filter(e=>e.id!==b.id);
   const list=window.entries.filter(e=>(!b.search||(e.canonical_name+' '+e.aliases.join(' ')).includes(b.search))&&(!b.kind||b.kind==='all'||e.kind===b.kind));const page=b.page||1;
   return {data:{items:list.slice((page-1)*20,page*20),total:list.length,page,pageSize:20,saved,history:[]}};
  }}};
 });
 assert(await page.locator('#knowledge').evaluate(n=>n.parentElement===document.getElementById('dashboard').parentElement));
 await page.addScriptTag({content:source.outputFiles[0].text});
 await page.locator('#knowledge-list tbody tr').first().waitFor();assert.equal(await page.locator('#knowledge-list img').count(),0);assert.equal(await page.evaluate(()=>window.injected),undefined);
 await page.locator('#knowledge-page [aria-label="2페이지"]').click();await page.waitForFunction(()=>document.querySelectorAll('#knowledge-list tbody tr').length===5);
 await page.locator('#knowledge-page [aria-label="1페이지"]').click();await page.waitForFunction(()=>document.querySelectorAll('#knowledge-list tbody tr').length===20);
 if(out)await page.screenshot({path:out+'/list-desktop.png'});
 await page.locator('#knowledge-add').click();await page.locator('#knowledge-canonical_name').fill('새 가상 아이돌');await page.locator('#knowledge-entry-kind').selectOption('person');
 await page.locator('#knowledge-aliases').fill('가상별칭\n가상별칭\n다른별칭');await page.locator('#knowledge-summary').fill('새 가상 인물 설명');await page.locator('#knowledge-source_urls').fill('https://example.invalid/public');
 await page.locator('#knowledge-save').click();await page.locator('#knowledge-edit-status').getByText('저장했습니다. 다음 대화부터 참고합니다.').waitFor();assert.equal(new URL(page.url()).pathname,'/admin/knowledge/00000000-0000-4000-8000-000000009999');
 assert.equal(await page.evaluate(()=>window.entries[0].aliases.length),2);
 for(const width of [430,390,360]){
  await page.setViewportSize({width,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert(await page.locator('#knowledge-dialog').evaluate(d=>{const r=d.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth;}));
  if(out&&width===390)await page.screenshot({path:out+'/edit-mobile.png'});
 }
 await page.setViewportSize({width:1440,height:1000});if(out)await page.screenshot({path:out+'/edit-desktop.png'});
 await page.locator('#knowledge-summary').fill('編集中の合成説明');await page.evaluate(()=>window.conflict=true);await page.locator('#knowledge-save').click();
 await page.waitForFunction(()=>document.querySelector('#knowledge-edit-status').textContent.includes('다른 관리자'));assert.equal(await page.locator('#knowledge-summary').inputValue(),'編集中の合成説明');
 await page.evaluate(()=>window.conflict=false);await page.locator('#knowledge-enabled').uncheck();await page.locator('#knowledge-save').click();await page.waitForFunction(()=>window.entries[0].enabled===false);await page.waitForFunction(()=>!document.querySelector('#knowledge-delete').disabled);
 page.on('dialog',d=>d.accept());await page.locator('#knowledge-delete').click();await page.waitForFunction(()=>!document.querySelector('#knowledge-dialog').open);assert.equal(await page.evaluate(()=>window.entries.some(e=>e.canonical_name==='새 가상 아이돌')),false);
 await page.locator('#knowledge-search').fill('별칭2');await page.locator('#knowledge-filters button').click();await page.waitForFunction(()=>document.querySelectorAll('#knowledge-list tbody tr').length===6);
 await page.evaluate(()=>window.denied=true);await page.locator('#knowledge-refresh').click();await page.waitForFunction(()=>document.querySelector('#knowledge-status').textContent.includes('관리자 권한'));assert.equal(await page.locator('#knowledge-list tbody tr').count(),0);
 assert.deepEqual(errors,[]);console.log('Knowledge CRUD, revision conflict, pagination, XSS, permissions and 360/390/430px browser checks passed.');
}finally{await browser.close();}
