// Typography metadata only. Text remains authoritative; no HTML or remote fonts.
const fonts = new Set(['pretendard', 'munmak']);
export const defaultLegalPresentation = Object.freeze({font:'pretendard', fontSize:15.5, lineHeight:1.4, letterSpacing:-0.42});
const bounded = (v,min,max) => typeof v === 'number' && Number.isFinite(v) && v >= min && v <= max;
function merge(runs) {
  const result=[];
  for(const r of runs){if(!r.text)continue;const last=result.at(-1);if(last?.font===r.font&&last?.fontSize===r.fontSize)last.text+=r.text;else result.push({text:r.text,font:r.font,fontSize:r.fontSize});}
  return result;
}
export function normalizePresentation(body,p) {
  const valid=p&&fonts.has(p.font)&&bounded(p.fontSize,10,32)&&bounded(p.lineHeight,1.2,2.4)&&bounded(p.letterSpacing,-1,3);
  const base=valid?{font:p.font,fontSize:p.fontSize,lineHeight:p.lineHeight,letterSpacing:p.letterSpacing}:{...defaultLegalPresentation};
  const runs=valid&&Array.isArray(p.runs)&&p.runs.length<=128&&p.runs.every(r=>r&&typeof r.text==='string'&&fonts.has(r.font)&&bounded(r.fontSize,10,32))&&p.runs.map(r=>r.text).join('')===body?p.runs:[{text:body,font:base.font,fontSize:base.fontSize}];
  return {...base,runs:merge(runs)};
}
function units(body,p){return normalizePresentation(body,p).runs.flatMap(r=>r.text.split('').map(text=>({...r,text})));}
function bounds(text){return new Set([0,text.length,...[...new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(text)].map(p=>p.index)]);}
export function applyLegalStyle(body,p,start,end,patch) {
  if(patch.font!==undefined&&!fonts.has(patch.font)||patch.fontSize!==undefined&&!bounded(patch.fontSize,10,32))throw Error('지원하지 않는 서식입니다.');
  const base=normalizePresentation(body,p);if(start===end)return base;
  for(const part of new Intl.Segmenter('ko',{granularity:'grapheme'}).segment(body)){
    const tail=part.index+part.segment.length;if(start>part.index&&start<tail)start=part.index;if(end>part.index&&end<tail)end=tail;
  }
  return {...base,runs:merge(units(body,base).map((v,i)=>i>=start&&i<end?{...v,...patch}:v))};
}
export function editPresentation(previous,p,next) {
  const base=normalizePresentation(previous,p);let prefix=0,suffix=0;
  while(prefix<previous.length&&prefix<next.length&&previous[prefix]===next[prefix])prefix++;
  while(suffix<previous.length-prefix&&suffix<next.length-prefix&&previous.at(-1-suffix)===next.at(-1-suffix))suffix++;
  const before=bounds(previous),after=bounds(next);
  while(prefix>0&&(!before.has(prefix)||!after.has(prefix)))prefix--;
  while(suffix>0&&(!before.has(previous.length-suffix)||!after.has(next.length-suffix)))suffix--;
  const old=units(previous,base);
  return {...base,runs:merge([...old.slice(0,prefix),...next.slice(prefix,next.length-suffix).split('').map(text=>({text,font:base.font,fontSize:base.fontSize})),...(suffix?old.slice(-suffix):[])])};
}
export function trimPresentation(body,p) {
  const base=normalizePresentation(body,p),start=body.length-body.trimStart().length,end=body.trimEnd().length;
  return {...base,runs:merge(units(body,base).slice(start,end))};
}
export function createLegalEditor(changed) {
  const $=id=>document.getElementById(id),field=$('legal-body'),preview=$('legal-preview');
  const controls={font:$('legal-font'),fontSize:$('legal-font-size'),lineHeight:$('legal-line-height'),letterSpacing:$('legal-letter-spacing')};
  let body='',p=normalizePresentation('',null);
  function render(){
    preview.style.lineHeight=p.lineHeight;preview.style.letterSpacing=p.letterSpacing+'px';
    preview.replaceChildren(...p.runs.map(r=>{const span=document.createElement('span');span.className='notice-font-'+r.font;span.style.fontSize=r.fontSize+'px';span.textContent=r.text;return span;}));
    selection();
  }
  function selection(){const selected=field.selectionStart!==field.selectionEnd;$('legal-apply-selection').disabled=!selected;$('legal-selection-hint').textContent=selected?'선택한 본문에 글꼴·크기를 적용할 수 있습니다.':'본문에서 문구를 선택하면 해당 부분의 글꼴·크기를 바꿀 수 있습니다.';}
  function sync(){if(body!==field.value){p=editPresentation(body,p,field.value);body=field.value;render();}}
  field.addEventListener('input',sync);
  for(const event of ['select','keyup','click'])field.addEventListener(event,selection);
  for(const [key,control] of Object.entries(controls))control.addEventListener('change',()=>{
    if(!control.reportValidity())return;
    const value=key==='font'?control.value:Number(control.value);p={...p,[key]:value};
    if(key==='font'||key==='fontSize')p.runs=merge(p.runs.map(r=>({...r,[key]:value})));
    render();changed();
  });
  $('legal-apply-selection').addEventListener('mousedown',e=>e.preventDefault());
  $('legal-apply-selection').onclick=()=>{
    const start=field.selectionStart,end=field.selectionEnd;if(start===end||!$('legal-selection-size').reportValidity())return;
    p=applyLegalStyle(body,p,start,end,{font:$('legal-selection-font').value,fontSize:Number($('legal-selection-size').value)});render();changed();field.focus();field.setSelectionRange(start,end);selection();
  };
  return {
    load(item){body=item?.body??'';p=normalizePresentation(body,item?.presentation);field.value=body;for(const [key,control] of Object.entries(controls))control.value=p[key];$('legal-selection-font').value=p.font;$('legal-selection-size').value=p.fontSize;render();},
    sync,
    value(trim=true){sync();const presentation=trim?trimPresentation(body,p):normalizePresentation(body,p);if(presentation.runs.length>128)throw Error('선택 서식은 최대 128개 구간까지 저장할 수 있습니다. 전체 글꼴·크기로 정리해 주세요.');return presentation;},
  };
}
