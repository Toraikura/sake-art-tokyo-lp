# AFTER HOURS — source cards and brand introduction / 2026-09-08

## Scope

The working branch is `codex/source-water-20260908`. The reviewed source-card UI lives at `experiments/after-hours-water/`; the older `after-hours-source/` URL redirects here while preserving its query and hash. No new experiment page is added. Publication uses the existing GitHub Pages source (`main`, repository root), preserving the current `CNAME` and other main-branch changes.

The main LP, original products, real labels, final comic, original SAKE CLASH repository, 75-second game and existing records are preserved. The existing water renderer and the canonical 30-second game/controller are retained. No new runtime dependency or animation loop is added.

## 水源カードだけで選ぶ

- 右側上部に浦里・土田のカードを横並びで配置。PCは各174×約99px、390pxは各159×約91px、375pxは各153×約87px。選択中は細枠・丸印・明度差で表示します。
- 浦里は筑波山・田園・霧、土田は森・岩・湧水・石鉢とししおどしが見える構図。提供PNGの画素を変更せず、SVGの表示範囲で切り取っています。カードの絵はイラストであり、実際の取水地点を検証した資料ではありません。
- カードと水面をつなぐSVG・膜・ストローク・座標計算・専用スクリプトは削除しました。カード選択では大きな波紋も発生しません。水面そのものの既存アニメーション・タップ波紋は維持します。
- 選択は水面色、SIDE、蔵名、短い情景文、商品表示、エチケット、ゲーム結果の商品案内へ連動します。最新の依頼により、ヒーローの「この蔵の一本へ」「PLAY GAME」は削除しました。旧「軽やかに／濃密に」の選択UIはありません。
- 浦里: `SIDE A / URAZATO`、浦里酒造、「霧の向こう、澄んだ余韻。」。
- 土田: `SIDE B / TSUCHIDA`、土田酒造、「森の奥、湧き出す深み。」。
- ヒーロー左下は両方 `SAKE ART TOKYO from CHILL LABO`。ブランド・URAZATOの表示表記を統一しています。
- スマホではコピー・ブランド、カード、水面の順。見出しの切れと横はみ出しを防ぎ、カードと水面は別々の操作対象にしています。ヘッダーの「お酒を見る」とゲームセクションの起動ボタンは維持します。
- `prefers-reduced-motion` と手動停止では追加のカード遷移も停止します。キーボードとタッチの両方で選択できます。
- エチケットは前回の余白修正を維持し、浦里972:1200／土田1027:1200の比率で表示。画像本来の白フチだけを残します。保存PNGは変更しません。

## ブランド思想と商品説明

- 「同じ日本酒。まったく違う、入り口。」を削除し、商品前にユーザー指定のブランド文章を一度だけ掲載。二つの指定文を太字とサイズ差で強調します。引用符以外の文章は変更せず、見え方に合わせて折り返します。
- 新しいボタン・タグ・アイコン・補足見出しは追加しません。既存の紙色とタイポグラフィを使い、三つの段落の間に余白を設けます。
- 提供された立体ロゴ `1.png` は、画像を加工せず `assets/sat-dimensional-logo.png` に配置。PCでは右側いっぱいの背景として幅58%・不透明度30%で大きく敷き、紙色に重ねて右端を切り取ります。本文を前面に保ち、700px以下ではロゴを非表示にします。
- ブランド思想 → 浦里 → 土田の順。PCの商品2列、スマホの商品1列は既存の構造を維持しています。
- 「この一本を、もう少し。」の折りたたみは撤去。商品名の下に、蔵との関係・香味・温度と時間による楽しみ方・常温保存を常時表示します。土田が貴醸酒であることと、両方が常温保存できることはユーザー提供情報です。香味・米由来の甘み・保存時の直射日光と高温の回避は既存root LPの記載に基づきます。製法や開発経緯は創作していません。
- ヒーロー内の2ボタンと、それらに対するJavaScript参照を撤去。ヘッダー、ゲームセクション、エチケット保存、商品詳細導線は維持します。
- 「選んだつくり手」のバッジを削除。「FEEL FIRST. / KNOW LATER.」の文字帯とマークも削除し、3pxのライム色の区切り線だけを残します。
- 追加のスタイルは `brand-intro.css` に限定。水面描画、ゲーム、元の商品・エチケット画像、漫画は変更しません。

## 比較・推奨

**このUI案は採用可。公開は検証済みの作業ブランチをmainへ統合して行います。**

| 観点 | 更新前 | 今回のカード版 |
| --- | --- | --- |
| 選び方 | 軽やか／濃密という気分 | 浦里／土田という具体的なつくり手 |
| 水面 | 抽象水面を表示 | 同じ水面を選択した蔵に連動 |
| 追加演出 | なし | 接続演出なし。カードの状態差だけ |
| ヒーローのボタン | この気分の一本へ／PLAY GAME | ユーザー指定により削除。既存のナビとゲームセクションを利用 |
| 商品前 | 二つの酒を紹介する見出し | ブランド思想を一度だけ掲載 |
| 商品説明 | 折りたたみ | 常時表示 |
| スマホ | 既存配置 | タイトル幅を修正し、カード・補助文・本文の余白を整理 |

PC1440px・1024px、390px・375pxの画面レビューでは、カードが選択肢に見え、水面・短句・SIDEのまとまりを維持できています。ブランドの考え方を読んでから具体的な二本に進む流れは、この構成で採用可能です。これは制作上の判断で、初見ユーザーの認知や好みを実測した結果ではありません。

残る確認はiPhone Safari実機での表示・タップ・PNG保存です。原画2枚は計4,201,459 bytesのため、公開前にはカード用配信画像の軽量化とモバイル通信での初回表示確認を推奨します。

## 販売リンクの表示

発売前のため、2商品の販売ボタンと外部ショップの案内文は `.record-shop` にまとめて `hidden` で非表示にしています。URL・文言・スタイルは残しています。販売開始時に、対象商品の `.record-shop` の `hidden` 属性を外すと再表示できます。

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

Local Chromium over HTTP verifies the canonical page, source selection, no connecting-effect DOM, exact brand copy and emphasis, the brand/product order, visible product descriptions, remaining navigation, label interactions/downloads, real game start and natural match, replay, product navigation and browser back. Node syntax checks and controller unit tests are also run. Source-card and brand evidence includes 1440px, 390px and 375px; supplemental checks include smaller game viewports and real PNG hashes. Reports and final status are recorded in the delivery memo after the run completes.

Physical iPhone Safari, iOS-specific saving and slow-network first-load behavior remain NOT TESTED. A push to the work branch triggers verification only; it is not a Pages publication. After verification, a separately authorized integration into main triggers the existing Pages build. Confirm the deployed commit and actual public content separately from the branch push; custom-domain DNS and HTTPS readiness are separate checks as well.

## 変更ファイル一覧

最新のブランド思想・商品説明の修正:

- `experiments/after-hours-water/index.html`: ブランド本文・常時表示の商品説明・ヒーロー2ボタン削除。
- `experiments/after-hours-water/brand-intro.css`: 本文・ロゴ・商品段落の余白とレスポンシブ表示。
- `experiments/after-hours-water/assets/sat-dimensional-logo.png`: 提供ロゴを無加工で追加。
- `experiments/after-hours-water/site.js`: 削除したCTA・旧紹介見出しへの参照を撤去。
- `experiments/after-hours-water/README.md`: 今回の内容・判断・検証範囲。
- `tests/source-water/test_ui.py`: ブランドと商品の表示、残したナビ・PLAYの実クリック検証。
- `tests/intuitive/test_http_details.py`: スマホの非表示・遅延読み込み画像を可視画像の検査から除外し、画像の読み込み待ちを15秒に制限。ロゴの実デコードはPC幅のカード・ブランド検証で確認します。

この作業ブランチの先行変更:

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
