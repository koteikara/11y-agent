---
type: migration-rule
title: 下線・打消し線・斜体
description: 下線、打消し線、斜め文字は使用しない
resource: manual://V2.01#p29
tags: [text]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
---

# 必須ルール
下線、打消し線、斜め文字は使用しない。

# 例
## ケース1: 下線の除去
```before
<u>重要</u>
```
```after
重要（下線なし。強調が必要なら太字）
```
