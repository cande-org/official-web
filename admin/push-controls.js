export const iconNames = { default: '앱 기본', chat: '말풍선', bell: '종', star: '별' };

// datetime-local values are explicitly entered in Korean time, independent of
// the browser's timezone. Reject normalized invalid dates as well as past times.
export function scheduledTime(mode, value, now = Date.now()) {
  if (mode === 'now') return null;
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) throw Error('예약 날짜와 시간을 입력해 주세요.');
  const time = Date.parse(`${value}+09:00`);
  if (!Number.isFinite(time) || new Date(time + 9 * 3600000).toISOString().slice(0, 16) !== value) throw Error('올바른 예약 날짜와 시간을 입력해 주세요.');
  if (time <= now) throw Error('예약 시각은 현재보다 나중이어야 합니다.');
  if (time > now + 90 * 86400000) throw Error('예약은 최대 90일 뒤까지 가능합니다.');
  return new Date(time).toISOString();
}

export function clickMetrics(item) {
  const sent = Number(item.sent_count ?? 0), tracked = Number(item.trackable_sent_count ?? 0), opened = Number(item.opened_count ?? 0);
  return { sent, tracked, opened, rate: tracked ? `${(100 * opened / tracked).toFixed(1)}%` : '—', summary: tracked ? `${(100 * opened / tracked).toFixed(1)}% · ${opened} / ${tracked}` : '집계 대상 없음' };
}

export function memberUids(value) {
  const ids = value.trim().split(/[\s,;]+/).filter(Boolean).map(id => id.toLowerCase());
  if (!ids.length && value.trim()) throw Error('회원 UID를 입력하거나 입력란을 비워 주세요.');
  if (ids.some(id => !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id))) throw Error('올바른 회원 UID를 입력해 주세요. 줄바꿈이나 쉼표로 구분할 수 있습니다.');
  const unique = [...new Set(ids)].sort();
  if (unique.length > 100) throw Error('회원 UID는 최대 100명까지 지정할 수 있습니다.');
  return unique;
}
