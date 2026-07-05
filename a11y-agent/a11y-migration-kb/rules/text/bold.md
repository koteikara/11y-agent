---
type: migration-rule
title: 太字
description: 移行元で太字が使われている場合は太字設定をする
resource: manual://V2.01#p20
tags: [text, mechanical]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: mechanical
municipality_specific: false
cms_auto: false
---

# 必須ルール
移行元ページで太字が使われている場合は太字設定をする。

# 例
## ケース1: 太字の保持
```before
<b>重要</b>なお知らせ
```
```after
重要（太字設定）なお知らせ
```
