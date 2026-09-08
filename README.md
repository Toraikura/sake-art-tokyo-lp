# SAKE ART TOKYO

本番URL: https://sakearttokyo.com/

GitHub Pagesは `main` のリポジトリルートを公開します。`CNAME` の `sakearttokyo.com` と `.nojekyll` を維持してください。DNSの変更は本番更新に不要です。

## 本番の構成

- `index.html`: 完成候補の水源カードUIを昇格した本番LP。ブランド思想、商品説明、エチケット、ゲーム導線、漫画を掲載。
- `site.css`, `intuitive.css`, `source-cards.css`, `brand-intro.css`: レイアウトと浦里／土田のテーマ。
- `site.js`, `intuitive.js`, `label-save.js`: 水面、カード、年齢確認、エチケットとiframe制御。
- `play/`: LP用の30秒ゲーム。元のSAKE CLASH・75秒版・既存記録は変更しません。
- `assets/`: 原画・エチケットPNG・表示画像。実物ラベルと漫画は再生成していません。
- `privacy.html`, `robots.txt`, `sitemap.xml`, `favicon.svg`: 本番用の案内と検索向けファイル。

canonical・OGP・Twitter画像・構造化データのURLは `https://sakearttokyo.com/` を基準にします。商品詳細はルート内の `#sat-001` / `#sat-002`、ゲームは `/play/` で開きます。

浦里選択時はライム系、土田選択時は紫系。区切り線、PLAYの背景と強調文字、ストーリーの強調、漫画セクションの背景まで連動します。本文・エチケット・漫画の原画は維持しています。

水源カードとエチケットの選択は双方向に連動します。エチケットをめくった時も水面・SIDE・蔵名・ページ全体の色が切り替わり、現在のスクロール位置を保ちます。

iPhone・iPadの保存ボタンは、対応環境では選択中の原寸PNGを共有メニューへ渡します。写真への保存は端末側で行います。共有非対応やエラー時は原寸画像を表示し、長押し保存を案内します。PCのPNGダウンロードは維持します。

## 販売開始時

2商品の販売リンクと案内文は `.record-shop` の `hidden` 属性で非表示にしています。再表示は販売開始時に `index.html` の該当2箇所の `hidden` を外します。自動で再表示する期限はありません。

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
```

HTTPテストの初期URLは `http://127.0.0.1:4190/`。`BASE_URL=https://sakearttokyo.com/` で公開ページも検証できます。375px／390pxのタッチエミュレーションと実機iPhone Safariは別の検証です。

## 履歴と公開

旧ルートLPは本番昇格直前のcommit `9ade27463bc90d0c1270975724710c93a0a656d5` の `index.html` に保存されています。無関係なファイルを巻き戻さず、そのファイルだけGit履歴から取り出せます。

`experiments/after-hours-water/` は昇格元候補として保持します。本番の更新先はルートです。候補ページのnoindexは維持し、本番ルートにはnoindexを指定しません。`experiments/after-hours-source/` の既存転送も保持しています。

作業ブランチで検証後、mainへ通常pushし、GitHub Pagesのデプロイ完了と独自ドメインのHTTPSを確認します。push成功と公開成功は別々に確認してください。
