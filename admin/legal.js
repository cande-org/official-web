import {nextLegalVersion, withLegalFooter} from './legal-versioning.js';

// Plain-text versioned documents. Published versions remain read-only.
export function createLegalDocuments(getClient) {
  const $=id=>document.getElementById(id);
  let data=null, generation=0, busy=false, dirty=false, active=null;
  const node=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};
  const status=(text,error=false)=>{$('legal-status').textContent=text;$('legal-status').className=error?'error':'';const inline=$('legal-dialog-status');if(inline){inline.textContent=text;inline.className=error?'error':'';}};
  function clear(){generation++;data=null;active=null;dirty=false;busy=false;$('legal-form').inert=false;$('legal-close').disabled=false;$('legal-new').disabled=false;$('legal-versions').disabled=false;$('legal-list').replaceChildren();$('legal-dialog').close();status('');}
  async function request(body){const {data,error}=await getClient().functions.invoke('admin-legal',{method:body?'POST':'GET',...(body?{body}:{})});if(error)throw Error(error.context?.status===409?'문서 버전이 충돌합니다. 새 버전 이름을 사용하거나 서버 내용을 다시 불러와 주세요.':'약관 요청에 실패했습니다. 관리자 권한과 연결을 확인해 주세요.');return data;}
  function render(){
    $('legal-list').replaceChildren();
    for(const doc of data.documents){
      const item=node('article');item.className='item';const info=node('div');
      const current=doc.versions.find(v=>v.id===doc.currentVersionId);
      info.append(node('h3',doc.label),node('p',current?`공개 v${current.version} · 시행 ${current.effectiveOn}`:'미공개'),node('p',doc.needsChoice?(doc.required?'필수 동의':'선택 동의'):'조회 문서'));
      const open=node('button','버전 관리');open.type='button';open.onclick=()=>openDocument(doc);item.append(info,open);$('legal-list').append(item);
    }
  }
  function openDocument(doc){
    if(dirty&&!confirm('저장하지 않은 내용을 버릴까요?'))return;
    status('');active={doc,version:null};dirty=false;$('legal-dialog-title').textContent=doc.label;
    const versions=$('legal-versions');versions.replaceChildren();
    for(const version of doc.versions){const option=node('option',`v${version.version} · ${version.publishedAt?'공개됨':'초안'} · 시행 ${version.effectiveOn}`);option.value=version.id;versions.append(option);}
    fill(doc.versions.find(v=>!v.publishedAt)??doc.versions.find(v=>v.id===doc.currentVersionId)??null);
    if(!$('legal-dialog').open)$('legal-dialog').showModal();
  }
  function syncFooter(){
    const body=$('legal-body');
    const next=withLegalFooter(body.value,$('legal-version').value,$('legal-effective').value);
    const changed=next!==body.value;
    if(changed)body.value=next;
    if(!active.version){const option=$('legal-versions').querySelector('option[value=""]');if(option)option.textContent=`새 초안 · v${$('legal-version').value}`;}
    return changed;
  }
  function fill(version, source=null){
    active.version=version;dirty=false;
    const seed=version??source;
    $('legal-version').value=version?.version??nextLegalVersion(active.doc.versions);$('legal-title').value=seed?.title??active.doc.label;
    $('legal-effective').value=seed?.effectiveOn??'2026-10-05';$('legal-body').value=seed?.body??'';
    const versions=$('legal-versions');const draft=versions.querySelector('option[value=""]');
    if(version){draft?.remove();versions.value=version.id;}else{if(!draft){const option=node('option');option.value='';versions.prepend(option);}versions.value='';}
    const locked=!!version?.publishedAt;
    if(!locked)dirty=syncFooter()||!version;
    for(const id of ['legal-version','legal-title','legal-effective','legal-body'])$(id).readOnly=locked;
    $('legal-save').disabled=locked;$('legal-publish').disabled=locked;
    $('legal-dialog-hint').textContent=locked?'공개한 본문은 수정할 수 없습니다. ‘새 버전 초안’을 만들어 변경하세요.':'초안 저장 후 공개하면 앱에서 이 버전을 읽습니다. 필수 약관의 새 버전에는 다시 동의를 받습니다.';
  }
  async function load(){if(busy)return;busy=true;const gen=generation;status('약관을 불러오는 중…');try{const result=await request();if(gen!==generation)return;data=result;render();status('');}catch(error){if(gen===generation)status(error.message,true);}finally{if(gen===generation)busy=false;}}
  async function save(publish){
    if(busy||!active||!$('legal-form').reportValidity())return;
    syncFooter();
    if(publish&&!confirm('이 문서 버전을 앱에 공개할까요? 기존 공개 본문은 이력으로 보존되고, 필수 약관은 이용자에게 다시 동의를 요청합니다.'))return;
    busy=true;const gen=generation;const key=active.doc.key;$('legal-form').inert=true;$('legal-close').disabled=true;$('legal-new').disabled=true;$('legal-versions').disabled=true;status('문서를 저장하는 중…');
    try{const result=await request({action:publish?'publish':'save',key,revision:active.doc.revision,id:active.version?.id??null,version:$('legal-version').value.trim(),title:$('legal-title').value.trim(),effectiveOn:$('legal-effective').value,body:$('legal-body').value});
      if(gen!==generation)return;data=result;dirty=false;render();
      if(publish){$('legal-dialog').close();active=null;}else openDocument(data.documents.find(d=>d.key===key));
      status(publish?'앱에 공개했습니다.':'초안을 저장했습니다. 앱에는 공개 전까지 반영되지 않습니다.');
    }catch(error){if(gen===generation)status(error.message,true);}finally{if(gen===generation){busy=false;$('legal-form').inert=false;$('legal-close').disabled=false;$('legal-new').disabled=false;$('legal-versions').disabled=false;}}
  }
  $('legal-refresh').onclick=()=>{if(!dirty||confirm('편집 내용을 버리고 서버에서 다시 불러올까요?')){dirty=false;$('legal-dialog').close();void load();}};
  $('legal-close').onclick=()=>{if(!dirty||confirm('저장하지 않은 편집 내용을 버릴까요?')){$('legal-dialog').close();dirty=false;}};
  $('legal-dialog').addEventListener('cancel',event=>{if(busy||dirty&&!confirm('저장하지 않은 내용을 버릴까요?'))event.preventDefault();else dirty=false;});
  $('legal-new').onclick=()=>{const prev=active?.version;if(!active||busy||dirty&&!confirm('저장하지 않은 내용을 버릴까요?'))return;status('');fill(null,prev);$('legal-version').focus();dirty=true;};
  $('legal-versions').onchange=()=>{if(!active||busy)return;if(dirty&&!confirm('저장하지 않은 내용을 버릴까요?')){$('legal-versions').value=active.version?.id??'';return;}const version=active.doc.versions.find(v=>v.id===$('legal-versions').value);if(version){status('');fill(version);}};
  $('legal-form').oninput=event=>{dirty=true;if(['legal-version','legal-effective'].includes(event.target.id))syncFooter();};
  $('legal-form').onsubmit=event=>{event.preventDefault();void save(false);};$('legal-publish').onclick=()=>void save(true);
  return {load,clear,hasUnsaved:()=>dirty};
}
