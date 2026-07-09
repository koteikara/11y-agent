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

## フォーム・title・lang属性のスコープ外化について（2026-07-09）

`a11y-migration-kb/rules/form/`配下の全ルール（送信ボタン・label配置・必須項目明示・入力形式ヒント）、および`html-structure/page-title.md`・`html-structure/lang-attribute.md`を削除した。理由は次の通り。

- フォームはCMSの入力フォーム機能側の実装に依存し、移行時にCMSへ登録する「本文コンテンツ」には含まれないため。
- ページtitleとhtml要素のlang属性は、新CMSのテンプレート側で自動生成・自動設定されるため、本文コンテンツの編集作業では扱わないため。

これに伴い、該当するチェック項目ID（フォーム関連約37件、C_60.x/C_600.12、C_21.x）はすべて`reference/michecker-out-of-content-scope.json`へ「本文スコープ外」として登録し直した。旧バックログのC_54.0・C_79.5もこの整理でスコープ外に解決したため、以下のバックログ表から除外した。

## 現在のバックログ（トリアージ保留中）

| チェック項目ID | 内容(要約) | WCAG | 検討状況 |
|---|---|---|---|
| C_3.0, C_3.1 | longdesc属性・D-linkによる詳細説明の提供 | 1.1.1 | 複雑な画像の詳細説明手法。`image/complex-image-report.md`との住み分けを検討中 |
| C_17.0, C_17.1, C_18.0, C_18.1, C_18.2 | blockquote/q要素・cite属性の適切な利用 | 1.3.1ほか | 引用の構造化に関するルール化を検討中 |
| C_46.0 | 隣接リンクの区切り表現 | 1.3.1 | リンクルールとの統合を検討中 |
| C_6.0, C_6.1, C_69.0 | アスキーアートの代替テキスト | 1.1.1 | 発生頻度が低く優先度未定 |
| C_67.0 | 見出し・リストの先頭内容の適切性 | 2.4.6ほか | `heading-content-quality.md`との重複可能性があり比較検討中 |
| C_70.0 | 内容の分かりやすさに関する一般的な確認 | 3.1.5 | 汎用的すぎるため具体ルール化を検討中 |
| C_87.0 | ふりがな・ルビの提供 | 3.1.5 | 自治体サイトでの発生頻度を踏まえ検討中 |
| C_1.1 | object要素の代替テキスト | 1.1.1 | 発生頻度が低く優先度未定 |
| C_40.0 | リンクへのaccesskey付与検討 | 2.4.1ほか | リンクルールとの統合を検討中 |
| C_300.1 | area要素のalt属性 | 1.1.1 | 画像マップの利用頻度を踏まえ優先度未定 |
| C_300.2 | applet要素のalt属性（C_0.x系と同様、廃止要素） | 1.1.1 | `deprecated-elements.md`側での吸収を検討中 |

## 実データでの検証記録（2026-07-08）

実際のhtmlchecker.exe出力（59シグネチャ）でのトリアージ結果:

- ルール一致: 32件（マニュアル版21・miChecker版11）
- 本文スコープ外: 25件
- KB未対応（バックログ）: 2件（当時のC_54.0・C_79.5。2026-07-09の整理でスコープ外に解決済み）
- 照合不可: 0件
