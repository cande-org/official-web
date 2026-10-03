// Apply the deployed header policy in a real browser; no production auth or sends.
import fs from 'node:fs';
import assert from 'node:assert/strict';
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE_PATH || 'playwright');
const config = JSON.parse(fs.readFileSync('vercel.json', 'utf8'));
const policy = config.headers.find(rule => rule.source === '/admin(.*)')
  .headers.find(header => header.key === 'Content-Security-Policy').value;
const photo = 'https://tzuxtejuscgyvgfmlijt.supabase.co/storage/v1/object/public/mental-push-images/a7a2bc52-c0db-44d3-8a7a-4a57a3e6aaac.jpg';
const supportPhoto = 'https://tzuxtejuscgyvgfmlijt.supabase.co/storage/v1/object/sign/mental-media/fixture/photo.png?token=fixture';
const otherBucket = 'https://tzuxtejuscgyvgfmlijt.supabase.co/storage/v1/object/public/other/photo.png';
const publicSupport = 'https://tzuxtejuscgyvgfmlijt.supabase.co/storage/v1/object/public/mental-media/photo.png';
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=', 'base64');
const browser = await chromium.launch({ headless: true,
  ...(process.env.CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.CHROMIUM_EXECUTABLE_PATH } : {}) });
try {
  const page = await browser.newPage();
  await page.route('https://admin.example.test/admin/', route => route.fulfill({
    contentType: 'text/html', headers: { 'Content-Security-Policy': policy },
    body: `<img id="photo" src="${photo}"><img id="support" src="${supportPhoto}"><img id="other-bucket" src="${otherBucket}"><img id="public-support" src="${publicSupport}"><img id="preview" src="data:image/png;base64,${png.toString('base64')}"><img id="unrelated" src="https://unrelated.example.test/photo.png">`,
  }));
  await page.route(supportPhoto, route => route.fulfill({ contentType: 'image/png', body: png }));
  await page.route(otherBucket, route => route.fulfill({ contentType: 'image/png', body: png }));
  await page.route(publicSupport, route => route.fulfill({ contentType: 'image/png', body: png }));
  await page.route(photo, route => route.fulfill({ contentType: 'image/png', body: png }));
  await page.route('https://unrelated.example.test/**', route => route.fulfill({ contentType: 'image/png', body: png }));
  await page.goto('https://admin.example.test/admin/', { waitUntil: 'networkidle' });
  assert.equal(await page.locator('#photo').evaluate(img => img.naturalWidth), 1, 'stored push photo must decode under production CSP');
  assert.equal(await page.locator('#support').evaluate(img => img.naturalWidth), 1, 'private signed support photo must decode under production CSP');
  assert.equal(await page.locator('#other-bucket').evaluate(img => img.naturalWidth), 0, 'other storage buckets must remain blocked');
  assert.equal(await page.locator('#public-support').evaluate(img => img.naturalWidth), 0, 'support images must not require a public bucket');
  assert.equal(await page.locator('#preview').evaluate(img => img.naturalWidth), 1, 'local preview must remain allowed');
  assert.equal(await page.locator('#unrelated').evaluate(img => img.naturalWidth), 0, 'unrelated image host must remain blocked');
  console.log('PASS production admin CSP: push photo, signed support photo and local preview load; unrelated host/buckets blocked');
} finally {
  await browser.close();
}
