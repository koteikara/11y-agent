---
project: 11y-agent
repository: https://github.com/koteikara/11y-agent
status: active
updated: 2026-09-21
knowledge_mocs:
  - AI・自動化
  - UI・デザイン
  - 開発・トラブルシューティング
---

# プロジェクト概要

公共団体向けCMS（SMART CMS）への自治体サイト移行と、移行時に行うアクセシビリティ修正を効率化するためのワークスペースである。
移行作業者と承認者は、旧サイトの本文HTMLをCMSに登録し直す際、WCAG 2.0/JIS X 8341-3と総務省の評価ツールmiCheckerに沿って目視で修正している。
このリポジトリは、その修正ルールをナレッジベース（`a11y-migration-kb/`）として体系化し、作業者が1ページずつ修正候補を確認して最終HTMLと証跡を出力する実行画面（`goal2-app/`）を提供する。
事業前提、作業フロー、制約は `AGENTS.md` に、3つのゴール（Goal 1: 一括最適化、Goal 2: ページ単位支援、Goal 3: 本文抽出）は `workstream.md` にある。

## 現在の技術構成

| 分類 | 技術 | 用途 | 根拠となるファイル |
| --- | --- | --- | --- |
| 言語 | JavaScript (CommonJS) | サーバー、ブラウザUI、テスト、分析ツール | `goal2-app/package.json` (`"type": "commonjs"`)、`goal2-app/server.js`、`goal2-app/public/*.js` |
| 言語 | Python 3 | ナレッジベースのMarkdownからJSONLを生成するジェネレータ | `a11y-migration-kb/tools/okf2jsonl.py`、`actf2json.py`、`gen_michecker_inventory.py` |
| 言語 | Google Apps Script | 移行記録スプレッドシートの作業時間計測サイドバー | `spreadsheet-gas/Code.gs`、`Index.html`、`appsscript.json` |
| ランタイム | Node.js 20以上 | Goal 2/3実行画面のHTTPサーバー | `goal2-app/package.json` (`engines.node >=20`)、`goal2-app/Dockerfile` (`node:20-alpine`) |
| フレームワーク | なし（Node標準 `http` モジュール） | 静的配信、ルールAPI、URL取得API、LLM中継API。npm依存は0件 | `goal2-app/server.js`、`goal2-app/package.json` (`dependencies` なし) |
| UI | 素のHTML/CSS/JS | Goal 2候補確認画面 (`index.html`/`app.js`)、Goal 3抽出画面 (`goal3.html`)、Goal 1画面 (`goal1.html`)、miChecker比較画面 (`michecker-compare.html`)、検証ガイド | `goal2-app/public/` |
| データ保存 | JSONL/JSONファイル（読み取り専用） | KBルール62件とmiChecker公式チェック項目を起動時に読み込む。永続化DBは無い | `goal2-app/data/rules.jsonl`、`goal2-app/data/michecker-checkitems.json`、`a11y-migration-kb/build/` |
| ナレッジ形式 | OKF (Open Knowledge Format) Markdown + フロントマター | 1ルール1ファイルの移行ルールグラフ。ジェネレータでJSONL化 | `a11y-migration-kb/README.md`、`a11y-migration-kb/rules/` |
| 外部サービス | Google Gemini API / Vertex AI (Gemini 2.5 Flash) | 画像alt下書きなどのLLM補助。`GEMINI_API_KEY` 未設定時は呼び出されない | `goal2-app/lib/llm.js`、`goal2-app/lib/llm-prompts.js`、`goal2-app/LLM_DATA_POLICY.md` |
| 外部ツール | miChecker / htmlchecker.exe (Eclipse ACTF) | ローカルWindows版でのアクセシビリティ検査の自動実行。公式チェック項目定義を同梱 | `goal2-app/server.js`（`MICHECKER_HTMLCHECKER_EXE`）、`a11y-migration-kb/vendor/eclipse-actf/` |
| インフラ・配信 | Google Cloud Run (asia-northeast1) + Cloud Build + Artifact Registry | ホスト版の配信。手元PowerShellから `gcloud builds submit` と `gcloud run deploy` で手動デプロイ | `goal2-app/Dockerfile`、`goal2-app/CLOUD_RUN_DEPLOY.md` |
| インフラ・配信 | Node.js SEA (Single Executable Applications) + esbuild + postject | Windows向け単一 `.exe` 配布 | `goal2-app/build-windows-app.bat`、`goal2-app/sea-config.json`、`goal2-app/LOCAL_WINDOWS_APP.md` |
| テスト | Node標準 `assert` + 自作ランナー | サーバー起動を含む統合テスト、miChecker互換テスト、表ネストテスト、出力テスト。外部テストフレームワークは無い | `goal2-app/test/run-tests.js`、`goal2-app/test/*/` |
| 開発ツール | Claude Code / Codex 向け指示ファイルとスキル | エージェント作業方針、日本語スタイル指針、変更履歴 | `AGENTS.md`、`.claude/skills/natural-japanese/`、`CHANGELOG.md`、`done-definition.md`、`memory/` |

Lint、フォーマッター、CI/CD設定（`.github/`）、lockファイルは存在しない。

## アーキテクチャ

主要コンポーネントは3つで、ナレッジベースがルールの正本、実行画面がその適用先、スプレッドシートGASが作業記録の補助という関係にある。

```mermaid
flowchart LR
  KB[a11y-migration-kb/<br>OKF Markdown ルール] -->|okf2jsonl.py / actf2json.py| BUILD[build/rules.jsonl<br>build/michecker-checkitems.json]
  BUILD -->|手動コピー| DATA[goal2-app/data/]
  DATA --> SRV[goal2-app/server.js<br>Node標準http]
  SRV -->|/api/rules 等| UI[public/ ブラウザUI<br>Goal 1 / 2 / 3 / miChecker比較]
  SRV -->|GEMINI_API_KEY設定時のみ| GEMINI[Gemini API / Vertex AI]
  SRV -->|Windows .exe版のみ| MIC[htmlchecker.exe]
  UI -->|最終HTML + 証跡JSON/CSV| OUT[CMS登録 / スプレッドシート]
  GAS[spreadsheet-gas/] --> OUT
```

データの流れは次の通り。

1. 作業者はGoal 3画面で旧ページ全体HTMLから本文を抽出するか、Goal 2画面に本文HTML断片を直接貼り付ける。
2. ブラウザ側の `app.js` がKBルールに基づいて修正候補を生成し、作業者は候補ごとに採用、編集して採用、却下、要確認を選ぶ。
3. 画面は最終HTMLと証跡（JSON/CSV）を出力し、作業者がCMSとスプレッドシートへ手動で反映する。
4. miChecker比較画面は、移行前後の検査結果CSVを読み込み、指摘を新規、未解消、解消に分類してKBルールへ逆引きする。

候補生成のロジックはサーバーではなくブラウザ側の `public/app.js`（約8,400行）にある。
サーバーはルール配信、URL取得（SSRF対策付き）、LLM中継、htmlchecker.exe実行に限られる。

## 重要な設計判断

- **npm依存なしのNode標準サーバー**を採用している。Cloud RunとWindows単一 `.exe` の両方へ同じ `server.js` を配布するためで、SEA化の手順書がその制約を説明している（`LOCAL_WINDOWS_APP.md`）。
- **ナレッジベースを1ルール1Markdown（OKF）で管理**し、JSONLは生成物として扱う。ルール本文と根拠（WCAG/JIS、miCheckerチェック項目ID）を人が読める形で保つためである（`a11y-migration-kb/README.md`）。
- **修正対象を本文コンテンツに限定**する。テンプレート起因の指摘は `content`、`old-site-template`、`new-cms-template`、`unknown` に分類し、本文起因のものだけを修正候補にする（`AGENTS.md`）。
- **miCheckerを主基準ではなく品質ゲート候補**として扱う。KB全ルールを既定とし、miChecker指摘のみへ絞るモードは案件の検収条件を確認したうえで使う（`AGENTS.md`）。
- **LLM連携は既定で無効**。実案件HTMLと画像を外部LLMへ送る合意が未確定のため、`GEMINI_API_KEY` の設定を運用判断に委ねている（`goal2-app/LLM_DATA_POLICY.md`）。
- **AI生成は部品別Skillと生成後レビューで扱う**。table、画像alt、見出しなど失敗パターンが異なる部品を同じプロンプトで処理しない（`AGENTS.md`、`memory/ai-accessibility-skills-policy.md`）。
- **Cloud Runをホスト第一候補**にした理由は `memory/goal2-hosting-candidates.md` にある。認証、永続保存、ログ方針は未決定のまま公開URLで運用している。
- 候補生成ロジックをブラウザ側に置いた理由は、実装から読み取れない。理由未確認。
- 外部検査エンジン（axe-core、A11yc library）を組み込まない判断は、`memory/project-state.md` で未決定として残っている。理由未確認。

## 実行と検証

開発環境の起動は次の通り。

```bash
cd goal2-app
npm start        # http://localhost:8080
```

テストは次の通り。すべて `goal2-app/` 内で実行する。

```bash
npm test                      # 統合テスト（サーバーを起動して検証）
npm run test:michecker-parity
npm run test:table-nesting
npm run test:goal2-output
npm run test:saga-gold        # 佐賀市 old/gold fixture との比較
```

2026-09-21時点で `npm test` はNode 22で成功した。

ナレッジベースのJSONL再生成は次の通り。生成後、`build/` の2ファイルを `goal2-app/data/` へ手動でコピーする（自動同期は無い）。

```bash
cd a11y-migration-kb
python3 tools/okf2jsonl.py --bundle . --out build/rules.jsonl
python3 tools/actf2json.py --bundle . --out build/michecker-checkitems.json
```

ビルドとデプロイは2系統ある。

- Cloud Run: `goal2-app/CLOUD_RUN_DEPLOY.md` のPowerShell手順で、GitHubの `main` を別フォルダへ同期してから `gcloud builds submit` と `gcloud run deploy` を実行する。
- Windows `.exe`: `goal2-app/build-windows-app.bat` を実行する。Node.js 20以上とsigntoolが必要（`LOCAL_WINDOWS_APP.md`）。

環境変数名は次の通り（値は記載しない）。

- サーバー: `PORT`、`GOAL2_RULES_PATH`、`GOAL2_MICHECKER_CHECKITEMS_PATH`
- LLM: `GEMINI_API_KEY`、`GEMINI_MODEL`、`GEMINI_AUTH_MODE`、`GEMINI_VERTEX_PROJECT`、`GEMINI_VERTEX_LOCATION`、`LLM_MAX_CALLS_PER_MINUTE`、`GEMINI_INPUT_PRICE_PER_1M_TOKENS`、`GEMINI_OUTPUT_PRICE_PER_1M_TOKENS`、`USD_JPY_RATE`
- ローカル検査: `MICHECKER_HTMLCHECKER_EXE`、`PLAYWRIGHT_CHROMIUM_PATH`
- テスト: `TABLE_TEST_PORT`、`OUTPUT_TEST_PORT`

## ForLLMとの関連

- `[[AI・自動化]]` — Gemini連携による画像alt下書き、KBルールに基づく修正候補の自動生成、AI生成を部品別Skillと生成後レビューで扱う方針を実装している。LLMへのデータ送信ポリシーの判断もここに蓄積する。
- `[[UI・デザイン]]` — 作業者向けの候補確認画面、miChecker比較画面、検証ガイドを素のHTML/CSSで作っている。アクセシビリティ規則（WCAG/JIS、miChecker）の適用先として参照する。
- `[[開発・トラブルシューティング]]` — Cloud Runの手動デプロイ、Node SEAによるWindows `.exe` ビルド、htmlchecker.exe連携の障害対応の知識を蓄積する。

MOC名はVault側で未確認のため、上記は要確認候補である（本ファイル末尾の未解決事項を参照）。

## 未解決事項

- `a11y-agent/` ディレクトリは、`a11y-migration-kb/` と `goal2-app/data/` の古い複製である。`README.md`、`build/rules.jsonl` が現行と異なり、miChecker関連ルールを含まない。由来は `CHANGELOG.md` に記録が無く、削除してよいか判断できない。
- `goal2-app/README.md` は「まだ扱わないもの」に「miCheckerの自動実行」を挙げているが、`server.js` はhtmlchecker.exeの自動実行を実装済みである（Windows `.exe` 版に限る）。READMEの記述が古い。
- `goal2-app/README.md` の説明は「Goal 2の最小実行画面」だが、実際には `goal1.html`（Goal 1）と `michecker-compare.html` も同居しており、package名 `goal2-a11y-review-poc` とディレクトリ名は範囲より狭い。
- `goal2-app/server.err.log`、`server.out.log`、`tmp/` がリポジトリにコミットされている。意図的かどうか未確認。
- lockファイルが無い。npm依存が0件のため現状は問題にならないが、ビルド時に `npx esbuild` と `npx postject` を未固定バージョンで取得している。
- CI/CD設定が無く、テストはローカルでのみ実行される。
- KBの `build/` から `goal2-app/data/` への同期が手動で、ずれると画面のルールが古くなる。2026-09-21時点では一致している。
- Cloud Run上の認証、実案件データの送信ポリシー、証跡の永続保存先は未決定（`memory/project-state.md` の「Not Completed Yet」）。
- CMS入力欄で許可されるHTMLタグと属性の制約は未確認で、最終HTML出力に反映されていない。
- ForLLM VaultのMOC名は本ファイル作成時に確認できなかった。Vault側で実在するMOC名に合わせて `knowledge_mocs` を修正する必要がある。
