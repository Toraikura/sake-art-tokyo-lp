/* Review-only adapter. No game source, rules, storage or scoring are changed.
   Same-origin deployment isolates #battle; other origins show an explicit fallback.
   Replace this adapter with a dedicated game embed route before moving domains. */
(function () {
  'use strict';
  const section = document.getElementById('playground');
  const frame = document.getElementById('inline-game');
  if (!section || !frame) return;
  const status = document.getElementById('game-status');
  const retry = document.getElementById('game-retry');
  const gate = document.getElementById('age-gate');
  const config = window.SAT_SITE || {};
  const product = document.body.dataset.bottle;
  const back = document.querySelector('[data-game-return]');
  if (back && ['sat-001', 'sat-002'].includes(product)) {
    back.href = '#' + product;
    back.textContent = 'この一本に戻る ↑';
    back.dataset.product = product;
  }
  let gameURL;
  try {
    gameURL = new URL(config.playgroundUrl);
    if (gameURL.protocol !== 'https:') throw new Error('HTTPS required');
    gameURL.hash = 'battle';
  } catch (_) {
    status.textContent = 'ゲームの接続先を確認しています。お酒と漫画は、そのままご覧いただけます。';
    return;
  }
  document.querySelectorAll('[data-game-original]').forEach(function (link) { link.href = gameURL.href; });
  let allowed = !gate || !gate.open;
  let nearby = false;
  let requested = false;
  let timeout;
  let resize;
  let readiness;
  let visibility;
  function note(text) { status.hidden = false; status.textContent = text; }
  function stopObservers() {
    if (resize) resize.disconnect();
    if (readiness) readiness.disconnect();
    resize = readiness = null;
  }
  function showProblem() {
    note('ゲームが表示されない、または反応しない場合は、再読み込みか下のリンクをご利用ください。');
    retry.hidden = false;
  }
  function isolate(doc) {
    const battle = doc.querySelector('main > section#battle');
    if (!battle) return false;
    const main = battle.parentElement;
    let style = doc.getElementById('sat-inline-presentation');
    if (!style) {
      style = doc.createElement('style');
      style.id = 'sat-inline-presentation';
      doc.head.appendChild(style);
    }
    /* Keep the mounted component tree intact for React hydration. Only hide the
       surrounding site's presentation. Never hide game controls or safety text. */
    style.textContent = [
      'html,body{margin:0!important;min-height:0!important;height:auto!important;scroll-behavior:auto!important;scroll-padding-top:0!important}',
      'body>main{min-height:0!important;overflow:visible!important}',
      'body>main>:not(#battle){display:none!important}',
      '#battle{padding:16px 12px!important;margin:0!important;scroll-margin-top:0!important;background-image:none!important}',
      '#battle>div>div:first-child{display:none!important}',
      '#battle-controls{scroll-margin-top:12px!important}'
    ].join('\n');
    const fit = function () {
      const height = Math.ceil(battle.getBoundingClientRect().height) + 4;
      if (Number.isFinite(height) && height > 80 && height < 12000) frame.style.height = height + 'px';
    };
    fit();
    if ('ResizeObserver' in window) {
      resize = new ResizeObserver(fit);
      resize.observe(battle);
    }
    try { frame.contentWindow.scrollTo(0, 0); } catch (_) {}
    const checkReady = function () {
      if (main.dataset.appReady !== 'true') return;
      clearTimeout(timeout);
      status.hidden = true;
      retry.hidden = true;
      frame.dataset.presentation = 'battle';
      fit();
      if (readiness) readiness.disconnect();
    };
    readiness = new MutationObserver(checkReady);
    readiness.observe(main, { attributes: true, attributeFilter: ['data-app-ready'] });
    checkReady();
    return true;
  }
  frame.addEventListener('load', function () {
    if (!requested) return;
    stopObservers();
    try {
      const doc = frame.contentDocument;
      if (doc && doc.URL === 'about:blank') return;
      if (doc && isolate(doc)) return;
    } catch (_) { /* Cross-origin access is intentionally not bypassed. */ }
    clearTimeout(timeout);
    frame.dataset.presentation = 'fallback';
    note('この表示環境では、ゲーム部分だけの表示を確認できません。枠内に遊び場全体が表示される場合があります。');
    retry.hidden = false;
  });
  frame.addEventListener('error', showProblem);
  function load() {
    if (!allowed || !nearby || requested) return;
    requested = true;
    if (visibility) visibility.disconnect();
    note('このページ内にゲームを読み込んでいます。');
    retry.hidden = true;
    frame.hidden = false;
    frame.removeAttribute('data-presentation');
    clearTimeout(timeout);
    timeout = setTimeout(showProblem, 15000);
    frame.src = gameURL.href;
  }
  retry.addEventListener('click', function () {
    stopObservers();
    requested = false;
    load();
  });
  if (gate) gate.addEventListener('close', function () { allowed = true; load(); });
  if ('IntersectionObserver' in window) {
    visibility = new IntersectionObserver(function (entries) {
      nearby = entries.some(function (entry) { return entry.isIntersecting; });
      load();
    }, { rootMargin: '360px 0px' });
    visibility.observe(section);
  } else { nearby = true; load(); }
  window.addEventListener('pagehide', function () { clearTimeout(timeout); stopObservers(); });
  window.addEventListener('pageshow', function (event) {
    if (event.persisted && requested) {
      try { if (frame.contentDocument) isolate(frame.contentDocument); } catch (_) {}
    }
  });
})();
