import { createClient } from '@supabase/supabase-js';
const $ = (id) => document.getElementById(id);
let client, snapshot, dirty = false, busy = false, activeTab = 'dashboard', authGeneration = 0;
const status = (message, error = false) => { $('status').textContent = message; $('status').className = error ? 'error' : ''; };
const node = (tag, text, className) => { const el = document.createElement(tag); if (text != null) el.textContent = text; if (className) el.className = className; return el; };
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
  $('login').hidden = true; $('editor').hidden = false; $('logout').hidden = false;
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
  activeTab = tab;
  $('form').hidden = tab === 'dashboard';
  if (tab === 'dashboard') void loadMetrics();
  for (const name of ['dashboard', 'products', 'faqs', 'notice']) $(name).hidden = name !== tab;
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
  try { const result = await request(); if (generation !== authGeneration) return; snapshot = result; dirty = false; render(); status('공개된 내용은 앱에서 화면을 다시 열 때 반영됩니다.'); }
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
$('logout').onclick = async () => { if (dirty && !confirm('저장하지 않은 변경사항을 버리고 로그아웃할까요?')) return; authGeneration++; dirty = false; await client.auth.signOut({ scope: 'local' }); snapshot = null; $('editor').hidden = true; $('metric-cards').replaceChildren(); $('metric-chart').replaceChildren(); $('metric-table').replaceChildren(); $('login').hidden = false; $('logout').hidden = true; status('로그아웃했습니다.'); };
$('signin').onclick = async () => {
  if (!client) return;
  const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${location.origin}/admin`, queryParams: { prompt: 'select_account' } } });
  if (error) status('로그인을 시작하지 못했습니다.', true);
};

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
    const max = Math.max(1,...data.buckets.map(b=>Number(b.members)));
    $('metric-chart').replaceChildren(node('h3','신규 가입 추이'));
    for (const b of data.buckets) { const row=node('div',null,'chart-row'),meter=node('meter');meter.min=0;meter.max=max;meter.value=Number(b.members);meter.setAttribute('aria-label',`${b.date} 가입 ${b.members}명`);row.append(node('span',b.date),meter,node('span',`${b.members}명`));$('metric-chart').append(row); }
    const columns = [['date','기간 시작'],['members','가입'],['guests','게스트 시작'],['rooms','생성 방'],['roomUsers','방 생성 유저'],['chatUsers','채팅 유저'],['memberChatUsers','회원 채팅 유저'],['guestChatUsers','게스트 채팅 유저'],['turns','전송'],['succeeded','응답 성공'],['failed','실패']];
    const table=node('table'),head=node('thead'),tr=node('tr');for(const [,label] of columns)tr.append(node('th',label));head.append(tr);table.append(head);const body=node('tbody');
    for(const b of data.buckets){const row=node('tr');for(const [key] of columns)row.append(node('td',key==='date'?b[key]:Number(b[key]).toLocaleString('ko-KR')));body.append(row);}table.append(body);$('metric-table').replaceChildren(table);
    const time = value => value ? new Date(value).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'}) : '아직 처리 전';
    $('metric-status').textContent = `최근 집계 ${time(data.lastProcessedAt)} · 수집 시작 ${time(data.trackingStartedAt)} · 집계 대기 ${data.pendingEvents}건 · 알림 대기 ${data.pendingNotifications}건 / 실패 ${data.failedNotifications}건`;
  } catch(error) { if(generation===authGeneration){$('metric-status').textContent=error.message;$('metric-cards').replaceChildren();$('metric-chart').replaceChildren();$('metric-table').replaceChildren();} }
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
  client.auth.onAuthStateChange((event) => { if (event === 'SIGNED_OUT') { authGeneration++; snapshot = null; dirty = false; $('editor').hidden = true; $('metric-cards').replaceChildren(); $('metric-chart').replaceChildren(); $('metric-table').replaceChildren(); $('login').hidden = false; } });
} catch (error) { status(error.message, true); }
