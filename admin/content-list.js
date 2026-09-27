// Paginated collection views with isolated item edits. Only onSave persists data.
export function createContentLists({ getSnapshot, onSave, onStage, onError }) {
  const $ = id => document.getElementById(id);
  const el = (tag,text,cls) => { const n=document.createElement(tag); if(text!=null)n.textContent=text;if(cls)n.className=cls;return n; };
  const button = (text,run,cls) => {const b=el('button',text,cls);b.type='button';b.onclick=run;return b;};
  const views={products:{page:1,size:20,query:'',filter:'all'},faqs:{page:1,size:20,query:'',filter:'all'}};
  let edit=null, saving=false, epoch=0;
  const dialog=$('item-dialog');
  const titleOf=(kind,item)=>kind==='products'?item.title:item.question;
  const keyOf=(kind,item)=>kind==='products'?item.key:item.id;
  const listOf=kind=>getSnapshot().draft[kind];
  function toolbar(kind) {
    const target=$(kind==='products'?'product-tools':'faq-tools'),view=views[kind];
    const search=el('input');search.type='search';search.placeholder=kind==='products'?'상품 이름·소개 검색':'질문·답변 검색';search.setAttribute('aria-label',search.placeholder);
    search.oninput=()=>{view.query=search.value;view.page=1;renderList(kind);};
    const filter=el('select');filter.setAttribute('aria-label',`${kind==='products'?'상품':'FAQ'} 노출 상태`);
    for(const [value,text] of [['all','전체 상태'],['visible','노출 중'],['hidden','숨김']]){const o=el('option',text);o.value=value;filter.append(o);}
    filter.onchange=()=>{view.filter=filter.value;view.page=1;renderList(kind);};target.append(search,filter);
  }
  function renderList(kind) {
    const view=views[kind],list=listOf(kind),query=view.query.trim().toLocaleLowerCase('ko-KR');
    const items=list.map((item,index)=>({item,index})).filter(({item})=>(view.filter==='all'||item.enabled===(view.filter==='visible'))&&(!query||`${titleOf(kind,item)} ${kind==='products'?item.description:item.answer}`.toLocaleLowerCase('ko-KR').includes(query)));
    const pages=Math.max(1,Math.ceil(items.length/view.size));view.page=Math.min(view.page,pages);
    const root=$(kind==='products'?'product-list':'faq-list');root.replaceChildren();
    const scroll=el('div',null,'collection-scroll');scroll.tabIndex=0;scroll.setAttribute('aria-label',kind==='products'?'상품 목록':'FAQ 목록');
    const table=el('table',null,'collection-table'),head=el('thead'),tr=el('tr'),body=el('tbody');
    for(const label of ['순서',kind==='products'?'상품':'질문','상태',...(kind==='products'?['참고 가격']:[]),'관리']){const th=el('th',label);th.scope='col';tr.append(th);}head.append(tr);table.append(head,body);
    for(const {item,index} of items.slice((view.page-1)*view.size,view.page*view.size)){
      const row=el('tr');row.dataset.key=keyOf(kind,item);row.append(el('td',String(index+1),'order-cell'));
      const name=el('td',null,'name-cell'),open=button(titleOf(kind,item),()=>openItem(kind,keyOf(kind,item)),'row-title');
      const summary=el('p',kind==='products'?item.description:item.answer,'row-summary');name.append(open,summary);row.append(name);
      const state=el('td');state.append(el('span',item.enabled?'노출 중':'숨김',`content-state ${item.enabled?'visible':'hidden-state'}`));row.append(state);
      if(kind==='products')row.append(el('td',`${Number(item.referencePriceKrw).toLocaleString('ko-KR')}원`,'price-cell'));
      const actions=el('td',null,'row-actions');const detail=button('상세',()=>openItem(kind,keyOf(kind,item)));detail.setAttribute('aria-label',`${titleOf(kind,item)} 상세`);actions.append(detail);
      for(const [text,delta] of [['위로',-1],['아래로',1]]){const b=button(text,()=>{const next=structuredClone(getSnapshot().draft);[next[kind][index],next[kind][index+delta]]=[next[kind][index+delta],next[kind][index]];onStage(next);renderList(kind);});b.disabled=index+delta<0||index+delta>=list.length;b.setAttribute('aria-label',`${titleOf(kind,item)} ${text}`);actions.append(b);}row.append(actions);
      row.onclick=e=>{if(!e.target.closest('button,a,input,select'))openItem(kind,keyOf(kind,item));};body.append(row);
    }
    if(!items.length){const row=el('tr'),cell=el('td',list.length?'검색 조건에 맞는 항목이 없습니다.':'등록된 FAQ가 없습니다. 질문을 추가해 주세요.','empty-list');cell.colSpan=kind==='products'?5:4;row.append(cell);body.append(row);}
    scroll.append(table);root.append(scroll);
    const pager=el('div',null,'pagination');const count=el('span',items.length?`${(view.page-1)*view.size+1}–${Math.min(view.page*view.size,items.length)} / ${items.length}개`:'0개','page-count');count.setAttribute('role','status');pager.append(count);
    const size=el('select');size.setAttribute('aria-label',`${kind==='products'?'상품':'FAQ'} 페이지당 항목 수`);for(const n of [5,10,20]){const o=el('option',`${n}개씩`);o.value=String(n);size.append(o);}size.value=String(view.size);size.onchange=()=>{view.size=Number(size.value);view.page=1;renderList(kind);};pager.append(size);
    const prev=button('이전',()=>{view.page--;renderList(kind);}),next=button('다음',()=>{view.page++;renderList(kind);});prev.disabled=view.page===1;next.disabled=view.page===pages;pager.append(prev,el('span',`${view.page} / ${pages}`,'page-current'),next);root.append(pager);
  }
  function field(label,value,{name,type='text',maxLength,min,max}={}){
    const wrap=el('label',label),input=el(type==='textarea'?'textarea':'input');if(type!=='textarea')input.type=type;else input.rows=type==='textarea'&&name==='answer'?7:3;
    input.name=name;input.value=value;input.required=true;if(maxLength)input.maxLength=maxLength;if(min!=null)input.min=min;if(max!=null)input.max=max;if(type==='number')input.step='1';wrap.append(input);return wrap;
  }
  function openItem(kind,key=null){
    if(saving)return;
    const list=listOf(kind),index=key==null?-1:list.findIndex(item=>keyOf(kind,item)===key);
    if(key!=null&&index<0)return;
    if(index<0&&list.length>=50){onError('질문은 최대 50개까지 등록할 수 있습니다.');return;}
    const item=index<0?{id:crypto.randomUUID(),question:'',answer:'',enabled:true,action:'none'}:structuredClone(list[index]);
    edit={kind,key,item,index,new:index<0,changed:false,opener:document.activeElement};
    $('item-title').textContent=index<0?'질문 추가':kind==='products'?'상품 상세':'FAQ 상세';
    $('item-error').textContent='';$('item-delete').hidden=kind==='products'||index<0;
    $('item-fields').replaceChildren();$('item-contract').hidden=kind!=='products';
    if(kind==='products'){
      const c=getSnapshot().contracts.find(c=>c.key===item.key);$('item-contract').textContent=`${c.id} · ${c.subscription?'매월':'구매당'} ${c.credits}회 지급 · 결제 계약은 유지됩니다.`;
      $('item-fields').append(field('상품 이름',item.title,{name:'title',maxLength:40}),field('참고 가격 (원)',item.referencePriceKrw,{name:'referencePriceKrw',type:'number',min:1,max:1000000}),field('상품 소개',item.description,{name:'description',type:'textarea',maxLength:160}));
    }else{
      $('item-fields').append(field('질문',item.question,{name:'question',maxLength:160}),field('답변',item.answer,{name:'answer',type:'textarea',maxLength:3000}));
      const label=el('label','답변 아래 연결'),select=el('select');select.name='action';for(const [value,text]of[['none','없음'],['passes','내 이용권 이동하기']]){const o=el('option',text);o.value=value;select.append(o);}select.value=item.action;label.append(select);$('item-fields').append(label);
    }
    $('item-fields').append(field('노출 순서',index<0?list.length+1:index+1,{name:'position',type:'number',min:1,max:list.length+(index<0?1:0)}));
    const check=el('label',null,'check'),input=el('input');input.type='checkbox';input.name='enabled';input.checked=item.enabled;check.append(input,document.createTextNode('앱에 노출'));$('item-fields').append(check);
    dialog.showModal();dialog.scrollTop=0;$('item-fields').querySelector('input,textarea').focus();
  }
  function close(force=false){
    if(!force&&(saving||(edit?.changed&&!confirm('저장하지 않은 수정을 버리고 닫을까요?'))))return;
    const opener=edit?.opener;dialog.close();edit=null;$('item-fields').replaceChildren();$('item-error').textContent='';
    if(opener?.isConnected)opener.focus();else $('page-title').focus({preventScroll:true});
  }
  async function persist(remove=false){
    if(!edit||saving)return;
    if(!remove){for(const input of $('item-fields').querySelectorAll('input[type=text],textarea'))input.setCustomValidity(input.value.trim()?'':'내용을 입력해 주세요.');if(!$('item-form').reportValidity())return;}
    if(remove&&!confirm('이 질문을 초안에서 삭제할까요? 앱에는 공개 후 반영됩니다.'))return;
    const current=edit,ticket=epoch,content=structuredClone(getSnapshot().draft),list=content[current.kind];
    const index=current.new?-1:list.findIndex(item=>keyOf(current.kind,item)===current.key);
    if(!current.new&&index<0){$('item-error').textContent='항목이 변경되었습니다. 목록을 다시 불러와 주세요.';return;}
    if(remove)list.splice(index,1);
    else{
      const data=new FormData($('item-form')),item={...current.item,enabled:data.has('enabled')};
      for(const name of current.kind==='products'?['title','description']:['question','answer','action'])item[name]=String(data.get(name)).trim();
      if(current.kind==='products')item.referencePriceKrw=Number(data.get('referencePriceKrw'));
      if(index>=0)list.splice(index,1);list.splice(Number(data.get('position'))-1,0,item);
    }
    saving=true;$('item-form').inert=true;$('item-error').textContent='';$('item-save').textContent='저장 중…';
    try{await onSave(content);if(ticket!==epoch)return;close(true);render();}
    catch(error){if(ticket===epoch)$('item-error').textContent=error.message;}
    finally{saving=false;$('item-form').inert=false;$('item-save').textContent='초안 저장';}
  }
  $('item-form').onsubmit=e=>{e.preventDefault();void persist();};
  $('item-form').oninput=e=>{if(edit)edit.changed=true;if(e.target.setCustomValidity)e.target.setCustomValidity('');};
  $('item-save').onclick=()=>{for(const input of $('item-fields').querySelectorAll('input[type=text],textarea'))input.setCustomValidity(input.value.trim()?'':'내용을 입력해 주세요.');};
  $('item-delete').onclick=()=>persist(true);$('item-cancel').onclick=()=>close();$('item-close').onclick=()=>close();dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  toolbar('products');toolbar('faqs');
  function render(){renderList('products');renderList('faqs');}
  return {render,hasUnsavedChanges:()=>Boolean(edit?.changed),addFaq:()=>openItem('faqs'),reset:()=>{epoch++;close(true);for(const kind of ['products','faqs'])views[kind].page=1;}};
}
