# goal2-development-requirements.md

## Purpose

この文書は、Goal 2の実行画面を開発するために必要な要素を検証し、最初に作るべき最小スコープ、必要な画面・API・データ構造・検査処理・証跡・Cloud Run運用を整理する。

結論として、Goal 2は最初からCMS連携、LLM本番利用、miChecker自動実行まで含めず、Cloud Runに載せられる独立Webアプリとして、1ページ分のHTML断片を処理する縦切りPoCから始めるのがよい。

## Verified Inputs

既存文書とナレッジから、Goal 2開発に使える入力を確認した。

- `workstream.md`
  - Goal 2は、作業者が1ページずつAGENT支援を受けながらCMS登録予定HTMLをアクセシビリティ修正する方式。
  - 実行画面は、HTML入力、問題箇所表示、候補確認、最終HTML出力、証跡記録を扱う。
  - 候補状態は `採用`、`編集して採用`、`却下`、`要確認`。
- `memory/goal2-hosting-candidates.md`
  - 初期開発のホスト環境はCloud Runを第一候補とする。
  - 初期PoCはCMS本体へ直接組み込まず、独立Webアプリとして作る。
  - 実案件HTMLを扱う段階では、無認証公開せず、認証・ログ・データ送信ポリシーを決める。
- `a11y-migration-kb/`
  - `build/rules.jsonl` に、Goal 2の候補生成に使えるルールが正規化されている。
  - ルール数は43件。
  - カテゴリ内訳は、text 15、link 9、table 9、image 6、file 2、html-structure 2。
  - 処理分類は、mechanical 12、ai 11、hybrid 16、escalation 4。
  - 各ルールには、`id`、`category`、`title`、`description`、`processing_class`、`wcag`、`jis`、`municipality_specific`、`cms_auto`、`rule`、`examples`、`source` が含まれる。

注意点:

- `a11y-migration-kb/` の一部ファイルはOneDrive上で `ReparsePoint, Encrypted` 属性を持っており、通常のサンドボックス読み取りでは本文にアクセスできなかった。ユーザー権限側では読み取れた。
- アプリ開発時は、OneDrive上の暗号化・オンライン専用状態に依存せず、`rules.jsonl` をアプリの通常ファイルまたはビルドアセットとして読める配置にする必要がある。

## Development Readiness

現時点で、ダミーデータまたは公開可能なサンプルHTMLを使ったローカルPoCは開始できる。

一方で、実案件HTMLを扱う本番相当PoCは、次が決まるまで開始しない。

- Cloud Runを置くGoogle Cloudプロジェクト。
- 認証方式。
- 実案件HTMLの送信・保存・ログ方針。
- LLM/APIにHTMLを送ってよい範囲。
- 証跡の保存先と保持期間。
- CMSに貼り付け可能なHTMLタグ・属性・入力欄制約。

## Minimum Viable Slice

最初に作るべき縦切りは、次の流れに限定する。

1. 作業者がCMS登録予定の本文HTML断片を貼り付ける。
2. アプリがHTMLをDOMとして解析し、危険なscriptやイベント属性をレンダリング用には無効化する。
3. アプリが `a11y-migration-kb/build/rules.jsonl` を読み込み、最初の対象ルールだけを使って候補を生成する。
4. 画面がレンダリングプレビュー、HTMLソース断片、候補一覧、候補詳細を表示する。
5. 作業者が候補ごとに `採用`、`編集して採用`、`却下`、`要確認` を選ぶ。
6. 採用結果を反映した最終HTML断片を出力する。
7. 候補ごとの状態、修正前後、理由、関連ルール、確認者、日時をJSON/CSV相当で出力する。

最初の完了条件:

- すべての候補に状態が付く。
- レンダリングプレビューと最終HTMLが同じ作業対象を指す。
- 最終HTMLをCMS入力欄へ貼り付ける前提の断片として出力できる。
- 証跡に、少なくとも候補ID、ルールID、状態、修正前、修正後、理由が残る。

## Initial Rule Scope

最初のPoCでは、43件すべてを一度に扱わない。自動判定しやすく、画面の価値が出やすい領域から始める。

### Phase 1 Rules

- 画像
  - alt欠落、汎用的すぎるalt、キャプション重複を候補化する。
  - 内容判断が必要なalt文案は `編集して採用` または `要確認` 前提にする。
- 見出し
  - コンテンツ領域内のh1混入、見出しレベルのスキップ、見出しらしいテキストの未設定を候補化する。
  - 見出し追加・降格は文脈判断があるため、確定変換ではなく候補提示にする。
- リンク
  - 「こちら」「詳細はこちら」など文脈非依存になりにくいリンクテキストを候補化する。
  - 内部リンク、外部リンク、アンカーリンクは、CMS登録方法や自治体ルールが絡むため候補分類から始める。
- 表
  - caption欠落、レイアウトテーブル疑い、セル結合の多用を候補化する。
  - 表の再構成は誤変換リスクが高いため、初期は `要確認` または編集前提に寄せる。
- ファイル/PDF
  - 表示テキストに含まれるファイル種別・容量の重複を候補化する。
  - 外部PDF、リンク切れ、転載判断はエスカレーションとして扱う。

### Later Rules

- 文字色、背景色、太字、下線、フォントサイズなどの視覚表現系。
- 日付、曜日、時刻、電話番号、単位、通貨など表記ルール系。
- 自治体固有ルールが必要なリンク、日付、電話番号、時間表記。
- A11yc library、axe系検査、LLMによる追加候補。

## Required UI Areas

Goal 2画面には、次の領域が必要である。

- ページ情報
  - ページ名、旧URL、CMS登録先、サイトカテゴリー、作業者、承認者、作業状態。
- 入力HTML
  - CMS登録予定HTMLを貼り付けるtextareaまたはエディタ。
  - 入力HTMLのハッシュまたはセッションIDを証跡に残す。
- レンダリングプレビュー
  - sandbox付きiframeで表示する。
  - scriptやイベントハンドラは実行させない。
  - 問題箇所をハイライトできる。
- 候補一覧
  - ルールID、カテゴリ、深刻度、状態、候補理由、対象箇所を表示する。
  - 未処理候補がすぐ分かる。
- 候補詳細
  - 修正前HTML、修正後HTML、理由、関連KBルール、WCAG/JIS、候補信頼度を表示する。
  - `採用`、`編集して採用`、`却下`、`要確認` を操作できる。
- 最終HTML
  - 採用結果を反映したHTML断片を表示する。
  - CMS貼り付け前提で余計なラッパーを含めない。
- 証跡出力
  - JSON/CSV相当で、スプレッドシートへ転記または取り込みできる。

## Required Backend Capabilities

バックエンドには、次の責務を持たせる。

- KB loader
  - `rules.jsonl` を読み込み、ルールID、カテゴリ、処理分類、根拠、例を取り出す。
- HTML parser
  - 文字列処理ではなくDOMとして解析する。
  - 元HTML、作業中HTML、最終HTMLを分ける。
- Node locator
  - 候補がどの要素・テキストに対するものかを安定して参照する。
  - CSS selectorだけでなく、DOM path、テキスト抜粋、近傍HTMLを合わせて持つ。
- Candidate generator
  - ルールに基づき候補を生成する。
  - 機械変換、AI候補、人間確認、エスカレーションを分ける。
- Patch applicator
  - 採用または編集採用された候補を、作業中HTMLへ反映する。
  - 複数候補が同じ箇所に当たる場合は競合として扱う。
- Evidence builder
  - 候補状態、修正前後、理由、関連ルール、日時、確認者を出力する。
- Exporter
  - 最終HTMLと証跡を出力する。

## Candidate Data Model

最初の候補データは、次の情報を持つ。

```json
{
  "candidate_id": "cand_001",
  "page_session_id": "session_001",
  "rule_id": "image.alt-text",
  "category": "image",
  "processing_class": "hybrid",
  "status": "unresolved",
  "target": {
    "selector": "img:nth-of-type(1)",
    "dom_path": "/div[1]/p[2]/img[1]",
    "snippet": "<img src=\"park.jpg\" alt=\"公園の写真\">"
  },
  "issue": {
    "message": "画像の代替テキストが汎用的です。",
    "reason": "分類語だけでは内容が十分に伝わらない可能性があります。",
    "wcag": ["1.1.1"],
    "jis": ["1.1.1"]
  },
  "proposal": {
    "before_html": "<img src=\"park.jpg\" alt=\"公園の写真\">",
    "after_html": "<img src=\"park.jpg\" alt=\"青空の下に芝生が広がる公園の写真\">",
    "confidence": "medium",
    "requires_human_review": true
  },
  "decision": {
    "status": null,
    "reason": null,
    "actor": null,
    "decided_at": null
  }
}
```

状態は次に限定する。

- `unresolved`: 未処理。
- `accepted`: `採用`。
- `edited`: `編集して採用`。
- `rejected`: `却下`。
- `needs_review`: `要確認`。
- `conflicted`: 他候補と同じ箇所に当たり、自動反映できない。

画面上の完了条件では、`unresolved` と `conflicted` が残っているページは完了不可にする。

## Evidence Data Model

証跡には、最低限次を残す。

- page_session_id
- 旧URLまたはページ識別子
- CMS登録先またはサイトカテゴリー
- 入力HTMLのハッシュ
- 最終HTMLのハッシュ
- candidate_id
- rule_id
- category
- processing_class
- status
- before_html
- after_html
- decision_reason
- actor
- decided_at
- related_wcag
- related_jis
- kb_source
- miChecker_status
- miChecker_classification
- unresolved_reason

miCheckerの実行結果そのものは初期PoCでは取り込まないが、将来取り込める列は最初から用意しておく。

## Cloud Run Requirements

Cloud Runに載せる前提で、開発時から次を満たす。

- コンテナはHTTPサーバーとして動かす。
- Cloud Runの `PORT` 環境変数で指定されたポートをlistenできるようにする。
- HTTPS終端はCloud Run側に任せ、アプリ内でTLS終端を実装しない。
- Next.jsを使う場合は、Node.js serverまたはDocker container構成を前提にする。
- APIキーやLLMキーはSecret Managerで管理する。
- 実案件HTMLを扱う環境では、Cloud RunにIAPなどの認証を設定する。
- 長時間処理や一括処理は、初期のWeb request内に閉じ込めず、将来Cloud Run jobsや別サービスへ分離できる設計にする。

## Security Requirements

Goal 2は顧客HTMLを扱う可能性があるため、初期から次を前提にする。

- 入力HTML全文をアプリケーションログに出さない。
- 例外ログにもHTML全文や個人情報を含めない。
- レンダリングプレビューはsandbox付きiframeで表示する。
- script、onload、onclickなどのイベント属性、javascript: URLはレンダリング用には無効化する。
- CMS貼り付け用の最終HTMLと、プレビュー安全化済みHTMLを混同しない。
- 外部LLM/APIへHTMLを送る処理は、データ送信ポリシーが決まるまで無効にする。
- ファイルアップロード、外部URL取得、画像取得は初期PoCでは扱わないか、明示的に制限する。

## Test Requirements

開発時に必要なテストは次の通り。

- KB loader test
  - `rules.jsonl` から43件のルールを読み込める。
  - `processing_class` と `category` で分類できる。
- HTML parser test
  - 不完全なHTML断片でもDOMとして扱える。
  - 日本語テキスト、表、画像、リンクが壊れない。
- Candidate generator test
  - サンプルHTMLから期待する候補が出る。
  - 対象外要素を候補にしない。
- Patch applicator test
  - `採用` と `編集して採用` が最終HTMLに反映される。
  - `却下` と `要確認` は最終HTMLに反映しない。
  - 同じ箇所への複数候補は競合扱いにできる。
- UI test
  - レンダリングプレビュー、候補一覧、候補詳細、最終HTMLが同期する。
  - すべての候補を処理しないと完了できない。
- Evidence test
  - 候補ごとの状態、理由、修正前後、関連ルールが出力される。
- Security test
  - scriptやイベント属性がプレビューで実行されない。
  - 入力HTML全文がログに出ない。

## Recommended Development Order

1. アプリの最小スキャフォールドを作る。
2. `rules.jsonl` を読み込むKB loaderを作る。
3. HTML断片をDOMとして解析し、プレビュー用に安全化する。
4. 候補データモデルと証跡データモデルを実装する。
5. 画像、見出し、リンク、表、ファイル表示テキストの最小候補を出す。
6. 候補レビューUIを作る。
7. 最終HTML出力と証跡出力を作る。
8. すべての候補が処理済みでないと完了できない状態管理を作る。
9. Docker化してCloud Run互換の起動方式にする。
10. IAP、Secret Manager、ログ方針、実案件データ利用方針を決めた後に、社内PoCへ進む。

## Open Questions

- CMS入力欄で許可されるHTMLタグ・属性は何か。
- CMS側で自動変換される項目と、Goal 2画面で先に修正すべき項目の境界はどこか。
- 証跡は最初からスプレッドシートへ直接書くか、まずJSON/CSV出力にするか。
- 作業者、承認者、SV、顧客確認の状態を1画面でどこまで扱うか。
- LLM/APIへHTMLを送れる条件は何か。
- Cloud Runの認証はIAP、IAM、既存SSO、アプリ独自ログインのどれにするか。
- A11yc libraryを同一コンテナに入れるか、PHP専用の別サービスに分けるか。
- axe系検査を最初から入れるか、KB候補生成が動いた後に追加するか。
- miChecker結果を手動入力、CSV転記、スクリーンショット添付のどれで証跡化するか。

## Source Links

- Cloud Run container runtime contract: https://docs.cloud.google.com/run/docs/container-contract
- Configure IAP for Cloud Run: https://docs.cloud.google.com/run/docs/securing/identity-aware-proxy-cloud-run
- Configure secrets for Cloud Run services: https://docs.cloud.google.com/run/docs/configuring/services/secrets
- Next.js deployment: https://nextjs.org/docs/app/getting-started/deploying
