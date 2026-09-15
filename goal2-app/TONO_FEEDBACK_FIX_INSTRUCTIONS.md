# 遠野市フィードバック対応 設計書（構造変更1と個別修正）

遠野市のページでAI移行を試した作業者から上がった15件の指摘のうち、ツール側で直す8件について、設計と構築手順をまとめる。
前半は、指摘の多くに共通する構造の弱点を直す「構造変更1: 決定のたびに依存候補を作り直す」の設計である。
後半は、指摘ごとの個別修正の設計で、構造変更1の前後どちらでも実装できるように書いている。

原因調査の結果は `memory/verification-2026-08-summary.md` の「AI移行で出た指摘」に、指摘の一覧はAI移行の指摘シートにある。
行番号は `main` の `1826b46` 時点の `public/app.js` を指す。

## 0. 作業の前に読むもの

- `AGENTS.md`: プロジェクト前提と作業方針
- `memory/project-state.md`: 進捗、特に表関連の過去バグの記録
- `done-definition.md`: 完了基準
- `TABLE_FIX_METHODS_INSTRUCTIONS.md`: 「手段＝兄弟候補」の設計判断。本書はこれを前提にする
- 本書の「6. 検証手順」: 全ステージで必須

リポジトリ運用は既存の指示書と同じにする。
指定された作業ブランチを使い、ステージごとにコミット前にユーザー確認を取り、`CHANGELOG.md` と `memory/project-state.md` を更新する。

## 1. 対象と対象外

| 指摘 | 内容 | 扱い | 節 |
| --- | --- | --- | --- |
| 1 | 見出しが先頭しか直らない | 個別修正（構造変更1で再導出の恩恵も受ける） | 4.5 |
| 2 | 表のキャプションがページごとに違う | 個別修正 | 4.4 |
| 3 | 背景色を採用すると表の構造候補が選べない | 個別修正。構造変更1で類型ごと消える | 4.1 |
| 6 | 通常のテキストに見出しを提案する | 個別修正（AIへの指示） | 4.7 |
| 7 | 表に「項目／内容1」の行が追加される | 個別修正 | 4.2 |
| 10 | 写真の文字まで文字起こしされる | 個別修正（AIへの指示） | 4.8 |
| 12 | ファイルアイコンに画像名の候補が出る | 個別修正 | 4.3 |
| 13 | 操作パネルの大きさを変えられない | 個別修正 | 4.6 |
| 4 | 表が真っ黒になる | 対象外。証跡CSVの `before_html` を入手してから判断する | |
| 5, 9, 14 | 改行が落ちる、画像の並び、メールの件名 | 対象外。CMS取込側 | |
| 8, 15 | 文字の置き換え、パーツ分割の単位 | 対象外。分担のルール決めが先 | |
| 11 | ツール内で依頼したい | 対象外。別機能として起票する | |

## 2. 現状の候補のライフサイクル（設計の前提となる事実）

構造変更1を設計するために、候補がどう生まれ、どう決まり、どう出力に反映されるかを先に書く。

**生成**。
`parseFragment()` が入力HTMLを `<template>` に読み込み、`assignNodeIds()`（`app.js:1034`）が全要素に文書順で `data-goal2-node-id="n0001"` 形式のIDを振る。
`generateCandidates()` が各コレクター（`collectHeadingCandidates`、`collectTableCandidates` など）を呼び、`makeCandidate()`（`app.js:6425`）が候補を作る。
候補は `target.node_id` と、元の要素から作った `proposal.after_html` を持つ。
軽い修正は `proposal.patch`（`set-attribute`、`remove-style-properties`、`rename-element` など）で表し、それ以外は `after_html` による要素ごとの差し替えになる。
AIによる補完（`enrichWithLlm` など）は生成直後に一度だけ走り、候補の文言を書き換えたり、新しい候補を足したりする。

**決定**。
`applyCandidateDecision()`（`app.js:6867`）が候補の `decision` を書き換え、続けて2つの調停を走らせる。
`resolveSupersededTableCandidates()`（`app.js:7054`）は、表の構造候補が採用されたとき、その表の中の内容修正候補を変換後HTMLへ「畳み込み」、同じ表の他の表候補を `conflicted` にする。
`resolveAlternativeMethodCandidates()`（`app.js:6894`）は、要素ごと差し替える候補が採用されたとき、同じ `node_id` の他の要素差し替え候補を `conflicted` にする。

**再構築**。
`rebuildWorkingHtmlFor()`（`app.js:6524`）は、毎回**元のHTMLから**やり直す。
元のHTMLを読み直してIDを振り直し、採用・編集済みの候補を `node_id` ごとにまとめ、要素を残すパッチを先、要素ごと差し替えるパッチを後の順で当てる。
`replaceTarget()`（`app.js:6684`）は差し替え後の先頭要素に元のIDを引き継ぎ、入れ子の表のIDも並び順で引き継ぐ。
差し替えで新しく生まれたそれ以外の要素にはIDが無い。

**証跡と最終HTML**。
`buildEvidenceFor()`（`app.js:8933`）は候補の配列をそのまま証跡にする。
`goal2Engine.buildFinalHtml()` は `rebuildWorkingHtmlFor` の結果から内部属性を除いたものを返す。
GOAL1のバッチ（`goal2Engine.autoAcceptSafe`）は、候補配列を一度走査して安全なものを採用し、同じ調停を通す。

**この構造の何が問題か**。

1. 候補の `after_html` は元のHTMLから作られ、決定後に作り直されない。ある候補を採用しても、それに依存する候補（同じ表の中の内容修正、後続の見出し）は古いままである。
2. 依存関係を後追いで埋めるのが2つの調停ロジックで、条件が増えるほど取りこぼしが増える。指摘3は `patch` の有無だけで「代替手段」を判定していることの取りこぼしである。
3. 再構築が元のHTMLからのやり直しであること自体は良い（決定を順に当て直す「リプレイ」になっている）。しかし候補生成がリプレイ後の状態を見ないため、リプレイと候補生成が噛み合っていない。

## 3. 構造変更1: 決定のたびに依存候補を作り直す

### 3.1 目標と非目標

目標は次の3つである。

- 作業者が1件を決めるたびに、作業中のHTMLに対して候補を作り直し、依存する候補が常に現在の状態を反映している。
- 調停ロジック（`resolveSupersededTableCandidates`、`resolveAlternativeMethodCandidates`、`foldDescendantFixIntoAncestor`）を無くす。
- 既存の画面、証跡CSVの列、`goal2Engine` のAPI、テスト4系統を壊さない。

非目標は次のとおり。

- AIによる補完を決定のたびに再実行しない。コストと時間が見合わない。
- コレクターの書き直しはしない。コレクターは「現在のHTMLを受け取って候補を返す関数」のまま使う。
- 指摘1（見出しの一括補正）を構造変更1だけで直そうとしない。再導出しても「h2, h3, h3, h3」は飛びが無いので候補は出ない。指摘1は4.5の専用コレクターが要る。

### 3.2 設計の原則

**候補は「現在の文書への操作」である。**
候補は、元の要素から作った固定の `after_html` ではなく、適用時に現在の要素へ実行する操作を持つ。
既存の `patch` は既にそうなっている。
不足しているのは、表の構造変換のように大きな変換を行う候補で、これに `rebuild` という種類のpatchを足す。

**決定は順序付きのログであり、作業中HTMLはログのリプレイである。**
現在も元のHTMLからやり直しているが、候補配列に決定を埋め込んでいるため、候補が入れ替わると決定が消える。
決定を候補から切り離し、`state.decisions` に順序付きで持つ。

**決定のたびに候補を再導出し、前の候補と照合する。**
再導出は作業中HTML全体に対してコレクターを走らせる。
新しい候補と前の候補を指紋で突き合わせ、同じ問題は同じ `candidate_id` を保つ。
対象が変わって消えた候補は「取り下げ」として記録する。

**同じ箇所の代替手段は、ルールの排他グループで宣言する。**
`patch` の有無やHTML差し替えの有無から推測しない。

### 3.3 データ構造

`state` に次を足す。

```js
state.decisions = [
  {
    seq: 1,                         // 決定順。リプレイ順でもある
    candidate_id: "cand_003",
    fingerprint: "table.caption||n0001",
    rule_id: "table.caption",
    method_label: null,
    node_id: "n0001",
    exclusive_group: "table-structure", // 3.8
    status: "accepted",             // accepted | edited | rejected | pending | withdrawn
    reason, actor, decided_at,
    after_html: null,               // edited のときだけ人が直したHTMLを固定で持つ
    op: { type: "rebuild", builder: "dataTableSemantics", params: {} }, // accepted のとき
    selected_method_id, selected_method_rule_id, selected_method_title, selected_method_label,
    withdrawn_by_seq: null,         // withdrawn のとき、原因になった決定の seq
  },
];
state.generation = 0;               // 再導出の回数
state.nextCandidateSeq = 1;         // candidate_id は再利用しない
```

候補には次を足す。

```js
candidate.fingerprint = `${rule_id}|${method_label || ""}|${node_id}`;
candidate.generation = 0;           // 生まれた再導出の世代。0 は初回生成
candidate.origin = "mechanical";    // mechanical | llm
candidate.target.content_hash = hashText(before_html);
candidate.proposal.patch = { type: "rebuild", builder: "dataTableSemantics", params: {} }; // 表の構造候補
```

`candidate.decision` は当面残す（画面と証跡の多くがこれを読む）。
ただし正本は `state.decisions` で、`candidate.decision` はログから写す派生情報にする。

### 3.4 ノード識別子の派生

差し替えで生まれた要素にもIDが要る。
再導出したコレクターがそれらを対象にするからである。

規則は次のとおり。

- 元のHTMLの要素は今までどおり `n0001` 形式。
- 決定 `seq` の適用で要素 `nX` が差し替えられたとき、差し替え後の先頭要素は `nX` を引き継ぐ（現状どおり）。
- 差し替え後に生まれたそれ以外の要素は、文書順に `nX.s{seq}.{k}`（例 `n0001.s3.2`）を振る。
- 入れ子の表のID引き継ぎ（`replaceTarget` の後半）は廃止する。派生IDで一意に指せるため不要になる。

同じ元HTMLに同じ決定を同じ順で当てれば同じIDになるので、リプレイは決定的である。
`cssEscape` は `.` を扱えることを確認済み。
IDの書式に依存するコードは無い（`grep` で確認済み）。

### 3.5 再導出の流れ

`decide()`、`bulkAcceptSelected()`、`bulkAcceptReviewFree()`、GOAL1の `autoAcceptSafe()` の後に、次を1回走らせる。

1. `state.workingHtml = replay(state.sourceHtml, state.decisions)`（3.7）。
2. `const fresh = generateCandidates(parseWorking(state.workingHtml))`。AIの補完は呼ばない。
3. `state.candidates = reconcile(state.candidates, fresh, state.decisions)`（3.6）。
4. `state.generation += 1`。
5. 選択中の候補が消えていれば、次の未処理候補へ移す。

一括採用は、選んだ決定をすべてログに積んでから再導出を1回だけ行う。
同じ世代の中では、現行の「要素を残すパッチを先、要素ごと差し替えを後」の順で当てる（3.7）。
1件ずつ再導出する方式にすると、候補数×再導出の時間がかかる。
再導出の時間は、遠野市の最も長いページで計測し、300ミリ秒を超えるなら影響範囲を部分木に絞る最適化を次段で検討する。

### 3.6 照合の規則

`reconcile(previous, fresh, decisions)` は次の順で決める。

1. `fresh` の各候補について、`previous` に同じ指紋の候補があれば、その `candidate_id`、`generation`、`origin`、AI補完で書き換えられた `issue.reason` と `proposal.ai_draft` を引き継ぐ。
2. 同じ指紋の候補が無ければ新しい `candidate_id` を振り、`generation` を現在の世代にする。
3. `previous` の未処理候補で `fresh` に同じ指紋が無いものは、`state.decisions` に `status: "withdrawn"` として記録し、候補一覧から外す。`withdrawn_by_seq` には直前の決定の `seq` を入れる。
4. `previous` の `origin: "llm"` の候補は、対象ノードが存在し `content_hash` が変わっていなければ、`fresh` に無くても残す。AIが出した候補は機械的な再導出では再現できないためである。対象が変わっていれば3と同じく取り下げる。
5. 決定済みの候補は、決定の正本がログにあるので、候補一覧上は「決定済み」として表示し続ける。対象が消えていても表示は残す（証跡のため）。

指紋に `content_hash` を含めない理由は、対象の中身が別の修正で変わっても「同じ箇所への同じルールの指摘」は同じ問題だからである。
中身が変わったことで指摘が消えるなら `fresh` に現れないので、3で取り下げになる。

### 3.7 リプレイと rebuild 操作

`replay(sourceHtml, decisions)` は次を行う。

1. 元のHTMLを読み、`n0001` 形式のIDを振る。
2. `decisions` を `seq` 順に走査する。同じ世代の決定はまとめ、要素を残すパッチを先、要素ごと差し替えを後にする。世代は `decided_at` ではなく、決定ログに `generation` を持たせて判定する。
3. `status` が `accepted` なら `op` を、`edited` なら `after_html` による差し替えを、現在の `node_id` の要素に適用する。要素が見つからなければ、その決定に `orphaned: true` を立て、黙って捨てない。
4. 差し替えで生まれた要素に派生IDを振る（3.4）。
5. 最後に `normalizeHeadingEmphasis()` を当てる（現状どおり）。

`rebuild` 操作は次の形にする。

```js
{ type: "rebuild", builder: "dataTableSemantics", params: {} }
```

`builder` は名前で引くレジストリにし、現在の要素を受け取ってHTML文字列を返す関数を登録する。
初期の登録対象は表の構造ビルダーである。

| builder | 現在の関数 | 候補 |
| --- | --- | --- |
| `dataTableSemantics` | `buildDataTableSemanticsHtml` | `table.caption` |
| `splitMergedRows` | `splitMergedRowsIntoTablesHtml` | `table.cell-merge-layout` |
| `decomposeLayoutTable` | `decomposeLayoutTable` | `table.layout-table` |
| `flattenTable` | `buildFlattenedTableHtml` | `table.cell-merge-layout`（M4） |
| `tableAsList` | `buildTableAsListHtml` | `table.layout-table`（M5） |
| `rowsAsSections` | `buildRowsAsSectionsHtml` | `table.layout-table`（M6） |

`proposal.after_html` は表示用に残すが、`rebuild` を持つ候補では `currentCandidateAfterHtml()` が現在の要素にビルダーを当てて都度計算する。
これにより、表の中の内容修正を先に採用してから構造候補を採用しても、内容修正が変換後HTMLに含まれる。
現状の「畳み込み」（`foldDescendantFixIntoAncestor`）が要らなくなる理由はこれである。

`edited` の決定は、人が直したHTMLを固定で持つ。
編集画面の初期値は `currentCandidateAfterHtml()`（現在の要素から計算した値）にするので、編集前に採用した内容修正は編集結果に含まれる。

### 3.8 調停ロジックの廃止と排他グループ

`app.js` に排他グループの宣言を置く。
`rules.jsonl` は変えない（KB再生成を伴わないという既存の判断に合わせる）。

```js
const EXCLUSIVE_GROUPS = {
  "table-structure": tableStructuralRuleIds,   // app.js:50 の集合をそのまま使う
};
```

規則は次のとおり。

- 候補一覧の「同じ箇所の代替手段 N件中」は、同じ `node_id` かつ同じ排他グループの候補で数える。グループに属さない候補（`text.background-color` など）は、同じ `node_id` でも代替手段に数えない。
- ログに `accepted` または `edited` の決定があり、その `node_id` と排他グループが一致する候補は、再導出で現れても候補一覧に載せない。「この箇所の構造は決定済み」として扱う。
- 排他グループに属さない候補は、同じ `node_id` に何件あっても独立に採用できる。

これで `resolveAlternativeMethodCandidates()` と `isElementReplacingCandidate()` による代替手段の推測が不要になる。
`resolveSupersededTableCandidates()` は3.7の理由で不要になる。
`conflicted` という状態は、新しく作られなくなる。既存の証跡CSVとの互換のため、値としては残す。

指摘3への効き方を確認しておく。
`bgcolor` の表で「確認不要をまとめて採用」を押すと、`text.background-color` が採用される。
再導出すると、表からは `bgcolor` が消えているので背景色候補は出ず、表の構造候補3件は同じ指紋で残る。
3件は排他グループ `table-structure` に属するが、ログにこのグループの決定は無いので、引き続き選べる。

### 3.9 AIによる補完

初回の `runAnalysis()` でのみ実行する（現状どおり）。
補完の結果は候補の `issue.reason`、`proposal.ai_draft`、新規候補（`origin: "llm"`）として残り、3.6の規則で世代をまたいで引き継ぐ。
「AIで再確認」ボタンを画面に足し、作業者が明示的に押したときだけ現在のHTMLで補完をやり直す。
このボタンは本書の範囲では任意とし、S4で入れるかを判断する。

### 3.10 画面

- 決定後に候補一覧を再描画する。新しい世代で生まれた候補には「再確認」のバッジを付け、`bulkActionStatus` に「決定により候補を N件追加、M件取り下げ」と出す。
- 「同じ箇所の代替手段 N件中」の数え方を3.8に変える。
- 取り下げた候補は一覧から消す。証跡には残る（3.11）。
- 完了判定（`isProcessingCompleteFor`）は「現在の候補一覧に未処理が無い」で判定する。取り下げ済みは未処理に数えない。

### 3.11 証跡

証跡の `candidates` は、現在の候補一覧と、ログ上の決定済み・取り下げ済みを合わせたものにする。
列は既存のまま、次を足す。

- `generation`: 候補が生まれた世代
- `withdrawn_by_seq`: 取り下げの原因になった決定の `seq`
- `orphaned`: リプレイで対象が見つからなかった決定

CSVの列順は末尾に追加し、既存の集計を壊さない。

### 3.12 GOAL1バッチ

`goal2Engine.autoAcceptSafe(candidates)` は、内部で「安全な候補を採用→再導出」を繰り返す。
新しく安全な候補が出なくなるか、5世代に達したら止める。
戻り値は採用件数のまま。
`goal2Engine.analyze()` の戻り値に `decisions` を足し、`buildFinalHtml(sourceHtml, candidates)` は候補配列から決定ログを組み立ててリプレイする。
`goal1.js` の呼び出しは変えない。

### 3.13 実装ステージ

各ステージの終わりに「6. 検証手順」を通し、ユーザー確認のうえコミットする。

**S1 決定ログの導入**。
`state.decisions` を作り、`applyCandidateDecision()` がログにも積むようにする。
`rebuildWorkingHtmlFor()` を `replay()` に置き換え、決定順で当てる。
この段階では候補配列の `decision` を正本のままにし、挙動を変えない。
検証: 4系統のテストが緑。

**S2 派生IDと rebuild 操作**。
`replaceTarget()` で派生IDを振る。
表の構造ビルダー6件をレジストリに登録し、候補に `rebuild` を持たせる。
`currentCandidateAfterHtml()` を現在の要素からの計算に変える。
検証: `test:table-nesting` と `test:goal2-output` が緑。表の中の内容修正を先に採用してから構造候補を採用したとき、内容修正が最終HTMLに残ることを新規テストで確認。

**S3 再導出と照合**。
`reconcile()` を実装し、決定の後に3.5の流れを入れる。
`EXCLUSIVE_GROUPS` を導入し、調停ロジック3関数を削除する。
検証: 指摘3の再現ケース（4.1）が通る。`conflicted` を新規に作る経路が無いことを `grep` で確認。

**S4 画面と証跡**。
バッジ、取り下げの表示、証跡の列追加。
検証: 証跡CSVの既存列が変わっていないことをファイル比較で確認。

**S5 GOAL1のループ化**。
検証: `goal1.html` のサンプル一括処理で、採用件数が S5 前以上であること。

### 3.14 決めてほしいこと

- 一括採用の粒度。本書は「まとめてログに積んで再導出1回」とした。1件ずつ再導出する方が正確だが遅い。
- `conflicted` の扱い。新規には作らず、証跡の値としてだけ残す案で良いか。
- 「AIで再確認」ボタンをS4に含めるか。
- 再導出の時間の上限。本書は300ミリ秒とした。

## 4. 個別修正の設計

各項目は「現象」「原因」「変更」「構造変更1との関係」「検証」の順で書く。
行番号は `1826b46` 時点。

### 4.1 指摘3 背景色を採用すると表の構造候補が選べない

**現象**。
`bgcolor` 属性を持つ表で「確認不要をまとめて採用」を押すと、表の構造候補3件が「同じ箇所で別の修正方法を採用したため自動解決」になり、選べなくなる。
`style="background-color"` の表では起きない。実画面で再現済み。

**原因**。
`collectInlineStyleCandidate()`（`app.js:4920`）が、`bgcolor` 属性があるときだけ `patch` を `undefined` にしている。
`isElementReplacingCandidate()`（`app.js:6586`）は `patch` が無い候補を要素ごと差し替える候補とみなし、`resolveAlternativeMethodCandidates()` が同じ `node_id` の他の要素差し替え候補を `conflicted` にする。
`patch` を `undefined` にしたのは、`bgcolor` 属性と `style` の背景指定を1つのpatchで消せなかったためと読める。

**変更**。
`remove-style-properties` パッチに `attributes` を足す。

```js
patch: { type: "remove-style-properties", names: ["background", "background-color"], attributes: ["bgcolor"] }
```

`applyCandidatePatch()` の `remove-style-properties` 分岐（`app.js:6634`）で、`attributes` に挙げた属性も削除する。
候補の `patch` は `hasBgColorAttr` に関係なくこの形にする。
`highlightPatchedTextInElement()` がこのパッチ種別をどう扱うかを確認し、属性削除は本文のハイライト対象にしない。

**構造変更1との関係**。
先に実装してよい。構造変更1のS3で排他グループが入れば、この類型は起きなくなるが、patchを正しく持たせること自体は残す価値がある。

**検証**。
`test/goal2-output/run-output-tests.js` に次を足す。
`bgcolor` の表で、`text.background-color` だけを採用したあと、`table.caption` と `table.layout-table` が未処理のまま残ること。
最終HTMLから `bgcolor` が消えていること。

### 4.2 指摘7 表に「項目／内容1」の行が追加される

**現象**。
1列目が `th` で `thead` の無い表に「データ表として維持し構造を整える」を採用すると、「項目」「内容1」「内容2」「内容3」の行が先頭に足される。再現済み。

**原因**。
`dataTableHeaderPlan()`（`app.js:4203`）が、`thead` が無く1列目の `th` 率が50%以上のとき、または1行目が見出しらしくないとき、`syntheticTableHeaderCells()`（`app.js:4318`）で列見出しを作る。
連絡先らしい表では「電話番号」「メール」を作る。
どちらも元の文書に無い文言の捏造で、CHANGELOGに繰り返し書かれている「捏造なし」の判断に反する。
`lib/sagaAutoFix.js:2747` と `:2781` に同じロジックの複製がある。

**変更**。
`dataTableHeaderPlan()` を次にする。

| 条件 | 結果 |
| --- | --- |
| `thead` がある、または1行目が見出しらしい、または1行目が全て `th` | 1行目を列見出しにする（現状どおり） |
| 上記以外で、1列目の `th` 率が50%以上 | 列見出し行を作らない。`bodyStartIndex: 0`。各行の1列目は `scope="row"` の `th` にする（現状の本体処理がそうしている） |
| 上記以外 | 列見出し行を作らない。候補の `message` に「列見出しの行がありません。必要なら見出し行を追加してください」を添え、`requiresHumanReview: true` にする |

`syntheticTableHeaderCells()` と `looksLikeContactDataTable()` は削除する。
`headerTexts` が空になるため、`normalizeGenericFileLinkText(clone, headerTexts[index])` は見出しが無いときに何もしないことを確認する。
`lib/sagaAutoFix.js` の複製も同じ規則に直す。

**構造変更1との関係**。
独立。先に実装してよい。

**検証**。
`test/goal2-output` に、1列目 `th` の3行の表を入れ、`table.caption` の変換後HTMLに `<thead>` が無く、`<tr>` が3つであることを確認する。
`npm run test:saga-gold` を変更前後で実行し、指標が下がっていないことを確認する。下がる場合は、正解データ側が捏造した見出し行を含んでいないかを見る。

### 4.3 指摘12 ファイルアイコンに画像名の候補が出る

**現象**。
`alt=""` の小さなアイコン画像に「画像の代替テキストが未設定です」の候補が出て、`alt="画像内容を具体的に入力"` を提案する。再現済み。

**原因**。
`collectImageCandidates()`（`app.js:2340`）が、`alt` が `null` か空のすべての `img` を候補にする。
装飾画像を除外する条件が無い。
`alt=""` は装飾画像として正しい状態で、miCheckerも指摘しない。

**変更**。
`isLikelyDecorativeIcon(img)` を足す。次のいずれかで真とする。

- `width` と `height` の属性がともに32以下
- `src` のファイル名が `/(^|[\/_-])(icon|ico|arrow|bullet|shim|spacer|blank|dot|mark)[\w-]*\.(gif|png|svg|jpg)$/i` に一致
- 親に `a` があり、その `a` のテキスト（画像を除く）が空でなく、`a` の中の `img` がこの1枚だけ

規則は `alt` の値で分ける。

| `alt` | 装飾アイコン | 結果 |
| --- | --- | --- |
| `""` | 真 | 候補を出さない |
| `null`（属性なし） | 真 | `alt=""` を提案する。`message` は「装飾画像に空の代替テキストを設定します」。`requiresHumanReview: false`、`confidence: "high"` |
| `null` または `""` | 偽 | 現状どおり |
| 空でない文字列 | 真 | 現状どおり（`isGenericAlt` などの既存判定に任せる）。テキスト付きリンク内のアイコンの `alt="PDF"` を空にする提案は、判断が要るので本書では扱わない |

**構造変更1との関係**。
独立。

**検証**。
`test:michecker-parity` で、`alt` 属性の無い画像への指摘が退行していないことを確認する。
`test/goal2-output` に、`alt=""` のアイコンでは候補が出ないこと、`alt` 属性の無いアイコンでは `alt=""` の提案が出ることを足す。

### 4.4 指摘2 表のキャプションがページごとに違う

**現象**。
同じ構造の表でもページごとに違うキャプションが提案され、シリーズで揃わない。

**原因**。
`dataTableCaptionText()`（`app.js:4437`）は、直前の見出しが無いとき、1行目のセルを連結して「の詳細」を付ける（`app.js:4452`）。
「名称 遠野市役所 0198-62-2111 平日のみの詳細」のようになり、行の中身の差でキャプションが変わる。
見出しがあるときの「見出し＋一覧」は、見出しが違えば違って当然なので、不具合ではない。
シリーズで文言を揃える仕組みが無いのは別の機能要望である（対象外）。

**変更**。
1行目連結のフォールバックを削除する。
見出しからも導けないときは、キャプション文言を空にし、候補を「文言を調整」でしか採用できないようにする。
`shouldRequireEditedAdoption()`（`app.js:7230`）は「要確認かつ確信度低かつ簡易編集あり」で採用を止めるので、この場合の候補を `confidence: "low"` にすれば既存の仕組みで止まる。
編集欄の初期値は空のキャプションにし、`<caption></caption>` のまま採用できないことを確認する。
`genericTableCaption`（「表の詳細」）へのフォールバックも同じ扱いにする。

**構造変更1との関係**。
独立。

**検証**。
`test/goal2-output` に、見出しの無い表で `table.caption` の変換後HTMLの `<caption>` が空であること、採用ボタンが無効であることを足す。

### 4.5 指摘1 見出しが先頭しか直らない

**現象**。
h3が4つ並ぶページで、先頭のh3だけにh2への修正候補が出て、残りはh3のまま残る。再現済み。
見出しを変えたあと、その下の見出しはツールで直せない。

**原因**。
`collectHeadingCandidates()`（`app.js:2632`）は「直前の見出しからレベルが飛んでいるか」だけを見る。
先頭に修正候補を出した時点で `previousLevel` を修正後の値に進める（`app.js:2675`）ため、続くh3は飛びに見えない。
AI側の補完は先頭80ブロックまでしか渡していない（`app.js:1972`）。

**変更**。
飛びの検出の前に、見出し全体の補正候補を出す。

1. コンテンツ内の見出し（h1を除く。h1はh2への既存候補に任せる）の最小レベル `min` を求める。
2. `min > 2` なら、`delta = 2 - min` として、次の1件を出す。対象は先頭の見出し。`message` は「見出しが h{min} から始まっています。全体を h2 起点に揃えます（対象 N件）」。`patch` は `{ type: "shift-headings", delta, node_ids: [...] }`。`requiresHumanReview: true`、`confidence: "medium"`。
3. `applyCandidatePatch()` に `shift-headings` を足す。`node_ids` の各要素を `renameElement()` で `delta` 分ずらす。IDは保たれるので要素を残すパッチとして扱う。
4. 飛びの検出は、補正候補がある場合は補正後のレベルに対して行う。補正候補が無い場合は現状どおり。

`proposal.after_html` は、補正後の見出し一覧を `<ul>` で示す表示用HTMLにし、`patch_mode` は `"patch"` とする。
`before_html` は先頭の見出しにする。

AIへの補完は、見出しは全件、段落は先頭120件まで（60文字で切る）を渡すようにし、80ブロックの上限を外す。
AIの `heading_level_fixes` は現状どおり個別候補にする。

**構造変更1との関係**。
どちらでも実装できる。
構造変更1の前は、補正候補を却下したときに飛びの候補が補正前提のままになる。
構造変更1の後は、決定のたびに再導出されるので、却下すれば飛びの候補が補正前のレベルで出直す。

**検証**。
`test/goal2-output` に次を足す。
h3×4で `shift-headings` の候補が1件出て、`node_ids` が4件であること。
採用後の最終HTMLで4件がh2であること。
h3, h4, h3 の並びで、採用後が h2, h3, h2 であること。

### 4.6 指摘13 操作パネルの大きさを変えられない

**現象**。
「次にやること」パネルは移動できるが、大きさを変えられない。

**原因**。
`.page-agent-panel` の幅が `min(400px, calc(100vw - 48px))` の固定で（`styles.css:1205`）、リサイズの手段が無い。
CSSの `resize` を足すだけでは動かない。
`startPageAgentDrag()`（`app.js:7733`）がパネル全体の `pointerdown` を移動の開始として奪い、`preventDefault()` とポインターキャプチャを行うためである。

**変更**。
右下にリサイズ用のつまみ（`button.page-agent-resize`、16px四方）を足す。

- `startPageAgentDrag()` の除外条件に `.page-agent-resize` を加える。
- つまみの `pointerdown` で開始時の幅・高さを記録し、`pointermove` で `width`/`height` を更新する。下限は 280×160、上限はビューポートから余白24pxを引いた値。
- `pointerup` で `localStorage` の `goal2.pageAgentSize` に保存し、`restorePageAgentPosition()` と同じ場所で復元する。
- `ensurePageAgentInViewport()` で大きさもビューポート内に収める。
- キーボード操作は、移動用のつまみと同じく矢印キーで8pxずつ変える。
- `.page-agent-panel` に `max-height: calc(100vh - 48px); overflow: auto;` を足し、中身が溢れたらパネル内でスクロールする。

**構造変更1との関係**。
独立。

**検証**。
Playwrightで、つまみをドラッグすると大きさが変わり位置が変わらないこと、本体をドラッグすると位置が変わり大きさが変わらないこと、再読み込み後に大きさが戻ることを確認する。

### 4.7 指摘6 通常のテキストに見出しを提案する

**現象**。
本文の定義や説明の段落に「見出しの追加を検討できます（AI提案）」が出る。

**原因**。
`heading-review` の指示（`lib/llm-prompts.js:316`）で、「確信が持てない場合は無理に提案しないでください」が見出しレベル修正（3）にしか付いていない。
`applyHeadingReviewResult()`（`app.js:1975`、`missing_headings` の処理は `:2010` 付近）は、AIの返答をそのまま `confidence: "low"` の候補にし、段落の長さなどの後段の判定が無い。

**変更**。
指示文の（2）に次を足す。

- 提案は1ページあたり3件まで。
- 対象は「3文以上の段落、または2段落以上のまとまり」に限る。
- 定義や導入の一文、直前に見出しがある段落には提案しない。
- 確信が持てない場合は提案しない（現在（3）にある文を（1）〜（3）共通に移す）。

`applyHeadingReviewResult()` の `missing_headings` に後段の判定を足す。

- 対象段落のテキストが80文字未満で、次の兄弟が段落でない場合は捨てる。
- 対象段落の直前の兄弟が見出しの場合は捨てる。

**構造変更1との関係**。
独立。

**検証**。
`npm run test:saga-gold` を変更前後で実行し、見出し関連の指標が下がらないことを確認する。
遠野市の証跡CSVが入手できれば、`html-structure.heading-required` の件数を変更前後で比べる。

### 4.8 指摘10 写真の文字まで文字起こしされる

**現象**。
写真に写り込んだ看板や名札の文字まで代替テキストに入り、チラシやポスターの全文が本文パーツとして出る。

**原因**。
画像の代替テキストの指示（`lib/llm-prompts.js:256`）が、画像の種類を区別せず「画像内の文字も内容なのでaltに含める」「収まらない分は `complex_detail` へ」としている。
`complex_detail` は `app.js:1580` で本文追記用の文言として候補に付く。

**変更**。
返答スキーマに `image_kind` を足す（`photo | banner | poster | flyer | map | chart | illustration | other`）。
指示文に次を足す。

- `photo` では、写り込んだ文字は主題でない限り `alt_text` に入れない。`is_complex` は常に偽。
- `banner`、`poster`、`flyer` では現状どおり文字を含める。
- `map`、`chart` では主要な文字だけを `alt_text` に入れ、全文は `complex_detail` に回す（現状どおり）。

作業者の要望にある「画像内の文字を読む／画像の内容を説明する」の切り替えは、ページ単位の設定 `state.imageNamingMode` として画面に置き、指示文の末尾に反映する。
既定は「画像の内容を説明する」にする。
この切り替えを本書の範囲に含めるかは判断が要る。

**構造変更1との関係**。
独立。

**検証**。
`public/images/` のサンプル画像（写真、バナー）で候補を生成し、写真の `alt_text` に写り込んだ文字が入らないこと、バナーでは入ることを確認する。
`npm run test:saga-gold` で画像関連の指標が下がらないことを確認する。

## 5. 着手順

1. 4.1、4.2、4.3 をまとめて1つのPRにする。互いに独立で、検証が浦添市以降に進む前に直したい。
2. 4.4、4.5 を1つのPRにする。表のキャプションと見出しの補正は、どちらも「捏造しない」「全体を見る」方針の適用である。
3. 構造変更1 を S1 から S5 まで、ステージごとにコミットする。
4. 4.6、4.7、4.8 を順に行う。4.7 と 4.8 はAIへの指示の変更なので、評価の結果を添えてコミットする。

構造変更1を先に始めたい場合は、1と2のPRを構造変更1のブランチに取り込んでから S2 に進む。
4.1 のpatch変更と 4.5 の `shift-headings` は、構造変更1の `replay()` がそのまま扱える。

## 6. 検証手順（共通）

各ステージ、各PRで次を通す。

```
cd goal2-app
node --check public/app.js
node test/run-tests.js
node test/goal2-output/run-output-tests.js
node test/table-nesting/run-table-tests.js
node test/michecker-parity/run-parity-tests.js
npm run test:saga-gold
```

Playwrightは `/opt/pw-browsers/chromium` を使う。
`node test/run-tests.js` はサーバーとAPIの確認で、候補生成のロジックは残り3系統が担う。
AIへの指示を変えた変更は、`npm run test:saga-gold` の結果を変更前後で比べ、差をコミットメッセージに書く。

原因調査で使った再現の入力は次のとおりで、そのまま回帰テストに転用する。

- 指摘1: `<h3>第1章</h3><p>…</p>` を4組
- 指摘3: `<table bgcolor="#eeeeee" border="1">` の3行2列の表
- 指摘7: 1列目が `th` で `thead` の無い3行4列の表
- 指摘12: `<a href="/docs/b.xlsx"><img src="/images/icon_excel.gif" alt="" width="16" height="16">様式集</a>`

## 7. 用語

- **候補**: ツールが提示する1件の修正提案。`candidate`。
- **決定**: 作業者またはバッチが候補に下した判断。採用、編集して採用、却下、要確認、取り下げ。
- **リプレイ**: 元のHTMLに決定を順に当て直して作業中HTMLを得ること。
- **再導出**: 作業中HTMLに対してコレクターを走らせ、候補を作り直すこと。
- **照合**: 再導出した候補と前の候補を指紋で突き合わせ、IDと決定を引き継ぐこと。
- **排他グループ**: 同じ箇所に対して1つしか採用できない候補の集まり。
