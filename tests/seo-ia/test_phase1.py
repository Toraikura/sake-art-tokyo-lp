"""SEO / IA Phase 1 browser and HTTP regression checks.

Runs against the repository served over real HTTP. It verifies the new bilingual
mirror, metadata, structured data, crawlable links, sitemap entries, mobile
layout and the deliberately small homepage IA changes.
"""
import json
import os
from pathlib import Path
from urllib.parse import urljoin, urlsplit
import xml.etree.ElementTree as ET

from playwright.sync_api import sync_playwright


BASE = os.environ.get("BASE_URL", "http://127.0.0.1:4190/")
SITE = urljoin(BASE, "/")
PUBLIC = "https://sakearttokyo.com/"
CHILL_LABO = "https://chilllabo.tokyo/"
OUT = Path(os.environ.get("EVIDENCE_DIR", "/tmp/sat-seo-ia-phase1"))
OUT.mkdir(parents=True, exist_ok=True)

PAGES = [
    {
        "path": "sake/",
        "public": "sake/",
        "lang": "ja",
        "alternate": "en/sake/",
        "h1": "SAKE ART TOKYO\n日本酒",
        "types": {"CollectionPage", "ItemList", "BreadcrumbList"},
    },
    {
        "path": "en/sake/",
        "public": "en/sake/",
        "lang": "en",
        "alternate": "sake/",
        "h1": "SAKE ART TOKYO\nSAKE",
        "types": {"CollectionPage", "ItemList", "BreadcrumbList"},
    },
    {
        "path": "breweries/urazato/",
        "public": "breweries/urazato/",
        "lang": "ja",
        "alternate": "en/breweries/urazato/",
        "h1_contains": "浦里酒造",
        "types": {"WebPage", "Organization", "BreadcrumbList"},
    },
    {
        "path": "en/breweries/urazato/",
        "public": "en/breweries/urazato/",
        "lang": "en",
        "alternate": "breweries/urazato/",
        "h1": "Urazato Brewery\n× SAKE ART TOKYO",
        "types": {"WebPage", "Organization", "BreadcrumbList"},
    },
    {
        "path": "breweries/tsuchida/",
        "public": "breweries/tsuchida/",
        "lang": "ja",
        "alternate": "en/breweries/tsuchida/",
        "h1_contains": "土田酒造",
        "types": {"WebPage", "Organization", "BreadcrumbList"},
    },
    {
        "path": "en/breweries/tsuchida/",
        "public": "en/breweries/tsuchida/",
        "lang": "en",
        "alternate": "breweries/tsuchida/",
        "h1": "Tsuchida Brewery\n× SAKE ART TOKYO",
        "types": {"WebPage", "Organization", "BreadcrumbList"},
    },
    {
        "path": "about/chill-labo/",
        "public": "about/chill-labo/",
        "lang": "ja",
        "alternate": "en/about/chill-labo/",
        "h1_contains": "Chill Laboから",
        "types": {"AboutPage", "Brand", "Organization", "BreadcrumbList"},
    },
    {
        "path": "en/about/chill-labo/",
        "public": "en/about/chill-labo/",
        "lang": "en",
        "alternate": "about/chill-labo/",
        "h1_contains": "CHILL LABO",
        "types": {"AboutPage", "Brand", "Organization", "BreadcrumbList"},
    },
    {
        "path": "sake/aroma/",
        "public": "sake/aroma/",
        "lang": "ja",
        "alternate": "en/sake/aroma/",
        "h1": "日本酒の\n香り",
        "types": {"WebPage", "BreadcrumbList"},
    },
    {
        "path": "en/sake/aroma/",
        "public": "en/sake/aroma/",
        "lang": "en",
        "alternate": "sake/aroma/",
        "h1": "Japanese Sake\nAroma",
        "types": {"WebPage", "BreadcrumbList"},
    },
    {
        "path": "sake/oem/",
        "public": "sake/oem/",
        "lang": "ja",
        "alternate": "en/sake/oem/",
        "h1": "オリジナルの\n日本酒をつくる。",
        "types": {"WebPage", "BreadcrumbList"},
    },
    {
        "path": "en/sake/oem/",
        "public": "en/sake/oem/",
        "lang": "en",
        "alternate": "sake/oem/",
        "h1": "Create an\nOriginal Sake.",
        "types": {"WebPage", "BreadcrumbList"},
    },
]

FORBIDDEN_SCHEMA = {"Product", "Offer", "FAQPage"}


def jsonld_nodes(page):
    nodes = []
    for script in page.locator('script[type="application/ld+json"]').all():
        value = json.loads(script.text_content())
        nodes.extend(value.get("@graph", [value]))
    return nodes


def schema_types(nodes):
    result = set()
    for node in nodes:
        value = node.get("@type")
        if isinstance(value, list):
            result.update(value)
        elif value:
            result.add(value)
    return result


def expected_alternates(page, item):
    ja_path = item["public"] if item["lang"] == "ja" else item["alternate"]
    en_path = item["public"] if item["lang"] == "en" else item["alternate"]
    return {
        "ja": urljoin(PUBLIC, ja_path),
        "en": urljoin(PUBLIC, en_path),
        "x-default": urljoin(PUBLIC, ja_path),
    }


def check_metadata(page, item):
    target = urljoin(PUBLIC, item["public"])
    assert page.locator("html").get_attribute("lang") == item["lang"]
    assert page.locator('link[rel="canonical"]').get_attribute("href") == target
    alternates = {
        node.get_attribute("hreflang"): node.get_attribute("href")
        for node in page.locator('link[rel="alternate"][hreflang]').all()
    }
    assert alternates == expected_alternates(page, item), (item["path"], alternates)
    assert page.locator('meta[property="og:url"]').get_attribute("content") == target
    assert page.locator('meta[name="description"]').get_attribute("content")
    assert page.locator('meta[property="og:title"]').get_attribute("content")
    assert page.locator('meta[name="twitter:title"]').get_attribute("content")
    assert page.locator('meta[property="og:image"]').get_attribute("content").startswith(PUBLIC)
    assert page.locator('meta[name="twitter:image"]').get_attribute("content").startswith(PUBLIC)
    assert page.locator("h1").count() == 1
    h1 = page.locator("h1").inner_text().strip()
    if "h1" in item:
        assert h1 == item["h1"], (item["path"], h1)
    else:
        assert item["h1_contains"] in h1, (item["path"], h1)
    types = schema_types(jsonld_nodes(page))
    assert item["types"].issubset(types), (item["path"], types)
    assert not FORBIDDEN_SCHEMA.intersection(types), (item["path"], types)


def check_internal_links(page, item):
    hrefs = page.locator('a[href^="/"]').evaluate_all(
        "nodes => [...new Set(nodes.map(node => node.getAttribute('href')))]"
    )
    assert not any(href.startswith("/playground/") or href.startswith("/en/playground/") for href in hrefs), hrefs
    for href in hrefs:
        split = urlsplit(href)
        if split.path == "/privacy.html" or split.path.endswith("/") or split.path == "/":
            response = page.request.get(urljoin(SITE, split.path.lstrip("/")))
            assert response.ok, (item["path"], href, response.status)


def keyboard_focus_visible(page):
    page.locator("body").click(position={"x": 2, "y": 2})
    page.keyboard.press("Tab")
    focused = page.locator(":focus")
    assert focused.count() == 1
    style = focused.evaluate("el => getComputedStyle(el).outlineStyle")
    assert style != "none", (focused.evaluate("el => el.outerHTML"), style)


def check_sitemap(page):
    response = page.request.get(urljoin(SITE, "sitemap.xml"))
    assert response.ok
    root = ET.fromstring(response.body())
    ns = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    locs = {node.text for node in root.findall("sm:url/sm:loc", ns)}
    expected = {urljoin(PUBLIC, item["public"]) for item in PAGES}
    expected.update({PUBLIC, urljoin(PUBLIC, "en/"), urljoin(PUBLIC, "privacy.html")})
    assert expected.issubset(locs), expected - locs
    assert not any("/playground/" in loc for loc in locs)


def check_homepage_ia(page, english=False):
    page.goto(urljoin(SITE, "en/" if english else ""), wait_until="networkidle")
    prefix = "/en" if english else ""
    assert page.locator(".nav-shop").get_attribute("href") == f"{prefix}/sake/"
    links = page.locator(".source-editorial-links .text-link")
    assert links.count() == 2
    assert links.nth(0).get_attribute("href") == f"{prefix}/breweries/urazato/"
    assert links.nth(1).get_attribute("href") == f"{prefix}/breweries/tsuchida/"
    story = page.locator("#story .story-body .text-link")
    assert story.get_attribute("href") == CHILL_LABO
    assert page.locator(f'a[href="{prefix}/about/chill-labo/"]').count() == 0
    assert page.locator(f'a[href="{prefix}/sake/oem/"]').count() == 0
    aroma = page.locator('#comic figcaption a[href$="/sake/aroma/"]')
    assert aroma.count() == 1
    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth")
    return links


def check_oem_guide_discovery(page, english=False):
    path = "en/sake/" if english else "sake/"
    target = "/en/sake/oem/" if english else "/sake/oem/"
    page.goto(urljoin(SITE, path), wait_until="networkidle")
    link = page.locator(f'.editorial-footer-links a[href="{target}"]')
    assert link.count() == 1
    assert link.inner_text().strip() == "ORIGINAL SAKE"


def run():
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=True)
        try:
            # Full metadata and HTTP crawl at desktop width.
            context = browser.new_context(viewport={"width": 1440, "height": 1000})
            context.add_init_script("localStorage.setItem('sat-age-confirmed','yes')")
            page = context.new_page()
            for item in PAGES:
                response = page.goto(urljoin(SITE, item["path"]), wait_until="networkidle")
                assert response and response.ok, (item["path"], response.status if response else None)
                check_metadata(page, item)
                check_internal_links(page, item)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), item["path"]
                keyboard_focus_visible(page)
            check_sitemap(page)
            check_homepage_ia(page, False)
            check_homepage_ia(page, True)
            check_oem_guide_discovery(page, False)
            check_oem_guide_discovery(page, True)
            page.goto(urljoin(SITE, "sake/"), wait_until="networkidle")
            page.screenshot(path=str(OUT / "sake-desktop-1440.png"), full_page=True)
            page.goto(urljoin(SITE, "sake/aroma/"), wait_until="networkidle")
            page.screenshot(path=str(OUT / "aroma-desktop-1440.png"), full_page=True)
            page.goto(urljoin(SITE, "sake/oem/"), wait_until="networkidle")
            page.screenshot(path=str(OUT / "oem-desktop-1440.png"), full_page=True)
            context.close()

            # iPhone-class touch widths, including the narrow 360 px regression edge.
            for width, height in ((390, 844), (360, 800)):
                context = browser.new_context(
                    viewport={"width": width, "height": height},
                    is_mobile=True,
                    has_touch=True,
                    device_scale_factor=1,
                )
                context.add_init_script("localStorage.setItem('sat-age-confirmed','yes')")
                page = context.new_page()
                for item in PAGES:
                    response = page.goto(urljoin(SITE, item["path"]), wait_until="networkidle")
                    assert response and response.ok
                    assert page.locator("h1").is_visible(), (width, item["path"])
                    assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), (width, item["path"])
                links = check_homepage_ia(page, False)
                for link in links.all():
                    box = link.bounding_box()
                    assert box and box["height"] >= 44, (width, box)
                assert page.evaluate("document.documentElement.scrollWidth <= innerWidth"), width
                page.screenshot(path=str(OUT / f"home-ia-{width}.png"), full_page=False)
                page.goto(urljoin(SITE, "sake/"), wait_until="networkidle")
                page.screenshot(path=str(OUT / f"sake-{width}.png"), full_page=True)
                page.goto(urljoin(SITE, "sake/aroma/"), wait_until="networkidle")
                page.screenshot(path=str(OUT / f"aroma-{width}.png"), full_page=True)
                page.goto(urljoin(SITE, "sake/oem/"), wait_until="networkidle")
                page.screenshot(path=str(OUT / f"oem-{width}.png"), full_page=True)
                page.goto(urljoin(SITE, "about/chill-labo/"), wait_until="networkidle")
                page.screenshot(path=str(OUT / f"chill-origin-{width}.png"), full_page=True)
                context.close()
        finally:
            browser.close()


if __name__ == "__main__":
    run()
