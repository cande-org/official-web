// Exercises the real admin shell against synthetic API responses. No live data.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const seed = JSON.parse(fs.readFileSync('../mental/server/supabase/content/initial.json', 'utf8'));
const source = await build({ entryPoints: ['admin/admin.js'], bundle: true, write: false, format: 'esm', plugins: [{ name: 'fixture', setup(b) {
  b.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'client', namespace: 'fixture' }));
  b.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const createClient=()=>window.fakeClient;', loader: 'js' }));
} }] });
const origin = 'http://127.0.0.1:54321';
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  async function boot(loggedOut = false) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }); page.setDefaultTimeout(10000);
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.route(origin + '/**', r => {
      const path = new URL(r.request().url()).pathname;
      if (path === '/admin/config.json') return r.fulfill({ contentType: 'application/json', body: JSON.stringify({ url: 'https://fixture.invalid', key: 'fixture' }) });
      if (path === '/admin/admin.js') return r.fulfill({ contentType: 'text/javascript', body: source.outputFiles[0].text });
      if (path === '/admin/admin.css') return r.fulfill({ contentType: 'text/css', body: fs.readFileSync('admin/admin.css', 'utf8') });
      if (path.startsWith('/assets/')) return r.fulfill({ contentType: path.endsWith('.svg') ? 'image/svg+xml' : 'image/png', body: fs.readFileSync('.' + path) });
      return r.fulfill({ contentType: 'text/html', body: fs.readFileSync('admin/index.html', 'utf8') });
    });
    await page.addInitScript(({ seed, loggedOut }) => {
      window.session = loggedOut && !sessionStorage.getItem('fixture:login') ? null : {};
      window.calls = [];
      const rows = Array.from({ length: 26 }, (_, i) => ({ id: 'fixture-' + i, created_at: '2026-11-03T01:00:00Z',
        flow: i < 21 ? 'account' : 'membership', reason: i < 21 ? i % 2 ? 'privacy' : 'usage' : 'cost',
        comment: i === 0 ? '가상 의견 <img src=x onerror="window.injected=true">\n두 번째 줄' : i % 2 ? '가상 의견 ' + i : '', account_status: i < 21 ? 'active' : 'deleted' }));
      window.fakeClient = { auth: {
        getSession: async () => ({ data: { session: window.session } }), onAuthStateChange: fn => window.signout = fn,
        signOut: async () => { window.session = null; window.signout('SIGNED_OUT'); },
        signInWithOAuth: async () => { sessionStorage.setItem('fixture:login', '1'); location.assign('/admin?code=fixture'); return {}; }
      }, functions: { invoke: async (name, o) => {
        if (name === 'admin-content') return { data: { draft: seed, revision: 1, published_revision: 1 } };
        if (name !== 'admin-exit-feedback') return { error: new Error('unused fixture') };
        const b = o.body; window.calls.push(b);
        if (window.fail) return { error: { context: new Response('{}', { status: window.fail }) } };
        const filtered = rows.filter(r => (b.flow === 'all' || b.flow === r.flow) && (b.reason === 'all' || b.reason === r.reason) && (b.accountState === 'all' || b.accountState === r.account_status));
        const page = Math.min(b.page, Math.max(1, Math.ceil(filtered.length / b.size)));
        const groups = new Map(); for (const r of filtered) { const key = r.flow + ':' + r.reason; groups.set(key, { flow: r.flow, reason: r.reason, count: (groups.get(key)?.count || 0) + 1 }); }
        const response = { data: { total: filtered.length, page, size: b.size, items: filtered.slice((page - 1) * b.size, page * b.size),
          summary: { total: filtered.length, account: filtered.filter(r => r.flow === 'account').length, membership: filtered.filter(r => r.flow === 'membership').length, comments: filtered.filter(r => r.comment).length }, distribution: [...groups.values()] } };
        if (window.defer) return new Promise(resolve => window.resolveFeedback = () => resolve(response));
        return response;
      } } };
    }, { seed, loggedOut });
    await page.goto(origin + '/admin/exit-feedback');
    await page.locator(loggedOut ? '#login' : '#exit-list tbody tr').first().waitFor({ state: 'visible' });
    return { page, errors };
  }
  const { page, errors } = await boot();
  assert.equal(await page.locator('[data-tab="exit-feedback"][aria-pressed="true"]').count(), 1);
  assert.equal(await page.locator('#exit-list tbody tr').count(), 20);
  assert.match(await page.locator('#exit-count').innerText(), /26건/);
  assert.equal(await page.locator('#exit-list img').count(), 0);
  assert.equal(await page.evaluate(() => window.injected), undefined);
  assert.match(await page.locator('#exit-list').innerText(), /<img/);
  await page.locator('#exit-next').click(); await page.waitForFunction(() => document.querySelectorAll('#exit-list tbody tr').length === 6);
  assert.equal(await page.locator('#exit-page').getAttribute('data-page'), '2');
  await page.locator('#exit-account-state').selectOption('deleted'); await page.locator('#exit-filters button[type=submit]').click();
  await page.waitForFunction(() => document.querySelectorAll('#exit-list tbody tr').length === 5);
  assert.match(await page.locator('#exit-list').innerText(), /탈퇴 회원/);
  assert.equal(await page.locator('#exit-page').getAttribute('data-page'), '1');
  await page.locator('#exit-reset').click(); await page.waitForFunction(() => document.querySelectorAll('#exit-list tbody tr').length === 20);
  const out = process.env.QA_SCREENSHOT_DIR;
  if (out) { fs.mkdirSync(out, { recursive: true }); await page.evaluate(() => window.scrollTo({top:0,left:0,behavior:'instant'})); await page.screenshot({ path: out + '/exit-feedback-desktop.png', animations: 'disabled' }); }
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  }
  if (out) { await page.setViewportSize({ width: 390, height: 844 }); await page.reload(); await page.locator('#exit-list tbody tr').first().waitFor(); await page.evaluate(() => window.scrollTo({top:0,left:0,behavior:'instant'})); await page.screenshot({ path: out + '/exit-feedback-mobile.png', animations: 'disabled' }); }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('#exit-reason').selectOption('privacy'); await page.locator('#exit-flow').selectOption('membership');
  assert.equal(await page.locator('#exit-reason').inputValue(), 'all'); assert.equal(await page.locator('#exit-reason option[value=privacy]').count(), 0);
  await page.locator('#exit-filters button[type=submit]').click(); await page.waitForFunction(() => document.querySelectorAll('#exit-list tbody tr').length === 5);
  assert.match(await page.locator('#exit-list').innerText(), /가격이 부담돼요/);
  await page.locator('#exit-reason').selectOption('errors'); await page.locator('#exit-filters button[type=submit]').click(); await page.getByText('접수된 사유가 없습니다.', { exact: true }).waitFor();
  await page.locator('#exit-start').fill('2026-01-01'); await page.locator('#exit-filters button[type=submit]').click(); await page.getByText('조회 기간은 최대 93일로 선택해 주세요.', { exact: true }).waitFor();
  assert.equal(await page.locator('#exit-list table').count(), 0);
  await page.locator('#exit-reset').click(); await page.waitForFunction(() => document.querySelectorAll('#exit-list tbody tr').length === 20);
  await page.evaluate(() => window.fail = 403); await page.locator('#exit-refresh').click(); await page.getByText('조회 권한이 없습니다.', { exact: true }).waitFor();
  assert.equal(await page.locator('#exit-list table').count(), 0); assert.equal(await page.locator('#exit-summary').innerText(), '');
  await page.evaluate(() => { window.fail = 0; window.defer = true; }); await page.locator('#exit-refresh').click(); await page.waitForFunction(() => !!window.resolveFeedback);
  await page.locator('#logout').click(); await page.evaluate(() => window.resolveFeedback());
  assert.equal(await page.locator('#exit-list table').count(), 0); assert.equal(await page.locator('#exit-summary').innerText(), '');
  assert.deepEqual(errors, []); assert(await page.evaluate(() => window.calls.every(c => c.action === 'list'))); await page.close();
  const auth = await boot(true); await auth.page.locator('#signin').click(); await auth.page.locator('#exit-list tbody tr').first().waitFor();
  assert.equal(new URL(auth.page.url()).pathname, '/admin/exit-feedback'); assert.deepEqual(auth.errors, []); await auth.page.close();
  console.log('PASS exit feedback: menu/OAuth, KST filters, live/retained, whole-range summaries, numeric paging, empty/error, XSS, 360/390/430, stale sign-out cleanup; read-only requests');
} finally { await browser.close(); }
