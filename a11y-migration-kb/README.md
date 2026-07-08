# a11y-migration-kb （OKF v0.1 バンドル）

「データ移行総合マニュアル V2.01」を **OKF（Open Knowledge Format）** で再構成したアクセシビリティ移行ナレッジベース。
SMART CMSへの自治体サイト移行ルール・作業手順・WCAG根拠を、1ルール＝1Markdownファイルのグラフとして表現する。

## 構成
- `index.md` … バンドルのエントリ／規約定義
- `log.md` … 改訂履歴
- `workflow/` … 移行・公開の作業フロー、基本ルール
- `rules/` … 移行ルール（中核）。ドメイン別ディレクトリ
  - `text/ html-structure/ link/ image/ file/ table/`
- `cms/` … SMART CMS 機能・操作
- `reference/` … 移行管理シート記入欄・質問プロトコル等
- `wcag/` … WCAG 2.2 / JIS X 8341-3 根拠（章別。ルールのリンク先）
- `tools/okf2jsonl.py` … OKF→JSONLルール基盤ジェネレータ
- `build/rules.jsonl` … 生成物（migration-rule 概念から自動生成）
- `vendor/eclipse-actf/` … miChecker/HTML Checkerの公式チェック項目定義（`checkitem.xml`／`description_ja.properties`、EPL-1.0）。出典・ライセンスは同ディレクトリの`NOTICE.md`を参照
- `tools/actf2json.py` … `vendor/eclipse-actf/`→JSONL逆引きカタログジェネレータ
- `build/michecker-checkitems.json` … 生成物（`goal2-app`のmiChecker比較結果画面が、指摘内容から公式チェック項目・本KBルールへ逆引きするために使用）

## フロントマター規約
| フィールド | 説明 |
|---|---|
| `type` (必須) | migration-rule / workflow-step / cms-feature / reference / wcag-criteria |
| `processing_class` | mechanical / ai / hybrid / escalation |
| `municipality_specific` | true=「自治体毎に専用ルール有」 |
| `cms_auto` | CMS側で自動変換されるか |
| `known_failure` | 既知のAI失敗モード（例: v1.0-blindspot） |
| `wcag` / `jis` | 関連達成基準 |
| `origin` | ルールの出自。`manual`（「データ移行総合マニュアルV2.01」由来、省略時のデフォルト）／`michecker`（miChecker公式チェックエンジン由来）。同一の問題に対しマニュアル版とmiChecker版が別ファイルで存在する場合は `related` で相互リンクする |
| `michecker_check_ids` | 対応する miChecker（HTML Checker）公式チェック項目ID（例: `["C_51.0"]`）。出典: [eclipse-actf/org.eclipse.actf](https://github.com/eclipse-actf/org.eclipse.actf) の `checkitem.xml`／`description_ja.properties` |
| `includes` | マニュアル版ルールが、内容として内包している対応するmiChecker版ルールへのパス（例: `["/rules/link/link-purpose-standalone.md"]`）。マニュアル版の基準を満たせば、`includes`先のmiChecker版の指摘も通常あわせて解消される |

## before/after 例の表記
本文 `# 例` 内で、ケース見出し＋ info string 付きフェンスを用いる。
ジェネレータはこの規約を解析して JSONL の `examples` 配列に変換する。

## JSONLの再生成
```bash
python3 tools/okf2jsonl.py --bundle . --out build/rules.jsonl
python3 tools/actf2json.py --bundle . --out build/michecker-checkitems.json
```

## 現状の規模
- migration-rule: 62ルール（text 18 / link 10 / table 10 / image 9 / file 2 / html-structure 9 / form 4）
- 処理分類: mechanical 18 / ai 15 / hybrid 24 / escalation 5
- before/after 例: 82件
- うち`origin: michecker`（miChecker公式チェックエンジン由来）: 9ルール、うち2ルールは対応するマニュアル版ルールの`includes`に含まれる
- `michecker_check_ids`を持つルール: 29件（77チェック項目IDをカバー）。本文スコープ外として分類済みのチェック項目: 54件（`reference/michecker-out-of-content-scope.json`）
- 「KB未対応」項目が見つかった場合のトリアージ手順は [reference/michecker-triage.md](/reference/michecker-triage.md) を参照。

map・mobile ドメイン等を追加すればさらに拡張できる。
- 画像＋関連リンクの共通ルールは [rules/image/showcase-section.md](/rules/image/showcase-section.md) を参照。
