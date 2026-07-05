# Goal2 A11y Review PoC

Goal 2の最小実行画面です。CMS登録予定の本文HTML断片を貼り付け、アクセシビリティ修正候補を確認し、候補ごとに `採用`、`編集して採用`、`却下`、`要確認` を選び、最終HTMLと証跡を出力します。

同じアプリ内に、Goal 3(旧ページ全体HTMLからのコンテンツ抽出)の実行画面 `/goal3.html` も同居しています。詳細は [Goal 3](#goal-3-content-extractor) を参照してください。

## Scope

このPoCで扱うもの:

- HTML断片の入力
- `a11y-migration-kb/build/rules.jsonl` の読み込み
- 画像、見出し、リンク、表、ファイル表示テキスト、テキスト表記、装飾指定の初期候補生成
- HTMLへ安全に反映できる候補と、CMS操作・SV確認・顧客確認が必要な候補の分離
- sandbox付きレンダリングプレビュー
- 修正候補と注意の分離表示
- 入力サンプルの選択投入（総合、画像、表、リンク・本文表記、iframe）
- 生成PNG画像を使った画像alt・複雑画像レビュー用サンプル
- `写真`、`案内図` などの画像種別を含むAI画像名候補を確認・編集してから修正後HTMLへ投入する画像alt下書き生成
- 候補ごとの判断状態
- 注意項目の出力欄表示と証跡JSONへの記録
- CMS貼り付け用の最終HTML出力
- JSON/CSVの証跡出力
- 佐賀市 old/gold fixture に対するローカル比較試験
- goldとの差分から、候補の `採用` / `編集して採用` / `却下` / `要確認` の推奨判断を学習・提示するローカルレポート
- Cloud Run互換のNode HTTPサーバー

このPoCでまだ扱わないもの:

- CMS管理画面への直接登録
- 実案件HTMLの外部LLM送信
- 実案件画像の外部AI送信
- miCheckerの自動実行
- A11yc libraryやaxe-coreの組み込み
- 認証、IAP、Secret Managerの実設定

## Local Run

```powershell
cd goal2-app
npm start
```

起動後、次を開きます。

```text
http://localhost:8080
```

PowerShellのExecution Policyで `npm.ps1` が止まる環境では、次でも起動できます。

```powershell
powershell -ExecutionPolicy Bypass -File .\start-server.ps1
```

Cloud Run互換のため、`PORT` 環境変数にも対応しています。

```powershell
$env:PORT=9090
npm start
```

## Test

```powershell
cd goal2-app
npm test
```

テストでは、KBルールの読み込み、主要ファイルの存在、`/api/health`、`/api/rules` を確認します。

佐賀市の `old` / `gold` fixture がある環境では、goldに対する近さを確認できます。

```powershell
cd goal2-app
npm run test:saga-gold
```

goldとの差分から候補選択の推奨判断を確認する場合:

```powershell
cd goal2-app
npm run learn:saga-gold
```

JSON/Markdownの証跡を出力する場合:

```powershell
npm run learn:saga-gold -- --write-output
```

ローカルサーバ起動中は、同じ内容を `GET /api/saga-gold-hints` からJSONで取得できます。

補正後HTMLを確認する場合:

```powershell
npm run test:saga-gold -- --write-output
```

出力先は `goal2-app/tmp/saga-gold-output/` です。`gold` は期待値として扱い、このコマンドでは変更しません。

## Goal 3 Content Extractor

`http://localhost:8080/goal3.html` で、旧ページ全体HTML(ヘッダー・ナビ・フッターなどのテンプレート部分を含む)からCMS登録対象のコンテンツ部分を抽出するPoC画面を開けます。

- 旧ページURLを入力し `/api/fetch-html` で取得するか、旧ページ全体HTMLを直接貼り付けます。
  - `/api/fetch-html` は `http`/`https` のみを許可し、`text/html` 系以外のレスポンスは失敗として扱います。
- `候補抽出` で、ブラウザ内 `DOMParser` によりテンプレート要素(パンくず、ページトップ、印刷リンク、署名/お問い合わせブロック、アンケートなど)を除いたコンテンツ候補をスコア順に最大5件提示します。
- 候補ごとに、本文量・見出し/表/画像/ファイルリンク数・除外件数などの抽出根拠と、元ページ内での抽出位置プレビューを確認できます。
- `GOAL2へ渡す` で、選択した候補のHTML・ページ名・旧URLを `localStorage` 経由でGoal 2画面(`/`)へ引き継ぎます。

このPoCでまだ扱わないもの:

- 認証が必要な旧サイトや社内ネットワーク限定サイトの取得
- 抽出候補の採否結果を証跡・ナレッジへ蓄積する仕組み
- Goal 1(バッチ処理)との連携

## Rules

既定では、次の順に `rules.jsonl` を探します。

1. `GOAL2_RULES_PATH` 環境変数
2. `goal2-app/data/rules.jsonl`
3. `../a11y-migration-kb/build/rules.jsonl`

OneDrive上の暗号化・オンライン専用ファイルに依存しないため、本PoCでは `goal2-app/data/rules.jsonl` にKB生成物を配置する運用を推奨します。

## Cloud Run

初心者向けの詳細手順は次を参照します。

```text
CLOUD_RUN_DEPLOY.md
```

最小のコンテナ実行例:

```powershell
docker build -t goal2-a11y-review-poc .
docker run --rm -p 8080:8080 -e PORT=8080 goal2-a11y-review-poc
```

本番相当のCloud Runへ進む前に、IAPなどの認証、ログ方針、実案件HTMLの保存方針、LLM/API送信可否を決めます。
