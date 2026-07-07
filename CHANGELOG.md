# CHANGELOG.md

## Purpose

この文書は、Claude Code(またはCodex等のAGENT)がこのリポジトリに対して行った修正・更新を、後から追跡できるように記録する。

- 新しいエントリは常に先頭(直近の変更)に追加する。
- 1エントリ = 1PR(または1まとまりの作業)を基本とする。
- 「何を」「なぜ」「関連ファイル」「関連PR/コミット」を簡潔に書く。詳細な経緯は `memory/project-state.md` を参照する。

## Entry Format

```
## YYYY-MM-DD: 変更の要約

- 背景・目的
- 主な変更内容(箇条書き)
- 関連ファイル
- 関連PR/コミット
```

## Entries

## 2026-07-07: miChecker公式ソースとの突合による第2弾ルール拡張とorigin区別の導入

- 背景・目的: ユーザーが提示した https://github.com/eclipse-actf/org.eclipse.actf が、miChecker/HTML Checkerの評価エンジン本体のソースコードであることが判明した。`checkitem.xml`(268チェック項目、50種のWCAG 2.0基準)と`description_ja.properties`(日本語メッセージ本文)を解析し、前回のaccessibility.jpカタログ(92件・24種)より遥かに完全な一次情報源としてカバレッジ再分析を行った。ユーザーの指示(「拡張します。ただしCMSの本文コンテンツに関係ないものは省きます。さらにKB由来のものとmiChecker由来のものを分別して修正をKB版とmiChecker版で選べるようにします」)に基づき対応した。
- 主な変更内容:
  - `a11y-migration-kb`のフロントマターに`origin`(`kb`/`michecker`)・`michecker_check_ids`フィールドを新設し、`tools/okf2jsonl.py`・`README.md`を対応更新。
  - 28種のWCAG基準の未カバー項目のうち、メディア制作・サイト全体テンプレート・スクリプト/ARIA実装レベルのもの(音声字幕、フォーカス順序、サイトナビゲーション、フォームのクライアント検証等)はCMS本文コンテンツの編集範囲外として除外。
  - 本文コンテンツで対応可能な項目について、新規ルール8件(`text/sensory-characteristics.md`、`image/avoid-text-as-image.md`、`text/abbreviation.md`、`html-structure/iframe-frame-title.md`、`form/required-field-indication.md`、`form/input-format-hint.md`、`link/link-purpose-standalone.md`、`html-structure/heading-content-quality.md`)を`origin: michecker`として追加。
  - 既存3件(`html-structure/embedded-script-behavior.md`、`deprecated-elements.md`、`image/alt-text.md`)にWCAGタグと`michecker_check_ids`を追加(`origin`は`kb`のまま)。
  - 同一の関心事に対しKB独自の観点とmiChecker由来の観点を別ファイルとして保持し`related`で相互リンクする設計を、`link-text.md`↔`link-purpose-standalone.md`、`heading-order.md`↔`heading-content-quality.md`の2ペアで導入。
  - `build/rules.jsonl`を再生成(53→61ルール)し`goal2-app/data/rules.jsonl`に同期。`memory/michecker-research.md`に詳細を追記。
- 検証: `node --check server.js`・`node test/run-tests.js`成功。`GET /api/rules`で`summary.total=61`を確認。既存サンプル6件でのPlaywright回帰確認で、変更前と同一の候補件数・ページエラーなしを確認。
- **未実装**: `origin`/`michecker_check_ids`は現時点ではKBデータ上の区別に留まり、goal2-appのUIで「KB版」「miChecker版」を視覚的に区別・選択させる画面機能は未実装。
- 関連ファイル: `a11y-migration-kb/tools/okf2jsonl.py`、`a11y-migration-kb/README.md`、`a11y-migration-kb/rules/text/{sensory-characteristics.md,abbreviation.md,index.md}`、`a11y-migration-kb/rules/image/{avoid-text-as-image.md,alt-text.md,index.md}`、`a11y-migration-kb/rules/html-structure/{iframe-frame-title.md,heading-content-quality.md,heading-order.md,embedded-script-behavior.md,deprecated-elements.md,index.md}`、`a11y-migration-kb/rules/form/{required-field-indication.md,input-format-hint.md,index.md}`、`a11y-migration-kb/rules/link/{link-purpose-standalone.md,link-text.md,index.md}`、`a11y-migration-kb/build/rules.jsonl`、`goal2-app/data/rules.jsonl`、`memory/michecker-research.md`
- 関連PR: (作成予定)

## 2026-07-07: miChecker指摘内容カタログとの突合によるa11y-migration-kbルール拡張

- 背景・目的: ユーザーが発見した第三者サイト「miChecker対策テクニック集」(miCheckerの指摘メッセージ・WCAG基準・達成方法を92件一覧化)を、`a11y-migration-kb`の既存ルールと突き合わせたところ、miCheckerでは指摘されるがKB側では未カバーの項目が実在すること(40/92件、17/24種のWCAG基準)が判明した。ユーザーの指示「ルールを拡張していきましょう。KBに拘る必要はないので」に基づき、KBを正本の枠内に留めず拡張する方針で対応した。
- 主な変更内容:
  - 新規ルール8件を追加: `rules/html-structure/deprecated-elements.md`(廃止要素の除去)、`page-title.md`(ページタイトル)、`lang-attribute.md`(lang属性)、`duplicate-id-accesskey.md`(id・accesskey重複)、`embedded-script-behavior.md`(埋め込みスクリプトの自動的な動作)、`rules/text/spaced-characters.md`(文字間の不要な空白)、新設`form/`カテゴリの`submit-button.md`(送信ボタン)・`label-position.md`(label配置)。すべて`resource`にaccessibility.jpの当該ページを出典として明記。
  - 既存ルールの`wcag`フロントマターを拡充: `rules/html-structure/heading-order.md`に`"2.4.10"`(見出しの入れ子関係、本文は既にカバー済みだったためタグ追加のみ)、`rules/text/color.md`に`"1.4.6"`(AAAコントラスト比、CMS標準パレット確認の一文も追加)。
  - `rules/html-structure/index.md`・`rules/text/index.md`・`rules/index.md`(新設`form/`セクション)を更新。
  - `a11y-migration-kb/tools/okf2jsonl.py`で`build/rules.jsonl`を再生成(43→53ルール)し、`goal2-app/data/rules.jsonl`に同期。
  - `memory/michecker-research.md`にカタログの概要・カバレッジ分析手法・拡張内容・未実装の逆引きUIについて追記。
- 検証: `node --check server.js`・`node test/run-tests.js`成功。`GET /api/rules`で`summary.total=53`、`byCategory`が`{file:2, form:2, html-structure:7, image:8, link:9, table:9, text:16}`となることを確認。既存サンプル6件でのPlaywright回帰確認でも候補生成件数に異常なし・ページエラーなしを確認。
- 関連ファイル: `a11y-migration-kb/rules/html-structure/deprecated-elements.md`、`page-title.md`、`lang-attribute.md`、`duplicate-id-accesskey.md`、`embedded-script-behavior.md`、`heading-order.md`、`index.md`、`a11y-migration-kb/rules/text/spaced-characters.md`、`color.md`、`index.md`、`a11y-migration-kb/rules/form/`(新設)、`a11y-migration-kb/rules/index.md`、`a11y-migration-kb/build/rules.jsonl`、`goal2-app/data/rules.jsonl`、`memory/michecker-research.md`
- 関連PR: (作成予定)

## 2026-07-07: ローカルWindows版をNode.js単一実行ファイル(.exe)化する仕組みを追加

- 背景・目的: ローカルWindows版のhtmlchecker.exe自動比較機能を、コマンドラインに不慣れな一般担当者にも配布したいという要望を受けた。専用のWindows環境を用意する代わりに、Node.js標準の単一実行ファイル化(SEA)機能でgoal2-appを1つの`.exe`に固め、ダブルクリックで起動・ブラウザ自動起動・画面からの設定入力ができるようにした(コマンド操作を一切不要にする狙い)。Electronアプリ化も比較検討したが、依存関係が増える(Chromium同梱で数百MB)ことと、今のゼロ依存構成を維持したい方針から、まずはNode.js標準機能のみで完結するSEA方式を選んだ。
- 主な変更内容:
  - `goal2-app/server.js`: `node:sea`モジュールで`.exe`として実行されているかを検知し(`isSeaBuild`)、該当する場合のみ起動時に既定のブラウザを自動で開く(`openBrowser`)。`htmlchecker.exe`のパスを環境変数だけでなく、`%APPDATA%\goal2-app\config.json`(Windows以外ではリポジトリ内の`.goal2-app-local/`)に保存する設定ファイル方式に対応させ、`GET`/`POST /api/local-settings`エンドポイントを新設。環境変数が設定されている場合はそちらを優先する。
  - `goal2-app/public/michecker-compare.html`・`michecker-compare.js`: 「(ローカルWindows限定)」セクションに、`htmlchecker.exe`のパスをテキスト入力・保存できる設定パネルを追加。環境変数での上書き手順の説明は削除した。
  - `goal2-app/sea-config.json`: Node.js SEAの設定ファイルを新規追加。
  - `goal2-app/build-windows-app.bat`: Windows上で`.exe`をビルドするための一連の手順(SEAブロブ生成→node.exeコピー→署名削除→postjectでの埋め込み)を自動化するバッチファイルを新規追加。
  - `goal2-app/LOCAL_WINDOWS_APP.md`: ビルド手順・利用者側の使い方・設定の保存場所・トラブルシューティングをまとめたドキュメントを新規追加。
  - `.gitignore`にビルド成果物(`.exe`、`sea-prep.blob`、ローカル設定フォルダ)を追加。
- **重要な未検証事項**: `.exe`のビルド自体(`build-windows-app.bat`の実行)は、この開発環境がLinuxのため実際には試せていない。Node.js公式のSEAドキュメントに基づいて作成したが、実際にWindows環境でビルド・起動して問題が無いか確認が必要。
- 検証: Linux環境で、設定の保存・読み込み(`/api/local-settings`)がPlaywrightで正しく動作すること(保存→再読み込みで値が保持される)を確認。既存のCSV手動アップロード・分類機能・ローカル自動比較機能(Windows以外での無効化ガード含む)への回帰が無いことも確認した。`node --check`・`node test/run-tests.js`・既存サンプルへの回帰確認はいずれも成功。
- 関連ファイル: `goal2-app/server.js`、`goal2-app/public/michecker-compare.html`、`goal2-app/public/michecker-compare.js`、`goal2-app/public/styles.css`、`goal2-app/sea-config.json`、`goal2-app/build-windows-app.bat`、`goal2-app/LOCAL_WINDOWS_APP.md`、`goal2-app/test/run-tests.js`、`.gitignore`
- 関連PR: (作成予定)

## 2026-07-07: htmlchecker.exe実機検証を受けてlist.csvベースの確実な対応付けに修正

- 背景・目的: ユーザーが実際にWindows環境で`htmlchecker.exe`をビルド・実行し、実データ(安城市 入札結果ページを想定した`before.html`/`after.html`)での検査結果を共有してくれた。これにより、前回「ファイル作成順(mtime)で移行元/移行後を対応付ける」としていた未検証の仮定を、実際に出力される`[日付]_[時刻]_list.csv`(ヘッダー`Target HTML file,Result CSV file`、検査対象パス→結果CSVパスの明確な対応表)を解析する確実な方式に修正できた。
- 主な変更内容:
  - `goal2-app/server.js`: `findNewResultCsvFiles`(mtime順ソート)を削除し、`parseCsvRows`(汎用CSVパーサー)・`parseHtmlCheckerListCsv`(`list.csv`を解析し検査対象パス→結果CSVパスのMapを返す)を追加。`runHtmlCheckerLocalCompare`は、新規生成された`*_list.csv`を1件特定→解析→`beforeHtmlPath`/`afterHtmlPath`をキーに結果CSVパスを確実に取得する方式に変更。
  - `memory/michecker-research.md`に、実機セットアップで発生した問題(`.psf`インポートが`git://`プロトコルのタイムアウトで失敗した件、GitHubからの直接クローンでの回避方法、`htmllist.txt`/`list.csv`の実際の書式、htmlchecker.exe(CLI版)の結果CSVがGUI版と異なり`WCAG 2.0`列を含む12列構成である点)を「実機検証結果」として追記した。
- 検証: ユーザー提供の実際の`list.csv`をパースし、`before.html`→`0707_1120_1.csv`、`after.html`→`0707_1120_2.csv`という対応が正しく取得できることを確認。また実際の2件の結果CSV(62件/57件、12列構成)を`michecker-compare.html`の手動アップロード機能に読み込ませ、49シグネチャに集約されて「新規2・未解消42・解消5」という妥当な結果になることを確認した(列名ベースのパーサーのため列追加の影響を受けないことも確認)。`node --check`・`node test/run-tests.js`はいずれも成功。
- 関連ファイル: `goal2-app/server.js`、`memory/michecker-research.md`
- 関連PR: (作成予定)

## 2026-07-06: (ローカルWindows限定・未検証)htmlchecker.exeによるmiChecker自動比較を追加

- 背景・目的: ユーザーから共有された「miCheckerのアクセシビリティ評価機能とCMS等との連携手順書」により、miChecker本体(GUI)とは別に、同じACTF評価エンジンを使うCLIツール「HTML Checker」(`htmlchecker.exe`)が公式に存在し、`-f htmllist.txt`でHTMLファイル一覧をバッチ検査してCSVを自動出力できることが判明した。専用のWindows環境を用意するのは難しいというユーザーの意向を受け、「Cloud Run上のホスト版」と「ユーザー自身のWindows PCでローカル起動する版」の両方をサポートする方針とし、ローカル版でのみ`htmlchecker.exe`をサーバーサイドから自動起動する機能を追加した。
- 主な変更内容:
  - `goal2-app/server.js`: `POST /api/michecker-local-compare`エンドポイントを新設。リクエストの`beforeHtml`/`afterHtml`を一時フォルダにHTMLファイルとして書き出し、`htmllist.txt`を生成した上で環境変数`MICHECKER_HTMLCHECKER_EXE`で指定された`htmlchecker.exe`を`child_process.execFile`(`-f`オプション)で実行し、`result`フォルダに新規生成されたCSV2件をShift-JISでデコードして返す。`process.platform !== "win32"`の場合や環境変数未設定・実行ファイル不在の場合は明確なエラーメッセージを返す。既存のGETオンリーだったメソッドチェックを、このエンドポイントに限りPOSTも許可するよう変更した。
  - `goal2-app/public/michecker-compare.html`・`michecker-compare.js`: 「(ローカルWindows限定)htmlchecker.exeで自動比較」セクションを追加。移行元/移行後の全体HTMLを貼り付けて実行すると、上記APIを呼び出し、返却されたCSVを既存の`parseMicheckerCsv`/`diffMicheckerRecords`/`renderResults`(手動アップロード版と共通)にそのまま渡して同じ比較結果を表示する。
  - `goal2-app/public/styles.css`: 貼り付け用テキストエリアのスタイルを追加。
- **重要な未検証事項**: `htmlchecker.exe`はWindows専用のためこの開発環境では実際に実行できず、(1)`result`フォルダの出力ファイル名・タイミング、(2)`htmllist.txt`に列挙した順序で結果CSVが生成される、という前提が本当に正しいかは未検証。実機で動かして問題があれば修正が必要。
- 検証: Linux開発環境で`process.platform !== "win32"`の分岐が正しく機能し、明確なエラーメッセージが返ることをPlaywrightで確認した。既存の手動CSVアップロード機能(分類・フィルタ含む)に回帰がないことも確認した。`node --check`・`node test/run-tests.js`はいずれも成功。
- 関連ファイル: `goal2-app/server.js`、`goal2-app/public/michecker-compare.html`、`goal2-app/public/michecker-compare.js`、`goal2-app/public/styles.css`、`memory/michecker-research.md`
- 関連PR: (作成予定)

## 2026-07-06: miChecker比較ビューに本文/テンプレート分類とcontentのみ表示フィルタを追加

- 背景・目的: miChecker CSV比較ビューが「ページ全体」の指摘をそのまま突き合わせるだけで、テンプレート(共通ヘッダー・フッター・ナビ)由来の指摘と、CMSへ移行する本文コンテンツ由来の指摘を区別していなかった。実際のCSVには外部CSSファイル参照(共通スタイル起因、実データ85件中13件、全件で行番号が空欄)が多く含まれており、これらは本文編集では対応不可能な指摘のため、区別できるようにした。
- 主な変更内容:
  - `goal2-app/public/michecker-compare.js`: 各比較結果行に`classification`(`unknown`/`content`/`old-site-template`/`new-cms-template`)を持たせ、内容欄に外部CSSファイル参照(`.css`または「セレクタ=」)がある場合は自動で`old-site-template`と仮分類する(`TEMPLATE_STYLE_REFERENCE_PATTERN`、実データで検証済み)。各行にドロップダウンで分類を上書き可能にし、自動タグには「自動推定」バッジを表示、手動変更で消える。「本文(content)に分類した行だけ表示する」フィルタチェックボックスを追加。
  - `goal2-app/public/michecker-compare.html`・`styles.css`: 上記UI要素(分類列、フィルタ、空状態メッセージ)を追加。
- 検証: 実CSV(85件)で自動タグが2件正しく付与されること、フィルタON時に未分類分は非表示、手動でcontentに変更した行のみ表示されること、自動バッジが手動変更で消えることをPlaywrightで確認。実際にローカルサーバーを起動しスクリーンショットでも見た目を確認した。`node --check`・`node test/run-tests.js`・既存サンプルへの回帰確認もいずれも成功。
- 関連ファイル: `goal2-app/public/michecker-compare.html`、`goal2-app/public/michecker-compare.js`、`goal2-app/public/styles.css`
- 関連PR: (作成予定)

## 2026-07-06: miChecker CSV結果の移行前後比較ビューを追加

- 背景・目的: miCheckerを判断基準の一つに加えたいというユーザー要望を受け、miChecker自体はCLI/APIを持たないWindows専用GUIツールであることを開発環境準備手順書で確認した上で、GUIで手動実行した結果のCSVエクスポート(Shift-JIS/CP932、引用符付きマルチラインフィールド)を取り込み、移行元(旧ページ)と移行後(新ページ)の指摘を比較する機能をgoal2-appに追加した。
- 主な変更内容:
  - `goal2-app/public/michecker-compare.html`・`goal2-app/public/michecker-compare.js` を新規追加。移行元/移行後の2つのCSVファイルをアップロードすると、`(種別, JIS, 達成方法)`の組み合わせをシグネチャとして件数を突き合わせ、「新規」「未解消」「解消」に分類して一覧表示する。サーバー側の変更は無く、クライアントの`TextDecoder("shift_jis")`とvanilla JSのCSVパーサーのみで完結させ、既存のゼロ依存構成を維持した。
  - `goal2-app/public/styles.css` に `.michecker-*` クラス群(アップロードフォーム、統計タイル、結果テーブル、状態バッジ)を追加。
  - `goal2-app/test/run-tests.js` のファイル存在チェックに新規2ファイルを追加。
  - `memory/michecker-research.md` に、実際にユーザーから共有された安城市 入札契約結果ページのmiChecker検査結果CSVを解析した結果(列構成、`種別`4分類の件数傾向、エンコーディングの注意点、前後比較のシグネチャ設計案)を追記した。
- 検証: 実際のCSV(85件)を「移行元」、`問題あり`3件と`問題の可能性大`1件を除去した加工版を「移行後」としてPlaywrightでアップロード・比較し、期待通り「解消」2件・「未解消」57件・「新規」0件になることを確認した。また最小限のCSVペアで「新規」判定(移行後のみに出現する指摘)も正しく動作することを確認した。`node --check`・`node test/run-tests.js`はいずれも成功。
- 関連ファイル: `goal2-app/public/michecker-compare.html`、`goal2-app/public/michecker-compare.js`、`goal2-app/public/styles.css`、`goal2-app/test/run-tests.js`、`memory/michecker-research.md`
- 関連PR: (作成予定)

## 2026-07-06: 表キャプション自動生成の文字化け(mojibake)とヘッダー途中切れを修正

- 背景・目的: ユーザーが独自の入札案件表(工事名称〜その他の9列見出し)を貼り付けて修正候補を確認したところ、「表のキャプション」候補の修正後プレビューが「工事名称 工事場所 工種 公告文 入札条件 提出書類 設計書 Q＆A そ????????????」のように途中から文字化けする不具合が報告された。
- 調査の結果、`goal2-app/public/app.js`に`dataTableCaptionText`という同名関数がリポジトリの初回コミット時点から2つ定義されており、JavaScriptの関数巻き上げにより後方の定義だけが実際に使われていた(前方の定義は完全なデッドコードで、しかもその本文自体が文字化けしたバイト列("陦ｨ縺ｮ蜀・ｮｹ"等)を含んでいた)。実際に使われていた後方の定義では、見出し行から生成するキャプションが長い場合のフォールバック文字列が本来の日本語ではなく単なる`"?"`の連続(`"????????????????"`、`"????????????"`)になっており、これが報告された文字化けの直接原因だった。加えて、36文字での単純な文字数切り詰めが見出しセルの途中(「その他」の「そ」の直後など)で発生し、不自然なキャプションになる問題もあった。
- 主な変更内容(`goal2-app/public/app.js`):
  - 完全にデッドコードだった前方の`dataTableCaptionText`定義(文字化けしたフォールバック文字列を含む)を削除した。
  - 実際に使われている`dataTableCaptionText`の`"?"`連続フォールバックを、既存の`\u`エスケープ済み定数`genericTableCaption`(表の詳細)・`tableDetailSuffix`(の詳細)を使う形に修正した。
  - 見出し行文字列の36文字切り詰めを、文字数の単純カットから新設の`truncateAtWordBoundary`によるセル区切り(スペース)単位の切り詰めへ変更し、単語やセル内容の途中で文字が欠けないようにした。
- 検証: 報告された表(工事名称〜その他の9列)を再現するテストHTMLで、修正後キャプションが文字化けせず、セル境界で自然に切り詰められることをPlaywrightで確認した。`node --check`・`node test/run-tests.js`はいずれも成功。既存の全サンプル(procedure-overview/images/tables/links-text/iframe/goal3-hirosaki-news2019)で候補件数に変化がなく、ページエラーが発生しないことを確認した。
- 関連ファイル: `goal2-app/public/app.js`、`CHANGELOG.md`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-06: 案内リンク付き結合セルを表外抽出ではなくcolspan解除+同一リンク繰り返しに変更

- 背景・目的: 直前のエントリ(「colspanを使わず表外へ抽出する案A」)について、ユーザーから「案Aでヘッダーだけが残ることに違和感がある」「表で無くなることも避けたい」との指摘があり、行を表の外へ抽出する案A自体を撤回。代わりに「表の行としてそのまま残し、`colspan`は解除して実セル(`<td>`)へ分解し、各セルに同じ案内リンク(同一href・同一リンクテキスト)を繰り返す」形へ変更した。捏造した列ごとの説明文は入れない(ユーザーの明示的な要望)。
- 主な変更内容(`goal2-app/public/app.js`):
  - `buildCaptionSeparatedTableHtml`が結合セルにリンクを含む場合に呼んでいた`buildRowExtractedToListHtml`(行を削除し`<h3>+<p>+<ul>`を表外に出力)を削除し、新設の`buildMergedLinkRepeatedAcrossCellsHtml`へ差し替えた。
  - `buildMergedLinkRepeatedAcrossCellsHtml`は、表をクローンして該当行・該当セルの位置をそのまま特定し、`colspan`の値だけ`<td>`(または`<th>`)を新規生成、各セルに同一href・同一テキスト(`extractedRowLinkLabel()` + 「の案件詳細ページ」)の`<a>`を設置して元のセルを置き換える。行自体は削除せず、`colspan`属性も残らない。
  - 不要になった`buildRowExtractedToListHtml`・`spannedColumnHeaderTexts`・`deriveExtractedRowHeading`を削除。`extractedRowLinkLabel`は引き続き利用。
  - `isLinkedGuidanceMergedCell`にヒットした場合の分類理由(`reason`)テキストを、表外分離ではなく「colspanを解除して各列に同じ案内リンクを繰り返し配置」という説明に更新。
- 検証: colspan=6(他セルなし)・colspan=5(整理番号セルあり)の2パターンをPlaywrightで実行し、候補採用後の最終HTMLが行を保持したまま`colspan`なしの実セルへ分解され、各セルに同一リンク(href・テキストとも同一)が入ることを確認。整理番号がある場合はそれがリンクテキストに反映されることも確認した。`node --check`・`node test/run-tests.js`はいずれも成功。既存サンプルへの回帰確認も実施。
- 関連ファイル: `goal2-app/public/app.js`、`CHANGELOG.md`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-06: レイアウト表分解(decomposeLayoutTable)で見出し+対応内容の構造を維持

- 背景・目的: 「セル結合①レイアウト用途」(table.cell-merge-layout、table.cell-merge-fileでも共用)の分解結果が、3セル以上の行(例: 「開催日」「令和8年7月20日」「10時から15時」「雨天中止」)で各セルが独立した段落に単純分解されるだけで、先頭セルが見出し(ラベル)であり残りがそれに対応する内容であるという関係が失われていた。
- 主な変更内容(`goal2-app/public/app.js`の`decomposeLayoutTable`):
  - 既存の「1セルのみ→見出し」「2セルで結合可能→太字ラベル付き段落」に加えて、「3セル以上で先頭セルが見出し的、残りが単純セル」の場合に、先頭セルを`<h(レベル)>`見出しとして分離し、残りのセルを「、」区切りの1つの段落として続ける分岐を追加した。
- 検証: 「開催日/令和8年7月20日/10時から15時/雨天中止」という4セル行が`<h4>開催日</h4><p>令和8年7月20日、10時から15時、雨天中止</p>`に、`table.cell-merge-file`が使う同じ分解ロジックで「参加申込書」行も見出し+内容形式になることを確認した。既存の全サンプルで候補件数・ページエラーに変化がないことを確認し、`node test/run-tests.js`も全件成功した。
- 関連ファイル: `goal2-app/public/app.js`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-06: colspanを使わず表外へ抽出する「案A」パターンを表候補生成に反映

- 背景・目的: 入札案件一覧で、総合評価方式のように複数列(公告文・入札条件等)をcolspanで1セルにまとめ、1つの案内リンクへ誘導する行について、ユーザーと「colspanを使わず、表の外に見出し＋本文＋リンク一覧として抽出する(案A)」方針を検討・合意した。実際にはこの方針がプログラムへ未反映だったため、確認のうえ反映した。
- 主な変更内容(`goal2-app/public/app.js`):
  - `classifyMergedCellTable`に、結合セルがリンク1件と「ご覧ください/ご確認ください」等の案内文を含む場合を検出する`isLinkedGuidanceMergedCell`を追加し、`table.cell-merge-summary`として分類するようにした(従来は汎用の`table.cell-merge-layout`に分類され、案Aが適用されていなかった)。
  - `buildCaptionSeparatedTableHtml`が、結合セルにリンクを含む場合は新設の`buildRowExtractedToListHtml`へ分岐するようにした。該当行を表から削除し、結合セルの案内文から見出し(`deriveExtractedRowHeading`)を、結合していた列見出しから段落文(実在する列名を使用、捏造なし)を、行の他セルから案件名+付随情報(`extractedRowLinkLabel`)を組み立て、`<h3>見出し</h3><p>段落</p><ul><li><a href="...">案件名（付随情報）の案件詳細ページ</a></li></ul>`として表の直後に出力するようにした。
- 検証: 元の1行colspan=6のサンプルで、候補採用後の最終HTMLが意図した見出し・段落・リンク付きリスト構造になることを確認した。既存の全サンプル(procedure-overview/images/tables/links-text/iframe/goal3-hirosaki-news2019)で候補件数に変化がなく、ページエラーが発生しないことを確認し、`node test/run-tests.js`も全件成功した。
- 関連ファイル: `goal2-app/public/app.js`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-06: 同じ箇所への代替修正手段を候補一覧・修正パネルの両方で明示

- 背景・目的: 表組みなどで1箇所に複数の修正方法(候補)が生成される場合、既存の`candidatesForSameTarget`により詳細側の「修正方法」パネルでは代替手段として連携されていたが、左側の修正候補一覧では独立した別々の項目に見えてしまい、同じ箇所への代替手段であることが分かりにくかった。
- 主な変更内容:
  - `goal2-app/public/app.js`の`renderCandidates()`で、`candidatesForSameTarget(candidate).length > 1`の場合に候補一覧の各項目へ「同じ箇所の代替手段 N件中」バッジを表示するようにした。aria-labelにも同内容を追加。
  - `renderDetail()`の「修正方法」パネル見出し直下に、件数に応じた説明文(「同じ箇所への修正方法がN件あります。いずれか1つを選んで採用してください。」/「この箇所の修正方法は1件です。」)を追加した。
  - `goal2-app/public/styles.css`に`.candidate-alt-badge`(候補一覧用バッジ)・`.fix-method-note`(修正方法パネルの説明文)のスタイルを追加した。
  - 表(セル結合系候補)だけでなく、ファイルリンクの表示テキストとリンクテキスト文脈化が同じリンクに対して重複するケースなど、既存の`candidatesForSameTarget`が対象とする全ての箇所で同様に機能することをサンプル(「表: レイアウト・結合・添付」)で確認した。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/public/styles.css`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-05: Goal2の表変換ロジックに「注記の分離」「ファイルリンク文言の列見出し化」「不足セルの補完」を追加

- 背景・目的: ユーザーとの検討で、入札案件一覧のような表(見出し行がtdのまま、案件名セルに`※`注記が埋め込まれ、リンク文言が「PDF」「Excel」のみ、列数より実セル数が少ない行がある)の正しい修正方針が固まったため、Goal2アプリの候補自動生成ロジックに反映した。
- 主な変更内容(`goal2-app/public/app.js` の `buildDataTableSemanticsHtml` 内、既存の `table.caption` 候補生成に追加):
  - 行見出しセル(案件名等)に埋め込まれた`※`始まりの`<strong>`注記を検出して除去し、表の直後に`<h3>注意事項</h3>`+`<ul>`として分離出力する(`extractEmbeddedTableCellNote`/`buildTableNoteSectionHtml`)。`cell-merge-note.md`の「注意書きは表の外へ」方針に対応。
  - データセル内のリンク文言が「PDF」「Excel」「Word」等のファイル種別のみの場合、対応する列見出し(公告文・入札条件等)のテキストに置き換える(`normalizeGenericFileLinkText`)。案件名等は含めず列見出し名のみとする方針で実装。`file-display-text.md`(ファイル種別はCMSが自動表示するため削除)の方針に対応。
  - 元HTMLで行のセル数が見出し列数より少ない場合、不足分を空の`<td>`で補い、列とセルの対応を揃えた。
- 検証: 実際の入札案件表(14行、注記2件を含む実データ)をPlaywrightで貼り付け、候補生成結果を確認。見出し行のth化・注記分離・リンク文言変更・空セル補完が意図通り動作することを確認した。既存の全サンプル(procedure-overview/images/tables/links-text/iframe/goal3-hirosaki-news2019)でページエラーが発生しないことを確認し、`node test/run-tests.js`も全件成功した。
- 関連ファイル: `goal2-app/public/app.js`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-05: 「次にやること」パネルのドラッグアイコン・見出し表記を修正

- 背景・目的: ユーザーからのスクリーンショット指摘により、「次にやること」パネルで(1)ドラッグ用の移動アイコンが閉じるボタン(×)と同じ丸いボタンチップの見た目になっており紛らわしい、(2)「次にやること」のラベルがピル型でボタンのように見える、という2点の見た目の問題が見つかったため修正した。
- 主な変更内容:
  - `.page-agent-kicker`(「次にやること」ラベル)を、ピル形の背景・角丸を廃し、サイドバーのeyebrowと同じ大文字・トラッキングを効かせた見出しラベル調に変更した。
  - `.page-agent-drag`(移動アイコン)から、常時表示のボーダー・背景チップを廃し、待機時は控えめなアイコンのみにして、ホバー・フォーカス時のみ背景が浮かぶようにした。閉じるボタン(`.page-agent-close`)は従来通りボタンらしい丸いチップのまま維持し、「これは押せる」「これは押せない(ドラッグ用の目印)」を視覚的に区別できるようにした。
  - キーボードでのフォーカス可能性・矢印キー移動機能(既存のアクセシビリティ対応)は変更していない。
  - 追加調査で、`.page-agent-close`・`.page-agent-drag` が基本の`button`ルール(`padding: 8px 16px`・`min-height: 40px`)を上書きしておらず、34×34pxのはずの円が実際は34×40pxの楕円になり、内部の20×20pxアイコンがパディングに押されて中心からずれ、枠外へはみ出していたバグを発見して修正した(`padding: 0`・`min-height: 0`を明示指定)。Playwrightでボタン・アイコン双方の座標を計測し、中心が一致することを確認した。
- 関連ファイル: `goal2-app/public/styles.css`
- 関連PR: (作成予定)

## 2026-07-05: CLOUD_RUN_DEPLOY.mdのデプロイ元をローカルからGitHub mainブランチへ変更

- 背景・目的: これまでの手順は手元のローカル作業フォルダをそのままCloud Buildへ送っており、未コミットの変更やローカルの状態次第でデプロイ内容がGitHub上の内容とずれる可能性があった。デプロイ元をGitHubの`main`ブランチに固定するよう変更した。
- 主な変更内容:
  - デプロイ専用の作業フォルダ(`C:\Codex\11y-agent-deploy`)を新設し、`git clone`/`git fetch`+`git reset --hard origin/main`でGitHubの`main`ブランチへ同期してからビルドするコマンドに変更した。
  - マージ前のブランチを試験デプロイしたい場合の代替手順を注記した。
  - `git`関連のよくあるつまずき(未インストール、認証、作業フォルダを分ける理由)を追加した。
- 関連ファイル: `goal2-app/CLOUD_RUN_DEPLOY.md`
- 関連PR: (作成予定)

## 2026-07-05: CLOUD_RUN_DEPLOY.mdにGoal3を反映

- 背景・目的: `CLOUD_RUN_DEPLOY.md`がGoal3追加前に書かれたままで、Goal3への言及が一切なかった。Goal2/Goal3のデプロイ方法を尋ねられた際に確認したところ、両者は別々のCloud Runサービスではなく同じ`goal2-app`(1サーバー・1イメージ)から配信されており、個別デプロイの手順は存在しないことが分かったため、その旨を明記した。
- 主な変更内容:
  - Goal3の公開URL(`/goal3.html`)を追加。
  - 「Goal 2とGoal 3は同じサービス・同じデプロイで反映される」の節を新設し、`Dockerfile`が`public/`フォルダ全体をコピーするため1回のデプロイで両方反映されることを明記。
  - 「反映確認」セクションで、Goal2だけでなくGoal3のURLも確認するよう追記。
- 関連ファイル: `goal2-app/CLOUD_RUN_DEPLOY.md`
- 関連PR: (作成予定)

## 2026-07-05: Goal2・Goal3のビジュアルデザイン刷新

- 背景・目的: エンタープライズ/業務系SaaSプロダクトデザイナー(+アクセシビリティ実務経験者)としての視点でUI評価を行った結果、Material 3のデフォルト配色をそのまま使用、ボタンが全て同一の丸ピルで優先度が塗り色以外に無い、タイポスケールが未定義(eyebrowがh1より大きい階層逆転)、サイドバーの余白過多、カードの入れ子が均質、といった課題が見つかったため刷新した。
- 主な変更内容:
  - `goal2-app/public/styles.css`: 配色トークンを単一ブランドアクセント(ティール)+意味用途限定のsuccess/warning/dangerに整理し、未使用だった`--cyan`/`--sun`/`--coral`等を削除。見出し深度タグ用`--tag-h1〜h4`とリンク用`--link`を分離。タイプスケール(`--text-micro`〜`--text-display`)を新設。
  - ボタンを`primary`(塗り・画面に1つ)/`secondary`(枠線)/既定(tertiary、控えめ)/`icon-button`(円形)の4階層に整理し、決定ボタン(採用/文言調整/却下/要確認)は候補一覧と同じ意味色(success/primary/danger/warning)にした。
  - サイドバー幅を132px→176pxに拡幅し、eyebrowとh1の階層逆転を解消。下部の空白に製品名フッターを追加。
  - 入れ子カード(この候補で変わること、見た目の比較等)を`--surface-2`背景にして、外側ペインとの階層差を明確化。スコア・件数等の数値表示に`tabular-nums`を適用。
  - `goal2-app/public/index.html`・`goal3.html`・`app.js`のボタンへ新しいクラス(`secondary`/`decision-accept`/`decision-edit`/`decision-reject`/`decision-review`)を適用。
  - コントラスト比を計算で確認(却下6.54:1、要確認5.93:1、文言調整6.42:1、採用5.35:1、いずれもWCAG AA基準を満たす)。`node test/run-tests.js`が全件成功することを確認した。
- 関連ファイル: `goal2-app/public/styles.css`、`goal2-app/public/index.html`、`goal2-app/public/goal3.html`、`goal2-app/public/app.js`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-05: ペルソナ再検証によるGoal2・Goal3のアクセシビリティ修正

- 背景・目的: 前回記録したGoal 2・Goal 3のUI/デザイン課題3件を、ペルソナ「佐藤美咲」(全盲・NVDA・キーボードのみ操作・移行作業オペレーター)を作成した上でPlaywrightによる擬似検証を実施。再検証の過程で、当初の課題より深刻な「パネルボタン操作時のフォーカス消失」を新たに発見し、あわせて4件を修正した。
- 主な変更内容:
  - `goal2-app/public/goal3.js`: ソースプレビューのハイライト対象(`.goal3-source-scope`)の中身を、実際の抽出後HTML(`candidate.html`)へ差し替え、ハイライト範囲と最終HTMLの内容を一致させた。
  - `goal2-app/public/goal3.js`: `dedupeCandidates`を、生HTML文字列ではなく正規化後テキストでグルーピングし、同一内容の候補はDOM要素数が最も少ない(最も狭い)ものだけを残すよう変更した。
  - `goal2-app/public/app.js`・`styles.css`: 「次にやること」パネル(`page-agent-panel`)に、キーボードで実行できる閉じるボタンと、矢印キーで移動できるドラッグハンドルボタンを追加した。
  - `goal2-app/public/app.js`: パネルの再描画時にフォーカスしていたボタンが`<body>`に消失する不具合を修正し、同じアクションのボタンへフォーカスを復元するようにした。閉じた際はページ見出しへフォーカスを移すようにした(`goal2-app/public/index.html`に`#pageHeading`と`tabindex="-1"`を追加)。
  - `node --check`と`node test/run-tests.js`(既存テストの文言変更なし、全件成功)、Playwrightによる実機確認(フォーカス復元・ハイライト一致・候補統合・矢印キー移動)を実施した。
- 関連ファイル: `goal2-app/public/goal3.js`、`goal2-app/public/app.js`、`goal2-app/public/styles.css`、`goal2-app/public/index.html`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-05: Goal 2・Goal 3のUI/デザイン評価(課題記録のみ、未修正)

- 背景・目的: Goal 2・Goal 3の画面をローカルで実際に起動し、サンプルHTMLで動作させてUI/デザインを評価した。ユーザー判断により、今回は修正せず課題の記録のみとした。
- 主な変更内容:
  - `memory/project-state.md` の `Not Completed Yet` に、実機確認で見つかった3件の課題を記録した。
    1. Goal 3の「抽出位置の確認」プレビューのハイライト範囲が、実際の抽出結果(除外済み要素)と食い違う。
    2. Goal 3の「おすすめ」候補判定が、内容が同一でもより広いスコープを優先することがある。
    3. Goal 2/Goal 3共通の「次にやること」フローティングパネルに、閉じるボタンとキーボードでの移動手段がない。
- 関連ファイル: `memory/project-state.md`
- 関連PR: (未作成。コード修正は行っていないため、記録のみのドキュメント更新)

## 2026-07-05: `CHANGELOG.md` の新設と運用ルール追加

- 背景・目的: AGENT(Claude Code等)が行った修正・更新を後から追跡できるようにするため、変更履歴を一箇所にまとめる運用に変更した。
- 主な変更内容:
  - `CHANGELOG.md` を新設し、過去2件のPR(Goal 3ドキュメント整備、SSRF対策強化)をバックフィルした。
  - `AGENTS.md` の `Important Constraints` に、修正・更新後は `CHANGELOG.md` へ記録する方針を追加した。
  - `done-definition.md` の `General Done Criteria` と `Self-Verification Commands` に `CHANGELOG.md` への記録・存在確認を追加した。
- 関連ファイル: `CHANGELOG.md`、`AGENTS.md`、`done-definition.md`
- 関連PR: (このコミットで作成予定)

## 2026-07-05: `/api/fetch-html`・`/api/link-title` のSSRF対策強化

- 背景・目的: プロジェクトの課題洗い出しにより、Goal 3のURL取得機能に、DNSリバインディング・IPv4写像IPv6リテラル・リダイレクト先未検証によるSSRFバイパスの可能性が見つかったため修正した。
- 主な変更内容:
  - ホスト名がIPリテラルでない場合にDNS解決結果の全アドレスを検証するようにした。
  - IPv4写像IPv6リテラル(ドット表記・16進表記の両方)を検出してブロック対象に含めた。
  - `redirect: "follow"` をやめ、リダイレクトを自前で追跡してホップごとに許可判定を行うようにした。
- 関連ファイル: `goal2-app/server.js`、`goal2-app/test/run-tests.js`、`memory/project-state.md`
- 関連PR: [#2](https://github.com/koteikara/11y-agent/pull/2)

## 2026-07-05: Goal 3(コンテンツ抽出)のドキュメント整備

- 背景・目的: `goal2-app/public/goal3.html`・`goal3.js` として実装済みだった「旧ページ全体HTMLからのコンテンツ抽出」機能が、`workstream.md` に正式なワークストリームとして文書化されていなかったため整備した。
- 主な変更内容:
  - `workstream.md` に「Goal 3: Content Extraction from Full Old Page HTML」を新規追加(実装状況、Target Flow、期待効果、リスク)。
  - `memory/project-state.md` のファイル構成・進捗・未決定事項・次候補作業をGoal 3に合わせて更新。
  - `done-definition.md` のSelf-Verification Commands・Workstream Done Criteria・Do Not Mark Done IfにGoal 3向けの基準を追加。
  - `goal2-app/README.md` にGoal 3画面(`/goal3.html`)の説明を追加。
- 関連ファイル: `workstream.md`、`memory/project-state.md`、`done-definition.md`、`goal2-app/README.md`
- 関連PR: [#1](https://github.com/koteikara/11y-agent/pull/1)
