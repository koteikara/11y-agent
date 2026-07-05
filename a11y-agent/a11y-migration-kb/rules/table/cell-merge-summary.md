---
type: migration-rule
title: セル結合③概要が見出し的
description: 表組の概要が見出し的に使われている場合はキャプションに設定する
resource: manual://V2.01#p40
tags: [table, ai]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: hybrid
municipality_specific: true
cms_auto: false
related: [/rules/table/caption.md, /wcag/ch6-table.md]
---

# 必須ルール
表組の概要が見出し的に使用されている文章は、表のキャプションに設定する。

# 例
## ケース1: 概要行
```before
結合セルに表全体の概要文
```
```after
概要文をキャプションへ移動
```
