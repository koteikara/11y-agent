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

## table要素のsummary属性（C_25.2・C_25.4）の方針決定（2026-07-10）

`summary`属性はHTML Living Standardで廃止済みであり、KBの`deprecated-elements.md`は元々この属性の除去を推奨していた。一方miChecker側のC_25.2（summary属性の追加検討）・C_25.4（既存summary属性の内容確認）は、summary属性を前提にした指摘であり、KBの廃止方針と矛盾していた。

ユーザーとの協議の結果、「summary属性が存在すればシステム側で自動的に削除する（内容の追加・改善は行わない）」方針で確定した。これに伴い、C_25.2・C_25.4を`table/caption.md`から`html-structure/deprecated-elements.md`へ付け替えた（`html-structure/deprecated-elements.md`のsummary属性除去ロジック(`goal2-app/public/app.js`の`collectDeprecatedAttributeCandidates`、C_48.8実装と共通)が、この2項目を実質的に解決するため）。表の概要は`summary`属性ではなく`caption`要素（`table/caption.md`、C_25.1・C_25.3）で提供する。

## 逆引き検出パリティ Phase 1〜3 の完了（2026-07-10）

タグ付け済みチェック項目について、KBルールへの対応づけだけでなく`goal2-app`の候補生成ロジック自体をmiChecker本体の判定条件に近づける作業（Phase 1: error型14件、Phase 2A/2B: warning型32件中の対応分、Phase 3: 当初C分類のうちユーザーと協議した15グループ中6グループ）が完了した。詳細は`CHANGELOG.md`の該当エントリを参照。意図的に未実装とした項目（miChecker本体でも要素条件を持たない`always()`型の常時リマインダー、デッドコード、出現頻度が低いレア要素、機械判定が困難で人間レビューに委ねる方が実効的な項目）はCHANGELOGに理由付きで記録済み。

## バックログの解消（2026-07-10）

上記11項目のバックログを、ユーザーと1項目ずつ協議して解消した。

| チェック項目ID | 内容(要約) | 対応 |
|---|---|---|
| C_3.0, C_3.1 | longdesc属性・D-linkによる詳細説明の提供 | `html-structure/deprecated-elements.md`へタグ追記（longdescは削除方針のため内容確認・D-link追加は不要） |
| C_17.0, C_17.1, C_18.0, C_18.1, C_18.2 | blockquote/q要素・cite属性の適切な利用 | 新規ルール`text/quotation.md`を作成 |
| C_46.0 | 隣接リンクの区切り表現 | `link/link-text.md`へタグ追記 |
| C_6.0, C_6.1, C_69.0 | アスキーアートの代替テキスト | 新規ルール`text/ascii-art.md`を作成（顔文字が実務で頻出との確認あり） |
| C_67.0 | 見出し・リストの先頭内容の適切性 | `html-structure/heading-content-quality.md`へタグ追記（自動検出は追加せず、人間確認事項として明記） |
| C_70.0 | 内容の分かりやすさに関する一般的な確認 | スコープ外化（汎用的すぎて具体化不可、個別ルールで実質カバー） |
| C_87.0 | ふりがな・ルビの提供 | スコープ外化（「読みにくい」の判定が主観的で機械化不可） |
| C_1.1 | object要素の代替テキスト | スコープ外化（現代のCMS本文での利用頻度が極めて低い） |
| C_40.0 | リンクへのaccesskey付与検討 | スコープ外化（現代のアクセシビリティ実務ではaccesskeyの積極利用は非推奨） |
| C_300.1 | area要素のalt属性 | `image/alt-text.md`へタグ追記（画像マップの利用実績ありとの確認あり） |
| C_300.2 | applet要素のalt属性 | スコープ外化（C_0.x系と同様、`deprecated-elements.md`でapplet除去を推奨） |

なお、新規ルール2件（`text/quotation.md`・`text/ascii-art.md`）は`goal2-app`側の自動検出コードを持たない（KBドキュメントとして、AI/人間判断でのレビュー時に参照する位置づけ）。自動検出が必要になった場合は、別途トリアージ手順に従って対応する。

## 実データでの検証記録（2026-07-08）

実際のhtmlchecker.exe出力（59シグネチャ）でのトリアージ結果:

- ルール一致: 32件（マニュアル版21・miChecker版11）
- 本文スコープ外: 25件
- KB未対応（バックログ）: 2件（当時のC_54.0・C_79.5。2026-07-09の整理でスコープ外に解決済み）
- 照合不可: 0件
