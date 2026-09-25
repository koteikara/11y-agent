# 移行アクセシビリティ作業アプリ(goal2-app)

自治体サイトの本文を新CMSへ移すときに、アクセシビリティの修正を支える画面をまとめたアプリです。Cloud Runのホスト版と、Windowsの単一 `.exe` 版([LOCAL_WINDOWS_APP.md](LOCAL_WINDOWS_APP.md))の2通りで動かします。

| 画面 | パス | 役割 |
| --- | --- | --- |
| 候補レビュー(Goal 2) | `/` | CMSに登録する本文HTMLの断片を貼り付け、修正候補ごとに `採用`、`編集して採用`、`却下`、`要確認` を選び、最終HTMLと証跡を出力する |
| 一括最適化(Goal 1) | `/goal1.html` | 複数ページに本文抽出と候補生成をまとめてかけ、安全な候補だけを自動で採用し、修正後HTML・証跡・要確認一覧を出力する(設計は [GOAL1_BUILD_INSTRUCTIONS.md](GOAL1_BUILD_INSTRUCTIONS.md)) |
| 本文抽出(Goal 3) | `/goal3.html` | 旧ページ全体のHTMLから、CMSに登録する本文部分を抽出して候補レビューへ渡す([Goal 3](#goal-3-content-extractor)) |
| miChecker結果比較 | `/michecker-compare.html` | 移行前と移行後のmiCheckerの検査結果を比べ、指摘を新規・未解消・解消に分けてKBのルールへ逆引きする([miChecker関連の機能](#michecker関連の機能)) |
| 検証ガイド | `/verification-guide.html` | 3パターン(通常移行 / AI移行 / miChecker移行)の比較検証の作業手順書。実体は `public/verification-guide.html`、画面キャプチャは `public/images/verification/` |
| 概要スライド | `/verification-slides.html` | 検証の概要を説明するスライド(「移行作業はこう変わる」)。検証ガイドからリンクしている |

作業者向けの操作マニュアルは [WORKER_GUIDE.md](WORKER_GUIDE.md) にあります。

ディレクトリ名の `goal2-app` は、Goal 2の画面から作り始めた名残です。Windows版の `goal2-app.exe` と設定の保存先 `%APPDATA%\goal2-app` も同じ名前を使っています。配布物と手順書がこの名前を参照しているため、ディレクトリ名は変えていません。

## Scope

扱うもの:

- HTML断片の入力と、旧ページ全体HTMLからの本文抽出(Goal 3)
- KB生成物 `data/rules.jsonl` の読み込み(探す順は [Rules](#rules))
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
- 複数ページの一括処理と、安全な候補の自動採用(Goal 1)
- miCheckerの検査結果の比較と、ブラウザ内でのmiChecker相当の検査([miChecker関連の機能](#michecker関連の機能))
- Cloud Run互換のNode HTTPサーバー

まだ扱わないもの:

- CMS管理画面への直接登録
- Cloud Runのホスト版でのmiChecker(`htmlchecker.exe`)の自動実行。自動実行はWindows上でローカルに動かしたとき(主に `.exe` 版)に限る
- A11yc libraryやaxe-coreの組み込み
- 認証、IAP、Secret Managerの実設定

LLM連携は実装済みだが、提供元の設定(Geminiは `GEMINI_API_KEY` か `GEMINI_AUTH_MODE=adc`、さくらのAI Engineは `LLM_TEXT_PROVIDER`/`LLM_VISION_PROVIDER` と `SAKURA_AI_API_KEY`)が無い既定の状態では一切呼び出されない。実案件HTML・画像を外部LLMへ送信してよいかの最終的なデータポリシー合意は自治体・発注元との間で未確定のため、有効化は運用判断に委ねる。詳細は [LLM (Gemini) 連携](#llm-gemini-連携) と [LLM_DATA_POLICY.md](LLM_DATA_POLICY.md)(Googleのデータ利用規約の調査結果・実案件投入前の最低条件たたき台)を参照。

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

ほかのテストは次のとおりです。表の入れ子、出力、miCheckerとの一致の3つはPlaywrightとChromiumを使います(Chromiumの場所は `PLAYWRIGHT_CHROMIUM_PATH` で指定できます)。

```powershell
npm run test:llm              # LLMの呼び出し(モックのサーバーを使う)
npm run test:table-nesting
npm run test:goal2-output
npm run test:michecker-parity
```

テストで起動するサーバーには、LLM関係の環境変数(`GEMINI_*`、`LLM_*`、`SAKURA_AI_*`、`USD_JPY_RATE`)を渡しません(`test/server-env.js`)。手元に鍵があっても、テストが実際のAPIを呼ぶことはありません。

pull requestとmainへのpushでは、GitHub Actions(`../.github/workflows/ci.yml`)が上の5つと、リポジトリの検査(一時生成物の混入、KB生成物とアプリ内のコピーの一致)を動かします。`npm run test:saga-gold` は、佐賀市fixtureが非公開のリポジトリにあるため、CIでは動かしません。

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

出力先は `goal2-app/tmp/saga-gold-output/` です。`tmp/` は一時生成物の置き場で、コミットしません。`gold` は期待値として扱い、このコマンドでは変更しません。

## 検証用のデータと一時ファイル

リポジトリに入れるものと入れないものを、次のように分けます。「入れない」ものは `.gitignore` で無視し、CIの `scripts/ci/check-tracked-files.js` が混入を検出します。

| 種類 | 置き場 | コミット | 説明 |
| --- | --- | --- | --- |
| テストのfixture | `test/*/fixtures/` | する | テストが読む入力と期待値。例: `test/michecker-parity/fixtures/generic-page.html`、`test/llm/fixtures/gemini-api-key-baseline.json` |
| 入力サンプル | `samples/`、`public/images/sample-*-generated.png` | する | 候補レビューの「入力サンプル」の素材。`samples/anjo-bidding-*.html` は `public/app.js` に埋め込んだ安城市の表サンプルの元の資料で、実行時には読まない |
| 画面の資料 | `public/images/verification/`、`../docs/images/` | する | 検証ガイドと手順書に載せる画面キャプチャ |
| 評価のデータセットと結果 | `agents-cli/datasets/`、`agents-cli/results/` | する | ローカル評価の入力と、その結果の記録。[agents-cli/README.md](agents-cli/README.md) が参照する |
| KBの生成物のコピー | `data/rules.jsonl`、`data/michecker-checkitems.json` | する | `a11y-migration-kb/build/` と同じ内容。CIの `scripts/ci/check-kb-build.js` が一致を確かめる |
| 佐賀市fixture | `../.tmp-gemini-a11y-agent/`(`koteikara/gemini-a11y-agent` の複製かシンボリックリンク) | しない | `npm run test:saga-gold`、`npm run learn:saga-gold`、`/api/saga-samples`、`/api/saga-gold-hints` が読む。無ければこれらは動かないか、404を返す |
| 一時生成物 | `tmp/`(`--write-output` の出力)、`*.log`(`start-server.ps1` の `server.log` など) | しない | いつでも作り直せるもの |
| Windows版のビルド生成物と手元の設定 | `dist/`、`*.exe`、`sea-prep.blob`、`server.bundled.js`、`.goal2-app-local/` | しない | `build-windows-app.bat` の出力と、`htmlchecker.exe` の場所の設定 |

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

## miChecker関連の機能

miCheckerは総務省の評価ツールで、公共団体の案件では検収の目安になりやすいものです(`AGENTS.md`)。このアプリはmiChecker本体を同梱せず、次の3つの形で扱います。

| 機能 | 使える環境 | 内容 |
| --- | --- | --- |
| 修正基準の切り替え | すべて | 候補レビューと一括最適化の「修正基準」で「miChecker指摘対応のみ」を選ぶと、miCheckerに関係する候補だけを生成し、証跡に `rule_scope_mode` を記録する。既定は「移行ルール全体(miChecker含む)」で、絞り込むかどうかは案件の検収条件を確かめてから決める |
| miChecker相当の検査 | すべて | `public/michecker-engine.js` は、miCheckerの検査ロジック(Eclipse ACTF、EPL-1.0)のうち、本文の編集にかかわる約116項目をJavaScriptへ移したもの。「miChecker指摘対応のみ」のときに候補レビューで結果のパネルを出し、最終HTMLに対して検査し直せる。一括最適化では件数を一覧に出す。移した範囲は [MICHECKER_PORT_INVENTORY.md](MICHECKER_PORT_INVENTORY.md)、方針は [MICHECKER_ENGINE_PORT_INSTRUCTIONS.md](MICHECKER_ENGINE_PORT_INSTRUCTIONS.md) |
| 検査結果の比較 | CSVの読み込みはすべて。自動の検査はWindowsのみ | miChecker(GUI)で書き出したCSVを、移行前と移行後の2つ読み込んで比べる。Windows上でローカルに動かし、`htmlchecker.exe`(miChecker本体とは別のCLIツール)の場所を画面か `MICHECKER_HTMLCHECKER_EXE` で指定すると、移行前後のHTMLを貼るだけで検査から比較まで進む(`POST /api/michecker-local-compare`)。Cloud Runでは自動の検査は使えない |

比較画面で「KB未対応」と出た指摘は、`a11y-migration-kb/reference/michecker-triage.md` の手順でKBへ戻します。`htmlchecker.exe` の用意は [LOCAL_WINDOWS_APP.md](LOCAL_WINDOWS_APP.md) と `memory/michecker-research.md` を参照してください。

## Rules

既定では、次の順に `rules.jsonl` を探します。

1. `GOAL2_RULES_PATH` 環境変数
2. `goal2-app/data/rules.jsonl`
3. `../a11y-migration-kb/build/rules.jsonl`

OneDrive上の暗号化・オンライン専用ファイルに依存しないため、本PoCでは `goal2-app/data/rules.jsonl` にKB生成物を配置する運用を推奨します。

## LLM (Gemini) 連携

一部の候補生成(`text.foreign-language`、`text.sensory-characteristics`、`link.link-text`/`mail-link`/`toppage-link`、`table.caption`/`cell-merge-*`/`th-scope`、`image.alt-text`/`complex-image-report`/`avoid-text-as-image`、`html-structure.heading-required`/`heading-content-quality`)は、LLMを使って候補の内容を改善する後処理(enrichment)に対応している。**提供元を何も設定していない場合(既定)、LLM関連コードは一切呼び出されず、課金も発生しない。** LLMが有効になるのは、`GEMINI_API_KEY`(GeminiのAPIキー方式)、`GEMINI_AUTH_MODE=adc`(Vertex AI経由)、`LLM_TEXT_PROVIDER`/`LLM_VISION_PROVIDER` を `sakura` にしたうえでの `SAKURA_AI_API_KEY`(さくらのAI Engine)のどれかを設定したときである。 既存のヒューリスティック(正規表現・DOM解析)による候補生成だけで動作し、検出結果はLLM無効時と完全に同じになる。

**実案件データで有効化する前に [LLM_DATA_POLICY.md](LLM_DATA_POLICY.md) を確認すること。** Googleの無料枠は送信内容をモデル学習・製品改善に利用する場合があるため、実案件データには使用できない(有料枠またはVertex AI経由のみ)。

### 有効化に必要な環境変数

| 環境変数 | 既定値 | 説明 |
|---|---|---|
| `GEMINI_API_KEY` | (未設定) | 設定するとGeminiがAPIキー方式で有効になる。Vertex AI経由(`GEMINI_AUTH_MODE=adc`)なら不要。Geminiがどちらの方式でも設定されていなければ、他の`GEMINI_*`変数は使われない。 |
| `GEMINI_MODEL` | `gemini-2.5-flash` | 使用するGeminiモデル。安価な高速ティアを既定にしている。 |
| `LLM_MAX_CALLS_PER_MINUTE` | `30` | 1分あたりのGemini呼び出し上限。超過分は429エラーとなり、呼び出し元は既存ヒューリスティックの案へ自動フォールバックする。 |
| `GEMINI_INPUT_PRICE_PER_1M_TOKENS` | `0.3` (USD) | コスト概算に使う入力トークン単価。既定モデル(`gemini-2.5-flash`)の[公式料金](https://ai.google.dev/gemini-api/docs/pricing)を2026-07-10時点で確認した値。**料金は変動するため、`GEMINI_MODEL`を変更した場合や時間が経過した場合は必ず最新値を確認して設定すること。** |
| `GEMINI_OUTPUT_PRICE_PER_1M_TOKENS` | `2.5` (USD) | コスト概算に使う出力トークン単価。同上、2026-07-10時点の公式料金で確認済み。 |
| `GEMINI_TEMPERATURE` | `0` | Geminiに送る温度。Gemini 3系は公式に既定の1.0のまま使うよう推奨されている(1.0より下げると繰り返し等が起きることがある)ため、3系のモデルに替えるときは `1` を設定する。数でない値は `0` として扱う。 |
| `GEMINI_THINKING_LEVEL` | (未設定) | Gemini 3系の考える量(`generationConfig.thinkingConfig.thinkingLevel`)。`minimal`、`low`、`medium`、`high` のいずれか。未設定なら送らず、モデルの既定(3系は `high`)になる。2.5系に送るとエラーになるので、2.5系では設定しない。 |
| `GEMINI_API_BASE_URL` | (未設定) | APIキー方式の宛先の根元。テストでモックのサーバーへ向けるためのもので、本番では設定しない。 |
| `USD_JPY_RATE` | `162` | UIに円換算コストを併記するための為替レート。2026-07-10時点の実勢レート(約161.7円)で確認済み。為替は日々変動するため、必要に応じて最新値へ更新する。 |

候補一覧の生成ごとに、画面上へ概算コスト(USD/円換算・呼び出し回数)が表示される。実際の請求額は Google Cloud 側のコンソールで確認すること。

### 認証方式(2種類)

- **APIキー方式(既定)**: `GEMINI_API_KEY` を設定するだけで動く。ローカル開発・Cloud Run両方で使えるが、キーの管理(Cloud Runでは Secret Manager 経由推奨)が必要。
- **ADC/Vertex AI方式(`GEMINI_AUTH_MODE=adc`)**: Cloud Run上でのみ動作する。APIキー不要で、Cloud Runサービスアカウントの権限でVertex AI経由のGemini呼び出しができる。ローカル開発では使えない(メタデータサーバーに到達できないため)。有効化には以下も設定する。
  - `GEMINI_VERTEX_PROJECT`(未設定時はメタデータサーバーから自動取得)
  - `GEMINI_VERTEX_LOCATION`(既定 `us-central1`)。`global` も指定できる(宛先は `aiplatform.googleapis.com` になる)。
  - Cloud Runサービスアカウントに Vertex AI 呼び出し権限(`roles/aiplatform.user`)を付与し、プロジェクトで `aiplatform.googleapis.com` を有効化する必要がある。手順は [CLOUD_RUN_DEPLOY.md](CLOUD_RUN_DEPLOY.md) を参照。

### 提供元の切り替え(さくらの AI Engine)

文字の11タスクと画像の2タスクで、LLM の提供元を別々に選べる(設計は [LLM_PROVIDER_SWITCH_INSTRUCTIONS.md](LLM_PROVIDER_SWITCH_INSTRUCTIONS.md) の 3章)。
何も設定しなければ、いまと同じく Gemini を呼ぶか、何も呼ばない。
本番をさくらへ切り替えるのは、評価(L2)のあとである。

| 環境変数 | 既定値 | 説明 |
|---|---|---|
| `LLM_TEXT_PROVIDER` | `gemini` | 文字の11タスクの提供元。`gemini` か `sakura`。ほかの値は `gemini` として扱う。 |
| `LLM_VISION_PROVIDER` | `gemini` | 画像の2タスクの提供元。`gemini` か `sakura`。 |
| `LLM_FALLBACK_PROVIDER` | `none` | 主の提供元が失敗したときの受け皿。`gemini` か `none`。主と同じ提供元なら使わない。 |
| `LLM_REQUEST_TIMEOUT_MS` | `45000` | 1回の呼び出しの上限(ミリ秒)。 |
| `SAKURA_AI_API_KEY` | (未設定) | さくらのトークン(`<UUID>:<シークレット>`)。Cloud Run では Secret Manager から渡す。 |
| `SAKURA_AI_BASE_URL` | `https://api.ai.sakura.ad.jp/v1` | 呼び口の根元。テストではモックのサーバーへ向ける。 |
| `SAKURA_AI_TEXT_MODEL` | `gpt-oss-120b` | 文字のタスクのモデル。 |
| `SAKURA_AI_VISION_MODEL` | `preview/Qwen3-VL-30B-A3B-Instruct` | 画像のタスクのモデル(プレビュー)。 |
| `SAKURA_AI_MAX_TOKENS` | `16384` | 出力の上限。gpt-oss-120b は考える過程で上限を使い切ると中身が空になるので大きめにする。 |
| `SAKURA_AI_TEXT_REASONING_EFFORT` | `low` | 文字のモデルに送る `reasoning_effort`。空にすると送らない。 |
| `SAKURA_AI_TEXT_INPUT_PRICE_PER_1M_JPY` / `SAKURA_AI_TEXT_OUTPUT_PRICE_PER_1M_JPY` | `15` / `75` | 費用の概算に使う単価(円)。2026-09-24 の公式の料金表の値。 |
| `SAKURA_AI_VISION_INPUT_PRICE_PER_1M_JPY` / `SAKURA_AI_VISION_OUTPUT_PRICE_PER_1M_JPY` | `10` / `30` | 同上。 |
| `LLM_RECORD_DIR` | (未設定) | 評価用に、送る予定の要求を `requests.jsonl` と `images/` に書き出すフォルダー。提供元が無くても書き出す。**本番では設定しない。** |

呼び出しの流れは次のとおりである。

- 応答は JSON として取り出し、タスクのスキーマで形を確かめる(コードブロックの囲みは外す。余分な項目は捨てる)。
- 失敗したら、同じ提供元で1回だけやり直す。429 はやり直さない。
- それでも失敗し、受け皿があれば受け皿で1回呼ぶ。
- `/api/llm/enrich` と `/api/llm/image-alt` の応答には、答えた提供元(`provider`)、モデル(`model`)、受け皿を使ったか(`fallback_used`)が付く。費用の概算は、やり直しと受け皿の分も数える。
- `/api/llm/status` は `{ configured, text: { provider, model }, vision: { provider, model } }` を返す。

### gemini-2.5-flash の廃止(2026-10-20)に向けたつなぎの設定

Vertex AI の `gemini-2.5-flash` は 2026-10-20 に廃止される。
さくらの AI Engine へ移すまでのつなぎとして、次の3案から選ぶ(設計は [LLM_PROVIDER_SWITCH_INSTRUCTIONS.md](LLM_PROVIDER_SWITCH_INSTRUCTIONS.md) の 3.8)。
推奨は案 A である。

| 案 | 設定 | 単価(現行比) | 処理する場所 | 備考 |
|---|---|---|---|---|
| A | `GEMINI_VERTEX_LOCATION=asia-northeast1`、`GEMINI_MODEL=gemini-3.5-flash`、`GEMINI_TEMPERATURE=1` | 入力5.5倍、出力4倍 | 東京 | 東京で使える後継はこれだけ。単価の変数も `GEMINI_INPUT_PRICE_PER_1M_TOKENS=1.65`、`GEMINI_OUTPUT_PRICE_PER_1M_TOKENS=9.9` に替える |
| B | `GEMINI_VERTEX_LOCATION=global`、`GEMINI_MODEL=gemini-3.5-flash-lite`、`GEMINI_TEMPERATURE=1` | 同じ | 保証なし | `global` の宛先の修正(2026-09-24)を含む版が要る |
| C | APIキー方式(`GEMINI_API_KEY`)に戻し、`gemini-2.5-flash` のまま | 同じ | 保証なし | 廃止日は未発表。入出力は55日保存される。課金を有効にしたキーが要る |

案 A と B では、費用と応答時間を抑えたいときに `GEMINI_THINKING_LEVEL=low` も足せる。
本番への出し方(トラフィックを流さないリビジョンで先に確かめる手順)は [CLOUD_RUN_DEPLOY.md](CLOUD_RUN_DEPLOY.md) を参照。

## Cloud Run

初心者向けの詳細手順は次を参照します。

```text
CLOUD_RUN_DEPLOY.md
```

最小のコンテナ実行例:

```powershell
docker build -t a11y-migration-app .
docker run --rm -p 8080:8080 -e PORT=8080 a11y-migration-app
```

本番相当のCloud Runへ進む前に、IAPなどの認証、ログ方針、実案件HTMLの保存方針、LLM/API送信可否を決めます。
