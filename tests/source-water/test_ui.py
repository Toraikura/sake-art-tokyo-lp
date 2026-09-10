"""Production-root regression for SAT source cards and water-scene integration.

Responsibilities here are intentionally narrow:
- production metadata and source-card artwork
- Urazato/Tsuchida selection and theme synchronization
- water ripple keyboard behavior and reduced motion
- the existing in-page SAKE CLASH launcher
- the new global PLAY link to FERMENTATION PLAYGROUND

Detailed label/game flows remain in tests/intuitive. Detailed FPG/audio behavior is
covered by tests/living-integration. Chromium emulation is not physical iPhone Safari.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import re
import subprocess
from urllib.parse import parse_qs, urljoin, urlsplit

from playwright.sync_api import sync_playwright


ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get("BASE_URL", "http://127.0.0.1:4190/")
PUBLIC_URL = "https://sakearttokyo.com/"
FPG_URL = "https://toraikura.github.io/sat-fermentation-playground/"
OUT = Path(os.environ.get("EVIDENCE_DIR", "/private/tmp/sat-source-cards-tests"))
OUT.mkdir(parents=True, exist_ok=True)
CHROME = os.environ.get("PLAYWRIGHT_EXECUTABLE_PATH")

checks: list[str] = []
geometry: list[dict] = []
page_errors: list[str] = []
http_errors: list[dict] = []
navigation: list[dict] = []

FORBIDDEN_FLOW = (
    "#source-flow, .source-flow, [data-flow], [data-flow-source], [data-flow-veil], "
    "[data-flow-wisp], [data-flow-soft], [data-origin-x], [data-origin-y]"
)


def monitor(page) -> None:
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    def response_received(response) -> None:
        if response.status >= 400:
            http_errors.append({"status": response.status, "url": response.url})

    page.on("response", response_received)


def assert_no_overflow(page, width: int) -> None:
    measured = page.evaluate("""() => ({
      innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    })""")
    assert measured["scrollWidth"] <= measured["innerWidth"] + 1, (width, measured)
    geometry.append({"width": width, **measured})


def verify_metadata(page) -> None:
    assert urlsplit(page.url).path == urlsplit(BASE).path
    assert page.locator("#hero-title > span").all_text_contents() == ["NOT", "JUST", "SAKE"]
    assert page.locator("#hero-title").get_attribute("aria-label") == "Not just sake まだ知らない、好きがある。"
    assert page.locator('link[rel="canonical"]').get_attribute("href") == PUBLIC_URL
    assert page.locator('meta[property="og:url"]').get_attribute("content") == PUBLIC_URL
    assert page.locator('meta[property="og:image"]').get_attribute("content") == PUBLIC_URL + "assets/sat-dimensional-logo.png"
    assert page.locator('meta[name="twitter:image"]').get_attribute("content") == PUBLIC_URL + "assets/sat-dimensional-logo.png"
    for item in page.locator('meta[name="robots"], meta[name="googlebot"]').all():
        assert not set(re.split(r"[\s,]+", (item.get_attribute("content") or "").lower())) & {"noindex", "none"}
    structured = [json.loads(item.text_content()) for item in page.locator('script[type="application/ld+json"]').all()]
    assert any(item.get("@type") == "WebSite" and item.get("url") == PUBLIC_URL for item in structured), structured
    assert page.locator(".record-shop[hidden]").count() == 2
    assert page.locator(FORBIDDEN_FLOW).count() == 0
    checks.append("Production canonical/OG/Twitter/schema and hidden shop state are intact.")


def verify_global_play(page, width: int) -> None:
    play = page.locator("header .nav-play")
    assert play.count() == 1
    assert play.get_attribute("href") == FPG_URL
    assert play.get_attribute("data-event") == "sat_playground_hub_click"
    assert play.get_attribute("data-experience") == "hub"
    if width <= 700:
        assert play.is_visible()
        box = play.bounding_box()
        assert box and box["width"] >= 44 and box["height"] >= 44, box
    checks.append(f"{width}px: global PLAY is a normal FPG link, not the SAKE CLASH trigger.")


def verify_theme(page, source: str, width: int) -> None:
    expected = {
        "urasato": {
            "mood": "light",
            "side": "SIDE A / URAZATO",
            "brewery": "浦里酒造",
            "copy": "霧の向こう、澄んだ余韻。",
            "release": "sat-001",
            "accent": "rgb(213, 239, 131)",
            "arcade": "rgb(37, 42, 30)",
        },
        "tsuchida": {
            "mood": "deep",
            "side": "SIDE B / TSUCHIDA",
            "brewery": "土田酒造",
            "copy": "森の奥、湧き出す深み。",
            "release": "sat-002",
            "accent": "rgb(197, 172, 243)",
            "arcade": "rgb(37, 32, 50)",
        },
    }[source]
    page.wait_for_timeout(450)
    assert page.locator("#source-scene").get_attribute("data-source") == source
    assert page.locator("body").get_attribute("data-mood") == expected["mood"]
    assert page.locator("#side-title").inner_text() == expected["side"]
    assert page.locator("#source-brewery").inner_text() == expected["brewery"]
    assert page.locator("#source-copy").inner_text() == expected["copy"]
    assert page.locator("#label-stack").get_attribute("data-release") == expected["release"]
    assert page.locator(f'#{expected["release"]}').get_attribute("data-selected") == "true"
    assert page.locator(".record[data-selected=true]").count() == 1
    assert page.locator(".source-card[aria-pressed=true]").count() == 1
    assert page.locator(f'.source-card[data-source="{source}"]').get_attribute("aria-pressed") == "true"
    colors = page.evaluate("""() => ({
      dot: getComputedStyle(document.querySelector('.motion-dot')).backgroundColor,
      rule: getComputedStyle(document.querySelector('.theme-rule')).backgroundColor,
      play: getComputedStyle(document.querySelector('#play-title > span')).color,
      arcade: getComputedStyle(document.querySelector('.arcade')).backgroundColor
    })""")
    assert colors["dot"] == colors["rule"] == colors["play"] == expected["accent"], (source, colors)
    assert colors["arcade"] == expected["arcade"], (source, colors)
    assert_no_overflow(page, width)


def verify_source_cards(page, width: int) -> None:
    cards = page.locator(".source-card")
    assert cards.count() == 2
    before = int(page.locator("#liquid").get_attribute("data-ripples") or 0)
    for card in cards.all():
        box = card.bounding_box()
        assert box and box["width"] >= 44 and box["height"] >= 44, (width, box)

    verify_theme(page, "urasato", width)
    target = page.locator('.source-card[data-source="tsuchida"]')
    target.tap() if width < 700 else target.click()
    verify_theme(page, "tsuchida", width)
    assert int(page.locator("#liquid").get_attribute("data-ripples") or 0) == before

    urazato = page.locator('.source-card[data-source="urasato"]')
    urazato.focus()
    page.keyboard.press("Enter")
    verify_theme(page, "urasato", width)
    page.keyboard.press("Tab")
    assert target.evaluate("el => el === document.activeElement")
    page.keyboard.press("Space")
    verify_theme(page, "tsuchida", width)
    assert int(page.locator("#liquid").get_attribute("data-ripples") or 0) == before

    # Actual source-card artwork must decode successfully.
    for svg_image in page.locator(".source-art image[href]").all():
        info = svg_image.evaluate("""async element => {
          const img = new Image();
          img.src = new URL(element.getAttribute('href'), document.baseURI).href;
          await img.decode();
          return {src: img.src, width: img.naturalWidth, height: img.naturalHeight};
        }""")
        assert info["width"] > 0 and info["height"] > 0, info

    page.locator("#source-scene").screenshot(path=str(OUT / f"source-scene-{width}.png"))
    checks.append(f"{width}px: source cards switch full SAT theme and labels without creating a water ripple.")


def verify_water_keyboard(page) -> None:
    zone = page.locator("#art-zone")
    zone.focus()
    before = int(page.locator("#liquid").get_attribute("data-ripples") or 0)
    page.keyboard.press("Enter")
    after = int(page.locator("#liquid").get_attribute("data-ripples") or 0)
    assert after == before + 1, (before, after)
    checks.append("Keyboard Enter on the water surface creates exactly one ripple.")


def verify_game_entry(page) -> None:
    trigger = page.locator("#play .play-launch")
    trigger.scroll_into_view_if_needed()
    page.wait_for_timeout(250)
    before_scroll = page.evaluate("scrollY")
    trigger.click()
    page.wait_for_function("document.querySelector('#play-loading').hidden")
    iframe = page.locator("#play-frame-slot iframe")
    src = urlsplit(iframe.get_attribute("src"))
    assert src.path == urlsplit(urljoin(BASE, "play/")).path
    assert parse_qs(src.query)["bottle"] == ["sat-002"]
    frame = page.frame_locator("#play-frame-slot iframe")
    frame.locator('#arena[data-status="playing"]').wait_for()
    assert frame.locator("#time").inner_text() == "30"
    assert frame.locator("#arena").get_attribute("data-played") == "0"
    page.locator("#close-play").click()
    page.wait_for_timeout(250)
    assert not page.locator("#play-modal").is_visible()
    after_scroll = page.evaluate("scrollY")
    assert abs(after_scroll - before_scroll) < 3, (before_scroll, after_scroll)
    navigation.append({"entry": "#play .play-launch", "before": before_scroll, "after": after_scroll})
    checks.append("The existing SAKE CLASH card still opens the 30-second same-origin game and restores scroll on close.")


def verify_brand_and_products(page, width: int) -> None:
    assert page.locator(".brand-intro").count() == 1
    assert page.locator(".record-story").count() == 2
    assert "常温保存できます。" in page.locator("#sat-001 .record-story").inner_text()
    assert "貴醸酒" in page.locator("#sat-002 .record-story").inner_text()
    assert page.locator("#comic-image").is_visible()
    page.locator("#comic-image").scroll_into_view_if_needed()
    page.locator("#comic-image").evaluate("img => img.decode()")
    assert page.locator("#comic-image").evaluate("img => img.naturalWidth > 0 && img.naturalHeight > 0")
    assert_no_overflow(page, width)
    checks.append(f"{width}px: brand, products and comic remain present without page overflow.")


def verify_reduced_motion(browser) -> None:
    context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True,
                                  has_touch=True, reduced_motion="reduce", device_scale_factor=1)
    context.add_init_script("localStorage.setItem('sat-age-confirmed', 'yes')")
    page = context.new_page()
    monitor(page)
    page.goto(BASE, wait_until="networkidle")
    assert page.locator("#motion").get_attribute("aria-pressed") == "true"
    for element in page.locator(".source-card, .source-art").all():
        durations = element.evaluate("el => getComputedStyle(el).transitionDuration").split(",")
        assert all(float(value.strip().removesuffix("s")) == 0 for value in durations)
    page.locator('.source-card[data-source="tsuchida"]').tap()
    verify_theme(page, "tsuchida", 390)
    context.close()
    checks.append("Reduced-motion mode keeps source selection usable with transitions disabled.")


def verify_preserved_candidate() -> None:
    preserved = subprocess.check_output([
        "git", "diff", "--name-only", "origin/main", "--",
        "experiments/after-hours-water", "sake-clash",
    ], cwd=ROOT, text=True).strip()
    assert not preserved, "Preserved candidate / original game changed: " + preserved
    candidate = ROOT / "experiments/after-hours-water"
    for name in ("model.js", "art.js", "preview.js", "game.css"):
        assert (ROOT / "play" / name).read_bytes() == (candidate / "play" / name).read_bytes(), name
    checks.append("Preserved after-hours candidate and original SAKE CLASH assets remain unchanged from main.")


def verify_old_redirect(page) -> None:
    old_url = urljoin(BASE, "experiments/after-hours-source/")
    candidate_url = urljoin(BASE, "experiments/after-hours-water/")
    page.goto(old_url + "?bottle=sat-002#labels", wait_until="networkidle")
    page.wait_for_url(candidate_url + "?bottle=sat-002#labels")
    assert page.locator("#source-scene").get_attribute("data-source") == "tsuchida"
    checks.append("Legacy after-hours-source redirect still preserves query/hash and selected bottle.")


def run() -> None:
    verify_preserved_candidate()
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True, executable_path=CHROME, args=["--no-sandbox"])
        for width, height in ((1440, 1000), (390, 844), (375, 812)):
            context = browser.new_context(viewport={"width": width, "height": height},
                                          is_mobile=width < 700, has_touch=width < 700,
                                          device_scale_factor=1)
            context.add_init_script("localStorage.setItem('sat-age-confirmed', 'yes')")
            page = context.new_page()
            monitor(page)
            response = page.goto(BASE, wait_until="networkidle")
            assert response and response.status == 200
            page.wait_for_function("document.querySelector('#liquid')?.dataset.renderer")
            verify_metadata(page)
            verify_global_play(page, width)
            verify_source_cards(page, width)
            verify_water_keyboard(page)
            verify_game_entry(page)
            verify_brand_and_products(page, width)
            context.close()

        verify_reduced_motion(browser)

        context = browser.new_context(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        context.add_init_script("localStorage.setItem('sat-age-confirmed', 'yes')")
        page = context.new_page()
        monitor(page)
        verify_old_redirect(page)
        context.close()
        browser.close()

    assert not page_errors, page_errors
    meaningful_http = [item for item in http_errors if not urlsplit(item["url"]).path.endswith("/favicon.ico")]
    assert not meaningful_http, meaningful_http


result = {"status": "running"}
try:
    run()
    result = {
        "status": "PASS",
        "browser": "Playwright Chromium; viewport/touch emulation",
        "checks": checks,
        "geometry": geometry,
        "navigation": navigation,
        "pageErrors": page_errors,
        "httpErrors": http_errors,
        "notTested": ["Physical iPhone Safari", "native audio output quality", "human first-impression evaluation"],
    }
except Exception as error:
    result = {
        "status": "FAIL",
        "failure": str(error),
        "checks": checks,
        "geometry": geometry,
        "navigation": navigation,
        "pageErrors": page_errors,
        "httpErrors": http_errors,
    }
    OUT.joinpath("results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
    raise

OUT.joinpath("results.json").write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps({"status": "PASS", "checks": checks, "evidence": str(OUT)}, ensure_ascii=False, indent=2))
