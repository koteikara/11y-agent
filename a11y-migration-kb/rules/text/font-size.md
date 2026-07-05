---
type: migration-rule
title: 文字サイズ・フォント
description: 文字サイズおよびフォントは指定しない
resource: manual://V2.01#p29
tags: [text]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.4.4"]
jis: ["1.4.4"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
related: [/wcag/ch2-site.md]
---

# 必須ルール
文字サイズおよびフォントは指定しない。

# 例
## ケース1: サイズ指定の除去
```before
<span style="font-size:18px">本文</span>
```
```after
本文（サイズ指定なし）
```
