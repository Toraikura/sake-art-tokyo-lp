from pathlib import Path
import os
import json
import time
import traceback

from playwright.sync_api import sync_playwright


BASE = os.environ.get("BASE_URL", "http://127.0.0.1:4190/")
OUT = Path(os.environ.get("EVIDENCE_DIR", "evidence/source-water"))
OUT.mkdir(parents=True, exist_ok=True)
REPORT = {
    "browser": "Playwright Chromium; viewport/touch emulation, not a physical iPhone",
    "status": "running",
    "checks": [],
    "pageErrors": [],
    "consoleErrors": [],
    "failedRequests": [],
    "httpErrors": [],
    "incidentalDiagnostics": [],
}


def assert_no_overflow(page, width: int) -> None:
    layout = page.evaluate("""() => ({
      width: innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyWidth: document.body.scrollWidth
    })""")
    assert layout["scrollWidth"] <= width and layout["bodyWidth"] <= width, (width, layout)


def record_diagnostics(page) -> None:
    page.on("pageerror", lambda error: REPORT["pageErrors"].append(str(error)))
    page.on("console", lambda message: REPORT["consoleErrors"].append({
        "text": message.text, "location": message.location
    }) if message.type == "error" else None)

    def on_request_failed(request):
        item = {"url": request.url, "failure": request.failure}
        if (
            request.url.endswith("/assets/images/optimized/sat-dimensional-logo.webp")
            and request.failure == "net::ERR_ABORTED"
        ):
            REPORT["incidentalDiagnostics"].append(item)
        else:
            REPORT["failedRequests"].append(item)

    page.on("requestfailed", on_request_failed)
    page.on("response", lambda response: REPORT["httpErrors"].append({
        "url": response.url, "status": response.status
    }) if response.status >= 400 else None)


def verify_ripple(page, width: int) -> None:
    zone = page.locator("#art-zone")
    zone.scroll_into_view_if_needed()
    page.wait_for_timeout(250)
    before = int(page.locator("#liquid").get_attribute("data-ripples") or 0)
    box = zone.bounding_box()
    assert box and box["width"] > 0 and box["height"] > 0
    x = box["x"] + box["width"] * 0.5
    y = box["y"] + box["height"] * 0.5
    page.touchscreen.tap(x, y)
    page.wait_for_function(
        "before => Number(document.querySelector('#liquid').dataset.ripples || 0) > before",
        arg=before,
    )
    assert_no_overflow(page, width)


def verify_vertical_scroll(page, width: int) -> None:
    zone = page.locator("#art-zone")
    zone.scroll_into_view_if_needed()
    page.wait_for_timeout(250)
    box = zone.bounding_box()
    before = int(page.locator("#liquid").get_attribute("data-ripples") or 0)
    start_y = box["y"] + min(box["height"] * .72, max(18, box["height"] - 18))
    x = box["x"] + box["width"] * .5
    cdp = page.context.new_cdp_session(page)
    cdp.send("Input.dispatchTouchEvent", {
        "type": "touchStart", "touchPoints": [{"x": x, "y": start_y}]
    })
    for distance in (16, 34, 58, 84):
        cdp.send("Input.dispatchTouchEvent", {
            "type": "touchMove", "touchPoints": [{"x": x, "y": start_y - distance}]
        })
    cdp.send("Input.dispatchTouchEvent", {"type": "touchEnd", "touchPoints": []})
    page.wait_for_timeout(450)
    after = int(page.locator("#liquid").get_attribute("data-ripples") or 0)
    assert after == before, (before, after)
    assert_no_overflow(page, width)


def verify_theme(page, source: str, width: int) -> None:
    expected = {
        "urasato": {
            "mood": "light",
            "side": "SIDE A / URAZATO",
            "brewery": "浦里酒造",
            "copy": "霧の向こう、澄んだ余韻。",
            "release": "sat-001",
            "accent": "rgb(213, 239, 131)",
            "arcade": "rgb(32, 39, 25)",
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
      play: getComputedStyle(document.querySelector('#fpg-arcade-title strong')).color,
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
          return {width: img.naturalWidth, height: img.naturalHeight};
        }""")
        assert info["width"] > 0 and info["height"] > 0, info


def verify_keyboard_ripple(page, width: int) -> None:
    zone = page.locator("#art-zone")
    zone.focus()
    before = int(page.locator("#liquid").get_attribute("data-ripples") or 0)
    page.keyboard.press("Enter")
    page.wait_for_function(
        "before => Number(document.querySelector('#liquid').dataset.ripples || 0) > before",
        arg=before,
    )
    assert_no_overflow(page, width)


def run() -> None:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(
            headless=True,
            executable_path=os.environ.get("PLAYWRIGHT_EXECUTABLE_PATH"),
            args=["--no-sandbox"],
        )
        context = browser.new_context(
            viewport={"width": 390, "height": 844}, is_mobile=True,
            has_touch=True, device_scale_factor=1,
        )
        context.add_init_script("localStorage.setItem('sat-age-confirmed','yes');")
        page = context.new_page()
        record_diagnostics(page)
        try:
            for width, height in ((320, 640), (360, 640), (390, 844), (430, 932), (1440, 1000)):
                page.set_viewport_size({"width": width, "height": height})
                page.goto(BASE, wait_until="networkidle")
                page.wait_for_timeout(350)
                assert not page.locator("#age").is_visible()
                verify_source_cards(page, width)
                verify_ripple(page, width)
                verify_vertical_scroll(page, width)
                verify_keyboard_ripple(page, width)
                page.screenshot(path=str(OUT / f"source-water-{width}x{height}.png"), full_page=True)
            assert not REPORT["pageErrors"], REPORT["pageErrors"]
            assert not REPORT["consoleErrors"], REPORT["consoleErrors"]
            assert not REPORT["failedRequests"], REPORT["failedRequests"]
            assert not REPORT["httpErrors"], REPORT["httpErrors"]
            REPORT["checks"] = [
                "Both source cards stay selectable by touch, click and keyboard at 320, 360, 390, 430 and 1440 widths.",
                "Source, mood, water copy, selected release, active source card, core accent and FPG arcade background stay synchronized.",
                "Water ripples on deliberate touch and Enter, while vertical touch scrolling does not create a ripple.",
                "Source-card artwork decodes successfully and no horizontal overflow or application network/console/page errors were observed.",
            ]
            REPORT["status"] = "passed"
        except Exception:
            REPORT["status"] = "failed"
            REPORT["failure"] = traceback.format_exc()
            try:
                page.screenshot(path=str(OUT / "source-water-failure.png"), full_page=True)
            except Exception:
                pass
            raise
        finally:
            (OUT / "results.json").write_text(
                json.dumps(REPORT, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            context.close()
            browser.close()


if __name__ == "__main__":
    run()
    print(json.dumps(REPORT, ensure_ascii=False, indent=2))
