# SAKE ART TOKYO

本番URL: https://sakearttokyo.com/

英語版: https://sakearttokyo.com/en/

GitHub Pagesは `main` のリポジトリルートを公開します。`CNAME` の `sakearttokyo.com` と `.nojekyll` を維持してください。DNSの変更は本番更新に不要です。

## 本番の構成

- `index.html`: 完成候補の水源カードUIを昇格した本番LP。ブランド思想、商品説明、エチケット、ゲーム導線、漫画を掲載。
- `en/index.html`: 同じレイアウト・原画を使う英語版。HTMLの `lang` で共有JSの案内文を切り替えます。
- `language.css`, `english.css`: JA / ENナビゲーションと英語の改行・余白。日本語をルート、英語を `/en/` に固定し、自動転送はしません。
- `site.css`, `intuitive.css`, `source-cards.css`, `brand-intro.css`: レイアウトと浦里／土田のテーマ。
- `site.js`, `intuitive.js`, `label-save.js`: 水面、カード、年齢確認、エチケットとiframe制御。
- `play/`: LP用の30秒ゲーム。元のSAKE CLASH・75秒版・既存記録は変更しません。
- `assets/`: 原画・エチケットPNG・表示画像。実物ラベルと漫画は再生成していません。
- `privacy.html`, `robots.txt`, `sitemap.xml`, `favicon.svg`: 本番用の案内と検索向けファイル。

canonical・OGP・Twitter画像・構造化データのURLは `https://sakearttokyo.com/` を基準にします。商品詳細はルート内の `#sat-001` / `#sat-002`、ゲームは `/play/` で開きます。

英語版のcanonical / og:urlは `https://sakearttokyo.com/en/`、商品詳細は `/en/#sat-001` / `/en/#sat-002` です。両言語に相互のhreflangを設定しています。ゲームは同じ `/play/` に `lang=en` を渡し、`play/locale.js` で表示だけ翻訳します。元のモデル・原画・記録は変更しません。ラベル、ポスター、漫画に描かれた日本語は原画像のまま維持しています。

## SEO / IA Phase 1

トップの作品性は維持したまま、検索エンジンに酒蔵・商品・香り・ブランド関係を伝える静的ページを追加します。日本語はルート配下、英語は `/en/` 配下の完全ミラーです。

日本語:

- `/sake/`: SAKE ART TOKYOの商品・酒蔵Collection Hub。
- `/breweries/urazato/`: 浦里酒造 × SAKE ART TOKYO / SAT 001。
- `/breweries/tsuchida/`: 土田酒造 × SAKE ART TOKYO / SAT 002。
- `/about/chill-labo/`: Chill LaboからSAKE ART TOKYOへ至るブランド関係。
- `/sake/aroma/`: 日本酒の香り。官能表現と香気成分の説明を分離。

英語:

- `/en/sake/`
- `/en/breweries/urazato/`
- `/en/breweries/tsuchida/`
- `/en/about/chill-labo/`
- `/en/sake/aroma/`

新規ページは `editorial.css` を共用し、既存の `site.css` / `language.css` / `english.css` の変数・タイポグラフィを継承します。新しいJavaScript、Web font、frameworkは追加しません。

トップの「お酒を見る / Explore sake」は `/sake/` / `/en/sake/` へ送ります。BOTTLESのページ内アンカーは残しています。水源カードはbuttonのまま維持し、その直下に酒蔵ページへの小さなcrawlable linkを追加しています。STORYは `/about/chill-labo/`、漫画末尾は `/sake/aroma/` へつなぎます。

SAKE ART TOKYOは構造化データ上で `Brand`、Chill Labo・浦里酒造・土田酒造は別entityとして扱います。`from CHILL LABO` はコピーとして残しますが、単一Organization名にはしません。

FERMENTATION PLAYGROUNDの将来公開先は `/playground/` / `/en/playground/` 配下ですが、このリポジトリのPhase 1では移設しません。移設前の404リンクを本番HTMLやsitemapへ出さないでください。

商品固有ページ `/sake/melon-cotton-candy/` と `/sake/chocolate-banana-muffin/`、BASE販売導線、Product / Offer schemaはPhase 1では未実装です。

CSS / JSのURLには版番号を付けています（`site.css` 以外は `?v=20260908-en1`）。共有ファイルの更新時は両HTMLと、該当するゲームのmodule importの版番号を揃え、旧キャッシュとの混在を防ぎます。

タッチ端末ではヘッダーを通常のスクロール配置にしています。iPhone Safariで黒い固定帯が居残る報告への対策で、PCの追従ヘッダーは維持します。この変更の `site.css` は両言語とも `?v=20260909-scroll1` です。実機での解消確認と、WebKitブラウザの検証結果は分けて扱います。

浦里選択時はライム系、土田選択時は紫系。区切り線、PLAYの背景と強調文字、ストーリーの強調、漫画セクションの背景まで連動します。本文・エチケット・漫画の原画は維持しています。

水源カードとエチケットの選択は双方向に連動します。エチケットをめくった時も水面・SIDE・蔵名・ページ全体の色が切り替わり、現在のスクロール位置を保ちます。

iPhone・iPadの保存ボタンは、対応環境では選択中の原寸PNGを共有メニューへ渡します。写真への保存は端末側で行います。共有非対応やエラー時は原寸画像を表示し、長押し保存を案内します。PCのPNGダウンロードは維持します。

## 販売開始時

2商品の販売リンクと案内文は `.record-shop` の `hidden` 属性で非表示にしています。再表示は販売開始時に `index.html` と `en/index.html` の各2箇所の `hidden` を外します。自動で再表示する期限はありません。

## 検証

```sh
python3 -m http.server 4190 --bind 127.0.0.1
```

別ターミナルで以下を実行します（PythonにPlaywrightとChromiumが必要）。

```sh
node --check site.js
node --check intuitive.js
node tests/intuitive/test_controller.cjs
node tests/intuitive/test_label_save.cjs
python3 tests/intuitive/test_ui.py
python3 tests/intuitive/test_http_details.py
python3 tests/source-water/test_ui.py
python3 tests/english/test_ui.py
python3 tests/seo-ia/test_phase1.py
```

`tests/seo-ia/test_phase1.py` は新規10ページのHTTP 200、title/H1/meta、canonical、ja/en/x-default hreflang、OG/Twitter、JSON-LD、内部リンク、sitemap、360/390px横溢れ、ホーム内部リンクと44pxタップ領域を確認します。

HTTPテストの初期URLは `http://127.0.0.1:4190/`。`BASE_URL=https://sakearttokyo.com/` で公開ページも検証できます。375px／390pxのタッチエミュレーションと実機iPhone Safariは別の検証です。

WebKitでは別ポート4213で配信し、`BASE_URL=http://127.0.0.1:4213/ python3 tests/safari/test_overlay.py` を実行します（`python3 -m playwright install webkit` が必要）。スクロール、表示高さの変更、ゲーム・画像保存・ポリシー画面を閉じた後、ブラウザバックを確認します。iOS Safari自体のツールバーや描画の不具合を再現する検証ではありません。

GitHub ActionsのProduction verificationは `main`、`codex/**`、`seo-**` で実行します。SEO/IAブランチでも既存トップのChromium/WebKit回帰とPhase 1テストを同時に通します。

## 履歴と公開

旧ルートLPは本番昇格直前のcommit `9ade27463bc90d0c1270975724710c93a0a656d5` の `index.html` に保存されています。無関係なファイルを巻き戻さず、そのファイルだけGit履歴から取り出せます。

`experiments/after-hours-water/` は昇格元候補として保持します。本番の更新先はルートです。候補ページのnoindexは維持し、本番ルートにはnoindexを指定しません。`experiments/after-hours-source/` の既存転送も保持しています。

作業ブランチで検証後、mainへ通常pushし、GitHub Pagesのデプロイ完了と独自ドメインのHTTPSを確認します。push成功と公開成功は別々に確認してください。
