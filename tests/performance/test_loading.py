"""Cold-load budgets and real arcade reveal, without a special production bypass."""
import os
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE_URL', 'http://127.0.0.1:4190/')

def preview_request(url):
    return '/aroma-lab/thumbs/' in url or '/assets/game-preview.webp' in url

with sync_playwright() as p:
    browser = p.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_EXECUTABLE_PATH'))
    for path in ('', 'en/'):
        context = browser.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        page = context.new_page()
        requests = []
        page.on('request', lambda request: requests.append(request.url))
        page.goto(urljoin(BASE, path), wait_until='networkidle')
        page.wait_for_timeout(3000)
        assert page.locator('#age').is_visible()
        assert not any('/assets/audio/water/' in url for url in requests), requests
        assert not any(preview_request(url) for url in requests), requests
        assert page.locator('iframe').count() == 0

        # Exercise the real local age-confirmation control, not injected CSS/DOM.
        page.locator('#age-yes').click()
        page.wait_for_timeout(3000)
        audio = {url for url in requests if '/assets/audio/water/' in url}
        assert 1 <= len(audio) <= 2, audio
        assert not any(preview_request(url) for url in requests), requests
        page.locator('#play').scroll_into_view_if_needed()
        page.wait_for_function("document.querySelector('#play').classList.contains('fpg-previews-ready')")
        page.wait_for_function("getComputedStyle(document.querySelector('.fpg-preview--clash')).backgroundImage.includes('game-preview.webp')")
        # CSS can contain a valid URL even when its image is a 404 or corrupt.
        # Decode the same cached resources to verify the artwork is usable.
        page.evaluate("""async () => {
          const selectors = '.fpg-preview--clash,.fpg-labo-scent,.fpg-match-row small:last-child';
          const urls = new Set([...document.querySelectorAll(selectors)].map(element =>
            getComputedStyle(element).backgroundImage.match(/url\\([\"']?([^\"')]+)[\"']?\\)/)?.[1]
          ));
          if (urls.size !== 3 || urls.has(undefined)) throw new Error('Missing preview artwork');
          await Promise.all([...urls].map(async url => {
            const img = new Image(); img.src = url; await img.decode();
            if (!img.naturalWidth) throw new Error('Empty preview artwork');
          }));
        }""")
        assert len({url for url in requests if preview_request(url)}) == 3, requests
        assert page.locator('iframe').count() == 0  # Actual game remains click-to-load.
        layout = page.evaluate("({width:innerWidth,scrollWidth:document.documentElement.scrollWidth})")
        assert layout['scrollWidth'] <= layout['width'], layout
        context.close()
    # Without JS, retain the original static thumbnail and its sizing rules.
    for path in ('', 'en/'):
        context = browser.new_context(java_script_enabled=False, viewport={'width': 390, 'height': 844})
        page = context.new_page()
        page.goto(urljoin(BASE, path), wait_until='networkidle')
        page.locator('#play').scroll_into_view_if_needed()
        img = page.locator('.play-launch > noscript > img')
        img.wait_for(state='visible')
        page.wait_for_function("document.querySelector('.play-launch > noscript > img').naturalWidth > 0")
        style = img.evaluate("img => ({fit:getComputedStyle(img).objectFit,position:getComputedStyle(img).objectPosition,width:img.width})")
        assert style['fit'] == 'cover' and style['position'] == '50% 32%' and style['width'] > 200, style
        context.close()
    browser.close()
print('PASS: JA/EN age gate has no audio/arcade requests; at most two sounds warm after entry; three real previews load near the arcade; no eager game iframe or overflow.')
