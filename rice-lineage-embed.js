/* RICE LINEAGE launcher for the existing FERMENTATION PLAYGROUND arcade.
   The game document is never requested until the user explicitly launches it. */
(function () {
  'use strict';

  const GAME_URL = 'https://toraikura.github.io/sat-fermentation-playground/rice-lineage/';
  const english = document.documentElement.lang === 'en';
  const copy = english ? {
    label: 'Play RICE LINEAGE — connect the lines and drive the roots through 14 stages and 4 worlds',
    play: 'PLAY RICE LINEAGE',
    meta: 'SAKE RICE LINEAGE / 14 STAGES / 4 WORLDS',
    modalTitle: 'RICE LINEAGE | Sake Rice Lineage',
    close: 'BACK TO SAKE ART TOKYO',
    loading: 'LOADING RICE LINEAGE…',
    error: 'RICE LINEAGE could not load. Open the game directly.',
    direct: 'OPEN RICE LINEAGE ↗'
  } : {
    label: 'RICE LINEAGE｜酒米の系譜。線をつなげ。ルーツを走れ。14 STAGES / 4 WORLDS',
    play: 'PLAY RICE LINEAGE',
    meta: '酒米の系譜 / 14 STAGES / 4 WORLDS',
    modalTitle: 'RICE LINEAGE｜酒米の系譜',
    close: 'SAKE ART TOKYOへ戻る',
    loading: 'RICE LINEAGEを読み込み中…',
    error: 'RICE LINEAGEを読み込めませんでした。ゲームを直接開いてください。',
    direct: 'RICE LINEAGEを開く ↗'
  };

  let launcher = null;
  let modal = null;
  let frame = null;
  let savedY = 0;
  let returnFocus = null;
  let loadTimer = 0;

  function enhanceCard() {
    const current = document.querySelector('.fpg-game--rice');
    if (!current || current.matches('[data-rice-lineage-launch]')) return current;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'fpg-game fpg-game--live fpg-game--rice sat-rice-lineage-card';
    button.dataset.riceLineageLaunch = '';
    button.setAttribute('aria-label', copy.label);
    button.innerHTML = current.innerHTML;

    const status = button.querySelector('.fpg-game-status');
    if (status) status.innerHTML = `${copy.play} <span aria-hidden="true">↗</span>`;

    const preview = button.querySelector('.fpg-preview--rice');
    if (preview && !preview.querySelector('.sat-rice-lineage-card-meta')) {
      const meta = document.createElement('span');
      meta.className = 'sat-rice-lineage-card-meta';
      meta.textContent = copy.meta;
      preview.appendChild(meta);
    }

    current.replaceWith(button);
    button.addEventListener('click', openGame);
    return button;
  }

  function buildModal() {
    if (modal) return modal;

    modal = document.createElement('dialog');
    modal.className = 'sat-rice-lineage-modal';
    modal.setAttribute('aria-labelledby', 'sat-rice-lineage-modal-title');
    modal.innerHTML = `
      <div class="sat-rice-lineage-shell">
        <header class="sat-rice-lineage-head">
          <div>
            <small>FERMENTATION PLAYGROUND / INTERACTIVE EXPERIENCE</small>
            <strong id="sat-rice-lineage-modal-title">RICE LINEAGE <span>｜ ${english ? 'SAKE RICE LINEAGE' : '酒米の系譜'}</span></strong>
          </div>
          <button class="sat-rice-lineage-close" type="button" aria-label="${copy.close}">${copy.close} <span aria-hidden="true">×</span></button>
        </header>
        <div class="sat-rice-lineage-frame-slot">
          <div class="sat-rice-lineage-loading" role="status">${copy.loading}</div>
        </div>
      </div>`;

    document.body.appendChild(modal);
    modal.querySelector('.sat-rice-lineage-close').addEventListener('click', closeGame);
    modal.addEventListener('cancel', event => {
      event.preventDefault();
      closeGame();
    });
    modal.addEventListener('close', cleanupFrame);
    return modal;
  }

  function showLoadError() {
    if (!modal || !modal.open) return;
    const slot = modal.querySelector('.sat-rice-lineage-frame-slot');
    if (!slot) return;
    slot.querySelector('.sat-rice-lineage-loading')?.remove();
    if (slot.querySelector('.sat-rice-lineage-error')) return;
    const error = document.createElement('div');
    error.className = 'sat-rice-lineage-error';
    error.innerHTML = `<p>${copy.error}</p><a href="${GAME_URL}" target="_blank" rel="noopener noreferrer">${copy.direct}</a>`;
    slot.appendChild(error);
  }

  function openGame() {
    launcher = enhanceCard() || launcher;
    const dialog = buildModal();
    if (dialog.open) {
      dialog.querySelector('.sat-rice-lineage-close')?.focus();
      return;
    }

    returnFocus = document.activeElement;
    savedY = window.scrollY;
    document.documentElement.classList.add('sat-rice-lineage-open');
    dialog.showModal();

    const slot = dialog.querySelector('.sat-rice-lineage-frame-slot');
    slot.innerHTML = `<div class="sat-rice-lineage-loading" role="status">${copy.loading}</div>`;

    frame = document.createElement('iframe');
    frame.className = 'sat-rice-lineage-frame';
    frame.title = copy.modalTitle;
    frame.allow = 'autoplay; fullscreen';
    frame.referrerPolicy = 'strict-origin-when-cross-origin';
    frame.src = GAME_URL;
    frame.addEventListener('load', () => {
      clearTimeout(loadTimer);
      slot.querySelector('.sat-rice-lineage-loading')?.remove();
    }, { once: true });
    frame.addEventListener('error', showLoadError, { once: true });
    slot.appendChild(frame);

    loadTimer = window.setTimeout(showLoadError, 15000);
    window.requestAnimationFrame(() => dialog.querySelector('.sat-rice-lineage-close')?.focus());
  }

  function closeGame() {
    if (modal?.open) modal.close();
  }

  function cleanupFrame() {
    clearTimeout(loadTimer);
    loadTimer = 0;
    frame?.remove();
    frame = null;
    document.documentElement.classList.remove('sat-rice-lineage-open');
    window.scrollTo(0, savedY);
    if (returnFocus instanceof HTMLElement && returnFocus.isConnected) returnFocus.focus({ preventScroll: true });
    returnFocus = null;
  }

  launcher = enhanceCard();

  // Defensive: if the arcade is rendered later for any reason, enhance only the RICE LINEAGE slot.
  if (!launcher) {
    const observer = new MutationObserver(() => {
      launcher = enhanceCard();
      if (launcher) observer.disconnect();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }
})();
