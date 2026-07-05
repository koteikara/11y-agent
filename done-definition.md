# done-definition.md

## Purpose

この文書は、Codexが自分で作業完了を検証するための基準を定義する。

ここでいう完了とは、最終的な業務設計が完成した状態ではなく、その時点のユーザー依頼に対して、必要なファイル作成・追記・整理・検証が終わっている状態を指す。

## General Done Criteria

Codexは作業を完了したと判断する前に、次を確認する。

- ユーザー依頼の対象ファイルが作成または更新されている。
- 追加した内容が `AGENTS.md` と `workstream.md` の前提に矛盾していない。
- 既存の移行・アクセシビリティ関連ナレッジを参照すべき内容では、`a11y-migration-kb/` の存在を前提にしている。
- アクセシビリティ修正対象を、CMSに登録するコンテンツ部分とページ全体・テンプレート領域とで混同していない。
- AGENTが機械的に対応する範囲と、人間が確認する範囲を混同していない。
- AI生成を伴うアクセシビリティ修正では、共通基本指示、部品別Skill、生成後レビュー、自動検証と人間確認の分離という方針に反していない。
- 行政情報の意味を変える可能性がある事項を、確定情報として扱っていない。
- 公共団体案件の品質確認としてmiCheckerを扱う場合は、`a11y-migration-kb/` との関係、本文範囲へのスコープ、証跡化の扱いが明示されている。
- 未決定事項や要確認事項がある場合は、未完了として明示されている。
- 作業後に、関連ファイルを読み返して文字化け、見出し崩れ、重複、明らかな矛盾がないことを確認している。

## Documentation Done Criteria

文書作成・追記作業では、次を満たす。

- 文書の目的が冒頭で説明されている。
- その文書が他のどのファイルと関係するかが分かる。
- 読み手が次に何を検討・実行すればよいかが分かる。
- 決定済みのことと未決定のことが分かれている。
- 具体例が必要な箇所には、CMS移行やアクセシビリティ修正に即した例がある。
- 後続作業で更新できる構成になっている。

## Workstream Done Criteria

効率化ワークストリームを扱う作業では、次を満たす。

- 対象工程が、移行作業、アクセシビリティ修正作業、作業者確認、承認者確認のどこに当たるか分かる。
- AGENTが行う処理と、作業者・承認者が行う処理が分かれている。
- CMS登録前に行う処理と、CMS登録中または登録後に行う処理が分かれている。
- 修正内容、修正理由、関連ナレッジ、要確認事項を記録する前提がある。
- スプレッドシート上の証跡管理との接続が考慮されている。
- miCheckerを品質ゲートとして使う場合は、CMS登録前確認とCMS登録後プレビュー確認のどちらで使うかが分かる。
- Goal 2の実行画面を扱う場合は、HTML入力、問題箇所表示、修正候補確認、最終HTML出力、証跡記録のどこまでを対象にするかが分かる。
- Goal 2の候補操作を扱う場合は、採用、編集して採用、却下、要確認の状態定義と完了条件が分かる。
- Goal 2のホスト環境を扱う場合は、ホスト先、認証、データ送信、ログ、検査エンジン、証跡保存、CMS連携の未決定事項が分かる。
- Goal 2の開発要件を扱う場合は、画面、API、HTML処理、候補データ、証跡データ、テスト、Cloud Run制約が分かる。
- 効果だけでなく、誤変換、見落とし、作業ばらつきなどのリスクも記載されている。

## Accessibility Proposal Done Criteria

アクセシビリティ修正やAGENT処理を提案する作業では、次を満たす。

- 修正対象のHTMLまたはコンテンツ範囲が明確である。
- 修正対象がコンテンツ部分である場合は、ヘッダー、ナビゲーション、フッター、CMSテンプレートなどのスコープ外指摘を混ぜていない。
- 修正前後の差分を説明できる。
- 最終HTMLを出力する場合は、CMS入力欄へ貼り付けられるHTML断片として出力される前提がある。
- レンダリングHTML上で候補を操作する場合は、表示上のハイライト、該当HTML断片、最終HTML出力が同じ対象を指している。
- 修正理由が説明できる。
- 関連する `a11y-migration-kb/` のルールまたはWCAG観点を参照できる。
- table、iframe、画像alt、フォーム、見出し構造などの部品別に失敗パターンが異なる場合は、単一の汎用判断ではなく部品別のレビュー観点を使っている。
- 生成後レビューとして、意味保持、構造、CMS入力制約、WCAG/JIS観点、miCheckerで指摘されやすい点、証跡、エスカレーション要否を確認している。
- 外部アクセシビリティ検査ツールの結果を使う場合は、本文領域にスコープしているか、結果を `content`、`old-site-template`、`new-cms-template`、`unknown` に分類している。
- miCheckerの結果を使う場合は、本文起因の明らかな問題が修正済み、または例外理由・エスカレーション・判断者が記録済みである。
- 機械的に確定できる修正と、人間の確認が必要な修正が分かれている。
- 判断に迷う箇所は、要質問または要確認として扱われている。

## Self-Verification Commands

Codexは、文書作成・更新後に可能な範囲で次を確認する。

```powershell
Test-Path .\AGENTS.md
Test-Path .\workstream.md
Test-Path .\memory\project-state.md
Test-Path .\memory\michecker-research.md
Test-Path .\memory\a11yc-resources-research.md
Test-Path .\memory\ai-accessibility-skills-policy.md
Test-Path .\memory\goal2-hosting-candidates.md
Test-Path .\memory\goal2-development-requirements.md
Test-Path .\done-definition.md
Test-Path .\goal2-app\server.js
Test-Path .\goal2-app\public\app.js
Test-Path .\goal2-app\data\rules.jsonl
Test-Path .\goal2-app\Dockerfile
Test-Path .\goal2-app\CLOUD_RUN_DEPLOY.md
```

```powershell
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
Get-Content .\AGENTS.md -Encoding UTF8 -TotalCount 40
Get-Content .\workstream.md -Encoding UTF8 -TotalCount 40
Get-Content .\memory\project-state.md -Encoding UTF8 -TotalCount 80
Get-Content .\memory\michecker-research.md -Encoding UTF8 -TotalCount 80
Get-Content .\memory\a11yc-resources-research.md -Encoding UTF8 -TotalCount 80
Get-Content .\memory\ai-accessibility-skills-policy.md -Encoding UTF8 -TotalCount 80
Get-Content .\memory\goal2-hosting-candidates.md -Encoding UTF8 -TotalCount 80
Get-Content .\memory\goal2-development-requirements.md -Encoding UTF8 -TotalCount 80
Get-Content .\done-definition.md -Encoding UTF8 -TotalCount 80
```

Goal 2アプリを実装・更新した場合は、可能な範囲で次も確認する。

```powershell
cd .\goal2-app
node --check .\server.js
node --check .\lib\rules.js
node --check .\public\app.js
node .\test\run-tests.js
```

## Do Not Mark Done If

次の状態では、完了と判断しない。

- 指定されたファイルが存在しない。
- 指定されたファイルは存在するが、中身がユーザー依頼と対応していない。
- AGENTが自動処理できる範囲と、人間確認が必要な範囲が曖昧なままである。
- Goal 2の候補操作で、採用、編集して採用、却下、要確認のいずれにも分類されていない候補が残っている。
- レンダリング表示では採用済みに見えるのに、最終HTML出力へ反映されているか確認できない。
- ページ全体の検査結果を、本文領域の修正候補として無条件に扱っている。
- miCheckerで本文起因の明らかな問題が残っているのに、修正、例外理由、エスカレーションのいずれも記録していない。
- miCheckerの指摘を、本文起因かテンプレート起因か分類せずに完了扱いしている。
- 未決定事項を決定済みのように書いている。
- 既存の `a11y-migration-kb/` と矛盾する可能性があるのに確認していない。
- 作業記録や証跡の扱いが、既存のスプレッドシート運用と接続できない。

## Completion Report Criteria

Codexがユーザーへ完了報告する場合は、次を簡潔に伝える。

- 作成または更新したファイル。
- 追加した主な内容。
- 実施した確認。
- まだ未決定として残している事項があれば、その概要。
