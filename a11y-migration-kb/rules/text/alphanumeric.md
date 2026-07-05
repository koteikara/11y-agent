---
type: migration-rule
title: 全角英数字
description: 全角英数字を半角英数字に修正する
resource: manual://V2.01#p28
tags: [text, mechanical]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.1.1"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: true
---

# 必須ルール
全角英数字は半角英数字に修正する（禁則文字として自動変換される）。

# 例
## ケース1: 全角→半角
```before
ＡＢＣ１２３
```
```after
ABC123
```
