import {isRetained,ownerKey,ownerLabel,accountBadge} from './account-status.js';
import {renderPager,setPagerBusy,clearPager} from './pagination.js';
import {chatPeriod} from './chat-history.js';
const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const kinds=['payments','ads','friends'];
const personas={stable:'안정형',anxious:'불안형',avoidant:'회피형'};
const products={jb_lite_monthly:'Lite 월간',jb_plus_monthly:'Plus 월간',jb_messages_10:'대화권 10회',jb_messages_30:'대화권 30회',jb_messages_50:'대화권 50회',jb_messages_100:'대화권 100회',jb_messages_150:'대화권 150회'};
const events={INITIAL_PURCHASE:'구독 시작',RENEWAL:'구독 갱신',NON_RENEWING_PURCHASE:'대화권 구매'};
const time=v=>v?new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'—';
export const paymentAmount=item=>item.price!=null&&Number.isFinite(Number(item.price))?`${Number(item.price).toLocaleString('ko-KR',{maximumFractionDigits:2})} ${item.currency||'(통화 미기록)'}`:'금액 미기록';
export function operationPhotoUrl(value){try{const u=new URL(value);return u.protocol==='https:'&&u.hostname==='tzuxtejuscgyvgfmlijt.supabase.co'&&u.pathname.startsWith('/storage/v1/object/sign/mental-media/')?u.href:null;}catch{return null;}}
const preset=item=>`/assets/admin-friend-${Object.hasOwn(personas,item.persona)?item.persona:'stable'}.svg`;
export function createOperations(getClient,onDetail=()=>{}){
 let generation=0,detailTicket=0,active=null;
 const states=Object.fromEntries(kinds.map(k=>[k,{filters:null,cursors:[null],page:0,next:null,ticket:0}]));
 const button=(text,run,cls)=>{const b=el('button',text,cls);b.type='button';b.onclick=run;return b;};
 const status=(kind,message,error=false)=>{const n=$(`${kind}-status`);n.textContent=message;n.classList.toggle('error',error);};
 function resetFilters(kind){
  $(`${kind}-user`).value='';$(`${kind}-account-state`).value='all';$(`${kind}-size`).value='20';
  if(kind==='friends'){$('friends-state').value='active';$('friends-persona').value='all';$('friends-introduction').value='all';}
  else{const end=new Date(Date.now()+9*3600000).toISOString().slice(0,10);$(`${kind}-end`).value=end;$(`${kind}-start`).value=new Date(Date.parse(end)-29*86400000).toISOString().slice(0,10);if(kind==='payments')$('payments-state').value='all';}
 }
 async function request(body){
  const {data}=await getClient().auth.getSession();if(!data.session)throw Error('관리자 로그인이 필요합니다.');
  const {data:result,error}=await getClient().functions.invoke('admin-operations',{method:'POST',body});
  if(error)throw Error(error.context?.status===403?'조회 권한이 없습니다.':error.context?.status===404?'항목이 없거나 삭제되었습니다.':error.context?.status===401?'로그인이 만료되었습니다. 다시 로그인해 주세요.':'내역을 불러오지 못했습니다. 다시 시도해 주세요.');return result;
 }
 function filters(kind){const user=$(`${kind}-user`).value.trim();if(user&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user))throw Error('회원 UID는 전체 UUID를 입력해 주세요.');
  const common={accountState:$(`${kind}-account-state`).value,userId:user||null,size:Number($(`${kind}-size`).value)};
  return kind==='friends'?{...common,state:$('friends-state').value,persona:$('friends-persona').value,introduction:$('friends-introduction').value}:{...common,...chatPeriod($(`${kind}-start`).value,$(`${kind}-end`).value),...(kind==='payments'?{status:$('payments-state').value}:{})};
 }
 function ownerCell(kind,item){const c=el('td',null,'operation-owner'),b=button(`${ownerKey(item).slice(0,8)}…${ownerKey(item).slice(-6)}`,()=>{$(`${kind}-user`).value=ownerKey(item);void load(kind,true);},'operation-owner-id');b.title=ownerKey(item);b.setAttribute('aria-label',`${ownerLabel(item)}로 조회: ${ownerKey(item)}`);c.append(b,accountBadge(item));return c;}
 function photo(item,large=false){
  const wrap=el('div',null,large?'operation-photo-large':'operation-photo'),img=el('img');
  const url=operationPhotoUrl(item.photo_url);img.src=url||preset(item);img.alt=url?'사용자가 설정한 친구 프로필 사진':'기본 친구 프로필';if(!large)img.loading='lazy';img.referrerPolicy='no-referrer';
  const note=el('span',item.has_custom_photo?'사진 미리보기':'기본 프로필','helper');
  if(item.has_custom_photo&&!url)note.textContent='사진 확인 필요';
  img.onerror=()=>{img.onerror=null;img.src=preset(item);img.alt='기본 친구 프로필';note.textContent='사진을 불러오지 못했습니다. 새로고침해 주세요.';};wrap.append(img,note);return wrap;
 }
 function render(kind,data){
  const state=states[kind],wrap=el('div',null,'collection-scroll');wrap.tabIndex=0;wrap.setAttribute('aria-label',`${kind==='payments'?'결제':kind==='ads'?'광고':'친구'} 목록`);
  const table=el('table',null,'collection-table admin-record-table operation-table'),head=el('thead'),tr=el('tr'),body=el('tbody');
  const columns=kind==='payments'?['결제 시각 (KST)','UID·보관용 키','상품','금액','유형','상태','환경','관리']:kind==='ads'?['보상 시각 (KST)','UID·보관용 키','지급 대화권','이용일','관리']:['프로필 사진','이름','성향','UID·보관용 키','상태','수정 시각 (KST)','관리'];
  for(const label of columns){const th=el('th',label);th.scope='col';tr.append(th);}head.append(tr);
  for(const item of data.items){const row=el('tr'),route={tab:kind,id:item.id,...(kind==='friends'?{user:ownerKey(item)}:{}),...(isRetained(item)?{accountState:'deleted',archive:item.archive_id}:{})},open=()=>void openDetail(route,true);
   if(kind==='friends'){
    const image=el('td'),imageButton=button('',open,'operation-photo-button');imageButton.setAttribute('aria-label','친구 프로필 사진 상세');imageButton.append(photo(item));image.append(imageButton);row.append(image);
    const name=el('td');name.append(button(item.nickname||'이름 없음',open,'row-title'),el('p',item.is_default?'기본 친구 · 사용자 수정':'추가한 친구','row-summary'));if(item.has_introduction)name.append(el('p','소개 있음','row-summary'));row.append(name,el('td',personas[item.persona]||item.persona),ownerCell(kind,item),el('td',item.is_deleted?'삭제됨':'사용 중'),el('td',time(item.updated_at),'audit-date'));
   }else if(kind==='payments'){
    const date=el('td');date.append(button(time(item.sort_at),open,'row-title'));row.append(date,ownerCell(kind,item));const product=el('td');product.append(el('strong',products[item.product_id]||item.product_id||'상품 미기록'),el('p',item.store||'스토어 미기록','row-summary'));row.append(product,el('td',paymentAmount(item)),el('td',events[item.event_type]||item.event_type),el('td',item.status==='refunded'?'환불':item.status==='completed'?'완료':item.status),el('td',item.verified_production?'실결제 확인':'환경 미기록'));
   }else{const date=el('td');date.append(button(time(item.created_at),open,'row-title'));row.append(date,ownerCell(kind,item),el('td',item.credits==null?'원장 미기록':`${item.credits}회`),el('td',item.reward_day));}
   const action=el('td',null,'row-actions');action.append(button('상세',open));row.append(action);row.onclick=e=>{if(!e.target.closest('button,a,input,select'))open();};body.append(row);
  }
  if(!data.items.length){const row=el('tr'),cell=el('td','조건에 맞는 내역이 없습니다.','empty-list');cell.colSpan=columns.length;row.append(cell);body.append(row);}
  table.append(head,body);wrap.append(table);$(`${kind}-list`).replaceChildren(wrap);
  state.next=data.nextCursor??null;$(`${kind}-count`).textContent=data.items.length?`${state.page*state.filters.size+1}–${state.page*state.filters.size+data.items.length} / ${data.total}개`:'0개';renderPager(kind,{page:state.page+1,total:data.total,size:state.filters.size,onChange:n=>{state.page=n-1;void load(kind);}});$(`${kind}-prev`).disabled=state.page===0;// Numbered pager owns button boundaries.

 }
 async function load(kind,reset=false){setPagerBusy(kind);const state=states[kind],ticket=++state.ticket,gen=generation;
  try{if(reset||!state.filters){state.filters=filters(kind);state.page=0;state.cursors=[null];}status(kind,'내역을 불러오는 중…');$(`${kind}-refresh`).disabled=true;$(`${kind}-prev`).disabled=true;$(`${kind}-next`).disabled=true;
   const result=await request({action:'list',kind,...state.filters,page:state.page+1});if(ticket!==state.ticket||gen!==generation)return false;state.page=(result.page??(state.page+1))-1;render(kind,result);status(kind,'');return true;
  }catch(error){if(ticket===state.ticket&&gen===generation){$(`${kind}-list`).replaceChildren();$(`${kind}-count`).textContent='';clearPager(kind);state.next=null;$(`${kind}-prev`).disabled=true;$(`${kind}-next`).disabled=true;status(kind,error.message,true);}return false;}
  finally{if(ticket===state.ticket&&gen===generation)$(`${kind}-refresh`).disabled=false;}
 }
 function clearDetail(){$('operation-title').textContent='상세';$('operation-fields').replaceChildren();$('operation-photo').replaceChildren();$('operation-ledger').replaceChildren();$('operation-detail-status').textContent='';$('operation-refresh-photo').hidden=true;}
 async function openDetail(route,notify=false){const ticket=++detailTicket,gen=generation;active={...route};clearDetail();$('operation-title').textContent=route.tab==='payments'?'결제 상세':route.tab==='ads'?'광고 보상 상세':'친구 상세';$('operation-refresh-photo').hidden=route.tab!=='friends';$('operation-detail-status').textContent='상세 정보를 불러오는 중…';if(!$('operation-dialog').open)$('operation-dialog').showModal();$('operation-close').focus();if(notify)onDetail({...route});
  try{const data=await request({action:'detail',kind:route.tab,id:route.id,accountState:route.accountState,...(route.accountState==='deleted'?{archiveId:route.archive??route.user}:{}),...(route.tab==='friends'?{userId:route.user}:{})});if(ticket!==detailTicket||gen!==generation||!$('operation-dialog').open)return;const item=data.items[0];if(!item)throw Error('항목이 없거나 삭제되었습니다.');
   const fields=route.tab==='payments'?[[ownerLabel(item),ownerKey(item)],['상품',products[item.product_id]||item.product_id||'미기록'],['상품 ID',item.product_id],['유형',events[item.event_type]||item.event_type],['스토어',item.store],['금액',paymentAmount(item)],['상태',item.status==='refunded'?'환불':item.status==='completed'?'완료':item.status],['실결제 구분',item.verified_production?'실결제 확인':'환경 미기록 · 테스트가 포함될 수 있습니다.'],['결제 시각 (KST)',time(item.purchased_at)],['서버 반영 시각 (KST)',time(item.created_at)],['환불 시각 (KST)',time(item.refunded_at)],['거래 번호',item.transaction_id],['처리 ID',item.id]]:route.tab==='ads'?[[ownerLabel(item),ownerKey(item)],['상태','서버 검증 · 보상 지급 완료'],['지급 대화권',item.credits==null?'원장 미기록':`${item.credits}회`],['보상 시각 (KST)',time(item.created_at)],['이용일 (05시 기준)',item.reward_day],['검증 거래 ID',item.id]]:[[ownerLabel(item),ownerKey(item)],['이름',item.nickname],['성향',personas[item.persona]||item.persona],['친구 소개',item.introduction?.trim()?item.introduction:'설정하지 않음'],['구분',item.is_default?'기본 친구 · 사용자 수정':'추가한 친구'],['상태',item.is_deleted?'삭제됨':'사용 중'],['계정',item.is_guest?'게스트':'회원'],['등록 시각 (KST)',time(item.created_at)],['수정 시각 (KST)',time(item.updated_at)],['친구 ID',item.id]];
   if(isRetained(item))fields.unshift(['계정 상태','탈퇴 회원'],['탈퇴 시각 (KST)',time(item.deleted_at)]);
   for(const [label,value] of fields)$('operation-fields').append(el('dt',label),el('dd',value??'—'));
   if(route.tab==='friends')$('operation-photo').append(photo(item,true));
   else{const entries=item.credit_entries??[];$('operation-ledger').append(el('h3','지급 원장'));if(!entries.length)$('operation-ledger').append(el('p','이 거래와 연결된 원장 기록이 없습니다.','helper'));for(const entry of entries)$('operation-ledger').append(el('p',`${time(entry.recorded_at)} · ${entry.delta>0?'+':''}${entry.delta}회${entry.bucket?' · '+entry.bucket:''}${entry.imported?' · 이관 기록':''}`));}
   $('operation-detail-status').textContent='';
  }catch(error){if(ticket===detailTicket&&gen===generation)$('operation-detail-status').textContent=error.message;}
 }
 function closeDetail(){detailTicket++;active=null;$('operation-dialog').close();clearDetail();}
 $('operation-dialog').addEventListener('close',()=>{if(!$('operation-dialog').open){detailTicket++;active=null;clearDetail();}});
 $('operation-close').onclick=closeDetail;$('operation-done').onclick=closeDetail;$('operation-refresh-photo').onclick=()=>{if(active)void openDetail(active);};
 for(const kind of kinds){resetFilters(kind);$(`${kind}-filters`).onsubmit=e=>{e.preventDefault();void load(kind,true);};$(`${kind}-refresh`).onclick=()=>load(kind,true);$(`${kind}-reset`).onclick=()=>{resetFilters(kind);void load(kind,true);};$(`${kind}-prev`).onclick=()=>{const s=states[kind];if(s.page){s.page--;void load(kind);}};$(`${kind}-next`).onclick=()=>{const s=states[kind];if(s.next){s.cursors[++s.page]=s.next;void load(kind);}};}
 const views=Object.fromEntries(kinds.map(k=>[k,{load:()=>load(k),setRoute:route=>{if(route.accountState||route.owner){$(`${k}-account-state`).value=route.accountState??'all';$(`${k}-user`).value=route.owner??'';states[k].filters=null;}}}]));
 return{view:k=>views[k],load,openDetail,closeDetail,clear:()=>{generation++;closeDetail();for(const kind of kinds){const s=states[kind];s.ticket++;s.filters=null;s.cursors=[null];s.page=0;s.next=null;$(`${kind}-list`).replaceChildren();$(`${kind}-count`).textContent='';$(`${kind}-page`).textContent='';$(`${kind}-refresh`).disabled=false;status(kind,'');resetFilters(kind);}}};
}
