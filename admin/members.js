import {isRetained,ownerLabel,accountBadge} from './account-status.js';
import {renderPager,setPagerBusy,clearPager} from './pagination.js';
const $ = id => document.getElementById(id);
const el = (tag, text, className) => { const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node; };
const button = (text, handler, className) => { const node=el('button',text,className);node.type='button';node.onclick=handler;return node; };
const date = value => value ? new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}) : '기록 없음';

export function createMembers(client, onPush, onDetail = () => {}) {
  let generation=0,ticket=0,detailTicket=0,historyTicket=0,member=null;
  const view={query:'',page:1,size:20,accountState:'all'};
  const status=(message,error=false)=>{ $('member-status').textContent=message;$('member-status').classList.toggle('error',error); };
  async function request(body) {
    const {data}=await client().auth.getSession();
    if(!data.session)throw Error('관리자 로그인이 필요합니다.');
    const {data:result,error}=await client().functions.invoke('admin-members',{method:'POST',body});
    if(error)throw Error(error.context?.status===403?'회원 정보를 조회할 권한이 없습니다.':error.context?.status===404?'회원이 없거나 탈퇴한 계정입니다.':'회원 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
    return result;
  }
  async function copy(id,target=$('member-status')) {
    try { await navigator.clipboard.writeText(id);target.textContent=isRetained(member)?'보관용 키를 복사했습니다.':'회원 UID를 복사했습니다.'; }
    catch { target.textContent='UID를 선택해 직접 복사해 주세요.';if(target.id==='member-detail-status')$('member-detail-uid').select(); }
  }
  function render(data) {
    const wrapper=el('div',null,'collection-scroll');wrapper.tabIndex=0;wrapper.setAttribute('aria-label','회원 목록');
    const table=el('table',null,'collection-table admin-record-table member-table'),head=el('thead'),headers=el('tr'),body=el('tbody');
    for(const text of ['회원','UID·보관용 키','가입일 (KST)','최근 활동 (KST)','알림 허용 기기','관리']){const th=el('th',text);th.scope='col';headers.append(th);}head.append(headers);
    for(const item of data.members){
      const row=el('tr'),name=el('td',null,'name-cell');
      name.append(button(item.nickname||'프로필 미설정',()=>open(item.id,isRetained(item)?'deleted':'active'),'row-title'),el('p',isRetained(item)?'UID·이메일 삭제됨':item.email||'이메일 없음','row-summary'),accountBadge(item));
      if(item.is_admin)name.append(el('span','운영 관리자','content-state'));row.append(name);
      const uid=el('td',null,'member-uid-cell');uid.append(el('code',item.id),button('복사',()=>copy(item.id)));row.append(uid);
      for(const value of [date(item.created_at),date(item.last_active_at),`${item.push_devices}대`])row.append(el('td',value));
      const actions=el('td',null,'row-actions');actions.append(button('상세',()=>open(item.id,isRetained(item)?'deleted':'active')));row.append(actions);
      row.onclick=e=>{if(!e.target.closest('button,a,input,select'))void open(item.id,isRetained(item)?'deleted':'active');};body.append(row);
    }
    if(!data.members.length){const row=el('tr'),cell=el('td',view.query?'검색 조건에 맞는 회원이 없습니다.':'가입한 회원이 없습니다.','empty-list');cell.colSpan=6;row.append(cell);body.append(row);}
    table.append(head,body);wrapper.append(table);$('member-list').replaceChildren(wrapper);
    const pages=Math.max(1,Math.ceil(data.total/view.size));
    $('member-count').textContent=data.total?`${(view.page-1)*view.size+1}–${Math.min(view.page*view.size,data.total)} / ${data.total}명`:'0명';
    renderPager('member',{page:view.page,total:data.total,size:view.size,onChange:n=>{view.page=n;void load();}});
  }
  async function load() {
    setPagerBusy('member');
    const current=++ticket,session=generation;status('회원을 불러오는 중…');$('member-refresh').disabled=true;
    try {
      const data=await request({action:'list',...view});if(current!==ticket||session!==generation)return;
      const last=Math.max(1,Math.ceil(data.total/view.size));if(view.page>last){view.page=last;return load();}
      render(data);status('');
    }catch(error){if(current===ticket&&session===generation){$('member-list').replaceChildren();clearPager('member');status(error.message,true);}}
    finally{if(current===ticket&&session===generation)$('member-refresh').disabled=false;}
  }
  async function open(id, accountState = 'active', notify = true) {
    const current=++detailTicket,session=generation;member=null;clearHistory();$('member-detail-key-label').textContent=accountState==='deleted'?'보관용 키':'회원 UID';$('member-detail-title').textContent=accountState==='deleted'?'회원 상세 · 탈퇴 회원':'회원 상세';$('member-detail-push').hidden=accountState==='deleted';
    $('member-detail-fields').replaceChildren();$('member-detail-uid').value=id;$('member-detail-copy').disabled=true;$('member-detail-push').disabled=true;
    $('member-detail-status').textContent='상세 정보를 불러오는 중…';
    if(!$('member-detail-dialog').open)$('member-detail-dialog').showModal();$('member-detail-close').focus();if(notify)onDetail('members',id,null,accountState==='deleted'?'deleted':undefined);
    try {
      const data=await request({action:'detail',id,accountState});if(current!==detailTicket||session!==generation||!$('member-detail-dialog').open)return;
      member=data.members[0];const fields=$('member-detail-fields');
      if(isRetained(member)){
        for(const [label,value] of [['계정 상태','탈퇴 회원'],['닉네임',member.nickname||'프로필 미설정'],['가입일 (KST)',date(member.created_at)],['탈퇴 시각 (KST)',date(member.deleted_at)],['최근 활동 (KST)',date(member.last_active_at)],['계정 유형',member.is_guest?'게스트':'회원']])fields.append(el('dt',label),el('dd',value));
        renderHistorySummary(member);void loadHistory(1);
      }else{
      for(const [label,value] of [['닉네임',member.nickname||'프로필 미설정'],['이메일',member.email||'없음'],['가입일 (KST)',date(member.created_at)],['최근 활동 (KST)',date(member.last_active_at)],['최근 로그인 (KST)',date(member.last_sign_in_at)],['로그인 방식',member.providers.join(' · ')||'기록 없음'],['알림 허용 기기',`${member.push_devices}대 (iOS ${member.ios_devices} · Android ${member.android_devices})`],['클릭 집계 지원',`${member.tracking_devices}대`],['푸시 대상',member.push_devices?'알림을 허용한 기기에 발송하며, 마케팅 알림은 별도 수신 동의가 필요합니다.':'알림을 허용한 기기가 없어 현재 발송할 수 없습니다.']])fields.append(el('dt',label),el('dd',value));
      }
      $('member-detail-copy').disabled=false;$('member-detail-push').disabled=isRetained(member)||!member.push_devices;$('member-detail-status').textContent='';
    }catch(error){if(current===detailTicket&&session===generation)$('member-detail-status').textContent=error.message;}
  }
  function clearHistory(){
    historyTicket++;$('member-retained-history').hidden=true;$('member-history-list').replaceChildren();$('member-retained-links').replaceChildren();
    for(const id of ['member-retained-summary','member-retained-wallet','member-history-status','member-history-count'])$(id).textContent='';
    clearPager('member-history');$('member-history-kind').value='turns';
  }
  function renderHistorySummary(item){
    const summary=item.retained_summary??{},c=summary.counts??{},w=summary.wallet;
    $('member-retained-history').hidden=false;
    $('member-retained-summary').textContent=`채팅방 ${c.mb_rooms??0}개 · 메시지 ${c.mb_messages??0}개 · 채팅 요청 ${c.mb_turns??0}회 (성공 ${summary.turn_statuses?.succeeded??0} · 실패 ${summary.turn_statuses?.failed??0}) · 결제 ${summary.payments??0}건 · 광고 보상 ${c.mb_ad_rewards??0}건`;
    $('member-retained-wallet').textContent=w?`탈퇴 시점 잔여 이용권: 무료 ${w.free_credits??0}회 · 유료 ${w.paid_credits??0}회 · 구독 ${Math.max(0,(w.plan_limit??0)-(w.plan_used??0))}회`:'탈퇴 시점 이용권 잔액 기록 없음';
    for(const [tab,label] of [['chats','대화 기록'],['payments','결제 내역'],['ads','광고 보상'],['friends','AI 친구']]){const link=el('a',label);link.href=`/admin/${tab}?account=deleted&owner=${encodeURIComponent(item.id)}`;$('member-retained-links').append(link);}
  }
  async function loadHistory(page=1){
    if(!isRetained(member))return;const current=++historyTicket,session=generation,id=member.id,kind=$('member-history-kind').value;
    setPagerBusy('member-history');$('member-history-list').replaceChildren();$('member-history-status').textContent='이용 내역을 불러오는 중…';
    try{
      const data=await request({action:'history',id,kind,page,size:20});if(current!==historyTicket||session!==generation||member?.id!==id||!$('member-detail-dialog').open)return;
      const wrapper=el('div',null,'collection-scroll'),table=el('table',null,'collection-table admin-record-table member-history-table'),head=el('thead'),header=el('tr'),body=el('tbody');wrapper.tabIndex=0;wrapper.setAttribute('aria-label','탈퇴 회원 이용 내역');
      const columns=kind==='turns'?['요청 시각 (KST)','처리 상태','이용권 종류','오류','방 ID']:['변동 시각 (KST)','구분','사유','변동','변동 후 잔액'];
      for(const label of columns){const th=el('th',label);th.scope='col';header.append(th);}head.append(header);
      const states={queued:'대기',running:'처리 중',succeeded:'성공',failed:'실패'},buckets={free:'무료',paid:'유료',membership:'구독',FREE:'무료',PAID:'유료',MEMBERSHIP:'구독'},sources={DAILY_RESET:'일일 무료 충전',AD_REWARD:'광고 보상',STORE_PURCHASE:'구매',STORE_REFUND:'구매 환불',TURN_DEBIT:'대화 사용',TURN_REFUND:'대화 실패 환급',REVIEW_GRANT:'리뷰 지급',ADMIN_GRANT:'관리자 지급'};
      for(const row of data.items){const tr=el('tr'),values=kind==='turns'?[date(row.created_at),states[row.status]??row.status,buckets[row.credit_source]??row.credit_source??'사용 미기록',row.error??'—',row.room_id]:[date(row.recorded_at),buckets[row.bucket]??row.bucket,(sources[row.source]??row.source)+(row.imported?' · 이관':''),`${row.delta>0?'+':''}${row.delta}회`,`${row.balance_after}회`];for(const value of values)tr.append(el('td',value??'—'));body.append(tr);}
      if(!data.items.length){const tr=el('tr'),td=el('td','보관된 이용 내역이 없습니다.','empty-list');td.colSpan=columns.length;tr.append(td);body.append(tr);}
      table.append(head,body);wrapper.append(table);$('member-history-list').replaceChildren(wrapper);$('member-history-count').textContent=`총 ${data.total}건`;
      renderPager('member-history',{page:data.page,total:data.total,size:20,onChange:loadHistory});$('member-history-status').textContent='';
    }catch(error){if(current===historyTicket&&session===generation){$('member-history-list').replaceChildren();$('member-history-count').textContent='';clearPager('member-history');$('member-history-status').textContent=error.message;}}
  }
  $('member-history-kind').onchange=()=>void loadHistory(1);
  const close=()=>{detailTicket++;member=null;clearHistory();$('member-detail-dialog').close();};
  $('member-detail-dialog').addEventListener('close',()=>{if(!$('member-detail-dialog').open){detailTicket++;member=null;clearHistory();}});
  $('member-refresh').onclick=load;
  $('member-search-form').onsubmit=e=>{e.preventDefault();view.accountState=$('member-account-state').value;view.query=$('member-search').value.trim();view.page=1;void load();};
  $('member-search-clear').onclick=()=>{$('member-search').value='';view.query='';view.accountState='all';$('member-account-state').value='all';view.page=1;void load();};
  $('member-size').onchange=e=>{view.size=Number(e.target.value);view.page=1;void load();};
  $('member-prev').onclick=()=>{view.page--;void load();};$('member-next').onclick=()=>{view.page++;void load();};
  $('member-detail-close').onclick=close;$('member-detail-done').onclick=close;
  $('member-detail-copy').onclick=()=>{if(member)void copy(member.id,$('member-detail-status'));};
  $('member-detail-push').onclick=()=>{if(!member||isRetained(member)||!member.push_devices)return;const id=member.id;close();onPush([id]);};
  return {load,setRoute:route=>{if(route.accountState||route.owner){view.accountState=route.accountState??'all';$('member-account-state').value=view.accountState;view.query=route.owner??'';$('member-search').value=view.query;view.page=1;}},openDetail:(id,state)=>open(id,state??'active',false),closeDetail:close,clear:()=>{generation++;ticket++;detailTicket++;member=null;view.page=1;view.query='';view.accountState='all';$('member-account-state').value='all';clearHistory();$('member-search').value='';$('member-list').replaceChildren();$('member-count').textContent='';$('member-page').textContent='';$('member-status').textContent='';$('member-detail-fields').replaceChildren();$('member-detail-uid').value='';$('member-detail-status').textContent='';$('member-refresh').disabled=false;if($('member-detail-dialog').open)$('member-detail-dialog').close();}};
}
