"""English-edition HTTP flows, with real input and an unmodified game clock.

BASE_URL may be either the site root or /en/. Chromium touch/viewport and iOS
capability emulation do not establish physical iPhone Safari/Photos behavior.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import time
import traceback
from urllib.parse import parse_qs, urljoin, urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:4190/")
SITE = urljoin(BASE, "/")
EN = urljoin(SITE, "en/")
PUBLIC = "https://sakearttokyo.com/"
OUT = Path(os.environ.get("EVIDENCE_DIR", "/private/tmp/sat-english-tests"))
OUT.mkdir(parents=True, exist_ok=True)
JP = re.compile(r"[\u3040-\u30ff\u3400-\u9fff]")
report = {"status": "running", "checks": [], "layouts": [], "downloads": [],
          "pageErrors": [], "httpErrors": [], "images": [], "languageLeaks": [],
          "notTested": ["Physical iPhone Safari", "Native iOS share sheet and Photos save"]}


def observe(page):
    page.on("pageerror", lambda error: report["pageErrors"].append(str(error)))
    page.on("response", lambda response: report["httpErrors"].append({
        "url": response.url, "status": response.status
    }) if response.status >= 400 else None)


def no_japanese(page, label):
    """Check rendered text/accessibility strings; original label artwork is kept."""
    content = page.evaluate("""() => {
      const visible = el => {
        if (el.closest('[hidden], [aria-hidden="true"], script, style, noscript')) return false;
        const css = getComputedStyle(el);
        return css.visibility !== 'hidden' && css.display !== 'none' && el.getClientRects().length;
      };
      const texts = [], walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      while (walk.nextNode()) {
        const node = walk.currentNode, el = node.parentElement;
        if (!el || !visible(el) || el.closest('.source-name')) continue;
        if (node.textContent.trim()) texts.push({kind:'text', element:el.id || el.tagName,
          text:node.textContent.trim()});
      }
      for (const el of document.querySelectorAll('[aria-label], img[alt]')) {
        if (!visible(el)) continue;
        for (const attribute of ['aria-label','alt']) {
          if (el.hasAttribute(attribute)) texts.push({kind:attribute,
            element:el.id || el.tagName, text:el.getAttribute(attribute)});
        }
      }
      return texts;
    }""")
    leaks = [{"page": label, **entry} for entry in content if JP.search(entry["text"])]
    report["languageLeaks"].extend(leaks)
    assert not leaks, ("Untranslated visible UI", leaks)


def within(locator, bounds):
    assert locator.is_visible(), str(locator)
    box = locator.bounding_box()
    assert box and box["width"] > 0 and box["height"] > 0
    assert box["x"] >= bounds["x"] - 1 and box["y"] >= bounds["y"] - 1, (box, bounds)
    assert box["x"] + box["width"] <= bounds["x"] + bounds["width"] + 1, (box, bounds)
    assert box["y"] + box["height"] <= bounds["y"] + bounds["height"] + 1, (box, bounds)


def text_fits(locator):
    info = locator.evaluate("""el => {
      const range = document.createRange(); range.selectNodeContents(el);
      const rects = [...range.getClientRects()].filter(r => r.width && r.height);
      const clips = [];
      for (let p = el; p; p = p.parentElement) {
        const css = getComputedStyle(p), b = p.getBoundingClientRect();
        const x = ['hidden','clip','auto','scroll'].includes(css.overflowX);
        const y = ['hidden','clip','auto','scroll'].includes(css.overflowY);
        if (x || y) clips.push({id:p.id || p.tagName, x, y,
          left:b.left+p.clientLeft, top:b.top+p.clientTop,
          right:b.left+p.clientLeft+p.clientWidth, bottom:b.top+p.clientTop+p.clientHeight});
      }
      return {text:el.textContent.trim(),clips,rects:rects.map(r =>
        ({left:r.left,top:r.top,right:r.right,bottom:r.bottom}))};
    }""")
    for rect in info["rects"]:
        for clip in info["clips"]:
            if clip["x"]:
                assert rect["left"] >= clip["left"] - 2 and rect["right"] <= clip["right"] + 2, info
            if clip["y"]:
                assert rect["top"] >= clip["top"] - 2 and rect["bottom"] <= clip["bottom"] + 2, info


def metadata(page, language):
    target = PUBLIC + ("en/" if language == "en" else "")
    assert page.locator("html").get_attribute("lang") == language
    assert page.locator('link[rel="canonical"]').get_attribute("href") == target
    alternates = {item.get_attribute("hreflang"): item.get_attribute("href")
                  for item in page.locator('link[rel="alternate"][hreflang]').all()}
    assert alternates.get("ja") == PUBLIC and alternates.get("en") == PUBLIC + "en/", alternates
    for item in page.locator('meta[name="robots"], meta[name="googlebot"]').all():
        assert not re.search(r"noindex|nofollow", item.get_attribute("content") or "", re.I)
    assert page.locator('meta[property="og:url"]').get_attribute("content") == target
    for selector in ('meta[property="og:image"]', 'meta[name="twitter:image"]'):
        assert page.locator(selector).get_attribute("content").startswith(PUBLIC)
    assert "toraikura.github.io" not in page.locator("head").inner_html()
    if language == "en":
        for text in (page.title(), page.locator('meta[name="description"]').get_attribute("content")):
            assert text and not JP.search(text), text
        structured = [json.loads(item.text_content()) for item in page.locator('script[type="application/ld+json"]').all()]
        assert any(item.get("url") == target and item.get("inLanguage") == "en" for item in structured), structured


def selection(page, release):
    mood, source, side = ("light", "urasato", "SIDE A / URAZATO") if release == "sat-001" else ("deep", "tsuchida", "SIDE B / TSUCHIDA")
    page.wait_for_function("id => document.querySelector('#label-stack').dataset.release === id", arg=release)
    page.wait_for_timeout(450)
    assert page.locator("body").get_attribute("data-mood") == mood
    assert page.locator("#source-scene").get_attribute("data-source") == source
    assert page.locator("#side-title").inner_text() == side
    assert page.locator(".source-card[aria-pressed=true]").count() == 1
    assert page.locator(f'.source-card[data-source="{source}"]').get_attribute("aria-pressed") == "true"
    assert page.locator(".record[data-selected=true]").count() == 1
    assert page.locator("#" + release).get_attribute("data-selected") == "true"
    detail = urljoin(page.url, page.locator("#label-details").get_attribute("href"))
    assert urlsplit(detail).path == "/en/" and urlsplit(detail).fragment == release, detail
    colors = page.evaluate("""() => {
      const style = s => getComputedStyle(document.querySelector(s));
      return {hero:style('#hero-title .last').color,dot:style('.motion-dot').backgroundColor,
        rule:style('.theme-rule').backgroundColor,arcade:style('.arcade').backgroundColor,
        story:style('.manifesto h2 em').color,comic:style('.comic-section').backgroundColor};
    }""")
    assert colors["hero"] == colors["dot"] == colors["rule"], colors
    no_japanese(page, "selection-" + source)
    return colors


def images(page, width):
    for image in page.locator("img[src]").all():
        if not image.is_visible() and image.get_attribute("loading") == "lazy":
            continue
        if image.is_visible():
            image.scroll_into_view_if_needed()
        image.evaluate("img => img.decode()")
        info = image.evaluate("img => ({src:img.currentSrc || img.src,width:img.naturalWidth,height:img.naturalHeight})")
        assert info["width"] > 0 and info["height"] > 0, info
        report["images"].append({"viewport": width, **info})
    for image in page.locator("svg image[href]").all():
        info = image.evaluate("""async el => {
          const img = new Image(); img.src = new URL(el.getAttribute('href'),document.baseURI);
          await img.decode(); return {src:img.src,width:img.naturalWidth,height:img.naturalHeight};
        }""")
        assert info["width"] > 0 and info["height"] > 0, info
        report["images"].append({"viewport": width, **info})
    assert page.locator("#comic-image").is_visible()
    assert not page.locator("#comic-error").is_visible()


def open_game(page):
    page.locator(".play-launch").click()
    page.wait_for_function("document.querySelector('#play-loading').hidden")
    frame = page.locator("#play-frame-slot iframe").element_handle().content_frame()
    assert frame is not None
    frame.locator('#arena[data-status="playing"]').wait_for()
    assert parse_qs(urlsplit(frame.url).query).get("lang") == ["en"], frame.url
    assert frame.locator("html").get_attribute("lang") == "en"
    no_japanese(frame, "English-game-ready")
    return frame


def run():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True,
            executable_path=os.environ.get("PLAYWRIGHT_EXECUTABLE_PATH"), args=["--no-sandbox"])
        contexts = []
        try:
            # The age gate's accepted and declined states both need real English UI.
            for declined in (True, False):
                context = browser.new_context(viewport={"width": 375, "height": 667}, is_mobile=True, has_touch=True)
                contexts.append(context)
                page = context.new_page(); observe(page)
                assert page.goto(EN, wait_until="networkidle").status == 200
                page.locator("#age").wait_for(state="visible")
                no_japanese(page, "age-initial")
                for selector in ("#age-title", "#age-copy", "#age-yes", "#age-no"):
                    text_fits(page.locator(selector))
                page.locator("#age-no" if declined else "#age-yes").tap()
                if declined:
                    no_japanese(page, "age-declined")
                    assert page.evaluate("localStorage.getItem('sat-age-confirmed')") != "yes"
                    page.screenshot(path=str(OUT / "age-declined-375.png"))
                else:
                    assert not page.locator("#age").is_visible()
                    assert page.evaluate("localStorage.getItem('sat-age-confirmed')") == "yes"
                context.close(); contexts.remove(context)
            report["checks"].append("English age gate accepts/declines real taps; the declined state stays unconfirmed.")

            for width, height in ((1440, 1000), (390, 844), (375, 812)):
                context = browser.new_context(viewport={"width": width, "height": height},
                    is_mobile=width < 700, has_touch=width < 700, device_scale_factor=1, accept_downloads=True)
                contexts.append(context)
                context.add_init_script("localStorage.setItem('sat-age-confirmed','yes')")
                page = context.new_page(); observe(page)
                page.goto(EN, wait_until="networkidle")
                metadata(page, "en")
                assert page.locator("#hero-title > span").all_text_contents() == ["NOT", "JUST", "SAKE"]
                assert not page.locator("#source-flow, .source-flow, [data-flow], .hero-actions").count()
                assert page.locator(".record-shop[hidden]").count() == 2
                assert all(not item.is_visible() for item in page.locator(".shop-button").all())
                assert page.locator(".record-story").count() == 2
                for item in page.locator(".record-storage").all():
                    assert "room temperature" in item.inner_text().lower(), item.inner_text()
                assert "kijo" in page.locator("#sat-002 .record-story").inner_text().lower()
                for card in page.locator(".source-card").all():
                    box = card.bounding_box()
                    assert box["height"] >= 44 and box["width"] >= 44
                for selector in ("#hero-title", ".hero-ja", "#source-copy", "#source-brewery", "#side-title"):
                    text_fits(page.locator(selector))
                light = selection(page, "sat-001")
                page.screenshot(path=str(OUT / f"hero-urasato-{width}.png"))
                page.locator('[data-mood-choice="deep"]').click()
                deep = selection(page, "sat-002")
                assert all(light[key] != deep[key] for key in light), (light, deep)
                page.screenshot(path=str(OUT / f"hero-tsuchida-{width}.png"))
                page.locator("#label-next").click()
                assert selection(page, "sat-001") == light
                page.locator("#label-stack").click()
                assert selection(page, "sat-002") == deep
                page.locator("#label-prev").click()
                assert selection(page, "sat-001") == light
                for selector in ("#label-name", "#label-brewery", "#save-label", "#label-details", "#takeaway-title"):
                    text_fits(page.locator(selector))
                page.locator("#labels").screenshot(path=str(OUT / f"labels-{width}.png"))
                page.locator(".brand-intro").screenshot(path=str(OUT / f"brand-{width}.png"))
                page.locator("#motion").click(); no_japanese(page, "motion-paused")
                page.locator("#motion").click(); no_japanese(page, "motion-resumed")
                page.locator("#privacy-open").click()
                assert page.locator("#policy").is_visible()
                no_japanese(page, "privacy-open")
                text_fits(page.locator("#policy-title"))
                page.locator("#policy-close").click()
                assert not page.locator("#policy").is_visible()
                images(page, width)
                page.locator("#comic").screenshot(path=str(OUT / f"comic-{width}.png"))
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
                report["layouts"].append({"width": width, "height": height, "overflow": False,
                    "sourceAndLabelSynchronization": True, "light": light, "deep": deep})
                if width == 1440:
                    releases = json.loads(page.locator("#label-releases").text_content())
                    for release in releases:
                        page.locator('[data-mood-choice="' + ("light" if release["id"] == "sat-001" else "deep") + '"]').click()
                        selection(page, release["id"])
                        with page.expect_download() as event:
                            page.locator("#save-label").click()
                        download = event.value
                        assert download.failure() is None
                        assert download.suggested_filename == release["filename"]
                        destination = OUT / download.suggested_filename
                        download.save_as(str(destination))
                        data = destination.read_bytes()
                        assert data[:8] == b"\x89PNG\r\n\x1a\n"
                        asset = ROOT / urlsplit(urljoin(EN, release["download"])).path.lstrip("/")
                        assert hashlib.sha256(data).digest() == hashlib.sha256(asset.read_bytes()).digest()
                        report["downloads"].append({"release": release["id"], "sha256": hashlib.sha256(data).hexdigest()})
                if width == 390:
                    exercise_game(page)
                context.close(); contexts.remove(context)
            report["checks"].append("1440/390/375: English metadata and UI, source/label/theme sync, original images, hidden sales, readable controls, both original PNG downloads and no page overflow passed.")

            # Capability emulation only: unsupported iOS sharing must offer English
            # long-press guidance and preserve the selected original image.
            context = browser.new_context(viewport={"width": 375, "height": 812}, is_mobile=True, has_touch=True,
                user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1")
            contexts.append(context)
            context.add_init_script("""localStorage.setItem('sat-age-confirmed','yes');
              Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
              Object.defineProperty(navigator,'canShare',{value:undefined,configurable:true});""")
            page = context.new_page(); observe(page); page.goto(EN, wait_until="networkidle")
            for release in ("sat-001", "sat-002"):
                if release == "sat-002": page.locator("#label-next").tap()
                selection(page, release)
                page.locator("#save-label").tap()
                page.locator("#label-save-dialog").wait_for(state="visible")
                no_japanese(page, "iOS-photo-fallback-" + release)
                text_fits(page.locator("#label-save-title")); text_fits(page.locator("#label-save-help"))
                page.locator("#label-save-image").evaluate("image => image.decode()")
                assert page.locator("#label-save-image").get_attribute("src").endswith("/assets/" + release + "-label.png")
                page.screenshot(path=str(OUT / f"photo-fallback-{release}-375.png"))
                page.locator(".label-save-close").tap()
                assert page.evaluate("document.body.style.position") != "fixed"
            context.close(); contexts.remove(context)
            report["checks"].append("Emulated iOS without file sharing offers English original-image long-press guidance for both labels and restores the page on close; actual Photos saving is not tested.")

            context = browser.new_context(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
            contexts.append(context); context.add_init_script("localStorage.setItem('sat-age-confirmed','yes')")
            page = context.new_page(); observe(page); page.goto(EN, wait_until="networkidle")
            page.locator('[data-mood-choice="deep"]').click(); selection(page, "sat-002")
            assert page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
            page.locator("#label-next").click(); selection(page, "sat-001")
            assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
            # Switch via the real page link, then smoke-test the unchanged Japanese
            # root and return via its real English link.
            page.locator('a[hreflang="ja"]').first.click()
            page.wait_for_url(SITE); metadata(page, "ja")
            assert "まだ知らない" in page.locator(".hero-ja").inner_text()
            page.locator('[data-mood-choice="deep"]').click()
            assert page.locator("#source-brewery").inner_text() == "土田酒造"
            page.locator("#label-next").click(); page.wait_for_timeout(400)
            assert page.locator("body").get_attribute("data-mood") == "light"
            page.locator(".play-launch").click()
            page.wait_for_function("document.querySelector('#play-loading').hidden")
            frame = page.locator("#play-frame-slot iframe").element_handle().content_frame()
            assert frame.locator("html").get_attribute("lang") == "ja"
            assert frame.locator("#time").inner_text() == "30"
            page.locator("#close-play").click()
            assert all(not item.is_visible() for item in page.locator(".shop-button").all())
            page.locator('a[hreflang="en"]').first.click()
            page.wait_for_url(EN); metadata(page, "en"); no_japanese(page, "returned-from-Japanese")
            report["checks"].append("Reduced-motion selection and real EN/JA language links work; Japanese hero, brewery switching, label/theme sync, game start and hidden sales remain intact.")
            assert not report["pageErrors"], report["pageErrors"]
            assert not report["httpErrors"], report["httpErrors"]
            report["status"] = "PASS"
        except Exception:
            report["status"] = "FAIL"; report["failure"] = traceback.format_exc()
            try: page.screenshot(path=str(OUT / "failure.png"))
            except Exception: pass
            raise
        finally:
            for context in contexts: context.close()
            browser.close()


def exercise_game(page):
    page.locator('[data-mood-choice="deep"]').tap(); selection(page, "sat-002")
    page.locator("#play").scroll_into_view_if_needed(); page.wait_for_timeout(400)
    frame = open_game(page)
    page.wait_for_timeout(2100)
    assert frame.locator("#time").inner_text() == "30"
    assert frame.locator("#arena").get_attribute("data-tick") == "0"
    assert frame.locator("#arena").get_attribute("data-played") == "0"
    bounds = page.locator("#play-frame-slot").bounding_box()
    for selector in ("#arena", "#pause") + tuple(f'.game-card[data-index="{i}"]' for i in range(4)):
        within(frame.locator(selector), bounds)
        if selector != "#arena": text_fits(frame.locator(selector))
    page.screenshot(path=str(OUT / "game-ready-390.png"))
    frame.locator('.game-card[data-index="0"]').tap()
    assert frame.locator("#first-target").is_visible()
    no_japanese(frame, "English-game-selected-card")
    box = frame.locator("#arena").bounding_box()
    page.touchscreen.tap(box["x"] + box["width"] * .5, box["y"] + box["height"] * .58)
    frame.locator('#arena[data-played="1"]').wait_for()
    page.wait_for_timeout(1500)
    assert int(frame.locator("#time").inner_text()) < 30
    frame.locator("#pause").tap(); frame.locator("#resume").wait_for(state="visible")
    no_japanese(frame, "English-game-pause")
    clock = frame.locator("#time").inner_text(); page.wait_for_timeout(1100)
    assert frame.locator("#time").inner_text() == clock
    frame.locator("#resume").tap()
    cpu_seen = False; started = time.monotonic()
    while time.monotonic() - started < 45:
        state = frame.locator("#arena").evaluate("el => ({...el.dataset})")
        cpu_seen = cpu_seen or any(unit["side"] == 2 for unit in json.loads(state["units"]))
        if state["status"] in ("won", "lost", "draw"): break
        page.wait_for_timeout(200)
    assert state["status"] in ("won", "lost", "draw") and cpu_seen, state
    assert page.locator("#play-modal").get_attribute("data-outcome") == state["status"]
    assert page.url == EN
    no_japanese(frame, "English-game-natural-result")
    for width, height in ((390, 844), (375, 667)):
        page.set_viewport_size({"width": width, "height": height}); page.wait_for_timeout(250)
        bounds = page.locator("#play-frame-slot").bounding_box()
        for selector in ("#result-title", "#result-score", "#result-caption", "#explore", "#replay", "#exit"):
            within(frame.locator(selector), bounds); text_fits(frame.locator(selector))
        page.screenshot(path=str(OUT / f"game-result-{width}.png"))
    frame.locator("#replay").tap(); page.wait_for_timeout(800)
    assert frame.locator("#time").inner_text() == "30"
    assert frame.locator("#arena").get_attribute("data-played") == "0"
    assert page.locator("#play-modal").get_attribute("data-outcome") is None
    page.locator("#close-play").tap(); page.set_viewport_size({"width": 390, "height": 844})
    page.wait_for_timeout(300)
    assert not page.locator("#play-modal").is_visible()
    # Reopen after close and finish a second real match to use its real product link.
    page.locator("#play").scroll_into_view_if_needed()
    frame = open_game(page); box = frame.locator("#arena").bounding_box()
    page.touchscreen.tap(box["x"] + box["width"] * .5, box["y"] + box["height"] * .58)
    frame.locator('#arena[data-played="1"]').wait_for()
    frame.locator("#explore").wait_for(state="visible", timeout=45000)
    detail = urljoin(frame.url, frame.locator("#explore").get_attribute("href"))
    assert urlsplit(detail).path == "/en/" and urlsplit(detail).fragment == "sat-002", detail
    frame.locator("#explore").tap(); page.wait_for_url(EN + "#sat-002")
    assert page.locator("html").get_attribute("lang") == "en"
    page.go_back(wait_until="load"); page.wait_for_timeout(400)
    assert page.url == EN and not page.locator("#play-modal").is_visible()
    assert page.evaluate("document.body.style.position") != "fixed"
    no_japanese(page, "English-game-browser-back")
    report["checks"].append("Real English iframe freezes before first deployment; real input, CPU, pause/resume, natural match result, replay, close/reopen, second natural result, English product navigation and browser Back all passed.")


try:
    run()
finally:
    report["browser"] = "Playwright Chromium; desktop/touch viewport emulation"
    (OUT / "results.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps({"status": report["status"], "checks": report["checks"], "evidence": str(OUT)}, ensure_ascii=False, indent=2))
