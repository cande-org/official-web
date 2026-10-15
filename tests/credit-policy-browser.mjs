// Isolated API fixtures exercise the real admin bundle; never mutates production.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const source = await build({ entryPoints: ['admin/admin.js'], bundle: true, write: false, format: 'esm', plugins: [{ name: 'fixture-client', setup(build) {
  build.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({ path: 'client', namespace: 'fixture' }));
  build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({ contents: 'export const createClient=()=>window.fakeClient;', loader: 'js' }));
} }] });
const seed = JSON.parse(fs.readFileSync('../mental/server/supabase/content/initial.json', 'utf8'));
const browser = await chromium.launch({ headless: true, executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } }), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  const html = fs.readFileSync('admin/index.html', 'utf8').replace(/<script[\s\S]*?<\/script>/g, '').replace(/<link[^>]+>/g, '');
  await page.route('http://127.0.0.1:54321/**', r => { const path = new URL(r.request().url()).pathname; return path.startsWith('/assets/') ? r.fulfill({ contentType: path.endsWith('.otf') ? 'font/otf' : 'image/png', body: fs.readFileSync('.' + path) }) : r.fulfill({ contentType: 'text/html', body: html }); });
  await page.goto('http://127.0.0.1:54321/admin/credits');
  await page.addStyleTag({ content: fs.readFileSync('admin/admin.css', 'utf8') });
  await page.evaluate(seed => {
    window.fetch = async () => new Response(JSON.stringify({ url: 'https://fixture.invalid', key: 'fixture' }));
    window.session = {}; window.calls = []; window.policy = { revision: 1, dailyFreeLimit: 10, history: [] };
    window.fakeClient = { auth: { getSession: async () => ({ data: { session: window.session } }), onAuthStateChange: f => window.signoutListener = f, signOut: async () => { window.session = null; window.signoutListener('SIGNED_OUT'); } }, functions: { invoke: async (name, options) => {
      if (name === 'admin-content') return { data: { draft: seed, revision: 1, published_revision: 1, contracts: [] } };
      if (name !== 'admin-credit-policy') return { error: new Error('unused fixture') };
      if (options?.body) {
        window.calls.push(options.body);
        if (window.conflict) { window.conflict = false; return { error: { context: { status: 409 } } }; }
        window.policy.history.unshift({ revision: window.policy.revision + 1, previous_limit: window.policy.dailyFreeLimit, daily_free_limit: options.body.dailyFreeLimit, recorded_at: '2026-10-15T05:00:00Z' });
        window.policy.revision++; window.policy.dailyFreeLimit = options.body.dailyFreeLimit;
      }
      return { data: structuredClone(window.policy) };
    } } };
  }, seed);
  await page.addScriptTag({ type: 'module', content: source.outputFiles[0].text });
  await page.locator('#credit-policy-limit').waitFor();
  await page.locator('#credit-policy-current').getByText('현재 충전 기준 10회', { exact: false }).waitFor();
  assert.equal(await page.locator('#form').isVisible(), false);
  page.on('dialog', d => d.accept());
  await page.locator('#credit-policy-limit').fill('5'); await page.locator('#credit-policy-save').click();
  await page.locator('#credit-policy-status').getByText('무료 충전 기준을 저장했습니다.').waitFor();
  assert.deepEqual(await page.evaluate(() => window.calls), [{ revision: 1, dailyFreeLimit: 5 }]);
  assert((await page.locator('#credit-policy-history').innerText()).includes('10회 → 5회'));
  const out = process.env.QA_SCREENSHOT_DIR;
  if (out) { fs.mkdirSync(out, { recursive: true }); await page.screenshot({ path: out + '/admin-free-policy.png', fullPage: true }); }
  await page.locator('#credit-policy-limit').fill('4'); await page.evaluate(() => window.conflict = true); await page.locator('#credit-policy-save').click();
  await page.locator('#credit-policy-status').getByText('다른 관리자가 먼저 변경했습니다.', { exact: false }).waitFor();
  assert.equal(await page.locator('#credit-policy-limit').inputValue(), '4');
  await page.locator('#credit-policy-refresh').click();
  await page.locator('#credit-policy-current').getByText('현재 충전 기준 5회', { exact: false }).waitFor();
  assert.equal(await page.locator('#credit-policy-limit').inputValue(), '5');
  await page.locator('#credit-policy-limit').fill('101'); await page.locator('#credit-policy-save').click();
  assert.equal((await page.evaluate(() => window.calls)).length, 2);
  await page.locator('#credit-policy-limit').fill('0'); await page.locator('#credit-policy-save').click();
  await page.locator('#credit-policy-current').getByText('현재 충전 기준 0회', { exact: false }).waitFor();
  for (const width of [430, 390, 360]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    if (out && width === 390) await page.screenshot({ path: out + '/admin-free-policy-mobile.png', fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.locator('#logout').click();
  assert(await page.locator('#editor').isHidden());
  assert.equal(await page.locator('#credit-policy-history').innerText(), '');
  assert.deepEqual(errors, []);
  console.log('PASS credit policy: deep link, 10→5→0, conflict retains input, reload, range, history, 360/390/430, logout');
} finally { await browser.close(); }
