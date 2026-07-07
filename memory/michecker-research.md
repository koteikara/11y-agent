# michecker-research.md

## Purpose

この文書は、公共団体向けのアクセシビリティ評価ツールである `miChecker` を、本プロジェクトのCMS移行・アクセシビリティ修正効率化にどう位置づけるかを整理する。

本プロジェクトでは、修正基準の正本はコンテンツ部分に特化した `a11y-migration-kb/` とする。一方で、多くの公共団体はWCAGやJISの達成基準を詳細には理解していない可能性があり、miCheckerで違反判定されるかどうかが、実務上の品質確認・検収判断に強く影響する。そのため、miCheckerは「外部参考ツール」ではなく、公共団体案件における重要な受け入れシグナルとして扱う。

## Investigated Sources

調査日は 2026-06-26。追加調査日は 2026-07-06。

主な確認元:

- 総務省 情報アクセシビリティポータルサイト: https://www.soumu.go.jp/info-accessibility-portal/webaccessibility/michecker/
- Eclipse ACTF miChecker説明: https://eclipse.dev/actf/downloads/tools/miChecker/index_ja.html
- miChecker v3評価ルール変更点: https://eclipse.dev/actf/downloads/tools/miChecker/v2v3_ja.html
- miChecker 開発環境準備手順書(2024年4月版): https://eclipse.dev/actf/downloads/tools/miChecker/miChecker_dev_env.pdf

## Official Positioning

総務省の公式ページでは、miCheckerは「みんなのアクセシビリティ評価ツール：miChecker（エムアイチェッカー）Ver.3.1」として紹介されている。

公式説明上の位置づけ:

- JIS X 8341-3:2016に基づくウェブアクセシビリティ対応の取組を支援するために、総務省が開発・提供するアクセシビリティ評価ツール。
- 第一の目的は検証作業の支援である。
- 付属文書等に沿って検証作業を行うことで、関連知識の習得も可能である。
- 機械的に検証可能な項目を自動評価し、人による判断も支援する。
- JIS X 8341-3:2016に基づく検証を全て自動的に行えるものではなく、人の判断により検証すべき項目が多数ある。

## Key Capabilities

公式ページで確認できる主な機能:

- 明らかな問題がある箇所を特定する。
- 問題の可能性が高い箇所、問題であるかについて人が判断すべき箇所を特定する。
- 問題箇所や検証項目に該当するJIS X 8341-3:2016の関連情報へのリンクを提供する。
- JIS X 8341-3:2016に基づく適合性評価や試験の実施を支援する付属資料を提供する。
- 音声読み上げソフトによる読み上げ順を視覚的にシミュレーションする。
- 高齢者・弱視者の見え方などを視覚的にシミュレーションする。

活用例:

- 新しいページの公開前確認。
- 既に公開されているページの問題確認。
- リニューアル時に、業者が作成したHTML雛形やページを検証する。
- JIS X 8341-3:2016に基づく適合性評価や試験に活用する。
- 情報アクセシビリティ自己評価様式作成時の技術基準の作成に活用する。
- ウェブアクセシビリティに関する知識習得に活用する。

## Runtime and Version Notes

公式ページで確認できる実行環境:

- OS: Windows 10、11
- ブラウザ: Microsoft Edge
- メモリ: 4GB以上
- ハードディスク空き容量: 250MB以上
- Java実行環境: Java 64bit版 Version 17
- 技術対応時点: 令和6年3月29日時点

バージョン関連:

- 公式ページ見出しは Ver.3.1。
- ダウンロードファイルは `michecker_v3_1.zip`。
- 更新履歴には `miChecker v3.10` の主な変更点として、WAI-ARIAおよび新たに追加された達成方法への対応、評価ルールの詳細化および調整、UI改善、付属文書追加・更新が記載されている。
- v3.00では、ブラウザがMicrosoft Edge、Java 64bit版 Version 17に変更され、HTML Living Standardにおける要素の追加・廃止などに伴う調整が行われている。
- Eclipse ACTF側の説明では、v2からv3への移行で、Internet Explorer相当のブラウザからMicrosoft Edge相当のブラウザへの変更、評価ルールの詳細化・調整が行われたと説明されている。

## Rule Change Notes from Eclipse ACTF

Eclipse ACTFの `miChecker v3の評価ルール変更点` では、v2からv3への差分として次のような点が説明されている。

- 同一テキストの繰り返しに関する評価が、隣接する画像リンクとテキストリンク、連続する画像などの状況に応じて分離された。
- 固定サイズフォントの指摘は、Internet Explorer相当からMicrosoft Edge相当への変更を踏まえ、要判断箇所相当に扱う方向へ調整された。
- 複雑なテーブルの `th` 要素と `scope` 属性に関するメッセージが詳細化された。
- 長い代替テキストについて、廃止された `longdesc` ではなく `aria-describedby` などの利用を促す方向へ変更された。
- v3.1以降では、スキップリンクに加え、`main` 要素などによる構造化の有無も踏まえて指摘が細分化されている。
- v3.1以降では、画像の代替テキスト、入力項目のラベル、テーブルの名前などについて、`aria-label`、`aria-labelledby` などを考慮した評価に変更されている。

## Development Environment Findings (CLI/API Feasibility)

`miChecker 開発環境準備手順書`(2024年4月版)を確認した結果、miCheckerを本プロジェクトのプログラム(goal2-app等)へ直接組み込む・CLIやAPIから呼び出す手段は無いことを確認した。

- miChecker自体はJavaベースのEclipse RCPアプリケーションであり、開発環境もWindows 10/11 + Eclipse IDE(2022-12版、64bit)が前提。
- ソースコード導入は`.psf`(Team Project Set)ファイルをEclipseのImport機能で読み込む形。
- 起動方法は`miChecker.product`ファイルを開き「Launch an Eclipse Application」を選択するのみで、GUI起動が前提。CLI実行・バッチ実行・ヘッドレスモードの記載は無い。
- ビルドもEclipse Product export wizardで`miChecker.exe`(Windowsデスクトップアプリ)を出力するのみ。
- 6.2節に「ACTF Visualization SDKには開発者向け情報(APIリファレンス等)が含まれる」との記載があるが、これはEclipseプラグインの拡張ポイント向け情報(Eclipse RCP内で動くプラグインを開発する人向け)であり、外部プログラムから叩ける公開API・Web APIではない。また同文書時点(2024年4月)では「最新のSDKの提供は2024年後半以降になる予定」とされ、この文書内でも未提供の状態だった。

結論(2026-07-06訂正): 上記は`miChecker`本体(GUI製品)についての結論としては引き続き正しいが、下記の通り**miChecker本体とは別に、CLIから使える公式の評価ツールが存在する**ことが判明した。CLI/APIが全く無いという結論は誤りだったため訂正する。

## CMS連携手順書で判明したCLIツール「HTML Checker」(重要・訂正)

2026-07-06、ユーザーから共有された`miCheckerのアクセシビリティ評価機能とCMS等との連携手順書`(2024年4月版)を確認したところ、miChecker(GUI製品)とは別に、**同じACTF評価エンジンを使うCLIツール「HTML Checker」(`htmlchecker.exe`)が公式に提供されている**ことが判明した。これはCMS等との連携を明示的な目的として設計されたツールである。

### 概要

- ソース入手: `https://www.eclipse.org/actf/downloads/tools/htmlchecker/htmlchecker.psf` (Team Project Setファイル)をEclipseの`File > Import > Team > Team Project Set`で導入。
- ビルド: miChecker本体と同様、Eclipse Product export wizardで`htmlchecker.exe`をビルドする(Windows専用、Eclipse IDE 2022-12前提という制約は同じ)。
- **実行方法はCLIそのもの**: `htmlchecker.exe -f "c:\tmp\htmllist.txt"` のように、検査対象のHTMLファイルパスを列挙したテキストファイル(`htmllist.txt`)を`-f`オプションで指定して実行する。GUI操作・クリック操作は不要。
- **出力もCLIバッチ向けに設計されている**: 実行すると`result`フォルダが自動生成され、以下のファイル群が出力される。
  - `[日付]_[時刻]_list.csv`: 検査したページと各結果ファイルの対応一覧。
  - `[日付]_[時刻]_[番号].csv`: 各ページの検査結果(列構成は本ドキュメントの「CSV Export Format」節で確認済みの形式と同一と推測される)。
  - 実行エラーは`log.txt`に出力される。
- 手順書内で**「5.1 外部アプリケーションとしての連携」として明示的にCMS連携方法が説明されている**: 「CMS等において評価の対象となるコンテンツをHTMLファイルとして一時フォルダなどに出力する」→「htmllist.txtに一覧を記載」→「htmlchecker.exeの-fオプションで実行」→「resultフォルダの内容を読み込んでCMS等に取り込む」という一連の流れが、まさに本プロジェクトが必要としている自動化そのものである。
- 「5.2 評価機能のJavaプログラムとしての利用」として、HTML Checkerのソースを参考に独自のJavaプログラムを書く、またはソースを直接改変して再利用する道も明記されている(より深い組み込み)。

### 本プロジェクトへの影響(重要な訂正点)

- **miChecker本体(GUI)はCLI/APIなしという結論は変わらない**が、**同じ評価エンジンを使うCLI版(HTML Checker)であれば、バッチ処理・自動CSV出力が可能**であることが確認できた。
- ただし以下の制約は変わらない。
  - `htmlchecker.exe`のビルド自体は依然としてWindows + Eclipse IDE前提であり、goal2-app(Node.js、Cloud Run/Linux想定)のプロセスに直接組み込むことはできない。
  - 実行にはWindows環境(実機またはWindows VM)が必要。goal2-appのサーバーサイドから直接呼び出すことはできないが、**Windows環境を1台用意できれば、そこで移行元・移行後のHTML群をまとめて`htmlchecker.exe -f`でバッチ検査し、出力されたCSV群をgoal2-appの`michecker-compare.html`に読み込ませる、という半自動パイプラインは十分に現実的**。
- 前後比較の「移行元CSVを1件ずつGUIで手動出力する」という運用コストは、`htmlchecker.exe`を使えば「検査対象HTMLファイル一覧を用意してバッチ実行するだけ」に削減できる可能性が高い。特にGoal 1(一括抽出)のような多ページ処理と相性が良い。
- 出力CSVの列構成が、GUI版でエクスポートしたものと同一かどうかは未検証(実際に`htmlchecker.exe`をビルド・実行して確認する必要がある)。

## htmlchecker.exe 実機検証結果(2026-07-07・確定)

ユーザーが実際にWindows環境で`htmlchecker.exe`をビルド・実行し、実HTML(安城市の入札結果ページ、移行前後の想定で作成した`before.html`/`after.html`)で検査した結果を確認した。以下は全て実機で確認済みの事実。

### セットアップで実際に発生した問題と対処

- `.psf`ファイル(Team Project Set)経由のインポートは、内部で`git://git.eclipse.org/gitroot/actf/org.eclipse.actf.examples.git`という**旧式のgit://プロトコル**を参照しており、「Connection timed out: getsockopt」で失敗した(ファイアウォール等でgit://ポートがブロックされるケースが多い)。
  - 対処: `.psf`によるインポートは諦め、GitHub本家リポジトリ(`https://github.com/eclipse-actf/org.eclipse.actf.git`)をEclipseの`Import > Git > Projects from Git > Clone URI`で直接HTTPSクローンする方式に切り替えて解決した。`org.eclipse.actf.examples.htmlchecker`はこの単一モノレポの中にトップレベルフォルダとして存在する。
- ビルド後、`htmlchecker.product`の「Overview」タブ内(タブではなくOverviewタブの中の1セクション)にある「Testing」→「Launch an Eclipse application」から起動する。起動時に依存プロジェクト`org.eclipse.actf.visualization`のコンパイルエラーで「Errors in Workspace」警告が出たが、「Proceed」で起動して問題なく動作した。
- 初回起動時、`C:\eclipse\htmllist.txt`が存在しないためのエラーメッセージが表示された。`org.eclipse.actf.examples.htmlchecker-feature/rootfiles/htmllist.txt`にサンプルがある。

### htmllist.txt の実際の書式(確認済み)

コメント行や特殊記法は無く、検査対象HTMLファイルの絶対パスを1行に1つずつ書くだけ。

```
C:\eclipse\source\before.html
C:\eclipse\source\after.html
```

### `[日付]_[時刻]_list.csv` の実際の書式(確認済み・重要)

ヘッダーは日本語ではなく英語で、`Target HTML file,Result CSV file`。値は検査対象ファイルの絶対パスと、対応する結果CSVファイルの絶対パスがそのまま入っている。

```
"Target HTML file","Result CSV file"
"C:\eclipse\source\before.html","C:\eclipse\result\0707_1120_1.csv"
"C:\eclipse\source\after.html","C:\eclipse\result\0707_1120_2.csv"
```

これにより、「検査対象ファイルのパス」→「結果CSVファイルパス」の対応が一意に確定できる。以前goal2-app側で採用していた「ファイル作成順(mtime)で対応付ける」という未検証の仮定は不要になり、`goal2-app/server.js`はこの`list.csv`をパースして確実に対応付ける方式に修正済み。

### 各ページの結果CSV(`[日付]_[番号].csv`)の列構成(確認済み・GUI版との差分)

htmlchecker.exe(CLI版)の結果CSVは、GUI版(`miChecker.exe`)でエクスポートしたCSVと**列構成が異なる**。CLI版には **`WCAG 2.0`という列が`堅ろう（牢）`と`JIS`の間に追加されており、12列**(GUI版は11列)。

```
種別,知覚可能,操作可能,理解可能,堅ろう（牢）,WCAG 2.0,JIS,ガイドライン(ヘルプ),達成方法,達成方法(ヘルプ),行番号,内容
```

この実データでは`WCAG 2.0`列と`JIS`列は同一の値が入っていた(例: 両方とも`A: 2.4.1`)。エンコーディングはGUI版と同じくShift-JIS(CP932)。

`goal2-app/public/michecker-compare.js`のCSVパーサーは列名ベースで値を取得する実装のため、この列追加があってもコード変更なしで正しく動作することを実際のCSVデータで確認済み。

### 実データでの前後比較結果(動作確認)

移行元(before.html、62件)・移行後(after.html、57件)を実際に`michecker-compare.html`に読み込ませたところ、49件のシグネチャに集約され、「新規2件・未解消42件・解消5件」という妥当な結果になった。「th要素にscope属性がありません」(3件→0件)が解消に分類されるなど、期待通りの挙動を確認した。

## ソース貼り付けでの検証について(miChecker本体のGUI)

miChecker本体(GUI)には「HTMLソースを直接貼り付けて検証する」ような専用のテキストボックスは無い。`miChecker利用ガイド`(2024年4月版)によれば、公式に案内されている代替手順は次の通り。

- ライブURLとして検査できないページ(ログイン後のページ、フォーム送信結果のページ、ローカルにしか無いHTML断片など)については、**「HTMLファイルとして保存」→「保存したファイルをmiCheckerの「ブラウザ」で開く」**という手順が案内されている。
  - 一般的なブラウザの「名前を付けて保存」機能、またはmiChecker自身の「ブラウザ」のコンテキストメニュー(右クリックまたはShift+F10)から「名前を付けて保存」(ファイルの種類は「Webページ、HTMLのみ」)で保存する。
  - もしくは、検証したいページの「ソースを表示」した内容をメモ帳等にコピー&ペーストし、`.html`/`.htm`として保存した上で、そのファイルをmiCheckerの「ブラウザ」で開く。
- つまり「貼り付け」そのものではなく、**「一度ローカルHTMLファイルとして保存してから開く」のが公式な回避策**であり、実質的には貼り付けと同じ効果が得られる(抽出済みHTML断片をこの方法で検証すること自体は可能)。
- 補足: miCheckerには「チェック対象」設定があり、[HTMLファイル](ソース上の行番号が分かる。動的に変更されるページには弱い)と[ブラウザ内のDOM](行番号は分からないがJavaScript実行後の状態を検査できる)を切り替えられる。行番号付きのCSV(本ドキュメントで確認済みの形式)を得るには[HTMLファイル]モードを使う必要がある。

## CSV Export Format (Confirmed with Real Sample)

2026-07-06、実際のmiChecker検査結果CSV(安城市 入札契約結果ページ https://www.city.anjo.aichi.jp/zigyo/nyusatsu/keiyaku/kekka.html の検査結果)を確認した。CLI/APIは無いが、**GUIで手動実行した結果をCSVでエクスポートすることは可能**であり、そのCSVをプログラムで取り込むことは十分に実現可能と判断した。

### エンコーディング上の注意(重要)

- ファイルは **Shift-JIS (CP932)** でエンコードされている。UTF-8として読み込むと文字化けする。取り込み処理では明示的に`cp932`(または`shift_jis`)でデコードすること。
- 一部のセル(`ガイドライン(ヘルプ)`列など)は、値の途中に改行やタブを含むマルチライン・クオート付きフィールドになっている。単純な行分割ではなく、正式なCSVパーサー(引用符・改行対応)で読む必要がある。

### 列構成

| 列名 | 内容 | 例 |
|---|---|---|
| 種別 | 指摘の種別(下記4種類) | `問題あり` |
| 知覚可能 | WCAG「知覚可能」カテゴリへのスコア影響(0または負値) | `-5` |
| 操作可能 | 「操作可能」カテゴリへのスコア影響 | `0` |
| 理解可能 | 「理解可能」カテゴリへのスコア影響 | `0` |
| 堅ろう（牢） | 「堅牢」カテゴリへのスコア影響 | `0` |
| JIS | 該当するJIS/WCAG達成基準番号(複数可、カンマ区切り) | `A: 1.3.1` |
| ガイドライン(ヘルプ) | WCAG解説ページのURL(複数可) | `https://waic.jp/translations/UNDERSTANDING-WCAG20/...` |
| 達成方法 | WCAG達成方法コード(複数可、カンマ区切り) | `H63` |
| 達成方法(ヘルプ) | 達成方法解説ページのURL(複数可) | `https://waic.jp/translations/WCAG-TECHS/H63.html` |
| 行番号 | 検査対象HTMLソース内の該当行番号(複数可、カンマ区切り)。**49/85件で空欄**(ページ全体・特定箇所を持たない指摘) | `2198, 2199` |
| 内容 | 指摘の説明文(定型メッセージ+該当時はCSSセレクタや要素情報を含む) | `th要素にscope属性がありません。scope属性を適切に用いて...` |

### 種別(4種類)と特徴

実サンプル(85件)の内訳: `要判断箇所`44件、`手動確認`36件、`問題あり`3件、`問題の可能性大`2件。

- **`問題あり`**: 明らかな問題。スコア列に負値(実サンプルでは`-5`)が入る。`行番号`も具体的な値が入っていることが多い。既存の「Proposed miChecker Result Handling」表の「明らかな問題」に対応。
- **`問題の可能性大`**: 問題の可能性が高い箇所。スコア列に負値(実サンプルでは`-2`)。同表の「問題の可能性が高い箇所」に対応。
- **`要判断箇所`**: スコア列は常に`0,0,0,0`。人間が判断すべき箇所。同表の「人が判断すべき箇所」に対応。
- **`手動確認`**: スコア列は常に`0,0,0,0`。ページ全体に関わる手動確認項目が多く、`行番号`が空欄のことが多い(例: 「バリデータでチェックしてください」)。

つまり、**スコアに影響する(=定量的に深刻度が高い)のは`問題あり`と`問題の可能性大`のみ**であり、この2種別が前後比較で「解消したか」を機械的に追跡する最有力候補になる。`要判断箇所`と`手動確認`は人間の確認記録が引き続き必要。

### 前後比較への活用イメージ

- `行番号`は移行元・移行後で別々のHTMLファイルの行番号なので、単純な行番号一致では前後比較できない。代わりに `(JIS, 達成方法, 内容の定型メッセージ部分)` の組み合わせを指摘の「シグネチャ」として、移行元CSVと移行後CSVで同じシグネチャの件数を比較する方式が有効そう。
- 実サンプルの`問題あり`(th要素にscope属性がありません、3件)は、既存の`a11y-migration-kb/rules/table/`系ルール(表構造・見出しセル関連)と直接対応しており、KBルールとの紐付けは無理なく可能。

## Implications for This Project

### 1. miCheckerは実務上の受け入れシグナル

公共団体側がWCAG/JISの詳細を理解していない場合、miCheckerで指摘されるかどうかが品質判断の中心になりやすい。

そのため、本プロジェクトでは次のように扱う。

- `a11y-migration-kb/` に沿った修正候補であっても、miCheckerでコンテンツ起因の明らかな問題として残る場合は、完了扱いにしない。
- miCheckerで指摘される可能性がある項目は、AGENTの候補生成・品質ゲート・証跡項目へ反映する。
- miCheckerで指摘が残るが業務上修正しない場合は、理由、スコープ、判断者、確認日を証跡として残す。

### 2. miCheckerはページ全体検査になりやすい

miCheckerはページまたはHTML雛形の検証を支援するツールであり、本プロジェクトのような「CMSに登録するコンテンツ部分だけ」の修正とはスコープがずれる可能性がある。

そのため、miChecker結果は必ず次に分類する。

- `content`: CMSに登録する本文コンテンツ起因の指摘。
- `old-site-template`: 旧サイトのヘッダー、ナビゲーション、フッター、テンプレート等に起因する指摘。
- `new-cms-template`: 新CMSテンプレートや製品側部品に起因する指摘。
- `unknown`: 本文起因かテンプレート起因か判断できない指摘。

### 3. Goal 1での扱い

Goal 1では、CMS登録前に次の2段階で使う。

- 抽出済みHTML断片を検査用HTMLにラップし、miChecker相当の事前確認を行う。
- CMS登録後のプレビューURLでmiCheckerを実行し、実際に顧客が見るページで指摘が残るか確認する。

ただし、検査用HTMLラッパーで出る指摘と、CMS登録後プレビューで出る指摘は分けて記録する。

### 4. Goal 2での扱い

Goal 2では、作業者がページ単位で登録・修正した後、miChecker確認を承認前ゲートとして組み込む。

- AGENTは、miCheckerで指摘されやすい候補を事前に提示する。
- 作業者は、miChecker指摘が本文起因かテンプレート起因かを確認する。
- 承認者は、本文起因の明らかな問題が残っていないこと、要判断箇所に判断記録があることを確認する。

## Proposed miChecker Result Handling

| miChecker上の扱い | 本プロジェクトでの扱い | 完了判定 |
|---|---|---|
| 明らかな問題 | `content` 起因なら修正必須 | 未修正なら完了不可 |
| 問題の可能性が高い箇所 | 修正または人間確認 | 判断記録なしなら完了不可 |
| 人が判断すべき箇所 | 作業者または承認者確認 | 判断記録があれば完了可 |
| シミュレーションで気づいた問題 | 目視確認・必要に応じて修正 | 証跡次第 |
| テンプレート起因の指摘 | 移行HTML修正とは分離 | `new-cms-template` または `old-site-template` として記録 |

## Evidence Items to Record

miCheckerを使う場合、スプレッドシートまたは証跡データに次を残す。

- miCheckerバージョン。
- 実行日。
- 検査対象URLまたは検査対象HTML。
- 検査対象が `pre-registration-wrapper` か `cms-preview` か。
- 指摘種別。
- 指摘箇所。
- `content` / `old-site-template` / `new-cms-template` / `unknown` の分類。
- 修正前HTMLまたは該当箇所。
- 修正後HTMLまたは対応内容。
- `a11y-migration-kb/` の関連ルール。
- miChecker上の指摘が解消したか。
- 解消しない場合の理由。
- 作業者確認者。
- 承認者確認者。

## Open Questions

- ~~miCheckerを自動実行できるCLI/APIがあるか、またはGUI前提で手動ゲートにするか。~~ → 2026-07-06訂正: miChecker本体(GUI)にはCLI/APIは無いが、**同じ評価エンジンを使う別のCLIツール「HTML Checker」(`htmlchecker.exe`)が公式に存在する**ことが判明(詳細は上記「CMS連携手順書で判明したCLIツール」節)。Windows環境が必要な点は変わらないが、バッチ実行・自動CSV出力は可能。
- 抽出済みHTML断片をmiCheckerで検証するための最小HTMLラッパーをどう設計するか。→ `htmlchecker.exe -f htmllist.txt`で複数HTMLファイルをバッチ検査できるため、Goal1/Goal2の候補HTMLを一時ファイル群として出力し、一覧ファイルを渡す設計が現実的になった。要検証。
- CMS登録後プレビューURLを、miCheckerで安定して検査できる環境をどう用意するか。
- ~~miChecker結果のエクスポート形式をどう取得し、スプレッドシート証跡に接続するか。~~ → 2026-07-06確認: CSVエクスポート(Shift-JIS/CP932、引用符付きマルチラインフィールド)を実サンプルで確認済み。列構成は上記「CSV Export Format」参照。取り込み(パース)自体はプログラム側で実装可能。
- ~~移行元CSVと移行後CSVを、行番号に頼らずどう機械的に対応づけるか~~ → 2026-07-06実装・2026-07-07実データで検証: `(種別, JIS, 達成方法)`のシグネチャで対応づける方式を実装し、実際のhtmlchecker.exe出力(62件/57件→49シグネチャ、新規2/未解消42/解消5)で妥当な結果になることを確認した。
- miCheckerの指摘分類と、`a11y-migration-kb/` のルール分類をどう対応づけるか。→ 下記「miChecker指摘内容カタログとKBカバレッジ分析」節を参照。逆引きUI自体は未実装。
- ~~`htmlchecker.exe`を実際にビルド・実行し、出力CSVの列構成がGUI版のエクスポート形式と同一かを検証する~~ → 2026-07-07確認: 完全に同一ではなく、CLI版には`WCAG 2.0`列が追加され12列構成だった(GUI版は11列)。詳細は上記「htmlchecker.exe 実機検証結果」節。goal2-app側のパーサーは列名ベースのため影響なし。
- `htmlchecker.exe`をどのWindows環境(ユーザーのPC/専用VM等)で動かす運用にするか、goal2-appからその結果CSVをどう受け渡すか。→ ユーザー自身のWindows PCでgoal2-appをローカル起動し、`MICHECKER_HTMLCHECKER_EXE`環境変数経由でサーバーサイドから直接呼び出す方式を実装済み(Cloud Runホスト版とは別軸)。

## miChecker指摘内容カタログとKBカバレッジ分析(2026-07-07)

ユーザーが発見した第三者サイト「miChecker対策テクニック集」(https://accessibility.jp/resources/tools/michecker-techniques/) は、miCheckerが出す指摘メッセージ本文(`内容`列、`{0}`等のプレースホルダ含む)を、対応するWCAG 2.0達成基準・達成方法番号・種別・スコア構成とともに一覧化した表(91データ行・見出し行含め92エントリ)を掲載している。プロキシポリシーによりWebFetch/curlでは直接取得できなかったため、ユーザーがページソースを直接貼り付け、BeautifulSoup4でテーブルを解析した(`content`/`link`/`wcag`/`technique`/`type`/`scores`の92件構造化データ)。

抽出した`内容`列のテンプレート文言を、実際にhtmlchecker.exeで得られた実データCSVの`内容`列と突き合わせたところ完全一致しており、カタログの信頼性を確認した。

### カバレッジ分析の手法と結果

カタログ92件それぞれのWCAG番号セットと、`a11y-migration-kb/`全43ルール(当時)の`wcag:`フロントマター値の和集合(distinctで8種)を比較。単純なWCAG番号の集合差分では、40/92件(17/24種の異なるWCAG基準)がKB側でカバーされていないという結果になった。

ただし、番号の不一致がそのまま「内容のカバー漏れ」ではない例もあった。例えば`heading-order.md`は本文で「見出しの入れ子関係」を既に実質的にカバーしていたが、`wcag:`タグは1.3.1/2.4.1のみでmiChecker側の2.4.10(AAA、見出しの入れ子)を含んでいなかった。このような「タグ漏れ」と「ルール自体が存在しない」を区別した上で最終的な対応を行った。

### 対応内容

ユーザーの指示(「ルールを拡張していきましょう。KBに拘る必要はないので」)に基づき、a11y-migration-kbを拡張する方針で対応した。

**タグ追加のみ(ルール自体は既存で十分カバー済み)**:
- `rules/html-structure/heading-order.md`: `wcag`に`"2.4.10"`を追加。
- `rules/text/color.md`: `wcag`に`"1.4.6"`を追加し、AAA(7:1コントラスト比)目標時はCMS標準パレットの別途確認が必要な旨を一文追加。

**新規ルール追加(実際にKBに欠けていた項目)**:
- `rules/html-structure/deprecated-elements.md` — 廃止要素(font/marquee/blink/applet/center/u/tt/acronym/big/strike)の除去。`wcag: ["4.1.1","2.2.2"]`、`processing_class: hybrid`。
- `rules/html-structure/page-title.md` — ページタイトル(title要素)。`wcag: ["2.4.2"]`、`processing_class: hybrid`、`cms_auto: true`。
- `rules/html-structure/lang-attribute.md` — 文書のlang属性。`wcag: ["3.1.1"]`、`processing_class: mechanical`、`cms_auto: true`。
- `rules/html-structure/duplicate-id-accesskey.md` — id・accesskey属性の重複。`wcag: ["4.1.1"]`、`processing_class: mechanical`。
- `rules/html-structure/embedded-script-behavior.md` — 埋め込みスクリプトによる自動的な動作(自動音声再生・自動リロード・マウス限定イベント等)。`wcag: ["1.4.2","2.1.1","2.2.1","2.2.4","3.2.5"]`、`processing_class: escalation`(テンプレート起因が多く開発者エスカレーション前提)。
- `rules/text/spaced-characters.md` — 見た目調整目的の文字間空白除去(スクリーンリーダー読み上げ阻害)。`wcag: ["1.3.2"]`、`processing_class: mechanical`。
- `rules/form/submit-button.md`(新設`form/`カテゴリ) — フォームの送信ボタン。`wcag: ["3.2.2"]`、`processing_class: hybrid`。
- `rules/form/label-position.md` — label配置。`wcag: ["3.3.2"]`、`processing_class: ai`。

いずれも`resource: https://accessibility.jp/resources/tools/michecker-techniques/`として出典を明記し、既存の他ルールと同じfrontmatter/本文構成(`# 必須ルール` + `# 例` の `## ケースN:` + before/after)に従った。

`rules/html-structure/index.md`・`rules/text/index.md`・`rules/index.md`(新設`form/`セクション)を更新し、`tools/okf2jsonl.py`で`build/rules.jsonl`を再生成(53ルール、カテゴリ別`{file:2, form:2, html-structure:7, image:8, link:9, table:9, text:16}`、処理分類別`{escalation:5, mechanical:16, ai:11, hybrid:21}`)。`goal2-app/data/rules.jsonl`にコピーし、`node test/run-tests.js`とPlaywright回帰確認(組み込みサンプル全件でエラーなし)で問題ないことを確認した。

### 未実装の残課題

カタログ92件と`goal2-app`の比較結果画面を突き合わせ、各行をカタログエントリ経由でKBルールへ逆引き表示する機能(当初の発端となった要望)自体は、今回は着手していない。KB拡張が先行タスクとして完了した段階であり、ユーザーの直近指示はこちらを優先する内容だった。

## miChecker公式ソース(eclipse-actf/org.eclipse.actf)によるカバレッジ再分析(2026-07-07)

ユーザーが提示した https://github.com/eclipse-actf/org.eclipse.actf は、単なる関連リポジトリではなく、**miChecker/HTML Checkerの評価エンジン本体のソースコード**だった。特に以下の2ファイルが、これまで参照していたaccessibility.jpの第三者カタログ(92件・24種のWCAG基準)より遥かに完全な一次情報源であることを確認した。

- `org.eclipse.actf.validation.html/resources/checkitem.xml` — 全268件のチェック項目。各項目にWCAG 2.0達成基準番号・達成方法(techniques)コード・重大度(`error`/`warning`/`info`/`user`)が対応付けられている。
- `org.eclipse.actf.validation.html/resources/description_ja.properties` — 各チェック項目ID(`C_0.0`、`C_15.0`等)に対応する日本語メッセージ本文(`{0}`プレースホルダ含む)。

このセッション前半でユーザーが実機取得した実際のhtmlchecker.exe結果CSV(`michecker_result_utf8.csv`)の`内容`列と、`description_ja.properties`の該当エントリを突き合わせたところ完全一致した(例: `C_8.0`の配色情報に関する文言、`C_15.0`の見出し太字利用に関する文言)。これにより、この2ファイルの組がCSV出力の一次ソースであることを確定させた。ライセンスはEPL-1.0(IBM Corporation)。

### 再分析の結果

`checkitem.xml`全268件から抽出した distinct WCAG 2.0基準は**50種**(accessibility.jpカタログの24種より大幅に多い)。このタイミングでの`a11y-migration-kb`(前回拡張後の53ルール)がカバーする22種と比較した結果、**28種のWCAG基準**が公式ソースには存在するがKB側では未カバーだった。

### 対応方針(ユーザー指示: 「拡張します。ただしCMSの本文コンテンツに関係ないものは省きます。さらにKB由来のものとmiChecker由来のものを分別して修正をKB版とmiChecker版で選べるようにします」)

**28基準を精査し、CMS本文コンテンツの編集で対応可能かどうかで選別した**:

- 対象外とした基準(音声・動画のキャプション/音声ガイド制作(1.2.1〜1.2.5、メディア新規制作が必要)、キーボードトラップ・マウス限定操作以外のフォーカス関連(2.1.2、2.4.3、2.4.7、3.2.1、スクリプト/テンプレート実装レベル)、サイト全体のナビゲーション設計(2.4.5、2.4.8、3.2.3、3.2.4)、フォームのクライアントサイド検証・ARIAライブリージョン実装(3.3.3、3.3.4、3.3.6)、カスタムウィジェットのARIA実装詳細(4.1.2の大半))は、コンテンツ編集者による本文修正の範囲を超える(テンプレート・スクリプト実装・メディア制作が必要)ため、a11y-migration-kbの対象外とした。
- 本文コンテンツで対応可能な残りの基準について、新規ルール8件を追加し、既存3件にWCAGタグを追加した(詳細は下記フロントマター拡張とルール一覧を参照)。

### フロントマター拡張: `origin` / `michecker_check_ids`

「KB由来」と「miChecker由来」を区別し、必要に応じて修正方針を選べるようにするため、ルールのfrontmatterに2つのフィールドを追加した(`tools/okf2jsonl.py`・`README.md`のフロントマター規約表も対応更新済み)。

- `origin`: `kb`(本KB独自の知見。省略時のデフォルト)または`michecker`(miChecker公式チェックエンジンの発見を契機に追加したルール)。
- `michecker_check_ids`: 対応する公式チェック項目ID(例: `["C_51.0"]`)。出典は`checkitem.xml`/`description_ja.properties`。

**KB版とmiChecker版を分けて選べるようにした2ペア**(同じ関心事について、既存のKB独自ルールとmiChecker由来の観点を別ファイルとして`related`で相互リンク):
- `rules/link/link-text.md`(origin: kb、「指示語だけのリンクを避ける」という編集面の指摘) ↔ `rules/link/link-purpose-standalone.md`(新規、origin: michecker、WCAG 2.4.9、「空リンク・重複リンクテキスト」という機械的な検出観点)
- `rules/html-structure/heading-order.md`(origin: kb、見出しレベルの階層順序) ↔ `rules/html-structure/heading-content-quality.md`(新規、origin: michecker、WCAG 2.4.6、見出しタグを太字目的だけに使わない、内容を表す文言にする)

**新規ルール(origin: michecker)の残り6件**:
- `rules/text/sensory-characteristics.md`(WCAG 1.3.3、形状・位置・色だけに依存した案内文の回避)
- `rules/image/avoid-text-as-image.md`(WCAG 1.4.5/1.4.9、文字を画像化しない)
- `rules/text/abbreviation.md`(WCAG 3.1.4、略語・頭字語のabbr表記)
- `rules/html-structure/iframe-frame-title.md`(WCAG 4.1.2、iframe/frame要素のtitle属性。実は`goal2-app/public/app.js`側に同種のチェック(`ruleId: "iframe.title"`)が既に実装済みだったが、KB側には対応ドキュメントが無かったため今回追加した)
- `rules/form/required-field-indication.md`(WCAG 3.3.1、必須項目をテキストでも明示)
- `rules/form/input-format-hint.md`(WCAG 3.3.5、入力形式・入力例のヒント)

**既存ルールへのタグ追加のみ(origin: kb のまま、michecker_check_idsは参考情報として追加)**:
- `rules/html-structure/embedded-script-behavior.md`: +2.1.3(マウス限定イベントハンドラ、既存の2.1.1と同じ内容のAAA版)
- `rules/html-structure/deprecated-elements.md`: +2.3.1(blink/marquee除去が閃光基準も同時に解消)
- `rules/image/alt-text.md`: +3.1.5(アイコン・画像の理解補助における代替テキスト、既存の1.1.1ガイダンスと同内容)

`build/rules.jsonl`を再生成(61ルール、`origin: michecker`が8件)し`goal2-app/data/rules.jsonl`に同期。`node test/run-tests.js`・既存サンプル6件のPlaywright回帰確認はいずれも成功。

### 未実装の残課題(更新)

- カタログ/公式ソースの各項目とgoal2-appの比較結果画面を直接紐づけ、KBルールへ逆引き表示するUI機能は依然として未着手。
- `origin`/`michecker_check_ids`は現時点ではKBのフロントマター・JSONLデータ上の区別に留まる。goal2-app側のUI(候補一覧・ルール一覧画面)で「マニュアル版」「miChecker版」を視覚的に区別したり、同一問題に対する2つの修正案を選択させたりする画面機能は未実装。

### origin値のリネームと内包関係の明示(2026-07-07追記)

上記で導入した`origin: kb`は、リポジトリ全体の呼称「KB(a11y-migration-kb)」と紛らわしいとの指摘を受け、`manual`にリネームした(a11y-migration-kbが「データ移行総合マニュアルV2.01」のOKF化であることに即した命名)。あわせて、マニュアル版とmiChecker版が対になっている2ペア(`link-text.md`↔`link-purpose-standalone.md`、`heading-order.md`↔`heading-content-quality.md`)について、両者は「並列の選択肢」ではなく「マニュアル版の基準を満たせばmiChecker版の指摘も内包的に解消する」関係であることを明示する`includes`フィールド(マニュアル版→対応miChecker版へのパス配列)を新設した。`origin`の内訳は`manual`53件・`michecker`8件。

## Source Links

- https://www.soumu.go.jp/info-accessibility-portal/webaccessibility/michecker/
- https://eclipse.dev/actf/downloads/tools/miChecker/index_ja.html
- https://eclipse.dev/actf/downloads/tools/miChecker/v2v3_ja.html
- https://eclipse.dev/actf/downloads/tools/miChecker/miChecker_dev_env.pdf
- miChecker利用ガイド(2024年4月版、ユーザー提供PDF)
- miCheckerのアクセシビリティ評価機能とCMS等との連携手順書(2024年4月版、ユーザー提供PDF、HTML Checker/`htmlchecker.exe`について記載)
- miCheckerよくある指摘事項と対応方法(2024年4月版、ユーザー提供PDF)
- miCheckerを用いた試験手順書(2024年4月版、ユーザー提供PDF)
- miChecker達成基準別活用法(2024年4月版、ユーザー提供PDF)
