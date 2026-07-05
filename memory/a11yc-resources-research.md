# a11yc-resources-research.md

## Purpose

この文書は、A11ycの「駒瑠市」教材サイトと「A11yc アクセシビリティ チェック サービス」を確認し、本プロジェクトのCMS移行・アクセシビリティ修正効率化に参考にできる点を整理する。

結論として、A11yc関連リソースは「自治体風の実例データ」「日本語の機械チェック結果」「HTML断片を検査できる可能性」の3点で有用である。一方、公開チェックサービスへ実案件HTMLを送信する運用は、情報管理・利用制限・外部サービス依存の観点から慎重に扱う。

## Investigated Sources

調査日は 2026-06-26。

- 駒瑠市: https://a11yc.com/city-komaru/
- A11yc アクセシビリティ チェック サービス: https://a11yc.com/check/index.php
- A11yc ACS 使い方: https://a11yc.com/check/index.php?a=readme
- A11yc ACS 参考資料: https://a11yc.com/check/index.php?a=docs
- A11yc library: https://github.com/jidaikobo-shibata/a11yc
- city-komaru repository: https://github.com/jidaikobo-shibata/city-komaru

## City Komaru

駒瑠市は、架空の地方自治体サイトにアクセシビリティ上の問題を意図的に仕込んだ教材サイトである。

確認できた特徴:

- WCAG 2.0 / 2.1 / 2.2を切り替えられる。
- 達成基準ごとにOK実装・NG実装をURLパラメータで再現できる。
- プリセット版とカスタマイズ版がある。
- 「機械チェックでエラーの出やすい駒瑠市」というmiChecker向け不具合プリセットがある。
- ストーリー版では、自治体サイトが数年かけてアクセシビリティ改善していく流れと試験結果の考え方を確認できる。
- リポジトリとライセンスはMITとして公開されている。

特に参考になる点:

- 自治体風のページ構成、PDF、お知らせ、問い合わせフォーム、グローバルナビゲーション、画像、動画、表などが含まれる。
- `?criteria=1.3.1f_ng` のように、個別の問題をURLで再現できる。
- 表、画像、リンク、見出し、フォーム、PDF、動画、キーボード操作など、移行案件で遭遇しやすい題材がそろっている。
- OK/NGの対比を、AGENT候補の評価データや作業者説明に使える。

注意点:

- 教材サイトであり、実際の自治体CMS移行データではない。
- 意図的にアクセシビリティ上の問題やHTML文法上の問題を含む場合がある。
- 達成基準番号と障壁内容が、システム都合により必ずしも完全一致しないと説明されている。
- 開発中のサービスであり、障壁の種類や箇所は変更される可能性がある。
- ヘッダー、ナビゲーション、フォームなどテンプレート寄りの問題も多く、本プロジェクトの「コンテンツ部分だけ」とは切り分けが必要である。

## A11yc Accessibility Check Service

A11yc ACSは、HTMLに対して機械的にできるアクセシビリティチェックを行う公開サービスである。

確認できた特徴:

- バージョン表示は `ver.5.0.2`。
- URLを入力して検査できる。
- HTML SourceのtextareaにHTMLを貼り付けて検査できる。
- URL検査では、画像とaltの一覧表示もできる。
- WCAG 2.0、JIS X 8341-3:2016、ISO/IEC 40500:2012に依存すると説明されている。
- 参考資料ページには、WCAG達成基準の日本語説明とUnderstandingへのリンクが整理されている。
- 無料で利用できるが、10分で10回超、24時間で150回超のPOSTに制限がある。
- Google Analyticsを使い、IPアドレス制限のためIPアドレスとアクセス時間を保存すると説明されている。

検査結果の形式:

- Error / Noticeが分かれる。
- WCAGレベルと達成基準番号が表示される。
- 該当メッセージと該当HTML断片が表示される。
- ソースコード内に `ERROR!` マーカーが付く。
- 判定ログが出力される。

小さなHTML Sourceでの検証結果:

- `img` のalt属性欠落はErrorとして検出された。
- `input` のlabel関連付け不足はErrorとして検出された。
- 画像altの妥当性確認、tableのcaption推奨はNoticeとして出力された。

駒瑠市 `ng-michecker1` プリセットでの検証結果:

- A11yc ACSでは、9点のError、4点のNoticeが出た。
- Error例は、alt属性欠落、html要素の基本言語未指定、input/textarea/selectのlabel不足、iframeのtitle属性欠落など。
- Notice例は、fieldset推奨、section内見出し推奨、画像alt妥当性確認、PDFアクセシビリティ確認など。
- 検査結果には、本文起因とテンプレート起因が混ざるため、`content` / `old-site-template` / `new-cms-template` / `unknown` の分類が必要である。

## A11yc Library

A11yc ACSの基礎ライブラリである `jidaikobo/a11yc` は、PHPライブラリとして公開されている。

確認できた特徴:

- MITライセンス。
- PHP 7.4以上、Composerが必要。
- URL解析とHTML解析のAPIがある。
- `Analyzer::analyzeHtml()` があり、既に取得済みのHTMLを解析できる。
- `is_partial` オプションがあり、部分HTML検査に使える可能性がある。
- 結果は `meta`、`summary`、`issues`、`images` に正規化される。
- `issues` は `id`、`type`、`message`、`level`、`criterion_keys`、`place_id`、`snippet` を含む。

本プロジェクトで重要な点:

- 公開サービスへHTMLをPOSTせず、自前環境で検査できる可能性がある。
- `is_partial` があるため、CMS登録対象の本文HTML断片に寄せた検査ができる可能性がある。
- `issues` の正規化形式は、AGENT候補、作業者確認、承認者確認、スプレッドシート証跡に接続しやすい。

## Goal 2 Execution Screen Reference

A11yc ACSは、Goal 2の「1ページずつアクセシビリティ対応しながら登録作業を進める」実行画面の参考として有力である。

A11yc ACSから参考にする画面パターン:

- HTML Sourceを入力できる。
- 検査結果として、Error / Noticeの件数を要約できる。
- 問題の種類、関連する達成基準、該当HTML断片を表示できる。
- ソースコード中に問題箇所を示すマーカーを付けられる。
- 判定ログを表示できる。
- 画像とaltの一覧のように、特定領域を一覧化できる。

本プロジェクトで拡張したい点:

- 検査結果表示だけでなく、AGENTが修正候補を提示する。
- 作業者が候補ごとに採用、編集、却下、要確認化を選べる。
- 採用した候補を反映した最終HTMLを出力する。
- 修正前HTML、修正後HTML、差分、修正理由、関連する `a11y-migration-kb/` ルールをセットで記録する。
- A11ycやmiChecker相当の検査結果を、本文起因、テンプレート起因、人間確認対象、スコープ外に分類する。
- CMS入力欄の制約に合わせ、貼り付け可能なHTML断片として出力する。

画面に必要な領域:

- 入力HTMLエリア。
- レンダリングHTMLプレビューエリア。
- 問題一覧エリア。
- 問題箇所ハイライト付きHTMLプレビューまたはソース表示。
- 修正候補と理由の確認エリア。
- 最終HTML出力エリア。
- 証跡出力エリア。

候補操作の参考:

- 修正候補の操作は、GitHubのコンフリクト解消のように、候補単位で `採用`、`編集して採用`、`却下`、`要確認` を選ぶモデルにする。
- `採用` は、AGENTが提示した修正候補をそのまま最終HTMLへ反映する。
- `編集して採用` は、作業者が文言やHTMLを調整したうえで最終HTMLへ反映する。
- `却下` は、修正候補を反映しない。却下理由を記録する。
- `要確認` は、承認者、SV、顧客確認など次工程へ渡す。
- レンダリングHTML上のハイライト、該当HTML断片、修正候補、最終HTML出力が同期して更新される必要がある。
- すべての候補に状態が付くことで、未判断のままCMS登録へ進むことを防ぐ。

注意点:

- A11yc ACS自体は検査支援の性格が強く、修正後HTML生成や承認フローまでは本プロジェクト側で設計する必要がある。
- 公開サービスのUIをそのままコピーするのではなく、「HTML入力、問題箇所明示、根拠表示」という作業導線を参考にする。
- GitHubのUIをそのまま再現するのではなく、コンフリクト解消のように候補を一つずつ安全に処理する操作モデルを参考にする。
- 実案件では公開サービスにHTMLを送るのではなく、A11yc libraryや別の検査エンジンを社内環境で使う前提を優先する。

## Project Fit

### 良い点

- 日本語の実務説明・チェックメッセージとして使いやすい。
- 駒瑠市は、PoC用の再現可能なサンプルページとして使いやすい。
- A11yc ACSはHTML Source検査ができ、本文HTML断片の検査PoCに近い。
- A11yc libraryは、公開サービスではなくローカルまたは社内環境で使う候補になる。
- Error / Noticeの分類は、`auto-fixable`、`needs-review`、`manual-only` の分離に使いやすい。
- 画像一覧とalt一覧は、画像移行ルールの確認補助に使える。
- Goal 2の実行画面として、HTML入力、問題箇所表示、候補確認、最終HTML出力の基本導線を設計する参考になる。
- レンダリングされたHTMLを見ながら、候補を採用、編集、却下できる操作モデルの設計に使える。

### 良くない点・注意点

- A11yc ACS公開サービスへ実案件HTMLを送るのは、情報管理上のリスクがある。
- 公開サービスにはPOST回数制限があり、一括移行処理の本番ゲートには向かない。
- 機械チェックであり、アクセシビリティの最終品質保証にはならない。
- ページ全体検査では、ヘッダー、ナビゲーション、フッター、フォーム、テンプレート部品の指摘が混ざる。
- 駒瑠市の教材データは、あくまで意図的な不具合サンプルであり、実案件のばらつきとは異なる。
- A11yc libraryはPHP前提であるため、本プロジェクトの実装言語や実行環境との相性確認が必要である。

## What We Should Carry Over

- PoC用の固定サンプルとして、駒瑠市のOK/NGページを使う。
- miChecker向け検証の予行演習として、`ng-michecker1` プリセットを使う。
- A11yc ACSのError / Notice / 達成基準番号 / snippetの出力形式を、証跡列設計の参考にする。
- A11yc libraryの `Analyzer::analyzeHtml()` と `is_partial` を、本文HTML断片検査の候補として技術検証する。
- 駒瑠市の `criteria` URL指定を使い、表、画像、リンク、見出し、フォームなどのルール別テストケースを作る。
- Goal 2の初期UI案として、A11yc ACS型の「HTML入力、問題一覧、該当箇所表示、修正候補、最終HTML出力」画面を試作する。
- GitHubのコンフリクト解消を参考に、候補ごとの状態管理と未判断候補ゼロの完了条件を取り込む。

## What Not To Copy Directly

- 公開A11yc ACSへ顧客HTMLを継続的に送る運用。
- 駒瑠市のNG実装を、そのまま実案件の問題分類として扱うこと。
- A11yc ACSのErrorがないことを、アクセシビリティ完了の証明として扱うこと。
- ページ全体のA11yc結果を、本文HTML修正候補として無条件に扱うこと。

## Candidate Next Work

- A11yc libraryをローカルまたは検証環境で動かし、`analyzeHtml()` と `is_partial` が本文HTML断片にどこまで有効か確認する。
- 駒瑠市の `criteria` URLから、画像、表、リンク、見出し、フォームのPoC用テストセットを作る。
- A11ycの `issues` 形式を、本プロジェクトの候補形式・証跡列に対応づける。
- A11yc結果とmiChecker結果を同じ駒瑠市ページで比較し、差分を `content` / `template` / `manual-only` に分類する。
- Goal 2実行画面のワイヤーフローを作り、A11yc ACSから参考にする部分と、本プロジェクトで追加する部分を分ける。
- レンダリングHTML上のハイライト、候補カード、採用/編集/却下操作、最終HTML出力の同期仕様を設計する。
- 公開サービス利用禁止・ローカル利用可など、実案件HTMLのデータ送信ポリシーを決める。

## Source Links

- https://a11yc.com/city-komaru/
- https://a11yc.com/check/index.php
- https://a11yc.com/check/index.php?a=readme
- https://a11yc.com/check/index.php?a=docs
- https://github.com/jidaikobo-shibata/a11yc
- https://github.com/jidaikobo-shibata/city-komaru
