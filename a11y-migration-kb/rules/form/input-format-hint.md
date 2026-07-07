---
type: migration-rule
title: 入力形式・入力例のヒント提供
description: 全角・半角やハイフンの要否など、求められる入力形式・入力例をフォームの前に明記する
resource: https://github.com/eclipse-actf/org.eclipse.actf/blob/master/org.eclipse.actf.validation.html/resources/checkitem.xml
tags: [form, ai]
timestamp: 2026-07-07T00:00:00Z
wcag: ["3.3.5"]
jis: ["なし"]
processing_class: ai
municipality_specific: false
cms_auto: false
origin: michecker
michecker_check_ids: ["C_78.2", "C_389.0"]
related: [/rules/text/tel-fax.md]
---

# 必須ルール
入力形式（全角・半角、ハイフンの要否等）や入力例が必要なフォーム項目には、テキスト・フィールドの前に説明文または入力例を記載する。

# 例
## ケース1: 入力形式の説明が無い
```before
<label for="tel">電話番号</label>
<input type="tel" id="tel">
```
```after
<label for="tel">電話番号（例: 03-1234-5678、半角ハイフンあり）</label>
<input type="tel" id="tel">
```
ポイント: `text/tel-fax.md`の電話・FAX表記ルールとあわせて、入力欄側にも同じ形式を案内する。
