---
type: migration-rule
title: 表のキャプション
description: 表にはアクセシビリティ配慮上キャプションを必須で入力する
resource: manual://V2.01#p38
tags: [table]
timestamp: 2025-12-15T00:00:00Z
wcag: ["1.3.1"]
jis: ["なし"]
processing_class: ai
municipality_specific: false
cms_auto: false
origin: manual
michecker_check_ids: ["C_25.1", "C_25.2", "C_25.3"]
related: [/wcag/ch6-table.md]
---

# 必須ルール
表のキャプションは必須。移行元に無い場合は表の内容を文章中の単語を使って入力する。セルが結合されていない表はそのまま移行可。結合表は表組をやめるか分割する（自治体指示があればそれに従う）。

# 例
## ケース1: キャプション欠落
```before
<table>（caption無し）...</table>
```
```after
<table><caption>届出に必要なもの一覧</caption>...</table>
```
