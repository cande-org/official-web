const kst = '+09:00';
const won = new Intl.NumberFormat('ko-KR');

function toInputTime(value) {
  if (!value) return '';
  return new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16);
}

export function createStoreSaleEditor({ getSnapshot, getClient, markDirty }) {
  const field = id => document.getElementById(id);
  const panel = field('sale-editor');
  const rows = field('sale-items');
  const paid = field('sale-popup');
  const imageInput = field('sale-popup-image');
  const imageStatus = field('sale-popup-image-status');
  const artwork = field('sale-popup-artwork');
  const removeImage = field('sale-popup-image-remove');
  let uploading = false;
  const props = [
    ['sale-title', 'shopTitle'],
    ['sale-popup-title', 'title'],
    ['sale-popup-headline', 'headline'],
    ['sale-popup-button', 'button'],
  ];
  const popupEnabled = sale => !!sale?.popup && sale.popup.enabled !== false;

  function renderImage() {
    const snapshot = getSnapshot();
    const image = snapshot?.draft.storeSale?.popup?.image;
    field('sale-popup-image-preview').hidden = !image;
    if (image) artwork.src = image.url;
    else artwork.removeAttribute('src');
    imageInput.disabled = removeImage.disabled = uploading;
  }

  function render() {
    const snapshot = getSnapshot();
    const sale = snapshot.draft.storeSale;
    const live = snapshot.publishedStoreSale;
    const now = Date.now();
    const status = !live?.enabled ? '꺼짐' :
      now < Date.parse(live.startsAt) ? '예약됨' :
      now >= Date.parse(live.endsAt) ? '종료됨' : '진행 중';
    field('sale-published').textContent = live?.enabled
      ? `현재 공개 · ${status} · ${live.shopTitle} · ${toInputTime(live.startsAt).replace('T', ' ')} ~ ${toInputTime(live.endsAt).replace('T', ' ')} KST`
      : '현재 공개 · 꺼짐';
    field('sale-create').textContent = sale ? '새 행사 만들기' : '행사 만들기';
    panel.hidden = !sale;
    panel.disabled = !sale;
    rows.replaceChildren();
    renderImage();
    if (!sale) return;
    field('sale-enabled').checked = sale.enabled;
    field('sale-start').value = toInputTime(sale.startsAt);
    field('sale-end').value = toInputTime(sale.endsAt);
    field('sale-pop-enabled').checked = popupEnabled(sale);
    paid.hidden = !popupEnabled(sale);
    paid.disabled = !popupEnabled(sale);
    field('sale-popup-show-dates').checked = sale.popup?.showDates !== false;
    field('sale-popup-hide-today').value = sale.popup?.hideTodayLabel ?? '';
    for (const [id, prop] of props) {
      const source = id === 'sale-title' ? sale : sale.popup;
      field(id).value = source?.[prop] ?? '';
    }
    renderRows(sale, snapshot.draft.products);
  }

  function renderRows(sale, products) {
    rows.replaceChildren();
    for (const product of products) {
      const item = sale.items.find(p => p.key === product.key);
      const row = document.createElement('fieldset');
      row.className = 'sale-product';
      const toggle = document.createElement('input');
      toggle.type = 'checkbox';
      toggle.checked = !!item;
      toggle.dataset.saleProduct = product.key;
      const heading = document.createElement('label');
      heading.className = 'sale-toggle';
      heading.append(toggle, product.title + (product.enabled ? '' : ' · 숨김'));
      row.append(heading);
      rows.append(row);
      toggle.onchange = () => {
        if (toggle.checked) {
          sale.items.push({
            key: product.key, label: product.title.slice(0, 32),
            regularPriceKrw: product.referencePriceKrw, salePriceKrw: null,
          });
        } else {
          sale.items = sale.items.filter(p => p.key !== product.key);
        }
        renderRows(sale, products);
        rows.querySelector(`[data-sale-product="${product.key}"]`)?.focus();
        markDirty();
      };
      if (!item) continue;
      const fields = document.createElement('div');
      fields.className = 'sale-grid';
      for (const [name, caption] of [
        ['label', '팝업 상품명'], ['regularPriceKrw', '정상가 (원)'], ['salePriceKrw', '할인가 (원)'],
      ]) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        label.textContent = caption;
        input.dataset.saleField = name;
        input.required = true;
        if (name === 'label') {
          input.maxLength = 32;
        } else {
          input.type = 'number';
          input.min = 1;
          input.max = 1000000;
        }
        input.value = item[name] ?? '';
        input.oninput = () => {
          item[name] = name === 'label' ? input.value :
            Number.isFinite(input.valueAsNumber) ? input.valueAsNumber : null;
          renderOfferSummary(summary, item, product.key);
          markDirty();
        };
        label.append(input);
        fields.append(label);
      }
      const show = document.createElement('input');
      show.type = 'checkbox';
      show.checked = item.showInPopup !== false;
      show.dataset.saleField = 'showInPopup';
      const showLabel = document.createElement('label');
      showLabel.className = 'sale-toggle';
      showLabel.append(show, '팝업에 이 상품 표시');
      show.onchange = () => { item.showInPopup = show.checked; markDirty(); };
      const style = document.createElement('select');
      style.dataset.saleField = 'ticketStyle';
      for (const [value, name] of [['', '자동'], ['cream', '크림색'], ['gold', '금색']]) {
        style.append(new Option(name, value));
      }
      style.value = item.ticketStyle ?? '';
      style.onchange = () => {
        if (style.value) item.ticketStyle = style.value;
        else delete item.ticketStyle;
        markDirty();
      };
      const styleLabel = document.createElement('label');
      styleLabel.append('티켓 디자인', style);
      fields.append(showLabel, styleLabel);
      const summary = document.createElement('p');
      summary.className = 'helper';
      renderOfferSummary(summary, item, product.key);
      row.append(fields, summary);
    }
  }

  function renderOfferSummary(summary, item, key) {
    const monthly = key.endsWith('Monthly');
    const discount = Math.floor((item.regularPriceKrw - item.salePriceKrw) * 100 / item.regularPriceKrw);
    summary.textContent = !item.salePriceKrw || !(discount >= 0 && item.regularPriceKrw > item.salePriceKrw) ? '' :
      `${discount}% 할인 · ${monthly ? '첫 달 ' : ''}${won.format(item.salePriceKrw)}원${monthly ? ` · 이후 월 ${won.format(item.regularPriceKrw)}원` : ''}`;
  }

  field('sale-create').onclick = () => {
    const draft = getSnapshot().draft;
    if (draft.storeSale && !confirm('편집 중인 행사 대신 새 행사를 만들까요? 공개본은 그대로 유지됩니다.')) return;
    draft.storeSale = {
      id: crypto.randomUUID(), enabled: false, startsAt: '', endsAt: '',
      shopTitle: '', popup: null, items: [],
    };
    render();
    markDirty();
    field('sale-title').focus();
  };
  field('sale-remove').onclick = () => {
    if (!confirm('초안의 행사 설정을 삭제할까요? 앱에는 공개할 때 반영됩니다.')) return;
    getSnapshot().draft.storeSale = null;
    render();
    markDirty();
    field('sale-create').focus();
  };
  field('sale-enabled').onchange = e => {
    getSnapshot().draft.storeSale.enabled = e.target.checked;
    markDirty();
  };
  field('sale-pop-enabled').onchange = e => {
    const sale = getSnapshot().draft.storeSale;
    const defaults = { title: sale.shopTitle || '할인 행사', headline: 'SALE', button: '세일 상점 가기' };
    sale.popup ??= defaults;
    if (!e.target.checked) for (const [key, value] of Object.entries(defaults)) {
      if (!sale.popup[key].trim()) sale.popup[key] = value;
    }
    sale.popup.enabled = e.target.checked;
    render();
    markDirty();
  };
  field('sale-popup-hide-today').oninput = e => {
    const popup = getSnapshot().draft.storeSale.popup;
    if (e.target.value.trim()) popup.hideTodayLabel = e.target.value;
    else delete popup.hideTodayLabel;
    markDirty();
  };
  field('sale-popup-show-dates').onchange = e => {
    getSnapshot().draft.storeSale.popup.showDates = e.target.checked;
    markDirty();
  };
  imageInput.onchange = async () => {
    const file = imageInput.files[0];
    imageInput.value = '';
    const sale = getSnapshot()?.draft.storeSale;
    const popup = sale?.popup;
    if (!file || !popupEnabled(sale) || uploading) return;
    const current = () => getSnapshot()?.draft.storeSale === sale && sale.popup === popup && popupEnabled(sale);
    uploading = true;
    renderImage();
    imageStatus.textContent = '이미지 업로드 중…';
    try {
      if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 2 * 1024 * 1024) {
        throw Error('2MB 이하 PNG 또는 JPG 파일을 선택해 주세요.');
      }
      const bitmap = await createImageBitmap(file).catch(() => { throw Error('이미지를 읽지 못했습니다.'); });
      const tooLarge = bitmap.width > 2048 || bitmap.height > 2048;
      bitmap.close();
      if (tooLarge) throw Error('이미지 크기를 2048×2048px 이하로 줄여 주세요.');
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(Error('파일을 읽지 못했습니다.'));
        reader.readAsDataURL(file);
      });
      if (!current()) return;
      const { data, error } = await getClient().functions.invoke('admin-sale-image', {
        method: 'POST', body: { image: dataUrl.split(',')[1] },
      });
      if (!current()) return;
      if (error || !data?.image) throw Error('이미지 업로드에 실패했습니다. 다시 시도해 주세요.');
      popup.image = data.image;
      markDirty();
      imageStatus.textContent = '초안에 이미지를 추가했습니다. ‘앱에 공개’를 누르면 반영됩니다.';
    } catch (error) {
      if (current()) imageStatus.textContent = error.message;
    } finally {
      uploading = false;
      if (!current()) imageStatus.textContent = '';
      renderImage();
    }
  };
  removeImage.onclick = () => {
    delete getSnapshot().draft.storeSale.popup.image;
    markDirty();
    renderImage();
    imageStatus.textContent = '‘앱에 공개’를 누르면 기본 티켓으로 돌아갑니다.';
  };
  for (const [id, prop] of props) {
    field(id).oninput = e => {
      const sale = getSnapshot().draft.storeSale;
      (id === 'sale-title' ? sale : sale.popup)[prop] = e.target.value;
      markDirty();
    };
  }
  for (const [id, prop] of [['sale-start', 'startsAt'], ['sale-end', 'endsAt']]) {
    field(id).oninput = e => {
      const time = new Date(e.target.value + kst);
      getSnapshot().draft.storeSale[prop] =
        Number.isFinite(time.getTime()) ? time.toISOString() : '';
      markDirty();
    };
  }

  function validationError() {
    const sale = getSnapshot().draft.storeSale;
    if (!sale) return null;
    if (!sale.startsAt || !sale.endsAt || sale.startsAt >= sale.endsAt) {
      return '종료 시각은 시작 시각 이후로 입력해 주세요.';
    }
    if (!sale.shopTitle.trim() || (sale.popup && ['title', 'headline', 'button'].some(key => !sale.popup[key].trim()))) {
      return '행사와 팝업 문구를 입력해 주세요.';
    }
    if (!sale.items.length || (sale.enabled && !sale.items.some(
      item => getSnapshot().draft.products.some(product => product.enabled && product.key === item.key),
    ))) return '노출할 할인 상품을 하나 이상 선택해 주세요.';
    if (sale.items.some(item => !item.label.trim() || !item.salePriceKrw || item.salePriceKrw >= item.regularPriceKrw)) {
      return '할인 상품명을 입력하고 할인가를 정상가보다 낮게 설정해 주세요.';
    }
    return null;
  }

  return { render, validationError, isUploading: () => uploading };
}
