"""Exercise real page controls and record mobile WebKit overlay/viewport state.

This runs desktop WebKit with mobile viewport, touch and iPhone user-agent
emulation. It cannot emulate iOS Safari's native toolbar/compositor itself.
Use an immutable baseline HTTP server when other agents are changing the site.
"""
import json
import os
from pathlib import Path
import traceback
from urllib.parse import urljoin

from playwright.sync_api import sync_playwright

BASE = os.environ.get("BASE_URL", "http://127.0.0.1:4213/")
OUT = Path(os.environ.get("EVIDENCE_DIR", "/private/tmp/sat-overlay-webkit"))
OUT.mkdir(parents=True, exist_ok=True)
EXPECT_STATIC_MOBILE = os.environ.get("EXPECT_STATIC_MOBILE", "1") == "1"
report = {"base": BASE, "status": "running", "states": [], "errors": [], "httpErrors": [],
          "expectStaticMobileHeader": EXPECT_STATIC_MOBILE,
          "limitation": "Desktop WebKit mobile viewport/touch/UA emulation; not native iOS Safari toolbar/compositor or physical device"}
IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1"


def capture(page, name):
    page.wait_for_timeout(250)
    state = page.evaluate("""() => {
      const rect = el => { const b=el.getBoundingClientRect(); return {x:b.x,y:b.y,width:b.width,height:b.height,bottom:b.bottom}; };
      const description = el => {
        if (!el) return null;
        const s=getComputedStyle(el);
        return {tag:el.tagName,id:el.id,class:typeof el.className==='string'?el.className:'',
          rect:rect(el),position:s.position,display:s.display,visibility:s.visibility,
          opacity:s.opacity,zIndex:s.zIndex,background:s.backgroundColor,
          transform:s.transform,filter:s.filter,backdropFilter:s.backdropFilter,
          overflowX:s.overflowX,overflowY:s.overflowY};
      };
      const intersects=el => {const b=el.getBoundingClientRect();const s=getComputedStyle(el);
        return s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity)>0&&b.width>0&&b.height>0&&b.x<innerWidth&&b.bottom>0&&b.y<innerHeight;};
      const layers=[...document.querySelectorAll('*')].filter(el=>{
        const p=getComputedStyle(el).position;return (p==='fixed'||p==='sticky')&&intersects(el);
      }).map(description);
      const hits=[];
      for (const yf of [.58,.67,.78,.9,.99]) for (const xf of [.02,.5,.98]) {
        const x=Math.min(innerWidth-1,innerWidth*xf),y=Math.min(innerHeight-1,innerHeight*yf);
        const el=document.elementFromPoint(x,y),chain=[];
        for (let p=el;p;p=p.parentElement) chain.push(description(p));
        hits.push({x,y,chain});
      }
      return {url:location.href,scrollX,scrollY,innerWidth,innerHeight,outerWidth,outerHeight,
        screen:{width:screen.width,height:screen.height},
        document:{clientWidth:document.documentElement.clientWidth,clientHeight:document.documentElement.clientHeight,
          scrollWidth:document.documentElement.scrollWidth,scrollHeight:document.documentElement.scrollHeight},
        visualViewport:visualViewport?{width:visualViewport.width,height:visualViewport.height,
          offsetTop:visualViewport.offsetTop,offsetLeft:visualViewport.offsetLeft,
          pageTop:visualViewport.pageTop,pageLeft:visualViewport.pageLeft,scale:visualViewport.scale}:null,
        body:{style:document.body.getAttribute('style'),...description(document.body)},
        html:description(document.documentElement),header:description(document.querySelector('.site-header')),
        coarse:matchMedia('(hover: none) and (pointer: coarse)').matches,layers,hits,
        dialogs:[...document.querySelectorAll('dialog')].map(el=>({open:el.open,...description(el)})),
        lifecycle:window.__satOverlayLifecycle||[]};
    }""")
    state["name"] = name
    report["states"].append(state)
    page.screenshot(path=str(OUT / (name + ".png")))
    print(name, "scroll", round(state["scrollY"]), "viewport", state["innerHeight"],
          "layers", [(item["id"] or item["class"], item["rect"]) for item in state["layers"]], flush=True)


def run():
    with sync_playwright() as playwright:
        browser = playwright.webkit.launch(headless=True)
        report["browserVersion"] = browser.version
        try:
            for language, width in (("ja", 390), ("en", 375)):
                context = browser.new_context(viewport={"width": width, "height": 844},
                    is_mobile=True, has_touch=True, device_scale_factor=1, user_agent=IPHONE)
                context.add_init_script("""window.__satOverlayLifecycle=[];
                  for(const type of ['pageshow','pagehide','resize','orientationchange'])
                    window.addEventListener(type,e=>window.__satOverlayLifecycle.push({
                      type,persisted:e.persisted,time:Date.now(),height:innerHeight,scrollY}));
                  Object.defineProperty(navigator,'share',{value:undefined,configurable:true});
                  Object.defineProperty(navigator,'canShare',{value:undefined,configurable:true});""")
                page = context.new_page(); page.set_default_timeout(20000)
                page.on("pageerror", lambda error: report["errors"].append(str(error)))
                page.on("response", lambda response: report["httpErrors"].append({"url":response.url,"status":response.status}) if response.status >= 400 else None)
                prefix = f"{language}-{width}"
                url = urljoin(BASE, "en/" if language == "en" else "./")
                try:
                    response=page.goto(url, wait_until="networkidle")
                    assert response is not None and response.status == 200, (url, 'No HTTP 200 document; verify server and WebKit-safe port')
                    capture(page, prefix + "-age-open")
                    page.locator("#age-yes").tap(); capture(page, prefix + "-age-closed")
                    for selector in ("#bottles", "#play", "#labels", "#comic"):
                        page.locator(selector).scroll_into_view_if_needed(); page.wait_for_timeout(400)
                        capture(page, prefix + "-scroll-" + selector[1:])
                    page.locator("#labels").scroll_into_view_if_needed()
                    for height in (650, 844):
                        page.set_viewport_size({"width":width,"height":height})
                        capture(page, prefix + f"-toolbar-resize-{height}")
                    page.locator(".play-launch").tap()
                    page.wait_for_function("document.querySelector('#play-loading').hidden")
                    capture(page, prefix + "-game-open")
                    page.set_viewport_size({"width":width,"height":650})
                    capture(page, prefix + "-game-resize-650")
                    page.locator("#close-play").tap(); capture(page, prefix + "-game-closed-short")
                    page.set_viewport_size({"width":width,"height":844})
                    page.locator("#comic").scroll_into_view_if_needed()
                    capture(page, prefix + "-game-closed-long-scroll")
                    page.locator("#privacy-open").tap(); capture(page, prefix + "-privacy-open")
                    page.locator("#policy-close").tap(); capture(page, prefix + "-privacy-closed")
                    page.locator("#save-label").tap()
                    page.locator("#label-save-dialog").wait_for(state="visible")
                    page.locator("#label-save-image").evaluate("image => image.decode()")
                    capture(page, prefix + "-photo-open")
                    page.set_viewport_size({"width":width,"height":650})
                    page.locator(".label-save-close").tap()
                    capture(page, prefix + "-photo-closed-short")
                    page.set_viewport_size({"width":width,"height":844})
                    page.locator("#comic").scroll_into_view_if_needed()
                    capture(page, prefix + "-photo-closed-long-scroll")
                    page.locator("#label-details").tap(); capture(page, prefix + "-label-detail")
                    page.go_back(wait_until="load"); capture(page, prefix + "-label-history-back")
                    other = page.locator('a[hreflang="' + ("ja" if language == "en" else "en") + '"]').first
                    other_url = urljoin(page.url, other.get_attribute("href"))
                    other.tap(); page.wait_for_url(other_url, wait_until="networkidle")
                    page.go_back(wait_until="load"); capture(page, prefix + "-document-history-back")
                    page.locator("#bottles").scroll_into_view_if_needed(); capture(page, prefix + "-final-scroll")
                except Exception:
                    report["errors"].append({"scenario":prefix,"failure":traceback.format_exc()})
                    try: capture(page, prefix + "-failure")
                    except Exception: pass
                finally:
                    context.close()
            context = browser.new_context(viewport={"width":1440,"height":1000})
            page = context.new_page()
            page.on("pageerror", lambda error: report["errors"].append(str(error)))
            page.on("response", lambda response: report["httpErrors"].append({"url":response.url,"status":response.status}) if response.status >= 400 else None)
            try:
                page.goto(BASE,wait_until="networkidle")
                page.locator('#age-yes').click()
                page.locator('#bottles').scroll_into_view_if_needed()
                capture(page,'desktop-1440-scrolled')
                header=report['states'][-1]['header']
                assert header['position']=='sticky' and abs(header['rect']['y'])<1,header
            except Exception:
                report['errors'].append({'scenario':'desktop','failure':traceback.format_exc()})
            finally:
                context.close()
        finally:
            browser.close()
    report["unexpectedClosedDialogs"] = [
        {"state":state["name"],"dialog":item}
        for state in report["states"] for item in state["dialogs"]
        if not item["open"] and item["display"] != "none" and item["rect"]["width"] > 0 and item["rect"]["height"] > 0
    ]
    report["largeFixedBottomLayers"] = [
        {"state":state["name"],"layer":item}
        for state in report["states"] for item in state["layers"]
        if item["position"] == "fixed" and item["rect"]["width"] >= state["innerWidth"] * .9
        and item["rect"]["height"] >= 150 and item["rect"]["y"] > state["innerHeight"] * .45
    ]
    for state in report['states']:
        if state['name'].endswith('-failure'): continue
        if not any(dialog['open'] for dialog in state['dialogs']):
            if state['body']['position']=='fixed' or state['body']['overflowY']=='hidden':
                report['errors'].append({'state':state['name'],'reason':'Page remains locked after the dialog closes','body':state['body']})
            unexpected=[layer for layer in state['layers'] if layer['position']=='fixed']
            if unexpected:
                report['errors'].append({'state':state['name'],'reason':'Unexpected fixed content layer with no open dialog','layers':unexpected})
        if EXPECT_STATIC_MOBILE and not state['name'].startswith('desktop'):
            if not state['coarse'] or state['header']['position'] not in ('relative','static'):
                report['errors'].append({'state':state['name'],'reason':'Mobile header still uses a fixed/sticky layer','header':state['header']})
            if state['scrollY']>100 and not any(dialog['open'] for dialog in state['dialogs']) and state['header']['rect']['bottom']>=0:
                report['errors'].append({'state':state['name'],'reason':'Mobile header did not scroll away','header':state['header']})
    if report['unexpectedClosedDialogs'] or report['largeFixedBottomLayers']:
        report['errors'].append({'reason':'Unexpected visible closed dialog or large fixed bottom layer'})
    if report['httpErrors']:
        report['errors'].append({'reason':'HTTP errors encountered','responses':report['httpErrors']})
    report["status"] = "PASS" if not report["errors"] else "FAIL"


try:
    run()
finally:
    (OUT / "results.json").write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"status":report["status"],"states":len(report["states"]),
    "errors":report["errors"],"closedDialogs":report.get("unexpectedClosedDialogs"),
    "largeFixedBottomLayers":report.get("largeFixedBottomLayers"),"evidence":str(OUT)},ensure_ascii=False,indent=2))
assert report['status']=='PASS', 'WebKit overlay regression failed; see results.json'
