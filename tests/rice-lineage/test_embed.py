from pathlib import Path
import json
import os
import traceback
from urllib.request import urlopen

from playwright.sync_api import sync_playwright


BASE = os.environ.get("BASE_URL", "http://127.0.0.1:4190/")
GAME_PREFIX = "https://toraikura.github.io/sat-fermentation-playground/rice-lineage/"
OUT = Path(os.environ.get("EVIDENCE_DIR", "evidence/rice-lineage"))
OUT.mkdir(parents=True, exist_ok=True)
REPORT = {"status": "running", "checks": [], "failures": []}


def assert_static_source():
    # The current SAT arcade is enhanced by intuitive.js, which replaces the arcade's
    # runtime DOM. SEO/discovery copy therefore belongs in the source HTML and must be
    # checked before that runtime enhancement rather than in the post-JS DOM.
    with urlopen(BASE, timeout=10) as response:
        source = response.read().decode("utf-8")
    for token in ("RICE LINEAGE", "酒米の系譜", "山田錦", "五百万石", "越淡麗"):
        assert token in source, (token, "missing from source HTML")


def no_horizontal_overflow(page_or_frame):
    dims = page_or_frame.evaluate("""() => ({
      inner: window.innerWidth,
      html: document.documentElement.scrollWidth,
      body: document.body ? document.body.scrollWidth : 0
    })""")
    assert dims["html"] <= dims["inner"] + 1, dims
    assert dims["body"] <= dims["inner"] + 1, dims


def find_game_frame(page):
    page.wait_for_function("""() => {
      const f = document.querySelector('.sat-rice-lineage-frame');
      return !!f && f.src.includes('/rice-lineage/');
    }""")
    handle = page.locator(".sat-rice-lineage-frame").element_handle()
    frame = handle.content_frame()
    frame.wait_for_load_state("domcontentloaded")
    frame.locator("#startMission").wait_for(state="visible", timeout=15000)
    return frame


def exercise_game(page, width, height, touch):
    rice_requests = []
    failures = []
    console_errors = []
    page.on("request", lambda req: rice_requests.append(req.url) if req.url.startswith(GAME_PREFIX) else None)
    page.on("requestfailed", lambda req: failures.append({"url": req.url, "failure": req.failure}))
    page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

    page.goto(BASE, wait_until="networkidle")
    page.wait_for_timeout(300)

    card = page.locator("[data-rice-lineage-launch]")
    card.wait_for(state="visible")
    card.scroll_into_view_if_needed()
    page.wait_for_timeout(500)
    assert len(rice_requests) == 0, rice_requests
    assert page.locator(".sat-rice-lineage-frame").count() == 0
    assert "RICE" in card.inner_text() and "LINEAGE" in card.inner_text()
    assert "14 STAGES / 4 WORLDS" in card.inner_text()
    no_horizontal_overflow(page)

    card.click()
    modal = page.locator(".sat-rice-lineage-modal")
    assert modal.get_attribute("open") is not None
    assert page.locator(".sat-rice-lineage-frame").count() == 1
    frame = find_game_frame(page)
    assert any(url.startswith(GAME_PREFIX) for url in rice_requests), rice_requests
    assert page.locator(".sat-rice-lineage-frame").get_attribute("title") in (
        "RICE LINEAGE｜酒米の系譜", "RICE LINEAGE | Sake Rice Lineage"
    )
    no_horizontal_overflow(page)
    no_horizontal_overflow(frame)

    # SOUND and DATA remain interactive inside the cross-origin game.
    sound = frame.locator("#soundToggle")
    before_sound = sound.get_attribute("aria-pressed")
    sound.click()
    assert sound.get_attribute("aria-pressed") != before_sound
    frame.locator("#openInfo").click()
    assert frame.locator("#infoModal").is_visible()
    frame.locator("#closeInfo").click()
    assert not frame.locator("#infoModal").is_visible()

    # Start the first mission and verify the real LEFT / RIGHT controls.
    frame.locator("#startMission").click()
    frame.locator("#arcadeScreen").wait_for(state="visible")
    assert frame.locator("#leftControl").is_visible()
    assert frame.locator("#rightControl").is_visible()
    assert frame.locator("#scoreValue").is_visible()
    assert frame.locator("#comboValue").is_visible()

    if touch:
        # Exercise the game's own touchstart/touchend swipe handler.
        frame.locator("#arcadeStage").evaluate("""stage => {
          const y = 320;
          const start = new Touch({identifier: 41, target: stage, clientX: 250, clientY: y});
          const end = new Touch({identifier: 41, target: stage, clientX: 170, clientY: y});
          stage.dispatchEvent(new TouchEvent('touchstart', {bubbles: true, changedTouches: [start], touches: [start]}));
          stage.dispatchEvent(new TouchEvent('touchend', {bubbles: true, changedTouches: [end], touches: []}));
        }""")
        frame.wait_for_function("() => document.querySelector('#feedback').textContent.trim().length > 0")
        frame.wait_for_timeout(850)
    else:
        frame.locator("#rightControl").click()
        frame.wait_for_function("() => document.querySelector('#feedback').textContent.trim().length > 0")

    # Explicit close restores SAT and removes the iframe completely.
    page.locator(".sat-rice-lineage-close").click()
    page.wait_for_function("() => !document.querySelector('.sat-rice-lineage-modal')?.open")
    assert page.locator(".sat-rice-lineage-frame").count() == 0
    assert not page.locator("html").evaluate("el => el.classList.contains('sat-rice-lineage-open')")

    # Reopen is clean: still only one iframe. ESC closes and focus returns.
    card = page.locator("[data-rice-lineage-launch]")
    card.focus()
    card.click()
    find_game_frame(page)
    assert page.locator(".sat-rice-lineage-frame").count() == 1
    page.locator(".sat-rice-lineage-close").focus()
    page.keyboard.press("Escape")
    page.wait_for_function("() => !document.querySelector('.sat-rice-lineage-modal')?.open")
    assert page.locator(".sat-rice-lineage-frame").count() == 0
    assert card.evaluate("el => el === document.activeElement")
    no_horizontal_overflow(page)

    # Ignore only navigation/close aborts from the remote iframe itself; no 404/real failures allowed.
    real_failures = [f for f in failures if "ERR_ABORTED" not in str(f.get("failure"))]
    assert not real_failures, real_failures
    assert not console_errors, console_errors

    page.screenshot(path=str(OUT / f"rice-lineage-{width}x{height}.png"), full_page=True)
    return {
        "viewport": f"{width}x{height}",
        "touch": touch,
        "preClickRiceRequests": 0,
        "postClickRiceRequests": len(rice_requests),
        "duplicateIframe": False,
        "horizontalOverflow": False,
    }


def run():
    assert_static_source()
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        try:
            results = []
            for width, height, touch in ((390, 844, True), (1440, 1000, False)):
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    has_touch=touch,
                    is_mobile=touch,
                    device_scale_factor=1,
                )
                context.add_init_script("localStorage.setItem('sat-age-confirmed','yes');")
                page = context.new_page()
                try:
                    results.append(exercise_game(page, width, height, touch))
                finally:
                    context.close()
            REPORT["status"] = "passed"
            REPORT["checks"] = results
        except Exception:
            REPORT["status"] = "failed"
            REPORT["failures"].append(traceback.format_exc())
            raise
        finally:
            (OUT / "results.json").write_text(json.dumps(REPORT, ensure_ascii=False, indent=2), encoding="utf-8")
            browser.close()


if __name__ == "__main__":
    run()
    print(json.dumps(REPORT, ensure_ascii=False, indent=2))
