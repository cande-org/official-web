const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
export function pageNumbers(page,pages){
 const values=new Set([1,pages]);const start=Math.max(1,Math.min(page-2,pages-4));for(let n=start;n<=Math.min(pages,start+4);n++)values.add(n);
 const out=[];for(const n of [...values].sort((a,b)=>a-b)){if(out.length&&n-out.at(-1)>1)out.push('…');out.push(n);}return out;
}
export function pageControls(host,{page,pages,onChange,busy=false}){
 pages=Math.max(1,pages);page=Math.max(1,Math.min(page,pages));host.replaceChildren();host.classList.add('page-controls');host.dataset.page=page;host.dataset.pages=pages;host.setAttribute('role','group');host.setAttribute('aria-label','페이지 이동');
 const summary=el('span',`${page} / ${pages}`);summary.className='sr-only';host.append(summary);
 const go=value=>{if(!busy&&Number.isInteger(value)&&value>=1&&value<=pages&&value!==page)onChange(value);};
 const button=(text,run)=>{const b=el('button',text);b.type='button';b.disabled=busy;b.onclick=run;return b;};
 const numbers=el('span');numbers.className='page-numbers';for(const value of pageNumbers(page,pages)){if(value==='…'){const gap=el('span',value);gap.className='page-gap';gap.setAttribute('aria-hidden','true');numbers.append(gap);}else{const b=button(String(value),()=>go(value));b.setAttribute('aria-label',`${value}페이지`);if(value===page)b.setAttribute('aria-current','page');numbers.append(b);}}host.append(numbers);
 const jump=el('span');jump.className='page-jump';const label=el('label','페이지'),input=el('input');input.type='text';input.value=String(page);input.inputMode='numeric';input.setAttribute('aria-label',`이동할 페이지 (1–${pages})`);input.disabled=busy;
 const error=el('span');error.className='page-jump-error';error.setAttribute('role','status');
 const submit=()=>{const value=Number(input.value);if(!/^\d+$/.test(input.value.trim())||!Number.isInteger(value)||value<1||value>pages){input.setAttribute('aria-invalid','true');error.textContent=`1–${pages} 사이의 페이지를 입력해 주세요.`;input.focus();return;}input.removeAttribute('aria-invalid');error.textContent='';go(value);};
 input.oninput=()=>{input.removeAttribute('aria-invalid');error.textContent='';};input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();e.stopPropagation();submit();}};label.append(input);jump.append(label,el('span',`/ ${pages}`),button('이동',submit),error);host.append(jump);
}
export function renderPager(prefix,{page,total,size,onChange,busy=false}){
 const host=document.getElementById(prefix+'-page');const pages=Math.max(1,Math.ceil(total/size));pageControls(host,{page,pages,onChange,busy});
 const prev=document.getElementById(prefix+'-prev'),next=document.getElementById(prefix+'-next');prev.disabled=busy||page<=1;next.disabled=busy||page>=pages;prev.onclick=()=>onChange(page-1);next.onclick=()=>onChange(page+1);
}
export function setPagerBusy(prefix,busy=true){for(const n of document.querySelectorAll(`#${prefix}-page button,#${prefix}-page input,#${prefix}-prev,#${prefix}-next`))n.disabled=busy;}
export function clearPager(prefix){document.getElementById(prefix+'-page').replaceChildren();setPagerBusy(prefix);}
// Small in-memory collections use the same controls without fetching every server record.
export function localPages(root,items,render,{size=20,label='목록'}={}){
 let page=1;const body=el('div'),pager=el('div');pager.className='pagination';pager.setAttribute('aria-label',label+' 페이지 이동');const count=el('span');count.className='page-count';const prev=el('button','이전'),host=el('span'),next=el('button','다음');prev.type=next.type='button';pager.append(count,prev,host,next);root.replaceChildren(body,pager);
 const draw=()=>{const pages=Math.max(1,Math.ceil(items.length/size));page=Math.min(page,pages);render(body,items.slice((page-1)*size,page*size));count.textContent=`총 ${items.length}개`;const change=n=>{page=n;draw();};pageControls(host,{page,pages,onChange:change});prev.disabled=page<=1;next.disabled=page>=pages;prev.onclick=()=>change(page-1);next.onclick=()=>change(page+1);};draw();
}
