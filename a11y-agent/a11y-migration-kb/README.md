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

## フロントマター規約
| フィールド | 説明 |
|---|---|
| `type` (必須) | migration-rule / workflow-step / cms-feature / reference / wcag-criteria |
| `processing_class` | mechanical / ai / hybrid / escalation |
| `municipality_specific` | true=「自治体毎に専用ルール有」 |
| `cms_auto` | CMS側で自動変換されるか |
| `known_failure` | 既知のAI失敗モード（例: v1.0-blindspot） |
| `wcag` / `jis` | 関連達成基準 |

## before/after 例の表記
本文 `# 例` 内で、ケース見出し＋ info string 付きフェンスを用いる。
ジェネレータはこの規約を解析して JSONL の `examples` 配列に変換する。

## JSONLの再生成
```bash
python3 tools/okf2jsonl.py --bundle . --out build/rules.jsonl
```

## 現状の規模
- migration-rule: 43ルール（text 15 / link 9 / table 9 / image 6 / file 2 / html-structure 2）
- 処理分類: mechanical 12 / ai 11 / hybrid 16 / escalation 4
- before/after 例: 52件

map・mobile ドメイン等を追加すれば 68 ルールへ拡張できる。
