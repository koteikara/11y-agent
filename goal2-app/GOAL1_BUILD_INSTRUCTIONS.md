# GOAL1 構築指示書(実装担当AGENT向け)

この文書は、GOAL1(CMS登録前の一括アクセシビリティ最適化)を実装するAGENTへの指示書である。
設計判断はユーザーと合意済みであり、**この文書に書かれた設計を変更する場合は必ずユーザーに確認してから**進めること。

## 0. 作業の前に必ず読むもの

| ファイル | 読む目的 |
|---|---|
| `workstream.md`(リポジトリルート) | GOAL1/2/3の定義。GOAL1のTarget Flow 1〜6が今回の実装範囲 |
| `CHANGELOG.md`(リポジトリルート) | 記録フォーマットと直近の変更履歴 |
| `memory/project-state.md` | プロジェクト経緯。追記ルールは本書 §8 参照 |
| `goal2-app/public/app.js` | GOAL2本体(約8,400行)。候補生成エンジンの実体 |
| `goal2-app/public/goal3.js` | GOAL3本体(約880行)。本文抽出エンジンの実体 |
| `goal2-app/server.js` | 素のNode http サーバー。`/api/fetch-html`・`/api/llm/*`・`/api/rules` |

## 1. GOAL1とは(実装範囲)

既存のGOAL3(本文抽出)とGOAL2(修正候補生成・適用)のエンジンを、**複数ページに対して一括実行し、結果を作業一覧として管理する画面**を新設する。

```
ページ一覧入力(CSV/URL/HTMLファイル)
  → [ページごとに] 取得 → 本文抽出(GOAL3エンジン) → 候補生成(GOAL2エンジン)
  → 安全な候補のみ自動採用
  → 修正後HTML + 証跡 + 要確認一覧を出力
  → 要確認が残るページだけGOAL2画面で個別レビュー
```

CMS登録後のmiChecker比較(workstream.md Target Flow 8)は既存の`michecker-compare.html`をそのまま使うため、実装対象外。

## 2. 確定済み設計判断(変更にはユーザー確認が必要)

1. **バッチ処理はブラウザ側で実行する。** 候補生成・抽出エンジンはDOM(DOMParser等)に全面依存しており、サーバーで動かすにはjsdom等の新規依存が必要になるため。このリポジトリは「npm依存を増やさない」方針(package.json参照。実行時依存ゼロ)。LLM呼び出しは従来どおりサーバー経由。
2. **エンジンのヘッドレス化リファクタを先行する(PR-A)。** UIをiframeで裏から操作する案は不採用。
3. **自動採用の範囲**: 既存の一括採用と同じ判定(`canBulkAcceptCandidate` = 未処理 かつ `acceptDisabledReason()`が空)を満たす候補のみ自動採用する。この判定関数を単一ソースとして再利用し、GOAL1用に別の判定を書かないこと。ユーザー承認済み: 「機械的・確信度十分・人間確認不要のみ自動採用」。
4. **バッチ状態の保存はブラウザのIndexedDB。** 本番想定のCloud Runはインスタンス揮発性のためサーバー側ファイル保存は永続化にならない。localStorageは容量不足(約5MB)。持ち運び・長期保管はバッチJSONのダウンロード/読み込みで担保。
5. **GOAL2への個別引き継ぎは既存の`goal3.toGoal2`(localStorage)方式を拡張する。** 判断済み状態の完全なインポート機構は作らない(PoC簡略化)。
6. **入力はCSV・URL一覧・ローカルHTMLファイル複数アップロードの3系統**(ユーザー承認済み)。CSV仕様は §4 に従うこと。

## 3. 既存コードの構造(実装に必要な事実)

### 3.1 goal2エンジン(public/app.js)

- 全体が `(function () { "use strict"; ... })()` のIIFE。冒頭で `els` オブジェクトに `document.getElementById()` の結果を束ね、330行目付近で `addEventListener` を張る。**goal1.htmlにはこれらの要素が無いため、そのまま読み込むとTypeErrorで落ちる。** UI初期化部を「要素が存在する場合のみ実行」にゲートする必要がある。
- 解析パイプラインの入口は `async function analyze()`(548行目付近)。流れ:
  `parseFragment(html)` → `generateCandidates(fragment)` → ruleScopeModeフィルタ → `enrichLinkTitleCandidates` → `Promise.all([enrichWithLlm, enrichImageAltWithLlm, enrichHeadingReviewWithLlm, enrichAvoidTextAsImageWithLlm, enrichAsciiArtWithLlm])` → `enrichLayoutTableImagesWithLlm`(直列、重複vision呼び出し回避のため順序固定) → candidates/notices分離・ID付番。
- パイプライン内の画面依存は浅く、以下のみ:
  - `els.pageTitleInput?.value`(enrichWithLlmのコンテキスト構築、1箇所)
  - `els.oldUrlInput?.value`(画像URL絶対化のbaseUrl、3箇所: 1123/1234/1328行付近)
  - UIステータス表示(`setAnalyzeStatus`等)
- `makeCandidate()` は `state.ruleMap` に依存。`loadRules()`(/api/rules)の完了が前提。
- `state.llmUsage` にLLMコストを累積(analyze冒頭でリセット)。
- 証跡は `buildEvidence(finalHtml)`(7173行付近)。`els.pageTitleInput`/`els.oldUrlInput`/`els.cmsTargetInput`/`els.workerInput` を直接読む → ヘッドレス化ではコンテキスト引数化が必要。
- 自動採用の判定: `canBulkAcceptCandidate(candidate)`(5740行付近) = 未処理 かつ `acceptDisabledReason(candidate)` が空文字。`acceptDisabledReason` はAI画像名の投入待ち・文言確認必須の候補を弾く。
- GOAL3からの引き継ぎ: 435〜451行付近。`localStorage.getItem("goal3.toGoal2")` → `{html, pageTitle, oldUrl}` を入力欄に流し込むだけ(解析は作業者が「候補生成」を押す)。

### 3.2 goal3エンジン(public/goal3.js)

- 同じくIIFE + `els` 束縛。UI初期化ゲートが同様に必要。
- 抽出の実体 `buildContentCandidates(document, pageTitle)`(92行目)は **既にほぼ純粋関数**(DOMParserで作ったDocumentとページタイトルを受け取り、候補配列を返す)。スコア順上位5件を返す。
- 候補オブジェクトは `{id, html, score, textLength, parts: {headings, tables, ...}, ...}`。

### 3.3 サーバー(server.js)

- `/api/fetch-html`: SSRF対策付き(http/httpsのみ、内部ホスト拒否)。**内部ホスト拒否のため、localhost相手のURL取得テストはできない**(§7参照)。
- `/api/llm/*`: `GEMINI_API_KEY`未設定なら即エラー → クライアントはヒューリスティック結果のまま(サイレントフォールバック)。インメモリキャッシュと`LLM_MAX_CALLS_PER_ANALYZE`ガードあり。

## 4. CSV入力仕様(ユーザー提供の実CSVに準拠)

ユーザーの移行管理スプレッドシートからエクスポートされる実CSVの仕様。サンプルは安城市50行(実在URL)で確認済み。

- **エンコーディング: CP932(Shift_JIS)**。Excel出力のため。読み込み手順:
  1. FileをArrayBufferで読む
  2. UTF-8 BOMがあれば `utf-8`
  3. なければ `new TextDecoder("utf-8", { fatal: true })` で試行、例外なら `new TextDecoder("shift_jis")` にフォールバック
- ヘッダー行(22列)。**列は名前で解決すること(位置に依存しない)**:
  `移行管理ID, 素材保存先グループ, 署名タイトル, 簡易アンケートタイトル, ページタイトル, テンプレートNo, 移行元URL, ファイル名, 移行先カテゴリ, ステータス, 公開開始日時, 公開終了日時, 地図情報(緯度:経度:縮尺), キーワード, ページ概要, 新着表示(トップ), 新着表示(カテゴリ), rss出力, twitter出力, facebook出力, 差分取り込み, ページNo`
- 使用する列と対応:

  | CSV列 | GOAL1内部フィールド | 備考 |
  |---|---|---|
  | 移行管理ID | `id` | ページ行の主キー。例: `aitest-anjo-001` |
  | ページタイトル | `pageTitle` | goal2の「ページ名」に渡す |
  | テンプレートNo | `templateNo` | 分類表示に使う(PR-D) |
  | 移行元URL | `url` | 必須。空行はスキップし、スキップ件数を表示 |
  | 移行先カテゴリ | `category` | 例: `ホーム/移行コスト削減PJ/安城市`。分類表示に使う |
  | ステータス | `sourceStatus` | 参考情報として一覧に表示のみ |

  その他の列は無視してよい(取り込んでも使わない)。
- **同一URLの重複行が実データに存在する**(例: aitest-anjo-006と027、007と028が同一URL)。重複は除去せず両方独立した行として扱い、一覧に重複警告バッジを表示する。
- CSVパーサは引用符・引用符内カンマ・改行を扱える簡易ステートマシンを自前実装する(依存追加禁止)。1行目に `移行管理ID` と `移行元URL` の両方が含まれる場合のみこのフォーマットとして解釈する。
- CSVフォーマットでない場合のフォールバック: 1行1URL(`https://...`)、または `URL,カテゴリ` の2列として解釈する。

## 5. 画面設計(新規 `public/goal1.html` + `public/goal1.js`)

`goal3.html`のページ構成・スタイル(styles.css共通)を踏襲する。ヘッダーにGOAL2/GOAL3への相互リンク(既存ページのナビと同様)。

| 区画 | 内容 |
|---|---|
| ① 入力 | (a) CSVファイル選択(§4)、(b) URL一覧テキストエリア(1行1URL / `URL,カテゴリ`)、(c) ローカルHTMLファイル複数選択(`<input type="file" multiple accept=".html,.htm">`)。(c)は1ファイル=1ページ、`id`はファイル名、`pageTitle`はHTMLの`<title>`から自動抽出 |
| ② 実行設定 | 修正基準(KB全ルール/miChecker指摘のみ — 既存`ruleScopeMode`と同じ2値)、LLM利用のON/OFF表示(サーバーの設定状態を`/api/llm`系の既存挙動で判定、キー未設定なら「LLMなし(コストゼロ)」と明示)、抽出候補はスコア1位を自動採用する旨の説明 |
| ③ 実行 | 「一括実行」ボタン。進捗表示(N/M件目、現在工程: 取得中/抽出中/候補生成中/自動採用中)、一時停止/再開、**1ページの失敗でバッチを止めない**(エラーは行のステータスに記録して次へ) |
| ④ 作業一覧 | 1ページ1行のテーブル。列: ID、ページ名、カテゴリ、状態(取得失敗/抽出失敗/完了)、候補総数、自動採用数、**要確認残数**、LLM概算コスト、重複警告。操作: 「GOAL2で開く」「修正後HTMLコピー」「証跡JSON DL」 |
| ⑤ バッチ出力 | 「証跡CSV一括DL」(§6.3)、「バッチJSON DL」「バッチJSON読み込み」、ルール別出現頻度サマリー(PR-D) |

ページは順次処理(直列)。ページ内部のLLM enrichmentの並列性は既存のまま。

## 6. 実装ステージ(PR単位)

**各PRは独立してマージ可能な状態で作り、PRごとに §7 の検証を通し、コミット前にユーザー確認を取ること。**

### PR-A: エンジンのヘッドレス化(UI・挙動変更なし)

最重要かつ最リスク。**このPRでは画面の見た目・候補の内容・件数を1件たりとも変えないこと。**

1. `public/goal3.js`:
   - UI初期化(els束縛後のaddEventListener群)を「必要な要素が存在する場合のみ」実行するようゲート。
   - `window.goal3Engine = { extract(html, pageTitle) }` を公開。実体は `DOMParser` + 既存 `buildContentCandidates(document, pageTitle)` の薄いラッパー。戻り値は既存の候補配列そのまま。
2. `public/app.js`:
   - UI初期化を同様にゲート(`els.analyzeButton` 等の存在チェック)。
   - 解析コンテキストの導入: モジュールレベルに `let analysisContext = null;` を置き、`currentPageTitle()` / `currentOldUrl()` ヘルパー経由で読むよう、既存の `els.pageTitleInput?.value` / `els.oldUrlInput?.value` 直読み(4箇所)を置き換える。ヘルパーは `analysisContext` があればそれを、なければ従来どおり `els` を読む。
   - `analyze()` の中核を `async function runAnalysis(html, context)` として抽出し、`{candidates, notices, llmUsage}` を返す純関数化(UIの`state`書き込み・`renderAll`・ステータス表示は既存`analyze()`側に残す)。
   - `buildEvidence` をコンテキスト引数版(`buildEvidenceFor(context, candidates, notices, finalHtml)`等)に整理し、既存呼び出しは従来の値を渡すだけにする。
   - `window.goal2Engine = { async init(), async analyze({html, pageTitle, oldUrl, ruleScopeMode}), autoAcceptSafe(candidates), buildEvidence(...) }` を公開。`init()` は `loadRules()` 未実行なら実行。`autoAcceptSafe` は既存 `canBulkAcceptCandidate` をそのまま使い、該当候補に `decision = {status: "accepted", actor: "goal1-batch", decided_at, reason: "一括自動採用(機械的・確認不要)"}` を設定して採用件数を返す。
   - 最終HTML生成(`rebuildWorkingHtml`相当)もヘッドレスで呼べるよう、`state`直依存があれば同様にパラメータ化する。
3. **合格条件**: §7.1 の回帰チェックが完全一致(11/10/23/29/5/20 + ルール別内訳一致)。goal2/goal3画面の手動スモーク(サンプル読込→候補生成→採用→出力)が従来どおり動く。

### PR-B: goal1.html骨格 + バッチ実行 + IndexedDB

1. `public/goal1.html` / `public/goal1.js` 新設(§5の①〜④)。server.jsの静的配信は既存の仕組みで賄えるか確認し、必要ならルート追加。
2. 入力3系統(§4/§5①)のパースとページ一覧構築。
3. バッチループ(直列):
   - URL系: `POST /api/fetch-html`(既存)で取得。失敗は行ステータス「取得失敗」。
   - ファイル系: FileReaderで読む。
   - `goal3Engine.extract(html, pageTitle)` → 0件なら「抽出失敗」。スコア1位を採用。
   - `goal2Engine.analyze({html: 抽出HTML, pageTitle, oldUrl: url, ruleScopeMode})` → `autoAcceptSafe()` → 証跡構築。
4. IndexedDB保存: DB名 `goal1`、ストア `batches`(キー: `batchId` = 生成時タイムスタンプ)。バッチオブジェクト: `{batchId, createdAt, settings, pages: [{id, url, pageTitle, category, templateNo, sourceStatus, status, extractedHtml, finalHtml, evidence, autoAcceptedCount, remainingCount, llmUsage, error, duplicateUrl}]}`。元ページの全体HTMLは保存しない(容量対策。抽出後HTMLと証跡のみ)。ページ再読み込みで最新バッチを復元表示。
5. **合格条件**: 既存6サンプル相当のHTMLファイル複数アップロード(§7.2の方法で用意)でバッチが完走し、一覧の候補数/自動採用数/要確認残数が、同じHTMLをGOAL2単体で解析した結果と一致する。1ファイル壊れたHTMLを混ぜてもバッチが最後まで走る。§7.1回帰も引き続き一致。

### PR-C: 出力系

1. **証跡CSV一括DL**: ページ×候補の明細CSV(1行=1候補)。列は既存 `buildEvidence` のcandidates要素に準拠しつつ、先頭に `移行管理ID(=page id)`, `ページ名`, `URL`, `カテゴリ` を付ける。**UTF-8 BOM付き**で出力(Excelでの文字化け防止)。あわせてページ単位サマリーCSV(1行=1ページ: ID/ページ名/URL/カテゴリ/状態/候補総数/自動採用数/要確認残数/LLM概算コスト/エラー)も出す。
2. **バッチJSONのDL/読み込み**(IndexedDBオブジェクトのシリアライズ)。
3. **GOAL2引き継ぎ**: `localStorage["goal3.toGoal2"]` のペイロードを `{html, pageTitle, oldUrl, autoAcceptSafe: true}` に拡張。app.js側は、このフラグ付きで引き継がれた場合、作業者が「候補生成」を実行した完了直後に `autoAcceptSafe` 相当の一括採用を1回だけ適用する(適用済みフラグで再適用を防ぐ)。既存の引き継ぎ(フラグなし)の挙動は不変。
4. **合格条件**: CSVがExcel/スプレッドシートで開けて文字化けしない。GOAL2引き継ぎ後の要確認残数がgoal1一覧の値と一致する(LLMなし環境では厳密一致するはず。機械的候補は決定的なため)。

### PR-D: 分類・サマリー・本番検証

1. 作業一覧のカテゴリ/テンプレートNoによるグルーピング表示(ソート+グループ見出しで十分。ツリーは不要)。
2. ルール別出現頻度サマリー(バッチ全体で rule_id ごとの候補数・自動採用数・要確認数)。「同種修正の一括適用しやすさ」(workstream.mdのExpected Benefits)の判断材料になる。
3. LLM有効環境(ユーザーがテスト用APIキーを提供した場合のみ)での実地検証。**キーの扱いは §8 のセキュリティルール厳守。**

### 将来拡張(今回は実装しない)

テンプレート構造の自動判別、htmlchecker.exe一括事前検査(Windows限定)、判断済み状態の完全インポート、抽出候補の1位以外への差し替えUI。

## 7. 検証手順

### 7.1 回帰チェック(全PRで必須)

**基準値(2026-07-14時点、PR #58マージ後)**: `procedure-overview 11 / images 10 / tables 23 / links-text 29 / iframe 5 / goal3-hirosaki-news2019 20`(候補+注意の合計件数)。ルール別内訳も差分がないこと。

手順:

```bash
cd goal2-app
node --check public/app.js
unset GEMINI_API_KEY GEMINI_AUTH_MODE   # LLM無効=決定的な結果で比較する
nohup node server.js > /tmp/server.log 2>&1 &
sleep 1 && curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8080/   # 200を確認
```

Playwright検証スクリプト(作業用ディレクトリに置いて実行。`npm init -y && npm install playwright --no-save` 後、ブラウザは `executablePath: "/opt/pw-browsers/chromium"` を指定):

```js
const { chromium } = require("playwright");
const BASE_URL = "http://localhost:8080/";
async function main() {
  const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
  const page = await browser.newPage();
  await page.goto(BASE_URL, { waitUntil: "load" });
  const sampleIds = await page.$$eval("#sampleSelect option", (opts) => opts.map((o) => o.value));
  const results = {};
  for (const id of sampleIds) {
    await page.goto(BASE_URL, { waitUntil: "load" });
    await page.selectOption("#sampleSelect", id);
    await page.evaluate(() => document.getElementById("loadSampleButton").click());
    await page.evaluate(() => document.getElementById("analyzeButton").click());
    await page.waitForFunction(() => {
      const el = document.getElementById("evidenceOutput");
      if (!el || !el.value) return false;
      try { return JSON.parse(el.value).generated_at !== null; } catch { return false; }
    }, { timeout: 20000 });
    const evidence = JSON.parse(await page.$eval("#evidenceOutput", (el) => el.value));
    const ruleCounts = {};
    [...evidence.candidates, ...evidence.notices].forEach((c) => { ruleCounts[c.rule_id] = (ruleCounts[c.rule_id] || 0) + 1; });
    results[id] = { total: evidence.candidates.length + evidence.notices.length, ruleCounts };
    console.error(`done: ${id} total=${results[id].total}`);
  }
  await browser.close();
  console.log(JSON.stringify(results, null, 2));
}
main().catch((err) => { console.error(err); process.exit(1); });
```

### 7.2 GOAL1のE2E検証(PR-B以降)

- **この開発環境のプロキシは一般Webサイトへのアクセスを全面ブロックしている**(パッケージレジストリ等のみ許可)。さらに `/api/fetch-html` はSSRF対策で内部ホストを拒否するため、**URL取得経路のE2E検証はこの環境では不可能**。URL経路はコードレビューで担保し、実地検証は本番/ローカル環境でユーザーに依頼する。
- E2Eは**ローカルHTMLファイルアップロード経路**で行う。既存6サンプルのHTML(app.jsの`inputSamples`配列)をファイルに書き出してテストデータにする。CSV経路は §4 のサンプル構造を模したテストCSV(CP932で保存すること: `python3 -c "open('test.csv','wb').write(text.encode('cp932'))"` 等)で検証する。
- Playwrightスクリーンショット検証時の既知の落とし穴:
  - `page.click()` 後はマウスカーソルが要素上に残り、`:hover` スタイルが撮影結果を汚染する。**スクリーンショット前に必ず `await page.mouse.move(0, 0);`**。
  - 画面下部に「次にやること」パネルが被る。`.page-agent-close` ボタンがあればクリックして閉じてから撮影する。

## 8. リポジトリ運用ルール(このプロジェクトの既定)

1. **ユーザーへの応答は常に日本語。**
2. **コミット前に必ずユーザー確認を取る**(実装→検証→スクリーンショット等の証跡提示→確認→コミット→プッシュ→PR作成、の順)。
3. 変更のたびに `CHANGELOG.md`(新エントリを先頭、フォーマット例ブロックの直後に挿入)と `memory/project-state.md`(`## Decisions` セクションの前に進捗を追記)を更新し、同じコミットに含める。
4. PRマージ後は `git fetch origin main && git checkout -B <作業ブランチ名> origin/main` でブランチを再構築する。マージコミットに対するStop hookの「Unverified」警告は既知の非問題(GitHubのマージボタン由来)。作業ツリーがクリーンであることだけ確認して無視してよい。
5. **APIキーをリポジトリ管理下のファイルに書かない・ステージしない・コミットしない。** ユーザーからテスト用キーを受け取った場合はリポジトリ外の作業用ディレクトリに `chmod 600` で保存し、検証後 `rm -f` で削除して削除済みであることを確認・報告する。
6. npm依存を追加しない(検証用のPlaywrightは作業用ディレクトリに `--no-save` で入れる。リポジトリのpackage.jsonに追加しない)。
7. サーバー起動時は `unset GEMINI_API_KEY GEMINI_AUTH_MODE` してから起動する(検証を決定的にするため。LLM検証はPR-Dでのみ、ユーザー提供キーで行う)。
