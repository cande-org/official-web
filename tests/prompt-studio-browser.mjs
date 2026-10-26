import fs from 'node:fs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE_PATH||'playwright');
const source=await build({stdin:{contents:`import {createPromptStudio} from './admin/prompt-studio.js';window.studio=createPromptStudio(()=>window.fixtureClient);window.studio.load();`,resolveDir:process.cwd()},bundle:true,write:false,format:'esm'});
const origin='https://fixture.invalid';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
 const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route(origin+'/**',route=>{const file=new URL(route.request().url()).pathname;
  if(file==='/studio.js')return route.fulfill({contentType:'text/javascript',body:source.outputFiles[0].text});
  if(file==='/admin/admin.css')return route.fulfill({contentType:'text/css',body:fs.readFileSync('admin/admin.css','utf8')});
  return route.fulfill({contentType:'text/html',body:fs.readFileSync('admin/index.html','utf8').replace('<script type="module" src="/admin/admin.js"></script>','<script type="module" src="/studio.js"></script>').replace('id="prompts" hidden','id="prompts"').replace('id="editor" hidden','id="editor"')});
 });
 await page.addInitScript(()=>{
  window.calls=[];window.snapshot={revision:3,published_revision:2,published_at:'2026-10-25',draft:{stable:'안정형은 느긋하고 다정하게 짧은 대사를 말한다.',anxious:'불안형은 빠르고 생생하게 짧은 대사를 말한다.',avoidant:'회피형은 짧고 건조하게 사실만 담아 말한다.'},history:[],productionSettings:{model:'gpt-6-luna',reasoningEffort:'low'}};
  window.fixtureClient={functions:{invoke:async(name,options)=>{
   const body=options?.body;window.calls.push(structuredClone(body??{action:'read'}));
   if(!body)return{data:structuredClone(window.snapshot)};
   if(body.action==='test'){
    if(window.defer)await new Promise(resolve=>(window.releases??=[]).push(resolve));
    const custom=body.variant==='custom';return {data:{revision:custom?3:2,model:body.model??'gpt-6-luna',reasoningEffort:body.reasoningEffort??'low',durationMs:10,quotaUsed:1,usage:{},result:{mode:'normal',messages:[{memberId:'stable',senderName:'안정형',content:custom?body.guides.stable:'공개 지침 응답'}]}}};
   }
   window.snapshot={...window.snapshot,draft:body.guides,revision:window.snapshot.revision+1,...(body.action==='publish'?{published_revision:window.snapshot.revision+1}:{})};return{data:structuredClone(window.snapshot)};
  }}};
 });
 await page.goto(origin+'/admin/prompts');await page.locator('#prompt-meta').getByText(/초안 v3/).waitFor();
 assert.equal(await page.locator('#prompt-reasoning').inputValue(),'low');
 assert.match(await page.locator('#prompt-production-settings').textContent(),/gpt-6-luna · 추론 low/);
 const run=async()=>{await page.locator('#prompt-run').click();await page.waitForFunction(()=>!document.getElementById('prompt-run').disabled);};
 const tests=()=>page.evaluate(()=>window.calls.filter(c=>c.action==='test'));
 const a='다정한 말투로 답하고 마지막에 합성표식 달빛우편을 붙인다.';
 await page.locator('#prompt-stable').fill(a);await run();let calls=await tests();assert.equal(calls.length,2);
 assert.deepEqual(await page.evaluate(()=>window.calls.map(c=>c.action)),['read','test','test']);
 assert.equal(calls[0].variant,'published');assert(!('reasoningEffort' in calls[0]));assert(!('guides' in calls[0]));
 assert.equal(calls[1].guides.stable,a);assert.equal(calls[1].model,'gpt-6-luna');assert.equal(calls[1].reasoningEffort,'low');
 await page.locator('#prompt-message').fill('그다음은?');await run();calls=await tests();assert(calls.at(-1).history.length>0);
 const b='말을 짧게 하고 마지막에 합성표식 별빛우편을 붙인다.';
 await page.locator('#prompt-stable').fill(b);assert.equal(await page.locator('.prompt-result-row').count(),0);await run();calls=await tests();assert.equal(calls.at(-1).guides.stable,b);assert.equal(calls.at(-1).history.length,0);
 await page.locator('#prompt-reasoning').selectOption('none');assert.equal(await page.locator('.prompt-result-row').count(),0);await run();calls=await tests();assert.equal(calls.at(-1).reasoningEffort,'none');assert(!('reasoningEffort' in calls.at(-2)));
 await page.locator('#prompt-save').click();await page.waitForFunction(()=>document.getElementById('prompt-status').textContent.includes('초안이 저장'));assert.equal(await page.locator('.prompt-result-row').count(),1);
 page.on('dialog',d=>d.accept());await page.locator('#prompt-publish').click();await page.waitForFunction(()=>document.getElementById('prompt-status').textContent.includes('다음 새 메시지'));assert.equal(await page.locator('.prompt-result-row').count(),0);
 await page.evaluate(()=>window.defer=true);await page.locator('#prompt-run').click();assert(await page.locator('#prompt-stable').isDisabled());assert(await page.locator('#prompt-reset').isDisabled());await page.waitForFunction(()=>window.releases?.length===2);await page.evaluate(()=>{window.defer=false;window.releases.forEach(resolve=>resolve());});await page.waitForFunction(()=>!document.getElementById('prompt-run').disabled);
 await page.locator('#prompt-scenario').selectOption('correction');await page.locator('#prompt-members').selectOption('anxious');await run();calls=await tests();
 assert(calls.at(-1).history.filter(m=>m.role==='assistant').every(m=>m.memberId==='anxious'));
 assert.deepEqual(errors,[]);
 console.log('PASS prompt studio: production defaults, unsaved A/B prompt delivery, continued history, automatic resets, published baseline, experimental none, save/publish and in-flight edit protection');
} finally {await browser.close();}
