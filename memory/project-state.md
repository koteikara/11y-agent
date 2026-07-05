# project-state.md

## Purpose

この文書は、移行作業とアクセシビリティ修正作業の効率化検討について、現在どこまで進んでいるか、何が未完了かを記録する。

CodexやAGENTが作業を再開するときは、まず `AGENTS.md`、`workstream.md`、このファイルを確認する。

## Current File Structure

- `AGENTS.md`
  - プロジェクトの前提、現状の手作業フロー、制約、エージェントの作業方針を記載する。
- `workstream.md`
  - 効率化のゴールと、想定する3つのワークストリーム(Goal 1: 一括最適化、Goal 2: 1ページ単位支援、Goal 3: コンテンツ抽出)を記載する。
- `memory/project-state.md`
  - 現在の進捗、決定事項、未完了事項、次に検討することを記載する。
- `done-definition.md`
  - Codexが自分で検証できる完了基準を記載する。
- `memory/gemini-a11y-agent-review.md`
  - 参考リポジトリ `koteikara/gemini-a11y-agent` の検証結果、良い点、良くない点、引き継げる要素を記載する。
- `memory/github-a11y-projects-research.md`
  - GitHub上のアクセシビリティ、a11y、WCAG関連リポジトリの調査結果と、本プロジェクトへ引き継げる設計要素を記載する。
- `memory/non-github-a11y-resources-research.md`
  - GitHub以外の標準、行政系ガイドライン、実務資料、評価ツール、研究資料の調査結果と、本プロジェクトへ引き継げる設計要素を記載する。
- `memory/michecker-research.md`
  - 公共団体案件で重要な評価ツールであるmiCheckerの位置づけ、使い方、品質ゲート化する際の注意点を記載する。
- `memory/a11yc-resources-research.md`
  - A11ycの駒瑠市教材サイト、A11yc ACS、A11yc libraryの検証結果と、本プロジェクトへ引き継げる要素を記載する。
- `memory/goal2-hosting-candidates.md`
  - Goal 2実行画面のホスト環境候補、Cloud Runを第一候補にする理由、代替候補、未決定事項を記載する。
- `memory/goal2-development-requirements.md`
  - Goal 2開発に必要な画面、API、データ構造、ルール処理、証跡、Cloud Run要件、検証項目を記載する。
- `memory/ai-accessibility-skills-policy.md`
  - AIによるアクセシビリティ生成を、共通基本指示、部品別Skill、生成後レビュー、自動検証と人間確認の分離で扱う方針を記載する。
- `goal2-app/`
  - Goal 2実行画面の初期PoC実装を格納する。
  - Node.jsの標準HTTPサーバーで静的UIとKBルールAPIを提供する。
  - Cloud Run互換の `PORT` 環境変数、Dockerfile、テストを含む。
  - `public/goal3.html` / `public/goal3.js` として、Goal 3(旧ページ全体HTMLからのコンテンツ抽出)のPoC画面を同居させている。
  - `server.js` の `/api/fetch-html` が、Goal 3のURL取得(簡易SSRF対策付き)を提供する。
- `goal2-app/CLOUD_RUN_DEPLOY.md`
  - Cloud Run初心者向けに、Google Cloud ConsoleのCloud Run概要画面から始めるステップバイステップのデプロイ手順を記載する。
- `a11y-migration-kb/`
  - 既存の移行・アクセシビリティ関連ナレッジを格納する。

## Current Progress

- `AGENTS.md` を作成済み。
  - 公共団体向けCMSへの移行作業という事業前提を記載した。
  - 移行作業とアクセシビリティ修正作業の定義を記載した。
  - 現状の手作業フローを記載した。
  - 既存ナレッジ `a11y-migration-kb/` の位置づけを記載した。
- `workstream.md` を作成済み。
  - Goal 1: CMS登録前にAGENTでHTMLを一括アクセシビリティ最適化する方式を記載した。
  - Goal 2: CMS登録時に作業者が1ページずつAGENT支援を受けながら進める方式を記載した。
  - Goal 3: 旧ページ全体HTMLからCMS登録対象のコンテンツ部分を抽出し、Goal 2へ引き継ぐ方式を記載した(実装 `goal2-app/public/goal3.html`/`goal3.js` に対して、後追いでドキュメントを整備した)。
  - 各方式の期待効果、リスク、共通成功条件、比較観点を記載した。
- `memory/project-state.md` を作成済み。
  - 現在の進捗と未完了事項を追跡する場所として定義した。
- `done-definition.md` を作成済み。
  - Codexが自分で検証できる完了基準を定義した。
- `memory/gemini-a11y-agent-review.md` を作成済み。
  - 参考リポジトリ `koteikara/gemini-a11y-agent` を確認した。
  - そのまま踏襲せず、失敗モード、検証観点、候補提示UIの考え方を引き継ぐ方針を整理した。
  - 一括処理方式とページ単位支援方式に引き継げる要素を分けて記載した。
- `memory/github-a11y-projects-research.md` を作成済み。
  - `accessibility`、`a11y`、`WCAG`、`accessibility remediation` などの観点でGitHubリポジトリを調査した。
  - 既存OSSは検査、ルール標準化、レポート、AI候補提示に強い一方、旧サイトHTMLからCMS登録用HTMLへ移行し、確認フローと証跡管理まで含めるものは見つからなかった。
  - `axe-core`、`pa11y`、`HTML_CodeSniffer`、`Siteimprove/Alfa`、`ACT Rules`、`awslabs/content-accessibility-utility-on-aws`、`HaTeMiLe`、AI/agent系リポジトリの引き継ぎ候補を整理した。
- `memory/non-github-a11y-resources-research.md` を作成済み。
  - W3C/WAI、WAIC、デジタル庁、GOV.UK、Section508.gov、WAVE、ARC Toolkit、IBM Equal Access、LLM関連研究を調査した。
  - GitHub外の資料は、直接HTMLを自動修正する材料というより、`a11y-migration-kb/` の根拠、作業者説明、承認者確認、証跡設計を補強する材料として有用だと整理した。
  - 特に、W3C Tutorials、WAIC、GOV.UK Content Guidanceは、表、画像、リンク、見出しなどのコンテンツ部分の判断に近い参照先として整理した。
- `memory/michecker-research.md` を作成済み。
  - 総務省とEclipse ACTFの公開情報を確認し、miCheckerを公共団体案件における重要な受け入れシグナルとして整理した。
  - miCheckerはJIS X 8341-3:2016対応を支援するが、全てを自動判定するものではなく、人間の判断支援を含むツールだと整理した。
  - miChecker結果はページ全体検査になりやすいため、本文起因とテンプレート起因を分類する必要があると整理した。
- `memory/a11yc-resources-research.md` を作成済み。
  - 駒瑠市は、架空の地方自治体サイトにアクセシビリティ上の問題を仕込んだ教材サイトであり、PoC用サンプルとして有用だと整理した。
  - A11yc ACSは、URL検査とHTML Source検査ができ、日本語のError / Notice / 達成基準番号 / snippetを返すことを確認した。
  - A11yc libraryは、PHPライブラリとして `analyzeHtml()`、`analyzeUrl()`、`is_partial`、正規化された `issues` 形式を提供しており、本文HTML断片検査の技術候補になると整理した。
- A11yc ACSを、Goal 2の実行画面におけるHTML入力、問題箇所明示、根拠表示、最終HTML出力の参考UIとして位置づけた。
  - GitHubのコンフリクト解消に近い、レンダリングHTML上で修正候補を採用、編集して採用、却下、要確認に分類する操作モデルをGoal 2の参考として整理した。
- `memory/goal2-hosting-candidates.md` を作成済み。
  - Goal 2の初期開発はCloud Run上の独立Webアプリを第一候補として進める方針を整理した。
  - Cloud Run採用時の初期アーキテクチャ、セキュリティ、miCheckerの扱い、PoCスコープ、未決定事項を整理した。
- `memory/goal2-development-requirements.md` を作成済み。
  - `a11y-migration-kb/build/rules.jsonl` には43件の移行ルールがあり、text 15、link 9、table 9、image 6、file 2、html-structure 2に分類されることを確認した。
  - 処理分類は、mechanical 12、ai 11、hybrid 16、escalation 4であることを確認した。
  - Goal 2の最小開発スコープを、HTML入力、DOM解析、候補生成、候補レビュー、最終HTML出力、証跡出力の縦切りPoCとして整理した。
- `goal2-app/` を作成済み。
  - 外部パッケージなしのNode.js標準HTTPサーバーとして実装した。
  - `/api/health` と `/api/rules` を提供し、`rules.jsonl` の43件ルールを読み込む。
  - 画面では、本文HTML入力、sandbox付きレンダリングプレビュー、候補一覧、候補詳細、`採用`、`編集して採用`、`却下`、`要確認`、最終HTML出力、証跡JSON/CSV出力を実装した。
  - 画面では、HTML修正として処理する `修正候補` と、CMS登録時に確認する `注意` を分離し、注意は候補一覧ではなく出力欄と証跡JSONに出すようにした。
  - 初期候補生成は、画像alt、キャプション重複、見出し階層、リンクテキスト、ファイル表示テキスト、表caption、レイアウト表疑い、セル結合疑いを対象にした。
  - 入力サンプルを選択式にし、総合、画像、表、リンク・本文表記、iframe・フォームの複数パターンを投入できるようにした。
  - サンプル画像は `goal2-app/public/images/` の生成PNGを参照し、プレビューで実際に表示できるようにした。
  - 画像alt候補では、PoCサンプル画像に対するAI画像名候補を、`写真`、`案内図` などの画像種別を含む表現で生成し、確認・編集してから修正後HTMLへ投入し、候補詳細・証跡へ出力するようにした。
  - iframeとフォームはKB未整備領域として、自動反映なし・人間確認前提の候補を出す最小検出を追加した。
  - Cloud Run用の `Dockerfile`、Windows起動用の `start-server.ps1`、`node test/run-tests.js` によるテストを追加した。
- `goal2-app/CLOUD_RUN_DEPLOY.md` を作成済み。
  - 添付画像のCloud Run概要画面から、Cloud Shellを開き、ZIPアップロード、API有効化、Artifact Registry作成、Cloud Build、Cloud Runデプロイ、動作確認、再デプロイ、よくあるエラーまでを手順化した。
  - ダミーデータ検証向けの `--allow-unauthenticated` と、認証必須の `--no-allow-unauthenticated` の違いを明記した。
- `goal2-app/server.js` の `/api/fetch-html`・`/api/link-title` について、SSRF対策を強化した。
  - ホスト名がIPリテラルでない場合にDNS解決結果の全アドレスを検証するようにし、DNSリバインディングによる内部アドレス到達を防いだ。
  - IPv4写像IPv6リテラル(`::ffff:127.0.0.1` などドット表記・16進表記の両方)を検出してブロック対象に含めた。
  - `redirect: "follow"` をやめ、リダイレクトを自前で追跡してホップごとに許可判定を行うようにし、外部URLが内部アドレスへリダイレクトするケースを防いだ。
- `memory/ai-accessibility-skills-policy.md` を作成済み。
  - Mark Fairchildの記事を参照し、AIモデル単体へ依存せず、短い共通基本指示、部品別Skill、生成後レビュー、自動検証と人間確認の分離を組み合わせる方針を整理した。
  - table、iframe、画像alt、フォーム、見出し構造などの部品別Skill化案、生成後レビュー用チェックリスト、自動検証と人間確認の分離表を記載した。

## Decisions

- 効率化対象は、移行作業とアクセシビリティ修正作業を一体で扱う。
- AGENTはLLMなどを活用し、機械的に対応できる部分を先に処理する。
- AGENTの出力は最終成果物ではなく、作業者または承認者による確認対象とする。
- 作業者確認と承認者確認は、効率化後も品質保証の工程として残す。
- 作業記録と証跡は、スプレッドシートなど既存の管理方法と接続する。
- 開発の優先順位は、まずGoal 2から進める。
- Goal 2の初期開発では、Cloud Run上の独立Webアプリを第一候補とする。
- Goal 2の初期PoCでは、CMS本体への直接組み込みではなく、CMS登録予定HTMLを貼り付け、候補レビュー後に最終HTMLと証跡を出力する画面として作る。
- Goal 2の最初の開発単位は、1ページ分のHTML断片を対象にした縦切りPoCとする。
- Goal 2初期PoCは、依存パッケージを増やさず、Node.js標準HTTPサーバーとブラウザDOMParserで実装する。
- Goal 2初期PoCでは、`a11y-migration-kb/build/rules.jsonl` のコピーを `goal2-app/data/rules.jsonl` に配置し、OneDriveの暗号化・オンライン専用属性に依存しない形で読み込む。
- Cloud Runデプロイ手順では、既存Cloud Runサービスと同じ `asia-northeast1` を初期リージョンとする。
- 実案件HTMLを扱う前に、認証、ログ、データ送信ポリシー、証跡保存先、CMS入力欄制約を決める。
- Cloud Runで実案件HTMLを扱う段階では、無認証公開せず、社内認証、IAP、IAM、VPN、または既存SSO連携などでアクセス制限する。
- miCheckerはGoal 2初期Cloud Run構成へ直接組み込まず、CMS登録後プレビューの手動確認ゲートとして扱い、結果を証跡化する。
- `koteikara/gemini-a11y-agent` は参考にするが、そのまま踏襲しない。
- 再開発では、`a11y-migration-kb/` を正とし、参考リポジトリの独自ルールや実装は必要に応じて考え方だけを取り込む。
- Goal 1とGoal 2は、別実装として分断せず、共通の候補形式・証跡形式・品質ゲートを使えるように検討する。
- 既存OSSは本プロジェクトの代替品ではなく、検査エンジン、ルール設計、レポート形式、バッチ構成、AI候補提示の参考部品として扱う。
- `axe-core` または `pa11y` は、AGENT出力HTMLとCMS登録後プレビューの自動品質ゲート候補とする。
- ACT Rules / Alfa の考え方は、`a11y-migration-kb/` を実行可能なルール定義へ変換する際の参考にする。
- AWS Content Accessibility Utility の `Audit -> Remediate -> Batch` の責務分離は、Goal 1の一括処理設計の参考にする。
- 本プロジェクトのアクセシビリティ修正対象は、原則としてCMSに登録するコンテンツ部分に限定する。
- コンテンツ部分の修正基準は、外部検査ツールよりも `a11y-migration-kb/` を優先する。
- ページ全体を対象にする外部検査結果は、そのまま移行HTML修正候補にせず、`content`、`old-site-template`、`new-cms-template`、`unknown` に分類して扱う。
- GitHub外の標準・ガイドライン・ツール資料は、`a11y-migration-kb/` を置き換えるものではなく、根拠、補足説明、分類、レビュー観点として対応づける。
- 作業者・承認者・顧客向けの説明では、日本語で説明しやすいWAICとデジタル庁資料を優先的な参照候補にする。
- GOV.UK Content Guidanceは、表、画像、リンク、見出しなどの本文編集ルールを磨くための参考にするが、日本語自治体サイトへそのまま適用しない。
- W3C ATAGは、Goal 2を作業者向けauthoring supportとして設計する際の参考にする。
- miCheckerは、`a11y-migration-kb/` を置き換える主基準ではなく、公共団体案件における実務上の受け入れシグナル・品質ゲート候補として扱う。
- miCheckerで本文コンテンツ起因の明らかな問題が残る場合は、原則として完了扱いにしない。
- miChecker結果は、`content`、`old-site-template`、`new-cms-template`、`unknown` に分類し、本文起因の指摘だけを移行HTML修正候補として扱う。
- miCheckerを使う場合は、バージョン、実行日、検査対象、指摘分類、対応結果、未解消理由を証跡として残す。
- 駒瑠市は、実案件データではなく教材データとして扱い、PoC用の再現可能なOK/NGサンプルに限定して使う。
- A11yc ACS公開サービスへ実案件HTMLを送信する運用は、情報管理・利用制限・外部サービス依存の観点から採用前に確認が必要である。
- A11yc libraryは、公開サービスではなく社内・ローカルで本文HTML断片を検査する候補として技術検証する価値がある。
- Goal 2の実行画面は、A11yc ACS型の「HTML入力、問題一覧、該当箇所表示、根拠表示」を参考にしつつ、本プロジェクトでは「修正候補の採用・編集・却下」と「最終HTML出力」まで拡張する。
- 修正候補の操作は、GitHubのコンフリクト解消に近い候補単位のレビューとして扱い、レンダリングHTML上の問題箇所を見ながら `採用`、`編集して採用`、`却下`、`要確認` を選べるようにする。
- Goal 2では、すべての修正候補が `採用`、`編集して採用`、`却下`、`要確認` のいずれかに分類されるまで、ページ作業を完了扱いにしない。
- 2026-06-29に、Mark Fairchildの記事 "AI-Generated Accessibility: An Update - Frontier Models Still Fail, but Skills Change the Game" を参照し、AIアクセシビリティ生成の共通方針として「短い基本指示」「部品別Skill」「生成後レビュー」「自動検証と人間確認の分離」を採用した。

## Not Completed Yet

- Goal 3のコンテンツ抽出ヒューリスティック(スコアリング・除外ルール)を、`a11y-migration-kb/` のコンテンツ範囲抽出条件として正式に文書化する作業は未完了。
- Goal 3の抽出候補とGoal 1のバッチ処理(ページ一覧・テンプレート分類)の接続方法は未定義。
- Goal 3の誤抽出・見落としを検証するためのテストセット、精度指標は未定義。
- Goal 3の `/api/fetch-html` を実案件の旧サイトへ使ってよいかのデータ送信ポリシー、認証が必要な旧サイトへの対応方針は未定義。

- Cloud Run上のGoal 2実行画面について、Google Cloudプロジェクト、リージョン、ネットワーク制限、認証方式は未決定。
- Cloud Run PoCの具体的なGoogle Cloud構成、DB、証跡保存先は未決定。
- Goal 2実行画面の初期PoCは実装済みだが、CMS入力欄制約、実案件データポリシー、認証、永続保存は未実装。
- CMS入力欄で許可されるHTMLタグ・属性・入力欄制約は未確認。
- 一括処理方式とページ単位方式を組み合わせるハイブリッド案は未整理。
- `gemini-a11y-agent` から引き継ぐ品質監査項目を `done-definition.md` へ正式反映する作業は未完了。
- `gemini-a11y-agent` の report-only ルールを `a11y-migration-kb/` のルール体系へ対応づける作業は未完了。
- GitHub調査で見つけた外部検査エンジンを `axe-core` 直接利用にするか、`pa11y --runner axe` 経由にするかは未決定。
- 外部検査エンジンを使う場合に、本文領域のroot selector、抽出済みHTML断片、CMS登録後プレビュー内の本文領域のどれを主対象にするかは未決定。
- 外部検査結果を `content`、`old-site-template`、`new-cms-template`、`unknown` に分類する具体的な判定方法は未定義。
- GitHub外調査で見つけた参照資料を、`a11y-migration-kb/` の各ルールへ対応づける作業は未完了。
- W3C / WAIC / GOV.UK / デジタル庁の参照先を、作業者説明用とAGENT判定用にどう分けるかは未定義。
- miCheckerをCLI/APIなどで自動実行できるか、GUI前提の手動ゲートにするかは未決定。
- 抽出済みHTML断片をmiCheckerで確認するための検査用HTMLラッパー設計は未定義。
- CMS登録後プレビューURLをmiCheckerで安定して検査する運用は未定義。
- miChecker結果をスプレッドシート証跡へ取り込む形式は未定義。
- miCheckerの指摘分類と `a11y-migration-kb/` のルール分類の対応づけは未定義。
- A11yc libraryを実際にローカルまたは検証環境で動かすかは未決定。
- A11ycの `issues` 形式を、本プロジェクトの候補形式・証跡列へどう対応づけるかは未定義。
- 駒瑠市のどの `criteria` / `preset` をPoC用テストセットに採用するかは未定義。
- 公開A11yc ACSへ顧客HTMLを送信してよいかどうかのデータ送信ポリシーは未定義。
- Cloud Run上でA11yc libraryを同一コンテナに含めるか、別サービスに分けるかは未定義。
- Cloud Run上でLLM/APIへHTMLを送信する場合の匿名化、保持、監査ログ、利用範囲は未定義。
- Goal 2実行画面の初期ワイヤーフロー、画面項目、最終HTML出力形式はPoC実装済みだが、作業者実務に合わせた詳細調整は未完了。
- A11yc ACS型の問題箇所表示はPoC実装済みだが、CMS入力欄制約やスプレッドシート証跡への本接続は未定義。
- レンダリングHTML上のハイライト、該当HTML断片、修正候補、最終HTML出力の同期はPoC実装済みだが、複数候補競合や複雑なHTML断片での検証は未完了。
- `採用`、`編集して採用`、`却下`、`要確認` の状態と理由はJSON/CSV証跡へ出力できるが、既存スプレッドシート列への正式対応は未定義。
- 外部LLM/APIへHTMLを送信してよいか、送信可能な範囲、匿名化、監査ログの扱いは未定義。
- 外部OSSの検査結果を、本プロジェクトの候補形式・証跡形式・スプレッドシート記録へどう対応づけるかは未定義。
- 旧サイトHTMLの取得方法、対象URL一覧の形式、ページ一覧の作成方法は未定義。
- デザインテンプレートやサイトカテゴリーの分類ルールは未定義。
- 移行対象コンテンツを抽出するためのID、class、要素の指定方法は未定義。
- AGENTが受け取る入力形式と、出力するHTML・修正記録・要確認事項の形式は未定義。
- `a11y-migration-kb/` の各ルールを、AGENTが実行可能なチェック・変換手順へどう対応づけるかは未定義。
- CMS管理画面への登録方法、入力欄制約、登録前後の検証方法は未定義。
- スプレッドシートに残す証跡の列、粒度、更新タイミングは未定義。
- 作業者、承認者、SV、顧客確認の責任分界は未整理。
- PoC対象ページ、評価指標、検証手順は未定義。

## Next Candidate Work

- Goal 2初期PoCを作業者に試してもらい、候補表示、採用/編集/却下/要確認、最終HTML、証跡出力の使い勝手を確認する。
- CMS入力欄で許可されるHTMLタグ・属性・自動変換の制約を調べ、PoCの最終HTML出力に反映する。
- 既存スプレッドシート列に合わせて証跡JSON/CSVの列を調整する。
- Cloud Runで扱う実案件HTMLのデータ送信ポリシー、認証方式、ログ方針を決める。
- AGENTの入出力仕様を定義する。
- スプレッドシートに残す作業記録・証跡の項目を定義する。
- `a11y-migration-kb/` のルールを、機械的変換、AI判断、人間確認、エスカレーションに分類し直す。
- サンプルHTMLを使った小さなPoCの流れを設計する。
- CMS登録前に検証できる項目と、CMS登録後にしか検証できない項目を分ける。
- `memory/gemini-a11y-agent-review.md` の引き継ぎ候補から、最初のPoCで採用するものを選ぶ。
- 出力HTML品質監査のCritical / High / Medium基準を、本リポジトリの完了基準へ移す。
- `memory/github-a11y-projects-research.md` の候補から、最初のPoCで使う外部検査エンジンを選ぶ。
- 外部検査エンジンの `violations`、`incomplete`、`cantTell` 相当の結果を、作業者確認・承認者確認・証跡へ接続する形式を設計する。
- 旧サイトごとの本文領域抽出ルールと、スコープ外領域の除外ルールを設計する。
- ページ全体検査の結果を、本文領域修正候補とテンプレート課題に切り分ける分類仕様を作る。
- `memory/non-github-a11y-resources-research.md` をもとに、`a11y-migration-kb/` と外部参照資料の対応表を作る。
- miCheckerの確認結果を記録する証跡列を設計する。
- miCheckerで出やすい指摘を `a11y-migration-kb/` のルールへ対応づける。
- CMS登録前ラッパーHTMLとCMS登録後プレビューURLの両方でmiChecker確認する小さなPoCを設計する。
- A11yc libraryの `Analyzer::analyzeHtml()` と `is_partial` を使った本文HTML断片検査のPoCを設計する。
- 駒瑠市のOK/NGページを使い、画像、表、リンク、見出し、フォームのテストセットを作る。
- A11yc結果とmiChecker結果を同じ駒瑠市ページで比較し、本文起因・テンプレート起因・人間確認対象に分類する。
- 最終HTML出力をCMSへ貼り付ける前提で、CMS入力欄制約に合うHTML断片形式を検討する。
- レンダリングHTML上の候補ハイライトと、採用/編集/却下操作の状態遷移を設計する。
- 候補ごとの状態、編集内容、却下理由、要確認理由を証跡列へ落とし込む。
- 表、画像、リンク、見出しの4領域について、外部参照資料を使ったAGENT候補分類を試作する。

- Goal 3の抽出ロジックを、実際の旧サイトHTMLサンプル(駒瑠市など)で検証し、誤抽出・見落としを記録する。
- Goal 3の抽出根拠表示を、`a11y-migration-kb/` のコンテンツ範囲抽出条件・除外領域の記録要件と対応づける。

## Update Policy

- 新しい決定があった場合は `Decisions` に追記する。
- 未完了事項が完了した場合は `Current Progress` に移し、`Not Completed Yet` から削除する。
- 次に取り組む候補が増えた場合は `Next Candidate Work` に追記する。
- 作業の完了判定は `done-definition.md` を参照する。
