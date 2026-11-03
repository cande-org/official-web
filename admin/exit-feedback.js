import { chatPeriod } from './chat-history.js';
import { renderPager, setPagerBusy, clearPager } from './pagination.js';
const $ = id => document.getElementById(id);
const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = text; if (cls) n.className = cls; return n; };
export const exitReasonLabels = {
  usage: '자주 사용하지 않아요', conversation: '친구와의 대화가 기대와 달라요',
  features: '원하는 친구나 기능이 부족해요', errors: '오류나 이용 중 불편함이 있어요',
  privacy: '개인정보나 대화 기록이 걱정돼요', cost: '이용 요금이 부담돼요',
  break: '잠시 쉬어가고 싶어요', other: '기타'
};
export const exitReasonLabel = (flow, reason) => flow === 'membership' && reason === 'cost' ? '가격이 부담돼요' : exitReasonLabels[reason] ?? '알 수 없는 사유';
const flowLabel = flow => flow === 'account' ? '계정 탈퇴' : '멤버십 해지';
export function createExitFeedback(getClient) {
  let ticket = 0, page = 1, previousFilters = null;
  const status = (text, error = false) => { $('exit-status').textContent = text; $('exit-status').classList.toggle('error', error); };
  function reasons() {
    const value = $('exit-reason').value, flow = $('exit-flow').value;
    $('exit-reason').replaceChildren(new Option('전체 사유', 'all'));
    for (const [key, label] of Object.entries(exitReasonLabels)) {
      if (flow === 'account' && key === 'break' || flow === 'membership' && key === 'privacy') continue;
      $('exit-reason').append(new Option(key === 'cost' && flow === 'membership' ? '가격이 부담돼요' : label, key));
    }
    if ([...$('exit-reason').options].some(o => o.value === value)) $('exit-reason').value = value;
  }
  function resetFilters() {
    const end = new Date(Date.now() + 9 * 3600000).toISOString().slice(0, 10);
    $('exit-start').value = new Date(Date.parse(end) - 29 * 86400000).toISOString().slice(0, 10);
    $('exit-end').value = end; $('exit-flow').value = 'all'; $('exit-account-state').value = 'all'; $('exit-size').value = '20';
    $('exit-reason').value = 'all'; reasons();
  }
  function clearResults() {
    for (const id of ['exit-list', 'exit-summary', 'exit-distribution', 'exit-count']) $(id).replaceChildren();
    clearPager('exit');
  }
  function render(data) {
    const summary = $('exit-summary'); summary.replaceChildren();
    for (const [key, label] of [['total', '전체 사유 제출'], ['account', '탈퇴 사유'], ['membership', '해지 사유'], ['comments', '추가 의견']]) {
      const card = el('article', null, 'metric-card'); card.append(el('span', label), el('strong', Number(data.summary[key]).toLocaleString('ko-KR') + '건')); summary.append(card);
    }
    const distribution = $('exit-distribution'); distribution.replaceChildren();
    if (!data.total) distribution.append(el('p', '선택한 조건에 해당하는 사유가 없습니다.', 'helper'));
    for (const row of data.distribution) {
      const line = el('div', null, 'exit-reason-row');
      line.append(el('span', `${flowLabel(row.flow)} · ${exitReasonLabel(row.flow, row.reason)}`), el('strong', `${Number(row.count).toLocaleString('ko-KR')}건`));
      distribution.append(line);
    }
    const list = $('exit-list'); list.replaceChildren();
    if (!data.items.length) list.append(el('p', '접수된 사유가 없습니다.', 'helper'));
    else {
      const wrap = el('div', null, 'table-wrap'), table = el('table', null, 'data-table exit-table');
      table.append(el('caption', '탈퇴·해지 사유 제출 내역'));
      const head = el('thead'), heading = el('tr');
      for (const label of ['제출 시각 (KST)', '유형', '사유', '추가 의견', '계정 상태']) { const th = el('th', label); th.scope = 'col'; heading.append(th); }
      head.append(heading); table.append(head); const body = el('tbody');
      for (const item of data.items) {
        const row = el('tr'); row.append(
          el('td', new Date(item.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', hour12: false })),
          el('td', flowLabel(item.flow)), el('td', exitReasonLabel(item.flow, item.reason)),
          el('td', item.comment || '—', 'exit-comment'), el('td', item.account_status === 'deleted' ? '탈퇴 회원' : '이용 중'));
        body.append(row);
      }
      table.append(body); wrap.append(table); list.append(wrap);
    }
    $('exit-count').textContent = `총 ${Number(data.total).toLocaleString('ko-KR')}건`;
    renderPager('exit', { page: data.page, total: data.total, size: data.size, onChange: n => { page = n; void load(); } });
  }
  async function load(reset = false) {
    const current = ++ticket;
    try {
      const filters = { ...chatPeriod($('exit-start').value, $('exit-end').value), flow: $('exit-flow').value,
        reason: $('exit-reason').value, accountState: $('exit-account-state').value, size: Number($('exit-size').value) };
      const signature = JSON.stringify(filters);
      if (reset || signature !== previousFilters) page = 1;
      previousFilters = signature;
      // Hide previous opinions on every refresh, failed request, and sign-out.
      clearResults(); setPagerBusy('exit'); $('exit-refresh').disabled = true; status('사유를 불러오는 중…');
      const client = getClient(), session = await client.auth.getSession();
      if (current !== ticket) return;
      if (!session.data.session) throw Error('관리자 로그인이 필요합니다.');
      const { data, error } = await client.functions.invoke('admin-exit-feedback', { method: 'POST', body: { action: 'list', ...filters, page } });
      if (current !== ticket) return;
      if (error) throw Error(error.context?.status === 403 ? '조회 권한이 없습니다.' : error.context?.status === 401 ? '로그인이 만료되었습니다. 다시 로그인해 주세요.' : '사유를 불러오지 못했습니다. 다시 시도해 주세요.');
      page = data.page; render(data); status(`선택한 조건의 사유 제출 ${Number(data.total).toLocaleString('ko-KR')}건입니다.`);
    } catch (error) { if (current === ticket) { clearResults(); status(error.message, true); } }
    finally { if (current === ticket) $('exit-refresh').disabled = false; }
  }
  $('exit-filters').onsubmit = e => { e.preventDefault(); void load(true); };
  $('exit-flow').onchange = reasons;
  $('exit-refresh').onclick = () => load();
  $('exit-reset').onclick = () => { resetFilters(); void load(true); };
  resetFilters();
  return { load, clear() { ticket++; page = 1; previousFilters = null; clearResults(); status(''); $('exit-refresh').disabled = false; resetFilters(); } };
}
