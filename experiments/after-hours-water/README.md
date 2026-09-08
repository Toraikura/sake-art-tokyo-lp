# AFTER HOURS — source-card UI / 2026-09-08

## Scope

The working branch is `codex/source-water-20260908`. The reviewed source-card UI lives at `experiments/after-hours-water/`; the older `after-hours-source/` URL redirects here while preserving its query and hash. No new experiment page is added. Main and the currently published Pages deployment stay unchanged until publication is authorized.

The main LP, original products, real labels, final comic, original SAKE CLASH repository, 75-second game and existing records are preserved. The existing water renderer and the canonical 30-second game/controller are retained. No new runtime dependency or animation loop is added.

## 水源カードだけで選ぶ

- 右側上部に浦里・土田のカードを横並びで配置。PCは各174×約99px、390pxは各159×約91px、375pxは各153×約87px。選択中は細枠・丸印・明度差で表示します。
- 浦里は筑波山・田園・霧、土田は森・岩・湧水・石鉢とししおどしが見える構図。提供PNGの画素を変更せず、SVGの表示範囲で切り取っています。カードの絵はイラストであり、実際の取水地点を検証した資料ではありません。
- カードと水面をつなぐSVG・膜・ストローク・座標計算・専用スクリプトは削除しました。カード選択では大きな波紋も発生しません。水面そのものの既存アニメーション・タップ波紋は維持します。
- 選択は水面色、SIDE、蔵名、短い情景文、商品CTA、商品表示、エチケット、ゲーム結果の商品案内へ連動します。CTA文言は両方「この蔵の一本へ」。旧「軽やかに／濃密に」の選択UIはありません。
- 浦里: `SIDE A / URAZATO`、浦里酒造、「霧の向こう、澄んだ余韻。」。
- 土田: `SIDE B / TSUCHIDA`、土田酒造、「森の奥、湧き出す深み。」。
- ヒーロー左下は両方 `SAKE ART TOKYO from CHILL LABO`。ブランド・URAZATOの表示表記を統一しています。
- スマホではコピー・CTA・ブランド、カード、水面の順。見出しの切れと横はみ出しを防ぎ、カードと水面は別々の操作対象にしています。
- `prefers-reduced-motion` と手動停止では追加のカード遷移も停止します。キーボードとタッチの両方で選択できます。
- エチケットは前回の余白修正を維持し、浦里972:1200／土田1027:1200の比率で表示。画像本来の白フチだけを残します。保存PNGは変更しません。

## 比較・推奨

**このUI案は採用可。公開反映はまだ行っていません。**

| 観点 | 公開中の完成版 | 今回のカード版 |
| --- | --- | --- |
| 選び方 | 軽やか／濃密という気分 | 浦里／土田という具体的なつくり手 |
| 水面 | 抽象水面を表示 | 同じ水面を選択した蔵に連動 |
| 追加演出 | なし | 接続演出なし。カードの状態差だけ |
| CTA | この気分の一本へ | この蔵の一本へ |
| スマホ | 既存配置 | タイトル幅を修正し、カード・CTA・補助文の余白を整理 |

PC1440px・1024px、390px・375pxの画面レビューでは、カードが選択肢に見え、CTAとPLAYが隠れず、水面・短句・SIDEのまとまりも維持できています。線のあった前案より情報の優先順位が明快です。これは制作上の判断で、初見ユーザーの認知や好みを実測した結果ではありません。

残る確認はiPhone Safari実機での表示・タップ・PNG保存です。原画2枚は計4,201,459 bytesのため、公開前にはカード用配信画像の軽量化とモバイル通信での初回表示確認を推奨します。

## Play

A single PLAY GAME click opens the viewport-sized game dialog. There is no settings page or second Start button. The LP-only game uses the pinned iPhone engine documented in `play/SOURCE.md`, with a 30-second duration and practice CPU. The first card is highlighted, then a visible deployment target appears. The timer and CPU do not advance before a successful user deployment; a direct first board tap can also deploy the starter card.

Results come from the real engine. Results expose an explicit product/producer link and Replay; there is no automatic redirect or taste inference. The parent validates the exact message origin, child window and session. Replay clears the prior result authorization. Closing restores scroll/focus. Pagehide cleans up the modal; returning to a standalone game through the history cache remains paused until resumed. No game records are read or written.

## Label collection

The supplied real label artwork replaces the generated-art souvenir. Only the black padding outside the paper has been removed; PNG downloads retain the original paper pixels. WebP images are separate display previews. A tap, horizontal swipe, arrow button or keyboard arrow turns the sleeve. Vertical page scrolling does not change the selection; there is no autoplay. Mobile order is heading → sleeves/current product → save/detail actions.

Edit the `label-releases` JSON block in `index.html` to add a product. Each entry needs a unique `id`, `name`, `jp`, `brewery`, `image`, `download`, `filename`, and `detail`. At most three sleeves are rendered visibly. Counter, download filename, artwork and details update together. Make sure the destination product anchor exists; do not publish a fake third release as part of testing. The initial and subsequent top-of-page source-card selections synchronize into the collection.

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
python tests/intuitive/test_http_details.py
python tests/source-water/test_ui.py
```

`BASE_URL` optionally overrides the HTTP test URL. `PLAYWRIGHT_EXECUTABLE_PATH` optionally selects an existing Chromium; otherwise install Playwright's Chromium normally. `test_offline.py` offers component-only checks where browser navigation is blocked. It inlines assets/styles and bundles modules without changing game logic. It does NOT substitute for same-origin iframe, real downloads, navigation or deployment verification.

Local Chromium over HTTP verifies the canonical page, source selection, no connecting-effect DOM, label interactions/downloads, real game start and natural match, replay, product navigation and browser back. Node syntax checks and controller unit tests are also run. Source-card evidence includes 1440px, 390px and 375px; supplemental checks include smaller game viewports and real PNG hashes. Reports and final status are recorded in the delivery memo after the run completes.

Physical iPhone Safari, iOS-specific saving and slow-network first-load behavior remain NOT TESTED. A push to the work branch triggers verification only; it is not a Pages publication.

## 変更ファイル一覧

- `experiments/after-hours-water/index.html`: ヒーロー構造、水源カード、ブランド・補助文。
- `experiments/after-hours-water/site.js`: 選択状態・文言・停止状態の同期。
- `experiments/after-hours-water/source-cards.css`: カードとレスポンシブ配置、前回のラベル余白修正。
- `experiments/after-hours-water/assets/urasato-source.png`, `tsuchida-source.png`: 旧実験から原本のまま移動。
- `experiments/after-hours-water/README.md`: 実装、比較判断、検証、未検証事項。
- `experiments/after-hours-source/index.html`, `README.md`: 旧URLを統合先へ案内。
- 削除: `experiments/after-hours-source/site.js`, `intuitive.js`, `source-water.js`, `source-water.css`。重複実装と不採用の接続演出を撤去。
- `tests/source-water/test_ui.py`: カードだけのUI・連動・旧URL移動のHTTP検証。
- `tests/intuitive/test_ui.py`, `test_http_details.py`: 検証用のブラウザコンテキストを先に閉じ、保存処理を含む終了待ちを防ぐ。検証項目は維持。
- `.github/workflows/intuitive-preview.yml`: この作業ブランチでも既存のHTTP検証とカード検証を実行。公開処理は追加しない。
