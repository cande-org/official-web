import {renderPager,clearPager} from './pagination.js';
const $=id=>document.getElementById(id);
const kinds={person:'인물·아이돌',group:'그룹',term:'줄임말·용어',event:'사건·활동'};
const el=(tag,text)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;return n;};
export const splitKnowledgeLines=value=>[...new Set(value.split('\n').map(s=>s.trim()).filter(Boolean))];
export function createChatKnowledge(getClient,onDetail=()=>{}){
 let rows=[],entry=null,dirty=false,busy=false,generation=0,page=1,search='',kind='all';
 const status=(message,error=false)=>{const n=$('knowledge-status');n.textContent=message;n.classList.toggle('error',error);};
 const editStatus=(message,error=false)=>{const n=$('knowledge-edit-status');n.textContent=message;n.classList.toggle('error',error);};
 async function request(body){
  const {data,error}=await getClient().functions.invoke('admin-chat-knowledge',{method:'POST',body});
  if(error)throw Error(error.context?.status===409?'다른 관리자가 변경했거나 삭제했습니다. 입력을 복사한 뒤 새로고침해 주세요.':error.context?.status===403?'관리자 권한이 필요합니다.':error.context?.status===400?'입력 형식과 길이를 확인해 주세요.':'사전을 처리하지 못했습니다. 다시 시도해 주세요.');
  return data;
 }
 function controls(){
  $('knowledge-save').disabled=busy;$('knowledge-delete').disabled=busy||!entry?.id;
  $('knowledge-refresh').disabled=busy;$('knowledge-add').disabled=busy;
 }
 function render(data){
  rows=data.items;page=data.page;
  const table=el('table'),thead=el('thead'),head=el('tr');
  for(const name of ['이름·표현','구분','별칭·줄임말','사용 상태','수정 시각'])head.append(el('th',name));
  thead.append(head);const body=el('tbody');
  for(const item of rows){
   const row=el('tr'),name=el('td'),button=el('button',item.canonical_name);button.type='button';button.className='table-link';
   button.onclick=()=>void openDetail(item.id);name.append(button);
   row.append(name,el('td',kinds[item.kind]),el('td',item.aliases.join(', ')||'—'),el('td',item.enabled?'사용':'비활성'),el('td',new Date(item.updated_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})));body.append(row);
  }
  table.append(thead,body);$('knowledge-list').replaceChildren(data.total?table:el('p','등록된 항목이 없습니다.'));
  $('knowledge-count').textContent=`총 ${data.total}개`;
  renderPager('knowledge',{page,total:data.total,size:data.pageSize,onChange:n=>void load(n),busy:false});
  $('knowledge-history').replaceChildren(...data.history.map(h=>el('p',`${new Date(h.recorded_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})} · ${{create:'추가',update:'수정',delete:'삭제'}[h.action]}`)));
 }
 async function load(next=page){
  const ticket=++generation;busy=true;controls();status('사전을 불러오는 중…');
  try{const data=await request({action:'list',page:next,search,kind});if(ticket!==generation)return false;render(data);status('');return true;}
  catch(e){if(ticket===generation){$('knowledge-list').replaceChildren();clearPager('knowledge');status(e.message,true);}return false;}
  finally{if(ticket===generation){busy=false;controls();}}
 }
 function fill(item){
  entry=item;
  for(const key of ['canonical_name','summary','role_style'])$('knowledge-'+key).value=item?.[key]??'';
  for(const key of ['aliases','context_terms','source_urls'])$('knowledge-'+key).value=(item?.[key]??[]).join('\n');
  $('knowledge-entry-kind').value=item?.kind??'person';$('knowledge-enabled').checked=item?.enabled??true;
  $('knowledge-edit-title').textContent=item?.id?'사전 항목 수정':'사전 항목 추가';
  $('knowledge-edit-version').textContent=item?.id?`v${item.revision} · 확인 ${new Date(item.verified_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}`:'';
  dirty=false;editStatus('');controls();
 }
 async function openDetail(id){
  if(busy)return false;
  const ticket=generation;
  try{
   let item=null;
   if(id!=='new'){busy=true;controls();item=(await request({action:'get',id,revision:0})).item;if(ticket!==generation)return false;if(!item){status('항목이 없거나 삭제되었습니다.',true);return false;}}
   fill(item);if(!$('knowledge-dialog').open)$('knowledge-dialog').showModal();onDetail(id);return true;
  }catch(e){if(ticket===generation)status(e.message,true);return false;}
  finally{if(ticket===generation){busy=false;controls();}}
 }
 function closeDetail(){if($('knowledge-dialog').open)$('knowledge-dialog').close();entry=null;dirty=false;}
 $('knowledge-form').oninput=()=>{dirty=true;};
 $('knowledge-form').onsubmit=async event=>{
  event.preventDefault();if(busy||!$('knowledge-form').reportValidity())return;
  const value={kind:$('knowledge-entry-kind').value,enabled:$('knowledge-enabled').checked};
  for(const key of ['canonical_name','summary','role_style'])value[key]=$('knowledge-'+key).value.trim();
  for(const key of ['aliases','context_terms','source_urls'])value[key]=splitKnowledgeLines($('knowledge-'+key).value);
  if(value.aliases.length>20||value.context_terms.length>10||value.source_urls.length>4){editStatus('별칭은 20개, 맥락 키워드는 10개, 출처는 4개까지 입력해 주세요.',true);return;}
  const ticket=generation;busy=true;controls();editStatus('저장 중…');
  try{const data=await request({action:'save',id:entry?.id??null,revision:entry?.revision??0,entry:value});if(ticket!==generation)return;fill(data.saved);onDetail(data.saved.id);editStatus('저장했습니다. 다음 대화부터 참고합니다.');busy=false;await load(page);}
  catch(e){if(ticket===generation)editStatus(e.message,true);}
  finally{busy=false;controls();}
 };
 $('knowledge-delete').onclick=async()=>{
  if(busy||!entry?.id||!confirm(`“${entry.canonical_name}” 항목을 삭제할까요? 이후 대화의 공통 사전에서 제외됩니다.`))return;
  const ticket=generation;busy=true;controls();
  try{await request({action:'delete',id:entry.id,revision:entry.revision});if(ticket!==generation)return;closeDetail();busy=false;await load(1);}
  catch(e){if(ticket===generation)editStatus(e.message,true);}
  finally{busy=false;controls();}
 };
 const tryClose=()=>{if(busy)return;if(!dirty||confirm('저장하지 않은 편집 내용을 버리고 닫을까요?'))closeDetail();};
 $('knowledge-close').onclick=tryClose;$('knowledge-dialog').oncancel=e=>{e.preventDefault();tryClose();};
 $('knowledge-add').onclick=()=>void openDetail('new');
 $('knowledge-refresh').onclick=()=>void load(page);
 $('knowledge-filters').onsubmit=e=>{e.preventDefault();search=$('knowledge-search').value.trim();kind=$('knowledge-kind').value;void load(1);};
 return {load,openDetail,closeDetail,isBusy:()=>busy,hasUnsaved:()=>dirty,
  clear(){generation++;closeDetail();rows=[];page=1;search='';kind='all';$('knowledge-search').value='';$('knowledge-kind').value='all';busy=false;$('knowledge-list').replaceChildren();$('knowledge-history').replaceChildren();$('knowledge-count').textContent='';clearPager('knowledge');status('');controls();}};
}
