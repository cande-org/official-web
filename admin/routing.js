export const ADMIN_TABS = ['dashboard', 'products', 'faqs', 'notice', 'prompts', 'announcements', 'push', 'legal', 'support', 'members', 'admins'];
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
  let id = pathTab && segments.length === 3 ? segments[2] : null;
  if (!detailTabs.has(tab) || !(id === 'new' && ['faqs', 'announcements', 'push'].includes(tab) || (['products', 'faqs', 'legal'].includes(tab) ? key : uuid).test(id ?? ''))) id = null;
  const candidate = url.searchParams.get('version');
  const version = tab === 'legal' && id && (candidate === 'new' || uuid.test(candidate ?? '')) ? candidate : null;
  return { tab, id, version };
}
export function adminRouteUrl(route) {
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
