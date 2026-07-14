# miChecker公式判定エンジン移植 実行計画書(Sonnet実装用)

作成: 2026-07-14 / 計画立案: Fable 5(このセッションで事前分析済み) / 実装担当: Sonnet

## 0. 必読(実装開始前に読むこと)

- `memory/michecker-research.md` — miCheckerの位置づけ・CSV形式・checkitem.xml/description_ja.propertiesの経緯の全て
- `a11y-migration-kb/vendor/eclipse-actf/NOTICE.md` — 一次ソースの取得元・コミット・ライセンス
- `a11y-migration-kb/reference/michecker-out-of-content-scope.json` — スコープ外152項目の分類(本計画のスコープ境界の正本)
- `goal2-app/public/app.js` の `runAnalysis()` / `isMicheckerRelevantRule()` / `MICHECKER_RULE_ALIASES`(660行付近) — 既存のmiCheckerモードの仕組み
- `goal2-app/GOAL1_BUILD_INSTRUCTIONS.md` §8 — リポジトリ運用ルール(本計画でも同一ルールを適用)

## 1. 目的

ユーザーの要求は「miChecker(エムアイチェッカー)と同じチェックをこのブラウザ上で可能にする」こと。現状のGOAL2「miChecker指摘対応のみ」モードは、公式チェック項目のWCAG番号・メッセージ文言と突き合わせた**独自ヒューリスティック**であり、公式の判定アルゴリズムそのものではない(このギャップの根拠はユーザーに説明済み)。

本計画では、miChecker/HTML Checkerの評価エンジン本体である
`org.eclipse.actf.validation.html/.../internal/CheckEngine.java`(約4,900行、EPL-1.0)の判定ロジックを、
**本文編集で対応可能な項目のみ**(ユーザー確定方針)JavaScriptへ忠実に移植し、
「miChecker相当の検査結果」をブラウザ上で得られるようにする。

## 2. 一次情報源の取得方法

```bash
# スクラッチパッド等の作業用ディレクトリで(リポジトリ内にはクローンしない)
git clone --depth 1 https://github.com/eclipse-actf/org.eclipse.actf.git actf-src
```

- 参照コミット: `703e34f0af7b7c4882a7adbd4fa6305f114cd548`(vendor/のcheckitem.xml等と同一時点。depth 1でmasterが進んでいた場合は
  `git fetch --depth 1 origin 703e34f0af7b7c4882a7adbd4fa6305f114cd548 && git checkout FETCH_HEAD`)
- 読むべきファイル(このセッションで所在確認済み):
  - `org.eclipse.actf.validation.html/src/org/eclipse/actf/validation/html/internal/CheckEngine.java`(4,909行) — 判定ロジック本体。約90個のメソッド(`item_0`〜`item_704`、`always`、`validateHtml`、`styleCheck`、`formCheck`、`mediaCheck`等)に分かれ、`addCheckerProblem("C_x.y", ...)`で指摘を発行する
  - 同`internal/`の補助クラス: `LanguageTag.java`(325行)、`FieldsetManager.java`(107行)、`CssBeforeAfterChecker.java`(159行)
  - `org.eclipse.actf.visualization.engines.blind/.../TextChecker.java`(433行) — alt文字列の品質判定(空白区切り・NGワード等)。画像alt系チェックが依存
  - `org.eclipse.actf.visualization.eval/.../html/HtmlEvalUtil.java`(1,462行)・`HtmlTagUtil.java`(386行) — 要素収集・テキスト取得ヘルパー。**丸ごと移植は不要**。大半はJSでは`querySelectorAll`等の1行で済む。CheckEngineから呼ばれている箇所に出会うたびに該当メソッドだけ読み、等価なJSを書く

## 3. 事前分析結果(Fable 5がこのセッションで確定させた事実)

### 3.1 スコープ集計

| 区分 | 件数 |
|---|---|
| 公式チェック項目 全体 | 268 |
| スコープ外(`michecker-out-of-content-scope.json`登録済み) | 152 |
| **本計画の対象(本文編集で対応可能)** | **116** |

対象116件の内訳(checkitem.xmlの`type`別): **error 24 / warning 18 / info 30 / user 44**。

判定はスクリプトで再現可能:
`goal2-app/data/michecker-checkitems.json`(JSONL)の全IDから、`michecker-out-of-content-scope.json`のキー(`C_`で始まるもの152件)を除いた差集合が対象116件。

### 3.2 特殊ケース(実装前に把握しておくこと)

1. **CheckEngine.java内に発火箇所が無いID: `C_16.0`・`C_332.0`** — checkitem.xmlには定義があるがエンジンは発行しない(C_332.0はmiChecker本体でも未発火であることを過去に実機確認済み)。**移植対象から除外**し、インベントリに「本体未発火」と記録する。ただしC_16.0/C_16.1/C_16.2相当のリスト構造検出はapp.js側に既存実装があるため、既存挙動は変更しない。
2. **CSS描画依存のID(9件): `C_8.0`, `C_33.0`, `C_33.1`, `C_33.2`, `C_500.17`〜`C_500.21`** — `styleCheck()`等がEclipse内蔵ブラウザのCSSOM(`IStyleSheets`)を参照する。ただしJavaソースを読むと、`style`属性・`<style>`要素のテキストを正規表現で解析する経路も併存している。**移植方針: テキスト解析経路のみ忠実に移植し、外部CSSファイル由来の検出はしない**(GOAL2は本文断片が対象で外部CSSはそもそも無いため、実用上の差は小さい)。この制約はインベントリと後述の既知差異リストに明記する。
3. **`always()`メソッド(3939行〜)** — ページ内容に関係なく常に発行される「手動確認」リマインダー群(一部は`hasAwithHref`等の単純フラグで条件付き)。対象116件のうち約24件がここに属する。実際のmiChecker CSVで「行番号が空欄の手動確認行」になっていたものに対応する。**個別の候補としてではなく、後述の「手動確認チェックリスト」としてまとめて扱う**。
4. **`TextChecker`依存** — 画像alt品質系チェック(3338行付近)が`checker.checkAlt(alt)`の結果(`NULL`/`BLANK`/`SPACE_SEPARATED`/`SPACE_SEPARATED_JP`等)で分岐する。TextChecker.javaは純粋な文字列処理433行であり移植可能。エンジンファイル内のヘルパーセクションとして移植する。
5. **行番号** — miChecker CSVの「行番号」列は専用HTMLパーサーの行情報由来。ブラウザの`DOMParser`では行番号が得られないため、**本移植では行番号は再現しない**(該当ノードのCSSセレクタパスで代替)。パリティ検証はチェックIDごとの件数比較で行う(後述§7)。

### 3.3 既存実装との関係

- `michecker_check_ids`タグ付きKBルールは29件・タグ付けされた公式ID(101件)が対象116件の大半をカバーする。残り15件(C_57.3, C_85.0, C_89.0, C_55.0, C_56.1, C_57.0, C_81.0, C_86.0, C_26.0, C_300.5, C_32.0, C_35.0, C_57.1, C_7.0, C_89.2)はKBルール未対応のバックログ(`michecker-triage.md`参照)。
- app.jsには過去の「検出パリティPhase 1〜3」で約40項目分の**独自実装**が既にある。**本計画はこれらを置き換えない**(削除・変更しない)。公式移植エンジンは**別ファイル・別レイヤー**として追加し、両者の一致・不一致はむしろ検証対象として活用する(§7)。

## 4. 設計方針(確定事項)

### 4.1 独立モジュール `goal2-app/public/michecker-engine.js`(新規)

- **CheckEngine.javaと1:1で対応する構造**にする: メソッド名(`item_331`等)をそのまま関数名として残し、各関数の冒頭コメントに「移植元: CheckEngine.java item_331 (L3480付近)」と対応行を書く。将来miCheckerが更新されたとき差分追跡できるようにするため。
- 公開API(goal3.js/app.jsのヘッドレスエンジンと同じIIFE+`window`公開パターン):
  ```js
  window.micheckerEngine = {
    // document: DOMParserでparseしたDocument(断片はGOAL2既存のラッパーでラップ済みのもの)
    // 返り値: { problems: [{ checkId, type, nodes: [cssSelectorPath...], extraText, message }], checklist: [{ checkId, type, message }] }
    run(document, options = {}) { ... },
  };
  ```
  - `problems` = 要素に紐づく指摘(該当ノードあり)。`message`は`description_ja.properties`のテンプレート(`goal2-app/data/michecker-checkitems.json`の`desc_ja`)に`{0}`置換を適用した文字列。**独自の文言を作らない**(公式CSVと突き合わせ可能にするため)。
  - `checklist` = `always()`系のページ非依存リマインダー(§3.2-3)。
  - 対象116件**以外**のチェックは実装しない。`options.checkIds`(配列)で発火対象をさらに絞れるようにする(テスト用)。
- 依存ゼロ(新規npmパッケージ禁止)。ブラウザ/`goal1.html`ヘッドレス文脈の両方で動くこと。

### 4.2 ライセンス隔離(必須・逸脱禁止)

移植コードはEPL-1.0コード(IBM Corporation)の二次的著作物になる。

- 移植ロジックは**`michecker-engine.js`1ファイルに完全に閉じ込める**。app.js等の既存ファイルへ移植ロジックをコピーしない(呼び出しはよいが、判定ロジック本体を混ぜない)。
- ファイル冒頭にEPL-1.0ヘッダー(移植元ファイル・参照コミット`703e34f0...`・Copyright (c) 2004, 2025 IBM Corporation and Others の表記)を置く。
- `a11y-migration-kb/vendor/eclipse-actf/NOTICE.md`に「`goal2-app/public/michecker-engine.js`はCheckEngine.java等の移植(EPL-1.0)」の節を追記する。

### 4.3 GOAL2への統合ポリシー(v1)

- エンジンは**「miChecker指摘対応のみ」モードのとき**、`runAnalysis()`の既存パイプラインの**後**に1回実行する(既存の候補生成には一切影響を与えない)。
- 結果は既存候補とマージ・重複排除**しない**。新しい表示領域「miChecker相当チェック結果」として独立表示する:
  - `problems`をCSV同様の表形式(種別/チェックID/該当箇所セレクタ/公式メッセージ/対応KBルール)で表示。対応KBルールは既存の逆引きインデックス(`michecker_check_ids`)を再利用。
  - `checklist`は折りたたみの「手動確認チェックリスト」として別枠表示(候補一覧を汚さない)。
  - 参考情報として「既存ヒューリスティック候補との突き合わせサマリー」(両方で検出/エンジンのみ/ヒューリスティックのみの件数)を1行表示する。
- 証跡JSON(`buildEvidence`)に`michecker_engine: { problems, checklist, engine_version }`を追加する(miCheckerモード時のみ)。
- KB全ルールモード(既定)では**エンジンを実行しない**(既定モードの挙動・性能を完全に現状維持)。

### 4.4 忠実性の原則

- 判定条件はJavaのロジックを**そのまま**移す(閾値・正規表現・分岐順序を含む)。「もっと良い判定にできる」と思っても改変しない — 改善はKB独自ルール側(既存ヒューリスティック)の役割であり、本エンジンの価値は「miCheckerと同じに振る舞うこと」にある。
- Javaと挙動を変えざるを得ない箇所(DOMParserとEclipse内蔵パーサーの差、CSS描画依存等)は、コード内コメント+§7の既知差異リストの両方に必ず記録する。

## 5. PR分割

GOAL1のときと同様、1PRずつ実装→検証→ユーザー確認→コミット→PR→マージ→ブランチ再構築の順で進める。

### PR-M0: インベントリ+エンジン骨格

1. `tools/`等にワンショット解析スクリプトを書き、**対象116件のインベントリ表**を`goal2-app/MICHECKER_PORT_INVENTORY.md`として生成・チェックイン:
   列 = チェックID / type / desc_ja要約 / CheckEngine.javaの担当メソッドと行番号 / 移植可否分類(pure-DOM / テキストCSS解析 / 本体未発火 / TextChecker依存) / 対応KBルール(あれば) / 実装PR(M1〜M3のどれか)
2. `michecker-engine.js`の骨格: EPLヘッダー、`run()`、`addCheckerProblem`相当の内部収集器、`desc_ja`テンプレートの`{0}`置換ヘルパー、セレクタパス生成、TextChecker移植(ヘルパーセクション)。チェック本体は未実装(0件発火)。
3. NOTICE.md追記。
4. テスト土台: `test/michecker-parity/fixtures/`ディレクトリと、fixture HTML→エンジン実行→チェックID件数を比較するNodeランナー(`test/michecker-parity/run-parity-tests.js`。既存`test/run-tests.js`から呼ぶか独立コマンドかは実装時に判断し、CHANGELOGに記録)。

合格条件: 既存6サンプルの回帰完全一致(エンジン未接続なので当然一致するはずだが確認する)。`node --check`成功。インベントリ表の合計が116件(±除外2件の明記)になっている。

### PR-M1: error型24件の移植

- インベントリでtype=errorの24件(うち本体未発火のC_16.0を除く23件)を移植。
- 各チェックIDにつき最低「陽性1・陰性1」のfixture HTMLを作り、パリティテストに登録。fixtureはJavaロジックの分岐を読んで境界値を突く(例: `item_331`のisSimpleTable判定 — 1行目全thの表はscope不要、崩れた表はscope必須)。
- GOAL2統合はまだ行わない(エンジン単体+テストのみ)。

### PR-M2: warning型18件の移植

- 同上の進め方。CSS描画依存9件のうちwarning/errorに属するもの(C_8.0等)はここまでに含まれるため、§3.2-2のテキスト解析限定方針で実装し、fixtureは`style`属性・`<style>`要素ベースで作る。

### PR-M3: info型30件+user型44件の移植

- 要素に紐づく条件付きのものは`problems`へ、`always()`系は`checklist`へ。
- `always()`系は1件あたり数行で終わる(無条件発行)ため、この段階でまとめて片付ける。

### PR-M4: GOAL2統合+UI

- §4.3のとおり統合。`goal1.html`にもスクリプトタグを追加し、GOAL1のmiCheckerモードバッチ実行時に`michecker_engine`が証跡へ入ることを確認(UI集計は最小限: ページ一覧にエンジン検出数の列を1本足す程度。凝った集計は本計画のスコープ外)。
- Playwright E2E: miCheckerモードで解析→「miChecker相当チェック結果」表とチェックリストが表示される/KB全ルールモードでは一切表示されず既存挙動と完全一致、を確認。

### PR-M5: 実機ゴールデン検証(ユーザー協力が必要)

- `test/michecker-parity/fixtures/`のHTML群(+実データ数ページ)を**ユーザーのWindows環境の`htmlchecker.exe -f`で検査してもらい**、出力CSVを`test/michecker-parity/golden/`に保存する。
- ランナーを拡張し、ゴールデンCSVの(チェックID→件数)とエンジン出力の(チェックID→件数)を突き合わせる。**対象116件のIDについて完全一致が目標**。不一致は1件ずつ原因調査し、(a)移植バグ→修正、(b)構造的差異(パーサー差・CSS描画)→既知差異リスト(`MICHECKER_PORT_INVENTORY.md`内の節)へ理由付きで登録、のどちらかに必ず倒す。
- スコープ外152件のIDはゴールデンCSVに現れても比較対象外(フィルタする)。
- この検証が終わって初めて「miCheckerと同じ判定(対象範囲内・既知差異を除く)」とユーザーに言える。**PR-M5完了までは、UI文言も『miChecker相当(移植版)』とし『同一』とは表記しないこと。**

## 6. 実装上の対応表(Java→JS)

| Java側 | JS側 |
|---|---|
| `Document`(Xerces/内蔵パーサー) | `DOMParser().parseFromString(html, "text/html")`。**注意**: HTMLパーサーの自動修復差(不正な入れ子の補正等)が判定差の源になり得る。差が出たら既知差異リストへ |
| `xpathService.evalPathForNodeList("descendant::td[@headers]", table)` | `table.querySelectorAll("td[headers]")`等。XPath軸がCSSで表せない場合のみ`document.evaluate`を使用 |
| `edu.getElementsList(doc, "th")`等のHtmlEvalUtilヘルパー | `querySelectorAll`+`Array.from`。HtmlEvalUtilの該当メソッドを読み、大文字小文字・名前空間の扱いを合わせる |
| `getTextAltDescendant(node)` | HtmlTagUtilの同名メソッドを読み、alt代替込みのテキスト収集を同じ規則で実装 |
| `MessageFormat.format(desc, args)` | `desc_ja`の`{0}`を単純置換(`{1}`以降が使われている項目があるか要確認) |
| `addCheckerProblem(id, str, nodeVector)` | 内部収集器に`{checkId, extraText, nodes}`をpush |
| `IStyleSheets`(CSSOM) | 実装しない。`style`属性/`<style>`テキストの正規表現解析のみ(§3.2-2) |

## 7. 検証方法(全PR共通)

1. `cd goal2-app && node --check public/michecker-engine.js public/app.js server.js`
2. パリティテスト: `node test/michecker-parity/run-parity-tests.js`(fixture陽性・陰性が全PASS)
3. 既存回帰: 既定モードで6サンプルの検出件数がベースライン(procedure-overview 11 / images 10 / tables 23 / links-text 29 / iframe 5 / goal3-hirosaki-news2019 20)と完全一致
4. `node test/run-tests.js`
5. PR-M4以降: Playwright E2E(§5参照)+スクリーンショットをユーザーへ共有
6. PR-M5: ゴールデンCSV突き合わせ(§5参照)

## 8. 非目標(このスコープではやらない)

- スコープ外152項目の移植(テンプレート・スクリプト実装・メディア制作系)
- 外部CSSファイルを解決してのスタイル判定、コントラスト比の実計算
- miChecker CSVの「行番号」列の再現
- 既存ヒューリスティック候補と公式エンジン結果の自動マージ・重複排除(v2候補。まず両者を並べて見えるようにする)
- lowVision(視覚シミュレーション)系・音声読み上げ順シミュレーション

## 9. 運用ルール

`GOAL1_BUILD_INSTRUCTIONS.md` §8と同一(日本語対応、コミット前ユーザー確認、CHANGELOG.md+memory/project-state.md更新、マージ後のブランチ再構築、新規npm依存の禁止、サーバー起動時の`unset GEMINI_API_KEY GEMINI_AUTH_MODE`)。加えて本計画固有:

- 移植中に「Javaのロジックがバグに見える」箇所を見つけても**修正せず忠実に移植**し、インベントリの備考に記録してユーザーへ報告する。
- `actf-src`のクローンはスクラッチパッドに置き、**リポジトリへコミットしない**(vendor/には既存2ファイル+NOTICEのみ)。
