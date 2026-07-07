---
type: migration-rule
title: フォームのlabel要素の配置
description: label要素は、ラジオボタン・チェックボックスではコントロールの後、それ以外ではコントロールの前に配置する
resource: https://accessibility.jp/resources/tools/michecker-techniques/
tags: [form, ai]
timestamp: 2026-07-07T00:00:00Z
wcag: ["3.3.2"]
jis: ["なし"]
processing_class: ai
municipality_specific: false
cms_auto: false
related: [/rules/form/submit-button.md]
---

# 必須ルール
フォーム・コントロールに対するlabel要素は、慣例に沿った位置に配置する。ラジオボタン・チェックボックスはコントロールの後に、テキスト入力等それ以外のコントロールはコントロールの前にlabelを置く。

# 例
## ケース1: チェックボックスのlabelがコントロールの前にある
```before
<label for="agree">同意する</label><input type="checkbox" id="agree">
```
```after
<input type="checkbox" id="agree"><label for="agree">同意する</label>
```

## ケース2: テキスト入力のlabelがコントロールの後にある
```before
<input type="text" id="name"><label for="name">お名前</label>
```
```after
<label for="name">お名前</label><input type="text" id="name">
```
