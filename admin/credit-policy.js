export function createCreditPolicy(getClient) {
  const $ = id => document.getElementById(id);
  let snapshot, busy = false, dirty = false, generation = 0;
  const status = (message, error = false) => { $('credit-policy-status').textContent = message; $('credit-policy-status').className = error ? 'error' : ''; };
  function render() {
    $('credit-policy-limit').value = snapshot.dailyFreeLimit;
    $('credit-policy-current').textContent = `현재 충전 기준 ${snapshot.dailyFreeLimit}회 · v${snapshot.revision}`;
    $('credit-policy-history').replaceChildren(...snapshot.history.map(h => {
      const p = document.createElement('p');
      p.textContent = `${new Date(h.recorded_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} · ${h.previous_limit}회 → ${h.daily_free_limit}회 · v${h.revision}`;
      return p;
    }));
    if (!snapshot.history.length) $('credit-policy-history').textContent = '아직 변경 이력이 없습니다.';
    dirty = false;
  }
  async function request(body) {
    const { data, error } = await getClient().functions.invoke('admin-credit-policy', { method: body ? 'POST' : 'GET', ...(body ? { body } : {}) });
    if (error) throw Error(error.context?.status === 409 ? '다른 관리자가 먼저 변경했습니다. 입력값을 확인한 뒤 새로고침해 주세요.' : error.context?.status === 403 ? '관리자 권한이 필요합니다.' : '설정을 처리하지 못했습니다. 다시 시도해 주세요.');
    return data;
  }
  async function load() {
    if (busy) return;
    const ticket = generation; busy = true; $('credit-policy-save').disabled = true; status('설정을 불러오는 중…');
    try { const data = await request(); if (ticket !== generation) return; snapshot = data; render(); status(''); }
    catch (e) { if (ticket === generation) status(e.message, true); }
    finally { if (ticket === generation) { busy = false; $('credit-policy-save').disabled = !snapshot; } }
  }
  $('credit-policy-form').onsubmit = async e => {
    e.preventDefault(); if (busy || !snapshot || !$('credit-policy-form').reportValidity()) return;
    const limit = Number($('credit-policy-limit').value);
    if (!Number.isInteger(limit) || limit < 0 || limit > 100) return;
    if (!confirm(`무료 충전 기준을 ${limit}회로 저장할까요? 기존 잔액은 보존하며, 새 계정과 다음 이용일 충전부터 적용됩니다.`)) return;
    const ticket = generation; busy = true; $('credit-policy-save').disabled = true;
    status('저장 중…');
    try { const data = await request({ revision: snapshot.revision, dailyFreeLimit: limit }); if (ticket !== generation) return; snapshot = data; render(); status('무료 충전 기준을 저장했습니다.'); }
    catch (e) { if (ticket === generation) status(e.message, true); }
    finally { if (ticket === generation) { busy = false; $('credit-policy-save').disabled = false; } }
  };
  $('credit-policy-limit').oninput = () => { dirty = true; };
  $('credit-policy-refresh').onclick = () => { if (!dirty || confirm('저장하지 않은 횟수 변경을 버리고 다시 불러올까요?')) void load(); };
  return { load, hasUnsaved: () => dirty, isBusy: () => busy, clear() { generation++; snapshot = null; dirty = false; busy = false; $('credit-policy-limit').value = ''; $('credit-policy-current').textContent = ''; $('credit-policy-history').replaceChildren(); $('credit-policy-save').disabled = true; status(''); } };
}
