const $=id=>document.getElementById(id);
const el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;if(cls)n.className=cls;return n;};
const date=v=>new Date(v).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
const states={open:'접수',answered:'답변됨',closed:'종료'};
const alerts={pending:'발송 대기',sending:'발송 중',sent:'발송됨',failed:'발송 실패',historical:'알림 연결 전 접수'};
export function supportTarget(){
 const key='mental:support:target',valid=id=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id??'');
 const id=new URLSearchParams(location.search).get('support');
 try{if(valid(id)){sessionStorage.setItem(key,id);return id;}const saved=sessionStorage.getItem(key);return valid(saved)?saved:null;}catch{return valid(id)?id:null;}
}
export function createSupport(getClient){
 let generation=0,ticket=0,detailTicket=0;
 const view={category:'',query:'',page:1,size:20};
 let deepId=supportTarget();
 const status=(text,error=false)=>{$('support-status').textContent=text;$('support-status').classList.toggle('error',error);};
 async function request(body){
  const {data}=await getClient().auth.getSession();if(!data.session)throw Error('관리자 로그인이 필요합니다.');
  const {data:result,error}=await getClient().functions.invoke('admin-support',{method:'POST',body});
  if(error)throw Error(error.context?.status===403?'문의 조회 권한이 없습니다.':error.context?.status===404?'문의가 없거나 삭제되었습니다.':'문의·아이디어를 불러오지 못했습니다. 다시 시도해 주세요.');
  return result;
 }
 function render(data){
  const wrap=el('div',null,'collection-scroll');wrap.tabIndex=0;wrap.setAttribute('aria-label','문의·아이디어 목록');
  const table=el('table',null,'collection-table admin-record-table'),head=el('thead'),headers=el('tr'),body=el('tbody');
  for(const label of ['유형','제목·내용','보낸 사람','접수 시각 (KST)','상태','Slack 알림','관리']){const th=el('th',label);th.scope='col';headers.append(th);}head.append(headers);
  for(const item of data.requests){
   const row=el('tr');row.append(el('td',item.category));
   const content=el('td',null,'name-cell'),open=el('button',item.subject||item.preview||'문의 내용','row-title');open.type='button';open.onclick=()=>void detail(item.id);
   content.append(open);if(item.subject)content.append(el('p',item.preview,'row-summary'));if(item.has_attachment)content.append(el('span','사진 첨부','content-state'));row.append(content);
   const sender=el('td',null,'support-sender');sender.append(el('p',item.nickname||(item.is_guest?'게스트':'프로필 미설정')),el('p',item.reply_email||'회신 이메일 없음','row-summary'));row.append(sender);
   for(const value of [date(item.created_at),states[item.status]||item.status,alerts[item.notification_state]||'확인 필요'])row.append(el('td',value));
   const actions=el('td',null,'row-actions'),button=el('button','상세');button.type='button';button.onclick=()=>void detail(item.id);actions.append(button);row.append(actions);
   row.onclick=e=>{if(!e.target.closest('button,a'))void detail(item.id);};body.append(row);
  }
  if(!data.requests.length){const row=el('tr'),cell=el('td','조건에 맞는 문의·아이디어가 없습니다.','empty-list');cell.colSpan=7;row.append(cell);body.append(row);}
  table.append(head,body);wrap.append(table);$('support-list').replaceChildren(wrap);
  const pages=Math.max(1,Math.ceil(data.total/view.size));$('support-count').textContent=`총 ${data.total}건`;
  $('support-page').textContent=`${view.page} / ${pages}`;$('support-prev').disabled=view.page<=1;$('support-next').disabled=view.page>=pages;
 }
 async function load(){
  const current=++ticket,session=generation;status('문의·아이디어를 불러오는 중…');$('support-refresh').disabled=true;
  try{const data=await request({action:'list',...view});if(current!==ticket||session!==generation)return;
   const last=Math.max(1,Math.ceil(data.total/view.size));if(view.page>last){view.page=last;return load();}
   render(data);status('');if(deepId){const id=deepId;deepId=null;try{sessionStorage.removeItem('mental:support:target');}catch{}void detail(id);}
  }catch(e){if(current===ticket&&session===generation){$('support-list').replaceChildren();status(e.message,true);}}
  finally{if(current===ticket&&session===generation)$('support-refresh').disabled=false;}
 }
 async function detail(id){
  const current=++detailTicket,session=generation;clearDetail();$('support-detail-status').textContent='내용을 불러오는 중…';
  if(!$('support-detail-dialog').open)$('support-detail-dialog').showModal();$('support-detail-close').focus();
  try{const data=await request({action:'detail',id});if(current!==detailTicket||session!==generation||!$('support-detail-dialog').open)return;
   const item=data.requests[0],fields=$('support-detail-fields');
   for(const [label,value] of [['접수 번호',item.id],['유형',item.category],['제목',item.subject||'없음'],['보낸 사람',item.nickname||(item.is_guest?'게스트':'프로필 미설정')],['회신 이메일',item.reply_email||'없음'],['접수 시각 (KST)',date(item.created_at)],['상태',states[item.status]||item.status],['Slack 알림',alerts[item.notification_state]||'확인 필요']])fields.append(el('dt',label),el('dd',value));
   $('support-detail-body').textContent=item.content||'';
   if(item.has_attachment){
    let url;try{url=new URL(item.attachmentUrl);}catch{}
    if(url?.protocol==='https:'&&url.hostname.endsWith('.supabase.co')&&url.pathname.startsWith('/storage/v1/object/sign/mental-media/')){
     const image=el('img');image.src=url.href;image.alt='제출한 아이디어 첨부 사진';image.referrerPolicy='no-referrer';
     image.onerror=()=>{if(current!==detailTicket||session!==generation)return;$('support-detail-attachment').replaceChildren(el('p','첨부 사진을 불러오지 못했습니다. 상세 화면을 다시 열어 주세요.','helper'));};
     const link=el('a','사진 크게 보기');link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';$('support-detail-attachment').append(image,link);
    }else $('support-detail-attachment').append(el('p','첨부 사진을 불러오지 못했습니다. 상세 화면을 다시 열어 주세요.','helper'));
   }
   $('support-detail-status').textContent='';
  }catch(e){if(current===detailTicket&&session===generation)$('support-detail-status').textContent=e.message;}
 }
 function clearDetail(){$('support-detail-fields').replaceChildren();$('support-detail-body').textContent='';$('support-detail-attachment').replaceChildren();$('support-detail-status').textContent='';}
 const close=()=>{detailTicket++;$('support-detail-dialog').close();clearDetail();};
 $('support-refresh').onclick=()=>void load();
 $('support-search-form').onsubmit=e=>{e.preventDefault();view.query=$('support-search').value.trim();view.category=$('support-category').value;view.page=1;void load();};
 $('support-category').onchange=()=>{view.category=$('support-category').value;view.page=1;void load();};
 $('support-search-clear').onclick=()=>{view.query='';view.category='';view.page=1;$('support-search').value='';$('support-category').value='';void load();};
 $('support-size').onchange=e=>{view.size=Number(e.target.value);view.page=1;void load();};
 $('support-prev').onclick=()=>{view.page--;void load();};$('support-next').onclick=()=>{view.page++;void load();};
 $('support-detail-close').onclick=close;$('support-detail-done').onclick=close;$('support-detail-dialog').addEventListener('close',()=>{detailTicket++;clearDetail();});
 return {load,clear:()=>{generation++;ticket++;detailTicket++;view.page=1;view.query='';view.category='';$('support-search').value='';$('support-category').value='';$('support-list').replaceChildren();$('support-count').textContent='';$('support-page').textContent='';$('support-status').textContent='';$('support-refresh').disabled=false;if($('support-detail-dialog').open)$('support-detail-dialog').close();clearDetail();}};
}
