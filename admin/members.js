const $ = id => document.getElementById(id);
const el = (tag, text, className) => { const node=document.createElement(tag);if(text!=null)node.textContent=text;if(className)node.className=className;return node; };
const button = (text, handler, className) => { const node=el('button',text,className);node.type='button';node.onclick=handler;return node; };
const date = value => value ? new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}) : '기록 없음';

export function createMembers(client, onPush) {
  let generation=0,ticket=0,detailTicket=0,member=null;
  const view={query:'',page:1,size:20};
  const status=(message,error=false)=>{ $('member-status').textContent=message;$('member-status').classList.toggle('error',error); };
  async function request(body) {
    const {data}=await client().auth.getSession();
    if(!data.session)throw Error('관리자 로그인이 필요합니다.');
    const {data:result,error}=await client().functions.invoke('admin-members',{method:'POST',body});
    if(error)throw Error(error.context?.status===403?'회원 정보를 조회할 권한이 없습니다.':error.context?.status===404?'회원이 없거나 탈퇴한 계정입니다.':'회원 정보를 불러오지 못했습니다. 다시 시도해 주세요.');
    return result;
  }
  async function copy(id,target=$('member-status')) {
    try { await navigator.clipboard.writeText(id);target.textContent='회원 UID를 복사했습니다.'; }
    catch { target.textContent='UID를 선택해 직접 복사해 주세요.';if(target.id==='member-detail-status')$('member-detail-uid').select(); }
  }
  function render(data) {
    const wrapper=el('div',null,'collection-scroll');wrapper.tabIndex=0;wrapper.setAttribute('aria-label','회원 목록');
    const table=el('table',null,'collection-table admin-record-table member-table'),head=el('thead'),headers=el('tr'),body=el('tbody');
    for(const text of ['회원','UID','가입일 (KST)','최근 활동 (KST)','알림 허용 기기','관리']){const th=el('th',text);th.scope='col';headers.append(th);}head.append(headers);
    for(const item of data.members){
      const row=el('tr'),name=el('td',null,'name-cell');
      name.append(button(item.nickname||'프로필 미설정',()=>open(item.id),'row-title'),el('p',item.email||'이메일 없음','row-summary'));
      if(item.is_admin)name.append(el('span','운영 관리자','content-state'));row.append(name);
      const uid=el('td',null,'member-uid-cell');uid.append(el('code',item.id),button('복사',()=>copy(item.id)));row.append(uid);
      for(const value of [date(item.created_at),date(item.last_active_at),`${item.push_devices}대`])row.append(el('td',value));
      const actions=el('td',null,'row-actions');actions.append(button('상세',()=>open(item.id)));row.append(actions);
      row.onclick=e=>{if(!e.target.closest('button,a,input,select'))void open(item.id);};body.append(row);
    }
    if(!data.members.length){const row=el('tr'),cell=el('td',view.query?'검색 조건에 맞는 회원이 없습니다.':'가입한 회원이 없습니다.','empty-list');cell.colSpan=6;row.append(cell);body.append(row);}
    table.append(head,body);wrapper.append(table);$('member-list').replaceChildren(wrapper);
    const pages=Math.max(1,Math.ceil(data.total/view.size));
    $('member-count').textContent=data.total?`${(view.page-1)*view.size+1}–${Math.min(view.page*view.size,data.total)} / ${data.total}명`:'0명';
    $('member-page').textContent=`${view.page} / ${pages}`;$('member-prev').disabled=view.page===1;$('member-next').disabled=view.page>=pages;
  }
  async function load() {
    const current=++ticket,session=generation;status('회원을 불러오는 중…');$('member-refresh').disabled=true;
    try {
      const data=await request({action:'list',...view});if(current!==ticket||session!==generation)return;
      const last=Math.max(1,Math.ceil(data.total/view.size));if(view.page>last){view.page=last;return load();}
      render(data);status('');
    }catch(error){if(current===ticket&&session===generation){$('member-list').replaceChildren();status(error.message,true);}}
    finally{if(current===ticket&&session===generation)$('member-refresh').disabled=false;}
  }
  async function open(id) {
    const current=++detailTicket,session=generation;member=null;
    $('member-detail-fields').replaceChildren();$('member-detail-uid').value=id;$('member-detail-copy').disabled=true;$('member-detail-push').disabled=true;
    $('member-detail-status').textContent='상세 정보를 불러오는 중…';
    if(!$('member-detail-dialog').open)$('member-detail-dialog').showModal();$('member-detail-close').focus();
    try {
      const data=await request({action:'detail',id});if(current!==detailTicket||session!==generation||!$('member-detail-dialog').open)return;
      member=data.members[0];const fields=$('member-detail-fields');
      for(const [label,value] of [['닉네임',member.nickname||'프로필 미설정'],['이메일',member.email||'없음'],['가입일 (KST)',date(member.created_at)],['최근 활동 (KST)',date(member.last_active_at)],['최근 로그인 (KST)',date(member.last_sign_in_at)],['로그인 방식',member.providers.join(' · ')||'기록 없음'],['알림 허용 기기',`${member.push_devices}대 (iOS ${member.ios_devices} · Android ${member.android_devices})`],['클릭 집계 지원',`${member.tracking_devices}대`],['푸시 대상',member.is_admin?'운영 관리자 계정은 발송 대상에서 제외됩니다.':member.push_devices?'알림을 허용한 기기에만 발송합니다.':'알림을 허용한 기기가 없어 현재 발송할 수 없습니다.']])fields.append(el('dt',label),el('dd',value));
      $('member-detail-copy').disabled=false;$('member-detail-push').disabled=member.is_admin||!member.push_devices;$('member-detail-status').textContent='';
    }catch(error){if(current===detailTicket&&session===generation)$('member-detail-status').textContent=error.message;}
  }
  const close=()=>{detailTicket++;member=null;$('member-detail-dialog').close();};
  $('member-refresh').onclick=load;
  $('member-search-form').onsubmit=e=>{e.preventDefault();view.query=$('member-search').value.trim();view.page=1;void load();};
  $('member-search-clear').onclick=()=>{$('member-search').value='';view.query='';view.page=1;void load();};
  $('member-size').onchange=e=>{view.size=Number(e.target.value);view.page=1;void load();};
  $('member-prev').onclick=()=>{view.page--;void load();};$('member-next').onclick=()=>{view.page++;void load();};
  $('member-detail-close').onclick=close;$('member-detail-done').onclick=close;
  $('member-detail-copy').onclick=()=>{if(member)void copy(member.id,$('member-detail-status'));};
  $('member-detail-push').onclick=()=>{if(!member||member.is_admin||!member.push_devices)return;const id=member.id;close();onPush([id]);};
  return {load,clear:()=>{generation++;ticket++;detailTicket++;member=null;view.page=1;view.query='';$('member-search').value='';$('member-list').replaceChildren();$('member-count').textContent='';$('member-page').textContent='';$('member-status').textContent='';$('member-detail-fields').replaceChildren();$('member-detail-uid').value='';$('member-detail-status').textContent='';$('member-refresh').disabled=false;if($('member-detail-dialog').open)$('member-detail-dialog').close();}};
}
