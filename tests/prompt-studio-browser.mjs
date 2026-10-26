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
  window.calls=[];window.snapshot={revision:3,published_revision:2,published_at:'2026-10-25',draft:{stable:'안정형은 느긋하고 다정하게 짧은 대사를 말한다.',anxious:'불안형은 빠르고 생생하게 짧은 대사를 말한다.',avoidant:'회피형은 짧고 건조하게 사실만 담아 말한다.'},history:[{revision:3,action:'save',created_at:'2026-10-26'},{revision:2,action:'publish',created_at:'2026-10-25'}],historyBeforeRevision:2,productionSettings:{model:'gpt-6-luna',reasoningEffort:'low'}};
  window.versions=Object.fromEntries([1,2,3].map(revision=>[revision,{revision,action:revision===3?'save':revision===2?'publish':'seed',created_at:'2026-10-25',guides:{stable:`이전 안정형 v${revision} 원문 <img src=x onerror=alert(1)>`,anxious:`이전 불안형 v${revision} 원문은 그대로 보여야 한다.`,avoidant:`이전 회피형 v${revision} 원문은 그대로 보여야 한다.`}}]));
  window.fixtureClient={functions:{invoke:async(name,options)=>{
   const body=options?.body;window.calls.push(structuredClone(body??{action:'read'}));
   if(!body)return{data:structuredClone(window.snapshot)};
   if(body.action==='history')return{data:{history:[{revision:1,action:'seed',created_at:'2026-10-25'}],historyBeforeRevision:null}};
   if(body.action==='version'){
    if(window.deferVersion)await new Promise(resolve=>window.releaseVersion=resolve);
    if(window.versionError)return{error:{context:{status:404}}};
    return{data:{version:structuredClone(window.versions[body.targetRevision])}};
   }
   if(body.action==='test'){
    if(window.voiceError)return{error:{context:{status:422}}};
    if(window.defer)await new Promise(resolve=>(window.releases??=[]).push(resolve));
    const custom=body.variant==='custom';return {data:{revision:custom?3:2,model:body.model??'gpt-6-luna',reasoningEffort:body.reasoningEffort??'low',durationMs:10,quotaUsed:1,usage:{},voiceChecks:{cuteEligibleCount:1,cuteMember:window.plainVoice?undefined:'stable',removedOpeners:window.removedEcho?1:0},result:{mode:'normal',messages:[{memberId:'stable',senderName:'안정형',content:custom?body.guides.stable:'공개 지침 응답'}]}}};
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
 assert.match(await page.locator('#prompt-results').textContent(),/애교 어미 후보/);
 await page.evaluate(()=>{window.plainVoice=true;window.removedEcho=true;});await run();assert.match(await page.locator('#prompt-results').textContent(),/이번 턴은 평소 말투/);assert.match(await page.locator('#prompt-results').textContent(),/되받기 첫 문장 1개/);
 await page.evaluate(()=>window.voiceError=true);await run();assert.match(await page.locator('#prompt-results').textContent(),/금지한 되받기 말투가 검출/);assert(!(await page.locator('#prompt-run').isDisabled()));
 const beforeWrites=await page.evaluate(()=>window.calls.filter(c=>['save','publish','rollback'].includes(c.action)).length);
 const unpublished='저장하지 않은 합성 지침을 미리보기가 덮어쓰면 안 된다.';
 await page.locator('#prompt-stable').fill(unpublished);
 await page.locator('#prompt-versions').selectOption('2');await page.locator('#prompt-view-version').click();
 await page.locator('#prompt-version-dialog').waitFor({state:'visible'});
 assert.equal(await page.locator('#prompt-version-stable').inputValue(),'이전 안정형 v2 원문 <img src=x onerror=alert(1)>');
 assert(await page.locator('#prompt-version-stable').evaluate(el=>el.readOnly));
 assert.equal(await page.locator('#prompt-version-dialog img').count(),0);
 assert.equal(await page.locator('#prompt-stable').inputValue(),unpublished);
 await page.locator('#prompt-version-close').click();
 await page.locator('#prompt-versions').selectOption('3');assert(await page.locator('#prompt-restore').isDisabled());
 await page.locator('#prompt-view-version').click();await page.locator('#prompt-version-dialog').waitFor({state:'visible'});
 assert.match(await page.locator('#prompt-version-meta').textContent(),/초안 저장/);await page.locator('#prompt-version-close').click();
 await page.locator('#prompt-more-versions').click();await page.waitForFunction(()=>document.querySelector('#prompt-versions option[value="1"]'));
 assert.equal(await page.locator('#prompt-versions').inputValue(),'3');assert.equal(await page.locator('#prompt-stable').inputValue(),unpublished);assert(await page.locator('#prompt-more-versions').isDisabled());
 await page.locator('#prompt-versions').selectOption('1');await page.locator('#prompt-view-version').click();await page.locator('#prompt-version-dialog').waitFor({state:'visible'});
 page.removeAllListeners('dialog');page.once('dialog',d=>d.dismiss());await page.locator('#prompt-version-load').click();assert.equal(await page.locator('#prompt-stable').inputValue(),unpublished);assert(await page.locator('#prompt-version-dialog').isVisible());
 await page.setViewportSize({width:390,height:844});assert(await page.locator('#prompt-version-dialog').evaluate(el=>el.getBoundingClientRect().width<=window.innerWidth&&el.scrollWidth<=el.clientWidth));
 page.once('dialog',d=>d.accept());await page.locator('#prompt-version-load').click();
 assert.equal(await page.locator('#prompt-stable').inputValue(),'이전 안정형 v1 원문 <img src=x onerror=alert(1)>');
 assert.equal(await page.locator('#prompt-results .prompt-result-row').count(),0);assert(await page.evaluate(()=>window.studio.hasUnsaved()));
 assert.match(await page.locator('#prompt-status').textContent(),/v1을/);
 assert.equal(await page.evaluate(()=>window.calls.filter(c=>['save','publish','rollback'].includes(c.action)).length),beforeWrites);
 await page.evaluate(()=>window.versionError=true);await page.locator('#prompt-view-version').click();await page.waitForFunction(()=>document.getElementById('prompt-history-status').textContent.includes('찾을 수 없습니다'));
 assert(!await page.locator('#prompt-version-dialog').isVisible());
 await page.evaluate(()=>{window.versionError=false;window.deferVersion=true;});await page.locator('#prompt-view-version').click();await page.waitForFunction(()=>window.releaseVersion);
 await page.evaluate(()=>{window.studio.clear();window.releaseVersion();});await page.waitForTimeout(50);
 assert(!await page.locator('#prompt-version-dialog').isVisible());assert.equal(await page.locator('#prompt-version-stable').inputValue(),'');
 assert.deepEqual(errors,[]);
 console.log('PASS prompt studio: production defaults, A/B history, version previews, draft history, older pages, plain text, unsaved protection, copy without publishing, narrow dialog, failed and stale reads');
} finally {await browser.close();}
