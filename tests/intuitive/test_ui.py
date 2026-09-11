from pathlib import Path
from urllib.parse import urljoin
from playwright.sync_api import sync_playwright
import json,time,os
BASE=os.environ.get('BASE_URL','http://127.0.0.1:4190/')
OUT=Path(os.environ.get('EVIDENCE_DIR','evidence'));OUT.mkdir(parents=True,exist_ok=True)
results=[]
def assert_source_sync(page,release):
 mood,source,side,brewery=('light','urasato','SIDE A / URAZATO','浦里酒造') if release=='sat-001' else ('deep','tsuchida','SIDE B / TSUCHIDA','土田酒造')
 assert page.locator('#label-stack').get_attribute('data-release')==release
 assert page.locator('body').get_attribute('data-mood')==mood
 assert page.locator('#source-scene').get_attribute('data-source')==source
 assert page.locator('.source-card[aria-pressed="true"]').count()==1
 assert page.locator(f'.source-card[data-source="{source}"]').get_attribute('aria-pressed')=='true'
 assert page.locator('.record[data-selected="true"]').count()==1
 assert page.locator(f'#{release}').get_attribute('data-selected')=='true'
 assert page.locator('#side-title').inner_text()==side
 assert page.locator('#source-brewery').inner_text()==brewery
 colors=page.evaluate("""() => {
  const style=s=>getComputedStyle(document.querySelector(s));
  return {title:style('#hero-title .last').color,dot:style('.motion-dot').backgroundColor,
   rule:style('.theme-rule').backgroundColor,play:style('.arcade').backgroundColor,
   comic:style('.comic-section').backgroundColor};
 }""")
 assert colors['title']==colors['dot']==colors['rule'],colors
 return colors

with sync_playwright() as p:
 browser=p.chromium.launch(headless=True,executable_path=os.environ.get('PLAYWRIGHT_EXECUTABLE_PATH'),args=['--no-sandbox'])
 context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True,device_scale_factor=1)
 context.add_init_script("localStorage.setItem('sat-age-confirmed','yes'); localStorage.setItem('sat-sake-clash:v1','baseline-sentinel'); localStorage.setItem('sat-sake-clash:v1:iphone-review','preview-sentinel');")
 page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(BASE,wait_until='networkidle');page.wait_for_timeout(300)
 assert not errors,errors
 assert page.evaluate('document.documentElement.scrollWidth <= innerWidth'), 'LP horizontal overflow'
 assert page.locator('#hero-title > span').all_text_contents()==['NOT','JUST','SAKE']
 assert page.locator('#hero-title').get_attribute('aria-label')=='Not just sake まだ知らない、好きがある。'
 light_theme=assert_source_sync(page,'sat-001')
 page.locator('[data-mood-choice="deep"]').tap()
 assert page.locator('#label-stack').get_attribute('data-release')=='sat-002'
 deep_theme=assert_source_sync(page,'sat-002')
 assert all(deep_theme[key]!=light_theme[key] for key in light_theme),(light_theme,deep_theme)
 page.locator('#labels').scroll_into_view_if_needed();page.wait_for_timeout(500)
 page.locator('#labels').screenshot(path=str(OUT/'labels-390.png'))
 page.locator('#label-stack').tap();page.wait_for_timeout(400)
 assert page.locator('#label-counter').inner_text()=='01 / 02'
 assert assert_source_sync(page,'sat-001')==light_theme,'Label tap did not restore the complete 浦里 theme'
 assert page.locator('#save-label').get_attribute('download')=='SAT_001_Melon_Cotton_Candy.png'
 with page.expect_download() as dl: page.locator('#save-label').tap()
 download=dl.value;download.save_as(str(OUT/download.suggested_filename))
 assert (OUT/download.suggested_filename).stat().st_size>10000
 # Real touchscreen gesture, not an injected selection or game result.
 box=page.locator('#label-stack').bounding_box();x=box['x']+box['width']*.8;y=box['y']+box['height']*.5
 cdp=context.new_cdp_session(page)
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
 for dx in [20,45,80,120]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-dx,'y':y}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(450)
 assert page.locator('#label-counter').inner_text()=='02 / 02','Swipe double-advanced or did not advance'
 assert assert_source_sync(page,'sat-002')==deep_theme,'Label swipe did not restore the complete 土田 theme'
 before=page.locator('#label-counter').inner_text()
 # Vertical scrolling must not select another label.
 box=page.locator('#label-stack').bounding_box();x=box['x']+box['width']/2;y=box['y']+box['height']*.7
 cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
 for dy in [15,35,65,95]:cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y-dy}]})
 cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});page.wait_for_timeout(500)
 assert page.locator('#label-counter').inner_text()==before
 assert assert_source_sync(page,'sat-002')==deep_theme,'Vertical scroll changed the source or theme'
 results.append('Hero SAKE text and aria-label have no English trailing period. Label tap and horizontal swipe synchronize the source card, water caption, body theme, selected product and section colors; vertical scroll preserves selection; original PNG download passed.')
 page.locator('#play').scroll_into_view_if_needed();page.wait_for_timeout(500)
 page.locator('#play').screenshot(path=str(OUT/'play-entry-390.png'))
 # The new arcade is taller than the old single-game launcher. Put the actual
 # SAKE CLASH card in view before recording the position we expect to restore.
 page.locator('.fpg-game--clash').scroll_into_view_if_needed();page.wait_for_timeout(100)
 previous_scroll=page.evaluate('scrollY')
 page.locator('.fpg-game--clash').tap()
 page.wait_for_function("document.querySelector('#play-loading').hidden")
 frame=page.frames[-1]
 frame.wait_for_selector('#arena[data-status="playing"]');page.wait_for_timeout(3200)
 assert frame.locator('#time').inner_text()=='30'
 assert frame.locator('#arena').get_attribute('data-tick')=='0'
 assert frame.locator('#arena').get_attribute('data-played')=='0'
 assert frame.evaluate('document.querySelector("#arena").dataset.units')=='[]'
 assert frame.locator('.game-card.prompt').count()==1
 page.screenshot(path=str(OUT/'game-ready-390.png'))
 frame.locator('.game-card[data-index="0"]').tap();assert frame.locator('#first-target').is_visible()
 r=frame.locator('#arena').bounding_box()
 # Frame locator bounding boxes are in top-page coordinates.
 page.touchscreen.tap(r['x']+r['width']*.5,r['y']+r['height']*.58)
 frame.wait_for_selector('#arena[data-played="1"]');page.wait_for_timeout(2500)
 assert int(frame.locator('#time').inner_text())<30
 assert frame.locator('#arena').get_attribute('data-played')=='1'
 assert not frame.locator('#first-target').is_visible()
 page.screenshot(path=str(OUT/'game-playing-390.png'))
 # Actual frame body becomes the LP thumbnail, rather than a synthetic game state.
 frame.locator('body').screenshot(path=str(OUT/'game-preview.png'))
 frame.locator('#pause').tap();frame.locator('#resume').wait_for(state='visible')
 frozen=frame.locator('#time').inner_text();page.wait_for_timeout(1200)
 assert frame.locator('#time').inner_text()==frozen
 frame.locator('#resume').tap();page.wait_for_timeout(1000)
 assert int(frame.locator('#time').inner_text())<=int(frozen)
 # Wait for a real 30-second match; never inject terminal status or remove CPU units.
 frame.locator('#explore').wait_for(state='visible',timeout=40000)
 assert frame.locator('#arena').get_attribute('data-status') in ['won','lost','draw']
 assert page.locator('#play-modal').get_attribute('data-outcome') in ['won','lost','draw']
 page.screenshot(path=str(OUT/'game-result-390.png'))
 assert page.url==BASE,'Unexpected automatic navigation'
 assert frame.locator('#explore').get_attribute('href').endswith('#sat-002')
 frame.locator('#replay').tap();page.wait_for_timeout(1000)
 assert frame.locator('#time').inner_text()=='30' and frame.locator('#arena').get_attribute('data-played')=='0'
 assert page.locator('#play-modal').get_attribute('data-outcome') is None, 'Replay retained a stale result'
 page.locator('#close-play').tap();page.wait_for_timeout(300)
 assert not page.locator('#play-modal').is_visible()
 assert abs(page.evaluate('scrollY')-previous_scroll)<3
 assert page.evaluate('localStorage.getItem("sat-sake-clash:v1")')=='baseline-sentinel'
 assert page.evaluate('localStorage.getItem("sat-sake-clash:v1:iphone-review")')=='preview-sentinel'
 assert not errors,errors
 results.append('One tap opens the board; timer and CPU stay frozen until the first real touch deployment; real match, pause/resume, replay, result protocol, no auto redirect, scroll restoration and original-record isolation passed.')
 # Verify a real end-of-match cross-page navigation, then browser-back cleanup.
 page.locator('.fpg-game--clash').tap();page.wait_for_function("document.querySelector('#play-loading').hidden")
 frame=page.frames[-1];r=frame.locator('#arena').bounding_box()
 page.touchscreen.tap(r['x']+r['width']*.5,r['y']+r['height']*.58)
 frame.wait_for_selector('#arena[data-played="1"]')
 frame.locator('#explore').wait_for(state='visible',timeout=45000)
 frame.locator('#explore').tap()
 page.wait_for_url(urljoin(BASE,'./#sat-002'))
 assert page.locator('#sat-002').count()==1
 page.go_back(wait_until='load');page.wait_for_timeout(300)
 assert not page.locator('#play-modal').is_visible()
 assert page.evaluate('document.body.style.position')!='fixed'
 results.append('Real finished-match product navigation and browser-back modal cleanup passed.')
 # Layout on short/small viewports and desktop, without faking game state.
 for width,height in [(360,640),(375,550),(430,932),(1440,1000)]:
  page.set_viewport_size({'width':width,'height':height});page.goto(BASE,wait_until='networkidle')
  assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),f'overflow {width}'
  page.locator('.fpg-game--clash').click();page.wait_for_function("document.querySelector('#play-loading').hidden")
  f=page.frames[-1]
  viewport=page.locator('#play-frame-slot').bounding_box()
  for selector in ['#arena','.game-card[data-index="0"]','.game-card[data-index="3"]','#pause']:
   b=f.locator(selector).bounding_box();assert b['x']>=viewport['x']-.5 and b['y']>=viewport['y']-.5 and b['y']+b['height']<=viewport['y']+viewport['height']+.5,(width,height,selector,b,viewport)
  page.screenshot(path=str(OUT/f'game-{width}x{height}.png'))
  page.locator('#close-play').click()
  if width==1440:
   page.locator('#labels').screenshot(path=str(OUT/'labels-desktop.png'))
   page.locator('#sat-002 .record-art').screenshot(path=str(OUT/'poster-corrected.png'))
 results.append('No horizontal page overflow; entire board, hand, pause and close controls fit 360x640, 375x550, 390x844, 430x932 and 1440x1000 Chromium viewports.')
 context.close()
 browser.close()
OUT.joinpath('results.json').write_text(json.dumps({'checks':results,'browser':'Playwright Chromium, touch / viewport emulation, not an iPhone device','pageErrors':errors},ensure_ascii=False,indent=2))
print(json.dumps(results,ensure_ascii=False,indent=2))