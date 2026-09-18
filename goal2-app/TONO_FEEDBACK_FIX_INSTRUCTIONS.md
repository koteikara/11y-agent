# 遠野市フィードバック対応 設計書（構造変更1と個別修正）

遠野市のページでAI移行を試した作業者から上がった15件の指摘のうち、ツール側で直す8件について、設計と構築手順をまとめる。
前半は、指摘の多くに共通する構造の弱点を直す「構造変更1: 決定のたびに依存候補を作り直す」の設計である。
後半は、指摘ごとの個別修正の設計で、構造変更1の前後どちらでも実装できるように書いている。

原因調査の結果は `memory/verification-2026-08-summary.md` の「AI移行で出た指摘」に、指摘の一覧はAI移行の指摘シートにある。
行番号は `main` の `1826b46` 時点の `public/app.js` を指す。
PR-1、PR-2、PR-2.5、構造変更1 S1 でずれているため、行番号ではなく関数名で該当箇所を探す。
2章の行番号だけは S1 で現在の値に直した（`public/app.js` の S1 時点）。

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
`parseFragment()` が入力HTMLを `<template>` に読み込み、`assignNodeIds()`（`app.js:1046`）が全要素に文書順で `data-goal2-node-id="n0001"` 形式のIDを振る。
`generateCandidates()`（`app.js:1060`）が各コレクター（`collectHeadingCandidates`、`collectTableCandidates` など）を呼び、`makeCandidate()`（`app.js:6595`）が候補を作る。
コレクターは呼ばれる順に走り、1つのコレクターの中は文書順なので、候補配列は「種類ごと、その中は文書順」に並ぶ。
配列全体としては文書順ではない。コレクターの呼び出し順が先にくるため、たとえば表の中の見出しは、見出しのコレクターが表のコレクターより先に走る分だけ表より前に並ぶ。
候補は `target.node_id` と、元の要素から作った `proposal.after_html` を持つ。
軽い修正は `proposal.patch`（`set-attribute`、`remove-style-properties`、`rename-element` など）で表し、それ以外は `after_html` による要素ごとの差し替えになる。
AIによる補完（`enrichWithLlm` など）は生成直後に一度だけ走り、候補の文言を書き換えたり、新しい候補を足したりする。

**決定**。
`applyCandidateDecision()`（`app.js:7290`）が候補の `decision` を書き換え、続けて2つの調停を走らせる。
`resolveSupersededTableCandidates()`（`app.js:7506`）は、表の構造候補が採用されたとき、その表の中の内容修正候補を変換後HTMLへ「畳み込み」（`foldDescendantFixIntoAncestor()`、`app.js:7602`）、同じ表の他の表候補を `conflicted` にする。
`resolveAlternativeMethodCandidates()`（`app.js:7318`）は、要素ごと差し替える候補が採用されたとき、同じ `node_id` の他の要素差し替え候補を `conflicted` にする。
決定済みの候補をもう一度選んで採用や却下を押し直せる。画面は決定済みかどうかで決定ボタンを閉じていないため、同じ候補が2回以上決まることがある。

**再構築**。
`rebuildWorkingHtmlFor()`（`app.js:6696`）は、毎回**元のHTMLから**やり直す。
元のHTMLを読み直してIDを振り直し、採用・編集済みの候補を `node_id` ごとにまとめ、要素を残すパッチを先、要素ごと差し替えるパッチを後の順で当てる。
`node_id` の組そのものの順序も、組の中の順序も、候補配列の並び順で決まる。決定した順は見ない。
この順序は出力を左右する。候補の `after_html` は元のHTMLから固定で作られているため、同じ要素への修正を別の順で当てたり、内側の要素を直したあとに外側を差し替えたりすると、先に当てた修正が消える。
候補配列の順で当てることによって、作業者がどの順で採用しても出力は同じになっている。この性質はどこにも明示されていない。
`replaceTarget()`（`app.js:6977`）は差し替え後の先頭要素に元のIDを引き継ぎ、入れ子の表のIDも並び順で引き継ぐ。
差し替えで新しく生まれたそれ以外の要素にはIDが無い。

**証跡と最終HTML**。
`buildEvidenceFor()`（`app.js:9418`）は候補の配列をそのまま証跡にする。
`goal2Engine.buildFinalHtml()` は `rebuildWorkingHtmlFor` の結果から内部属性を除いたものを返す。
GOAL1のバッチ（`goal2Engine.autoAcceptSafe`）は、候補配列を一度走査して安全なものを採用し、同じ調停を通す。

この章はS1前の姿である。S1で再構築は `replay()` に替わり、`rebuildWorkingHtmlFor()` は同値テストの比較対象としてだけ残った。S2で `rebuildWorkingHtmlFor()` と `foldDescendantFixIntoAncestor()` は削除し、表の構造候補は固定の `after_html` ではなく `rebuild` 操作を持つようになった（3.7）。生成と証跡はS2でも同じである。

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

**S1での段階差（実装済み）**。

- `op` はS1では持たせない。`foldDescendantFixIntoAncestor()` が決定の後から構造候補の `decision.after_html` を書き換えるため、決定時点の `after_html` を写すと畳み込みがリプレイに乗らず挙動が変わる。`op` の写しは、畳み込みが要らなくなるS2の `rebuild` 操作と一緒に入れる。S1のログは `candidate_id` を持ち、リプレイは `patch` と `after_html` を候補配列から引く。
- 同じ理由で、`edited` の `after_html` もS1では「証跡用の写し」にとどめ、リプレイは候補配列の `decision.after_html` を読む。正本をログへ移すのはS2。
- `candidate.fingerprint`、`candidate.generation`、`candidate.origin`、`candidate.target.content_hash` はS1では足していない。これらを読むのは3.6の照合だけなので、S3で入れる。指紋はログの各決定が `fingerprint` として持つ。
- `state.generation`（再導出の回数）はS1では使わない。S1が持つのは `state.decisionSeq`（決定の通し番号）と `state.decisionGeneration`（決定の一かたまりの番号）で、どちらも再導出の回数とは別の数である。
- `exclusive_group` は、いま導ける値（`isTableStructuralCandidate()` が真なら `table-structure`）をS1から入れている。読むのは3.8なのでS3から。

**S2での段階差（実装済み）**。

- `op` を入れた。`accepted` の `op` は決定時点の `proposal.patch` の写しで、パッチを持たない候補は `{ type: "replace-html", after_html }`、`patch_mode` が `"none"` の候補は `apply: false` を立てる。`merge-following-note` や `replace-paragraph-sequence` のように当てるときに変換後HTMLを読むパッチ型があるため、`rebuild` 以外の写しには `after_html` も添える。別の手段を選んだ決定の `op` は、選んだ手段の候補から写す。
- `edited` の `after_html` をログの正本にした。畳み込みが無くなり、決定の後から書き換わらなくなったためである。
- `order`（当て順に使う候補配列の添字）を足した。3.7の第1段の当て順に使う。S2では候補配列が変わらないので、決定した時点の添字を固定で持つ。S3で候補を作業中HTMLから作り直し、当て順を `seq` へ切り替えるときに落とす。
- これで `replay()` は候補配列を参照しなくなり、`replay(sourceHtml, decisions)` の2引数になった。旧実装 `rebuildWorkingHtmlFor()` と `decisionLog.legacyRebuild` は削除した。
- `candidate.fingerprint`、`candidate.generation`、`candidate.origin`、`candidate.target.content_hash`、`state.generation` はS2でも足していない。S3で入れる。

**S3での段階差（実装済み）**。

- `candidate.fingerprint`、`candidate.generation`、`candidate.origin`、`candidate.target.content_hash`、`candidate.exclusive_group`、`state.generation`、`state.nextCandidateSeq` を入れた。照合（3.6）と排他グループ（3.8）が読む。
- `order` を決定ログから落とした。当て順が `seq` になったためである（3.7）。
- **`state.decisionGeneration` と `state.generation` は統合しない**。意味が違い、値も一致しない。
  - `state.decisionGeneration`（決定の一かたまりの番号）は決定ログの各行が `generation` として持ち、**リプレイが当て順を決めるために読む**。`decide()` 1回、一括採用1回がそれぞれ1つ。
  - `state.generation`（再導出の回数）は**候補が生まれた世代**を `candidate.generation` に記録するために使う。
  - 一致しない経路が2つある。(1) GOAL1 の `goal2Engine.autoAcceptSafe()` は S3 では単一パスで再導出を挟まないので、決定の世代は進むが再導出の回数は進まない（ループ化は S5）。(2) `decisionsFromCandidates()`（`buildFinalHtml()` が使う）は全件を `generation: 1` に置く、画面の state を持たない経路である。
- 指紋は `rule_id|method_label|node_id` だけでは一意にならない。1つの段落に「全　長→全長」と「高　さ→高さ」の `text.spaced-characters` が2件、「22m」「17.5m」「4m」の `text.unit-notation` が3件というように、同じルールが同じ要素の別々の箇所に出る。指紋が重なると、1件採用しただけで残りが「決定済みの指紋」と見なされて候補一覧から消える。そこで **`replace-text` のパッチに限り、置換前の文字列を指紋に足す**。置換「後」を入れないのは、AIの補完が置換後の文言を書き換える候補（`set-text` のリンク文言、`set-attribute` の `alt` など）で指紋が変わり、世代をまたいだ引き継ぎが切れるためである。`replace-text` はAIの補完が触らないパッチ型なので、置換前の文字列は世代をまたいで安定する。
- `candidate.enriched` を足した。AIの補完（と、作業者が投入したAI画像名）が候補の内容を書き換えたかどうかの印で、照合の引き継ぎ範囲を決める（3.6）。

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

**S2での段階差（実装済み）**。

- `replaceTarget()` が上の規則どおり派生IDを振る。当てている決定の `seq` は、引数で持ち回らず、リプレイが当てている間だけ立てるモジュール変数（`activeDecisionSeq`）から読む。画面の「修正後」欄のように決定の外から当てるときは `null` なので、派生IDは振らない。
- 入れ子の表のID引き継ぎは廃止した。3.7の第2段が `rebuild` の決定を内側（子孫）から先に当てるため、入れ子の表の変換は外側の変換より先に済んでおり、外側の変換結果にそのまま含まれる。実ページ51件のプローブでも退行は出なかったので、`rebuild` 以外の差し替えにも引き継ぎは残していない。
- 派生IDは `seq` を含むので、**同じ決定の集合でも積んだ順が違えばIDの値は変わる**。変わらないのは中身の方である。回帰テストの「決定順を入れ替えても出力が変わらない」検査は、内部属性を落としたHTMLで比べている。
- 引き継ぎの廃止で、画面側に1点の制限が残る。外側の表を解体したあと、内側の表への未処理候補は `node_id` が作業中HTMLから消えるため、「修正後」欄が生成時点の `proposal.after_html` へフォールバックする（採用そのものはできる。リプレイが内側を先に当てるため最終HTMLは正しい）。S3の再導出で、内側の表に新しい `node_id` の候補が出るようになれば解消する。

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

**S3での段階差（実装済み）**。

- `rederiveCandidates()` を `decide()`、`bulkAcceptSelected()`、`bulkAcceptReviewFree()`、`applyPendingAutoAcceptSafe()` の後に1回走らせる。**GOAL1 の `goal2Engine.autoAcceptSafe()` は単一パスのままで、再導出を入れない**（ループ化は S5）。
- 作業中HTMLの読み直しは `parseFragment()` ではなく専用の `parseWorkingForRederivation()` を通す。作業中HTMLには派生ID（`nX.s{seq}.{k}`）付きの要素があるので、既存の `data-goal2-node-id` を振り直さない。IDを持たない要素（`insert-caption` が足した `<caption>` など）にだけ、既存の `n####` と衝突しない番号を振り、**振った結果を `state.workingHtml` へ書き戻す**。書き戻さないと、画面の「修正後」欄が読む `parseWorkingFragment()` に同じIDが無く、候補が対象を見失う。
- miChecker モードでは、初回の `runAnalysis()` と同じ絞り込み（`isMicheckerRelevantRule()`）を再導出でもかける。かけないと、決定のたびに非対応のルールが候補一覧へ紛れ込む。
- 注意（`state.notices`）は再導出で作り直さない。決定の対象ではなく、証跡の列も S4 で扱うためである。
- 選択中の候補が一覧から消えていれば、次の未処理候補へ移す。一括選択（`bulkSelectedCandidateIds`）は `pruneBulkSelection()` で整理し、選択中の手段（`selectedFixMethodId`）と簡易編集の開閉も、対象が消えていれば閉じる。

### 3.6 照合の規則

`reconcile(previous, fresh, decisions)` は次の順で決める。

1. `fresh` の各候補について、`previous` に同じ指紋の候補があれば、その `candidate_id`、`generation`、`origin`、AI補完で書き換えられた `issue.reason` と `proposal.ai_draft` を引き継ぐ。
2. 同じ指紋の候補が無ければ新しい `candidate_id` を振り、`generation` を現在の世代にする。
3. `previous` の未処理候補で `fresh` に同じ指紋が無いものは、`state.decisions` に `status: "withdrawn"` として記録し、候補一覧から外す。`withdrawn_by_seq` には直前の決定の `seq` を入れる。
4. `previous` の `origin: "llm"` の候補は、対象ノードが存在し `content_hash` が変わっていなければ、`fresh` に無くても残す。AIが出した候補は機械的な再導出では再現できないためである。対象が変わっていれば3と同じく取り下げる。
5. 決定済みの候補は、決定の正本がログにあるので、候補一覧上は「決定済み」として表示し続ける。対象が消えていても表示は残す（証跡のため）。

指紋に `content_hash` を含めない理由は、対象の中身が別の修正で変わっても「同じ箇所への同じルールの指摘」は同じ問題だからである。
中身が変わったことで指摘が消えるなら `fresh` に現れないので、3で取り下げになる。

**S3での段階差（実装済み）**。

- `reconcile(previous, fresh, decisions)` を実装した。上の1〜5に加えて、3.8 の排他グループによる除外（ログに `accepted`／`edited` の決定がある `node_id`＋グループに属する `fresh` の候補は一覧に載せない）を行う。
- 引き継ぐのは `candidate_id`、`generation`、`origin`、`decision`（ログの写し）。**`patch`・`after_html`・`before_html`・`target.snippet`・`target.content_hash` は `fresh` の値を使う**。これが S1 のレビューで出た「リンク文言の書き戻しが元の全角の文言で上書きする」問題と、3.13 の sg04015（`replace-paragraph-sequence` の固定の変換後HTMLが同じ範囲の他の修正を上書きする）を解消する。
- **AIの補完が書き換えた候補（`candidate.enriched`）は、`issue` と `proposal` を前の候補から引き継ぐ**（`before_html` だけは `fresh` の値）。本書の1は「`issue.reason` と `proposal.ai_draft` を引き継ぐ」と書いていたが、実装ではAIの結果が `proposal.patch` の値（`alt`、リンク文言、`scope`、`lang`、キャプション）と `proposal.after_html` にも入る。ここを `fresh` で上書きすると、決定1件ごとにAIの下書きが機械的な下書きへ戻ってしまう。再導出はAIを呼び直さない（3.9）ので、前の候補の値が唯一の手がかりである。
  - 印が立つのは、`runAnalysis()` が補完の前後で候補の内容（`issue.message`、`issue.reason`、`proposal.after_html`、`proposal.patch`、`proposal.confidence`、`proposal.requires_human_review`、`proposal.ai_draft`）を比べて差があった候補と、補完が足した `origin: "llm"` の候補、それに作業者が「AI画像名を修正後HTMLへ投入」した候補である。
  - 残る制限。AIが書き換えた候補の対象が別の修正で変わっても、`proposal.after_html` は生成時点のままである。`patch` を持つ候補では出力に影響しない（リプレイは `op`＝パッチを当てる）が、`patch` を持たないAI候補では古い変換後HTMLが当たる。3.9 の「AIで再確認」ボタン（S4以降で判断）が入るまでの制限である。
- **指紋が重なったときの引き当て**は「消費する」形にした。指紋ごとに前の候補を未処理・決定済みの2列に並べ、`fresh` の1件が引き当てられるのは1件までとする。未処理を先に引き当て、無ければ決定済みを引き当てて `fresh` の候補を落とす（決定済みとして一覧に残っているので二重に載せない）。件数の帳尻が合うので、指紋が万一重なっても候補が消えない。
- **候補一覧の並び**は、`fresh` の並びを軸に、`fresh` に現れなかった生き残り（決定済み・`origin: "llm"`）を「前の一覧で直前にあった候補の位置」へ寄せる。決定のたびに一覧が大きく動かないようにするためである。

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

**S1での段階差（実装済み）**。

S1の `replay()` は `replay(sourceHtml, decisions, candidates)` の3引数になる。ログに `op` が無く、当てる内容を候補配列から引くためである。第3引数はS2で落とす。

S1では、上の2が書く「`seq` 順に走査し、世代の境目で区切って当てる」ことはしない。当て順は候補配列の添字が決め、ログが決めるのは「どの決定を当てるか」だけにする。これで旧実装の `rebuildWorkingHtmlFor()` と構成上同じ順序になる（2章）。候補配列の順に並べ、同じ `node_id` の決定を1組にまとめ、組の中では要素を残すパッチを先、要素ごと差し替えを後に当てる。

`seq` を当て順に使わない理由は、S1の候補の `after_html` が元のHTMLから固定で作られているため、作業者が採用した順で当てると出力が採用順で変わることである。旧実装は候補配列の順で当てるので採用順に依存しなかった。実ページで確かめた例を挙げる。

- 佐賀市 sg03996 の `n0015` では、リンク文言を書き戻す `file.file-display-text`（`set-text`）と「１」→「1」の `text.alphanumeric`（`replace-text`）が同じ `<a>` に出る。半角化を先に当てると `set-text` が元の文言で上書きする。
- 佐賀市 sg02562 の `n0141` では、箇条書き化する `text.list`（`replace-with-list`）と半角化が同じ段落に出る。半角化を先に当てると、箇条書きの `after_html`（元のHTML由来）で全角に戻る。
- `autoAcceptSafe()` と同じ決定の集合を逆順に積むと、佐賀市51ページ中3ページで出力が変わる。全候補を採用した集合では13ページ。

`node_id` の昇順で並べる案は採らない。`assignNodeIds()` は4桁ゼロ埋めなので10000個目からは `n10000` になり、文字列比較では `n10003` が `n9999` より前にくる。S2の派生ID `nX.s{seq}.{k}` は文字列でも数値でも文書順にならない。

`seq` が当て順になるのは、候補が「そのときの作業中HTML」から `after_html` を作り直すようになるS2以降である。

同じ候補が2回以上決まることがある（2章）。後の決定が前の決定を置き換えるので、リプレイは候補ごとに `seq` が最大の1件だけを当てる。残さないと、採用から却下へ決め直した候補の採用が当たってしまう。

上の3が言う `orphaned` は、S1では「修正が失われた」ではなく「リプレイで対象が見つからなかった」を意味する。畳み込み（`foldDescendantFixIntoAncestor()`）で祖先の `after_html` に入った修正も、対象の要素は祖先ごと差し替えられて消えるため印が立つが、修正自体は出力に残っている。S3で画面に出すときに「失われた」と表示すると誤りになる。畳み込みが無くなるS2で本来の意味になる。

**S2での段階差（実装済み）**。

**ビルダーのレジストリ**。表の構造ビルダー7件を `TABLE_REBUILD_BUILDERS` に名前で登録し、`(element, params) => htmlString` の形に揃えた。各ビルダーが対象の要素の外のDOM（直前の見出し）から読んでいた入力は `params` に移し、候補を作る時点で確定させる。`currentCandidateAfterHtml()` は対象の表だけを複製してビルダーを当てるため、複製先には直前の見出しが無く、DOMから導き直すと表示と適用で結果が食い違うからである。AIの補完（`applyTableCaptionLlmResult()`）がキャプションの文言を書き換えたときは `params.caption` も揃える。

| builder | 現在の関数 | `params` |
| --- | --- | --- |
| `dataTableSemantics` | `buildDataTableSemanticsHtml` | `caption`（直前の見出しから導いたキャプションの文言。空なら現在の要素から導き直す。表が自分で `<caption>` を持っていればそちらが優先される） |
| `splitMergedRows` | `splitMergedRowsIntoTablesHtml` | `heading_text`、`heading_tag_with_caption`、`heading_tag_fallback` |
| `decomposeLayoutTable` | `decomposeLayoutTable` | `parent_heading_tag` |
| `flattenTable` | `buildFlattenedTableHtml` | なし（表の外を読まない） |
| `tableAsList` | `buildTableAsListHtml` | `heading_tag` |
| `rowsAsSections` | `buildRowsAsSectionsHtml` | `heading_tag` |
| `mergedCellProposal` | `buildMergedCellProposal` | `rule_id`、`heading_tag`、`parent_heading_tag` |

`rebuild` を持たせるのは「表を丸ごと差し替える構造候補」すべてである。`planTableTreatments()` が返す6手段に加えて、`buildMergedCellProposal()` が作るセル結合の分類ごとの再構成（`table.cell-merge-heading` / `-summary` / `-note` / `-file` / `-mark`）も含む。後者は表と `mergeRule.ruleId` だけで決まるので、ビルダーは `mergedCellProposal` 1つにして `params.rule_id` で分岐する。結合セルが無くなっているなど扱えない形になっていた場合は `unchangedProposal()` が表をそのまま返すので、差し替えても何も変わらない。

ここを6手段だけに留めると、畳み込みの廃止と組み合わさって挙動が変わる。セル結合の再構成が固定の変換後HTMLのままだと、リプレイの第1段で、`order`（表のコレクターは文字のコレクターより先に走る）により表の中の内容修正より**先に**当たり、元のHTMLから作ったHTMLで表ごと差し替えてしまう。後に当たる内容修正は対象を失う。S1ではこれを畳み込みが守っていた。

`isTableStructuralCandidate()` が真でも `rebuild` にしない候補が2種類ある。どちらも表を差し替えないので、上の問題は起きない。

- 要素を残すパッチを持つ候補（`insert-caption` の簡易候補）。第1段で当たり、表の中の他の修正を消さない。
- `patch_mode` が `"none"` の確認だけの候補（`collectNaiveTableStructureCandidates()` が出す `table.layout-table` など）。決定ログの `op` に `apply: false` が立ち、リプレイで当たらない。

`image.image-text-layout` は `figure` / `p` / `div` を対象にするので、そもそも `isTableStructuralCandidate()` が真にならない。

回帰テストで、全候補を走査して「要素ごと差し替える構造候補（`patch_mode` が `"none"` でないもの）はすべて `rebuild`」が成り立つことを確かめている。

`applyCandidatePatch()` は `rebuild` を当てるようになり、「当てられたか」を返す。対象が表でない、ビルダーの名前が引けない、ビルダーが空を返したときは当てず、リプレイ側で `orphaned` を立てる。`ELEMENT_REPLACING_PATCH_TYPES` には `rebuild` と `replace-html` を足した。

**当て順は2段**。S2でも `seq` は当て順にしない（第1段の決定は固定の `after_html` を持つため、採用順で当てると出力が採用順で変わる。上の実ページの例を参照）。

- 第1段: `rebuild` 以外の決定。S1の規則のまま（`order`＝候補配列の添字の順、同じ `node_id` は1組、組の中は要素を残すパッチを先、要素ごと差し替えを後）。
- 第2段: `rebuild` の決定。内側（子孫）を先、外側（先祖）を後に当てる。互いに子孫関係に無いものは `order` の順。子孫関係は第2段を当て始める前のDOMで判定する（当て始めると要素が入れ替わるため）。同じ要素を指す `rebuild` が2件以上あると互いを子孫と見て選べなくなるので、その場合は `order` の先頭から当てる。

第1段を先にするので、ビルダーは「先に当てた内容修正を含む現在の要素」を読む。これにより、作業者がどちらを先に採用しても、表の中の内容修正も内側の表の変換も外側の変換結果に含まれる。

**畳み込みの廃止（挙動の変更）**。`foldDescendantFixIntoAncestor()` を削除し、`resolveSupersededTableCandidates()` から内容修正の子孫候補（`table.` 以外）に対する処理を外した。同じ表の表関連候補（`table.*`）を `conflicted` にする処理と、入れ子の表の `survivesInAncestorOutput()` の扱いはS2では変えていない（S3で排他グループに置き換える）。

これまで「構造候補の採用時に未処理だった内容修正」は、畳み込みで作業者の採用なしに出力へ入り、`conflicted`（反映済み）と表示されていた。S2からは未処理のまま残り、作業者が採用したものだけが第1段で当たって最終HTMLに入る。採用が後になっても、リプレイは第1段を先に当てるので反映される。

**`edited` の制限**。構造候補を編集（`edited`）すると、その決定は人が直したHTMLでの固定の差し替えになる。そのあとにその表の中の内容修正を採用しても、対象が編集後のHTMLに無いため `orphaned` になる（従来は畳み込みで入っていた）。S3の再導出で、編集後のHTMLに対する候補が出るようになるまでの制限である。編集画面の初期値は `currentCandidateAfterHtml()`（現在の要素から計算）なので、編集**前**に採用した内容修正は編集結果に含まれる。

**`orphaned` の意味**。畳み込みが無くなったので、S2の `orphaned` は本来の意味、つまり「その決定の操作が当たらなかった」になった。ただし `patch_mode` が `"none"` の候補（通知だけの候補）も、対象が見つからなければ印が立つ。HTMLは元から変えない候補なので「修正が失われた」わけではない。画面に出すS4で、この区別を付けるか判断する。

**S3での段階差（実装済み）**。

- 当て順を `seq` 順にした。`replay()` は決定を**世代ごとにまとめ**、世代の中を S2 の2段（第1段: `rebuild` 以外を `seq` 順に並べ、同じ `node_id` を1組にして要素を残すパッチを先。第2段: `rebuild` を内側から）で当てる。世代の順は「その世代で最小の `seq`」の順にする（世代番号そのもので並べないのは、入れ子の一括採用のように後から始まった世代に大きい番号が付きうるためである）。
- `order` をログから落とした。`decisionsFromCandidates()`（GOAL1 の `buildFinalHtml()`）は候補配列の並び順で `seq` を振り全件を1世代に置くので、当て順は S2 と同じになり、GOAL1 の出力は変わらない。
- `seq` を当て順にできるようになったのは、候補が「そのときの作業中HTML」から作り直されるようになったためである。S1・S2 では、候補の `after_html` が元のHTMLから固定で作られていたので、採用順で当てると出力が採用順で変わった。
- **決定ログは「操作の列」であって「集合」ではなくなった**。派生ID `nX.s{seq}.{k}` はその要素を生んだ決定の `seq` を含むので、再導出で作り直された要素への決定がログに入ると、`seq` を振り直した時点で後の決定が対象を見失う。並べ替えても同じ出力になる、という性質は、派生IDを指す決定を含まないログに限られる。回帰テストもその線で分けている。
- 同じ世代の中でも、**同じ `node_id` への複数の決定は順序で結果が変わりうる**（第1段が「要素を残すパッチを先」と決めているのはそのためである）。1世代の中のこの順は候補配列の並び（＝一括採用が積む順）で決まり、作業者が触れるものではない。世代をまたげば、2件目は再導出で作り直されるので順序によらず正しくなる。

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

**同じ世代の中の同一箇所の扱い**。

調停を外すと、一括採用や GOAL1 の単一パスで、同じ `node_id` に要素ごと差し替える候補が2件以上同時に採用される経路が残る（例: 同じ `<p>` への `text.note-symbol` と別の差し替え候補が両方とも確認不要）。リプレイは同じ世代の中では後の1件が先の1件の結果を上書きするので、出力が採用順で決まってしまう。
画面の1件ずつの採用では問題にならない。決定のたびに再導出が走り、2件目は次の世代で作業中HTMLから作り直されるためである。

そこで、**一括採用と GOAL1 の単一パスでは、1世代に同じ `node_id` の要素ごと差し替えは1件まで**とし、2件目以降は採用せず未処理のまま残す。作業者は次の世代で作り直された候補を採用できる（GOAL1 は S5 のループ化で再導出に置き換える）。
`rebuild` はリプレイの第2段で内側から当たり、ビルダーが現在の要素を読むので、この制限の対象外である。`patch_mode` が `"none"` の候補もHTMLを変えないので対象外である。

**この規則は「同じ `node_id`」では足りない（S3 の実装で広げた）**。佐賀市の実ページ51件の候補を全件走査したところ、「同じ `node_id` に要素ごと差し替えの確認不要候補が2件」という形は**1件も無かった**。実際に出るのは 3.13 の sg04015 の形である。

- `n0004` の `text.list`（`replace-paragraph-sequence`）は `requires_human_review` が `false` なので「確認不要をまとめて採用」に入る。この候補は `n0004`〜`n0018` の段落をまとめて差し替える。
- 同じ一括採用で採用される `n0015` の `text.alphanumeric`（「令和５年度」→「令和5年度」）は、その範囲の中にある。
- 差し替える候補の変換後HTMLは、その世代では作り直されていないので元のHTML由来である。先に当たれば上書きされ、後に当たれば対象が見つからない。どちらにしても修正は消える。

そこで規則を次まで広げる。

> 1世代の中で、**固定の変換後HTMLで差し替わる範囲**（その要素と子孫。`replace-paragraph-sequence` ならまとめられる段落すべてとその子孫）にある候補は、要素を残すパッチであっても採用しない。次の世代で、作業中HTMLから作り直された候補を採用する。

範囲を主張するのは、変換後HTMLで差し替えるパッチ型だけにする。`replace-html`、`merge-following-note`、`replace-paragraph-sequence`、`remove-element` と、パッチを持たない候補（操作は `replace-html`）である。
`unwrap-element` と `rename-element` は入れない。どちらも子要素と `data-goal2-node-id` をそのまま残すので、範囲の中の修正は当たる。`rebuild` も入れない（上記の理由）。

また、「同じ `node_id` への2件目以降」の方は、**要素ごと差し替える候補にだけ**適用する。リプレイの第1段が同じ `node_id` の中で要素を残すパッチを先に当てるため、`<p><tt>…</tt></p>` で装飾タグの解除（`unwrap-element`）と単位の言い換え（`replace-text`）が同居していても、両方とも最終HTMLに残る。

**S3での段階差（実装済み）**。

- `EXCLUSIVE_GROUPS = { "table-structure": tableStructuralRuleIds }` を置き、`exclusiveGroupFor()` で候補と決定ログの `exclusive_group` を導く。`table-structure` は「対象が表であること」まで含めて判定する（`image.image-text-layout` は `figure` / `p` / `div` も対象にするため）。`isTableStructuralCandidate()` はこの関数の薄い包みになった。
- 候補一覧の「同じ箇所の代替手段 N件中」と、代替手段のグループ表示（`renderCandidates()` のバケット分け）、手段の選択（`activeFixMethodCandidate()`）を、`isElementReplacingCandidate()` ではなく排他グループで数えるようにした。
- `resolveSupersededTableCandidates()`、`resolveAlternativeMethodCandidates()`、`survivesInAncestorOutput()`、`isDescendantOfCandidateTarget()`、`isTableRelatedCandidate()`、`tableRelatedRuleIds` を削除した。`conflicted` を新しく作る経路は無い（`grep` で確認。残るのは状態ラベルの定義とCSS、コメントだけ）。
- 上の規則を `createGenerationReplacementGuard()` として、`bulkAcceptSelected()`、`bulkAcceptReviewFree()`、`applyPendingAutoAcceptSafe()`、`goal2Engine.autoAcceptSafe()` に入れた。範囲の判定に作業中HTMLのDOMを使うため、`runAnalysis()` が `state.sourceHtml` と `state.workingHtml` を候補の元のHTMLに揃えるようにした（ヘッドレス経路には画面の `analyze()` のような設定箇所が無く、前のページのHTMLが残っていた）。
- ガードは候補配列の順に判定するので、**先に来た候補が勝つ**。コレクターの並びは「要素をまとめて差し替える候補（`collectPseudoListCandidate` / `collectSequentialNumberedParagraphCandidates`、どちらも要素の走査で先に出る）→ 文字の修正（テキストノードの走査）」なので、sg04015 の形では差し替えが先に採用され、範囲の中の文字修正が次の世代へ回る。
- **挙動の変更**。S2 まで `conflicted`（決定済み）になっていた「同じ箇所の採用されなかった代替手段」は、S3 では未処理のまま残る。GOAL1 の証跡では、その分だけ `unresolved` が増え `complete` が偽になりうる。S5 で `autoAcceptSafe()` をループ化すれば、これらは再導出で取り下げられるか、作業者が選ぶべき手段として正しく残る。

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

**S1 決定ログの導入**。実装済み（PR #131）。
`state.decisions` を作り、`applyCandidateDecision()` がログにも積むようにする。
`rebuildWorkingHtmlFor()` を `replay()` に置き換える。
この段階では候補配列の `decision` を正本のままにし、挙動を変えない。
検証: 6章の5コマンドすべてがS1前と同じ結果。

S1で決めた段階差は次のとおりで、3.3 と 3.7 に書いた。

- `op` はS2から。畳み込み（`foldDescendantFixIntoAncestor()`）が決定の後から `after_html` を書き換えるため、決定時点の写しを持つと挙動が変わる。S1のリプレイは候補配列から `patch` と `after_html` を引く（`replay()` は3引数）。
- 当て順は `seq` ではなく候補配列の添字が決める。ログが決めるのは「どの決定を当てるか」だけで、これで旧実装と構成上同じ順序になる。`seq` が当て順になるのはS2以降。
- 旧実装の `rebuildWorkingHtmlFor()` はS1では残し、同値テストの比較対象にだけ使う。削除はS2。
- 同じ候補を決め直したときは、リプレイは `seq` が最大の決定だけを当てる。
- `orphaned` はS1では畳み込み済みの決定にも立つ。本来の意味になるのはS2。

**S2 派生IDと rebuild 操作**。実装済み（PR #132）。
`replaceTarget()` で派生IDを振る。
表の構造ビルダー6件をレジストリに登録し、候補に `rebuild` を持たせる。
`currentCandidateAfterHtml()` を現在の要素からの計算に変える。
あわせて、S1から持ち越した「決定ログの正本化」（`op`・`order`、`replay()` の2引数化、旧実装の削除）と「畳み込みの廃止」も行った。段階差は3.3・3.4・3.7に書いた。
検証: 6章の5コマンドすべて緑。`npm run test:saga-gold` は変更前後で同じ数値（`lib/sagaAutoFix.js` は候補の決定を通らない）。実ページ51件のGOAL1経路は51件すべてS1と同じ出力。

S2で確かめる項目（S1のレビューで見つかった申し送り）。
GOAL1と同じ決定の集合（`autoAcceptSafe()`）でも、佐賀市の実ページ51件のうち5件で、採用済みの決定に `orphaned` が立つ。畳み込みの対象になる表の候補ではないため、修正が実際に最終HTMLから落ちている可能性がある。S2で `rebuild` 操作と派生IDを入れたあと、これらが拾えるようになるかを確かめる。

5件とも表の構造候補が関わらない（`rebuild` にならない）決定だったため、S2でも `orphaned` は同じ5件に立ち、出力もS1と同じである。1件ずつ確かめた結果は次のとおりで、**修正が実際に失われていたのは sg04015 の1件だけ**だった。

| ページ | 対象を失った決定 | 同じ箇所を消した採用済みの決定 | S2の結果 |
| --- | --- | --- | --- |
| sg02535 | `text.note-symbol`（n0030） | 先祖の `text.note-symbol`（n0027） | 修正は残る。n0030 は `after_html` が `before_html` と同じ（HTMLを変えない候補）で、先祖 n0027 の同じルールの差し替えが `<br>`・`<strong>` を外した段落を作っている。失われた修正は無い |
| sg02538 | `text.note-symbol`（n0031、n0032） | 先祖の `text.note-symbol`（n0029） | 修正は残る。n0031 はHTMLを変えない候補。n0032 の意図（`<br>` を外す）は、先祖 n0029 の差し替え後HTMLに同じ形で入っている |
| sg04015 | `text.note-symbol`（n0008）、`text.alphanumeric`（n0015） | n0004 の `text.list`（`replace-paragraph-sequence`） | n0008 はHTMLを変えない候補で失われていない。**n0015（「令和５年度」→「令和5年度」）は失われている**。原因は先祖の `text.decoration-lines`（n0014）ではなく、n0004 の `replace-paragraph-sequence` が n0012〜n0018 の段落をまとめて差し替えることだった。この候補の `after_html` は元のHTMLから作られるため、同じ範囲に当たった他の修正（n0014 の `<u>` 解除もこちら）が上書きされる。`rebuild` では直らない。**S3の再導出に回す** |
| sg02544 | `text.note-symbol`（n0044） | n0029 の `text.list`（`replace-paragraph-sequence`、n0029/n0033/n0037/n0040/n0047/n0051/n0054/n0055 をまとめる） | 修正は残る。n0044 は `patch_mode: "none"` の通知候補で、そもそもHTMLを変えない |
| sg02554 | `text.alphanumeric`（n0051、n0055、n0059） | n0050/n0054/n0058 の `text.list`（`replace-paragraph-sequence`） | 修正は残る（実質）。箇条書き化で行頭の「２．」ごと落ちるため、最終HTMLに全角の「２」は1つも残っていない |

下2件の「先祖にも同じ要素にも採用済みの候補が無い」は誤りで、S1のレビューで疑われていたとおり `replace-paragraph-sequence` が他の `node_id` を消していた。
S3で直すのは sg04015 の1件と、その一般形である「固定の `after_html` を持つ候補が、他の修正が当たった範囲を元のHTMLで上書きする」問題である。

**S3 再導出と照合**。実装済み（PR #135）。
`reconcile()` を実装し、決定の後に3.5の流れを入れる。
`EXCLUSIVE_GROUPS` を導入し、調停ロジック3関数を削除する。
検証: 指摘3の再現ケース（4.1）が通る。`conflicted` を新規に作る経路が無いことを `grep` で確認。

S3で決めた段階差は 3.3・3.5・3.6・3.7・3.8 に書いた。要点は次のとおり。

- 指紋 `rule_id|method_label|node_id` は一意にならないので、`replace-text` のときは置換前の文字列まで含める（3.3）。
- AIの補完が書き換えた候補は `issue` と `proposal` を引き継ぐ。本書の「`issue.reason` と `proposal.ai_draft`」より広い（3.6）。
- `state.decisionGeneration`（決定の一かたまり）と `state.generation`（再導出の回数）は統合しない（3.3）。
- 決定ログは操作の列であって集合ではない。派生IDを指す決定を含むログは並べ替えられない（3.7）。
- 一括採用と GOAL1 では「1世代に同じ `node_id` の要素ごと差し替えは1件まで」（3.8）。
- S2 で `conflicted` になっていた代替手段は、S3 では未処理のまま残る（3.8）。

S3で確かめた S2 からの持ち越し。

| 項目 | S3の結果 |
| --- | --- |
| `edited` の制限（3.7のS2） | 解消。構造候補を編集したあとでも、編集後のHTMLに対する内容修正候補が再導出で出るので採用できる |
| 入れ子の表のID引き継ぎ廃止による画面側の制限（3.4のS2） | 解消。外側を解体したあと、解体後に残った内側の表に派生IDの新しい候補が出る |
| sg04015（`replace-paragraph-sequence` が同じ範囲の修正を上書きする） | 解消。ただし再導出だけでは足りず、3.8 の規則を「差し替わる範囲」まで広げる必要があった（同じ世代で両方採用されるため）。画面の経路（「確認不要をまとめて採用」を押し直す）で「令和5年度」が最終HTMLに残ることを回帰テストで確認 |
| 指摘3（4.1） | 背景色を採用しても表の構造候補3件は同じ指紋で残り、引き続き選べる |

S3で新しく分かった制限（S4以降の判断に回す）。

- `tableAsList`（箇条書きに変換する）は、ビルダーがセルの文言を作るときに全角空白を半角へ直す。そのため変換後HTMLでは `text.spaced-characters` の条件（全角空白・NBSP・半角空白2つ以上）を満たさず、この候補が作り直されない。構造候補を先に採用すると文字間空白が残る（内容修正を先に採用すれば残らない）。ビルダー側の問題で、S3の範囲では直さない。
- 取り下げた候補は候補一覧から消えるので、証跡（3.11、S4）にも出なくなる。3.11 で `withdrawn_by_seq` の列を足すときに、ログから拾って並べる。
- 候補は「現在の文書への操作」なので、提示される手段そのものが決定によって変わる。入れ子の表で内側をデータ表に変換すると、外側の「表をやめて見出し・段落へ解体」が `planTableTreatments()` から出なくなる（実測）。これは設計どおりだが、「採用順を変えても同じ最終HTMLになる」という S2 までの回帰テストは成り立たなくなる。

**S4 画面と証跡**。
バッジ、取り下げの表示、証跡の列追加。
検証: 証跡CSVの既存列が変わっていないことをファイル比較で確認。

**S5 GOAL1のループ化**。
検証: `goal1.html` のサンプル一括処理で、採用件数が S5 前以上であること。

### 3.14 確定済みの判断（2026-09-15、ユーザー確認済み）

- 一括採用の粒度は「まとめてログに積んで再導出1回」とする。確認不要の候補は属性や文字の修正で互いに干渉しにくく、1件ずつ再導出すると候補数の分だけ待たせるため。
- `conflicted` は新規には作らず、証跡の値としてだけ残す。取り下げ（`withdrawn`）が理由付きで代わりを果たす。過去の証跡CSVとの互換のため値は残す。
- 「AIで再確認」ボタンはS4に含めず、別PRにする。構造変更1の検証を軽くするため。
- 再導出の時間の上限は300ミリ秒とし、遠野市の最長ページで計測する。超えた場合は部分木への絞り込みを次段で検討する。

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

**既知の残り**。
背景色と `table.caption` の両方を採用すると、`table.caption` の変換後HTMLには `bgcolor` が残る。
最終HTMLからは `DEPRECATED_PRESENTATION_ATTRIBUTES` の除去で消えるため出力は正しいが、作業中のプレビューには残って見える。
候補の `after_html` が元のHTMLから作られ、決定後に作り直されないため（2章の問題1）で、構造変更1の `rebuild` 操作で解消する。このPRでは直さない。

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

判定は次の順に行う。順序が重要で、1列目の `th` 率を先に見る。

| 順 | 条件 | 結果 |
| --- | --- | --- |
| 1 | `thead` が無く、1列目の `th` 率が50%以上 | 列見出し行を作らない。`bodyStartIndex: 0`。各行の1列目は `scope="row"` の `th` にする（現状の本体処理がそうしている） |
| 2 | `thead` がある、または1行目が見出しらしい、または1行目が全て `th` | 1行目を列見出しにする（現状どおり） |
| 3 | 上記以外 | 列見出し行を作らない。候補の `message` に「列見出しの行がありません。必要なら見出し行を追加してください」を添える（この候補は元から `requiresHumanReview: true`） |

順序を逆にして条件2を先に置いてはいけない。
`firstRowHeaderLike` は「2列以上あり、どのセルも28文字以下で文末記号で終わらない」だけで立つ弱い判定で、課名・電話番号・所在地が並ぶ普通のデータ行にも当たる。
条件2を先に置くと、1列目が `th` の連絡先一覧で1行目が列見出しへ繰り上がり、データ行が1つ消える。
佐賀市 sg00761（26個の連絡先表）で `th` 165→139、`scope="row"` 88→61 になることを確認済み。

`syntheticTableHeaderCells()` は削除する。
`looksLikeContactDataTable()` は削除しない。
`shouldPreserveAsDataTable()`（データ表として維持するかの判定）、`dataTableSemanticsConfidence()`（確信度）、`isSingleRecordContactDataTableProfile()`（1行だけの連絡先表のキャプション導出）の3か所で使われており、どれも列見出しの文言を作る処理ではない。
`syntheticTableHeaderCells()` からの参照だけを断つ。
`headerTexts` が空になるため、`normalizeGenericFileLinkText(clone, headerTexts[index])` は見出しが無いときに何もしないことを確認する。
`lib/sagaAutoFix.js` の複製も同じ規則に直す。

**構造変更1との関係**。
独立。先に実装してよい。

**検証**。
`test/goal2-output` に、1列目 `th` の3行の表を入れ、`table.caption` の変換後HTMLに `<thead>` が無く、`<tr>` が3つであることを確認する。
`npm run test:saga-gold` を変更前後で実行する。
指標一致は652→648に下がるが、これは正解データ側の問題で、退行した指標は0件である。
差が出るのは佐賀市 sg00761 の1ファイルだけで、`gold_html` が `<thead><tr><th scope="col">&nbsp;</th><th scope="col">電話番号</th><th scope="col">メール</th></tr></thead>` を26個含んでいる。
「電話番号」「メール」は `old_html` のどこにも無い。
この gold は先行実装（`koteikara/gemini-a11y-agent`）の出力をもとにしており、`inferSyntheticHeaderCells()` はこの gold を再現するために書かれていた。
gold に合わせて捏造を戻すことはしない。

### 4.3 指摘12 ファイルアイコンに画像名の候補が出る

**現象**。
`alt=""` の小さなアイコン画像に「画像の代替テキストが未設定です」の候補が出て、`alt="画像内容を具体的に入力"` を提案する。再現済み。

**原因**。
`collectImageCandidates()`（`app.js:2340`）が、`alt` が `null` か空のすべての `img` を候補にする。
装飾画像を除外する条件が無い。
`alt=""` は装飾画像として正しい状態で、miCheckerも指摘しない。

**変更**。
`decorativeIconEvidence(img)` を足す。
真偽ではなく、装飾と判断した**根拠**を返す（`"size" | "filename" | "link-context" | null`）。
根拠によって確信度が違うため、呼び出し側で扱いを分けられるようにする。

まず、装飾ではありえない形を先に除く。

- 親に `a` があり、その `a` のテキスト（画像を除く）が空のときは `null`。
  画像だけのリンクでは画像がリンクの名前そのものなので、`alt=""` にするとアクセシブルネームの無いリンクになる。
  大きさやファイル名がアイコンらしくても、装飾とはみなさない。

そのうえで、次の順に判定する。

| 根拠 | 条件 |
| --- | --- |
| `"size"` | `width` と `height` の属性がともに32以下 |
| `"filename"` | `src` のファイル名が下の `DECORATIVE_ICON_SRC_PATTERN` に一致 |
| `"link-context"` | 親に `a` があり、その `a` のテキスト（画像を除く）が空でなく、`a` の中の `img` がこの1枚だけで、かつ `width` か `height` が明示されていて64を超えることがない |

`"link-context"` は弱い根拠である。
寸法もファイル名も装飾だとは言っておらず、`width`/`height` を持たない写真もここに入る。
CMSが出すHTMLでは寸法の無い画像が普通にあるため、この根拠だけのときは `alt=""` の提案を `requiresHumanReview: true`、`confidence: "medium"` にする。
`"size"` と `"filename"` は従来どおり `requiresHumanReview: false`、`confidence: "high"`。

`alt=""` のときに候補を出さない扱いは、3つの根拠で共通にする（既にある状態を悪くしない）。

ファイル名の判定は、語の強さで3群に分け、群ごとに許す形を変える。

| 群 | 語 | 許す形 | 拡張子 |
| --- | --- | --- | --- |
| 強い語 | `icon` `ico` `arrow` `bullet` `shim` `spacer` `blank` `dot` `mark` `btn` `button` | 接頭辞・接尾辞どちらも可（`icon_excel.gif`、`pdf_icon.gif`） | gif/png/svg/jpg |
| ファイル種別の語 | `pdf` `xls` `xlsx` `excel` `doc` `docx` `word` `ppt` | 基底名そのもの、または数字だけを伴う（`pdf.gif`、`pdf16.gif`） | gif/png/svg |
| 一般語 | `new` `mail` `tel` `link` `ext` `external` `window` `file` | 基底名そのものだけ。`^` か `/` の直後に限る（`new.gif` は可、`photo_new.jpg` は不可） | gif/png/svg |

```js
const DECORATIVE_ICON_SRC_PATTERN = new RegExp(
  "(?:(?:^|[\\/_-])(?:icon|ico|arrow|bullet|shim|spacer|blank|dot|mark|btn|button)(?:[_-][\\w-]*)?\\.(?:gif|png|svg|jpg)" +
    "|(?:^|[\\/_-])(?:pdf|xlsx?|excel|docx?|word|ppt)\\d{0,3}\\.(?:gif|png|svg)" +
    "|(?:^|\\/)(?:new|mail|tel|link|ext|external|window|file)\\d{0,3}\\.(?:gif|png|svg))$",
  "i"
);
```

群を分ける理由は、語を足すほどファイル名だけでの誤判定が増えるためである。
すべての語に「語のあとは区切りが来れば何でも可」を許すと、`pdf_thumbnail.jpg`（チラシPDFのサムネイル）や `new_building.jpg`（新庁舎の写真）といった、自治体サイトに普通にある名前の内容画像が `"filename"` に入り、確認不要で `alt=""` になる。
ファイル種別の語で `.jpg` を外しているのも同じ理由で、`.jpg` のファイル種別アイコンは稀で、サムネイルの可能性の方が高い。

`ext_link.gif`（外部リンクのアイコン）はこの判定では拾えず、根拠 `"link-context"`（確認必要）に落ちる。
`alt=""` の提案自体は出るため、実害は確認が1回増えることだけである。

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
`test/goal2-output` に次の4件を足す。

- `alt=""` のアイコンでは候補が出ない
- `alt` 属性の無いアイコンでは `alt=""` の提案が出る
- `<a href="/next"><img src="/images/icon_arrow.gif" width="16" height="16"></a>`（画像だけのリンク）では `alt=""` を提案しない
- `<a href="/event"><img src="/photos/matsuri.jpg" width="640" height="480">秋祭りの案内</a>` では `alt=""` を提案しない
- `<a href="/event"><img src="/photos/matsuri.jpg">秋祭りの案内</a>`（寸法なし）では `alt=""` の提案が `requires_human_review: true` になる
- `<a href="/a.pdf"><img src="/images/pdf.gif">申請書</a>`（寸法なしのファイル種別アイコン）は `requires_human_review: false` のまま
- 内容のある写真をファイル名だけで装飾と判定しない（`document_scan.jpg`、`markets.jpg`、`pdf_thumbnail.jpg`、`new_building.jpg`、`mail_center.png`、`doc_scan.jpg`、`photo_new.jpg`、`word_cloud.png`、`file_photo.jpg`、`link-banner.jpg`）
- ファイル名で装飾と分かるアイコンは確認不要のまま（`pdf.gif`、`pdf16.gif`、`mail_icon.png`、`img_pdf.gif`、`icon_excel.gif`）

### 4.4 指摘2 表のキャプションがページごとに違う

**現象**。
同じ構造の表でもページごとに違うキャプションが提案され、シリーズで揃わない。

**原因**。
`dataTableCaptionText()`（`app.js:4437`）は、直前の見出しが無いとき、1行目のセルを連結して「の詳細」を付ける（`app.js:4452`）。
「名称 遠野市役所 0198-62-2111 平日のみの詳細」のようになり、行の中身の差でキャプションが変わる。
見出しがあるときの「見出し＋一覧」は、見出しが違えば違って当然なので、不具合ではない。
シリーズで文言を揃える仕組みが無いのは別の機能要望である（対象外）。

**変更**。
1行目連結のフォールバックを削除し、`genericTableCaption`（「表の詳細」）へのフォールバックも削除する。
見出しからも導けないときは、キャプション文言を空にする。
`buildDataTableSemanticsHtml()` は文言が空なら `<caption>` 要素自体を作らないため、`<caption></caption>` は出ない。
`lib/sagaAutoFix.js` の `inferCaptionFromTable()` にも同じフォールバックがあるので、同じ規則に直す。

「文言を調整」でしか採用できないようにするのは、**キャプション専用の候補**（「表にキャプションがありません」、`patch` が `insert-caption`）に限る。
この候補は元から `confidence: "low"` と `requiresHumanReview: true` を持つので、`shouldRequireEditedAdoption()`（「要確認かつ確信度低かつ簡易編集あり」）が採用を止める。
ただし `quickEditConfig()` は `after_html` に `<caption>` があるときしか簡易編集を返さないため、キャプションを作らなくなるとこの候補には簡易編集が出ない。
`rule_id` が `table.caption` で `after_html` に `<table>` がある候補に、`mode: "insert-caption"` の簡易編集を足す。
`buildQuickEditedAfterHtml()` にも同じモードを足し、入力された文言で `<caption>` を作って先頭に差し込む。

**「データ表として維持し構造を整える」の手段は確信度を下げない。**
下げると `shouldRequireEditedAdoption()` が採用を止め、GOAL1の一括採用では代わりに「箇条書きに変換する」が採用されて、行と列の関係を持つ表が解体される（安城市の入れ子の表 n0012 で確認）。
この手段はキャプション以外に `thead`・行見出し・`scope` も付けるので、キャプションが空でも元より悪くならない。
キャプションの文言そのものは専用候補で人が入れる。

**PR-2.5 でこの前提は変わった。**
表の構造変換の手段が一括採用と `autoAcceptSafe` の対象から外れたため、確信度を下げても「箇条書きに変換する」が代わりに自動採用されることはなくなった。
構造の手段でもキャプションを入れないと採用できないようにする揃え方は取れるが、このPRでは実装していない（PR-2.6 の候補）。
実装するなら、確信度を下げる以外に、`shouldRequireEditedAdoption()` が止めた手段が画面の修正方法グリッドでどう見えるか（他の手段だけが選べる状態になるか）を確かめる必要がある。

**構造変更1との関係**。
独立。

**検証**。
`test/goal2-output` に次を足す。

- 見出しの無い表で、`table.caption` の変換後HTMLに `<caption>` が無いこと（空の `<caption></caption>` も無いこと）
- キャプション専用の候補が `patch.value` を空にし、`confidence: "low"`・`requiresHumanReview: true` であること
- その候補では採用ボタンが無効で、「文言を調整」で入力した文言が最終HTMLの `<caption>` になること

`npm run test:saga-gold` は動かない。
佐賀市の51ファイルではキャプションがすべて見出しの文脈（`inferContextualDataTableCaption()`・`inferCaptionBefore()`）から決まっており、1行目連結のフォールバックが使われていないため。
変更の前後どちらも21ファイル・81件のキャプションで、gold と同数である。

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
3. `applyCandidatePatch()` に `shift-headings` を足す。`node_ids` の各要素を `renameElement()` で `delta` 分ずらす。IDは保たれるので要素を残すパッチとして扱う（`ELEMENT_REPLACING_PATCH_TYPES` には入れない）。
4. 飛びの検出は、補正候補がある場合は補正後のレベルに対して行う。補正候補が無い場合は現状どおり。
5. GOAL1の一括採用から、この候補を明示的に外す。

`requiresHumanReview: true` にすれば一括採用から外れる、という想定は成り立たない。
`canBulkAcceptCandidate()` は `requires_human_review` を見ておらず、決定済みかどうかと `acceptDisabledReason()`（AI画像名の投入待ちと、文言調整が要る候補）だけで判断する。
`autoAcceptSafe()` のコメントは「not flagged for human review」と書いているが、実際にはそうなっていない。
この食い違いは本書の変更以前からあり、範囲が広いのでここでは直さない。
代わりに `isBulkExcludedCandidate()` を足し、`shift-headings` のパッチを持つ候補を一括採用の対象から外す。
ページ内の見出しをすべて動かす変更なので、元の階層の意図を人が見てから決める。個別の採用は従来どおりできる。

`proposal.after_html` は、対象の見出しを `h3 → h2: 第1章` の形で並べた `<ul>` の表示用HTMLにし、`patch_mode` は `"patch"` とする。
`before_html` は先頭の見出しにする。前後の対比は一覧の各行が持つ。

`currentCandidateAfterHtml()` にも同じ分岐を足す。
修正パネルの修正後欄はこの関数の結果を優先するが、この関数は対象要素だけを複製した `<template>` にパッチを当てるため、`shift-headings` では `node_ids` のうち先頭の見出ししか見つからない。
そのままだとメッセージが「対象4件」なのに画面では1件しか動かないように見え、ページ内の見出しをすべて動かす候補の判断材料にならない。
作業中HTML全体から一覧を組み立てて返す。

`buildPreviewHtml()` も、`shift-headings` のときは `node_ids` のすべてに `goal2-highlight` を付ける。
どの見出しが動くかが一目で分かるようにする。

AIへの補完は、見出しは全件、段落は先頭120件まで（60文字で切る）を渡すようにし、80ブロックの上限を外す。
AIの `heading_level_fixes` は現状どおり個別候補にする。

**構造変更1との関係**。
どちらでも実装できる。
構造変更1の前は、補正候補を却下したときに飛びの候補が補正前提のままになる。
構造変更1の後は、決定のたびに再導出されるので、却下すれば飛びの候補が補正前のレベルで出直す。

**検証**。
`test/goal2-output` に次を足す。

- h3×4で `shift-headings` の候補が1件出て、`node_ids` が4件であること
- 採用後の最終HTMLで4件がh2であること
- h3, h4, h3 の並びで、採用後が h2, h3, h2 であること
- 補正候補があるとき、同じ並びに飛びの候補を重ねて出さないこと
- `autoAcceptSafe()` が補正候補を自動採用しないこと
- 候補の変換後HTMLと、実UIの修正後欄に、対象の見出しが4件とも出ること
- プレビューが対象の見出しを4件とも強調すること

`npm run test:saga-gold` は動かない。
この変更は `public/app.js` の候補生成だけで、saga-goldが使う `lib/sagaAutoFix.js` は別実装であり、そちらは `promoteHeadingsBeforeFirstH2()` で独自に見出しを引き上げているため。

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
