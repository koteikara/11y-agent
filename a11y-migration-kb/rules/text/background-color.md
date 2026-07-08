---
type: migration-rule
title: 背景色
description: 装飾目的の背景色は移行しない（CMSで変更不可）
resource: manual://V2.01#p20
tags: [text]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.4.3"]
jis: ["1.4.3"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
origin: manual
michecker_check_ids: ["C_500.13", "C_500.16", "C_500.18"]
related: [/wcag/ch2-site.md]
---

# 必須ルール
CMSではコントラスト比保持のため背景色は変更できない。装飾のための背景色は移行しない。

# 例
## ケース1: 背景色の除去
```before
<td style="background:#ffff00">注目</td>
```
```after
注目（背景色なし）
```
