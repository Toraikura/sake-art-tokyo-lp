# Sake Art Tokyo Brand LP

Static preview package for GitHub Pages.

## Files

- `index.html`
- `assets/images/urazato-melon-cotton-candy.png`
- `assets/images/tsuchida-chocolate-banana-muffin.png`
- `assets/images/sake-style-comic.png`

## Notes

This is a visual mock / art direction preview. Product details, license information, prices, and sales conditions must be confirmed before public release.

## Automatic Instagram feed

The Chill Labo panel reads `assets/data/instagram-feed.json`. GitHub Actions runs daily at 02:00 JST (`17:00 UTC`), fetches the latest three posts through the official Instagram API, stores the images in this repository, and requests a Pages rebuild.

### One-time Meta setup

1. Use an Instagram Professional account (Business or Creator) for `@chilllabotokyo`.
2. Create a Meta app and enable **Instagram API with Instagram Login**.
3. Authorize the managed account with `instagram_business_basic` and obtain its Instagram User ID and access token.
4. Add these GitHub Actions secrets to `Toraikura/sake-art-tokyo-lp`:
   - `INSTAGRAM_USER_ID`
   - `INSTAGRAM_ACCESS_TOKEN`
5. Run **Update Instagram feed** once from the repository's Actions tab.

Never place the access token in `index.html`, JavaScript shipped to the browser, or a committed file. Renew or replace the token before the expiry reported by Meta.
