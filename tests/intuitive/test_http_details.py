"""Supplemental real-HTTP checks; no injected game results, CPU, or clock changes."""
from pathlib import Path
from urllib.parse import urljoin
import hashlib
import json
import os
import struct
import time
import traceback

from playwright.sync_api import sync_playwright


BASE = os.environ.get(
    "BASE_URL", "http://127.0.0.1:4190/experiments/after-hours-water/"
)
OUT = Path(os.environ.get("EVIDENCE_DIR", "evidence"))
SOURCE = Path(__file__).resolve().parents[2] / "experiments/after-hours-water"
OUT.mkdir(parents=True, exist_ok=True)
report = {
    "browser": "Playwright Chromium, touch / viewport emulation; not an iPhone device",
    "status": "running", "checks": [], "downloads": [], "images": [],
    "pageErrors": [], "consoleErrors": [], "failedRequests": [], "httpErrors": [],
    "incidentalDiagnostics": [],
}


def png_info(data):
    assert data[:8] == b"\x89PNG\r\n\x1a\n" and data[12:16] == b"IHDR", "Invalid PNG header"
    width, height = struct.unpack(">II", data[16:24])
    assert width > 0 and height > 0
    return {"sha256": hashlib.sha256(data).hexdigest(), "width": width, "height": height}


def clean_diagnostics():
    for key in ("pageErrors", "consoleErrors", "failedRequests", "httpErrors"):
        application_errors = []
        for item in report[key]:
            # Chrome automatically requests this absent baseline icon. Keep the
            # observed message in the report; exclude only this exact 404 URL.
            is_icon = isinstance(item, dict) and (
                item.get("url", item.get("location", {}).get("url"))
                == urljoin(BASE, "/favicon.ico")
            )
            is_404 = isinstance(item, dict) and (
                item.get("status") == 404 or "404 (File not found)" in item.get("text", "")
            )
            if is_icon and is_404:
                report["incidentalDiagnostics"].append({"source": key, **item})
            else:
                application_errors.append(item)
        assert not application_errors, (key, application_errors)


def loaded_images(page, label):
    """Scroll real lazy images into view and check the browser's decoded dimensions."""
    for img in page.locator("img[src]").all():
        if not img.is_visible() and img.get_attribute("loading") == "lazy":
            # The desktop-only brand mark deliberately does not load on mobile.
            report["images"].append({"page": label, "src": img.get_attribute("src"),
                                     "state": "hidden lazy image; outside visible-image check"})
            continue
        if img.is_visible():
            img.scroll_into_view_if_needed()
        img.evaluate("""img => new Promise((resolve, reject) => {
            if (img.complete) return img.naturalWidth ? resolve() : reject(new Error(img.src));
            const timeout = setTimeout(() => reject(new Error('Image load timed out: ' + img.src)), 15000);
            img.addEventListener('load', () => { clearTimeout(timeout); resolve(); }, {once: true});
            img.addEventListener('error', () => { clearTimeout(timeout); reject(new Error(img.src)); }, {once: true});
        })""")
        info = img.evaluate("img => ({src: img.currentSrc || img.src, width: img.naturalWidth, height: img.naturalHeight})")
        assert info["width"] > 0 and info["height"] > 0, info
        report["images"].append({"page": label, **info})


def text_fits(locator):
    """Measure glyphs against real clipping ancestors, not their CSS line box.

    A line-height:1 score can paint above/below its own box without clipping;
    its surrounding margins and overflow-visible ancestors intentionally allow it.
    """
    info = locator.evaluate("""el => {
        const range = document.createRange(); range.selectNodeContents(el);
        const rects = Array.from(range.getClientRects()).filter(r => r.width && r.height);
        const clips = [];
        for (let parent = el; parent; parent = parent.parentElement) {
            const style = getComputedStyle(parent), bounds = parent.getBoundingClientRect();
            const x = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowX);
            const y = ['hidden', 'clip', 'auto', 'scroll'].includes(style.overflowY);
            if (x || y) clips.push({element: parent.id || parent.tagName, x, y,
                left: bounds.left + parent.clientLeft, top: bounds.top + parent.clientTop,
                right: bounds.left + parent.clientLeft + parent.clientWidth,
                bottom: bounds.top + parent.clientTop + parent.clientHeight});
        }
        return {text: el.textContent.trim(), clips,
            rects: rects.map(r => ({left:r.left, top:r.top, right:r.right, bottom:r.bottom}))};
    }""")
    for rect in info["rects"]:
        for clip in info["clips"]:
            if clip["x"]:
                assert rect["left"] >= clip["left"] - 2 and rect["right"] <= clip["right"] + 2, info
            if clip["y"]:
                assert rect["top"] >= clip["top"] - 2 and rect["bottom"] <= clip["bottom"] + 2, info


def within(locator, bounds):
    assert locator.is_visible(), "Hidden control: " + str(locator)
    box = locator.bounding_box()
    assert box and box["width"] > 0 and box["height"] > 0
    assert box["x"] >= bounds["x"] - 1 and box["y"] >= bounds["y"] - 1, (box, bounds)
    assert box["x"] + box["width"] <= bounds["x"] + bounds["width"] + 1, (box, bounds)
    assert box["y"] + box["height"] <= bounds["y"] + bounds["height"] + 1, (box, bounds)


def selected_label(page, releases, expected_id):
    page.wait_for_function(
        "id => document.querySelector('#label-stack').dataset.release === id", arg=expected_id
    )
    page.wait_for_timeout(350)
    release = next(item for item in releases if item["id"] == expected_id)
    index = releases.index(release)
    assert page.locator("#label-name").inner_text() == release["name"]
    assert page.locator("#label-brewery").inner_text() == (
        expected_id.upper().replace("-", " ", 1) + " / " + release["brewery"]
    )
    assert page.locator("#label-counter").inner_text() == f"{index + 1:02} / {len(releases):02}"
    for selector, attr, value in (
        ("#label-image", "src", release["image"]),
        ("#save-label", "href", release["download"]),
        ("#save-label", "download", release["filename"]),
        ("#label-details", "href", release["detail"]),
    ):
        assert page.locator(selector).get_attribute(attr) == value, (selector, attr, value)
    page.locator("#label-image").evaluate("img => img.decode()")
    assert not page.locator("#label-error").is_visible()
    return release


def open_game(page):
    page.locator(".play-launch").tap()
    page.wait_for_function("document.querySelector('#play-loading').hidden")
    frame = page.locator("#play-frame-slot iframe").element_handle().content_frame()
    assert frame is not None
    frame.locator('#arena[data-status="playing"]').wait_for()
    return frame


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(
        headless=True, executable_path=os.environ.get("PLAYWRIGHT_EXECUTABLE_PATH"),
        args=["--no-sandbox"],
    )
    context = browser.new_context(
        viewport={"width": 320, "height": 640}, is_mobile=True,
        has_touch=True, device_scale_factor=1, accept_downloads=True,
    )
    context.add_init_script("""localStorage.setItem('sat-age-confirmed', 'yes');
        for (const [key, value] of [
          ['sat-sake-clash:v1', 'supplemental-baseline'],
          ['sat-sake-clash:v1:iphone-review', 'supplemental-preview']]) {
          if (localStorage.getItem(key) === null) localStorage.setItem(key, value);
        }""")
    page = context.new_page()
    page.set_default_timeout(15000)
    page.on("pageerror", lambda error: report["pageErrors"].append(str(error)))
    page.on("console", lambda message: report["consoleErrors"].append({
        "text": message.text, "location": message.location
    }) if message.type == "error" else None)
    page.on("requestfailed", lambda request: report["failedRequests"].append({
        "url": request.url, "failure": request.failure
    }))
    page.on("response", lambda response: report["httpErrors"].append({
        "url": response.url, "status": response.status
    }) if response.status >= 400 else None)
    try:
        page.goto(BASE, wait_until="networkidle")
        releases = json.loads(page.locator("#label-releases").text_content())
        assert [item["id"] for item in releases] == ["sat-001", "sat-002"]
        loaded_images(page, "experiment-initial")
        assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
        page.locator("#art-zone").scroll_into_view_if_needed()
        page.wait_for_timeout(300)
        page.locator("#art-zone").screenshot(path=str(OUT / "supplemental-water-320.png"))
        page.locator("#comic").screenshot(path=str(OUT / "supplemental-comic-320.png"))
        page.locator("#sat-002 .record-art").screenshot(path=str(OUT / "supplemental-poster-320.png"))

        selected_label(page, releases, "sat-001")
        page.locator("#label-next").tap()
        selected_label(page, releases, "sat-002")
        page.locator("#label-prev").tap()
        selected_label(page, releases, "sat-001")
        page.locator("#label-stack").focus()
        page.keyboard.press("ArrowRight")
        selected_label(page, releases, "sat-002")
        page.keyboard.press("ArrowLeft")
        selected_label(page, releases, "sat-001")
        report["checks"].append("Arrow buttons and keyboard update label, counter, name, brewery, image, PNG and detail targets together.")

        for release in releases:
            # Select with an actual mood button; never inject release data.
            page.locator('[data-mood-choice="' + ("deep" if release["id"] == "sat-002" else "light") + '"]').tap()
            selected_label(page, releases, release["id"])
            with page.expect_download() as event:
                page.locator("#save-label").tap()
            download = event.value
            assert download.failure() is None
            assert download.suggested_filename == release["filename"]
            destination = OUT / ("supplemental-" + download.suggested_filename)
            download.save_as(str(destination))
            actual = png_info(destination.read_bytes())
            expected = png_info((SOURCE / release["download"]).read_bytes())
            assert actual == expected, (actual, expected)
            report["downloads"].append({"release": release["id"], **actual})
            for selector in ("#label-name", "#label-brewery", "#label-counter", "#save-label", "#label-details"):
                text_fits(page.locator(selector))
                box = page.locator(selector).bounding_box()
                assert box["x"] >= -1 and box["x"] + box["width"] <= 321, (selector, box)
            page.locator("#labels").screenshot(path=str(OUT / f'supplemental-label-{release["id"]}-320.png'))
            page.locator("#label-details").scroll_into_view_if_needed()
            page.wait_for_timeout(300)
            previous_scroll = page.evaluate("scrollY")
            page.locator("#label-details").tap()
            page.wait_for_url(urljoin(BASE, release["detail"]), wait_until="load")
            assert page.locator("#" + release["id"]).count() == 1
            loaded_images(page, "product-detail-" + release["id"])
            page.go_back(wait_until="load")
            page.wait_for_timeout(500)
            assert page.url == BASE
            assert not page.locator("#play-modal").is_visible()
            assert page.evaluate("document.body.style.position") != "fixed"
            assert abs(page.evaluate("scrollY") - previous_scroll) < 5, "Back did not restore label scroll"
        report["checks"].append("Both actual PNG downloads match source SHA-256 and PNG header dimensions; both real label-detail navigations return to an unlocked page at the original scroll.")

        page.locator('[data-mood-choice="deep"]').tap()
        selected_label(page, releases, "sat-002")
        page.locator("#play").scroll_into_view_if_needed()
        page.wait_for_timeout(350)
        frame = open_game(page)
        bounds = page.locator("#play-frame-slot").bounding_box()
        for selector in ("#arena", "#cancel", "#pause") + tuple(f'.game-card[data-index="{i}"]' for i in range(4)):
            within(frame.locator(selector), bounds)
        within(page.locator("#close-play"), {"x": 0, "y": 0, "width": 320, "height": 640})
        for card in frame.locator(".game-card b").all():
            text_fits(card)
        assert frame.locator("#time").inner_text() == "30"
        assert frame.locator("#arena").get_attribute("data-tick") == "0"
        page.screenshot(path=str(OUT / "supplemental-game-ready-320.png"))
        frame.locator('.game-card[data-index="0"]').tap()
        frame.locator("#first-target").wait_for(state="visible")
        box = frame.locator("#arena").bounding_box()
        started = time.monotonic()
        page.touchscreen.tap(box["x"] + box["width"] * .5, box["y"] + box["height"] * .58)
        frame.locator('#arena[data-played="1"]').wait_for()
        cpu_seen = False
        while time.monotonic() - started < 50:
            state = frame.locator("#arena").evaluate("el => ({...el.dataset})")
            cpu_seen = cpu_seen or any(unit["side"] == 2 for unit in json.loads(state["units"]))
            if state["status"] in ("won", "lost", "draw"):
                break
            assert state["status"] == "playing", state
            page.wait_for_timeout(100)
        elapsed = time.monotonic() - started
        assert state["status"] in ("won", "lost", "draw"), "Natural match did not finish"
        assert cpu_seen, "No real CPU unit deployment observed"
        clock = frame.locator("#time").inner_text()
        tick = int(state["tick"])
        if clock == "00":
            assert tick == 900 and elapsed >= 29, (tick, elapsed)
        else:
            assert 0 < tick < 900, (tick, clock)
        assert page.locator("#play-modal").get_attribute("data-outcome") == state["status"]
        report["match"] = {"outcome": state["status"], "clock": clock, "tick": tick,
            "wallSeconds": round(elapsed, 3), "cpuDeploymentObserved": cpu_seen,
            "endReason": "30-second timeout" if clock == "00" else "preserved early territory win"}
        assert page.url == BASE
        for width, height in ((320, 640), (375, 550), (390, 844)):
            page.set_viewport_size({"width": width, "height": height})
            page.wait_for_timeout(250)
            bounds = page.locator("#play-frame-slot").bounding_box()
            for selector in ("#result-title", "#result-score", "#result-caption", "#explore", "#replay", "#exit"):
                within(frame.locator(selector), bounds)
                text_fits(frame.locator(selector))
            within(page.locator("#close-play"), {"x": 0, "y": 0, "width": width, "height": height})
            page.screenshot(path=str(OUT / f"supplemental-result-{width}x{height}.png"))
        report["checks"].append("One real touch-started match includes observed CPU units and an unmodified natural finish; full result text and controls fit 320x640, 375x550 and 390x844.")

        # Real finished-match navigation and Back, followed by an actual reopening.
        frame.locator("#explore").tap()
        page.wait_for_url("**/index.html#sat-002", wait_until="load")
        page.go_back(wait_until="load")
        page.wait_for_timeout(400)
        assert page.url == BASE and not page.locator("#play-modal").is_visible()
        assert page.evaluate("document.body.style.position") != "fixed"
        frame = open_game(page)
        assert frame.locator("#time").inner_text() == "30"
        assert frame.locator("#arena").get_attribute("data-played") == "0"
        assert page.locator("#play-modal").get_attribute("data-outcome") is None
        page.locator("#close-play").tap()
        for key, expected in (("sat-sake-clash:v1", "supplemental-baseline"),
                              ("sat-sake-clash:v1:iphone-review", "supplemental-preview")):
            assert page.evaluate("key => localStorage.getItem(key)", key) == expected
        loaded_images(page, "experiment-final")
        page.wait_for_timeout(300)
        clean_diagnostics()
        report["checks"].append("Game detail navigation, browser Back and a fresh one-tap reopening succeed; existing record sentinels survive navigation; no application page/console/network/image errors. Any baseline favicon 404 is retained separately in incidentalDiagnostics.")
        report["status"] = "passed"
    except Exception:
        report["status"] = "failed"
        report["failure"] = traceback.format_exc()
        try:
            page.screenshot(path=str(OUT / "supplemental-failure.png"))
        except Exception:
            pass
        raise
    finally:
        (OUT / "http-details-results.json").write_text(
            json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        context.close()
        browser.close()

print(json.dumps(report, ensure_ascii=False, indent=2))
