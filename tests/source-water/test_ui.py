"""Real HTTP regression for the isolated source-water experiment.

Uses actual button / touch / keyboard input and a naturally completed game.
No game-state injection or timer acceleration. Chromium viewport emulation is
not a substitute for iPhone Safari device testing.
"""
import json
import hashlib
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import parse_qs, urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get(
    "BASE_URL", "http://127.0.0.1:4190/experiments/after-hours-source/"
)
OUT = Path(os.environ.get("EVIDENCE_DIR", "/private/tmp/sat-source-water-tests"))
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get(
    "PLAYWRIGHT_EXECUTABLE_PATH",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
)
checks, geometry, page_errors, http_errors, loaded_artwork = [], [], [], [], []


def verify_selection(page, source):
    mood, release, title = {
        "urasato": ("light", "sat-001", "SIDE A / URASATO"),
        "tsuchida": ("deep", "sat-002", "SIDE B / TSUCHIDA"),
    }[source]
    page.wait_for_timeout(700)  # The actual opacity / label transitions settle.
    assert page.locator("#source-scene").get_attribute("data-source") == source
    assert page.locator("body").get_attribute("data-mood") == mood
    assert page.locator("#side-title").inner_text() == title
    assert page.locator("#mood-link").get_attribute("href") == "#" + release
    assert page.locator("#label-stack").get_attribute("data-release") == release
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
            # The revised selected artwork must no longer be dimmed below its
            # supplied brightness, while the inactive option remains subordinate.
            assert style["opacity"] == 1 and 1 <= brightness <= 1.1, (card_source, style)
            assert 0.9 <= saturation <= 1.05, (card_source, style)
        else:
            assert style["opacity"] < 0.85 and brightness < 1, (card_source, style)
        layers = page.locator(f'.source-flow [data-flow-source="{card_source}"]')
        assert layers.count() == 4, card_source
        for layer in layers.all():
            opacity = layer.evaluate("element => Number(getComputedStyle(element).opacity)")
            assert abs(opacity - int(selected)) < 0.001, (card_source, opacity)


def verify_geometry(page, width):
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (
        "horizontal overflow", width
    )
    cards = page.locator(".source-card")
    assert cards.count() == 2
    assert page.locator(".source-card button, .source-card [role=button]").count() == 0
    assert page.locator('[role="button"] .source-card').count() == 0
    for card in cards.all():
        box = card.bounding_box()
        assert box["width"] >= 44 and box["height"] >= 44, (width, box)
    # Hero overflow:hidden can conceal an intrinsically oversized grid; scrollWidth
    # alone cannot prove the title, cards and caption are actually visible.
    visible_bounds = page.evaluate("""() => {
      const boxes = Array.from(document.querySelectorAll('.source-cards, .art-caption'),
        element => ({selector: element.className,
          left: element.getBoundingClientRect().left, right: element.getBoundingClientRect().right}));
      for (const element of document.querySelectorAll('#hero-title > span')) {
        const range = document.createRange(); range.selectNodeContents(element);
        boxes.push({selector: '#hero-title ' + element.textContent,
          left: range.getBoundingClientRect().left, right: range.getBoundingClientRect().right});
      }
      return boxes;
    }""")
    for bounds in visible_bounds:
        assert bounds["left"] >= -0.5 and bounds["right"] <= width + 0.5, (width, bounds)
    measured = page.evaluate("""() => {
      const flow = document.querySelector('#source-flow');
      const origins = { urasato: [570, 595], tsuchida: [469, 967] };
      return Object.entries(origins).map(([source, xy]) => {
        const art = document.querySelector(`.source-card[data-source="${source}"] .source-art`);
        const expected = new DOMPoint(...xy).matrixTransform(art.getScreenCTM());
        const bounds = art.getBoundingClientRect();
        const layers = Array.from(flow.querySelectorAll(`[data-flow-source="${source}"]`), path => {
          const actual = path.getPointAtLength(0).matrixTransform(flow.getScreenCTM());
          const gradientId = path.getAttribute('fill').match(/^url\(#([^)]*)\)$/)?.[1];
          const gradient = document.getElementById(gradientId);
          const length = path.getTotalLength();
          const points = Array.from({length: 96}, (_, i) => path.getPointAtLength(length * i / 96));
          const area = Math.abs(points.reduce((sum, p, i) => {
            const next = points[(i + 1) % points.length]; return sum + p.x * next.y - next.x * p.y;
          }, 0)) / 2;
          return { role: path.hasAttribute('data-flow') ? 'main' :
              path.hasAttribute('data-flow-veil') ? 'veil' : 'wisp',
            actual: {x: actual.x, y: actual.y}, d: path.getAttribute('d'),
            stroke: getComputedStyle(path).stroke, fill: getComputedStyle(path).fill,
            area, length,
            stops: gradient ? Array.from(gradient.querySelectorAll('stop'), stop =>
              ({offset: stop.offset.baseVal, opacity: Number(getComputedStyle(stop).stopOpacity)})) : []};
        });
        return { source, expected: { x: expected.x, y: expected.y }, layers,
          inside: expected.x >= bounds.left && expected.x <= bounds.right &&
                  expected.y >= bounds.top && expected.y <= bounds.bottom,
          pointerEvents: getComputedStyle(flow).pointerEvents };
      });
    }""")
    for item in measured:
        assert item["inside"], (width, item)
        assert item["pointerEvents"] == "none", (width, item)
        layers = item["layers"]
        assert sorted(layer["role"] for layer in layers) == ["main", "veil", "wisp", "wisp"]
        assert len({layer["d"] for layer in layers}) == 4, ("duplicate membranes", width)
        for layer in layers:
            error = max(abs(item["expected"][k] - layer["actual"][k]) for k in ("x", "y"))
            assert error < 1, ("source anchor drift", width, layer)
            assert layer["stroke"] == "none" and layer["fill"] != "none", (width, layer)
            assert layer["d"].rstrip().endswith("Z") and layer["area"] > 0.1, (width, layer)
            assert layer["length"] > 10, (width, layer)
            stops = layer["stops"]
            assert len(stops) >= 3 and all(0 <= stop["opacity"] < 1 for stop in stops), (width, layer)
            peak = max(stop["opacity"] for stop in stops)
            assert peak > 0, ("invisible membrane", width, layer)
            assert abs(stops[-1]["offset"] - 1) < .001 and stops[-1]["opacity"] == 0, (width, layer)
            if layer["role"] == "main":
                peak_index = next(i for i, stop in enumerate(stops) if stop["opacity"] == peak)
                tail = stops[peak_index:]
                assert any(stop["offset"] < .95 and stop["opacity"] == 0 for stop in tail), (width, layer)
                assert all(b["opacity"] <= a["opacity"] for a, b in zip(tail, tail[1:])), (width, layer)
    visible_features = page.evaluate("""() => {
      const art = document.querySelector('.source-card[data-source="tsuchida"] .source-art');
      const bounds = art.getBoundingClientRect();
      // Visible feature landmarks in the original 1122 x 1402 supplied artwork.
      // Inspect the transformed locations, rather than merely checking a viewBox string.
      const landmarks = {
        bambooTop: [583, 473], bambooSpout: [528, 686],
        bowlLeft: [313, 859], bowlRight: [676, 859], bowlBase: [466, 997]
      };
      return Object.entries(landmarks).map(([name, xy]) => {
        const screen = new DOMPoint(...xy).matrixTransform(art.getScreenCTM());
        return {name, x: screen.x, y: screen.y,
          inside: screen.x >= bounds.left && screen.x <= bounds.right &&
                  screen.y >= bounds.top && screen.y <= bounds.bottom};
      });
    }""")
    assert all(item["inside"] for item in visible_features), (width, visible_features)
    geometry.append({"width": width, "paths": measured, "tsuchidaFeatures": visible_features})


def source_still(page):
    assert "source-still" in page.locator("#source-scene").get_attribute("class")
    for selector in (".source-card", ".source-art", ".source-flow path"):
        for element in page.locator(selector).all():
            durations = element.evaluate(
                "element => getComputedStyle(element).transitionDuration"
            ).split(",")
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


def open_game(page):
    page.locator(".play-launch").tap()
    page.wait_for_function("document.querySelector('#play-loading').hidden")
    iframe = page.locator("#play-frame-slot iframe")
    actual = urlsplit(iframe.get_attribute("src"))
    assert actual.path.endswith("/experiments/after-hours-water/play/"), actual
    assert parse_qs(actual.query)["bottle"] == ["sat-002"], actual
    frame = page.frame_locator("#play-frame-slot iframe")
    frame.locator('#arena[data-status="playing"]').wait_for()
    return frame


def run():
    # Keep the complete existing page, shared game, and root records untouched.
    preserved = subprocess.check_output([
        "git", "diff", "--name-only", "origin/main", "--",
        "experiments/after-hours-water", "index.html", "assets", "sake-clash",
    ], cwd=ROOT, text=True).strip()
    assert not preserved, "Existing version changed: " + preserved
    source_js = (ROOT / "experiments/after-hours-source/source-water.js").read_text()
    assert not re.search(r"\b(requestAnimationFrame|setInterval)\s*\(", source_js)
    checks.append("Existing version / shared game have no diff from origin/main; source overlay adds no animation loop.")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True, executable_path=CHROME, args=["--no-sandbox"]
        )
        for width, height in ((1440, 1000), (390, 844), (375, 812)):
            context = browser.new_context(
                viewport={"width": width, "height": height},
                is_mobile=width < 700, has_touch=width < 700, device_scale_factor=1,
            )
            context.add_init_script("localStorage.setItem('sat-age-confirmed', 'yes')")
            page = context.new_page()
            monitor(page)
            page.goto(BASE, wait_until="networkidle")
            page.locator("#source-scene").scroll_into_view_if_needed()
            verify_geometry(page, width)
            verify_selection(page, "urasato")
            page.screenshot(path=str(OUT / f"source-urasato-{width}.png"))
            before = page.locator("#liquid").get_attribute("data-ripples")
            target = page.locator('.source-card[data-source="tsuchida"]')
            target.tap() if width < 700 else target.click()
            verify_selection(page, "tsuchida")
            assert page.locator("#liquid").get_attribute("data-ripples") == before
            verify_geometry(page, width)
            page.screenshot(path=str(OUT / f"source-tsuchida-{width}.png"))
            page.locator("#source-scene").screenshot(path=str(OUT / f"scene-tsuchida-{width}.png"))
            light = page.locator('.source-card[data-source="urasato"]')
            light.focus()
            page.keyboard.press("Enter")
            verify_selection(page, "urasato")
            page.keyboard.press("Tab")
            assert target.evaluate("element => element === document.activeElement")
            page.keyboard.press("Space")
            verify_selection(page, "tsuchida")
            assert page.locator("#liquid").get_attribute("data-ripples") == before
            # Check the existing water gesture still acts on the water itself.
            page.locator("#art-zone").focus()
            page.keyboard.press("Enter")
            assert int(page.locator("#liquid").get_attribute("data-ripples")) == int(before or 0) + 1
            page.locator("#motion").click()
            source_still(page)
            page.locator("#motion").click()
            checks.append(f"{width}px: layout, 44px targets, cropped-art anchors, four translucent stroke-free membranes with fading ends, selected-art brightness, bamboo/basin visibility, touch/click/keyboard source sync, no card ripple, water gesture, global stop passed.")
            context.close()

        context = browser.new_context(
            viewport={"width": 390, "height": 844}, is_mobile=True,
            has_touch=True, reduced_motion="reduce", device_scale_factor=1,
        )
        context.add_init_script("localStorage.setItem('sat-age-confirmed', 'yes')")
        page = context.new_page()
        monitor(page)
        page.goto(BASE, wait_until="networkidle")
        source_still(page)
        page.locator('.source-card[data-source="tsuchida"]').tap()
        verify_selection(page, "tsuchida")
        source_still(page)
        page.locator("#source-scene").screenshot(path=str(OUT / "reduced-motion-390.png"))
        checks.append("Reduced motion: source remains selectable with all added transitions disabled.")
        context.close()

        context = browser.new_context(
            viewport={"width": 390, "height": 844}, is_mobile=True,
            has_touch=True, device_scale_factor=1,
        )
        context.add_init_script("""
          localStorage.setItem('sat-age-confirmed', 'yes');
          if (!sessionStorage.getItem('sat-source-test-seeded')) {
            localStorage.setItem('sat-sake-clash:v1', 'baseline-sentinel');
            localStorage.setItem('sat-sake-clash:v1:iphone-review', 'preview-sentinel');
            sessionStorage.setItem('sat-source-test-seeded', 'yes');
          }
        """)
        page = context.new_page()
        monitor(page)
        page.goto(BASE, wait_until="networkidle")
        page.locator('.source-card[data-source="tsuchida"]').tap()
        verify_selection(page, "tsuchida")
        page.locator("#play").scroll_into_view_if_needed()
        page.wait_for_timeout(500)
        saved_y = page.evaluate("scrollY")
        frame = open_game(page)
        page.wait_for_timeout(3100)
        assert frame.locator("#time").inner_text() == "30"
        assert frame.locator("#arena").get_attribute("data-tick") == "0"
        assert frame.locator("#arena").get_attribute("data-played") == "0"
        assert frame.locator("#arena").get_attribute("data-units") == "[]"
        page.screenshot(path=str(OUT / "shared-game-ready-390.png"))
        frame.locator('.game-card[data-index="0"]').tap()
        arena = frame.locator("#arena").bounding_box()
        page.touchscreen.tap(arena["x"] + arena["width"] * .5, arena["y"] + arena["height"] * .58)
        frame.locator('#arena[data-played="1"]').wait_for()
        page.wait_for_timeout(2300)
        assert int(frame.locator("#time").inner_text()) < 30
        page.screenshot(path=str(OUT / "shared-game-running-390.png"))
        frame.locator("#explore").wait_for(state="visible", timeout=40000)
        assert frame.locator("#arena").get_attribute("data-status") in ("won", "lost", "draw")
        assert page.locator("#play-modal").get_attribute("data-outcome") in ("won", "lost", "draw")
        assert page.url == BASE
        assert frame.locator("#explore").get_attribute("href").endswith("#sat-002")
        page.screenshot(path=str(OUT / "shared-game-result-390.png"))
        # Replay and close after a real result; reopen for natural product routing.
        frame.locator("#replay").tap()
        frame.locator('#arena[data-played="0"]').wait_for()
        assert frame.locator("#time").inner_text() == "30"
        page.wait_for_function("!document.querySelector('#play-modal').hasAttribute('data-outcome')")
        assert page.locator("#play-modal").get_attribute("data-outcome") is None
        page.locator("#close-play").tap()
        page.wait_for_timeout(300)
        assert not page.locator("#play-modal").is_visible()
        assert abs(page.evaluate("scrollY") - saved_y) < 3
        assert page.evaluate("localStorage.getItem('sat-sake-clash:v1')") == "baseline-sentinel"
        assert page.evaluate("localStorage.getItem('sat-sake-clash:v1:iphone-review')") == "preview-sentinel"
        frame = open_game(page)
        arena = frame.locator("#arena").bounding_box()
        page.touchscreen.tap(arena["x"] + arena["width"] * .5, arena["y"] + arena["height"] * .58)
        frame.locator('#arena[data-played="1"]').wait_for()
        frame.locator("#explore").wait_for(state="visible", timeout=40000)
        frame.locator("#explore").tap()
        page.wait_for_url("**/index.html#sat-002")
        assert urlsplit(page.url).path == urlsplit(BASE).path.split("/experiments/")[0] + "/index.html"
        assert page.locator("#sat-002").count() == 1
        page.screenshot(path=str(OUT / "product-sat-002-390.png"))
        page.go_back(wait_until="load")
        page.wait_for_timeout(500)
        assert page.url == BASE
        assert not page.locator("#play-modal").is_visible()
        assert page.evaluate("document.body.style.position") != "fixed"
        assert page.evaluate("localStorage.getItem('sat-sake-clash:v1')") == "baseline-sentinel"
        assert page.evaluate("localStorage.getItem('sat-sake-clash:v1:iphone-review')") == "preview-sentinel"
        checks.append("Shared real iframe: one-tap launch, selected SAT 002, first-deploy freeze, two natural matches, replay, close/scroll restoration, product navigation/back, original-record isolation passed.")
        context.close()
        browser.close()
    assert not page_errors, page_errors
    unexpected = [error for error in http_errors if not urlsplit(error["url"]).path.endswith("/favicon.ico")]
    assert not unexpected, unexpected
    for name in ("urasato-source.png", "tsuchida-source.png"):
        assert any(item["url"].endswith("/" + name) and item["status"] == 200
                   and item["resourceType"] == "image" for item in loaded_artwork), name


try:
    run()
except Exception as error:
    OUT.joinpath("results.json").write_text(json.dumps({
        "status": "FAIL", "failure": str(error), "checks": checks,
        "geometry": geometry, "pageErrors": page_errors, "httpErrors": http_errors,
        "loadedArtwork": loaded_artwork,
    }, ensure_ascii=False, indent=2))
    raise
OUT.joinpath("results.json").write_text(json.dumps({
    "status": "PASS", "checks": checks, "geometry": geometry,
    "browser": "Google Chrome / Playwright Chromium; viewport and touch emulation",
    "notTested": ["iPhone Safari physical device", "iOS saving", "human first-impression evaluation"],
    "pageErrors": page_errors, "httpErrors": http_errors,
    "loadedArtwork": loaded_artwork,
    "testedFiles": {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest()
                    for path in (ROOT / "experiments/after-hours-source").iterdir() if path.is_file()},
}, ensure_ascii=False, indent=2))
print(json.dumps({"status": "PASS", "checks": checks, "evidence": str(OUT)}, ensure_ascii=False, indent=2))
