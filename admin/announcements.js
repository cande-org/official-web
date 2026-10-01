import { iconNames, scheduledTime, clickMetrics, memberUids } from './push-controls.js';
const $ = (id) => document.getElementById(id);
const screens = { announcements: '공지사항', friends: '친구', rooms: '채팅 목록', my: '마이페이지', store: '상점' };
const statusNames = { scheduled: '예약됨', queued: '대기 중', sending: '발송 중', complete: '완료', failed: '실패 포함', canceled: '예약 취소' };
const el = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = text; if (className) node.className = className; return node; };
const button = (text, handler, className) => { const node = el('button', text, className); node.type = 'button'; node.onclick = handler; return node; };
const date = value => value ? new Date(value).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }) : '—';
const audienceLabel = audience => {
  if (!audience || !Object.keys(audience).length) return '전체 허용 기기';
  return [audience.userId && `회원 UID ${audience.userId}`, Array.isArray(audience.userIds) && `지정 회원 ${audience.userIds.length}명`, audience.activeWithinDays && `최근 ${audience.activeWithinDays}일 활동`, audience.joinedWithinDays && `가입 ${audience.joinedWithinDays}일 이내`, audience.subscription && (audience.subscription === 'active' ? '구독 중' : '구독 없음')].filter(Boolean).join(' · ');
};

export function createAnnouncements(client) {
  let data = { announcements: [], campaigns: [], pushReady: false };
  const views = { announcements: { page: 1, size: 20, query: '', filter: 'all' }, push: { page: 1, size: 20, query: '' } };
  let current = null, busy = false, preview = null, previewTicket = 0, generation = 0;
  let currentPush = null, requestId = null, requestSignature = null;
  const state = (kind, message, error = false) => { const target = $(`${kind === 'announcements' ? 'announcement' : 'push'}-status`); target.textContent = message; target.classList.toggle('error', error); };
  const dialogState = (kind, message) => { $(`${kind}-dialog-status`).textContent = message; };
  async function request(payload) {
    const { data: session } = await client().auth.getSession();
    if (!session.session) throw Error('관리자 로그인이 필요합니다.');
    const { data: result, error } = await client().functions.invoke('admin-announcements', payload ? { method: 'POST', body: payload } : { method: 'GET' });
    if (error) {
      let code; try { code = (await error.context.clone().json()).error; } catch { /* Network error. */ }
      const messages = { invalid_schedule: '예약 시각은 현재 이후부터 90일 이내로 입력해 주세요.', campaign_not_cancelable: '이미 발송을 시작했거나 취소할 수 없는 알림입니다. 목록을 새로고침해 주세요.', invalid_user_ids: '회원 UID를 확인해 주세요. 최대 100명까지 지정할 수 있습니다.', invalid_user_id: '올바른 회원 UID를 입력해 주세요.' };
      throw Error(messages[code] ?? '공지사항·푸시 요청을 완료하지 못했습니다. 다시 시도해 주세요.');
    }
    return result;
  }
  function table(headers) {
    const wrapper = el('div', null, 'collection-scroll'); wrapper.tabIndex = 0;
    const root = el('table', null, 'collection-table admin-record-table');
    const head = el('thead'), row = el('tr'), body = el('tbody');
    for (const label of headers) { const th = el('th', label); th.scope = 'col'; row.append(th); }
    head.append(row); root.append(head, body); wrapper.append(root);
    return { wrapper, body };
  }
  function cell(row, value, className) { row.append(el('td', value, className)); }
  function pager(kind, count, pages) {
    const view = views[kind], prefix = kind === 'announcements' ? 'announcement' : 'push';
    $(`${prefix}-count`).textContent = count ? `${(view.page - 1) * view.size + 1}–${Math.min(view.page * view.size, count)} / ${count}개` : '0개';
    $(`${prefix}-page`).textContent = `${view.page} / ${pages}`;
    $(`${prefix}-prev`).disabled = view.page === 1;
    $(`${prefix}-next`).disabled = view.page === pages;
  }
  function renderAnnouncements() {
    const view = views.announcements, query = view.query.trim().toLocaleLowerCase('ko-KR');
    const list = data.announcements.filter(item => (view.filter === 'all' || Boolean(item.published_at) === (view.filter === 'published')) && (!query || `${item.title} ${item.body}`.toLocaleLowerCase('ko-KR').includes(query)));
    const pages = Math.max(1, Math.ceil(list.length / view.size)); view.page = Math.min(view.page, pages);
    const { wrapper, body } = table(['제목', '상태', '생성일 (KST)', '수정일 (KST)', '수정자', '관리']);
    wrapper.setAttribute('aria-label', '공지사항 목록');
    for (const item of list.slice((view.page - 1) * view.size, view.page * view.size)) {
      const row = el('tr');
      const name = el('td', null, 'name-cell');
      name.append(button(item.title, () => openAnnouncement(item), 'row-title'), el('p', item.body, 'row-summary')); row.append(name);
      const status = el('td'); status.append(el('span', item.published_at ? '공개 중' : '초안', `content-state ${item.published_at ? 'visible' : 'hidden-state'}`)); row.append(status);
      cell(row, date(item.created_at), 'audit-date'); cell(row, date(item.updated_at), 'audit-date'); cell(row, item.updated_by_name ?? '—', 'audit-name');
      const action = el('td', null, 'row-actions'); action.append(button('상세', () => openAnnouncement(item))); row.append(action);
      row.onclick = event => { if (!event.target.closest('button,a,input,select')) openAnnouncement(item); }; body.append(row);
    }
    if (!list.length) { const row = el('tr'), empty = el('td', data.announcements.length ? '검색 조건에 맞는 공지사항이 없습니다.' : '등록된 공지사항이 없습니다. 새 공지를 추가해 주세요.', 'empty-list'); empty.colSpan = 6; row.append(empty); body.append(row); }
    $('announcement-list').replaceChildren(wrapper); pager('announcements', list.length, pages);
  }
  function openPushDetail(item) {
    currentPush = item;
    const metrics = clickMetrics(item);
    const fields = $('push-detail-fields'); fields.replaceChildren();
    for (const [label, value] of [['제목', item.title], ['본문', item.body], ['아이콘', iconNames[item.icon_key] ?? '앱 기본'], ['이동 화면', screens[item.target_screen] ?? '—'], ['대상', audienceLabel(item.audience)], ...(Array.isArray(item.audience?.userIds) ? [['지정 UID', item.audience.userIds.join('\n')]] : []), ['상태', statusNames[item.status] ?? item.status], ['등록일 (KST)', date(item.created_at)], ['발송 시각 (KST)', date(item.scheduled_at)], ['완료일 (KST)', date(item.completed_at)], ['대상 기기', `${item.recipient_count ?? 0}대`], ['발송 성공 / 실패', `${metrics.sent} / ${item.failed_count ?? 0}건`], ['클릭', `${metrics.opened}건 (집계 지원 앱 · 기기별 1회)`], ['클릭률', metrics.summary], ['집계 범위', `클릭 집계 지원 앱에 발송 성공한 ${metrics.tracked}건 / 전체 성공 ${metrics.sent}건. 발송 성공은 FCM 접수 기준이며 실제 화면 노출을 보장하지 않습니다.`]]) {
      fields.append(el('dt', label), el('dd', value ?? '—'));
    }
    $('push-cancel-reservation').hidden = item.status !== 'scheduled';
    $('push-detail-status').textContent = '';
    $('push-detail-dialog').showModal(); $('push-detail-close').focus();
  }
  async function cancelReservation() {
    if (!currentPush || busy || !confirm('이 알림의 예약을 취소할까요?')) return;
    busy = true; $('push-cancel-reservation').disabled = true;
    try { await request({ action: 'cancel', id: currentPush.id }); $('push-detail-dialog').close(); if (await load()) state('push', '예약을 취소했습니다.'); }
    catch (error) { $('push-detail-status').textContent = error.message; }
    finally { busy = false; $('push-cancel-reservation').disabled = false; }
  }
  function renderPush() {
    const view = views.push, query = view.query.trim().toLocaleLowerCase('ko-KR');
    const list = data.campaigns.filter(item => !query || `${item.title} ${item.body}`.toLocaleLowerCase('ko-KR').includes(query));
    const pages = Math.max(1, Math.ceil(list.length / view.size)); view.page = Math.min(view.page, pages);
    $('push-readiness').textContent = data.pushReady ? '푸시 서버가 연결되어 있습니다.' : '푸시 서버 연결 전입니다. 이력은 조회할 수 있으며 새 알림 발송은 연결 후 가능합니다.';
    const { wrapper, body } = table(['제목', '본문', '대상', '아이콘', '발송 시각 (KST)', '성공 / 실패', '클릭률 · 클릭/대상', '상태', '관리']);
    wrapper.setAttribute('aria-label', '푸시 발송 이력');
    for (const item of list.slice((view.page - 1) * view.size, view.page * view.size)) {
      const row = el('tr'), name = el('td', null, 'name-cell'); name.append(button(item.title, () => openPushDetail(item), 'row-title')); row.append(name);
      cell(row, item.body, 'push-body-cell'); cell(row, audienceLabel(item.audience), 'push-audience-cell');
      cell(row, iconNames[item.icon_key] ?? '앱 기본'); cell(row, date(item.scheduled_at ?? item.created_at), 'audit-date');
      cell(row, `${item.sent_count ?? 0} / ${item.failed_count ?? 0}`);
      cell(row, clickMetrics(item).summary, 'push-metric-cell');
      cell(row, statusNames[item.status] ?? item.status, 'push-state-cell');
      const action = el('td', null, 'row-actions'); action.append(button('상세', () => openPushDetail(item))); row.append(action);
      row.onclick = event => { if (!event.target.closest('button,a,input,select')) openPushDetail(item); }; body.append(row);
    }
    if (!list.length) { const row = el('tr'), empty = el('td', data.campaigns.length ? '검색 조건에 맞는 발송 이력이 없습니다.' : '아직 발송 이력이 없습니다.', 'empty-list'); empty.colSpan = 9; row.append(empty); body.append(row); }
    $('push-history').replaceChildren(wrapper); pager('push', list.length, pages);
  }
  function render() { renderAnnouncements(); renderPush(); }
  async function load() {
    const ticket = generation;
    try { const result = await request(); if (ticket !== generation) return false; data = result; render(); state('announcements', ''); state('push', ''); return true; }
    catch (error) { if (ticket === generation) state($('push').hidden ? 'announcements' : 'push', error.message, true); return false; }
  }
  function openAnnouncement(item = null) {
    current = item;
    $('announcement-dialog-title').textContent = item ? '공지사항 상세' : '새 공지';
    $('announcement-title').value = item?.title ?? '';
    $('announcement-body').value = item?.body ?? '';
    $('announcement-published').checked = Boolean(item?.published_at);
    $('announcement-delete').hidden = !item; dialogState('announcement', '');
    $('announcement-dialog').showModal(); $('announcement-title').focus();
  }
  async function saveAnnouncement(event) {
    event.preventDefault(); if (busy) return;
    busy = true; $('announcement-form').inert = true; dialogState('announcement', '저장 중…');
    try {
      await request({ action: 'save', id: current?.id, title: $('announcement-title').value.trim(), body: $('announcement-body').value.trim(), targetScreen: current?.target_screen ?? 'announcements', published: $('announcement-published').checked });
      $('announcement-dialog').close(); await load(); state('announcements', '공지사항을 저장했습니다.');
    } catch (error) { dialogState('announcement', error.message); }
    finally { busy = false; $('announcement-form').inert = false; }
  }
  async function removeAnnouncement() {
    if (!current || busy || !confirm(`“${current.title}” 공지사항을 삭제할까요?`)) return;
    busy = true; $('announcement-form').inert = true; dialogState('announcement', '삭제 중…');
    try { await request({ action: 'delete', id: current.id }); $('announcement-dialog').close(); await load(); state('announcements', '공지사항을 삭제했습니다.'); }
    catch (error) { dialogState('announcement', error.message); }
    finally { busy = false; $('announcement-form').inert = false; }
  }
  function audience() {
    const result = {}, ids = memberUids($('push-user-ids').value); if (ids.length) result.userIds = ids;
    for (const key of ['active', 'joined']) { const value = $(`push-${key}`).value; if (value) result[key === 'active' ? 'activeWithinDays' : 'joinedWithinDays'] = Number(value); }
    const subscription = $('push-subscription').value; if (subscription) result.subscription = subscription;
    return result;
  }
  function invalidatePreview() { preview = null; previewTicket++; $('push-recipient-count').textContent = '대상 수를 확인해 주세요.'; $('push-send').disabled = !data.pushReady; }
  function openPush() {
    $('push-form').reset(); invalidatePreview(); dialogState('push', '');
    requestId = null; requestSignature = null; updateSchedule();
    if (!data.pushReady) dialogState('push', '푸시 서버 연결 후 발송할 수 있습니다.');
    $('push-dialog').showModal(); $('push-title').focus();
  }
  function updateSchedule() {
    const scheduled = $('push-timing').value === 'scheduled';
    $('push-scheduled-field').hidden = !scheduled;
    $('push-scheduled-at').required = scheduled;
    $('push-send').textContent = scheduled ? '예약 등록' : '발송 요청';
  }
  async function previewAudience() {
    const ticket = ++previewTicket; let filters;
    try { filters = audience(); } catch (error) { invalidatePreview(); dialogState('push', error.message); return; }
    $('push-preview').disabled = true; dialogState('push', '대상 수를 확인하는 중…');
    try {
      const response = await request({ action: 'preview', audience: filters });
      if (ticket !== previewTicket) return;
      preview = { filters: JSON.stringify(filters), count: response.recipients };
      $('push-recipient-count').textContent = `알림을 허용한 기기 ${response.recipients.toLocaleString('ko-KR')}대`;
      dialogState('push', '');
    } catch (error) { if (ticket === previewTicket) { invalidatePreview(); dialogState('push', error.message); } }
    finally { $('push-preview').disabled = false; }
  }
  async function send(event) {
    event.preventDefault(); if (busy) return;
    if (!data.pushReady) { dialogState('push', '푸시 서버 연결 후 발송할 수 있습니다.'); return; }
    let filters;
    try { filters = audience(); } catch (error) { invalidatePreview(); dialogState('push', error.message); return; }
    if (!preview || preview.filters !== JSON.stringify(filters)) { dialogState('push', '먼저 대상 수를 확인해 주세요.'); return; }
    if (!preview.count) { dialogState('push', '발송 대상이 없습니다.'); return; }
    const title = $('push-title').value.trim(), message = $('push-body').value.trim();
    if (!title || !message) { dialogState('push', '제목과 본문을 입력해 주세요.'); return; }
    let scheduledAt;
    try { scheduledAt = scheduledTime($('push-timing').value, $('push-scheduled-at').value); }
    catch (error) { dialogState('push', error.message); return; }
    const payload = { action: 'send', title, body: message, targetScreen: $('push-screen').value, audience: filters, iconKey: 'default', scheduledAt };
    const signature = JSON.stringify(payload);
    if (signature !== requestSignature) { requestId = crypto.randomUUID(); requestSignature = signature; }
    if (!confirm(`${preview.count.toLocaleString('ko-KR')}대에 “${title}” 알림을 ${scheduledAt ? `${date(scheduledAt)}에 예약` : '발송'}할까요?`)) return;
    busy = true; $('push-form').inert = true; dialogState('push', scheduledAt ? '예약을 등록하는 중…' : '발송을 요청하는 중…');
    try {
      const result = await request({ ...payload, requestId });
      $('push-dialog').close(); invalidatePreview();
      const refreshed = await load(); if (refreshed) state('push', scheduledAt ? `${result.recipients}대에 ${date(result.scheduledAt)} 발송을 예약했습니다.` : `${result.recipients}대에 발송을 요청했습니다.`);
    } catch (error) { dialogState('push', error.message); }
    finally { busy = false; $('push-form').inert = false; }
  }
  $('announcement-add').onclick = () => openAnnouncement();
  $('announcement-refresh').onclick = load;
  $('announcement-form').onsubmit = saveAnnouncement;
  $('announcement-delete').onclick = removeAnnouncement;
  $('announcement-cancel').onclick = () => $('announcement-dialog').close();
  $('announcement-search').oninput = event => { views.announcements.query = event.target.value; views.announcements.page = 1; renderAnnouncements(); };
  $('announcement-filter').onchange = event => { views.announcements.filter = event.target.value; views.announcements.page = 1; renderAnnouncements(); };
  $('announcement-size').onchange = event => { views.announcements.size = Number(event.target.value); views.announcements.page = 1; renderAnnouncements(); };
  $('announcement-prev').onclick = () => { views.announcements.page--; renderAnnouncements(); };
  $('announcement-next').onclick = () => { views.announcements.page++; renderAnnouncements(); };
  $('push-add').onclick = openPush;
  $('push-refresh').onclick = load;
  $('push-search').oninput = event => { views.push.query = event.target.value; views.push.page = 1; renderPush(); };
  $('push-size').onchange = event => { views.push.size = Number(event.target.value); views.push.page = 1; renderPush(); };
  $('push-prev').onclick = () => { views.push.page--; renderPush(); };
  $('push-next').onclick = () => { views.push.page++; renderPush(); };
  $('push-preview').onclick = previewAudience;
  $('push-timing').onchange = updateSchedule;
  $('push-cancel-reservation').onclick = cancelReservation;
  $('push-form').onsubmit = send;
  $('push-cancel').onclick = () => $('push-dialog').close();
  $('push-close').onclick = () => $('push-dialog').close();
  $('push-detail-close').onclick = () => $('push-detail-dialog').close();
  $('push-detail-done').onclick = () => $('push-detail-dialog').close();
  for (const field of ['push-user-ids', 'push-active', 'push-joined', 'push-subscription']) $(field).oninput = invalidatePreview;
  return { load, clear: () => { generation++; invalidatePreview(); for (const id of ['announcement-dialog', 'push-dialog', 'push-detail-dialog']) if ($(id).open) $(id).close(); data = { announcements: [], campaigns: [], pushReady: false }; $('announcement-list').replaceChildren(); $('push-history').replaceChildren(); } };
}
