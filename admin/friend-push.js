import { memberUids } from './push-controls.js';
const names={pending:'대기',generating:'생성 중',saved:'대화 저장 완료',skipped:'건너뜀',failed:'실패',sending:'전송 중',sent:'FCM 접수'};
const reasons={settings_changed:'설정 변경·자동 발송 중단',consent_withdrawn:'수신 동의 철회',outside_window:'발송 시간 외',friend_or_room_removed:'친구·대화방 삭제',credits_changed:'대화권 조건 변경',subscription_changed:'구독 상태 변경',payment_changed:'결제 상태 변경',user_active:'사용자가 대화 중',no_supported_device:'지원 앱·기기 없음',generation_skipped:'선톡이 부적절하여 생략',generation_failed:'생성 실패',generation_provider_failed:'AI 제공사 오류',generation_incomplete:'생성 답변 미완료',generation_outcome_unknown:'생성 결과 미확인 · 자동 재생성 안 함',delivery_outcome_unknown:'푸시 결과 미확인 · 자동 재전송 안 함',invalid_token:'유효하지 않은 기기 토큰',provider_rejected:'푸시 제공사 거절',device_changed:'기기·알림 설정 변경'};
const date=value=>value?new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul',hour12:false}):'—';
const el=(tag,text,cls)=>{const e=document.createElement(tag);if(text!=null)e.textContent=text;if(cls)e.className=cls;return e;};
export function createFriendPush(client,root){
 let settings=null,revision=0,generation=0,busy=false,preview=null,requestId=null,page=1,total=0,dirty=false;
 const fields={},status=el('p',null,'helper');status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 const details=el('details',null,'friend-push-panel'),summary=el('summary','친구 선톡 · 배치 / CRM');details.append(summary);
 const heading=el('div',null,'section-heading');heading.append(el('h2','친구 선톡'));
 const refresh=el('button','새로고침');refresh.type='button';heading.append(refresh);details.append(heading);
 const base=el('p',null,'helper');details.append(base);
 const form=el('form'),grid=el('div',null,'friend-push-grid');form.append(grid);
 function field(key,label,type='number',options){
  const wrap=el('label',label),input=el(options?'select':'input');input.id='friend-push-'+key;
  if(options){for(const [value,name]of options){const option=el('option',name);option.value=value;input.append(option);}}
  else input.type=type;
  if(type==='number'){input.min=key==='min_credits'||key==='inactive_hours'?'0':'1';input.step='1';}
  fields[key]=input;wrap.append(input);grid.append(wrap);return input;
 }
 field('enabled','자동 선톡','checkbox');
 field('audience','대상 사용자','text',[['active_paid','현재 실결제 구독 중'],['paid_history','실결제 이력 있음'],['all','전체 사용자']]);
 field('min_credits','현재 대화권 최소 잔액');
 field('interval_hours','사용자별 최소 간격 (시간)');
 field('inactive_hours','마지막 사용자 대화 후 (시간)');
 field('strategy','친구 선택 기준','text',[['recent','가장 최근 대화한 친구'],['most_messages','대화를 가장 많이 한 친구'],['random','조건에 맞는 친구 중 랜덤']]);
 field('start_hour','발송 시작 (KST 시)').min='8';fields.start_hour.max='20';
 field('end_hour','발송 종료 (KST 시)').max='21';
 field('batch_limit','한 배치 최대 사용자').max='100';
 field('daily_limit','사용자별 하루 최대 횟수').max='10';
 const promptLabel=el('label','선톡 전용 프롬프트'),prompt=el('textarea');prompt.rows=7;prompt.maxLength=8000;prompt.id='friend-push-prompt';fields.prompt=prompt;promptLabel.append(prompt);form.append(promptLabel);
 const note=el('p','현재 게시 성향 프롬프트·친구 소개·최근 대화·방별 기억을 함께 참고합니다. 선톡은 사용자 대화권을 차감하지 않습니다.','helper');form.append(note);
 const save=el('button','설정 저장','primary');save.type='submit';form.append(save);details.append(form,status);
 const crm=el('section');crm.append(el('h3','친구 메시지 보내기'));
 const uidLabel=el('label','대상 회원 UID (선택)'),uids=el('textarea');uids.rows=2;uids.placeholder='비워두면 저장된 대상 조건을 적용합니다';uids.id='friend-push-users';uidLabel.append(uids);crm.append(uidLabel);
 const modeLabel=el('label','메시지 작성'),mode=el('select');mode.id='friend-push-mode';for(const [v,n]of [['ai','AI가 친구 설정과 최근 대화로 생성'],['manual','직접 작성']]){const o=el('option',n);o.value=v;mode.append(o);}modeLabel.append(mode);crm.append(modeLabel);
 const textLabel=el('label','보낼 메시지'),text=el('textarea');text.id='friend-push-text';text.rows=3;text.maxLength=240;textLabel.append(text);textLabel.hidden=true;crm.append(textLabel);
 const actions=el('div',null,'friend-push-actions'),count=el('p','대상을 먼저 확인해 주세요.','helper'),check=el('button','대상 미리보기'),send=el('button','이번 배치 보내기','primary');send.disabled=true;check.type=send.type='button';actions.append(check,send);crm.append(actions,count);const samples=el('div',null,'collection-scroll');crm.append(samples);details.append(crm);
 const history=el('section'),historyHead=el('div',null,'section-heading');historyHead.append(el('h3','선톡 전송 기록'));
 const stateFilter=el('select');stateFilter.id='friend-push-history-state';stateFilter.setAttribute('aria-label','선톡 기록 상태');for(const [value,name]of [['all','모든 상태'],...Object.entries(names).filter(([k])=>['pending','generating','saved','skipped','failed'].includes(k))]){const o=el('option',name);o.value=value;stateFilter.append(o);}historyHead.append(stateFilter);history.append(historyHead);
 const historyTable=el('div',null,'collection-scroll'),pager=el('div',null,'pagination'),previous=el('button','이전'),next=el('button','다음'),pageLabel=el('span');previous.type=next.type='button';pager.append(previous,pageLabel,next);history.append(historyTable,pager,el('p','FCM 접수는 실제 기기 노출과 다릅니다. 열람은 알림 탭이 서버에 확인된 경우만 표시합니다.','helper'));details.append(history);root.append(details);
 const dialog=el('dialog',null,'friend-push-detail'),close=el('button','닫기'),detailBody=el('div');close.type='button';close.onclick=()=>dialog.close();dialog.append(close,detailBody);root.append(dialog);
 function message(value,error=false){status.textContent=value;status.classList.toggle('error',error);}
 function invalidate(){preview=null;send.disabled=true;requestId=null;count.textContent='대상을 다시 확인해 주세요.';samples.replaceChildren();}
 form.addEventListener('input',()=>{dirty=true;invalidate();});uids.oninput=mode.onchange=text.oninput=()=>{textLabel.hidden=mode.value!=='manual';invalidate();};
 async function api(payload){
  const session=await client().auth.getSession();if(!session.data.session)throw Error('관리자 로그인이 필요합니다.');
  const {data,error}=await client().functions.invoke('admin-friend-push',{method:'POST',body:payload});
  if(error){let code;try{code=(await error.context.clone().json()).error;}catch{}
   throw Error(({revision_conflict:'다른 관리자가 설정을 변경했습니다. 새로고침 후 다시 확인해 주세요.',invalid_settings:'대상 조건과 시간·프롬프트를 확인해 주세요.',invalid_users:'회원 UID는 올바른 형식으로 최대 100명까지 입력해 주세요.',invalid_text:'메시지는 1~240자로 입력해 주세요.'})[code]??'친구 선톡 요청을 완료하지 못했습니다. 다시 시도해 주세요.');}
  return data;
 }
 function populate(value){settings=value;revision=value.revision;for(const [key,input]of Object.entries(fields)){if(input.type==='checkbox')input.checked=value[key];else input.value=value[key];}dirty=false;invalidate();}
 function table(headers,rows){const t=el('table',null,'collection-table admin-record-table'),head=el('thead'),r=el('tr'),body=el('tbody');for(const h of headers){const th=el('th',h);th.scope='col';r.append(th);}head.append(r);t.append(head,body);for(const row of rows){const tr=el('tr');for(const value of row){const td=el('td');if(value instanceof Node)td.append(value);else td.textContent=value??'—';tr.append(td);}body.append(tr);}return t;}
 async function loadHistory(){
  const ticket=generation;try{const data=await api({action:'list',page,size:20,status:stateFilter.value});if(ticket!==generation)return;total=data.total;
   historyTable.replaceChildren(table(['생성 시각 (KST)','대상 회원','친구 · 선택','메시지','생성·저장','푸시 접수 / 실패 / 열람','상세'],data.items.map(item=>{
    const button=el('button','상세');button.type='button';button.onclick=()=>openDetail(item.id);const d=item.deliveries??[];
    return [date(item.created_at),item.user_id,item.friend_snapshot.nickname+' · '+({recent:'최근 대화',most_messages:'대화량',random:'랜덤'})[item.selection.strategy],item.message_text??'—',names[item.status]+(item.error_code?' · '+(reasons[item.error_code]??item.error_code):''),`${d.filter(x=>x.status==='sent').length} / ${d.filter(x=>x.status==='failed').length} / ${d.filter(x=>x.opened_at).length}`,button];
   })));
   if(!data.items.length)historyTable.append(el('p','조건에 맞는 선톡 기록이 없습니다.','helper'));
   pageLabel.textContent=`${page} / ${Math.max(1,Math.ceil(total/20))} · ${total}건`;previous.disabled=page===1;next.disabled=page*20>=total;
  }catch(error){if(ticket===generation)message(error.message,true);}
 }
 async function openDetail(id){
  const ticket=generation;try{const {job,run,deliveries}=await api({action:'detail',id});if(ticket!==generation)return;
   detailBody.replaceChildren(el('h2','선톡 전송 상세'));const dl=el('dl',null,'detail-fields');
   for(const [label,value]of [['작업 ID',job.id],['대상 회원',job.user_id],['대화방',job.room_id],['메시지 ID',job.message_id],['발송 경로',run.source==='batch'?'자동 배치':'관리자 CRM'],['친구',`${job.friend_snapshot.nickname} (${job.friend_id})`],['메시지',job.message_text],['상태',names[job.status]],['실패·건너뜀 이유',reasons[job.error_code]??job.error_code],['선택 이유',JSON.stringify(job.selection,null,2)],['생성 시각 (KST)',date(job.created_at)],['처리 완료 (KST)',date(job.completed_at)],['프롬프트 버전',job.prompt_revision??(run.manual_text?'직접 작성':'—')],['생성 시간',job.generation_ms!=null?`${job.generation_ms}ms`:'—'],['입력 / 출력 토큰',`${job.input_tokens??'—'} / ${job.output_tokens??'—'}`]]){dl.append(el('dt',label),el('dd',value??'—'));}detailBody.append(dl);
   detailBody.append(el('h3','기기별 푸시 결과'),table(['플랫폼','상태','이유','FCM 접수 (KST)','열람 (KST)'],deliveries.map(d=>[d.mb_push_devices?.platform??'삭제된 기기',names[d.status],reasons[d.error_code]??d.error_code,date(d.sent_at),date(d.opened_at)])));
   for(const [title,value]of [['적용한 발송 조건',run.settings],['적용한 프롬프트',job.prompt_snapshot]]){const section=el('details'),s=el('summary',title),pre=el('pre',JSON.stringify(value,null,2));section.append(s,pre);detailBody.append(section);}
   if(!dialog.open)dialog.showModal();close.focus();
  }catch(error){message(error.message,true);}
 }
 async function load(){
  const ticket=++generation;try{const data=await api({action:'state'});if(ticket!==generation)return;populate(data.settings);base.textContent=`현재 게시 성향 프롬프트: ${data.publishedPromptRevision==null?'코드 기본값':'revision '+data.publishedPromptRevision} · ${data.configured?'배치 서버 연결됨':'배치 서버 설정 확인 필요'}`;message('');await loadHistory();}catch(error){if(ticket===generation)message(error.message,true);}
 }
 form.onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;save.disabled=true;const ticket=generation;
  try{const value=Object.fromEntries(Object.entries(fields).map(([key,input])=>[key,input.type==='checkbox'?input.checked:input.type==='number'?Number(input.value):input.value]));
   if(value.enabled&&!settings.enabled&&!confirm('저장하면 조건에 맞는 사용자에게 자동 선톡을 시작합니다. 활성화할까요?'))return;
   const data=await api({action:'save',revision,settings:value});if(ticket!==generation)return;populate(data.settings);message('선톡 설정을 저장했습니다.');
  }catch(error){if(ticket===generation)message(error.message,true);}finally{busy=false;save.disabled=false;}
 };
 check.onclick=async()=>{if(busy)return;if(dirty){message('변경한 선톡 설정을 먼저 저장해 주세요.',true);return;}busy=true;check.disabled=true;const ticket=generation;
  try{const ids=memberUids(uids.value);const data=await api({action:'preview',revision,...(ids.length?{userIds:ids}:{})});if(ticket!==generation)return;preview={...data,userIds:ids};requestId=crypto.randomUUID();
   count.textContent=`대상 ${data.recipients}명 · 지원 앱 기기 ${data.devices}대 · 이번 배치 최대 ${Math.min(data.recipients,data.batchLimit)}명`;send.disabled=!data.recipients;
   samples.replaceChildren(table(['대상 회원','선택 친구','대화방','대화 수 / 현재 대화권'],data.samples.map(s=>[s.user_id,s.friend_name,s.room_id,`${s.selection.userMessages} / ${s.selection.availableCredits}`])));message('수신 동의·대화권·간격·지원 앱을 확인한 대상입니다.');
  }catch(error){if(ticket===generation)message(error.message,true);}finally{busy=false;check.disabled=false;}
 };
 send.onclick=async()=>{if(busy||!preview||dirty)return;if(mode.value==='manual'&&!text.value.trim()){message('보낼 메시지를 입력해 주세요.',true);return;}
  if(!confirm(`저장된 조건으로 최대 ${Math.min(preview.recipients,preview.batchLimit)}명에게 친구 메시지를 보낼까요? 발송 직전에 대상을 다시 확인합니다.`))return;
  busy=true;send.disabled=true;const ticket=generation;
  try{const result=await api({action:'queue',revision,requestId,...(preview.userIds.length?{userIds:preview.userIds}:{}),...(mode.value==='manual'?{text:text.value.trim()}:{})});if(ticket!==generation)return;
   if(result.outsideWindow){message('현재는 설정한 발송 시간 밖입니다. 발송 시간 안에 다시 실행해 주세요.',true);send.disabled=false;return;}
   invalidate();message(`${result.queued??0}명의 선톡 작업을 등록했습니다. 배치가 생성·저장·푸시를 순서대로 처리합니다.`);page=1;await loadHistory();
  }catch(error){if(ticket===generation){message(error.message,true);send.disabled=false;}}finally{busy=false;}
 };
 refresh.onclick=()=>{if(dirty&&!confirm('저장하지 않은 설정을 버리고 새로고침할까요?'))return;void load();};previous.onclick=()=>{page--;void loadHistory();};next.onclick=()=>{page++;void loadHistory();};stateFilter.onchange=()=>{page=1;void loadHistory();};
 return {load,clear(){generation++;settings=null;preview=null;dirty=false;busy=false;historyTable.replaceChildren();samples.replaceChildren();status.textContent='';if(dialog.open)dialog.close();},hasUnsavedChanges:()=>dirty};
}
