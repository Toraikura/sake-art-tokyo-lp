# HTTP verification — 2026-09-08

This record covers the imported UI in `experiments/after-hours-water/`. The supplied experiment README describes the earlier offline handoff; the HTTP results below were obtained separately on this Mac before commit/push.

## Source and scope

- Import base: `2c91f3f027be84ac41f2a8a6b967eb4f83f8efc6` on `feat/intuitive-play-labels-20260908`; fetched branch and local HEAD matched.
- ZIP SHA-256: `b7f41e875676e68f217fc336249cfc58d71b62b9dc8cabfcee58dd1560afeec3`.
- All 44 entries in the supplied MANIFEST matched SHA-256. All 23 `changes/` files were copied in full and matched that manifest. The final staged whitespace check then found pre-existing trailing whitespace in `site.css`, `site.js` and `test_offline.py`; only line-end/EOF whitespace was normalized in those three files. The other 20 imports remain byte-identical. Supplemental tests and this record are separate additions.
- All 14 previously tracked files outside the import/workflow scope are byte-identical to the starting checkout, including the main LP, other experiment, original product images and comic images.
- Water-rendering function and root palette declarations match the original inline source exactly. Comic markup is unchanged except for equivalent local relative image/link URLs.
- Real label PNGs were supplied, not regenerated. Their downloaded bytes and dimensions are checked against source files.
- Original `sake-clash`, its 75-second edition and existing user records are untouched. Tests use an isolated browser profile and verify record sentinels remain unchanged.
- The obsolete transfer workflow was replaced with read-only verification: no signed payload URL, asset rewrite, automatic commit/push or Pages deployment.

## Executed

Environment: macOS, Node v26.7.0, Python 3.9.6, Playwright 1.57.0, Google Chrome 152.0.7977.76. Mobile checks emulate viewport/touch input; they are not physical iPhone tests.

1. `node --check` on all seven shipped JavaScript files: PASS.
2. `node tests/intuitive/test_controller.cjs`: PASS (mock DOM/transport). Tests origin/window/session checks, result authorization, replay reset, retry, pagehide cleanup and scroll/focus restoration.
3. Local relative resource/anchor checks: PASS (26 references); target anchors exist and are unique.
4. `python tests/intuitive/test_ui.py` against a real loopback HTTP server: PASS. Single-tap iframe launch; timer, tick and CPU frozen until first real deployment; hand selection; natural match; pause/resume; replay; matching parent result message; no automatic redirect; selected SAT 002 detail navigation; browser Back; modal cleanup; restored scroll; record isolation. Touch labels include tap/swipe and vertical-scroll discrimination. Layouts cover 360×640, 375×550, 390×844, 430×932 and 1440×1000.
5. Supplemental `python tests/intuitive/test_http_details.py`: PASS. Real CPU deployment observed; natural 30-second timeout at clock `00`, tick `900`, wall time `30.096s`. Both PNG downloads match source SHA-256 and dimensions (SAT 001: 1506×1859; SAT 002: 1628×1902). Arrow buttons, keyboard, displayed metadata and both detail/back routes pass. All requested images decoded. Game detail/back/reopen and existing-record sentinels pass. Board, hand, close button and result text/control bounds pass at 320px; result screens also pass at 375×550 and 390×844. No application JavaScript errors, failed requests or HTTP response errors; one pre-existing automatic `/favicon.ico` 404 console diagnostic is retained separately in the report.
6. Visual inspection: ready/result/label layouts at 320/390px, corrected poster headline, compact 375×550 game, full-page screenshots at 320/390/1440px, water and final comic. Water, palette and comic preservation also checked against the original source. The supplemental harness initially misclassified intentional line-height glyph overhang as clipping; it was corrected to inspect actual clipping ancestors, then passed without changing production UI.
7. Final staged `git diff --cached --check` and workflow YAML parsing: PASS after normalization of the three supplied whitespace warnings. JavaScript syntax and controller tests were rerun after that normalization; PASS. HTTP-tested executable code and styles are unchanged.

Reproduce from the repository root (server in a separate terminal):

```sh
python3 -m http.server 4190 --bind 127.0.0.1
# In a Python environment with playwright==1.57.0 and an installed Chromium:
node tests/intuitive/test_controller.cjs
python tests/intuitive/test_ui.py
EVIDENCE_DIR=evidence/details python tests/intuitive/test_http_details.py
```

`BASE_URL` overrides the experiment URL. `PLAYWRIGHT_EXECUTABLE_PATH` may select an existing Chrome/Chromium. Install the default test browser with `python -m playwright install chromium`. No npm build is required for this static page.

## Limits and publication

- Physical iPhone Safari, iOS Photos/Files saving, third-party first-use usability and game-balance evaluation: NOT TESTED.
- The supplied offline evidence was inspected as handoff evidence, not counted as a new HTTP or physical-device run.
- Source-image paper-pixel fidelity and upstream TypeScript equivalence were reported in the supplied handoff; this run verifies the supplied file hashes and browser downloads rather than claiming a new comparison against unavailable original label masters.
- The GitHub Pages configuration serves `main` from `/`. This work targets the named feature branch only. Branch push is not Pages publication; no main merge or Pages deployment is authorized or performed here.
