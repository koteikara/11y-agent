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
