---
type: migration-rule
title: セル結合②見出し用途
description: 見出しとして使われている結合は、表を一部崩して見出し表示にする
resource: manual://V2.01#p39
tags: [table, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1", "2.4.1"]
jis: ["2.4.1"]
processing_class: hybrid
municipality_specific: true
cms_auto: false
origin: manual
michecker_check_ids: ["C_76.1"]
related: [/rules/html-structure/heading-required.md, /wcag/ch6-table.md]
---

# 必須ルール
見出しとして使用されている結合セルは、表を一部崩して見出しとして表示させ、必要な箇所にのみ表を使用する。

# 例
## ケース1: 結合セルが小見出し
```before
結合セルに「届出に必要なもの」、その下に表
```
```after
「届出に必要なもの」を見出し化し、必要箇所のみ表に
```
