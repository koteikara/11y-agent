# 表修正手段メニュー拡張 構築指示書(実装担当AGENT向け)

GOAL2(候補レビュー画面)の「修正方法」パネルは、現状1つの表に対して最大2件の手段しか提示していない。これを「その表に適用可能な、考えうる全ての修正手段」から作業者が選択できる形に拡張する。

この指示書は、設計判断・既存コードの必要事実・実装ステージ・検証手順を1つにまとめた実装担当AGENT向けの資料である。

## 0. 作業の前に必ず読むもの

- `AGENTS.md` — プロジェクト前提と作業方針
- `memory/project-state.md` — 現在の進捗、特に表関連の過去バグの記録
- `done-definition.md` — 完了基準
- 本指示書の「7. 検証手順」— 全ステージで必須

リポジトリ運用: ブランチは指定された作業ブランチを使用する。各ステージのコミット前にユーザー確認を取る。PRはユーザーの指示があってから作成する。`CHANGELOG.md`(リポジトリ直下)と`memory/project-state.md`をステージごとに更新する。

## 1. 背景(なぜ2件止まりなのか)

「修正方法」パネルは `candidatesForSameTarget()`(public/app.js:7365)が返す**同一 `target.node_id` を持つ候補の集合**をラジオカードとして表示する仕組みである。つまり「手段」の実体は候補(candidate)そのものであり、同じ表を対象とする候補が2件あれば手段2件、1件なら1件と表示される。

表に対する構造候補の生成元は `planTableTreatment()`(app.js:3054)だが、これは**早期returnのウォーターフォール**で、1つの表に対して以下のうち**1件だけ**を返す:

1. データ表維持+セマンティクス整備(`table.caption` / `buildDataTableSemanticsHtml`) — `shouldPreserveAsDataTable() && tableNeedsDataTableSemantics()` の場合
2. 意味単位ごとの表分割(`table.cell-merge-layout` / `splitMergedRowsIntoTablesHtml`) — 解体系mergeRule かつ `canSplitMergedRowsIntoTables()` の場合
3. レイアウト表解体(`table.layout-table` / `decomposeLayoutTable`) — `isLikelyLayoutTable()` の場合
4. どれでもなければ構造候補なし(`{kind: "data"}`)

これに加えて `collectTableCandidates()`(app.js:2932)がセル結合分類候補(`classifyMergedCellTable` → `buildMergedCellProposal`)を独立に1件プッシュするため、典型的には「構造候補1件+セル結合候補1件=2件」が上限になっている。

## 2. 確定済み設計判断(変更にはユーザー確認が必要)

- **手段=兄弟候補という既存機構をそのまま使う。** 新しい「メソッド配列」データ構造は導入しない。適用可能な各手段を同一表(同一`target.node_id`)への候補としてプッシュすれば、既存の修正方法グリッド・`selected_method_id`記録・`applyCandidatePatch`の反映・証跡出力がすべて無改修で機能する。
- **全ての構造変換手段は `requiresHumanReview: true`。** 一括採用(`canBulkAcceptCandidate`)とGOAL1の`autoAcceptSafe`の対象に絶対に入れない。
- **`<dl>`(定義リスト)への変換は手段に含めない。** ユーザー確定済み方針(project-state.md Decisions 2026-07-10): CMS入力画面での自治体職員による定義リストの運用が難しいため、見出し+段落構造を使う。
- **推奨手段の順序**: 修正方法グリッドの先頭(「おすすめ:」表示)は現行`planTableTreatment()`のウォーターフォール順位をそのまま推奨順位として使う(データ表維持 > 分割 > レイアウト解体 > その他)。既存の推奨挙動を変えない。
- **rule_idは既存idへ相乗りし、新設しない**(ユーザー確定 2026-07-21): M4→`table.cell-merge-layout`、M5/M6→`table.layout-table`。カード・証跡の表示は`methodLabel`で区別する。KBファイル追加・rules.jsonl再生成は行わない。
- **候補一覧は従来どおり全件表示**(ユーザー確定 2026-07-21): 既存の「同じ箇所の代替手段 N件中」バッジのまま全兄弟候補を一覧に出す。`isAlternativeMethod`による一覧の間引きは実装しない。

## 3. 手段メニュー(canonical list)

1つの表に対し、適用条件を満たす手段を**すべて**兄弟候補として生成する。

| # | 手段 | rule_id | ビルダー | 適用条件 | 状態 |
|---|------|---------|---------|---------|------|
| M1 | データ表として維持し、caption/thead/th/scopeを整備 | `table.caption` | `buildDataTableSemanticsHtml`(app.js:3384) | 表がtr/td構造を持つ(ほぼ常時)。現行の`shouldPreserveAsDataTable && tableNeedsDataTableSemantics`ゲートは「推奨判定」に降格し、適用可否は緩める | 既存 |
| M2 | 意味単位ごとに複数の表へ分割 | `table.cell-merge-layout` | `splitMergedRowsIntoTablesHtml`(app.js:5121) | `canSplitMergedRowsIntoTables()`(app.js:5114: グリッド3行以上、1列目ラベル2種以上、rowspan継続行あり) | 既存 |
| M3 | 表をやめて見出し+段落+画像配置へ解体 | `table.layout-table` | `decomposeLayoutTable`(app.js:4891) | 常時適用可能。ただしデータ表(`shouldPreserveAsDataTable`=true)に対しては確信度low・説明文で「データ表の可能性が高い」ことを明示 | 既存 |
| M4 | 結合セルを解除してフラットな単純表へ | 新設 or `table.cell-merge-layout`相乗り(4.2参照) | **新規** `buildFlattenedTableHtml` | `table.querySelector("[rowspan],[colspan]")`が存在 | 新規 |
| M5 | 単純な表を箇条書き(ul)へ変換 | 新設 or `table.layout-table`相乗り | **新規** `buildTableAsListHtml` | 実質1列の表、または2列で「ラベル+値」構造の表(ヘッダー行を除く) | 新規 |
| M6 | 1行=1項目として見出し+段落へ展開 | 新設 or `table.layout-table`相乗り | **新規** `buildRowsAsSectionsHtml` | 行見出し(1列目th、または1列目が短いラベル)を持つ3行以上の表 | 新規 |

既存の独立候補はそのまま維持する(手段メニューとは別軸):
- セル結合分類候補(`table.cell-merge-heading`/`summary`/`note`/`mark`/`file`) — それ自体が具体的な1手段なので、従来どおり該当時に兄弟候補としてプッシュされ、結果として手段グリッドに並ぶ
- `table.format-clear`(書式解除、mechanical・自動採用可) — 構造を変えないため手段メニューと競合しない
- `table.th-scope` / `table.caption`のcaption文言系 / naive構造通知 — セル単位・通知系はそのまま

### 3.1 新規ビルダーの仕様

**M4 `buildFlattenedTableHtml(table)`**: `buildExpandedTableGrid()`(既存)で結合を展開したグリッドを取得し、全セルの`rowspan`/`colspan`を除去した単純グリッドの表を再構築する。結合で占有されていたマス(`isOrigin`がfalse)には元セルのテキストを複製する(空セルにはしない — miChecker C_12系の空セル指摘を誘発しないため)。1行目がthならthead/scope="col"を付与。**過去バグの教訓**(project-state.md記録): `buildDataTableSemanticsHtml`はcolspanを無視した行パディングで空td追加のバグ、`splitMergedRowsIntoTablesHtml`はcolspanヘッダーの複製バグを起こした。グリッドの`isOrigin`と占有列数を必ず尊重すること。

**M5 `buildTableAsListHtml(table)`**: ヘッダー行を除く各行を`<li>`へ。2列構造なら「1列目テキスト: 2列目テキスト」を1項目に。caption/直前見出しがあれば`<p>`または見出しとして先頭に置く。セル内にリンク・画像がある場合は内容ごと`<li>`へ移す。

**M6 `buildRowsAsSectionsHtml(table)`**: 各行の行見出しを見出し要素(`suggestSeparatedHeadingTag(table)`(既存)で階層決定)にし、残りのセルを「列見出し: 値」形式の`<p>`として並べる。`<dl>`は使わない(確定方針)。列見出しは1行目th(なければ「1列目/2列目…」のような機械ラベルは使わず、値のみの段落にする)。

## 4. 実装方針

### 4.1 `planTableTreatment()` → `planTableTreatments()`(複数返却化)

早期returnのウォーターフォールを、**適用可能な全手段を配列で返す**関数に変える。配列は推奨順(現行ウォーターフォール順位を維持し、新手段はその後ろ)。`collectTableCandidates()`は配列の全要素を`makeCandidate`でプッシュする。先頭要素が従来の「structural候補」に相当する。

注意: 現行コードには「structural候補が出た場合はformat-clear/caption簡易候補をスキップする」earlyリターン(app.js:2988)がある。複数手段化後もこの挙動(構造候補がある表にcaption簡易追加候補を重ねない)は維持する。

### 4.2 rule_idと表示タイトル

手段カードのタイトルは`candidateDisplayTitle()`(app.js:6936)がKBルールの`rule.title`を返すため、同一rule_idの手段が複数並ぶと区別できない。対応として`makeCandidate`のoptionsに`methodLabel`(任意)を追加し、`candidateDisplayTitle()`で`candidate.method_label`があれば優先表示する。証跡(evidence)にも`method_label`を出力する。

rule_idは**既存idへの相乗り+`methodLabel`で確定**(2章参照。M4→`table.cell-merge-layout`、M5/M6→`table.layout-table`)。新設rule_id・KBファイル追加・rules.jsonl再生成は行わない。

### 4.3 競合解決セットの更新

`resolveSupersededTableCandidates()`(app.js:6132)は採用された構造候補と同じ表・子孫要素の未処理候補をconflictedへ自動解決する。この判定は`tableStructuralRuleIds`/`tableRelatedRuleIds`(app.js:29-52)のrule_idセットに依存するため、新設rule_idを起こす場合は両セットへ追加する。相乗り方式ならセット変更は不要(既存idが含まれているため)。いずれの場合も「手段Aを採用したら兄弟の手段B〜Fが全てconflictedになる」ことをPlaywrightで必ず検証する。

### 4.4 候補一覧の表示(確定済み)

**従来どおり全兄弟候補を一覧に表示する**(ユーザー確定 2026-07-21)。既存の「同じ箇所の代替手段 N件中」バッジがそのまま件数を伝える。一覧の間引き・専用フラグは実装しない。手段採用時に兄弟がconflictedへ自動解決される既存挙動により、未処理件数は採用後に正しく収束する。実データ検証(PR-T4)で一覧が煩雑と感じられた場合の改善は、別タスクとしてユーザーへ提案する。

## 5. 既存コードの構造(実装に必要な事実)

すべて `goal2-app/public/app.js`(行番号は2026-07-21時点):

- `collectTableCandidates(fragment, candidates)` :2932 — 表ごとの候補生成の起点。セル結合候補→th-scope走査→`planTableTreatment`→(構造候補なしの場合のみ)naive構造通知+format-clear+caption簡易追加
- `planTableTreatment(table)` :3054 — 今回複数化する対象
- `shouldPreserveAsDataTable(table)` :3277 / `tableNeedsDataTableSemantics` / `dataTableSemanticsConfidence` — データ表判定と確信度
- `classifyMergedCellTable(table)` :8747 / `buildMergedCellProposal(table, mergeRule)` :4959 — セル結合の分類と提案生成。`tableDecomposeMergeRuleIds`(:54)が解体系(layout/file/mark)の集合
- ビルダー: `buildDataTableSemanticsHtml` :3384、`decomposeLayoutTable(table, imageContexts)` :4891(第2引数に画像コンテキストを収集し、`llmContext: {images}`としてvision enrichmentへ渡す — 新手段でも画像を含む表を扱う場合は同じ流儀に従う)、`splitMergedRowsIntoTablesHtml` :5121、`canSplitMergedRowsIntoTables` :5114
- `buildExpandedTableGrid(table)` — 結合セルを展開したグリッド。各マスは`{cell, text, isOrigin, isHeader, rowIndex, ...}`。同一セル参照が複数マスに入る点に注意(過去バグの原因)
- `makeCandidate(options)` :5643 — 候補オブジェクト生成。`target.node_id`は要素の`data-goal2-node-id`
- 修正方法UI: `candidatesForSameTarget` :7365、`activeFixMethodCandidate` :7370、`fixMethodDescription` :7381(**新手段の説明文をここに追加**)、`fixMethodBadge` :7411、修正方法グリッド描画 :7060-7107
- 採用フロー: `decide()` :5990 → `applyCandidateDecision` :6028(`selected_method_id`等を記録)→ `resolveSupersededTableCandidates` :6132。最終HTML反映は`applyCandidatePatch` :5798 — `decision.selected_method_id`が候補自身と異なる場合、選択手段の`after_html`で`replaceTarget`する。**つまりビルダーはafterHtml文字列を返すだけでよい**
- ヘッドレス経路: `window.goal2Engine.analyze()` :9083(GOAL1バッチが使用)。候補生成は画面と完全共通
- 表示: `candidateDisplayTitle` :6936、候補一覧行 `buildCandidateRow` :6943

## 6. 実装ステージ(PR単位)

各ステージ完了ごとに検証(7章)→ユーザー確認→コミット。

### PR-T1: 複数手段化の骨格(新規ビルダーなし)
- `planTableTreatments()`化。既存3手段(M1/M2/M3)を適用条件に従い併記(例: 結合ありデータ表なら M1+M2+M3 の3件が並ぶ)
- `methodLabel`対応、`fixMethodDescription`/`fixMethodBadge`の文言整備
- 4.4のノイズ対策(ユーザー確認済みの方式で)
- 兄弟採用→conflicted自動解決の回帰確認
- 合格条件: `tables`サンプルの結合表で修正方法が3件以上表示され、いずれを選んで採用しても最終HTMLに正しく反映され、残る兄弟がconflictedになる

### PR-T2: M4 フラット化ビルダー
- `buildFlattenedTableHtml`実装+手段配列への組み込み
- 合格条件: rowspan/colspan混在表(安城市サンプルの「市内公園施設情報」表が好例: rowspan=2とcolspan=2が共存)で、結合が解除され全行が同一列数になり、テキストが欠落しないこと

### PR-T3: M5 リスト化 / M6 見出し+段落化ビルダー
- 適用条件判定(3.1)を保守的に実装(条件を満たさない表にはカードを出さない)
- 合格条件: 2列ラベル表でM5が、行見出し表でM6が表示され、変換結果にテキスト欠落がないこと。`<dl>`が出力に一切含まれないこと

### PR-T4: 実データ検証+ドキュメント
- 全GOAL3実データサンプル+`tables`サンプルで手段件数・変換品質を確認し、スクリーンショットでユーザーへ提示
- `WORKER_GUIDE.md`(作業者向け)に修正方法の選び方を追記
- `CHANGELOG.md`・`memory/project-state.md`更新

## 7. 検証手順

### 7.1 回帰チェック(全ステージ必須)

```bash
cd goal2-app
node --check public/app.js
node test/run-tests.js   # 全テスト成功必須
```

候補件数は本件で**意図的に増える**。ステージごとに既存6サンプルの検出件数を変更前後で記録し、増分が「追加した手段の件数」で説明できることを確認して`memory/project-state.md`に新基準として記録する。説明できない増減は回帰として扱う。

### 7.2 Playwright検証(実ブラウザ)

環境: Playwrightは`/opt/node22/lib/node_modules/playwright`、Chromiumは`executablePath: "/opt/pw-browsers/chromium"`。サーバーは`cd goal2-app && node server.js`(ポート8080)。

必須シナリオ:
1. `window.goal2Engine.analyze({html})`で結合表を解析し、同一`target.node_id`の候補が期待手段数と一致すること
2. 画面で表候補を選択し、修正方法グリッドのカード件数・ラベル・説明文を確認
3. 各手段を1つずつ選択→採用し、最終HTML(`els.finalHtml`)に選択手段の`after_html`が反映されること
4. 採用後、同じ表の兄弟候補・表内要素候補がconflictedになること
5. 一括採用・GOAL1 `autoAcceptSafe`が構造手段を自動採用**しない**こと
6. 証跡JSON/CSVに`selected_method_id`と手段ラベルが出力されること

### 7.3 変換品質の目視確認

各ビルダーの出力を、`tables`サンプルと安城市サンプルの実表で目視確認し、before/afterのスクリーンショットをユーザーへ提示する。特に: テキスト欠落ゼロ、リンク・画像の保持、見出し階層の妥当性(`suggestSeparatedHeadingTag`準拠)。

## 8. リポジトリ運用ルール(このプロジェクトの既定)

- 依存パッケージを増やさない(Node.js標準+ブラウザDOMのみ)
- UI文言・候補の説明文はすべて日本語
- コミット前にユーザー確認を取る。PRはユーザーの指示があってから作成する
- 各コミットで`CHANGELOG.md`と`memory/project-state.md`を更新する
- 途中で本指示書と実コードの不整合を見つけた場合は、指示書を正とせず実コードを再調査し、判断が必要ならユーザーへ確認する
