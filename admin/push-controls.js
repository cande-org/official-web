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
