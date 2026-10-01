// Decode locally; only the confirmed square JPEG leaves the browser.
async function decodePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
    throw Error('20MB 이하의 JPG, PNG, WEBP 사진을 선택해 주세요.');
  }
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw Error('사진을 읽지 못했습니다. 다른 파일을 선택해 주세요.'); }
  if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 32000000) {
    bitmap.close(); throw Error('사진 크기가 너무 큽니다. 3,200만 화소 이하로 줄여 주세요.');
  }
  return bitmap;
}
function cropRect(bitmap, zoom, x, y) {
  const side = Math.min(bitmap.width, bitmap.height) / zoom;
  return { side, x: (bitmap.width - side) * x / 100, y: (bitmap.height - side) * y / 100 };
}
function paint(canvas, bitmap, rect) {
  const context = canvas.getContext('2d');
  context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(bitmap, rect.x, rect.y, rect.side, rect.side, 0, 0, canvas.width, canvas.height);
}
function encodePhoto(bitmap, rect) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = Math.max(1, Math.min(1024, Math.round(rect.side)));
  paint(canvas, bitmap, rect);
  let url = canvas.toDataURL('image/jpeg', .85);
  if (url.length > 1398100) url = canvas.toDataURL('image/jpeg', .65);
  if (url.length > 1398100) throw Error('사진 용량을 줄이지 못했습니다. 더 작은 사진을 선택해 주세요.');
  return { photo: url.split(',')[1], url, id: crypto.randomUUID(), uploaded: false };
}
export function createPhotoEditor() {
  const $ = id => document.getElementById(`push-photo-${id}`);
  const dialog = $('dialog'), canvas = $('canvas'), zoom = $('zoom'), x = $('x'), y = $('y');
  let original = null, candidate = null, resolve = null, revision = 0, saved = null, drag = null;
  const values = () => ({ zoom: Number(zoom.value), x: Number(x.value), y: Number(y.value) });
  const rect = () => { const v = values(); return cropRect(candidate, v.zoom, v.x, v.y); };
  const draw = () => { if (candidate) paint(canvas, candidate, rect()); };
  const position = (control, value) => { control.value = String(Math.max(0, Math.min(100, value))); };
  const finish = (result = null) => {
    if (candidate && candidate !== original) candidate.close();
    candidate = null; drag = null;
    const done = resolve; resolve = null;
    if (dialog.open) dialog.close();
    done?.(result);
  };
  for (const control of [zoom, x, y]) control.oninput = draw;
  $('reset').onclick = () => { zoom.value = '1'; x.value = y.value = '50'; draw(); };
  $('cancel').onclick = $('close').onclick = () => finish();
  dialog.addEventListener('cancel', event => { event.preventDefault(); finish(); });
  dialog.addEventListener('close', () => { if (resolve) finish(); });
  $('apply').onclick = () => {
    try {
      const prepared = encodePhoto(candidate, rect());
      if (original !== candidate) original?.close();
      original = candidate; saved = values(); finish(prepared);
    } catch (error) { $('error').textContent = error.message; }
  };
  canvas.onpointerdown = event => {
    if (!candidate) return;
    canvas.setPointerCapture(event.pointerId);
    drag = { id: event.pointerId, clientX: event.clientX, clientY: event.clientY, ...values() };
  };
  canvas.onpointermove = event => {
    if (!drag || drag.id !== event.pointerId || !candidate) return;
    const crop = rect(), width = canvas.getBoundingClientRect().width;
    if (candidate.width > crop.side) position(x, drag.x - (event.clientX - drag.clientX) * crop.side / width / (candidate.width - crop.side) * 100);
    if (candidate.height > crop.side) position(y, drag.y - (event.clientY - drag.clientY) * crop.side / width / (candidate.height - crop.side) * 100);
    draw();
  };
  canvas.onpointerup = canvas.onpointercancel = canvas.onlostpointercapture = () => { drag = null; };
  canvas.onkeydown = event => {
    const steps = { ArrowLeft: [x, 2], ArrowRight: [x, -2], ArrowUp: [y, 2], ArrowDown: [y, -2] };
    if (!steps[event.key]) return;
    event.preventDefault(); const [control, delta] = steps[event.key]; position(control, Number(control.value) + delta); draw();
  };
  return {
    async edit(file) {
      const ticket = ++revision;
      if (resolve) finish();
      const decoded = file ? await decodePhoto(file) : original;
      if (ticket !== revision) { if (decoded !== original) decoded?.close(); return null; }
      if (!decoded) return null;
      candidate = decoded;
      const v = !file && saved ? saved : { zoom: 1, x: 50, y: 50 };
      zoom.value = v.zoom; x.value = v.x; y.value = v.y; $('error').textContent = ''; draw();
      const result = new Promise(done => { resolve = done; });
      dialog.showModal(); return result;
    },
    clear() { revision++; finish(); original?.close(); original = null; saved = null; canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height); },
  };
}
