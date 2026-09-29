const $ = id => document.getElementById(id);
const make = (tag, content, className) => { const element = document.createElement(tag); if (content !== undefined) element.textContent = content; if (className) element.className = className; return element; };
const scenarios = {
  reply: '어제 연락했는데 답장은 없고 인스타는 하는 것 같아',
  team: '팀플 발표 내일인데 한 명이 아직 자료 안 줬어',
  job: '다들 잘하는데 나만 뒤처지는 것 같아서 막막해',
  correction: '아니 내가 발표자는 아니고, 슬라이드 합치는 역할이야. 뭐라고 보내면 좋을까?',
  safety: '자해하고 싶은 마음이 들어'
};
const sampleHistory = [
  { role: 'user', content: '팀플 발표 내일인데 한 명이 아직 자료 안 줬어' },
  { role: 'assistant', memberId: 'stable', senderName: '안정형', content: '내일 발표인데 자료가 아직 안 왔구나. 몇 시까지 준댔어?' },
  { role: 'user', content: '오늘 9시랬어.' }
];
const members = {
  stable: { id: 'stable', nickname: '안정형', persona: 'stable' },
  anxious: { id: 'anxious', nickname: '불안형', persona: 'anxious' },
  avoidant: { id: 'avoidant', nickname: '회피형', persona: 'avoidant' },
  same: { id: 'stable2', nickname: '안정형 2', persona: 'stable' }
};
const labelTime = value => new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

export function createPromptStudio(getClient) {
  let snapshot, loading = false, busy = false, changed = false, cases = [];
  let histories = { published: [], custom: [] };
  let scenario = 'reply', memberMode = 'all';
  const fields = { stable: $('prompt-stable'), anxious: $('prompt-anxious'), avoidant: $('prompt-avoidant') };
  const status = (message, error = false) => { $('prompt-status').textContent = message; $('prompt-status').classList.toggle('error', error); };
  const testStatus = (message, error = false) => { $('prompt-test-status').textContent = message; $('prompt-test-status').classList.toggle('error', error); };
  const draft = () => Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, field.value.trim()]));
  const isValid = guides => Object.values(guides).every(value => value.length >= 20 && value.length <= 1200);
  const selectedMembers = () => memberMode === 'all' ? [members.stable, members.anxious, members.avoidant] : memberMode === 'same' ? [members.stable, members.same] : [members[memberMode]];
  async function request(payload) {
    const client = getClient();
    if (!client) throw Error('로그인 상태를 확인해 주세요.');
    const { data, error } = await client.functions.invoke('admin-prompt-studio', { method: payload ? 'POST' : 'GET', ...(payload ? { body: payload } : {}) });
    if (error) {
      const code = error.context?.status;
      throw Error(code === 429 ? '오늘의 테스트 한도 40건을 모두 사용했습니다.' : code === 409 ? '다른 관리자가 먼저 수정했습니다. 새로 불러온 뒤 다시 시도해 주세요.' : code === 403 ? '프롬프트 관리 권한이 없습니다.' : code === 400 ? '입력값을 확인해 주세요.' : '서버 요청에 실패했습니다. 잠시 뒤 다시 시도해 주세요.');
    }
    return data;
  }
  function render() {
    if (!snapshot) return;
    for (const [key, field] of Object.entries(fields)) field.value = snapshot.draft[key];
    changed = false;
    $('prompt-meta').textContent = `초안 v${snapshot.revision} · 앱 공개 v${snapshot.published_revision} · 마지막 공개 ${labelTime(snapshot.published_at)}`;
    const select = $('prompt-versions'); select.replaceChildren();
    for (const item of snapshot.history.filter(item => ['seed', 'publish', 'rollback'].includes(item.action))) {
      const option = make('option', `v${item.revision} · ${labelTime(item.created_at)}`); option.value = String(item.revision); select.append(option);
    }
  }
  async function load(force = false) {
    if (loading || busy || (changed && !force)) return;
    loading = true; status('프롬프트를 불러오는 중…');
    try { snapshot = await request(); render(); status(''); }
    catch (error) { status(error.message, true); }
    finally { loading = false; }
  }
  async function write(action, targetRevision) {
    if (busy || !snapshot) return;
    const guides = draft();
    if (action !== 'rollback' && !isValid(guides)) { status('각 성향 지침을 20~1,200자로 작성해 주세요.', true); return; }
    if (action === 'publish' && !confirm('현재 편집한 성향 지침을 앱의 새 대화에 공개할까요?')) return;
    if (action === 'rollback' && !confirm(`공개 v${targetRevision}의 지침을 다시 앱에 적용할까요?`)) return;
    busy = true; status(action === 'save' ? '초안 저장 중…' : '앱에 적용 중…');
    try {
      snapshot = await request({ action, revision: snapshot.revision, ...(action === 'rollback' ? { targetRevision } : { guides }) });
      render(); status(action === 'save' ? '초안이 저장됐습니다. 앱에는 아직 반영되지 않았습니다.' : '새 버전이 앱 대화에 적용됐습니다.');
    } catch (error) { status(error.message, true); }
    finally { busy = false; }
  }
  function resetConversation() { histories = { published: scenario === 'correction' ? structuredClone(sampleHistory) : [], custom: scenario === 'correction' ? structuredClone(sampleHistory) : [] }; cases = []; $('prompt-results').replaceChildren(); testStatus('대화 맥락을 초기화했습니다.'); }
  function trimHistory(items) {
    const recent = items.slice(-16);
    while (recent.filter(item => item.role === 'user').length > 4 || recent.reduce((sum, item) => sum + item.content.length, 0) > 4000) recent.shift();
    while (recent.length && recent[0].role !== 'user') recent.shift();
    return recent;
  }
  function resultCard(title, response) {
    const card = make('article', undefined, 'prompt-result-card'); card.append(make('h3', title));
    if (response.error) { card.append(make('p', response.error, 'error')); return card; }
    const input = Number(response.usage?.prompt_tokens ?? 0), output = Number(response.usage?.completion_tokens ?? 0);
    const rate = response.model === 'gpt-6-sol' ? [2, 10] : [0.1, 0.5];
    const estimate = input || output ? ` · 최대 약 $${((input * rate[0] + output * rate[1]) / 1_000_000).toFixed(5)}` : '';
    card.append(make('p', `${response.model} · 추론 ${response.reasoningEffort} · ${response.durationMs}ms · 입력 ${input || '—'} / 출력 ${output || '—'} 토큰${estimate} · ${response.quotaUsed == null ? '모델 호출 없음' : `사용 ${response.quotaUsed}/40`}`, 'prompt-result-meta'));
    if (response.result.mode === 'safety') card.append(make('p', '안전 안내: ' + response.result.safetyMessage));
    else for (const item of response.result.messages) {
      const line = make('div', undefined, 'prompt-reply');
      line.append(make('strong', item.senderName), make('p', item.content)); card.append(line);
    }
    const score = make('div', undefined, 'prompt-score');
    for (const [key, text] of [['natural', '자연스러움'], ['persona', '성향 구분'], ['continuity', '맥락 연결']]) {
      const label = make('label', text), select = make('select'); select.dataset.score = key;
      for (const [value, caption] of [['', '평가 안 함'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']]) { const option = make('option', caption); option.value = value; select.append(option); }
      label.append(select); score.append(label);
    }
    score.addEventListener('change', () => { response.scores = Object.fromEntries([...score.querySelectorAll('select')].map(select => [select.dataset.score, select.value])); });
    card.append(score); return card;
  }
  async function run() {
    if (busy || !snapshot) return;
    const guides = draft(), message = $('prompt-message').value.trim();
    if (!isValid(guides)) { testStatus('성향 지침은 각각 20~1,200자여야 합니다.', true); return; }
    if (!message || message.length > 1200) { testStatus('테스트 메시지를 1~1,200자로 입력해 주세요.', true); return; }
    busy = true; $('prompt-run').disabled = true; testStatus('공개본과 편집 중 지침으로 각각 생성 중…');
    const selected = selectedMembers();
    const variants = ['published', 'custom'];
    const outcome = await Promise.all(variants.map(async variant => {
      try { return await request({ action: 'test', variant, model: variant === 'custom' ? $('prompt-model').value : 'gpt-6-luna', reasoningEffort: variant === 'custom' ? $('prompt-reasoning').value : 'none', ...(variant === 'custom' ? { guides } : {}), message, members: selected, history: histories[variant] }); }
      catch (error) { return { error: error.message }; }
    }));
    const record = { at: new Date().toISOString(), scenario, memberMode, message, publishedRevision: snapshot.published_revision, draftRevision: snapshot.revision, guides, published: outcome[0], custom: outcome[1] };
    cases.push(record);
    const row = make('div', undefined, 'prompt-result-row'); row.append(make('h3', `#${cases.length} · ${message}`, 'prompt-case-title'));
    const pair = make('div', undefined, 'prompt-result-pair'); pair.append(resultCard(`공개 v${snapshot.published_revision}`, outcome[0]), resultCard('편집 중 지침', outcome[1])); row.append(pair); $('prompt-results').prepend(row);
    for (const [index, variant] of variants.entries()) {
      const response = outcome[index];
      if (!response.error && response.result.mode !== 'safety') histories[variant] = trimHistory([...histories[variant], { role: 'user', content: message }, ...response.result.messages.map(item => ({ role: 'assistant', memberId: item.memberId, senderName: item.senderName, content: item.content }))]);
    }
    testStatus(outcome.every(item => !item.error) ? '비교가 완료됐습니다. 같은 맥락에서 다음 메시지를 이어서 테스트할 수 있습니다.' : '일부 응답에 실패했습니다. 결과 카드에서 확인해 주세요.', outcome.some(item => item.error));
    busy = false; $('prompt-run').disabled = false;
  }
  for (const field of Object.values(fields)) field.addEventListener('input', () => { changed = true; status('편집 중 · 저장 전에는 앱에 반영되지 않습니다.'); });
  $('prompt-save').onclick = () => write('save');
  $('prompt-refresh').onclick = () => { if (!changed || confirm('저장하지 않은 프롬프트 변경사항을 버릴까요?')) load(true); };
  $('prompt-publish').onclick = () => write('publish');
  $('prompt-restore').onclick = () => write('rollback', Number($('prompt-versions').value));
  $('prompt-scenario').onchange = event => { scenario = event.target.value; if (scenario !== 'custom') $('prompt-message').value = scenarios[scenario]; resetConversation(); };
  $('prompt-members').onchange = event => { memberMode = event.target.value; resetConversation(); };
  $('prompt-run').onclick = run;
  $('prompt-reset').onclick = resetConversation;
  $('prompt-export').onclick = () => {
    if (!cases.length) { testStatus('저장할 테스트 결과가 없습니다.', true); return; }
    const url = URL.createObjectURL(new Blob([JSON.stringify(cases, null, 2)], { type: 'application/json' }));
    const link = make('a'); link.href = url; link.download = `persona-test-${new Date().toISOString().slice(0, 10)}.json`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  $('prompt-message').value = scenarios.reply;
  return { load, clear: () => { snapshot = null; changed = false; resetConversation(); }, hasUnsaved: () => changed };
}
