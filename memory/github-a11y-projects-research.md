# github-a11y-projects-research.md

## Purpose

この文書は、`accessibility`、`a11y`、`WCAG`、`HTML`、`fix`、`remediation` などのキーワードでGitHubリポジトリを調査し、本リポジトリのCMS移行・アクセシビリティ修正効率化プロジェクトで参考にできるものを整理する。

結論として、既存OSSには強力な「検査」「ルール標準化」「レポート」「AIによる候補提示」は存在する。一方で、本プロジェクトのように「旧サイトHTMLからCMS登録用HTMLへ移行し、作業者・承認者の確認フローと証跡管理まで含めて最適化する」ものは見つからなかった。

## Search Scope

調査日は 2026-06-26。

主な検索キーワード:

- `accessibility`
- `a11y`
- `WCAG`
- `HTML`
- `accessibility testing`
- `accessibility remediation`
- `accessibility fix`
- `a11y autofix`
- `AI accessibility checker`
- `accessibility agents`

主な調査元:

- GitHub repository search
- GitHub topic search
- 各リポジトリのREADME
- 関連する一次ドキュメント

## High-Level Findings

- 大規模で成熟しているOSSの多くは、HTMLを「直す」よりも「検査する」ことに強い。
- `axe-core`、`pa11y`、`HTML_CodeSniffer`、`Lighthouse`、`Accessibility Insights` は、CMS登録前後の品質ゲートとして参考にできる。
- `ACT Rules`、`Siteimprove/Alfa` は、ルール設計、判定根拠、レポート形式の参考になる。
- `awslabs/content-accessibility-utility-on-aws` は、監査、修正、バッチ処理、利用量記録を分けた構成が本プロジェクトに近い。
- `hatemile/hatemile-for-javascript` は、HTMLをよりアクセシブルに変換する発想が近いが、現代的なCMS移行プロジェクトへそのまま使うには古く、ランタイムDOM補助寄りである。
- `Community-Access/accessibility-agents` は、AIエージェントを専門分化させる考え方が参考になる。ただし既存コード/新規コードのレビュー支援が中心で、移行HTMLの自動最適化とは異なる。
- `qed42/ai-accessibility-checker` のようなAIチェッカーは、修正提案の形式やプライバシー注意の参考になる。ただしHTML全体を外部APIへ送る方式は本プロジェクトでは慎重に扱う必要がある。
- 外部プロジェクトの多くはページ全体、アプリ全体、またはレンダリング済みDOM全体を対象にするため、本プロジェクトの「CMSに登録するコンテンツ部分だけ」を扱う要件では、そのまま使うとヘッダー、ナビゲーション、フッター、テンプレート部品の指摘がノイズになりやすい。

## Content-Only Scope Implications

本プロジェクトでは、外部ツールの検査結果よりも、コンテンツ部分に特化した `a11y-migration-kb/` を主基準にする。

- 旧サイトHTML全体に対する指摘は、移行対象コンテンツへの指摘とは限らない。
- 外部ツールの結果は、`content`、`old-site-template`、`new-cms-template`、`unknown` に分類してから扱う。
- 修正候補に昇格できるのは、`content` に分類でき、かつ `a11y-migration-kb/` のルールまたは業務上の移行判断と対応づくものに限る。
- `old-site-template` の問題は、移行時に持ち込まないための除外確認として扱う。
- `new-cms-template` の問題は、CMSテンプレートや製品側改善の課題として分離し、移行HTML修正候補には混ぜない。
- `unknown` は作業者または承認者の確認対象とし、自動修正しない。
- 検査は可能な限り、抽出済みHTML断片、本文領域のroot selector、またはCMSプレビュー内の本文領域に限定して実行する。
- ページ全体検査は、最終確認やCMSテンプレート課題の発見には有用だが、移行対象コンテンツの修正候補生成とは別のレイヤーとして扱う。

## Candidate Repositories

### 1. dequelabs/axe-core

- URL: https://github.com/dequelabs/axe-core
- Category: accessibility testing engine
- Role: HTML/DOMのアクセシビリティ自動検査エンジン。

良い点:

- WCAG 2.0、2.1、2.2 の A、AA、AAA とベストプラクティスを扱う。
- 既存テスト環境へ組み込みやすい。
- 自動検出できないものは `incomplete` として手動確認対象にできる。
- README上で、自動検出できる範囲には限界があることを明示している。

本プロジェクトで参考にすること:

- CMS登録前後の品質ゲートに使う。
- AGENTの修正結果に対する自動検査として使う。
- `violations` と `incomplete` を分け、後者を作業者・承認者の確認対象にする。
- 「自動化できる範囲」と「人間確認が必要な範囲」を分離する設計に使う。

注意点:

- axe-coreは修正エンジンではない。
- 日本語行政コンテンツの意味判断、リンク文言改善、画像altの妥当性判断などは別途必要。

### 2. pa11y/pa11y

- URL: https://github.com/pa11y/pa11y
- Category: CLI / Node.js accessibility testing
- Role: URLまたはローカルHTMLファイルに対するアクセシビリティ検査。

良い点:

- CLIでURLやローカルHTMLを検査できる。
- JSON、CSV、HTMLなどのレポート出力に対応する。
- `--root-element` で検査対象範囲を絞れる。
- `HTML_CodeSniffer` と `axe` のrunnerを使える。
- exit codeによりCIや品質ゲートへ組み込みやすい。

本プロジェクトで参考にすること:

- 移行対象のコンテンツ部分だけを検査する方式。
- ページ一覧に対する一括検査。
- スプレッドシートへ流し込みやすいCSV/JSONレポート。
- Goal 1の一括処理後ゲートとしての利用。

注意点:

- 修正はしない。
- 動的レンダリング後のCMSプレビュー検査には有効だが、CMS入力HTML断片の変換には別エンジンが必要。

### 3. squizlabs/HTML_CodeSniffer

- URL: https://github.com/squizlabs/HTML_CodeSniffer
- Category: browser/client-side accessibility standard checker
- Role: HTML文書またはHTMLソースコードに対して、WCAGやSection 508違反を検出する。

良い点:

- WCAG 2.1 のA/AA/AAA、Section 508に対応する。
- ブックマークレット、JS直接実行、CLI、Node.js + JSDOMなど複数の利用形態がある。
- HTMLソース断片への検査ができる。
- Pa11yのrunnerとしても使われる。

本プロジェクトで参考にすること:

- CMS登録前のHTML断片検査。
- 作業者向けの候補表示に近いメッセージ設計。
- `a11y-migration-kb/` のルールと外部検査結果の対応付け。

注意点:

- 修正はしない。
- 最終リリースが古く、現代ブラウザ・最新WCAGへの追随は確認が必要。

### 4. Siteimprove/alfa

- URL: https://github.com/Siteimprove/alfa
- Category: standards-based conformance testing engine
- Role: HTML/CSS/JavaScriptを対象に、ACT Rules FormatとWCAGに基づくアクセシビリティ適合性テストを行う。

良い点:

- ACT Rules Format、EARL JSON-LDなど、標準寄りの設計。
- ルール実行、結果表現、スクレイピング、クロールなどが分かれている。
- false positive / false negativeのバランスを設計目標として扱っている。
- `cantTell` のような、人間判断が必要な結果を扱う設計がある。

本プロジェクトで参考にすること:

- `a11y-migration-kb/` のルールを実行可能な形式へ落とす際の設計。
- 結果を `passed` / `failed` / `cantTell` / `inapplicable` のように分類する発想。
- 証跡を標準的なレポート構造に近づける発想。

注意点:

- 修正エンジンではない。
- 学習コストと実装複雑度が高い。

### 5. act-rules/act-rules.github.io

- URL: https://github.com/act-rules/act-rules.github.io
- Category: rule specification / standards community
- Role: 自動・半自動アクセシビリティテストのためのACTルールを管理する。

良い点:

- 「ツールではなくルールを書く」という思想が明確。
- WCAG適合性テストの結果がどうあるべきかを、実装非依存で記述する。
- ツール間の透明性と品質改善を目的にしている。

本プロジェクトで参考にすること:

- `a11y-migration-kb/` を「人間向けマニュアル」から「AGENTが扱えるルール定義」へ変換するときの型。
- ルールごとに、適用条件、期待結果、非適用条件、手動確認条件を分ける。
- 検査・修正・証跡の分離。

注意点:

- 修正方法までは提供しない。
- 業務ルールやCMS固有制約は別途必要。

### 6. awslabs/content-accessibility-utility-on-aws

- URL: https://github.com/awslabs/content-accessibility-utility-on-aws
- Category: GenAI audit/remediation utility
- Role: PDFをアクセシブルHTMLへ変換し、HTMLをWCAG 2.1に基づいて監査・修正するAWS上のユーティリティ。

良い点:

- `PDF2HTML`、`Audit`、`Remediate`、`Batch` という責務分離がある。
- HTML監査、直接修正、AI修正を分けている。
- 大量コンテンツのバッチ処理と利用量・コスト追跡を扱っている。
- table remediationを明示的に扱っている。

本プロジェクトで参考にすること:

- `Audit -> Remediate -> Batch -> Usage tracking` の構造。
- 直接修正できる問題とAI修正が必要な問題を分ける設計。
- table remediationを個別領域として扱う設計。
- Goal 1の一括処理方式の参考。

注意点:

- AWS Bedrock / BDA前提であり、そのまま導入するものではない。
- PDF起点の思想が強く、CMS移行HTMLとは入力前提が異なる。
- 公共団体案件では、クラウド外部送信、個人情報、機密情報の扱いを慎重に判断する必要がある。

### 7. hatemile/hatemile-for-javascript

- URL: https://github.com/hatemile/hatemile-for-javascript
- Category: HTML accessibility conversion library
- Role: HTMLコードをよりアクセシブルなHTMLコードへ変換するライブラリ。

良い点:

- HTMLをアクセシブルに「変換する」と明言している点が本プロジェクトに近い。
- データセルと見出しセルの関連付け、labelとform fieldの関連付け、キーボード利用可能化、ナビゲーション補助などを扱う。
- DOMに対してアクセシビリティ補助を加える機能群がある。

本プロジェクトで参考にすること:

- 変換カテゴリの分け方。
- tableセルとheaderの関連付け。
- label関連付け。
- キーボード操作やナビゲーション補助を「変換対象」として扱う発想。

注意点:

- ランタイムJavaScriptでDOM補助を加える発想に近い。
- CMS登録用HTMLを静的に最適化する本プロジェクトとは実行モデルが違う。
- メンテナンス状況や現代標準への追随は確認が必要。

### 8. Community-Access/accessibility-agents

- URL: https://github.com/Community-Access/accessibility-agents
- Category: AI accessibility agents / prompts / skills
- Role: Claude Code、GitHub Copilot、Gemini CLI、Codex CLIなど向けのアクセシビリティ専門エージェント群。

良い点:

- AIツールは完全ではなく、スクリーンリーダーやキーボード操作での実検証が必要と明記している。
- Web、Document、GitHub workflow、Developer toolsなど、専門エージェントに分けている。
- WCAG AAを忘れがちなAIコーディング支援を補強する目的が明確。

本プロジェクトで参考にすること:

- AGENTを単一巨大プロンプトにしない。
- ルール領域ごとに専門化する。
- 例: `table-agent`、`link-agent`、`image-alt-agent`、`html-structure-agent`、`evidence-agent`、`review-agent`。
- AIの限界を前提に、人間確認を残す設計。

注意点:

- 既存/新規コードのレビュー支援が中心。
- 旧サイトHTMLからCMS登録HTMLへ変換する業務フローは扱っていない。

### 9. qed42/ai-accessibility-checker

- URL: https://github.com/qed42/ai-accessibility-checker
- Category: AI-powered checker
- Role: Python CLI / GitHub Actionで、OpenAIを使ってフロントエンドコードのWCAG違反と修正提案を出す。

良い点:

- WCAG 2.0、2.1、2.2、A/AA/AAAを選べる。
- HTML、CSS、JSXなどを対象にできる。
- 指摘、重要度、行番号、説明、修正提案を出す。
- GitHub Actionやpre-commit hookとして利用できる。
- READMEでコードをOpenAI APIへ送信するプライバシー注意を明記している。

本プロジェクトで参考にすること:

- 修正提案の出力形式。
- `issue title`、`type`、`severity`、`line`、`description`、`suggestion` のような証跡項目。
- API送信時の注意書きと利用許可の扱い。

注意点:

- HTMLを直接修正するより、AIに検出・提案させる方式。
- 外部API送信前提のため、自治体案件では扱いに注意が必要。
- LLM結果の検証・差し戻し・承認フローは別途必要。

### 10. microsoft/accessibility-insights-web

- URL: https://github.com/microsoft/accessibility-insights-web
- Category: browser extension / manual + automated assessment
- Role: Webサイト/アプリのアクセシビリティ評価を行うブラウザ拡張。

良い点:

- 実ブラウザ上で評価できる。
- 自動検査だけでなく、手動評価ワークフローの補助として使える。
- 作業者・承認者の確認観点を設計する参考になる。

本プロジェクトで参考にすること:

- CMS登録後のプレビュー確認。
- 承認者確認でのチェック手順。
- 自動検査と人間確認の組み合わせ。

注意点:

- CMS登録用HTMLを生成・修正するものではない。

### 11. GoogleChrome/lighthouse

- URL: https://github.com/GoogleChrome/lighthouse
- Category: browser audit / report
- Role: Webページのパフォーマンス、ベストプラクティス、SEO、アクセシビリティなどを監査する。

良い点:

- Chrome DevTools、CLI、Node moduleで使える。
- `--only-categories=accessibility` のようにアクセシビリティだけ実行できる。
- JSON、HTML、CSVなどのレポート出力が可能。
- CMS公開前プレビューの機械検査に向いている。

本プロジェクトで参考にすること:

- CMS登録後のページ単位レポート。
- 承認前の最終ゲート。
- 自動監査結果をスプレッドシート証跡へ接続する設計。

注意点:

- 修正はしない。
- Lighthouseのaccessibilityカテゴリは主にaxe-coreベースであり、手動判断が必要な項目は残る。

### 12. jsx-eslint/eslint-plugin-jsx-a11y

- URL: https://github.com/jsx-eslint/eslint-plugin-jsx-a11y
- Category: static AST checker
- Role: JSX要素に対するアクセシビリティ静的検査。

良い点:

- 開発時のアクセシビリティ欠陥を早期検出できる。
- READMEでも、静的コードだけでは不足し、レンダリングDOMや支援技術での確認と組み合わせるべきと説明している。

本プロジェクトで参考にすること:

- 静的検査とレンダリング後検査を分ける考え方。
- 将来的にCMSテンプレートやReact/JSX管理画面部品を検査する場合の参考。

注意点:

- 旧サイトHTML断片の移行・変換には直接使いにくい。

### 13. medialize/ally.js

- URL: https://github.com/medialize/ally.js
- Category: accessibility utility library
- Role: Webアプリで使うアクセシビリティ関連の機能・挙動を補助するJavaScriptライブラリ。

良い点:

- focus管理、キーボード操作、DOMアクセシビリティ挙動の補助に使える。
- CMS管理画面側や確認UI側のアクセシビリティを高める参考になる。

本プロジェクトで参考にすること:

- Goal 2の作業者向け画面を作る場合、UI自体のアクセシビリティ設計の参考。
- フォーカス制御、キーボード操作、モーダル/候補カードUIの補助。

注意点:

- 移行対象HTMLを修正するエンジンではない。

## Comparison For This Project

| Repository | 検査 | 修正 | AI | 一括処理 | ページ単位確認 | 証跡/レポート | 本プロジェクトへの近さ |
|---|---:|---:|---:|---:|---:|---:|---|
| `dequelabs/axe-core` | 高 | なし | なし | 中 | 中 | 中 | 高 |
| `pa11y/pa11y` | 高 | なし | なし | 高 | 中 | 高 | 高 |
| `squizlabs/HTML_CodeSniffer` | 高 | なし | なし | 中 | 中 | 中 | 中 |
| `Siteimprove/alfa` | 高 | なし | なし | 高 | 中 | 高 | 高 |
| `act-rules/act-rules.github.io` | ルール | なし | なし | 間接 | 間接 | 高 | 高 |
| `awslabs/content-accessibility-utility-on-aws` | 高 | 高 | 高 | 高 | 中 | 高 | 高 |
| `hatemile/hatemile-for-javascript` | 中 | 中 | なし | 低 | 低 | 低 | 中 |
| `Community-Access/accessibility-agents` | 中 | 提案 | 高 | 中 | 高 | 中 | 中 |
| `qed42/ai-accessibility-checker` | 中 | 提案 | 高 | 中 | 低 | 中 | 中 |
| `microsoft/accessibility-insights-web` | 高 | なし | なし | 低 | 高 | 中 | 中 |
| `GoogleChrome/lighthouse` | 高 | なし | なし | 高 | 中 | 高 | 中 |

## What We Should Carry Over

### From testing engines

- `axe-core` または `pa11y` を、AGENT出力HTMLの自動品質ゲートに使う。
- `violations` と `incomplete` または `needs review` を分ける。
- 検査対象をページ全体ではなく、移行対象コンテンツ領域に絞れる設計を持つ。
- ページ全体検査しかできない場合は、指摘箇所をスコープ分類し、本文領域以外の指摘を移行HTML修正候補に混ぜない。
- CMS登録後のレンダリング結果にも同じ検査を実行する。

### From rule standardization projects

- `a11y-migration-kb/` の各ルールを、検出条件、適用条件、非適用条件、要確認条件、証跡項目に分ける。
- ACT Rulesのように、ルールとツール実装を分ける。
- ルール結果を `pass`、`fail`、`cantTell`、`notApplicable` のように扱う。

### From remediation projects

- 監査と修正を分ける。
- 直接修正できるものと、AI修正が必要なものを分ける。
- AI修正は小さい対象単位に限定し、戻り値を検証する。
- バッチ処理、利用量、コスト、修正レポートを独立して記録する。

### From agent projects

- 専門エージェントに分ける。
- 例: `extract-agent`、`table-agent`、`link-agent`、`image-agent`、`text-normalize-agent`、`evidence-agent`、`review-agent`。
- AIの限界を明示し、作業者・承認者確認を品質保証工程として残す。

### From browser/manual assessment tools

- 作業者確認と承認者確認のUIは、キーボード操作やスクリーンリーダー確認を意識する。
- 自動検査では分からない項目を、確認チェックリストとして残す。
- CMSプレビューでの最終確認を品質ゲート化する。

## What Not To Copy Directly

- 「検査ツールの指摘をそのまま修正完了」とみなすこと。
- HTML全文を外部LLMへ送って丸ごと書き換えさせること。
- ランタイムJSでアクセシビリティを後付けするだけの方式。
- CMS登録構造や自治体固有ルールを無視した一般的なWebアクセシビリティ修正。
- 外部APIへ機密HTMLを送る前提の設計。
- 自動検査で拾えない項目を見落とすこと。

## Recommended Direction

本プロジェクトでは、既存OSSを次のように使い分けるのがよい。

1. Rule base
   - `a11y-migration-kb/` を正とする。
   - `a11y-migration-kb/` はコンテンツ部分に特化した移行・アクセシビリティ関連ナレッジとして扱う。
   - ACT Rules / Alfa の考え方を借り、機械実行可能なルール形式へ変換する。

2. Detection engine
   - ルールごとの独自検出を主にし、`axe-core` / `pa11y` は本文領域にスコープできる範囲で外部検査として使う。
   - ページ全体の検査結果は、本文領域の結果とテンプレート領域の結果を分けて扱う。
   - 自動検出結果をAGENT候補とスプレッドシート証跡に接続する。

3. Remediation engine
   - AWS utilityのように、直接修正とAI修正を分ける。
   - AI修正は対象DOM単位に限定する。
   - 修正後は必ずHTML構造検証とアクセシビリティ再検査を行う。

4. Review workflow
   - Goal 1では一括変換後に検査レポートと要確認候補を出す。
   - Goal 2ではページ単位で候補カードを出し、作業者が確認しながら適用する。
   - どちらも同じ候補データ構造と証跡形式を使う。

5. Quality gate
   - CriticalなHTML構造破壊、非標準タグ、table外セル、文字化け、本文外要素混入は承認不可にする。
   - 自動検査の `incomplete` / `cantTell` は作業者または承認者の確認対象にする。

## Candidate First PoC Stack

最初のPoCでは、次の組み合わせが現実的である。

- `a11y-migration-kb/`: 業務ルールの正本。
- `axe-core` または `pa11y`: 自動検査と品質ゲート。
- 独自HTML監査: `gemini-a11y-agent` の失敗モードを反映したHTML構造監査。
- 独自Candidate Engine: ルール候補、修正前後、根拠、要確認理由を出力する。
- LLM: table、リンク文言、alt、iframe titleなど、小さく限定した候補生成にのみ使用。

## Open Questions

- `axe-core` を直接使うか、`pa11y --runner axe` 経由で使うか。
- CMS登録前HTML断片と、CMS登録後プレビューHTMLのどちらを主検査対象にするか。
- 旧サイトごとに、本文領域のroot selectorや抽出条件をどの形式で管理するか。
- ページ全体検査で出た指摘を `content`、`old-site-template`、`new-cms-template`、`unknown` に分類する方法をどう定義するか。
- 外部API利用可否、送信可能データ、匿名化ルールをどう定義するか。
- ACT Rules形式に寄せるか、本プロジェクト専用の軽量ルール形式を作るか。
- Goal 2の作業者UIは、CMS内拡張、別画面、ブラウザ拡張、スプレッドシートサイドバーのどれが現実的か。

## Source Links

- https://github.com/dequelabs/axe-core
- https://github.com/pa11y/pa11y
- https://github.com/squizlabs/HTML_CodeSniffer
- https://github.com/Siteimprove/alfa
- https://github.com/act-rules/act-rules.github.io
- https://github.com/awslabs/content-accessibility-utility-on-aws
- https://github.com/hatemile/hatemile-for-javascript
- https://github.com/Community-Access/accessibility-agents
- https://github.com/qed42/ai-accessibility-checker
- https://github.com/microsoft/accessibility-insights-web
- https://github.com/GoogleChrome/lighthouse
- https://github.com/jsx-eslint/eslint-plugin-jsx-a11y
- https://github.com/medialize/ally.js
