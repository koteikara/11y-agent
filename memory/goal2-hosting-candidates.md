# goal2-hosting-candidates.md

## Purpose

この文書は、Goal 2の実行画面をどこにホストするかを検討し、現時点の第一候補と代替候補を整理する。

Goal 2の実行画面は、作業者がCMS登録予定HTMLを入力し、レンダリングされたHTML上で問題箇所と修正候補を確認し、`採用`、`編集して採用`、`却下`、`要確認` を選びながら、最終HTMLと証跡を出力するための画面である。

## Current Decision

Goal 2のPoCおよび初期開発では、Cloud Runを第一候補として進める。

理由:

- 実行画面を通常のWebアプリとして作れる。
- コンテナで動かせるため、Next.js / React、Node.js API、PHP製A11yc library、axe系検査などを段階的に組み合わせやすい。
- LLM/APIキー、検査処理、証跡保存処理をサーバー側に置ける。
- CMS本体へ最初から組み込むより、PoCの速度を出しやすい。
- 本番候補としても、認証、ログ、監視、段階的リリース、Cloud Run jobsなどへ拡張しやすい。

この決定は「最終的にCMS管理画面へ組み込まない」という意味ではない。初期開発はCloud Run上の独立Webアプリとして始め、十分に業務フロー・画面・候補形式・証跡形式が固まった後で、CMS管理画面への組み込み可否を再判断する。

## Required Capabilities

Goal 2のホスト環境には、少なくとも次が必要である。

- HTML入力欄を持てること。
- 入力HTMLを安全にレンダリングして表示できること。
- 問題箇所をレンダリング表示とHTML断片の両方で示せること。
- 修正候補を `採用`、`編集して採用`、`却下`、`要確認` に分類できること。
- 採用結果を反映した最終HTMLを出力できること。
- 修正前HTML、修正後HTML、候補状態、理由、関連ルール、要確認事項を証跡として残せること。
- `a11y-migration-kb/` を基準に候補生成・説明・分類できること。
- A11yc library、axe系エンジン、LLMなどを必要に応じてサーバー側で呼び出せること。
- 実案件HTMLを扱う場合、外部公開サービスへ不用意に送信しないこと。

## Recommended Initial Architecture

PoCの初期構成は、Cloud Run上の独立Webアプリを想定する。

- Frontend: React / Next.js相当のWeb UI。
- Backend: HTML解析、候補生成、検査エンジン実行、証跡生成を行うAPI。
- Hosting: Cloud Run service。
- Container: Web UIとAPIを1つのコンテナに同居させるところから始める。
- Persistence: 初期PoCではJSON/CSVエクスポートまたはスプレッドシート連携を優先し、本格運用時にFirestore、Cloud SQL、または既存管理DBを検討する。
- Evidence: ページ単位、候補単位、miChecker確認単位の証跡を出力できる形式にする。
- Authentication: 実案件HTMLを扱う段階では公開URLのままにせず、社内認証、IAP、IAM、VPN、または既存SSO連携のいずれかで制限する。

初期PoCでは、Cloud Run service 1つで画面とAPIをまとめる。A11yc libraryや重い検査処理、長時間処理、将来の一括処理が必要になった場合は、別Cloud Run serviceまたはCloud Run jobsに分離する。

## Security and Data Handling

Goal 2では、旧サイトHTMLや移行予定HTMLに顧客情報、公開前情報、担当部署情報、問い合わせ先、PDFリンクなどが含まれる可能性がある。

Cloud Runを使う場合の前提:

- 実案件HTMLを扱う環境は、社内管理下のGoogle Cloudプロジェクトに限定する。
- PoC初期は、駒瑠市やダミーHTMLなど公開可能なデータで検証する。
- Cloud Run serviceを無認証公開しない運用を前提にする。
- アプリケーションログに入力HTML全文、個人情報、顧客固有情報を出さない。
- LLM/APIへHTMLを送る場合は、送信可能範囲、匿名化、保持設定、監査ログを別途決める。
- レンダリングHTMLは、sandbox付きiframeなどで表示し、旧サイト由来のscriptやイベントハンドラを実行させない。
- 最終HTML生成では、表示用の安全化と、CMS登録用HTML断片の保持を混同しない。

## Candidate Comparison

| 候補 | 位置づけ | 良い点 | 注意点 |
|---|---|---|---|
| Cloud Run上の独立Webアプリ | 第一候補 | PoCが速い。Web UI、API、検査エンジン、LLM連携をまとめやすい。将来分離もしやすい。 | 認証、ログ、データ保存、CMS連携を最初に決めすぎないよう注意が必要。 |
| CMS管理画面への組み込み | 将来の本命候補 | 作業者がCMS登録中にそのまま使える。ページ情報、権限、プレビューと接続しやすい。 | 初期開発が重い。CMS製品のリリース管理や既存UIへの影響が大きい。 |
| 社内VM / VPN内Docker | セキュリティ重視の代替 | 実案件HTMLを社内網に閉じやすい。Cloud利用制約がある案件に対応しやすい。 | 運用、更新、監視、スケールの負荷が高い。 |
| ローカルPCアプリ | 限定PoCの代替 | HTMLを中央サーバーへ送らずに検証できる。 | 作業者への配布、バージョン管理、証跡集約が難しい。 |
| ブラウザ拡張 / サイドパネル | CMS画面補助の候補 | 実際のCMS画面やプレビューDOMに近い場所で支援できる。 | 権限、配布、ブラウザ制約、証跡保存、バックエンド連携が複雑。 |
| スプレッドシート / Apps Script | 証跡補助 | 既存の作業記録と接続しやすい。 | レンダリングHTML上の候補レビュー画面としては弱い。 |

## miChecker Handling

miCheckerは公共団体案件で重要な受け入れシグナルだが、Goal 2実行画面の初期Cloud Run構成に直接組み込む前提にはしない。

理由:

- miCheckerはWindows、Microsoft Edge、Java実行環境を前提とするデスクトップツールとして扱う必要がある。
- Cloud Runはコンテナ実行環境であり、miChecker GUI操作をそのまま組み込むのには向かない。
- 初期PoCでは、AGENTがmiCheckerで指摘されやすい問題を事前に候補化し、CMS登録後プレビューで人がmiChecker確認する流れを優先する。

Goal 2初期開発では、miCheckerは次のように扱う。

- AGENT候補生成時に、miCheckerで指摘されやすい項目を優先度高めに扱う。
- 作業者が最終HTMLをCMSへ登録した後、CMSプレビューURLをmiCheckerで確認する。
- miChecker指摘は `content`、`old-site-template`、`new-cms-template`、`unknown` に分類して証跡化する。
- 将来、自動化可能性が確認できた場合のみ、別の実行環境や手動アップロード支援として検討する。

## First PoC Scope

Cloud Run前提の最初のPoCでは、次に絞る。

- 入力: CMS登録予定の本文HTML断片。
- 表示: sandbox付きレンダリングプレビューとHTMLソース断片。
- 検出: 画像alt、見出し階層、リンク文言、表caption/scope、PDFリンク表記など、`a11y-migration-kb/` に近い項目。
- 候補操作: `採用`、`編集して採用`、`却下`、`要確認`。
- 出力: CMS貼り付け用の最終HTML断片。
- 証跡: 候補ごとの状態、修正前後、理由、関連ルール、確認者、日時をJSON/CSV相当で出力。
- テストデータ: 駒瑠市、ダミー自治体風HTML、公開可能なサンプルHTML。

PoCでは、いきなりCMS連携やmiChecker自動実行まで含めない。まずは「作業者が1ページ分のHTMLを画面に貼り、候補を処理し、最終HTMLと証跡を得る」ことを完了条件にする。

## Open Questions

- Cloud Runを置くGoogle Cloudプロジェクト、リージョン、ネットワーク制限をどうするか。
- 認証はIAP、IAM、既存SSO、アプリ独自ログインのどれにするか。
- 実案件HTMLを扱う前のデータ送信ポリシーをどう定めるか。
- LLM/APIへHTMLを送る場合の匿名化、保持、監査ログをどう扱うか。
- 証跡をスプレッドシートへ直接書くか、JSON/CSVを出力して取り込むか。
- A11yc libraryを同一コンテナに含めるか、別Cloud Run serviceに分けるか。
- CMS管理画面との連携は、貼り付け前提、API登録、ブラウザ拡張補助のどこまでを初期対象にするか。

## Source Links

- Cloud Run overview: https://docs.cloud.google.com/run/docs/overview/what-is-cloud-run
- Cloud Run authentication overview: https://docs.cloud.google.com/run/docs/authenticating/overview
- Cloud Run billing settings: https://docs.cloud.google.com/run/docs/configuring/billing-settings
- Cloud Run pricing: https://cloud.google.com/run/pricing
- A11yc library: https://github.com/jidaikobo-shibata/a11yc
- A11yc ACS: https://a11yc.com/check/index.php
