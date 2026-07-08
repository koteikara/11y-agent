---
type: migration-rule
title: セル結合⑥●印での該当表現
description: ●等でどこに該当するかを表現している表は、見出しと文章で構成する
resource: manual://V2.01#p43
tags: [table, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1", "1.4.1"]
jis: ["1.4.1"]
processing_class: hybrid
municipality_specific: true
cms_auto: false
origin: manual
michecker_check_ids: ["C_76.1"]
related: [/rules/text/color.md, /wcag/ch6-table.md]
---

# 必須ルール
表組の中に●などでどこに該当させるかを表現している場合は、表を崩し見出しと文章で構成する。

# 例
## ケース1: ●印での対応表現
```before
行×列の交点に●を置いて該当を示す
```
```after
見出し＋文章で「○○は△△が対象」と明記
```
