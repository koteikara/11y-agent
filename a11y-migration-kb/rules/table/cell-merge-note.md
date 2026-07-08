---
type: migration-rule
title: セル結合④注意書き
description: 表の中に書かれた注意書きは表の外に表示させる
resource: manual://V2.01#p41
tags: [table, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: true
cms_auto: false
origin: manual
michecker_check_ids: ["C_76.1"]
related: [/wcag/ch6-table.md]
---

# 必須ルール
表の中に書かれている注意書きは、表の外に表示させる。

# 例
## ケース1: 表内の注意書き
```before
結合セルに「※申込は先着順」
```
```after
「※申込は先着順」を表の外（本文）へ
```
