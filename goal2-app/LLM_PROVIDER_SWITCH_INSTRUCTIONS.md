# LLM 提供元の切り替え 設計書（さくらの AI Engine への移行）

Goal 2 実行画面の LLM 呼び出しを、いまの Google Gemini から、さくらの AI Engine を主とする構成へ移すための設計と実装の手順をまとめる。
前半は判断の前提と現状の事実、後半は段階ごとの実装と検証である。
提供元を比べた調査は `memory/llm-provider-alternatives-research.md` にある。

作成は 2026-09-24、設計はこのリポジトリの設計・レビュー担当（Opus 5.5）が行った。
関数名で該当箇所を探すこと。行番号は書かない。

## 0. 作業の前に読むもの

- `AGENTS.md`、`PROJECT_CONTEXT.md`
- `memory/llm-provider-alternatives-research.md`（比較と出典）
- `goal2-app/LLM_DATA_POLICY.md`（データ送信の方針）
- `goal2-app/lib/llm.js`、`goal2-app/lib/llm-prompts.js`、`goal2-app/server.js` の `/api/llm/*`
- `goal2-app/public/app.js` の `runLlmBatch()` と、`/api/llm/image-alt` を呼ぶ3か所

## 1. 前提（ユーザー確定、2026-09-24）

- **さくらの AI Engine に寄せる。** 他のプロジェクトですでに使っており、契約と支払いの手続きが済んでいるためである。
- **ISMAP はいまは求めない。** 送るのは公開済みの自治体ページの HTML と画像で、機密性が低いためである。
- **Google から離れることは条件ではない。** Gemini は、受け皿とつなぎとして残してよい。
- **既定の挙動は変えない。** 新しい設定を何も入れなければ、いまと同じく Gemini を呼ぶか、何も呼ばない。

対象外は次のとおりである。

- Google Workspace 経由の利用。サーバーから呼べる経路が無い（研究メモ参照）。
- AWS Bedrock、Azure、Anthropic と OpenAI の直接契約、自前で動かすモデル。比較は研究メモに残した。
- Windows 版の設定画面から API キーを入れる機能。いまの Gemini と同じく環境変数で渡す。
- 研究メモ `memory/agent-context-relevance-compaction-research.md` の小型分類器。

## 2. 現状の事実（2026-09-24、main `6b82962`）

### 2.1 呼び出しの流れ

- LLM を呼ぶのは `lib/llm.js` の `callGemini()` の1か所だけである。
- `server.js` の呼び口は3つある。
  - `GET /api/llm/status`: `{ configured }` を返す。GOAL1 画面が、費用が発生し得るかの表示に使う。
  - `POST /api/llm/enrich`: 文字の11タスク。1回に50件まで。`callGemini()` の応答の `text` を `JSON.parse()` して `{ ok, results, usage }` を返す。
  - `POST /api/llm/image-alt`: 画像の2タスク（`image-alt`、`avoid-text-as-image`）。画像はサーバーが取りに行き、base64 にして送る（`fetchImageAsBase64()`、jpeg、png、webp、gif、4MB まで）。
- 画面は、呼び出しが失敗すると黙ってルールベースの案を残す（`runLlmBatch()` など）。LLM が止まっても作業は止まらない。

### 2.2 `callGemini()` の中身

- 認証は2通りある。`GEMINI_API_KEY`（Gemini API）と、`GEMINI_AUTH_MODE=adc`（Vertex AI、Cloud Run のメタデータサーバーからトークンを取る）である。
- Vertex AI の地域は `GEMINI_VERTEX_LOCATION` で、既定は `us-central1` である。宛先は `https://{location}-aiplatform.googleapis.com/...` の形で組み立てるので、`global` は指定できない。
- 既定のモデルは `gemini-2.5-flash` で、`GEMINI_MODEL` で変えられる。
- 温度は 0 で固定している。
- 応答スキーマは `generationConfig.responseSchema` で渡す。
- プロセス内のキャッシュ（モデル、システム指示、本文、画像のハッシュが鍵）、1分あたりの呼び出し上限（`LLM_MAX_CALLS_PER_MINUTE`、既定30）、45秒のタイムアウトがある。
- 費用はドル建ての単価（`GEMINI_INPUT_PRICE_PER_1M_TOKENS` など）と為替（`USD_JPY_RATE`）で概算し、`usage.estimatedCostUsd` と `usage.estimatedCostJpy` で返す。

### 2.3 応答スキーマ

- 13 のタスクすべてが、Gemini 独自の書き方（型名が大文字）で書かれている。使っている型は `OBJECT`、`ARRAY`、`STRING`、`BOOLEAN` だけで、`enum` や `nullable` は無い。
- 文字の11タスクは、一番外側が `ARRAY`（1件の入力に1件の結果）である。画像の2タスクは `OBJECT` である。
- 数値に当たる項目（見出しのレベルなど）も `STRING` で受けている。

### 2.4 テスト

- LLM の呼び口を試すテストは1つも無い。`test/run-tests.js` にも `test/goal2-output/` にも無い。

### 2.5 期限

- Vertex AI の `gemini-2.5-flash` は 2026-10-20 に廃止される（公式の「Model versions and lifecycle」、2026-09-22 更新）。
- 本番の Cloud Run が Vertex AI 経由か API キー経由かは、まだ確かめていない。記録には、ユーザーが Cloud Run で Vertex AI 経由の呼び出しを確かめたことが残っている（`memory/project-state.md`）。

## 3. 設計

### 3.1 構成

`lib/llm.js` に、提供元を選んで呼ぶ関数 `callLlm()` を置き、提供元ごとの処理を「アダプター」として分ける。

- **gemini アダプター**: いまの `callGemini()` の中身。Gemini API と Vertex AI の両方を扱う。
- **openai-compatible アダプター**: OpenAI 互換の `/v1/chat/completions` を呼ぶ。さくらの AI Engine に使う。名前を提供元でなく形式にしておくのは、将来 Azure や自前のサーバー（Ollama、vLLM）を同じ作りで足せるようにするためである。

`callLlm({ kind, task, systemPrompt, userText, image, responseSchema })` は次の順に動く。

1. `kind`（`"text"` か `"vision"`）で、使う提供元を決める（3.2）。
2. キャッシュを引く。鍵に提供元とモデルを含める。
3. 1分あたりの上限を確かめる（提供元をまたいで共通）。
4. アダプターで呼び、JSON を取り出して検証する（3.4）。
5. 失敗したら同じ提供元で1回だけやり直す。
6. それでも失敗し、受け皿（`LLM_FALLBACK_PROVIDER`）が設定されていれば、受け皿で1回呼ぶ。
7. `{ json, provider, model, fallback_used, usage }` を返す。`usage` には、いまと同じ `inputTokens`、`outputTokens`、`estimatedCostUsd`、`estimatedCostJpy` を入れる。

`server.js` の2つの呼び口は `callLlm()` を使うように変える。
JSON の取り出しは `callLlm()` の中に移し、呼び口では行わない。
応答の形 `{ ok, results, usage }` と `{ ok, result, usage }` は変えず、`provider` と `model` を足す（足すだけなので画面は壊れない）。
`callGemini()` は外から呼ばれなくなるので、gemini アダプターの中に入れてよい。

### 3.2 設定（環境変数）

| 変数 | 既定 | 意味 |
|---|---|---|
| `LLM_TEXT_PROVIDER` | `gemini` | 文字の11タスクの提供元。`gemini` か `sakura` |
| `LLM_VISION_PROVIDER` | `gemini` | 画像の2タスクの提供元。`gemini` か `sakura` |
| `LLM_FALLBACK_PROVIDER` | `none` | 失敗したときの受け皿。`gemini` か `none`。主と同じ提供元なら使わない |
| `LLM_REQUEST_TIMEOUT_MS` | `45000` | 1回の呼び出しの上限。いまの固定値を変数にする |
| `SAKURA_AI_API_KEY` | 未設定 | さくらのトークン（`<UUID>:<シークレット>`）。Cloud Run では Secret Manager から渡す |
| `SAKURA_AI_BASE_URL` | `https://api.ai.sakura.ad.jp/v1` | 呼び口の根元。テストではモックのサーバーに向ける |
| `SAKURA_AI_TEXT_MODEL` | `gpt-oss-120b` | 文字のタスクのモデル |
| `SAKURA_AI_VISION_MODEL` | `preview/Qwen3-VL-30B-A3B-Instruct` | 画像のタスクのモデル |
| `SAKURA_AI_MAX_TOKENS` | `16384` | 出力の上限。考える過程で使い切ると中身が空になるので大きめにする |
| `SAKURA_AI_TEXT_REASONING_EFFORT` | `low` | 文字のモデルに送る `reasoning_effort`。空なら送らない |
| `SAKURA_AI_TEXT_INPUT_PRICE_PER_1M_JPY` | `15` | 費用の概算に使う単価（円）。2026-09-24 の公式の料金表から |
| `SAKURA_AI_TEXT_OUTPUT_PRICE_PER_1M_JPY` | `75` | 同上 |
| `SAKURA_AI_VISION_INPUT_PRICE_PER_1M_JPY` | `10` | 同上 |
| `SAKURA_AI_VISION_OUTPUT_PRICE_PER_1M_JPY` | `30` | 同上 |
| `LLM_RECORD_DIR` | 未設定 | 評価用に、送る予定の要求を書き出すフォルダー（3.9）。本番では設定しない |

- `isConfigured()` は、文字と画像のどちらかの提供元が使える状態なら真にする。gemini は、いまと同じく `GEMINI_API_KEY` か `GEMINI_AUTH_MODE=adc` がそろっていれば使える。sakura は `SAKURA_AI_API_KEY` があれば使える。
- `GET /api/llm/status` は `{ configured, text: { provider, model }, vision: { provider, model } }` を返す。`configured` の意味は変えない。
- 何も設定しなければ、いまと同じ挙動になる。これをテストで確かめる（3.10）。

### 3.3 スキーマの変換

`lib/llm-prompts.js` のスキーマはそのままにし、openai-compatible アダプターが送る直前に標準の JSON Schema へ変換する。
gemini アダプターには、いまと同じ形で渡す。

- 型名を小文字にする（`OBJECT` → `object` など）。
- `object` には `additionalProperties: false` を足す。`required` はそのまま写す。
- 一番外側が `array` のときは、`{ "type": "object", "properties": { "results": <元の配列> }, "required": ["results"], "additionalProperties": false }` で包む。返ってきた JSON は `results` を取り出して、元の配列の形に戻す。包む理由は、OpenAI 互換の呼び口の多くが、一番外側にオブジェクトを求めるためである。
- 送り方は `response_format: { "type": "json_schema", "json_schema": { "name": <タスク名>, "schema": <変換後>, "strict": true } }` とする。
- さくらでは JSON Schema による強制が公式に保証されていない。そのため、openai-compatible アダプターはシステム指示の末尾にも「出力は次の JSON Schema に従う JSON だけにし、説明やコードブロックを付けない」という一文と、変換後のスキーマを足す。
- 変換は、13 のタスクすべてに対してテストで確かめる。

### 3.4 応答の取り出しと検証

openai-compatible アダプターは、次の順に処理する。

1. HTTP の状態が 200 以外なら失敗にする。429 は `llm_rate_limited`、5xx は `llm_api_error` とする。
2. `choices[0].message.content` が空か、`finish_reason` が `length` なら失敗にする（`llm_empty_response`、`llm_truncated`）。gpt-oss-120b は、考える過程で上限を使い切ると HTTP 200 のまま中身が空で返る。
3. 前後の空白と、```` ```json ```` のようなコードブロックの囲みを外してから `JSON.parse()` する。
4. 変換前のスキーマで検証する。依存パッケージは足さず、使っている4つの型と `properties`、`required`、`items` だけを見る小さな検証関数を書く。余分な項目は捨て、失敗にはしない。`required` の欠けと型の違いは失敗にする（`llm_schema_mismatch`）。
5. `usage.prompt_tokens` と `usage.completion_tokens` から費用を概算する。さくらは円建てなので円を先に計算し、ドルは `USD_JPY_RATE` で割って出す。

gemini アダプターにも、4 の検証を同じように入れる。いまは `JSON.parse()` だけで、形の違いは画面側まで届いている。

エラーのメッセージに API キーを含めない。応答の本文を載せるときは、いまと同じく先頭 300 文字までにする。

### 3.5 画像の送り方

- `messages` の `user` の `content` を配列にし、本文を先、画像を後に置く。画像は `{ "type": "image_url", "image_url": { "url": "data:<MIME>;base64,<データ>" } }` とする。
- さくらの Chat Completions が GIF を受け付けるかは確かめられていない。400 が返ったら受け皿に回す。
- 画像のサイズの上限（4MB）は変えない。

### 3.6 さくらの文字モデル（gpt-oss-120b）の扱い

- `temperature: 0` を送る。ただし、温度 0 でも答えが揺れる報告がある。同じ入力はプロセス内のキャッシュが同じ結果を返すので、1ページの作業の中では揺れない。
- `reasoning_effort` は `low` を既定にする。上げても差が出なかった報告があり、上げると出力のトークン（費用）が増えるためである。
- `max_tokens` は `SAKURA_AI_MAX_TOKENS` を送る。見出しの見直しは、ページ全体を1回で送るので出力も長くなる。

### 3.7 受け皿

- 受け皿に回すのは、失敗が 3.4 の 1〜4 のいずれかで、同じ提供元での1回のやり直しでも直らなかったときである。
- 受け皿に回したときは、応答の `fallback_used: true` と、実際に答えた提供元を返す。画面の費用の表示は受け皿の分も数える。
- 受け皿も失敗したら、いまと同じくエラーを返す。画面はルールベースの案を残す。

### 3.8 つなぎの Gemini 設定（L0）

Vertex AI の `gemini-2.5-flash` が 2026-10-20 に止まるので、さくらへの移行とは別に、次の3つを小さな変更として先に入れる。

- `GEMINI_VERTEX_LOCATION=global` のとき、宛先を `https://aiplatform.googleapis.com/v1/projects/{project}/locations/global/...` にする。いまは `global-aiplatform.googleapis.com` という存在しない宛先になる。
- 温度を `GEMINI_TEMPERATURE`（既定 0）で変えられるようにする。Gemini 3 系は、温度を既定の 1.0 のまま使うよう公式に推奨されているためである。
- Gemini 3 系の考える量を `GEMINI_THINKING_LEVEL`（既定は未設定で送らない）で指定できるようにする。既定の high では、費用と応答時間が増える。項目名と値は、実装前に公式の説明（`https://ai.google.dev/gemini-api/docs/gemini-3`）で確かめる。

本番の設定の選択肢は次のとおりで、どれにするかはユーザーが決める（6章）。

| 案 | 設定 | 単価（現行比） | 処理する場所 | 備考 |
|---|---|---|---|---|
| A | `GEMINI_VERTEX_LOCATION=asia-northeast1`、`GEMINI_MODEL=gemini-3.5-flash` | 入力5.5倍、出力4倍 | 東京 | 東京で使える後継はこれだけ |
| B | `GEMINI_VERTEX_LOCATION=global`、`GEMINI_MODEL=gemini-3.5-flash-lite` | 同じ | 保証なし | 上の宛先の修正が要る |
| C | API キー経由（Gemini API）に戻し、`gemini-2.5-flash` のまま | 同じ | 保証なし | 廃止日は未発表。55日保存。課金を有効にしたキーが要る |

A と B は Gemini 3 系なので、`GEMINI_TEMPERATURE=1` を合わせて設定する。
本番がすでに API キー経由なら、L0 の設定変更は要らない。

### 3.9 評価用の書き出し（`LLM_RECORD_DIR`）

評価（L2）では、実際の画面が送る要求を集めて、提供元ごとに流し直す。
要求の中身（どの項目を送るか）は画面の `app.js` が組み立てるので、サーバー側で受け取った時点で書き出すのが確実である。

- `LLM_RECORD_DIR` が設定されていると、`callLlm()` は呼ぶ前に、要求を1行の JSON としてそのフォルダーの `requests.jsonl` に追記する。項目は `task`、`kind`、`systemPrompt`、`userText`、`responseSchema`、`image_sha256`、`image_mime` である。画像の中身は `images/<sha256>.<拡張子>` に別に保存する。
- 提供元が設定されていなくても書き出す（書き出したあとで、いまと同じく `llm_not_configured` を返す）。これで、API キーが無くても評価用の要求を集められる。
- API キー、トークン、提供元の宛先は書き出さない。
- 本番では設定しない。README と Cloud Run の手順書に書く。

### 3.10 テスト

`test/llm/run-llm-tests.js` を新しく作る。
Node の `http` でさくらの呼び口をまねたモックのサーバーを立て、`SAKURA_AI_BASE_URL` をそこへ向ける。
gemini アダプターのテストのために、`GEMINI_API_BASE_URL`（既定は今の宛先）を足してモックへ向けられるようにする。

- 何も設定しないとき、`/api/llm/status` が `configured: false` を返し、2つの呼び口が 503 と `llm_not_configured` を返す（いまと同じ）。
- `GEMINI_API_KEY` だけのとき、送る本文がいまと同じ（`contents`、`systemInstruction`、`generationConfig` の温度 0 と `responseSchema`）。
- さくらの文字のタスク: 送る本文に、モデル名、`system` と `user` の2つの `messages`、`temperature: 0`、変換後のスキーマ（小文字の型、`additionalProperties: false`、`results` で包んだ形）が入る。返りは元の配列の形に戻る。費用が円の単価で計算される。
- さくらの画像のタスク: `image_url` が `data:<MIME>;base64,` の形で入る。
- コードブロックで囲まれた応答を取り出せる。
- 中身が空の応答と `finish_reason: "length"` の応答で、1回やり直し、なお失敗すれば受け皿に回る。
- `required` が欠けた応答で、やり直しと受け皿が働き、応答の `provider` が `gemini`、`fallback_used` が真になる。
- 429 で受け皿に回る。
- 受け皿が `none` のときは、エラーを返す。
- キャッシュの鍵が提供元ごとに分かれる。
- エラーのメッセージにも `LLM_RECORD_DIR` の書き出しにも、API キーが出ない。
- 13 のタスクのスキーマがすべて変換でき、大文字の型が残らない。
- L0: `GEMINI_VERTEX_LOCATION=global` の宛先、`GEMINI_TEMPERATURE`、`GEMINI_THINKING_LEVEL` が本文に反映される。Vertex AI 経由はメタデータサーバーが要るので、トークンの取得を差し替えられる形にして試す。

`package.json` に `"test:llm": "node test/llm/run-llm-tests.js"` を足す。

## 4. 実装ステージ

各ステージの終わりに5章の検証を通す。
コードの PR は、設計・レビュー担当の承認相当と Codex の二次レビューのあとで、ユーザーがマージを判断する。

**L0 つなぎ（10月20日への対応）**。
3.8 の3つの変更と、そのテストを入れる。
README と `CLOUD_RUN_DEPLOY.md` に、案 A、B、C の設定のしかたを書く。
本番の設定を変えるのはユーザーで、変えたら結果を記録する。
構造変更1 の S4 と触るファイルが重ならないので、並行して進めてよい。

**L1 提供元の切り替えの仕組み**。
3.1〜3.7、3.9、3.10 を実装する。
画面（`public/app.js`）には触れない。
L0 と同じ PR にしてもよい。分ける場合は L0 を先にマージする。

**L2 評価**。
`tools/llm-provider-eval.js` を作り、評価を1回行う。

- 要求を集める: `LLM_RECORD_DIR` を設定したサーバーで、佐賀市の実ページ51件（`agents-cli/datasets/saga-a11y-eval.json` の `old_html`）と、遠野市のページを画面の経路で処理する。
- 流し直す: 集めた要求を、Gemini（いまの設定）、さくらの文字モデル、さくらの画像モデルの候補（`preview/Qwen3-VL-30B-A3B-Instruct`、`preview/gemma-4-31B-it`）に流す。
- 測るもの: タスクごとの JSON の妥当率（1回目、やり直し後）、応答時間（中央値、95パーセンタイル）、1ページあたりの費用、真偽や分類の項目（`is_foreign`、`is_decorative`、`is_complex`、`has_embedded_text` など）の Gemini との一致率。
- 人が見るもの: 文言を作る項目（代替テキスト、見出しの文言、リンクの文言、表のキャプション、画像内の文字の書き起こし）を、Gemini とさくらで並べた表を CSV で出す。抜き取りで、タスクごとに20件、代替テキストは30件を人が「さくらが良い、同等、Gemini が良い」で判定する。
- 合格の目安（案。ユーザーが変えてよい）:
  - JSON の妥当率が、やり直しのあとで99%以上。
  - 真偽や分類の項目の一致率が90%以上。食い違った分は抜き取りで人が見て、さくらの誤りが Gemini の誤りより多くない。
  - 文言を作る項目で、「さくらが良い」と「同等」の合計が80%以上。
  - 応答時間の95パーセンタイルが45秒以内。見出しの見直しは90秒以内。
- 結果は `memory/llm-provider-eval-<日付>.md` に残す。画像のタスクは、合格しなければ Gemini のままにする。

L2 には、さくらの API キーと、評価する環境から `api.ai.sakura.ad.jp` へつなげることが要る。
Gemini との比較には Gemini の API キーも要る。

**L3 本番の切り替え**。
L2 の結果に従って、本番の Cloud Run の設定を変える（文字は `LLM_TEXT_PROVIDER=sakura`、画像は L2 の結果しだい、受け皿は `gemini`）。
あわせて、画面と文書を直す。
画面の変更は `public/app.js` に触れるので、構造変更1 の S4 がマージされてから行う。

- 画面: 外国語の候補の説明にある「(Gemini APIによる判定)」を「(AIによる判定)」にする。LLM の費用の表示に、答えた提供元を出す。
- 証跡: JSON のトップに `llm: { text_provider, text_model, vision_provider, vision_model }` を足す。候補ごとの列は足さない。
- 文書: README の LLM の節、`CLOUD_RUN_DEPLOY.md`、`LLM_DATA_POLICY.md`（さくらの約款の要点、保存と学習の扱い）、`public/verification-guide.html` の外部送信の説明、`WORKER_GUIDE.md`、`PROJECT_CONTEXT.md`（技術構成と設計判断、`updated`）。
- 発注元と自治体への説明文の案を作る。送信先がさくらインターネット（国内のデータセンター）に変わること、入力を学習に使わないことを書く。

## 5. 検証

各ステージで次を通す。

```
cd goal2-app
node --check server.js
node --check lib/llm.js
node test/llm/run-llm-tests.js
node test/run-tests.js
node test/goal2-output/run-output-tests.js
node test/table-nesting/run-table-tests.js
node test/michecker-parity/run-parity-tests.js
npm run test:saga-gold
```

- L0 と L1 では、LLM の設定を何も入れないときの画面の出力が変わらないことを、既存のテストで確かめる（上の4系統がそのまま通ること）。
- L1 では、`GEMINI_API_KEY` だけを設定したときに送る本文が、変更前と1バイトも変わらないことをテストで確かめる。
- L3 では、本番に近い設定（文字はさくら、受け皿は Gemini）で、佐賀市の数ページを画面で処理し、候補に AI の下書きが入ることを確かめる。

## 6. 決めてほしいこと

- L0 の本番の設定（案 A、B、C）。本番がすでに API キー経由なら不要。
- 画像のタスクをさくらのプレビューのモデルに載せるか。L2 の結果を見て決める。
- 評価と本番で使う、さくらの API キー。他のプロジェクトとは別に、このプロジェクト専用のものを発行するのが望ましい（費用を分けて見られ、止めるときに他へ響かない）。
- 発注元と自治体への説明の要否と時期。

## 7. 危険と対策

| 危険 | 対策 |
|---|---|
| さくらの画像モデルはプレビューで、予告なく終わる | 画像は受け皿を Gemini にする。モデル名は変数で替えられる |
| さくらの JSON Schema の強制が保証されていない | 送る前にスキーマをシステム指示にも書く。受け取ったら検証し、やり直しと受け皿で補う |
| gpt-oss-120b が中身の無い応答を返す | 出力の上限を大きめにし、中身が空の応答と打ち切られた応答を失敗として扱う |
| さくらの有償プランの上限が公開されていない | 429 は受け皿に回す。1分あたりの上限はいまの変数で絞れる |
| さくらに SLA が無い | 受け皿の Gemini を残す。画面はもともと、失敗してもルールベースの案で作業を続けられる |
| 保守のための保存期間が公開されていない | 送るのは公開済みのページで機密性が低いと判断している（1章）。必要になったらさくらに問い合わせる |
| 約款は、さくらの承諾なく第三者に使わせることを禁じている | 自社の作業者が使うツールなので当たりにくい。自治体の職員が直接使う形にするときは、さくらに確かめる |

## 8. 用語

- **提供元**：LLM を提供するサービス。ここでは Gemini（Gemini API と Vertex AI）とさくらの AI Engine。
- **アダプター**：提供元ごとの呼び出し方の違いを吸収する、`lib/llm.js` の中の処理。
- **受け皿**：主の提供元が失敗したときに代わりに呼ぶ提供元。
- **つなぎ**：さくらへの移行が終わるまで、Gemini を止めずに使い続けるための設定。
