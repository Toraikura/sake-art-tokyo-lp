# SAT performance measurement

The age dialog is an overlay on the actual home page. A 100 in PageSpeed Insights
describes a navigation in that initial state; it does not measure every later
tap, scroll, water interaction, or game. Keep the age gate; do not add a special
Lighthouse bypass to production.

## Repeatable measurements

Use a disposable browser and separate **age state** from **HTTP cache state**.
`measure.mjs` measures an unconfirmed visitor and a synthetic confirmed visitor.
It clears the HTTP cache immediately before each navigation while retaining only
the test's age-confirmation state. Lighthouse mode runs each state three times.

Install measurement tools outside this static site's publication directory:

```sh
npm install --prefix /tmp/sat-performance-tools lighthouse@13.4.1 puppeteer-core@24
cp tests/performance/measure.mjs /tmp/sat-performance-tools/measure.mjs
export CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
node /tmp/sat-performance-tools/measure.mjs https://sakearttokyo.com/ /tmp/sat-lighthouse lighthouse
node /tmp/sat-performance-tools/measure.mjs https://sakearttokyo.com/ /tmp/sat-resources resources
```

Use the installed Chrome path on other operating systems. Run one measurement
at a time. Compare the same Chrome, machine, viewport, and throttling settings.
The harness uses 390 × 844, DPR 1; Lighthouse uses its simulated mobile network
and 4× CPU throttling. Resource mode is an unthrottled cold reload, waits for
network quiet and another five seconds, then samples five seconds of idle CPU.
Lighthouse JSON reports and raw request inventories are retained in the output.
Report medians **and ranges** for the three Lighthouse runs. This local/CLI result
is not a Google PSI run or real visitor Core Web Vitals.

Lighthouse's full-page screenshot can fetch additional lazy images; its total
payload is not interchangeable with the initial-viewport resource sample.
Audio is shuffled, so the selected two clips make confirmed-state bytes vary.
Do not describe the whole site as having the initial viewport's transfer size.

For entry clicks and subsequent interactions, use the real controls in the
browser's Performance recorder and run the regression suites. LCP stops updating
after the first interaction, so it cannot stand in for click-to-water readiness
or runtime responsiveness. Physical iPhone Safari and field INP require separate
validation.

## 2026-09-11 change

Baseline: `959d8df8b1fc93f23b0ccec9dc971373d73f5f75`; its root HTML matched
the live independent domain before editing.

| Cold initial viewport / local Chrome | Before | After |
| --- | ---: | ---: |
| Age dialog open | 670,134 B / 27 requests | 358,464 B / 16 requests |
| Confirmed, water visible | 669,819 B / 27 requests | 423,409 B / 18 requests |
| Two source-card assets | 176,032 B | 89,660 B |

The confirmed resource sample decreased 36.8%; the gate sample decreased 46.5%.
These are one resource capture per state under identical conditions, not PSI
scores or guaranteed transfer sizes for every device/session.

- Source cards: derive only the original SVG viewBox crop from the two original
  1122 × 1402 PNGs (Urazato: y=340; Tsuchida: y=430; crop 1122 × 640), resize to
  600 × 342 with Lanczos, and encode WebP quality 90 / method 6. Preserve the SVG
  coordinates and original assets. The two new files are 14,494 and 75,166 bytes.
- Water audio: warm only the next two clips after entry, while visible, in the
  foreground, and enabled; replenish after gestures. Preserve the shuffle bag,
  original audio, synchronous gesture playback, two voices, and credits.
- Arcade: keep layout/CSS and links ready immediately; load the three original
  preview images within 600px of the section. Actual games remain click-to-load.
- Home page scripts and preview CSS get matching JA/EN cache-version updates.

The pre-change live domain already scored 98–100 in all six Lighthouse runs.
Score chasing is not the purpose of this change. Local cold accepted-state
scores were 91/91/99 before and 99/98/99 after; synthetic local timings must not
be presented as measured production speedups.

## Regression coverage

`test_loading.py` checks JA/EN gate requests, the two-clip warm budget, loading
the actual previews when approaching the arcade, no eager iframe, and overflow.
`tests/living-integration/test_sound_loading.cjs` checks lifecycle transitions,
shuffle/no-repeat behavior, queued work cancellation, OFF, and two voice reuse.
Both run in production verification alongside the existing source/water,
label/download, actual game, English, SEO, and WebKit suites.

Primary references:
- [Google: consent UI and measurement state](https://web.dev/articles/cookie-notice-best-practices)
- [Lighthouse user flows](https://web.dev/articles/lighthouse-user-flows)
- [LCP and user input](https://web.dev/articles/lcp)
- [Lighthouse performance scoring](https://developer.chrome.com/docs/lighthouse/performance/performance-scoring)
