---
type: migration-rule
title: 文字間の不要な空白
description: 読み上げに支障が出る、文字間に空白を挟んだ表記（見出し・alt属性・ボタン文言等）を修正する
resource: https://accessibility.jp/resources/tools/michecker-techniques/
tags: [text, mechanical]
timestamp: 2026-07-07T00:00:00Z
wcag: ["1.3.2"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
related: [/rules/image/alt-text.md, /wcag/ch5-text.md]
---

# 必須ルール
見出し・本文・画像のalt属性・ボタン文言等で、文字間に空白を挟んで見た目を整える表記（例:「お  知  ら  せ」）は、読み上げソフトが単語として正確に読み上げられなくなるため使用しない。見た目の間隔調整はCSSの文字間隔（letter-spacing）等で行う。

# 例
## ケース1: 見出し・本文の文字間空白
```before
お  知  ら  せ
```
```after
お知らせ（間隔調整が必要な場合はCSSのletter-spacingで表現）
```

## ケース2: 画像のalt属性
```before
alt="お  知  ら  せ"
```
```after
alt="お知らせ"
```
ポイント: 単語のつづりを説明する目的（アルファベットの綴りを1文字ずつ示す等）で意図的に区切っている場合は対象外。
