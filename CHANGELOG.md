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

## 2026-07-24: 複雑な画像(チラシ・ポスター等)のAI生成alt文言が「詳細は以下」ルールから外れる不具合を修正

- 背景・目的: ユーザーが公開ページの観光地特集バナー(写真多数配置のポスター画像)を実際にGEMINI_API_KEY有効な環境でGOAL2に解析させたところ、「生成した画像名がルールと逸脱してます」と報告(生成された画像名は「観光地特集のポスター。各地のグルメや景勝地の写真が多数配置。」という内容だった)。KBルール`image/complex-image-report.md`は、グラフ・チラシ・ポスター等の複雑な画像には画像名へ「詳細は以下」を付す必要があると定めている。
- 原因(2点、いずれも独立):
  1. `applyImageAltLlmResult()`(AIのalt_text応答を候補へ反映する処理)が、`image.complex-image-report`候補に対してもAIの`alt_text`をそのまま上書きしていた。機械的な下書き(`generateComplexImageNameDraft`)は「詳細は以下」を正しく付与していたが、AI enrichmentがこれを気にせず上書きするため、AI有効時は常にルール違反の画像名に後退していた。
  2. さらに根本として、この画像は機械的な複雑画像判定(`isComplexImageCandidate`)自体が発火しておらず(alt=""のため`isMicheckerComplexImageAltText`が不成立、かつsrc/alt/captionに「地図」「グラフ」等の既存キーワードが一致しない)、`image.complex-image-report`候補がそもそも生成されていなかった。AIのレスポンススキーマには`is_complex`フィールドが既にあったが、クライアント側でこの値を一切参照していなかった(死んだフィールド)。
- 主な変更内容:
  - `applyImageAltLlmResult()`で、`candidate.rule_id === "image.complex-image-report"`のときに加え、AIが`is_complex: true`と判定した場合も、alt_textへ「詳細は以下」を付与するよう変更(既に含まれる場合は付与しない)。
  - `isComplexImageCandidate()`のキーワード一致リストに「チラシ」「ポスター」「バナー」「flyer」「poster」「banner」を追加(KBルールの例示に合わせた defense-in-depth、AI無効時にも一部のケースで機械的に拾えるようにする)。
- 検証:
  - `node --check public/app.js`成功。`node test/run-tests.js`全テスト成功。
  - Node上でsuffix付与ロジックを直接検証: `image.alt-text`候補+`is_complex: true`、`image.complex-image-report`候補、通常の`image.alt-text`候補(付与しない)、既に「詳細は以下」を含む名前(重複付与しない)の4パターンで期待どおりの結果を確認。
- 関連ファイル: `goal2-app/public/app.js`

## 2026-07-24: GOAL3本文抽出でheader内のバナー画像が消える不具合を修正 + デプロイ確認用のバージョン表示を追加

- 背景・目的: ユーザーが実際に公開したページ(`docs/tourism-spots-feature.html`、`<header><img ...></header><main>...</main>`という構成)をGOAL3(本文抽出)で取得したところ、「本文抽出した際に画像が欠落する」と報告。また「デプロイが最新かわかりにくいのでバージョン情報をページのどこかに入れよう」との提案もあった。
- 画像欠落の調査・原因: PR#98(`removeEmptyElements()`のimg自己チェック漏れ)とは**別の、2段階の原因**がGOAL3側にあった。
  1. `sanitizeDocument()`が呼ぶ`isLikelyContentBlock()`は、`header`要素をテキスト量(300文字超)だけで判定しており、バナー画像だけで構成されテキストをほぼ持たない`<header>`は常に定型のナビゲーションとして除去されていた。
  2. (1)を個別に直しても、`removeLeadingTemplateFragments()`が呼ぶ`isLeadingTemplateFragment()`に`if (!text) return true`という早期returnがあり、ページ先頭の要素はテキストが無ければ画像の有無を問わず「先頭のテンプレート断片」として無条件に除去されていた。`<header>`は`body`の先頭の子要素にあたるため、(1)を回避してもここで除去されていた。
- 主な変更内容:
  - `isLikelyContentBlock()`に、`<header>`要素かつ十分なサイズの画像を含む場合は保持する分岐を追加(nav/footer/aside/formは対象外のまま、テキスト量のみで判定を継続)。
  - `isLeadingTemplateFragment()`の`if (!text) return true`を、`hasSubstantialImage()`を使った判定に変更(テキストが無くても十分なサイズの画像を含む場合は先頭断片とみなさない)。
  - `hasSubstantialImage(element)`を新設。判定当初は幅80px・高さ40px以上としたが、Playwrightでの回帰確認中に典型的なサイト共通ヘッダーのロゴ(120x40)まで本文画像として拾ってしまうことが判明したため、幅300px・高さ80px以上(サイズ未指定は許容)に調整。ヒーロー・バナー画像相当のサイズのみを対象にし、ロゴ・アイコンとの誤検知を避ける。
  - `dedupeCandidates()`のキーにも画像件数を追加。テキストが同じでも画像件数が異なる候補(画像入りheaderを持つbody候補 vs それを含まないmain候補)を「重複」として黙って一方を捨てないようにする不具合も合わせて修正(この不具合により、(1)(2)を直した直後もまだ画像入り候補が消えていた)。
  - バージョン表示: `goal2-app/public/version-badge.js`を新設。`/build-info.json`(Cloud Runデプロイ時に生成、ローカル開発では存在しないため404で何も表示されない)を読み込み、画面右下に「build: <コミット短縮ID> (デプロイ日時)」を表示する。`index.html`・`goal3.html`・`goal1.html`の3画面すべてに追加。`CLOUD_RUN_DEPLOY.md`のデプロイ手順に、`git rev-parse`等でこのファイルを生成するPowerShellの手順を追記。
- 検証:
  - `node --check public/goal3.js`成功。`node test/run-tests.js`全テスト成功。
  - Playwrightで、実際に公開したページと同じ構成(header内バナー画像+main本文)のHTMLをGOAL3で抽出し、画像を含む「body候補」が推奨候補として生成されることを確認。
  - 回帰確認: ロゴ(120x40)+ナビゲーションリンクを持つheaderでは、リンクの生テキストは従来どおり除去され、ロゴ画像も(閾値調整後は)本文候補に含まれないことを確認。
  - バージョン表示: ローカル開発環境(build-info.json無し)では表示されないこと、`public/build-info.json`を仮生成した状態では画面右下に正しく表示されることを3画面すべてで確認。
- 関連ファイル: `goal2-app/public/goal3.js`、`goal2-app/public/version-badge.js`(新規)、`goal2-app/public/index.html`、`goal2-app/public/goal3.html`、`goal2-app/public/goal1.html`、`goal2-app/public/styles.css`、`goal2-app/CLOUD_RUN_DEPLOY.md`

## 2026-07-22: 「画像: alt・キャプション・複雑画像」サンプルに、文字が書き込まれたバナー画像を追加

- 背景・目的: ユーザーから「画像の中に文字が入っているバナーに対して代替テキストを正しく提供できるか検証したい」とのサンプル追加要望。
- 主な変更内容:
  - `goal2-app/public/images/sample-banner-generated.png`を新規作成。「夏の交通安全運動実施中　7月11日（土）～7月20日（月）」という文言を書き込んだ、青地に黄色縁取りの自治体バナー風の画像(Playwrightでスクリーンショット生成、600×180px)。
  - 既存の「画像: alt・キャプション・複雑画像」サンプル(`id: "images"`)に`<img src="/images/sample-banner-generated.png" alt="" width="600">`を追加(alt=""で、実際は情報を持つ画像なのに空altという実務でよくある誤りを再現)。
  - `generateImageNameDraft()`の既知ドラフト一覧に`sample-banner-generated.png`のエントリを追加し、`GEMINI_API_KEY`未設定時のPoCフォールバック名("夏の交通安全運動実施中　7月11日（土）～7月20日（月）")を用意(他4件の既存サンプル画像と同じ扱い)。
- 検証:
  - `node --check public/app.js`成功。`node test/run-tests.js`全テスト成功。
  - Playwrightで「画像」サンプルを読み込み、バナー画像が正しく配信される(HTTP 200)こと、`image.alt-text`候補(cand_005)としてバナー画像が候補一覧に追加されることを確認。
- 既知の制約(ユーザーへの申し送り): `image.avoid-text-as-image`(画像内埋め込み文字の実LLM vision検出)や、Gemini vision経由の`image.alt-text`強化は、画像バイトを実際にサーバー側で取得できる場合のみ動作する。このサンプルの「旧ページURL」は`https://www.example-city.jp/...`という実在しないプレースホルダドメインのため、画像取得は必ず失敗し、AI vision判定は実行されない(既存の他4サンプル画像も同様の制約を受けている、今回新規に生じた制約ではない)。`GEMINI_API_KEY`設定時の実際のvision判定を確認したい場合は、実在する旧ページURL(例: 尼崎市サンプルページ等、実際にバナー画像を含む本物のページ)で検証することを推奨。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/public/images/sample-banner-generated.png`(新規)

## 2026-07-22: GOAL3本文抽出で画像が丸ごと消える不具合を修正 + 相対パスの画像を絶対パスへ変換

- 背景・目的: ユーザーから「本文抽出の際に画像パスなどが相対パスで記載されている際に認識できなくなってしまうので絶対パスに置き換えるようにしてほしい」との要望(例示ページ: 尼崎市 交通案内ページ)。調査のため実際の相対パス画像を含むHTMLでGOAL3の抽出結果をPlaywrightで検証したところ、要望どおりの絶対パス化を実装する過程で、**それ以前の、より重大な既存バグ**を発見した: `removeEmptyElements()`(空要素除去)が、`<img>`(および`<iframe>`/`<table>`/`<video>`/`<audio>`)要素を、`<p>`等で囲んでいても囲んでいなくても、**常に「空要素」として除去してしまっていた**。原因は、この関数の保護判定が`element.querySelector("img,iframe,table,video,audio")`(子孫にこれらを含むかどうか)のみをチェックしており、要素自身がこれらのタグである場合の自己チェック(`element.matches(...)`)が欠落していたため。`<img>`要素はテキストを持たない(`textContent`が空)ため、この判定に無条件で引っかかり、GOAL3で本文抽出したHTMLから画像が常に消えていた(サンプル入力ではこれまで裸のimgタグを含む実データでの検証機会が少なく、見過ごされていた)。
- 主な変更内容:
  - `goal2-app/public/goal3.js`の`removeEmptyElements()`に、`element.matches("img,iframe,table,video,audio")`の自己チェックを追加(該当要素自身は無条件で保護し、以後のtextContent/子孫チェックをスキップ)。
  - 新規`absolutizeResourceUrl(rawUrl, baseUrl)`・`absolutizeSrcsetValue(srcset, baseUrl)`・`absolutizeImageUrls(root, baseUrl)`を追加。`img[src]`・`img[srcset]`・`source[srcset]`を、旧ページURL(`旧ページURL`欄の入力値、GOAL1バッチ処理では`page.url`)を基準に絶対URLへ書き換える。`data:`/`mailto:`/`tel:`/`javascript:`/`#`始まりの値、および旧ページURL未入力時は対象外(元の値のまま)。
  - `cleanContentClone()`・`buildCandidate()`・`buildContentCandidates()`・`extractCandidates()`・`window.goal3Engine.extract()`に`baseUrl`を伝播。`goal2-app/public/goal1.js`の`window.goal3Engine.extract()`呼び出しに`page.url`を追加。
- 検証:
  - `node --check public/goal3.js public/goal1.js`成功。`node test/run-tests.js`全テスト成功。
  - Playwrightで、裸の`<img>`・`<p>`で囲んだ`<img>`の両方を含むHTMLをGOAL3で抽出し、修正前は画像が完全に消えていたのが修正後は正しく残ることを確認。あわせて、ルート相対パス(`/foo/bar.jpg`)・相対パス(`img/bar.png`、`srcset`含む)・プロトコル相対(`//cdn.example.jp/x.png`)が旧ページURLを基準に正しい絶対URLへ変換され、既に絶対URLの値・`data:`URIは変更されないことを確認。
- 関連ファイル: `goal2-app/public/goal3.js`、`goal2-app/public/goal1.js`

## 2026-07-22: 曖昧な見出し検知(html-structure.heading-content-quality)で「修正後HTML」が変わらず分かりにくい点にUI注記を追加

- 背景・目的: ユーザーから、AIが曖昧な見出し(例:「注意！」)を検知した候補で「修正前HTML」と「修正後HTML」が完全に同一のまま表示され、「これもおかしい」との指摘があった。一時、「`<span>`を太字と誤判定しているのでは」との仮説も検討したが、AIが返した実際の理由(reason)を確認したところ「見出しの文言が抽象的で、直後の段落の具体的な内容が不明瞭」という正当な判定であり、span/太字とは無関係と判明した。
  - 根本の設計: `html-structure.heading-content-quality`ルール(見出しの内容と太字利用の区別)は、機械判定(`collectHeadingContentQualityCandidates`、極端に短い/記号のみの見出し)・AI判定(`applyHeadingReviewResult`の`vague_headings`)のどちらも、意図的に代替の見出し文言を提案しない(`patch_mode: "none"`、`afterHtml`は`beforeHtml`と同一)。理由の判断に高い文脈理解が必要なため、AIに文言まで生成させず人間が判断する設計だが、UI上「修正後HTML」欄が「修正前」と同じテキストのまま表示されるため、何も変わっていないように見えて分かりにくかった。
  - ユーザーに改善方向(AIに代替文言も提案させる/UIで「AIは文言を提案しない」旨を明示する)を確認したところ、後者を選択。
- 主な変更内容:
  - `goal2-app/public/index.html`の`#decisionFold`内、`#afterHtml`テキストエリアの直後に`#afterHtmlNoAiSuggestionNote`(既定で`hidden`)を追加。
  - `renderDetail()`で、選択中の候補(`chosenMethodCandidate`)の`rule_id`が`html-structure.heading-content-quality`かつ`proposal.patch_mode`が`"none"`のときだけ、この注記の`hidden`を解除するよう変更。
- 検証:
  - `node --check public/app.js`成功。`node test/run-tests.js`全テスト成功。
  - Playwrightで、記号のみの見出し(`<h2>※</h2>`)を含むカスタムHTMLを解析し、「見出しの内容と太字利用の区別」候補選択時のみ注記が表示され、他の候補(`html-structure.heading-order`・`text.note-symbol`)選択時は表示されないことを確認。
- 関連ファイル: `goal2-app/public/index.html`、`goal2-app/public/app.js`

## 2026-07-22: miChecker指摘対応のみモードでも、enrichment由来の非対応ルール候補が漏れる不具合を修正

- 背景・目的: 直前の「見出し提案(AI)が表セル内の段落を見出し要素に変換してしまう不具合」修正をユーザーに説明したところ、「miChecker版もこのように修正されてしまうようです」と、`<p><strong>連絡先</strong></p>` → `<h4>連絡先</h4><p><strong>連絡先</strong></p>`という同じ壊れ方をする例を提示された。「miChecker指摘対応のみ」モードは`html-structure.heading-required`のようなmichecker_check_idsを持たないルールの候補を表示しない設計のため、本来この症状はKBモードだけの問題のはずだったが、実際にはmiCheckerモードでも起きる別のバグがあることが分かった。
- 原因: `runAnalysis()`は、`ruleScopeMode === "michecker"`のとき`generateCandidates()`直後の`reviewItems`を`isMicheckerRelevantRule()`でフィルタしていたが、そのフィルタは**enrichment(AI呼び出し)より前の1回だけ**実行されていた。`enrichHeadingReviewWithLlm`(見出し提案)・`enrichAvoidTextAsImageWithLlm`(画像内テキスト検出)・`enrichAsciiArtWithLlm`(顔文字検出)は、既存候補の書き換えだけでなく`items.push()`で**新規候補を追加**することがあり、これらの新規候補はmiCheckerモードのフィルタを一切通過していなかった。結果、`html-structure.heading-required`のようなmiChecker非対応ルールの候補が、AIのenrichmentを経由することでmiCheckerモードでも表示されてしまっていた。
- 主な変更内容:
  - `runAnalysis()`で、`ruleScopeMode === "michecker"`時のフィルタを**enrichment前後の2箇所**に適用するよう変更。前段(既存どおり)はenrichmentの呼び出し対象・LLM呼び出し件数を絞るための最適化として維持し、後段(新規追加)はenrichmentが新規に追加した候補も含めて最終的な候補集合からmiChecker非対応ルールを確実に除外する。
- 検証:
  - `node --check public/app.js`成功。`node test/run-tests.js`全テスト成功。
  - Playwrightで`tables`サンプルをKBモード(31件・13ルールID)とmiCheckerモード(23件・9ルールID)の両方で解析し、miCheckerモードの結果に`html-structure.heading-required`が含まれないこと、両モードとも候補生成でエラーが発生しないことを確認。
  - AI enrichmentが実際に新規候補を追加するケース(GEMINI_API_KEY有効時)での二重フィルタの動作は、ローカル環境にAPIキーが無いため未検証(フィルタのタイミング変更自体の正しさとしては、既存のPlaywright検証および既存テストスイートの全件成功で担保)。
- 関連ファイル: `goal2-app/public/app.js`

## 2026-07-22: 見出し提案(AI)が表セル内の段落を見出し要素に変換してしまう不具合を修正

- 背景・目的: PR#95提示後、ユーザーから「安城市のサンプルページで表を修正したのに見出しの設定の修正が完了するまで全体が完了にならないのはおかしくないか」との指摘があり、当初は「ページ内の全候補に決定を下すまで完了にならない」という既存の完了判定仕様(`renderCandidates()`の`done = total > 0 && unresolved === 0`)の説明で対応したが、ユーザーから「表内のことでは」との再指摘、続けて動画とサンプルHTML原文の提示があり、実際には**表のth要素(列見出しセル)の中身が個別にh4見出しへ変換される提案**(「名称」→`<h4>名称</h4>`、「連絡先」→同様、等)が発生していたことが判明した。
- 根本原因: `enrichHeadingReviewWithLlm()`がAIへ渡す文書アウトラインを構築する`buildHeadingReviewOutline()`が、`h1〜h6,p`要素を**祖先を問わず**収集していた。ユーザーの実データでは表のth要素が`<th scope="col"><p><strong>名称</strong></p></th>`のように内部に`<p>`要素を持つ構造になっており、この`<p>`がアウトラインに含まれてしまっていた。AIが「この段落の直前に見出しを追加すべき」と提案すると(`missing_headings`)、`<h4>名称</h4><p>名称</p>`のようにth要素の内部へ新しい見出し要素を挿入する候補が生成され、表構造を破壊し、同じテキストが重複する見出しをページのアウトラインに大量発生させていた。同様の問題は機械的な検出(`collectHeadingCandidates`内のp/div短文マッチャー、担当課等の固定キーワード)にも潜在的に存在した(現行のキーワードリストには「名称」等は含まれないため今回は未発火だったが、将来別のキーワードが表セル内に出現すれば同じ形で発火しうる構造的な欠陥だった)。
- 主な変更内容:
  - `buildHeadingReviewOutline()`で、`element.closest("th,td")`が真の要素(表セル内の要素)をアウトライン収集から除外。
  - `collectHeadingCandidates()`内のp/div短文マッチャーでも同様に、`element.closest("th,td")`が真の要素を対象外にする早期returnを追加。
  - 表側の見出し関連(th要素そのものの整備)は、既存のth/scope専用ルール(`table.th-scope`)が別途担当するため、この変更で対応漏れは生じない。
- 検証:
  - `node --check public/app.js`成功。`node test/run-tests.js`全テスト成功。
  - ユーザーが貼り付けた実際のサンプルHTML(安城市 指定緊急避難場所一覧、th要素内にpタグを持つ表を含む)を`window.goal2Engine.analyze()`で直接解析し、th要素内の「名称」「連絡先」等を対象にした見出し変換候補が生成されないこと、既存の`table.th-scope`候補(scope属性欠如)は引き続き正しく生成されることをPlaywrightで確認。
  - AI(Gemini)による`missing_headings`提案自体は`GEMINI_API_KEY`未設定のローカル環境では実行されないため、AIが実際に修正後の提案を返さないことまでは今回のセッションでは検証できていない(アウトラインへ渡す入力から該当要素が除外されることのみ確認)。本番環境(Cloud Run、AI有効)での再デプロイ後の確認を推奨。
- 関連ファイル: `goal2-app/public/app.js`

## 2026-07-22: 新規ルールtable/simple-structure.md追加、M2/M4のルール解説をこの一般ルールへ差し替え

- 背景・目的: 直前のPR#95(M2/M4のルール解説をth-scopeへ差し替え)提示に対し、ユーザーからScience Tokyo(旧東京科学大学)のウェブアクセシビリティサポートブック内「表組み(テーブル)における配慮」ページのURLとともに、「結合セルはできるだけ単純な構造にする」というガイドラインを採用できないか、との提案があった。同ページ本文(ユーザーが直接貼り付けたもの。プロキシのドメインポリシーにより本セッションからは直接フェッチ不可)は、表組みの3つのポイント(1. できるだけ単純な構造にする、2. 行・列に見出しをつける、3. 表組み以外の表現を検討する)を挙げており、特に1番目が「セルの結合や入れ子は複雑になるため避け、結合を使う場合は読み上げ確認をする」という内容で、M2(複数表への分割)・M4(結合解除フラット化)の実際の動作(表を維持したまま結合を解消・分割して単純化する)と正確に一致していた。th-scope(PR#95)はM2/M4が副次的に行うscope属性設定への言及に留まっていたのに対し、この新ルールは両手法の設計意図そのものを説明できる。
- 主な変更内容:
  - `a11y-migration-kb/rules/table/simple-structure.md`を新規作成。`origin: external-guideline`(内部マニュアル`manual`・miChecker`michecker`のいずれでもない出典を明示する新しい値)、`resource`に該当ページのURLを設定。本文はユーザーが貼り付けた原文を要約する形で記載し、M2(分割)・M4(フラット化)それぞれに対応する例を2件収録。
  - `a11y-migration-kb/rules/table/index.md`に追記。
  - `planTableTreatments()`のM2(`buildSplitMethod`)・M4(`buildFlattenMethod`)の`ruleId`を、PR#95の`"table.th-scope"`から`"table.simple-structure"`へ変更。
  - `a11y-migration-kb/tools/okf2jsonl.py --bundle . --out build/rules.jsonl`でJSONLを再生成し、`goal2-app/data/rules.jsonl`へコピー(運用手順どおり)。
  - 作業中、Editツールの`replace_all`で`ruleId: "table.th-scope"`という文字列を一括置換した際、無関係な既存のth-scope検出候補(`collectTableHeaderScopeCandidates`・`collectThLayoutPatternCandidate`・`collectThlessDataTableFallbackCandidate`内の6箇所)まで誤って`table.simple-structure`に書き換わっていたことに気づき、対象2箇所(M2/M4)のみ残して6箇所を`table.th-scope`に戻した。教訓: 複数箇所に同一の短い文字列が存在する場合、`replace_all`は意図しない箇所まで書き換えるリスクがあるため、対象を一意に絞れる周辺コンテキストを含めて置換するか、置換後に必ず`grep`で全箇所を確認する。
- 検証:
  - `node --check public/app.js`成功。`node test/run-tests.js`全テスト成功。
  - Playwrightで、候補「先頭の結合セルが見出し用途に見えます」をM4に切り替え、ルール解説ポップアップが「表組みの単純な構造」(出典: 該当URL)に変わり、本文がM4の実際の動作と整合することを確認。あわせて、既存のth-scope検出候補(「表の見出しセル(th)とscope属性」)のポップアップが誤って書き換わっていないことも確認。
- 関連ファイル: `a11y-migration-kb/rules/table/simple-structure.md`(新規)、`a11y-migration-kb/rules/table/index.md`、`goal2-app/public/app.js`、`goal2-app/data/rules.jsonl`、`a11y-migration-kb/build/rules.jsonl`

## 2026-07-22: 表修正手段(M2分割/M4フラット化)のルール解説がテーブルの実際の結合分類とずれる不具合を修正

- 背景・目的: PR#91/#92/#93で「ルール解説ポップアップが選択中の修正方法と食い違う」不具合を修正したはずだったが、ユーザーが追加のスクリーンショット(cand_001、rule_id `table.cell-merge-layout`、修正方法1件のみ「結合セルを解除してフラットな表に整える」)で「修正されていなさそう」と再報告。調査の結果、PR#91-93はポップアップが参照する候補オブジェクトのルーティング(どの候補を見せるか)は正しく直っていたが、その候補オブジェクト自体が持つ`rule_id`が依然として不正確なケースが残っていた。具体的には`planTableTreatments()`内のM2(複数表へ分割)・M4(結合解除フラット化)が、その表の実際の結合分類(`classifyMergedCellTable()`が返す見出し/概要/注記/レイアウト等の判定)を無視し、`rule_id: "table.cell-merge-layout"`(レイアウト用途)を無条件に固定していた。このため、例えば見出し用途の結合セル(候補「先頭の結合セルが見出し用途に見えます」、本来の分類は`table.cell-merge-heading`)でM4(フラット化)を選ぶと、ポップアップは無関係な「セル結合①レイアウト用途」(表を画像2枚並びに置き換える、という助言)を表示していた。これはセッション冒頭でユーザーが最初に報告したのと同種の不一致で、PR#91-93では対処しきれていなかった根本原因。
- 主な変更内容:
  - `collectTableCandidates()`が`classifyMergedCellTable()`の結果(`mergeRule`)を`planTableTreatments(table, mergeRule)`に渡すよう変更。
  - `planTableTreatments()`内でM2(`buildSplitMethod`)・M4(`buildFlattenMethod`)の`ruleId`を、`mergeRule?.ruleId || "table.cell-merge-layout"`(分類が取れた場合はその分類、取れない場合のみ従来どおりレイアウト用途にフォールバック)に変更。
  - 上記に伴い、`fixMethodDescription()`・`fixMethodBadge()`内でM2(分割案)を判定していた`rule_id === "table.cell-merge-layout" && 生成後HTMLに表が2つ以上`という間接的な判定を、M4等と同様の`method_label === "意味単位ごとに複数の表へ分割"`という直接判定に置き換え(rule_idが表の分類によって変動するようになったため、旧判定はM2を検出できなくなる)。
- 検証:
  - `node --check public/app.js`成功。`node test/run-tests.js`全テスト成功(既存サンプルの候補件数に変化なし、rule_idの値のみ表の分類に応じて変わる)。
  - Playwrightで`tables`サンプルの候補「先頭の結合セルが見出し用途に見えます」(`table.cell-merge-heading`)を選択し、修正方法をM4(結合セルを解除してフラットな表に整える)に切り替えてルール解説ポップアップを確認したところ、タイトルが「セル結合②見出し用途」(修正前は誤って「セル結合①レイアウト用途」)に正しく変わることを確認。
- 関連ファイル: `goal2-app/public/app.js`

## 2026-07-22: 表修正手段(M2分割/M4フラット化)のルール解説をcell-merge-N系用途分類から最も近い一般ルール(th-scope)へ差し替え

- 背景・目的: 直前のPR#94(M2/M4のルール解説をテーブルの実結合分類に連動させる修正)をマージした直後、ユーザーが再検証し「まだ修正されていません」と報告。原因を再調査したところ、PR#94はcand_001のような**分類不明(classifyMergedCellTable()が確信度lowの汎用「レイアウト用途」を返す)ケースには何も変化を与えていなかった**ことが判明した。より根本的には、M2(複数表へ分割)・M4(結合解除フラット化)はいずれも「表を維持したまま結合だけを解消する/意味単位に割る」という、公式マニュアルのどのcell-merge-N(見出し/概要/注記/レイアウト/●印/添付ファイル)個別ルールとも一致しないこのツール独自の技術的手段であり、そもそもどの用途分類のルール文書を紐付けても内容の食い違いが生じる構造だった(例: 「レイアウト用途」ルールの正式な指示は「表を使わず画像2枚並びで再現する」だが、M4は逆に表を維持したまま結合だけ解除する)。この設計判断についてユーザーに選択肢(ボタン非表示/矛盾を注記として明示/最も近い一般ルールへ差し替え)を提示し、「最も近い一般ルールに差し替える」を選択された。
- 主な変更内容:
  - `planTableTreatments()`のM2(`buildSplitMethod`)・M4(`buildFlattenMethod`)の`ruleId`を、PR#94で導入した表の結合分類連動(`mergeRule?.ruleId`)から、固定の`"table.th-scope"`へ変更。`collectTableCandidates()`から`planTableTreatments()`への`mergeRule`受け渡しは不要になったため削除(呼び出しを`planTableTreatments(table)`に戻す)。
  - `table.th-scope`を選んだ理由: M2(`splitMergedRowsIntoTablesHtml`)・M4(`buildFlattenedTableHtml`)はいずれも実際に見出しセルへ`scope="col"`/`scope="row"`を設定する変換を行っており、`th-scope.md`の内容(データテーブルの見出しセルにはthを使いscope属性で方向を明示する)と技術的に一致する。またth-scope.mdの本文には「結合がある場合はセル結合ルール(cell-merge-*)に沿って表を崩す・分割することを先に検討する」という一文が既にあり、cell-merge系との関係も自然に示せる。
- 検証:
  - `node --check public/app.js`成功。`node test/run-tests.js`全テスト成功。
  - Playwrightで`tables`サンプルの候補「先頭の結合セルが見出し用途に見えます」をM4(結合セルを解除してフラットな表に整える)に切り替え、ルール解説ポップアップのタイトルが「表の見出しセル(th)とscope属性」に変わり、本文が「rowspan/colspanを解除し...scope属性を設定する」というM4の実際の動作と矛盾しない内容になることを確認。
- 関連ファイル: `goal2-app/public/app.js`

## 2026-07-22: 表修正手段(M2分割/M4フラット化)のルール解説がテーブルの実際の結合分類とずれる不具合を修正(PR#94、その後PR#95で再修正)

- 背景・目的: `goal2-app/TABLE_FIX_METHODS_INSTRUCTIONS.md`の最終ステージとして、全サンプルでの手段件数・変換品質の総括検証と、作業者向けドキュメントの整備を行った。これによりPR-T1(複数手段化の骨格)〜T4までの表修正手段メニュー拡張プロジェクトが完了した。
- 主な変更内容:
  - `goal2-app/WORKER_GUIDE.md`に「表の直し方が複数あるときの選び方」節を新設。M1〜M6の6手段を、rule_idやconfidence等の内部用語を使わず、作業者が実際の表を見て判断するための目安として表形式で整理した(例: 「データ表として維持し構造を整える」→表として読める行・列データがある場合、「表をやめて見出し・段落・画像配置へ解体」→レイアウト目的だけで表が使われている場合、など)。
  - 全7サンプル(procedure-overview/images/tables/links-text/iframe/goal3-hirosaki-news2019/anjo-evacuation-shelters)を対象に、表修正手段(M1〜M6)候補の総件数・空HTML件数・`<dl>`混入件数をPlaywrightで一括検証。異常ゼロを確認。
- 検証:
  - `node --check`成功。`node test/run-tests.js`全テスト成功。
  - `tables`サンプルでは7つの表に対し合計17件の手段候補が生成され、1表あたり最大5件の手段(候補一覧上は th-scope 等の他ルールも合わせ最大9件)が並ぶことを確認。全17件で出力HTMLが空になるケース・`<dl>`混入ゼロ。
  - 結合セルを含む表(cand_019「先頭の結合セルが見出し用途に見えます」)で、9件の代替手段(推奨のセル結合再構成案・表解体・データ表維持・結合解除フラット化・箇条書き化・1行ずつ見出し展開・th/scope修正3件)が実際に画面へ表示されることをスクリーンショットで確認。
- 関連ファイル: `goal2-app/WORKER_GUIDE.md`
- 関連ドキュメント: `goal2-app/TABLE_FIX_METHODS_INSTRUCTIONS.md`(全ステージ完了)

## 2026-07-22: 表修正手段メニューをPR-T3(M5: 箇条書き化/M6: 見出し・段落展開)で拡張

- 背景・目的: `goal2-app/TABLE_FIX_METHODS_INSTRUCTIONS.md`のPR-T3として、列数が少ない表を箇条書きへ変換する手段(M5)と、行見出しを持つ表を1行=1項目の見出し+段落へ展開する手段(M6)を追加した。
- 主な変更内容:
  - `computeTableGridShape(table)`を新設。`buildExpandedTableGrid()`とM4で導入した末尾空列トリミングロジックを共通化し、M4/M5/M6が同じ形状情報(列数・ヘッダー行の有無・ボディ行)を共有する。
  - `canOfferListConversion(table)`(M5適用条件: 実質1列、または2列でボディ行の1列目が`isHeaderLikeTableCell`判定でラベルらしい表)、`canOfferRowSections(table)`(M6適用条件: 1列目が行見出し(th、またはラベルらしいテキスト)を持つ3行以上の表)を新設。指示書の「保守的に実装」方針どおり、条件を満たさない表にはカードを出さない。
  - `buildTableAsListHtml(table)`(M5)・`buildRowsAsSectionsHtml(table)`(M6)を新設。両方ともセル内のリンク・画像はinnerHTMLごと引き継ぎ、テキストだけに削らない。M6は`<dl>`を使わず見出し+段落構造にする(確定方針、project-state.md Decisions 2026-07-10)。
  - M5/M6ともrule_idは既存の`table.layout-table`に相乗り(PR-T1/T2の方針どおり、新設なし)。`fixMethodDescription()`に`method_label`で判定する専用の説明文分岐を追加。
- **実装中に発見・修正した不具合**: colspanで複数列にまたがる1つのセルを持つ行で、M5が「見出し: 見出し」、M6でも同内容の段落が重複表示される不具合をPlaywright検証で発見(procedure-overviewサンプルの「受付時間」表: `<td colspan="2">受付時間</td>`が「受付時間: 受付時間」という無意味な箇条書き項目になっていた)。原因は、M4のグリッド展開ロジックがcolspanセルを列ごとに複製する仕様(M4自体には正しい挙動)を、M5/M6が「1列目=ラベル、2列目=値」という前提でそのまま流用したため。`isSingleMergedCellRow(row, maxColumns)`ヘルパーを新設し、行の全列が同一の元セルを指す場合は「ラベル: 値」に分解せず、1つの完結した内容として扱うよう修正した。
- 検証: `node --check`成功。`node test/run-tests.js`全テスト成功。既存6サンプル+安城市サンプルの検出件数を変更前後で比較し、M5/M6の適用条件を満たす表がある場合のみ増加(procedure-overview 9→10、tables 27→31)、他は変化なし(回帰なし)。修正後の全M5/M6候補で`<dl>`が一切含まれないこと、テキスト長がbefore/afterで大きく変わらない(冗長な重複除去分のみ減少)ことを確認。画面操作でM6カードの選択→専用説明文の表示→採用→最終HTMLへの反映を確認した。
- 関連ファイル: `goal2-app/public/app.js`
- 関連ドキュメント: `goal2-app/TABLE_FIX_METHODS_INSTRUCTIONS.md`

## 2026-07-22: 表修正手段メニューをPR-T2(M4: 結合セル解除フラット化)で拡張

- 背景・目的: `goal2-app/TABLE_FIX_METHODS_INSTRUCTIONS.md`のPR-T2として、表を分割・解体せず「結合セルだけを解除して単純な表に整える」手段(M4)を追加した。
- 主な変更内容:
  - `buildFlattenedTableHtml(table)`を新設。`buildExpandedTableGrid()`で結合を展開したグリッドから、rowspan/colspanの無い単純な行×列の表を再構築する。結合で複数マスを占めていたセルは、そのマス全てに同じ内容(innerHTML、リンク等の構造含む)を複製する(空セルにしない)。1行目が全てthなら`<thead>`+`scope="col"`、各行1列目がthなら`scope="row"`を付与する。
  - 実データ検証中に、安城市サンプルの「市内公園施設情報」表(指示書が想定した好例: rowspan=2とcolspan=2が共存)で、末尾に意味のない空列が1つ余分に生成される問題を発見。原因は元HTMLに、rowspanで既にカバーされている位置へさらに空の`<td></td>`が重複して書かれているという実データ側の欠陥で、`buildExpandedTableGrid`(ブラウザの表レンダリングと同じロジック)がこれを新しい列として展開してしまうためだった。「全行にわたって完全に空の末尾列」を切り詰めるトリミング処理を追加して解消した。
  - M4は既存rule_id `table.cell-merge-layout`に相乗りするため(PR-T1で確定済みの方針)、既存の`fixMethodDescription()`が汎用の「結合セルが見出し・注記・レイアウトのどれかを見て、必要な形に直します。」という説明文をM4にも適用してしまう問題をPlaywright検証で発見。`candidate.method_label`で判定する専用の説明文分岐を追加して解消した。
  - `planTableTreatments()`にM4を追加: `table.querySelector("[rowspan], [colspan]")`が存在する表であれば、M1〜M3の適用可否に関わらず末尾に追加する(preserveAsDataTableの値を問わない、非破壊的な手段のため)。
- 検証: `node --check`成功。`node test/run-tests.js`全テスト成功。既存6サンプル+安城市サンプルの検出件数を変更前後で比較し、結合セルを持つ表がある場合のみ+1件(M4追加分)、他は変化なしを確認(procedure-overview 8→9、tables 22→27、anjo-evacuation-shelters 0→1、他4サンプルは変化なし)。Playwrightで、安城市の「市内公園施設情報」表(rowspan+colspan混在)を実際にM4で変換し、全行が同一列数(5列)になり、リンクを含むテキストが一切欠落しないことを確認。画面操作でM4カードの選択・専用説明文の表示・最終HTMLへの反映も確認した。
- 関連ファイル: `goal2-app/public/app.js`
- 関連ドキュメント: `goal2-app/TABLE_FIX_METHODS_INSTRUCTIONS.md`

## 2026-07-22: 表修正手段メニューをPR-T1(複数手段化の骨格)で拡張

- 背景・目的: 表の「修正方法」パネルが最大2件(構造候補1件+セル結合候補1件)しか提示できていなかった。`goal2-app/TABLE_FIX_METHODS_INSTRUCTIONS.md`の計画に基づき、適用可能な修正方法を全て選択肢として提示するPR-T1(骨格)を実装した。
- 主な変更内容:
  - 早期returnのウォーターフォールだった`planTableTreatment()`を、適用可能な全手段を配列で返す`planTableTreatments()`に置き換えた。既存3手段(M1: データ表として維持+セマンティクス整備/M2: 複数表への分割/M3: 見出し・段落・画像配置への解体)を、適用条件を満たす限り併記する。
  - M1のゲートを`shouldPreserveAsDataTable()`必須から緩和(`canOfferDataTableSemanticsMethod()`新設)し、確信度のみに反映するよう変更。M3は逆に`!shouldPreserveAsDataTable(table)`を必須条件として追加した — 実装中に、`classifyMergedCellTable()`内の既存コメント(大規模なrowspan見出し付きデータ表が解体候補で構造の無い段落の羅列に変換された過去の実データ事例)を発見し、M3を無条件に「常時提示」すると同じ不具合を再現することが判明したため、ユーザーに確認の上この安全策を追加した。
  - `collectTableCandidates()`内の重複候補生成バグを修正: 従来、`table.cell-merge-layout`分類の表かつ`canSplitMergedRowsIntoTables()`がtrueの場合、トップレベルの無条件プッシュと`planTableTreatment()`の両方が同一内容(`splitMergedRowsIntoTablesHtml()`)の候補を生成していた。この重複を解消し、"layout"分類はM2/M3経由でのみ候補化するようにした。
  - `makeCandidate()`に`methodLabel`オプションを追加し、`candidate.method_label`として保持。`candidateDisplayTitle()`で最優先表示することで、同一rule_idの複数手段カードを区別できるようにした(rule_idの新設・KB再生成は行わず、既存id(`table.caption`/`table.cell-merge-layout`/`table.layout-table`)への相乗りで対応)。
  - `applyCandidateDecision()`の`decision`と`buildEvidenceFor()`の証跡出力に`selected_method_label`(および`selected_method_id`/`selected_method_rule_id`/`selected_method_title`、従来evidenceに未出力だった)を追加。
- 検証: `node --check`成功。`node test/run-tests.js`全テスト成功。既存6サンプル+安城市サンプルの検出件数を変更前後でPlaywright比較し、`tables`サンプルのみ20→22件(table.caption +1、table.layout-table +1、想定通りの新規代替手段追加分)、他は変化なしを確認(回帰なし)。画面操作で、複数手段カードの表示・切り替え・採用・最終HTMLへの反映・未採用の兄弟候補の自動conflicted化を確認した。
- 既知の残課題: 一部の表で、M1(データ表として維持)と既存の単純なキャプション欠落候補が並んで表示され、内容が一部重複するケースがある(いずれを採用しても他方は自動的にconflictedへ解決されるため実害はないが、PR-T2/T3で整理を検討)。
- 関連ファイル: `goal2-app/public/app.js`
- 関連ドキュメント: `goal2-app/TABLE_FIX_METHODS_INSTRUCTIONS.md`

## 2026-07-15: 大きな表・列グループ化ヘッダーを持つ表の候補生成が表構造を破壊する不具合を修正

- 背景・目的: ユーザーから実際の自治体ページ(避難場所一覧、185行の表を含む)の候補生成結果が「おかしい」と、元HTMLと生成後HTMLの両方を提示された。調査したところ、3件の重大な不具合が見つかった。いずれも「セル結合(colspan/rowspan)の分解・再構成」ロジック(`table.cell-merge-*`)まわりの過剰発火・誤判定が原因だった。
- **バグ1(最も深刻)**: `classifyMergedCellTable`は、表のどこか(ヘッダー行も含む)に`colspan`/`rowspan`が1つでもあれば無条件に呼ばれていた。「使用できる災害種別」のように複数の真偽値列を1つの見出しでグループ化するだけの、正当かつ一般的なヘッダーcolspanを持つ185行のデータ表が、他のどのパターン(見出し/注記/添付ファイル/概要/案内リンク)にも一致しなかったため、汎用の`table.cell-merge-layout`に分類されてしまい、`canSplitMergedRowsIntoTables`が(データ行に結合が無いため)falseを返し、レイアウト専用に設計された`decomposeLayoutTable`へフォールバックした結果、表全体が構造の無い1800個以上の`<p>`タグの羅列に変換されていた。
- **バグ2**: `splitMergedRowsIntoTablesHtml`が、`colspan`で結合されたヘッダーセル(例: `colspan="2"`の「連絡先」)のラベルを、そのセルが占めるグリッド列数ぶん単純に複製していた(`buildExpandedTableGrid`が結合セルを同一参照で複数グリッド枠に埋めるため)。結果、施設のサブ名称を表す列にまで誤って「連絡先」という見出しが付いていた。
- **バグ3**: `isLeadingTitleRowDataTableProfile`(「先頭行はタイトルバナーで実際のヘッダーは2行目」パターンの検出)が、複数セルの合計colspanが表の列数とたまたま一致するだけの、ごく普通の(colspanで複数列をグループ化しただけの)ヘッダー行まで誤って「タイトル行」と判定していた。この結果、本来のヘッダー行が捨てられ、次の行(実際には最初のデータ行)がヘッダーとして扱われてしまっていた。
- 主な変更内容:
  - `classifyMergedCellTable`に、結合セルが表の最初の行に限られ、かつ`shouldPreserveAsDataTable`が既にこの表を正当なデータ表と判定している場合は候補を出さないガードを追加した。この場合、同じ表に対して`planTableTreatment`経由の安全な`table.caption`候補(`buildDataTableSemanticsHtml`、キャプション/thead/scope属性を追加しつつ表構造は保持する)が既にカバーするため、破壊的な`table.cell-merge-layout`側は不要かつ有害と判断した。
  - `splitMergedRowsIntoTablesHtml`のヘッダーラベル抽出を、結合セルが占める連続したグリッド枠を1単位として検出するよう修正し、2列以上にまたがる結合ヘッダーはラベルを複製せず、既存の`内容${index+1}`という汎用フォールバックに委ねるようにした。
  - `isLeadingTitleRowDataTableProfile`を、先頭行が単一セルで完結するタイトルバナーの場合のみに限定する(複数セルの合計colspan一致による緩い判定を削除)よう厳格化した。付随して未使用になった`tableRowColspanCount`/`tableCellSpanValue`ヘルパーを削除した。
- 検証: `node --check`成功。`npm test`成功。`npm run test:michecker-parity` 223/223 PASS。ユーザー提供の実データ(避難場所利用停止期間の表、広域避難場所の結合セル表、185行の一時避難場所一覧表)をPlaywrightで`window.goal2Engine.analyze()`に通し、3表とも構造を保持したまま(キャプション・thead・scope属性のみ追加された)正しい候補が生成されることを確認した。既存6サンプルの固定回帰基準を更新: procedure-overview **11→10** / images 10 / tables **23→22** / links-text 29 / iframe 5 / goal3-hirosaki-news2019 20。両方の-1は同じ理由による意図した挙動で、実質的な検出漏れではないことをサンプル単体の詳細確認で裏付けた。
  - tablesサンプルの「講座の実施日程」表(先頭データ行がrowspanで日付をグループ化)は、今回のガードで冗長な`table.cell-merge-layout`候補が抑制され、既に並行して生成されていた安全な`table.caption`候補のみが残った。
  - procedure-overviewサンプルの「受付時間」表(`<td colspan="2">受付時間</td>`+2列データ行)も同様で、以前は「受付時間」を別見出しへ分離し表を2セルに縮小する`table.cell-merge-heading`候補が(表構造をより壊す形で)並行生成されていたが、今回のガードで抑制され、「受付時間」を`<th colspan="2" scope="row">`として表内に保持したまま`<caption>`を追加する、より安全な`table.caption`候補のみが残ることを確認した。
  - 検証中、既存の回帰確認スクリプト(`verify-regr-8080.js`)自体に、実行順序に応じて無関係な1サンプルが偶発的に0件を返すことがある既知のflakiness(本改修とは無関係、`page.goto`と`evidenceOutput`読み取りのタイミング起因と推測)があることも確認したため、疑わしいサンプルは複数回の単独再現確認で裏付けた。
- 関連ファイル: `goal2-app/public/app.js`

## 2026-07-15: GOAL1一括実行が特定ページで数時間ハングする不具合を修正

- 背景・目的: ユーザーからGOAL1の一括最適化が特定ページ(「「市民の声」の公表」、大きな表を含む自治体の公開ページ)で数時間止まったままになるという報告を受けた。サーバー側の外部通信(ページ取得・Gemini呼び出し・画像取得)は全てタイムアウト保護済み(8〜45秒)であることをコードで確認済みだったため、ブラウザ内の同期処理に原因があると推測し、`goal2-app/public/app.js`のテーブル解析処理を精査した。
- **根本原因**: `buildExpandedTableGrid()`が、テーブルセルの`colspan`/`rowspan`属性値を`Math.max(1, ...)`で下限のみクランプし、上限クランプ無しでそのままネストしたループの反復回数として使っていた。Excel等からのコピー貼り付けで生じがちな壊れた`colspan`値(例: `colspan="999999999"`のような数値)が1セルでも存在すると、このループが実質的に終わらなくなる。この関数はテーブル系候補生成(`collectTableCandidates`とその下流の見出しscope判定・セル結合表の分割・レイアウト表分解など)の共通経路であり、大きな表を含むページで踏みやすい。
- 主な変更内容:
  - `buildExpandedTableGrid()`のrowspan/colspan計算に上限クランプ(`MAX_TABLE_SPAN = 1000`、WHATWG HTML仕様がcolspanに課す上限と同じ値をrowspanにも適用)を追加。下限クランプは既存のまま維持。
  - 副次的に発見した別のリスクも修正: サーバー側のSSRF防止用ホスト名解決(`assertFetchUrlAllowed`内の`dns.promises.lookup()`)にタイムアウトが一切設定されておらず、`fetch()`に渡している`AbortController`の効果も及ばないことが判明したため、`dnsLookupWithTimeout()`(3秒でタイムアウト)でラップした。
- 検証: `node --check`成功。`npm test`成功。`npm run test:michecker-parity` 223/223 PASS。既存6サンプル回帰完全一致(11/10/23/29/5/20)。Playwrightで、`colspan="999999999"`という壊れたセルを含むテーブルを`window.goal2Engine.analyze()`で解析させ、修正前なら極めて長時間かかっていたはずの処理が40msで完了し正しく候補が生成されることを確認した。DNSタイムアウト側は、正常ドメイン・ブロック対象ホスト(localhost)・存在しないドメインそれぞれで既存の応答が変わらないことを確認した(実際のDNSハングを再現しての検証はサンドボックス環境の制約上できていない)。
- 補足: IndexedDBへページ単位で保存する既存の永続化設計により、ハング中のページより前に完了済みのページはブラウザタブの再読み込みで失われない。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/server.js`

## 2026-07-15: 該当箇所のビジュアル化・「KB」表記の統一・id/class属性の一括削除

- 背景・目的: ユーザーから3件の改善要望を受けた。(1)「miChecker相当チェック結果」表の「該当箇所」がCSSセレクタ文字列のままで作業者には分からない、(2)「KB」という表記が開発者目線すぎる、(3)元のHTMLのid/class属性は移行に不要なので候補生成時に一括削除したい。3点ともリスクを含むため、実装前にユーザーへ方式を確認した。
- 主な変更内容:
  1. **該当箇所のビジュアル化**: 「該当箇所」セルをCSSセレクタ文字列から、実際に検出時点で使ったHTML(`state.micheckerEngineResultHtml`)を再パースして得た該当要素のHTML抜粋(短縮・エスケープ済み)表示に変更(`buildMicheckerLocationCell`/`truncateHtmlSnippet`)。加えて表に「操作」列を追加し、「プレビューで確認」ボタンを押すとプレビューペインで該当要素へジャンプ・ハイライト表示するようにした(`highlightMicheckerProblemInFragment`、既存の候補選択時と同じ`.goal2-highlight`クラス・スクロール機構を再利用)。miChecker側のセレクタは`DOMParser`が補う`html > body > ...`から始まるため、プレビュー側の`<template>`フラグメント(html/body要素を持たない)へ適用する際はこのプレフィックスを`stripMicheckerSelectorPrefix`で除去する必要があった。
  2. **「KB」→「移行ルール」表記統一**: 画面上の表示文言(ステータス表示・修正基準セレクトの選択肢・プレースホルダ・テーブル見出し・詳細パネルのラベル・miChecker比較画面のバッジ「KB未対応」→「移行ルール未対応」等)を全て「移行ルール」に統一。内部の変数名・state項目名・APIエンドポイント名(`/api/rules`等)・`value="kb"`のような内部識別子・コード中のコメントは変更していない(スコープ外として明示的に除外)。
  3. **id/class属性の一括削除**: 新設した`stripMigrationUnneededAttributes`/`stripMigrationUnneededAttributesFromHtml`を、最終HTML構築の最終段階(`renderOutputs()`のfinalHtml計算、GOAL1の`window.goal2Engine.buildFinalHtml()`)にのみ適用。候補生成・検出ロジックより前には一切適用しないため、`table.className`をレイアウト表判定の信号として使う既存ヒューリスティックは影響を受けない。class属性は無条件削除。id属性は、ページ内アンカー(`href="#foo"`)やARIA関連付け属性(`aria-describedby`/`aria-labelledby`/`aria-controls`/`aria-owns`/`aria-activedescendant`/`aria-details`/`aria-errormessage`/`aria-flowto`)、`label[for]`から実際に参照されているものだけ`collectReferencedIds`で検出し保持、それ以外は削除する。副次的に、GOAL1の`buildFinalHtml()`がこれまで`data-goal2-node-id`(内部管理用の属性)を最終HTMLに残したまま返していた既存の抜け漏れも、同じ経路で`stripInternalFromHtml`を通すことで併せて修正した。
- 検証: `node --check`成功。`npm test`成功。`npm run test:michecker-parity` 223/223 PASS(エンジン内部は無変更)。既存6サンプル回帰完全一致(11/10/23/29/5/20、id/class削除は検出前ではなく最終HTML構築後にのみ適用しているため件数に影響なし)。Playwrightで、(1)「該当箇所」セルにHTML抜粋の`<code>`要素が表示されること、(2)「プレビューで確認」ボタン押下で行に`is-selected`が付きプレビュー内に`.goal2-highlight`要素が現れること、(3)画面上の「KB」表記が全て「移行ルール」に置き換わっていること、(4)最終HTMLに`class`/`id`属性が一切含まれないこと、を確認。別途、`href="#target"`で参照されるid属性は最終HTMLに残り、参照されないidと全classは削除されること、GOAL1の`buildFinalHtml()`から`data-goal2-node-id`が漏れなくなったことを、`window.goal2Engine`を直接呼び出すテストで確認した。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/public/index.html`、`goal2-app/public/goal1.html`、`goal2-app/public/michecker-compare.html`、`goal2-app/public/michecker-compare.js`、`goal2-app/public/styles.css`

## 2026-07-14: miChecker相当チェック結果の「種別」表示を公式表示文言に修正

- 背景・目的: 「miChecker相当チェック結果」表の「種別」列の表示文言(エラー/警告/情報/要確認)が、実機miChecker公式の表示文言(問題あり/問題の可能性大/要判断箇所/手動確認、`michecker-compare.js`が実CSVから読み取っている値と同一)と一致しているかユーザーから質問された。調査したところ、独自の直訳的な文言を使っており、公式文言とは異なっていたことが判明。さらに、当初「`info`→要判断箇所、`user`→手動確認だろう」と推測で回答したが、実際にeclipse-actf公式ソース(`ReportMessageDialog.java`の`switch (curItem.getSeverity())`、および`IProblemConst.java`の定数定義)を確認したところ、**`info`↔手動確認、`user`↔要判断箇所という逆の対応関係**であることが判明した(`IEvaluationItem.SEV_INFO`は`IProblemConst.INFO`="手動確認"に、`SEV_USER`は`IProblemConst.USER_CHECK`="要判断箇所"に対応)。この発見は、PR-M3で「常に発火する手動確認事項(always型)」が全て`type="info"`だったという既知の事実とも整合する(infoが手動確認に対応するなら当然の結果)。
- 主な変更内容:
  - `app.js`の`MICHECKER_ENGINE_TYPE_LABEL`を、`{ error: "問題あり", warning: "問題の可能性大", info: "手動確認", user: "要判断箇所" }`に修正(修正前は`{ error: "エラー", warning: "警告", info: "情報", user: "要確認" }`という独自訳語だった)。
- 検証: `node --check`成功。`npm test`成功。既存6サンプル回帰完全一致(11/10/23/29/5/20)。Playwrightで、miCheckerモードで解析した際の表示種別が実際に「問題あり」「要判断箇所」「手動確認」という公式文言になっていることを確認。
- 関連ファイル: `goal2-app/public/app.js`

## 2026-07-14: miChecker相当チェックを最終HTMLに対して手動再実行できるようにする

- 背景・目的: PR-M4のレビュー時、「miChecker相当チェック結果」パネルが候補生成時点の元HTML(`state.sourceHtml`)のみを検査しており、候補を採用・編集した後の最終HTMLに対しては検査できない(修正で指摘が解消されたか確認できない)ことをユーザーから指摘された。ボタンによる手動再実行方式を採用した(候補一覧操作のたびに自動再実行してコストをかけるより、いつの時点の結果かを明示できる方が良いという判断)。
- 主な変更内容:
  - `index.html`のmiCheckerエンジンパネルに「最終HTMLで再実行」ボタン(`#micheckerEngineRecheckButton`)と、現在表示中の結果が元HTML/最終HTMLのどちらに対するものかを示すラベル(`#micheckerEngineResultBasis`)を追加。
  - `state.micheckerEngineResultBasis`(`"source"` / `"final"` / `null`)を新設。`analyze()`実行時は常に`"source"`にリセットされる(候補生成をやり直すと元HTMLの結果に戻る)。
  - `recheckMicheckerEngineAgainstFinalHtml()`(app.js)を新設。ボタン押下時に`stripInternalFromHtml(state.workingHtml || state.sourceHtml)`(出力ドロワーの「最終HTML」と同じ組み立て方)を`runMicheckerEngine()`へ渡して再実行し、`state.micheckerEngineResult`を上書きしてパネルを再描画する。この結果は証跡JSON(`buildEvidenceFor`)の`michecker_engine`フィールドにもそのまま反映される(押した時点でパネルに表示されている内容が証跡としてもエクスポートされる、という単純な一貫性を優先した)。
  - 「既存ヒューリスティック候補との突き合わせサマリー」は、再実行後も引き続き元の候補生成時点のヒューリスティック検出セット(`state.candidates`/`state.notices`)と比較する(採用済み候補を除外した差分比較などは行っていない、簡易な参考値のまま)。
  - KB全ルールモードではボタンごとパネルが非表示のままで、既存挙動に影響はない。
- 検証: `node --check`成功。`npm test`成功。既存6サンプル回帰完全一致(11/10/23/29/5/20)。Playwrightで、miCheckerモードで解析→ラベルが「元のHTML」表示→再実行ボタン押下→ラベルが「最終HTML」表示に切り替わり証跡にも反映されること、KBモードへ切り替えるとパネルが再び非表示になり操作に影響がないことを確認。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/public/index.html`、`goal2-app/public/styles.css`

## 2026-07-14: miChecker公式判定エンジン移植 PR-M4: GOAL2/GOAL1統合+UI

- 背景・目的: `MICHECKER_ENGINE_PORT_INSTRUCTIONS.md` §4.3/§5 PR-M4を実装。PR-M0〜M3で移植した`michecker-engine.js`(108件の判定ロジック)を、実際にGOAL2画面・GOAL1バッチのパイプラインへ接続した。エンジン自体のロジックは無変更(呼び出し側の配線のみ)。
- 主な変更内容:
  - `runAnalysis()`(app.js)に`runMicheckerEngine(html)`を追加し、「miChecker指摘対応のみ」モード選択時のみ`window.micheckerEngine.run()`を実行するようにした。既存のKB全ルールモードでは一切呼び出されず、既定モードの挙動・性能を完全に現状維持している。
  - **重要な設計判断**: 既存の候補生成が使う`parseFragment()`は`<template>`要素の`DocumentFragment`(body/doctypeを持たない)を返すが、`michecker-engine.js`はC_69.0/C_89.x/C_80.0/C_23.0等`page.bodyElements`に依存するチェックを含む完全な`Document`を前提とする。そのため既存フラグメントは流用せず、`goal3Engine.extract()`やパリティテストと同じく`new DOMParser().parseFromString(html, "text/html")`で独立に再パースしてエンジンへ渡すようにした。
  - `state.micheckerCheckitems`(新規`loadMicheckerCheckitems()`、`/api/michecker-checkitems`を取得)と`state.ruleByCheckId`(`buildRuleByCheckIdIndex()`、KBルールの`michecker_check_ids`から構築する逆引きMap)を追加し、エンジンのメッセージテンプレート適用と「対応KBルール」列の表示に利用した。
  - 結果は既存候補一覧とマージ・重複排除せず、独立表示にした: `index.html`に新セクション「miChecker相当チェック結果」(`#micheckerEnginePanel`、既存の`workspace-grid`と`output-drawer`の間に配置、KB全ルールモードでは常に非表示)を追加。表(種別/チェックID/該当箇所セレクタ/公式メッセージ/対応KBルール)+折りたたみ「手動確認チェックリスト」+「既存ヒューリスティック候補との突き合わせサマリー」(チェックID単位の集合演算で両方検出/エンジンのみ/ヒューリスティックのみの件数を1行表示、詳細な要素単位マッチングはmiChecker比較画面の役割としてスコープ外)。
  - 証跡JSON(`buildEvidenceFor`)に、miCheckerモード時のみ`michecker_engine: { problems, checklist, engine_version }`を追加した。
  - `goal1.html`にも`michecker-engine.js`のスクリプトタグを追加し、`window.goal2Engine.init()`/`analyze()`がヘッドレスでもチェックアイテムをロードしてエンジンを実行できるようにした。GOAL1のページ一覧テーブルに「miChecker検出」列を1本追加(計画書の「UI集計は最小限」指示どおり、件数を1列足すのみで詳細集計は追加していない)。
- 検証: `node --check`成功。`npm test`成功。`npm run test:michecker-parity` 223/223 PASS(エンジン内部は無変更のため影響なし)。既存6サンプルの回帰完全一致(procedure-overview 11 / images 10 / tables 23 / links-text 29 / iframe 5 / goal3-hirosaki-news2019 20)。Playwright E2Eで、KB全ルールモード(解析前後とも)ではパネル非表示・証跡に`michecker_engine`なしを確認、miCheckerモードに切り替えて解析するとパネル表示・表とチェックリストが描画され証跡に`michecker_engine`が含まれることを確認、KBモードへ再度切り替えると非表示・証跡フィールドも消えることを確認。GOAL1側も`window.goal2Engine.analyze()`を直接呼び出し、KBモードでは`micheckerEngineResult`が`null`、miCheckerモードでは実データが返り証跡へ反映されること、ページ一覧の列見出しが10列(新規列含む)になることを確認。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/public/goal1.js`、`goal2-app/public/index.html`、`goal2-app/public/goal1.html`、`goal2-app/public/styles.css`

## 2026-07-14: miChecker公式判定エンジン移植 PR-M3: info/user型67件の移植(移植フェーズ完了)

- 背景・目的: `MICHECKER_ENGINE_PORT_INSTRUCTIONS.md` §5 PR-M3を実装。インベントリでtype=info/userの74件(C_16.0は本体未発火のため対象外の73件が対象)のうち、実装中に新たに判明した本体未発火6件を除く**67件**を移植した。これで対象116件中108件の移植が完了(PR-M1〜M3合計)。
- **重要な訂正(既存インベントリの盲点を発見)**: `MICHECKER_PORT_INVENTORY.md`の「手動確認(always)」分類は、`CheckEngine.java`内の`"C_x.y"`という文字列リテラルを正規表現でマッチさせて生成しており、**コメントアウトされたコードとの区別ができていなかった**。`always()`メソッド全文を実際に読んだところ、分類対象24件のうち5件(C_500.4, C_500.13, C_500.14, C_500.15, C_500.16)が`// addCheckerProblem(...)`という形でコメントアウトされており、現在のソースでは一切発火しないことが判明した。同様に`item_76`のC_76.0も全体がコメントアウトされていた。これら6件は、PR-M0/M1で確認済みのC_16.0/C_332.0(本体未発火)と同じ扱いとし、実装せず理由をコード内コメントに明記した。
- 主な変更内容:
  - 「always」型(ページ単位の無条件確認事項)19件を`registerAlways()`ヘルパー経由で追加。`run()`の既存の"always"特殊処理により`checklist`出力へ振り分けられる。
  - 個別チェック49件(実装時に49件全てを実装後、当初見落としていたC_52.0/C_52.1を追加確認し、最終的に48件+2件=個別49件を含む67件全体を実装完了)。`item_12`(入れ子テーブル深度)、`item_16`(空リスト/孤立li)、`item_23`(データテーブルのキャプション/summary分類、4分岐)、`item_57`の残り5分岐(C_57.0/57.1/57.4/57.5/57.6、C_57.2/57.3はPR-M1で実装済み)、`item_58`(同一リンクテキスト・異なる遷移先の重複検出、文字数バケット方式)など、特に複雑なロジックを含む。
  - 実装中に発見した重要な癖: `item_58`はJavaの`String.hashCode()`比較を高速化のため使っているが、本移植では直接の文字列完全一致に置き換えた(ハッシュ衝突による誤検出は事実上発生しないため、意図の忠実な再現と判断)。`C_500.19`(`<style>`要素内の固定単位font-size)と`C_500.20`(`style`属性内の同じパターン)は、概念上は同じ内容にもかかわらず**別々のチェックIDで報告される**というJava側の非対称な設計を発見し、そのまま実装した(当初は同一IDとして誤実装しており、テスト失敗から発見・修正)。`COLOR_ATTR`正規表現はJavaが`Matcher#matches()`(全文一致)を使うのに対し、他の同様のパターン(`BGCOLOR_ATTR`等)は`find()`(部分一致)を使うという非対称性も発見し、JS側で`^...$`アンカーの有無を使い分けて再現した(アンカーなしで実装した際に`background-color`が誤って`color`宣言としても検出されるテスト失敗から発見)。
  - `C_500.17`/`C_500.18`/`C_500.19`/`C_500.21`(`<style>`要素・外部スタイルシートの色/固定サイズ判定)は、Java側の完全なCSSセレクタブロック解析(`findStyles`/`StyleSelectorSets`)ではなく、簡略化した正規表現の全文テストで実装した(検出の発火/不発火自体は要素単位で正確に再現するが、メッセージ文言中の該当セレクタ一覧は省略)。外部スタイルシートの解決(ネットワーク取得)は計画書§3.2-2の方針どおり対象外。
  - `C_8.0`は`item_8`の`<font color/bgcolor>`パスのみ実装し、`styleCheck()`側の「同一要素にcolorとbgcolor両方」を検出する経路は簡略化のため対象外とした(コード内コメントで明記)。
- 検証: `node --check`成功。`npm test`成功。`npm run test:michecker-parity` 223/223 PASS(67件×陽性・陰性約110件+dead-code確認6件を追加)。全108件の登録済みチェックIDにテストカバレッジがあることをスクリプトで確認。既存6サンプルの回帰完全一致(procedure-overview 11 / images 10 / tables 23 / links-text 29 / iframe 5 / goal3-hirosaki-news2019 20)。`michecker-engine.js`は未統合のため既存機能への影響なし(GOAL2統合はPR-M4)。
- 関連ファイル: `goal2-app/public/michecker-engine.js`、`goal2-app/test/michecker-parity/run-parity-tests.js`

## 2026-07-14: miChecker公式判定エンジン移植 PR-M2: warning型18件の移植

- 背景・目的: `MICHECKER_ENGINE_PORT_INSTRUCTIONS.md` §5 PR-M2を実装。インベントリでtype=warningの18件全て(C_6.1, C_13.0, C_23.2, C_33.2, C_38.0, C_46.0, C_48.0, C_48.1, C_48.2, C_48.3, C_48.4, C_48.5, C_48.7, C_48.8, C_80.0, C_89.2, C_300.1, C_331.2)を移植した。
- 主な変更内容:
  - `buildPageContext`を拡張し、`layoutTableList`(データテーブルに分類されなかった全テーブル: 1行1列テーブル・非データテーブル・入れ子テーブル)、マウスイベントハンドラ要素、`<style>`要素本文マップを追加。
  - `item_331`(C_331.0/331.1/331.2)の共通のテーブル分類ロジックを`analyzeScopeTable()`として1関数に切り出し、C_331.0(PR-M1で実装済み)とC_331.2(本PRの新規)が同一ロジックを共有するようリファクタリング(重複実装によるロジック乖離を防止)。
  - `item_89`のbody走査ロジックも`accumulateBodyText()`として切り出し、C_89.0(PR-M1)とC_89.2(本PR)で共有。
  - C_33.2は`<style>`要素本文(インラインCSSテキスト)のみを対象とし、外部スタイルシートの解決は計画書§3.2-2の方針どおり対象外。
  - C_48.7(acronym)・C_48.8(longdesc/summary属性)は原典でJavaの`isHTML5`分岐内でのみ発火するが、本エンジンのフラグメント解析では`document.doctype`が常に無いため`isHTML5`は常にfalseとなり、**通常利用では構造的に到達不能**であることを確認した上でそのまま実装(完全なdoctype付き文書を将来解析する可能性に備えて忠実に移植)。
  - C_300.1(area要素のalt品質)はTextChecker移植(PR-M0)を再利用し、`getImgElementsFromMap`相当のロジックで対応img要素ごとに個別報告する原典の重複挙動も保持。
  - パリティテストのハーネス健全性チェック(PR-M0で追加)が、PR-M1/M2でチェックが実際に登録されたことで既存fixture(1行テーブル入りの汎用HTML)に対して意図せずC_23.2を検出するようになり偽陽性の失敗が発生。`run()`呼び出しに明示的に`checkIds: []`を指定する形に修正し、登録済みチェック数に依存しない安定したテストに改善した。
- 検証: `node --check`成功。`npm test`成功。`npm run test:michecker-parity` 100/100 PASS(18件×陽性・陰性36件を追加)。既存6サンプルの回帰完全一致(procedure-overview 11 / images 10 / tables 23 / links-text 29 / iframe 5 / goal3-hirosaki-news2019 20)。`michecker-engine.js`は未統合のため既存機能への影響なし(GOAL2統合はPR-M4)。
- 関連ファイル: `goal2-app/public/michecker-engine.js`、`goal2-app/test/michecker-parity/run-parity-tests.js`

## 2026-07-14: miChecker公式判定エンジン移植 PR-M1: error型23件の移植

- 背景・目的: `MICHECKER_ENGINE_PORT_INSTRUCTIONS.md` §5 PR-M1を実装。インベントリでtype=errorの24件のうち、本体未発火のC_332.0を除く23件(C_3.0, C_6.0, C_14.0, C_18.2, C_33.0, C_33.1, C_34.0, C_36.0, C_36.1, C_51.0, C_51.1, C_51.4, C_51.5, C_57.2, C_57.3, C_85.0, C_89.0, C_331.0, C_331.1, C_332.1, C_332.2, C_422.0, C_423.0)を`CheckEngine.java`から`michecker-engine.js`へ忠実に移植した。
- 主な変更内容:
  - `goal2-app/public/michecker-engine.js`: ページ単位の共有コンテキスト構築(`buildPageContext`。img/a[href]/frame/iframe/見出し/データテーブル一覧を1回だけ計算し全チェックへ渡す、Java側の事前計算パターンを踏襲)と、`HtmlTagUtil`/`HtmlEvalUtil`の主要ヘルパー移植(`getTextAltDescendant`/`getTextDescendant`/`hasTextDescendant`/`getNoScriptText`/`getNameByAria`/`getWordCount`/データテーブル判定(`isDataTable`/`isDataCell`/`hasFormControl`/`is1Row1ColTable`)/`isHTML5`)を追加した上で、23件のチェック本体を登録。
  - 忠実性を優先し、実装中に判明した原典の癖はコード内コメント+CHANGELOGの両方に明記し、修正せずそのまま移植した。特に重要なもの:
    - `item_331`(C_331.0/331.1、th要素のscope検査)が`tr.getFirstChild()`/`tr.getChildNodes().getLength()`という**生の子ノード数(空白テキストノード込み)**に依存しており、見た目上のセル数とは一致しない場合がある。
    - `item_332`(C_332.1/332.2、headers属性検査)がデータテーブル1件ごとに文書全体のth/td再走査を繰り返す設計になっており、複数のデータテーブルがあると同一の不正参照が重複報告される。
    - `item_423`(C_423.0、id重複)の対象がXPath`//body/*[@id]`により**bodyの直接の子要素のみ**に限定されており、ネストした要素同士のid重複は検出しない。
    - `TextChecker`の`isSeparatedJapaneseChars`(PR-M0で移植済み)と同様、`\b`のASCII限定セマンティクスに起因する挙動はC_331系のロジックには影響しないが、他の文字列判定にも共通する注意点として実装時に再確認した。
  - `goal2-app/test/michecker-parity/run-parity-tests.js`: 23件それぞれに陽性・陰性ケース(計46件)+`item_332`の重複報告の癖を示す追加ケース1件、計47件の新規ケースを追加(既存17件と合わせて64/64件PASS)。`<frame>`要素はHTML5パーサーが`<frameset>`外では破棄するため、C_51.0/C_51.4のfixtureのみ`<frameset>`で囲む対応が必要だった(実ブラウザのHTML5パース仕様であり、実装側の問題ではないことをテスト内コメントで明記)。
- 検証: `node --check`成功。`npm test`成功。`npm run test:michecker-parity` 64/64 PASS。既存6サンプルの回帰完全一致(procedure-overview 11 / images 10 / tables 23 / links-text 29 / iframe 5 / goal3-hirosaki-news2019 20)。`michecker-engine.js`はまだどの画面からも読み込まれていないため(GOAL2統合はPR-M4)、既存機能への影響は原理的にゼロ。
- 関連ファイル: `goal2-app/public/michecker-engine.js`、`goal2-app/test/michecker-parity/run-parity-tests.js`

## 2026-07-14: miChecker公式判定エンジン移植 PR-M0: インベントリ+michecker-engine.js骨格

- 背景・目的: `goal2-app/MICHECKER_ENGINE_PORT_INSTRUCTIONS.md`(前PRで作成した実行計画書)のPR-M0を実装。移植対象116件のインベントリ表と、判定ロジック本体(`michecker-engine.js`)の骨格(チェック本体は未実装、0件発火)を構築した。
- 主な変更内容:
  - `a11y-migration-kb/tools/gen_michecker_inventory.py`(新規): `goal2-app/data/michecker-checkitems.json`・`a11y-migration-kb/reference/michecker-out-of-content-scope.json`・`goal2-app/data/rules.jsonl`と、eclipse-actf公式ソースの`CheckEngine.java`を突き合わせ、対象116件それぞれのCheckEngine.java担当メソッド・行番号・移植可否分類(pure-DOM 79 / テキストCSS解析 9 / 手動確認(always) 24 / TextChecker依存 2 / 本体未発火 2)・対応KBルールを一覧化する`goal2-app/MICHECKER_PORT_INVENTORY.md`を生成するワンショットスクリプト。
  - `goal2-app/public/michecker-engine.js`(新規): EPL-1.0ヘッダー(移植元・参照コミット`703e34f0...`・Copyright表記)、`window.micheckerEngine.run(document, options)`の公開API、`addCheckerProblem`相当の内部収集器、`desc_ja`テンプレートの`{0}`置換(`MessageFormat`相当)、CSSセレクタパス生成(行番号の代替)、`TextChecker.java`+`altText.properties`(NGワード一覧)の完全移植(`checkAlt`/`isSeparatedJapaneseChars`/`isAsciiArtString`等)。C_x.yチェック本体(PR-M1以降)は未登録。
  - `a11y-migration-kb/vendor/eclipse-actf/NOTICE.md`: `michecker-engine.js`の移植元・ライセンス(EPL-1.0)・ライセンス隔離方針を追記。
  - `goal2-app/test/michecker-parity/`(新規): パリティテストランナー(`run-parity-tests.js`、`npm run test:michecker-parity`)。`npm test`本体(`test/run-tests.js`)はゼロ依存方針のため、Playwright実ブラウザで`michecker-engine.js`を実行するこのランナーは独立コマンドとした(既存の全E2E検証と同じPlaywright実行環境を利用。新規npm依存は追加していない)。PR-M0時点ではCHECKS未登録のためチェック本体のパリティ検証は無く、収集器・メッセージ整形・セレクタ生成・TextChecker移植の17ケースを検証(全PASS)。TextChecker移植では、Java側の`\b`(ASCII単語境界)が純粋な日本語テキストでは実質発火しないという原典の癖を発見し、「修正」せず忠実に再現した上でテストにも明記した。
  - 副次的な修正: `goal2-app/test/run-tests.js`の`goal3Html.includes("Goal 3")`アサーションが、前PR(#66、GOAL番号表記の除去)で`goal3.html`から「Goal 3」という文字列自体が無くなったことにより既に失格していたことを発見。`"本文抽出"`(現在のeyebrowラベル)を見る形に更新し、`npm test`を再び通るようにした(miChecker移植とは無関係の、前PRで見落とされていた既存バグの修正)。
- 検証: `node --check`(michecker-engine.js/app.js/goal1.js/goal3.js/server.js)成功。`npm test`成功(前述の副次修正を含む)。`npm run test:michecker-parity`17/17 PASS。既存6サンプルの回帰完全一致(procedure-overview 11 / images 10 / tables 23 / links-text 29 / iframe 5 / goal3-hirosaki-news2019 20)。インベントリ表の合計116件(本体未発火2件を「対象外」と明記)を確認。`michecker-engine.js`はどのHTML画面からも未読み込みのため既存UI・既存機能への影響なし(GOAL2統合はPR-M4)。
- 関連ファイル: `goal2-app/MICHECKER_PORT_INVENTORY.md`(新規)、`goal2-app/public/michecker-engine.js`(新規)、`goal2-app/test/michecker-parity/`(新規)、`goal2-app/test/run-tests.js`、`goal2-app/package.json`、`a11y-migration-kb/tools/gen_michecker_inventory.py`(新規)、`a11y-migration-kb/vendor/eclipse-actf/NOTICE.md`

## 2026-07-14: miChecker公式判定エンジン(CheckEngine.java)移植の実行計画書を作成(実装は未着手)

- 背景・目的: ユーザーから「miCheckerと同じチェックはこのブラウザ上で可能か」という一連の質問があり、現状の「miChecker指摘対応のみ」モードは公式チェック項目のメタデータ(WCAG番号・メッセージ文言)との突き合わせに基づく独自ヒューリスティックであって、公式の判定アルゴリズムそのものではないことを根拠付きで説明した。判定ロジックの実体が`eclipse-actf/org.eclipse.actf`リポジトリの`CheckEngine.java`(約4,900行、EPL-1.0)として公開されていることを実ソース取得で確認し、ユーザーから「本文編集で対応可能な項目のみから着手。Fable 5が移植実行計画を立て、Sonnetが実装する」との指示を受けて計画書のみを作成した(コードは未着手)。
- 事前分析(計画の根拠として実施):
  - 公式チェック項目268件のうち、`michecker-out-of-content-scope.json`登録済みの152件を除いた**116件**(error 24 / warning 18 / info 30 / user 44)を移植対象と確定。
  - `CheckEngine.java`の全`addCheckerProblem`呼び出し箇所を約90メソッドへマッピングし、CSS描画(CSSOM)依存は9件のみ、`C_16.0`/`C_332.0`の2件はエンジン内に発火箇所なし(本体未発火)、約24件は`always()`による無条件の手動確認リマインダーであることを確認。大半は純粋なDOM解析で移植可能と判断。
- 計画書の主な内容: EPL-1.0コードの二次的著作物として`michecker-engine.js`1ファイルへのライセンス隔離、CheckEngine.javaと1:1対応の構造(忠実移植・独自改変禁止)、既存ヒューリスティック実装は変更せず別レイヤーとして追加、PR-M0(インベントリ+骨格)〜PR-M5(ユーザーのWindows環境のhtmlchecker.exe出力をゴールデンとした実機パリティ検証)の6段階、PR-M5完了までUI上「miChecker相当(移植版)」と表記し「同一」と言わないこと等。
- 関連ファイル: `goal2-app/MICHECKER_ENGINE_PORT_INSTRUCTIONS.md`(新規)

## 2026-07-14: GOAL1/GOAL2/GOAL3/miChecker比較の4画面間に相互ナビゲーションを追加

- 背景・目的: ユーザーから「GOAL2やGOAL1それぞれを行き来できるようにしましょう」との依頼。これまで4画面(`index.html`=GOAL2、`goal3.html`=GOAL3、`michecker-compare.html`=miChecker結果比較、`goal1.html`=GOAL1)は互いへのリンクが一切無く、URLを直接書き換えないと移動できなかった。
- 主な変更内容:
  - 4画面共通の左サイドバー(`.app-header`)内、既存のステータス表示とフッターの間に`<nav class="app-nav">`を追加。一括最適化/候補レビュー/本文抽出/miChecker結果比較への4リンクを、常に同じ順序・同じ場所に表示。
  - 各画面で、自分自身へのリンクにのみ`aria-current="page"`を付与。
  - `goal2-app/public/styles.css`に`.app-nav`/`.app-nav-link`(通常時・hover・focus-visible・`aria-current`時)を追加。初回実装は現在地リンクを白背景の角丸ボックス(既存の`.header-status`ステータス表示と同じ見た目)にしたが、ユーザーから「ボタンと差別がない」との指摘を受け、押せるボタン風の塗りつぶし表示をやめ、左ボーダー付きのプレーンテキストリスト(現在地のみ白文字+太い左ボーダー、他はグレー文字でボックスなし)に変更。ホバー時は下線+左ボーダーの明るさ変化のみでクリック可能であることを示す。
  - ナビゲーション追加をきっかけに、ユーザーから「GOAL1のような名称はあくまでプロジェクトのGOALを示したものなので機能名だけにしましょう。サービス全体で使用していないかチェックして(URLは除く)」との指摘。画面のタイトル(`<title>`)・見出し上のラベル(`eyebrow`)・サイドバーのフッター・ナビゲーションのリンク文言・GOAL3画面の「候補レビューへ渡す」ボタン(旧「GOAL2へ渡す」)・GOAL1画面の「候補レビューで開く」ボタン(旧「GOAL2で開く」)・GOAL1画面の一括採用基準の説明文・GOAL2画面のサンプルデータの表示ラベル(「本文抽出サンプル: 弘前市 お知らせ本文」、旧「GOAL3抽出: 弘前市 お知らせ本文」)から「GOAL1」「GOAL2」「GOAL3」表記を除去し、機能名(一括最適化/候補レビュー/本文抽出/miChecker結果比較)のみの表記に統一。URL(`/goal1.html`等)・HTMLファイル名・要素ID・localStorageキー・コード内コメントは対象外(指示通りURLは除外、かつユーザー非表示のため)。
- 検証: 4画面それぞれで、ナビゲーションの4リンクが正しい`href`と`aria-current`を持つことを確認。GOAL2からナビゲーションリンクをクリックして実際にGOAL1画面へ遷移することを確認。既存6サンプルの検出件数(11/10/23/29/5/20)が変更前後で完全一致(回帰なし)。GOAL2画面(サンプル読込→候補生成→採用→出力)・GOAL3画面(貼り付け→抽出)の既存E2Eスモークシナリオを再実行し、いずれもJSエラーゼロで影響なしを確認。再デザイン後もスクリーンショットで、ステータス表示(ボタン風の塗りつぶし)とナビゲーション(プレーンテキストリスト)が明確に見分けられることを確認。名称変更後のナビゲーション表記(GOAL番号を含まない機能名のみ)をスクリーンショットで確認。
- 関連ファイル: `goal2-app/public/index.html`、`goal2-app/public/goal3.html`、`goal2-app/public/michecker-compare.html`、`goal2-app/public/goal1.html`、`goal2-app/public/goal1.js`、`goal2-app/public/app.js`、`goal2-app/public/styles.css`

## 2026-07-14: 写真キャプション表がファイルサイズ注記のせいでデータ表と誤判定されるバグを修正

- 背景・目的: ユーザーから、寺院の蓮の花の生育記録ページ(実在の自治体ページのHTML)を貼り付けた「表の崩しかたがむちゃくちゃ」との報告。写真キャプション+ダウンロードリンクだけの単純な2×2表(見出しなし、ヘッダーなし)が、`table.caption`候補で「山門北側。クリック！（JPG：629KB）の詳細」という不自然なキャプションと、実在しない列見出し(`<th scope="col">`)・行見出し(`<th scope="row">`)を持つ構造に再構築されていた。
- 原因(独立した2件の誤判定が重なっていた):
  1. `isHeaderLikeTableCell()`の文末記号除外パターン(`。.!?！？`)が閉じ括弧類(）)】」』])を含んでいなかったため、「クリック！（JPG：629KB）」のような、ファイル情報付きリンクだけのセル(実際は本文の一部で見出しではない)が、閉じ括弧で終わっているにもかかわらず「短い体言(見出しらしい文字列)」と誤判定されていた。
  2. `isTableDataValueText()`が単純に数字の有無だけで「データ値を含む行がある」と判定しており、「629KB」のようなファイルサイズ注記に含まれる数字も、電話番号や金額と同様の表データとして扱われていた。この結果、rowspan/colspanが無い、ヘッダーもキャプションも無い単純な写真キャプション表まで「データ表として温存すべき」と判定され、`buildDataTableSemanticsHtml()`による構造再構築(存在しない見出しの捏造)が発動していた。
- 修正: `isHeaderLikeTableCell()`の文末記号除外パターンに閉じ括弧類を追加。`isTableDataValueText()`は、判定対象のテキストから「数字+KB/MB/GB」のファイルサイズパターンを除去してから数字判定するよう変更(電話番号・金額など本来のデータ値の判定には影響しない)。
- 検証: `node --check`成功。既存6サンプルの検出件数(11/10/23/29/5/20)がルール別内訳も含めて完全一致(回帰なし)。ユーザー報告の表を単体で再現し、修正前は実在しない見出し付きのデータ表構造(不自然な自動生成キャプション込み)になっていたのが、修正後は`table.layout-table`によるシンプルな段落分解(元の見出し・リンクテキストをそのまま保持)になることを確認。あわせてユーザー提供ページの該当箇所全体(4つの表)を通して検証し、すべての表が一貫して適切に段落へ分解されることを確認。
- 関連ファイル: `goal2-app/public/app.js`

## 2026-07-14: GOAL1 PR-D(後半): LLM有効環境での実地検証(コード変更なし)

- 背景・目的: `goal2-app/GOAL1_BUILD_INSTRUCTIONS.md`§6 PR-D項目3「LLM有効環境での実地検証」を、ユーザー提供のテスト用Gemini APIキーで実施した。
- 実施内容: `GEMINI_API_KEY`を設定した状態でサーバーを起動し、GOAL1画面から実際にGeminiを呼び出すバッチ処理を検証した。
  - ヘッダーの「LLM利用」バッジが正しく「有効(コストが発生します)」に切り替わることを確認。
  - ローカルHTMLファイル2件のバッチで、LLM enrichmentが実際に候補を追加すること(例: `html-structure.heading-required`がAI判定で新規追加)、LLM由来の候補は`processing_class: "ai"`・`requires_human_review: true`のため`autoAcceptSafe`で自動採用されず正しく「要確認」に残ること、機械的候補(`table.caption`)は従来どおり自動採用されることを確認。
  - ページごとのLLM概算コストが実際の課金額(ゼロではない実測値)として記録され、作業一覧の合計値・証跡CSVの双方に正しく反映されることを確認。
  - JSエラーゼロ、証跡CSVの内容も正常(rule_id/status/confidence/requires_human_reviewが実データと一致)。
- 結果: バグは発見されず、コード変更は不要だった。GOAL1_BUILD_INSTRUCTIONS.mdのPR-D全項目(グルーピング表示・ルール別サマリー・LLM実地検証)が完了。
- APIキーの取り扱い: リポジトリ外のスクラッチパッドにのみ`chmod 600`で保存し、検証完了後に`rm -f`で削除、削除済みであることを確認した。リポジトリ管理下のファイルには一切書き込んでいない。
- 関連ファイル: なし(検証のみ、コード変更なし)

## 2026-07-14: GOAL1 PR-D(前半): 作業一覧のグルーピング表示・ルール別出現頻度サマリー

- 背景・目的: `goal2-app/GOAL1_BUILD_INSTRUCTIONS.md`§6 PR-Dの実施。バッチ全体の傾向を把握しやすくするため、作業一覧のグルーピング表示とルール別集計を追加した。
- 主な変更内容(`goal2-app/public/goal1.html` / `goal1.js` / `styles.css`):
  - 作業一覧に「グループ化」セレクト(なし/カテゴリ別/テンプレートNo別)を追加。選択したキーでページをグルーピングし、グループ見出し行(件数付き)を表とインラインで表示。値が空のページは「(未分類)」にまとめ、常に末尾にソート(実際に分類が付いているページを先に見せるため)。
  - 新規セクション「ルール別集計」を追加。バッチ全体の`evidence.candidates`を`rule_id`ごとに集計し、候補数・自動採用数・要確認数を候補数降順で一覧表示。同種修正をまとめて確認・適用しやすいルールを一目で把握できる。
- 検証: `node --check`成功。goal2既存回帰は変更前後で完全一致。PR-Bの全E2Eシナリオを再実行し影響なしを確認。あわせて新規シナリオ(カテゴリ違いのURL2件+HTMLファイル2件の混在バッチ)で、(1)グループ見出しが正しい件数・順序で表示されること、(2)グループ化を「なし」に戻すとグループ行が消えること、(3)ルール別集計の候補数合計が、作業一覧の各ページの候補総数の合計と一致すること、を確認。
- 未実施(要ユーザー対応): 指示書のPR-D項目3「LLM有効環境での実地検証」は、有効なGemini APIキーが必要なため、ユーザーからテスト用キーの提供があった場合に別途実施する。
- 関連ファイル: `goal2-app/public/goal1.html`、`goal2-app/public/goal1.js`、`goal2-app/public/styles.css`

## 2026-07-14: GOAL1 PR-C: 出力系の合格条件検証+要確認残数の表示バグ修正

- 背景・目的: PR-Bの時点で`goal2-app/GOAL1_BUILD_INSTRUCTIONS.md`§6 PR-C(証跡CSV一括・バッチJSON・GOAL2引き継ぎ)のコード自体は前倒し実装済みだったため、PR-Cとしては指示書記載の合格条件「GOAL2引き継ぎ後の要確認残数がgoal1一覧の値と一致する」を明示的に検証する回として実施した。
- 検証中に発見したバグ: GOAL1の作業一覧テーブルで、`自動採用`列・`要確認残数`列が`page.autoAcceptedCount || ""` / `page.remainingCount || ""`という書き方になっており、値が`0`(自動採用0件、または要確認残数0件)のとき`0`が偽値として扱われ空欄表示になっていた。実データは正しいが、表示上「まだ集計されていない」ように見えてしまう紛らわしい不具合。`page.evidence`の有無(=解析完了済みかどうか)を判定に使い、解析完了後は`0`も`"0"`として明示表示するよう修正。
- 検証: `node --check`成功。goal2既存回帰は変更前後で完全一致。GOAL1でページ1件をバッチ処理→「GOAL2で開く」→候補生成、という一連の流れで、GOAL1一覧の要確認残数(`0`)とGOAL2側の`evidence.completion.unresolved`(`0`)が一致することを確認(修正前は空欄`""` vs `"0"`で不一致していた)。PR-Bの全E2Eシナリオ(混在入力・重複検出・エラー継続・CSV/JSON出力・IndexedDB復元)も再実行し変化がないことを確認。
- 関連ファイル: `goal2-app/public/goal1.js`

## 2026-07-14: GOAL1 PR-B: goal1.html骨格+バッチ実行+IndexedDB

- 背景・目的: `goal2-app/GOAL1_BUILD_INSTRUCTIONS.md`§6 PR-Bの実施。PR-Aで公開した`window.goal3Engine`/`window.goal2Engine`を使い、複数ページを一括処理するGOAL1のバッチ画面を新設した。
- 主な変更内容:
  - `goal2-app/public/goal1.html`(新規): ①ページ一覧入力(CSV/URL一覧/HTMLファイル複数選択)、②実行設定(修正基準・LLM利用状況表示)、③一括実行(進捗バー・一時停止/再開)、④作業一覧(状態・候補総数・自動採用数・要確認残数・LLM概算・操作)、⑤バッチ出力の5区画構成。
  - `goal2-app/public/goal1.js`(新規): CSV(CP932/UTF-8自動判定、簡易RFC4180パーサ自前実装、移行管理CSVの列名解決+1行1URL/`URL,カテゴリ`形式へのフォールバック)・URL一覧・HTMLファイル複数の3入力系統からページキューを構築。同一URLの重複は除去せず一覧に警告バッジ表示。バッチは直列実行(`/api/fetch-html`→`goal3Engine.extract`→`goal2Engine.analyze`→`autoAcceptSafe`→最終HTML/証跡構築)し、1ページの失敗(取得失敗/抽出失敗/実行時エラー)でバッチ全体を止めない。IndexedDB(db=`goal1`, store=`batches`)へページごとに保存(元ページの全体HTMLは保存せず、抽出後HTML・最終HTML・証跡のみ永続化)、再読み込み時に最新バッチを自動復元。
  - `goal2-app/server.js`: `GET /api/llm/status`を新設(`lib/llm.js`の既存`isConfigured()`をそのまま利用、呼び出しは一切発生させない)。GOAL1画面がLLM設定状態(コスト発生の有無)を実行前に表示するために使用。
  - `goal2-app/public/app.js`: GOAL1→GOAL2の個別引き継ぎ(`localStorage["goal3.toGoal2"]`)に`autoAcceptSafe`フラグを追加。フラグ付きで引き継がれた場合、作業者が「候補生成」を実行した直後に1回だけ、既存の一括採用と同じ`applyCandidateDecision`経路(競合解決含む)で自動採用相当を適用する新関数`applyPendingAutoAcceptSafe()`を追加(ヘッドレス版`autoAcceptSafe`の単純な決定状態コピーではなく、画面の通常経路を再実行する設計)。
  - `goal2-app/public/styles.css`: `.goal1-*`系クラスを追加。既存の`.michecker-shell`パターン(`margin: 0 auto`)を検証中に発見した潜在バグ(固定左サイドバーnav`.app-header`と、ビューポート幅によっては重なり클릭を奪う)を避けるため、`.goal1-shell`は`.goal3-shell`と同じ「margin/max-width上書きなし」パターンを採用。
- 検証: `node --check`全ファイル成功。goal2既存回帰(全6サンプル×ルール別内訳、変更前後で完全一致)は影響なし。ローカルHTMLファイル3件(通常記事×2、空ページ×1)+移行管理CSV(CP932実データ形式)+URL一覧(重複URL含む)の混在入力でE2E検証: キュー構築(7件、重複バッジ2件)、バッチ完走(この環境では外部URL取得不可のため取得失敗4件・完了2件・抽出失敗1件、想定どおりバッチは停止せず継続)、証跡CSV/バッチJSONダウンロード(UTF-8 BOM付き、Excelで文字化けしない内容を確認)、リロード後のIndexedDB復元、GOAL2への引き継ぎ+`autoAcceptSafe`適用(候補生成後に1件が自動採用されることを確認)まで一通り確認。JSエラーはゼロ。
- 関連ファイル: `goal2-app/public/goal1.html`(新規)、`goal2-app/public/goal1.js`(新規)、`goal2-app/public/styles.css`、`goal2-app/server.js`、`goal2-app/public/app.js`

## 2026-07-14: GOAL1 PR-A: 解析・抽出エンジンのヘッドレス化(挙動変更なし)

- 背景・目的: GOAL1構築指示書(`goal2-app/GOAL1_BUILD_INSTRUCTIONS.md`)§6 PR-Aの実施。GOAL1バッチ画面(後続PR-B)がgoal2/goal3のエンジンをUI無しで呼び出せるよう、両エンジンをヘッドレス関数として公開した。**画面の見た目・候補の内容・件数の変更は一切ない。**
- 主な変更内容(`goal2-app/public/goal3.js` / `goal2-app/public/app.js`):
  - 両ファイルのUI初期化(els束縛後のイベント登録・初期描画)を「必要な要素が存在する場合のみ」実行するようゲート。goal1.html(将来)から読み込んでもTypeErrorにならない。
  - goal3.js: `window.goal3Engine.extract(html, pageTitle)` を公開。DOMParser+既存`buildContentCandidates()`の薄いラッパーで、`{pageTitle, candidates}`を返す。
  - app.js: 解析コンテキスト(`analysisContext`+`currentPageTitle()`/`currentOldUrl()`ヘルパー)を導入し、解析パイプライン内の入力欄直読み5箇所(toppage-linkのpageTitle、vision系3箇所+linkTitleLookupBaseのoldUrl)と`currentSessionId()`をヘルパー経由に置換。ヘッドレス実行時は引数の値、画面実行時は従来どおり入力欄の値を読む。
  - app.js: `analyze()`の中核を`runAnalysis(html, options)`として抽出(候補生成→enrichment→candidates/notices分離まで)。既存`analyze()`はこれを呼ぶだけの形にし、ステータス表示のタイミング(`onEnrichmentStart`コールバック)も従来と同一。
  - app.js: `rebuildWorkingHtml()`→`rebuildWorkingHtmlFor(sourceHtml, candidates)`、`isProcessingComplete()`→`isProcessingCompleteFor(...)`、`buildEvidence()`→`buildEvidenceFor(context, finalHtml)`にパラメータ化(既存関数は従来値を渡すだけの委譲に変更)。
  - app.js: `window.goal2Engine`を公開: `init()`(ルール読込)、`analyze({html, pageTitle, oldUrl, ruleScopeMode})`、`autoAcceptSafe(candidates)`(既存`canBulkAcceptCandidate`基準で自動採用、actor="goal1-batch")、`buildFinalHtml()`、`buildEvidence()`、`sessionIdFor()`。直列実行前提(analysisContext/llmUsageがモジュールレベルのため)とコメントに明記。
  - `loadRules()`内の`els.ruleStatus.textContent`書き込み2箇所をnullガード(ヘッドレスページで唯一クラッシュした箇所。ライブ検証で発見)。
- 検証: `node --check`成功。**回帰チェックは件数だけでなく、変更前(git stash)と変更後の全サンプル×ルール別内訳のJSONをdiffし完全一致(byte-identical)を確認**(11/10/23/29/5/20)。ヘッドレス動作はUI要素の無いページに両スクリプトを注入し、抽出→候補生成→自動採用→最終HTML→証跡構築の全経路がpageerrorゼロで完走することを確認。goal2画面(サンプル読込→候補生成→採用→出力)・goal3画面(貼り付け→抽出)のスモークもpageerrorゼロ。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/public/goal3.js`

## 2026-07-14: GOAL1構築指示書を作成(実装は未着手)

- 背景・目的: ユーザーから「GOAL1に取り掛かりたいのでまずは設計を」との依頼。設計案(ブラウザ側バッチ実行・エンジンのヘッドレス化先行・自動採用は既存の一括採用基準を単一ソースとして再利用・IndexedDB保存・入力はCSV/URL一覧/ローカルHTMLファイルの3系統)を提示し、ユーザーが承認。実装は別のAGENT(Sonnet)が行うため、指示書として文書化した。
- 主な内容: `goal2-app/GOAL1_BUILD_INSTRUCTIONS.md` を新規作成。確定済み設計判断(6項目)、既存コード構造の実装に必要な事実(app.js/goal3.jsのIIFE構造とels依存箇所、canBulkAcceptCandidate、goal3.toGoal2引き継ぎ等)、ユーザー提供の移行管理CSV実物(安城市50行)に基づくCSV入力仕様(CP932エンコーディング、22列、列名解決、重複URL許容)、画面設計、PR-A〜Dの実装ステージと合格条件、回帰チェック手順(基準値11/10/23/29/5/20+検証スクリプト全文)、E2E検証の環境制約(外部URL取得不可のためHTMLファイル経路で検証)、リポジトリ運用ルール(日本語対応・コミット前確認・CHANGELOG/project-state更新・APIキー厳守事項・依存追加禁止)を収録。
- 関連ファイル: `goal2-app/GOAL1_BUILD_INSTRUCTIONS.md`(新規)
- 実装着手はユーザー指示待ち。

## 2026-07-14: rowspan行の行見出し(th scope=row)欠落を修正

- 背景・目的: 直前のPR(rowspan誤ヘッダー化バグ修正)で残課題として報告した非対称の解消をユーザーから依頼された。「講座の実施日程」表で、rowspanの行グループ見出し「火曜日」と同じ行にある「親子で学ぶ防災講座」だけが`<td>`のままで、他の2行の同じ列(「初めての救急講習」「読み聞かせボランティア説明会」)は`<th scope="row">`になっており、同じ意味の列なのに一貫性がなかった。
- 原因: `buildDataTableSemanticsHtml()`のtbody構築処理は、各行のDOM上0番目のセルを機械的に行見出し(`scope="row"`)としていた。rowspanの行グループ見出しセル(「火曜日」)がその行のDOM上0番目を占めるため、その行では本来の行見出しであるはずの「親子で学ぶ防災講座」がDOM上1番目にずれてしまい、見出し扱いされていなかった(rowspanが無い他の2行は0番目がそのまま行見出しなので問題なかった)。
- 修正: 行をまたいで「rowspanが後何行分残っているか」を追跡する`rowSpanCarry`カウンタを導入。rowspanを開始する行(このカウンタが0の状態でDOM上0番目のセルにrowspanがある行)だけ、行見出しの位置を1番目にずらす。rowspanの影響を受けない全ての表(このリポジトリの他のサンプル表を含む)は`rowSpanCarry`が常に0のままなので、今回の変更による影響を受けない。
- 検証: `node --check`成功。Playwrightで既存6サンプルの検出件数(11/10/23/29/5/20)が完全一致(回帰なし)。`tables`サンプルの全candidateのbefore/after HTMLをダンプし、「講座の実施日程」表で3行すべての講座名が`<th scope="row">`になり非対称が解消されたこと、他の全テーブル候補(rowspanを含まないもの)の出力が一切変化していないことを確認。
- 関連ファイル: `goal2-app/public/app.js`

## 2026-07-14: テーブル分解ロジックの見出し重複バグ・空セル混入バグを修正

- 背景・目的: ユーザーから、表が文書冒頭にあるサンプル(`tables`サンプルの「申込書類」表)で見出しレベルが不正に修正され、それ以外の候補でも表のヘッダーだけが残っておかしい、との指摘。実際に候補のbefore/after HTMLを全件ダンプして調査し、2件の独立したバグを特定した。
- バグ1(見出し重複): `decomposeLayoutTable()`(`table.cell-merge-file`/`table.cell-merge-layout`/`table.layout-table`が共通で使う表分解ロジック)は、3列以上の行で先頭セルが短い平文の場合、残りのセルが全て単純なら先頭セルを独立した見出し(`<h3>`〜)に昇格させていた。この結果、「参加申込書｜PDFリンク｜提出期限」のような通常の3列レコード行が「参加申込書」という見出しに化け、直前の表見出し(同じく`<h3>`の「申込書類」)と同じレベルの見出しが不要に重複していた。2セル行を`<strong>ラベル</strong> 値`という1つの段落にまとめる既存ロジック(2セル限定)を3セル以上にも一般化し、「先頭セル=見出し、残り=リスト」という別解釈の分岐を削除。これにより多列レコード行は常に1つの段落として扱われ、存在しない見出しが生成されなくなった。
- バグ2(空セル混入): `buildDataTableSemanticsHtml()`(`table.caption`の構造再構築ロジック)の行パディング処理が、列数に満たない行へ空の`<td>`を追加する際、セルの`colspan`を無視して「DOM上の子要素数」だけで判定していた。このため、`colspan="3"`で表全体を占める見出し行に対しても本来不要な空`<td>`が2個追加され、無意味な空セルが残るテーブル構造になっていた。`colspan`を合算して実際に占有している列数を数えるよう修正。
- バグ3(rowspan行の誤ヘッダー化、ユーザー依頼により追加調査・修正): `dataTableProfile()`の`firstRowHeaderLike`判定が、先頭行のセルが「短い平文かどうか」だけで見出しらしさを判定しており、`rowspan`で複数行にまたがる行グループラベル(例:「対象区分」)を含む行も見出し行と誤認していた。この結果、`対象者一覧`サンプルのような表で、本来はデータ値である「乳幼児の保護者」「午前」「●」が実在しない列見出しとして`<thead>`に昇格し、元データが失われていた。先頭行のいずれかのセルに`rowspan`があれば見出し行候補から除外するよう修正し、あわせて`buildDataTableSemanticsHtml()`のtbody構築処理で、rowspan付きの行見出しセルには`scope="row"`ではなく行グループを表す`scope="rowgroup"`を付与するよう修正。列見出しが元データに存在しない場合は既存の汎用見出し(「項目」「内容1」…)にフォールバックする(他の表と同じ既存パターン)。
- 検証: `node --check`成功。表示・構造のみの変更で候補生成ロジック自体(候補の有無・件数)は変更していないため、Playwrightで既存6サンプルの検出件数(11/10/23/29/5/20)が完全一致することを確認(回帰なし)。`tables`サンプルの全candidateのbefore/after HTMLをダンプし、ユーザー報告の「申込書類」表で見出し重複が解消されたこと、`table.caption`の複数ケースで空セルが解消されたこと、`対象者一覧`表でデータ消失が解消されたことをスクリーンショットで確認。
- 既知の残課題(意図的に未対応): rowspan行(1行目)の2列目だけが`<td>`のままで、2・3行目の同じ列が`<th scope="row">`になる非対称が残る。これはDOM上のセルindexとrowspanによる視覚的な列のズレに起因し、完全に直すには表全体をグリッド展開して列位置を再計算する設計変更が必要なため、今回はデータ消失という重大な不具合の解消を優先し、この軽微な非対称は許容した。
- サンプル内容の見直し: バグ3の修正確認中、ユーザーから「そもそも表として成立していないので修正前の表をもう少し現実的にしよう」との指摘。元の`対象者一覧`表は、rowspanラベル「対象区分」(対象の種別)と各行の実際の対象("乳幼児の保護者"等)が意味的に重複しており、実在の表としては不自然だった。`tables`サンプルを、rowspanが実務でよく使われる自然な用途(同じ曜日に複数の講座が開催される日程表、`<caption>講座の実施日程</caption>`、火曜日の3講座をrowspanでまとめる形)に差し替えた。修正後も候補件数(23件)は変わらず、`table.cell-merge-layout`(段落へのまとめ)・`table.caption`(データ表として維持)の両方の修正方法が、新しい内容でも正しく動作することをスクリーンショットで確認。
- 関連ファイル: `goal2-app/public/app.js`

## 2026-07-14: 修正候補一覧・修正方法カードのセル結合ラベルを分かりやすく変更

- 背景・目的: ユーザーから「修正候補のラベルで特にセル結合がわかりにくいのでここも整理しましょう」との指摘。`table.cell-merge-*`系6ルールは、KBの元となる公式マニュアル(V2.01)のページ内番号に合わせた「セル結合①レイアウト用途」「セル結合②見出し用途」のような丸数字付きタイトルをそのまま候補一覧・修正方法カードのタイトルに使っており、番号自体に意味がないため作業者には何が起きるのか一見して伝わらないことを確認した。
- 主な変更内容: `goal2-app/public/app.js`に新規ヘルパー`candidateDisplayTitle(candidate)`を追加。`table.cell-merge-*`ルールに限り、候補生成時点で既に`classifyMergedCellTable()`が状況ごとに書き分けている`candidate.issue.message`(例:「先頭の結合セルが見出し用途に見えます」「概要説明用途に見える結合セルがあります」)を末尾の句点を除いて表示タイトルとして使うよう変更。候補一覧のカードタイトル・チェックボックスのaria-label・カード本体のaria-label・詳細画面の「修正方法」カードタイトルの計4箇所に適用。KBブラウザ表示や決定内容のエクスポート(`selected_method_title`)など、マニュアルのページ番号と対応させたい箇所の`rule.title`自体は変更していない(公式マニュアルとの対応関係を壊さないため)。
- 検証: `node --check`成功。表示専用の変更で候補生成ロジックは変更していないため、Playwrightで既存6サンプルの検出件数(procedure-overview 11 / images 10 / tables 23 / links-text 29 / iframe 5 / goal3-hirosaki-news2019 20)が完全一致することを確認(回帰なし)。`tables`サンプルの実際の画面で、候補一覧の5件のセル結合候補すべてが丸数字なしの状況説明文で表示されること、詳細画面の「修正方法」カードでも同様に表示されることをスクリーンショットで確認。
- 関連ファイル: `goal2-app/public/app.js`

## 2026-07-13: 修正候補一覧の「選択中」カードの視認性を改善

- 背景・目的: ユーザーから「修正候補のcurrentの色合いが差別化できていないので明確にいま選択していることがわかるように調整しましょう」との指摘。既存の選択中スタイル(`.candidate-item[aria-selected="true"]`)は背景を`var(--primary-container)`(淡い青)に変えるだけで、特に(1)「同じ箇所の候補」グループのコンテナ自体が同系統の淡い青背景を持つ場合、(2)未処理カードの白背景との差が小さい場合、に選択中カードが一覧の中で目立ちにくいことをスクリーンショットで確認した。
- 試行錯誤の経緯:
  1. 初回実装として`box-shadow`によるインセットリング+外側グローを追加しつつ、背景を`var(--primary-container)`から`var(--primary)`方向へごく僅か(4%)だけ深色化。ユーザーから「もっと目立つ色にしたい」とフィードバックがあり、50%まで濃い青に強化。
  2. 再度ユーザーへ確認したところ「反対色など青とは別の色にしましょう」との指摘。青(`--primary`)はこのUIで既にリンク・フォーカスリング・「同じ箇所の候補」グループのコンテナ枠など随所に使われており、選択中カードをどれだけ濃い青にしても既存の青系ノイズに埋もれてしまう、という根本的な問題を認識。マゼンタ/バイオレット系(`#9c1f8a`)へ変更し提示したが、ユーザーから「毒々しいので別の色相にしましょう」と再指摘。
  3. ユーザーから「対照色相配色(基準色から120°〜150°ずらす配色技法)」の色相環図を共有され、これを参考にくすみベリー(赤紫寄り)・くすみモス(黄緑寄り)の2案を作成して提示したが、ユーザーは別途、参考パレット(`--color-primary: #2f5fdb` / `--color-secondary: #552fdb` / `--color-accent: #dbab2f`等)を提示し「この中から選ぶなら」と質問。分析の結果、primaryは既存`--primary`そのもの、secondaryは既存の見出しh4タグ色(`#6a5aa8`、色相差約1°)とほぼ同一色相で、どちらも「青系から離す」目的に合わないと判断。accentの`#dbab2f`(ゴールド)が最も妥当だが、既存の`--warning`(琥珀、要確認バッジの色)と色相差約4°で近すぎることも判明。
  4. 色相を`--warning`から約15.9°離しつつ明度・彩度を上げて視覚的にも区別しやすくした調整版`#938915`を提案し、ユーザーが選択。
- 最終的な変更内容: `goal2-app/public/styles.css`の`:root`に、この用途専用の新しいアクセント色`--selected`(ゴールド系、`#938915`)・`--selected-container`(`#f7f4d4`)・`--on-selected-container`(`#4e490e`)を新設。`.candidate-item[aria-selected="true"]`はこれらを使い、背景`color-mix(in srgb, var(--selected-container), var(--selected) 50%)`、`box-shadow`によるインセットリング+外側グローを`var(--selected)`基準に変更。カード内の補足テキスト(`.candidate-meta`)は選択中に限り`color: var(--on-selected-container)`へ切り替え、Pythonスクリプトで事前にコントラスト比を確認(本文側`--text`は約9.1:1、補足テキスト側`--on-selected-container`は約4.8:1、いずれもWCAG AAの4.5:1を上回る)。`border-width`は変更していないため、選択時にカードサイズが変わってレイアウトがずれることもない。
- 実装中に自己発見・解決した検証上の落とし穴: 青系で試行していた段階のPlaywrightスクリーンショット検証で「色を50%まで濃くしたのにほとんど変わっていないように見える」現象に遭遇したが、CSSの不具合ではなく、`page.click()`後にマウスカーソルが要素上に残ったままスクリーンショットを撮っていたため`button:hover:not(:disabled)`ルール(`background: var(--surface-2)`)が選択中スタイルを覆い隠していた検証スクリプト側の問題と判明。`page.mouse.move(0, 0)`でカーソルを退避してから再検証するよう3本の検証スクリプトを修正し、以降は正しい状態で確認できるようにした。
- 検証: `node --check`成功(CSSのみの変更で候補生成ロジックには影響しないため、既存サンプルの回帰確認は対象外)。Playwrightのスクリーンショット(マウスカーソルを退避した状態)で、(1)通常の未処理カードとの対比、(2)「同じ箇所の候補」グループ内での対比、(3)採用済み(グレー背景)カードが選択された場合でも選択中スタイルが正しく優先されて見えること、の3パターンを確認し、いずれも選択中カードのゴールドが既存の「要確認」バッジ色とも十分に区別できる形で一見して明確に識別できることを確認。
- 関連ファイル: `goal2-app/public/styles.css`

## 2026-07-13: サンプルデータの内容充実(未検出だった15ルールを追加)、テーブル判定ロジックの重複バグ・英語テキスト混入バグを修正

- 背景・目的: ユーザーから「サンプルをもう少し充実させましょうか。今の系統はよいのでその内容を充実させていきましょう」との依頼。既存6サンプルを実際に解析し、KB全59ルールのうちどれが一度も候補化されていないか調査した結果、20ルールが未検出と判明。うち5件(`image.heritage-image`/`image.showcase-section`/`text.abbreviation`/`text.quotation`/`text.spaced-characters`)は検出コード自体が未実装(別タスク)、残り15件は検出コードは存在するがサンプルHTMLに該当パターンが含まれていないだけと判明したため、既存3サンプル(procedure-overview/links-text/tables)へ自然な内容として追加する方針とした。
- 主な変更内容:
  - `goal2-app/public/app.js`の`inputSamples`配列を拡張。
    - `procedure-overview`: `html-structure.embedded-script-behavior`(meta refresh)、`html-structure.duplicate-id-accesskey`(id重複)、`html-structure.heading-required`(「担当課」パターン)、`link.internal-link`(通常の内部リンク)を追加。
    - `links-text`: `html-structure.deprecated-elements`(marquee)、`html-structure.heading-content-quality`(記号のみの見出し「▲」)、`link.in-page-anchor`、`link.cross-page-anchor`、`link.link-purpose-standalone`(同一リンクテキストで異なるリンク先)を追加。
    - `tables`: `table.th-scope`(th要素にscope属性なし)、`table.format-clear`(bgcolor/cellspacing付きテーブル)、`table.cell-merge-heading`(先頭の結合セルが見出し用途)を追加。
  - 実装過程で2件の既存バグを自己発見・修正(サンプル追加とは独立した、以前から存在していた不具合):
    1. **`table.cell-merge-heading`/`table.cell-merge-summary`の重複候補バグ**: `classifyMergedCellTable()`が「見出し用途」と判定した結合セルについて、`collectTableCandidates()`の直接プッシュと`planTableTreatment()`末尾のcatch-allの両方が、`shouldPreserveAsDataTable(table)`がfalseの場合に全く同一の候補を二重生成していた(実際に「対象となる施設」のような具体的な数字・キーワードを含まない結合セル表を投入すると再現)。`planTableTreatment()`末尾のcatch-all(`if (mergeRule) { return {kind: "structural", ...} }`)を`return { kind: "data" }`に単純化し、`collectTableCandidates()`側の直接プッシュだけで完結するよう修正(既存の`table.cell-merge-note`等、`shouldPreserveAsDataTable`がtrueになるケースは`planTableTreatment()`の別分岐で処理されるため無関係、回帰なし)。
    2. **テーブル関連候補メッセージへの英語テキスト混入**: `table.format-clear`(message/reason)、表にキャプションが無い場合の簡易追加候補(`table.caption`、しかも実際に挿入される`<caption>`要素の中身も英語の"Table details"だった)、データ表として維持する構造的リビルド案内(`table.caption`)、`table.layout-table`の判定メッセージ、`table.cell-merge-*`系の理由末尾に付与される補足文、の計7箇所が日本語話者の作業者に英語のまま表示される状態だった。全て日本語へ修正(「Table details」は既存の`genericTableCaption`定数[="表の詳細"]を使うよう統一)。
  - 検証: `node --check`成功。Playwright回帰確認の結果procedure-overview 7→11、tables 14→23、links-text 24→29に増加(いずれも新規追加分)、images/iframe/goal3-hirosaki-news2019は変化なし(10/5/20)。ルールカバレッジは41/59→53/59ルールに向上(残り8件は上記の理由でサンプル追加では埋められない/または既存の別名で実質カバー済み)。追加した各テーブルパターンが意図通りのルールを発火し、重複候補が発生しないことを個別に確認。修正後のメッセージが全て日本語で表示されることをスクリーンショットで確認。
  - **回帰ベースライン更新**: procedure-overview **11**(旧7) / images 10 / tables **23**(旧14) / links-text **29**(旧24) / iframe 5 / goal3-hirosaki-news2019 20。
- 関連ファイル: `goal2-app/public/app.js`

## 2026-07-13: 見出し候補の「文言を調整」に見出しレベル選択機能を追加

- 背景・目的: 前回のheading-review拡張(見出しレベルのAI文脈判定)をマージした後も、ユーザーから「写真と言葉の展覧会 ～或る日の大鰐線で～ はレベル２になっていません。これ作業者が自分で修正できるようにできないですか？見出しに限らないですが」との指摘。前回の機能は「AIが正しいと判断すれば候補として提案する」だけで、AIの判定が違う・GEMINI_API_KEY未設定でAI候補自体が出ない、といったケースでは作業者に手段が無かった。「見出しに限らないですが」という補足を踏まえ、(1)見出しレベル選択機能(推奨・既存候補への機能追加として実装容易)、(2)修正後HTMLの自由編集、(3)手動での新規候補追加、の3案を提示し、(1)が選択された。
- 主な変更内容:
  - `goal2-app/public/app.js`: `quickEditConfig()`の見出し系(`html-structure.*`)分岐を、見出し文言のみ編集できる`mode: "element-text"`から、見出しレベル(h2〜h6のプルダウン)と見出し文言の両方を編集できる`mode: "heading"`へ変更。`firstElementTagName()`ヘルパーを新設し、候補の現在の見出しレベルを初期選択値として表示。`renderQuickEditPanel()`に見出しレベル用の`<select id="quickEditLevel">`を追加、`buildQuickEditedAfterHtml()`に選択されたレベルへ要素をリネームする処理を追加(既存の`renameElement()`とは別に、テンプレート内のノードを直接差し替えるインライン実装。`renameElement()`は`data-goal2-node-id`付きの実DOM要素向けで、こちらはafter_html生成用の一時テンプレート内ノード向けのため使い分けた)。
  - この機能は、既存の`quickEditConfig()`の仕組みをそのまま使うため、対象箇所にすでに何らかの見出し候補(機械的またはAI提案)が存在する場合にのみ使える(候補が1件も無い見出しには使えない、という制約はユーザー合意済み)。
  - `goal2-app/public/styles.css`: `.quick-edit-panel select`にも既存のinput/textareaと同じスタイルを適用。
  - `goal2-app/WORKER_GUIDE.md`: 「4つの判断ボタン」節に、見出し候補での「文言を調整」でレベルも選び直せる旨を追記。
- 検証: `node --check`成功。`GEMINI_API_KEY`未設定でPlaywright回帰確認(既存6サンプル7/10/14/24/5/20が完全一致、回帰なし)。Playwrightで、機械的候補(h6→h4がデフォルト提案の見出し)を選択し、レベルをデフォルトのh4ではなくh5へ変更して「この内容で採用」した結果、実際に`<h5>...</h5>`として採用されることを確認(デフォルト値をそのまま使うだけでなく、作業者が別の値へ上書きできることを確認)。スクリーンショットで見た目(レベルセレクトと文言入力欄が並んで表示されること)を目視確認。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/public/styles.css`、`goal2-app/WORKER_GUIDE.md`

## 2026-07-13: heading-review(LLM)に、文脈から見出しレベルの妥当性を判定する機能を追加

- 背景・目的: ユーザーから、弘前市サンプルの「写真と言葉の展覧会　～或る日の大鰐線で～」(`<h4>`)は見出しレベル2になるべきだが、そうなっていないとの指摘。「文脈で見出しの順序を判断できますか?」との質問。調査の結果、既存の機械的検出`collectHeadingCandidates()`(`html-structure.heading-order`)は「直前の見出しより2階層以上深くならないか」という単純な単調性チェックのみで、この文書内の実際の見出し系列(h4→h3→h6→h4)を辿ると、2つ目のh4は直前の見出し(h3経由でh4相当まで戻ったh6→h4補正後の状態)から見て1階層しか深くなっていないため、機械的には全く検出されないことが判明した。これは複数の独立したお知らせ記事が1つの文書に連結されているGOAL3抽出データ特有のパターンで、後続記事のタイトル見出しが、直前の記事内の無関係な小見出しの階層に引きずられてしまう。この判定には文書全体の内容理解が必要なため、既存の`heading-review`LLMタスク(`enrichHeadingReviewWithLlm`)を拡張する方針とした。
- 主な変更内容:
  - `goal2-app/lib/llm-prompts.js`: `heading-review`タスクのプロンプトに(3)見出しレベルの妥当性判定を追加。「複数の独立したセクションが並ぶ場合、直前の無関係な見出しの階層に引きずられて本来同じレベルであるべき見出しが不自然に深いままになっている」パターンを優先確認するよう指示。`responseSchema`に`heading_level_fixes`(`block_id`・修正後レベル・理由の配列)を追加。
  - `goal2-app/public/app.js`: `applyHeadingReviewResult()`に`heading_level_fixes`の処理を追加。対象block_idにすでに機械的(または他のLLM判定による)`html-structure.heading-order`候補が存在する場合は、その`after_html`/`patch`/`reason`をLLMの文脈判断で上書き(既存候補の更新パターン)。存在しない場合は新規候補として追加(新規候補提案パターン、heading-review本来の設計に準拠)。実装中に自己発見・修正したバグ: 上書きパスで`renameElement()`の出力をそのまま`existing.proposal.after_html`へ代入していたため、内部属性`data-goal2-node-id`がユーザー向けのafter_htmlへ漏れる不具合があった(新規候補パスは`makeCandidate()`が内部で`cleanHtml()`するため無事だったが、上書きパスは直接代入のため素通りしていた)。他の直接代入箇所(1190行目・1294行目・1776行目)と同様に`cleanHtml()`でラップして修正。
- 検証: `node --check`成功。`GEMINI_API_KEY`未設定でPlaywright回帰確認(既存6サンプル7/10/14/24/5/20が完全一致、回帰なし)。Playwrightで`/api/llm/enrich`をモックし、(1)「写真と言葉の展覧会」への新規レベル修正提案が実際に`<h4>...</h4>` → `<h2>...</h2>`の候補として生成されること、(2)既存の機械的候補(1つ目の記事タイトル)へLLM判定結果を適用した場合、新規候補が重複生成されず既存候補が正しく上書きされること、(3)上書き後の`after_html`に内部属性が含まれないこと、の3点を確認。
- ライブ検証で自己発見・修正した追加の問題: ユーザー提供のテスト用APIキーで弘前市サンプル(36ブロックの見出し・段落アウトライン)全体を対象にheading-reviewを呼び出したところ、`"Gemini request failed: This operation was aborted"`で失敗。原因は`lib/llm.js`の`REQUEST_TIMEOUT_MS`(20秒)を、今回追加したプロンプト(3)・レスポンススキーマの拡張により生成トークン数が増え、単一リクエストで文書全体を送る`enrichHeadingReviewWithLlm`(他タスクと異なりバッチ分割していない、文書全体の文脈が必要なため意図的に非分割)の応答時間が超過したこと。実測では36ブロック分のフルリクエストで約29.5秒かかった。バッチ分割は文書全体を横断する比較推論(「1つ目の記事見出しと2つ目の記事見出しは同じレベルであるべき」)を壊すため不適当と判断し、`REQUEST_TIMEOUT_MS`を20000→45000に引き上げて対応(全Geminiリクエスト共通の上限のため、他の短いリクエストの挙動には影響しない、待ち時間の上限を伸ばすだけの変更)。
- 修正後、テスト用APIキーで再度ライブ検証。実際に`n0034`(「写真と言葉の展覧会　～或る日の大鰐線で～」)に対して`{"level":"2","reason":"...他のイベント記事のタイトル（n0001）と並列に扱うべきであるため、より上位のレベル（h2）が適切です。"}`という判定が返り、UI経由でも`<h4>写真と言葉の展覧会　～或る日の大鰐線で～</h4>` → `<h2>写真と言葉の展覧会　～或る日の大鰐線で～</h2>`の新規候補として正しく生成されることを確認(1つ目の記事タイトル・チラシダウンロードリンクの既存2件の機械的候補も維持)。`GEMINI_API_KEY`未設定でのPlaywright回帰確認(既存6サンプル完全一致)も再実施。動作確認後、テスト用APIキーは削除済み。
- 関連ファイル: `goal2-app/lib/llm-prompts.js`、`goal2-app/public/app.js`、`goal2-app/lib/llm.js`

## 2026-07-13: 単独の文頭「・」を箇条書き化、単発の「※」を注意ではなく修正候補として表示

- 背景・目的: ユーザーから、弘前市サンプルで「単独の文頭の「・」」「※」が「修正対象に入っていません」との指摘。調査の結果2つの独立した原因が判明した。
  1. `collectPseudoListCandidate()`が使う`buildPseudoListHtml()`は、中黒(・)を先頭に持つ行が**2件以上**ないと箇条書き化しない設計だった。弘前市サンプルの`<p>・上映終了後、参加者同士で映画を見て感じたことやテーマについて話し合うワークショップを開催します。</p>`は、直前直後に同様の「・」段落がない単独の1件のみだったため、候補が一切生成されていなかった。
  2. `text.note-symbol`(単発の注釈記号※)は、`noticeRuleIds`と`isNoticeItem()`の特別扱いにより、構造化・統合できるパターンは修正候補として表示される一方、対応する構造化先が見つからない単発の「※」(例:`<p>※受付は午後１時から</p>`)は`patch_mode: "none"`のため機械的に「注意」(出力欄の補助情報。決定を記録しない一覧)へ格下げされていた。ユーザーが期待していたのは「修正候補」として明示的に採用/文言調整/却下/要確認のいずれかを判断できることだった。
- 主な変更内容:
  - `goal2-app/public/app.js`の`buildPseudoListHtml()`に、`bulletParts.length === 1 && parts.length === 1`(単一の段落全体が「・」で始まる、グループ化できる兄弟行がない)の場合の新しい分岐を追加。この場合も`<ul><li>...</li></ul>`(単一項目リスト)へ変換する。既存の2件以上のケースと同じ`confidence: "high", requiresHumanReview: false`の機械的候補として扱う。
  - `noticeRuleIds`から`"text.note-symbol"`を削除し、`isNoticeItem()`内の同ルール専用の特別扱い(もはや不要になった条件分岐)も削除。これにより`text.note-symbol`の全てのケース(統合提案・構造化提案・単発の3パターン全て)が一律で「修正候補」として表示され、明示的な決定(採用/文言調整/却下/要確認)を残せるようになった。
- 検証: `node --check`成功。Playwright回帰確認の結果、procedure-overview/images/tables/links-text/iframeの5サンプルは完全一致(7/10/14/24/5)で変化なし。**goal3-hirosaki-news2019のみ19→20に増加**(新規の単独「・」箇条書き化1件が追加されたぶん。「※」2件は候補と注意の間で再分類されただけで合計件数には影響しない)。この20が新しい回帰ベースラインとなる。実際に生成された候補(`<p>・上映終了後...</p>` → `<ul><li>上映終了後...</li></ul>`、`<p>※受付は午後１時から</p>`が採用/文言調整/却下/要確認ボタン付きの通常候補カードとして表示されること)をPlaywrightのスクリーンショットで目視確認。
- 関連ファイル: `goal2-app/public/app.js`
- **回帰ベースライン更新**: procedure-overview 7 / images 10 / tables 14 / links-text 24 / iframe 5 / goal3-hirosaki-news2019 **20**(旧19から+1)。

## 2026-07-13: ブラケットラベル段落を、重複挿入ではなくラベル自身の見出し化に変更

- 背景・目的: 直前の修正(下記エントリ参照)では、`<p>【とき】</p>`のようなカッコ書きラベル段落の直前に新規見出しを重複挿入する不具合を「候補を出さない」形で抑制した。ユーザーから「`<h4>開催日時</h4><p>【とき】</p>`であれば`<h4>とき</h4>`と修正させてほしい」との要望があり、単に抑制するだけでなく、ラベル段落自身をカッコを外した見出し要素へ変換する(ラベルをそのまま見出しとして昇格させる)動作に変更した。
- 主な変更内容:
  - `goal2-app/public/app.js`: `SHORT_BRACKET_LABEL_PATTERN`を、開き括弧・閉じ括弧の対応が取れたものだけにマッチするよう書き直し(`【...】`/`[...]`/`［...］`/`(...)`/`（...）`)、内部のラベル文言をキャプチャできるようにした。新設した`extractBracketLabelText(text)`がマッチしたラベル文言(カッコを除いたもの)を返す。`applyHeadingReviewResult()`のmissing_headings処理を、ブラケットラベル段落を検出した場合は候補生成をスキップする代わりに、そのラベル段落自体を`<h${level}>${ラベル文言}</h${level}>`へ丸ごと置き換える(元の`<p>`要素は残さない)候補を生成するよう変更。
  - `goal2-app/lib/llm-prompts.js`: `heading-review`タスクのプロンプトを、「ブラケットラベル段落は提案対象から除外する」指示から「ブラケットラベル段落自身をbefore_block_idに指定し、suggested_textにはカッコを外したラベル文言をそのまま入れる」指示へ変更。
- 検証: `node --check`成功。`GEMINI_API_KEY`未設定でPlaywright回帰確認(既存6サンプル7/10/14/24/5/19が完全一致、回帰なし。この機能はLLM呼び出しが発生する場合のみ関与)。Playwrightで`/api/llm/enrich`をモックし、`【とき】`段落をbefore_block_idに指定した提案が、実際に`<h4>とき</h4>`(元の`<p>`要素を含まない、ラベルからカッコを除いただけの見出し)へ変換されることを確認。あわせて、ブラケットラベルでない通常の長文段落への正当な見出し提案(見出し+元の段落を維持する従来の挙動)が引き続き機能することも確認。さらにユーザー提供のテスト用APIキーで実際のGemini呼び出しによるライブ検証を実施し、弘前市サンプルの8件全てのカッコ書きラベル段落(【とき】×2/【ところ】/【内容】×2/【定員】/【参加料】/【申込み方法】)が正しく`<h4>とき</h4>`等へ変換され、重複候補が0件であること、通常の長文段落への正当な見出し提案(「イベント概要」「展覧会概要」)は引き続き機能することを確認。動作確認後、テスト用APIキーは削除済み。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/lib/llm-prompts.js`

## 2026-07-13: heading-review(見出し提案)がブラケットラベル段落を重複した見出しにしてしまう不具合を修正

- 背景・目的: ユーザーから、弘前市サンプルで`<p>【とき】</p>`の直前に`<h4>開催日時</h4>`を挿入する提案が出て「内容が重複した修正になってしまう」との指摘。「【とき】」「【ところ】」等のカッコ書きラベルは、それ自体が既に見出し相当の役割を果たしている段落であり、その直前に意味の重なる新規見出しを挿入すると視覚的・意味的に二重表現になる。
- 主な変更内容:
  - `goal2-app/public/app.js`: `SHORT_BRACKET_LABEL_PATTERN`(段落全体が`【...】`/`[...]`等の短いカッコ書きラベルのみで構成されているかを判定する正規表現)を新設。`applyHeadingReviewResult()`のmissing_headings処理で、LLMが提案した`before_block_id`の対象段落がこのパターンに一致する場合は候補生成をスキップするガードを追加(LLM側の判断結果に関わらず機械的に防止する安全策)。
  - `goal2-app/lib/llm-prompts.js`: `heading-review`タスクのシステムプロンプトに、カッコ書きラベル段落を見出し提案の対象にしないよう明示的な指示を追加(根本原因側の抑制)。
- 検証: `node --check`成功。`GEMINI_API_KEY`未設定でPlaywright回帰確認(既存6サンプル7/10/14/24/5/19が完全一致、回帰なし。この修正はLLM呼び出しが発生する場合のみ関与するため未設定時は無影響)。Playwrightで`/api/llm/enrich`をモックし、(1)`【とき】`段落をbefore_block_idに指定した`開催日時`見出し提案が実際に0件の候補になること(ガードが機能)、(2)カッコ書きラベルでない通常の長文段落への正当な見出し提案は従来通り候補として生成されること、の両方を確認(過剰抑制になっていないことも確認済み)。さらにユーザー提供のテスト用APIキーで実際のGemini呼び出しによるライブ検証を実施し、弘前市サンプルで`【とき】`等のカッコ書きラベルに重複する見出し提案が0件であること、一方で正当な見出し(「イベント概要」「展覧会概要」)は引き続き提案されることを確認。動作確認後、テスト用APIキーは削除済み。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/lib/llm-prompts.js`

## 2026-07-13: 候補の詳細パネルに「このルールについて詳しく確認する」モーダルを追加

- 背景・目的: ユーザーから「作業者がこの修正はどんな意味かと気になった際に確認して学習する仕組みがあると良い」との要望。KBのルールMarkdown(`a11y-migration-kb/rules/**/*.md`)には元々、短い説明(`description`)だけでなく、必須ルールの全文(`rule`)と修正前後の実例(`examples`)が含まれ、`data/rules.jsonl`ビルド経由でサーバーの`/api/rules`はすでにこれらのフィールドを返していたが、クライアント側(`makeCandidate()`)では`title`/`source`/`description`のみを`candidate.rule`へ転記しており、`rule`本文と`examples`は画面上どこにも表示されていなかった。既存データを活かす形で実装した。
- 主な変更内容:
  - `goal2-app/public/app.js`: `makeCandidate()`の`rule`オブジェクトに`rule_text`(KBの必須ルール全文)・`examples`(修正前後の実例配列、最大3件表示)を追加。当初は折りたたみ`<details>`で実装したが、ユーザーから「折りたたみではなくモーダル表示にしましょう。集中しやすいので」とのフィードバックを受け、`#analyzeOverlay`/`#previewExpandOverlay`と同じ`inert`+フォーカス管理パターンのモーダルダイアログ(`#ruleLearnMoreOverlay`)に変更した。`renderDetail()`の「この候補で変わること」カード内、要約リストの直後にトリガーボタン(`.rule-learn-more-trigger`)のみを配置し、クリック時に`openRuleLearnMore(candidate)`がルールタイトル・重複除去したWCAG/JIS番号・概要・ルール全文・実例(ケース名/修正前/修正後/ポイント)・出典をモーダル本文へ描画する。「閉じる」ボタン・背景クリック・Escキーのいずれでも閉じられ、閉じた後は元のトリガーボタンへフォーカスを戻す。
  - `goal2-app/public/index.html`: `#analyzeOverlay`/`#previewExpandOverlay`と同じbody直下兄弟パターンで`#ruleLearnMoreOverlay`(タイトル・閉じるボタン・本文コンテナ)を新設。
  - `goal2-app/public/styles.css`: `.rule-learn-more-trigger`(リンク調ボタン)と、`.preview-expand-overlay`と統一感のある暗幕+中央ダイアログスタイルの`.rule-learn-more-overlay`/`.rule-learn-more-dialog`/`.rule-learn-more-header`を新設。
  - `goal2-app/WORKER_GUIDE.md`: 「候補を選んで詳細を確認する」節に、このモーダルの説明(開き方・閉じ方)を追記。
- 検証: `node --check`成功。`GEMINI_API_KEY`未設定でPlaywright回帰確認(既存6サンプル7/10/14/24/5/19が完全一致、回帰なし)。Playwrightでモーダルを開き、`image.alt-text`候補の実例(公園の写真等)がKBのMarkdownと同じ内容で表示されること、`appMain.inert`の切り替え、「閉じる」ボタン・Escキー・背景クリックの3通りでの正しいクローズとトリガーボタンへのフォーカス復帰を確認。WCAG/JISの重複表示(既存の`各種情報`カードにあった`[...wcag, ...jis]`の連結による重複)は、この新セクションではSetで除去して表示。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/public/styles.css`、`goal2-app/WORKER_GUIDE.md`

## 2026-07-13: レンダリングプレビュー欄に拡大表示ボタンを追加

- 背景・目的: 3ペイン構成のうち右端のレンダリングプレビュー欄が狭く「印象が薄い」というユーザーからのUI/UXフィードバックを受け、3案(幅調整のみ/拡大表示ボタン追加/大規模レイアウト再構成)を提示し、中規模の「拡大表示ボタンを追加」案が採用された。
- 主な変更内容:
  - `goal2-app/public/index.html`: プレビュー欄の見出しに「拡大」ボタン(`#previewExpandButton`)を追加。`#analyzeOverlay`と同じ body直下の兄弟要素として、ほぼ全画面のダイアログ`#previewExpandOverlay`(タイトル・閉じるボタン・拡大用iframe`#previewFrameExpanded`)を新設。ユーザーから「レンダリングという言葉が作業者に理解しにくい」との指摘を受け、見出し・ダイアログタイトル・iframeのtitle属性を「レンダリング」→「プレビュー」表記に統一した。
  - `goal2-app/public/styles.css`: `.workspace-grid`の`grid-template-columns`をプレビュー列に厚めに配分(`0.82fr`→`0.97fr`等)。`.preview-expand-overlay`系のスタイルを、既存の`.analyze-overlay`(PR#46)と同じ暗幕+中央ダイアログのパターンで新設。
  - `goal2-app/public/app.js`: `renderPreview()`のsrcdoc生成ロジックを`buildPreviewHtml()`として切り出し、通常のプレビューiframeと拡大表示iframeの両方で共有。`scrollPreviewToSelectedCandidate()`を対象iframeを引数で受け取る形に一般化(既定値`els.previewFrame`)。`openPreviewExpanded()`/`closePreviewExpanded()`を新設し、`#analyzeOverlay`と同じ`inert`によるフォーカストラップ・フォーカス管理パターン(開く時は閉じるボタンへ、閉じる時はトリガーボタンへ)を踏襲。拡大表示は「閉じる」ボタン・背景クリック・Escキーのいずれでも閉じられる。
- 検証: `node --check`成功。`GEMINI_API_KEY`未設定でPlaywrightにより既存6サンプルの検出件数(procedure-overview 7 / images 10 / tables 14 / links-text 24 / iframe 5 / goal3-hirosaki-news2019 19)がベースラインと完全一致(回帰なし)。Playwrightで拡大ボタンのクリック→オーバーレイ表示・`appMain.inert=true`・拡大用iframeへの選択候補ハイライト反映を確認、その後「閉じる」ボタン・Escキー・背景クリックの3通りで正しく閉じることを確認。スクリーンショットで拡大表示の見た目(選択中候補のオレンジ枠ハイライト含む)を目視確認。
- 関連ファイル: `goal2-app/public/index.html`、`goal2-app/public/styles.css`、`goal2-app/public/app.js`、`goal2-app/WORKER_GUIDE.md`

## 2026-07-13: text.ascii-art(顔文字・AA)の自動検出を実装、41件のテストで100%精度を確認

- 背景・目的: 直前のUI/UXフィードバックで見送っていたAA(アスキーアート)区切り行の検出について、ユーザーから「AAと顔文字はできたら自動検出したいけどよい方向ないかな？」と再提案があった。正規表現単体では信頼性が低いという既存の判断を維持しつつ、「正規表現で緩く候補を拾い、Gemini APIで最終判定させる」という、`text.foreign-language`等で既に実績のある設計パターンを提案し合意を得た。「そもそもAIで最終判定できるものか」との質問に対し、顔文字は言語理解タスクとして得意、複数行AAはテキストパターン推論でやや不確実という誠実な評価を伝えた上で、`confidence: low`・`requires_human_review: true`・ライブ検証という既存の安全策で吸収する前提で実装した。
- 主な変更内容:
  - `goal2-app/lib/llm-prompts.js`: 新規タスク`ascii-art`を追加(`foreign-language`等と同じ配列バッチ形式)。3種類を判定: (1) 顔文字(kind: simple、言い換え案を`suggested_text`に)、(2) 同一記号8回以上連続する装飾目的の区切り行(kind: separator、hr要素への置換や読み上げ除外等の対応方針を`suggested_text`に)、(3) 複数行AA(kind: complex、alt候補の方向性を`suggested_text`に)。`matched_text`に該当箇所の原文をそのまま書き写させることで、後段での正確な文字列置換を可能にした。曜日・番号・ファイル情報等の通常の日本語括弧書き、罫線表は対象外と明記。
  - `goal2-app/public/app.js`: `text.ascii-art`には既存の機械的検出が一切無いため(新規候補提案パターン、heading-review型)、`collectAsciiArtPrefilterTargets()`が正規表現(`REPEATED_SYMBOL_LINE_PATTERN`=同一記号10回以上連続、`KAOMOJI_BRACKET_PATTERN`+`KAOMOJI_GLYPH_PATTERN`=顔文字特有記号を含む括弧書き、`<pre>`要素内の複数行記号密度チェック)で緩く候補を拾い、`enrichAsciiArtWithLlm()`が既存の`runLlmBatch()`ヘルパーをそのまま再利用してGemini判定にかける。`applyAsciiArtLlmResult()`は、simple(顔文字)の場合`matched_text`を`suggested_text`で置換した`afterHtml`を生成(置換対象が原文に見つからない場合は安全側でパッチなしのフラグのみに後退)、separator/complexの場合は常にパッチなしで対応方針を促すのみとした。
  - ライブ検証で自己発見・修正した問題: 初回プロンプトでは「単なる装飾目的の区切り線(同じ記号の反復のみ)は対象外」と明記しており、これがユーザーの元々の指摘実例(＊が80個連続する区切り行)を含む区切り線パターン5/5件全てを誤って除外する結果になった。区切り線を独立したkind(`separator`)として明示的に対象へ含めるようプロンプトを修正し、対応方針(hr要素化・読み上げ除外)を提案させる形にした。
- 検証: `node --check`成功。`GEMINI_API_KEY`未設定でPlaywrightにより既存6サンプルの検出件数(7/10/14/24/5/19)がベースラインと完全一致(回帰なし、プレフィルタが候補ゼロなら`runLlmBatch`自体が呼び出しをスキップするため無駄な通信も発生しない)。ユーザー提供のテスト用APIキーで、陽性・陰性合わせて41種類のテストケース(顔文字15件、AA区切り線6件、誤検出しやすい日本語括弧書き等の陰性例20件)によるライブ検証を実施し、プロンプト修正後は**41/41件(100%)の精度**を達成(顔文字15/15、区切り線5/5、複数行AA1/1、陰性20/20全て正解)。実際の弘前市サンプル(＊が80個連続する区切り行)とKB例そのままの顔文字言い換え(`(・∇・)`→`（笑顔で）`)の両方をUI経由のPlaywrightでエンドツーエンド確認。動作確認後、テスト用APIキーは削除済み。
- 関連ファイル: `goal2-app/lib/llm-prompts.js`、`goal2-app/public/app.js`
- 関連PR: (作成予定)

## 2026-07-13: UI/UX改善5件(AI確認中オーバーレイ、ツールチップ、リンク化検出等)

- 背景・目的: ユーザーからGOAL2画面のUI/UXに関する7件のフィードバックを受けた。曖昧な点(AA区切り行の扱い、画像alt反映が分かりにくい具体箇所)をAskUserQuestionで確認した上で、5件を実装した(残り2件は既存KBトリアージ判断を尊重してスコープ外に、1件は背景情報として理解)。
- 実装内容:
  1. **コスト概算の注記文言を削除**: `llmUsageSummaryText()`から「※概算です。実際の請求額はGoogle Cloud側でご確認ください。」を削除。
  2. **AI確認中の全画面オーバーレイ**: `setAnalyzeStatus("enriching")`時に画面全体を覆う半透明オーバーレイ(スピナー+メッセージ)を表示し、`<main>`に`inert`属性を付与して他の操作(サンプル切替え等)もブロックするようにした。`prefers-reduced-motion`にも対応。
  3. **見た目が変わらない候補へのツールチップ**: `alt`/`lang`/`scope`/`headers`/`title`属性のみを変更する候補(patch.typeが`set-attribute`でこれらの属性名)は、詳細パネルの「見た目の比較」カードが視覚的に同一になるため、`title`属性(ネイティブホバーツールチップ)で実際の変更内容(`属性名: 変更前 → 変更後`)を表示するようにした。
  4. **AI画像名候補パネルの可視化改善**: このパネルが**折りたたまれた「詳細を見る」の中**に隠れていたことが「投入ボタンの存在が分かりにくい」の根本原因と判明。常に見える`decisionPanel`内、判断ボタンより前の位置へ移動し、説明文の追加・ボタンをprimaryスタイルへ変更して視認性を高めた。
  5. **ラベル+生URLのリンク化検出(新規)**: 「申し込みフォーム　`<a href="URL">URL</a>`」のように、ラベルテキストの直後にリンクテキストがURLそのものになっているパターン(既存の`isGenericLinkText`はこちら/ここ等の曖昧表現のみ検出しURL丸出しは未検出だった)を新規検出。直前の短いラベルテキストをリンクテキストへ畳み込み、重複するURL表記を削除する`link.link-text`候補を追加(`buildRawUrlLinkTextProposal`)。
  - 見送った項目: AA(アスキーアート)区切り行の自動検出は既存KBトリアージ判断(`text.ascii-art`は自動検出対象外とする2026-07-08付決定)を尊重し実装しない。
- 検証: `node --check`成功。`GEMINI_API_KEY`未設定でPlaywrightにより既存6サンプルの検出件数を確認したところ、5サンプル(procedure-overview/images/tables/links-text/iframe)はベースラインと完全一致、`goal3-hirosaki-news2019`のみ実データに含まれる2件のラベル+生URLパターン(申し込みフォーム・Facebook)が新規検出され17→19件に増加(新規検出ルールのため想定通りの増加)。実際の変換結果(`<p>申し込みフォーム　<a href="...">https://...</a></p>` → `<p><a href="...">申し込みフォーム</a></p>`)をPlaywrightで確認。AI確認中オーバーレイは`/api/llm/enrich`のレスポンスを人為的に遅延させ、表示中は`inert`によりメイン領域が操作不能になること、完了後に正しく解除されることを確認。AI画像名候補パネルは折りたたみを開かず常に見える位置に表示されること、投入→採用の一連の操作が引き続き正しく動作することを確認。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/public/styles.css`、`goal2-app/public/index.html`
- 関連PR: (作成予定)

## 2026-07-10: GOAL2作業者向け操作マニュアルを作成

- 背景・目的: ユーザーから「GOAL2を作業者向けの説明書を作成しましょうか」との提案。既存のREADME.md/CLOUD_RUN_DEPLOY.md/LLM_DATA_POLICY.mdはいずれも開発者・運用者向けで、実際に画面を操作してアクセシビリティ修正候補をレビューする作業者向けの、専門知識を前提としない操作マニュアルが存在しなかった。
- 主な変更内容:
  - 新規`goal2-app/WORKER_GUIDE.md`を作成。`index.html`/`app.js`のUI実装(ボタンラベル・パネル文言・ワークフロー分岐)を直接確認しながら、実際の画面表示と一致する内容で記載。
    - 全体の流れ(入力→候補生成→候補レビュー→出力の4ステップ)と、画面内蔵の「次にやること」ガイドパネルの使い方。
    - ステップ①入力: ページ情報・本文HTML・修正基準(KB全ルール/miChecker指摘対応のみ)の切り替え、サンプル投入が練習用ダミーデータである旨の明記。
    - ステップ②候補生成: 「生成中」と「AIで確認中」(直近PRで実装した状態)の違い、数十秒かかる場合がある旨。
    - ステップ③候補レビュー: 直近PRで実装した候補カード4状態(白=未処理/青=選択中/濃いグレー=処理完了/薄いグレー=自動解決)の意味、詳細パネルの読み方(この候補で変わること・修正方法・見た目の比較・各種情報)、4つの判断ボタン(採用/文言を調整/却下/要確認)の使い分け、AI画像名候補の投入操作、同じ箇所の代替手段グループの選び方、一括採用、次の未処理への移動。
    - ステップ④出力: 最終HTML・注意・証跡の役割と出力操作。
    - よくある質問(AI確認中が長い場合、AI提案を無条件で信じてよいか、サンプルデータのまま作業してしまった場合、候補が0件の場合)と用語集。
  - `goal2-app/README.md`の冒頭に本マニュアルへのリンクを追加。
- 検証: ドキュメントのみの変更(コード変更なし)。記載内容は`index.html`のボタンラベル・`app.js`のワークフロー分岐ロジック(`pageAgentWorkflowState`/`pageAgentNextTask`/`acceptDisabledReason`等)と突き合わせて正確性を確認。
- 関連ファイル: `goal2-app/WORKER_GUIDE.md`(新規)、`goal2-app/README.md`
- 関連PR: (作成予定、GitHub MCP認証待ちのためローカルコミットのみ)

## 2026-07-10: 修正候補カードの処理状態を背景色で明示

- 背景・目的: ユーザーから「処理選択中のcurrentと処理完了のもの、処理未完了のものを明示的に違いをつけよう(今はカードの左側のラインだけの違い)」との依頼。処理選択中/処理完了/同じ箇所で自動的に処理完了/処理未処理の4状態が、カード左端の細い縦線(採用=緑・却下=赤・要確認=橙)でしか区別できておらず、一覧をぱっと見て状態を把握しにくかった。
- 配色案(コントラスト比を計算して選定、ユーザー承認済み):
  - 処理選択中(`aria-selected="true"`): 青 `--primary-container`(#dbe6fb、既存トークン再利用)。文字コントラスト13.9:1。
  - 処理完了(`accepted`/`edited`/`rejected`/`needs_review`): 濃いグレー 新規`--status-done-bg`(#ccd3dc)。文字11.5:1、リンク色バッジ文字4.6:1(いずれもWCAG AA適合)。
  - 同じ箇所で他の候補が採用されたことで自動解決された候補(`conflicted`、`resolveSupersededTableCandidates`が設定): 薄いグレー `--surface-2`(#eaf0f7、既存トークン再利用)。文字15.2:1。
  - 未処理(既定): 白 `--surface`、現状維持。
- 主な変更内容(`goal2-app/public/styles.css`):
  - `:root`に`--status-done-bg: #ccd3dc`を追加(意思決定の色=`--success`/`--danger`/`--warn`とは別軸の「処理済みかどうか」を表す状態色として、既存の「Semantic status」コメント欄に追記)。
  - `.candidate-item.accepted/.edited/.rejected/.needs_review`に`background: var(--status-done-bg)`を追加(既存のborder-left色分けは維持、背景色は独立して重ねる設計)。
  - `.candidate-item.conflicted`に`background: var(--surface-2)`を新設(このクラス自体は既にJS側で付与されていたが、専用のCSSスタイルはこれまで無かった)。
  - `.candidate-item[aria-selected="true"]`のbackgroundを、ほぼ白に近い薄い色(`color-mix(...)`)から、より明確に青と分かる`--primary-container`へ変更。CSSソース順を「状態別背景→選択状態」に並べ替え、同一詳細度でカスケードにより選択状態が常に最優先で勝つようにした(既に決定済みの候補を選択して見返す場合でも青が優先表示される)。
- 検証: `node --check`なし(CSSのみ)。Playwrightで「表」サンプルを使い、候補を採用(accepted)・却下(rejected)・選択のみ(current)・自動解決(conflicted、表の構造変換候補を採用してtable関連の兄弟候補を自動解決させて再現)の4状態を実際に発生させ、`getComputedStyle`で背景色が設計通りの4色(#dbe6fb/#ccd3dc/#eaf0f7/#fdfeff)になっていることを確認。`node test/run-tests.js`成功(回帰なし、CSSのみの変更のためロジックへの影響なし)。Goal 3(`goal3.js`)は`.candidate-item.selected`/`.unresolved`という別クラス体系を使っており、今回変更したセレクタとは重複しないため無影響であることをコード確認。
- 関連ファイル: `goal2-app/public/styles.css`
- 関連PR: (作成予定)

## 2026-07-10: 実案件データの外部LLM送信ポリシーたたき台を作成

- 背景・目的: LLM(Gemini)統合完了後も、実案件(自治体サイト)のHTML・画像を外部LLMへ送信してよいかのデータポリシーが未確定のままだった(残バックログの項目10)。ユーザーの指示で項目3の後に着手。
- 調査結果(2026-07-10確認、WebSearch): Googleのデータ利用規約を確認したところ、**無料枠(Google AI Studioの無料利用枠)は送信内容をモデル学習・製品改善に利用する場合があり、人間のレビュアーが閲覧することがある**一方、**有料枠(Gemini API有料利用・Vertex AI)はプロンプト・レスポンスを学習に利用しない**(ただし不正利用検出目的で最大55日間ログ保持)ことが判明。この違いは実案件データの送信可否を左右する最重要事項のため、ユーザーへ明示的に報告した。
- 主な変更内容:
  - 新規`goal2-app/LLM_DATA_POLICY.md`を作成。Googleのデータ利用規約の調査結果(無料枠/有料枠/Zero Data Retentionの違い、出典URL)、本アプリ側のデータ取り扱い(レスポンスキャッシュはプロセス内メモリのみで永続化しない、送信対象は貼り付けた本文HTML断片と画像のみ)、実案件投入前に満たすべき最低条件のたたき台(有料枠/Vertex AI経由限定、個人情報保護条例との照合、自治体への事前説明・同意取得等)、未決定事項を記載。
  - `goal2-app/README.md`のScope節・LLM (Gemini) 連携節から`LLM_DATA_POLICY.md`へのリンクを追加し、無料枠を実案件データに使用してはならない旨を明記。
- 検証: ドキュメントのみの変更(コード変更なし)。この文書は最終決定ではなくたたき台であり、実際の運用可否は発注元・自治体との合意が必要である旨を明記。
- 関連ファイル: `goal2-app/LLM_DATA_POLICY.md`(新規)、`goal2-app/README.md`
- 関連PR: (作成予定)

## 2026-07-10: 料金プレースホルダ(Gemini単価・為替レート)を最新値へ更新

- 背景・目的: `lib/llm.js`のコスト概算に使う`GEMINI_INPUT_PRICE_PER_1M_TOKENS`/`GEMINI_OUTPUT_PRICE_PER_1M_TOKENS`/`USD_JPY_RATE`は実装当初からプレースホルダのままだった(残バックログの項目3)。WebSearchでGemini公式料金ページおよび複数の独立集計サイト(Hacker News議論、OpenRouter等)を確認した結果、`gemini-2.5-flash`(既定モデル)の料金は2026-07-02の改定後、$0.30/$2.50(入力/出力、per 1Mトークン)であることが判明し、これは既存のプレースホルダ値と偶然一致していたため据え置いた。為替レートはBank of Japan/市場データで確認したところ約161.7円/USDであり、既存の既定値155から乖離していたため162へ更新した。
- 主な変更内容(`goal2-app/lib/llm.js`):
  - `USD_JPY_RATE`の既定値を`155`→`162`に更新(2026-07-10時点の実勢レート約161.7円を反映)。
  - 各定数のコメントに、確認日(2026-07-10)・確認元(公式料金ページ、Bank of Japan/市場データ)・「モデル変更時や時間経過後は再確認が必要」という運用上の注意を明記。
  - `GEMINI_INPUT_PRICE_PER_1M_TOKENS`/`GEMINI_OUTPUT_PRICE_PER_1M_TOKENS`は値自体は据え置き(既に現在の公式料金と一致していたため)。
  - `goal2-app/README.md`の該当表にも確認日・確認済みである旨を反映。
- 検証: `node --check`成功。`GEMINI_API_KEY`未設定でのPlaywright回帰確認(既存6サンプルの検出件数がベースラインと完全一致)を実施。`estimateCostUsd`/`estimateCostJpy`が新しい既定値で正しく計算されることを直接呼び出しで確認。
- 関連ファイル: `goal2-app/lib/llm.js`、`goal2-app/README.md`
- 関連PR: (作成予定)

## 2026-07-10: GEMINI_*環境変数の運用ドキュメントを整備

- 背景・目的: LLM統合(PR #34〜#40)完了後、`GEMINI_API_KEY`をはじめとする環境変数群がREADME/CLOUD_RUN_DEPLOY.mdのどこにも説明されておらず、運用者が機能の存在に気づけない状態だった(残バックログの項目1)。ユーザーの指示で項目2(ADC実装)を先に完了させた後、この項目に着手。
- 主な変更内容:
  - `goal2-app/README.md`: 「Scope」節の「このPoCでまだ扱わないもの」から「実案件HTMLの外部LLM送信」「実案件画像の外部AI送信」を削除(実装済みのため事実と異なっていた)し、LLM連携は実装済みだが既定で無効・データポリシー未確定である旨に書き換え。新規「LLM (Gemini) 連携」節を追加し、全環境変数(`GEMINI_API_KEY`/`GEMINI_MODEL`/`LLM_MAX_CALLS_PER_MINUTE`/`GEMINI_INPUT_PRICE_PER_1M_TOKENS`/`GEMINI_OUTPUT_PRICE_PER_1M_TOKENS`/`USD_JPY_RATE`/`GEMINI_AUTH_MODE`/`GEMINI_VERTEX_PROJECT`/`GEMINI_VERTEX_LOCATION`)を表形式で説明し、APIキー方式とADC/Vertex AI方式の使い分けを記載。
  - `goal2-app/CLOUD_RUN_DEPLOY.md`: 「LLM (Gemini) 連携を有効にする場合」節を追加。APIキー方式(Secret Manager経由での安全な注入手順、`--set-env-vars`に平文で書かない旨の注意)と、ADC方式(Vertex AI API有効化・サービスアカウントへの`roles/aiplatform.user`権限付与・デプロイ時の環境変数設定)の両方について、実際に実行可能な`gcloud`コマンド例を記載。
- 検証: ドキュメントのみの変更(コード変更なし)。
- 関連ファイル: `goal2-app/README.md`、`goal2-app/CLOUD_RUN_DEPLOY.md`
- 関連PR: (作成予定)

## 2026-07-10: ADC/Vertex AI認証(Stage B)を実装、lib/llm.jsのヌルバイト混入も修正

- 背景・目的: LLM統合の当初計画で「まずAPIキー方式のみで実装し、動作確認後にADC方式を追加検討する2段階方針」として合意していたStage Bに着手。Cloud Run上ではAPIキーをSecret Managerで管理する代わりに、メタデータサーバー経由のサービスアカウント認証でVertex AI Gemini APIを呼び出せるようにする。
- 主な変更内容(`goal2-app/lib/llm.js`):
  - 新規`GEMINI_AUTH_MODE`環境変数(既定`"api-key"`、明示的に`"adc"`を指定した場合のみADCモードへ切り替え)。既定値のままなら`callGemini()`の挙動・エンドポイント・認証は完全に無変更。
  - ADCモード時は、Cloud Runのメタデータサーバー(`http://metadata.google.internal/...`)からアクセストークンとプロジェクトID(`GEMINI_VERTEX_PROJECT`未設定時)を取得し、Vertex AI経由(`https://{location}-aiplatform.googleapis.com/v1/projects/{project}/locations/{location}/publishers/google/models/{model}:generateContent`)でGeminiを呼び出す。`GEMINI_VERTEX_PROJECT`/`GEMINI_VERTEX_LOCATION`(既定`us-central1`)で対象を指定可能。取得したアクセストークンはプロセス内でキャッシュし、期限60秒前から再取得する。
  - Vertex AIのgenerateContentリクエスト/レスポンス形式はDeveloper APIとほぼ同一(`contents`/`generationConfig`/`usageMetadata`等が共通)のため、認証ヘッダーとURL構築部分のみを分岐させ、ボディ構築・レスポンス解析・コスト概算・キャッシュ・予算ガードのロジックは完全に共有した。
  - メタデータサーバーに到達できない環境(Cloud Run以外)でADCモードを指定した場合は、明確なエラーメッセージ(`llm_adc_token_failed`/`llm_adc_project_failed`)で失敗し、既存の全呼び出し元のフォールバック機構(失敗時はヒューリスティック案を維持)がそのまま機能する。
  - 副次的に発見・修正: `buildCacheKey()`内の区切り文字用`hash.update(" ")`が3箇所とも実際にはヌルバイト(`\x00`)としてファイルに保存されていたことを発見(`file`コマンドで`data`と判定される非テキストファイルになっていた)。原因は不明(過去のセッションでの編集時のエンコーディング事故と推測)だが、意図した半角スペースへ修正した。機能上はハッシュが変わるだけで動作に影響はなかったが、ソースファイルとして不健全な状態だったため修正した。
- 検証: `node --check`成功。`GEMINI_API_KEY`未設定・`GEMINI_AUTH_MODE`未設定(既定)でPlaywrightにより既存6サンプルの検出件数(7/10/14/24/5/17)がベースラインと完全一致(回帰なし)。`GEMINI_AUTH_MODE=adc`を設定した状態で`callGemini()`を直接呼び出し、`isConfigured()`が`true`を返すこと、メタデータサーバーに到達できないこのサンドボックス環境では`llm_adc_token_failed`という明確なエラーで(クラッシュせず)失敗することを確認。**このサンドボックスは実際のGCP環境ではないため、Cloud Run上でメタデータサーバー経由の認証が実際に成功することは検証できていない。ユーザーが実際にCloud Runへデプロイして確認する。**
- 関連ファイル: `goal2-app/lib/llm.js`
- 関連PR: (作成予定)

## 2026-07-10: image.avoid-text-as-imageを実装(vision LLMによる画像内文字検出)

- 背景・目的: 未実装5ルール(ascii-art/quotation/avoid-text-as-image/heritage-image/showcase-section)を調査した結果、`text.ascii-art`・`text.quotation`は`michecker-triage.md`で既に「自動検出コードを持たない、AI/人間判断でのレビュー時に参照するKB文書」と意図的にスコープ外化されていることが判明。`image.heritage-image`・`image.showcase-section`は他ルールのbefore/afterパターンと異なり、ページ種別の判断基準を記した文書(検出対象ではなくコンテキスト供給用)であることが判明。明確なbefore/afterパターンを持ち、vision LLMで実装可能な`image.avoid-text-as-image`のみを新規実装する方針をユーザーに確認・合意した。
- 主な変更内容:
  - `goal2-app/lib/llm-prompts.js`: 新規タスク`avoid-text-as-image`を追加(`image-alt`と同じ単一画像style)。バナー等に描き込まれた本文相当の文字情報の有無(`has_embedded_text`)と、あれば書き起こしテキスト(`extracted_text`)を判定するプロンプト。
  - `goal2-app/server.js`: `POST /api/llm/image-alt`を汎用化し、リクエストボディに任意の`task`フィールド(既定`"image-alt"`、後方互換)を追加。`getTaskConfig(task)`で未対応taskは400を返す。画像取得・SSRF対策・base64変換ロジックは既存の`fetchImageAsBase64`をそのまま再利用(新規セキュリティロジックなし)。
  - `goal2-app/public/app.js`: 新規`enrichAvoidTextAsImageWithLlm(fragment, items)`/`enrichOneAvoidTextAsImage(img, baseUrl, items)`。他の画像enrichmentと異なり既存候補の上書きではなく新規候補提案パターン(heading-reviewと同型)。旧ページURL未入力時は画像取得不能なため即return(候補0件・呼び出し0件)。`isNormalSizedImageForComplexCheck()`(既存の複雑画像判定で使われている閾値)を再利用し、極小アイコンを除外してコストを抑制。LLMが`has_embedded_text: true`を返した場合のみ、画像の直後に書き起こしテキストを`<p>`として追加する候補(`image.avoid-text-as-image`、confidence: low、要人間確認)を新規作成する。
- 検証: `node --check`成功。`GEMINI_API_KEY`未設定でPlaywrightにより既存6サンプルの検出件数(7/10/14/24/5/17)がベースラインと完全一致(回帰なし)。ライブ検証: (1) Canvas生成の「7月10日は休館日です」というバナー画像をローカルで作成し`callGemini()`を直接呼び出したところ、`has_embedded_text: true`・`extracted_text: "7月10日は休館日です"`と完全一致する結果を確認(SSRF対策がローカルホスト宛リクエストを正しくブロックしたため、画像取得自体はブラウザ経由でなく直接呼び出しで検証)。(2) 実在する外部画像(GitHubのJSロゴ)をブラウザ経由で解析させ、`task: "avoid-text-as-image"`のリクエストが正しく送信され、ロゴには文字情報が無いため`has_embedded_text: false`・候補0件となることを確認(誤検出なし)。(3) `/api/llm/image-alt`の`task`未指定時(既存呼び出し)が引き続き`image-alt`として動作することを確認(後方互換)。
- 副産物として、PR #38(table.layout-table系画像のvision enrichment)の未実施だったライブ検証もあわせて実施: 実在する外部画像を使った独自HTML(レイアウト表内に汎用alt画像を配置)で、表候補の`after_html`内の画像altが`alt="写真"`→`alt="JSのロゴ"`へ実際に書き換わること、同じ画像の独立`image.alt-text`候補も同じ結果になっている(重複呼び出し回避ロジックが機能している)ことを確認した。
- 関連ファイル: `goal2-app/lib/llm-prompts.js`、`goal2-app/server.js`、`goal2-app/public/app.js`
- 関連PR: (作成予定)

## 2026-07-10: table.layout-table系画像へのvision enrichment拡張

- 背景・目的: PR#37までの4段階LLM統合で`image.alt-text`/`image.complex-image-report`という独立候補になった画像は`enrichImageAltWithLlm`でvision enrichmentされるが、`table.layout-table`/`table.cell-merge-layout`/`table.cell-merge-file`/`table.cell-merge-mark`の各候補が呼ぶ`decomposeLayoutTable()`は、表を解体・再構成する過程で画像のalt属性を`prepareLayoutTableImage()`の旧ヒューリスティック(`generateImageNameDraft`/`generateComplexImageNameDraft`)のみで直接`after_html`に焼き込んでおり、独立候補を一切作らないためLLM enrichmentの対象から漏れていた(直近のリプランニングでユーザーが選択した「2」に対応)。
- 主な変更内容(`goal2-app/public/app.js`):
  - `decomposeLayoutTable(table, imageContexts)`/`tableCellDraft(cell, imageContexts)`/`normalizeLayoutTableImages(root, imageContexts)`/`prepareLayoutTableImage(img, imageContexts)`に、任意の第2引数`imageContexts`(配列)を追加。渡された場合のみ、ヒューリスティックでalt文言を焼き込んだ画像ごとに`{src, caption}`を収集する。引数を渡さない既存呼び出しは完全に無変更(出力HTMLは一切変わらない)。
  - `buildMergedCellProposal()`・`buildMarkSeparatedTableHtml()`・`planTableTreatment()`・`collectTableCandidates()`を通じて、`table.layout-table`/`table.cell-merge-layout`(分割不可時)/`table.cell-merge-file`/`table.cell-merge-mark`の各候補作成時に収集済み画像を`proposal.llm_context.images`(内部専用、UI非表示、既存の`llm_context`パターンを踏襲)として付与。
  - 新規`enrichLayoutTableImagesWithLlm(items)`: `llm_context.images`を持つ候補を走査し、同一src重複除去後に既存`/api/llm/image-alt`エンドポイントへvision呼び出しし、`after_html`内の対応する`<img src>`のalt属性のみを書き換える(表全体は再構築しない)。失敗時は焼き込み済みのヒューリスティック案をそのまま残す。
  - コスト最適化: 同一画像が独立した`image.alt-text`/`image.complex-image-report`候補としても存在する場合(実際によくある重複)、重複vision呼び出しを避けるため`enrichLayoutTableImagesWithLlm`は`enrichImageAltWithLlm`完了後に実行し、`findExistingAltForImageUrl()`で既に確定済みのalt文言があればそれを再利用して新規API呼び出しをスキップする。
- 検証: `node --check`成功。`GEMINI_API_KEY`未設定でPlaywrightにより全6サンプルの検出件数(7/10/14/24/5/17)がベースラインと完全一致することを確認(回帰なし)。「表」サンプルの`table.layout-table`候補で新設フィールドが正しく収集されること、`/api/llm/image-alt`への重複呼び出しが1回に削減されることをネットワークインターセプトで確認。ライブAPIキーでの動作確認は、Stage3で同一エンドポイント・同一適用ロジックが実機検証済みであるためユーザー判断でスキップ。
- 関連ファイル: `goal2-app/public/app.js`
- 関連PR: (作成予定)

## 2026-07-10: LLM確認中の処理状態をUIに明示

- 背景・目的: ユーザーから「呼び出しから返答までに時間がかかったようですが処理中を示す表現がないと何度もボタンを押してしまいそうです」との指摘を受けた。LLM enrichment導入後は`analyze()`のうち`enrichWithLlm`/`enrichImageAltWithLlm`/`enrichHeadingReviewWithLlm`の並行実行部分が数十秒かかることがあるが、この間もボタン表示は最初の「生成中」のままで、ヒューリスティック生成(1秒未満)とAI確認(最大数十秒)の区別がつかなかった。
- 主な変更内容(`goal2-app/public/app.js`):
  - `setAnalyzeStatus()`に新しい状態`"enriching"`を追加(`"running"`と同様、ボタンを無効化したまま早期returnする分岐)。ボタン文言を「AIで確認中」、候補一覧サマリーを「AIによる内容確認を行っています。ページの内容によっては数十秒かかる場合があります。」に変更。
  - `analyze()`で、`enrichLinkTitleCandidates()`完了後・LLM enrichmentの`Promise.all`開始前に`setAnalyzeStatus("enriching")`を呼ぶよう変更。
  - 実装中に、`setAnalyzeStatus()`の既存コードが`"running"`以外のstatus値に対して無条件で`els.analyzeButton.disabled = false`にフォールスルーする作りだったため、新しい状態を単純に追加するとボタンが処理中に再度押せる状態になってしまう("running"と同様の早期return分岐が無いと発生する)潜在的な不具合を発見し、正しく早期returnする形で実装した。
- 検証: `node --check`・`node test/run-tests.js`成功。`GEMINI_API_KEY`未設定環境で既存6サンプルの検出件数がベースラインと完全一致(回帰なし、状態表示のみの変更で機能面への影響なし)。Playwrightで`/api/llm/enrich`のレスポンスを人為的に2秒遅延させ、遅延中はボタンが「AIで確認中」表示・無効化されたまま維持され、完了後に正しく「候補生成」表示・有効化に戻ることを確認。
- 関連ファイル: `goal2-app/public/app.js`
- 関連PR: (作成予定)

## 2026-07-10: ステージ4(heading-required/heading-content-quality)のライブ動作確認とプロンプト調整

- 背景・目的: 直前のステージ4コミットは`GEMINI_API_KEY`未設定環境での検証止まりだった。ユーザーからテスト用APIキーの再提供を受け、実際のGemini呼び出しまで含めて検証した。
- 検証中に発見・修正した問題:
  - `before_block_id`の解釈にズレがあり、LLMが提案した見出し文言の内容と、実際に挿入される段落の内容が一致しない(1つ前の段落に挿入されてしまう)ケースが再現性をもって発生した。プロンプトに「見出し文言が要約している内容そのものを持つ段落のblock_idを指定すること」を明記して修正し、再検証で正しい段落への挿入を確認。
  - `links-text`サンプル(短い断片的な段落の集合)で、ほぼ全ての段落に見出し追加が提案される過剰生成を発見(8件)。プロンプトに「1文だけの短い段落や断片的な段落には見出しを追加しない」「本当に構造が読み取りにくい箇所のみを対象にする」という制約を追加し、3件まで抑制されることを確認(残った3件は複数の情報を含む段落や複数項目の箇条書きで、より妥当な提案になった)。
- 既存6サンプル全てで実際にGeminiが稼働している状態のまま最終確認: `procedure-overview`(7、変化なし)・`images`(10、変化なし)・`tables`(14、変化なし)・`links-text`(24→27、見出し提案3件が妥当な内容)・`iframe`(5、変化なし)・`goal3-hirosaki-news2019`(17→26、見出し提案9件)。ステージ1〜3は既存候補の上書きのみのため件数が変化しない設計だが、ステージ4は新規候補提案が設計上の目的のため、件数の増加は意図した挙動。
  - `goal3-hirosaki-news2019`(実データサンプル)で見出し提案9件の内容を確認したところ、日時・場所・定員・参加料など、見出しもラベルも無いまま羅列されているイベント詳細の各項目に、それぞれ「開催日時」「開催場所」等の見出しを提案する内容だった。実務上は`<dl>`(定義リスト)化との判断が分かれる可能性はあるが、明確に誤った提案ではなく、確信度lowかつ要人間確認の設計のため、最終判断は人間のレビューに委ねられる。
  - 大きめのページでは複数のLLM呼び出しが並行するため処理時間が数十秒に達することがある(検証用スクリプトのタイムアウトを20秒→45秒に緩和して確認)。機能上の不具合ではなく、実際の待ち時間として認識しておく必要がある。
  - 動作確認に使用したテスト用APIキーは確認後に削除済み(リポジトリには含まれない)。
- 関連ファイル: `goal2-app/lib/llm-prompts.js`
- 関連PR: (作成予定)

## 2026-07-10: heading-required・heading-content-qualityへLLM enrichmentを接続(ステージ4/4)

- 背景・目的: 偽AI2件のもう1件`html-structure.heading-required`(PoC文書の内容にべた書きで一致させているだけ)と、ステージ2でスコープを合わせた`html-structure.heading-content-quality`(短い/記号のみの見出ししか候補化しない)へ対応。両ルールとも既存ヒューリスティックは「候補を生成する条件」自体が狭く、これまでの7タスクのような「既存候補の上書き」では価値を出せないため、LLMが文書全体を読んで新規に候補を提案する設計にした(4ステージの中で最も新規性が高い箇所)。
- 主な変更内容:
  - `goal2-app/lib/llm-prompts.js`: `heading-review`タスクを追加。他のテキスト系タスクと異なり、独立した項目の配列ではなく文書全体のアウトライン(見出し・段落を出現順に並べたもの)を1つの合成アイテム(`{id: "outline", blocks: [...]}`)として渡し、既存の`/api/llm/enrich`エンドポイント(1件配列・1件レスポンスの規約)をそのまま再利用できる形にした。レスポンスは`vague_headings`(曖昧な見出しの指摘)と`missing_headings`(見出し追加提案)の2種類。
  - `goal2-app/public/app.js`: `enrichHeadingReviewWithLlm(fragment, items)`を新設し、`analyze()`から他のLLM enrichmentと並行実行(`Promise.all`)。`buildHeadingReviewOutline()`が`fragment`から見出し・段落を最大80件抽出(各要素は`parseFragment()`が既に付与している`data-goal2-node-id`で識別)。`applyHeadingReviewResult()`が結果を適用: (1)曖昧な見出しは、同じ見出しに既存の`heading-content-quality`候補があれば理由文を上書き、無ければ新規候補を作成。(2)見出し追加提案は、既存の`heading-required`候補が同じ対象に既にあれば重複を避けてスキップし、無ければ新規候補を作成(`<h{level}>提案文言</h{level}>` + 対象要素のHTML、という既存の`procedureParentHeadingProposal`等と同じ「見出しを前に挿入する」パターンを踏襲)。LLMが返すblock_idは、送信したアウトラインに実在するIDかを毎回検証し、存在しないIDは無視する。
- 検証: `node --check`・`node test/run-tests.js`成功。`GEMINI_API_KEY`未設定環境で既存6サンプルの検出件数がベースラインと完全一致(回帰なし、新規候補提案パスは常にLLM成功時のみ候補を追加するため無設定時は何も増えない)。`/api/llm/enrich`に`heading-review`タスクを直接投げて`unknown_task`にならず正しく認識されることを確認。実際のGemini呼び出しまでのライブ検証はテスト用APIキー待ちのため未実施。
- 関連ファイル: `goal2-app/lib/llm-prompts.js`、`goal2-app/public/app.js`
- 関連PR: (作成予定)

## 2026-07-10: ステージ3(image.alt-text)のライブ動作確認

- 背景・目的: 直前のステージ3コミットは`GEMINI_API_KEY`未設定環境での検証止まりだった。ユーザーからテスト用APIキーの再提供を受け、実際のGemini vision呼び出しまで含めて検証した。
- 検証内容:
  - `/api/llm/image-alt`を実在する画像URL(`raw.githubusercontent.com`上のJavaScriptロゴ画像)で直接呼び出し、`alt_text: "JSのロゴ"`という画像内容に即した結果が返ることを確認。
  - 組み込みサンプルの画像は全て架空ドメイン(`https://www.example-city.jp/...`)を指しており実在しないため、実際に取得可能な絶対URLを持つカスタムHTML(`<img src="https://raw.githubusercontent.com/...">`)をUIに貼り付けてPlaywrightで検証し、`alt=""`が実際に`alt="JSのロゴ"`へ書き換えられること、コスト概算(USD/円)が正しく表示されることをエンドツーエンドで確認。
  - 既存6サンプルで実際にGeminiが稼働している状態のまま候補・注意の総件数がベースラインと完全一致することを確認(`images`サンプルは架空ドメインのため画像取得に失敗し、既存ヒューリスティックへ正しくフォールバックすることも確認)。
  - 動作確認に使用したテスト用APIキーは確認後に削除済み(リポジトリには含まれない)。
- 関連ファイル: なし(検証のみ、コード変更なし)
- 関連PR: (作成予定)

## 2026-07-10: image.alt-textへLLM(Gemini vision)enrichmentを接続(ステージ3/4)

- 背景・目的: 偽AI2件のうちの1件、`image.alt-text`(旧実装は4種類の決め打ちPoCサンプル画像ファイル名への固定文言のみ)へ、実際に画像を見て代替テキストを生成する仕組みを接続した。
- 主な変更内容:
  - `goal2-app/server.js`: `fetchImageAsBase64()`を新設。既存のSSRF対策済み`fetchWithSafeRedirects`/`assertFetchUrlAllowed`を再利用し、画像URLから画像バイトを取得(4MB上限、`image/jpeg`・`png`・`webp`・`gif`のみ許可)してbase64化する。`POST /api/llm/image-alt`エンドポイントを新設し、取得した画像とキャプション文脈をGeminiのvision対応エンドポイントへ渡す。
  - `goal2-app/lib/llm-prompts.js`: `image-alt`タスクを追加。他のタスクと異なり画像1件=1リクエスト(vision呼び出しは画像バイト取得を伴うためバッチ化できない)。
  - `goal2-app/public/app.js`: `enrichImageAltWithLlm()`を新設し、`analyze()`から`enrichWithLlm()`と並行実行(`Promise.all`)。`image.alt-text`・`image.complex-image-report`の両ルール(同じ`<img>`を対象にすることがある)を対象の`target.node_id`単位でグルーピングし、1画像1回のGemini呼び出しで両方の候補を更新。移行元ページURL(「旧ページURL」入力欄)に対して`img[src]`を絶対URL解決し、解決できた場合のみ(http/https URLのみ対応、data:等は既存ヒューリスティックのまま)enrichmentを実行。同時実行数を4に制限。`makeCandidate()`の`llmContext`に近接キャプション文言を保存し、`image.alt-text`(未設定/汎用の2ケース)・`image.complex-image-report`の生成箇所に追加。
- 検証: `node --check`・`node test/run-tests.js`成功。`GEMINI_API_KEY`未設定環境で既存6サンプルの検出件数がベースラインと完全一致(回帰なし)。`/api/llm/image-alt`の契約レベル検証として、(1)到達不能なURLで適切にエラーを返すこと、(2)実在する画像URL(`raw.githubusercontent.com`、組織のプロキシポリシーで`google.com`等は遮断されているため到達可能なホストで代替)で画像取得・content-type判定・Gemini呼び出し直前までの経路が正常に動作し`llm_not_configured`で応答することを確認。実際のGemini vision呼び出しまでのライブ検証は、テスト用APIキーの再提供待ちのため未実施(Stop hookにより確認未了のままコミット)。
- 関連ファイル: `goal2-app/server.js`、`goal2-app/lib/llm-prompts.js`、`goal2-app/public/app.js`
- 関連PR: (作成予定)

## 2026-07-10: LLM利用コスト概算に円換算を併記

- 背景・目的: ユーザーから「コストは円換算も併記しましょう」との要望を受けた。従来はUSDの概算のみ表示していた。
- 主な変更内容:
  - `goal2-app/lib/llm.js`: `USD_JPY_RATE`環境変数(既定値155、変動するためプレースホルダである旨をコメントで明記)を新設し、`estimateCostJpy()`を追加。`callGemini()`が返す`usage`に`estimatedCostJpy`を含めるようにした。
  - `goal2-app/public/app.js`: `state.llmUsage`に`estimatedCostJpy`を追加し累積、候補一覧サマリーの表示を「概算$0.00XX（約Y円、呼び出しN回、トークン計M）」の形式に変更。
- 検証: `node --check`・`node test/run-tests.js`成功。`estimateCostUsd`/`estimateCostJpy`の計算を単体で確認(`USD_JPY_RATE`環境変数の上書きも含め正しく計算されることを確認)。`GEMINI_API_KEY`未設定環境で既存6サンプルの検出件数がベースラインと完全一致(回帰なし)。今回はテスト用APIキーが手元に無かったため、円換算表示の実際のUIでのライブ確認は未実施(計算ロジック自体は単体テスト済み、USD分はステージ2で実証済みのため技術的リスクは低い)。
- 関連ファイル: `goal2-app/lib/llm.js`、`goal2-app/public/app.js`
- 関連PR: (作成予定)

## 2026-07-10: ステージ2のライブ動作確認、table.captionの適用範囲を拡大

- 背景・目的: 直前のステージ2コミット(未プッシュ、追記内容参照)後、ユーザーからテスト用Gemini APIキーの再提供を受け、7タスク全てを実際のGemini呼び出しまで含めて検証した。
- 検証の過程で、`table.caption`のenrichment対象条件(`patch?.type === "insert-caption"`)が狭すぎることが判明した。`collectTableCandidates()`内の`table.caption`候補には実際には3つの発生経路があり、うち最も一般的な「データテーブルとして構造的に保持し、caption/thead/th/scopeをまとめて追加する」経路(`planTableTreatment`の`kind: "structural"`、`patchMode: "replace"`で`patch`オブジェクトを持たない)は元のフィルタ条件に一致せず、enrichmentが素通りしていた。
- 主な変更内容(`goal2-app/public/app.js`):
  - `table-caption`タスクの対象条件を、`after_html`に`<caption>`要素を含む`table.caption`候補全般に拡大(`patch`の有無を問わない)。ただし「既存のキャプションが汎用語のみ」を検出するだけの確認専用候補(`element`がテーブルではなくcaption要素自体、`patchMode: "none"`)は、`before_html`が`<table`で始まるかどうかで判定して明確に除外した(この候補は表全体の書き換えを意図していないため)。
  - `applyTableCaptionLlmResult()`を、`patch`が無い(構造的書き換え)候補にも対応できるよう汎用化。
- 検証: `node --check`・`node test/run-tests.js`成功。テスト用APIキーで実際にGemini呼び出しまで実施し、7タスク全てが期待通りの高品質な出力を返すことを確認(例: `link-text`「防災ガイドブック（PDF版）」、`mail-link`「健康推進課へメールを送信」、`toppage-link`「弘前市トップページ」、`table-caption`は旧実装の固定文言"Table details"に代わり「粗大ごみ処理手数料」のような内容に即した要約、`sensory-characteristics`は「右のボタン」を問題ありと判定しつつ「「電子申請」ボタン」は問題なしと正しく区別、`cell-merge`は表内容に即した具体的な理由文、`th-scope`は表構造から`col`/`row`を正しく判定)。既存6サンプル全てで実際にGeminiを呼び出した状態での回帰確認も行い、候補・注意の総件数がベースライン(procedure-overview 7, images 10, tables 14, links-text 24, iframe 5, goal3-hirosaki-news2019 17)と完全一致することを確認(LLMによる書き換えは既存候補の内容更新のみで、件数の増減は発生しない設計のため)。1ページあたりの実測コストは概算$0.0002〜$0.0011程度(6サンプル合計で1セント未満)。動作確認に使用したテスト用APIキーは確認後に削除済み(リポジトリには含まれない)。
- 関連ファイル: `goal2-app/public/app.js`
- 関連PR: (作成予定)

## 2026-07-10: 残り8ルールへLLM(Gemini)enrichmentを接続(ステージ2/4)

- 背景・目的: ステージ1(PR #34)で構築したLLM連携基盤・`enrichWithLlm()`パターンを、対象9実装対象のうち残り8ルール(実装対象としては7関数、`table.cell-merge-*`は6ルールIDを1関数でカバー)へ展開した。ユーザー承認を得て着手。
- 主な変更内容:
  - `goal2-app/public/app.js`: `enrichWithLlm()`を共通バッチ処理ヘルパー`runLlmBatch(task, targets, buildItem, applyResult)`を軸にリファクタリングし、以下7タスクを追加接続(既存の`text.foreign-language`と合わせ計8タスク)。
    - `text.sensory-characteristics`: 形・位置だけの案内表現が実際に問題か否かをLLMが再判定し、該当文脈に即した具体的な理由(`reason`)に差し替え(`patchMode: none`のため文言修正は行わない)。
    - `link.link-text`: リンク先URL・直前見出し・周辺テキストを渡し、「こちら」等の曖昧なリンク文言をLLMが具体的な文言案に差し替え。
    - `link.mail-link`: メールアドレス・周辺テキストを渡し、担当部署名を含む文言案を生成。
    - `link.toppage-link`: 入力中の「ページ名」からLLMが市区町村名を抽出し「◯◯市トップページ」を生成。
    - `table.caption`: キャプション欠落の表(HTML)を渡し、内容を要約したキャプション文言を生成(旧実装は英語の固定文言"Table details"だった)。
    - `table.cell-merge-*`(6ルールID): セル結合表(HTML)+機械分類済みカテゴリを渡し、実際の内容に即した具体的な理由文を生成(分類自体・構造再構成ロジックは安全のため変更しない)。
    - `table.th-scope`: 表全体のHTML+対象th要素のテキストを渡し、col/row/colgroup/rowgroupを判定(旧実装は位置だけの機械的な推測で常にlow確信度)。
    - 各タスクとも、LLM呼び出し失敗・未設定・判定不能時は既存ヒューリスティックの下書きをそのまま維持する(既存パターンを踏襲)。
  - `makeCandidate()`に`options.llmContext`を追加し、`candidate.proposal.llm_context`として保存(UIには表示しない)。`before_html`/`target.snippet`だけでは復元できない周辺DOM文脈(リンク周辺の段落テキスト・直前見出し、対象thを含む表全体のHTML)を、同期の候補生成時点でenrichmentパス用に保存しておく設計。`link.link-text`(1524行目付近)・`link.mail-link`(1694行目付近)・`table.th-scope`の2箇所(missing scope/invalid scope、1900行目付近)の生成コードに`llmContext`を追加。
  - `goal2-app/lib/llm-prompts.js`: 7タスク分のシステムプロンプト・JSONスキーマ・`buildUserText()`を追加。
- 検証: `node --check`(app.js/server.js/lib/llm.js/lib/llm-prompts.js)・`node test/run-tests.js`成功。`GEMINI_API_KEY`未設定環境で既存6サンプルの検出件数がステージ1と完全に同じベースラインと一致(回帰なし)。追加した7タスクすべてが`/api/llm/enrich`で`unknown_task`エラーにならず正しく認識されることを確認(未設定環境のため`llm_not_configured`で応答することも確認)。`html-structure.heading-content-quality`は、既存のヒューリスティックが「短い/記号のみ」の見出ししか候補化しない構造上、既存候補の上書きではなく新規候補の提案(見出し全体をLLMが走査)が必要と判断し、同じく新規提案パスが必要な`html-structure.heading-required`(ステージ4)とまとめて扱う方針に変更した。
- 今後の予定(未実施): `image.alt-text`(ステージ3)、`html-structure.heading-required`+`heading-content-quality`(ステージ4、新規候補提案パス)。ステージ2の実際のGemini呼び出しでの動作確認(ライブテスト)は、テスト用APIキーの再提供があれば実施予定。プロンプト・スキーマの技術的な仕組み自体はステージ1で実証済みのため、未検証でもリスクは「AIによる改善が発生しない」に留まり、既存動作を壊すことはない設計。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/lib/llm-prompts.js`
- 関連PR: (作成予定)

## 2026-07-10: LLM(Gemini)連携基盤を新設し、text.foreign-languageルールに接続(ステージ1/4)

- 背景・目的: ユーザーから「今のプログラムはLLMをAPIで利用していますか？」と問われ調査した結果、`processing_class: ai`/`hybrid`とタグ付けされた36ルール(KB定義では「LLM判断」「LLM+人間」を意味する)が実際には全て正規表現・DOM解析・一部はハードコードされた対応表で実装されており、実LLM APIは一切呼び出されていないことが判明した。特に画面表示「AI画像名生成」は4種類の決め打ちPoCサンプル画像ファイル名への固定文言のみだった。Explore agentによる36ルール全数調査の結果、偽AI2件(`image.alt-text`、`html-structure.heading-required`)+素朴なヒューリスティックで改善余地が大きい9実装対象(約14ルールID)を今回の改修対象と決定。ユーザーの強いコスト懸念を踏まえ、プロバイダはGoogle Gemini(既存Cloud Run/GCP運用との親和性)、認証はまずAPIキー方式のみ(ADC/Vertex AIは将来拡張として保留)、キャッシュ・バッチ化・呼び出し上限・LLM未設定時の完全な現状維持フォールバックを設計の中心に据えた。実装前にplanモードで設計をまとめ、ユーザー了承のAPIキー(利用量上限つきのテスト用)を使って実際にGemini APIまで通した動作確認まで実施した。
- 主な変更内容:
  - `goal2-app/lib/llm.js`(新規): Gemini Developer API(`generativelanguage.googleapis.com`)への薄いラッパー`callGemini()`。認証は`GEMINI_API_KEY`環境変数のみ。プロセス内インメモリキャッシュ(同一入力の再計算防止)、`LLM_MAX_CALLS_PER_MINUTE`による呼び出し上限ガード、レスポンスの`usageMetadata`からトークン数・概算コスト(`GEMINI_INPUT_PRICE_PER_1M_TOKENS`/`GEMINI_OUTPUT_PRICE_PER_1M_TOKENS`環境変数、既定値はプレースホルダでユーザーに最新料金表での確認を促す)を算出。`GEMINI_API_KEY`未設定時は即座に`llm_not_configured`エラーを投げ、課金なしで確実にフォールバックする設計。
  - `goal2-app/lib/llm-prompts.js`(新規): タスク種別(現状`foreign-language`のみ)ごとのシステムプロンプトとGemini構造化出力用JSONスキーマを定義。
  - `goal2-app/server.js`: `POST /api/llm/enrich`エンドポイントを新設(`readJsonBody`/`sendJson`など既存の`/api/link-title`等と同じ規約に準拠)。`{ task, items }`を受け取りタスク別プロンプトでGeminiを呼び出し、`{ ok, results, usage }`を返す。
  - `goal2-app/public/app.js`: 既存の`enrichLinkTitleCandidates`(`/api/link-title`を叩く事後enrichmentパス)と同じパターンで`enrichWithLlm()`を追加。`generateCandidates()`本体(全ルール収集のオーケストレーター、完全同期処理)は一切変更せず、`analyze()`内で候補生成後に`await enrichWithLlm(reviewItems)`を1行追加するのみ。`text.foreign-language`候補を対象に、ページ内の全該当候補をまとめて1回のバッチリクエストで送信し、成功した項目のみ`issue.message`/`issue.reason`/`proposal.patch.value`/`proposal.after_html`のlang値をLLM判定で上書き(`confidence`は`low`、`requires_human_review`は`true`のまま維持、失敗時は既存ヒューリスティックの案をそのまま残す)。候補一覧サマリーに「LLM利用: 概算$0.00XX（呼び出しN回、トークン計M）」という概算コスト表示を追加(`GEMINI_API_KEY`未設定時は非表示)。
- 検証: `node --check`(app.js/server.js/lib/llm.js/lib/llm-prompts.js)・`node test/run-tests.js`成功(`GEMINI_API_KEY`未設定環境、既存6サンプルの検出件数がベースラインと完全一致し回帰なしを確認)。ユーザー提供のテスト用APIキーで実際にGemini呼び出しまで実施し、(1)正規表現版では検出できなかったフランス語("Bienvenue à la mairie...")を正しく`lang="fr"`と判定できること、(2)予算ガードが3件目で429エラーを返すこと、(3)画面の「問題」「この候補で変わること」欄に`(AI判定)`/`(Gemini APIによる判定)`という表示とコスト概算が正しく反映されることをPlaywrightで確認。確認後、テスト用キーを保存した一時ファイルは削除済み(リポジトリには一切含まれない)。
- 今後の予定(未実施): 残り8ルールへのテキスト系enrichment適用、`image.alt-text`(画像バイト取得・vision呼び出し)、`html-structure.heading-required`(新規候補提案パス)、ADC/Vertex AI方式への対応拡張。詳細は plan ファイル(`/root/.claude/plans/melodic-purring-karp.md`)を参照。
- 関連ファイル: `goal2-app/lib/llm.js`(新規)、`goal2-app/lib/llm-prompts.js`(新規)、`goal2-app/server.js`、`goal2-app/public/app.js`
- 関連PR: (作成予定)

## 2026-07-10: 修正候補リストで同じ箇所の代替手段候補を枠で囲んでグループ表示

- 背景・目的: ユーザーからスクリーンショット付きで「同じ箇所の代替手段●件と出ていますが、どれとどれが同じ箇所なのかわかりにくいのでグループとして括って明示できませんか？」との要望を受けた。従来は`同じ箇所の代替手段 N件中`というバッジが各候補ボタン内に個別に表示されているだけで、どのボタンとどのボタンが実際に同じ箇所(同じ`target.node_id`)を指しているのかが、リスト上で視覚的にひとまとまりになっていなかった。
- 主な変更内容:
  - `goal2-app/public/app.js`の`renderCandidates()`を、`state.candidates`を先頭から走査し、同じ`target.node_id`を持つ候補が連続している区間(候補生成コードは同一対象の代替手段を必ず連続してpushするため、常に連続区間になる)を検出してグループ化するよう変更。各候補ボタンの生成処理は`buildCandidateRow()`として関数分離。
  - 2件以上のグループには`role="group"` + `aria-label="同じ箇所の候補、N件"`のコンテナ(`.candidate-group`)でラップし、視覚的なラベル(`同じ箇所の候補・N件`)も表示。スクリーンリーダー利用者にも境界が伝わるよう、枠線という視覚情報だけに頼らずテキスト・aria属性でも明示した。1件のみの候補は従来どおりグループ化せずに表示。
  - `goal2-app/public/styles.css`に`.candidate-group`(青系の枠線・角丸・淡い背景)・`.candidate-group-label`のスタイルを追加。
- 検証: `node --check`・`node test/run-tests.js`成功。既存6サンプルすべてで、複数の代替手段を持つ候補が正しくグループ枠で囲まれることをPlaywrightで確認(procedure-overview 2グループ、tables 4グループ、links-text 3グループ、goal3-hirosaki-news2019 3グループ、images/iframeは代替手段なしのため0グループ)。スクリーンショットでユーザー提示のイメージ(枠囲み)通りの見た目になっていることを確認。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/public/styles.css`
- 関連PR: (作成予定)

## 2026-07-10: 「外国語の言語属性」候補で判定した言語をUIに明示

- 背景・目的: 前エントリ(多言語対応拡張)の直後、ユーザーから「外国語判定して修正欄でlang属性が付与されたことが明示できるようにならないかな？すくなくともどの言語として判定しているかは見えたほうがいい。」との要望を受けた。従来は`text.foreign-language`候補を選択しても、問題/理由欄が「外国語の文章または語句が含まれている可能性があります。」という汎用文言のみで、どの言語と判定したか・`lang`属性がどんな値で付与されるかが画面上から読み取れなかった。またこのルールは`lang`属性の追加のみでレンダリング結果が変わらないため、「見た目の比較」カードも修正前後で同一に見え、変更内容が視覚的に分からない状態だった。
- 主な変更内容(`goal2-app/public/app.js`):
  - `LANGUAGE_LABELS`/`languageLabel()`を新設(`en`→英語、`zh`→中国語、`ko`→韓国語、`es`→スペイン語、`pt`→ポルトガル語、`ru`→ロシア語、`th`→タイ語、`vi`→ベトナム語)。
  - `collectForeignLanguageCandidate()`の`message`/`reason`を、判定した言語名と実際に付与する`lang`値を含む具体的な文言に変更(例: `外国語(英語の可能性)の文章または語句が含まれています。lang="en" を付与します。`)。詳細パネルの「問題」「理由」行に表示される。
  - `buildChangeSummary()`に`text.foreign-language`専用の分岐を追加し、「この候補で変わること」欄に`この文章にlang="en"（英語）を付与します。`のように具体的に表示されるようにした(従来は他のtext系ルールと同じ汎用文言だった)。
  - `quickEditConfig()`に`patch.type === "set-attribute" && patch.name === "lang"`の分岐を追加。既存のalt/title編集と同じ汎用「属性編集」の仕組み(`mode: "attribute"`)をそのまま流用し、「文言を調整」パネルで自動判定結果(言語名)を確認しつつ、BCP47言語コードを直接書き換えて採用できるようにした。
- 検証: `node --check`・`node test/run-tests.js`成功。既存6サンプルの検出件数に変化なし(表示のみの変更)。Playwrightで`links-text`サンプルの`text.foreign-language`候補(`English guidance is available at the counter.`)を実際に選択し、詳細パネルの「問題」欄に`外国語(英語の可能性)...lang="en" を付与します。`、「この候補で変わること」欄に`この文章にlang="en"（英語）を付与します。`、「文言を調整」パネルに`自動判定: 英語`という説明文とlangコード入力欄(初期値`en`)が表示されることを確認。
- 関連ファイル: `goal2-app/public/app.js`
- 関連PR: (作成予定)

## 2026-07-10: 「外国語の言語属性」ルールの対応言語をラテン文字(英語のみ)から多言語へ拡張

- 背景・目的: 前エントリ(URL・メールアドレスの誤検出修正)の作業中、ユーザーから「関連でもうひとつテストしてほしいけど『外国語』として認識するのはどういうロジック？英語だけではダメでフランス語、ポルトガル語、ロシア語、タガログ語、タイ語、ベトナム語、簡体字、繁体字とか多岐に渡るので。」との質問を受けた。実際にテストしたところ、既存ロジック(`[A-Za-z]{3,}...`)はASCII英字のみを見ており、キリル文字(ロシア語)・タイ文字・漢字(中国語)・ハングル(韓国語)は原理的に検出不可能、フランス語・ポルトガル語・スペイン語もアクセント記号(é/ã/ñ/ç等)を含む単語で単語境界が崩れて多くの場合検出できないことが判明した。KBルール`text/foreign-language.md`は英語・中国語・韓国語・スペイン語・ポルトガル語の5言語を想定しているが、実装は事実上英語(とASCII表記の言語)のみ対応という状態だった。ユーザーに対応範囲の選択肢を提示し、「Unicodeスクリプト判別で広く対応」を選択された。
- 主な変更内容(`goal2-app/public/app.js`):
  - `LATIN_FOREIGN_PATTERN`: 既存のASCII限定の単語連鎖パターンを、Latin-1 Supplement・Latin Extended-A/B・Latin Extended Additional(ベトナム語の声調記号付き母音を含む)まで拡張し、フランス語・ポルトガル語・スペイン語・ベトナム語のようなアクセント付きラテン文字言語も検出できるようにした。
  - `HANGUL_SCRIPT_PATTERN`・`THAI_SCRIPT_PATTERN`・`CYRILLIC_SCRIPT_PATTERN`: Unicodeスクリプトプロパティ(`\p{Script=...}`)によるハングル・タイ文字・キリル文字の検出を新設。
  - 中国語(漢字)検出は当初「かなを含まない漢字の並び」を条件にしたところ、実データ検証で日本語の通常の見出し・ラベル(「受付窓口」「中央公園会場案内図」「対象者一覧」等、かなを一切含まない漢字だけの語句)を大量に誤検出する重大な回帰が発生した(procedure-overview 7→9件、tables 14→20件等)。原因を分析し、「かな無し」だけでは中国語と日本語の漢字のみラベルを区別できないと判断。`CHINESE_MARKER_PATTERN`(我们/你们/他们/不是/没有/可以/因为/所以/但是/如果/虽然/哪里/什么/怎么/谢谢/欢迎等、日本語では通常使われない中国語特有の代名詞・助詞・熟語、簡体字・繁体字の両表記を収録)を新設し、「漢字を含み、かつ中国語特有語を含む」場合のみ中国語候補とするよう設計を修正。修正後、実データ6サンプルで既存の誤検出はすべて解消し、既存6サンプルの検出件数はURL/メールアドレス修正後のベースラインと完全一致することを確認。
  - `inferLanguageCode()`: ハングル→`ko`、タイ文字→`th`、キリル文字→`ru`、漢字+中国語特有語→`zh`、ベトナム語声調記号→`vi`、`ñ`を含む→`es`、`ã`/`õ`/`ç`のいずれかを含む→`pt`、それ以外のラテン文字→`en`(既存のフォールバック)、いずれにも該当しなければ空文字、の優先順位で言語コードを推定するよう拡張。フランス語のようにこれらの特徴的な文字を含まない場合は引き続き`en`扱いになる制約が残るが、これはKBルールが元々明記している5言語(英・中・韓・西・葡)+実務上有用な追加言語(露・タイ・越)をカバーする範囲であり、それ以外の完全な言語同定は本ルールのスコープ外として許容する。
  - `buildForeignLanguageHtml()`の引数をテキストから言語コードそのものに変更(呼び出し側で1回だけ`inferLanguageCode`を計算し、候補のHTML生成とpatchの両方で同じ値を使うよう統一)。
  - `test/run-tests.js`に、URL/メールアドレス除外・多言語スクリプト検出・中国語マーカー要件についてのアサーションを追加。
- 検証: `node --check`・`node test/run-tests.js`成功。単体のNode.jsスクリプトで英語・フランス語・ポルトガル語・スペイン語・ロシア語・タガログ語・タイ語・ベトナム語・簡体字/繁体字中国語・韓国語の検出/言語コード推定を個別確認(タガログ語は他のASCIIのみの言語と区別不能なため`en`扱いのまま、という既知の限界も確認)。実データ6サンプルで、Chinese markerパターン導入前は「受付窓口」等の日本語見出しを大量誤検出する回帰があったことを検出・修正し、修正後は全サンプルでURL/メールアドレス修正後のベースラインと完全一致することを確認(回帰なし)。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/test/run-tests.js`
- 関連PR: (作成予定)

## 2026-07-10: 「外国語の言語属性」ルールがURL・メールアドレスを誤検出する問題を修正

- 背景・目的: ユーザーから「外国語の言語属性でURLを外国語として扱ってしまっているので除外しましょう」との指摘を受けた。`collectForeignLanguageCandidate()`(`text.foreign-language`)は英字が「3文字以上の単語+区切り文字」を2回以上繰り返すパターンを外国語の目安として検出しているが、この判定は語句の意味を見ておらず、`https://www.city.example.jp/kurashi/gomi/index.html`のようなURLも「www」「example」「jp」等の英字トークンがピリオドで区切られているだけで同じパターンに合致してしまい、誤って「外国語の可能性あり」と判定していた。
- 主な変更内容(`goal2-app/public/app.js`):
  - `URL_OR_EMAIL_PATTERN`正規表現を新設(`https?://`・`www.`始まりのURL、および`xxx@yyy.zzz`形式のメールアドレスにマッチ)。`collectForeignLanguageCandidate()`内で、外国語判定の正規表現を適用する前にこのパターンでURL・メールアドレスをテキストから除去してから判定するよう変更。
  - 実データ検証で、URLだけでなく`<a href="mailto:hoken@example-city.jp">hoken@example-city.jp</a>`のようなメールアドレス表示も同じ理由(ドメイン部分が英字・ピリオド・ハイフンで区切られている)で誤検出していることが判明したため、ユーザーに確認の上、メールアドレスも合わせて除外対象に含めた。
  - 元のテキスト自体(`buildForeignLanguageHtml`で`lang`属性を付与する対象)は変更していない。URL・メールアドレスを除去するのは判定用の一時コピーのみで、実際に候補として提示するHTMLには影響しない。
- 検証: `node --check`・`node test/run-tests.js`成功。既存6サンプルのうち`links-text`サンプルで、修正前は`text.foreign-language`が2件(URL絡みのメールアドレス表示1件+正規の英語文1件)検出されていたが、修正後は誤検出だったメールアドレス表示1件が除外され、正規の英語文(`English guidance is available at the counter.`)のみが正しく残ることを確認(全体件数25→24件、意図した減少)。他5サンプルは完全一致(影響なし)。単体でURL・メールアドレス・通常の英文パターンの真偽判定もNode.jsスクリプトで個別確認済み。
- 関連ファイル: `goal2-app/public/app.js`
- 関連PR: (作成予定)

## 2026-07-10: 寒色系ブルーグレーデザインをmichecker-compare.html/goal3.htmlへ展開+スクロール閉じ込めバグ修正

- 背景・目的: 直前のindex.htmlデザイン刷新(下記エントリ)をユーザーが確認し、他画面への展開を指示。`michecker-compare.html`/`goal3.html`は`index.html`と同じ`styles.css`を共有しているため、`:root`トークンの変更は自動的に反映されるが、ページ固有のハードコード色が旧ミント系のまま残っていた箇所を修正。あわせて、展開時の実データ検証で発見した既存の潜在バグ(ページ全体のスクロール閉じ込め崩れ)、およびユーザーからの追加フィードバック(primaryボタンのホバー時視認性)も同時に修正した。
- 主な変更内容(`goal2-app/public/styles.css`):
  - `.goal3-source-preview`の背景色を旧ミント系`#f8fbfa`から新パレットの`#f6f9fc`(淡いブルーグレー)へ変更。`michecker-compare.html`側は元々中立トーンで使われており修正不要だった。
  - バグ修正: `.michecker-shell`・`.goal3-shell`(いずれも`.app-shell`と同一要素に付与される追加クラス)に`contain: layout;`を追加。`.app-shell`は`display: grid; height: 100vh; overflow: auto;`で内部スクロールを想定しているが、実データ(59行の比較結果テーブル、高さ約8676px)を表示すると、ブラウザの座標計算上の癖(containment未指定によりグリッドコンテナ内の巨大な子要素のスクロール可能領域が祖先の`document.body`のscrollHeightに漏れ出す)により、`body`(`overflow: hidden`)のスクロール高が実際のビューポートを大幅に超えてしまい、フルページ表示(印刷・特定のスクロール計算等)でレイアウトが崩れる状態だった。`.app-shell`自体の内部スクロール(`overflow: auto`)は実際には機能しており、通常のマウス操作によるユーザー体験は壊れていなかったが、`document.body.scrollHeight`の異常な肥大化は他の計算(印刷レイアウト等)に影響しうるため修正した。`.app-shell`単体(index.html)には適用していない。理由: `index.html`は`.app-shell`直下に`position: fixed`の「次にやること」フローティングパネル(`.page-agent-panel`)を持ち、`contain: layout`を付与すると`fixed`の基準がビューポートから`.app-shell`に変わってしまい、パネルがビューポート右下に固定されなくなる回帰が生じるため、対象を`michecker-compare.html`/`goal3.html`(いずれも`.app-shell`内に`position: fixed`要素を持たない)に限定した。
  - バグ修正: `button.primary:hover`の背景色を`var(--primary-strong)`(#17274d、ほぼ黒に近い紺)から`color-mix(in srgb, var(--primary), black 15%)`(元のブルーを保った濃紺)へ変更、外側グローのリングも`0 0 0 6px`(透過82%)から`0 0 0 4px`(透過68%)へ強化。ユーザーから「濃色のボタンにホバーした時の視認性が悪い」との指摘を受けたもの。全ページで共有される`button.primary`ルール(比較する・候補抽出・GOAL2へ渡す等の主要CTAボタン)に適用されるため、3画面すべてに影響する。コントラスト比自体は変更前後ともWCAG AA基準を大幅に上回っており(白文字に対し変更前14.6:1→変更後7.06:1、いずれも基準4.5:1をクリア)問題なかったが、ホバー時に元の色味(ブルー)を失い黒に近づきすぎることで「押せそう」という視覚的な手がかりが弱まっていた点を改善した。
- 検証: `node --check`・`node test/run-tests.js`成功(機能面の変更なし)。Playwrightで実データ(CSVペア59行、goal3.htmlの候補抽出)を読み込んだ状態のスクリーンショットを撮影し両画面の配色を目視確認。修正前後で`document.body.scrollHeight`を計測し、修正前9923px→修正後1000px(ビューポート高と一致)を確認。`.app-shell`自体は`clientHeight: 1000`/`scrollHeight: 10120`のままで内部スクロールが引き続き機能すること、`index.html`の`.page-agent-panel`が修正後も`position: fixed`でビューポート右下に留まること(影響なし)を確認。primaryボタンのホバー状態をPlaywrightでクリップスクリーンショットし、ブルーの色味を保ったまま視認性が改善されたことを目視確認。
- 関連ファイル: `goal2-app/public/styles.css`
- 関連PR: (作成予定、PR #31は既にマージ済みのため新規PR)

## 2026-07-10: index.htmlのビジュアルデザインを寒色系ブルーグレーへ刷新

- 背景・目的: ユーザーから、オペレーショナル・ダッシュボード調のデザイン仕様(レイヤード背景・ニューモーフィズム的な柔らかい影・寒色系ニュートラルパレット・抑制されたアクセントカラー・8px基準のスペーシング・スロー/コントロールドなモーション等を定めたデザインスペック)を採用したいとの依頼があった。既存デザインは単一ブランドアクセント(ティール)を採用していたが、これを寒色系ブルーグレーパレットへ置き換える。まずgoal2-appの全画面のうちindex.html(Goal 2修正候補レビュー画面)から適用する。
- 主な変更内容(`goal2-app/public/styles.css`):
  - `:root`のカラートークンを刷新: `--bg`/`--surface`/`--line`/`--text`/`--muted`等のニュートラルを寒色系ブルーグレーに、`--primary`をティール(#0b6b5c)からブルー(#2f5fdb)へ、`--primary-strong`を紺(#17274d)へ変更。新規に`--sun`(セカンダリハイライト、シアン系)トークンを追加。
  - 見出し深度タグ(`--tag-h1〜h4`)を新パレットに合わせて再配色(h1=primary blue、h2=dark cyan、h3=amber、h4=purple)。
  - 角丸トークンを`--radius-xs`(10px)〜`--radius-xl`(26px)の5段階に再編。8px基準のスペーシングトークン(`--space-1〜6`)とモーショントークン(`--motion-fast`/`--motion-base`/`--motion-slow`、`prefers-reduced-motion`で0msに)を新設。シャドウを緑がかった色味から紺系(`rgba(13, 20, 38, ...)`)へ retint。
  - body背景をレイヤードグラデーション化し、2つのアンビエントな光の玉(ブルー・シアン)を`--motion-slow`(90秒)周期でゆっくりドリフトさせる演出を追加。
  - 全ボタンにホバー時の軽いリフト(-1px)+柔らかいシャドウを追加、primaryボタンはさらに外側グローを追加。トランジションは`--motion-fast`(180ms)。
  - 「次にやること」フローティングパネルのフェーズ別配色(input/generate/review/output)を新パレットに合わせて再配色。
  - `.input-band`の装飾グラデーションを新パレットのブルー系へ変更。
  - 新トークンの色コントラストをWCAG AA(4.5:1)基準で計算確認したところ、`--sun`/`--tag-h2`(旧: 明るいシアン#1fa7c9、白文字コントラスト2.83で未達)と`--faint`(旧: #7c88a0、コントラスト3.53で未達)がAA基準を満たしていなかったため、それぞれ濃色(`#0f6e86`、`#69768d`)に調整して基準を満たすようにした。
- 検証: `node --check`・`node test/run-tests.js`成功(機能面の変更なし)。Playwrightでスクリーンショットを撮影し、初期状態・候補生成後の3カラムワークスペース・候補選択状態・ボタンホバー状態を目視確認。全カラートークンの新パレットでのコントラスト比を計算確認(全てAA基準クリア)。
- 関連ファイル: `goal2-app/public/styles.css`
- 関連PR: (作成予定)
- 備考: 今回はindex.htmlのみ(ユーザー指定によりまず1画面で確認)。ユーザーの確認後、`michecker-compare.html`・`goal3.html`など他画面への展開を予定。

## 2026-07-10: 新規ルール「リンク単体の見出しタグを使わない」を追加

- 背景・目的: ユーザーがビルド前の最終確認をしている中で、「リンク（内部・外部・ファイル）が見出しに設定されている場合は見出しでなくしましょう」との修正依頼があった。カード型の一覧表示（お知らせ一覧・関連ファイル一覧等）で、CMSテンプレートが見た目の強調のために見出しタグ(h1〜h6)でリンクをラップしているだけのケースがあり、これは文書構造上の見出しではなくリンクの一種であるため、見出しジャンプ機能（スクリーンリーダーの見出し単位ナビゲーション）を妨げる。既存の見出し関連ルール3件（heading-required/heading-order/heading-content-quality）はいずれもこのケースに正確には当てはまらないため、新規ルールとして追加した。
- 主な変更内容:
  - 新規ルール`a11y-migration-kb/rules/html-structure/heading-link-only.md`(origin: manual、processing_class: mechanical)を作成。見出しの中身が内部・外部・ファイル(PDF等)リンク1件だけで構成されている場合を対象とし、同一ページ内アンカー・リンク切れ・見出しにリンク以外のテキストも含む場合は対象外(人間の確認に委ねる)とする方針を明記。
  - `goal2-app/public/app.js`に`collectHeadingLinkOnlyCandidates()`を実装。見出しの子要素が`a`要素1件のみ、かつ見出し全体のテキストとリンクのテキストが一致し、`classifyHref()`で内部・外部・ファイル・別ページアンカー・トップページのいずれかと判定された場合に、見出しタグを外す(`unwrap-element`)高確信度・自動適用可能な候補を生成する。壊れたリンク(`isBrokenCandidate`)は対象外にする実装上のガードも追加(開発中に発見)。
  - `a11y-migration-kb/rules/html-structure/index.md`に新規ルールを追記。`build/rules.jsonl`を再生成・同期(59ルール)。
- 検証: 陽性4(内部/外部/ファイル/別ページアンカーリンク)+陰性5(同一ページ内アンカー・混在テキスト・壊れたリンク・通常見出し・複数リンク)+実際に候補を採用して見出しタグが外れリンクが保持されることの確認、計10ケース全PASS。既存6サンプルは実サンプル`goal3-hirosaki-news2019`で実際にこのパターン(PDFファイルへのリンクをh6見出しでラップしている箇所)を正しく検出し+1件(意図した増加)、他5サンプルは完全一致。`node --check`・`node test/run-tests.js`成功。
- 関連ファイル: `a11y-migration-kb/rules/html-structure/{heading-link-only.md(新規),index.md}`、`a11y-migration-kb/build/rules.jsonl`・`goal2-app/data/rules.jsonl`、`goal2-app/public/app.js`、`goal2-app/test/run-tests.js`
- 関連PR: (作成予定)

## 2026-07-10: miChecker-triageバックログ11件の解消(タグ追記・新規ルール2件・スコープ外化)

- 背景・目的: miChecker検出パリティ(Phase 1〜3)完了後、ユーザーから「トリアージバックログの個別判断も同じ形式で進めよう」との依頼を受け、`reference/michecker-triage.md`に残っていた11件のバックログをJavaソース由来の正確な文言を確認した上で1項目ずつ協議し、全件解消した。
- 主な変更内容:
  - **タグ追記(4件)**: `html-structure/deprecated-elements.md`にC_3.0/C_3.1(longdesc・D-link、longdescは既存のC_48.8除去方針で内容確認自体が不要になるため)を追加。`link/link-text.md`にC_46.0(連続リンクの区切り表現、ケース2を追記)。`html-structure/heading-content-quality.md`にC_67.0(見出し・段落・リストの先頭内容、自動検出は追加せず人間確認事項として明記)。`image/alt-text.md`にC_300.1(area要素のalt属性、ケース4を追記、画像マップの利用実績ありとの確認あり)。
  - **新規ルール作成(2件)**: `text/quotation.md`(C_17.0/17.1/18.0/18.1/18.2、blockquote/q/cite要素による引用の構造化)、`text/ascii-art.md`(C_6.0/6.1/69.0、顔文字・アスキーアートの代替表現。顔文字が実務で頻出との確認があったため新規ルール化)。いずれも`goal2-app`側の自動検出コードは持たず、KBドキュメントとして人間/AI判断でのレビュー時に参照する位置づけ。
  - **スコープ外化(5件)**: C_70.0(内容の分かりやすさの一般的確認、汎用的すぎ)、C_87.0(ふりがな、判定が主観的)、C_1.1(object要素alt、利用頻度低)、C_40.0(リンクaccesskey、現代の実務では非推奨のため付与しない方針)、C_300.2(applet要素alt、C_0.x系と同様deprecated-elements.mdでのapplet除去に吸収)を`reference/michecker-out-of-content-scope.json`へ追加。
  - **レビューで発見した不整合の修正**: `image/alt-text.md`に以前からC_80.0が重複タグ付けされていたことを発見(実際の検出コードはPhase 3で`image/complex-image-report.md`側に実装済み)。`alt-text.md`側のタグを削除し、実装箇所と一致させた。
  - `a11y-migration-kb/rules/text/index.md`に新規2ルールを追記。`reference/michecker-triage.md`のバックログ表を解消記録に置き換え。
  - `build/{rules.jsonl,michecker-checkitems.json}`を再生成し`goal2-app/data/`へ同期(58ルール、268チェック項目、本文スコープ外152件)。タグの二重登録(スコープ外との矛盾)なし、意図しない多重タグ付けなしを確認。
- 検証: `node --check`・`node test/run-tests.js`成功。既存6サンプルの候補数は今回のKB/データ変更のみ(app.jsコード変更なし)のため完全一致(回帰なし)。
- 関連ファイル: `a11y-migration-kb/rules/html-structure/{deprecated-elements.md,heading-content-quality.md}`、`a11y-migration-kb/rules/link/link-text.md`、`a11y-migration-kb/rules/image/alt-text.md`、`a11y-migration-kb/rules/text/{index.md,quotation.md,ascii-art.md}`(新規2件)、`a11y-migration-kb/reference/{michecker-out-of-content-scope.json,michecker-triage.md}`、`a11y-migration-kb/build/`・`goal2-app/data/`の両JSONL
- 関連PR: (作成予定、PR #30へ追加)
- 備考: これでmiChecker関連の逆引き精度向上・検出パリティ・トリアージバックログの一連の取り組みが完了した。

## 2026-07-10: miChecker検出パリティ Phase 3(絞り込み確認通知)の実装とノイズ設計協議

- 背景・目的: Phase 1・2A・2Bで対応しきれなかった「C分類(当初未検出42件)」について、ユーザーに「洗い出してほしい」と依頼され、Phase1/2A/2Bで既に解決済みの項目・上位互換への訂正・ノイズ回避での除外を差し引いた結果、実質的な検討対象は15グループ・約30項目まで絞り込めた。ユーザーの希望「個々に選択肢を提示して話し合いながら決める」に従い、15グループそれぞれについて「実装しない/最小限のシグナルのみ/miChecker同等の広い実装」の選択肢を提示し、1グループずつ確認した。
- **協議結果**: 15グループ中6グループを実装(ユーザーが「最小限のシグナル」「機械判定しやすいので両方実装」等を選択)、9グループは実装見送り(理由: 機械判定が困難で人間レビューに委ねる方が実効的、出現頻度が低い、既存の運用で代替可能、等)。
  - 実装: E(見出し内容の質、極端に短い/記号のみに限定)、J(caption品質、汎用語のみに限定)、G(alt150文字超)、M(リスト構造3項目)、K(th配置パターン)、N(形・位置依存語彙、代表的な複合表現のみ)。
  - 見送り: H(テキスト画像化検出)、I(リンクtitle属性)、A(廃止要素の残りタグ)、D(スクリプト依存)、B(動き・閃光の停止手段確認)、F(frame/iframeのtitle品質確認)、O(画像内の色のみ依存)、C(タグ・属性整合性)、L(略語・頭字語abbr化)。
- 主な変更内容(`goal2-app/public/app.js`):
  - C_15.0/C_388.0/C_500.4: 正規化後2文字以下、または記号・句読点のみで構成される見出しを低確信度で確認候補にする(`collectHeadingContentQualityCandidates`、`html-structure.heading-content-quality`)。
  - C_25.3: 「表」「一覧」等、内容を特定しない汎用語のみのcaptionを低確信度でフラグ(`isGenericTableCaptionText`、`table.caption`)。
  - C_80.0: alt属性が150文字を超える画像に、aria-describedby等での詳細説明分離を促す確認候補(`image.complex-image-report`、既存のC_4.0「詳細な説明が必要」と同じruleIdへ寄せた)。
  - C_16.0/C_16.1/C_16.2: li要素を持たないul/ol、親ul/ol/menuを持たないli要素(`collectListStructureCandidates`)。li要素の親子関係はブラウザのHTMLパーサーが自動修復しないことをPlaywrightで確認した上で実装。C_16.0は承認済みの簡易ヒューリスティック(項目1件のみのリスト)で低確信度フラグ。
  - C_331.2: th要素が1行目・1列目のみにある単純な表(行列見出しパターン)で、左上のtd要素にテキストがある場合の確認候補(`collectThLayoutPatternCandidate`、既存の`buildExpandedTableGrid`を流用)。
  - C_83.0: 「右の」「上記の」「下のボタン」等、位置・形状に依存する代表的な複合表現をテキストノードから検出(`collectPositionalLanguageCandidate`、`text.sensory-characteristics`)。単独の「右」「左」は過検出防止のため対象外。
  - **KBタグの補完**: `image/complex-image-report.md`にC_80.0のタグ付けが漏れていた(サブエージェントは「既存タグで十分」と報告したが、レビューで発見・修正)。app.js側の候補生成自体はruleId単位のフィルタのため実害はなかったが、`michecker-compare.js`の逆引き表示の正確性のため追記し、ケース2(alt長すぎる例)も本文に追加。`build/rules.jsonl`を再生成・同期。
- 検証: 陽性15+陰性6+miCheckerモード2の計17ケース(親セッションで独立検証)全PASS。既存6サンプルは`iframe`(4→5)・`goal3-hirosaki-news2019`(17→18)がそれぞれ+1(C_83.0の「下記の」該当箇所があり意図した増加)、他4サンプルは完全一致。`node --check`・`node test/run-tests.js`成功。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/test/run-tests.js`、`a11y-migration-kb/rules/image/complex-image-report.md`、`a11y-migration-kb/build/rules.jsonl`・`goal2-app/data/rules.jsonl`
- 関連PR: (作成予定、PR #30へ追加)
- 備考: これでmiChecker検出パリティの取り組み(Phase 1〜3)が完了。当初のギャップ分析88項目は、上位互換15件・実装対応(Phase1-3合計)約40件・意図的な未実装(dead code・ノイズ回避・要素条件なしの常時リマインダー・出現頻度低)約33件に整理された。トリアージバックログ(michecker-triage.mdの11項目)の個別協議は別途実施予定。

## 2026-07-10: PR #28マージ後の分岐修正、summary属性(C_25.2/C_25.4)の方針決定、不整合データの削除

- 背景・目的: PR #28がPhase 1・2A・2Bのコミットを含まないまま(最初のコミットのみで)マージされていたことが判明した。以後の3コミット(Phase 1・2A・2B)が閉じたPRのブランチに積まれたままどのPRにも属していない状態になっていたため、ユーザーの指示に基づき是正した。あわせて、Phase 1完了時から「要方針判断」として保留していたsummary属性(C_25.2/C_25.4)の扱い、旧セッションから残っていた不整合データの解消もユーザーの指示に基づき対応した。
- 主な変更内容:
  - ブランチを`origin/main`(PR #28およびPR #29がマージ済みの最新main)にリベースし直した。`CHANGELOG.md`の同一挿入位置での競合(PR #29の「プロジェクト理解サマリーの追加」エントリと自分のPhase 1エントリ)を日付順に解消。
  - summary属性(C_25.2/C_25.4)の方針をユーザーと確定: 「summary属性が存在すればシステム側で自動的に削除する(内容の追加・改善は行わない)」。`table/caption.md`から`html-structure/deprecated-elements.md`へ`michecker_check_ids`を付け替え、`deprecated-elements.md`の本文にlongdesc/summary属性の除去方針とケース3(summary属性除去の例)を追記。`reference/michecker-triage.md`に決定内容を記録。
  - `reference/michecker-out-of-content-scope.json`から、実在しないチェックID`C_5.4`(過去セッションの入力ミスと推測、実害なし)を削除。
  - `build/{rules.jsonl,michecker-checkitems.json}`を再生成し`goal2-app/data/`へ同期(56ルール、268チェック項目、本文スコープ外147件)。タグ付けとスコープ外の二重登録が無いことを確認。
- 検証: `node --check`・`node test/run-tests.js`成功。
- 関連ファイル: `a11y-migration-kb/rules/table/caption.md`、`a11y-migration-kb/rules/html-structure/deprecated-elements.md`、`a11y-migration-kb/reference/{michecker-out-of-content-scope.json,michecker-triage.md}`、`a11y-migration-kb/build/`・`goal2-app/data/`の両JSONL
- 関連PR: (作成予定、新規PR)
- 備考: 今後、PRをマージする際は同一ブランチへの追加コミット前に必ず`origin/main`とのマージ状態を確認する。トリアージバックログ(michecker-triage.mdの表)とPhase 3(user/info型の確認通知)の設計方針はユーザーと協議しながら別途進める。

## 2026-07-10: miChecker warning型チェック項目の検出パリティ実装(Phase 2B: 廃止要素拡大・リンク関連・配色確認、最終フェーズ)

- 背景・目的: Phase 2A(テーブル層・色/コントラスト)に続き、B分類(部分カバー)の残り(廃止要素の対象拡大、リンク関連、複雑画像シグナル、配色のみの情報伝達確認)を実装した。Phase 2Aで「事前のギャップ分析レポート自体に誤りがある」ことが判明したため、本Phaseでは実装対象の全項目についてmiChecker本体のJavaソース(`CheckEngine.java`・`HtmlEvalUtil.java`)を先に取得して発火条件を裏取りしてから実装する方針を徹底した。
- **裏取りにより判明した重要な事実**: レポートに残っていたC_19.0/C_500.6(外国語検出)・C_71.0/C_600.0(非テキストコンテンツ代替確認)・C_600.14(曖昧リンク文言)・C_500.11/C_500.12(コントラスト・拡大確認)の計6件は、対応する`item_NN()`ロジックが存在せず、`always()`という**要素条件を一切持たないページ単位の無条件リマインダー**(checkitem.xmlの`type="info"`と整合)であることが判明した。これらをmiChecker通りに実装すると内容に無関係な定型ノイズになるため、Phase 2AのC_23.1と同じ理由で**意図的に未実装**とした。
- 主な変更内容(`goal2-app/public/app.js`):
  - C_48.0/C_48.2: 廃止要素の対象拡大。CENTER・BASEFONT・BIG・TTを`collectDecorationElementCandidate()`に追加(item_48()で実際に発火するタグのみ)。NOBRはitem_48()にチェックロジックが存在せず対象外と確認。
  - C_4.0: 複雑画像のキーワード非依存シグナル。`item_4()`の実際の条件(alt文字列が3語以上または20文字以上、かつ非ASCII含むか30文字超、小さすぎる/細長すぎるアイコンは除外)を`isMicheckerComplexImageAltText()`/`isNormalSizedImageForComplexCheck()`として実装し、既存のキーワード一致判定に追加(いずれかを満たせば発火)。
  - C_8.0: 配色のみでの情報伝達確認。style属性でcolorとbackground/background-colorが**両方**指定されている場合(`styleCheck()`相当)、およびfont要素のcolor/bgcolor属性が**いずれか一方でも**指定されている場合(`item_8()`相当、font要素は条件が異なる)に確認候補を追加。`text.sensory-characteristics`ルールへ対応づけ。
  - C_57.5/C_57.6/C_58.0: リンク関連。隣接(直前・直後)する同一hrefのリンクへの統合検討(C_57.5)、要素・テキストが完全に空のリンク(C_57.6、`href="#"`始まりは既存の`link.link-broken`に委ねるため対象外)、同一リンクテキストで異なるhrefを指す場合の確認(C_58.0)を追加。
  - **副次的なバグ修正**: `text.decoration-lines`ルールのfrontmatterに`michecker_check_ids`が未設定だったため、miCheckerモードでU/S/STRIKE/CENTER/BIG/TT候補が(実際にはC_33.1/33.2/48.2等のmiChecker項目を検出しているにもかかわらず)一切表示されなかった既存バグを発見。`MICHECKER_RULE_ALIASES`に`"text.decoration-lines" → "html-structure.deprecated-elements"`を追加して解消。
- 検証: 陽性12+陰性含む独立検証全PASS(サブエージェント実装後、親セッションで別途Playwrightスクリプトを書いて再検証)、既存6サンプルは`links-text`のみ20→21件(C_8.0のcolor+background-color併用スタイルに該当する既存サンプル文言があり、意図した増加)、他5サンプルは完全一致。`node --check`・`node test/run-tests.js`成功。C_4.0の拡張により、既に丁寧に書かれた説明的なalt文(例:「市役所本庁舎の外観、青空の下で撮影した写真」)にも確認候補が出ることを確認したが、`confidence: low`・`patchMode: none`・人間確認前提の設計であり、miChecker本体自体がこの粒度で動作するため、ユーザーの「検出方法も完全に一致させたい」という要望に沿った意図的な挙動と判断した。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/test/run-tests.js`
- 関連PR: (作成予定)
- 備考: これでmiChecker検出パリティのPhase 1・2A・2Bが完了。ギャップ分析88項目のうちA(上位互換、Phase 2A訂正後15件)はそのまま、B(部分カバー、当初32件)のうち実装したもの以外(dead code 6件・意図的ノイズ回避2件)は対象外と結論。残るC(未検出、42件)への対応(Phase 3、user/info型の確認通知)は未着手。

## 2026-07-10: miChecker warning型チェック項目の検出パリティ実装(Phase 2A: テーブル層・色/コントラスト)

- 背景・目的: Phase 1(error型14件)に続き、ギャップ分析でB分類(部分カバー)とされたテーブル構造・色/コントラスト系の検出漏れを補強した。実装前にmiChecker本体のJavaソース(eclipse-actf `CheckEngine.java`・`HtmlEvalUtil.java`)を直接取得して発火条件を裏取りしたところ、事前のギャップ分析レポートには複数の誤りがあることが判明したため、Javaソースを正として実装範囲を再確定した。
- **ギャップ分析レポートの訂正点**(Javaソース確認により判明):
  - C_76.0・C_500.13/14/15/16は、該当する`addCheckerProblem(...)`呼び出しがmiChecker本体のコード上でコメントアウトされており、実際には発火しないデッドコード。**未実装**(Phase 1のC_332.0と同様の扱い)。
  - C_13.0は、実際の判定が`font[size]`属性と`table/tr/td/col`の`width`/`height`属性(px指定のCSSではなく非`%`のHTML属性)のみを対象としており、既存の廃止要素検出・`table.format-clear`(テーブル書式属性の一括除去)で既にカバー済みと判明。分類はB→**A(上位互換)に訂正**、追加実装なし。
  - C_48.8は「古い属性全般」ではなく、実際は`img[longdesc]`と`table[summary]`(HTML5判定時)の2属性のみが対象と判明。align/bgcolor等はC_48.8としては発火しない(bgcolorは別途、一般的なアクセシビリティ改善として`text.background-color`側で独立に対応)。
  - C_12.0/C_23.0は「レイアウト表の素朴判定」ではなく実際は「表の入れ子」の検出だったため、実装をJavaソースの定義に合わせて訂正。
  - C_23.1(データ表がth/captionを持つ場合の確認)は、実際のコードでは正しく構造化された表にも無条件に発火する仕様のため、実装すると健全な表にまでノイズが出る。意図的に**未実装**。
- 主な変更内容(`goal2-app/public/app.js`):
  - C_12.0/C_12.1/C_12.2 + C_23.0/C_23.2: 表の素朴な構造判定(`classifyNaiveTableStructure`: nested/1row1col/notdata/data)を、既存の`isLikelyLayoutTable()`等による構造化判定(`planTableTreatment`)とは独立したシグナルとして追加(`collectNaiveTableStructureCandidates`)。構造化経路で既に解体・再構築される表とは重複しないよう、構造化プランが立たなかった表にのみ適用。レイアウト表と推定される表でth/caption/summaryが使われている場合の確認候補も追加。
  - C_75.0: 上記の"data"分類で、かつth要素を持たない表への確認候補(`collectThlessDataTableFallbackCandidate`)。既存の構造化経路(`shouldPreserveAsDataTable`等)に乗らない表(例: relation-explanation判定等でスキップされる表)のみを対象とする、狭いが実在するギャップ。
  - C_48.8: `img[longdesc]`・`table[summary]`属性の検出・除去候補(`collectDeprecatedAttributeCandidates`)。
  - C_500.17/C_500.18: `collectInlineStyleCandidate()`の`closest("table")`早期return(テーブルセル内のcolor/background-color指定を一切検出しない設計上の穴)を除去し、テーブル内外を区別せず色系style属性を検出するようにした。`bgcolor`属性も背景色指定として検出・除去対象に追加。表の構造化経路(`cloneTableCellAs`)でも、再構築後のセルにcolor/background系styleとbgcolor属性を引き継がないよう整合を取った。`hasTableFormatting`/`stripFormatting`(table.format-clear)にも`bgcolor`を追加。
- 検証: 陽性11+陰性2の独立検証(サブエージェントの実装後、親セッションで別途Playwrightスクリプトを書いて再検証)全PASS。既存6サンプルの候補数は完全一致(回帰なし、Phase 1と同じ6/4/12/20/2/13)。`node --check`・`node test/run-tests.js`成功。C_75.0は初回の検証HTMLが既存の構造化経路に先に捕捉されてしまい一時的に不一致となったが、原因を追跡した結果テスト側のHTML選定の問題と判明し、真のギャップケース(relation-explanation判定などで構造化経路をすり抜ける表)で正しく発火することを確認した。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/test/run-tests.js`
- 関連PR: (作成予定)
- 備考: 残るPhase 2B(廃止要素拡大・リンク関連・画像/テキスト確認通知、C_48.0/48.2・C_19.0/500.6・C_71.0/600.0・C_600.14・C_4.0・C_500.11/12・C_8.0・C_57.5/57.6/58.0)は未着手。

## 2026-07-09: プロジェクト理解サマリーの追加

- 背景・目的: ユーザーから「まずは内容を理解して整理」する依頼があったため、AGENTS.md、workstream.md、a11y-migration-kb/README.md、memory/project-state.md の内容を踏まえ、プロジェクトの目的・対象範囲・既存KB・miChecker・Goal 1〜3・人間確認との分担を再整理した。
- 主な変更内容:
  - `memory/project-understanding-summary.md` を新規作成し、今後の検討・実装前に参照できる理解サマリーとして、公共団体向けCMS移行とアクセシビリティ修正の効率化方針を整理した。
- 関連ファイル: `memory/project-understanding-summary.md`
- 関連PR: #29(マージ済み)

## 2026-07-09: miChecker error型チェック項目の検出パリティ実装(Phase 1)と見た目比較のサニタイズ修正

- 背景・目的: ユーザーから「ルールとしてはmiCheckerのものを網羅できたが、検出・チェックの方法も全く同じにしたい。ただしgoal2-appの候補生成が上位互換であればそのままでよい」との依頼。タグ付け済み88チェック項目と`app.js`の候補生成ロジックを突き合わせるギャップ分析を実施した結果、A(上位互換)14件・B(部分カバー)32件・C(未検出)42件で、特にmiCheckerが機械的に確定検出する「error型」なのに未検出・不完全なものが14件あった。本エントリはそのerror型14件(Phase 1)の実装。発火条件はmiChecker本体のJavaソース(eclipse-actf `CheckEngine.java`のitem_NN()メソッド群)で裏取りした。
- 主な変更内容(`goal2-app/public/app.js`):
  - C_33.0/C_34.0: blink・marquee要素の検出とunwrap候補(blinkはmiChecker本体と同じくテキスト子孫がある場合のみ発火)。
  - C_36.0/C_36.1: `<meta http-equiv="refresh">`の検出(content値にurlがあればリダイレクト、無ければ自動リロード)と除去候補。
  - C_422.0/C_423.0: fragment全体でのid・accesskey属性値の重複検出(2件目以降を一意化が必要な候補として提示、patchMode: none)。
  - C_51.0/C_51.4: frame要素のtitle欠落・空白検出。frame要素はframeset外ではHTMLパーサーが完全に破棄しDOM走査では原理的に検出できない(貼り付けた時点で作業用HTMLからも消える)ことが判明したため、生入力HTMLをframeset文書として再解析する`collectFrameElementNotices()`を新設し、「CMS本文には取り込めない」旨の注意(`iframe.frame-unsupported`、miCheckerモードでは`html-structure.iframe-frame-title`へ対応づけ)として出力する方式にした。
  - C_57.2: 読み上げ可能テキストの無いリンクの検出。テキストノード+img[alt]+aria-label/aria-labelledby参照先を合成した「読み上げ可能テキスト」が空のリンクを候補化(`computeLinkAccessibleText()`)。
  - C_331.0/C_331.1: th要素のセル単位scope検査(scope欠落、col/row/colgroup/rowgroup以外の不正値)。従来の表単位boolean判定(hasScope)は変更せず検出を追加。
  - C_332.1/C_332.2: headers属性の参照検証(表内に該当idが無い/参照先がth・tdでない)。なおC_332.0はCheckEngine.javaのitem_332()では発火しない(C_332.1/C_332.2のみ実装されている)ことを確認し、本実装でも対象外とした。
  - **バグ修正**: 候補詳細の「見た目の比較」が候補HTMLを親ページへ`innerHTML`で直接挿入しており、meta refresh候補のプレビュー表示でアプリのページ自体が外部URLへ遷移する問題をPlaywright検証中に発見。`sanitizeVisualPreviewHtml()`を新設し、挿入前にmeta/script/base/link要素・on*属性・javascript: URLを除去するようにした。
  - 新候補の「この候補で変わること」要約文言を追加(従来は廃止要素候補等にも見出し系の汎用文言が表示されていた)。
- 検証: 陽性13ケース(各チェック項目の違反HTML)+陰性6ケース(違反なしHTML・空blink・title付きframe等での偽陽性なし)+miCheckerモード動作の計21ケースをPlaywrightで全件PASS。既存6サンプルの候補数は完全一致(回帰なし)。`node --check`・`node test/run-tests.js`成功。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/test/run-tests.js`
- 関連PR: (作成予定)
- 備考: ギャップ分析の全量(88項目のA/B/C分類表・B/C項目の実装メモ)はセッション内スクラッチパッドの`michecker-parity-gap-analysis.md`に基づく。残るPhase 2(warning/B系32件の補強)・Phase 3(user/info型の確認通知)は未着手。summary属性系(C_25.2/C_25.4)はKBの廃止属性方針と衝突するため方針判断待ち。

## 2026-07-09: フォーム・title・lang属性をKBのコンテンツ対象外として整理、逆引きタグの追加補強

- 背景・目的: PR #27での逆引き精度向上作業を踏まえ、ユーザーから「バックログ2件(C_54.0・C_79.5)はフォームなのでコンテンツに入ってこない。他にも本文コンテンツに入らない可能性のあるものはないか」との指摘があった。全268チェック項目を棚卸しした結果、(1)フォームは移行対象の「本文コンテンツ」ではなくCMSのフォーム機能側の実装に依存するためKB対象外とすべき、(2)ページtitleとhtml要素のlang属性は新CMSのテンプレート側で自動生成・自動設定されるため本文編集のスコープ外、という2点をユーザーに確認し、双方とも「対応ルールを削除しスコープ外に分類する」方針で合意した(フォーム: 承認、title/lang: 当初「titleは残しlangのみ削除」で検討したが、ユーザーが「titleもlangも両方削除」に訂正)。あわせて、この棚卸しで見つかった他の高確度なタグ漏れ(見出し入れ子・id/accesskey重複・廃止要素・自動リロード・リスト・表ヘッダ・キャプション・iframe/frame title等)も一括でタグ追記した。
- 主な変更内容:
  - `a11y-migration-kb/rules/form/`配下4ルール+`index.md`を削除(送信ボタン・label配置・必須項目明示・入力形式ヒント)。`rules/index.md`のform/行を削除。
  - `a11y-migration-kb/rules/html-structure/page-title.md`・`lang-attribute.md`を削除。`rules/html-structure/index.md`から該当行を削除。
  - `reference/michecker-out-of-content-scope.json`に、上記削除で解放された6件(C_78.2, C_389.0, C_383.0, C_380.0, C_382.0, C_600.16)を含むフォーム関連約37項目、title/lang関連6項目(C_60.x, C_600.12, C_21.x)、および棚卸しで見つかったframe/frameset・head/メタデータ・サイト内ナビゲーション・スクリプト実装・テンプレートCSS・ARIA実装・廃止要素(applet alt)・汎用的すぎる項目など約80項目を、理由付きで追加(合計148項目)。
  - 既存ルール10件に`michecker_check_ids`を追記: `heading-order.md`(+C_14.0)、`duplicate-id-accesskey.md`(+C_422.0, C_423.0)、`deprecated-elements.md`(+C_33.0-C_33.2, C_34.0)、`embedded-script-behavior.md`(+C_36.0, C_36.1)、`text/list.md`(origin: manual + C_16.0-C_16.2を新規付与)、`table/th-scope.md`(+C_331.2, C_332.0-C_332.2)、`table/caption.md`(+C_25.4)、`html-structure/iframe-frame-title.md`(+C_51.2, C_51.3, C_52.0, C_52.1)、`image/complex-image-report.md`(origin: manual + C_4.0を新規付与)、`image/avoid-text-as-image.md`(+C_500.14)。
  - `reference/michecker-triage.md`: 解決済みのC_54.0・C_79.5バックログ行を削除し、今回の棚卸しで新たに見つかった未対応バックログ(longdesc/D-link、blockquote/cite、リンク区切り、アスキーアート、C_67.0、C_70.0、ふりがな、object alt、リンクaccesskey、area alt等)を新しいバックログ表として追記。フォーム・title・lang削除の経緯を追記。
  - `a11y-migration-kb/build/{rules.jsonl,michecker-checkitems.json}`を再生成し`goal2-app/data/`へ同期(56ルール、268チェック項目)。
- 検証: 実データ(59シグネチャ、`real_before_sjis.csv`+`michecker_after_sample.csv`)で、KB未対応(赤バッジ)が2件→0件に減少、本文スコープ外(グレーバッジ)が25件→33件に増加、ルール一致(マニュアル版24+miChecker版8=32件)は変化なし(回帰なし)を確認。既存サンプル6件でのGoal 2候補生成もPlaywrightで回帰なしを確認。`node --check`(server.js/app.js/michecker-compare.js)・`node test/run-tests.js`成功(スコープ外とタグ付けの二重登録なしを確認するテストも通過)。
- 関連ファイル: `a11y-migration-kb/rules/form/`(削除)、`a11y-migration-kb/rules/index.md`、`a11y-migration-kb/rules/html-structure/{page-title.md,lang-attribute.md}`(削除)、`a11y-migration-kb/rules/html-structure/index.md`、`a11y-migration-kb/rules/html-structure/{heading-order.md,duplicate-id-accesskey.md,deprecated-elements.md,embedded-script-behavior.md,iframe-frame-title.md}`、`a11y-migration-kb/rules/text/list.md`、`a11y-migration-kb/rules/table/{th-scope.md,caption.md}`、`a11y-migration-kb/rules/image/{complex-image-report.md,avoid-text-as-image.md}`、`a11y-migration-kb/reference/{michecker-out-of-content-scope.json,michecker-triage.md}`、`a11y-migration-kb/build/`・`goal2-app/data/`の両JSONL
- 関連PR: (作成予定)

## 2026-07-08: 「KB全ルール(miChecker含む)」と「miChecker指摘対応のみ」の切り替えを両画面に追加

- 背景・目的: ユーザーから「KB(miChecker含む)とmiCheckerのみの切り替えを検討」との依頼があり、対象を確認したところGoal 2修正候補画面とmiChecker比較画面の両方だった。検収基準がmiChecker通過のみの案件で、最小限の修正に絞って作業したいという想定。
- 主な変更内容:
  - Goal 2修正候補画面(`index.html`/`app.js`): 「候補生成」ボタンの並びに「修正基準」セレクタ(「KB全ルール(miChecker含む)」(既定)/「miChecker指摘対応のみ」)を追加。miCheckerモードでは、候補生成時に`michecker_check_ids`を持つルールに対応する候補だけを生成する。画面独自の擬似ルールID(`iframe.title`)は`html-structure.iframe-frame-title`へ対応づけて判定し、`iframe.cms-review`(CMS運用確認でmiChecker外)はmiCheckerモードでは除外される。モードを変更すると「候補生成を押すと反映される」旨のヒントを表示し、証跡JSONに`rule_scope_mode`を記録する。
  - miChecker比較画面(`michecker-compare.html`/`.js`): 「対応ルールの基準」セレクタ(「KB基準(miChecker含む)」(既定)/「miChecker基準のみ」)を追加。miChecker基準モードでは、マニュアル版とmiChecker版の両方に一致する行でmiChecker版(最小限の修正観点)だけを表示し、「(マニュアル版の◯◯に内包)」の注記も非表示にする。マニュアル版しか無い行は、それがmiChecker指摘を解消する唯一の対応ルールなのでそのまま表示する。
  - `test/run-tests.js`に両画面のセレクタ・実装の存在チェックを追加。
- 検証: Playwrightで、Goal 2のmiCheckerモードで候補が絞られること(tables 12→10件、links-text 20→7件、procedure-overview 6→4件)、証跡に`"rule_scope_mode": "michecker"`が記録されること、比較画面で基準切替により「内包」注記が表示/非表示されること、既定(KB)モードでは既存サンプル6件の候補件数に変化がないこと(回帰なし)を確認。`node --check`・`node test/run-tests.js`成功。
- 関連ファイル: `goal2-app/public/index.html`、`goal2-app/public/app.js`、`goal2-app/public/michecker-compare.html`、`goal2-app/public/michecker-compare.js`、`goal2-app/public/styles.css`、`goal2-app/test/run-tests.js`
- 関連PR: (作成予定)

## 2026-07-08: 逆引きの精度向上(偽ギャップ解消・本文スコープ外分類・トリアージ運用の確立)

- 背景・目的: ワークフロー明文化に続く「逆引きの完成度向上」(ユーザー指定の優先順位2番目)。実データで「KB未対応」となっていた51件(59シグネチャ中)を1件ずつ精査したところ、大半は「既存ルールが実質カバーしているのに`michecker_check_ids`が未設定」という偽のギャップ、または本文編集のスコープ外(テンプレート・実装・サイト全体設計等)の項目だった。
- 主な変更内容:
  - 既存ルール17件に`michecker_check_ids`を追記(公式カタログのキーワード検索で同族IDファミリーも含めて登録)。タグ付きルール12件→29件、カバーする公式チェック項目77件に拡大。`embedded-script-behavior`にはキーボードトラップ等の3項目とWCAG 2.1.2/2.2.2を、`sensory-characteristics`には1.4.1を追加。
  - 実データで「問題あり」レベルで検出されていたth要素のscope属性欠如に対応する新規ルール`rules/table/th-scope.md`(origin: michecker)を作成(62ルール目)。
  - 本文編集で対応できない54チェック項目を`reference/michecker-out-of-content-scope.json`に理由付きで分類し、`tools/actf2json.py`が`content_scope_note`としてマージ。`michecker-compare.js`は該当項目をグレーの「本文スコープ外」バッジ+理由で表示(「KB未対応」と区別)。
  - トリアージ運用((1)既存ルールへタグ追記 (2)新規ルール作成 (3)スコープ外分類)を`reference/michecker-triage.md`として文書化。バックログ2件(C_54.0 fieldset・C_79.5 label内容)を記録。タグ付けとスコープ外の二重登録は`test/run-tests.js`が自動検出。
- 検証: 同じ実データ(59シグネチャ)で、KBルール一致8件→32件、KB未対応51件→2件(意図したバックログのみ)、本文スコープ外25件、照合不可0件を確認。既存サンプル6件のPlaywright回帰確認・`node test/run-tests.js`成功。
- 関連ファイル: `a11y-migration-kb/rules/`(17ファイルのタグ追記+`table/th-scope.md`新規+`table/index.md`)、`a11y-migration-kb/reference/{michecker-out-of-content-scope.json,michecker-triage.md,index.md}`、`a11y-migration-kb/tools/actf2json.py`、`a11y-migration-kb/build/`・`goal2-app/data/`の両JSONL、`goal2-app/public/{michecker-compare.js,michecker-compare.html,styles.css}`、`goal2-app/test/run-tests.js`、`a11y-migration-kb/README.md`、`memory/michecker-research.md`
- 関連PR: (作成予定)

## 2026-07-08: goal2-appとmiChecker/htmlchecker.exeの実務ワークフローをAGENTS.md/workstream.mdに明文化

- 背景・目的: ユーザーから「miCheckerとの共存について調整していきましょう」との依頼があり、意図を確認したところ「実業務ワークフローの整理を先に行い、その後で逆引きの完成度を上げる」という優先順位だった。これまでの`AGENTS.md`/`workstream.md`のmiChecker関連記述は「CMS登録後のプレビューURLでmiChecker確認を行い分類する」といった抽象的な記述に留まり、このセッションで実装済みの`michecker-compare.html`(移行前後比較・分類・KBルールへの逆引き)を具体的に反映していなかったため、実際に使えるツールに基づいた具体的な手順として書き直した。
- 主な変更内容:
  - `workstream.md`のGoal 2 Target Flowに、移行前HTMLの確保タイミング、CMS登録後の移行後検査、`michecker-compare.html`への読み込み(ローカルWindows版での自動比較 / Cloud Runホスト版でのCSV手動アップロードの2経路)、「対応ルール」列(マニュアル版/miChecker版への逆引き、KB未対応の可視化)を使った本文起因指摘の絞り込みまでを具体的な手順として追記(全13ステップに再構成)。
  - `workstream.md`のGoal 1 Target Flowにも、Goal 2向けに実装済みの`michecker-compare.html`を将来流用できる旨を一文追記。
  - `AGENTS.md`の「miChecker Quality Signal」節に、`goal2-app/public/michecker-compare.html`の機能(新規/未解消/解消の自動分類、KBルールへの逆引き表示、KB未対応の可視化)と、検査結果の2つの取得方法(Cloud Run版: CSV手動アップロード / ローカルWindows版: htmlchecker.exe自動比較)を追記。
- 検証: ドキュメントのみの変更(コードへの影響なし)。
- 関連ファイル: `AGENTS.md`、`workstream.md`
- 関連PR: (作成予定)

- 背景・目的: ユーザーから「Node.js・signtoolのインストールも含めてパッケージ化できないか、今のままだと敷居が高い」との相談があった。確認したところ、これらのインストールが必要なのはビルドを行う担当者PCのみで、出来上がった`goal2-app.exe`(+`public`+`data`フォルダ)を受け取って使うだけの人には一切不要であることを説明し、意図は「配る側の負担を減らしたい」ではなく「`goal2-app.exe`単体ではなく3点セットを配る必要がある」という点の運用を分かりやすくしたい、ということだったため、配布物を1つのZIPファイルにまとめる自動化を行った。
- 主な変更内容:
  - `goal2-app/build-windows-app.bat`: 末尾に`[6/6]`としてPowerShellの`Compress-Archive`を使い、`goal2-app.exe`・`public`・`data`を`goal2-app-windows.zip`にまとめるステップを追加(全6ステップに変更)。完了メッセージも「このZIP1つを渡せばよい」という内容に更新。
  - `goal2-app/LOCAL_WINDOWS_APP.md`: 「ビルド手順」「利用者側の使い方」を、`goal2-app-windows.zip`を配布・展開する前提の内容に書き換え。トラブルシューティングのステップ番号を`[1/6]`〜`[6/6]`に更新し、ZIP作成失敗時の対処(手動でのZIP作成含む)を追加。
- 検証: `node --check server.js`・`node test/run-tests.js`成功(server.js自体は今回変更なし)。`Compress-Archive`はWindows標準搭載のPowerShellコマンドのため追加インストール不要。実際のZIP生成動作はこの開発環境(Linux)では検証できないため、ユーザーの実機再検証待ち。
- 関連ファイル: `goal2-app/build-windows-app.bat`、`goal2-app/LOCAL_WINDOWS_APP.md`
- 関連PR: (作成予定)

## 2026-07-08: Windows実機でのSEA(.exe)ビルド成功を受けドキュメントを整理

- 背景・目的: `call`の付け忘れ・`signtool`必須化・`signtool`検出のフォールバック追加、という3件の修正を経て、ユーザーのWindows実機で`goal2-app.exe`のビルド→起動→画面表示(KBルール61件の読み込み含む)までの一連の流れが初めて成功した。この過程で判明した「PowerShellでは`.\`が必要」「`[5/5]`でpostjectがファイル書き込みに失敗することがある(プロセスロック/アンチウイルス)」等の知見を反映し、`LOCAL_WINDOWS_APP.md`を実機検証済みの内容として整理した。
- 主な変更内容:
  - `goal2-app/LOCAL_WINDOWS_APP.md`:
    - 「ビルド手順」に、PowerShellでは`.\build-windows-app.bat`と入力する必要がある旨を明記。
    - 「注意」の記載を、Windows実機での動作確認が完了した旨(2026-07-08)に更新。
    - トラブルシューティングを「ビルド中のエラー」「`goal2-app.exe`実行時のエラー」「アンチウイルスによるブロック」の3グループに再構成し、`postject`の`Error: Couldn't write executable`(プロセスロック・アンチウイルスが原因になりうる)の対処法を追加。
- 検証: `node --check server.js`・`node test/run-tests.js`成功(server.js自体は今回変更なし)。ドキュメントの内容は、このセッション中に実際にユーザーのWindows実機で発生した一連の事象とその解決に基づく。
- 関連ファイル: `goal2-app/LOCAL_WINDOWS_APP.md`
- 関連PR: (作成予定)

## 2026-07-08: signtool検出をPATH以外の標準インストール先にも対応

- 背景・目的: signtoolを必須化した直後、ユーザーが「signtoolはインストール済みなのに`signtool was not found`と表示される」と報告した。Windows SDKのインストーラーは`signtool.exe`をPATHに自動追加しないことが多く、また既に開いているコマンドプロンプト/PowerShellのウィンドウにはインストール後のPATH更新が反映されない(新しいウィンドウを開き直す必要がある)ため、`where signtool`だけに頼る検出方法では見つけられないケースがあることが分かった。
- 主な変更内容:
  - `goal2-app/build-windows-app.bat`: `where signtool`で見つからない場合、`C:\Program Files (x86)\Windows Kits\10\bin\`以下を再帰的に検索して`signtool.exe`を探すフォールバックを追加。見つかった場合はそのフルパスを使用する。
  - エラーメッセージに、インストール済みの場合は新しいウィンドウを開き直すよう案内する一文を追加。
  - `LOCAL_WINDOWS_APP.md`のトラブルシューティングを対応更新。
- 検証: `node --check server.js`・`node test/run-tests.js`成功(server.js自体は今回変更なし)。バッチファイルの実際の検索動作はこの開発環境(Linux)では検証できないため、ユーザーの実機再検証待ち。
- 関連ファイル: `goal2-app/build-windows-app.bat`、`goal2-app/LOCAL_WINDOWS_APP.md`
- 関連PR: (作成予定)

## 2026-07-08: signtoolによる署名除去を必須化(goal2-app.exeがNode REPLで起動する不具合を修正)

- 背景・目的: `call`修正後にビルドは`[1/5]`〜`[5/5]`まで完走し`goal2-app.exe`も生成されたが、実行するとアプリではなくNode.jsの対話モード(REPL)が開いてしまう不具合が報告された。`postject`の実行ログに`warning: The signature seems corrupted!`という警告が出ており、これが原因と判明した。`node.exe`は署名済みバイナリであり、Node.js公式のSEA機能ドキュメントでも「署名済みバイナリを改変する場合は事前に署名を除去する必要がある」と明記されている。従来の`build-windows-app.bat`は`signtool`が無い場合は署名除去を静かにスキップする作りだったため、`signtool`が入っていない環境では、ビルド自体は完走するものの中身が壊れた(SEAのフューズが正しく設定されない)`.exe`が生成され、実行時にNode.jsの通常のCLI引数解析にフォールバックしてREPLが起動していた。
- 主な変更内容:
  - `goal2-app/build-windows-app.bat`: `signtool`が見つからない場合はビルドをエラー終了させ、インストール方法を案内するメッセージを表示するよう変更(従来の「スキップして続行」から「必須化」に変更)。
  - `goal2-app/LOCAL_WINDOWS_APP.md`: 前提条件に`signtool`を追加し、「signtoolのインストール(未インストールの場合)」節(Windows SDKインストーラーで「Windows SDK Signing Tools for Desktop Apps」のみを選択導入する手順)を新設。トラブルシューティングに、REPLが開いてしまう症状とその原因・対処法を追加。
- 検証: `node --check server.js`・`node test/run-tests.js`成功(server.js自体は今回変更なし)。`signtool`によるバイナリ署名除去・PE形式でのSEA注入という部分はこの開発環境(Linux)では検証できないため、Node.js公式ドキュメントの記載とpostjectの警告メッセージに基づく修正であり、ユーザーの実機再検証待ち。
- 関連ファイル: `goal2-app/build-windows-app.bat`、`goal2-app/LOCAL_WINDOWS_APP.md`
- 関連PR: (作成予定)

## 2026-07-08: build-windows-app.batが[1/5]で無言終了する不具合を修正(callの付け忘れ)

- 背景・目的: 前回esbuildバンドルのステップを追加したところ、ユーザーがWindows実機で`build-windows-app.bat`を実行すると、`[1/5]`(esbuildバンドル)が正常終了した直後にスクリプト全体が(エラーメッセージも無いまま)終了し、`[2/5]`以降が一切実行されない不具合が発生した。原因は、Windowsのバッチファイルの既知の落とし穴で、`npx`(実体は`npx.cmd`というバッチファイル)を`call`を付けずに別のバッチファイルから呼び出すと、その時点で制御が呼び出し元に戻らずスクリプトが終了してしまうというもの。以前の4ステップ構成では`npx postject`が最後のステップだったため問題が表面化しなかったが、今回`npx esbuild`を先頭ステップとして追加したことで、後続のステップが実行されなくなっていた。
- 主な変更内容:
  - `goal2-app/build-windows-app.bat`: `npx esbuild ...`・`npx postject ...`の呼び出しに`call`を追加。
- 検証: `node --check server.js`・`node test/run-tests.js`成功(server.js自体は今回変更なし)。バッチファイルの実行自体はこの開発環境(Linux)では検証できないため、Windowsのバッチスクリプトにおける「`call`無しで.bat/.cmdを呼ぶと制御が戻らない」という広く知られた挙動に基づく修正であり、ユーザーの実機再検証待ち。
- 関連ファイル: `goal2-app/build-windows-app.bat`
- 関連PR: (作成予定)

## 2026-07-08: SEA(.exe)ビルドがrequire()解決に失敗する不具合を修正(esbuildバンドル追加)

- 背景・目的: 前回のrootDir修正をユーザーがWindows実機で再検証したところ、`goal2-app.exe`が依然としてクラッシュした。この開発環境(Linux)で同じSEAビルド手順を再現して調査したところ、`ERR_UNKNOWN_BUILTIN_MODULE: No such built-in module: ./lib/rules`というエラーで`server.js`の冒頭(`require("./lib/rules")`)から即座にクラッシュすることを確認した。Node.js SEAは埋め込みスクリプトからのローカルファイルへの`require()`を実行時に解決できない(単一の自己完結したスクリプトである必要がある)という、rootDirの問題とは別の既知の制約が原因だった。
- 主な変更内容:
  - `goal2-app/build-windows-app.bat`: SEA化の前段に、`npx esbuild server.js --bundle --platform=node --outfile=server.bundled.js`で`server.js`と`lib/`以下の依存ファイルを1つの自己完結したファイルにまとめるステップを追加(全5ステップに変更)。
  - `goal2-app/sea-config.json`: `main`を`server.js`から`server.bundled.js`に変更。
  - `.gitignore`に生成物`goal2-app/server.bundled.js`を追加。
  - `goal2-app/LOCAL_WINDOWS_APP.md`: バンドルが必要な理由の説明、`esbuild`失敗時のトラブルシューティング、`ERR_UNKNOWN_BUILTIN_MODULE`が出た場合(古い手順でビルドされた.exeが残っている場合)の対処、署名なしバイナリがアンチウイルス/Windows Defenderにブロックされる可能性についての注記を追加。
- 検証: この開発環境(Linux)で、esbuildバンドル→SEA化→postject注入という同じ手順を再現し、生成したバイナリを実際に起動して`/api/health`・`/api/rules`(61ルール)・`/api/michecker-checkitems`(268件)・`index.html`・`michecker-compare.html`のいずれも正しく応答することを確認した(バンドル前の状態では同じ手順で確実に`ERR_UNKNOWN_BUILTIN_MODULE`が再現することも確認済み)。`node --check server.js`・`node test/run-tests.js`成功(server.js自体は今回変更なし)。
- **重要な未検証事項**: バンドル・SEA化・実行の一連の流れはLinux上で動作確認したが、Windows実機での最終確認はまだ完了していない。署名なしバイナリに対するWindows Defender/アンチウイルスの挙動も未確認。
- 関連ファイル: `goal2-app/build-windows-app.bat`、`goal2-app/sea-config.json`、`goal2-app/LOCAL_WINDOWS_APP.md`、`.gitignore`
- 関連PR: (作成予定)

## 2026-07-07: SEA(.exe)ビルドが起動直後に落ちる不具合を修正(rootDir解決)

- 背景・目的: ユーザーが実際にWindows実機で`goal2-app.exe`をビルド・起動したところ、「ダブルクリックしても何も起きない、一瞬何かを開こうとしてそこで終わる」という現象が発生した。原因は、Node.js SEA(単一実行ファイル化)でパッケージ化した場合、埋め込まれたエントリスクリプトの`__dirname`が`.exe`の実際の設置場所を指さない(Node内部の仮想パスになる)という、Node SEA機能の既知の制約だった。`server.js`は`rootDir = __dirname`を起点に`public/`(静的ファイル)・`data/`(ルールデータ)を読み込む設計だったため、SEAビルドでは起動直後にファイル読み込みエラーで即座にクラッシュし、ダブルクリック起動時はコンソール画面が一瞬表示されてすぐ閉じる(エラー内容が読めない)という症状になっていた。
- 主な変更内容:
  - `goal2-app/server.js`: `isSeaBuild`判定を`rootDir`計算より前に移動し、SEAビルド時は`rootDir = path.dirname(process.execPath)`(`.exe`自身の場所)を使うよう修正。通常の`node server.js`実行時は従来通り`__dirname`を使うため、Cloud Run等の既存動作への影響はない。
  - `goal2-app/LOCAL_WINDOWS_APP.md`: `goal2-app.exe`単体ではなく`public`/`data`フォルダを含む`goal2-app`フォルダごと配布・移動する必要があることを明記。トラブルシューティングに、ダブルクリックで何も起きない場合にコマンドプロンプトから実行してエラー内容を確認する手順を追加。
- 検証: `node --check server.js`・`node test/run-tests.js`成功。この開発環境(Linux)では`isSeaBuild`が常に`false`のため、修正後も既存の`__dirname`ベースの経路が変わらず動くことを確認した。SEAビルド時の実際の起動確認は、ユーザーによるWindows実機での再ビルド・再検証待ち。
- **重要な未検証事項**: この修正が実際にWindows実機での起動不具合を解消するかは、まだ確認できていない(この環境ではSEAビルドを実行できないため)。ユーザーに最新の変更を取り込んで`build-windows-app.bat`を再実行し、`goal2-app.exe`が正常に起動するか確認してもらう必要がある。
- 関連ファイル: `goal2-app/server.js`、`goal2-app/LOCAL_WINDOWS_APP.md`
- 関連PR: (作成予定)

## 2026-07-07: LOCAL_WINDOWS_APP.mdにNode.jsインストール手順を追記

- 背景・目的: Windows実機でのSEA(.exe)ビルド検証を進めるにあたり、ユーザーから「miCheckerなど既存ツールのアンインストールは不要か」との確認があった。ビルド自体にはNode.jsのみが必要で、miChecker/htmlchecker.exeとは無関係な独立プロセスであることを回答した上で、Node.js未インストールの担当者向けに導入手順が無いことに気づき、ドキュメントを整備した。
- 主な変更内容:
  - `goal2-app/LOCAL_WINDOWS_APP.md`に「Node.jsのインストール(未インストールの場合)」節を追加。nodejs.orgからのLTS版ダウンロード→インストーラー実行→コマンドプロンプトでの`node -v`確認、という非技術者向けの手順を記載。
  - トラブルシューティング節の`node: command not found`の説明を、新設した節への参照に統一。
- 検証: `node test/run-tests.js`成功(ドキュメントのみの変更のため既存挙動への影響なし)。
- 関連ファイル: `goal2-app/LOCAL_WINDOWS_APP.md`
- 関連PR: (作成予定)

## 2026-07-07: miChecker比較結果からa11y-migration-kbルールへの逆引き機能を実装

- 背景・目的: このセッションの発端だった「miCheckerで指摘される内容を逆引きできれば」という要望を実装した。`goal2-app`のmiChecker比較結果画面(`michecker-compare.html`/`.js`)で、各指摘行の`内容`テキストを公式チェック項目定義(`eclipse-actf/org.eclipse.actf`)と照合し、対応する`a11y-migration-kb`ルール(マニュアル版/miChecker版)を自動表示する「対応ルール」列を追加した。KBルールが無い項目は「KB未対応」+該当WCAG基準として可視化する。
- 主な変更内容:
  - `a11y-migration-kb/vendor/eclipse-actf/`に公式チェック項目定義(`checkitem.xml`・`description_ja.properties`、EPL-1.0)を配置(出典・ライセンスは同ディレクトリの`NOTICE.md`に記録)。
  - `a11y-migration-kb/tools/actf2json.py`(新規)で上記2ファイルを解析し、`build/michecker-checkitems.json`(268チェック項目、`{0}`を含むテンプレート78件・完全静的190件)を生成。`goal2-app/data/michecker-checkitems.json`に同期。
  - `goal2-app/lib/michecker-checkitems.js`(新規、`lib/rules.js`と同じ候補パスパターン)と`GET /api/michecker-checkitems`ルートを追加。
  - `goal2-app/public/michecker-compare.js`: ページ読み込み時に`/api/rules`・`/api/michecker-checkitems`を取得し、チェック項目テンプレート(静的テキストは完全一致、`{0}`含みは正規表現化)による逆引きインデックスを構築。各比較結果行を照合し、一致したチェック項目IDから対応ルール(`michecker_check_ids`経由)、及びそのルールがマニュアル版ルールの`includes`に含まれる場合は内包関係も表示する。
  - `michecker-compare.html`に「対応ルール」列を追加し、説明文を更新。`styles.css`に出自バッジ(マニュアル版/miChecker版/KB未対応)用のCSSクラスを追加。
  - `test/run-tests.js`に`loadCheckitems()`の存在・件数チェックを追加。
- 検証: `node --check`(server.js・lib/michecker-checkitems.js・public/michecker-compare.js)・`node test/run-tests.js`成功。実際のhtmlchecker.exe由来CSV(220行/212行、59シグネチャ)をPlaywrightで比較UIに読み込ませ、テンプレート照合が59件中59件で成功(照合不可0件)、8件がKBルールに一致(うち2件はマニュアル版ルールへの内包表示も正しく表示)、51件が正しく「KB未対応」として可視化されることを確認。既存サンプル6件での回帰確認でも候補件数・ページエラーに変化がないことを確認。
- 関連ファイル: `a11y-migration-kb/vendor/eclipse-actf/{checkitem.xml,description_ja.properties,NOTICE.md}`、`a11y-migration-kb/tools/actf2json.py`、`a11y-migration-kb/build/michecker-checkitems.json`、`a11y-migration-kb/README.md`、`goal2-app/data/michecker-checkitems.json`、`goal2-app/lib/michecker-checkitems.js`、`goal2-app/server.js`、`goal2-app/public/michecker-compare.{html,js}`、`goal2-app/public/styles.css`、`goal2-app/test/run-tests.js`
- 関連PR: (作成予定)

## 2026-07-07: origin値のリネーム(kb→manual)とマニュアル版/miChecker版の内包関係の明示

- 背景・目的: 直前のエントリで導入した`origin: kb`は、リポジトリ全体の呼称である「KB(a11y-migration-kb)」と紛らわしいとの指摘を受け、`a11y-migration-kb`の実態(「データ移行総合マニュアルV2.01」のOKF化)により即した`manual`に改称した。あわせて、マニュアル版とmiChecker版が対になっている2ペアについて、「別々に確認すべき選択肢」ではなく「マニュアル版の基準を満たせばmiChecker版の指摘も内包的に解消する」という関係であることを明示した。
- 主な変更内容:
  - `origin: kb`を使用していた5ファイル(`link/link-text.md`、`html-structure/heading-order.md`、`html-structure/embedded-script-behavior.md`、`html-structure/deprecated-elements.md`、`image/alt-text.md`)を`origin: manual`にリネーム。`tools/okf2jsonl.py`のデフォルト値も`"kb"`→`"manual"`に変更。
  - 新しいフロントマターフィールド`includes`を追加(マニュアル版ルールが内包する対応miChecker版ルールへのパス配列)。`link-text.md`→`link-purpose-standalone.md`、`heading-order.md`→`heading-content-quality.md`の2件に設定。
  - 該当4ファイルの「ポイント」注記を、「両方確認する」という並列的な記述から、「マニュアル版の基準を満たせばmiChecker版の指摘も通常あわせて解消する」という内包関係の記述に修正。
  - `README.md`のフロントマター規約表を更新し、`origin`の値を`manual`/`michecker`表記に、`includes`フィールドの説明を追加。
  - `build/rules.jsonl`を再生成(originカウント: manual 53 / michecker 8)し`goal2-app/data/rules.jsonl`に同期。
- 検証: `node --check server.js`・`node test/run-tests.js`成功。既存サンプル6件でのPlaywright回帰確認で候補件数・ページエラーに変化がないことを確認。
- 関連ファイル: `a11y-migration-kb/tools/okf2jsonl.py`、`a11y-migration-kb/README.md`、`a11y-migration-kb/rules/link/{link-text.md,link-purpose-standalone.md}`、`a11y-migration-kb/rules/html-structure/{heading-order.md,heading-content-quality.md,embedded-script-behavior.md,deprecated-elements.md}`、`a11y-migration-kb/rules/image/alt-text.md`、`a11y-migration-kb/build/rules.jsonl`、`goal2-app/data/rules.jsonl`
- 関連PR: (作成予定)

## 2026-07-07: miChecker公式ソースとの突合による第2弾ルール拡張とorigin区別の導入

- 背景・目的: ユーザーが提示した https://github.com/eclipse-actf/org.eclipse.actf が、miChecker/HTML Checkerの評価エンジン本体のソースコードであることが判明した。`checkitem.xml`(268チェック項目、50種のWCAG 2.0基準)と`description_ja.properties`(日本語メッセージ本文)を解析し、前回のaccessibility.jpカタログ(92件・24種)より遥かに完全な一次情報源としてカバレッジ再分析を行った。ユーザーの指示(「拡張します。ただしCMSの本文コンテンツに関係ないものは省きます。さらにKB由来のものとmiChecker由来のものを分別して修正をKB版とmiChecker版で選べるようにします」)に基づき対応した。
- 主な変更内容:
  - `a11y-migration-kb`のフロントマターに`origin`(`kb`/`michecker`)・`michecker_check_ids`フィールドを新設し、`tools/okf2jsonl.py`・`README.md`を対応更新。
  - 28種のWCAG基準の未カバー項目のうち、メディア制作・サイト全体テンプレート・スクリプト/ARIA実装レベルのもの(音声字幕、フォーカス順序、サイトナビゲーション、フォームのクライアント検証等)はCMS本文コンテンツの編集範囲外として除外。
  - 本文コンテンツで対応可能な項目について、新規ルール8件(`text/sensory-characteristics.md`、`image/avoid-text-as-image.md`、`text/abbreviation.md`、`html-structure/iframe-frame-title.md`、`form/required-field-indication.md`、`form/input-format-hint.md`、`link/link-purpose-standalone.md`、`html-structure/heading-content-quality.md`)を`origin: michecker`として追加。
  - 既存3件(`html-structure/embedded-script-behavior.md`、`deprecated-elements.md`、`image/alt-text.md`)にWCAGタグと`michecker_check_ids`を追加(`origin`は`kb`のまま)。
  - 同一の関心事に対しKB独自の観点とmiChecker由来の観点を別ファイルとして保持し`related`で相互リンクする設計を、`link-text.md`↔`link-purpose-standalone.md`、`heading-order.md`↔`heading-content-quality.md`の2ペアで導入。
  - `build/rules.jsonl`を再生成(53→61ルール)し`goal2-app/data/rules.jsonl`に同期。`memory/michecker-research.md`に詳細を追記。
- 検証: `node --check server.js`・`node test/run-tests.js`成功。`GET /api/rules`で`summary.total=61`を確認。既存サンプル6件でのPlaywright回帰確認で、変更前と同一の候補件数・ページエラーなしを確認。
- **未実装**: `origin`/`michecker_check_ids`は現時点ではKBデータ上の区別に留まり、goal2-appのUIで「KB版」「miChecker版」を視覚的に区別・選択させる画面機能は未実装。
- 関連ファイル: `a11y-migration-kb/tools/okf2jsonl.py`、`a11y-migration-kb/README.md`、`a11y-migration-kb/rules/text/{sensory-characteristics.md,abbreviation.md,index.md}`、`a11y-migration-kb/rules/image/{avoid-text-as-image.md,alt-text.md,index.md}`、`a11y-migration-kb/rules/html-structure/{iframe-frame-title.md,heading-content-quality.md,heading-order.md,embedded-script-behavior.md,deprecated-elements.md,index.md}`、`a11y-migration-kb/rules/form/{required-field-indication.md,input-format-hint.md,index.md}`、`a11y-migration-kb/rules/link/{link-purpose-standalone.md,link-text.md,index.md}`、`a11y-migration-kb/build/rules.jsonl`、`goal2-app/data/rules.jsonl`、`memory/michecker-research.md`
- 関連PR: (作成予定)

## 2026-07-07: miChecker指摘内容カタログとの突合によるa11y-migration-kbルール拡張

- 背景・目的: ユーザーが発見した第三者サイト「miChecker対策テクニック集」(miCheckerの指摘メッセージ・WCAG基準・達成方法を92件一覧化)を、`a11y-migration-kb`の既存ルールと突き合わせたところ、miCheckerでは指摘されるがKB側では未カバーの項目が実在すること(40/92件、17/24種のWCAG基準)が判明した。ユーザーの指示「ルールを拡張していきましょう。KBに拘る必要はないので」に基づき、KBを正本の枠内に留めず拡張する方針で対応した。
- 主な変更内容:
  - 新規ルール8件を追加: `rules/html-structure/deprecated-elements.md`(廃止要素の除去)、`page-title.md`(ページタイトル)、`lang-attribute.md`(lang属性)、`duplicate-id-accesskey.md`(id・accesskey重複)、`embedded-script-behavior.md`(埋め込みスクリプトの自動的な動作)、`rules/text/spaced-characters.md`(文字間の不要な空白)、新設`form/`カテゴリの`submit-button.md`(送信ボタン)・`label-position.md`(label配置)。すべて`resource`にaccessibility.jpの当該ページを出典として明記。
  - 既存ルールの`wcag`フロントマターを拡充: `rules/html-structure/heading-order.md`に`"2.4.10"`(見出しの入れ子関係、本文は既にカバー済みだったためタグ追加のみ)、`rules/text/color.md`に`"1.4.6"`(AAAコントラスト比、CMS標準パレット確認の一文も追加)。
  - `rules/html-structure/index.md`・`rules/text/index.md`・`rules/index.md`(新設`form/`セクション)を更新。
  - `a11y-migration-kb/tools/okf2jsonl.py`で`build/rules.jsonl`を再生成(43→53ルール)し、`goal2-app/data/rules.jsonl`に同期。
  - `memory/michecker-research.md`にカタログの概要・カバレッジ分析手法・拡張内容・未実装の逆引きUIについて追記。
- 検証: `node --check server.js`・`node test/run-tests.js`成功。`GET /api/rules`で`summary.total=53`、`byCategory`が`{file:2, form:2, html-structure:7, image:8, link:9, table:9, text:16}`となることを確認。既存サンプル6件でのPlaywright回帰確認でも候補生成件数に異常なし・ページエラーなしを確認。
- 関連ファイル: `a11y-migration-kb/rules/html-structure/deprecated-elements.md`、`page-title.md`、`lang-attribute.md`、`duplicate-id-accesskey.md`、`embedded-script-behavior.md`、`heading-order.md`、`index.md`、`a11y-migration-kb/rules/text/spaced-characters.md`、`color.md`、`index.md`、`a11y-migration-kb/rules/form/`(新設)、`a11y-migration-kb/rules/index.md`、`a11y-migration-kb/build/rules.jsonl`、`goal2-app/data/rules.jsonl`、`memory/michecker-research.md`
- 関連PR: (作成予定)

## 2026-07-07: ローカルWindows版をNode.js単一実行ファイル(.exe)化する仕組みを追加

- 背景・目的: ローカルWindows版のhtmlchecker.exe自動比較機能を、コマンドラインに不慣れな一般担当者にも配布したいという要望を受けた。専用のWindows環境を用意する代わりに、Node.js標準の単一実行ファイル化(SEA)機能でgoal2-appを1つの`.exe`に固め、ダブルクリックで起動・ブラウザ自動起動・画面からの設定入力ができるようにした(コマンド操作を一切不要にする狙い)。Electronアプリ化も比較検討したが、依存関係が増える(Chromium同梱で数百MB)ことと、今のゼロ依存構成を維持したい方針から、まずはNode.js標準機能のみで完結するSEA方式を選んだ。
- 主な変更内容:
  - `goal2-app/server.js`: `node:sea`モジュールで`.exe`として実行されているかを検知し(`isSeaBuild`)、該当する場合のみ起動時に既定のブラウザを自動で開く(`openBrowser`)。`htmlchecker.exe`のパスを環境変数だけでなく、`%APPDATA%\goal2-app\config.json`(Windows以外ではリポジトリ内の`.goal2-app-local/`)に保存する設定ファイル方式に対応させ、`GET`/`POST /api/local-settings`エンドポイントを新設。環境変数が設定されている場合はそちらを優先する。
  - `goal2-app/public/michecker-compare.html`・`michecker-compare.js`: 「(ローカルWindows限定)」セクションに、`htmlchecker.exe`のパスをテキスト入力・保存できる設定パネルを追加。環境変数での上書き手順の説明は削除した。
  - `goal2-app/sea-config.json`: Node.js SEAの設定ファイルを新規追加。
  - `goal2-app/build-windows-app.bat`: Windows上で`.exe`をビルドするための一連の手順(SEAブロブ生成→node.exeコピー→署名削除→postjectでの埋め込み)を自動化するバッチファイルを新規追加。
  - `goal2-app/LOCAL_WINDOWS_APP.md`: ビルド手順・利用者側の使い方・設定の保存場所・トラブルシューティングをまとめたドキュメントを新規追加。
  - `.gitignore`にビルド成果物(`.exe`、`sea-prep.blob`、ローカル設定フォルダ)を追加。
- **重要な未検証事項**: `.exe`のビルド自体(`build-windows-app.bat`の実行)は、この開発環境がLinuxのため実際には試せていない。Node.js公式のSEAドキュメントに基づいて作成したが、実際にWindows環境でビルド・起動して問題が無いか確認が必要。
- 検証: Linux環境で、設定の保存・読み込み(`/api/local-settings`)がPlaywrightで正しく動作すること(保存→再読み込みで値が保持される)を確認。既存のCSV手動アップロード・分類機能・ローカル自動比較機能(Windows以外での無効化ガード含む)への回帰が無いことも確認した。`node --check`・`node test/run-tests.js`・既存サンプルへの回帰確認はいずれも成功。
- 関連ファイル: `goal2-app/server.js`、`goal2-app/public/michecker-compare.html`、`goal2-app/public/michecker-compare.js`、`goal2-app/public/styles.css`、`goal2-app/sea-config.json`、`goal2-app/build-windows-app.bat`、`goal2-app/LOCAL_WINDOWS_APP.md`、`goal2-app/test/run-tests.js`、`.gitignore`
- 関連PR: (作成予定)

## 2026-07-07: htmlchecker.exe実機検証を受けてlist.csvベースの確実な対応付けに修正

- 背景・目的: ユーザーが実際にWindows環境で`htmlchecker.exe`をビルド・実行し、実データ(安城市 入札結果ページを想定した`before.html`/`after.html`)での検査結果を共有してくれた。これにより、前回「ファイル作成順(mtime)で移行元/移行後を対応付ける」としていた未検証の仮定を、実際に出力される`[日付]_[時刻]_list.csv`(ヘッダー`Target HTML file,Result CSV file`、検査対象パス→結果CSVパスの明確な対応表)を解析する確実な方式に修正できた。
- 主な変更内容:
  - `goal2-app/server.js`: `findNewResultCsvFiles`(mtime順ソート)を削除し、`parseCsvRows`(汎用CSVパーサー)・`parseHtmlCheckerListCsv`(`list.csv`を解析し検査対象パス→結果CSVパスのMapを返す)を追加。`runHtmlCheckerLocalCompare`は、新規生成された`*_list.csv`を1件特定→解析→`beforeHtmlPath`/`afterHtmlPath`をキーに結果CSVパスを確実に取得する方式に変更。
  - `memory/michecker-research.md`に、実機セットアップで発生した問題(`.psf`インポートが`git://`プロトコルのタイムアウトで失敗した件、GitHubからの直接クローンでの回避方法、`htmllist.txt`/`list.csv`の実際の書式、htmlchecker.exe(CLI版)の結果CSVがGUI版と異なり`WCAG 2.0`列を含む12列構成である点)を「実機検証結果」として追記した。
- 検証: ユーザー提供の実際の`list.csv`をパースし、`before.html`→`0707_1120_1.csv`、`after.html`→`0707_1120_2.csv`という対応が正しく取得できることを確認。また実際の2件の結果CSV(62件/57件、12列構成)を`michecker-compare.html`の手動アップロード機能に読み込ませ、49シグネチャに集約されて「新規2・未解消42・解消5」という妥当な結果になることを確認した(列名ベースのパーサーのため列追加の影響を受けないことも確認)。`node --check`・`node test/run-tests.js`はいずれも成功。
- 関連ファイル: `goal2-app/server.js`、`memory/michecker-research.md`
- 関連PR: (作成予定)

## 2026-07-06: (ローカルWindows限定・未検証)htmlchecker.exeによるmiChecker自動比較を追加

- 背景・目的: ユーザーから共有された「miCheckerのアクセシビリティ評価機能とCMS等との連携手順書」により、miChecker本体(GUI)とは別に、同じACTF評価エンジンを使うCLIツール「HTML Checker」(`htmlchecker.exe`)が公式に存在し、`-f htmllist.txt`でHTMLファイル一覧をバッチ検査してCSVを自動出力できることが判明した。専用のWindows環境を用意するのは難しいというユーザーの意向を受け、「Cloud Run上のホスト版」と「ユーザー自身のWindows PCでローカル起動する版」の両方をサポートする方針とし、ローカル版でのみ`htmlchecker.exe`をサーバーサイドから自動起動する機能を追加した。
- 主な変更内容:
  - `goal2-app/server.js`: `POST /api/michecker-local-compare`エンドポイントを新設。リクエストの`beforeHtml`/`afterHtml`を一時フォルダにHTMLファイルとして書き出し、`htmllist.txt`を生成した上で環境変数`MICHECKER_HTMLCHECKER_EXE`で指定された`htmlchecker.exe`を`child_process.execFile`(`-f`オプション)で実行し、`result`フォルダに新規生成されたCSV2件をShift-JISでデコードして返す。`process.platform !== "win32"`の場合や環境変数未設定・実行ファイル不在の場合は明確なエラーメッセージを返す。既存のGETオンリーだったメソッドチェックを、このエンドポイントに限りPOSTも許可するよう変更した。
  - `goal2-app/public/michecker-compare.html`・`michecker-compare.js`: 「(ローカルWindows限定)htmlchecker.exeで自動比較」セクションを追加。移行元/移行後の全体HTMLを貼り付けて実行すると、上記APIを呼び出し、返却されたCSVを既存の`parseMicheckerCsv`/`diffMicheckerRecords`/`renderResults`(手動アップロード版と共通)にそのまま渡して同じ比較結果を表示する。
  - `goal2-app/public/styles.css`: 貼り付け用テキストエリアのスタイルを追加。
- **重要な未検証事項**: `htmlchecker.exe`はWindows専用のためこの開発環境では実際に実行できず、(1)`result`フォルダの出力ファイル名・タイミング、(2)`htmllist.txt`に列挙した順序で結果CSVが生成される、という前提が本当に正しいかは未検証。実機で動かして問題があれば修正が必要。
- 検証: Linux開発環境で`process.platform !== "win32"`の分岐が正しく機能し、明確なエラーメッセージが返ることをPlaywrightで確認した。既存の手動CSVアップロード機能(分類・フィルタ含む)に回帰がないことも確認した。`node --check`・`node test/run-tests.js`はいずれも成功。
- 関連ファイル: `goal2-app/server.js`、`goal2-app/public/michecker-compare.html`、`goal2-app/public/michecker-compare.js`、`goal2-app/public/styles.css`、`memory/michecker-research.md`
- 関連PR: (作成予定)

## 2026-07-06: miChecker比較ビューに本文/テンプレート分類とcontentのみ表示フィルタを追加

- 背景・目的: miChecker CSV比較ビューが「ページ全体」の指摘をそのまま突き合わせるだけで、テンプレート(共通ヘッダー・フッター・ナビ)由来の指摘と、CMSへ移行する本文コンテンツ由来の指摘を区別していなかった。実際のCSVには外部CSSファイル参照(共通スタイル起因、実データ85件中13件、全件で行番号が空欄)が多く含まれており、これらは本文編集では対応不可能な指摘のため、区別できるようにした。
- 主な変更内容:
  - `goal2-app/public/michecker-compare.js`: 各比較結果行に`classification`(`unknown`/`content`/`old-site-template`/`new-cms-template`)を持たせ、内容欄に外部CSSファイル参照(`.css`または「セレクタ=」)がある場合は自動で`old-site-template`と仮分類する(`TEMPLATE_STYLE_REFERENCE_PATTERN`、実データで検証済み)。各行にドロップダウンで分類を上書き可能にし、自動タグには「自動推定」バッジを表示、手動変更で消える。「本文(content)に分類した行だけ表示する」フィルタチェックボックスを追加。
  - `goal2-app/public/michecker-compare.html`・`styles.css`: 上記UI要素(分類列、フィルタ、空状態メッセージ)を追加。
- 検証: 実CSV(85件)で自動タグが2件正しく付与されること、フィルタON時に未分類分は非表示、手動でcontentに変更した行のみ表示されること、自動バッジが手動変更で消えることをPlaywrightで確認。実際にローカルサーバーを起動しスクリーンショットでも見た目を確認した。`node --check`・`node test/run-tests.js`・既存サンプルへの回帰確認もいずれも成功。
- 関連ファイル: `goal2-app/public/michecker-compare.html`、`goal2-app/public/michecker-compare.js`、`goal2-app/public/styles.css`
- 関連PR: (作成予定)

## 2026-07-06: miChecker CSV結果の移行前後比較ビューを追加

- 背景・目的: miCheckerを判断基準の一つに加えたいというユーザー要望を受け、miChecker自体はCLI/APIを持たないWindows専用GUIツールであることを開発環境準備手順書で確認した上で、GUIで手動実行した結果のCSVエクスポート(Shift-JIS/CP932、引用符付きマルチラインフィールド)を取り込み、移行元(旧ページ)と移行後(新ページ)の指摘を比較する機能をgoal2-appに追加した。
- 主な変更内容:
  - `goal2-app/public/michecker-compare.html`・`goal2-app/public/michecker-compare.js` を新規追加。移行元/移行後の2つのCSVファイルをアップロードすると、`(種別, JIS, 達成方法)`の組み合わせをシグネチャとして件数を突き合わせ、「新規」「未解消」「解消」に分類して一覧表示する。サーバー側の変更は無く、クライアントの`TextDecoder("shift_jis")`とvanilla JSのCSVパーサーのみで完結させ、既存のゼロ依存構成を維持した。
  - `goal2-app/public/styles.css` に `.michecker-*` クラス群(アップロードフォーム、統計タイル、結果テーブル、状態バッジ)を追加。
  - `goal2-app/test/run-tests.js` のファイル存在チェックに新規2ファイルを追加。
  - `memory/michecker-research.md` に、実際にユーザーから共有された安城市 入札契約結果ページのmiChecker検査結果CSVを解析した結果(列構成、`種別`4分類の件数傾向、エンコーディングの注意点、前後比較のシグネチャ設計案)を追記した。
- 検証: 実際のCSV(85件)を「移行元」、`問題あり`3件と`問題の可能性大`1件を除去した加工版を「移行後」としてPlaywrightでアップロード・比較し、期待通り「解消」2件・「未解消」57件・「新規」0件になることを確認した。また最小限のCSVペアで「新規」判定(移行後のみに出現する指摘)も正しく動作することを確認した。`node --check`・`node test/run-tests.js`はいずれも成功。
- 関連ファイル: `goal2-app/public/michecker-compare.html`、`goal2-app/public/michecker-compare.js`、`goal2-app/public/styles.css`、`goal2-app/test/run-tests.js`、`memory/michecker-research.md`
- 関連PR: (作成予定)

## 2026-07-06: 表キャプション自動生成の文字化け(mojibake)とヘッダー途中切れを修正

- 背景・目的: ユーザーが独自の入札案件表(工事名称〜その他の9列見出し)を貼り付けて修正候補を確認したところ、「表のキャプション」候補の修正後プレビューが「工事名称 工事場所 工種 公告文 入札条件 提出書類 設計書 Q＆A そ????????????」のように途中から文字化けする不具合が報告された。
- 調査の結果、`goal2-app/public/app.js`に`dataTableCaptionText`という同名関数がリポジトリの初回コミット時点から2つ定義されており、JavaScriptの関数巻き上げにより後方の定義だけが実際に使われていた(前方の定義は完全なデッドコードで、しかもその本文自体が文字化けしたバイト列("陦ｨ縺ｮ蜀・ｮｹ"等)を含んでいた)。実際に使われていた後方の定義では、見出し行から生成するキャプションが長い場合のフォールバック文字列が本来の日本語ではなく単なる`"?"`の連続(`"????????????????"`、`"????????????"`)になっており、これが報告された文字化けの直接原因だった。加えて、36文字での単純な文字数切り詰めが見出しセルの途中(「その他」の「そ」の直後など)で発生し、不自然なキャプションになる問題もあった。
- 主な変更内容(`goal2-app/public/app.js`):
  - 完全にデッドコードだった前方の`dataTableCaptionText`定義(文字化けしたフォールバック文字列を含む)を削除した。
  - 実際に使われている`dataTableCaptionText`の`"?"`連続フォールバックを、既存の`\u`エスケープ済み定数`genericTableCaption`(表の詳細)・`tableDetailSuffix`(の詳細)を使う形に修正した。
  - 見出し行文字列の36文字切り詰めを、文字数の単純カットから新設の`truncateAtWordBoundary`によるセル区切り(スペース)単位の切り詰めへ変更し、単語やセル内容の途中で文字が欠けないようにした。
- 検証: 報告された表(工事名称〜その他の9列)を再現するテストHTMLで、修正後キャプションが文字化けせず、セル境界で自然に切り詰められることをPlaywrightで確認した。`node --check`・`node test/run-tests.js`はいずれも成功。既存の全サンプル(procedure-overview/images/tables/links-text/iframe/goal3-hirosaki-news2019)で候補件数に変化がなく、ページエラーが発生しないことを確認した。
- 関連ファイル: `goal2-app/public/app.js`、`CHANGELOG.md`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-06: 案内リンク付き結合セルを表外抽出ではなくcolspan解除+同一リンク繰り返しに変更

- 背景・目的: 直前のエントリ(「colspanを使わず表外へ抽出する案A」)について、ユーザーから「案Aでヘッダーだけが残ることに違和感がある」「表で無くなることも避けたい」との指摘があり、行を表の外へ抽出する案A自体を撤回。代わりに「表の行としてそのまま残し、`colspan`は解除して実セル(`<td>`)へ分解し、各セルに同じ案内リンク(同一href・同一リンクテキスト)を繰り返す」形へ変更した。捏造した列ごとの説明文は入れない(ユーザーの明示的な要望)。
- 主な変更内容(`goal2-app/public/app.js`):
  - `buildCaptionSeparatedTableHtml`が結合セルにリンクを含む場合に呼んでいた`buildRowExtractedToListHtml`(行を削除し`<h3>+<p>+<ul>`を表外に出力)を削除し、新設の`buildMergedLinkRepeatedAcrossCellsHtml`へ差し替えた。
  - `buildMergedLinkRepeatedAcrossCellsHtml`は、表をクローンして該当行・該当セルの位置をそのまま特定し、`colspan`の値だけ`<td>`(または`<th>`)を新規生成、各セルに同一href・同一テキスト(`extractedRowLinkLabel()` + 「の案件詳細ページ」)の`<a>`を設置して元のセルを置き換える。行自体は削除せず、`colspan`属性も残らない。
  - 不要になった`buildRowExtractedToListHtml`・`spannedColumnHeaderTexts`・`deriveExtractedRowHeading`を削除。`extractedRowLinkLabel`は引き続き利用。
  - `isLinkedGuidanceMergedCell`にヒットした場合の分類理由(`reason`)テキストを、表外分離ではなく「colspanを解除して各列に同じ案内リンクを繰り返し配置」という説明に更新。
- 検証: colspan=6(他セルなし)・colspan=5(整理番号セルあり)の2パターンをPlaywrightで実行し、候補採用後の最終HTMLが行を保持したまま`colspan`なしの実セルへ分解され、各セルに同一リンク(href・テキストとも同一)が入ることを確認。整理番号がある場合はそれがリンクテキストに反映されることも確認した。`node --check`・`node test/run-tests.js`はいずれも成功。既存サンプルへの回帰確認も実施。
- 関連ファイル: `goal2-app/public/app.js`、`CHANGELOG.md`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-06: レイアウト表分解(decomposeLayoutTable)で見出し+対応内容の構造を維持

- 背景・目的: 「セル結合①レイアウト用途」(table.cell-merge-layout、table.cell-merge-fileでも共用)の分解結果が、3セル以上の行(例: 「開催日」「令和8年7月20日」「10時から15時」「雨天中止」)で各セルが独立した段落に単純分解されるだけで、先頭セルが見出し(ラベル)であり残りがそれに対応する内容であるという関係が失われていた。
- 主な変更内容(`goal2-app/public/app.js`の`decomposeLayoutTable`):
  - 既存の「1セルのみ→見出し」「2セルで結合可能→太字ラベル付き段落」に加えて、「3セル以上で先頭セルが見出し的、残りが単純セル」の場合に、先頭セルを`<h(レベル)>`見出しとして分離し、残りのセルを「、」区切りの1つの段落として続ける分岐を追加した。
- 検証: 「開催日/令和8年7月20日/10時から15時/雨天中止」という4セル行が`<h4>開催日</h4><p>令和8年7月20日、10時から15時、雨天中止</p>`に、`table.cell-merge-file`が使う同じ分解ロジックで「参加申込書」行も見出し+内容形式になることを確認した。既存の全サンプルで候補件数・ページエラーに変化がないことを確認し、`node test/run-tests.js`も全件成功した。
- 関連ファイル: `goal2-app/public/app.js`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-06: colspanを使わず表外へ抽出する「案A」パターンを表候補生成に反映

- 背景・目的: 入札案件一覧で、総合評価方式のように複数列(公告文・入札条件等)をcolspanで1セルにまとめ、1つの案内リンクへ誘導する行について、ユーザーと「colspanを使わず、表の外に見出し＋本文＋リンク一覧として抽出する(案A)」方針を検討・合意した。実際にはこの方針がプログラムへ未反映だったため、確認のうえ反映した。
- 主な変更内容(`goal2-app/public/app.js`):
  - `classifyMergedCellTable`に、結合セルがリンク1件と「ご覧ください/ご確認ください」等の案内文を含む場合を検出する`isLinkedGuidanceMergedCell`を追加し、`table.cell-merge-summary`として分類するようにした(従来は汎用の`table.cell-merge-layout`に分類され、案Aが適用されていなかった)。
  - `buildCaptionSeparatedTableHtml`が、結合セルにリンクを含む場合は新設の`buildRowExtractedToListHtml`へ分岐するようにした。該当行を表から削除し、結合セルの案内文から見出し(`deriveExtractedRowHeading`)を、結合していた列見出しから段落文(実在する列名を使用、捏造なし)を、行の他セルから案件名+付随情報(`extractedRowLinkLabel`)を組み立て、`<h3>見出し</h3><p>段落</p><ul><li><a href="...">案件名（付随情報）の案件詳細ページ</a></li></ul>`として表の直後に出力するようにした。
- 検証: 元の1行colspan=6のサンプルで、候補採用後の最終HTMLが意図した見出し・段落・リンク付きリスト構造になることを確認した。既存の全サンプル(procedure-overview/images/tables/links-text/iframe/goal3-hirosaki-news2019)で候補件数に変化がなく、ページエラーが発生しないことを確認し、`node test/run-tests.js`も全件成功した。
- 関連ファイル: `goal2-app/public/app.js`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-06: 同じ箇所への代替修正手段を候補一覧・修正パネルの両方で明示

- 背景・目的: 表組みなどで1箇所に複数の修正方法(候補)が生成される場合、既存の`candidatesForSameTarget`により詳細側の「修正方法」パネルでは代替手段として連携されていたが、左側の修正候補一覧では独立した別々の項目に見えてしまい、同じ箇所への代替手段であることが分かりにくかった。
- 主な変更内容:
  - `goal2-app/public/app.js`の`renderCandidates()`で、`candidatesForSameTarget(candidate).length > 1`の場合に候補一覧の各項目へ「同じ箇所の代替手段 N件中」バッジを表示するようにした。aria-labelにも同内容を追加。
  - `renderDetail()`の「修正方法」パネル見出し直下に、件数に応じた説明文(「同じ箇所への修正方法がN件あります。いずれか1つを選んで採用してください。」/「この箇所の修正方法は1件です。」)を追加した。
  - `goal2-app/public/styles.css`に`.candidate-alt-badge`(候補一覧用バッジ)・`.fix-method-note`(修正方法パネルの説明文)のスタイルを追加した。
  - 表(セル結合系候補)だけでなく、ファイルリンクの表示テキストとリンクテキスト文脈化が同じリンクに対して重複するケースなど、既存の`candidatesForSameTarget`が対象とする全ての箇所で同様に機能することをサンプル(「表: レイアウト・結合・添付」)で確認した。
- 関連ファイル: `goal2-app/public/app.js`、`goal2-app/public/styles.css`、`memory/project-state.md`
- 関連PR: (作成予定)

## 2026-07-05: Goal2の表変換ロジックに「注記の分離」「ファイルリンク文言の列見出し化」「不足セルの補完」を追加

- 背景・目的: ユーザーとの検討で、入札案件一覧のような表(見出し行がtdのまま、案件名セルに`※`注記が埋め込まれ、リンク文言が「PDF」「Excel」のみ、列数より実セル数が少ない行がある)の正しい修正方針が固まったため、Goal2アプリの候補自動生成ロジックに反映した。
- 主な変更内容(`goal2-app/public/app.js` の `buildDataTableSemanticsHtml` 内、既存の `table.caption` 候補生成に追加):
  - 行見出しセル(案件名等)に埋め込まれた`※`始まりの`<strong>`注記を検出して除去し、表の直後に`<h3>注意事項</h3>`+`<ul>`として分離出力する(`extractEmbeddedTableCellNote`/`buildTableNoteSectionHtml`)。`cell-merge-note.md`の「注意書きは表の外へ」方針に対応。
  - データセル内のリンク文言が「PDF」「Excel」「Word」等のファイル種別のみの場合、対応する列見出し(公告文・入札条件等)のテキストに置き換える(`normalizeGenericFileLinkText`)。案件名等は含めず列見出し名のみとする方針で実装。`file-display-text.md`(ファイル種別はCMSが自動表示するため削除)の方針に対応。
  - 元HTMLで行のセル数が見出し列数より少ない場合、不足分を空の`<td>`で補い、列とセルの対応を揃えた。
- 検証: 実際の入札案件表(14行、注記2件を含む実データ)をPlaywrightで貼り付け、候補生成結果を確認。見出し行のth化・注記分離・リンク文言変更・空セル補完が意図通り動作することを確認した。既存の全サンプル(procedure-overview/images/tables/links-text/iframe/goal3-hirosaki-news2019)でページエラーが発生しないことを確認し、`node test/run-tests.js`も全件成功した。
- 関連ファイル: `goal2-app/public/app.js`、`memory/project-state.md`
- 関連PR: (作成予定)

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
