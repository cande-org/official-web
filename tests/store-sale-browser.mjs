import fs from 'node:fs';
import assert from 'node:assert/strict';
import { build } from 'esbuild';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const target = process.env.QA_SCREENSHOT_DIR;
const origin = 'http://127.0.0.1:54321';
const seed = JSON.parse(fs.readFileSync(new URL('../../mental/server/supabase/content/initial.json', import.meta.url)));
const bundle = await build({
  entryPoints: ['admin/admin.js'], bundle: true, write: false, format: 'esm',
  plugins: [{ name: 'test-session', setup(build) {
    build.onResolve({ filter: /^@supabase\/supabase-js$/ }, () => ({
      path: 'fixture', namespace: 'fixture',
    }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, () => ({
      contents: 'export const createClient=()=>window.fakeClient;', loader: 'js',
    }));
  } }],
});
const csp = JSON.parse(fs.readFileSync('vercel.json', 'utf8')).headers
  .find(header => header.source === '/admin(.*)').headers
  .find(header => header.key === 'Content-Security-Policy').value;
const browser = await chromium.launch({
  headless: true,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.route(origin + '/**', route => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === '/admin/admin.js') return route.fulfill({
      contentType: 'text/javascript', body: bundle.outputFiles[0].text,
    });
    if (pathname === '/admin/config.json') return route.fulfill({
      json: { url: 'https://fixture.invalid', key: 'fixture' },
    });
    if (pathname === '/admin/admin.css') return route.fulfill({
      contentType: 'text/css', body: fs.readFileSync('admin/admin.css'),
    });
    if (pathname.startsWith('/assets/')) return route.fulfill({
      status: fs.existsSync('.' + pathname) ? 200 : 404,
      ...(fs.existsSync('.' + pathname) ? { path: '.' + pathname } : {}),
    });
    return route.fulfill({
      contentType: 'text/html', headers: { 'Content-Security-Policy': csp },
      body: fs.readFileSync('admin/index.html'),
    });
  });
  await page.addInitScript(initial => {
    const restored = sessionStorage.getItem('fixture:store');
    window.snapshot = restored ? JSON.parse(restored) : {
      draft: initial, revision: 1, published_revision: 1,
      published_at: '2026-11-20T00:00:00Z', publishedStoreSale: null,
      contracts: initial.products.map(p => ({ key: p.key, subscription: p.key.endsWith('Monthly') })),
    };
    window.fakeClient = {
      auth: {
        getSession: async () => ({ data: { session: {} } }),
        onAuthStateChange: () => {},
      },
      functions: { invoke: async (name, options) => {
        const body = options?.body;
        if (name !== 'admin-content') return { data: {} };
        if (body) {
          if (body.revision !== window.snapshot.revision || window.conflict) {
            return { error: { context: new Response('{}', { status: 409 }) } };
          }
          window.snapshot.draft = structuredClone(body.content);
          window.snapshot.revision++;
          if (body.action === 'publish') {
            window.snapshot.published_revision = window.snapshot.revision;
            window.snapshot.publishedStoreSale = body.content.storeSale;
          }
          sessionStorage.setItem('fixture:store', JSON.stringify(window.snapshot));
        }
        return { data: structuredClone(window.snapshot) };
      } },
    };
  }, seed);
  await page.goto(origin + '/admin/products');
  await page.locator('#sale-create').click();
  const input = (id, value) => page.locator('#' + id).fill(value);
  await input('sale-title', '블랙프라이데이');
  await input('sale-start', '2026-11-23T00:00');
  await input('sale-end', '2026-11-30T00:00');
  await page.locator('#sale-enabled').check();
  await page.locator('#sale-pop-enabled').check();
  await input('sale-popup-title', '정병발사 블랙프라이데이');
  await input('sale-popup-headline', '50% SALE');
  for (const [key, label, price] of [
    ['messages30', '대화권 30회', '950'], ['liteMonthly', 'Lite 멤버십 첫 달', '2950'],
  ]) {
    const row = page.locator('fieldset.sale-product').filter({ has: page.locator(`[data-sale-product="${key}"]`) });
    await row.locator('[data-sale-product]').check();
    await row.locator('[data-sale-field=label]').fill(label);
    await row.locator('[data-sale-field=salePriceKrw]').fill(price);
  }
  await page.locator('#preview').click();
  assert.match(await page.locator('#preview-body').innerText(), /첫 달 2,950원 · 이후 월 5,900원/);
  await page.locator('#close-preview').click();
  await input('sale-end', '2026-11-22T00:00');
  await page.locator('#form button[type=submit]').click();
  assert.match(await page.locator('#status').innerText(), /종료 시각/);
  await input('sale-end', '2026-11-30T00:00');
  await page.locator('#form button[type=submit]').click();
  await page.waitForFunction(() => window.snapshot.revision === 2);
  assert.equal(await page.evaluate(() => window.snapshot.publishedStoreSale), null);
  await page.reload();
  await page.locator('#sale-popup-headline').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#sale-popup-headline').inputValue(), '50% SALE');
  const draft = await page.evaluate(() => window.snapshot.draft.storeSale);
  assert.equal(draft.startsAt, '2026-11-22T15:00:00.000Z');
  assert.equal(draft.endsAt, '2026-11-29T15:00:00.000Z');
  assert.equal(draft.items[0].key, 'messages30');
  await page.locator('#publish').click();
  await page.waitForFunction(() => window.snapshot.publishedStoreSale?.items.length === 2);
  if (target) {
    fs.mkdirSync(target, { recursive: true });
    await page.locator('#store-sale-panel').screenshot({ path: target + '/admin-sale.png' });
  }
  for (const width of [360, 390, 430]) {
    await page.setViewportSize({ width, height: 844 });
    assert(await page.locator('#store-sale-panel').evaluate(element =>
      element.scrollWidth <= element.clientWidth + 1));
  }
  await input('sale-title', '수정된 행사');
  await page.evaluate(() => { window.conflict = true; });
  await page.locator('#publish').click();
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('다른 관리자'));
  assert.equal(await page.locator('#sale-title').inputValue(), '수정된 행사');
  await page.evaluate(() => { window.conflict = false; });
  await page.locator('#sale-enabled').uncheck();
  await page.locator('#publish').click();
  await page.waitForFunction(() => window.snapshot.publishedStoreSale?.enabled === false);
  assert.deepEqual(await page.evaluate(() => window.snapshot.draft.products), seed.products);
  assert.deepEqual(errors, []);
  console.log('Store sale: KST, preview, save/reload, publish, conflict, disable, three viewport widths passed.');
} finally {
  await browser.close();
}
