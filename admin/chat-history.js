import {isRetained,ownerKey,ownerLabel,accountBadge} from './account-status.js';
import {renderPager,setPagerBusy,clearPager} from './pagination.js';
const $=id=>document.getElementById(id);
const node=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const labels={user:'사용자',ai:'AI',safety:'안전 안내',failed:'전송 실패'};
const time=value=>new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false});
export function chatPeriod(start,end){
  const valid=v=>/^\d{4}-\d\d-\d\d$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
  if(!valid(start)||!valid(end))throw Error('조회 기간을 확인해 주세요.');
  const from=new Date(start+'T00:00:00+09:00'),until=new Date(Date.parse(end+'T00:00:00+09:00')+86400000);
  if(until<=from||until-from>93*86400000)throw Error('조회 기간은 최대 93일로 선택해 주세요.');
  return {from:from.toISOString(),until:until.toISOString()};
}
export function createChatHistory(getClient,onDetail=()=>{}){
  let generation=0,listTicket=0,detailTicket=0,active=null,rows=[],before=false,after=false,next=null,offset=0;
  let cursors=[null],page=0,filters=null;
  const status=(message,error=false)=>{$('chat-status').textContent=message;$('chat-status').classList.toggle('error',error);};
  const today=()=>new Date(Date.now()+9*3600000).toISOString().slice(0,10);
  function resetFilters(){const end=today();$('chat-end').value=end;$('chat-start').value=new Date(Date.parse(end)-6*86400000).toISOString().slice(0,10);$('chat-user').value='';$('chat-kind').value='user';$('chat-account-state').value='all';$('chat-size').value='20';}
  resetFilters();
  function readFilters(){const user=$('chat-user').value.trim();if(user&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user))throw Error('회원 UID는 전체 UUID를 입력해 주세요.');return {...chatPeriod($('chat-start').value,$('chat-end').value),accountState:$('chat-account-state').value,kind:$('chat-kind').value,userId:user||null,size:Number($('chat-size').value)};}
  async function request(body){
    const {data}=await getClient().auth.getSession();if(!data.session)throw Error('관리자 로그인이 필요합니다.');
    const {data:result,error}=await getClient().functions.invoke('admin-chat-history',{method:'POST',body});
    if(error){let code;try{code=(await error.context.clone().json()).error;}catch{}throw Error(error.context?.status===403?'채팅 기록 조회 권한이 없습니다.':code==='room_not_found'?'채팅방이 없거나 삭제되었습니다.':code==='message_not_found'?'선택한 메시지가 없거나 삭제되었습니다. 최근 대화로 다시 열어 주세요.':error.context?.status===401?'로그인이 만료되었습니다. 다시 로그인해 주세요.':'채팅 기록을 불러오지 못했습니다. 다시 시도해 주세요.');}
    return result;
  }
  function button(text,fn,cls){const b=node('button',text,cls);b.type='button';b.onclick=fn;return b;}
  function renderList(data){
    const wrap=node('div',null,'collection-scroll');wrap.tabIndex=0;wrap.setAttribute('aria-label','최신 메시지 목록');
    const table=node('table',null,'collection-table admin-record-table chat-table'),head=node('thead'),headers=node('tr'),body=node('tbody');
    for(const label of ['전송 시각 (KST)','구분','메시지','채팅방','UID·보관용 키','관리']){const th=node('th',label);th.scope='col';headers.append(th);}head.append(headers);
    for(const item of data.messages){
      const open=()=>void openDetail({user:ownerKey(item),id:item.room_id,message:item.id,...(isRetained(item)?{accountState:'deleted'}:{})},true),row=node('tr');
      row.append(node('td',time(item.sent_at),'audit-date'),node('td',labels[item.sender_kind]??item.sender_kind));
      const preview=node('td',null,'chat-preview');preview.append(button(item.preview||'(빈 메시지)',open,'row-title'));row.append(preview);
      row.append(node('td',item.room_title||'이름 없는 방','chat-room-name'));
      const user=node('td',null,'chat-owner');const owner=button(`${ownerKey(item).slice(0,8)}…${ownerKey(item).slice(-6)}`,()=>{$('chat-user').value=ownerKey(item);void load(true);},'chat-owner-id');owner.title=ownerKey(item);owner.setAttribute('aria-label',`${ownerLabel(item)}로 조회: ${ownerKey(item)}`);user.append(owner,accountBadge(item));row.append(user);
      const action=node('td',null,'row-actions');action.append(button('대화 보기',open));row.append(action);
      row.onclick=e=>{if(!e.target.closest('button,a,input,select'))open();};body.append(row);
    }
    if(!data.messages.length){const row=node('tr'),cell=node('td','조건에 맞는 메시지가 없습니다.','empty-list');cell.colSpan=6;row.append(cell);body.append(row);}
    table.append(head,body);wrap.append(table);$('chat-list').replaceChildren(wrap);
    $('chat-count').textContent=data.messages.length?`${offset+1}–${offset+data.messages.length} / ${data.total}개`:'0개';renderPager('chat',{page:page+1,total:data.total,size:filters.size,onChange:n=>{page=n-1;offset=page*filters.size;void load();}});
    next=data.nextCursor??null;
  }
  async function load(reset=false){setPagerBusy('chat');
    const ticket=++listTicket,gen=generation;
    try{
      if(reset||!filters){filters=readFilters();cursors=[null];page=0;offset=0;}
      status('메시지를 불러오는 중…');$('chat-refresh').disabled=true;$('chat-prev').disabled=true;$('chat-next').disabled=true;
      const result=await request({action:'list',...filters,page:page+1});
      if(ticket!==listTicket||gen!==generation)return false;page=(result.page??(page+1))-1;offset=page*filters.size;renderList(result);status('');return true;
    }catch(error){if(ticket===listTicket&&gen===generation){$('chat-list').replaceChildren();$('chat-count').textContent='';clearPager('chat');next=null;$('chat-prev').disabled=true;$('chat-next').disabled=true;status(error.message,true);}return false;}
    finally{if(ticket===listTicket&&gen===generation)$('chat-refresh').disabled=false;}
  }
  function renderRoom(highlight=null){
    const list=$('chat-messages');list.replaceChildren();let previousDay='';
    for(const item of rows){
      const day=new Date(Date.parse(item.sent_at)+9*3600000).toISOString().slice(0,10);
      if(day!==previousDay){list.append(node('p',day,'chat-day'));previousDay=day;}
      const line=node('article',null,`chat-message chat-message-${item.sender_kind}`);line.dataset.messageId=item.id;
      if(item.id===active?.message){line.classList.add('chat-selected');line.setAttribute('aria-label','선택한 메시지');}
      const meta=node('div',null,'chat-message-meta');meta.append(node('strong',item.sender_kind==='user'?'사용자':item.sender_name||labels[item.sender_kind]));if(item.sender_kind!=='user')meta.append(node('span',labels[item.sender_kind]??item.sender_kind));meta.append(node('time',time(item.sent_at)));
      line.append(meta,node('p',item.content,'chat-message-content'));list.append(line);
    }
    if(!rows.length)list.append(node('p','저장된 메시지가 없습니다.','helper'));
    $('chat-older').disabled=!before;$('chat-newer').disabled=!after;$('chat-room-count').textContent=`불러온 메시지 ${rows.length}개`;
    const target=[...list.querySelectorAll('[data-message-id]')].find(n=>n.dataset.messageId===highlight);
    if(target)target.scrollIntoView({block:'center'});else if(!highlight)list.scrollTop=list.scrollHeight;
  }
  async function openDetail(route,notify=false){
    const ticket=++detailTicket,gen=generation;active={...route};rows=[];before=false;after=false;
    $('chat-room-title').textContent='채팅방 대화';$('chat-room-meta').textContent='';$('chat-messages').replaceChildren();$('chat-room-count').textContent='';$('chat-detail-status').textContent='대화를 불러오는 중…';
    $('chat-older').disabled=true;$('chat-newer').disabled=true;
    if(!$('chat-dialog').open)$('chat-dialog').showModal();$('chat-close').focus();if(notify)onDetail({...route});
    try{const result=await request({action:'room',userId:route.user,accountState:route.accountState,roomId:route.id,messageId:route.message??null});
      if(ticket!==detailTicket||gen!==generation||!$('chat-dialog').open)return;
      $('chat-room-title').textContent=result.room.title||'이름 없는 방';$('chat-room-meta').textContent=`${isRetained(result.room)?'탈퇴 회원':result.room.is_guest?'게스트':'회원'} · ${ownerLabel(result.room)} ${ownerKey(result.room)}${result.room.deleted_at?' · 탈퇴 '+time(result.room.deleted_at):''} · 방 ID ${result.room.id}`;
      rows=result.messages;before=result.hasBefore;after=result.hasAfter;renderRoom(route.message);$('chat-detail-status').textContent='';
    }catch(error){if(ticket===detailTicket&&gen===generation)$('chat-detail-status').textContent=error.message;}
  }
  async function extend(direction){
    if(!active||!rows.length)return;const boundary=direction==='before'?rows[0]:rows.at(-1),gen=generation,ticket=++detailTicket;
    $('chat-older').disabled=true;$('chat-newer').disabled=true;$('chat-detail-status').textContent='대화를 더 불러오는 중…';
    try{const result=await request({action:'room',userId:active.user,accountState:active.accountState,roomId:active.id,direction,cursor:{sentAt:boundary.sent_at,id:boundary.id}});
      if(ticket!==detailTicket||gen!==generation||!$('chat-dialog').open)return;
      const ids=new Set(rows.map(m=>m.id)),fresh=result.messages.filter(m=>!ids.has(m.id));rows=direction==='before'?[...fresh,...rows]:[...rows,...fresh];
      if(direction==='before')before=result.hasBefore;else after=result.hasAfter;renderRoom(boundary.id);$('chat-detail-status').textContent='';
    }catch(error){if(ticket===detailTicket&&gen===generation){$('chat-detail-status').textContent=error.message;$('chat-older').disabled=!before;$('chat-newer').disabled=!after;}}
  }
  function clearRoom(){rows=[];$('chat-messages').replaceChildren();$('chat-room-title').textContent='채팅방 대화';$('chat-room-meta').textContent='';$('chat-room-count').textContent='';$('chat-detail-status').textContent='';}
  const close=()=>{detailTicket++;active=null;$('chat-dialog').close();clearRoom();};
  $('chat-dialog').addEventListener('close',()=>{if(!$('chat-dialog').open){detailTicket++;active=null;clearRoom();}});
  $('chat-search-form').onsubmit=e=>{e.preventDefault();void load(true);};$('chat-refresh').onclick=()=>load(true);
  $('chat-reset').onclick=()=>{resetFilters();void load(true);};
  $('chat-prev').onclick=()=>{if(page>0){page--;offset=page*filters.size;void load();}};
  $('chat-next').onclick=()=>{if(next){cursors[++page]=next;offset=page*filters.size;void load();}};
  $('chat-close').onclick=close;$('chat-done').onclick=close;$('chat-older').onclick=()=>extend('before');$('chat-newer').onclick=()=>extend('after');
  $('chat-latest').onclick=()=>{if(active)void openDetail({...active,message:null},true);};
  return {load,setRoute:route=>{if(route.accountState||route.owner){$('chat-account-state').value=route.accountState??'all';$('chat-user').value=route.owner??'';filters=null;}},openDetail,closeDetail:close,clear:()=>{generation++;listTicket++;close();filters=null;next=null;cursors=[null];page=0;offset=0;$('chat-list').replaceChildren();$('chat-count').textContent='';$('chat-page').textContent='';status('');$('chat-refresh').disabled=false;resetFilters();}};
}
