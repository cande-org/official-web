const kst = '+09:00';
const won = new Intl.NumberFormat('ko-KR');

function toInputTime(value) {
  if (!value) return '';
  return new Date(Date.parse(value) + 9 * 3600000).toISOString().slice(0, 16);
}

export function createStoreSaleEditor({ getSnapshot, markDirty }) {
  const field = id => document.getElementById(id);
  const panel = field('sale-editor');
  const rows = field('sale-items');
  const paid = field('sale-popup');
  const props = [
    ['sale-title', 'shopTitle'],
    ['sale-popup-title', 'title'],
    ['sale-popup-headline', 'headline'],
    ['sale-popup-button', 'button'],
  ];

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
    if (!sale) return;
    field('sale-enabled').checked = sale.enabled;
    field('sale-start').value = toInputTime(sale.startsAt);
    field('sale-end').value = toInputTime(sale.endsAt);
    field('sale-pop-enabled').checked = !!sale.popup;
    paid.hidden = !sale.popup;
    paid.disabled = !sale.popup;
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
    sale.popup = e.target.checked
      ? { title: sale.shopTitle, headline: 'SALE', button: '세일 상점 가기' }
      : null;
    paid.hidden = !sale.popup;
    paid.disabled = !sale.popup;
    if (sale.popup) for (const [id, prop] of props.slice(1)) field(id).value = sale.popup[prop];
    markDirty();
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
    if (!sale.shopTitle.trim() || (sale.popup && Object.values(sale.popup).some(value => !value.trim()))) {
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

  return { render, validationError };
}
