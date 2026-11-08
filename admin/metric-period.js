const dayMs = 86400000;
const iso = date => date.toISOString().slice(0,10);
export const todayKst = () => iso(new Date(Date.now() + 9*3600000));
export function metricPeriod(period, anchor) {
  const start = new Date(anchor + 'T00:00:00Z');
  if (!Number.isFinite(start.getTime())) return null;
  if (period === 'week') start.setUTCDate(start.getUTCDate() - (start.getUTCDay()+6)%7);
  if (period === 'month') start.setUTCDate(1);
  const end = new Date(start);
  if (period === 'week') end.setUTCDate(end.getUTCDate()+6);
  if (period === 'month') end.setUTCMonth(end.getUTCMonth()+1,0);
  return {start:iso(start),end:iso(end)};
}
export function shiftMetricPeriod(period, start, end, direction) {
  const date = new Date(start + 'T00:00:00Z');
  if (period === 'month') date.setUTCMonth(date.getUTCMonth()+direction,1);
  else date.setUTCDate(date.getUTCDate()+direction*(period==='week'?7:period==='day'?1:(Date.parse(end)-Date.parse(start))/dayMs+1));
  if (period === 'custom') return {start:iso(date),end:iso(new Date(date.getTime()+Date.parse(end)-Date.parse(start)))};
  return metricPeriod(period,iso(date));
}
export function metricBucketLabel(value, grain, compact = false, singleDay = false) {
  if (grain !== 'hour') return compact ? value.slice(5).replace('-','.') : value;
  const time = value.slice(11,16);
  return compact && singleDay ? time : `${value.slice(compact?5:0,10).replaceAll('-','.')} ${time}`;
}
