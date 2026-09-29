const $ = (id) => document.getElementById(id);
const screens = { announcements: '공지사항', friends: '친구', rooms: '채팅 목록', my: '마이페이지', store: '상점' };
const pageSize = 20;

export function createAnnouncements(client) {
  let data = { announcements: [], campaigns: [], pushReady: false };
  let page = 0;
  let current = null;
  const state = (message, error = false) => {
    $('announcement-status').textContent = message;
    $('announcement-status').classList.toggle('error', error);
  };
  async function request(payload) {
    const { data: session } = await client().auth.getSession();
    if (!session.session) throw Error('관리자 로그인이 필요합니다.');
    const { data: result, error } = await client().functions.invoke('admin-announcements', payload ? { method: 'POST', body: payload } : { method: 'GET' });
    if (error) throw Error('공지사항 서버에 연결하지 못했습니다. 다시 시도해 주세요.');
    return result;
  }
  function cell(row, value) { const c = document.createElement('td'); c.textContent = value; row.append(c); }
  function render() {
    $('push-send').disabled = !data.pushReady;
    $('push-readiness').textContent = data.pushReady
      ? '푸시 서버가 연결되어 있습니다.'
      : '푸시 서버 연결 전입니다. 공지사항은 작성할 수 있으며 알림 발송은 연결 후 가능합니다.';
    const list = data.announcements;
    const pages = Math.max(1, Math.ceil(list.length / pageSize));
    page = Math.min(page, pages - 1);
    $('announcement-count').textContent = `총 ${list.length}건 · ${page + 1}/${pages}페이지`;
    const table = document.createElement('table');
    const head = document.createElement('tr');
    for (const label of ['제목', '상태', '이동 화면', '생성일', '수정일', '수정자']) {
      const th = document.createElement('th'); th.textContent = label; head.append(th);
    }
    table.append(head);
    for (const item of list.slice(page * pageSize, (page + 1) * pageSize)) {
      const row = document.createElement('tr');
      row.tabIndex = 0;
      row.className = 'editable-row';
      row.onclick = () => open(item);
      row.onkeydown = (event) => { if (event.key === 'Enter') open(item); };
      cell(row, item.title); cell(row, item.published_at ? '공개' : '초안');
      cell(row, screens[item.target_screen] ?? '');
      cell(row, new Date(item.created_at).toLocaleDateString('ko-KR'));
      cell(row, new Date(item.updated_at).toLocaleDateString('ko-KR'));
      cell(row, item.updated_by_name ?? '');
      table.append(row);
    }
    $('announcement-list').replaceChildren(table);
    $('announcement-prev').disabled = page === 0;
    $('announcement-next').disabled = page >= pages - 1;
    const history = document.createElement('table');
    const h = document.createElement('tr');
    for (const label of ['발송일', '제목', '대상', '상태']) { const th = document.createElement('th'); th.textContent = label; h.append(th); }
    history.append(h);
    for (const item of data.campaigns.slice(0, 20)) {
      const row = document.createElement('tr');
      cell(row, new Date(item.created_at).toLocaleString('ko-KR'));
      cell(row, item.title);
      cell(row, Object.entries(item.audience ?? {}).map(([k, v]) => `${k}: ${v}`).join(', ') || '전체');
      cell(row, item.status);
      history.append(row);
    }
    $('push-history').replaceChildren(history);
  }
  async function load() {
    state('공지사항을 불러오는 중…');
    try { data = await request(); render(); state(''); }
    catch (error) { state(error.message, true); }
  }
  function open(item = null) {
    current = item;
    $('announcement-dialog-title').textContent = item ? '공지사항 수정' : '공지사항 작성';
    $('announcement-title').value = item?.title ?? '';
    $('announcement-body').value = item?.body ?? '';
    $('announcement-screen').value = item?.target_screen ?? 'announcements';
    $('announcement-published').checked = Boolean(item?.published_at);
    $('announcement-delete').hidden = !item;
    $('announcement-dialog').showModal();
  }
  async function save(event) {
    event.preventDefault();
    try {
      await request({ action: 'save', id: current?.id, title: $('announcement-title').value,
        body: $('announcement-body').value, targetScreen: $('announcement-screen').value,
        published: $('announcement-published').checked });
      $('announcement-dialog').close(); await load(); state('공지사항을 저장했습니다.');
    } catch (error) { state(error.message, true); }
  }
  async function remove() {
    if (!current || !confirm(`“${current.title}” 공지사항을 삭제할까요?`)) return;
    try { await request({ action: 'delete', id: current.id }); $('announcement-dialog').close(); await load(); state('공지사항을 삭제했습니다.'); }
    catch (error) { state(error.message, true); }
  }
  function audience() {
    const result = {};
    const id = $('push-user-id').value.trim();
    if (id) result.userId = id;
    for (const key of ['active', 'joined']) {
      const value = $('push-' + key).value;
      if (value) result[key === 'active' ? 'activeWithinDays' : 'joinedWithinDays'] = Number(value);
    }
    const subscription = $('push-subscription').value;
    if (subscription) result.subscription = subscription;
    return result;
  }
  let preview = null;
  function invalidatePreview() { preview = null; $('push-recipient-count').textContent = '대상 수를 확인해 주세요.'; }
  async function previewAudience() {
    try {
      const filters = audience();
      const response = await request({ action: 'preview', audience: filters });
      preview = { filters: JSON.stringify(filters), count: response.recipients };
      $('push-recipient-count').textContent = `알림을 허용한 기기 ${response.recipients.toLocaleString('ko-KR')}대`;
      state('');
    } catch (error) { invalidatePreview(); state(error.message, true); }
  }
  async function send(event) {
    event.preventDefault();
    if (!data.pushReady) { state('푸시 서버 연결 후 발송할 수 있습니다.', true); return; }
    const filters = audience();
    if (!preview || preview.filters !== JSON.stringify(filters)) { state('먼저 대상 수를 확인해 주세요.', true); return; }
    const title = $('push-title').value.trim(), message = $('push-body').value.trim();
    if (!preview.count) { state('발송 대상이 없습니다.', true); return; }
    if (!confirm(`${preview.count.toLocaleString('ko-KR')}대에 “${title}” 알림을 발송할까요?`)) return;
    try {
      const result = await request({ action: 'send', title, body: message, targetScreen: $('push-screen').value, audience: filters });
      invalidatePreview(); await load(); state(`${result.recipients}대에 발송을 예약했습니다.`);
    } catch (error) { state(error.message, true); }
  }
  $('announcement-add').onclick = () => open();
  $('announcement-prev').onclick = () => { page--; render(); };
  $('announcement-next').onclick = () => { page++; render(); };
  $('announcement-refresh').onclick = load;
  $('announcement-form').onsubmit = save;
  $('announcement-delete').onclick = remove;
  $('announcement-cancel').onclick = () => $('announcement-dialog').close();
  $('push-preview').onclick = previewAudience;
  $('push-form').onsubmit = send;
  for (const field of ['push-user-id', 'push-active', 'push-joined', 'push-subscription']) $(field).oninput = invalidatePreview;
  return { load, clear: () => { data = { announcements: [], campaigns: [], pushReady: false }; $('announcement-list').replaceChildren(); $('push-history').replaceChildren(); } };
}
