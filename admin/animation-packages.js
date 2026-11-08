// Data-only previews. Uploaded files are validated again by the server.
export function createAnimationPackages({getClient,getDraft,stage,onError}) {
 const $=id=>document.getElementById(id);
 let packages=[],generation=0,previewTicket=0,pack=null,requestedKey=null,previewDescriptor=null,images={},step=0,playing=false,uploading=false,queuedTap=false,autoplayRequested=false,demoTimer=null;
 const bundled = theme => ({id:`${theme}-original-v1`,name:theme==='pepero'?'빼빼로':'포춘쿠키',url:`/assets/animations/${theme}.animation.json`,bundled:true});
 const selection = () => getDraft()?.fortuneAnimation ?? bundled(getDraft()?.fortuneTheme==='pepero'?'pepero':'cookie');
 const previewKey = descriptor => descriptor.bundled?descriptor.url:descriptor.sha256;
 const readyMessage = '그림을 두 번 누르거나 더블클릭하세요. ‘전체 미리보기 재생’으로도 확인할 수 있습니다. 미리보기는 무음입니다.';
 function controls(loading=false){$('animation-play').disabled=!pack;$('animation-play-all').disabled=!pack||playing;$('animation-replay').disabled=loading;$('animation-play').setAttribute('aria-busy',String(playing||loading));}
 function options() {
  const selected=getDraft()?.fortuneAnimation;
  const values=[...packages];
  if(selected&&!values.some(p=>p.sha256===selected.sha256))values.unshift(selected);
  $('animation-package').replaceChildren(new Option('업로드한 애니메이션 선택',''),...values.map(p=>new Option(`${p.name} · ${p.sha256.slice(0,8)}`,p.sha256)));
  $('animation-package').value=selected?.sha256??'';
  $('animation-source').value=selected||$('animation-source').value==='remote'?'remote':'bundled';
  $('animation-package').required=$('animation-source').value==='remote';
  $('animation-uploaded-fields').hidden=!selected&&$('animation-source').value!=='remote';
 }
 async function preview(descriptor,{autoplay=false}={}) {
  if(previewKey(descriptor)===requestedKey){if(autoplay){if(pack)void playAll();else autoplayRequested=true;}return;}
  clearTimeout(demoTimer);demoTimer=null;
  const ticket=++previewTicket;pack=null;requestedKey=previewKey(descriptor);previewDescriptor=descriptor;step=0;playing=false;queuedTap=false;autoplayRequested=autoplay;
  $('animation-preview').hidden=false;$('animation-caption').textContent='';
  $('animation-details').textContent=descriptor.bundled?`${descriptor.name} · 앱 기본 애니메이션 미리보기`:`${descriptor.name} · ${(descriptor.bytes/1024).toFixed(0)}KB · 버전 ${descriptor.sha256.slice(0,8)}`;
  $('animation-canvas').getContext('2d').clearRect(0,0,336,255);controls(true);
  $('animation-preview-status').textContent='미리보기를 불러오는 중…';
  try {
   const response=await fetch(descriptor.url,{cache:'force-cache'});
   if(!response.ok)throw Error();
   const bytes=new Uint8Array(await response.arrayBuffer());
   if(bytes.length>8388608)throw Error();
   if(!descriptor.bundled){
    if(bytes.length!==descriptor.bytes)throw Error();
    const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('');
    if(hash!==descriptor.sha256)throw Error();
   }
   const value=JSON.parse(new TextDecoder().decode(bytes));
   if(value.schemaVersion!==1||value.stages?.length!==7||value.id!==descriptor.id||value.name!==descriptor.name)throw Error();
   const decoded={};
   for(const [id,a] of Object.entries(value.assets))if(a.mime==='image/png'){
    const image=new Image();image.src='data:image/png;base64,'+a.base64;await image.decode();decoded[id]=image;
   }
   if(ticket!==previewTicket)return;
   images=decoded;pack=value;
   $('animation-caption').textContent=value.caption;
   $('animation-preview-status').textContent=readyMessage;
   draw(0,0,1);controls();
   if(autoplayRequested)void playAll();
  }catch{if(ticket===previewTicket){pack=null;requestedKey=null;controls();$('animation-preview-status').textContent='미리보기를 불러오지 못했습니다. 파일과 연결 상태를 확인한 뒤 ‘미리보기 다시 시작’을 눌러 주세요.';}}
 }
 function draw(from,to,t){
  const canvas=$('animation-canvas'),ctx=canvas.getContext('2d');ctx.clearRect(0,0,336,255);
  const mix=(a,b)=>a+(b-a)*t;
  pack.stages[to].parts.forEach((b,i)=>{
   const a=pack.stages[from].parts[i],w=mix(a.width,b.width),h=mix(a.height,b.height);
   const layer=document.createElement('canvas');layer.width=Math.ceil(w*3);layer.height=Math.ceil(h*3);
   const l=layer.getContext('2d');l.scale(3,3);
   if(a.asset){l.globalAlpha=1-t;l.drawImage(images[a.asset],0,0,w,h);}
   l.globalCompositeOperation='lighter';
   if(b.asset){l.globalAlpha=t;l.drawImage(images[b.asset],0,0,w,h);}
   ctx.save();ctx.translate(mix(a.x,b.x),mix(a.y,b.y));ctx.rotate(mix(a.rotation,b.rotation)*Math.PI/180);ctx.scale(mix(a.scale,b.scale),mix(a.scale,b.scale));ctx.translate(mix(a.offsetX,b.offsetX),mix(a.offsetY,b.offsetY));ctx.globalAlpha=mix(a.opacity,b.opacity);ctx.drawImage(layer,0,0,w,h);ctx.restore();
  });
 }
 // Cubic bezier matches Flutter/Figma easeIn/easeOut, including the x mapping.
 function ease(x,curve){if(curve==='linear')return x;const p=curve==='easeIn'?[.42,0,1,1]:[0,0,.58,1];const b=(t,a,c)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*c+t*t*t;let lo=0,hi=1;for(let i=0;i<16;i++){const t=(lo+hi)/2;if(b(t,p[0],p[2])<x)lo=t;else hi=t;}return b((lo+hi)/2,p[1],p[3]);}
 async function animate(from,to,ticket){
  const s=pack.stages[to];if(s.delayMs)await new Promise(r=>setTimeout(r,s.delayMs));
  if(ticket!==previewTicket)return;
  await new Promise(resolve=>{let start;function frame(now){if(ticket!==previewTicket){resolve();return;}start??=now;const t=Math.min(1,(now-start)/s.durationMs);draw(from,to,ease(t,s.curve));if(t<1)requestAnimationFrame(frame);else resolve();}requestAnimationFrame(frame);});
 }
 async function advance(){
  if(!pack||step===2)return;
  if(playing){if(step===0)queuedTap=true;return;}
  playing=true;const ticket=previewTicket;controls();
  try{
   do{
    for(const index of step===0?[1,2,3]:[4,5,6]){await animate(index-1,index,ticket);if(ticket!==previewTicket)return;}
    step++;$('animation-preview-status').textContent=step===1?'한 번 더 눌러 보세요.':'미리보기 완료 · 앱에서는 운세와 광고·구매 버튼으로 이어집니다.';
   }while(step===1&&queuedTap);
  }finally{if(ticket===previewTicket){playing=false;queuedTap=false;controls();}}
 }
 function reset(){clearTimeout(demoTimer);demoTimer=null;previewTicket++;step=0;playing=false;queuedTap=false;autoplayRequested=false;if(pack){draw(0,0,1);$('animation-preview-status').textContent=readyMessage;}controls();}
 async function playAll(){if(!pack)return;if(playing){if(step===0)queuedTap=true;return;}reset();queuedTap=true;await advance();}
 $('animation-play').onclick=()=>{void advance();};
 $('animation-play-all').onclick=()=>{void playAll();};
 $('animation-replay').onclick=()=>{if(pack)reset();else void preview(previewDescriptor??selection());};
 for(const button of document.querySelectorAll('[data-animation-demo]'))button.onclick=()=>{
  clearTimeout(demoTimer);const current=generation;
  // Let a double-click finish before moving its target out of the viewport.
  demoTimer=setTimeout(()=>{demoTimer=null;if(current!==generation||$('fortune').hidden)return;$('animation-preview').hidden=false;$('animation-canvas').scrollIntoView({block:'center'});void preview(bundled(button.dataset.animationDemo),{autoplay:true});},300);
 };
 $('animation-source').onchange=()=>{
  if($('animation-source').value==='bundled'){stage(null);options();void preview(selection());}
  else{$('animation-uploaded-fields').hidden=false;$('animation-package').required=true;$('animation-package').focus();}
 };
 $('animation-package').onchange=()=>{const p=packages.find(p=>p.sha256===$('animation-package').value);if(!p)return;stage(p);options();void preview(p);};
 $('animation-upload').onchange=async()=>{
  const file=$('animation-upload').files[0];if(!file)return;
  if(uploading)return;uploading=true;
  const current=generation;
  $('animation-upload').disabled=true;$('animation-upload-status').textContent='파일을 확인하는 중…';
  try{
   if(file.size>8388608||!file.name.endsWith('.json'))throw Error('8MB 이하의 애니메이션 JSON 패키지를 선택하세요.');
   const value=JSON.parse(await file.text());
   $('animation-upload-status').textContent='검사하고 업로드하는 중…';
   const {data,error}=await getClient().functions.invoke('admin-animation',{method:'POST',body:{package:value}});
   if(current!==generation)return;
   if(error||!data?.package)throw Error(error?.context?.status===400?'지원하지 않거나 손상된 애니메이션 패키지입니다.':'업로드하지 못했습니다. 연결 상태와 관리자 로그인을 확인하세요.');
   const p=data.package;packages=[p,...packages.filter(x=>x.sha256!==p.sha256)];stage(p);options();void preview(p);
   $('animation-upload-status').textContent='업로드 완료 · 아직 앱에 공개되지 않았습니다. 확인 후 임시 저장 또는 앱에 공개를 눌러 주세요.';
  }catch(error){if(current===generation){$('animation-upload-status').textContent=error instanceof SyntaxError?'JSON 파일을 읽을 수 없습니다.':error.message;}}
  finally{if(current===generation){uploading=false;$('animation-upload').disabled=false;$('animation-upload').value='';}}
 };
 return {
  isBusy(){return uploading;},
  render(published){options();const d=getDraft()?.fortuneAnimation;if(d&&published?.sha256===d.sha256)$('animation-upload-status').textContent='현재 앱에 공개된 애니메이션입니다.';if(!$('fortune').hidden)void preview(selection());},
  async load(){const current=generation;void preview(selection());try{const {data,error}=await getClient().functions.invoke('admin-animation',{method:'GET'});if(current!==generation)return;if(error)throw Error('업로드 목록을 불러오지 못했습니다.');packages=data.packages;options();}catch(e){if(current===generation)onError(e.message);}},
  clear(){clearTimeout(demoTimer);demoTimer=null;generation++;previewTicket++;packages=[];pack=null;requestedKey=null;previewDescriptor=null;images={};step=0;playing=false;queuedTap=false;autoplayRequested=false;uploading=false;$('animation-source').value='bundled';$('animation-package').required=false;$('animation-upload').value='';$('animation-upload').disabled=false;$('animation-upload-status').textContent='';$('animation-preview-status').textContent='';$('animation-caption').textContent='';$('animation-canvas').getContext('2d').clearRect(0,0,336,255);controls();$('animation-preview').hidden=true;},
 };
}
