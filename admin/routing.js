export const ADMIN_TABS = ['dashboard', 'credits', 'products', 'faqs', 'notice', 'prompts', 'announcements', 'push', 'legal', 'support', 'members', 'chats', 'payments', 'ads', 'friends', 'admins'];
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const key = /^[a-z0-9._:-]{1,80}$/i;
const detailTabs = new Set(['products', 'faqs', 'announcements', 'push', 'legal', 'support', 'members']);
export const RETURN_ROUTE_KEY = 'mental:admin:return-route:v1';
export function readAdminRoute(value) {
  const url = new URL(value, 'https://cande.fyi');
  let segments;
  try { segments = url.pathname.replace(/\/$/, '').split('/').filter(Boolean).map(decodeURIComponent); } catch { segments = []; }
  const pathTab = segments[0] === 'admin' && ADMIN_TABS.includes(segments[1]) ? segments[1] : null;
  const tab = pathTab ?? 'dashboard';
  if(['payments','ads'].includes(tab)){const value=segments[2];const id=segments.length===3&&typeof value==='string'&&value.length>0&&value.length<=512&&!/[\u0000-\u001f\u007f]/.test(value)&&!['.','..'].includes(value)?value:null;return{tab,id,version:null};}
  if(tab==='chats'||tab==='friends'){
    const validId=v=>typeof v==='string'&&v.length>0&&v.length<=(tab==='friends'?160:128)&&!/[\u0000-\u001f\u007f]/.test(v);
    const user=segments.length===4&&uuid.test(segments[2])?segments[2]:null;
    const id=user&&validId(segments[3])?segments[3]:null;
    const message=url.searchParams.get('message');
    return {tab,id,version:null,user:id?user:null,...(tab==='chats'?{message:id&&validId(message)?message:null}:{})};
  }
  let id = pathTab && segments.length === 3 ? segments[2] : null;
  if (!detailTabs.has(tab) || !(id === 'new' && ['faqs', 'announcements', 'push'].includes(tab) || (['products', 'faqs', 'legal'].includes(tab) ? key : uuid).test(id ?? ''))) id = null;
  const candidate = url.searchParams.get('version');
  const version = tab === 'legal' && id && (candidate === 'new' || uuid.test(candidate ?? '')) ? candidate : null;
  return { tab, id, version };
}
export function adminRouteUrl(route) {
  if(route.tab==='chats'||route.tab==='friends'){const path=`/admin/${route.tab}${route.user&&route.id?`/${encodeURIComponent(route.user)}/${encodeURIComponent(route.id)}`:''}`;return route.tab==='chats'&&route.message&&route.id?`${path}?${new URLSearchParams({message:route.message})}`:path;}
  const path = `/admin/${encodeURIComponent(route.tab)}${route.id ? `/${encodeURIComponent(route.id)}` : ''}`;
  return route.version ? `${path}?${new URLSearchParams({version: route.version})}` : path;
}
const sameRoute = (a, b) => adminRouteUrl(a) === adminRouteUrl(b);
// Only tab/record/version survive OAuth; never retain a token or arbitrary URL.
export function resumeAdminRoute(location, storage) {
  let route = readAdminRoute(location.href);
  if (new URL(location.href).searchParams.has('code')) {
    try { const saved = storage.getItem(RETURN_ROUTE_KEY); if (saved) route = readAdminRoute(saved); } catch { /* Storage may be unavailable. */ }
  }
  try { storage.removeItem(RETURN_ROUTE_KEY); storage.removeItem('mental:support:target'); } catch { /* No persistent redirect needed. */ }
  return route;
}
export function createAdminRouter({ window: win = window, onNavigate, canNavigate = () => true }) {
  let current = readAdminRoute(win.location.href), index = Number.isInteger(win.history.state?.adminRouteIndex) ? win.history.state.adminRouteIndex : 0, restoring = false;
  const stamp = () => ({ ...(win.history.state ?? {}), adminRouteIndex: index });
  function commit(next, { replace = false, notify = true, check = true } = {}) {
    next = readAdminRoute(adminRouteUrl(next));
    if (sameRoute(current, next)) return true;
    if (check && !canNavigate(next)) return false;
    current = next;
    if (!replace) index++;
    win.history[replace ? 'replaceState' : 'pushState'](stamp(), '', adminRouteUrl(next));
    if (notify) void onNavigate(next);
    return true;
  }
  function pop(event) {
    const next = readAdminRoute(win.location.href), target = event.state?.adminRouteIndex;
    if (restoring) { restoring = false; return; }
    if (sameRoute(current, next)) { if (Number.isInteger(target)) index = target; return; }
    if (!sameRoute(current, next) && !canNavigate(next)) {
      if (Number.isInteger(target) && target !== index) { restoring = true; win.history.go(index - target); }
      else win.history.replaceState(stamp(), '', adminRouteUrl(current));
      return;
    }
    current = next;
    if (Number.isInteger(target)) index = target;
    void onNavigate(next);
  }
  win.addEventListener('popstate', pop);
  return {
    get current() { return current; }, go: commit,
    initialize(route) { current = route; win.history.replaceState(stamp(), '', adminRouteUrl(route)); },
    dispose() { win.removeEventListener('popstate', pop); }
  };
}
