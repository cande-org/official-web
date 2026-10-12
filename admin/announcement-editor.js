// Only plain text and two bundled fonts. Never accept or render HTML.
const fonts = new Set(['pretendard', 'munmak']);
export function normalizeRuns(body, runs) {
  if (!Array.isArray(runs) || runs.some(r => !r || typeof r.text !== 'string' || !fonts.has(r.font)) || runs.map(r => r.text).join('') !== body) return body ? [{text:body,font:'pretendard'}] : [];
  const result=[];
  for(const r of runs){if(!r.text)continue;const last=result.at(-1);if(last?.font===r.font)last.text+=r.text;else result.push({...r});}
  return result;
}
function units(body,runs){return normalizeRuns(body,runs).flatMap(r=>r.text.split('').map(text=>({text,font:r.font})));}
function fromUnits(values){return normalizeRuns(values.map(v=>v.text).join(''),values);}
export function applyFont(body,runs,start,end,font){
  if(!fonts.has(font)||start===end)return normalizeRuns(body,runs);
  // Expand to whole graphemes so emoji/combining characters never split across fonts.
  for(const part of new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(body)){
    const tail=part.index+part.segment.length;
    if(start>part.index&&start<tail)start=part.index;
    if(end>part.index&&end<tail)end=tail;
  }
  return fromUnits(units(body,runs).map((v,i)=>i>=start&&i<end?{...v,font}:v));
}
export function editRuns(previous,runs,next){
  let prefix=0,suffix=0;
  while(prefix<previous.length&&prefix<next.length&&previous[prefix]===next[prefix])prefix++;
  while(suffix<previous.length-prefix&&suffix<next.length-prefix&&previous[previous.length-1-suffix]===next[next.length-1-suffix])suffix++;
  const boundaries=text=>new Set([0,text.length,...[...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text)].map(p=>p.index)]);
  const before=boundaries(previous),after=boundaries(next);
  while(prefix>0&&(!before.has(prefix)||!after.has(prefix)))prefix--;
  while(suffix>0&&(!before.has(previous.length-suffix)||!after.has(next.length-suffix)))suffix--;
  // Plain newly typed text, with unedited highlights retained on either side.
  const old=units(previous,runs);
  return fromUnits([...old.slice(0,prefix),...next.slice(prefix,next.length-suffix).split('').map(text=>({text,font:'pretendard'})),...(suffix?old.slice(-suffix):[])]);
}
export function trimmedRuns(body,runs){const start=body.length-body.trimStart().length,end=body.trimEnd().length;return fromUnits(units(body,runs).slice(start,end));}
export function createAnnouncementEditor(changed){
  const field=document.getElementById('announcement-body'),preview=document.getElementById('announcement-body-preview'),hint=document.getElementById('announcement-font-hint');
  const buttons=[...document.querySelectorAll('[data-announcement-font]')];let body='',runs=[];
  function render(){preview.replaceChildren(...runs.map(r=>{const span=document.createElement('span');span.className='notice-font-'+r.font;span.textContent=r.text;return span;}));}
  function selection(){const selected=field.selectionStart!==field.selectionEnd;for(const b of buttons)b.disabled=!selected;hint.textContent=selected?'선택한 문구에 적용할 글꼴을 누르세요.':'본문에서 문구를 드래그해 선택한 뒤 글꼴을 적용하세요.';}
  field.addEventListener('input',()=>{runs=editRuns(body,runs,field.value);body=field.value;render();selection();});
  for(const event of ['select','keyup','click'])field.addEventListener(event,selection);
  for(const button of buttons){button.addEventListener('mousedown',e=>e.preventDefault());button.addEventListener('click',()=>{
    const start=field.selectionStart,end=field.selectionEnd;if(start===end)return;
    runs=applyFont(body,runs,start,end,button.dataset.announcementFont);render();changed();field.focus();field.setSelectionRange(start,end);selection();
  });}
  return {load(item){body=item?.body??'';runs=normalizeRuns(body,item?.body_runs);field.value=body;render();selection();},value(){return {body:body.trim(),bodyRuns:trimmedRuns(body,runs)};}};
}
