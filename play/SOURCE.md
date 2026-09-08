# SAKE CLASH / LP quick experience

Engine source: Toraikura/sake-clash, iPhone preview commit `9e391336f4b4dceee217289cc1100e5a1d55885a`.

`model.js`, `preview.js`, `render.js`, and the shared glyph drawing in `art.js` are TypeScript-transpiled copies from that commit. The LP copy changes DURATION from 75 to 30. The unused React card component/import is omitted. Other engine coefficients remain unchanged. `game.js`, `index.html`, and `game.css` are the new LP-only UI. Opponent: practice CPU, sokujo, rush deck. No persistence, tracking, payments, or accounts.

The original sake-clash repository and both existing game URLs are unchanged. This is a deliberately isolated version, not a new default of the full game. Update the upstream pin and retest explicitly before syncing future engine changes.

The timer and CPU do not tick before the first successful deployment. Outcome is determined by the real engine; victories and scores are never fabricated. No relationship to product taste or drinking safety is inferred.
