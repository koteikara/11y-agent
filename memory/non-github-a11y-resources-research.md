# non-github-a11y-resources-research.md

## Purpose

この文書は、GitHubリポジトリ以外で、本プロジェクトのCMS移行・アクセシビリティ修正効率化に参考になりそうな標準、行政系ガイドライン、実務資料、評価ツール、研究資料を整理する。

結論として、GitHub外の資料は「直接HTMLを自動修正する材料」よりも、`a11y-migration-kb/` の妥当性確認、ルール化、作業者・承認者の判断補助、証跡設計に使えるものが多い。

本プロジェクトでは、外部資料をそのまま正本にせず、コンテンツ部分に特化した `a11y-migration-kb/` を主基準とする。外部資料は、ルールの根拠、分類、説明、レビュー観点を補強する参照情報として扱う。

## Search Scope

調査日は 2026-06-26。

主な調査対象:

- W3C / WAI の標準、評価方法、チュートリアル
- WAIC の日本語資料、JIS X 8341-3:2016 関連資料
- デジタル庁の行政向けウェブアクセシビリティ資料
- GOV.UK / GDS のコンテンツデザイン・公開ガイダンス
- Section508.gov など公共機関向け評価プロセス資料
- WAVE、ARC Toolkit、IBM Equal Access などの非GitHub中心の評価ツール
- 公共団体案件で重要な評価ツールであるmiChecker
- A11ycの駒瑠市教材サイト、A11yc ACS、A11yc library
- LLMとアクセシビリティに関する近年の研究資料

## High-Level Findings

- GitHub外の資料は、実装コードよりも「判断基準」「運用プロセス」「教育・説明」「評価手順」に強い。
- W3C / WAI は、標準・評価方法・チュートリアルの一次情報として有用である。
- WAICは、日本の公共団体案件で説明しやすい日本語の根拠として重要である。
- デジタル庁のガイドブックは、行政機関・事業者向けに、専門知識がない人への説明材料として使いやすい。
- GOV.UKのコンテンツガイダンスは、表、画像、リンク、見出しなど、CMS本文編集に近い具体的ルールが多く、`a11y-migration-kb/` の運用ルールを磨く参考になる。
- WAVE、ARC Toolkit、IBM Equal Accessなどのツールは、候補提示・人間レビュー・レポート形式の参考になる。ただし多くはページ全体検査が前提であり、本文領域にスコープできない場合はノイズになりやすい。
- miCheckerは、公共団体案件では実務上の受け入れシグナルになり得る。`a11y-migration-kb/` に沿っていても、本文起因の明らかな問題がmiCheckerで残る場合は品質ゲートとして扱う必要がある。
- A11yc関連リソースは、日本語の機械チェック、HTML Source検査、自治体風OK/NG教材、PHPライブラリによる部分HTML検査候補として有用である。
- LLM研究では、アクセシビリティ支援はalt、テーブル、検出、修正提案などで試みられているが、評価方法のばらつきや、障害当事者を含む検証不足が指摘されている。

## Candidate References

### 1. W3C WAI WCAG-EM

- URL: https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/
- Category: conformance evaluation methodology
- Role: ウェブサイトのアクセシビリティ適合性評価方法。

良い点:

- 評価スコープ定義、サイト資産の把握、代表サンプル選定、評価、報告という手順が整理されている。
- 最初に評価範囲を定義する考え方が、本プロジェクトの「コンテンツ部分だけ」に合う。
- レポートと証跡の組み立て方の参考になる。

本プロジェクトで参考にすること:

- 旧サイト全体ではなく、CMS移行対象コンテンツ領域を評価スコープとして明記する。
- Goal 1の一括処理結果や、Goal 2のページ単位支援結果を、評価範囲・評価手順・結果として記録する。
- サンプル検証を行う場合の考え方を取り込む。

注意点:

- サイト全体の適合性評価が主目的であり、HTML断片の自動修正方法は提供しない。
- 本プロジェクトでは、WCAG-EMをそのまま適用するのではなく、移行対象本文領域の評価・証跡設計に限定して参照する。

### 2. W3C WAI Easy Checks

- URL: https://www.w3.org/WAI/test-evaluate/preliminary/
- Category: preliminary accessibility review
- Role: 初期確認向けの簡易チェック。

良い点:

- 見出し、画像代替テキスト、コントラスト、キーボード、フォーム、基本構造など、作業者が理解しやすいチェック項目に分かれている。
- 「完全な評価ではない」ことを明示しており、人間確認を残す設計と相性がよい。

本プロジェクトで参考にすること:

- 作業者・承認者向けの簡易確認チェックリスト。
- `a11y-migration-kb/` のルールを、作業者に説明する際の粒度。
- Goal 2でページごとに表示するステップの順序。

注意点:

- ページ全体向けの初期確認であり、CMS登録HTMLの変換仕様ではない。

### 3. W3C WAI Tutorials

- URL: https://www.w3.org/WAI/tutorials/
- Category: accessible content implementation guidance
- Role: ページ構造、画像、表、フォームなどのアクセシブルな実装チュートリアル。

良い点:

- 画像、表、見出し、コンテンツ構造など、移行対象の本文HTMLに直結するテーマが多い。
- CMSやWYSIWYGエディタなど、オーサリングツールがアクセシブルなコンテンツ作成を支援できることにも触れている。
- 表の `th`、`td`、`scope`、`id`、`headers`、`caption` などの構造整理は、本プロジェクトのテーブル修正に近い。

本プロジェクトで参考にすること:

- `table-agent`、`image-agent`、`heading-agent` の判断根拠。
- `a11y-migration-kb/` の表・画像・見出しルールを機械実行可能な粒度に落とす際の型。
- 修正理由を作業者・承認者へ説明するときの表現。

注意点:

- 実装例は一般的なWeb制作向けであり、自治体CMSの入力制約や既存ナレッジに合わせた調整が必要。

### 4. W3C WAI Writing for Web Accessibility

- URL: https://www.w3.org/WAI/tips/writing/
- Category: content writing guidance
- Role: アクセシブルなWeb本文を書くための基本ガイド。

良い点:

- 見出し、リンクテキスト、画像代替テキスト、明確で簡潔な本文など、CMS本文編集に近い。
- リンク文言を「こちら」「クリック」ではなくリンク先が分かる文言にする考え方が明確。

本プロジェクトで参考にすること:

- リンク文言修正候補の説明。
- 見出し構造の改善候補。
- alt修正時に、情報または機能を表すという判断軸。

注意点:

- 英語圏の文体ガイドであり、日本語行政文書の表記・言い換えには `a11y-migration-kb/` と案件固有ルールを優先する。

### 5. WAIC

- URL: https://waic.jp/
- URL: https://waic.jp/translations/WCAG20/
- URL: https://waic.jp/translations/UNDERSTANDING-WCAG20/
- URL: https://waic.jp/docs/jis2016/test-guidelines/202012/
- URL: https://waic.jp/docs/jis2016/accessibility-plan-guidelines/201604/
- Category: Japanese accessibility standards and guidance
- Role: WCAG 2.0 / JIS X 8341-3:2016 に関する日本語資料。

良い点:

- 日本の公共団体案件で説明しやすい。
- WCAG 2.0、JIS X 8341-3:2016、ISO/IEC 40500:2012の関係を説明している。
- 試験実施ガイドラインは、全ページ試験、ランダム選択、代表ページ選択などの考え方を整理している。
- 方針策定ガイドラインは、対象範囲や除外範囲を明記する考え方が、本プロジェクトのコンテンツ領域スコープに合う。

本プロジェクトで参考にすること:

- `a11y-migration-kb/` のルールに、日本語で説明可能な根拠を付ける。
- スコープ外領域、例外、対象範囲を証跡に残す設計。
- サンプル検証や承認者確認の粒度。

注意点:

- WCAG/JISの根拠資料であり、CMS登録用HTMLの具体的な変換手順は別途必要。

### 6. デジタル庁 ウェブアクセシビリティ導入ガイドブック

- URL: https://www.digital.go.jp/resources/introduction-to-web-accessibility-guidebook
- Category: Japanese government accessibility guide
- Role: 行政官・事業者向けのウェブアクセシビリティ入門・実践資料。

良い点:

- 行政機関・事業者向けで、本プロジェクトの顧客文脈に近い。
- 専門用語を抑え、取り組み方や考え方を説明する資料として使いやすい。
- JIS X 8341-3:2016以降の課題や、スマートフォン対応などの更新観点にも触れている。

本プロジェクトで参考にすること:

- 作業者・承認者・顧客向けの説明資料のトーン。
- 「不要・過剰・不適切な対応」を避けるという考え方。
- アクセシビリティを特別対応ではなく行政サービス品質として扱う説明。

注意点:

- 入門・研修資料であり、AGENTが実行する変換ルールの直接仕様にはならない。

### 7. GOV.UK Content and Publishing Guidance

- URL: https://guidance.publishing.service.gov.uk/
- URL: https://guidance.publishing.service.gov.uk/formatting-content/text-formatting/tables/
- URL: https://guidance.publishing.service.gov.uk/formatting-content/images/
- Category: government content publishing guidance
- Role: 政府サイトの本文コンテンツ作成・公開ガイド。

良い点:

- CMS本文作成に近い粒度で、表、画像、添付ファイル、リンク、見出しなどの具体的ルールがある。
- 表について、複雑すぎる表を避ける、小さすぎる表は本文化する、空セルを避ける、結合セルを避けるなど、移行修正に使いやすい判断が多い。
- 画像について、装飾画像と情報画像、図表・グラフ・インフォグラフィックの本文説明など、altだけに閉じない考え方が参考になる。

本プロジェクトで参考にすること:

- 表を「HTML構造だけ修正」するのではなく、本文化、表分割、添付ファイル化、データ表化などに分類する。
- 画像alt候補を出す前に、本文説明や表データが必要かを判定する。
- 作業者向けの候補理由を、具体的な業務判断として出す。

注意点:

- GOV.UK固有のCMS・記法・政府文体ルールが含まれる。
- 日本の自治体サイトへは、そのままではなく考え方だけを取り込む。

### 8. GOV.UK Design System

- URL: https://design-system.service.gov.uk/
- URL: https://design-system.service.gov.uk/styles/headings/
- Category: design system accessibility guidance
- Role: 政府サービス向けデザインシステム。

良い点:

- 見出しタグと見た目のスタイルを分けて考える点が明確。
- 見出し階層を変える場合はアクセシビリティテストが必要という姿勢が、本プロジェクトの人間確認に合う。

本プロジェクトで参考にすること:

- CMSテンプレートや本文部品の設計観点。
- Goal 2の確認UIを作る場合の見出し・ページ構造の参考。

注意点:

- デザインシステムであり、旧HTMLの移行変換ルールそのものではない。

### 9. W3C ATAG

- URL: https://www.w3.org/WAI/standards-guidelines/atag/
- URL: https://www.w3.org/TR/ATAG20/
- Category: authoring tool accessibility
- Role: CMSなどのオーサリングツールが、アクセシブルなコンテンツ作成をどう支援すべきかの標準。

良い点:

- CMSやWYSIWYGエディタを対象に含む。
- authoring tool自体のアクセシビリティと、authorsがアクセシブルなコンテンツを作る支援を分けている。
- 既存コンテンツの問題チェックと修復支援という観点が、Goal 2に近い。

本プロジェクトで参考にすること:

- Goal 2の作業者向け支援UIの原則。
- CMS管理画面に組み込む場合の支援設計。
- AGENTが候補を出すだけでなく、作業者が理解して修正できる導線を作る。

注意点:

- CMS製品そのもののアクセシビリティ改善にも関わるため、移行HTML修正とは責任範囲を分ける必要がある。

### 10. W3C Evaluation Tools Guidance

- URL: https://www.w3.org/WAI/test-evaluate/tools/selecting/
- URL: https://www.w3.org/WAI/test-evaluate/tools/list/
- Category: evaluation tool selection
- Role: アクセシビリティ評価ツールの選定観点。

良い点:

- ツールは支援であり、すべてを自動確認できるわけではないことを明示している。
- 自動検査、手動検査、CMS連携、ブラウザ拡張、対象範囲などの観点が整理されている。

本プロジェクトで参考にすること:

- 外部検査ツールを主役にしない方針の根拠。
- `content` / `old-site-template` / `new-cms-template` / `unknown` の分類後に、どの結果を使うかを判断する。
- 作業者・承認者確認を残す理由の説明。

注意点:

- ツール一覧は広すぎるため、本プロジェクトの本文領域スコープに合うものだけを見る。

### 11. WAVE

- URL: https://wave.webaim.org/
- Category: visual accessibility evaluation tool
- Role: ページ上に視覚的にアクセシビリティ指摘を表示する評価ツール。

良い点:

- 人間評価を助けるという思想が明確。
- ブラウザ拡張で、認証済みページ、ローカルページ、動的ページも確認しやすい。
- 指摘をページ上の文脈で見せるUIは、Goal 2の候補表示に参考になる。

本プロジェクトで参考にすること:

- 作業者向け候補表示UI。
- 修正箇所を本文中の位置と一緒に示す方式。
- 自動検査と人間確認をつなぐ見せ方。

注意点:

- ページ全体検査が中心で、本文領域に限定できない場合はノイズが混ざる。
- APIやスタンドアロン利用はライセンス・費用・データ送信条件を確認する必要がある。

### 12. TPGi ARC Toolkit

- URL: https://www.tpgi.com/arc-platform/arc-toolkit/
- Category: browser extension / page-level testing
- Role: 単一ページのWCAG 2.1 A/AA検査と修正助言。

良い点:

- ページ単位のオンデマンド検査、要素別結果、修正助言、タブ順序可視化がある。
- 結果をバグ管理へ転記しやすいという観点が、証跡管理に近い。

本プロジェクトで参考にすること:

- Goal 2のページ単位レビューUI。
- 指摘を要素単位で管理するデータ構造。
- 修正、再検査、承認の流れ。

注意点:

- 商用プラットフォーム寄りであり、そのまま採用するものではない。
- ページ全体検査のため、本文領域以外の指摘分離が必要。

### 13. IBM Equal Access Accessibility Checker

- URL: https://www.ibm.com/able/toolkit/verify/automated/
- Category: automated verification workflow
- Role: 自動検査、手動検査、スクリーンリーダー検査を段階的に進める検証ワークフロー。

良い点:

- `Violations` と `Needs Review` を分ける考え方が、本プロジェクトの機械修正・人間確認の分類に合う。
- 自動検査がきれいになってから手動検査へ進むというゲート設計が参考になる。
- 自動検査は要件の一部しかカバーしないため、手動・スクリーンリーダー検査が必要と明示している。

本プロジェクトで参考にすること:

- `auto-fixable`、`needs-review`、`manual-only`、`out-of-scope` の状態管理。
- 承認前ゲートの設計。
- 証跡の分類軸。

注意点:

- IBM固有の要件・ツール体系が前提であり、本プロジェクトでは分類思想だけを取り込む。

### 14. Section508.gov

- URL: https://www.section508.gov/test/
- URL: https://www.section508.gov/develop/
- Category: public sector accessibility testing lifecycle
- Role: 米国連邦政府向けのアクセシビリティ試験・開発・運用資料。

良い点:

- 計画、スコープ、試験、修正、継続監視というライフサイクルが明確。
- 自動、手動、ハイブリッド検査を分けている。
- レポート要素やTrusted Testerの考え方は、承認者確認や証跡管理の参考になる。

本プロジェクトで参考にすること:

- 作業者、承認者、SVの責任分界。
- 修正後の再検査と継続監視。
- 公共団体向け説明でのプロセス設計。

注意点:

- Section 508は米国制度であり、日本のJIS/WCAG要件とは制度上の位置づけが異なる。

### 15. W3C Nu Html Checker

- URL: https://validator.w3.org/nu/
- Category: HTML conformance checker
- Role: HTML構文・仕様適合のチェック。

良い点:

- アクセシビリティ以前に、HTML構造破壊や不正なマークアップを検出する品質ゲートとして使える。
- CMS登録前のHTML断片に対して、ラップ用の最小HTMLを付けて検査する運用が考えられる。

本プロジェクトで参考にすること:

- 変換後HTMLの構造破壊検出。
- 非標準タグ、閉じタグ不整合、table構造破壊などのCritical判定。

注意点:

- アクセシビリティ検査ではなくHTML仕様検査である。
- 断片HTMLをそのまま検査できない場合、検査用ラッパーを設計する必要がある。

### 16. LLM and Web Accessibility Research

- URL: https://arxiv.org/abs/2605.13873
- URL: https://arxiv.org/abs/2511.03471
- Category: research / LLM-supported accessibility
- Role: LLMを使ったアクセシビリティ検出・修正・生成・監査の研究動向。

良い点:

- LLMがalt生成、違反検出、修正提案、マークアップ生成などに使われていることが整理されている。
- 研究上も、評価のばらつき、信頼性、障害当事者を含む検証不足が課題として挙げられている。
- WCAG-EMを人間とAIの協働でスケールさせる研究は、Goal 1 / Goal 2の両方に参考になる。

本プロジェクトで参考にすること:

- LLMは丸ごとHTML書き換えではなく、小さな対象単位の候補生成に使う。
- LLM出力は必ず構造検証、ルール検証、人間確認へ渡す。
- 研究評価の弱点を踏まえ、PoCでは実作業者の確認結果と承認結果を評価データに含める。

注意点:

- 研究はプロトタイプや実験条件に依存するため、自治体CMS移行業務へ直接適用できるとは限らない。

### 17. miChecker

- URL: https://www.soumu.go.jp/info-accessibility-portal/webaccessibility/michecker/
- URL: https://eclipse.dev/actf/downloads/tools/miChecker/index_ja.html
- URL: https://eclipse.dev/actf/downloads/tools/miChecker/v2v3_ja.html
- Category: Japanese public-sector accessibility evaluation tool
- Role: JIS X 8341-3:2016に基づくウェブアクセシビリティ対応を支援する、総務省提供の評価ツール。

良い点:

- 日本の公共団体案件で説明・検収判断に使われやすい。
- 明らかな問題、問題の可能性が高い箇所、人が判断すべき箇所を分けて扱える。
- JIS X 8341-3:2016の関連情報や付属資料への導線があり、作業者・承認者の判断支援に使える。
- 読み上げ順や高齢者・弱視者の見え方のシミュレーションがあり、目視確認の補助になる。
- v3系ではMicrosoft Edge相当のブラウザ利用、HTML Living Standard、WAI-ARIA関連の評価調整が行われている。

本プロジェクトで参考にすること:

- 公共団体案件における受け入れシグナル・品質ゲート候補として扱う。
- Goal 1では、抽出済みHTML断片を検査用HTMLにラップした事前確認と、CMS登録後プレビューURLでの確認に使う。
- Goal 2では、作業者のページ単位作業後、承認前ゲートとして使う。
- miCheckerの指摘を、`content`、`old-site-template`、`new-cms-template`、`unknown` に分類して記録する。
- miCheckerの指摘種別、箇所、対応結果、未解消理由をスプレッドシート証跡へ接続する。

注意点:

- miCheckerはJIS X 8341-3:2016に基づく検証を全て自動的に行えるものではなく、人間の判断が必要な項目が多い。
- ページ全体検査になりやすいため、本文コンテンツだけを対象にする本プロジェクトでは、テンプレート起因の指摘を混ぜない分類が必要。
- CLI/APIで自動実行できるか、GUI前提で運用するかは未確認であり、PoCで確認する必要がある。
- miCheckerの指摘がないことを、アクセシビリティ品質全体の保証として扱ってはいけない。

### 18. A11yc / 駒瑠市 / A11yc ACS

- URL: https://a11yc.com/city-komaru/
- URL: https://a11yc.com/check/index.php
- URL: https://a11yc.com/check/index.php?a=readme
- URL: https://a11yc.com/check/index.php?a=docs
- URL: https://github.com/jidaikobo-shibata/a11yc
- URL: https://github.com/jidaikobo-shibata/city-komaru
- Category: Japanese accessibility testing tool and training fixtures
- Role: 日本語のアクセシビリティ機械チェック、自治体風サンプルサイト、HTML断片検査候補。

良い点:

- 駒瑠市は、架空の地方自治体サイトにアクセシビリティ上の問題を意図的に仕込んだ教材であり、PoCサンプルとして使いやすい。
- WCAG 2.0 / 2.1 / 2.2を切り替えられ、達成基準ごとのOK/NG実装をURLパラメータで再現できる。
- `ng-michecker1` プリセットには、miCheckerでよく指摘されるalt欠落、label不足、iframe title欠落、scopeなしtable、id重複などが含まれる。
- A11yc ACSは、URL検査だけでなくHTML Sourceの貼り付け検査ができる。
- A11yc ACSの検査結果は、Error / Notice、WCAGレベル、達成基準番号、該当HTML断片、判定ログを含む。
- A11yc libraryはPHPライブラリとして公開され、`analyzeHtml()`、`is_partial`、正規化された `issues` 形式を提供している。

本プロジェクトで参考にすること:

- 駒瑠市のOK/NGページを、AGENT候補生成と検証の固定テストデータとして使う。
- A11yc ACSの出力形式を、スプレッドシート証跡列や候補データ形式の参考にする。
- A11yc libraryをローカルまたは社内環境で動かし、本文HTML断片検査に使えるか確認する。
- A11yc結果とmiChecker結果を同じ駒瑠市ページで比較し、検査ツールごとの差分を整理する。

注意点:

- A11yc ACS公開サービスへ実案件HTMLを送る運用は、情報管理上のリスクがある。
- 公開サービスにはPOST制限があり、本番の大量一括処理には向かない。
- 機械チェックであり、アクセシビリティ品質全体の保証にはならない。
- 駒瑠市は教材サイトであり、実案件の移行HTMLとは性質が異なる。
- ページ全体検査では、本文以外のヘッダー、ナビゲーション、フォーム、テンプレート起因の指摘が混ざる。

## Comparison For This Project

| Reference | 標準根拠 | 実務ルール | 評価手順 | ツール/UI参考 | コンテンツ部分への近さ |
|---|---:|---:|---:|---:|---|
| W3C WCAG-EM | 高 | 中 | 高 | 中 | 中 |
| W3C Easy Checks | 高 | 中 | 中 | 中 | 中 |
| W3C Tutorials | 高 | 高 | 中 | 低 | 高 |
| W3C Writing Tips | 中 | 高 | 低 | 低 | 高 |
| WAIC | 高 | 中 | 高 | 低 | 高 |
| デジタル庁ガイドブック | 中 | 中 | 中 | 低 | 中 |
| GOV.UK Content Guidance | 中 | 高 | 中 | 低 | 高 |
| GOV.UK Design System | 中 | 中 | 低 | 中 | 中 |
| W3C ATAG | 中 | 中 | 中 | 高 | 中 |
| W3C Tool Selection | 中 | 中 | 高 | 中 | 中 |
| WAVE | 中 | 中 | 中 | 高 | 中 |
| ARC Toolkit | 中 | 中 | 中 | 高 | 中 |
| IBM Equal Access | 中 | 中 | 高 | 中 | 中 |
| Section508.gov | 中 | 中 | 高 | 中 | 中 |
| Nu Html Checker | 低 | 低 | 高 | 低 | 中 |
| LLM research | 低 | 中 | 中 | 中 | 中 |
| miChecker | 高 | 中 | 高 | 高 | 中 |
| A11yc / 駒瑠市 | 中 | 高 | 高 | 高 | 高 |

## What We Should Carry Over

### From standards and Japanese guidance

- `a11y-migration-kb/` の各ルールに、WAIC / WCAG / JIS / W3Cへの根拠リンクを付ける。
- 対象範囲、除外範囲、例外、未対応理由を明記する。
- 作業者・承認者向けには、日本語で説明しやすいWAICとデジタル庁資料を優先して参照する。

### From content design guidance

- 表は、HTML構造修正だけでなく、本文化、分割、添付ファイル化、データ表化を含めて候補分類する。
- 画像は、altの有無だけでなく、本文説明、キャプション、データ表、添付ファイルへの置換も候補にする。
- リンク文言は、リンク先の目的が分かるかを人間確認対象にする。
- 見出しは、見た目ではなく構造と意味で判断する。

### From evaluation tools and workflows

- 自動検査は支援であり、判定の最終責任を持たせない。
- `Violation`、`Needs Review`、`Manual Only`、`Out of Scope` の分類を持つ。
- ページ全体検査を行う場合は、本文領域以外を移行HTML修正候補から除外する。
- 作業者が見て分かる位置・理由・修正案をセットで出す。
- miCheckerで本文起因の明らかな問題が残る場合は、修正、例外理由、エスカレーションのいずれかを必ず記録する。
- miCheckerを使う場合は、バージョン、実行日、検査対象URLまたはHTML、検査対象種別、分類、対応結果を証跡に残す。
- A11ycのError / Notice / 達成基準番号 / snippet形式を、AGENT候補形式と証跡列の参考にする。
- 駒瑠市のOK/NGサンプルを、ルール別PoCと回帰テスト用フィクスチャの参考にする。

### From ATAG

- Goal 2は、単なる変換エンジンではなく、作業者がアクセシブルなコンテンツを作るためのauthoring supportとして設計する。
- CMS管理画面や候補確認UI自体も、キーボード操作、見出し構造、フォーカス順序、説明文の分かりやすさを確認する。

### From LLM research

- LLMは小さな単位の候補生成に限定する。
- LLM出力の評価には、構造検証、自動検査、人間確認、承認結果を組み合わせる。
- PoCでは、LLMによる作業削減量だけでなく、誤修正、要確認増加、承認差し戻し率も測る。

## What Not To Copy Directly

- 外部ガイドラインの一般ルールを、自治体CMS移行ルールとして無条件に採用すること。
- ページ全体の評価結果を、コンテンツ部分の修正候補としてそのまま扱うこと。
- ツールのスコアを、移行HTMLの品質保証そのものとして扱うこと。
- 英語圏の行政文体やCMS記法を、日本語自治体サイトへそのまま持ち込むこと。
- LLM研究の成功例を、実務品質保証済みの方法として扱うこと。

## Recommended Direction

1. Primary rule base
   - `a11y-migration-kb/` を主基準にする。
   - 外部資料は、根拠、補足説明、分類、レビュー観点として対応づける。

2. Content-only crosswalk
   - `a11y-migration-kb/` のルールごとに、WAIC、W3C、GOV.UK、デジタル庁などの参照先を対応づける。
   - 対応づけは、作業者が見る説明用と、AGENTが使う判定用に分ける。

3. Evidence and review
   - WCAG-EM、WAIC試験実施ガイドライン、Section508.gov、IBMの考え方を参考に、証跡形式を作る。
   - `auto-fixed`、`suggested`、`needs-review`、`manual-only`、`out-of-scope` を記録する。

4. Tool usage
   - WAVE、ARC Toolkit、IBM、Nu Html Checkerなどは、最終判断ではなく検査・確認・UI設計の参考にする。
   - 本文領域にスコープできないツールは、ページ全体確認またはテンプレート課題検出用に限定する。
   - miCheckerは公共団体案件の実務上の受け入れシグナルとして、CMS登録後プレビュー確認の品質ゲート候補にする。ただし、`a11y-migration-kb/` を置き換えるものではない。
   - A11yc ACS公開サービスは調査・PoC確認用にとどめ、実案件HTMLではA11yc libraryのローカル利用可否を優先して検証する。

5. Goal 2 authoring support
   - ATAGを参考に、作業者がアクセシブルなコンテンツを作れる支援UIとして設計する。
   - 候補適用、理由確認、差し戻し、承認、証跡化までを同じ流れで扱う。

## Candidate Next Work

- `a11y-migration-kb/` の各ルールと、WAIC / W3C / GOV.UK / デジタル庁の参照先を対応づける。
- `content-only-reference-crosswalk.md` のような対応表を作る。
- 表、画像、リンク、見出しの4領域について、最初のAGENT候補分類を作る。
- 外部ツールの結果を `content`、`old-site-template`、`new-cms-template`、`unknown` に分類する仕様と、証跡列を設計する。
- miCheckerの指摘種別と `a11y-migration-kb/` のルール分類を対応づける。
- miChecker確認結果をスプレッドシート証跡へ取り込む列設計を作る。
- A11yc libraryの `analyzeHtml()` と `is_partial` を使った本文HTML断片検査PoCを作る。
- 駒瑠市の `criteria` / `preset` を使い、ルール別のOK/NGテストセットを作る。
- Goal 2のUIをATAG観点で検証するチェックリストを作る。

## Source Links

- https://www.w3.org/WAI/test-evaluate/conformance/wcag-em/
- https://www.w3.org/WAI/test-evaluate/preliminary/
- https://www.w3.org/WAI/tutorials/
- https://www.w3.org/WAI/tutorials/page-structure/
- https://www.w3.org/WAI/tutorials/images/
- https://www.w3.org/WAI/tutorials/tables/
- https://www.w3.org/WAI/tips/writing/
- https://www.w3.org/WAI/test-evaluate/tools/selecting/
- https://www.w3.org/WAI/standards-guidelines/atag/
- https://www.w3.org/TR/ATAG20/
- https://validator.w3.org/nu/
- https://waic.jp/
- https://waic.jp/translations/WCAG20/
- https://waic.jp/translations/UNDERSTANDING-WCAG20/
- https://waic.jp/docs/jis2016/test-guidelines/202012/
- https://waic.jp/docs/jis2016/accessibility-plan-guidelines/201604/
- https://www.digital.go.jp/resources/introduction-to-web-accessibility-guidebook
- https://guidance.publishing.service.gov.uk/formatting-content/text-formatting/tables/
- https://guidance.publishing.service.gov.uk/formatting-content/images/
- https://design-system.service.gov.uk/styles/headings/
- https://wave.webaim.org/
- https://www.tpgi.com/arc-platform/arc-toolkit/
- https://www.ibm.com/able/toolkit/verify/automated/
- https://www.section508.gov/test/
- https://www.section508.gov/develop/
- https://arxiv.org/abs/2605.13873
- https://arxiv.org/abs/2511.03471
- https://www.soumu.go.jp/info-accessibility-portal/webaccessibility/michecker/
- https://eclipse.dev/actf/downloads/tools/miChecker/index_ja.html
- https://eclipse.dev/actf/downloads/tools/miChecker/v2v3_ja.html
- https://a11yc.com/city-komaru/
- https://a11yc.com/check/index.php
- https://a11yc.com/check/index.php?a=readme
- https://a11yc.com/check/index.php?a=docs
- https://github.com/jidaikobo-shibata/a11yc
- https://github.com/jidaikobo-shibata/city-komaru
