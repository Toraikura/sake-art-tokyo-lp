"""Offline component checks; no network, policy changes, or game-state injection.

For restricted environments only. Styles/assets are inlined and ES module imports
are bundled into one lexical scope. Production HTTP/iframe navigation must also be
checked with test_ui.py on a normal local server before deployment.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import base64
import json
import mimetypes
import os
import re

ROOT = Path(__file__).resolve().parents[2]
APP = ROOT / 'experiments/after-hours-water'
OUT = Path(os.environ.get('EVIDENCE_DIR', ROOT / 'evidence/offline'))
OUT.mkdir(parents=True, exist_ok=True)


def data_uri(path):
    return 'data:' + (mimetypes.guess_type(path)[0] or 'application/octet-stream') + ';base64,' + base64.b64encode(path.read_bytes()).decode()


def markup(game=False, release_count=None):
    folder = APP / 'play' if game else APP
    html = (folder / 'index.html').read_text()
    html = re.sub(r'<link rel="stylesheet" href="([^"]+)">', lambda m: '<style>' + (folder / m[1]).read_text() + '</style>', html)
    html = re.sub(r'<script\b[^>]*\bsrc="[^"]+"[^>]*></script>', '', html)
    if game:
        parts = []
        for name in ['model.js', 'art.js', 'preview.js', 'render.js', 'game.js']:
            source = (folder / name).read_text()
            source = re.sub(r'^import .*?;\s*', '', source, flags=re.M)
            source = re.sub(r'\bexport\s+(?=const |function )', '', source)
            parts.append(source)
        script = '(()=>{\n' + '\n'.join(parts) + '\n})();'
    else:
        match = re.search(r'(<script id="label-releases" type="application/json">)(.*?)(</script>)', html, flags=re.S)
        releases = json.loads(match[2])
        if release_count is not None:
            releases = [{**releases[i % 2], 'id': f'sat-{i+1:03d}', 'name': f'Test release {i+1}', 'detail': f'../../index.html#sat-{i+1:03d}'} for i in range(release_count)]
        for release in releases:
            for key in ['image', 'download']:
                release[key] = data_uri(folder / release[key])
        html = html[:match.start(2)] + json.dumps(releases) + html[match.end(2):]
        html = re.sub(r'<img\b[^>]*>', lambda m: re.sub(r'\bsrc="([^"]+)"', lambda n: 'src="' + data_uri((folder / n[1]).resolve()) + '"' if not n[1].startswith(('https:', 'data:')) else n[0], m[0]), html)
        script = (folder / 'site.js').read_text() + '\n' + (folder / 'intuitive.js').read_text()
    return html.replace('</body>', '<script>' + script + '</script></body>')


def touch_swipe(context, page, locator, dx, dy):
    box = locator.bounding_box()
    x = box['x'] + box['width'] * (.75 if dx < 0 else .25)
    y = box['y'] + box['height'] * .6
    client = context.new_cdp_session(page)
    client.send('Input.dispatchTouchEvent', {'type': 'touchStart', 'touchPoints': [{'x': x, 'y': y}]})
    for fraction in [.15, .4, .7, 1]:
        client.send('Input.dispatchTouchEvent', {'type': 'touchMove', 'touchPoints': [{'x': x + dx * fraction, 'y': y + dy * fraction}]})
    client.send('Input.dispatchTouchEvent', {'type': 'touchEnd', 'touchPoints': []})
    client.detach()
    page.wait_for_timeout(420)


def new_page(browser, width, height, game=False, count=None, reduced=False, touch=True):
    context = browser.new_context(viewport={'width': width, 'height': height}, is_mobile=touch, has_touch=touch,
                                  device_scale_factor=1, reduced_motion='reduce' if reduced else 'no-preference')
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_content(markup(game=game, release_count=count), wait_until='load')
    if not game:
        page.locator('#age-yes').click()
    page.wait_for_timeout(350)
    assert not errors, errors
    return context, page, errors


checks = []
with sync_playwright() as playwright:
    browser = playwright.chromium.launch(executable_path=os.environ.get('PLAYWRIGHT_EXECUTABLE_PATH'),
                                        headless=True, args=['--no-sandbox'])
    try:
        context, page, errors = new_page(browser, 390, 844)
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.locator('[data-mood-choice="deep"]').tap()
        assert page.locator('#label-stack').get_attribute('data-release') == 'sat-002'
        page.locator('#labels').scroll_into_view_if_needed()
        page.wait_for_timeout(350)
        page.locator('#labels').screenshot(path=str(OUT / 'labels-390.png'))
        page.locator('#label-stack').tap()
        page.wait_for_timeout(400)
        assert page.locator('#label-counter').inner_text() == '01 / 02'
        assert page.locator('#save-label').get_attribute('download') == 'SAT_001_Melon_Cotton_Candy.png'
        # Compare the complete PNG bytes addressed by the save link with the real source.
        addressed = page.locator('#save-label').get_attribute('href')
        assert base64.b64decode(addressed.split(',', 1)[1]) == (APP / 'assets/sat-001-label.png').read_bytes()
        touch_swipe(context, page, page.locator('#label-stack'), -110, 0)
        assert page.locator('#label-counter').inner_text() == '02 / 02'
        before = page.locator('#label-counter').inner_text()
        touch_swipe(context, page, page.locator('#label-stack'), 0, -100)
        assert page.locator('#label-counter').inner_text() == before
        page.locator('#label-prev').tap()
        page.wait_for_timeout(400)
        assert page.locator('#label-counter').inner_text() == '01 / 02'
        assert page.locator('#label-details').get_attribute('href').endswith('#sat-001')
        page.locator('#sat-002 .record-art').screenshot(path=str(OUT / 'poster-corrected-390.png'))
        page.locator('#play').screenshot(path=str(OUT / 'play-entry-390.png'))
        assert page.locator('#comic img').count() == 1
        assert not errors, errors
        checks.append('390px LP: real tap/swipe/arrow input; vertical scroll does not select; mood sync; PNG save-link bytes and product link; final comic retained.')
        context.close()

        for width, height in [(320, 568), (360, 640), (375, 550), (430, 932), (1440, 1000)]:
            context, page, errors = new_page(browser, width, height, touch=width < 700)
            assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), (width, 'horizontal overflow')
            page.locator('#labels').screenshot(path=str(OUT / f'labels-{width}.png'))
            assert not errors, errors
            context.close()
        checks.append('LP has no horizontal overflow at 320, 360, 375, 390, 430 and 1440px; screenshots inspected separately.')

        for count in [1, 3, 10]:
            context, page, errors = new_page(browser, 390, 844, count=count, reduced=True)
            page.locator('#labels').scroll_into_view_if_needed()
            if count == 1:
                assert page.locator('#label-next').is_disabled()
                assert page.locator('#label-stack').is_disabled()
            else:
                for i in range(count):
                    assert page.locator('#label-counter').inner_text() == f'{i+1:02d} / {count:02d}'
                    assert page.locator('#label-details').get_attribute('href').endswith(f'#sat-{i+1:03d}')
                    page.locator('#label-next').tap()
                assert page.locator('#label-counter').inner_text() == f'01 / {count:02d}'
            assert page.locator('.sleeve:visible').count() == min(count, 3)
            assert not errors, errors
            context.close()
        checks.append('Catalogs with 1, 3 and 10 entries: wrapping, disabled singleton controls, counter, per-product link, at most 3 visible sleeves; reduced motion.')

        context, page, errors = new_page(browser, 390, 796, game=True)
        page.wait_for_timeout(2200)
        arena = page.locator('#arena')
        assert arena.get_attribute('data-tick') == '0'
        assert arena.get_attribute('data-units') == '[]'
        assert page.locator('#time').inner_text() == '30'
        assert page.locator('.game-card.prompt').count() == 1
        page.screenshot(path=str(OUT / 'game-ready-390.png'))
        page.locator('.game-card').first.tap()
        assert page.locator('#first-target').is_visible()
        box = arena.bounding_box()
        page.touchscreen.tap(box['x'] + box['width'] * .5, box['y'] + box['height'] * .58)
        page.wait_for_timeout(1500)
        assert arena.get_attribute('data-played') == '1'
        assert int(page.locator('#time').inner_text()) < 30
        # Another real play makes the thumbnail representative of the shipped experience.
        page.locator('.game-card').nth(1).tap()
        page.touchscreen.tap(box['x'] + box['width'] * .25, box['y'] + box['height'] * .63)
        page.wait_for_timeout(5000)
        page.screenshot(path=str(OUT / 'game-playing-390.png'))
        assert arena.get_attribute('data-played') == '2'
        assert arena.get_attribute('data-enemy-action') != '戦況を見ています', 'CPU must make a real card deployment (including spells)'
        page.locator('#pause').tap()
        frozen = page.locator('#time').inner_text()
        page.wait_for_timeout(1000)
        assert page.locator('#time').inner_text() == frozen
        assert arena.get_attribute('data-status') == 'paused'
        page.locator('#resume').tap()
        page.locator('#explore').wait_for(state='visible', timeout=42000)
        assert arena.get_attribute('data-status') in ['won', 'lost', 'draw']
        assert page.url == 'about:blank'
        page.screenshot(path=str(OUT / 'game-result-390.png'))
        page.locator('#replay').tap()
        page.wait_for_timeout(350)
        assert page.locator('#time').inner_text() == '30'
        assert arena.get_attribute('data-played') == '0'
        # A first direct board tap also works, even without choosing the highlighted card.
        page.touchscreen.tap(box['x'] + box['width'] * .5, box['y'] + box['height'] * .58)
        page.wait_for_timeout(250)
        assert arena.get_attribute('data-played') == '1'
        assert not errors, errors
        context.close()
        checks.append('Real 30-second game: frozen timer/CPU before first move, highlighted starter, touch deployment, live CPU, pause/resume, natural result, replay, direct-board starter. No fabricated game state or accelerated clock.')

        for width, height in [(320, 524), (360, 596), (375, 506), (430, 888), (558, 850)]:
            context, page, errors = new_page(browser, width, height, game=True)
            for selector in ['#arena', '.game-card[data-index="0"]', '.game-card[data-index="3"]', '#pause']:
                box = page.locator(selector).bounding_box()
                assert box['x'] >= -.5 and box['y'] >= -.5 and box['x'] + box['width'] <= width + .5 and box['y'] + box['height'] <= height + .5, (width, height, selector, box)
            page.screenshot(path=str(OUT / f'game-{width}x{height}.png'))
            assert not errors, errors
            context.close()
        checks.append('Game board, all hand cards and pause button fit 320x524, 360x596, 375x506, 390x796, 430x888, 558x850 content viewports.')

        context, page, errors = new_page(browser, 558, 850, game=True, reduced=True, touch=False)
        page.keyboard.press('1')
        page.keyboard.press('ArrowRight')
        page.keyboard.press('Enter')
        page.wait_for_timeout(200)
        assert page.locator('#arena').get_attribute('data-played') == '1'
        page.keyboard.press('p')
        assert page.locator('#resume').is_visible()
        page.locator('#resume').click()
        page.evaluate('window.dispatchEvent(new PageTransitionEvent("pagehide", {persisted:true})); window.dispatchEvent(new PageTransitionEvent("pageshow", {persisted:true}));')
        assert page.locator('#resume').is_visible()
        tick = int(page.locator('#arena').get_attribute('data-tick'))
        page.locator('#resume').click()
        page.wait_for_timeout(500)
        assert int(page.locator('#arena').get_attribute('data-tick')) > tick
        assert not errors, errors
        context.close()
        checks.append('Keyboard 1/arrow/Enter placement and P pause; reduced-motion game; synthetic pagehide/pageshow lifecycle and manual resumption.')
    finally:
        browser.close()

report = {'passed': checks, 'mode': 'offline component browser tests: styles/assets inlined, ESM bundled; real Chromium touch/mouse/keyboard input',
          'not_verified': ['HTTP asset loading', 'same-origin iframe start/result handshake', 'cross-page navigation/download in Safari', 'physical iPhone Safari', 'human first-time usability / game balance']}
(OUT / 'results.json').write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(report, ensure_ascii=False, indent=2))
