# AI Accessibility Skills Policy

Updated: 2026-06-29

## Source

- Mark Fairchild, "AI-Generated Accessibility: An Update - Frontier Models Still Fail, but Skills Change the Game"
- URL: https://dev.to/mfairchild365/ai-generated-accessibility-an-update-frontier-models-still-fail-but-skills-change-the-game-5629

## Adopted Premise

本プロジェクトでは、AIモデルにアクセシビリティ対応を一括で任せるのではなく、次の4層で扱う。

1. プロジェクト共通の短い基本指示
2. table、iframe、画像alt、フォーム、見出し構造などの部品別Skill
3. 生成後レビュー用チェックリスト
4. 自動検証と人間確認の分離

この方針は、公共団体向けCMS移行で必要な説明責任、行政情報の意味保持、CMS入力制約、miChecker受け入れシグナルを前提に運用する。

## Common Basic Instruction

AGENTは、アクセシビリティ修正候補を生成するとき、常に次を守る。

- `a11y-migration-kb/` を主基準にする。
- コンテンツ部分だけを対象にし、テンプレート共通部品を混ぜない。
- 原文の行政情報、法的意味、日付、金額、対象者、手続き条件を不用意に変えない。
- 機械変換、AI下書き、人間確認、SV/顧客確認を分ける。
- 修正前後、修正理由、関連WCAG/JIS観点、未確定事項を証跡化する。
- 生成後レビューと検証を通るまで完了扱いにしない。

## Component Skillization Plan

部品別Skillは、1つのSkillが次を持つ形にする。

- 対象HTML/部品
- 典型的な失敗パターン
- 自動検出できる条件
- 自動修正できる条件
- AI下書きに留める条件
- 人間確認またはSV/顧客確認へ回す条件
- 修正後HTMLの許容形
- レビュー観点
- 証跡項目

### table Skill

- 対象: `table`, `caption`, `th`, `td`, `rowspan`, `colspan`
- 主な論点: caption不足、見出しセル不足、レイアウト表、セル結合、表内画像、貼り付け書式
- 自動検証: caption有無、`th`有無、セル結合有無、表内画像有無、不要属性/inline style有無
- 人間確認: 表の意味関係、行列見出しの妥当性、レイアウト表を本文へ解体した際の意味保持

### iframe Skill

- 対象: `iframe`, 埋め込み地図、動画、外部フォーム
- 主な論点: title不足、代替リンク不足、外部サービス依存、キーボード操作、CMS許可タグ
- 自動検証: `title`有無、`src`種別、CMS許可可否
- 人間確認: 埋め込みを移行対象に含めるか、外部サービスの利用方針、代替テキスト/リンクの説明妥当性

### image-alt Skill

- 対象: `img`, `figure`, `figcaption`, 画像リンク
- 主な論点: alt不足、汎用alt、captionとの重複、複雑画像、画像内文字
- 自動検証: alt属性有無、空alt、汎用語、caption重複、ファイル名由来alt
- 人間確認: 画像の意味、装飾画像か内容画像か、複雑画像の補足説明、行政情報として必要な文字情報

### form Skill

- 対象: `form`, `input`, `select`, `textarea`, `button`, `label`
- 主な論点: label不足、説明不足、エラー表示、必須項目表記、CMSフォーム機能への置換
- 自動検証: label関連付け、button名、placeholder依存、required属性、fieldset/legend有無
- 人間確認: 入力項目の意味、必須/任意の方針、個人情報送信の扱い、CMSフォーム機能で再現する範囲

### heading-structure Skill

- 対象: `h1`-`h6`, 見出し相当の本文
- 主な論点: コンテンツ内h1、見出しレベル飛ばし、見出し不足、見た目だけの見出し
- 自動検証: 見出し順序、h1有無、短い項目名パターン
- 人間確認: 文書構造としての妥当性、自治体表記、ページタイトルとの関係

## Post-Generation Review Checklist

生成後レビューでは、少なくとも次を確認する。

- 対象範囲: 修正対象がコンテンツ部分に限定されている。
- 意味保持: 日付、金額、対象者、条件、手続き名、連絡先、リンク先の意味が変わっていない。
- 構造: 見出し、リスト、表、画像、リンク、注記がCMS登録後も構造として理解できる。
- HTML: CMS入力欄で許可されるタグ/属性に収まっている。
- アクセシビリティ: 関連WCAG/JIS観点に対して改善理由が説明できる。
- miChecker: 本文コンテンツ起因の明らかな問題を残していない、または未解消理由が記録されている。
- 証跡: 修正前HTML、修正後HTML、判断理由、判断者、未確定事項が残っている。
- エスカレーション: 行政情報の意味、自治体固有ルール、顧客確認事項をAGENTが確定していない。

## Separation Of Automated Validation And Human Confirmation

| 項目 | 自動検証で扱う | 人間確認で扱う |
|---|---|---|
| HTML構文 | タグ閉じ、許可タグ候補、危険属性 | CMS入力欄での実際の許容可否 |
| 見出し | h1混入、レベル飛ばし、短い項目名 | 文書構造として正しい階層か |
| 画像alt | alt有無、空alt、汎用語、caption重複 | 画像が装飾か内容か、説明が正しいか |
| table | caption/th/セル結合/書式残り | 表として残すか、本文へ解体するか、関係が保持されるか |
| iframe | title有無、src種別 | 埋め込みを移行するか、代替リンクでよいか |
| form | label有無、button名、required | CMSフォーム機能で再構成する範囲、個人情報の扱い |
| リンク | 指示語、空href、外部/内部/PDF分類 | リンク先ページ名、内部リンク先、外部リンク可否 |
| テキスト | 全角英数字、日付、時刻、単位、通貨 | 自治体表記統一、文脈上の強調、注記整理 |

自動検証は「候補を漏らさない」「機械的に危険な状態を見つける」ために使う。人間確認は「意味を確定する」「公開情報として責任を持てる状態にする」ために使う。

