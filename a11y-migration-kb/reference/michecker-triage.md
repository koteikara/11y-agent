---
type: reference
title: miChecker指摘のトリアージ手順（KB未対応項目の扱い）
timestamp: 2026-07-08T00:00:00Z
---

# miChecker指摘のトリアージ手順

goal2-appのmiChecker比較画面（`michecker-compare.html`）の「対応ルール」列に**「KB未対応」**と表示された指摘は、本KBがまだ扱えていない項目である。放置せず、次の3択のいずれかにトリアージして、KBを継続的に育てる。

## トリアージの3択

1. **既存ルールへのタグ追記** — 既存ルールの本文が実質的にその指摘をカバーしている場合（＝そのルールに従って修正すれば指摘が解消する場合）、該当ルールのfrontmatterの`michecker_check_ids`にチェック項目IDを追記する。関連するWCAG基準が`wcag`配列に無ければ合わせて追加する。
2. **新規ルールの作成** — CMS本文コンテンツの編集で対応可能なのにKBにルールが無い場合、`origin: michecker`の新規ルールを作成する（例: `table/th-scope.md`）。frontmatter・本文の書式は既存ルールに合わせ、`michecker_check_ids`と出典（`resource`）を必ず設定する。
3. **本文スコープ外として分類** — テンプレート・スクリプト実装・サイト全体設計・メディア制作など、本文編集の範囲を超える項目は、`reference/michecker-out-of-content-scope.json`にチェック項目IDと理由を追記する。以後、比較画面では「KB未対応」ではなくグレーの「本文スコープ外」として表示される。

どの選択肢でも、変更後に以下を再生成・同期する。

```bash
cd a11y-migration-kb
python3 tools/okf2jsonl.py --bundle . --out build/rules.jsonl
python3 tools/actf2json.py --bundle . --out build/michecker-checkitems.json
cp build/rules.jsonl ../goal2-app/data/rules.jsonl
cp build/michecker-checkitems.json ../goal2-app/data/michecker-checkitems.json
```

## 判断の目安

- 「そのルールに従って本文を修正すれば、miCheckerの指摘も解消するか？」がYesなら選択肢1。
- 指摘の対象がヘッダー・フッター・ナビ・CSSファイル・JavaScript・ARIA実装・フォームのバリデーション処理・音声/動画の制作なら選択肢3。
- 迷う場合は「KB未対応」のまま残し、下記バックログに追記して承認者・チームで検討する。
- 1つのチェック項目を、ルールへのタグ付けとスコープ外分類の**両方に登録してはならない**（`goal2-app/test/run-tests.js`が矛盾を検出する）。

## 現在のバックログ（トリアージ保留中）

| チェック項目ID | 内容(要約) | WCAG | 検討状況 |
|---|---|---|---|
| C_54.0 | 関連するフォーム・コントロールのグループをfieldset等で明示 | 1.3.1, 3.3.2 | 本文に埋め込まれたフォームで発生しうるが、CMSのフォーム機能側の実装に依存する可能性が高い。`form/`カテゴリの新規ルール候補として保留 |
| C_79.5 | label要素がコントロールの目的を表し画面上に表示されていることの確認 | 1.1.1ほか | `form/label-position.md`は配置のみを扱う。labelの「内容の質」を扱う新規ルール候補として保留（C_79.x系の他項目とまとめて検討） |

## 実データでの検証記録（2026-07-08）

実際のhtmlchecker.exe出力（59シグネチャ）でのトリアージ結果:

- ルール一致: 32件（マニュアル版21・miChecker版11）
- 本文スコープ外: 25件
- KB未対応（バックログ）: 2件（上表のC_54.0・C_79.5）
- 照合不可: 0件
