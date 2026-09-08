/* iOS photo-saving uses the original PNG, prepared before the sharing gesture.
 * Keep navigator.share() synchronous with the tap: fetching first can expire
 * WebKit's transient user activation. Desktop downloads remain unchanged. */
(function () {
  'use strict';
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const link = document.querySelector('#save-label');
  if (!ios || !link) return;

  const cache = new Map(), toast = document.querySelector('#toast');
  const shareAvailable = typeof navigator.share === 'function' &&
    typeof navigator.canShare === 'function' && typeof File === 'function';
  let nearby = false, sharing = false, waitingKey = '', toastTimer = 0;
  let dialog = null, image = null, help = null, savedBody = '', savedY = 0, locked = false;
  let epoch = 0, active = true;

  function selected() {
    try {
      const url = new URL(link.href, location.href);
      if (url.origin !== location.origin || !/\.png$/i.test(url.pathname)) return null;
      const name = link.download || url.pathname.split('/').pop();
      return { url: url.href, name, key: `${url.href}\n${name}`,
        alt: document.querySelector('#label-image')?.alt || '日本酒のエチケット' };
    } catch (_) { return null; }
  }

  function tell(text) {
    if (!toast) return;
    clearTimeout(toastTimer);
    toast.textContent = text;
    toastTimer = setTimeout(() => {
      if (toast.textContent === text) toast.textContent = '';
    }, 6000);
  }

  function restore() {
    if (!locked) return;
    locked = false;
    document.body.style.cssText = savedBody;
    const html = document.documentElement, behavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo(0, savedY);
    link.focus({ preventScroll: true });
    html.style.scrollBehavior = behavior;
  }

  function closeOriginal() {
    if (!dialog?.open) return;
    dialog.close();
    // The native close event is queued; release the page before a history snapshot.
    restore();
  }

  function showOriginal(item) {
    if (!active) return;
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.id = 'label-save-dialog';
      dialog.className = 'label-save-dialog';
      dialog.setAttribute('aria-labelledby', 'label-save-title');
      dialog.setAttribute('aria-describedby', 'label-save-help');
      const head = document.createElement('div');
      head.className = 'label-save-head';
      const title = document.createElement('h2');
      title.id = 'label-save-title';
      title.textContent = 'エチケットを写真に保存';
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'label-save-close';
      close.textContent = '×';
      close.setAttribute('aria-label', 'エチケット表示を閉じる');
      close.addEventListener('click', closeOriginal);
      head.appendChild(title);
      head.appendChild(close);
      help = document.createElement('p');
      help.id = 'label-save-help';
      image = document.createElement('img');
      image.id = 'label-save-image';
      image.className = 'label-save-image';
      image.addEventListener('error', () => {
        help.textContent = '画像を読み込めませんでした。閉じて、もう一度お試しください。';
      });
      dialog.appendChild(head);
      dialog.appendChild(help);
      dialog.appendChild(image);
      dialog.addEventListener('close', restore);
      document.body.appendChild(dialog);
    }
    if (typeof dialog.showModal !== 'function') {
      // A plain image URL has no download attribute; browser Back returns here.
      location.assign(item.url);
      return;
    }
    help.textContent = '画像を長押し →「写真に保存」';
    image.alt = item.alt;
    image.src = item.url;
    if (dialog.open) return;
    savedBody = document.body.style.cssText;
    savedY = window.scrollY;
    dialog.showModal();
    locked = true;
    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${savedY}px`;
    document.body.style.width = '100%';
  }

  function prepare(item) {
    if (!item || !shareAvailable) return null;
    if (cache.has(item.key)) return cache.get(item.key);
    if (cache.size === 2) {
      const oldest = cache.keys().next().value;
      cache.get(oldest).controller.abort();
      cache.delete(oldest);
    }
    const entry = { file: null, failed: false, controller: new AbortController() };
    cache.set(item.key, entry);
    const requestEpoch = epoch;
    const timeout = setTimeout(() => entry.controller.abort(), 12000);
    entry.promise = fetch(item.url, { credentials: 'same-origin', signal: entry.controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('PNG unavailable');
        return response.blob();
      })
      .then(async blob => {
        const header = new Uint8Array(await blob.slice(0, 8).arrayBuffer());
        if (![137, 80, 78, 71, 13, 10, 26, 10].every((byte, i) => header[i] === byte)) {
          throw new Error('Invalid PNG');
        }
        entry.file = new File([blob], item.name, { type: 'image/png' });
      })
      .catch(() => { entry.failed = true; })
      .finally(() => {
        clearTimeout(timeout);
        if (!active || requestEpoch !== epoch || waitingKey !== item.key || selected()?.key !== item.key) return;
        waitingKey = '';
        if (entry.failed) showOriginal(item);
        else tell('準備できました。もう一度「このエチケットを保存」をタップしてください。');
      });
    return entry;
  }

  const section = document.querySelector('#labels');
  if (shareAvailable && section && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        nearby = true;
        prepare(selected());
        observer.disconnect();
      }
    }, { rootMargin: '600px 0px' });
    observer.observe(section);
  } else if (shareAvailable) {
    nearby = true;
    prepare(selected());
  }
  window.addEventListener('sat:label', () => {
    waitingKey = '';
    if (nearby) prepare(selected());
  });

  link.addEventListener('click', event => {
    event.preventDefault();
    if (sharing) return;
    nearby = true;
    const item = selected();
    if (!item) { tell('エチケットを選び直して、もう一度お試しください。'); return; }
    const entry = prepare(item);
    if (!shareAvailable || entry?.failed) { showOriginal(item); return; }
    if (!entry.file) {
      waitingKey = item.key;
      tell('画像を準備しています。準備できたら、もう一度タップしてください。');
      return;
    }
    const shareEpoch = epoch;
    const fail = error => {
      if (error?.name !== 'AbortError' && active && shareEpoch === epoch) showOriginal(item);
    };
    try {
      if (!navigator.canShare({ files: [entry.file] })) { showOriginal(item); return; }
      sharing = true;
      // Do not insert await, fetch or a microtask before this call.
      const result = navigator.share({ files: [entry.file] });
      Promise.resolve(result).catch(fail).finally(() => {
        if (shareEpoch === epoch) sharing = false;
      });
    } catch (error) {
      sharing = false;
      fail(error);
    }
  });
  window.addEventListener('pagehide', () => {
    active = false;
    epoch += 1;
    waitingKey = '';
    sharing = false;
    closeOriginal();
    for (const entry of cache.values()) entry.controller.abort();
    cache.clear();
  });
  window.addEventListener('pageshow', () => {
    active = true;
    if (nearby) prepare(selected());
  });
})();
