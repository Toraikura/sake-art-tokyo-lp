"""Production-root HTTP regression for source cards, brand and public metadata.

Uses real touch, click and keyboard input. The existing intuitive suite covers
the unchanged game integration separately. Chromium viewport emulation is not
a substitute for physical iPhone Safari testing.
"""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import parse_qs, urljoin, urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
PAGE_DIR = ROOT
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:4190/")
PUBLIC_URL = "https://sakearttokyo.com/"
OUT = Path(os.environ.get("EVIDENCE_DIR", "/private/tmp/sat-source-cards-tests"))
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PLAYWRIGHT_EXECUTABLE_PATH")
checks, geometry, page_errors, http_errors, loaded_artwork, navigation = [], [], [], [], [], []
production, image_checks, theme_checks = [], [], []
FORBIDDEN_FLOW = (
    "#source-flow, .source-flow, [data-flow], [data-flow-source], [data-flow-veil], "
    "[data-flow-wisp], [data-flow-soft], [data-origin-x], [data-origin-y]"
)
BRAND_LINES = (
    "SAKE ART TOKYOでつくりたいのは、",
    "急いで飲み切るためのお酒ではなく、",
    "開ける日までの時間も、一緒に楽しめる一本。",
    "SAKE ART TOKYOがやりたいのは、",
    "完成された酒を選んで並べることではなく、",
    "蔵の個性に一歩踏み込んで、一緒に新しい表情をつくること。",
    "今日開けてもいい。",
    "少し寝かせてからでもいい。",
    "好きな時に、好きな人と、好きなように。",
)


def verify_production_metadata(page):
    assert urlsplit(page.url).path == urlsplit(BASE).path
    assert page.locator(".preview-tag").count() == 0
    for fragment in ("DESIGN EXPERIMENT", "CONCEPT B"):
        assert fragment not in page.locator("body").inner_text()
    for item in page.locator('meta[name="robots"], meta[name="googlebot"]').all():
        assert not set(re.split(r"[\s,]+", (item.get_attribute("content") or "").lower())) & {"noindex", "none"}
    canonical = page.locator('link[rel="canonical"]')
    assert canonical.count() == 1 and canonical.get_attribute("href") == PUBLIC_URL
    expected = {
        'meta[property="og:url"]': PUBLIC_URL,
        'meta[property="og:type"]': "website",
        'meta[property="og:site_name"]': "SAKE ART TOKYO",
        'meta[property="og:image"]': PUBLIC_URL + "assets/sat-dimensional-logo.png",
        'meta[name="twitter:card"]': "summary_large_image",
        'meta[name="twitter:image"]': PUBLIC_URL + "assets/sat-dimensional-logo.png",
    }
    metadata = {selector: page.locator(selector).get_attribute("content") for selector in expected}
    assert metadata == expected, metadata
    assert page.locator('meta[property="og:title"]').get_attribute("content") == page.title()
    assert page.locator('meta[name="description"]').get_attribute("content")
    assert page.locator('meta[property="og:description"]').get_attribute("content")
    structured = [json.loads(item.text_content()) for item in page.locator('script[type="application/ld+json"]').all()]
    assert any(item.get("@type") == "WebSite" and item.get("url") == PUBLIC_URL for item in structured), structured
    releases = json.loads(page.locator("#label-releases").text_content())
    assert [item["detail"] for item in releases] == ["./#sat-001", "./#sat-002"]
    assert page.locator(".record-shop[hidden]").count() == 2
    assert all(not link.is_visible() for link in page.locator(".record-shop .shop-button").all())
    production.append({"url": page.url, "canonical": PUBLIC_URL, "metadata": metadata,
                       "productDetails": [item["detail"] for item in releases]})


def verify_theme(page, source, width):
    accent, dark, ink, paper = {
        "urasato": ("rgb(213, 239, 131)", "rgb(37, 42, 30)", "rgb(82, 106, 32)", "rgb(229, 235, 206)"),
        "tsuchida": ("rgb(197, 172, 243)", "rgb(37, 32, 50)", "rgb(117, 80, 149)", "rgb(223, 213, 233)"),
    }[source]
    expected = {
        ".motion-dot": ("backgroundColor", accent), ".theme-rule": ("backgroundColor", accent),
        ".arcade": ("backgroundColor", dark), "#play-title > span": ("color", accent),
        ".arcade .chapter": ("color", accent), ".play-button": ("backgroundColor", accent),
        ".manifesto h2 em": ("color", ink), ".comic-section": ("backgroundColor", paper),
    }
    measured = {}
    for selector, (prop, value) in expected.items():
        actual = page.locator(selector).first.evaluate("(element, prop) => getComputedStyle(element)[prop]", prop)
        assert actual == value, (source, width, selector, actual, value)
        measured[selector] = actual
    theme_checks.append({"width": width, "source": source, "colors": measured})


def verify_production_images(page, width):
    for img in page.locator("img[src]").all():
        if not img.is_visible() and img.get_attribute("loading") == "lazy":
            image_checks.append({"width": width, "src": img.get_attribute("src"), "state": "intentionally hidden lazy image"})
            continue
        if img.is_visible():
            img.scroll_into_view_if_needed()
        img.evaluate("img => img.decode()")
        info = img.evaluate("img => ({src: img.currentSrc || img.src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight})")
        assert info["naturalWidth"] > 0 and info["naturalHeight"] > 0, info
        image_checks.append({"width": width, **info})
    for svg_image in page.locator("svg image[href]").all():
        info = svg_image.evaluate("""async element => {
          const img = new Image(); img.src = new URL(element.getAttribute('href'), document.baseURI).href;
          await img.decode(); return {src: img.src, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight};
        }""")
        assert info["naturalWidth"] > 0 and info["naturalHeight"] > 0, info
        image_checks.append({"width": width, "kind": "svg artwork", **info})
    if width > 700:
        logo = page.locator(".brand-mark").evaluate("img => ({src: img.currentSrc || img.src, width: img.naturalWidth, height: img.naturalHeight})")
        assert urlsplit(logo["src"]).path == "/assets/sat-dimensional-logo.png"
        assert logo["width"] == int(page.locator('meta[property="og:image:width"]').get_attribute("content"))
        assert logo["height"] == int(page.locator('meta[property="og:image:height"]').get_attribute("content"))
    comic = page.locator("#comic-image")
    assert comic.is_visible() and not page.locator("#comic-error").is_visible()
    page.locator("#comic").screenshot(path=str(OUT / f"production-comic-{width}.png"))
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")


def verify_selection(page, source):
    mood, release, side, brewery, copy = {
        "urasato": ("light", "sat-001", "SIDE A / URAZATO", "浦里酒造", "霧の向こう、澄んだ余韻。"),
        "tsuchida": ("deep", "sat-002", "SIDE B / TSUCHIDA", "土田酒造", "森の奥、湧き出す深み。"),
    }[source]
    page.wait_for_timeout(700)
    assert page.locator("#source-scene").get_attribute("data-source") == source
    assert page.locator("body").get_attribute("data-mood") == mood
    assert page.locator("#side-title").inner_text() == side
    assert page.locator("#source-brewery").inner_text() == brewery
    assert page.locator("#source-copy").inner_text() == copy
    assert page.locator("#hero-brand").inner_text() == "SAKE ART TOKYO from CHILL LABO"
    assert page.locator(".hero-actions, #mood-link, .hero [data-play], #choice-note").count() == 0
    assert page.locator("#label-stack").get_attribute("data-release") == release
    assert page.locator(".record[data-selected=true]").count() == 1
    assert page.locator("#" + release).get_attribute("data-selected") == "true"
    assert page.locator(FORBIDDEN_FLOW).count() == 0
    for card_source in ("urasato", "tsuchida"):
        selected = card_source == source
        card = page.locator(f'.source-card[data-source="{card_source}"]')
        assert card.get_attribute("aria-pressed") == str(selected).lower()
        style = card.evaluate("""element => ({
          opacity: Number(getComputedStyle(element).opacity),
          filter: getComputedStyle(element.querySelector('.source-art')).filter
        })""")
        brightness = float(re.search(r"brightness\(([^)]+)\)", style["filter"]).group(1))
        saturation = float(re.search(r"saturate\(([^)]+)\)", style["filter"]).group(1))
        if selected:
            assert style["opacity"] == 1 and 1 <= brightness <= 1.1, (card_source, style)
            assert .9 <= saturation <= 1.05, (card_source, style)
        else:
            assert style["opacity"] < .85 and brightness < 1, (card_source, style)


def verify_geometry(page, width):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), ("overflow", width)
    assert page.locator(FORBIDDEN_FLOW).count() == 0
    assert page.locator(".chosen, .theme-strip").count() == 0
    assert page.get_by_text("FEEL FIRST.", exact=True).count() == 0
    assert page.get_by_text("KNOW LATER.", exact=True).count() == 0
    rule = page.locator(".theme-rule")
    assert rule.count() == 1 and rule.text_content().strip() == "" and rule.locator("*").count() == 0
    rule_style = rule.evaluate("""element => {
      const style = getComputedStyle(element);
      return {height: element.getBoundingClientRect().height,
        background: style.backgroundColor,
        motionDot: getComputedStyle(document.querySelector('.motion-dot')).backgroundColor};
    }""")
    assert abs(rule_style["height"] - 3) < .05, rule_style
    assert rule_style["background"] == rule_style["motionDot"], rule_style
    assert page.locator('.source-scene svg:not(.source-art)').count() == 0
    assert page.locator('script[src*="source-water"]').count() == 0
    assert page.locator('link[rel="stylesheet"][href*="source-cards.css"]').count() == 1
    cards = page.locator(".source-card")
    assert cards.count() == 2
    assert page.locator(".source-card button, .source-card [role=button]").count() == 0
    assert page.locator('[role="button"] .source-card').count() == 0
    for card in cards.all():
        box = card.bounding_box()
        assert box["width"] >= 44 and box["height"] >= 44, (width, box)
    # scrollWidth can miss text hidden by an overflowing hero grid.
    bounds = page.evaluate("""() => {
      const boxes = Array.from(document.querySelectorAll('.source-cards, .art-caption'), element => {
        const b = element.getBoundingClientRect();
        return {selector: element.className, left: b.left, right: b.right};
      });
      for (const element of document.querySelectorAll(
        '#hero-title > span, #hero-brand, #side-title, #source-brewery, #source-copy')) {
        const range = document.createRange(); range.selectNodeContents(element);
        const b = range.getBoundingClientRect();
        boxes.push({selector: element.id || element.textContent, left: b.left, right: b.right});
      }
      return boxes;
    }""")
    for item in bounds:
        assert item["left"] >= -.5 and item["right"] <= width + .5, (width, item)
    features = page.evaluate("""() => {
      const art = document.querySelector('.source-card[data-source="tsuchida"] .source-art');
      const bounds = art.getBoundingClientRect();
      const landmarks = {bambooTop: [583, 473], bambooSpout: [528, 686],
        bowlLeft: [313, 859], bowlRight: [676, 859], bowlBase: [466, 997]};
      return Object.entries(landmarks).map(([name, xy]) => {
        const p = new DOMPoint(...xy).matrixTransform(art.getScreenCTM());
        return {name, x: p.x, y: p.y, inside: p.x >= bounds.left && p.x <= bounds.right &&
          p.y >= bounds.top && p.y <= bounds.bottom};
      });
    }""")
    assert all(feature["inside"] for feature in features), (width, features)
    geometry.append({"width": width, "bounds": bounds, "tsuchidaFeatures": features})


def verify_still(page):
    assert page.locator("#motion").get_attribute("aria-pressed") == "true"
    for element in page.locator(".source-card, .source-art").all():
        durations = element.evaluate("element => getComputedStyle(element).transitionDuration").split(",")
        assert all(float(value.strip().removesuffix("s")) == 0 for value in durations)


def verify_brand_and_products(page, width):
    page.locator(".nav-shop").click()
    page.wait_for_url("**/#bottles")
    intro = page.locator("#bottles .brand-intro")
    assert intro.count() == 1 and intro.is_visible()
    copy = intro.locator(".brand-copy")
    assert "".join(copy.inner_text().split()) == "".join("".join(BRAND_LINES).split())
    assert [node.text_content() for node in copy.locator("strong").all()] == [BRAND_LINES[2], BRAND_LINES[5]]
    assert intro.locator("a, button, input, select, textarea, summary, [role=button]").count() == 0
    assert page.locator(".record-details, .record details, .record summary").count() == 0
    position = intro.evaluate("""element => {
      const records = document.querySelector('#bottles .records');
      return {before: Boolean(element.compareDocumentPosition(records) & Node.DOCUMENT_POSITION_FOLLOWING),
        bottom: element.getBoundingClientRect().bottom, recordsTop: records.getBoundingClientRect().top};
    }""")
    assert position["before"] and position["bottom"] <= position["recordsTop"] + .5, position
    mark = intro.locator(".brand-mark")
    assert mark.count() == 1
    assert mark.is_visible() == (width > 700)
    intro.scroll_into_view_if_needed()
    if width > 700:
        mark.evaluate("img => img.decode()")
        assert mark.evaluate("img => img.naturalWidth > 0 && img.naturalHeight > 0")
        background = intro.evaluate("""element => {
          const mark = element.querySelector('.brand-mark'), copy = element.querySelector('.brand-copy');
          const bounds = element.getBoundingClientRect(), image = mark.getBoundingClientRect();
          const style = getComputedStyle(element), markStyle = getComputedStyle(mark);
          return {overflowX: style.overflowX, overflowY: style.overflowY,
            position: markStyle.position, pointerEvents: markStyle.pointerEvents,
            imageZ: Number(markStyle.zIndex), textZ: Number(getComputedStyle(copy).zIndex),
            ariaHidden: mark.getAttribute('aria-hidden'),
            raw: {left: image.left, right: image.right, top: image.top, bottom: image.bottom},
            clipped: {left: Math.max(bounds.left, image.left), right: Math.min(bounds.right, image.right),
              top: Math.max(bounds.top, image.top), bottom: Math.min(bounds.bottom, image.bottom)},
            container: {left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom}};
        }""")
        assert background["overflowX"] in ("hidden", "clip") and background["overflowY"] in ("hidden", "clip")
        assert background["position"] == "absolute" and background["pointerEvents"] == "none"
        assert background["ariaHidden"] == "true" and background["textZ"] > background["imageZ"]
        clipped = background["clipped"]
        assert 0 <= clipped["left"] < clipped["right"] <= width and clipped["bottom"] > clipped["top"], background
        geometry.append({"width": width, "brandBackground": background})
    intro.screenshot(path=str(OUT / f"brand-intro-{width}.png"))
    for release in ("sat-001", "sat-002"):
        article = page.locator("#" + release)
        assert article.locator(".record-shop[hidden]").count() == 1
        assert not article.locator(".shop-button").is_visible()
        story = article.locator(".record-story")
        assert story.count() == 1 and story.is_visible()
        assert story.locator("p").count() == 3
        assert all(paragraph.is_visible() for paragraph in story.locator("p").all())
        assert "常温保存できます。" in story.inner_text(), (release, story.inner_text())
        if release == "sat-002":
            assert "貴醸酒" in article.inner_text()
        story.scroll_into_view_if_needed()
        story.screenshot(path=str(OUT / f"record-story-{release}-{width}.png"))
    bounds = page.evaluate("""() => {
      const elements = document.querySelectorAll('.brand-intro, .brand-copy, .record, .record-story');
      const boxes = Array.from(elements).map(element => {
        const rect = element.getBoundingClientRect();
        return {selector: element.id || element.className, left: rect.left, right: rect.right,
          // The decorative logo intentionally extends inside its clipping container.
          overflow: !element.classList.contains('brand-intro') && element.scrollWidth > element.clientWidth + 1};
      });
      for (const element of document.querySelectorAll('.brand-copy, .record-story')) {
        const container = element.closest('.brand-intro, .record').getBoundingClientRect();
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
        while (walker.nextNode()) {
          if (!walker.currentNode.textContent.trim()) continue;
          const range = document.createRange(); range.selectNodeContents(walker.currentNode);
          for (const rect of range.getClientRects()) boxes.push({selector: element.className + ' text',
            left: rect.left, right: rect.right, overflow: rect.left < container.left - .5 ||
              rect.right > container.right + .5 || rect.top < container.top - .5 || rect.bottom > container.bottom + .5});
        }
      }
      return boxes;
    }""")
    for item in bounds:
        assert item["left"] >= -.5 and item["right"] <= width + .5 and not item["overflow"], (width, item)
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), ("background caused page overflow", width)
    geometry.append({"width": width, "brandAndProductBounds": bounds})


def verify_play_entry(page, selector):
    trigger = page.locator(selector)
    trigger.scroll_into_view_if_needed()
    page.wait_for_timeout(700)
    previous_scroll = page.evaluate("scrollY")
    # Playwright may reposition a sticky navigation button while making it
    # actionable. Observe the real click position before the application's
    # click handler saves it, rather than using the pre-action measurement.
    trigger.evaluate("""element => element.addEventListener('click', () => {
      element.__testClickScrollY = window.scrollY;
    }, {once: true, capture: true})""")
    trigger.click()
    click_scroll = trigger.evaluate("element => element.__testClickScrollY")
    page.wait_for_function("document.querySelector('#play-loading').hidden")
    iframe = page.locator("#play-frame-slot iframe")
    url = urlsplit(iframe.get_attribute("src"))
    assert url.path == urlsplit(urljoin(BASE, "play/")).path
    assert parse_qs(url.query)["bottle"] == ["sat-002"]
    frame = page.frame_locator("#play-frame-slot iframe")
    frame.locator('#arena[data-status="playing"]').wait_for()
    assert frame.locator("#time").inner_text() == "30"
    assert frame.locator("#arena").get_attribute("data-played") == "0"
    page.locator("#close-play").click()
    page.wait_for_timeout(300)
    assert not page.locator("#play-modal").is_visible()
    restored_scroll = page.evaluate("scrollY")
    sample = {"selector": selector, "beforeAction": previous_scroll,
              "atClick": click_scroll, "afterClose": restored_scroll}
    navigation.append(sample)
    assert abs(restored_scroll - click_scroll) < 3, sample


def verify_remaining_navigation(page, width):
    if width > 700:
        page.locator('.nav-links a[href="#bottles"]').click()
        page.wait_for_url("**/#bottles")
        verify_play_entry(page, ".nav-play")
        page.locator('.nav-links a[href="#story"]').click()
        page.wait_for_url("**/#story")
    verify_play_entry(page, ".play-launch")
    page.locator(".logo").click()
    page.wait_for_url("**/#top")


def monitor(page):
    page.on("pageerror", lambda error: page_errors.append(str(error)))
    def response_received(response):
        if response.status >= 400:
            http_errors.append({"status": response.status, "url": response.url})
        if urlsplit(response.url).path.endswith(("/urasato-source.png", "/tsuchida-source.png")):
            loaded_artwork.append({"status": response.status, "url": response.url,
                                   "resourceType": response.request.resource_type})
    page.on("response", response_received)


def run():
    preserved = subprocess.check_output([
        "git", "diff", "--name-only", "origin/main", "--",
        "experiments/after-hours-water", "sake-clash",
    ], cwd=ROOT, text=True).strip()
    assert not preserved, "Preserved candidate / original game changed: " + preserved
    candidate = ROOT / "experiments/after-hours-water"
    for name in ("model.js", "art.js", "preview.js", "render.js", "game.css"):
        assert (ROOT / "play" / name).read_bytes() == (candidate / "play" / name).read_bytes(), name
    checks.append("The after-hours-water candidate and original game have no diff from origin/main.")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME, args=["--no-sandbox"])
        for width, height in ((1440, 1000), (390, 844), (375, 812)):
            context = browser.new_context(viewport={"width": width, "height": height},
                is_mobile=width < 700, has_touch=width < 700, device_scale_factor=1)
            context.add_init_script("localStorage.setItem('sat-age-confirmed', 'yes')")
            page = context.new_page()
            monitor(page)
            page.goto(BASE, wait_until="networkidle")
            verify_production_metadata(page)
            page.locator("#source-scene").scroll_into_view_if_needed()
            verify_selection(page, "urasato")
            verify_theme(page, "urasato", width)
            verify_geometry(page, width)
            page.screenshot(path=str(OUT / f"source-urasato-{width}.png"))
            before = page.locator("#liquid").get_attribute("data-ripples")
            target = page.locator('.source-card[data-source="tsuchida"]')
            target.tap() if width < 700 else target.click()
            verify_selection(page, "tsuchida")
            verify_theme(page, "tsuchida", width)
            assert page.locator("#liquid").get_attribute("data-ripples") == before
            verify_geometry(page, width)
            page.screenshot(path=str(OUT / f"source-tsuchida-{width}.png"))
            page.locator("#source-scene").screenshot(path=str(OUT / f"scene-tsuchida-{width}.png"))
            page.locator('.source-card[data-source="urasato"]').focus()
            page.keyboard.press("Enter")
            verify_selection(page, "urasato")
            page.keyboard.press("Tab")
            assert target.evaluate("element => element === document.activeElement")
            page.keyboard.press("Space")
            verify_selection(page, "tsuchida")
            assert page.locator("#liquid").get_attribute("data-ripples") == before
            page.locator("#art-zone").focus()
            page.keyboard.press("Enter")
            assert int(page.locator("#liquid").get_attribute("data-ripples")) == int(before or 0) + 1
            page.locator("#motion").click()
            verify_still(page)
            page.locator("#motion").click()
            verify_brand_and_products(page, width)
            verify_remaining_navigation(page, width)
            verify_production_images(page, width)
            checks.append(f"{width}px: production root metadata/share targets, source/copy/record and full section color sync, hidden shop links, all visible images/SVG artwork/comic, no hero CTA/flow/badges/banner copy, brand and product layout, real navigation/PLAY entries passed.")
            context.close()

        context = browser.new_context(viewport={"width": 390, "height": 844},
            is_mobile=True, has_touch=True, reduced_motion="reduce", device_scale_factor=1)
        context.add_init_script("localStorage.setItem('sat-age-confirmed', 'yes')")
        page = context.new_page()
        monitor(page)
        page.goto(BASE, wait_until="networkidle")
        verify_still(page)
        page.locator('.source-card[data-source="tsuchida"]').tap()
        verify_selection(page, "tsuchida")
        verify_still(page)
        page.locator("#source-scene").screenshot(path=str(OUT / "reduced-motion-390.png"))
        checks.append("Reduced motion: cards remain selectable with added transitions disabled.")
        old_url = urljoin(BASE, "experiments/after-hours-source/")
        candidate_url = urljoin(BASE, "experiments/after-hours-water/")
        page.goto(old_url, wait_until="networkidle")
        page.wait_for_url(candidate_url)
        verify_selection(page, "urasato")
        assert page.locator(FORBIDDEN_FLOW).count() == 0
        page.goto(old_url + "?bottle=sat-002#labels", wait_until="networkidle")
        page.wait_for_url(candidate_url + "?bottle=sat-002#labels")
        verify_selection(page, "tsuchida")
        checks.append("The former after-hours-source URL still redirects to the preserved candidate, retaining query/hash and the selected bottle.")
        context.close()
        browser.close()
    assert not page_errors, page_errors
    assert not [error for error in http_errors if not urlsplit(error["url"]).path.endswith("/favicon.ico")], http_errors
    for name in ("urasato-source.png", "tsuchida-source.png"):
        assert any(item["url"].endswith("/" + name) and item["status"] == 200
                   and item["resourceType"] == "image" for item in loaded_artwork), name


try:
    run()
except Exception as error:
    OUT.joinpath("results.json").write_text(json.dumps({
        "status": "FAIL", "failure": str(error), "checks": checks, "geometry": geometry,
        "pageErrors": page_errors, "httpErrors": http_errors, "loadedArtwork": loaded_artwork, "navigation": navigation,
        "production": production, "images": image_checks, "themes": theme_checks,
    }, ensure_ascii=False, indent=2))
    raise
OUT.joinpath("results.json").write_text(json.dumps({
    "status": "PASS", "checks": checks, "geometry": geometry,
    "browser": "Playwright Chromium; viewport and touch emulation",
    "executableOverride": CHROME,
    "notTested": ["iPhone Safari physical device", "iOS saving", "human first-impression evaluation"],
    "separateSuite": "tests/intuitive/test_ui.py covers the unchanged full game / label integration.",
    "pageErrors": page_errors, "httpErrors": http_errors, "loadedArtwork": loaded_artwork, "navigation": navigation,
    "production": production, "images": image_checks, "themes": theme_checks,
    "testedFiles": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
                    for path in PAGE_DIR.iterdir() if path.is_file()},
}, ensure_ascii=False, indent=2))
print(json.dumps({"status": "PASS", "checks": checks, "evidence": str(OUT)}, ensure_ascii=False, indent=2))
