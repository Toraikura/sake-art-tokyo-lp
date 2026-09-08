# SAKE ART TOKYO — brand hub proposal

Review branch: `design/quiet-brand-qr-20260907`. Do not merge or deploy without owner approval and the live-device checks below. The published `main` and original Playground are unchanged.

## Structure

- `index.html`: quiet brand homepage, collection and optional per-bottle QR view.
- `assets/site.css`: existing paper / tomato / basil palette, simplified layout.
- `assets/site.js`: age confirmation, validated QR selection, navigation and memory-only event hooks.
- `assets/site-config.js`: public destination URLs; no secrets.
- `play/index.html`: temporary frame-based Playground wrapper with a permanent return-to-product link.
- `privacy.html`: describes this implementation, not a claim of legal review.
- Existing image files stay unchanged.

## Preview

Serve the repository root with any static server, for example `python3 -m http.server 8000`.

- `/`: brand homepage.
- `/?bottle=sat-001&utm_source=label&utm_medium=qr`: SAT 001 QR entry.
- `/?bottle=sat-002&utm_source=label&utm_medium=qr`: SAT 002 QR entry.
- `/play/?bottle=sat-001`: Playground wrapper retaining a route back to the bottle.

These are proposed paths, NOT newly printed QR destinations. Confirm what the existing labels actually encode before migration. Do not add `utm_source=chatgpt.com` to printed labels.

Only SAT 001, SAT 002 and SAT 003 are presented. SAT 003 is Coming soon only: no region, category, brewery, date or fourth product announcement.

## Release blockers

Product-specific purchase URLs, a registration / feedback provider, analytics collection, the original Playground source and live iPhone testing are still outstanding. The links currently lead to the existing shop, not an unverified equivalent product. See `docs/REVIEW.md` for architecture, evidence and rollout checks.
