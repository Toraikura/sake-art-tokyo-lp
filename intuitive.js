/* No telemetry. Same-origin game messages must match the active iframe and session. */
(function () {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const english = document.documentElement.lang === 'en';
  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const releases = JSON.parse($('#label-releases').textContent);
  if (!Array.isArray(releases) || !releases.length || releases.some(release =>
    !release.id || !release.image || !release.download || !release.detail || !release.name
  ) || new Set(releases.map(release => release.id)).size !== releases.length) {
    throw new Error('Invalid or duplicate label release data');
  }
  const wrapIndex = value => ((value % releases.length) + releases.length) % releases.length;
  let index = Math.max(0, releases.findIndex(release => release.id ===
    (document.body.dataset.mood === 'deep' ? 'sat-002' : 'sat-001')));
  let busy = false, swipe = null, suppressClickUntil = 0;
  let flipTimer = 0, unlockTimer = 0;
  const stack = $('#label-stack'), front = $('#label-image');
  const back1 = $('.back-one'), back2 = $('.back-two');
  const pad = value => String(value).padStart(2, '0');

  function renderLabel() {
    const release = releases[index];
    $('#label-error').hidden = true;
    front.src = release.image;
    front.alt = english ? `${release.name.replace(/\.$/, '')} label` : `${release.jp || release.name}のエチケット`;
    $('#label-name').textContent = release.name;
    $('#label-brewery').textContent = `${release.id.toUpperCase().replace('-', ' ')} / ${release.brewery}`;
    $('#label-counter').textContent = `${pad(index + 1)} / ${pad(releases.length)}`;
    $('#save-label').href = release.download;
    $('#save-label').download = release.filename || `${release.id}-label.png`;
    $('#label-details').href = release.detail;
    back1.hidden = releases.length < 2;
    back2.hidden = releases.length < 3;
    if (releases.length > 1) back1.querySelector('img').src = releases[wrapIndex(index + 1)].image;
    if (releases.length > 2) back2.querySelector('img').src = releases[wrapIndex(index + 2)].image;
    stack.disabled = releases.length === 1;
    $('#label-prev').disabled = releases.length === 1;
    $('#label-next').disabled = releases.length === 1;
    stack.setAttribute('aria-label', english ? `${release.name} View the next label` : `${release.jp || release.name}。次のエチケットを見る`);
    stack.dataset.release = release.id;
    window.dispatchEvent(new CustomEvent('sat:label', { detail: { id: release.id } }));
  }

  function settle() {
    clearTimeout(flipTimer);
    clearTimeout(unlockTimer);
    busy = false;
    stack.classList.remove('is-flipping');
  }

  function choose(value, animate = true) {
    const next = wrapIndex(value);
    // A new mood choice must override an in-flight flip, not leave stale artwork.
    if (!animate || motion.matches) {
      settle();
      index = next;
      renderLabel();
      return;
    }
    if (next === index || busy) return;
    busy = true;
    stack.dataset.direction = value < index ? 'previous' : 'next';
    stack.classList.add('is-flipping');
    flipTimer = setTimeout(() => {
      index = next;
      renderLabel();
      stack.classList.remove('is-flipping');
      unlockTimer = setTimeout(() => { busy = false; }, 170);
    }, 150);
  }

  $('#label-prev').addEventListener('click', () => choose(index - 1));
  $('#label-next').addEventListener('click', () => choose(index + 1));
  stack.addEventListener('click', () => {
    if (performance.now() >= suppressClickUntil) choose(index + 1);
  });
  stack.addEventListener('pointerdown', event => {
    if (event.isPrimary && event.button === 0) {
      swipe = { id: event.pointerId, x: event.clientX, y: event.clientY };
    } else {
      swipe = null;
      suppressClickUntil = performance.now() + 450;
    }
  }, { passive: true });
  stack.addEventListener('pointerup', event => {
    if (!swipe || swipe.id !== event.pointerId) return;
    const dx = event.clientX - swipe.x, dy = event.clientY - swipe.y;
    swipe = null;
    if (Math.hypot(dx, dy) > 14) suppressClickUntil = performance.now() + 450;
    if (Math.abs(dx) > 34 && Math.abs(dx) > Math.abs(dy) * 1.3) {
      choose(index + (dx < 0 ? 1 : -1));
    }
  }, { passive: true });
  stack.addEventListener('pointercancel', () => {
    swipe = null;
    suppressClickUntil = performance.now() + 450;
  }, { passive: true });
  stack.addEventListener('keydown', event => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      choose(index + (event.key === 'ArrowLeft' ? -1 : 1));
    }
  });
  front.addEventListener('error', () => { $('#label-error').hidden = false; });
  front.addEventListener('load', () => { $('#label-error').hidden = true; });
  window.addEventListener('sat:mood', event => {
    const next = releases.findIndex(release => release.id === event.detail?.id);
    if (next >= 0) choose(next, false);
  });
  renderLabel();

  function renderPlaygroundArcade() {
    const arcade = $('.arcade');
    if (!arcade) return;
    if (!document.getElementById('fpg-preview-styles')) {
      const previewStyles = document.createElement('link');
      previewStyles.id = 'fpg-preview-styles';
      previewStyles.rel = 'stylesheet';
      previewStyles.href = '/fpg-preview.css?v=20260911-mini1';
      document.head.appendChild(previewStyles);
    }
    const sourcePage = english ? '/en/' : '/';
    const copy = english ? {
      kicker: 'FERMENTATION PLAYGROUND / ARCADE',
      intro: 'Choose a game. Follow whatever makes you curious.',
      select: 'SELECT A GAME',
      hub: 'OPEN THE PLAYGROUND',
      play: 'PLAY NOW',
      soon: 'COMING SOON...'
    } : {
      kicker: 'FERMENTATION PLAYGROUND / ARCADE',
      intro: '気になったところから、好きなゲームを選ぶ。',
      select: 'SELECT A GAME',
      hub: 'PLAYGROUNDを見る',
      play: 'PLAY NOW',
      soon: 'COMING SOON...'
    };

    arcade.classList.add('fpg-arcade');
    arcade.setAttribute('aria-labelledby', 'fpg-arcade-title');
    arcade.innerHTML = `
      <div class="wrap fpg-arcade-shell">
        <div class="fpg-arcade-brand">
          <p class="eyebrow">${copy.kicker}</p>
          <a class="fpg-title-link" id="fpg-arcade-title" href="https://toraikura.github.io/sat-fermentation-playground/" data-event="sat_playground_hub_click" data-experience="hub" data-source-page="${sourcePage}">
            <strong>FERMENTATION<br>PLAYGROUND</strong>
            <span>${copy.hub} <span aria-hidden="true">↗</span></span>
          </a>
          <p class="fpg-arcade-intro">${copy.intro}</p>
          <p class="mono fpg-select">${copy.select}</p>
        </div>
        <div class="fpg-game-grid" aria-label="${english ? 'Fermentation Playground games' : 'FERMENTATION PLAYGROUNDのゲーム'}">
          <button class="fpg-game fpg-game--live fpg-game--clash" type="button" data-play data-event="sat_to_fpg" data-experience="sake-clash" data-source-page="${sourcePage}" aria-label="${english ? 'Play SAKE CLASH' : 'SAKE CLASHを遊ぶ'}">
            <span class="fpg-game-index">01</span>
            <strong class="fpg-game-title"><span>SAKE</span><span>CLASH</span></strong>
            <span class="fpg-preview fpg-preview--clash" aria-hidden="true">
              <span class="fpg-preview-meta">30 SEC / CPU</span>
              <span class="fpg-clash-stage"><i class="fpg-clash-player is-left"></i><i class="fpg-clash-floor floor-a"></i><i class="fpg-clash-floor floor-b"></i><i class="fpg-clash-player is-right"></i></span>
            </span>
            <span class="fpg-game-status">${copy.play} <span aria-hidden="true">↗</span></span>
          </button>
          <a class="fpg-game fpg-game--live fpg-game--aroma" href="https://toraikura.github.io/sat-fermentation-playground/aroma-lab/" data-event="sat_to_fpg" data-experience="aroma-labo" data-source-page="${sourcePage}" aria-label="${english ? 'Open AROMA LABO' : 'AROMA LABOを開く'}">
            <span class="fpg-game-index">02</span>
            <strong class="fpg-game-title"><span>AROMA</span><span>LABO</span></strong>
            <span class="fpg-preview fpg-preview--labo" aria-hidden="true">
              <span class="fpg-labo-card"><small>ISOAMYL</small><i class="fpg-molecule"><b></b><b></b><b></b></i></span>
              <span class="fpg-labo-arrow">→</span>
              <span class="fpg-labo-scent"><i class="fpg-banana"></i><small>BANANA</small></span>
            </span>
            <span class="fpg-game-status">${copy.play} <span aria-hidden="true">↗</span></span>
          </a>
          <a class="fpg-game fpg-game--live fpg-game--match" href="https://toraikura.github.io/sat-fermentation-playground/aroma-lab/aroma-match/" data-event="sat_to_fpg" data-experience="aroma-match" data-source-page="${sourcePage}" aria-label="${english ? 'Open AROMA MATCH' : 'AROMA MATCHを開く'}">
            <span class="fpg-game-index">03</span>
            <strong class="fpg-game-title"><span>AROMA</span><span>MATCH</span></strong>
            <span class="fpg-preview fpg-preview--match" aria-hidden="true">
              <span class="fpg-match-row"><small>ISOAMYL</small><i></i><small>BANANA</small></span>
              <span class="fpg-match-row is-dim"><small>4VG</small><i></i><small>CLOVE</small></span>
            </span>
            <span class="fpg-game-status">${copy.play} <span aria-hidden="true">↗</span></span>
          </a>
          <div class="fpg-game fpg-game--soon fpg-game--rice" aria-disabled="true">
            <span class="fpg-game-index">04</span>
            <strong class="fpg-game-title"><span>RICE</span><span>LINEAGE</span></strong>
            <span class="fpg-preview fpg-preview--rice" aria-hidden="true"><i class="rice-line line-a"></i><i class="rice-line line-b"></i><b class="rice-node n1"></b><b class="rice-node n2"></b><b class="rice-node n3"></b><b class="rice-node n4"></b><b class="rice-node n5"></b></span>
            <span class="fpg-game-status"><i aria-hidden="true"></i>${copy.soon}</span>
          </div>
          <div class="fpg-game fpg-game--soon fpg-game--shubo" aria-disabled="true">
            <span class="fpg-game-index">05</span>
            <strong class="fpg-game-title"><span>SHUBO</span></strong>
            <span class="fpg-preview fpg-preview--shubo" aria-hidden="true"><span class="shubo-tank"><i class="bubble b1"></i><i class="bubble b2"></i><i class="bubble b3"></i><i class="bubble b4"></i><i class="shubo-liquid"></i></span></span>
            <span class="fpg-game-status"><i aria-hidden="true"></i>${copy.soon}</span>
          </div>
          <div class="fpg-game fpg-game--soon fpg-game--pathway" aria-disabled="true">
            <span class="fpg-game-index">06</span>
            <strong class="fpg-game-title"><span>PATHWAY</span></strong>
            <span class="fpg-preview fpg-preview--pathway" aria-hidden="true"><b class="path-node p1"></b><i class="path-arrow a1"></i><b class="path-node p2"></b><i class="path-arrow a2"></i><b class="path-node p3"></b><i class="path-arrow a3"></i><b class="path-node p4"></b></span>
            <span class="fpg-game-status"><i aria-hidden="true"></i>${copy.soon}</span>
          </div>
        </div>
      </div>`;

    const oldEntry = $('.playground-entry');
    oldEntry?.remove();
  }

  renderPlaygroundArcade();

  const modal = $('#play-modal'), slot = $('#play-frame-slot'), loading = $('#play-loading');
  let frame = null, session = '', loadTimer = 0, returnFocus = null;
  let savedY = 0, bodyStyle = '', launchRelease = null, hasFinished = false;

  function fail() {
    if (!modal.open) return;
    loading.hidden = false;
    $('#play-loading-text').textContent = english ? 'The game could not load. Please try again.' : 'ゲームを読み込めませんでした。もう一度お試しください。';
    $('#retry-play').hidden = false;
  }

  function gameURL() {
    const url = new URL(english ? '/play/' : './play/', location.href);
    if (english) url.searchParams.set('lang', 'en');
    return url;
  }

  function load() {
    clearTimeout(loadTimer);
    frame?.remove();
    hasFinished = false;
    delete modal.dataset.outcome;
    loading.hidden = false;
    $('#play-loading-text').textContent = 'LOADING…';
    $('#retry-play').hidden = true;
    session = typeof crypto.randomUUID === 'function' ? crypto.randomUUID() :
      `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const url = gameURL();
    url.searchParams.set('session', session);
    url.searchParams.set('bottle', launchRelease.id);
    frame = document.createElement('iframe');
    frame.title = english ? 'SAKE CLASH, a 30-second CPU battle' : 'SAKE CLASH、30秒のCPU対戦';
    frame.referrerPolicy = 'same-origin';
    frame.src = url.href;
    frame.addEventListener('error', fail);
    slot.appendChild(frame);
    loadTimer = setTimeout(fail, 12000);
  }

  function openGame(trigger) {
    if (modal.open || $('#age')?.open) return;
    if (typeof modal.showModal !== 'function') {
      location.assign(gameURL().href);
      return;
    }
    returnFocus = trigger;
    savedY = window.scrollY;
    bodyStyle = document.body.style.cssText;
    launchRelease = { ...releases[index] };
    modal.showModal();
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedY}px`;
    document.body.style.width = '100%';
    window.dispatchEvent(new CustomEvent('sat:game-active', { detail: true }));
    load();
  }

  function closeGame() {
    clearTimeout(loadTimer);
    session = '';
    frame?.remove();
    frame = null;
    hasFinished = false;
    delete modal.dataset.outcome;
    if (!modal.open) return;
    modal.close();
    document.body.style.cssText = bodyStyle;
    const html = document.documentElement, old = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, savedY);
    returnFocus?.focus({ preventScroll: true });
    requestAnimationFrame(() => { html.style.scrollBehavior = old; });
    window.dispatchEvent(new CustomEvent('sat:game-active', { detail: false }));
  }

  document.querySelectorAll('[data-play]').forEach(button => {
    button.addEventListener('click', () => openGame(button));
  });
  $('#close-play').addEventListener('click', closeGame);
  $('#retry-play').addEventListener('click', load);
  modal.addEventListener('cancel', event => { event.preventDefault(); closeGame(); });
  window.addEventListener('message', event => {
    const data = event.data;
    if (!modal.open || !frame || event.origin !== location.origin ||
      event.source !== frame.contentWindow || !data ||
      data.channel !== 'sat-quick-v1' || data.session !== session) return;
    if (data.type === 'ready') {
      clearTimeout(loadTimer);
      // Ready also begins a replay. Never carry the previous result into a new round.
      hasFinished = false;
      delete modal.dataset.outcome;
      loading.hidden = true;
      frame.focus();
    } else if (data.type === 'exit') closeGame();
    else if (data.type === 'error') fail();
    else if (data.type === 'finished' && ['won', 'lost', 'draw'].includes(data.outcome) &&
      Number.isFinite(data.share) && data.share >= 0 && data.share <= 100 &&
      Number.isInteger(data.played) && data.played >= 1) {
      hasFinished = true;
      modal.dataset.outcome = data.outcome;
    } else if (data.type === 'explore' && hasFinished) {
      const target = new URL(launchRelease.detail, location.href);
      if (target.origin === location.origin) {
        closeGame();
        location.assign(target.href);
      }
    }
  });
  // Returning through the browser back/forward cache must not reveal an empty, locked modal.
  window.addEventListener('pagehide', () => { settle(); closeGame(); });
})();
