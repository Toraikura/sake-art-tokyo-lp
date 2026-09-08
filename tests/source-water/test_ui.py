"""HTTP regression for the canonical LP's source-card-only hero.

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
from urllib.parse import urljoin, urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
PAGE_DIR = ROOT / "experiments/after-hours-water"
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:4190/experiments/after-hours-water/")
OUT = Path(os.environ.get("EVIDENCE_DIR", "/private/tmp/sat-source-cards-tests"))
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PLAYWRIGHT_EXECUTABLE_PATH")
checks, geometry, page_errors, http_errors, loaded_artwork = [], [], [], [], []
FORBIDDEN_FLOW = (
    "#source-flow, .source-flow, [data-flow], [data-flow-source], [data-flow-veil], "
    "[data-flow-wisp], [data-flow-soft], [data-origin-x], [data-origin-y]"
)


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
    assert page.locator("#mood-link").get_attribute("href") == "#" + release
    # Ignore only the decorative arrow; wording stays identical for both sources.
    cta = page.locator("#mood-link").evaluate("""element => {
      const clone = element.cloneNode(true);
      clone.querySelectorAll('[aria-hidden="true"]').forEach(node => node.remove());
      return clone.textContent.trim();
    }""")
    assert cta == "この蔵の一本へ", cta
    assert page.locator("#label-stack").get_attribute("data-release") == release
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
        "experiments/after-hours-water/play", "experiments/after-hours-water/game", "experiments/after-hours-water/intuitive.js",
        "index.html", "assets", "sake-clash",
    ], cwd=ROOT, text=True).strip()
    assert not preserved, "Game / root release artifacts changed: " + preserved
    checks.append("Game/play, intuitive.js and root release artifacts have no diff from origin/main.")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME, args=["--no-sandbox"])
        for width, height in ((1440, 1000), (390, 844), (375, 812)):
            context = browser.new_context(viewport={"width": width, "height": height},
                is_mobile=width < 700, has_touch=width < 700, device_scale_factor=1)
            context.add_init_script("localStorage.setItem('sat-age-confirmed', 'yes')")
            page = context.new_page()
            monitor(page)
            page.goto(BASE, wait_until="networkidle")
            page.locator("#source-scene").scroll_into_view_if_needed()
            verify_selection(page, "urasato")
            verify_geometry(page, width)
            page.screenshot(path=str(OUT / f"source-urasato-{width}.png"))
            before = page.locator("#liquid").get_attribute("data-ripples")
            target = page.locator('.source-card[data-source="tsuchida"]')
            target.tap() if width < 700 else target.click()
            verify_selection(page, "tsuchida")
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
            # Real CTA click must reach the release belonging to the selected card.
            page.locator("#mood-link").click()
            page.wait_for_url("**/#sat-002")
            assert page.locator("#sat-002").is_visible()
            page.go_back(wait_until="load")
            assert not page.locator("#play-modal").is_visible()
            checks.append(f"{width}px: two source cards, no flow/membrane/origin overlay, exact copy/brand/CTA sync, artwork brightness/crop, unclipped layout, 44px targets, click/touch/keyboard, no card ripple, original water gesture, stop control and CTA destination passed.")
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
        old_url = urljoin(BASE, "../after-hours-source/")
        page.goto(old_url, wait_until="networkidle")
        page.wait_for_url(BASE)
        verify_selection(page, "urasato")
        assert page.locator(FORBIDDEN_FLOW).count() == 0
        page.goto(old_url + "?bottle=sat-002#labels", wait_until="networkidle")
        page.wait_for_url(BASE + "?bottle=sat-002#labels")
        verify_selection(page, "tsuchida")
        checks.append("The former after-hours-source URL redirects to canonical after-hours-water, preserving query/hash and the selected bottle.")
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
        "pageErrors": page_errors, "httpErrors": http_errors, "loadedArtwork": loaded_artwork,
    }, ensure_ascii=False, indent=2))
    raise
OUT.joinpath("results.json").write_text(json.dumps({
    "status": "PASS", "checks": checks, "geometry": geometry,
    "browser": "Playwright Chromium; viewport and touch emulation",
    "executableOverride": CHROME,
    "notTested": ["iPhone Safari physical device", "iOS saving", "human first-impression evaluation"],
    "separateSuite": "tests/intuitive/test_ui.py covers the unchanged full game / label integration.",
    "pageErrors": page_errors, "httpErrors": http_errors, "loadedArtwork": loaded_artwork,
    "testedFiles": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
                    for path in PAGE_DIR.iterdir() if path.is_file()},
}, ensure_ascii=False, indent=2))
print(json.dumps({"status": "PASS", "checks": checks, "evidence": str(OUT)}, ensure_ascii=False, indent=2))
