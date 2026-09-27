import { renderTrend, renderRetention, clearCharts, disposeChart, resizeCharts } from './charts.js';
import { createClient } from '@supabase/supabase-js';
const $ = (id) => document.getElementById(id);
let client, snapshot, dirty = false, busy = false, activeTab = 'dashboard', authGeneration = 0;
const status = (message, error = false) => { $('status').textContent = message; $('status').className = error ? 'error' : ''; };
const node = (tag, text, className) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; };
const mobileMenu = matchMedia('(max-width: 760px)');
let menuOpen = false;
function setMenu(open, restoreFocus = true) {
  menuOpen = open && mobileMenu.matches;
  document.body.classList.toggle('menu-open', menuOpen);
  $('menu-backdrop').hidden = !menuOpen;
  $('menu-toggle').setAttribute('aria-expanded', String(menuOpen));
  $('workspace').inert = menuOpen;
  $('sidebar').inert = mobileMenu.matches && !menuOpen;
  if (menuOpen) $('menu-close').focus();
  else if (restoreFocus && mobileMenu.matches) $('menu-toggle').focus();
}
function shell(visible) {
  document.body.classList.toggle('signed-in', visible);
  $('sidebar').hidden = !visible; $('topbar').hidden = !visible;
  setMenu(false, false);
}
$('menu-toggle').onclick = () => setMenu(true);
$('menu-close').onclick = () => setMenu(false);
$('menu-backdrop').onclick = () => setMenu(false);
mobileMenu.addEventListener('change', () => setMenu(false, false));
document.addEventListener('keydown', e => {
  if (!menuOpen) return;
  if (e.key === 'Escape') { e.preventDefault(); setMenu(false); }
  if (e.key === 'Tab') {
    const items = [...$('sidebar').querySelectorAll('a,button:not([disabled])')].filter(el => !el.hidden);
    const first = items[0], last = items.at(-1);
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
const pageMeta = {
  dashboard: ['대시보드', '서비스의 사용과 성장을 한눈에 확인하세요.'],
  products: ['상점 상품', '상품의 노출, 순서와 소개를 관리하세요.'],
  faqs: ['자주 묻는 질문', '사용자가 궁금해하는 질문과 답변을 관리하세요.'],
  notice: ['결제 안내', '상점 하단에 표시되는 결제 안내를 편집하세요.'],
  admins: ['관리자', '운영 콘솔의 접근 권한과 변경 이력을 관리하세요.']
};
function markDirty() { dirty = true; $('dirty').textContent = '저장하지 않은 변경사항'; }
function field(label, value, onInput, { type = 'text', maxLength, wide = false } = {}) {
  const wrapper = node('label', label, wide ? 'wide' : '');
  const input = node(type === 'textarea' ? 'textarea' : 'input');
  if (type !== 'textarea') input.type = type;
  input.value = value; input.required = true;
  if (maxLength) input.maxLength = maxLength;
  if (type === 'number') { input.min = '1'; input.max = '1000000'; input.step = '1'; }
  if (type === 'textarea') input.rows = 5;
  input.addEventListener('input', () => { onInput(type === 'number' ? Number(input.value) : input.value); markDirty(); });
  wrapper.append(input); return wrapper;
}
function action(text, handler) { const b = node('button', text); b.type = 'button'; b.addEventListener('click', handler); return b; }
function itemTop(list, item, index, title, removable = false) {
  const top = node('div', null, 'item-top'); top.append(node('h3', title));
  const check = node('label', null, 'check'), input = node('input'); input.type = 'checkbox'; input.checked = item.enabled;
  input.addEventListener('change', () => { item.enabled = input.checked; markDirty(); }); check.append(input, document.createTextNode('앱에 노출')); top.append(check);
  for (const [label, delta] of [['위로', -1], ['아래로', 1]]) {
    const b = action(label, () => { [list[index], list[index + delta]] = [list[index + delta], list[index]]; markDirty(); render(); });
    b.disabled = index + delta < 0 || index + delta >= list.length; b.setAttribute('aria-label', `${title} ${label}`); top.append(b);
  }
  if (removable) top.append(action('삭제', () => { if (confirm('이 질문을 초안에서 삭제할까요? 공개 전까지 앱에는 유지됩니다.')) { list.splice(index, 1); markDirty(); render(); } }));
  return top;
}
function render() {
  shell(true); $('login').hidden = true; $('editor').hidden = false; $('logout').hidden = false;
  $('revision').textContent = `초안 v${snapshot.revision} · 공개 v${snapshot.published_revision} · ${new Date(snapshot.published_at).toLocaleString('ko-KR')}`;
  $('dirty').textContent = dirty ? '저장하지 않은 변경사항' : '저장된 초안';
  const products = snapshot.draft.products; $('product-list').replaceChildren();
  products.forEach((p, i) => {
    const contract = snapshot.contracts.find((c) => c.key === p.key);
    const box = node('article', null, 'item'); box.append(itemTop(products, p, i, p.title));
    box.append(node('p', `${contract.id} · ${contract.subscription ? '매월' : '구매당'} ${contract.credits}회 지급`, 'contract'));
    const fields = node('div', null, 'fields');
    fields.append(field('상품 이름', p.title, (v) => p.title = v, { maxLength: 40 }), field('참고 가격 (원)', p.referencePriceKrw, (v) => p.referencePriceKrw = v, { type: 'number' }), field('상품 소개', p.description, (v) => p.description = v, { maxLength: 160, wide: true }));
    box.append(fields); $('product-list').append(box);
  });
  const faqs = snapshot.draft.faqs; $('faq-list').replaceChildren();
  faqs.forEach((f, i) => {
    const box = node('article', null, 'item'); box.append(itemTop(faqs, f, i, `질문 ${i + 1}`, true));
    const fields = node('div', null, 'fields'); fields.append(field('질문', f.question, (v) => f.question = v, { maxLength: 160, wide: true }), field('답변', f.answer, (v) => f.answer = v, { type: 'textarea', maxLength: 3000, wide: true }));
    const label = node('label', '답변 아래 연결'), select = node('select');
    for (const [value, title] of [['none', '없음'], ['passes', '내 이용권 이동하기']]) { const option = node('option', title); option.value = value; select.append(option); }
    select.value = f.action; select.addEventListener('change', () => { f.action = select.value; markDirty(); }); label.append(select); fields.append(label); box.append(fields); $('faq-list').append(box);
  });
  $('payment-notice').value = snapshot.draft.paymentNotice;
  selectTab(activeTab);
}
function selectTab(tab) {
  const changed = activeTab !== tab;
  activeTab = tab;
  $('page-title').textContent = pageMeta[tab][0];
  $('page-description').textContent = pageMeta[tab][1];
  $('breadcrumb-current').textContent = pageMeta[tab][0];
  $('reload').hidden = ['dashboard', 'admins'].includes(tab);
  $('revision').hidden = ['dashboard', 'admins'].includes(tab);
  if (menuOpen) { setMenu(false, false); $('page-title').focus({ preventScroll: true }); }
  if (changed) { status(''); window.scrollTo({ top: 0, behavior: 'instant' }); }
  $('form').hidden = ['dashboard', 'admins'].includes(tab);
  if (tab === 'dashboard') { resizeCharts(); void loadMetrics(); }
  if (tab === 'admins') void loadAdmins();
  for (const name of ['dashboard', 'products', 'faqs', 'notice', 'admins']) $(name).hidden = name !== tab;
  document.querySelectorAll('[data-tab]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tab === tab)));
}
async function request(body) {
  const { data: { session }, error } = await client.auth.getSession();
  if (error || !session) throw Error('로그인이 필요합니다.');
  const { data, error: failure } = await client.functions.invoke('admin-content', { method: body ? 'POST' : 'GET', ...(body ? { body } : {}) });
  if (failure) {
    const code = failure.context?.status;
    throw Error(code === 403 ? '관리자로 허용되지 않은 계정입니다. 담당자에게 접근 권한을 요청해 주세요.' : code === 409 ? '다른 관리자가 먼저 저장했습니다. 변경 내용을 복사한 뒤 서버 내용을 다시 불러와 주세요.' : code === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : '요청을 완료하지 못했습니다. 네트워크를 확인하고 다시 시도해 주세요.');
  }
  return data;
}
async function load() {
  if (busy) return;
  const generation = authGeneration;
  busy = true; status('콘텐츠를 불러오는 중…');
  try { const result = await request(); if (generation !== authGeneration) return; snapshot = result; dirty = false; render(); status(''); }
  catch (error) { status(error.message, true); }
  finally { busy = false; }
}
async function save(publish) {
  if (busy) return;
  // Validate hidden panels too and reveal the first invalid field.
  const invalid = $('form').querySelector(':invalid');
  if (invalid) { selectTab(invalid.closest('section').id); invalid.reportValidity(); return; }
  if (publish && !confirm('현재 초안을 앱에 공개할까요? 노출을 끈 상품은 새 구매 목록에서 숨겨집니다. 기존 구매·구독은 유지됩니다.')) return;
  const generation = authGeneration;
  busy = true; $('editor').inert = true; status(publish ? '공개 중…' : '저장 중…');
  try { const result = await request({ action: publish ? 'publish' : 'save', revision: snapshot.revision, content: snapshot.draft }); if (generation !== authGeneration) return; snapshot = result; dirty = false; render(); status(publish ? '앱에 공개했습니다.' : '초안을 저장했습니다. 앱에는 아직 반영되지 않았습니다.'); }
  catch (error) { status(error.message, true); }
  finally { busy = false; $('editor').inert = false; }
}
$('form').addEventListener('submit', (e) => { e.preventDefault(); save(false); });
$('publish').onclick = () => save(true);
$('reload').onclick = () => { if (!dirty || confirm('저장하지 않은 변경사항을 버리고 다시 불러올까요?')) load(); };
$('payment-notice').oninput = (e) => { snapshot.draft.paymentNotice = e.target.value; markDirty(); };
$('add-faq').onclick = () => { if (snapshot.draft.faqs.length >= 50) return status('질문은 최대 50개까지 등록할 수 있습니다.', true); snapshot.draft.faqs.push({ id: crypto.randomUUID(), question: '', answer: '', enabled: true, action: 'none' }); markDirty(); render(); $('faq-list').lastElementChild.querySelector('input:not([type=checkbox])').focus(); };
document.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => selectTab(b.dataset.tab));
$('preview').onclick = () => {
  const body = $('preview-body'); body.replaceChildren();
  for (const p of snapshot.draft.products.filter((p) => p.enabled)) { const section = node('section', null, 'preview-section'); section.append(node('h3', p.title), node('p', p.description), node('p', `참고 가격 ${p.referencePriceKrw.toLocaleString('ko-KR')}원`)); body.append(section); }
  for (const f of snapshot.draft.faqs.filter((f) => f.enabled)) { const section = node('section', null, 'preview-section'); section.append(node('h3', f.question), node('p', f.answer)); if (f.action === 'passes') section.append(node('p', '내 이용권 이동하기')); body.append(section); }
  body.append(node('h3', '결제 안내'), node('p', snapshot.draft.paymentNotice)); $('preview-dialog').showModal(); $('preview-dialog').scrollTop = 0; $('preview-title').focus({ preventScroll: true });
};
$('close-preview').onclick = () => $('preview-dialog').close();
window.addEventListener('beforeunload', (e) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } });
$('logout').onclick = async () => { if (dirty && !confirm('저장하지 않은 변경사항을 버리고 로그아웃할까요?')) return; authGeneration++; dirty = false; await client.auth.signOut({ scope: 'local' }); snapshot = null; $('editor').hidden = true; shell(false); clearMetrics(); clearAdmins(); $('login').hidden = false; $('logout').hidden = true; status('로그아웃했습니다.'); };
$('signin').onclick = async () => {
  if (!client) return;
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/admin`, queryParams: { prompt: 'select_account' } } });
  if (error) status('로그인을 시작하지 못했습니다.', true);
};

let adminsBusy = false;
function clearAdmins() {
  $('admin-list').replaceChildren(); $('admin-history').replaceChildren(); $('admin-email').value = ''; $('admin-status').textContent = '';
}
function renderAdmins(data) {
  $('admin-list').replaceChildren();
  for (const admin of data.admins) {
    const box = node('article', null, 'item admin-item'), info = node('div');
    const self = admin.email === data.currentEmail;
    info.append(node('strong', admin.email), node('p', `${admin.enabled ? '허용됨' : '해제됨'}${self ? ' · 현재 로그인 계정' : ''}`));
    const button = action(admin.enabled ? '권한 해제' : '다시 허용', () => {
      const label = admin.enabled ? '관리자에서 해제' : '관리자로 다시 허용';
      if (confirm(`${admin.email} 계정을 ${label}할까요?`)) void loadAdmins({ action: admin.enabled ? 'disable' : 'enable', email: admin.email });
    });
    button.disabled = self; button.setAttribute('aria-label', `${admin.email} ${admin.enabled ? '권한 해제' : '다시 허용'}`);
    box.append(info, button); $('admin-list').append(box);
  }
  const labels = { add: '추가', enable: '다시 허용', disable: '권한 해제', bootstrap: '최초 등록' };
  $('admin-history').replaceChildren(data.history.length ? metricTable(['시각 (KST)', '실행 관리자', '대상', '변경'], data.history.map(h => [new Date(h.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }), h.action === 'bootstrap' ? '최초 설정' : h.actor_email, h.target_email, labels[h.action] ?? h.action])) : node('p', '변경 이력이 없습니다.'));
}
async function loadAdmins(body) {
  if (!client || adminsBusy) return;
  adminsBusy = true; const generation = authGeneration;
  $('admins').inert = true; $('admin-status').textContent = body ? '권한을 반영하는 중…' : '관리자 목록을 불러오는 중…';
  try {
    const { data, error } = await client.functions.invoke('admin-access', { method: body ? 'POST' : 'GET', ...(body ? { body } : {}) });
    if (generation !== authGeneration) return;
    if (error) {
      let code; try { code = (await error.context.clone().json()).error; } catch { /* network failure */ }
      if ([401,403].includes(error.context?.status)) {
        authGeneration++; snapshot = null; dirty = false; clearMetrics(); clearAdmins(); $('editor').hidden = true; shell(false); $('login').hidden = false;
        status('관리자 권한이 없거나 로그인이 만료되었습니다. 허용된 계정으로 다시 로그인해 주세요.', true);
        return;
      }
      const messages = { admin_exists: '이미 등록된 계정입니다. 해제된 계정은 목록에서 다시 허용해 주세요.', admin_not_found: '목록이 변경되었습니다. 새로고침 후 다시 시도해 주세요.', invalid_email: '올바른 이메일 주소를 입력해 주세요.', last_admin: '마지막 관리자는 해제할 수 없습니다.', self_revoke: '현재 로그인한 본인의 권한은 해제할 수 없습니다.' };
      throw Error(messages[code] ?? '권한을 반영하지 못했습니다. 목록을 새로고침해 확인한 뒤 다시 시도해 주세요.');
    }
    renderAdmins(data); if (body?.action === 'add') $('admin-email').value = '';
    $('admin-status').textContent = body ? '관리자 권한을 반영했습니다.' : `허용된 관리자 ${data.admins.filter(a => a.enabled).length}명`;
  } catch (error) { if (generation === authGeneration) { if (!body) { $('admin-list').replaceChildren(); $('admin-history').replaceChildren(); } $('admin-status').textContent = error.message; } }
  finally { adminsBusy = false; $('admins').inert = false; }
}
$('admin-add-form').addEventListener('submit', e => { e.preventDefault(); const email = $('admin-email').value.trim().toLowerCase(); if (confirm(`${email} 계정에 콘텐츠·지표·관리자 관리 권한을 부여할까요?`)) void loadAdmins({ action: 'add', email }); });
$('admin-refresh').onclick = () => loadAdmins();

function clearMetrics() {
  clearCharts();
  for (const id of ['metric-cards','metric-chart','metric-table','growth-overview','growth-conversion','growth-retention','growth-commerce']) $(id).replaceChildren();
}
const number = value => Number(value ?? 0).toLocaleString('ko-KR');
const ratio = (n,d) => d > 0 ? `${(100*n/d).toFixed(1)}% · ${number(n)} / ${number(d)}명` : '— 관찰 대상 없음';
function metricCards(target, title, items, note) {
  const section = $(target); section.replaceChildren(node('h3',title));
  if(note) section.append(node('p',note,'metric-note'));
  const cards=node('div',null,'metric-cards');
  for(const [label,value,detail] of items){const card=node('article',null,'metric-card');card.append(node('span',label),node('strong',value));if(detail)card.append(node('small',detail));cards.append(card);}section.append(cards);
}
function metricTable(headers, rows) {
  const table=node('table'),head=node('thead'),tr=node('tr'),body=node('tbody');
  for(const label of headers){const th=node('th',label);th.scope='col';tr.append(th);}head.append(tr);table.append(head);
  for(const values of rows){const row=node('tr');for(const value of values)row.append(node('td',value));body.append(row);}table.append(body);return table;
}
function renderGrowth(data) {
  if(data.schemaVersion!==2){clearMetrics();throw Error('확장 지표를 준비 중입니다. 잠시 후 다시 조회해 주세요.');}
  const g=data.growth,c=data.cohorts.summary,coverage=data.coverage;
  const kst = value => new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'});
  metricCards('growth-overview','사용과 재방문',[
    ['기간 활성 사용자',number(g.activeUsers)+'명','게스트·회원 합산, 중복 제거'],
    ['기간 재방문율',g.activeUsers ? (100*g.returningUsers/g.activeUsers).toFixed(1)+'%' : '—',`${number(g.returningUsers)} / ${number(g.activeUsers)}명 · 다른 날 다시 활동`],
    ['DAU / WAU / MAU',`${number(g.dau)} / ${number(g.wau)} / ${number(g.mau)}`,'최근 완결 1일 / 7일 / 30일의 고유 사용자']
  ],`서버 활동 기준 · 최근 완결일 ${coverage.lastCompleteDay}. 신규 수집 시작 ${kst(coverage.growthStartedAt)}. 수집 시작 이전은 완전한 활동 이력이 아니며 초기 WAU·MAU는 일부 기간만 관찰됩니다.`);
  const conversion=$('growth-conversion');conversion.replaceChildren(node('h3','가입 후 7일 전환'));
  conversion.append(node('p',`선택 기간에 가입하고 168시간을 관찰한 회원 ${number(c.eligible7d)}명 · 관찰 대기 ${number(c.pending7d)}명. 수집 시작 이전 가입자는 제외합니다.`,'metric-note'));
  const wrap=node('div',null,'table-scroll');wrap.tabIndex=0;wrap.setAttribute('aria-label','7일 전환 상세');wrap.append(metricTable(['단계','전환율 · 전환 / 대상'],[
    ['회원가입 → 첫 채팅',ratio(c.chatConverted7d,c.eligible7d)],
    ['회원가입 → 실제 구매',ratio(c.purchaseConverted7d,c.eligible7d)],
    ['게스트 시작 → 회원가입',ratio(g.guestConverted7d,g.guestEligible7d)]
  ]));conversion.append(wrap,node('p',c.medianFirstChatSeconds==null?'첫 채팅까지 중앙시간: — 관찰 대상 없음':`첫 채팅까지 중앙시간: ${(c.medianFirstChatSeconds/60).toLocaleString('ko-KR',{maximumFractionDigits:1})}분 · 7일 내 전환한 회원 기준`));
  metricCards('growth-retention','가입 코호트 리텐션',['d1','d7','d30'].map(key=>[key.toUpperCase(),c[key].eligible ? (100*c[key].retained/c[key].eligible).toFixed(1)+'%' : '—',c[key].eligible ? `${number(c[key].retained)} / ${number(c[key].eligible)}명 · 해당 날짜 관찰 완료` : '관찰 대기 또는 가입 대상 없음']),'가입한 날을 D0으로 보고 정확히 1·7·30일 뒤 다시 서버 활동을 한 비율입니다. 끝나지 않은 날짜는 분모에서 제외합니다.');
  const retention=node('div',null,'table-scroll');retention.tabIndex=0;retention.setAttribute('aria-label','가입 코호트별 리텐션');
  if(data.cohorts.buckets.length)retention.append(metricTable(['가입 기간','가입','D1','D7','D30','7일 채팅','7일 구매','7일 관찰 대기'],data.cohorts.buckets.map(b=>[b.date,number(b.members),ratio(b.d1.retained,b.d1.eligible),ratio(b.d7.retained,b.d7.eligible),ratio(b.d30.retained,b.d30.eligible),ratio(b.chatConverted7d,b.eligible7d),ratio(b.purchaseConverted7d,b.eligible7d),number(b.pending7d)])));
  else retention.append(node('p','수집 시작 이후의 가입 코호트가 아직 없습니다. 날짜가 쌓이면 표시됩니다.'));
  disposeChart('retention-chart');
  if (['d1','d7','d30'].some(key => c[key].eligible > 0)) {
    const chart = node('div',null,'echart retention-chart'); chart.id = 'retention-chart';
    $('growth-retention').append(chart); renderRetention(c);
  } else $('growth-retention').append(node('p','리텐션 관찰 기간이 지나면 그래프가 표시됩니다.','empty-chart'));
  $('growth-retention').append(retention);
  metricCards('growth-commerce','결제·광고와 응답 품질',[
    ['실제 결제',number(g.purchases)+'건',`구매 유저 ${number(g.buyers)}명 · 갱신 포함`],
    ['광고 시청 완료',number(g.adViews)+'회',`시청 유저 ${number(g.adViewers)}명 · 서버 보상 검증 기준`],
    ['AI 응답 실패율',g.succeeded+g.failed ? (100*g.failed/(g.succeeded+g.failed)).toFixed(1)+'%' : '—',`${number(g.failed)} / ${number(g.succeeded+g.failed)}건 · 결과 확정 기준`]
  ],'Sandbox·목결제는 제외합니다. 베타에서 실제 결제·광고가 비활성이라면 0건일 수 있습니다. 구매는 순매출이 아닌 결제 경험입니다.');
}

let metricsBusy = false, metricsRequest = 0;
const todayKst = () => new Date(Date.now() + 9*3600000).toISOString().slice(0,10);
$('metric-end').value = todayKst();
$('metric-start').value = new Date(Date.parse(todayKst()) - 29*86400000).toISOString().slice(0,10);
$('metric-refresh').onclick = () => loadMetrics();
async function loadMetrics() {
  if (!client || metricsBusy) return;
  const generation = authGeneration, ticket = ++metricsRequest;
  const start = $('metric-start').value, end = $('metric-end').value, grain = $('metric-grain').value;
  if (!start || !end || end < start || (Date.parse(end)-Date.parse(start))/86400000 > 365) { $('metric-status').textContent = '시작일과 종료일을 최대 366일 범위로 선택해 주세요.'; return; }
  metricsBusy = true; $('metric-refresh').disabled = true; $('metric-status').textContent = '지표를 불러오는 중…';
  try {
    const { data, error } = await client.functions.invoke(`admin-metrics?${new URLSearchParams({start,end,grain})}`, { method: 'GET' });
    if (generation !== authGeneration || ticket !== metricsRequest) return;
    if (error) throw Error(error.context?.status === 403 ? '지표 조회 권한이 없습니다.' : '지표를 불러오지 못했습니다. 다시 조회해 주세요.');
    const cards = $('metric-cards'); cards.replaceChildren();
    for (const [label,value] of [['누적 가입',data.totalMembers],['이번 주 가입',data.weekMembers],['현재 회원',data.currentMembers],['기간 내 채팅 유저',data.rangeChatUsers],['기간 내 방 생성 유저',data.rangeRoomUsers]]) {
      const card=node('article',null,'metric-card');card.append(node('span',label),node('strong',Number(value).toLocaleString('ko-KR')+'명'));cards.append(card);
    }
    renderGrowth(data);
    const growthByDate = new Map(data.growth.buckets.map(b=>[b.date,b]));
    const rows = data.buckets.map(b=>({...b,...growthByDate.get(b.date)}));
    disposeChart('trend-chart');
    const heading = node('div',null,'chart-heading');
    heading.append(node('h3','가입과 활성 사용자 추이'),node('span',`${start} — ${end}`));
    const chart = node('div',null,'echart trend-chart'); chart.id = 'trend-chart';
    $('metric-chart').replaceChildren(heading,chart);
    renderTrend(rows);
    if (!rows.some(b => b.members > 0)) $('metric-chart').append(node('p','선택 기간에 신규 가입이 없습니다.','chart-note'));
    const columns = [['date','기간 시작'],['activeUsers','활성 유저'],['returningUsers','재방문 유저'],['purchases','구매 건'],['buyers','구매 유저'],['adViews','광고 완료'],['adViewers','광고 유저'],['members','가입'],['guests','게스트 시작'],['rooms','생성 방'],['roomUsers','방 생성 유저'],['chatUsers','채팅 유저'],['memberChatUsers','회원 채팅 유저'],['guestChatUsers','게스트 채팅 유저'],['turns','전송'],['succeeded','응답 성공'],['failed','실패']];
    const table=node('table'),head=node('thead'),tr=node('tr');for(const [,label] of columns)tr.append(node('th',label));head.append(tr);table.append(head);const body=node('tbody');
    for(const b of rows){const row=node('tr');for(const [key] of columns)row.append(node('td',key==='date'?b[key]:Number(b[key]).toLocaleString('ko-KR')));body.append(row);}table.append(body);$('metric-table').replaceChildren(table);
    const time = value => value ? new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}) : '아직 처리 전';
    $('metric-status').textContent = `최근 집계 ${time(data.lastProcessedAt)} · 수집 시작 ${time(data.trackingStartedAt)} · 집계 대기 ${data.pendingEvents}건 · 알림 대기 ${data.pendingNotifications}건 / 실패 ${data.failedNotifications}건`;
  } catch(error) { if(generation===authGeneration){$('metric-status').textContent=error.message;clearMetrics();} }
  finally { metricsBusy=false; $('metric-refresh').disabled=false; }
}

try {
  const response = await fetch('/admin/config.json', { cache: 'no-store' });
  if (!response.ok) throw Error('관리자 사이트 연결 설정을 확인해 주세요.');
  const config = await response.json();
  if (!config.url || !config.key) throw Error('관리자 사이트 연결 설정을 확인해 주세요.');
  client = createClient(config.url, config.key, { auth: { flowType: 'pkce', storage: sessionStorage, storageKey: 'mental-content-admin', detectSessionInUrl: true } });
  const { data: { session }, error } = await client.auth.getSession();
  history.replaceState({}, '', '/admin');
  if (error) throw Error('로그인 결과를 확인하지 못했습니다. 다시 로그인해 주세요.');
  if (session) { $('logout').hidden = false; await load(); } else status('관리자 계정으로 로그인해 주세요.');
  client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') { authGeneration++; snapshot = null; dirty = false; $('editor').hidden = true; shell(false); clearMetrics(); clearAdmins(); $('login').hidden = false; } });
} catch (error) { status(error.message, true); }
