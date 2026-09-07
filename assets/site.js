(function () {
  'use strict';
  const config = window.SAT_SITE || {};
  const ids = ['sat-001', 'sat-002', 'sat-003'];
  const names = { 'sat-001': 'Melon Cotton Candy', 'sat-002': 'Chocolate Banana Muffin', 'sat-003': 'Coming soon' };
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('bottle');
  const bottle = ids.includes(requested) ? requested : null;
  const storageKey = 'sat:entry:v1';
  function read(store, key) { try { return window[store].getItem(key); } catch (_) { return null; } }
  function write(store, key, value) { try { window[store].setItem(key, value); } catch (_) {} }
  function https(value) { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : null; } catch (_) { return null; } }
  let entry = { product: '', source: 'brand' };
  try {
    const saved = JSON.parse(read('sessionStorage', storageKey) || 'null');
    if (saved && ids.includes(saved.product) && ['label', 'brand', 'playground'].includes(saved.source)) entry = saved;
  } catch (_) {}
  if (bottle) {
    const source = params.get('utm_source');
    const fromPlay = source === 'playground' || document.body.dataset.page === 'play';
    const origin = source === 'label' ? 'label' : fromPlay ? (entry.product === bottle ? entry.source : 'playground') : 'brand';
    entry = { product: bottle, source: origin };
    write('sessionStorage', storageKey, JSON.stringify(entry));
  }
  let unlocked = read('localStorage', 'sat-age-confirmed') === 'yes';
  /* In-memory hooks only: no analytics SDK, network request, or customer database. */
  function track(event, product, location) {
    if (!unlocked) return;
    const data = { event: event, product: ids.includes(product) ? product : entry.product, location: location || '', source: entry.source };
    window.dataLayer = Array.isArray(window.dataLayer) ? window.dataLayer : [];
    window.dataLayer.push(data);
    if (window.dataLayer.length > 100) window.dataLayer.shift();
  }
  const isPlay = document.body.dataset.page === 'play';
  if (isPlay) {
    const product = bottle || entry.product;
    const back = document.querySelector('[data-return]');
    if (back && ids.includes(product)) {
      back.href = '../?bottle=' + product + '&utm_source=playground#' + product;
      back.textContent = product === 'sat-003' ? 'コレクションに戻る →' : 'このお酒に戻る →';
      back.dataset.product = product;
    }
    const frame = document.querySelector('iframe');
    const playground = https(config.playgroundUrl);
    if (frame && playground && frame.src !== playground) frame.src = playground;
    document.querySelectorAll('[data-original-playground]').forEach(function (a) { if (playground) a.href = playground; });
  } else if (document.body.dataset.page === 'brand') {
    if (bottle) {
      document.body.dataset.bottle = bottle;
      document.querySelectorAll('.bottle, .coming').forEach(function (card) { card.hidden = card.dataset.product !== bottle; });
      document.querySelector('.bottles').hidden = bottle === 'sat-003';
      document.querySelector('#collection-kicker').textContent = bottle === 'sat-003' ? 'NEXT COLLECTION' : 'YOUR BOTTLE';
      document.querySelector('#collection-title').textContent = bottle === 'sat-003' ? '次の一本。' : 'この一本のこと。';
      document.querySelector('.collection-description').hidden = true;
      document.querySelector('.all-bottles').hidden = false;
      document.title = names[bottle] + '｜SAKE ART TOKYO';
      const image = document.querySelector('#' + bottle + ' img');
      if (image) { image.loading = 'eager'; image.fetchPriority = 'high'; }
    }
    document.querySelectorAll('[data-event="click_playground"]').forEach(function (a) {
      const product = bottle || entry.product;
      if (ids.includes(product)) a.href = 'play/?bottle=' + product;
    });
    const shop = https(config.shopUrl);
    if (shop) document.querySelectorAll('[data-event="click_shop"]').forEach(function (a) { a.href = shop; });
    const instagram = https(config.instagramUrl);
    if (instagram) document.querySelector('.updates-link').href = instagram;
    document.querySelectorAll('.product-shop').forEach(function (a) {
      const specific = https((config.productUrls || {})[a.dataset.product]);
      const general = https(config.shopUrl);
      if (specific) {
        a.href = specific;
        a.textContent = 'このお酒の販売ページへ ↗';
        a.nextElementSibling.textContent = '価格・在庫・配送条件は販売ページでご確認ください。';
      } else if (general) { a.href = general; }
    });
    const signup = https(config.signupUrl);
    if (signup) {
      const link = document.querySelector('.updates-link');
      link.href = signup;
      link.textContent = '新作のお知らせを受け取る ↗';
      document.querySelector('#updates-copy').textContent = '配信内容・利用目的をご確認のうえ、外部の登録ページからお申し込みください。';
    }
    const feedback = https(config.feedbackUrl);
    if (feedback) document.querySelectorAll('.feedback').forEach(function (a) {
      const url = new URL(feedback);
      url.searchParams.set('product', a.dataset.product);
      a.href = url.href; a.target = '_blank'; a.rel = 'noopener'; a.hidden = false;
    });
    const dialog = document.querySelector('#age-gate');
    const yes = document.querySelector('#age-yes');
    const no = document.querySelector('#age-no');
    function ready() {
      if (bottle && params.get('utm_source') === 'label' && params.get('utm_medium') === 'qr') track('qr_landing', bottle, 'bottle');
      if ('IntersectionObserver' in window) {
        const seen = new Set();
        const observer = new IntersectionObserver(function (entries) {
          entries.forEach(function (item) {
            const id = item.target.dataset.product;
            if (item.isIntersecting && !seen.has(id)) { seen.add(id); track('view_item', id, 'collection'); observer.unobserve(item.target); }
          });
        }, { threshold: 0.1 });
        document.querySelectorAll('.bottle:not([hidden])').forEach(function (card) { observer.observe(card); });
      }
    }
    if (dialog) {
      dialog.addEventListener('cancel', function (event) { event.preventDefault(); });
      yes.addEventListener('click', function () {
        write('localStorage', 'sat-age-confirmed', 'yes'); unlocked = true;
        dialog.close(); track('age_confirm', bottle, 'age_gate'); ready();
      });
      no.addEventListener('click', function () {
        document.querySelector('#age-copy').textContent = 'このページのご案内は20歳以上の方が対象です。ブラウザのタブを閉じてください。';
        document.querySelector('.age-actions').hidden = true;
      });
      if (!unlocked) dialog.showModal(); else ready();
    }
    const comic = document.querySelector('#comic');
    if (comic) comic.addEventListener('toggle', function () { if (comic.open) track('open_comic', bottle, 'drink'); });
    /* Keep legacy section links usable without retaining outdated product copy. */
    const legacy = { '#product-details': 'product', '#labels': 'product', '#at-the-table': 'menu', '#store': 'story', '#faq': 'menu', '#kashiwazaki-series': 'sat-003' };
    if (legacy[window.location.hash]) {
      const target = document.getElementById(legacy[window.location.hash]);
      if (target && !target.hidden) target.scrollIntoView();
    }
  }
  document.addEventListener('click', function (event) {
    const a = event.target.closest('a[data-event]');
    if (a) track(a.dataset.event, a.dataset.product || bottle, a.dataset.location || (isPlay ? 'play_header' : 'brand'));
  });
})();
