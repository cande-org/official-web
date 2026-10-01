// Normalize photos locally before any upload; metadata and original filenames stay local.
export async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20 * 1024 * 1024) {
    throw Error('20MB 이하의 JPG, PNG, WEBP 사진을 선택해 주세요.');
  }
  let bitmap;
  try { bitmap = await createImageBitmap(file); }
  catch { throw Error('사진을 읽지 못했습니다. 다른 파일을 선택해 주세요.'); }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > 32000000) throw Error('사진 크기가 너무 큽니다. 3,200만 화소 이하로 줄여 주세요.');
    const scale = Math.min(1, 1024 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    const context = canvas.getContext('2d'); context.fillStyle = '#fff'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    let url = canvas.toDataURL('image/jpeg', .85);
    if (url.length > 1398100) url = canvas.toDataURL('image/jpeg', .65);
    if (url.length > 1398100) throw Error('사진 용량을 줄이지 못했습니다. 더 작은 사진을 선택해 주세요.');
    return { photo: url.split(',')[1], url, id: crypto.randomUUID(), uploaded: false };
  } finally { bitmap.close(); }
}
