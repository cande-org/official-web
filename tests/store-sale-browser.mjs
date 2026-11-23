import fs from 'node:fs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { build } from 'esbuild';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const target = process.env.QA_SCREENSHOT_DIR;
const origin = 'http://127.0.0.1:54321';
const artworkBase = 'https://tzuxtejuscgyvgfmlijt.supabase.co/storage/v1/object/public/mental-sale-popup-images/';
const artworkFiles = [
  process.env.QA_SALE_PNG_PATH && fs.readFileSync(process.env.QA_SALE_PNG_PATH),
  process.env.QA_SALE_JPG_PATH && fs.readFileSync(process.env.QA_SALE_JPG_PATH),
];
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
  const page = await browser.newPage({ viewport: { width: 1440, height: 1340 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  const uploaded = new Map();
  await page.exposeFunction('fixtureUploadArtwork', encoded => {
    const bytes = Buffer.from(encoded, 'base64');
    const position = artworkFiles.findIndex(file => file && file.equals(bytes));
    assert(position >= 0);
    const mime = position ? 'image/jpeg' : 'image/png';
    const suffix = position ? 'jpg' : 'png';
    const url = `${artworkBase}${createHash('sha256').update(bytes).digest('hex')}.${suffix}`;
    uploaded.set(url, { bytes, mime });
    return { url, width: 900, height: 900 };
  });
  await page.route(artworkBase + '*', route => {
    const asset = uploaded.get(route.request().url());
    return asset ? route.fulfill({ contentType: asset.mime, body: asset.bytes }) : route.fulfill({ status: 404 });
  });
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
        if (name === 'admin-sale-image') return { data: { image: await window.fixtureUploadArtwork(body.image) } };
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
  await input('sale-popup-hide-today', '오늘은 닫기');
  await page.locator('#sale-popup-show-dates').uncheck();
  await page.locator('#sale-pop-enabled').uncheck();
  await page.locator('#sale-pop-enabled').check();
  assert.equal(await page.locator('#sale-popup-hide-today').inputValue(), '오늘은 닫기');
  for (const [key, label, price] of [
    ['messages30', '대화권 30회', '950'], ['liteMonthly', 'Lite 멤버십 첫 달', '2950'],
  ]) {
    const row = page.locator('fieldset.sale-product').filter({ has: page.locator(`[data-sale-product="${key}"]`) });
    await row.locator('[data-sale-product]').check();
    await row.locator('[data-sale-field=label]').fill(label);
    await row.locator('[data-sale-field=salePriceKrw]').fill(price);
  }
  const credit = page.locator('fieldset.sale-product').filter({ has: page.locator('[data-sale-product="messages30"]') });
  const lite = page.locator('fieldset.sale-product').filter({ has: page.locator('[data-sale-product="liteMonthly"]') });
  await credit.locator('[data-sale-field=ticketStyle]').selectOption('gold');
  await lite.locator('[data-sale-field=showInPopup]').uncheck();
  await page.locator('#preview').click();
  assert.match(await page.locator('#preview-body').innerText(), /첫 달 2,950원 · 이후 월 5,900원/);
  assert.match(await page.locator('#preview-body').innerText(), /기간 표시 안 함 · 오늘은 닫기/);
  assert.match(await page.locator('#preview-body').innerText(), /팝업 티켓 · 대화권 30회 \(금색\)/);
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
  assert.equal(draft.items[0].ticketStyle, 'gold');
  assert.equal(draft.items[1].showInPopup, false);
  assert.equal(draft.popup.showDates, false);
  assert.equal(draft.popup.hideTodayLabel, '오늘은 닫기');
  await page.locator('#publish').click();
  await page.waitForFunction(() => window.snapshot.publishedStoreSale?.items.length === 2);
  if (target) {
    fs.mkdirSync(target, { recursive: true });
    await page.locator('#store-sale-panel').screenshot({ path: target + '/admin-sale.png' });
  }
  if (artworkFiles.every(Boolean)) {
    const upload = async (index) => {
      const mimeType = index ? 'image/jpeg' : 'image/png';
      const name = index ? 'weekend.jpg' : 'spring.png';
      await page.locator('#sale-popup-image').setInputFiles({ name, mimeType, buffer: artworkFiles[index] });
      await page.waitForFunction(() => document.querySelector('#sale-popup-image-status').textContent.includes('추가했습니다'));
      const preview = page.locator('#sale-popup-artwork');
      await preview.evaluate(async image => { await image.decode(); });
      return preview.getAttribute('src');
    };
    const first = await upload(0);
    assert.equal(await page.evaluate(() => window.snapshot.publishedStoreSale.popup.image), undefined);
    await page.locator('#form button[type=submit]').click();
    await page.waitForFunction(url => window.snapshot.draft.storeSale.popup.image?.url === url, first);
    await page.reload();
    assert.equal(await page.locator('#sale-popup-artwork').getAttribute('src'), first);
    await page.locator('#publish').click();
    await page.waitForFunction(url => window.snapshot.publishedStoreSale.popup.image?.url === url, first);
    const second = await upload(1);
    assert.notEqual(second, first);
    assert.equal(await page.evaluate(() => window.snapshot.publishedStoreSale.popup.image.url), first);
    await input('sale-popup-button', '할인 상품 보러 가기');
    await page.locator('#preview').click();
    assert.match(await page.locator('#preview-body').innerText(), /할인 상품 보러 가기/);
    await page.locator('.sale-preview-artwork').evaluate(async image => { await image.decode(); });
    await page.locator('#close-preview').click();
    if (target) await page.locator('#sale-popup').screenshot({ path: target + '/admin-popup-upload.png' });
    await page.locator('#publish').click();
    await page.waitForFunction(url => window.snapshot.publishedStoreSale.popup.image?.url === url, second);
    assert.equal(await page.evaluate(() => window.snapshot.publishedStoreSale.popup.button), '할인 상품 보러 가기');
    await input('sale-popup-button', '혜택 확인하기');
    await page.locator('#publish').click();
    await page.waitForFunction(() => window.snapshot.publishedStoreSale.popup.button === '혜택 확인하기');
    assert.equal(await page.evaluate(() => window.snapshot.publishedStoreSale.popup.image.url), second);
    assert.equal(uploaded.size, 2);
    await page.locator('#sale-popup-image-remove').click();
    await page.locator('#publish').click();
    await page.waitForFunction(() => !window.snapshot.publishedStoreSale.popup.image);
    console.log('Popup image: PNG upload, saved draft reload, JPEG replacement, independent label, and reset passed.');
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
