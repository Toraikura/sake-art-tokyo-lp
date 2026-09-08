# AFTER HOURS — intuitive UI update / 2026-09-08

## Scope

Changes are confined to `experiments/after-hours-water/` and `tests/intuitive/`.
The main LP, the other AFTER HOURS experiment, original product files, the final comic, and the original SAKE CLASH repository are not replaced.
The original water-surface renderer is retained. No ads, accounts, analytics SDKs, or new dependencies are added to the shipped page.

## Play

A single PLAY GAME click opens the viewport-sized game dialog. There is no settings page or second Start button. The LP-only game uses the pinned iPhone engine documented in `play/SOURCE.md`, with a 30-second duration and practice CPU. The first card is highlighted, then a visible deployment target appears. The timer and CPU do not advance before a successful user deployment; a direct first board tap can also deploy the starter card.

Results come from the real engine. Results expose an explicit product/producer link and Replay; there is no automatic redirect or taste inference. The parent validates the exact message origin, child window and session. Replay clears the prior result authorization. Closing restores scroll/focus. Pagehide cleans up the modal; returning to a standalone game through the history cache remains paused until resumed. No game records are read or written.

## Label collection

The supplied real label artwork replaces the generated-art souvenir. Only the black padding outside the paper has been removed; PNG downloads retain the original paper pixels. WebP images are separate display previews. A tap, horizontal swipe, arrow button or keyboard arrow turns the sleeve. Vertical page scrolling does not change the selection; there is no autoplay. Mobile order is heading → sleeves/current product → save/detail actions.

Edit the `label-releases` JSON block in `index.html` to add a product. Each entry needs a unique `id`, `name`, `jp`, `brewery`, `image`, `download`, `filename`, and `detail`. At most three sleeves are rendered visibly. Counter, download filename, artwork and details update together. Make sure the destination product anchor exists; do not publish a fake third release as part of testing. The initial and subsequent top-of-page mood selections synchronize into the collection.

## Poster correction

`assets/tsuchida-poster-fixed.jpg` fixes the clipped top-right headline in the actual source image. Its product bottle and label are not regenerated. `object-fit: contain` keeps the corrected image visible without cropping. Original source product files are preserved outside this experiment. The unrelated regenerated square poster is NOT used.

## Verification

Static delivery does not require npm or a build step. Node checks syntax and controller unit tests:

```sh
find experiments/after-hours-water -name '*.js' -exec node --check {} \;
node tests/intuitive/test_controller.cjs
```

Use Python Playwright 1.57.0 and Chromium for the HTTP browser checks. In separate terminals, from the repository root:

```sh
python -m http.server 4190 --bind 127.0.0.1
python tests/intuitive/test_ui.py
```

`BASE_URL` optionally overrides the HTTP test URL. `PLAYWRIGHT_EXECUTABLE_PATH` optionally selects an existing Chromium; otherwise install Playwright's Chromium normally. `test_offline.py` offers component-only checks where browser navigation is blocked. It inlines assets/styles and bundles modules without changing game logic. It does NOT substitute for same-origin iframe, real downloads, navigation or deployment verification.

The supplied evidence records completed offline component browser tests, controller unit tests and source fidelity checks. Actual HTTP E2E and physical iPhone Safari have NOT been completed in this environment; finish HTTP E2E before pushing a release. Report device testing separately. Do not mark a blocked HTTP run as passed.
