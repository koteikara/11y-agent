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
