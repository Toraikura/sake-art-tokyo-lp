"""Regression checks for SAKE ART TOKYO × FERMENTATION PLAYGROUND integration.

This suite verifies only published destinations, the water-sound progressive enhancement,
and responsive overflow. It does not treat Chromium emulation as physical iPhone Safari.
"""
from __future__ import annotations

import os
from urllib.parse import urljoin, urlsplit
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


BASE = os.environ.get("BASE_URL", "http://127.0.0.1:4190/")
FPG = "https://toraikura.github.io/sat-fermentation-playground/"
AROMA = FPG + "aroma-lab/"
MATCH = AROMA + "aroma-match/"
AUDIO = (
    "water-drop-pochan.mp3",
    "water-drop-01.mp3",
    "water-drop-03.mp3",
    "water-drop-05.mp3",
    "water-drop-mid-reverb.mp3",
    "water-drop-low-reverb.mp3",
    "water-drop-high-reverb.mp3",
    "water-drop-short.mp3",
)


def local(path: str) -> str:
    return urljoin(BASE, path.lstrip("/"))


def assert_external(locator, expected: str) -> None:
    assert locator.count() == 1, (expected, locator.count())
    assert locator.get_attribute("href") == expected


def assert_no_overflow(page, width: int) -> None:
    measured = page.evaluate("""() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth
    })""")
    assert measured["scrollWidth"] <= measured["width"] + 1, (width, measured)


def verify_audio_http() -> None:
    for filename in AUDIO:
        with urlopen(local("assets/audio/water/" + filename), timeout=10) as response:
            body = response.read()
            assert response.status == 200, (filename, response.status)
            assert len(body) > 1000, (filename, len(body))
            assert body.startswith(b"ID3") or (body[0] == 0xFF and body[1] & 0xE0 == 0xE0), filename


def verify_static_routes(page) -> None:
    page.goto(local("/sake/aroma/"), wait_until="domcontentloaded")
    assert_external(page.locator('a[data-experience="aroma-labo"]'), AROMA)
    assert_external(page.locator('a[data-experience="aroma-match"]'), MATCH)
    assert page.locator('a[href*="rice-lineage"],a[href*="/playground/"]').count() == 0

    page.goto(local("/en/sake/aroma/"), wait_until="domcontentloaded")
    assert_external(page.locator('a[data-experience="aroma-labo"]'), AROMA)
    assert_external(page.locator('a[data-experience="aroma-match"]'), MATCH)

    for path in ("/breweries/urazato/", "/breweries/tsuchida/", "/en/breweries/urazato/", "/en/breweries/tsuchida/"):
        page.goto(local(path), wait_until="domcontentloaded")
        assert_external(page.locator('a[data-experience="aroma-labo"]'), AROMA)

    for path in ("/about/chill-labo/", "/en/about/chill-labo/"):
        page.goto(local(path), wait_until="domcontentloaded")
        assert_external(page.locator('a[data-experience="hub"]'), FPG)

    for path in ("/sake/", "/en/sake/"):
        page.goto(local(path), wait_until="domcontentloaded")
        body = page.locator("body").inner_text()
        assert "FIELD → RICE → BREWING → GLASS → BOTTLE" in body
        assert page.locator('a[href*="rice-lineage"],a[href*="shubo"],a[href*="pathway"]').count() == 0


def verify_home(page, language: str) -> None:
    path = "/en/" if language == "en" else "/"
    page.goto(local(path), wait_until="domcontentloaded")
    page.wait_for_function("document.querySelector('#liquid')?.dataset.renderer")

    nav = page.locator("header .nav-play")
    assert nav.count() == 1 and nav.get_attribute("href") == FPG
    assert nav.get_attribute("data-event") == "sat_playground_hub_click"
    assert page.locator("#play [data-play]").count() == 1  # existing SAKE CLASH remains
    assert_external(page.locator('.playground-entry a[data-experience="hub"]'), FPG)

    sound = page.locator("#water-sound")
    assert sound.count() == 1 and sound.is_visible()
    box = sound.bounding_box()
    assert box and box["width"] >= 44 and box["height"] >= 44, box
    assert sound.get_attribute("aria-pressed") == "true"

    zone = page.locator("#art-zone")
    before_ripples = int(page.locator("#liquid").get_attribute("data-ripples") or 0)
    zone.click(position={"x": 100, "y": 100})
    page.wait_for_timeout(80)
    after_ripples = int(page.locator("#liquid").get_attribute("data-ripples") or 0)
    assert after_ripples == before_ripples + 1
    plays = page.evaluate("window.__satAudioPlays.slice()")
    assert len(plays) == 1, plays
    assert urlsplit(plays[0]["src"]).path.rsplit("/", 1)[-1] in AUDIO
    assert 0 < plays[0]["volume"] <= 0.4

    sound.click()
    assert sound.get_attribute("aria-pressed") == "false"
    assert page.evaluate("localStorage.getItem('sat-water-sound-enabled')") == "off"
    zone.click(position={"x": 120, "y": 120})
    page.wait_for_timeout(160)
    assert len(page.evaluate("window.__satAudioPlays")) == 1

    sound.click()
    assert sound.get_attribute("aria-pressed") == "true"
    page.wait_for_timeout(140)
    zone.click(position={"x": 140, "y": 120})
    page.wait_for_timeout(80)
    assert len(page.evaluate("window.__satAudioPlays")) == 2


def main() -> None:
    verify_audio_http()
    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(viewport={"width": 390, "height": 844})
        page = context.new_page()
        page.add_init_script("""
          localStorage.setItem('sat-age-confirmed', 'yes');
          localStorage.removeItem('sat-water-sound-enabled');
          window.__satAudioPlays = [];
          HTMLMediaElement.prototype.play = function () {
            window.__satAudioPlays.push({src: this.src, volume: this.volume});
            return Promise.resolve();
          };
        """)
        verify_home(page, "ja")
        page.evaluate("localStorage.removeItem('sat-water-sound-enabled')")
        verify_home(page, "en")
        verify_static_routes(page)
        context.close()

        for width in (320, 375, 390, 430):
            context = browser.new_context(viewport={"width": width, "height": 844})
            page = context.new_page()
            page.add_init_script("localStorage.setItem('sat-age-confirmed', 'yes')")
            for path in ("/", "/en/", "/sake/aroma/", "/sake/"):
                page.goto(local(path), wait_until="domcontentloaded")
                assert_no_overflow(page, width)
            context.close()
        browser.close()

    print("living integration: ok")


if __name__ == "__main__":
    main()
