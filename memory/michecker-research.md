# michecker-research.md

## Purpose

この文書は、公共団体向けのアクセシビリティ評価ツールである `miChecker` を、本プロジェクトのCMS移行・アクセシビリティ修正効率化にどう位置づけるかを整理する。

本プロジェクトでは、修正基準の正本はコンテンツ部分に特化した `a11y-migration-kb/` とする。一方で、多くの公共団体はWCAGやJISの達成基準を詳細には理解していない可能性があり、miCheckerで違反判定されるかどうかが、実務上の品質確認・検収判断に強く影響する。そのため、miCheckerは「外部参考ツール」ではなく、公共団体案件における重要な受け入れシグナルとして扱う。

## Investigated Sources

調査日は 2026-06-26。

主な確認元:

- 総務省 情報アクセシビリティポータルサイト: https://www.soumu.go.jp/info-accessibility-portal/webaccessibility/michecker/
- Eclipse ACTF miChecker説明: https://eclipse.dev/actf/downloads/tools/miChecker/index_ja.html
- miChecker v3評価ルール変更点: https://eclipse.dev/actf/downloads/tools/miChecker/v2v3_ja.html

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

- miCheckerを自動実行できるCLI/APIがあるか、またはGUI前提で手動ゲートにするか。
- 抽出済みHTML断片をmiCheckerで検証するための最小HTMLラッパーをどう設計するか。
- CMS登録後プレビューURLを、miCheckerで安定して検査できる環境をどう用意するか。
- miChecker結果のエクスポート形式をどう取得し、スプレッドシート証跡に接続するか。
- miCheckerの指摘分類と、`a11y-migration-kb/` のルール分類をどう対応づけるか。

## Source Links

- https://www.soumu.go.jp/info-accessibility-portal/webaccessibility/michecker/
- https://eclipse.dev/actf/downloads/tools/miChecker/index_ja.html
- https://eclipse.dev/actf/downloads/tools/miChecker/v2v3_ja.html
